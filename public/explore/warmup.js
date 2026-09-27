/* 独立热身：不使用正式 Game、计时、道具或排行榜。 */
(function(root) {
  'use strict';
  const SIZE = 3;
  const DIRS = [{dr:-1,dc:0},{dr:0,dc:1},{dr:1,dc:0},{dr:0,dc:-1}];
  const NAMES = ['东北 ↗','东南 ↘','西南 ↙','西北 ↖'];
  const KEYS = {w:0,ArrowUp:0,d:1,ArrowRight:1,s:2,ArrowDown:2,a:3,ArrowLeft:3};
  const inside = (r,c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  class Warmup {
    constructor() { this.reset(); }
    reset() { this.r=2; this.c=0; this.direction=0; this.visited=new Set([6]); }
    get complete() { return this.visited.size === SIZE*SIZE; }
    visibleCells() {
      const cells=new Set(this.visited), d=DIRS[this.direction];
      const r=this.r+d.dr,c=this.c+d.dc;
      if(inside(r,c)) cells.add(r*SIZE+c);
      return cells;
    }
    turn(delta) {
      if(this.complete || ![-1,1].includes(delta)) return false;
      this.direction=(this.direction+delta+4)%4;
      return true;
    }
    move(direction) {
      if(this.complete) return 'complete';
      if(!Number.isInteger(direction) || direction<0 || direction>3) return 'invalid';
      this.direction=direction;
      const d=DIRS[direction],r=this.r+d.dr,c=this.c+d.dc;
      if(!inside(r,c)) return 'edge';
      this.r=r; this.c=c; this.visited.add(r*SIZE+c);
      return this.complete ? 'complete' : 'move';
    }
  }
  function mount(dialog) {
    if(!dialog) return null;
    const model=new Warmup(), $=s=>dialog.querySelector(s);
    const board=$('#warmup-board'), status=$('#warmup-status'), next=$('#warmup-finish');
    const svgNS='http://www.w3.org/2000/svg';
    const shape=(tag,attrs,parent)=>{
      const node=document.createElementNS(svgNS,tag);
      for(const [name,value] of Object.entries(attrs)) node.setAttribute(name,value);
      parent.append(node); return node;
    };
    function render(message) {
      const visible=model.visibleCells();
      board.replaceChildren();
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) {
        const index=r*SIZE+c;
        if(!visible.has(index)) continue;
        const x=240+(c-r)*66,y=76+(c+r)*33;
        const current=r===model.r && c===model.c, visited=model.visited.has(index);
        const direction=DIRS.findIndex(d=>model.r+d.dr===r && model.c+d.dc===c);
        const cell=shape('g',{'data-cell':index,'data-visited':visited,'class':current?'warmup-current':visited?'warmup-visited':'warmup-front'},board);
        shape('path',{d:`M${x-62} ${y}L${x} ${y+31}L${x+62} ${y}V${y+12}L${x} ${y+43}L${x-62} ${y+12}Z`,class:'warmup-side'},cell);
        const surface=shape('path',{d:`M${x} ${y-31}L${x+62} ${y}L${x} ${y+31}L${x-62} ${y}Z`,class:'warmup-surface'},cell);
        if(direction>=0 && !model.complete) {
          surface.style.cursor='pointer';
          surface.addEventListener('click',()=>act(direction));
        }
        if(visited && !current) {
          shape('circle',{cx:x,cy:y,r:3,class:'warmup-trace'},cell);
        }
        if(current) {
          shape('ellipse',{cx:x,cy:y+2,rx:13,ry:5,fill:'#0006'},cell);
          shape('path',{d:`M${x-10} ${y}L${x-4} ${y-24}H${x+4}L${x+10} ${y}Q${x} ${y+5} ${x-10} ${y}`,fill:'#eae5dd'},cell);
          shape('circle',{cx:x,cy:y-32,r:6,fill:'#fff5e7'},cell);
          const d=DIRS[model.direction],dx=(d.dc-d.dr)*25,dy=(d.dc+d.dr)*12.5;
          shape('path',{d:`M${x+dx*.6} ${y+dy*.6}L${x+dx*1.35} ${y+dy*1.35}`,stroke:'#ffc08f','stroke-width':3,'stroke-linecap':'round'},cell);
        }
      }
      $('#warmup-count').textContent=`${model.visited.size} / 9`;
      $('#warmup-facing').textContent=`面朝 ${NAMES[model.direction]}`;
      board.setAttribute('aria-label',`3×3 热身地图，位于第 ${model.r+1} 行第 ${model.c+1} 列，面朝${NAMES[model.direction]}，已走过 ${model.visited.size} 格。只显示脚下、正前方一格和走过的格子。`);
      const progress=$('#warmup-progress');
      progress.setAttribute('aria-valuenow',model.visited.size);
      progress.firstElementChild.style.width=`${model.visited.size/9*100}%`;
      status.textContent=model.complete?'热身完成。你已经用脚步照亮了这片小小的元白。':message || '先试着按 W 向前一步，再用 Q / E 转身观察。';
      next.hidden=!model.complete;
      $('#warmup-skip').hidden=model.complete;
      for(const button of dialog.querySelectorAll('[data-warmup-move],[data-warmup-turn]')) button.disabled=model.complete;
      if(model.complete) next.focus({preventScroll:true});
    }
    function act(direction) {
      const result=model.move(direction);
      render(result==='edge'?'前方已到边界，按 Q / E 换个朝向。':'走过的格子会一直亮着；未走过的地方，只看见正前方一格。');
    }
    function turn(delta) { if(model.turn(delta)) render('朝向改变了。刚才看见但没走过的格子，重新藏回黑暗。'); }
    for(const button of dialog.querySelectorAll('[data-warmup-move]')) button.addEventListener('click',()=>act(Number(button.dataset.warmupMove)));
    for(const button of dialog.querySelectorAll('[data-warmup-turn]')) button.addEventListener('click',()=>turn(Number(button.dataset.warmupTurn)));
    $('#warmup-retry').addEventListener('click',()=>{model.reset();render();});
    $('#warmup-skip').addEventListener('click',()=>dialog.close());
    next.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('keydown',event=>{
      if(event.altKey || event.ctrlKey || event.metaKey) return;
      const key=event.key.length===1?event.key.toLowerCase():event.key;
      if(!(key in KEYS) && key!=='q' && key!=='e' && !['1','2','3'].includes(key)) return;
      event.preventDefault(); event.stopPropagation();
      if(event.repeat) return;
      if(key in KEYS) act(KEYS[key]); else if(key==='q' || key==='e') turn(key==='q'?-1:1);
      else render('热身无需道具，只用移动和转向就能走遍九格。');
    });
    return {open() {
      model.reset();
      render(); dialog.showModal(); $('#warmup-move-w').focus({preventScroll:true});
    }};
  }
  const api={Warmup,mount};
  if(typeof module!=='undefined' && module.exports) module.exports=api; else root.YuanbaiWarmup=api;
})(typeof window!=='undefined'?window:globalThis);
