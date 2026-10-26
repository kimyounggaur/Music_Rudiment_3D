import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { assessAnswers, questionsForPhase } from '../lesson/assessment.ts';
import type { AssessmentPhase, AssessmentResult } from '../lesson/assessment.ts';

export type ConceptQuizProps = {
  onRecord?: (id: string, correct: boolean) => void;
};

/** Inline native controls preserve keyboard access without an extra modal layer. */
export function ConceptQuiz({ onRecord }: ConceptQuizProps) {
  const instanceId = useId();
  const [phase, setPhase] = useState<AssessmentPhase>('pre');
  const [answers, setAnswers] = useState<Record<AssessmentPhase, Record<string, string>>>({ pre: {}, post: {} });
  const [checked, setChecked] = useState<Partial<Record<AssessmentPhase, AssessmentResult>>>({});
  const questions = questionsForPhase(phase);
  const result = checked[phase];
  const phaseLabel = phase === 'pre' ? '사전' : '사후';

  function choose(questionId: string, optionId: string) {
    setAnswers(previous => ({ ...previous, [phase]: { ...previous[phase], [questionId]: optionId } }));
    // A changed response invalidates its old feedback; the learner checks again.
    setChecked(previous => ({ ...previous, [phase]: undefined }));
  }

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = assessAnswers(phase, answers[phase]);
    setChecked(previous => ({ ...previous, [phase]: next }));
    for (const item of next.results) {
      if (item.answered) onRecord?.(item.questionId, item.correct);
    }
  }

  return (
    <section className="concept-quiz" aria-label="사전·사후 개념 확인">
      <details>
        <summary style={{ minHeight: 44, cursor: 'pointer', paddingBlock: 10 }}>사전·사후 개념 확인</summary>
        <p id={`${instanceId}-instructions`}>각 묶음은 5문항입니다. 답을 고른 뒤 정답 확인을 누르세요. 소리 없이 답할 수 있습니다.</p>
        <div role="group" aria-label="문항 묶음 선택" className="quiz-phase-buttons">
          <button type="button" aria-pressed={phase === 'pre'} onClick={() => setPhase('pre')} style={{ minHeight: 44 }}>사전 5문항</button>
          <button type="button" aria-pressed={phase === 'post'} onClick={() => setPhase('post')} style={{ minHeight: 44 }}>사후 5문항</button>
        </div>
        <form onSubmit={check} aria-label={`${phaseLabel} 5문항`} aria-describedby={`${instanceId}-instructions`}>
          {questions.map((question, index) => {
            const feedback = result?.results.find(item => item.questionId === question.id);
            const feedbackId = `${instanceId}-${question.id}-feedback`;
            return (
              <fieldset key={question.id} className="quiz-question" aria-describedby={feedback ? feedbackId : undefined} style={{ minWidth: 0, marginBlock: 16 }}>
                <legend>{index + 1}. {question.prompt}</legend>
                {question.options.map(option => (
                  <label key={option.id} className="quiz-option" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, paddingBlock: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`${instanceId}-${question.id}`}
                      value={option.id}
                      checked={answers[phase][question.id] === option.id}
                      onChange={() => choose(question.id, option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                {feedback && (
                  <p id={feedbackId} className={feedback.correct ? 'quiz-feedback quiz-correct' : 'quiz-feedback'}>
                    {!feedback.answered ? '아직 답을 고르지 않았어요.' : `${feedback.correct ? '맞았어요.' : '다시 확인해 보세요.'} ${feedback.explanation}`}
                  </p>
                )}
              </fieldset>
            );
          })}
          <button type="submit" style={{ minHeight: 44 }}>정답 확인</button>
          {result && (
            <div className="quiz-summary" role="status" aria-live="polite" aria-atomic="true">
              <p>{phaseLabel} 5문항 중 {result.answered}문항에 답했고, {result.correct}문항이 맞았습니다.</p>
              {!result.complete && <p>남은 문항을 고른 뒤 다시 확인할 수 있습니다.</p>}
              <p>현재 문항 응답의 요약입니다.</p>
            </div>
          )}
        </form>
      </details>
    </section>
  );
}
