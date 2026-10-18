import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentServer} from '../server.mjs';
import {synthesize,transcribe,chat,publicVoiceConfig} from '../edge-functions/api/yuanbai/chat.js';
const origin='https://academy.example.test';
test('new female voice uses Qwen TTS API and original voice remains blocked',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url:String(url),body:options?.body&&JSON.parse(options.body)});
  return calls.length===1?Response.json({output:{audio:{url:'https://audio.example.test/result.wav'}}}):new Response(new Uint8Array([82,73,70,70]));
 });
 assert.equal(await synthesize('你好','test','qwen3-tts-flash','Serena'),'UklGRg==');
 assert.match(calls[0].url,/multimodal-generation\/generation$/);
 assert.deepEqual(calls[0].body.input,{text:'你好',voice:'Serena',language_type:'Chinese'});
 assert.equal(publicVoiceConfig({YUANBAI_PUBLIC_TTS_MODEL:'old',YUANBAI_PUBLIC_TTS_VOICE_ID:'qwen-audio-3.1-tts-flash-bailian-99b47d2c8e7a459d9e49d67ab2d9033d'}),null);
});
test('recorded speech uses supported ASR model and reads nested transcript',async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  const data=JSON.parse(options.body);assert.equal(data.model,'qwen3-asr-flash');assert.match(data.input.messages[0].content[0].audio,/data:audio\/mp4;base64,/);
  return Response.json({output:{choices:[{message:{content:[{text:'胡清清研究什么'}]}}]}});
 });
 assert.equal(await transcribe('AA==','audio/mp4','test'),'胡清清研究什么');
});
test('faculty can read the known official page without native search support',async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push(String(url));
  if(String(url).includes('design.bnu.edu.cn'))return new Response('<html><body>胡清清 研究领域：数字文化遗产、多模态感知。</body></html>',{headers:{'Content-Type':'text/html'}});
  assert.match(String(url),/chat\/completions$/);assert.match(JSON.parse(options.body).messages[1].content,/数字文化遗产/);
  return Response.json({choices:[{message:{content:'她研究数字文化遗产。'}}]});
 });
 const result=await chat('查一下胡清清老师的官网介绍',[],'test');
 assert.equal(calls.length,2);assert.equal(result.webSources.length,1);assert.equal(result.webSearchAttempted,true);
});
test('local service isolates queue controls, refuses foreign origins and serves corpus to chat',async t=>{
 const nativeFetch=globalThis.fetch;
 const {server,queue}=createAgentServer({YUANBAI_ALLOWED_ORIGINS:origin,DASHSCOPE_API_KEY:'test',DEEPSEEK_API_KEY:'test'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url).startsWith(base))return nativeFetch(url,options);
  assert.match(String(url),/chat\/completions$/);assert.match(JSON.parse(options.body).messages[1].content,/CMBP-9/);
  return Response.json({choices:[{message:{content:'胡清清的苗族蜡染研究结合LoRA和LCM。'}}]});
 });
 const call=(route,body={},o=origin)=>fetch(base+route,{method:'POST',headers:{Origin:o,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await call('/api/yuanbai/voice-queue/join',{},'https://evil.test')).status,403);
 assert.equal((await call('/api/yuanbai/voice-queue/claim')).status,404);
 const join=await (await call('/api/yuanbai/voice-queue/join')).json();assert.ok(join.ticket);
 const result=await (await call('/api/yuanbai/chat',{text:'胡清清研究什么',voice_queue_ticket:join.ticket})).json();
 assert.equal(result.ok,true);assert.match(result.answer,/LoRA/);assert.equal(result.text_only,true);assert.equal(queue.size,0);
 assert.equal((await call('/api/yuanbai/chat',{text:'你好',voice_queue_ticket:join.ticket})).status,409);
});

test('text returns before speech, polling is bounded to generated answer tokens',async t=>{
 const nativeFetch=globalThis.fetch;
 let finishVoice; const waitVoice=new Promise(resolve=>{finishVoice=resolve});
 const {server}=createAgentServer({YUANBAI_ALLOWED_ORIGINS:origin,DASHSCOPE_API_KEY:'test',DEEPSEEK_API_KEY:'test',YUANBAI_PUBLIC_TTS_MODEL:'qwen3-tts-flash',YUANBAI_PUBLIC_TTS_VOICE_ID:'Serena'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url).startsWith(base))return nativeFetch(url,options);
  if(String(url).includes('multimodal-generation')){await waitVoice;return Response.json({output:{audio:{url:'https://audio.example.test/voice.wav'}}});}
  if(String(url).includes('audio.example.test'))return new Response(new Uint8Array([82,73,70,70]));
  return Response.json({choices:[{message:{content:'这是用于异步语音测试的回答。'}}]});
 });
 const call=body=>fetch(base+'/api/yuanbai/chat',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const join=await (await nativeFetch(base+'/api/yuanbai/voice-queue/join',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).json();
 const result=await (await call({text:'介绍一下元白',want_audio:true,voice_queue_ticket:join.ticket})).json();
 assert.equal(result.ok,true);assert.ok(result.answer);assert.equal(result.voice_status,'pending');assert.ok(result.speech_ticket);
 assert.equal((await call({action:'speech',speech_ticket:'invented',text:'不能任意合成'})).status,404);
 assert.equal((await (await call({action:'speech',speech_ticket:result.speech_ticket})).json()).voice_status,'pending');
 finishVoice();
 let speech;
 for(let i=0;i<20;i++){speech=await (await call({action:'speech',speech_ticket:result.speech_ticket})).json();if(speech.voice_status==='ready')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(speech.voice_status,'ready');assert.equal(speech.audio_base64,'UklGRg==');
});
