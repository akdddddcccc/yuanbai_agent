import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await preview({base:'/',preview:{host:'127.0.0.1',port:4180}});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
await mkdir('artifacts/mobile-scenes',{recursive:true});
const reports=[];
try {
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:2});
   const page=await context.newPage(); const requested=[]; const errors=[];
   page.on('request',r=>requested.push(r.url()));
   page.on('pageerror',e=>errors.push(e.message));
   // If regression requests a model, fail without spending time downloading it.
   await page.route(/\.glb|model-preload|precise-v3/,r=>r.abort());
   await page.goto('http://127.0.0.1:4180/');
   await page.locator('.mobile-portal-sculpture[data-state="ready"]').waitFor();
   await page.locator('a[href$="dialogue/"]').first().click();
   await page.locator('.mobile-building[data-state="ready"]').waitFor();
   assert.equal(await page.locator('.scene-mount canvas').count(),0,'Mobile must not create WebGL canvas');
   const bad=requested.filter(u=>/\.glb|model-preload|precise-v3|YuanbaiScene-|PortalSculpture-|preciseModel-|GLTFLoader-/.test(u));
   assert.deepEqual(bad,[],'Mobile requested desktop resources');
   assert.deepEqual(errors,[]);
   // Verify all image resources actually decoded.
   assert(await page.locator('.mobile-building img').evaluateAll(imgs=>imgs.every(i=>i.complete && i.naturalWidth>0)));
   await page.screenshot({path:'artifacts/mobile-scenes/'+viewport.width+'.png'});
   const resourceBytes=await page.evaluate(()=>performance.getEntriesByType('resource').reduce((sum,r)=>sum+r.transferSize,0));
   reports.push({viewport,resourceBytes,requests:requested.length});
   await page.setViewportSize({width:1100,height:600});
   assert.equal(await page.locator('.mobile-building').count(),1,'Rotation must keep image renderer');
   await context.close();
 }
 // Direct entry, failed texture, and reduced motion still leave the voice controls usable.
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 await page.route('**/mobile/building.webp',r=>r.abort());
 await page.goto('http://127.0.0.1:4180/dialogue/');
 await page.locator('.mobile-building[data-state="fallback"]').waitFor();
 assert(await page.locator('button').count()>0);
 assert.equal(await page.locator('.scene-mount canvas').count(),0);
 await context.close();
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});
 await desktop.goto('http://127.0.0.1:4180/dialogue/');
 await desktop.locator('.scene-mount[data-model="precise"] canvas').waitFor({timeout:60000});
 assert.equal(await desktop.locator('.mobile-building').count(),0);
 const manifest=JSON.parse(await readFile('public/mobile/manifest.json','utf8'));
 const report={manifest,reports,note:'Local CI transfer bytes; not real WeChat network timings.'};
 await writeFile('artifacts/mobile-scenes/report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
