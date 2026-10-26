import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAnswers, questionsForPhase, preQuestions, postQuestions } from '../src/lesson/assessment.ts';
import type { AssessmentPhase, Concept } from '../src/lesson/assessment.ts';
import { frac, sum, sub, seconds, div } from '../src/domain/index.ts';

const concepts: Concept[] = ['equivalence', 'bar-total', 'rest-time', 'tempo-ratio', 'length-properties'];
const preKey = {
  'pre-equivalence': 'four', 'pre-bar-total': 'full', 'pre-rest-time': 'continue',
  'pre-tempo-ratio': 'same-ratio', 'pre-length-properties': 'length-only',
};
const postKey = {
  'post-equivalence': 'four', 'post-bar-total': 'eighth-left', 'post-rest-time': 'two-seconds',
  'post-tempo-ratio': 'two-to-four', 'post-length-properties': 'half-length',
};

test('pre and post each contain exactly five distinct concepts and question IDs', () => {
  assert.equal(preQuestions.length, 5);
  assert.equal(postQuestions.length, 5);
  assert.equal(new Set([...preQuestions, ...postQuestions].map(question => question.id)).size, 10);
  for (const phase of ['pre', 'post'] as const) {
    const questions = questionsForPhase(phase);
    assert.deepEqual(questions.map(question => question.concept).sort(), [...concepts].sort());
    for (const question of questions) {
      assert.equal(new Set(question.options.map(option => option.id)).size, question.options.length);
      assert.equal(question.options.filter(option => option.id === question.correctOptionId).length, 1);
      assert.ok(question.prompt.length > 0);
      assert.ok(question.explanation.length > 0);
    }
  }
});

test('post uses alternate expressions or numbers for the same five concepts', () => {
  for (const before of preQuestions) {
    const after = postQuestions.find(question => question.concept === before.concept);
    assert.ok(after);
    assert.notEqual(before.prompt, after.prompt);
    assert.notEqual(before.explanation, after.explanation);
  }
});

test('fixed pre answers yield five correct and a complete response summary', () => {
  const result = assessAnswers('pre', preKey);
  assert.equal(result.phase, 'pre');
  assert.equal(result.total, 5);
  assert.equal(result.answered, 5);
  assert.equal(result.correct, 5);
  assert.equal(result.complete, true);
  assert.ok(result.results.every(item => item.answered && item.correct));
});

test('fixed post answers yield five correct and no inferred educational efficacy', () => {
  const result = assessAnswers('post', postKey);
  assert.equal(result.correct, 5);
  assert.equal(result.complete, true);
  assert.deepEqual(Object.keys(result).sort(), ['answered', 'complete', 'correct', 'phase', 'results', 'total']);
});

test('missing answers remain unanswered; valid wrong choices are answered but incorrect', () => {
  const blank = assessAnswers('pre', {});
  assert.equal(blank.answered, 0);
  assert.equal(blank.correct, 0);
  assert.equal(blank.complete, false);
  const mixed = assessAnswers('pre', { 'pre-equivalence': 'four', 'pre-rest-time': 'stop' });
  assert.equal(mixed.answered, 2);
  assert.equal(mixed.correct, 1);
  assert.equal(mixed.complete, false);
  assert.equal(mixed.results.find(item => item.questionId === 'pre-rest-time')?.correct, false);
});

test('unknown choices, unrelated keys and inherited answers do not count', () => {
  const inherited = Object.create({ 'pre-equivalence': 'four' });
  inherited['pre-bar-total'] = 'not-a-choice';
  inherited['post-rest-time'] = 'two-seconds';
  const result = assessAnswers('pre', inherited);
  assert.equal(result.answered, 0);
  assert.equal(result.correct, 0);
  assert.ok(result.results.every(item => item.selectedOptionId === null));
});

test('assessment is pure and phase switching cannot reuse another phase answer key', () => {
  const before = JSON.stringify(preKey);
  const a = assessAnswers('pre', preKey);
  const b = assessAnswers('pre', preKey);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(preKey), before);
  assert.equal(assessAnswers('post', preKey).answered, 0);
  assert.equal(assessAnswers('pre', postKey).answered, 0);
});

test('changing a previously correct choice recomputes current correctness', () => {
  const changed = { ...postKey, 'post-bar-total': 'full' };
  assert.equal(assessAnswers('post', postKey).correct, 5);
  assert.equal(assessAnswers('post', changed).correct, 4);
  assert.equal(assessAnswers('post', changed).complete, true);
});

test('numeric music facts underlying the alternate questions use exact domain math', () => {
  assert.deepEqual(div(frac(1, 2), frac(1, 8)), frac(4));
  assert.deepEqual(div(frac(1, 4), frac(1, 16)), frac(4));
  assert.deepEqual(sum([frac(1, 2), frac(1, 4), frac(1, 8), frac(1, 8)]), frac(1));
  assert.deepEqual(sub(frac(1), sum([frac(1, 4), frac(1, 4), frac(1, 4), frac(1, 8)])), frac(1, 8));
  assert.equal(seconds(frac(1, 2), { bpm: 60, unit: frac(1, 4) }), 2);
  assert.equal(seconds(frac(1), { bpm: 120, unit: frac(1, 4) }), 2);
  assert.equal(seconds(frac(1), { bpm: 60, unit: frac(1, 4) }), 4);
  assert.deepEqual(div(frac(1, 16), frac(1, 8)), frac(1, 2));
});

test('unsupported phase is explicitly rejected', () => {
  assert.throws(() => questionsForPhase('future' as AssessmentPhase), RangeError);
});
