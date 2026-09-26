/* 元白 · 失重之间 | Canvas绘制、输入、声音与动画。 */
(() => {
  'use strict';
  const { Game, SIZE, SAFE_COUNT, DIRS, CLIFFS, PICKUPS, TOOL_NAMES, RULE_VERSION, PANORAMA_MS, SAN_PER_SECOND, SAN_PICKUP, SAN_FALL, id } = window.YuanbaiCore;
// 公共 API 地址不是密钥。身份令牌由服务端生成，保存在本机浏览器中。
  const leaderboardBase='/api/yuanbai/game';
  const tokenStorageKey='yuanbai-player-v1';
  const nameStorageKey='yuanbai-player-name-v1';
  let playerToken=null;
  try{playerToken=localStorage.getItem(tokenStorageKey);}catch{}
  let lockedName='';
  try{lockedName=localStorage.getItem(nameStorageKey)||'';}catch{}
  let runId=null,practice=false,actions=[],verified=null,verifying=false,submitting=false,generation=0;
  let boardPage=1,boardPages=1,boardRequest=0,boardKind='normal',finishersRequest=0;
  const game = new Game(), $ = s => document.querySelector(s);
  const uiFont='"Yuanbai Sans","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  const canvas = $('#world'), ctx = canvas.getContext('2d', { alpha: false });
  const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
  const arrow = ['↗','↘','↙','↖'];
  const pad = n => String(n).padStart(2, '0');
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = x => 1 - Math.pow(1 - clamp(x), 3);
  let viewY=0, overviewY=0, overviewSize=0;
  let width = 0, height = 0, tile = 190, camera = { x: 0, y: 0 }, lastTime = 0;
  let frameLights=[],pickupFlashes=[];
  const pickupColors={companion:'#ef9c60',probe:'#c6d0d8',panorama:'#e4c3a7'};
  let walking=null,falling=null,winning=null,sweep=null,echoCue=null,hover=-1,overview=null,boundary=null;
  let starting=false,started=false,startTick=0,endElapsed=null,lastClock=0,toastUntil=0;
  const viewOpacity=new Map();
  let soundEnabled = true, hapticsEnabled=true, audio = null, artReady = false;
  let lastSanTick=0,lastSanUI=0,wasRestricted=false,lastStrainTone=0;
  let renderShift={x:0,y:0};
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  ui['reduce-motion'].checked = reduced;
  const art = new Image();
  const textures = new Map();
  const fallOrder = Array.from({ length: 81 }, (_, i) => ({ index: i, delay: random(i + 90) * .6, spin: random(i + 170) - .5 }));
  function random(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function plane(r, c, size = tile) { return { x: (c - r) * size / 2, y: (c + r) * size / 4 }; }
  function resize() {
    const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fit the scene between the HUD and the tool dock, including small phones.
    const top=document.querySelector('.san-block').getBoundingClientRect().bottom-rect.top+18;
    const noteTop=document.querySelector('.stage-note').getBoundingClientRect().top;
    const limit=ui['vision-status'].hidden?noteTop:Math.min(noteTop,ui['vision-status'].getBoundingClientRect().top);
    const bottom=limit-rect.top-14;
    tile=Math.max(35,Math.min(width*.36,(bottom-top)/1.5,242));
    viewY=(top+bottom)/2;
    const overviewTop=Math.min(76,height*.24);
    overviewSize=Math.max(12,Math.min(width/9.7,(bottom-overviewTop)/5.1));
    overviewY=(overviewTop+bottom)/2;
  }
  new ResizeObserver(resize).observe(canvas);
  document.fonts.ready.then(resize);
  function material(index, revealed) {
    const key=index+':'+(revealed&&artReady?1:0);
    if(textures.has(key))return textures.get(key);
    const t=document.createElement('canvas');t.width=t.height=180;
    const c=t.getContext('2d'),base=c.createLinearGradient(0,0,180,180);
    base.addColorStop(0,'#57595c');base.addColorStop(1,'#3c3e41');c.fillStyle=base;c.fillRect(0,0,180,180);
    if(revealed&&artReady){const ux=art.naturalWidth/9,uy=art.naturalHeight/9;c.drawImage(art,index%9*ux,Math.floor(index/9)*uy,ux,uy,0,0,180,180);}
    c.globalAlpha=revealed&&artReady?.25:1;
    // Fine concrete grain, pinholes and oxide along broken hairline seams.
    for(let i=0;i<2800;i++){
      const seed=index*947+i*17,x=random(seed)*180,y=random(seed+5)*180;
      c.fillStyle=i%3?'#d2d2d216':'#0c0c0c60';
      const grain=.25+random(seed+8)*.8;c.fillRect(x,y,grain,grain);
    }
    for(let vein=0;vein<19;vein++){
      const seed=index*1493+vein*61,x0=random(seed)*180,y0=random(seed+3)*180;
      const angle=random(seed+4)*Math.PI*2,length=13+random(seed+7)*48;
      c.strokeStyle='#1b1b1b50';c.lineWidth=.45;c.beginPath();
      for(let k=0;k<7;k++){const u=k/6,jitter=(random(seed+k*11)-.5)*2.6;
        const x=x0+Math.cos(angle)*length*u-Math.sin(angle)*jitter,y=y0+Math.sin(angle)*length*u+Math.cos(angle)*jitter;k?c.lineTo(x,y):c.moveTo(x,y);}
      c.stroke();
      for(let chip=0;chip<105;chip++){
        const k=seed+chip*23,u=random(k),spread=(random(k+2)-.5)*(3+7*Math.sin(u*Math.PI));
        const x=x0+Math.cos(angle)*length*u-Math.sin(angle)*spread,y=y0+Math.sin(angle)*length*u+Math.cos(angle)*spread;
        const grain=.5+random(k+6)*1.7;
        c.fillStyle='#281d17a6';c.fillRect(x+.45,y+.65,grain+.4,grain*.78);
        c.fillStyle=['#a85529bd','#ce823bbf','#62371bd9','#dfa2658c'][chip%4];c.fillRect(x,y,grain,grain*.7);
        if(chip%4===0){c.fillStyle='#efc18e8c';c.fillRect(x-.1,y-.15,grain*.65,.35);}
        if(chip%9===0){c.fillStyle='#1e1d1aaa';c.fillRect(x+grain*.35,y+grain*.3,.5,.5);}
        if(chip%7===0){c.fillStyle='#1a1a1a66';c.fillRect(x+.65,y+.65,grain,.4);}
      }
    }
    // Coarse oxide blooms: dense cores, scattered angular flakes and pale lifted edges.
    for(let patch=0;patch<7;patch++){
      const seed=index*1817+patch*739,cx=9+random(seed)*162,cy=9+random(seed+3)*162;
      const rx=5+random(seed+7)*13,ry=3+random(seed+9)*7;
      for(let f=0;f<110;f++){
        const n=seed+f*31,angle=random(n+1)*Math.PI*2,rad=Math.sqrt(random(n+4));
        const x=cx+Math.cos(angle)*rx*rad,y=cy+Math.sin(angle)*ry*rad;
        const chip=.5+random(n+6)*2.1;
        c.fillStyle=['#793c23b8','#ad5c2dc9','#d98945b0','#e6a36399'][f%4];
        const oxide=c.fillStyle;c.fillStyle='#271b15a8';c.fillRect(x+.55,y+.7,chip+.35,chip*.75);
        c.fillStyle=oxide;c.fillRect(x,y,chip,chip*.68);
        if(f%4===0){c.fillStyle='#edd0a18a';c.fillRect(x-.15,y-.3,chip*.7,.4);}
        if(f%5===0){c.fillStyle='#292829a6';c.fillRect(x+.5,y+chip*.7,chip,.55);}
        if(f%7===0){c.fillStyle='#f0ba7973';c.fillRect(x,y,chip,.45);}
      }
    }
    c.globalAlpha=1;textures.set(key,t);return t;
  }
  function warmFloorTextures(){
    let next=0;
    const schedule=window.requestIdleCallback?fn=>requestIdleCallback(fn,{timeout:100}):fn=>setTimeout(()=>fn({timeRemaining:()=>5}),24);
    function batch(deadline){const begin=performance.now();do{material(next++,false);}while(next<81&&performance.now()-begin<5&&deadline.timeRemaining()>1);if(next<81)schedule(batch);}
    schedule(batch);
  }
  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function drawTexture(points, texture, alpha = 1) {
    const [a,b,,d] = points;
    ctx.save(); polygon(points); ctx.clip(); ctx.globalAlpha *= alpha;
    ctx.transform((b.x-a.x)/texture.width,(b.y-a.y)/texture.width,(d.x-a.x)/texture.height,(d.y-a.y)/texture.height,a.x,a.y);
    ctx.drawImage(texture, 0, 0); ctx.restore();
  }
  function diamond(x, y, size) { return [{x,y:y-size/4},{x:x+size/2,y},{x,y:y+size/4},{x:x-size/2,y}]; }
  function drawTile(r, c, center, size, opacity, finale = 0, time = 0) {
    const index = id(r,c), current = game.r === r && game.c === c;
    const revealed=game.safeVisited.has(index),cliff=CLIFFS.includes(index)&&(!!overview||game.visited.has(index)||game.inspected.has(index))&&!winning;
    let points = diamond(center.x, center.y, size * .95);
    if (winning) {
      const mosaic = Math.max(90,Math.min(width-42,height-(width<700?104:176),680)), cell = mosaic / 9;
      const x = width / 2 - mosaic / 2 + c * cell + .75;
      const y = height / 2 - mosaic / 2 + (width<700?27:39) + r * cell + .75;
      const square = [{x,y},{x:x+cell-1.5,y},{x:x+cell-1.5,y:y+cell-1.5},{x,y:y+cell-1.5}];
      points = points.map((p,i) => ({x:lerp(p.x,square[i].x,finale),y:lerp(p.y,square[i].y,finale)}));
    }
    const depth = size * .128 * (1 - finale), [a,b,d,e] = points;
    ctx.save(); ctx.globalAlpha = opacity;
    polygon([e,d,{x:d.x,y:d.y+depth},{x:e.x,y:e.y+depth}],cliff?'#0a0a0a':'#343538',null);
    polygon([b,d,{x:d.x,y:d.y+depth},{x:b.x,y:b.y+depth}],cliff?'#090909':'#232427',null);
    polygon(points,cliff?'#060606':'#484a4d');
    drawTexture(points,material(index,revealed || !!winning),cliff?.15:1);
    if (!current && !winning) polygon(points,cliff?'#0008':'#00000026');
    if(!cliff&&!falling&&!winning)lightSurface(points,center,size);
    polygon(points,null,current&&!winning?'#f0d4b3':cliff?'#c08356':overview&&revealed?'#ad8d6e':'#77797c',current?2:.85);
    // 侧面只保留整块明暗，去除竖向装饰线和侧面竖边描线。
    if(current && boundary && !winning && !overview){
      const edges=[[a,b],[b,d],[d,e],[e,a]],edge=edges[boundary.direction];
      const strength=clamp(1-(time-boundary.start)/1100);
      ctx.save();ctx.globalAlpha*=strength;ctx.strokeStyle='#ffc291';ctx.shadowColor='#eb914f';ctx.shadowBlur=22;ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(edge[0].x,edge[0].y);ctx.lineTo(edge[1].x,edge[1].y);ctx.stroke();ctx.restore();
    }
    if (cliff) {
      ctx.fillStyle='#231209';ctx.beginPath();ctx.arc(center.x,center.y,overview?6:10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffc293';ctx.font=(overview?'bold 13px':'bold 18px')+' '+uiFont;ctx.textAlign='center';ctx.fillText('×',center.x,center.y+(overview?4:6));
    } else if ((game.inspected.has(index) || game.safeSignals.has(index)) && !revealed && !winning) {
      ctx.fillStyle='#bcbcbc'; ctx.beginPath();ctx.arc(center.x,center.y+2,2.5,0,Math.PI*2);ctx.fill();
    }
    const pickup=game.pickupAt(index);
    if(pickup&&!winning&&!falling){
      const colors={companion:'#ef9c60',probe:'#c6d0d8',panorama:'#e4c3a7'};
      const radius=overview?Math.max(3.8,size*.10):clamp(size*.09,6.5,23);
      const bob=reduced||overview?0:Math.sin(time/900+index)*Math.min(2,size*.009);
      const y=center.y-(overview?size*.10:size*.15)+bob;
      drawPickupOrb(pickup.type,center.x,y,center.y,radius,colors[pickup.type],!!overview);
    }
    if (hover === index && !falling && !winning && !overview) polygon(points,'#ffffff10','#dcdcdc',1.5);
    ctx.restore();
  }
  function lightSurface(points,center,size){
    if(!frameLights.length)return;
    ctx.save();polygon(points);ctx.clip();ctx.globalCompositeOperation='screen';
    for(const light of frameLights){
      const range=size*(overview?.34:.88),distance=Math.hypot(center.x-light.x,(center.y-light.groundY)*2);
      if(distance>range+size*.38)continue;
      const rgb=[1,3,5].map(i=>parseInt(light.color.slice(i,i+2),16));
      ctx.save();ctx.translate(light.x,light.groundY);ctx.scale(1,.50);
      const pool=ctx.createRadialGradient(0,0,0,0,0,range);
      pool.addColorStop(0,`rgba(${rgb.join(',')},${.25*light.alpha})`);
      pool.addColorStop(.28,`rgba(${rgb.join(',')},${.13*light.alpha})`);pool.addColorStop(1,`rgba(${rgb.join(',')},0)`);
      ctx.fillStyle=pool;ctx.fillRect(-range,-range,range*2,range*2);ctx.restore();
    }
    ctx.restore();
  }
  function drawPickupFlashes(time,origin,player,size){
    for(const fx of pickupFlashes){
      const age=time-fx.start,t=clamp(age/fx.duration),k=ease(clamp((t-.18)/.82));
      const at=plane(Math.floor(fx.index/9),fx.index%9,size),from={x:origin.x+at.x,y:origin.y+at.y-size*.15};
      const to={x:origin.x+player.x,y:origin.y+player.y-size*.14};
      const x=reduced?from.x:lerp(from.x,to.x,k),y=reduced?from.y:lerp(from.y,to.y,k)-Math.sin(k*Math.PI)*size*.045;
      ctx.save();ctx.globalAlpha=reduced?1-t:1-Math.pow(k,4);
      if(k<.55&&!reduced)drawPickupOrb(fx.type,x,y,origin.y+at.y,Math.max(1,size*.09*(1-k)),fx.color,false);
      else{
        const radius=Math.max(1.2,size*.032*(1-k)+1),halo=ctx.createRadialGradient(x,y,0,x,y,radius*4);
        halo.addColorStop(0,'#fff6dfd9');halo.addColorStop(.25,fx.color+'b0');halo.addColorStop(1,fx.color+'00');
        ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,radius*4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff4df';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawPickupOrb(type,x,y,groundY,r,color,small){
    const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    const tint=(k,a=1)=>`rgba(${rgb.map(v=>Math.round(v*k)).join(',')},${a})`;
    ctx.save();
    // Soft projected shadow anchors the floating sphere above the tile.
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(x,groundY+2,r*.95,r*.27,0,0,Math.PI*2);ctx.fill();
    const halo=ctx.createRadialGradient(x,y,r*.45,x,y,r*2.05);
    halo.addColorStop(0,tint(1,.24));halo.addColorStop(.5,tint(1,.13));halo.addColorStop(1,tint(1,0));
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,r*2.05,0,Math.PI*2);ctx.fill();
    const body=ctx.createRadialGradient(x-r*.4,y-r*.46,r*.03,x+r*.15,y+r*.23,r*1.22);
    body.addColorStop(0,'#ffecd2');body.addColorStop(.2,tint(.95));body.addColorStop(.53,tint(.46));body.addColorStop(.84,tint(.16));body.addColorStop(1,'#141416');
    ctx.fillStyle=body;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=tint(1,.7);ctx.lineWidth=small?.6:.9;ctx.stroke();
    ctx.strokeStyle='rgba(255,243,226,.68)';ctx.lineWidth=Math.max(.7,r*.065);ctx.beginPath();ctx.arc(x-r*.08,y-r*.08,r*.76,Math.PI*1.11,Math.PI*1.59);ctx.stroke();
    ctx.shadowColor='#000';ctx.shadowBlur=small?0:2;
    drawToolIcon(type,x,y+r*.07,r*1.14,'#fff5e7');ctx.restore();
  }
  const toolVectors={"companion": {"viewBox": [0.0, 0.0, 88.0, 88.0], "paths": [{"d": "M62.3333 25.6667V62.3334H55V25.6667H62.3333ZM33 25.6667V62.3334H25.6667V25.6667H33ZM18.3333 36.6667V51.3334H11V36.6667H18.3333ZM77 36.6667V51.3334H69.6667V36.6667H77ZM47.6667 14.6667V73.3334H40.3333V14.6667H47.6667Z", "rule": "nonzero"}]}, "probe": {"viewBox": [0.0, 0.0, 89.0, 89.0], "paths": [{"d": "M44.5869 34.7656C49.9631 34.7656 54.3213 39.1238 54.3213 44.5C54.3213 49.8762 49.9631 54.2344 44.5869 54.2344C39.2108 54.2344 34.8525 49.8762 34.8525 44.5C34.8525 39.1238 39.2108 34.7656 44.5869 34.7656ZM44.5869 40.3281C42.2828 40.3281 40.415 42.1959 40.415 44.5C40.415 46.8041 42.2828 48.6719 44.5869 48.6719C46.891 48.6719 48.7588 46.8041 48.7588 44.5C48.7588 42.1959 46.891 40.3281 44.5869 40.3281Z", "rule": "nonzero"}, {"d": "M30.1253 62.4372C25.445 57.6891 22.7715 51.3022 22.7715 44.5001C22.7715 37.2268 25.8303 30.4384 31.0953 25.629L34.8469 29.7361C30.7237 33.5023 28.334 38.8059 28.334 44.5001C28.334 49.8259 30.4224 54.8148 34.0868 58.5323L30.1253 62.4372Z", "rule": "nonzero"}, {"d": "M60.2765 62.4372C64.9567 57.6891 67.6302 51.3022 67.6302 44.5001C67.6302 37.2268 64.5715 30.4384 59.3064 25.629L55.5548 29.7361C59.678 33.5023 62.0677 38.8059 62.0677 44.5001C62.0677 49.8259 59.9794 54.8148 56.3149 58.5323L60.2765 62.4372Z", "rule": "nonzero"}, {"d": "M18.4642 70.8066C11.7654 64.0106 7.93988 54.872 7.93988 45.1361C7.93988 34.7259 12.3166 25.0126 19.8528 18.1288L23.6042 22.2358C17.2101 28.0764 13.5024 36.305 13.5024 45.1361C13.5024 53.3956 16.7427 61.1363 22.4258 66.9017L18.4642 70.8066Z", "rule": "nonzero"}, {"d": "M71.9376 70.8066C78.6364 64.0106 82.4619 54.872 82.4619 45.1361C82.4619 34.7259 78.0852 25.0126 70.549 18.1288L66.7976 22.2358C73.1917 28.0764 76.8994 36.305 76.8994 45.1361C76.8994 53.3956 73.6591 61.1363 67.976 66.9017L71.9376 70.8066Z", "rule": "nonzero"}]}, "panorama": {"viewBox": [0.0, 0.0, 60.0, 60.0], "paths": [{"d": "M21.9428 35.4166L11.448 45.9228V35.4166H7.91669V48.3754V52.0833H11.448H24.5834V48.3754H14.2425L24.5645 38.0413L21.9428 35.4166Z", "rule": "nonzero"}, {"d": "M35.4167 7.91663H48.548H52.0834V11.452V24.5833H48.548V14.074L38.0572 24.5644L35.4356 21.9428L45.9259 11.452H35.4167V7.91663Z", "rule": "evenodd"}, {"d": "M60 0V60H0V0H60ZM4.16667 55.8333H55.8333V4.16667H4.16667V55.8333Z", "rule": "nonzero"}]}};
  for(const icon of Object.values(toolVectors))icon.paths=icon.paths.map(p=>({...p,path:new Path2D(p.d)}));
  function drawToolIcon(type,x,y,size,color){
    const icon=toolVectors[type],scale={companion:1.18,probe:1.14,panorama:.88}[type];
    size*=scale;ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/icon.viewBox[2],size/icon.viewBox[3]);ctx.fillStyle=color;
    for(const p of icon.paths)ctx.fill(p.path,p.rule);ctx.restore();
  }
  function avatar(x,y,size,time,opacity=1) {
    ctx.save();ctx.globalAlpha=opacity;
    const pulse = reduced?1:1+Math.sin(time/580)*.11;
    const glow=ctx.createRadialGradient(x,y,2,x,y,size*.4);glow.addColorStop(0,'#f3c59c45');glow.addColorStop(.45,'#d68f5530');glow.addColorStop(1,'#d68f5500');
    ctx.fillStyle=glow;ctx.save();ctx.translate(x,y);ctx.scale(1,.53);ctx.beginPath();ctx.arc(0,0,size*.44*pulse,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.strokeStyle='#e7b99199';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,size*.19*pulse,size*.09*pulse,0,0,Math.PI*2);ctx.stroke();
    const d=DIRS[game.direction],p=plane(d.dr,d.dc,size*.43);
    ctx.fillStyle='#f0bd90';ctx.beginPath();ctx.arc(x+p.x,y+p.y,2.6,0,Math.PI*2);ctx.fill();
    const bob = walking && !reduced?Math.sin(time/85)*1.4:0;
    const h=size*.205,hem=size*.087,neck=size*.023,top=y-h+bob,base=y+bob,headR=size*.037,headY=top-headR-size*.014;
    ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(x,y+4,hem*1.1,size*.027,0,0,Math.PI*2);ctx.fill();
    const robe=ctx.createLinearGradient(x-hem,top,x+hem,base);robe.addColorStop(0,'#fff8e7');robe.addColorStop(.55,'#e6dfcf');robe.addColorStop(1,'#afa99d');
    ctx.fillStyle=robe;ctx.shadowColor='#f1d2a4';ctx.shadowBlur=7;
    ctx.beginPath();ctx.moveTo(x-neck,top);ctx.quadraticCurveTo(x,top-size*.012,x+neck,top);ctx.lineTo(x+hem,base);ctx.bezierCurveTo(x+hem*.6,base+size*.04,x-hem*.6,base+size*.04,x-hem,base);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    if(!falling&&!winning&&!overview&&frameLights.length){
      ctx.save();ctx.clip();ctx.globalCompositeOperation='screen';
      for(const light of frameLights){
        const distance=Math.hypot(light.x-x,(light.groundY-y)*1.4),strength=clamp(1-distance/(size*.95))*.29*light.alpha;
        if(strength<.015)continue;
        const rgb=[1,3,5].map(i=>parseInt(light.color.slice(i,i+2),16));
        const reflected=ctx.createLinearGradient(x-hem,0,x+hem,0),left=light.x<x;
        reflected.addColorStop(left?0:1,`rgba(${rgb.join(',')},${strength})`);
        reflected.addColorStop(left?1:0,`rgba(${rgb.join(',')},0)`);
        ctx.fillStyle=reflected;ctx.fillRect(x-hem,top-1,hem*2,h+size*.06);
      }
      ctx.restore();
    }
    polygon([{x:x+neck*.35,y:top},{x:x+hem,y:base},{x:x+hem*.2,y:base+size*.024}], '#bcb6a733');
    ctx.fillStyle='#f7f0df';ctx.beginPath();ctx.arc(x,headY,headR,0,Math.PI*2);ctx.fill();
    const face=plane(d.dr,d.dc,headR*1.3);
    ctx.fillStyle='#8e7558';ctx.beginPath();ctx.arc(x+face.x,headY+face.y,Math.max(1.3,headR*.19),0,Math.PI*2);ctx.fill();
    if (!walking && !falling && !winning && game.totalSteps < 2) {ctx.textAlign='center';ctx.fillStyle='#b4b4b4';ctx.font='12px '+uiFont;ctx.fillText('你在这里',x,headY-headR-16);}
    ctx.restore();
  }
  function drawEcho(x,y,size,time) {
    if(!echoCue)return;
    const age=time-echoCue.start;
    if(age<0)return;
    if(age>1600){echoCue=null;return;}
    const breath=Math.sin(Math.PI*age/1600);
    ctx.save();ctx.globalAlpha=breath*(reduced?.24:.5);ctx.translate(x,y-size*.07);ctx.scale(1,.58);
    const radius=size*(reduced?.58:.5+breath*.1),haze=ctx.createRadialGradient(0,0,size*.15,0,0,radius);
    haze.addColorStop(0,'#d6d6d600');haze.addColorStop(.58,'#c5c5c56b');haze.addColorStop(1,'#c5c5c500');
    ctx.fillStyle=haze;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawAtmosphere(time){
    if(winning||overview)return;
    const level=game.effectLevel,breath=reduced?1:.86+Math.sin(time/970)*.14;
    if(level>.015){
      ctx.save();
      const haze=ctx.createRadialGradient(width/2,height*.48,Math.min(width,height)*.12,width/2,height*.48,Math.max(width,height)*.68);
      haze.addColorStop(0,'#130b1200');haze.addColorStop(.52,'#57302624');haze.addColorStop(1,'#995332ad');
      ctx.globalAlpha=level*breath*.6;ctx.fillStyle=haze;ctx.fillRect(0,0,width,height);
      if(!reduced){
        ctx.fillStyle='#dbc49a';
        for(let i=0;i<30;i++){const x=random(i+711)*width,y=(random(i+981)*height+time*(.002+random(i+37)*.008))%height;ctx.globalAlpha=level*.1*(.4+random(i+23));ctx.fillRect(x,y,1,1+random(i+801));}
      }
      ctx.restore();
    }
    if(echoCue){
      const age=time-echoCue.start;
      if(age>=0&&age<=1600){
        ctx.save();ctx.globalAlpha=Math.sin(Math.PI*age/1600)*.28;
        const shade=ctx.createRadialGradient(width/2,height*.48,Math.min(width,height)*.17,width/2,height*.48,Math.max(width,height)*.68);
        shade.addColorStop(0,'#26262600');shade.addColorStop(1,'#8e8e8e77');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);ctx.restore();
      }
    }
  }
  function drawBoundary(time){
    if(!boundary)return;
    const age=time-boundary.start;if(age>1100){boundary=null;return;}
    const strength=Math.sin(Math.PI*clamp(age/1100));
    ctx.save();ctx.globalAlpha=strength*(reduced?.5:.8);
    const span=Math.min(width,height)*.19;
    for(const [x0,y0,x1,y1] of [[0,0,span,0],[width,0,width-span,0],[0,0,0,span],[0,height,0,height-span]]){
      const glow=ctx.createLinearGradient(x0,y0,x1,y1);glow.addColorStop(0,'#ffdd6480');glow.addColorStop(1,'#ffdd6400');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    }
    ctx.strokeStyle='#ffe78c';ctx.lineWidth=2;ctx.strokeRect(1,1,width-2,height-2);ctx.restore();
  }
  function resetViewOpacity(){
    viewOpacity.clear();
    for(const p of game.visibleCells())viewOpacity.set(id(p.r,p.c),1);
  }
  function animateVision(dt){
    const visible=new Set(game.visibleCells().map(p=>id(p.r,p.c)));
    for(const index of visible)if(!viewOpacity.has(index))viewOpacity.set(index,0);
    for(const [index,opacity] of viewOpacity){
      if(index===game.position){viewOpacity.set(index,1);continue;}
      const target=visible.has(index)?1:0;
      const duration=target?330:780;
      const next=opacity+(target-opacity)*(1-Math.exp(-dt*3/duration));
      if(!target&&next<.015)viewOpacity.delete(index);
      else viewOpacity.set(index,next);
    }
  }
  function advanceSan(now=performance.now()){
    if(!started||game.mode==='won')return;
    if(document.hidden||document.querySelector('dialog[open]')){lastSanTick=now;return;}
    game.advanceTime(Math.max(0,now-lastSanTick));lastSanTick=now;
    if(game.restrictedVision!==wasRestricted){
      wasRestricted=game.restrictedVision;hover=-1;
      if(wasRestricted){tone('strain');} // The persistent vision hint stays clear of the map.
      else if(!falling)toast('拾取道具 · 周围视野恢复',1600);
      updateSanUI();
    }
    if(now-lastSanUI>150){lastSanUI=now;updateSanUI();}
    if(game.san>=80&&now-lastStrainTone>lerp(5500,2700,game.effectLevel)){lastStrainTone=now;tone('strain');}
  }
  function updateSanUI(){
    const wasHidden=ui['vision-status'].hidden;
    const value=Math.min(100,Math.floor(game.san*10)/10);
    ui['san-value'].textContent=value.toFixed(1)+'%';ui['san-meter'].setAttribute('aria-valuenow',value);
    ui['san-fill'].style.width=game.san+'%';ui['san-fill'].style.background=`hsl(${43-game.san*.35} 65% 64%)`;
    ui['san-block'].classList.toggle('critical',game.restrictedVision);
    ui['san-state'].textContent=game.restrictedVision?'脚下与正前方可见 · 拾取道具后恢复':`每秒 +${SAN_PER_SECOND} · 拾取 −${SAN_PICKUP} · 坠落 +${SAN_FALL}`;
    ui['vision-status'].hidden=!game.restrictedVision||!!winning||!!overview;
    if(game.restrictedVision)ui['vision-status'].lastElementChild.textContent='Q / E 转向观察 · 拾取道具后恢复';
    if(width&&wasHidden!==ui['vision-status'].hidden)resize();
    ui['opening-hint'].hidden=game.restrictedVision||!!winning;
    canvas.dataset.visibleTiles=(falling||winning||overview?81:game.visibleCells().length);
  }
  function vibrate(pattern){if(hapticsEnabled&&!reduced&&navigator.vibrate)navigator.vibrate(pattern);}
  function draw(time) {
    advanceSan(time);
    if(falling)updateFall(time);
    syncMusic(time);
    const dt=Math.min((time-lastTime)||16,60);lastTime=time;
    ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
    let active=plane(game.r,game.c), player={...active};
    if (walking) {
      const t=ease((time-walking.start)/walking.duration),a=plane(walking.from.r,walking.from.c);
      player={x:lerp(a.x,active.x,t),y:lerp(a.y,active.y,t)};
      if(t>=1) walking=null;
    }
    const follow=1-Math.exp(-dt/125);camera.x=lerp(camera.x,player.x,follow);camera.y=lerp(camera.y,player.y,follow);
    let origin={x:width/2-camera.x,y:viewY-camera.y},size=tile;
    renderShift={x:0,y:0};
    if(!reduced&&!falling&&!winning&&!overview){renderShift={x:Math.sin(time/1100)*3*game.effectLevel,y:Math.sin(time/830)*1.8*game.effectLevel};origin.x+=renderShift.x;origin.y+=renderShift.y;}
    let progress=0;
    if(falling&&!falling.reset) {
      progress=(time-falling.start)/1000;
      if(!reduced){
        const k=ease((progress-.24)/1.5);size=lerp(tile,Math.min(width/9.5,(height-130)/5.2),k);
        const mid=plane(4,4,size);origin={x:lerp(origin.x,width/2-mid.x,k),y:lerp(origin.y,viewY-mid.y,k)};
        // A brief impact at the instant of stepping off, followed by a quiet shared fall.
        if(progress<.38){const force=clamp(tile*.065,7,15)*Math.exp(-progress*13);
          origin.x+=Math.sin(progress*105+1.1)*force;origin.y+=Math.cos(progress*137+.4)*force*.65;}
      }
    }
    if(overview){
      const age=time-overview.start,transition=220;
      const total=PANORAMA_MS+transition*2;
      const k=transition===0?1:(age<transition?ease(age/transition):age<=transition+PANORAMA_MS?1:1-ease((age-transition-PANORAMA_MS)/transition));
      size=lerp(tile,overviewSize,k);
      const mid=plane(4,4,size);origin={x:lerp(origin.x,width/2-mid.x,k),y:lerp(origin.y,overviewY-mid.y,k)};
      if(age>=total){overview=null;updateUI();say('全景已经消退。','危险标记随全景消失；记住路线，继续走遍安全格。');}
    }
    if(time>toastUntil)ui['center-toast'].classList.remove('visible');
    if(time-lastClock>200){lastClock=time;ui.timer.textContent=formatTime(elapsed());}
    let finale=0;
    if(winning){
      finale=ease((time-winning.start-450)/(reduced?100:2100));
      size=Math.min(width/9.9,(height-140)/5.5);const mid=plane(4,4,size);origin={x:width/2-mid.x,y:height*.48-mid.y};
    }
    ctx.save();
    if(!falling&&!winning&&!overview)animateVision(dt);
    let cells=(falling&&!falling.reset) || winning || overview ? Array.from({length:81},(_,i)=>({r:Math.floor(i/9),c:i%9})) : [...viewOpacity].map(([index,opacity])=>({r:Math.floor(index/9),c:index%9,opacity}));
    canvas.dataset.visibleTiles=cells.filter(cell=>(cell.opacity??1)>.35).length;
    pickupFlashes=pickupFlashes.filter(fx=>time-fx.start<fx.duration);
    if(falling||winning||overview)pickupFlashes=[];
    frameLights=[];
    if(!falling&&!winning){
      for(const cell of cells){
        const item=game.pickupAt(id(cell.r,cell.c));if(!item||(cell.opacity??1)<.35)continue;
        const p=plane(cell.r,cell.c,size);frameLights.push({x:origin.x+p.x,groundY:origin.y+p.y,color:pickupColors[item.type],alpha:cell.opacity??1});
      }
      for(const fx of pickupFlashes){const p=plane(Math.floor(fx.index/9),fx.index%9,size);frameLights.push({x:origin.x+p.x,groundY:origin.y+p.y,color:fx.color,alpha:1-(time-fx.start)/fx.duration});}
    }
    cells.sort((a,b)=>a.r+a.c-b.r-b.c);
    for(const cell of cells){
      const index=id(cell.r,cell.c),p=plane(cell.r,cell.c,size);
      let x=origin.x+p.x,y=origin.y+p.y,alpha=cell.opacity??1;
      if(falling&&!falling.reset){
        const drop=fallTransform(index,progress);x+=drop.x;y+=drop.y;alpha*=drop.alpha;
        if(progress<.7 && !game.neighbors().some(n=>id(n.r,n.c)===index) && index!==falling.index)alpha*=smooth(progress/.7)*.48;
      }
      drawTile(cell.r,cell.c,{x,y},size,alpha,finale,time);
    }
    if(!winning && !falling && !overview){
      const p=player;drawEcho(origin.x+p.x,origin.y+p.y,size,time);
    }
    if(!winning){
      const inFall=falling&&!falling.reset;
      const p=overview||inFall&&!walking?plane(game.r,game.c,size):player;
      const shared=inFall?fallTransform(falling.index,progress):{x:0,y:0,alpha:1};
      avatar(origin.x+p.x+shared.x,origin.y+p.y+shared.y,size,time,shared.alpha);
      if(overview){
        const x=origin.x+p.x,y=origin.y+p.y;
        ctx.save();ctx.shadowColor='#ffe6b9';ctx.shadowBlur=13;ctx.strokeStyle='#ffe6b9';ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(x,y,size*.33,size*.16,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
        ctx.fillStyle='#ffe6b9';ctx.beginPath();ctx.moveTo(x,y-11);ctx.lineTo(x-4,y-18);ctx.lineTo(x+4,y-18);ctx.closePath();ctx.fill();
        ctx.font='11px '+uiFont;ctx.textAlign='center';ctx.strokeStyle='#060606';ctx.lineWidth=4;ctx.strokeText('你在这里',x,y-24);ctx.fillText('你在这里',x,y-24);ctx.restore();
      }
    }
    if(!falling&&!winning&&!overview)drawPickupFlashes(time,origin,player,size);
    if(sweep && !falling && !winning && !overview){
      const t=(time-sweep.start)/1000;
      if(t>4.5)sweep=null;
      else {
        const p=plane(sweep.target.r,sweep.target.c,size),x=origin.x+p.x,y=origin.y+p.y;
        ctx.globalAlpha=clamp(4.5-t);ctx.strokeStyle='#bebebe';ctx.lineWidth=1.2;ctx.setLineDash([4,5]);
        ctx.beginPath();ctx.ellipse(x,y,21+Math.sin(t*4)*3,10,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#cecece';ctx.font='12px '+uiFont;ctx.textAlign='center';ctx.fillText('安全落点',x,y-23);
      }
    }
    ctx.restore();
    drawAtmosphere(time);drawBoundary(time);
    requestAnimationFrame(draw);
  }
  function formatTime(ms){const seconds=Math.max(0,Math.floor(ms/1000));return pad(Math.floor(seconds/60))+':'+pad(seconds%60);}
  function elapsed(){return endElapsed!==null?endElapsed:started?performance.now()-startTick:0;}
  function busy(){return starting||falling||walking||winning||overview||document.querySelector('dialog[open]');}
  function say(title,detail='',warning=false){ui['message-title'].textContent=title;ui['message-detail'].textContent=detail;ui['message-title'].parentElement.classList.toggle('warning',warning);}
  function toast(text,duration=1200){ui['center-toast'].textContent=text;ui['center-toast'].classList.add('visible');toastUntil=performance.now()+duration;}
  function updateUI(){
    updateSanUI();
    ui['panorama-legend'].hidden=!overview;document.querySelector('.stage').classList.toggle('is-overview',!!overview);
    ui.count.textContent=pad(game.count);ui.percentage.textContent=Math.floor(game.count/SAFE_COUNT*100)+'%';ui.progress.setAttribute('aria-valuenow',game.count);ui['progress-fill'].style.width=game.count/SAFE_COUNT*100+'%';
    ui.coordinate.textContent=`位置 ${pad(game.r+1)} · ${pad(game.c+1)}`;ui['picked-count'].textContent=game.picked.size;
    for(const type of Object.keys(TOOL_NAMES)){ui[type+'-stock'].textContent=game.stock[type];ui[type].disabled=game.mode!=='playing'||game.stock[type]===0||!!falling||!!overview||starting;}
    ui.direction.textContent=DIRS[game.direction].name+' '+arrow[game.direction];ui['compass-facing'].textContent='面朝 '+DIRS[game.direction].name;
    document.querySelectorAll('[data-face]').forEach(el=>el.classList.toggle('active',Number(el.dataset.face)===game.direction));
    document.querySelectorAll('[data-direction]').forEach(el=>{const facing=Number(el.dataset.direction)===game.direction;el.classList.toggle('is-facing',facing);el.title=el.getAttribute('aria-label')+(facing?' · 当前朝向':'');});
    ui.falls.textContent=pad(game.falls);ui['run-kind'].textContent=game.mode==='won'?(practice?'练习完成':'探索完成'):practice?'练习模式':started?'正在探索':'尚未出发';
    canvas.setAttribute('aria-label',`位置第${game.r+1}行第${game.c+1}列，走过${game.count}/${SAFE_COUNT}个安全格，坠落${game.falls}次，面朝${DIRS[game.direction].name}。道具：提示${game.stock.companion}、探测${game.stock.probe}、全景${game.stock.panorama}。WASD移动，123使用道具。`);
  }
  async function beginRun(){
    if(started)return true;starting=true;const current=generation;updateUI();
    try{const result=await api('/api/runs',{});if(current!==generation)return false;if(result.ruleVersion!==RULE_VERSION)throw Error('规则版本已更新，请刷新页面');runId=result.runId;}
    catch(error){if(current!==generation)return false;practice=true;toast('当前为练习模式，成绩不入榜',2300);}
    starting=false;started=true;startTick=lastSanTick=performance.now();updateUI();return true;
  }
  async function step(direction){
    if(busy())return;if(!await beginRun())return;if(game.mode!=='playing'||document.querySelector('dialog[open]'))return;
    advanceSan();const wasNear=!!game.environment();
    const result=game.move(direction);if(result.kind==='invalid'||result.kind==='busy')return;actions.push('m'+direction);wasRestricted=game.restrictedVision;updateUI();
    if(result.kind==='edge'){boundary={direction,start:performance.now()};toast('前方已到边界 · 换个方向');say('这里是空间的边缘。','黄色边光提醒：这个方向无法继续。');tone('edge');vibrate(18);return;}
    walking={...result,start:performance.now(),duration:180};sweep=null;hover=-1;
    ui['opening-hint'].style.opacity=0;tone('step');
    if(result.kind==='fall'){startFall();return;}
    if(result.kind==='win'){startWin();return;}
    if(result.pickup){pickupFlashes.push({type:result.pickup.type,index:game.position,color:pickupColors[result.pickup.type],start:performance.now(),duration:reduced?160:620});say(`拾取「${TOOL_NAMES[result.pickup.type]}」×1。`,`SAN 降低 ${SAN_PICKUP} 个百分点；道具随时可用，每处只拾取一次。`);ui[result.pickup.type].classList.add('just-collected');setTimeout(()=>ui[result.pickup.type].classList.remove('just-collected'),750);tone('pickup');}
    else say('这一步已经成为记忆。',practice?'当前未连接共享成绩，仍可完整练习。':'自由移动。已有道具可以随时使用，注意脚下。');
    const signal=game.environment();
    if(signal&&!wasNear){echoCue={start:performance.now()+180};tone('echo');vibrate([16,45,20]);if(!result.pickup){say('附近似乎不太对劲。','空气与光发生了变化；用道具确认准确的悬崖位置。');toast('附近似乎不太对劲',1400);}}
  }
  function tool(type){
    if(busy())return;
    advanceSan();
    const result=game.useTool(type);
    if(result.kind==='empty'){say('还没有这个道具。','寻找方格上的发光图标，踩上去即可拾取。',true);return;}
    if(result.kind==='no-target'){say('这个方向没有安全落点。','本次不消耗道具。按Q / E转向后再探测。',true);toast('前方没有安全落点 · 未消耗道具');tone('edge');return;}
    if(!['tool','win'].includes(result.kind))return;actions.push(type);
    if(type==='companion'){
      const dangers=result.targets.filter(p=>p.cliff);
      say(dangers.length?'「'+dangers.map(p=>DIRS[p.direction].name).join('、')+'，脚下是空的。」':'「相邻的方格都安全。」',dangers.length?`已标记${dangers.length}处悬崖；绕行即可，不用踩上去。`:'安全格已用小圆点标记。');tone('companion');
    }else if(type==='probe'){
      const target=result.targets[0],distance=Math.abs(target.r-game.r)+Math.abs(target.c-game.c);sweep={target,start:performance.now()};
      say(`面朝${DIRS[game.direction].name}，第${distance}格有安全落点。`,distance>1?'中间仍有悬崖，请绕行；探测不会传送。':'只确认这个落点，踩上去才收集图案。',distance>1);tone('probe');
    }else{
      overview={start:performance.now()};sweep=null;toastUntil=0;ui['center-toast'].classList.remove('visible');
      say('瞬间全景 · 看清这1.5秒。','图片是已走过的路，混凝土是未走过的路；× 标记全部悬崖。');tone('panorama');
    }
    updateUI();
  }
  async function turn(delta){if(busy())return;if(!await beginRun())return;advanceSan();if(game.turn(delta)){actions.push(delta===-1?'left':'right');updateUI();tone('turn');}}
  const FALL_DURATION=5000;
  function smooth(x){x=clamp(x);return x*x*(3-2*x);}
  function fallTransform(index,seconds){
    if(!falling||falling.reset||reduced)return {x:0,y:0,alpha:1};
    const data=fallOrder[index],delay=index===falling.index?.24:.24+data.delay*.65;
    const drop=Math.max(0,seconds-delay);
    return {x:data.spin*drop*24,y:drop*drop*height*.31,alpha:1-smooth((drop-1.25)/.9)};
  }
  function startFall(){
    falling={start:performance.now(),reset:false,index:game.position,r:game.r,c:game.c};
    sweep=echoCue=null;boundary=null;pickupFlashes=[];document.body.classList.add('is-falling');
    say(`脚下失去了重量 · SAN +${SAN_FALL}。`,'回到起点后保留当前 SAN、进度与未用道具。',true);
    ui['fall-caption'].textContent='失 重';ui['fall-caption'].classList.remove('memory-caption');
    ui['fall-caption'].style.opacity=0;toastUntil=0;ui['center-toast'].classList.remove('visible');
    syncMusic(performance.now());vibrate([42,20,22]);updateUI();
  }
  function updateFall(time){
    const ms=time-falling.start;
    // 5-second sequence; the first caption stays fully visible for exactly 0.9 seconds.
    const darkness=ms<1400?smooth((ms-450)/950):ms<4200?1:1-smooth((ms-4200)/800);
    ui.fade.style.opacity=darkness;
    let opacity=0;
    if(ms<2800){
      ui['fall-caption'].textContent='失 重';ui['fall-caption'].classList.remove('memory-caption');
      opacity=ms<1450?smooth((ms-1000)/450):ms<2350?1:1-smooth((ms-2350)/400);
    }else{
      ui['fall-caption'].textContent='回到起点，记忆仍在';ui['fall-caption'].classList.add('memory-caption');
      opacity=ms<3300?smooth((ms-2850)/450):ms<3750?1:1-smooth((ms-3750)/450);
    }
    ui['fall-caption'].style.opacity=opacity;
    ui['fall-caption'].style.transform=`translateY(${reduced?0:(1-opacity)*7}px)`;
    // Reset while fully black; keep input locked through the return fade.
    if(ms>=2800&&!falling.reset){falling.reset=true;game.respawn();actions.push('respawn');walking=null;resetViewOpacity();resize();camera=plane(game.r,game.c);updateUI();}
    if(ms>=FALL_DURATION){
      falling=null;ui.fade.style.opacity=0;ui['fall-caption'].style.opacity=0;
      ui['fall-caption'].style.transform='';document.body.classList.remove('is-falling');
      updateUI();say('你回来了，记忆与道具仍在。','已经拿走的道具不刷新。继续探索还没有走过的地方。');
    }
  }
  function startWin(){
    winning={start:performance.now()};walking=null;sweep=null;endElapsed=elapsed();document.body.classList.add('won');
    ui['play-controls'].hidden=true;ui['win-controls'].hidden=false;ui['end-label'].hidden=false;ui['opening-hint'].hidden=true;
    ui['progress-note'].innerHTML='走过66个安全格，81块建筑记忆重新拼合。<br>这是你走出来的元白。';ui['stage-note'].lastElementChild.textContent='元白楼 · 艺术化重构';
    updateUI();tone('win');ui['verification-status'].textContent=`探索完成 · 坠落 ${game.falls} 次 · 用时 ${formatTime(endElapsed)}。`;verifyFinish();loadFinishers();
  }
async function api(path,data){
    const headers=data===undefined?{}:{'Content-Type':'application/json'};
    if(playerToken)headers.Authorization='Bearer '+playerToken;
    const response=await fetch(leaderboardBase+path.slice(4),{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
    let result;try{result=await response.json();}catch{throw new Error('成绩服务暂时不可用，请稍后重试。');}if(!response.ok)throw new Error(result.error||'暂时无法连接，请重试。');
    if(path==='/api/runs'&&result.playerToken){
      if(!/^[a-f0-9]{64}$/.test(result.playerToken))throw new Error('服务器返回的身份信息无效。');
      playerToken=result.playerToken;
      try{localStorage.setItem(tokenStorageKey,playerToken);}catch{}
    }
    return result;
  }
  async function verifyFinish(){
    if(verifying)return;if(practice||!runId){ui['verification-status'].textContent='练习已完成。本局未连接共享成绩，无法入榜。';ui['score-form'].hidden=true;return;}
    verifying=true;const current=generation;ui['retry-verify'].hidden=true;ui['verification-status'].textContent='正在确认通关成绩…';
    try{const result=await api('/api/finish',{runId,actions});if(current!==generation)return;verified=result;endElapsed=result.durationMs;ui.timer.textContent=formatTime(endElapsed);ui['verification-status'].textContent=`通关确认：坠落 ${result.deaths} 次 · ${formatTime(result.durationMs)}。`;ui['submit-score'].disabled=false;}
    catch(error){if(current!==generation)return;ui['verification-status'].textContent=error.message||'成绩确认失败，请重试。';ui['retry-verify'].hidden=false;}
    finally{if(current===generation)verifying=false;}
  }
  async function submitScore(event){
    event.preventDefault();if(!verified||submitting)return;
    const nickname=ui.nickname.value.normalize('NFC').trim();if(!nickname||Array.from(nickname).length>16||/[\u0000-\u001f\u007f<>]/.test(nickname)){ui['score-result'].textContent='昵称请输入1—16个字符，不含尖括号。';return;}
    submitting=true;const current=generation;ui['submit-score'].disabled=true;ui['submit-score'].textContent='正在保存…';
    try{const result=await api('/api/scores',{runId,nickname});if(current!==generation)return;lockedName=result.nickname;try{localStorage.setItem(nameStorageKey,result.nickname);}catch{}ui['score-result'].textContent=result.personalBest?`已入榜，当前第 ${result.rank} 名。`:`已保留更好的历史成绩，当前第 ${result.rank} 名。`;ui['submit-score'].textContent='已提交';ui.nickname.readOnly=true;loadFinishers();}
    catch(error){if(current!==generation)return;ui['score-result'].textContent=error.message||'保存失败，昵称已保留，请再试。';ui['submit-score'].disabled=false;ui['submit-score'].textContent='重试提交';}
    finally{if(current===generation)submitting=false;}
  }
  function formatDate(value){return value?new Date(value).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}):'—';}
  function newbieBadge(){const badge=document.createElement('span');badge.className='newbie-badge';badge.textContent='新手';return badge;}
  function fillNameCell(cell,row){cell.textContent=row.nickname+(row.isYou?' · 你':'');if(row.newbie){cell.append(' ');cell.append(newbieBadge());}}
  function applyLockedName(){if(lockedName){ui.nickname.value=lockedName;ui.nickname.readOnly=true;}}
  async function loadFinishers(){
    const request=++finishersRequest,current=generation;
    ui['finishers-status'].textContent='正在读取已通关名单…';
    ui['finishers-refresh'].disabled=true;
    try{
      const data=await api('/api/leaderboard?page=1');
      if(request!==finishersRequest||current!==generation)return;
      ui['finishers-body'].replaceChildren();
      for(const row of data.items){
        const tr=document.createElement('tr');if(row.isYou)tr.className='is-you';
        const values=[row.rank,row.nickname+(row.isYou?' · 你':''),formatTime(row.durationMs)+'.'+Math.floor(row.durationMs%1000/100),formatDate(row.completedAt)];
        values.forEach((value,idx)=>{
          const td=document.createElement('td');
          if(idx===1){fillNameCell(td,row);}else{td.textContent=value;}
          tr.append(td);
        });
        ui['finishers-body'].append(tr);
      }
      ui['finishers-table'].hidden=!data.items.length;
      ui['finishers-status'].textContent=data.total?`共 ${data.total} 位已通关 · 显示前 20 名`:'还没有通关记录，留下第一个名字吧。';
    }catch(error){
      if(request!==finishersRequest||current!==generation)return;
      ui['finishers-table'].hidden=true;ui['finishers-status'].textContent='名单读取失败，点击刷新重试。已保存的成绩不会丢失。';
    }finally{if(request===finishersRequest&&current===generation)ui['finishers-refresh'].disabled=false;}
  }
  async function loadLeaderboard(page=1){
    const request=++boardRequest;ui['ranking-state'].hidden=false;ui['ranking-state'].textContent='正在读取…';ui['ranking-table'].hidden=true;ui['ranking-retry'].hidden=true;ui['ranking-prev'].disabled=ui['ranking-next'].disabled=true;
    try{const data=await api('/api/leaderboard?page='+page+'&board='+boardKind);if(request!==boardRequest)return;boardPage=data.page;boardPages=Math.max(1,Math.ceil(data.total/data.pageSize));ui['ranking-body'].replaceChildren();
      for(const row of data.items){const tr=document.createElement('tr');if(row.isYou)tr.className='is-you';const texts=[row.rank,row.nickname+(row.isYou?' · 你':''),row.deaths,formatTime(row.durationMs)+'.'+Math.floor(row.durationMs%1000/100),formatDate(row.completedAt)];texts.forEach((text,idx)=>{const td=document.createElement('td');if(idx===1){fillNameCell(td,row);}else{td.textContent=text;}tr.append(td);});ui['ranking-body'].append(tr);}
      ui['ranking-state'].hidden=data.total>0;ui['ranking-state'].textContent='还没有通关记录，成为第一个留下名字的人。';ui['ranking-table'].hidden=data.total===0;const multi=boardPages>1;ui['ranking-page'].textContent=multi?`${data.total} 位探索者 · ${boardPage} / ${boardPages}`:`共 ${data.total} 位探索者`;ui['ranking-prev'].hidden=!multi;ui['ranking-next'].hidden=!multi;ui['ranking-prev'].disabled=boardPage<=1;ui['ranking-next'].disabled=boardPage>=boardPages;
    }catch(error){if(request!==boardRequest)return;ui['ranking-state'].textContent='排行榜暂时无法连接。已提交的记录不会因此消失。';ui['ranking-page'].textContent='';ui['ranking-retry'].hidden=false;}
  }
  function selectBoard(kind){boardKind=kind;for(const name of ['normal','deaths'])ui['ranking-'+name].setAttribute('aria-pressed',kind===name);ui['ranking-rule'].textContent=kind==='deaths'?'这是一张有点荒诞的榜：已通关玩家按坠落次数从多到少排列，每人保留最多坠落的一局。':'先比坠落次数，再比通关用时，最后比移动步数；完全相同按首次提交时间。每人保留最好的一局。';loadLeaderboard(1);}
  function openRanking(){ui['ranking-dialog'].showModal();selectBoard('normal');}


  function restart(){
    game.reset();pickupFlashes=[];frameLights=[];resetViewOpacity();falling=walking=winning=sweep=echoCue=overview=boundary=null;camera=plane(game.r,game.c);
    starting=started=false;startTick=lastSanTick=lastSanUI=lastStrainTone=0;wasRestricted=false;endElapsed=null;document.body.classList.remove('won','is-falling');
    generation++;finishersRequest++;ui['finishers-refresh'].disabled=false;ui['finishers-body'].replaceChildren();ui['finishers-table'].hidden=true;practice=verifying=submitting=false;runId=null;actions=[];verified=null;
    ui['play-controls'].hidden=false;ui['win-controls'].hidden=true;ui['end-label'].hidden=true;ui['opening-hint'].hidden=false;ui['opening-hint'].style.opacity=1;
    ui['progress-note'].innerHTML='走过的安全格，留下建筑的片段。<br>悬崖不用踩踏，也不计入进度。';ui['stage-note'].lastElementChild.textContent='光所及之处，只有一步。';
    ui.fade.style.opacity=ui['fall-caption'].style.opacity=0;ui['center-toast'].classList.remove('visible');ui['score-form'].hidden=false;ui['score-form'].reset();ui.nickname.readOnly=false;applyLockedName();ui['score-result'].textContent='';ui['submit-score'].textContent='加入已通关名单';ui['submit-score'].disabled=true;ui['retry-verify'].hidden=true;say('自由移动，沿途拾取道具。','道具在安全格上，每处只能拿一次。步数不限。');updateUI();resize();
  }
  const MUSIC_DATA={}; // 音乐已拆分为 assets/audio/*.mp3，按需 fetch。
  // All recordings are embedded and loudness-matched to -22 LUFS.
  // One shared AudioContext keeps the music envelopes and effect output in sync.
  const musicBuffers={}, musicVoices={}, musicLoads={};
  let musicMaster=null, musicMode='', musicLastFrame=0, musicFallToken=null;
  let musicTransition={start:0,duration:900,from:{},target:''};
  let musicMasterLevel=0, musicMasterTarget=-1, musicMasterFrom=0, musicMasterStart=0;
  const musicLevels={explore:0,pressure:0,win:0};
  function ensureMusic(){
    if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();}
    if(!musicMaster){musicMaster=audio.createGain();musicMaster.gain.value=0;musicMaster.connect(audio.destination);}
    for(const name of ['fall','explore','pressure','win']){
      if(musicLoads[name])continue;
      musicLoads[name]=true;
      fetch('assets/audio/'+name+'.mp3').then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(buffer=>audio.decodeAudioData(buffer)).then(buffer=>{musicBuffers[name]=buffer;syncMusic(performance.now());}).catch(()=>{musicLoads[name]=false;});
    }
  }
  function stopMusicVoice(name){const v=musicVoices[name];if(!v)return;try{v.source.stop();}catch{}v.source.disconnect();v.gain.disconnect();delete musicVoices[name];}
  function startMusicVoice(name,offset=0){
    if(musicVoices[name]||!musicBuffers[name]||!audio||audio.state!=='running')return;
    const buffer=musicBuffers[name],loop=name==='explore'||name==='pressure';
    if(!loop&&offset>=buffer.duration)return;
    const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;source.loop=loop;gain.gain.value=0;source.connect(gain);gain.connect(musicMaster);
    source.start(0,loop?offset%buffer.duration:offset);
    musicVoices[name]={source,gain,started:performance.now()-offset*1000,audioStarted:audio.currentTime-offset,born:performance.now()};
  }
  function syncMusic(now){
    if(!musicMaster||!audio)return;
    const allowed=soundEnabled&&!document.hidden;
    if(allowed&&audio.state!=='running')return;
    const masterTarget=allowed?1:0;
    if(masterTarget!==musicMasterTarget){musicMasterFrom=musicMaster.gain.value;musicMasterTarget=masterTarget;musicMasterStart=now;musicMaster.gain.cancelScheduledValues(audio.currentTime);musicMaster.gain.setValueAtTime(musicMasterFrom,audio.currentTime);musicMaster.gain.linearRampToValueAtTime(masterTarget,audio.currentTime+.2);}
    musicMasterLevel=lerp(musicMasterFrom,masterTarget,smooth((now-musicMasterStart)/200));

    const mode=winning?'win':game.san>=100?'pressure':'explore';
    if(mode!==musicMode){
      musicMode=mode;musicTransition={start:now,duration:mode==='win'?2100:900,from:{...musicLevels},target:mode};
      // A fresh win starts at the visual reveal; returning to exploration starts a fresh loop.
      if(mode==='win')stopMusicVoice('win');
    }
    let fallDuck=1;
    if(falling){
      const age=now-falling.start;
      if(musicFallToken!==falling.start){stopMusicVoice('fall');musicFallToken=falling.start;}
      if(age<2850&&allowed)startMusicVoice('fall',Math.max(0,age/1000));
      const v=musicVoices.fall;
      if(v){
        const envelope=smooth(age/35)*(1-smooth((age-2350)/450));
        v.gain.gain.setTargetAtTime(envelope,audio.currentTime,.008);
        if(age>=2850)stopMusicVoice('fall');
      }
      fallDuck=age<300?1-smooth(age/300):age<4200?0:smooth((age-4200)/800);
    }else{stopMusicVoice('fall');musicFallToken=null;}
    const progress=smooth((now-musicTransition.start)/musicTransition.duration);
    for(const name of ['explore','pressure','win']){
      musicLevels[name]=lerp(musicTransition.from[name]||0,name===mode?1:0,progress);
      if(musicLevels[name]>.0001&&allowed){
        const offset=name==='win'&&winning?Math.max(0,(now-winning.start)/1000):0;
        startMusicVoice(name,offset);
      }
      const v=musicVoices[name];if(!v)continue;
      // Soft edges also prevent clicks at loop seams and at the end of the victory track.
      const duration=musicBuffers[name].duration;
      const elapsed=Math.max(0,audio.currentTime-v.audioStarted),position=name==='win'?elapsed:elapsed%duration;
      const edge=smooth(position/.035)*(1-smooth((position-duration+(name==='win'?1.2:.035))/(name==='win'?1.2:.035)));
      v.gain.gain.setTargetAtTime(musicLevels[name]*fallDuck*edge*smooth((now-v.born)/700),audio.currentTime,.015);
      if(musicLevels[name]<.0001&&name!==mode)stopMusicVoice(name);
    }
    musicLastFrame=now;
  }

  function tone(kind){
    if(kind==='fall'||kind==='win')return;
    if(!soundEnabled||!audio)return;const now=audio.currentTime;if(audio.state==='suspended')audio.resume();
    const play=(f,end,length,gain,type='sine',delay=0)=>{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,now+delay);o.frequency.exponentialRampToValueAtTime(Math.max(10,end),now+delay+length);g.gain.setValueAtTime(0,now+delay);g.gain.linearRampToValueAtTime(gain,now+delay+.012);g.gain.exponentialRampToValueAtTime(.0001,now+delay+length);o.connect(g);g.connect(audio.destination);o.start(now+delay);o.stop(now+delay+length+.05);};
    if(kind==='echo'){
      const o=audio.createOscillator(),g=audio.createGain();
      o.type='sine';o.frequency.setValueAtTime(245,now);o.frequency.exponentialRampToValueAtTime(72,now+.78);
      g.gain.setValueAtTime(0,now);
      for(const [i,delay] of [0,.23,.45].entries()){g.gain.setValueAtTime(.0001,now+delay);g.gain.linearRampToValueAtTime(.047/(i+1),now+delay+.035);g.gain.exponentialRampToValueAtTime(.0001,now+delay+.2);}
      o.connect(g);g.connect(audio.destination);
      o.start(now);o.stop(now+.8);return;
    }
    if(kind==='strain'){play(62,42,.38,.018);play(52,36,.44,.012,'sine',.24);}if(kind==='step')play(105,38,.17,.2,'triangle');if(kind==='companion'){play(440,415,.35,.04);play(330,310,.45,.035,'sine',.16);}if(kind==='probe'||kind==='pickup'){play(740,910,.3,.035);play(1110,1110,.45,.018,'sine',.2);}if(kind==='panorama'){play(220,880,.7,.035);play(550,550,1.3,.02);}if(kind==='fall'){play(160,19,1.8,.17,'sawtooth');play(60,20,1.4,.15);}if(kind==='edge')play(80,70,.12,.045,'triangle');if(kind==='turn')play(420,400,.06,.009);if(kind==='win')[261.63,329.63,392,523.25].forEach((f,i)=>play(f,f,1.8,.035,'sine',i*.23));
  }
  function hit(event){if(busy())return null;const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;const origin={x:width/2-camera.x+renderShift.x,y:viewY-camera.y+renderShift.y};return game.neighbors().find(p=>{if(game.restrictedVision&&p.direction!==game.direction)return false;const z=plane(p.r,p.c);return Math.abs(x-origin.x-z.x)/(tile*.5)+Math.abs(y-origin.y-z.y)/(tile*.25)<=.96;});}
  canvas.addEventListener('pointermove',e=>{const p=hit(e);hover=p?id(p.r,p.c):-1;canvas.style.cursor=p?'pointer':'default';});canvas.addEventListener('pointerleave',()=>{hover=-1;});
  canvas.addEventListener('pointerup',e=>{const p=hit(e);if(p)step(p.direction);canvas.focus({preventScroll:true});});
  // 屏幕键与物理键盘共用同一入口：原样迁移成功版本。
  const keyDirections={w:0,d:1,s:2,a:3};
  const arrowKeys={arrowup:'w',arrowright:'d',arrowdown:'s',arrowleft:'a'};
  function performControl(key){if(key in keyDirections)return step(keyDirections[key]);if(key==='q')return turn(-1);if(key==='e')return turn(1);}
  // Uniformly fit the supplied keyboard composition; preserve its exact perspective.
  const keyboardCluster=document.querySelector('.movement-cluster'),keyboardPlane=document.querySelector('.key-plane');
  function fitKeyboard(){
    if(!keyboardCluster||!keyboardPlane)return;
    const box=keyboardCluster.getBoundingClientRect();if(!box.width||!box.height)return;
    const scale=Math.min(1,(box.width-16)/315.4,(box.height-16)/199.2);
    keyboardPlane.style.marginLeft='0';keyboardPlane.style.left='50%';
    keyboardPlane.style.transform=`matrix(${.19*scale},${.10*scale},${-.19*scale},${.10*scale},${-31.54*scale},8)`;
  }
  new ResizeObserver(fitKeyboard).observe(keyboardCluster);fitKeyboard();
  const pressedControls=new Map();
  function markKey(key,pressed,source='keyboard'){
    const sources=pressedControls.get(key)||new Set();
    if(pressed)sources.add(source);else sources.delete(source);
    pressedControls.set(key,sources);
    document.querySelectorAll('[data-game-key="'+key+'"]').forEach(button=>button.classList.toggle('is-active',sources.size>0));
  }
  function releaseControls(){pressedControls.clear();document.querySelectorAll('[data-game-key]').forEach(button=>button.classList.remove('is-active'));}
  document.querySelectorAll('[data-game-key]').forEach(button=>{
    const key=button.dataset.gameKey;
    button.addEventListener('pointerdown',event=>{button.setPointerCapture(event.pointerId);markKey(key,true,'pointer:'+event.pointerId);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>markKey(key,false,'pointer:'+event.pointerId));
    button.addEventListener('click',()=>performControl(key));
  });
  for(const type of Object.keys(TOOL_NAMES))ui[type].addEventListener('click',()=>tool(type));
  ui['new-game'].addEventListener('click',()=>{if(starting||falling||overview)return;ui['restart-dialog'].showModal();});ui['cancel-restart'].addEventListener('click',()=>ui['restart-dialog'].close());ui['confirm-restart'].addEventListener('click',()=>{ui['restart-dialog'].close();restart();});ui.restart.addEventListener('click',restart);
  ui.help.addEventListener('click',()=>openGuide(false));ui['close-help'].addEventListener('click',()=>ui['help-dialog'].close());ui.begin.addEventListener('click',()=>ui['help-dialog'].close());ui['reduce-motion'].addEventListener('change',e=>{reduced=e.target.checked;});ui.haptics.addEventListener('change',e=>{hapticsEnabled=e.target.checked;});
  function unlockAudio(){
    if(!soundEnabled)return;
    ensureMusic();
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      if(!audio)audio=new Audio();
      if(audio.state==='suspended')audio.resume().then(()=>syncMusic(performance.now())).catch(()=>{});else syncMusic(performance.now());
    }catch{/* Silent play remains available when the device has no audio output. */}
  }
  document.addEventListener('pointerdown',unlockAudio,{capture:true,passive:true});
  document.addEventListener('keydown',unlockAudio,{capture:true});
  ui.sound.addEventListener('click',()=>{soundEnabled=!soundEnabled;ui.sound.setAttribute('aria-checked',String(soundEnabled));if(soundEnabled){unlockAudio();tone('probe');}else{syncMusic(performance.now());}});
  document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;const raw=event.key.toLowerCase(),key=arrowKeys[raw]||raw;if(key in keyDirections||key==='q'||key==='e'){event.preventDefault();markKey(key,true);if(!event.repeat)performControl(key);}else if(['1','2','3'].includes(key)){event.preventDefault();if(event.repeat)return;tool({1:'companion',2:'probe',3:'panorama'}[key]);}});
  document.addEventListener('keyup',event=>{const key=arrowKeys[event.key.toLowerCase()]||event.key.toLowerCase();if(key in keyDirections||key==='q'||key==='e')markKey(key,false);});
  window.addEventListener('blur',releaseControls);
  document.addEventListener('visibilitychange',()=>{lastSanTick=performance.now();if(document.hidden){releaseControls();audio?.suspend().catch(()=>{});}else if(soundEnabled){unlockAudio();}});
  let guidePage=0;
  function showGuidePage(index){
    guidePage=Math.max(0,Math.min(2,index));
    ui['help-dialog'].setAttribute('aria-labelledby',['help-title','help-title-tools','help-title-san'][guidePage]);
    document.querySelectorAll('.guide-page').forEach((el,i)=>el.hidden=i!==guidePage);
    document.querySelectorAll('.guide-dots i').forEach((el,i)=>el.classList.toggle('active',i===guidePage));
    ui['guide-counter'].textContent=pad(guidePage+1)+' / 03 · '+['开始感知','借助线索','面对黑暗'][guidePage];
    ui['guide-prev'].hidden=guidePage===0;ui['guide-next'].hidden=guidePage===2;ui.begin.hidden=guidePage!==2;
    ui['help-dialog'].scrollTop=0;
  }
  function openGuide(first){showGuidePage(0);ui['close-help'].textContent=first?'跳过介绍 ×':'关闭 ×';ui.begin.textContent=started?'回到探索 ↗':'开始探索 ↗';ui['help-dialog'].showModal();}
  ui['guide-prev'].addEventListener('click',()=>showGuidePage(guidePage-1));
  ui['guide-next'].addEventListener('click',()=>showGuidePage(guidePage+1));
  ui['leaderboard-open'].addEventListener('click',openRanking);ui['win-ranking'].addEventListener('click',openRanking);ui['close-ranking'].addEventListener('click',()=>ui['ranking-dialog'].close());
  ui['ranking-normal'].addEventListener('click',()=>selectBoard('normal'));ui['ranking-deaths'].addEventListener('click',()=>selectBoard('deaths'));
  ui['ranking-prev'].addEventListener('click',()=>loadLeaderboard(boardPage-1));ui['ranking-next'].addEventListener('click',()=>loadLeaderboard(boardPage+1));ui['ranking-retry'].addEventListener('click',()=>loadLeaderboard(boardPage));
  ui['finishers-refresh'].addEventListener('click',loadFinishers);
  ui['score-form'].addEventListener('submit',submitScore);ui['retry-verify'].addEventListener('click',verifyFinish);


  art.onload=()=>{artReady=true;textures.clear();warmFloorTextures();};art.onerror=()=>say('建筑图像加载失败。','请刷新页面后重试。',true);art.src='yuanbai-art.webp';
  resize();camera=plane(game.r,game.c);resetViewOpacity();updateUI();requestAnimationFrame(draw);applyLockedName();openGuide(true);ensureMusic();unlockAudio();
  if(document.modelContext?.registerTool){const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'explore_yuanbai',title:'探索元白楼',description:'通过与界面相同的操作探索元白楼，不泄露未知格。道具需要先拾取。',inputSchema:{type:'object',properties:{action:{type:'string',enum:['read','move_ne','move_se','move_sw','move_nw','turn_left','turn_right','companion','probe','panorama']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){const choices=['read','move_ne','move_se','move_sw','move_nw','turn_left','turn_right','companion','probe','panorama'];if(!input||Object.keys(input).some(k=>k!=='action')||!choices.includes(input.action))throw Error('无效操作');if(input.action!=='read'){if(busy())throw Error('请等待动画或关闭弹窗');const d=choices.slice(1,5).indexOf(input.action);if(d>=0)await step(d);else if(input.action.startsWith('turn_'))await turn(input.action==='turn_left'?-1:1);else tool(input.action);await new Promise(resolve=>{function done(){if(!starting&&!walking&&!falling&&!overview&&(!winning||performance.now()-winning.start>2700))resolve();else requestAnimationFrame(done);}done();});}return {position:{row:game.r+1,column:game.c+1},collected:game.count,san:Number(game.san.toFixed(1)),visibleTiles:game.visibleCells().length,deaths:game.falls,stock:{...game.stock},facing:DIRS[game.direction].name,mode:game.mode,message:ui['message-title'].textContent};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
})();

