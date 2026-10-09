// SPDX-License-Identifier: AGPL-3.0-or-later
// Authored flash test only; never reads a user's cartridge or browser profile.
const assert=require('node:assert/strict');
const browserName=process.env.BROWSER_ENGINE||'chromium',browserType=require('./browser-runtime.cjs')[browserName];
(async()=>{
 const browser=await browserType.launch({headless:true,...(browserName==='chromium'?{channel:process.env.BROWSER_CHANNEL||'msedge'}:{})});
 try{
  const context=await browser.newContext(),page=await context.newPage(),base=process.env.TEST_URL||'http://127.0.0.1:4173/';const requests=[],errors=[];
  context.on('request',r=>requests.push(r));page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  await page.goto(base);
  await page.locator('#rom-input').setInputFiles({name:'Authored-flash.gba',mimeType:'application/octet-stream',buffer:Buffer.from(require('./core-upgrade.cjs').flash(95,true))});
  await page.locator('.game-launch').click();await page.locator('.game-info-play').click();await page.locator('#loading').waitFor({state:'hidden'});
  await page.waitForTimeout(1000);await page.locator('#player-menu').click();
  await page.locator('[data-action=newState]').click();await page.locator('#confirm-state-save').click();await page.locator('[data-slot-load]').first().waitFor();
  const saved=await page.evaluate(async()=>{const db=await import('./src/storage.js'),[game]=await db.all('library'),[entry]=await db.stateEntries(game.id);const s=entry.value;return {id:game.id,stateBytes:s.bytes.length,saveBytes:s.save.length,first:s.save[0],lastBank:s.save[95*65536],core:s.coreId};});
  assert.ok(saved.stateBytes>22*1048576);assert.equal(saved.saveBytes,6*1048576);assert.equal(saved.first,0x5a);assert.equal(saved.lastBank,0x3c);assert.equal(saved.core,'mgba-rom64-save6-v2');
  await page.locator('[data-slot-load]').first().click();await page.locator('#sheet').waitFor({state:'hidden'});
  await page.locator('#player-menu').click();await page.locator('[data-action=importSave]').click();
  const bytes=Buffer.alloc(6*1048576,0xff);bytes[0]=0x41;bytes[bytes.length-1]=0x27;
  await page.locator('#save-input').setInputFiles({name:'Authored-flash.sav',mimeType:'application/octet-stream',buffer:bytes});
  await page.getByText('セーブを読み込みました。ゲームを再起動します。',{exact:true}).waitFor();
  const result=await page.evaluate(async id=>{const db=await import('./src/storage.js'),save=await db.get('saves',id),backups=await db.get('backups',id)||[],states=await db.get('recoveries',id)||[];return {length:save.bytes.length,last:save.bytes.at(-1),backup:backups.some(s=>s.bytes.length===6*1048576&&s.bytes[0]===0x5a),recovery:states.some(s=>s.bytes.length>22*1048576)};},saved.id);
  assert.deepEqual(result,{length:6*1048576,last:0x27,backup:true,recovery:true});
  assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method()==='GET'&&!r.postData()&&new URL(r.url()).origin===new URL(base).origin));
  await context.close();console.log('PASS: 6 MiB UI import, manual state, paired recovery, retained battery backup and no uploads.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
