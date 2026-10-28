import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh } from 'three';
import { PAPER_POPUP_SCENES, SceneHost } from '../src/book/SceneHost.ts';
import type { PreparedScene, SceneDefinition, SceneHostEvent } from '../src/book/SceneHost.ts';
import type { BookToken } from '../src/book/controller.ts';

const token = (sequence = 1): BookToken => ({ bookEpoch: 0, navigationToken: sequence, sceneInstanceId: sequence });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function resource(name: string) {
  const group = new Group();
  group.name = name;
  let disposals = 0;
  return { group, dispose() { disposals += 1; group.removeFromParent(); }, get disposals() { return disposals; } };
}
function definition(scene: PreparedScene, sceneId = scene.group.name): SceneDefinition {
  return { sceneId, load: () => scene };
}
function fixture() {
  let current = token();
  const attached: (Group | null)[] = [];
  const stops: string[] = [];
  const reports: SceneHostEvent[] = [];
  const stage = new Group();
  let invalidations = 0;
  const host = new SceneHost({
    attach(group) { stage.clear(); if (group) stage.add(group); attached.push(group); },
    invalidate() { invalidations += 1; },
    stopAudio(reason) { stops.push(reason); },
    isCurrent(candidate) { return JSON.stringify(candidate) === JSON.stringify(current); },
    report(event) { reports.push(event); },
  });
  return { host, attached, stops, reports, stage, current: () => current,
    advance(sequence: number) { current = token(sequence); return current; },
    invalidations: () => invalidations };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('load and attach stay input-blocked until the separate entry completion barrier', async () => {
  const f = fixture();
  const prepared = resource('first');
  const result = await f.host.replace(definition(prepared), f.current());
  assert.equal(result, 'ready');
  assert.equal(f.host.getSnapshot().phase, 'entering');
  assert.equal(f.host.getSnapshot().inputBlocked, true);
  assert.equal(f.host.markReady(token(8)), false);
  assert.equal(f.host.markReady(f.current()), true);
  assert.equal(f.host.getSnapshot().inputBlocked, false);
  assert.equal(f.host.markReady(f.current()), false);
  assert.deepEqual(f.reports.map(event => event.type), ['load', 'attached', 'ready']);
  assert.equal(f.invalidations(), 1);
  f.host.dispose();
});

test('entry then next invalidates old completion and detaches the old owner before attaching the next', async () => {
  const f = fixture();
  const first = resource('first'), second = resource('second');
  const firstToken = f.current();
  await f.host.replace(definition(first), firstToken);
  f.advance(2);
  f.host.exit('navigate');
  assert.equal(f.host.markReady(firstToken), false);
  assert.equal(f.host.getSnapshot().inputBlocked, true);
  assert.equal(first.disposals, 0);
  assert.deepEqual(f.stage.children, [first.group]);
  await f.host.replace(definition(second), f.current());
  assert.deepEqual(f.attached, [first.group, null, second.group]);
  assert.equal(first.disposals, 1);
  assert.equal(f.host.getSnapshot().activeCount, 1);
  assert(f.reports.every(event => event.activeCount <= 1 && event.pendingCount <= 1));
  f.host.dispose();
});

test('exit then cancel rebuilds the same snapshot with a fresh instance and keeps audio stopped', async () => {
  const f = fixture();
  const snapshot = Object.freeze({ splitCount: 2 });
  const loaded: object[] = [];
  const scenes: ReturnType<typeof resource>[] = [];
  const def: SceneDefinition = { sceneId: 'scene-2', load() { loaded.push(snapshot); const scene = resource('second'); scenes.push(scene); return scene; } };
  const oldToken = f.current();
  await f.host.replace(def, oldToken);
  f.host.markReady(oldToken);
  f.advance(2);
  f.host.exit('navigate');
  f.advance(3);
  await f.host.replace(def, f.current());
  assert.equal(f.host.markReady(oldToken), false);
  assert.equal(f.host.markReady(f.current()), true);
  assert.deepEqual(loaded, [snapshot, snapshot]);
  assert.equal(scenes[0].disposals, 1);
  assert(f.stops.includes('navigate'));
  f.host.dispose();
});

test('A pending -> B attached -> late A only releases A without detaching B', async () => {
  const f = fixture();
  const pending = deferred<PreparedScene>();
  let signal: AbortSignal | undefined;
  const a = resource('A'), b = resource('B');
  const first = f.host.replace({ sceneId: 'A', load(value) { signal = value; return pending.promise; } }, f.current());
  await flush();
  f.advance(2);
  const second = f.host.replace(definition(b), f.current());
  assert.equal(await first, 'aborted');
  assert.equal(signal?.aborted, true);
  assert.equal(await second, 'ready');
  pending.resolve(a);
  await flush();
  assert.equal(a.disposals, 1);
  assert.equal(b.disposals, 0);
  assert.deepEqual(f.attached, [b.group]);
  assert.deepEqual(f.stage.children, [b.group]);
  assert.deepEqual([f.host.getSnapshot().loadsInFlight, f.host.getSnapshot().preparedCount, f.host.getSnapshot().disposedCount], [0, 2, 1]);
  f.host.dispose();
});

test('a token that becomes stale during load cannot attach or become ready', async () => {
  const f = fixture();
  const pending = deferred<PreparedScene>();
  const prepared = resource('stale');
  const result = f.host.replace({ sceneId: 'stale', load: () => pending.promise }, f.current());
  f.advance(2);
  pending.resolve(prepared);
  assert.equal(await result, 'stale');
  assert.equal(prepared.disposals, 1);
  assert.equal(f.attached.length, 0);
  assert.equal(f.host.getSnapshot().inputBlocked, true);
  f.host.dispose();
});

test('navigation between preparation and attachment releases the stale owner and clears pending state', async () => {
  const f = fixture();
  const prepared = resource('prepared-before-navigation');
  const operation = f.host.replace({ sceneId: prepared.group.name, load() {
    // The first microtask lets preparation finish; the second changes the book
    // token before replace resumes from its load/cancel race.
    queueMicrotask(() => queueMicrotask(() => f.advance(2)));
    return prepared;
  } }, f.current());
  assert.equal(await operation, 'stale');
  assert.equal(prepared.disposals, 1);
  assert.equal(f.attached.length, 0);
  assert.equal(f.host.getSnapshot().phase, 'idle');
  assert.equal(f.host.getSnapshot().pendingCount, 0);
  assert.equal(f.host.getSnapshot().loadsInFlight, 0);
  assert.equal(f.host.getSnapshot().activeCount, 0);
  assert.equal(f.host.getSnapshot().inputBlocked, true);
  assert.equal(f.reports.at(-1)?.type, 'stale');
  const next = resource('new-current');
  assert.equal(await f.host.replace(definition(next), f.current()), 'ready');
  assert.equal(f.host.markReady(f.current()), true);
  f.host.dispose();
  assert.equal(prepared.disposals, 1);
  assert.equal(next.disposals, 1);
});

test('a stale allocation cleanup failure is reported without retaining a completed loading phase', async () => {
  const f = fixture();
  const pending = deferred<PreparedScene>();
  let disposals = 0;
  const operation = f.host.replace({ sceneId: 'stale-cleanup-failure', load: () => pending.promise }, f.current());
  await flush();
  f.advance(2);
  pending.resolve({ group: new Group(), dispose() { disposals += 1; throw new Error('cleanup-failed'); } });
  assert.equal(await operation, 'stale');
  assert.equal(disposals, 1);
  assert.equal(f.host.getSnapshot().phase, 'idle');
  assert.equal(f.host.getSnapshot().pendingCount, 0);
  assert.equal(f.host.getSnapshot().loadsInFlight, 0);
  assert.equal(f.host.getSnapshot().cleanupFailures, 1);
  assert.equal(f.reports.find(event => event.type === 'cleanup-error')?.reason, 'cleanup-failed');
  f.host.dispose();
});

test('a stale replace request cannot stop or replace the current live scene', async () => {
  const f = fixture();
  const prepared = resource('current');
  await f.host.replace(definition(prepared), f.current());
  f.host.markReady(f.current());
  const stops = f.stops.length;
  let called = false;
  assert.equal(await f.host.replace({ sceneId: 'old', load() { called = true; return resource('wrong'); } }, token(0)), 'stale');
  assert.equal(called, false);
  assert.equal(f.stops.length, stops);
  assert.equal(f.host.getSnapshot().inputBlocked, false);
  assert.deepEqual(f.stage.children, [prepared.group]);
  f.host.dispose();
});

test('close abort settles immediately and a later returned allocation is released once', async () => {
  const f = fixture();
  const pending = deferred<PreparedScene>();
  const prepared = resource('late-close');
  const operation = f.host.replace({ sceneId: 'late-close', load: () => pending.promise }, f.current());
  await flush();
  f.host.exit('close');
  f.host.clear('closed');
  assert.equal(await operation, 'aborted');
  assert.equal(f.host.getSnapshot().loadsInFlight, 1);
  pending.resolve(prepared);
  await flush();
  assert.equal(prepared.disposals, 1);
  assert.equal(f.attached.length, 0);
  assert.equal(f.host.getSnapshot().phase, 'idle');
  assert.equal(f.host.getSnapshot().loadsInFlight, 0);
  f.host.dispose();
});

test('hide during turn stops audio and releases the retained source without enabling input', async () => {
  const f = fixture();
  const scene = resource('source');
  await f.host.replace(definition(scene), f.current());
  f.host.markReady(f.current());
  f.host.exit('drag');
  assert.equal(scene.disposals, 0);
  f.host.clear('hidden');
  assert.equal(scene.disposals, 1);
  assert.equal(f.host.getSnapshot().activeCount, 0);
  assert.equal(f.host.getSnapshot().inputBlocked, true);
  assert.equal(f.stops.at(-1), 'hidden');
  f.host.dispose();
});

test('context loss during entry releases resources; recovery may reuse the host with a new token', async () => {
  const f = fixture();
  const first = resource('lost'), recovered = resource('recovered');
  const old = f.current();
  await f.host.replace(definition(first), old);
  f.host.clear('context-loss');
  assert.equal(f.host.markReady(old), false);
  assert.equal(first.disposals, 1);
  f.advance(2);
  await f.host.replace(definition(recovered), f.current());
  assert.equal(f.host.markReady(f.current()), true);
  assert.equal(f.host.getSnapshot().activeCount, 1);
  f.host.dispose();
});

test('dispose is terminal and idempotent, and also cleans a loader that ignores abort', async () => {
  const f = fixture();
  const pending = deferred<PreparedScene>();
  const prepared = resource('late-dispose');
  const operation = f.host.replace({ sceneId: 'late-dispose', load: () => pending.promise }, f.current());
  await flush();
  f.host.dispose();
  f.host.dispose();
  assert.equal(await operation, 'aborted');
  pending.resolve(prepared);
  await flush();
  assert.equal(prepared.disposals, 1);
  assert.equal(f.host.getSnapshot().phase, 'disposed');
  assert.equal(f.host.getSnapshot().activeCount, 0);
  assert.equal(f.stops.filter(reason => reason === 'scene-host-dispose').length, 1);
  let called = false;
  assert.equal(await f.host.replace({ sceneId: 'never', load() { called = true; return resource('never'); } }, f.current()), 'aborted');
  assert.equal(called, false);
});

test('an audio stop failure cannot prevent terminal scene cleanup', async () => {
  const scene = resource('owned-at-audio-failure');
  const stage = new Group();
  const host = new SceneHost({
    attach(group) { stage.clear(); if (group) stage.add(group); },
    invalidate() {}, isCurrent: () => true,
    stopAudio(reason) { if (reason === 'scene-host-dispose') throw new Error('audio-stop-failed'); },
  });
  await host.replace(definition(scene), token());
  assert.throws(() => host.dispose(), /audio-stop-failed/);
  host.dispose();
  assert.equal(scene.disposals, 1);
  assert.equal(stage.children.length, 0);
  assert.equal(host.getSnapshot().activeCount, 0);
  assert.equal(host.getSnapshot().phase, 'disposed');
});

test('an audio stop failure still aborts a pending loader and releases its late allocation', async () => {
  const pending = deferred<PreparedScene>();
  const scene = resource('late-at-audio-failure');
  let signal: AbortSignal | undefined;
  const host = new SceneHost({
    attach() {}, invalidate() {}, isCurrent: () => true,
    stopAudio(reason) { if (reason === 'scene-host-dispose') throw new Error('audio-stop-failed'); },
  });
  const operation = host.replace({ sceneId: scene.group.name, load(value) { signal = value; return pending.promise; } }, token());
  await flush();
  assert.throws(() => host.dispose(), /audio-stop-failed/);
  assert.equal(signal?.aborted, true);
  assert.equal(host.getSnapshot().pendingCount, 0);
  assert.equal(await operation, 'aborted');
  pending.resolve(scene);
  await flush();
  assert.equal(scene.disposals, 1);
  assert.equal(host.getSnapshot().loadsInFlight, 0);
  assert.equal(host.getSnapshot().phase, 'disposed');
});

test('live owner is released once across repeated exit, clear and dispose calls', async () => {
  const f = fixture();
  const prepared = resource('owned');
  await f.host.replace(definition(prepared), f.current());
  f.host.exit('navigate'); f.host.exit('close');
  f.host.clear('closed'); f.host.clear('hidden');
  f.host.dispose(); f.host.dispose();
  assert.equal(prepared.disposals, 1);
  assert.equal(f.host.getSnapshot().disposedCount, 1);
  assert.deepEqual(f.attached, [prepared.group, null]);
});

test('current load failure rejects for fallback; stale rejection cannot fail the new scene', async () => {
  const f = fixture();
  await assert.rejects(f.host.replace({ sceneId: 'bad', load() { throw new Error('load-failed'); } }, f.current()), /load-failed/);
  assert.equal(f.host.getSnapshot().phase, 'error');
  assert.equal(f.host.getSnapshot().inputBlocked, true);
  const pending = deferred<PreparedScene>();
  f.advance(2);
  const old = f.host.replace({ sceneId: 'old', load: () => pending.promise }, f.current());
  await flush();
  f.advance(3);
  await f.host.replace(definition(resource('new')), f.current());
  assert.equal(await old, 'aborted');
  pending.reject(new Error('obsolete-load-error'));
  await flush();
  assert.equal(f.host.getSnapshot().phase, 'entering');
  assert.equal(f.reports.filter(event => event.type === 'error').length, 1);
  f.host.dispose();
});

test('attach failure releases the allocation and leaves input blocked', async () => {
  const scene = resource('attach-failure');
  const reports: SceneHostEvent[] = [];
  const host = new SceneHost({ attach(group) { if (group) throw new Error('attach-failed'); },
    invalidate() {}, stopAudio() {}, isCurrent: () => true, report: event => reports.push(event) });
  await assert.rejects(host.replace(definition(scene), token()), /attach-failed/);
  assert.equal(scene.disposals, 1);
  assert.equal(host.getSnapshot().activeCount, 0);
  assert.equal(host.getSnapshot().inputBlocked, true);
  assert.equal(host.getSnapshot().phase, 'error');
  assert.equal(reports.filter(event => event.type === 'error').length, 1);
  host.dispose();
});

test('inspection registry is restricted to the first two spreads and owns real geometry/material disposal', async () => {
  assert.deepEqual(Object.keys(PAPER_POPUP_SCENES), ['spread-1', 'spread-2']);
  for (const def of Object.values(PAPER_POPUP_SCENES)) {
    const scene = await def.load(new AbortController().signal);
    assert.equal(scene.group.children.length, 2);
    const mesh = scene.group.children[0] as Mesh;
    assert(!Array.isArray(mesh.material));
    let geometryDisposals = 0, materialDisposals = 0;
    mesh.geometry.addEventListener('dispose', () => { geometryDisposals += 1; });
    mesh.material.addEventListener('dispose', () => { materialDisposals += 1; });
    const stage = new Group(); stage.add(scene.group);
    scene.dispose(); scene.dispose();
    assert.equal(geometryDisposals, 1);
    assert.equal(materialDisposals, 1);
    assert.equal(scene.group.children.length, 0);
    assert.equal(stage.children.length, 0);
    const aborted = new AbortController(); aborted.abort();
    assert.throws(() => def.load(aborted.signal), { name: 'AbortError' });
  }
});
