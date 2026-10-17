/**
 * 学校教学编排，不是独立脚本。
 * build-school-tutorial.mjs 将本文件插入正式 game.js 的闭包内，复用 game、ui、
 * canvas、resize、busy、toast 等变量/函数，以及原有角色、道具动画和声音。
 * 调整文案可改 lessons；改变动作顺序时，需同时检查构建脚本中的拾取位置与动作钩子。
 */
// action 是完成条件；key 用于显示和高亮。七步依次为 W → 1 → W → E → 2 → W → 3。
const lessons = [
  {key:'w', title:'迈出第一步', copy:'按 W（或 ↑），走向面前的光。踩到道具所在格，就能拾取它。', action:'move'},
  {key:'1', title:'听见同伴的声音', copy:'按 1，或点击「同伴的声音」。它会确认相邻四格，帮你分辨脚下的方向。', action:'companion'},
  {key:'w', title:'把线索带在身边', copy:'再按 W，拾起前方的「向前探测」。每个道具点只能拾取一次。', action:'move'},
  {key:'e', title:'转身，不必移动', copy:'按 E 向右转。朝向改变，位置不变；小灯会沿你面朝的方向探路。', action:'turn'},
  {key:'2', title:'让小灯先去看看', copy:'按 2，观察小灯出发、跳跃和落地。它标出前方最近的安全格，不会把你传送过去，也不保证途中安全。', action:'probe'},
  {key:'w', title:'拾起最后一种工具', copy:'按 W，向东北移动，拾起「瞬间全景」。移动键决定方向，与朝向无关。', action:'move'},
  {key:'3', title:'记住这 1.5 秒', copy:'按 3，让整张地图显现。图片是走过的路，彩色色块是未知的路，× 是悬崖。', action:'panorama'},
  {key:'', title:'现在，去认识完整的元白', copy:'你已经学会移动、转向和三种工具。正式探索有 66 个安全格；注意 SAN 压力，慢慢找回建筑的轮廓。', action:'done'},
];
let lessonIndex=0;
const lessonPanel=document.getElementById('lesson-panel');
// 使用原生 dialog：自动限制焦点和背景交互。弹层文案是固定本地内容，不拼入用户输入。
const rulesIntro=document.createElement('dialog');
rulesIntro.id='rules-intro';rulesIntro.setAttribute('aria-labelledby','rules-intro-title');
rulesIntro.innerHTML=`<span class="rules-intro-eyebrow">探索元白 / 初次感知</span><h2 id="rules-intro-title">先用几步，学会探索。</h2><p>一小片 4 × 4 的空间，带你认识移动、转向和三种工具。</p><ol><li><b>走过，才算发现</b><span>正式探索是 9 × 9 网格，走遍 66 个安全格，拼回元白楼。</span></li><li><b>让线索照亮下一步</b><span>同伴确认相邻四格，小灯探测前方，全景短暂展示地图。</span></li><li><b>留意感知压力</b><span>SAN 随时间增加，拾取道具可以降低；满值时转向寻找前路。</span></li></ol><p class="rules-intro-note">跟随呼吸的光，按下对应按键，或直接点击发光按钮。</p><div class="rules-intro-actions"><button id="begin-lesson" autofocus>开始互动教学 ↗</button><button id="skip-intro">直接进入游戏</button></div>`;
document.body.append(rulesIntro);
const focusRing=document.createElement('div');focusRing.id='lesson-focus';focusRing.setAttribute('aria-hidden','true');
// 光圈与文字只是视觉层（CSS pointer-events:none），实际点击仍落在原游戏按钮上。
focusRing.innerHTML='<span></span>';document.body.append(focusRing);
let focusTarget=null;
function positionLessonFocus(){
  // getBoundingClientRect 包含原键盘的等距变换；不能用未变换的 offsetWidth 定位。
  focusRing.hidden=rulesIntro.open||!focusTarget||lessonIndex===7;
  if(focusRing.hidden)return;
  const rect=focusTarget.getBoundingClientRect(),padding=8;
  focusRing.style.left=`${rect.left-padding}px`;focusRing.style.top=`${rect.top-padding}px`;
  focusRing.style.width=`${rect.width+padding*2}px`;focusRing.style.height=`${rect.height+padding*2}px`;
  focusRing.classList.toggle('key-focus',focusTarget.hasAttribute('data-game-key'));
}
rulesIntro.addEventListener('close',()=>{focusTarget?.focus({preventScroll:true});positionLessonFocus();});
rulesIntro.querySelector('#begin-lesson').addEventListener('click',()=>rulesIntro.close());
rulesIntro.querySelector('#skip-intro').addEventListener('click',leaveLesson);
addEventListener('resize',()=>requestAnimationFrame(positionLessonFocus));
addEventListener('scroll',positionLessonFocus,{capture:true,passive:true});
new ResizeObserver(()=>requestAnimationFrame(positionLessonFocus)).observe(document.querySelector('.movement-cluster'));
// seen 在进入教学时写入，complete 在完成/跳过时写入；两者都会阻止下次自动进入。
// 此键只属于当前来源和浏览器。主动打开 tutorial/ 不受限制，便于随时重看。
try{localStorage.setItem('yuanbai-school-onboarding-v2','seen');}catch{}
try{sessionStorage.setItem('yuanbai-school-onboarding-v2','seen');}catch{}
function syncLesson(){
  // 统一更新顶部文字、按钮高亮与就近提示，避免步骤切换后光圈指向上一项。
  const lesson=lessons[lessonIndex];
  lessonPanel.dataset.step=String(lessonIndex);
  document.body.classList.toggle('lesson-complete',lessonIndex===7);
  document.getElementById('lesson-count').textContent=lessonIndex===7?'准备就绪':`${String(lessonIndex+1).padStart(2,'0')} / 07`;
  document.getElementById('lesson-title').textContent=lesson.title;
  document.getElementById('lesson-copy').textContent=lesson.copy;
  document.getElementById('lesson-next-key').textContent=lesson.key?`按 ${lesson.key.toUpperCase()}`:'探索开始';
  document.getElementById('finish-lesson').hidden=lessonIndex!==7;
  document.querySelectorAll('.lesson-target').forEach(el=>el.classList.remove('lesson-target'));
  const toolId={1:'companion',2:'probe',3:'panorama'}[lesson.key];
  const target=lessonIndex===7?document.getElementById('finish-lesson'):toolId?ui[toolId]:document.querySelector(`[data-game-key="${lesson.key}"]`);
  target?.classList.add('lesson-target');
  focusTarget=target;
  focusRing.firstElementChild.textContent=lesson.key?`按 ${lesson.key.toUpperCase()} · 或点击这里`:'准备好，开始探索';
  document.body.classList.toggle('lesson-has-target',!!target);
  canvas.dataset.lessonStep=String(lessonIndex);
  requestAnimationFrame(()=>{resize();positionLessonFocus();if(lessonIndex===7)document.getElementById('finish-lesson').focus({preventScroll:true});});
}
function allowLesson(action,value){
  // 教学限定安全路线。正式游戏不注入此门控，仍可自由移动和使用工具。
  const lesson=lessons[lessonIndex];
  const accepted=lesson.action===action && (action!=='move'||value===0) && (action!=='turn'||value===1);
  if(!accepted)toast('先试试提示中的操作 · '+(lesson.key||'完成教学'),1100);
  return accepted;
}
function completeLesson(action){
  if(lessons[lessonIndex].action!==action)return;
  // 等待原动画完成再推进：避免小灯还在移动时文字和光圈已经跳到下一步。
  if(action==='companion'||action==='probe'||action==='panorama'){
    const wait=()=>{if(busy()){requestAnimationFrame(wait);return;}lessonIndex++;syncLesson();};
    requestAnimationFrame(wait);
  }else{lessonIndex++;syncLesson();}
}
function leaveLesson(){
  // 正式游戏另起页面和正常计分局；教学步数/道具库存不会带入正式成绩。
  try{localStorage.setItem('yuanbai-school-onboarding-v2','complete');}catch{}
  try{sessionStorage.setItem('yuanbai-school-onboarding-v2','complete');}catch{}
  location.assign('../game/');
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
rulesIntro.showModal();
positionLessonFocus();
