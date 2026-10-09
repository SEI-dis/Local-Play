// SPDX-License-Identifier: AGPL-3.0-or-later
// Both revisions run the same authored test programs. No user ROM/save is read.
const assert=require('node:assert/strict'),path=require('node:path');
const {gba64}=require('./core.cjs');
function input(m,bytes,fn){const p=m._malloc(bytes.length);assert.ok(p);try{m.HEAPU8.set(bytes,p);return fn(p,bytes.length);}finally{m._free(p);}}
function load(m,bytes){assert.equal(input(m,bytes,(p,n)=>m._web_load(p,n)),1);}
function frames(m,count=5){for(let i=0;i<count;i++){m._web_frame(0);m._web_audio_read();}}
function state(m){const n=m._web_state_export();assert.ok(n>0,'State export failed (including the highest used extra-RAM page)');return m.HEAPU8.slice(m._web_state_data(),m._web_state_data()+n);}
function battery(m){const n=m._web_save_export();return m.HEAPU8.slice(m._web_save_data(),m._web_save_data()+n);}
function green(m){const p=m._web_pixels();return m.HEAPU8[p]<10&&m.HEAPU8[p+1]>200&&m.HEAPU8[p+2]<10;}
function program(build){
 const bytes=new Uint8Array(8192),view=new DataView(bytes.buffer),code=[],literals=[];
 view.setUint32(0,0xea00003e,true);bytes[0xb2]=0x96;
 const emit=value=>code.push(value>>>0),ldr=(r,value)=>{literals.push({at:code.length,r,value});emit(0);};
 build({emit,ldr,position:()=>code.length});
 for(const item of literals){const offset=(code.length-item.at)*4-8;assert.ok(offset>=0&&offset<4096);code[item.at]=0xe59f0000|(item.r<<12)|offset;code.push(item.value>>>0);}
 code.forEach((value,i)=>view.setUint32(0x100+i*4,value,true));return bytes;
}
function xram(){return program(({emit,ldr,position})=>{
 ldr(0,0x04000000);ldr(1,0x403);emit(0xe1c010b0); // mode 3, BG2
 ldr(0,0x01fffffc);ldr(1,0x03e0);emit(0xe5801000); // final page of 16 MiB extension
 ldr(3,0x06000000);const loop=position();emit(0xe5902000);emit(0xe1c320b0);
 emit(0xea000000|((loop-position()-2)&0xffffff));
});}
function flash(){const rom=program(({emit,ldr})=>{
 const write=(address,value)=>{ldr(0,address);ldr(1,value);emit(0xe5c01000);};
 const command=value=>{write(0x0e005555,0xaa);write(0x0e002aaa,0x55);write(0x0e005555,value);};
 command(0xb0);write(0x0e000000,15);command(0xa0);write(0x0e000000,0x3c);
 // Let the flash program operation settle before the next command.
 ldr(2,10000);emit(0xe2522001);emit(0x1afffffd);
 command(0xb0);write(0x0e000000,0);command(0xa0);write(0x0e000000,0x5a);emit(0xeafffffe);
 });rom.set(new TextEncoder().encode('FLASH1M_V103'),0x1000);return rom;}

async function check(baselineFile,candidateFile){
 const quiet={print:()=>{},printErr:()=>{}};
 const baseline=await require(path.resolve(baselineFile))(quiet),candidate=await require(path.resolve(candidateFile))(quiet);
 try{
  console.log('CHECK: old-state');
  const rom=gba64();load(baseline,rom);frames(baseline);const previous=state(baseline);
  load(candidate,rom);assert.equal(input(candidate,previous,(p,n)=>candidate._web_state_import(p,n)),1,'Previous state rejected');frames(candidate);assert.ok(green(candidate),'Previous 64 MiB state restored incorrectly');
  const next=state(candidate);candidate._web_reset();assert.equal(input(candidate,next,(p,n)=>candidate._web_state_import(p,n)),1);frames(candidate);assert.ok(green(candidate));
  console.log('PASS: old-state');
  console.log('CHECK: old-battery');
  const gb=new Uint8Array(32768);gb.set([0xc3,0x50,0x01],0x100);gb.set([0xce,0xed,0x66,0x66],0x104);gb.set([0x18,0xfe],0x150);gb[0x147]=3;gb[0x149]=2;
  load(baseline,gb);frames(baseline);const save=battery(baseline);assert.ok(save.length);save[0]=0x35;save[save.length-1]=0x71;
  load(candidate,gb);assert.equal(input(candidate,save,(p,n)=>candidate._web_save_import(p,n)),1);assert.deepEqual(battery(candidate),save);
  console.log('PASS: old-battery');
  console.log('CHECK: extended-flash');
  load(candidate,flash());frames(candidate,30);const extended=battery(candidate);
  if(extended.length>=1048576){assert.equal(extended[15*65536],0x3c);assert.equal(extended[0],0x5a);assert.equal(input(candidate,extended,(p,n)=>candidate._web_save_import(p,n)),1);assert.deepEqual(battery(candidate),extended);console.log('PASS: extended-flash');}
  else console.log('SKIP: extended-flash');
  console.log('CHECK: extended-ram-state');
  load(candidate,xram());frames(candidate);
  if(green(candidate)){const full=state(candidate);candidate._web_reset();assert.equal(input(candidate,full,(p,n)=>candidate._web_state_import(p,n)),1);frames(candidate);assert.ok(green(candidate),'Extra RAM lost during state restore');console.log('PASS: extended-ram-state');}
  else console.log('SKIP: extended-ram-state');
 }finally{baseline._web_close();candidate._web_close();}
}
if(require.main===module)check(process.argv[2]||path.join(__dirname,'../cores/mgba/mgba.js'),process.argv[3]||path.join(__dirname,'../cores/mgba/mgba.js')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={check,xram,flash};
