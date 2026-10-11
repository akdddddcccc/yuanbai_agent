export const SIZE = 5;
export const DIRECTIONS = [{r:-1,c:0,name:'东北',key:'W'},{r:0,c:1,name:'东南',key:'D'},{r:1,c:0,name:'西南',key:'S'},{r:0,c:-1,name:'西北',key:'A'}];
export const TOOLS = {companion:{name:'同伴的声音',key:'1',symbol:'◎'},probe:{name:'向前探测',key:'2',symbol:'⌁'},panorama:{name:'瞬间全景',key:'3',symbol:'✳'}};
export const PICKUPS = [{r:3,c:0,type:'companion'},{r:2,c:0,type:'probe'},{r:1,c:0,type:'panorama'}];
export const CLIFFS = new Set([2*SIZE+1,3*SIZE+1,1*SIZE+3]);
export const index = (r,c) => r*SIZE+c;
const inside = (r,c) => r>=0 && r<SIZE && c>=0 && c<SIZE;
export class Tutorial {
  constructor(){this.reset();}
  reset(){
    this.r=4;this.c=0;this.direction=0;this.visited=new Set([index(4,0)]);
    this.collected=new Set();this.used=new Set();this.inspected=new Set();this.probed=new Set();
    this.moved=false;this.turned=false;this.panoramaUntil=0;this.effect=null;
    this.message='按 W 或 ↗，走到前方的橙色光点，拾取第一个工具。';
  }
  get complete(){return this.moved && this.turned && this.used.size===3;}
  get progress(){return Number(this.moved)+Number(this.turned)+this.used.size;}
  visible(r,c,now=0){return now<this.panoramaUntil || Math.abs(this.r-r)+Math.abs(this.c-c)<=1;}
  clue(r,c,now=0){return now<this.panoramaUntil || this.inspected.has(index(r,c));}
  nextLesson(){
    if(!this.moved)return {title:'迈出第一步',body:'按 W 向东北走一步。方向键或下方屏幕按键也能操作。',key:'w',target:PICKUPS[0]};
    if(!this.collected.has('companion'))return {title:'拾起同伴的声音',body:'走到地图左侧的橙色 ◎ 光点，拾取工具。',target:PICKUPS[0]};
    if(!this.used.has('companion'))return {title:'听听身边的回应',body:'按 1 确认相邻四格。× 是悬崖，空心圆是安全线索。',key:'1'};
    if(!this.collected.has('probe'))return {title:'继续向前，拾起探测',body:'沿左侧继续向东北走，拾取银色 ⌁ 光点。',target:PICKUPS[1]};
    if(!this.turned)return {title:'先转向，再观察',body:'按 E 右转，或按 Q 左转。转向改变朝向，不会改变位置。',key:'e'};
    if(!this.used.has('probe'))return {title:'试探前方的落点',body:'按 2 标记朝向上的最近安全格。它不会带你移动，也不保证途中安全。',key:'2'};
    if(!this.collected.has('panorama'))return {title:'找到最后一种工具',body:'沿左侧继续向东北走，拾取浅金色 ✳ 光点。',target:PICKUPS[2]};
    if(!this.used.has('panorama'))return {title:'看见完整的地图',body:'按 3，全图亮起 1.5 秒。记住自己的位置和悬崖，再回到局部视野。',key:'3'};
    return {title:'准备好，踏入未知',body:'你已体验移动、转向和全部工具。可以继续练习，或进入正式的 9 × 9 探索。'};
  }
  act(key,now=0){
    const action=key.toLowerCase();
    if(now<this.panoramaUntil){this.message='全景正在展开，观察 1.5 秒后再继续操作。';return {kind:'busy'};}
    const moves={w:0,d:1,s:2,a:3};
    if(Object.hasOwn(moves,action)){
      this.direction=moves[action];const d=DIRECTIONS[this.direction],r=this.r+d.r,c=this.c+d.c;
      if(!inside(r,c)){this.message='这里是教学地图的边界，换个方向试试。';return {kind:'edge'};}
      this.moved=true;
      if(CLIFFS.has(index(r,c))){this.inspected.add(index(r,c));this.r=4;this.c=0;this.direction=0;this.message='这是悬崖。已回到起点，练习进度与拾取的工具保留。';this.effect={kind:'fall',at:now};return {kind:'fall'};}
      this.r=r;this.c=c;this.visited.add(index(r,c));
      const pickup=PICKUPS.find(p=>p.r===r&&p.c===c&&!this.collected.has(p.type));
      if(pickup){this.collected.add(pickup.type);this.message=`拾取了${TOOLS[pickup.type].name}，按 ${TOOLS[pickup.type].key} 试一试。`;}
      else this.message=`向${d.name}移动一格。亲自走过的格子才会留下探索进度。`;
      this.effect={kind:'move',at:now};return {kind:'move',pickup};
    }
    if(action==='q'||action==='e'){
      this.direction=(this.direction+(action==='q'?3:1))%4;this.turned=true;
      this.message=`${action==='q'?'左转':'右转'}，现在面朝${DIRECTIONS[this.direction].name}。位置没有改变。`;
      return {kind:'turn'};
    }
    const type=Object.keys(TOOLS).find(t=>TOOLS[t].key===action);
    if(!type)return {kind:'ignored'};
    if(!this.collected.has(type)){this.message=`先走到 ${TOOLS[type].symbol} 光点，拾取${TOOLS[type].name}。`;return {kind:'empty',type};}
    const targets=[];
    if(type==='companion'){
      for(const d of DIRECTIONS){const r=this.r+d.r,c=this.c+d.c;if(inside(r,c)){targets.push({r,c});this.inspected.add(index(r,c));}}
      this.message='同伴的声音确认了相邻四格：× 是悬崖，○ 是安全格。';
    }else if(type==='probe'){
      const d=DIRECTIONS[this.direction];
      for(let r=this.r+d.r,c=this.c+d.c;inside(r,c);r+=d.r,c+=d.c){if(!CLIFFS.has(index(r,c))){targets.push({r,c});this.probed.add(index(r,c));break;}}
      if(!targets.length){this.message='这个方向没有安全落点。用 Q / E 换个朝向，再按 2。';return {kind:'no-target',type};}
      this.message='已标记前方最近安全格。探测光经过的中间格仍可能是悬崖，你还在原位。';
    }else{
      this.panoramaUntil=now+1500;
      this.message='全图亮起 1.5 秒：× 是悬崖，亮色是已走过的格子。';
    }
    this.used.add(type);this.effect={kind:type,at:now,from:{r:this.r,c:this.c},targets};
    return {kind:'tool',type,targets};
  }
}
