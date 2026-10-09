// SPDX-License-Identifier: AGPL-3.0-or-later
// Delay real IndexedDB startup in isolated profiles; original cartridge only.
const assert=require('node:assert/strict'),runtime=require('./browser-runtime.cjs');
const engine=process.env.BROWSER_ENGINE||'chromium',base=process.env.TEST_URL||'http://127.0.0.1:4173/';
const cartridge=[...require('./link.cjs').cartridge(31,992)];
// Deliver user gestures inside the delayed-success window itself, avoiding a
// timing race between a loaded CI runner and an external Playwright command.
function slowStartup({bytes,failSettings=false}){
 const open=indexedDB.open.bind(indexedDB);let intercepted=false;
 window.startupProbe={held:false,released:false,actionsBeforeRelease:false};
 if(failSettings){const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='manic-settings')throw new DOMException('Synthetic settings failure','QuotaExceededError');return set.call(this,key,value);};}
 indexedDB.open=function(...args){
  const request=open(...args);if(intercepted||args[0]!=='manicemu-web')return request;intercepted=true;
  let success;Object.defineProperty(request,'onsuccess',{configurable:true,get:()=>success,set:fn=>{success=fn;}});
  request.addEventListener('success',event=>{
   const probe=window.startupProbe;probe.held=true;probe.started=performance.now();
   const input=document.querySelector('#rom-input'),tab=document.querySelector('[data-tab=settings]'),transfer=new DataTransfer();
   transfer.items.add(new File([new Uint8Array(bytes)],'Early startup.gba',{type:'application/octet-stream'}));input.files=transfer.files;
   input.dispatchEvent(new Event('change',{bubbles:true}));tab.click();
   probe.actionsBeforeRelease=!probe.released;probe.emptyBeforeRelease=!document.querySelector('.game-card');
   setTimeout(()=>{probe.released=true;probe.delay=performance.now()-probe.started;success?.call(request,event);},450);
  });return request;
 };
}
(async()=>{
 const browser=await runtime[engine].launch({headless:true,...(engine==='chromium'?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
 try{
  for(const scenario of ['fresh','pending','failed']){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[],coreRequests=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\/cores\/mgba\/[^/]+\.wasm/.test(request.url()))coreRequests.push(request.url());});
   if(scenario!=='fresh'){
    await page.goto(base);await page.locator('#add-first').waitFor();
    await page.evaluate(async()=>{
     const db=await import('./src/storage.js');localStorage.setItem('manic-settings',JSON.stringify({theme:'dark',speed:1,volume:.7,filter:'pixel'}));
     await db.put('coverCatalogs',db.backupMetadataPrefix+'pending',{settings:{theme:'light',speed:4,volume:.3,filter:'smooth',autosave:false,recovery:false}});
    });
   }
   await context.addInitScript(slowStartup,{bytes:cartridge,failSettings:scenario==='failed'});await page.goto(base);
   await page.waitForFunction(()=>window.startupProbe?.released===true);
   assert.equal(await page.evaluate(()=>startupProbe.actionsBeforeRelease&&startupProbe.emptyBeforeRelease&&startupProbe.delay>=400),true,'Gestures occurred while actual IndexedDB completion was withheld');
   if(scenario==='failed'){
    await page.getByRole('button',{name:'再読み込みして復元を完了',exact:true}).waitFor();
    await page.locator('[data-tab=games]').click();await page.waitForTimeout(100);
    const status=await page.evaluate(async()=>{const db=await import('./src/storage.js');return {games:(await db.all('library')).length,pending:await db.has('coverCatalogs',db.backupMetadataPrefix+'pending'),settings:JSON.parse(localStorage.getItem('manic-settings'))};});
    assert.equal(status.games,0,'A failed settings recovery cannot replay queued ROM imports');assert.equal(status.pending,true,'Failed recovery retains its journal');assert.equal(status.settings.theme,'dark');assert.equal(await page.locator('#player').isVisible(),false);assert.equal(await page.locator('#sheet').isVisible(),false);assert.deepEqual(coreRequests,[],'Recovery failure cannot start a core');assert.ok(errors.length>0&&errors.every(message=>/設定を保存できません/.test(message)),JSON.stringify(errors));
   }else{
    await page.locator('.settings-page').waitFor();assert.equal(new URL(page.url()).hash,'#settings','A tab chosen after a queued import is applied last');
    assert.equal(await page.locator('[data-tab=settings]').getAttribute('aria-current'),'page');
    const games=await page.evaluate(async()=>{const db=await import('./src/storage.js');return (await db.all('library')).map(g=>({name:g.name,size:g.size}));});assert.deepEqual(games,[{name:'Early startup',size:cartridge.length}]);
    await page.locator('[data-action=audio]').click();assert.equal(await page.locator('[data-setting=speed]').inputValue(),scenario==='pending'?'4':'1');assert.equal(Number(await page.locator('[data-setting=volume]').inputValue()),scenario==='pending'?.3:.7);await page.locator('#close-sheet').click();
    if(scenario==='pending'){
     assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
     assert.equal(await page.evaluate(async()=>{const db=await import('./src/storage.js');return db.has('coverCatalogs',db.backupMetadataPrefix+'pending');}),false,'Successful recovery consumes the journal');
     await page.evaluate(async()=>{const {MGBACore}=await import('./src/mgba.js'),speed=MGBACore.prototype.setSpeed;MGBACore.prototype.setSpeed=function(value){window.startupEngine=this;return speed.call(this,value);};});
     await page.locator('[data-tab=games]').click();await page.locator('.game-launch').click();await page.locator('.game-info-play').click();await page.locator('#loading').waitFor({state:'hidden'});
     assert.deepEqual(await page.evaluate(()=>({speed:startupEngine.speed,volume:startupEngine.volume,filter:startupEngine.video.mode})),{speed:4,volume:.3,filter:'smooth'},'The running core receives recovered settings, not stale defaults');
    }
    assert.deepEqual(errors,[]);
   }
   await context.close();
  }
  console.log(`PASS ${engine}: delayed IndexedDB startup preserves first ROM selection and later tab, applies pending backup settings before UI/core startup, and blocks import/core launch on recovery failure.`);
 }finally{await browser.close();}
})().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
