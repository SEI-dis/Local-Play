// SPDX-License-Identifier: AGPL-3.0-or-later
// Isolated profile, generated stereo tones and an original test cartridge only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const kind=process.env.BROWSER_ENGINE||'chromium',browserType=require('./browser-runtime.cjs')[kind];
(async()=>{
 const browser=await browserType.launch({headless:true,...(kind==='chromium'?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4173/');
  const result=await page.evaluate(async()=>{
   const {MGBACore}=await import('./src/mgba.js'),{RetroCore}=await import('./src/retro.js'),{NDSCore}=await import('./src/nds.js');
   const check=(ok,label)=>{if(!ok)throw Error(label);};
   for(const Core of [RetroCore,NDSCore])for(const method of ['audio','setPreservePitch','setSpeed','stopAudio'])check(Core.prototype[method]===MGBACore.prototype[method],'Every core uses the shared audio path');
   if(typeof OfflineAudioContext==='undefined')return{unavailable:true};
   const frequency=(data,start,end)=>{
    const crossings=[];for(let i=start+1;i<end;i++)if(data[i-1]<0&&data[i]>=0)crossings.push(i-data[i]/(data[i]-data[i-1]));
    return (crossings.length-1)*48000/(crossings.at(-1)-crossings[0]);
   };
   const cases=[];
   for(const rate of [32768,44100,48000])for(const speed of [1,2,3,4,5]){
    let normal;
    for(const preserve of [false,true]){
     const ac=new OfflineAudioContext(2,Math.ceil((2/speed+.2)*48000),48000),core=new MGBACore(document.createElement('canvas'));
     const samples=Math.round(rate*2),chunk=Math.round(rate/60);let frame=0,n=0,now=0,heap=new Int16Array(chunk*2+16),starts=[],ends=[];
     core.m={get HEAP16(){return heap;},_web_audio:()=>32,_web_audio_rate:()=>rate,_web_audio_read:()=>n};
     core.ac={state:'running',get currentTime(){return now;},createBuffer:ac.createBuffer.bind(ac),createBufferSource:()=>{
      const source=ac.createBufferSource(),start=source.start.bind(source);
      source.start=t=>{starts.push(t);ends.push(t+source.buffer.duration/source.playbackRate.value);check(source.playbackRate.value===(preserve?1:speed),'Playback rate matches the selected mode');start(t);};return source;
     }};
     core.gain=ac.createGain();core.gain.connect(ac.destination);core.setSpeed(speed);core.setPreservePitch(preserve);
     while(frame<samples){
      n=Math.min(chunk,samples-frame);heap=new Int16Array(n*2+16); // Changing memory view + nonzero WASM pointer.
      for(let i=0;i<n;i++){heap[16+i*2]=Math.sin(2*Math.PI*440*(frame+i)/rate)*19660;heap[17+i*2]=Math.sin(2*Math.PI*660*(frame+i)/rate)*9830;}
      // The same burst cadence as a 60 Hz display running multiple emulated frames.
      now=Math.floor(frame/rate/speed*60)/60;core.audio();frame+=n;
      check(core.nextAudio-now<.16,'Live queue latency remains bounded');
     }
     check(starts.length>2,'Audio was scheduled');
     for(let i=1;i<starts.length;i++)check(Math.abs(starts[i]-ends[i-1])<1e-9,'Continuous stream has no scheduling gaps');
     check(Math.abs(ends.at(-1)-starts[0]-2/speed)<.035,'Output tempo follows emulation speed');
     const pending=core.sources.size;core.setSpeed(speed);core.setPreservePitch(preserve);check(core.sources.size===pending,'Unchanged settings do not cancel sound');
     const rendered=await ac.startRendering(),start=Math.ceil((starts[0]+.065)*48000),end=Math.floor((ends.at(-1)-.025)*48000),hz=[];
     for(const [ch,tone,amplitude]of [[0,440,.6],[1,660,.3]]){
      const data=rendered.getChannelData(ch),actual=frequency(data,start,end);hz.push(actual);
      check(Math.abs(actual-tone*(preserve?1:speed))<5,`${rate} / ${speed}x / ${preserve} / channel ${ch}: ${actual} Hz`);
      let energy=0;for(let i=start;i<end;i++)energy+=data[i]**2;check(Math.sqrt(energy/(end-start))>amplitude*.55,'Stereo energy is preserved');
      check(data.slice(0,Math.floor(starts[0]*48000)-64).every(v=>v===0),'Silence before the scheduled start');
      check(data.slice(Math.ceil((ends.at(-1)+.005)*48000)).every(v=>Math.abs(v)<.0001),'No trailing audio');
     }
     if(speed===1){if(!preserve)normal=rendered;else for(let ch=0;ch<2;ch++){const a=normal.getChannelData(ch),b=rendered.getChannelData(ch);check(a.every((v,i)=>v===b[i]),'1x bypass is sample-identical');}}
     cases.push({rate,speed,preserve,hz});
    }
   }
   // Every discontinuity must clear scheduled sound and the overlap history.
   const ac=new OfflineAudioContext(2,48000,48000),core=new MGBACore(document.createElement('canvas'));let reads=0,closed=0;
   core.m={HEAP16:new Int16Array(2048).fill(12000),_web_audio:()=>0,_web_audio_rate:()=>48000,_web_audio_read:()=>{reads++;return 1024;},_web_reset:()=>{},_web_state_import:()=>1,_web_close:()=>{closed++;}};
   core.ac={state:'running',currentTime:0,createBuffer:ac.createBuffer.bind(ac),createBufferSource:ac.createBufferSource.bind(ac),close:()=>{}};
   core.gain=ac.createGain();core.gain.connect(ac.destination);core.copyIn=(_,fn)=>fn(0,1);core.draw=()=>{};
   const empty=()=>check(core.sources.size===0&&core.nextAudio===0&&(!core.stretch||core.stretch.size===0),'Discontinuity clears pending audio and DSP');
   const fill=()=>{core.setVolume(.7);core.setSpeed(2);core.setPreservePitch(true);for(let i=0;i<6;i++)core.audio();check(core.sources.size>0,'Sources primed');};
   for(const change of [()=>core.setSpeed(3),()=>core.setPreservePitch(false),()=>core.setVolume(0),()=>core.pause(true),()=>core.reset(),()=>core.loadState(new Uint8Array([0]))]){fill();change();empty();}
   fill();for(let i=0;i<300;i++)core.audio();check(core.nextAudio<=.23&&core.sources.size<=11,'Stalled clock cannot grow the source queue');core.stopAudio();empty();
   core.setVolume(0);const before=reads;core.audio();empty();check(reads===before+1,'Muted bridge is still drained');
   core.setVolume(.7);core.ac.state='suspended';core.audio();empty();core.ac.state='running';
   fill();core.close();empty();check(closed===1,'Close reaches native adapter');
   const cancelled=await ac.startRendering();check(cancelled.getChannelData(0).every(v=>v===0),'All cancelled sources remain silent');
   return{cases};
  });
  if(result.unavailable)console.log('SKIP: this browser build has no OfflineAudioContext; rendered audio is not verified.');
  else{assert.equal(result.cases.length,30);console.log('PASS: 30 rendered stereo cases (32.768/44.1/48 kHz, 1–5x, on/off), 1x sample identity, continuous timing, bounded queue and pause/mute/toggle/speed/state/reset/close cancellation.');}
  const pitch=page.locator('input[data-setting=preservePitch]');
  const settings=async()=>{await page.locator('[data-tab=settings]').click();await page.locator('#content [data-action=audio]').click();};
  await settings();assert.equal(await pitch.isChecked(),true,'Existing profiles receive on by default');
  await pitch.uncheck();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('manic-settings')).preservePitch),false);
  await page.reload();await settings();assert.equal(await pitch.isChecked(),false,'Off survives a reload');
  await page.locator('#close-sheet').click();await page.locator('[data-tab=games]').click();
  await page.evaluate(async()=>{const {MGBACore}=await import('./src/mgba.js'),original=MGBACore.prototype.setPreservePitch;MGBACore.prototype.setPreservePitch=function(v){window.testEngine=this;return original.call(this,v);};});
  await page.locator('#rom-input').setInputFiles({name:'Original pitch test.gba',mimeType:'application/octet-stream',buffer:Buffer.from(require('./link.cjs').cartridge(31,992))});
  await page.locator('[data-details]').click();assert.equal(await pitch.isChecked(),false,'Pre-play game menu uses the same setting');await pitch.check();
  await page.locator('[data-action=play]').click();await page.locator('#loading').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>testEngine.preservePitch),true,'Engine receives setting at launch');
  await page.locator('#boost').click();assert.equal(await page.evaluate(()=>testEngine.speed),2);
  await page.locator('#player-menu').click();assert.equal(await pitch.isChecked(),true);await pitch.uncheck();
  assert.equal(await page.evaluate(()=>testEngine.preservePitch),false,'In-game change reaches active engine');
  await pitch.check();assert.equal(await page.evaluate(()=>testEngine.preservePitch),true);
  await pitch.scrollIntoViewIfNeeded();
  if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,kind+'-pitch-menu.png')});}
  await page.locator('[data-action=play]').click();assert.equal(await page.evaluate(()=>testEngine.speed),2,'Switch does not change selected speed');
  await page.locator('#player-menu').click();await page.locator('[data-action=exit]').click();await page.locator('#player').waitFor({state:'hidden'});
  await settings();assert.equal(await pitch.isChecked(),true,'In-game change also updates settings screen');
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,kind+'-pitch-settings.png')});
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: default-on migration, persisted off/on, settings/pre-play/playing menu sync, live engine application and inherited NDS/Retro audio path.');
 }finally{await browser.close();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
