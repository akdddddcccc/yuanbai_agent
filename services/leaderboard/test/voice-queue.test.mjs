import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceQueue} from '../voice-queue.mjs';

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
