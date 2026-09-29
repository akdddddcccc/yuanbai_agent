import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceQueue} from '../voice-queue.mjs';
import {createVoiceQueueServer,sanitizeDiagnostics} from '../voice-queue-server.mjs';

test('persistent diagnostics discard private payloads and unbounded labels',()=>{
  assert.deepEqual(sanitizeDiagnostics({ok:false,stage:'语音合成',upstream_status:429,tts_ms:34000,
    audio:'secret-audio',answer:'private-answer',ticket:'private-ticket',api_key:'secret-key',
    asr_ms:-1,total_ms:Infinity,error_name:'private arbitrary string',
  }),{ok:false,tts_ms:34000,upstream_status:429,stage:'语音合成'});
  assert.deepEqual(sanitizeDiagnostics({stage:'private transcript',dialogue_ms:600001}),{});
});

test('default four slots admit 100 visitors FIFO and retire jobs before playback',()=>{
  const queue=createVoiceQueue();
  const all=Array.from({length:100},()=>queue.join());
  assert.equal(all.filter(t=>t.state==='active').length,4);
  for(let i=0;i<all.length;i++){
    const ticket=all[i].ticket;
    assert.equal(queue.status(ticket).state,'active');
    const claim=queue.claim(ticket);
    assert.equal(claim.ok,true);
    assert.equal(queue.complete(ticket,'forged').ok,false);
    assert.equal(queue.complete(ticket,claim.claimToken).ok,true);
    assert.equal(queue.status(ticket).expired,true);
    assert.equal(queue.claim(ticket).expired,true);
    assert.ok(queue.snapshot().active<=4);
  }
  assert.deepEqual(queue.snapshot(),{capacity:4,active:0,processing:0,waiting:0});
});

test('four-way HTTP admission promotes a fifth caller without a playback release',async t=>{
  const server=createVoiceQueueServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(action,body={})=>(await fetch(`${base}/api/yuanbai/voice-queue/${action}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  })).json();
  const jobs=await Promise.all(Array.from({length:20},()=>call('join')));
  assert.equal(jobs.filter(j=>j.state==='active').length,4);
  const first=jobs.find(j=>j.state==='active');
  const fifth=jobs.find(j=>j.position===1);
  const claim=await call('claim',{ticket:first.ticket});
  await call('complete',{ticket:first.ticket,claimToken:claim.claimToken});
  assert.equal((await call('status',{ticket:fifth.ticket})).state,'active');
  assert.deepEqual(await (await fetch(`${base}/health`)).json(),{ok:true,capacity:4,active:4,processing:0,waiting:15});
});

test('并发名额满后按加入顺序等待，释放后依次进入',()=>{
  let id=0;
  const queue=createVoiceQueue({capacity:2,makeId:()=>`ticket-${++id}`});
  const first=queue.join(),second=queue.join(),third=queue.join(),fourth=queue.join();
  assert.equal(first.state,'active');
  assert.equal(second.state,'active');
  assert.deepEqual([third.position,fourth.position],[1,2]);
  queue.release(first.ticket);
  assert.equal(queue.status(third.ticket).state,'active');
  assert.equal(queue.status(fourth.ticket).position,1);
  queue.release(second.ticket);
  assert.equal(queue.status(fourth.ticket).state,'active');
});

test('过期的活跃票据释放名额，等待队列有上限',()=>{
  let now=0,id=0;
  const queue=createVoiceQueue({capacity:1,ticketTtl:100,maxWaiting:1,now:()=>now,makeId:()=>`t${++id}`});
  const active=queue.join(),waiting=queue.join();
  assert.equal(queue.join().ok,false);
  now=90;queue.status(waiting.ticket);
  now=101;
  assert.equal(queue.status(waiting.ticket).state,'active');
  assert.equal(queue.status(active.ticket).expired,true);
});

test('三十个同时到达的请求不会超过两个活跃名额',()=>{
  let id=0;
  const queue=createVoiceQueue({capacity:2,maxWaiting:40,makeId:()=>`load-${++id}`});
  const tickets=Array.from({length:30},()=>queue.join());
  assert.equal(tickets.filter(ticket=>ticket.state==='active').length,2);
  assert.deepEqual(tickets.slice(2).map(ticket=>ticket.position),Array.from({length:28},(_,index)=>index+1));
  const active=tickets.slice(0,2);
  for(let index=0;index<28;index++){
    queue.release(active[0].ticket);
    const next=tickets[index+2];
    assert.equal(queue.status(next.ticket).state,'active');
    active[0]=next;
    active.reverse();
  }
  assert.equal(new Set(active.map(ticket=>ticket.ticket)).size,2);
});

test('关闭页面不能提前释放仍在生成的请求，完成凭据不可伪造',()=>{
  const queue=createVoiceQueue({capacity:1});
  const a=queue.join(),b=queue.join();
  const claim=queue.claim(a.ticket);
  assert.equal(queue.claim(a.ticket).busy,true);
  assert.equal(queue.release(a.ticket).released,false);
  assert.equal(queue.status(b.ticket).state,'waiting');
  assert.equal(queue.complete(a.ticket,'wrong').ok,false);
  assert.equal(queue.complete(a.ticket,claim.claimToken).ok,true);
  assert.equal(queue.status(b.ticket).state,'active');
});

test('独立HTTP服务接收30台设备并按完成顺序放行，不调用模型',async t=>{
  const server=createVoiceQueueServer({capacity:2});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const call=async(action,body={})=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}/api/yuanbai/voice-queue/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:res.status,...await res.json()};
  };
  const tickets=await Promise.all(Array.from({length:30},()=>call('join')));
  assert.equal(tickets.filter(t=>t.state==='active').length,2);
  const waiting=tickets.filter(t=>t.state==='waiting').sort((a,b)=>a.position-b.position);
  assert.equal(waiting.length,28);
  const first=tickets.find(t=>t.state==='active');
  const claim=await call('claim',{ticket:first.ticket});
  assert.equal(claim.ok,true);
  assert.equal((await call('claim',{ticket:first.ticket})).status,409);
  await call('release',{ticket:first.ticket});
  assert.equal((await call('status',{ticket:waiting[0].ticket})).state,'waiting');
  await call('complete',{ticket:first.ticket,claimToken:claim.claimToken});
  assert.equal((await call('status',{ticket:waiting[0].ticket})).state,'active');
});
