/* 元白 · 失重之间 | Canvas绘制、输入、声音与动画。 */
(() => {
  'use strict';
  const { Game, SIZE, SAFE_COUNT, DIRS, CLIFFS, PICKUPS, TOOL_NAMES, RULE_VERSION, PANORAMA_MS, id } = window.YuanbaiCore;
  const game = new Game(), $ = s => document.querySelector(s);
  const canvas = $('#world'), ctx = canvas.getContext('2d', { alpha: false });
  const ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
  const arrow = ['↗','↘','↙','↖'];
  const pad = n => String(n).padStart(2, '0');
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = x => 1 - Math.pow(1 - clamp(x), 3);
  let width = 0, height = 0, tile = 190, camera = { x: 0, y: 0 }, lastTime = 0;
  let walking=null,falling=null,winning=null,sweep=null,echoCue=null,hover=-1,overview=null,boundary=null;
  let starting=false,started=false,runId=null,practice=false,actions=[],startTick=0,endElapsed=null,verified=null,verifying=false,submitting=false,generation=0,lastClock=0,toastUntil=0;
  let boardPage=1,boardPages=1,boardRequest=0,boardSeason='current';
  let soundEnabled = false, hapticsEnabled=true, audio = null, artReady = false;
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
    tile = clamp(Math.min(width*.36,height*.52),78,242);
  }
  new ResizeObserver(resize).observe(canvas);
  function material(index, revealed) {
    const key = index + ':' + (revealed && artReady ? 1 : 0);
    if (textures.has(key)) return textures.get(key);
    const t = document.createElement('canvas'); t.width = t.height = 180;
    const c = t.getContext('2d');
    c.fillStyle = revealed ? '#7e6a51' : '#474e45'; c.fillRect(0, 0, 180, 180);
    if (revealed && artReady) {
      const unitX = art.naturalWidth / 9, unitY = art.naturalHeight / 9;
      c.drawImage(art, index % 9 * unitX, Math.floor(index / 9) * unitY, unitX, unitY, 0, 0, 180, 180);
    }
    // 固定种子的粗糙混凝土与锈蚀颗粒，邻格不根据危险类型改变纹理。
    const alpha = revealed && artReady ? .22 : 1;
    c.globalAlpha = alpha;
    for (let i = 0; i < 280; i++) {
      const seed = index * 823 + i * 19;
      const x = random(seed) * 180, y = random(seed + 3) * 180, s = random(seed + 8) * 2.5 + .3;
      c.fillStyle = i % 7 === 0 ? '#bc724866' : (i % 2 ? '#d0d3bf22' : '#05070440');
      c.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 11; i++) {
      const seed = index * 39 + i * 23;
      c.fillStyle = '#995b3850';
      c.beginPath(); c.ellipse(random(seed) * 180, random(seed + 2) * 180, random(seed + 5) * 17 + 2, random(seed + 6) * 11 + 1, random(seed + 7) * 6, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    textures.set(key, t); return t;
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
    const revealed = game.visited.has(index) || (CLIFFS.includes(index) && game.inspected.has(index)) || !!overview, cliff = CLIFFS.includes(index) && revealed && !winning;
    let points = diamond(center.x, center.y, size * .95);
    if (winning) {
      const mosaic = Math.max(90,Math.min(width-42,height-(width<700?104:176),680)), cell = mosaic / 9;
      const x = width / 2 - mosaic / 2 + c * cell + .75;
      const y = height / 2 - mosaic / 2 + (width<700?27:39) + r * cell + .75;
      const square = [{x,y},{x:x+cell-1.5,y},{x:x+cell-1.5,y:y+cell-1.5},{x,y:y+cell-1.5}];
      points = points.map((p,i) => ({x:lerp(p.x,square[i].x,finale),y:lerp(p.y,square[i].y,finale)}));
    }
    const depth = size * .2 * (1 - finale), [a,b,d,e] = points;
    ctx.save(); ctx.globalAlpha = opacity;
    polygon([e,d,{x:d.x,y:d.y+depth},{x:e.x,y:e.y+depth}],cliff?'#090b09':'#30372f',null);
    polygon([b,d,{x:d.x,y:d.y+depth},{x:b.x,y:b.y+depth}],cliff?'#080908':'#1e231c',null);
    polygon(points,cliff?'#050606':'#42493e');
    drawTexture(points,material(index,revealed || !!winning),cliff?(overview?.7:.27):1);
    if (!current && !winning) polygon(points,cliff?'#0008':'#00000026');
    polygon(points,null,current && !winning?'#e2b58a':(cliff?'#bb714d':'#6b745d'),current?1.8:.85);
    // 侧面只保留整块明暗，去除竖向装饰线和侧面竖边描线。
    if(current && boundary && !winning && !overview){
      const edges=[[a,b],[b,d],[d,e],[e,a]],edge=edges[boundary.direction];
      const strength=clamp(1-(time-boundary.start)/1100);
      ctx.save();ctx.globalAlpha*=strength;ctx.strokeStyle='#ffc291';ctx.shadowColor='#eb914f';ctx.shadowBlur=22;ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(edge[0].x,edge[0].y);ctx.lineTo(edge[1].x,edge[1].y);ctx.stroke();ctx.restore();
    }
    if (cliff) {
      ctx.fillStyle='#231209';ctx.beginPath();ctx.arc(center.x,center.y,overview?6:10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffc293';ctx.font=(overview?'bold 13px':'bold 18px')+' system-ui';ctx.textAlign='center';ctx.fillText('×',center.x,center.y+(overview?4:6));
    } else if ((game.inspected.has(index) || game.safeSignals.has(index)) && !revealed && !winning) {
      ctx.fillStyle='#afc39f'; ctx.beginPath();ctx.arc(center.x,center.y+2,2.5,0,Math.PI*2);ctx.fill();
    }
    const pickup=game.pickupAt(index);
    if(pickup&&!winning&&!falling){
      const labels={companion:'1',probe:'2',panorama:'3'},colors={companion:'#dc9d6b',probe:'#afd0a0',panorama:'#c6b8e4'};
      const radius=overview?4:Math.max(11,size*.065),y=center.y-(overview?3:size*.12);
      ctx.save();ctx.shadowColor=colors[pickup.type];ctx.shadowBlur=overview?0:14;ctx.fillStyle='#11130f';ctx.strokeStyle=colors[pickup.type];ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(center.x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
      if(!overview){ctx.fillStyle=colors[pickup.type];ctx.textAlign='center';ctx.font='bold 13px ui-monospace,monospace';ctx.fillText(labels[pickup.type],center.x,y+4);}
      ctx.restore();
    }
    if (hover === index && !falling && !winning && !overview) polygon(points,'#ffffff10','#dedec3',1.5);
    ctx.restore();
  }
  function avatar(x,y,size,time,fallProgress=0,opacity=1) {
    ctx.save();ctx.globalAlpha=opacity;
    const pulse = reduced?1:1+Math.sin(time/580)*.11;
    const glow=ctx.createRadialGradient(x,y,2,x,y,size*.4);glow.addColorStop(0,'#f3c59c45');glow.addColorStop(.45,'#d68f5530');glow.addColorStop(1,'#d68f5500');
    ctx.fillStyle=glow;ctx.save();ctx.translate(x,y);ctx.scale(1,.53);ctx.beginPath();ctx.arc(0,0,size*.44*pulse,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.strokeStyle='#e7b99199';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,size*.19*pulse,size*.09*pulse,0,0,Math.PI*2);ctx.stroke();
    const d=DIRS[game.direction],p=plane(d.dr,d.dc,size*.43);
    ctx.fillStyle='#f0bd90';ctx.beginPath();ctx.arc(x+p.x,y+p.y,2.6,0,Math.PI*2);ctx.fill();
    const bob = walking && !reduced?Math.sin(time/85)*1.4:0;
    y += fallProgress*fallProgress*height*2.7;
    const h=size*.205,hem=size*.087,neck=size*.023,top=y-h+bob,base=y+bob,headR=size*.037,headY=top-headR-size*.014;
    ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(x,y+4,hem*1.1,size*.027,0,0,Math.PI*2);ctx.fill();
    const robe=ctx.createLinearGradient(x-hem,top,x+hem,base);robe.addColorStop(0,'#fff8e7');robe.addColorStop(.55,'#e6dfcf');robe.addColorStop(1,'#afa99d');
    ctx.fillStyle=robe;ctx.shadowColor='#f1d2a4';ctx.shadowBlur=7;
    ctx.beginPath();ctx.moveTo(x-neck,top);ctx.quadraticCurveTo(x,top-size*.012,x+neck,top);ctx.lineTo(x+hem,base);ctx.bezierCurveTo(x+hem*.6,base+size*.04,x-hem*.6,base+size*.04,x-hem,base);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    polygon([{x:x+neck*.35,y:top},{x:x+hem,y:base},{x:x+hem*.2,y:base+size*.024}], '#bcb6a733');
    ctx.fillStyle='#f7f0df';ctx.beginPath();ctx.arc(x,headY,headR,0,Math.PI*2);ctx.fill();
    const face=plane(d.dr,d.dc,headR*1.3);
    ctx.fillStyle='#8e7558';ctx.beginPath();ctx.arc(x+face.x,headY+face.y,Math.max(1.3,headR*.19),0,Math.PI*2);ctx.fill();
    if (!walking && !falling && !winning && game.totalSteps < 2) {ctx.textAlign='center';ctx.fillStyle='#b4b6a7';ctx.font='12px system-ui';ctx.fillText('你在这里',x,headY-headR-16);}
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
    haze.addColorStop(0,'#cadace00');haze.addColorStop(.58,'#bdc9b86b');haze.addColorStop(1,'#bdc9b800');
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
        shade.addColorStop(0,'#162b2300');shade.addColorStop(1,'#75978477');ctx.fillStyle=shade;ctx.fillRect(0,0,width,height);ctx.restore();
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
  function advanceSan(now=performance.now()){
    if(!started||game.mode==='won')return;
    game.advanceTime(Math.max(0,now-lastSanTick));lastSanTick=now;
    if(game.restrictedVision!==wasRestricted){
      wasRestricted=game.restrictedVision;hover=-1;
      if(wasRestricted){toast('SAN 100% · 视野收缩至脚下',2300);tone('strain');}
      else if(!falling)toast('SAN 回落 · 周围视野恢复',1600);
      updateSanUI();
    }
    if(now-lastSanUI>150){lastSanUI=now;updateSanUI();}
    if(game.san>=80&&now-lastStrainTone>lerp(5500,2700,game.effectLevel)){lastStrainTone=now;tone('strain');}
  }
  function updateSanUI(){
    const value=Math.min(100,Math.floor(game.san*10)/10);
    ui['san-value'].textContent=value.toFixed(1)+'%';ui['san-meter'].setAttribute('aria-valuenow',value);
    ui['san-fill'].style.width=game.san+'%';ui['san-fill'].style.background=`hsl(${43-game.san*.35} 65% 64%)`;
    ui['san-block'].classList.toggle('critical',game.restrictedVision);
    ui['san-state'].textContent=game.restrictedVision?'仅脚下可见 · 拾取可恢复':'每秒 +0.5 · 拾取 −5 · 坠落 +10';
    ui['vision-status'].hidden=!game.restrictedVision||!!winning||!!overview;
    ui['opening-hint'].hidden=game.restrictedVision||!!winning;
    canvas.dataset.visibleTiles=(falling||winning||overview?81:game.visibleCells().length);
  }
  function vibrate(pattern){if(hapticsEnabled&&!reduced&&navigator.vibrate)navigator.vibrate(pattern);}
  function draw(time) {
    advanceSan(time);
    const dt=Math.min((time-lastTime)||16,60);lastTime=time;
    ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);
    let active=plane(game.r,game.c), player={...active};
    if (walking) {
      const t=ease((time-walking.start)/walking.duration),a=plane(walking.from.r,walking.from.c);
      player={x:lerp(a.x,active.x,t),y:lerp(a.y,active.y,t)};
      if(t>=1) walking=null;
    }
    const follow=1-Math.exp(-dt/125);camera.x=lerp(camera.x,player.x,follow);camera.y=lerp(camera.y,player.y,follow);
    let origin={x:width/2-camera.x,y:height*.48-camera.y},size=tile;
    renderShift={x:0,y:0};
    if(!reduced&&!falling&&!winning&&!overview){renderShift={x:Math.sin(time/1100)*3*game.effectLevel,y:Math.sin(time/830)*1.8*game.effectLevel};origin.x+=renderShift.x;origin.y+=renderShift.y;}
    let progress=0;
    if(falling) {
      progress=(time-falling.start)/1000;
      if(!reduced){
        const k=ease(progress/.75);size=lerp(tile,Math.min(width/9.5,(height-130)/5.2),k);
        const mid=plane(4,4,size);origin={x:lerp(origin.x,width/2-mid.x,k),y:lerp(origin.y,height*.43-mid.y,k)};
        if(progress<1.4){const force=(1-progress/1.4)*15;origin.x+=(random(Math.floor(time/19))*2-1)*force;origin.y+=(random(Math.floor(time/13))*2-1)*force;}
      }
      updateFall(time);
    }
    if(overview){
      const age=time-overview.start,transition=220;
      const total=PANORAMA_MS+transition*2;
      const k=transition===0?1:(age<transition?ease(age/transition):age<=transition+PANORAMA_MS?1:1-ease((age-transition-PANORAMA_MS)/transition));
      size=lerp(tile,Math.max(17,Math.min(width/9.7,(height-102)/5.1)),k);
      const mid=plane(4,4,size);origin={x:lerp(origin.x,width/2-mid.x,k),y:lerp(origin.y,height*.5-mid.y,k)};
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
    let cells=falling || winning || overview ? Array.from({length:81},(_,i)=>({r:Math.floor(i/9),c:i%9})) : game.visibleCells();
    canvas.dataset.visibleTiles=cells.length;
    cells.sort((a,b)=>a.r+a.c-b.r-b.c);
    for(const cell of cells){
      const index=id(cell.r,cell.c),p=plane(cell.r,cell.c,size);
      let x=origin.x+p.x,y=origin.y+p.y,alpha=1;
      if(falling && !reduced){
        const data=fallOrder[index],drop=Math.max(0,progress-.37-data.delay);
        y+=drop*drop*height*.9;x+=data.spin*drop*110;alpha=clamp(1-drop*.5);
        if(progress<.4 && !game.neighbors().some(n=>id(n.r,n.c)===index) && index!==game.position) alpha*=clamp(progress/.4)*.48;
      }
      drawTile(cell.r,cell.c,{x,y},size,alpha,finale,time);
    }
    if(!winning && !falling && !overview){
      const p=player;drawEcho(origin.x+p.x,origin.y+p.y,size,time);
    }
    if(!winning){
      const p=falling||overview?plane(game.r,game.c,size):player;
      avatar(origin.x+p.x,origin.y+p.y,size,time,falling&&!reduced?Math.max(0,progress*1.85):0,falling?clamp(1-progress*1.5):1);
    }
    if(sweep && !falling && !winning && !overview){
      const t=(time-sweep.start)/1000;
      if(t>4.5)sweep=null;
      else {
        const p=plane(sweep.target.r,sweep.target.c,size),x=origin.x+p.x,y=origin.y+p.y;
        ctx.globalAlpha=clamp(4.5-t);ctx.strokeStyle='#b0c69d';ctx.lineWidth=1.2;ctx.setLineDash([4,5]);
        ctx.beginPath();ctx.ellipse(x,y,21+Math.sin(t*4)*3,10,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#c4d4b1';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('安全落点',x,y-23);
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
    ui.count.textContent=pad(game.count);ui.percentage.textContent=Math.floor(game.count/SAFE_COUNT*100)+'%';ui.progress.setAttribute('aria-valuenow',game.count);ui['progress-fill'].style.width=game.count/SAFE_COUNT*100+'%';
    ui.coordinate.textContent=`位置 ${pad(game.r+1)} · ${pad(game.c+1)}`;ui['picked-count'].textContent=game.picked.size;
    for(const type of Object.keys(TOOL_NAMES)){ui[type+'-stock'].textContent=game.stock[type];ui[type].disabled=game.mode!=='playing'||game.stock[type]===0||!!falling||!!overview||starting;}
    ui.direction.textContent=DIRS[game.direction].name+' '+arrow[game.direction];ui['compass-facing'].textContent='面朝 '+DIRS[game.direction].name;
    document.querySelectorAll('[data-face]').forEach(el=>el.classList.toggle('active',Number(el.dataset.face)===game.direction));
    ui.falls.textContent=pad(game.falls);ui['run-kind'].textContent=game.mode==='won'?(practice?'练习完成':'探索完成'):practice?'练习模式':started?'正在探索':'尚未出发';
    canvas.setAttribute('aria-label',`位置第${game.r+1}行第${game.c+1}列，走过${game.count}/${SAFE_COUNT}个安全格，坠落${game.falls}次，面朝${DIRS[game.direction].name}。道具：提示${game.stock.companion}、探测${game.stock.probe}、全景${game.stock.panorama}。WASD移动，123使用道具。`);
  }
  async function api(path,data){
    const response=await fetch('/api/yuanbai/game'+path.slice(4),{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'暂时无法连接，请重试。');return result;
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
    if(result.pickup){say(`拾取「${TOOL_NAMES[result.pickup.type]}」×1。`,'SAN 降低 5 个百分点；道具随时可用，每处只拾取一次。');toast(TOOL_NAMES[result.pickup.type]+' +1 · SAN −5',1300);tone('pickup');}
    else say('这一步已经成为记忆。',practice?'当前未连接共享成绩，仍可完整练习。':'自由移动。已有道具可以随时使用，注意脚下。');
    const signal=game.environment();
    if(signal&&!wasNear){echoCue={start:performance.now()+180};tone('echo');vibrate([16,45,20]);if(!result.pickup){say('附近似乎不太对劲。','空气与光发生了变化；用道具确认准确的悬崖位置。');toast('附近似乎不太对劲',1400);}}
  }
  function tool(type){
    if(busy())return;
    advanceSan();
    const result=game.useTool(type);
    if(result.kind==='empty'){say('还没有这个道具。','寻找方格上的发光数字，踩上去即可拾取。',true);return;}
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
      say('瞬间全景 · 看清这1.5秒。','悬崖以 × 标记；安全格图案只是暂时显现。');tone('panorama');
    }
    updateUI();
  }
  async function turn(delta){if(busy())return;if(!await beginRun())return;advanceSan();if(game.turn(delta)){actions.push(delta===-1?'left':'right');updateUI();tone('turn');}}
  function startFall(){falling={start:performance.now(),reset:false};walking=null;sweep=echoCue=null;boundary=null;say('脚下失去了重量 · SAN +10。','回到起点后保留当前 SAN、进度与未用道具。',true);ui['fall-caption'].textContent='失 重';tone('fall');vibrate([40,30,65]);updateUI();}
  function updateFall(time){
    const duration=3400,t=(time-falling.start)/duration;
    ui.fade.style.opacity=t<.61?clamp((t-.39)/.22):t<.81?1:clamp(1-(t-.81)/.19);ui['fall-caption'].style.opacity=t>.56&&t<.82?'1':'0';
    if(t>.66&&!falling.reset){falling.reset=true;game.respawn();actions.push('respawn');camera=plane(game.r,game.c);updateUI();ui['fall-caption'].textContent='回到起点，记忆仍在。';}
    if(t>=1){falling=null;ui.fade.style.opacity=0;ui['fall-caption'].style.opacity=0;updateUI();say('你回来了，记忆与道具仍在。','已经拿走的道具不刷新。继续探索还没有走过的地方。');if(game.mode==='won')startWin();}
  }
  function startWin(){
    winning={start:performance.now()};walking=null;sweep=null;endElapsed=elapsed();document.body.classList.add('won');
    ui['play-controls'].hidden=true;ui['win-controls'].hidden=false;ui['end-label'].hidden=false;ui['opening-hint'].hidden=true;
    ui['progress-note'].innerHTML='走过66个安全格，81块建筑记忆重新拼合。<br>这是你走出来的元白。';ui['stage-note'].lastElementChild.textContent='元白楼 · 艺术化重构';
    updateUI();tone('win');verifyFinish();
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
    try{const result=await api('/api/scores',{runId,nickname});if(current!==generation)return;ui['score-result'].textContent=result.personalBest?`已入榜，当前第 ${result.rank} 名。`:`已保留更好的历史成绩，当前第 ${result.rank} 名。`;ui['submit-score'].textContent='已提交';ui.nickname.readOnly=true;}
    catch(error){if(current!==generation)return;ui['score-result'].textContent=error.message||'保存失败，昵称已保留，请再试。';ui['submit-score'].disabled=false;ui['submit-score'].textContent='重试提交';}
    finally{if(current===generation)submitting=false;}
  }
  async function loadLeaderboard(page=1){
    const request=++boardRequest;ui['ranking-state'].hidden=false;ui['ranking-state'].textContent='正在读取…';ui['ranking-table'].hidden=true;ui['ranking-retry'].hidden=true;ui['ranking-prev'].disabled=ui['ranking-next'].disabled=true;
    try{const data=await api('/api/leaderboard?page='+page+'&season='+boardSeason);if(request!==boardRequest)return;boardPage=data.page;boardPages=Math.max(1,Math.ceil(data.total/data.pageSize));ui['ranking-body'].replaceChildren();
      for(const row of data.items){const tr=document.createElement('tr');if(row.isYou)tr.className='is-you';for(const text of [row.rank,row.nickname+(row.isYou?' · 你':''),row.deaths,formatTime(row.durationMs)+'.'+Math.floor(row.durationMs%1000/100)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}ui['ranking-body'].append(tr);}
      ui['ranking-state'].hidden=data.total>0;ui['ranking-state'].textContent=boardSeason==='previous'?'上一版还没有通关记录。':'还没有通关记录，成为第一个留下名字的人。';ui['ranking-table'].hidden=data.total===0;ui['ranking-page'].textContent=`${data.total} 位探索者 · ${boardPage} / ${boardPages}`;ui['ranking-prev'].disabled=boardPage<=1;ui['ranking-next'].disabled=boardPage>=boardPages;
    }catch(error){if(request!==boardRequest)return;ui['ranking-state'].textContent='排行榜暂时无法连接。已提交的记录不会因此消失。';ui['ranking-page'].textContent='';ui['ranking-retry'].hidden=false;}
  }
  function selectSeason(season){boardSeason=season;for(const name of ['current','previous','reconstruction','legacy'])ui['ranking-'+name].setAttribute('aria-pressed',season===name);loadLeaderboard(1);}
  function openRanking(){ui['ranking-dialog'].showModal();selectSeason('current');}
  function restart(){
    generation++;game.reset();falling=walking=winning=sweep=echoCue=overview=boundary=null;camera=plane(game.r,game.c);
    starting=started=practice=verifying=submitting=false;runId=null;actions=[];startTick=lastSanTick=lastSanUI=lastStrainTone=0;wasRestricted=false;endElapsed=null;verified=null;document.body.classList.remove('won');
    ui['play-controls'].hidden=false;ui['win-controls'].hidden=true;ui['end-label'].hidden=true;ui['opening-hint'].hidden=false;ui['opening-hint'].style.opacity=1;
    ui['progress-note'].innerHTML='走过的安全格，留下建筑的片段。<br>悬崖不用踩踏，也不计入进度。';ui['stage-note'].lastElementChild.textContent='光所及之处，只有一步。';
    ui['score-form'].hidden=false;ui['score-form'].reset();ui.nickname.readOnly=false;ui['score-result'].textContent='';ui['submit-score'].textContent='加入排行榜';ui['submit-score'].disabled=true;ui['retry-verify'].hidden=true;
    ui.fade.style.opacity=ui['fall-caption'].style.opacity=0;ui['center-toast'].classList.remove('visible');say('自由移动，沿途拾取道具。','道具在安全格上，每处只能拿一次。步数不限。');updateUI();
  }
  function tone(kind){
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
  function hit(event){if(game.restrictedVision||busy())return null;const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;const origin={x:width/2-camera.x+renderShift.x,y:height*.48-camera.y+renderShift.y};return game.neighbors().find(p=>{const z=plane(p.r,p.c);return Math.abs(x-origin.x-z.x)/(tile*.5)+Math.abs(y-origin.y-z.y)/(tile*.25)<=.96;});}
  canvas.addEventListener('pointermove',e=>{const p=hit(e);hover=p?id(p.r,p.c):-1;canvas.style.cursor=p?'pointer':'default';});canvas.addEventListener('pointerleave',()=>{hover=-1;});
  canvas.addEventListener('pointerup',e=>{const p=hit(e);if(p)step(p.direction);canvas.focus({preventScroll:true});});
  document.querySelectorAll('[data-direction]').forEach(button=>button.addEventListener('click',()=>step(Number(button.dataset.direction))));
  for(const type of Object.keys(TOOL_NAMES))ui[type].addEventListener('click',()=>tool(type));
  ui['turn-left'].addEventListener('click',()=>turn(-1));ui['turn-right'].addEventListener('click',()=>turn(1));
  ui['new-game'].addEventListener('click',()=>{if(starting||falling||overview)return;ui['restart-dialog'].showModal();});ui['cancel-restart'].addEventListener('click',()=>ui['restart-dialog'].close());ui['confirm-restart'].addEventListener('click',()=>{ui['restart-dialog'].close();restart();});ui.restart.addEventListener('click',restart);
  ui.help.addEventListener('click',()=>ui['help-dialog'].showModal());ui['close-help'].addEventListener('click',()=>ui['help-dialog'].close());ui.begin.addEventListener('click',()=>ui['help-dialog'].close());ui['reduce-motion'].addEventListener('change',e=>{reduced=e.target.checked;});ui.haptics.addEventListener('change',e=>{hapticsEnabled=e.target.checked;});
  ui['leaderboard-open'].addEventListener('click',openRanking);ui['win-ranking'].addEventListener('click',openRanking);ui['close-ranking'].addEventListener('click',()=>ui['ranking-dialog'].close());ui['ranking-current'].addEventListener('click',()=>selectSeason('current'));ui['ranking-previous'].addEventListener('click',()=>selectSeason('previous'));ui['ranking-reconstruction'].addEventListener('click',()=>selectSeason('reconstruction'));ui['ranking-legacy'].addEventListener('click',()=>selectSeason('legacy'));ui['ranking-prev'].addEventListener('click',()=>loadLeaderboard(boardPage-1));ui['ranking-next'].addEventListener('click',()=>loadLeaderboard(boardPage+1));ui['ranking-retry'].addEventListener('click',()=>loadLeaderboard(boardPage));
  ui['score-form'].addEventListener('submit',submitScore);ui['retry-verify'].addEventListener('click',verifyFinish);
  ui.sound.addEventListener('click',()=>{try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();soundEnabled=!soundEnabled;ui.sound.textContent='声音 '+(soundEnabled?'开':'关');ui.sound.setAttribute('aria-pressed',soundEnabled);if(soundEnabled)tone('probe');}catch{say('当前浏览器未能开启声音。','可以继续无声探索。');}});
  document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;const key=event.key.toLowerCase(),move={w:0,arrowup:0,d:1,arrowright:1,s:2,arrowdown:2,a:3,arrowleft:3};if(key in move){event.preventDefault();if(!event.repeat)step(move[key]);}else if(['1','2','3','q','e'].includes(key)){event.preventDefault();if(event.repeat)return;if(key==='1')tool('companion');if(key==='2')tool('probe');if(key==='3')tool('panorama');if(key==='q')turn(-1);if(key==='e')turn(1);}});
  art.onload=()=>{artReady=true;textures.clear();};art.onerror=()=>say('建筑图像加载失败。','请刷新页面后重试。',true);art.src='yuanbai-art.webp';
  resize();camera=plane(game.r,game.c);updateUI();requestAnimationFrame(draw);
  if(document.modelContext?.registerTool){const lifecycle=new AbortController();addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{Promise.resolve(document.modelContext.registerTool({name:'explore_yuanbai',title:'探索元白楼',description:'通过与界面相同的操作探索元白楼，不泄露未知格。道具需要先拾取。',inputSchema:{type:'object',properties:{action:{type:'string',enum:['read','move_ne','move_se','move_sw','move_nw','turn_left','turn_right','companion','probe','panorama']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){const choices=['read','move_ne','move_se','move_sw','move_nw','turn_left','turn_right','companion','probe','panorama'];if(!input||Object.keys(input).some(k=>k!=='action')||!choices.includes(input.action))throw Error('无效操作');if(input.action!=='read'){if(busy())throw Error('请等待动画或关闭弹窗');const d=choices.slice(1,5).indexOf(input.action);if(d>=0)await step(d);else if(input.action.startsWith('turn_'))await turn(input.action==='turn_left'?-1:1);else tool(input.action);await new Promise(resolve=>{function done(){if(!starting&&!walking&&!falling&&!overview&&(!winning||performance.now()-winning.start>2700))resolve();else requestAnimationFrame(done);}done();});}return {position:{row:game.r+1,column:game.c+1},collected:game.count,san:Number(game.san.toFixed(1)),visibleTiles:game.visibleCells().length,deaths:game.falls,stock:{...game.stock},facing:DIRS[game.direction].name,mode:game.mode,message:ui['message-title'].textContent};}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
})();
