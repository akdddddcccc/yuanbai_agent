import {randomUUID} from 'node:crypto';

const DEFAULT_CAPACITY=2;
const DEFAULT_TICKET_TTL=90_000;
const MAX_WAITING=200;

export function createVoiceQueue({capacity=DEFAULT_CAPACITY,ticketTtl=DEFAULT_TICKET_TTL,maxWaiting=MAX_WAITING,now=()=>Date.now(),makeId=randomUUID}={}){
  const tickets=new Map();
  function promote(){
    const time=now();
    for(const [id,ticket] of tickets)if(time-ticket.touchedAt>ticketTtl)tickets.delete(id);
    let active=[...tickets.values()].filter(ticket=>ticket.state==='active').length;
    for(const ticket of tickets.values()){
      if(active>=capacity)break;
      if(ticket.state==='waiting'){ticket.state='active';ticket.touchedAt=time;active++;}
    }
  }
  function positionFor(id){
    let position=0;
    for(const ticket of tickets.values()){
      if(ticket.state==='waiting')position++;
      if(ticket.id===id)return ticket.state==='active'?0:position;
    }
    return null;
  }
  return {
    join(){
      promote();
      if([...tickets.values()].filter(ticket=>ticket.state==='waiting').length>=maxWaiting)return {ok:false,error:'现在等候的人比较多，请过一会儿再来。'};
      const id=makeId();
      tickets.set(id,{id,state:[...tickets.values()].filter(ticket=>ticket.state==='active').length<capacity?'active':'waiting',touchedAt:now(),claimed:false});
      return {ok:true,ticket:id,...this.status(id)};
    },
    status(id){
      promote();
      const ticket=tickets.get(id);
      if(!ticket)return {ok:false,expired:true};
      ticket.touchedAt=now();
      return {ok:true,state:ticket.state,position:positionFor(id),capacity};
    },
    release(id){
      const removed=tickets.delete(id);
      promote();
      return {ok:true,released:removed};
    },
    claim(id){
      const status=this.status(id);
      const ticket=tickets.get(id);
      if(!status.ok)return {ok:false,expired:true};
      if(status.state!=='active')return {ok:false,waiting:true};
      if(ticket.claimed)return {ok:false,busy:true};
      ticket.claimed=true;
      return {ok:true};
    },
    get size(){return tickets.size;},
  };
}
