import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {preparePreciseModel} from '../../src/preciseModel.js';
const root=new URL('../../',import.meta.url);
test('light model decodes, preserves non-metal geometry and binds all 15 moving masses',async()=>{
 const meta=JSON.parse(await readFile(new URL('school/model/manifest.json',root),'utf8'));
 const data=gunzipSync(Buffer.from(await readFile(new URL('school/model/dialogue-light.glb.gz.b64',root),'utf8'),'base64'));
 assert.equal(createHash('sha256').update(data).digest('hex'),meta.sha256);
 const original=await readFile(new URL(meta.source,root));
 const parse=bytes=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
 const old=await parse(original),fresh=await parse(data);
 // Compare exact triangle positions for every material not intentionally simplified.
 old.scene.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.name==='MAT_METAL_WHITE')return;
  const other=fresh.scene.getObjectByName(mesh.name);assert.ok(other,mesh.name);
  const oldP=mesh.geometry.attributes.position,newP=other.geometry.attributes.position;
  const oldIx=mesh.geometry.index,newIx=other.geometry.index;
  assert.equal(oldIx.count,newIx.count);
  for(let i=0;i<oldIx.count;i++)for(let j=0;j<3;j++)assert.equal(oldP.array[oldIx.array[i]*3+j],newP.array[newIx.array[i]*3+j]);
 });
 const result=preparePreciseModel(fresh.scene,()=>({}));
 assert.equal(result.blocks.length,15);assert.ok(result.blocks.some(b=>b.name==='YB_mass_A08'));
 for(const block of result.blocks){assert.ok(block.userData.home);const home=block.position.clone();block.position.y+=.25;assert.equal(block.position.distanceTo(home),.25);block.position.copy(home);}
 assert.ok(result.bindings.length>0);assert.ok(Number.isFinite(result.viewRadius));
 assert.ok(meta.transferBytes<2_000_000);
});
