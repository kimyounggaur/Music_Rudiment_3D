import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url=new URL(process.env.LAB_DEPLOY_URL??'');
assert.equal(url.protocol,'https:');assert.ok(url.hostname.endsWith('.vercel.app'));assert.equal(url.username+url.password,'');
const gitSha=process.env.LAB_DEPLOY_GIT_SHA??'';assert.match(gitSha,/^[a-f0-9]{40}$/);
const output=`output/release/smoke-${gitSha.slice(0,8)}`;await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
const checks:string[]=[];const errors:string[]=[];const external:string[]=[];
try{
 const context=await browser.newContext({viewport:{width:844,height:390},acceptDownloads:true});
 await context.route(/^https?:/,async route=>{if(new URL(route.request().url()).origin!==url.origin){external.push(route.request().url());await route.abort();}else await route.continue();});
 await context.addInitScript(()=>{const Original=window.AudioContext;Reflect.set(window,'__deployContextCount',0);window.AudioContext=class extends Original{constructor(options?:AudioContextOptions){super(options);Reflect.set(window,'__deployContextCount',Number(Reflect.get(window,'__deployContextCount'))+1);}};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url.href);assert.equal(response?.status(),200);
 await page.locator('main .notation-view[data-notation-ready="true"]').waitFor({timeout:30000});
 assert.equal(await page.evaluate(()=>Reflect.get(window,'__deployContextCount')),0);checks.push('public HTTPS200, actual SVG/font ready, no autoplay');
 await page.locator('.steps button').nth(1).click();await page.getByRole('button',{name:'둘로 나누기',exact:true}).click();
 await page.getByRole('button',{name:'3D',exact:true}).click();await page.locator('[data-three-status="ready"] canvas[data-three-ready="true"]').waitFor({timeout:30000});
 assert.equal(await page.locator('[data-three-event]').count(),2);assert.equal(await page.locator('canvas[data-three-canvas]').getAttribute('data-renderer'),'three-webgl');checks.push('deployed actual Three module loads and preserves two half-note blocks');
 await page.locator('canvas[data-three-canvas]').evaluate(node=>node.scrollIntoView({block:'center'}));await page.locator('canvas[data-three-canvas]').screenshot({path:output+'/three-canvas.png'});
 await page.getByRole('button',{name:'2D',exact:true}).click();assert.equal(await page.locator('canvas[data-three-canvas]').count(),0);
 await page.locator('.steps button').nth(3).click();const total=await page.locator('.measure-caption strong').innerText();await page.getByRole('button',{name:'음표 ↔ 쉼표',exact:true}).click();assert.equal(await page.locator('.measure-caption strong').innerText(),total);
 await page.getByRole('button',{name:'소리 켜고 재생'}).click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>Reflect.get(window,'__deployContextCount')),1);await page.getByRole('button',{name:'■ 정지',exact:true}).click();assert.equal(await page.locator('.play').isEnabled(),true);checks.push('rest toggle preserves total; native Web Audio gesture starts and stops');
 await page.locator('.steps button').nth(5).click();
 for(const name of [/^2분음표/,/^4분쉼표/,/^8분음표/,/^8분음표/])await page.locator('.palette-pair button').filter({hasText:name}).click();
 await page.getByLabel('쉼표도 시간을 차지한다는 점과 길이의 합을 설명했어요.').check();assert.equal(await page.locator('.completion.complete').count(),1);checks.push('final composition meets sum, duration variety, rest and explanation conditions');
 await page.waitForTimeout(400);await page.reload();await page.locator('main .notation-view[data-notation-ready="true"]').waitFor();assert.equal(await page.locator('.completion.complete').count(),1);assert.equal(await page.evaluate(()=>Reflect.get(window,'__deployContextCount')),0);checks.push('HTTPS-origin progress restores without autoplay');
 for(const viewport of [{width:844,height:390},{width:390,height:844}]){await page.setViewportSize(viewport);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`${output}/${viewport.width}x${viewport.height}.png`,fullPage:true});}checks.push('landscape/portrait stay usable without horizontal body overflow');
 const license=await page.request.get(new URL('/licenses/Three-MIT.txt',url).href);assert.equal(license.status(),200);
 assert.equal(createHash('sha256').update(await license.body()).digest('hex'),createHash('sha256').update(await readFile('public/licenses/Three-MIT.txt')).digest('hex'));checks.push('actual Three MIT notice is served unchanged');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);checks.push('no uncaught page errors or external app requests');
 await writeFile(output+'/results.json',JSON.stringify({status:'passed',url:url.href,gitShaFromVerifiedDeploymentMetadata:gitSha,browser:browser.version(),actualDevice:false,actualListening:false,checks,errors,external},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,url:url.href,gitSha,output}));await context.close();
}catch(error){await writeFile(output+'/results.json',JSON.stringify({status:'failed',url:url.href,gitSha,checks,errors,external,error:error instanceof Error?error.stack:String(error)},null,2));throw error;}
finally{await browser.close();}
