import type { Fraction, Pitch, Notation } from '../domain/index.ts';

export type SceneId = 'scene-1' | 'scene-2' | 'scene-3' | 'scene-4' | 'scene-5' | 'scene-6';
export type MusicEvent = Readonly<{
  id: string;
  onset: Fraction;
  duration: Fraction;
  notation: Notation;
}> & (Readonly<{ kind: 'note'; pitch: Pitch }> | Readonly<{ kind: 'rest'; pitch?: never }>);
export type Lane = Readonly<{ laneId: string; label: string; role: 'reference' | 'draft'; events: readonly MusicEvent[] }>;
export type Task = Readonly<{ target: Fraction; minimumDurationKinds?: number; minimumRests?: number; onlyDuration?: Fraction }>;
export type Question = Readonly<{ id: string; prompt: string; options: readonly Readonly<{ value: string; label: string }>[]; correctValue: string; explanation: string }>;
export type SceneDefinition = Readonly<{
  sceneId: SceneId; title: string; goal: string; question: string; instructions: string;
  meter: Readonly<{ numerator: number; denominator: number; groups: readonly number[] }>;
  tempo: Readonly<{ bpm: number; unit: Fraction }>;
  lanes: readonly Lane[]; task: Task; questions: readonly Question[];
  teacherGuide: Readonly<{ misconception: string; answer: string; demonstration: string; extension4: string; extension5: string }>;
  alternative: string; completion: string; audio: Readonly<{ instrument: 'prototype-synth'; narrationAssetId: null; backgroundMusicAssetId: null }>;
}>;
export type LessonContent = Readonly<{
  schemaVersion: '2.0.0'; contentVersion: '1.0.0'; lessonId: 'duration-basics'; locale: 'ko-KR';
  title: string; pitchConvention: 'C4=MIDI60'; scenes: readonly SceneDefinition[];
}>;
