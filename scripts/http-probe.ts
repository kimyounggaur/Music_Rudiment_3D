import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base='http://127.0.0.1:4174/';
const response=await fetch(base);
if(response.status!==200)throw new Error(`HTTP ${response.status}`);
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
try {
  const page=await browser.newPage({viewport:{width:844,height:390}});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.locator('main .notation-view[data-notation-ready="true"]').waitFor({timeout:30000});
  const graphics=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');
    const gl=canvas.getContext('webgl2');
    const result={webgl2:!!gl,version:gl?.getParameter(gl.VERSION) as string|undefined,renderer:gl?.getParameter(gl.RENDERER) as string|undefined};
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return result;
  });
  await mkdir('output/http',{recursive:true});
  await page.screenshot({path:'output/http/initial-http-844x390.png',fullPage:true});
  const result={base,status:response.status,browser:browser.version(),graphics,errors,securityFlagsAdded:false};
  await writeFile('output/http/probe.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  if(errors.length)process.exitCode=1;
} finally {await browser.close();}
