import {Tutorial,SIZE,DIRECTIONS,TOOLS,PICKUPS,CLIFFS,index} from './model.js';
const model=new Tutorial(), $=s=>document.querySelector(s), ns='http://www.w3.org/2000/svg';
const tiles=$('#map-tiles'), player=$('#map-player'), effects=$('#map-effects');
const buttons=[...document.querySelectorAll('[data-key]')];
const arrows=['↗','↘','↙','↖'], keyMap={arrowup:'w',arrowright:'d',arrowdown:'s',arrowleft:'a'};
const xy=(r,c)=>({x:350+(c-r)*61,y:86+(c+r)*30.5});
const node=(name,attrs,text)=>{const el=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;return el;};
let animation=0, previousTime=0, pulseTimers=new Map();
const cells=[];
for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
  const {x,y}=xy(r,c), group=node('g',{'class':'map-tile','data-cell':index(r,c)});
  const sides=node('path',{d:`M${x-58} ${y}L${x} ${y+29}L${x+58} ${y}V${y+10}L${x} ${y+39}L${x-58} ${y+10}Z`,class:'tile-side'});
  const top=node('path',{d:`M${x} ${y-29}L${x+58} ${y}L${x} ${y+29}L${x-58} ${y}Z`,class:'tile-top'});
  const label=node('text',{x,y:y+5,'text-anchor':'middle',class:'tile-label'});
  group.append(sides,top,label);tiles.append(group);cells.push({r,c,group,label});
}
function markKey(key,down){for(const b of buttons.filter(b=>b.dataset.key===key))b.classList.toggle('is-pressed',down);}
function releaseAll(){buttons.forEach(b=>b.classList.remove('is-pressed'));}
function pulse(key){markKey(key,true);clearTimeout(pulseTimers.get(key));pulseTimers.set(key,setTimeout(()=>markKey(key,false),320));}
function render(now=performance.now()){
  const lesson=model.nextLesson(), panorama=now<model.panoramaUntil;
  for(const cell of cells){
    const n=index(cell.r,cell.c),visible=model.visible(cell.r,cell.c,now),pickup=PICKUPS.find(p=>p.r===cell.r&&p.c===cell.c&&!model.collected.has(p.type));
    const cliff=CLIFFS.has(n)&&model.clue(cell.r,cell.c,now),known=model.inspected.has(n)||model.probed.has(n);
    cell.group.classList.toggle('dim',!visible&&!known);
    cell.group.classList.toggle('visited',model.visited.has(n));
    cell.group.classList.toggle('cliff',cliff);
    cell.group.classList.toggle('inspected',known&&!cliff);
    cell.group.classList.toggle('current',model.r===cell.r&&model.c===cell.c);
    cell.group.classList.toggle('target',lesson.target?.r===cell.r&&lesson.target?.c===cell.c);
    cell.group.classList.toggle('pickup',!!pickup);
    cell.label.textContent=cliff?'×':pickup?TOOLS[pickup.type].symbol:known?'○':'';
    cell.label.setAttribute('fill',pickup?.type==='probe'?'#c9d9df':pickup?.type==='panorama'?'#edd6ae':'#e9a370');
  }
  const p=xy(model.r,model.c);player.style.transform=`translate(${p.x}px,${p.y}px)`;
  $('#player-direction').style.transform=`rotate(${model.direction*90}deg)`;
  $('#position-label').textContent=`位置 ${String(model.r+1).padStart(2,'0')} · ${String(model.c+1).padStart(2,'0')}`;
  $('#facing-label').textContent=`面朝${DIRECTIONS[model.direction].name} ${arrows[model.direction]}`;
  $('#action-feedback').textContent=model.message;
  $('#lesson-title').textContent=lesson.title;$('#lesson-body').textContent=lesson.body;
  $('#lesson-key').textContent=lesson.key?.toUpperCase()||'↗';$('#lesson-key').hidden=!lesson.key;
  $('#lesson-label').textContent=model.complete?'教学完成':'当前练习';
  $('#lesson-count').textContent=`${model.progress} / 5`;
  $('#lesson-progress-fill').style.width=`${model.progress*20}%`;
  $('.lesson-progress').setAttribute('aria-valuenow',model.progress);
  document.querySelectorAll('[data-mission]').forEach(li=>{const key=li.dataset.mission;const done=key==='move'?model.moved:key==='turn'?model.turned:model.used.has(key);li.classList.toggle('done',done);li.querySelector('.mission-dot').textContent=done?'✓':'';});
  for(const b of buttons){
    b.classList.toggle('suggested',b.dataset.key===lesson.key);
    if(b.dataset.tool){const owned=model.collected.has(b.dataset.tool);b.classList.toggle('available',owned);b.classList.toggle('tried',model.used.has(b.dataset.tool));b.querySelector('em').textContent=owned?'已拾取 · 可反复练习':'待拾取';}
  }
  $('#start-formal').hidden=!model.complete;
  $('#start-formal').setAttribute('aria-disabled',String(panorama));
  if(model.complete){try{localStorage.setItem('yuanbai-school-tutorial-v1','complete');}catch{}}
  $('#tutorial-map').classList.toggle('panorama',panorama);
}
function drawEffect(now){
  effects.replaceChildren();const effect=model.effect;if(!effect)return;
  const elapsed=now-effect.at,from=effect.from&&xy(effect.from.r,effect.from.c);
  if(effect.kind==='companion'&&elapsed<1000){effects.append(node('ellipse',{cx:from.x,cy:from.y,rx:20+elapsed*.16,ry:10+elapsed*.08,fill:'none',stroke:'#e7a477','stroke-width':2,opacity:1-elapsed/1000}));}
  if(effect.kind==='probe'&&elapsed<1500){const to=xy(effect.targets[0].r,effect.targets[0].c),t=Math.min(1,elapsed/650);effects.append(node('path',{d:`M${from.x} ${from.y}L${from.x+(to.x-from.x)*t} ${from.y+(to.y-from.y)*t}`,fill:'none',stroke:'#d2e5ee','stroke-width':2,'stroke-dasharray':'5 6',opacity:Math.min(1,(1500-elapsed)/300)}));if(t===1)effects.append(node('ellipse',{cx:to.x,cy:to.y,rx:24,ry:12,fill:'none',stroke:'#d2e5ee','stroke-width':2}));}
}
function tick(now){drawEffect(now);if(previousTime<model.panoramaUntil&&now>=model.panoramaUntil){model.message=model.complete?'教学完成。你可以继续练习，或开始正式探索。':'全景已收起，回到脚下与相邻四格的视野。';render(now);}previousTime=now;if(model.effect&&now-model.effect.at<1600||now<model.panoramaUntil)animation=requestAnimationFrame(tick);else animation=0;}
function perform(key){const now=performance.now();model.act(key,now);render(now);if(!animation){previousTime=now;animation=requestAnimationFrame(tick);}}
buttons.forEach(button=>{
  button.addEventListener('pointerdown',()=>markKey(button.dataset.key,true));
  button.addEventListener('pointerup',()=>markKey(button.dataset.key,false));
  button.addEventListener('pointercancel',()=>markKey(button.dataset.key,false));
  button.addEventListener('pointerleave',()=>markKey(button.dataset.key,false));
  button.addEventListener('click',()=>{pulse(button.dataset.key);perform(button.dataset.key);});
});
document.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;const raw=event.key.toLowerCase(),key=keyMap[raw]||raw;if(!buttons.some(b=>b.dataset.key===key))return;event.preventDefault();markKey(key,true);if(!event.repeat)perform(key);});
document.addEventListener('keyup',event=>{const key=keyMap[event.key.toLowerCase()]||event.key.toLowerCase();markKey(key,false);});
window.addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll();});
$('#reset-tutorial').addEventListener('click',()=>{cancelAnimationFrame(animation);animation=0;model.reset();effects.replaceChildren();releaseAll();render();});
$('#start-formal').addEventListener('click',event=>{if(performance.now()<model.panoramaUntil)event.preventDefault();});
render();
