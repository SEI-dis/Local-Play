// SPDX-License-Identifier: AGPL-3.0-or-later
// Synthetic cartridge and isolated browser profile only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('./browser-runtime.cjs');
const base=process.env.TEST_URL||'http://127.0.0.1:4173/';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'}),p=await ctx.newPage(),errors=[],uploads=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&(r.method()!=='GET'||!r.url().startsWith(base)))uploads.push(r.url());});
  await p.goto(base);
  await p.evaluate(async()=>{const {MGBACore}=await import('./src/mgba.js');const old=MGBACore.prototype.setKeys;window.currentKeys=0;MGBACore.prototype.setKeys=function(k){currentKeys=k;return old.call(this,k);};});
  await p.locator('#rom-input').setInputFiles({name:'Original test.gba',mimeType:'application/octet-stream',buffer:Buffer.from(require('./link.cjs').cartridge(31,992))});
  await p.locator('.game-launch').click();await p.locator('.game-info-play').click();await p.locator('#loading').waitFor({state:'hidden'});
  await p.waitForFunction(()=>!document.querySelector('#toast').classList.contains('show'));
  const pad=p.locator('.skin-button.dpad'),out=process.env.SCREENSHOT_DIR;
  if(out)fs.mkdirSync(out,{recursive:true});
  const point=async(x,y)=>{const r=await pad.boundingBox();return{x:r.x+r.width*x,y:r.y+r.height*y};};
  const expect=async(dirs,keys)=>{try{await p.waitForFunction(({dirs,keys})=>window.currentKeys===keys&&[...document.querySelectorAll('.dpad-direction:not([hidden])')].map(e=>e.dataset.direction).sort().join(',')===[...dirs].sort().join(','),{dirs,keys},{timeout:5000});}catch(e){throw new Error(`Expected ${dirs}/${keys}: `+JSON.stringify(await p.evaluate(()=>({keys:currentKeys,shown:[...document.querySelectorAll('.dpad-direction:not([hidden])')].map(e=>e.dataset.direction)}))),{cause:e});}};
  const sample=async()=>{
   const shot=await pad.screenshot();
   return p.evaluate(async data=>{const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);return Object.fromEntries(Object.entries({up:[.42,.18],down:[.42,.82],left:[.18,.42],right:[.82,.42]}).map(([d,[x,y]])=>[d,[...g.getImageData(Math.floor(x*c.width),Math.floor(y*c.height),1,1).data].slice(0,3)]));},shot.toString('base64'));
  };
  const neutral=await sample(),bounds=await pad.boundingBox();
  const press=await point(.5,.18);await p.mouse.move(press.x,press.y);await p.mouse.down();await expect(['up'],64);
  assert.deepEqual(await pad.boundingBox(),bounds,'No whole-pad shrinking or hitbox movement');
  assert.equal(await pad.evaluate(e=>getComputedStyle(e).filter),'none');
  const up=await sample();assert.ok(up.up.every((v,i)=>v<neutral.up[i]*.8),'Pressed arm visibly darkens');for(const d of ['left','right','down'])assert.deepEqual(up[d],neutral[d],d+' arm unchanged');
  if(out)await pad.screenshot({path:path.join(out,'dpad-up.png')});
  for(const [x,y,dirs,keys]of [[.18,.18,['up','left'],96],[.18,.5,['left'],32],[.18,.82,['left','down'],160],[.5,.82,['down'],128],[.82,.82,['down','right'],144],[.82,.5,['right'],16],[.82,.18,['up','right'],80],[.5,.5,[],0]]){
   const at=await point(x,y);await p.mouse.move(at.x,at.y);await expect(dirs,keys);
  }
  await p.mouse.up();await expect([],0);assert.deepEqual(await sample(),neutral,'Release restores the unpressed appearance');
  // Keyboard and touch share the same visible effective input state.
  await p.keyboard.down('ArrowDown');await expect(['down'],128);await p.keyboard.down('ArrowLeft');await expect(['down','left'],160);await p.keyboard.up('ArrowDown');await expect(['left'],32);await p.keyboard.up('ArrowLeft');await expect([],0);
  const cdp=await ctx.newCDPSession(p),top=await point(.5,.18),right=await point(.82,.5);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...top}]});await expect(['up'],64);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...top},{id:2,...right}]});await expect(['up','right'],80);
  if(out)await pad.screenshot({path:path.join(out,'dpad-diagonal.png')});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{id:1,...top}]});await expect(['right'],16);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect([],0);
  // A polled gamepad, pause and orientation changes must not leave stale shading.
  await p.evaluate(()=>{window.fakePad={axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===13}))};navigator.getGamepads=()=>[fakePad];});await expect(['down'],128);
  await p.locator('#player-menu').click();await expect([],0);await p.evaluate(()=>fakePad.buttons[13].pressed=false);await p.locator('[data-action=play]').click();await expect([],0);
  await p.keyboard.down('ArrowUp');await expect(['up'],64);await p.setViewportSize({width:844,height:390});await expect([],0);await p.keyboard.up('ArrowUp');
  const left=await point(.18,.5);await p.mouse.move(left.x,left.y);await p.mouse.down();await expect(['left'],32);await p.mouse.up();await expect([],0);
  // The selected opacity applies equally to the artwork and its direction feedback.
  await p.locator('#player-menu').click();await p.locator('#sheet [data-action=skins]').click();await p.locator('#edit-controls').click();await p.locator('[data-edit-orientation=landscape]').click();await p.locator('#edit-selection').selectOption('dpad');await p.locator('#edit-opacity').fill('50');await p.locator('#edit-opacity').dispatchEvent('input');await p.locator('#edit-save').click();await p.locator('#skin-select').waitFor();await p.locator('#close-sheet').click();
  assert.equal(await pad.evaluate(e=>getComputedStyle(e).opacity),'0.5');const at=await point(.5,.18);await p.mouse.move(at.x,at.y);await p.mouse.down();await expect(['up'],64);await p.mouse.up();await expect([],0);
  // Ordinary buttons retain their existing press feedback.
  const a=await p.locator('.skin-button[aria-label=A]').boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();assert.equal(await p.locator('.skin-button[aria-label=A]').evaluate(e=>getComputedStyle(e).filter),'brightness(0.7)');await p.mouse.up();
  assert.deepEqual(errors,[]);assert.deepEqual(uploads,[]);await ctx.close();
  console.log('PASS: pixel-verified directional shading, stable hit area, 8 directions/center/drag, keyboard, multi-touch release/cancel, gamepad, pause/rotation, opacity and unchanged A feedback; no uploads.');
 }finally{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,2500))]);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
