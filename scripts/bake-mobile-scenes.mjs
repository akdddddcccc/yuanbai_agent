import { mkdir, writeFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';

await mkdir('public/mobile', {recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4179},base:'/'});
await server.listen();
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4179/tools/mobile-bake.html');
 await page.waitForFunction(()=>typeof window.bake==='function');
 const {body,mask,windows}=await page.evaluate(()=>window.bake());
 assert(windows>0,'No glass materials found');
 const decode=s=>Buffer.from(s.split(',')[1],'base64');
 const {data:rgba,info}=await sharp(decode(body)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const pixels=await sharp(decode(mask)).ensureAlpha().raw().toBuffer();
 const lights=Buffer.alloc(rgba.length);
 let visibleWindowPixels=0;
 for(let i=0;i<rgba.length;i+=4){
   const a=Math.round(pixels[i]*pixels[i+3]/255);
   if(a>128) visibleWindowPixels++;
   rgba[i+3]=Math.round(rgba[i+3]*(1-a/255));
   lights[i]=255; lights[i+1]=184; lights[i+2]=105; lights[i+3]=a;
 }
 assert(visibleWindowPixels>100,'Window mask is empty or occluded');
 const raw={width:info.width,height:info.height,channels:4};
 await sharp(rgba,{raw}).webp({quality:84,alphaQuality:100}).toFile('public/mobile/building.webp');
 await sharp(lights,{raw}).webp({lossless:true}).toFile('public/mobile/windows.webp');
 await sharp('artifacts/yuanbai-perception-sculpture-transparent.png').resize(800,800,{fit:'inside'}).webp({quality:82}).toFile('public/mobile/portal.webp');
 const sizes=Object.fromEntries(await Promise.all(['building','windows','portal'].map(async name=>[name,(await stat('public/mobile/'+name+'.webp')).size])));
 assert(sizes.building+sizes.windows<500000,'Dialogue textures exceed 500 KB budget');
 assert(sizes.portal<250000,'Portal texture exceeds 250 KB budget');
 const report={sourceBytes:18647460,sizes,visibleWindowPixels,width:info.width,height:info.height};
 await writeFile('public/mobile/manifest.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 // Exercise the actual React props, then check that light changes stay inside the glass mask.
 await mkdir('artifacts/mobile-scenes',{recursive:true});
 await page.setViewportSize({width:1024,height:768});
 await page.goto('http://127.0.0.1:4179/tools/mobile-light-check.html');
 await page.locator('.mobile-building[data-state="ready"]').waitFor();
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.mobile-window-light')).opacity)===.3);
 const dim=await page.screenshot({path:'artifacts/mobile-scenes/light-dim.png'});
 await page.evaluate(()=>window.setEnergy(1));
 await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.mobile-window-light')).opacity)===1);
 const bright=await page.screenshot({path:'artifacts/mobile-scenes/light-bright.png'});
 const dimPixels=await sharp(dim).ensureAlpha().raw().toBuffer();
 const brightPixels=await sharp(bright).ensureAlpha().raw().toBuffer();
 let changed=0,leaked=0;
 for(let i=0;i<dimPixels.length;i+=4){
   if(Math.abs(dimPixels[i]-brightPixels[i])+Math.abs(dimPixels[i+1]-brightPixels[i+1])+Math.abs(dimPixels[i+2]-brightPixels[i+2])<15)continue;
   changed++;
   if(lights[i+3]<16)leaked++;
 }
 assert(changed>100,'Voice level did not visibly illuminate the windows');
 assert(leaked/changed<.05,'Window light spills onto opaque walls');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.mobile-window-light')).opacity)===.35);
 console.log(JSON.stringify({lightChangedPixels:changed,lightOutsideWindowPixels:leaked,reducedMotion:true}));

} finally {await browser.close();await server.close();}
