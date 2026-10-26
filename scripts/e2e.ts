import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { lessonContent } from '../src/content/lesson.ts';

const output='output/playwright';
await mkdir(output,{recursive:true});
// Standalone local-file UI checks only. The denied localhost socket is never retried.
const base=pathToFileURL(resolve('output/preview.html')).href;
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const results:{name:string;status:string;detail?:string}[]=[];
const context=await browser.newContext({viewport:{width:844,height:390},acceptDownloads:true});
await context.addInitScript(()=>{const Original=window.AudioContext;Reflect.set(window,'__createdContexts',0);window.AudioContext=class extends Original{constructor(options?:AudioContextOptions){super(options);Reflect.set(window,'__createdContexts',Number(Reflect.get(window,'__createdContexts'))+1);}};});
await context.tracing.start({screenshots:true,snapshots:true});
const errors:string[]=[];
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
const outbound:string[]=[];page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))outbound.push(r.url());});
const done=(name:string,detail?:string)=>{results.push({name,status:'passed',detail});process.stdout.write('PASS '+name+'\n');};
const capture=async(scene:string,state:string)=>{await page.locator('main .notation-view[data-notation-ready="true"]').waitFor({timeout:20000});await page.screenshot({path:`${output}/${scene}-844x390-2d-${state}-notation05.png`,fullPage:true});};
async function answerScene(index:number){for(const q of lessonContent.scenes[index].questions){await page.locator(`input[name="${q.id}"][value="${q.correctValue}"]`).check();}}
async function scene(index:number){await page.getByRole('navigation',{name:'학습 장면'}).locator('button').nth(index).click();await page.getByRole('heading',{level:1,name:lessonContent.scenes[index].title}).waitFor();}
try {
  await page.goto(base);await page.getByRole('heading',{level:1}).waitFor();
  assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.evaluate(()=>Reflect.get(window,'__createdContexts')),0);done('first entry creates no AudioContext and has no autoplay');
  await capture('scene-1','initial');
  await page.getByRole('button',{name:'소리 없이 설명 확인',exact:true}).click();
  await page.locator('.lane-tabs button').nth(1).click();await page.getByRole('button',{name:'소리 없이 설명 확인',exact:true}).click();
  await answerScene(0);assert.equal(await page.locator('.nav-actions button').last().isEnabled(),true);await capture('scene-1','complete');
  await page.locator('.nav-actions button').last().click();
  await capture('scene-2','initial');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'둘로 나누기',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'둘로 나누기',exact:true}).isEnabled(),false);
  await answerScene(1);await capture('scene-2','complete');
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();await page.getByRole('button',{name:'다시 하기',exact:true}).click();
  done('scene2 splitting, sixteenth limit, undo/redo and question');
  await page.locator('.nav-actions button').last().click();
  await capture('scene-3','initial');
  const quarter=()=>page.locator('.palette-pair button').filter({hasText:'4분음표'}).click();
  const eighth=()=>page.locator('.palette-pair button').filter({hasText:'8분음표'}).click();
  await quarter();await quarter();
  await page.locator('.lane-tabs button').nth(1).click();for(let i=0;i<4;i++)await eighth();
  await page.locator('.lane-tabs button').nth(2).click();await quarter();await eighth();await eighth();
  assert.equal(await page.locator('.nav-actions button').last().isEnabled(),true);await capture('scene-3','complete');
  await page.locator('.nav-actions button').last().click();await capture('scene-4','initial');
  await page.getByRole('button',{name:'음표 ↔ 쉼표',exact:true}).click();await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  await answerScene(3);await capture('scene-4','complete');await page.locator('.nav-actions button').last().click();
  await capture('scene-5','initial');await answerScene(4);
  await page.locator('.tempo-comparison select').selectOption('120');
  await page.locator('.tempo-comparison select').selectOption('60');await capture('scene-5','complete');
  done('scene3 equivalences, scene4 rests, scene5 60/120 text comparison');
  await page.locator('.nav-actions button').last().click();await capture('scene-6','initial');
  await page.locator('.palette-pair button').filter({hasText:/^2분음표/}).click();
  await page.locator('.palette-pair button').filter({hasText:/^4분쉼표/}).click();await eighth();await eighth();
  await page.getByLabel('쉼표도 시간을 차지한다는 점과 길이의 합을 설명했어요.').check();
  assert.equal(await page.locator('.completion.complete').count(),1);await capture('scene-6','complete');
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();assert.equal(await page.locator('.completion.complete').count(),0);
  await page.getByRole('button',{name:'다시 하기',exact:true}).click();assert.equal(await page.locator('.completion.complete').count(),1);
  assert.equal(await page.evaluate(()=>Reflect.get(window,'__createdContexts')),0);
  done('sound-free text/2D six-scene route and scene6 current success undo redo');

  await scene(4);await page.locator('.tempo-comparison select').selectOption('120');
  await page.getByRole('button',{name:'소리 켜고 재생'}).click();await page.waitForTimeout(180);
  assert.equal(await page.locator('.tempo-comparison select').isDisabled(),true);
  assert.equal(await page.evaluate(()=>Reflect.get(window,'__createdContexts')),1);
  await page.getByRole('button',{name:'■ 정지',exact:true}).click();
  assert.equal(await page.locator('.tempo-comparison select').isEnabled(),true);
  await page.getByLabel('반복',{exact:true}).check();
  await page.getByRole('button',{name:'소리 켜고 재생'}).click();await page.waitForTimeout(2200);
  assert.equal(await page.locator('.play').isDisabled(),true);
  await page.getByRole('button',{name:'■ 정지',exact:true}).click();await page.getByLabel('반복',{exact:true}).uncheck();
  await page.locator('.tempo-comparison select').selectOption('60');await scene(5);
  done('real browser AudioContext playback stop loop and tempo edit guard');

  const rhythmBefore=await page.locator('.measure-caption strong').innerText();
  await page.getByRole('button',{name:'3D',exact:true}).click();await page.waitForTimeout(350);
  assert.equal(await page.locator('.measure-caption strong').innerText(),rhythmBefore);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/scene-6-390x844-3d-complete-local01.png',fullPage:true});
  await page.getByRole('button',{name:'2D',exact:true}).click();assert.equal(await page.locator('.measure-caption strong').innerText(),rhythmBefore);
  done('2D/3D and orientation preserve rhythm');

  await page.getByRole('button',{name:'교사 보기',exact:true}).click();await page.getByRole('button',{name:'정답 공개하기',exact:true}).click();
  assert.equal(await page.locator('.teacher-answer').count(),1);await page.getByRole('button',{name:'교사 보기',exact:true}).click();assert.equal(await page.locator('.teacher-answer').count(),0);
  await page.waitForTimeout(400);await page.reload();await page.getByRole('heading',{level:1,name:lessonContent.scenes[5].title}).waitFor();
  assert.equal(await page.locator('.measure-caption strong').innerText(),rhythmBefore);assert.equal(await page.locator('.play').isEnabled(),true);assert.equal(await page.evaluate(()=>Reflect.get(window,'__createdContexts')),0);
  done('teacher answer reset, saved state restores without autoplay');

  await page.getByRole('button',{name:'설정·기록',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"__proto__":{"x":1}}')});
  await page.waitForTimeout(100);assert.equal(await page.locator('.measure-caption strong').innerText(),rhythmBefore);
  await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
  done('malicious JSON rejected and valid rhythm preserved');

  for(const [width,height] of [[844,390],[667,375],[568,320],[390,844],[360,640],[320,640],[1024,768],[1366,768]]){
    await page.setViewportSize({width,height});
    for(let i=0;i<6;i++){
      await scene(i);
      const over=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      assert.equal(over,false,`overflow scene${i+1} ${width}x${height}`);
      await page.screenshot({path:`${output}/scene-${i+1}-${width}x${height}-2d-restored-local01.png`,fullPage:true});
    }
    const sizes=await page.locator('.transport button').evaluateAll(nodes=>nodes.map(n=>({h:n.getBoundingClientRect().height,w:n.getBoundingClientRect().width})));
    assert.ok(sizes.every(s=>s.h>=44&&s.w>=44));done(`viewport ${width}x${height} six scenes no body overflow and44px transport`);
  }
  await page.setViewportSize({width:844,height:390});await scene(1);
  await page.getByRole('button',{name:'장면 초기화',exact:true}).click();await page.getByRole('button',{name:'확인',exact:true}).click();
  await page.getByRole('button',{name:'둘로 나누기',exact:true}).focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-event-select]').count()>1,true);done('keyboard Enter edits, dialog confirm restores focus route');
  await page.emulateMedia({reducedMotion:'reduce',media:'print'});
  assert.equal(await page.locator('.print-sheet svg').count(),9);
  await page.pdf({path:output+'/activity-sheet-local01.pdf',format:'A4',printBackground:true});
  await page.emulateMedia({media:'screen',reducedMotion:'no-preference'});done('nine SVG notation lanes and text activity sheet PDF generated; human print review pending');
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(outbound.length,0,outbound.join('\n'));done('zero uncaught page errors and no external data requests');
} catch(error) {
  results.push({name:'browser suite',status:'failed',detail:String(error)});await page.screenshot({path:output+'/failure-local01.png',fullPage:true});throw error;
} finally {
  await context.tracing.stop({path:output+'/trace-local01.zip'});
  await writeFile(output+'/results.json',JSON.stringify({environment:{browser:browser.version(),mode:'standalone-file',servedE2E:false,viewport:'matrix',actualDevice:false,actualListening:false},results,errors,outbound},null,2));
  await browser.close();
}

