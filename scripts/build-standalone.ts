import { build } from 'esbuild';
import { mkdir,writeFile } from 'node:fs/promises';
const result=await build({entryPoints:['src/main.tsx'],bundle:true,write:false,outfile:'standalone.js',format:'iife',target:'es2022',minify:true,legalComments:'eof'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js'))!.text.replaceAll('</script','<\\/script');
const css=result.outputFiles.find(f=>f.path.endsWith('.css'))!.text.replaceAll('</style','<\\/style');
const html=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>음가 블록 실험실 · 로컬 파일 미리보기</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await mkdir('output',{recursive:true});await writeFile('output/preview.html',html);console.log(JSON.stringify({file:'output/preview.html',bytes:Buffer.byteLength(html),networkDependencies:0,servedE2E:false}));
