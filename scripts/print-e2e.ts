import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createLessonState,reduceLesson,serializeLearning } from '../src/lesson/controller.ts';
import { createProgress,STORAGE_KEY } from '../src/persistence/progress.ts';
import { frac } from '../src/domain/index.ts';

let state=createLessonState();state=reduceLesson(state,{type:'navigate',sceneId:'scene-3'});
for(const [lane,denominators] of [['A',[4,4]],['B',[8,8,8,8]],['C',[4,8,8]]] as const){state=reduceLesson(state,{type:'selectLane',laneId:lane});for(const denominator of denominators)state=reduceLesson(state,{type:'add',duration:frac(1,denominator),kind:'note'});}
state=reduceLesson(state,{type:'navigate',sceneId:'scene-6'});
for(const [denominator,kind] of [[2,'note'],[4,'rest'],[8,'note'],[8,'note']] as const)state=reduceLesson(state,{type:'add',duration:frac(1,denominator),kind});
const progress=createProgress({...serializeLearning(state),preferences:{mode:'2d',reducedMotion:true,muted:true,volume:0.3,currentSceneId:'scene-6'}});
const artifact=resolve('output/preview.html');const hash=createHash('sha256').update(await readFile(artifact)).digest('hex');
const out='output/qa/print-final';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try{
 const page=await browser.newPage({viewport:{width:844,height:390}});const errors:string[]=[];const external:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
 await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:STORAGE_KEY,value:JSON.stringify(progress)});
 await page.goto(pathToFileURL(artifact).href);await page.waitForFunction(()=>document.querySelectorAll('.print-sheet .notation-view[data-notation-ready="true"]').length===9);
 await page.emulateMedia({media:'print',reducedMotion:'reduce'});await page.waitForTimeout(300);
 const pdf=resolve(out,'activity-sheet-six-scenes.pdf');await page.pdf({path:pdf,format:'A4',printBackground:true});
 const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8',windowsHide:true});const pages=Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
 const boxes=await page.locator('.print-sheet > .print-scene').evaluateAll(nodes=>nodes.map(node=>({title:node.querySelector('h2')?.textContent,height:node.getBoundingClientRect().height,lanes:node.querySelectorAll('.print-lane h3').length})));
 const report={artifactSha256:hash,pdf,sha256:createHash('sha256').update(await readFile(pdf)).digest('hex'),pages,boxes,errors,external,fileOrigin:true,actualPrinter:false};
 await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2));assert.equal(pages,6,'Each scene and its writing area must fit one page.');assert.equal(errors.length,0);assert.equal(external.length,0);assert.equal(await page.locator('.print-sheet svg').count(),9);
 console.log('PASS six scenes on six A4 pages, nine actual SVG lanes, no page errors or HTTP requests; physical printer not tested');
}finally{await browser.close();}
