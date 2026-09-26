/* 元白 · 灰橙美术版。基于用户上传的 partner exact keyboard mobile 版本。 */
(function(root){
  'use strict';
  const SIZE=9, RULE_VERSION='yuanbai-v5-san', PANORAMA_MS=1500;
  const SAN_PER_SECOND=.2, SAN_PICKUP=8, SAN_FALL=8;
  const SAN_EFFECT_RAMP_MS=5000;
  const START={r:8,c:0};
  const CLIFFS=[3,7,11,15,22,26,28,34,40,46,50,56,60,66,70];
  const SAFE_COUNT=SIZE*SIZE-CLIFFS.length;
  const DIRS=[{dr:-1,dc:0,name:'东北',key:'W'},{dr:0,dc:1,name:'东南',key:'D'},{dr:1,dc:0,name:'西南',key:'S'},{dr:0,dc:-1,name:'西北',key:'A'}];
  const PICKUPS=[
    {index:63,type:'companion'},{index:74,type:'probe'},{index:54,type:'panorama'},
    {index:58,type:'companion'},{index:79,type:'companion'},{index:43,type:'probe'},
    {index:36,type:'probe'},{index:31,type:'panorama'},{index:19,type:'companion'},
    {index:8,type:'probe'},{index:5,type:'companion'},{index:0,type:'panorama'}
  ];
  const TOOL_NAMES={companion:'同伴的声音',probe:'向前探测',panorama:'瞬间全景'};
  const id=(r,c)=>r*SIZE+c;
  const inside=(r,c)=>r>=0&&r<SIZE&&c>=0&&c<SIZE;
  class Game{
    constructor(){this.reset();}
    reset(){
      this.r=START.r;this.c=START.c;this.direction=0;this.mode='playing';
      this.stock={companion:0,probe:0,panorama:0};this.picked=new Set();
      this.known=new Set([id(this.r,this.c)]);this.visited=new Set(this.known);this.safeVisited=new Set(this.visited);
      this.inspected=new Set();this.safeSignals=new Set();this.falls=0;this.outings=1;this.totalSteps=0;this.usedPanoramas=0;
      this.san=0;this.overloadMs=0;
    }
    get count(){return this.safeVisited.size;}
    get position(){return id(this.r,this.c);}
    get restrictedVision(){return this.san>=100;}
    get effectLevel(){return .72*Math.pow(this.san/100,1.5)+(this.restrictedVision?.12*(1-Math.exp(-this.overloadMs/1300)):0);}
    changeSan(amount){
      if(!Number.isFinite(amount))return 0;
      const before=this.san;this.san=Math.max(0,Math.min(100,this.san+amount));
      if(!this.restrictedVision)this.overloadMs=0;
      return this.san-before;
    }
    advanceTime(ms){
      if(!Number.isFinite(ms)||ms<=0||!['playing','falling'].includes(this.mode))return;
      const untilFull=Math.max(0,(100-this.san)/SAN_PER_SECOND*1000);
      this.changeSan(ms/1000*SAN_PER_SECOND);
      if(this.restrictedVision)this.overloadMs=Math.min(SAN_EFFECT_RAMP_MS,this.overloadMs+Math.max(0,ms-untilFull));
    }
    visibleCells(){
      const here={r:this.r,c:this.c};
      if(!this.restrictedVision)return [here,...this.neighbors()];
      const facing=DIRS[this.direction],r=this.r+facing.dr,c=this.c+facing.dc;
      return inside(r,c)?[here,{r,c}]:[here];
    }
    isCliff(r,c){return CLIFFS.includes(id(r,c));}
    neighbors(r=this.r,c=this.c){return DIRS.map((d,direction)=>({r:r+d.dr,c:c+d.dc,direction})).filter(p=>inside(p.r,p.c));}
    environment(){
      if(this.mode!=='playing')return null;
      // 只反馈异常存在，不透露方位、数量或距离。
      return this.neighbors().some(p=>this.isCliff(p.r,p.c))?{near:true}:null;
    }
    pickupAt(index){return this.picked.has(index)?null:PICKUPS.find(p=>p.index===index)||null;}
    turn(delta){if(this.mode!=='playing'||![1,-1].includes(delta))return false;this.direction=(this.direction+delta+4)%4;return true;}
    move(direction){
      if(this.mode!=='playing')return {kind:'busy'};
      if(!Number.isInteger(direction)||direction<0||direction>3)return {kind:'invalid'};
      this.direction=direction;const d=DIRS[direction],r=this.r+d.dr,c=this.c+d.dc;
      if(!inside(r,c))return {kind:'edge',direction};
      const from={r:this.r,c:this.c};this.r=r;this.c=c;this.totalSteps++;
      const target=id(r,c);this.known.add(target);this.visited.add(target);
      if(this.isCliff(r,c)){this.falls++;const sanDelta=this.changeSan(SAN_FALL);this.mode='falling';return {kind:'fall',from,to:{r,c},sanDelta};}
      this.safeVisited.add(target);
      const pickup=this.pickupAt(target);let sanDelta=0;if(pickup){this.picked.add(target);this.stock[pickup.type]++;sanDelta=this.changeSan(-SAN_PICKUP);}
      if(this.count===SAFE_COUNT)this.mode='won';
      return {kind:this.mode==='won'?'win':'move',from,to:{r,c},pickup,sanDelta};
    }
    useTool(type){
      if(this.mode!=='playing')return {kind:'busy'};
      if(!Object.hasOwn(this.stock,type))return {kind:'invalid'};
      if(!this.stock[type])return {kind:'empty',type};
      let targets=[];
      if(type==='companion'){
        targets=this.neighbors().map(p=>({...p,cliff:this.isCliff(p.r,p.c)}));
        for(const p of targets){this.inspected.add(id(p.r,p.c));if(p.cliff)this.known.add(id(p.r,p.c));}
      }else if(type==='probe'){
        const d=DIRS[this.direction];
        for(let r=this.r+d.dr,c=this.c+d.dc;inside(r,c);r+=d.dr,c+=d.dc){if(!this.isCliff(r,c)){targets.push({r,c,cliff:false});this.safeSignals.add(id(r,c));break;}}
        if(!targets.length)return {kind:'no-target'};
      }else{
        // 全景只短暂展示地图；既不增加安全格进度，也不永久显示全部危险。
        for(const i of CLIFFS)this.known.add(i);this.usedPanoramas++;
        targets=Array.from({length:81},(_,i)=>({r:Math.floor(i/9),c:i%9,cliff:CLIFFS.includes(i)}));
      }
      this.stock[type]--;
      return {kind:'tool',type,targets};
    }
    respawn(){
      if(this.mode!=='falling')return false;
      this.r=START.r;this.c=START.c;this.direction=0;this.outings++;this.mode='playing';return true;
    }
  }
  function replay(actions){
    if(!Array.isArray(actions)||actions.length<1||actions.length>12000)throw new Error('动作记录无效');
    const g=new Game();
    for(const a of actions){
      if(typeof a!=='string')throw new Error('动作格式无效');
      if(/^m[0-3]$/.test(a)){const result=g.move(Number(a[1]));if(['busy','invalid'].includes(result.kind))throw new Error('当前状态无法移动');}
      else if(a==='left'||a==='right'){if(!g.turn(a==='left'?-1:1))throw new Error('当前状态无法转向');}
      else if(Object.hasOwn(TOOL_NAMES,a)){const result=g.useTool(a);if(result.kind!=='tool')throw new Error('道具未拾取或已耗尽');}
      else if(a==='respawn'){if(!g.respawn())throw new Error('无坠落却请求复位');}
      else throw new Error('未知操作');
    }
    if(g.mode!=='won'||g.count!==SAFE_COUNT)throw new Error('尚未走遍全部安全格');return g;
  }
  const api={Game,SIZE,SAFE_COUNT,START,CLIFFS,DIRS,PICKUPS,TOOL_NAMES,RULE_VERSION,PANORAMA_MS,SAN_PER_SECOND,SAN_PICKUP,SAN_FALL,id,inside,replay};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.YuanbaiCore=api;
})(typeof window!=='undefined'?window:globalThis);

