import { lessonContent } from '../src/content/lesson.ts';
import { validateLessonContent } from '../src/content/validation.ts';

const result = validateLessonContent(lessonContent);
if (!result.valid) {
  console.error(JSON.stringify({ status: 'failed', errors: result.errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ status: 'passed', lessonId: lessonContent.lessonId, schemaVersion: lessonContent.schemaVersion, contentVersion: lessonContent.contentVersion, scenes: lessonContent.scenes.length, lanes: lessonContent.scenes.reduce((n, scene) => n + scene.lanes.length, 0) }));
}
