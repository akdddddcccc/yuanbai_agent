// Runs inside the original game's closure: identical canvas, tools, sound and controls.
const lessons = [
  {key:'w', title:'迈出第一步', copy:'按 W（或 ↑），走向面前的光。踩到道具所在格，就能拾取它。', action:'move'},
  {key:'1', title:'听见同伴的声音', copy:'按 1，或点击「同伴的声音」。它会确认相邻四格，帮你分辨脚下的方向。', action:'companion'},
  {key:'w', title:'把线索带在身边', copy:'再按 W，拾起前方的「向前探测」。每个道具点只能拾取一次。', action:'move'},
  {key:'e', title:'转身，不必移动', copy:'按 E 向右转。朝向改变，位置不变；小灯会沿你面朝的方向探路。', action:'turn'},
  {key:'2', title:'让小灯先去看看', copy:'按 2，观察小灯出发、跳跃和落地。它标出前方最近的安全格，不会把你传送过去，也不保证途中安全。', action:'probe'},
  {key:'w', title:'拾起最后一种工具', copy:'按 W，向东北移动，拾起「瞬间全景」。移动键决定方向，与朝向无关。', action:'move'},
  {key:'3', title:'记住这 1.5 秒', copy:'按 3，让整张地图显现。图片是走过的路，混凝土是未知的路，× 是悬崖。', action:'panorama'},
  {key:'', title:'现在，去认识完整的元白', copy:'你已经学会移动、转向和三种工具。正式探索有 66 个安全格；注意 SAN 压力，慢慢找回建筑的轮廓。', action:'done'},
];
let lessonIndex=0;
const lessonPanel=document.getElementById('lesson-panel');
try{localStorage.setItem('yuanbai-school-onboarding-v2','seen');}catch{}
function syncLesson(){
  const lesson=lessons[lessonIndex];
  lessonPanel.dataset.step=String(lessonIndex);
  document.getElementById('lesson-count').textContent=lessonIndex===7?'准备就绪':`${String(lessonIndex+1).padStart(2,'0')} / 07`;
  document.getElementById('lesson-title').textContent=lesson.title;
  document.getElementById('lesson-copy').textContent=lesson.copy;
  document.getElementById('lesson-next-key').textContent=lesson.key?`按 ${lesson.key.toUpperCase()}`:'探索开始';
  document.getElementById('finish-lesson').hidden=lessonIndex!==7;
  document.querySelectorAll('.lesson-target').forEach(el=>el.classList.remove('lesson-target'));
  const toolId={1:'companion',2:'probe',3:'panorama'}[lesson.key];
  const target=toolId?ui[toolId]:document.querySelector(`[data-game-key="${lesson.key}"]`);
  target?.classList.add('lesson-target');
  canvas.dataset.lessonStep=String(lessonIndex);
  requestAnimationFrame(resize);
}
function allowLesson(action,value){
  const lesson=lessons[lessonIndex];
  const accepted=lesson.action===action && (action!=='move'||value===0) && (action!=='turn'||value===1);
  if(!accepted)toast('先试试提示中的操作 · '+(lesson.key||'完成教学'),1100);
  return accepted;
}
function completeLesson(action){
  if(lessons[lessonIndex].action!==action)return;
  // Keep the explanation and light on the active tool until its animation finishes.
  if(action==='companion'||action==='probe'||action==='panorama'){
    const wait=()=>{if(busy()){requestAnimationFrame(wait);return;}lessonIndex++;syncLesson();};
    requestAnimationFrame(wait);
  }else{lessonIndex++;syncLesson();}
}
function leaveLesson(){
  try{localStorage.setItem('yuanbai-school-onboarding-v2','complete');}catch{}
  location.assign('../explore/');
}
document.getElementById('skip-lesson').addEventListener('click',leaveLesson);
document.getElementById('finish-lesson').addEventListener('click',leaveLesson);
document.getElementById('restart-lesson').addEventListener('click',()=>location.reload());
for(const [key,type] of Object.entries({1:'companion',2:'probe',3:'panorama'})){
  document.addEventListener('keydown',event=>{if(event.key===key&&!event.ctrlKey&&!event.metaKey&&!event.altKey)ui[type].classList.add('is-active');});
  document.addEventListener('keyup',event=>{if(event.key===key)ui[type].classList.remove('is-active');});
}
window.addEventListener('blur',()=>document.querySelectorAll('.tool.is-active').forEach(el=>el.classList.remove('is-active')));
syncLesson();
