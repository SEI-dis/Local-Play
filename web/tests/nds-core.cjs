// SPDX-License-Identifier: AGPL-3.0-or-later
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const m=await require('../cores/nds/core.js')({wasmBinary:fs.readFileSync(path.join(__dirname,'../cores/nds/core.wasm')),print:()=>{},printErr:()=>{}});
 const put=(bytes,fn)=>{const p=m._malloc(bytes.length);try{m.HEAPU8.set(bytes,p);return fn(p,bytes.length);}finally{m._free(p);}};
 assert.equal(put(require('./nds-cartridge.cjs')(),m._web_load),1);
 const run=(keys=0,n=4)=>{for(let i=0;i<n;i++)m._web_frame(keys);},pixel=i=>[...m.HEAPU8.slice(m._web_pixels()+i*256*192*4,m._web_pixels()+i*256*192*4+4)];
 run();assert.deepEqual([m._web_width(),m._web_height()],[256,384]);assert.deepEqual(pixel(0),[255,0,0,255]);assert.deepEqual(pixel(1),[0,0,255,255]);
 run(1<<8);assert.deepEqual(pixel(0),[0,255,0,255]);m._web_touch(0,16384,1);run();assert.deepEqual(pixel(1),[0,255,0,255]);m._web_touch(0,0,0);run();assert.deepEqual(pixel(1),[0,0,255,255]);
 const start=m._web_frame_serial();run(0,12);assert.equal(m._web_frame_serial()-start,6,'Power mode draws half the emulated frames');m._web_render_limit(0);const full=m._web_frame_serial();run(0,12);assert.equal(m._web_frame_serial()-full,12);
 const save=new Uint8Array(8192).fill(0x36);assert.equal(put(save,m._web_save_import),1);assert.equal(m._web_save_export(),save.length);assert.deepEqual(m.HEAPU8.slice(m._web_save_data(),m._web_save_data()+save.length),save);
 assert.equal(put(new Uint8Array(17),m._web_save_import),0);assert.equal(m._web_save_export(),save.length);assert.deepEqual(m.HEAPU8.slice(m._web_save_data(),m._web_save_data()+save.length),save);
 const size=m._web_state_export(),state=m.HEAPU8.slice(m._web_state_data(),m._web_state_data()+size);assert.ok(size>0);run(1<<8);assert.equal(put(state,m._web_state_import),1);run();assert.deepEqual(pixel(0),[255,0,0,255]);
 m._web_reset();run();assert.equal(m._web_save_export(),save.length);assert.deepEqual(m.HEAPU8.slice(m._web_save_data(),m._web_save_data()+save.length),save);m._web_close();
 console.log('PASS: source-built NDS, two real displays, buttons/stylus, 30/60fps rendering, battery import/export, invalid-save refusal, state restore and reset.');
})().catch(e=>{console.error(e);process.exitCode=1;});
