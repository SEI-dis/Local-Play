// SPDX-License-Identifier: AGPL-3.0-or-later
// Original ARM9/ARM7 test program, assembled here without SDK, BIOS or game data.
// Main backdrop responds to A; lower backdrop responds to stylus press.
function assemble(build){
 const words=[],pool=[];
 const emit=n=>words.push(n>>>0),constant=(reg,value)=>{pool.push({at:words.length,reg,value});emit(0);};
 build(emit,constant,()=>words.length);
 for(const {at,reg,value} of pool){words[at]=(0xe59f0000|(reg<<12)|((words.length-at-2)*4))>>>0;emit(value);}
 const out=Buffer.alloc(words.length*4);words.forEach((v,i)=>out.writeUInt32LE(v,i*4));return out;
}
module.exports=function nds(){
 const arm9=assemble((e,l,pos)=>{
  l(0,0x04000304);l(1,0x820f);e(0xe1c010b0);
  l(0,0x04000000);l(1,0x10000);e(0xe5801000);l(0,0x04001000);e(0xe5801000);
  const loop=pos();
  l(0,0x04000130);e(0xe1d010b0);e(0xe3110001);e(0x03a01e3e);e(0x13a0101f);l(0,0x05000000);e(0xe1c010b0);
  l(0,0x02001004);e(0xe1d010b0);e(0xe3110040);e(0x03a01e3e);e(0x13a01b1f);l(0,0x05000400);e(0xe1c010b0);
  e(0xea000000|((loop-pos()-2)&0xffffff));
 });
 const arm7=assemble((e,l,pos)=>{l(0,0x04000136);l(2,0x02001004);const loop=pos();e(0xe1d010b0);e(0xe1c210b0);e(0xea000000|((loop-pos()-2)&0xffffff));});
 const rom=Buffer.alloc(131072);rom.write('LOCALNDS');rom.write('####',12);rom.write('00',16);
 const fields={0x20:0x200,0x24:0x02000000,0x28:0x02000000,0x2c:arm9.length,0x30:0x400,0x34:0x03800000,0x38:0x03800000,0x3c:arm7.length,0x80:rom.length,0x84:0x200};
 for(const [at,n] of Object.entries(fields))rom.writeUInt32LE(n,Number(at));rom[0x14]=0;rom[0x15]=0;rom[0x1e]=4;
 rom.set(arm9,0x200);rom.set(arm7,0x400);return rom;
};
