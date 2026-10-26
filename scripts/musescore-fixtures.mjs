import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

// Independent author-created fixture data, not a transcription of any user score.
// No renderer, network, subprocess or font extraction is performed by this script.
const out = resolve('output/notation');
await mkdir(out, { recursive: true });
const values = [
  ['whole', 1, 16, 'whole'], ['half', 2, 8, 'half'], ['quarter', 4, 4, 'quarter'],
  ['eighth', 8, 2, 'eighth'], ['sixteenth', 16, 1, '16th'],
];
const manifest = [];
function document(name, notes) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>${name}</work-title></work>
  <identification><encoding><software>3D Music Theory Lab fixture generator</software></encoding></identification>
  <part-list><score-part id="P1"><part-name>Rhythm</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
${notes.join('\n')}
    <barline location="right"><bar-style>light-heavy</bar-style></barline>
  </measure></part>
</score-partwise>
`;
}
function note(id, kind, duration, type, beam = '') {
  const body = kind === 'note' ? '<pitch><step>C</step><alter>0</alter><octave>4</octave></pitch>'
    : type === 'whole' ? '<rest measure="yes"/>' : '<rest/>';
  return `    <note id="${id}">${body}<duration>${duration}</duration><voice>1</voice><type>${type}</type>${kind === 'note' && type !== 'whole' ? '<stem>up</stem>' : ''}${beam}</note>`;
}
for (const kind of ['note', 'rest']) for (const [name, count, duration, type] of values) {
  const fixtureId = `${kind}-${name}-c4-treble-4-4`;
  const notes = Array.from({ length: count }, (_, i) => {
    let beam = '';
    if (kind === 'note' && count >= 8) {
      const perBeat = count / 4;
      const position = i % perBeat;
      const state = position === 0 ? 'begin' : position === perBeat - 1 ? 'end' : 'continue';
      beam = `<beam number="1">${state}</beam>${count === 16 ? `<beam number="2">${state}</beam>` : ''}`;
    }
    return note(`${fixtureId}-e${i + 1}`, kind, duration, type, beam);
  });
  const filename = `${fixtureId}.musicxml`;
  await writeFile(resolve(out, filename), document(fixtureId, notes), 'utf8');
  manifest.push({ fixtureId, file: filename, eventCount: count, noteCount: kind === 'note' ? count : 0,
    restCount: kind === 'rest' ? count : 0, divisionsPerQuarter: 4, totalDurationDivisions: 16,
    pitch: kind === 'note' ? 'C4' : null, clef: 'G2', meter: '4/4', rendererStatus: 'not-executed' });
}
const mixedId = 'scene6-half-note-quarter-rest-two-eighth-notes';
const mixed = [note(`${mixedId}-e1`, 'note', 8, 'half'), note(`${mixedId}-e2`, 'rest', 4, 'quarter'),
  note(`${mixedId}-e3`, 'note', 2, 'eighth', '<beam number="1">begin</beam>'),
  note(`${mixedId}-e4`, 'note', 2, 'eighth', '<beam number="1">end</beam>')];
await writeFile(resolve(out, `${mixedId}.musicxml`), document(mixedId, mixed), 'utf8');
manifest.push({ fixtureId: mixedId, file: `${mixedId}.musicxml`, eventCount: 4, noteCount: 3, restCount: 1,
  divisionsPerQuarter: 4, totalDurationDivisions: 16, pitch: 'C4', clef: 'G2', meter: '4/4', rendererStatus: 'not-executed' });
await writeFile(resolve(out, 'fixture-manifest.json'), JSON.stringify({
  source: 'independently-authored', musicxmlVersion: '4.0', fixtureCount: manifest.length,
  schemaValidation: 'not-executed', rendererValidation: 'not-executed',
  references: ['https://www.w3.org/2021/06/musicxml40/tutorial/hello-world/', 'https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/beam/'],
  fixtures: manifest,
}, null, 2) + '\n', 'utf8');
console.log(`Wrote ${manifest.length} independent MusicXML fixtures to ${relative(process.cwd(), out)}. No rendering or XSD validation claimed.`);
