// SPDX-License-Identifier: AGPL-3.0-or-later
// Original skins and implementation of the documented Delta skin data format.
import * as db from './storage.js';
import {hash} from './shared.js';
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
 const images={},urls=[];for(const [key,blob] of Object.entries(saved.images)){const u=URL.createObjectURL(blob);urls.push(u);images[key]=u;}return {skin:{...saved,images},urls};
}
const number=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('スキンの座標が範囲外です。');return v;};
function rect(r){if(!r)throw new Error('スキンに画面やボタンの位置が指定されていません。');return {x:number(r.x,-4096,4096),y:number(r.y,-4096,4096),width:number(r.width,1,4096),height:number(r.height,1,4096)};}
const controls=new Set(['a','b','x','y','c','z','l','r','l1','r1','start','select','menu','up','down','left','right']);
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
 if(file.size>20*1024*1024)throw new Error('20MBを超えるスキンは追加できません。');const buffer=await file.arrayBuffer(),files=await readSkinZip(buffer),infoName=[...files.keys()].find(n=>/(^|\/)info\.json$/i.test(n));
 if(!infoName||files.get(infoName).length>128*1024)throw new Error('スキンの設定ファイルがないか、大きすぎます。');
 const prefix=infoName.slice(0,-9),info=JSON.parse(new TextDecoder().decode(files.get(infoName))),system=String(info.gameTypeIdentifier||'').split('.').pop().toLowerCase();
 if(!['gba','gb','gbc','nes','snes','md'].includes(system))throw new Error('対応機種はGBA・GB/GBC・FC・SFC・MDです。');
 if(expectedSystem&&!skinSupportsSystem(system,expectedSystem))throw new Error('このゲーム用のスキンではありません。');
 const source=info.representations?.iphone||info.representations?.iPhone||info.representations?.ipad||info.representations?.iPad;
 const traits=source?.edgeToEdge||source?.standard||source,used=new Set(),representations={};
 const asset=name=>{if(typeof name!=='string'||!files.has(prefix+name)||name.includes('..'))throw new Error('スキン内の画像が見つかりません。');used.add(name);return name;};
 for(const orientation of ['portrait','landscape']){
  const r=traits?.[orientation];if(!r)continue;
  const mappingSize={width:number(r.mappingSize?.width,64,4096),height:number(r.mappingSize?.height,64,4096)};
  let frame=r.gameScreenFrame;if(r.screens){if(r.screens.length!==1||r.screens[0].filters?.length)throw new Error('複数画面や特殊フィルターを使うスキンには対応していません。');frame=r.screens[0].outputFrame;const crop=r.screens[0].inputFrame;if(crop&&(crop.x||crop.y||crop.width!==({gba:240,gb:160,gbc:160,nes:256,snes:256,md:320}[system])||crop.height!==({gba:160,gb:144,gbc:144,nes:240,snes:224,md:224}[system])))throw new Error('画面を切り抜くスキンには対応していません。');}
  const assets={resizable:asset(r.assets?.resizable||r.assets?.large||r.assets?.medium||r.assets?.small)};
  if(!Array.isArray(r.items)||r.items.length>80)throw new Error('ボタンの設定がないか、数が多すぎます。');
  const items=r.items.map(item=>{let inputs=item.inputs;if(Array.isArray(inputs)){if(!inputs.length||inputs.some(k=>!controls.has(k)))throw new Error('未対応のボタン操作が含まれています。');}else{if(!inputs||Object.keys(inputs).some(k=>!['up','down','left','right'].includes(k))||Object.values(inputs).some(k=>!controls.has(k)))throw new Error('対応していない方向キーの設定です。');inputs={...inputs};}return {inputs,frame:rect(item.frame),asset:item.asset?.normal?{normal:asset(item.asset.normal)}:undefined};});
  representations[orientation]={mappingSize,assets,items,screens:[{outputFrame:rect(frame)}]};
 }
 if(!Object.keys(representations).length)throw new Error('対応する縦画面・横画面の設定が見つかりません。');
 if(used.size>24)throw new Error('スキンの画像数が多すぎます。');const images={};let imageBytes=0;
 for(const name of used){images[name]=await renderImage(files.get(prefix+name),name);if((imageBytes+=images[name].size)>32*1024*1024)throw new Error('変換後のスキンが大きすぎます。');}
 const record={id:'skin:'+await hash(new Uint8Array(buffer)),name:String(info.name||file.name).slice(0,120),system,images,...representations,importedAt:Date.now()};
 await db.put('skins',record.id,record);return record;
}
