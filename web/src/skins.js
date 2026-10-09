// SPDX-License-Identifier: AGPL-3.0-or-later
// Original skins and implementation of the documented Delta skin data format.
import * as db from './storage.js';
import {hash} from './shared.js';
import {normalizeSkin} from './skin-format.js';
import {readSkinZip} from './skin-zip.js';
import {builtins,builtinSkin} from './skin-art.js';
export {builtins};
export const skinSupportsSystem=(skinSystem,system)=>skinSystem===system||(['gb','gbc'].includes(system)&&['gb','gbc'].includes(skinSystem));
let liveURLs=[];
export function releaseSkin(){for(const u of liveURLs)URL.revokeObjectURL(u);liveURLs=[];}
export async function loadSkin(system,id='builtin:classic',fallback='builtin:classic'){
 releaseSkin();const preview=await previewSkin(system,id,fallback);liveURLs=preview.urls;return preview.skin;
}
// Preview URLs have their own lifetime and cannot revoke the running game's skin.
export async function previewSkin(system,id='builtin:classic',fallback='builtin:classic'){
 if(id.startsWith('builtin:'))return {skin:builtinSkin(system,id.split(':')[1]),urls:[]};
 const saved=await db.get('skins',id);if(!saved||!skinSupportsSystem(saved.system,system))return previewSkin(system,fallback===id?'builtin:classic':fallback);
 const images={},urls=[];for(const [key,image] of Object.entries(saved.images)){const blob=image instanceof Blob?image:new Blob([image.bytes],{type:'image/png'});const u=URL.createObjectURL(blob);urls.push(u);images[key]=u;}return {skin:{...saved,images},urls};
}
async function renderImage(bytes,name){
 let canvas=document.createElement('canvas');
 if(/\.pdf$/i.test(name)){
  const pdf=await import('../vendor/pdfjs/pdf.mjs');pdf.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  const task=pdf.getDocument({data:bytes.slice(),isEvalSupported:false,useWasm:false,disableFontFace:true,useSystemFonts:true,useWorkerFetch:false,stopAtErrors:true,isOffscreenCanvasSupported:false,isImageDecoderSupported:false});
  const doc=await task.promise;
  try{if(doc.numPages!==1)throw new Error('2ページ以上あるPDFのスキンには対応していません。');const page=await doc.getPage(1),base=page.getViewport({scale:1}),scale=Math.min(2,2048/Math.max(base.width,base.height)),viewport=page.getViewport({scale});if(viewport.width*viewport.height>8000000)throw new Error('スキン画像が大きすぎます。');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgba(0,0,0,0)'}).promise;}finally{await task.destroy();}
 }else{
  if(!/\.(png|jpe?g|webp)$/i.test(name))throw new Error('スキン画像はPNG・JPEG・WebP・PDFに対応しています。');
  const type=/\.png$/i.test(name)?'image/png':/\.webp$/i.test(name)?'image/webp':'image/jpeg',bitmap=await createImageBitmap(new Blob([bytes],{type}));
  try{if(bitmap.width*bitmap.height>8000000||bitmap.width>8192||bitmap.height>8192)throw new Error('スキン画像が大きすぎます。');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);}finally{bitmap.close();}
 }
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('画像の変換に失敗しました。')),'image/png'));
}
export async function importSkin(file,expectedSystem){
 if(!/\.(deltaskin|manicskin)$/i.test(file.name))throw new Error('DeltaまたはManic形式のスキンを選択してください。');
 if(file.size>40*1024*1024)throw new Error('40MBを超えるスキンは追加できません。');const buffer=await file.arrayBuffer(),files=await readSkinZip(buffer),infoName=[...files.keys()].find(n=>/(^|\/)info\.json$/i.test(n));
 if(!infoName||files.get(infoName).length>512*1024)throw new Error('スキンの設定ファイルがないか、大きすぎます。');
 const prefix=infoName.slice(0,-9),info=JSON.parse(new TextDecoder().decode(files.get(infoName)));
 const identifier=String(info.gameTypeIdentifier||'').split('.').pop().toLowerCase(),system=({ds:'nds',genesis:'md'})[identifier]||identifier;
 if(!['gba','gb','gbc','nes','snes','md','nds'].includes(system))throw new Error('このスキンの機種には対応していません。GBA・GB/GBC・FC・SFC・MD・NDS用を選択してください。');
 if(expectedSystem&&!skinSupportsSystem(system,expectedSystem))throw new Error('このゲーム用のスキンではありません。');
 const used=new Set();
 const asset=name=>{if(typeof name!=='string'||!files.has(prefix+name)||name.split('/').includes('..')||! /\.(png|jpe?g|webp|pdf)$/i.test(name))throw new Error('スキン内の画像が見つからないか、画像形式に対応していません。');used.add(name);return name;};
 const representations=normalizeSkin(info,system,asset);
 if([...files.keys()].some(n=>/\.caf$/i.test(n)))representations.warnings.push('スキンの効果音（CAF）は再生しません。');
 if(used.size>96)throw new Error('スキンの画像数が多すぎます。');const images=Object.create(null);let imageBytes=0;
 // Store bytes rather than Blob handles: some WebKit storage backends cannot
 // persist generated Blobs. Existing Blob records remain readable above.
 for(const name of used){const blob=await renderImage(files.get(prefix+name),name);if((imageBytes+=blob.size)>64*1024*1024)throw new Error('変換後のスキンが大きすぎます。');images[name]={bytes:new Uint8Array(await blob.arrayBuffer()),type:'image/png',size:blob.size};}
 const record={id:'skin:'+await hash(new Uint8Array(buffer)),name:String(info.name||file.name).slice(0,120),system,images,...representations,importedAt:Date.now()};
 await db.put('skins',record.id,record);return record;
}
