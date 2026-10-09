/* SkinSettingsView / FlexSkinSettingViewController Web port.
   Copyright © 2025–2026 Manic EMU. Created by Daiuno. Modified 2026-10-09.
   See sources/manicemu-ui/README.md. */
// SPDX-License-Identifier: AGPL-3.0-or-later
import {guardUpdateTask} from './update-activity.js';
import * as db from './storage.js';
import {systems,escapeHTML as esc,icon} from './shared.js';
import {row} from './ui.js';
import {builtins,loadSkin,importSkin,previewSkin,skinSupportsSystem} from './skins.js';
import {mountSkinPreview} from './skin-preview.js';
import {mountControlEditor} from './control-editor.js';
export function createSkinSettings(api){
 const {runtime,settings,setPause,sheet,applySettings,layoutSkin,refresh,toast,error,controlLayout,playerSize,frameStyle}=api;
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 let skinOrientation='portrait';
async function editControls(system,game,id){
 if(runtime.engine)setPause(true);
 const preview=await previewSkin(system,id);
 if(!preview.skin.id.startsWith('builtin:')){preview.urls.forEach(URL.revokeObjectURL);return;}
 sheet('レイアウトを編集','',!!runtime.engine);$('#sheet').classList.add('control-edit');
 const cleanup=mountControlEditor($('#sheet-body'),{skin:preview.skin,layout:controlLayout(system,game),shared:settings.controlLayouts?.[system],inherits:game?.controlLayout==null,game:!!game,orientation:skinOrientation,viewport:playerSize,
  onCancel:()=>showSkins(system,game),
  onSave:async layout=>{
   if(game){await db.setGameControls(game.id,layout);game.controlLayout=layout??undefined;}
   else{const next={...settings,controlLayouts:{...settings.controlLayouts,[system]:layout}};localStorage.setItem('manic-settings',JSON.stringify(next));Object.assign(settings,next);}
   if(runtime.current){runtime.current.controlLayout=(await db.get('library',runtime.current.id))?.controlLayout;layoutSkin();}
   await refresh();await showSkins(system,game);toast('レイアウトを保存しました。');
  }
 });
 runtime.cleanup=()=>{cleanup();$('#sheet').classList.remove('control-edit');preview.urls.forEach(URL.revokeObjectURL);};
}
async function showSkins(system=settings.skinSystem||'gba',game=null){
 if(!systems[system])system='gba';
 if(game){const record=await db.get('library',game.id);if(!record)throw new Error('ゲームが見つかりません。');game.skinId=record.skinId;game.controlLayout=record.controlLayout;system=game.system;}
 else if(settings.skinSystem!==system){settings.skinSystem=system;applySettings();}
 const saved=(await db.skinCatalog()).filter(s=>skinSupportsSystem(s.system,system)).sort((a,b)=>(a.importedAt||0)-(b.importedAt||0)||a.name.localeCompare(b.name));
 const choices=[...builtins.map(([id,name])=>({id:'builtin:'+id,name})),...saved];
 const shared=choices.some(s=>s.id===settings.skins?.[system])?settings.skins[system]:'builtin:classic';
 let selected=game?(choices.some(s=>s.id===game.skinId)?game.skinId:''):shared,effective=selected||shared;
 let standardId=effective.startsWith('builtin:')?effective:shared.startsWith('builtin:')?shared:'builtin:classic',editing=false,alive=true,busy=false;
 const mounted=new Map(),pending=new Set(),zoomCleanups=new Set();
 const syncCurrent=async()=>{if(runtime.current){runtime.current.skinId=(await db.get('library',runtime.current.id))?.skinId;runtime.skinData=await loadSkin(runtime.current.system,runtime.current.skinId||settings.skins?.[runtime.current.system],settings.skins?.[runtime.current.system]);layoutSkin();}};
 const card=(id,name)=>`<article class="skin-card" data-skin-card="${esc(id)}"><button class="skin-use" data-skin-choice="${esc(id)}" aria-label="${esc(name)}を使う" aria-pressed="false"><span class="skin-card-preview" role="img"></span><span class="skin-current" aria-hidden="true"></span></button><button class="skin-preview-open" data-preview-skin="${esc(id)}" aria-label="${esc(name)}をプレビュー">${icon('expand')}<span>プレビュー</span></button><p class="skin-card-name">${esc(name)}</p>${id.startsWith('skin:')?`<button class="skin-delete danger" data-delete-skin="${esc(id)}" aria-label="${esc(name)}を削除" hidden>${icon('trash')}<span>削除</span></button>`:''}</article>`;
 sheet('スキン',`${game?`<p class="sheet-note skin-target">${esc(game.name)}</p><label class="row skin-inherit"><span>機種の設定を使う</span><input type="checkbox" id="skin-inherit" ${!selected?'checked':''}></label>`:`<div class="settings-group">${row('機種',`<select id="skin-system">${Object.entries(systems).map(([k,s])=>`<option value="${k}" ${k===system?'selected':''}>${s.short}</option>`).join('')}</select>`,'game')}</div>`}<div class="segmented skin-orientation" role="group" aria-label="プレビューの向き"><button data-skin-orientation="portrait">縦画面</button><button data-skin-orientation="landscape">横画面</button></div><div id="skin-grid" class="skin-grid">${card(standardId,'標準')}${saved.map(s=>card(s.id,s.name)).join('')}<button id="import-skin" class="skin-add">${icon('plus')}<span>新規スキン追加</span></button></div><div class="skin-standard-options"><p class="label">標準スキンの色</p><div id="skin-colors" aria-label="標準スキンの色">${builtins.map(([id,name])=>`<button data-skin-color="${id}" aria-label="${name}" title="${name}"><i class="swatch-${id}"></i></button>`).join('')}</div><button class="secondary" id="edit-controls">画面・ボタンのレイアウト</button></div><details class="sheet-note skin-help"><summary>スキンについて</summary><p id="skin-description"></p><p>選んだスキンを縦・横の両方で使います。追加済みのスキンは、別のスキンに切り替えても残ります。</p><p>Delta／Manic形式に対応しています。スキンは端末内だけで使用します。作者の利用条件をご確認ください。</p><a class="row" href="https://faq.deltaemulator.com/using-delta/controller-skins" target="_blank" rel="noopener">Delta公式のスキン案内</a><a class="row" href="https://manicemu.site/guides/homemade-skins/#-official-skins-downloads" target="_blank" rel="noopener">Manic公式のスキン案内</a></details>`,!!runtime.engine);
 const grid=$('#skin-grid'),standard=grid.firstElementChild;
 $('#sheet').classList.add('skin-manager');
 $('#sheet-tools').innerHTML=`<button class="sheet-tool skin-edit-toggle" id="manage-skins" ${saved.length?'':'disabled'}>編集</button>`;
 const previewOptions=()=>({system,orientation:skinOrientation,viewport:playerSize,layout:controlLayout(system,game),frameStyle});
 function disposeCard(node){const entry=mounted.get(node);if(entry){entry.cleanup();entry.preview.urls.forEach(URL.revokeObjectURL);mounted.delete(node);}node.querySelector('.skin-card-preview').replaceChildren();}
 async function mountCard(node){
  if(!alive||mounted.has(node)||pending.has(node))return;
  const id=node.dataset.skinCard;pending.add(node);let preview;
  try{
   preview=await previewSkin(system,id);
   if(!alive||!node.isConnected||node.dataset.skinCard!==id){preview.urls.forEach(URL.revokeObjectURL);return;}
   const host=node.querySelector('.skin-card-preview'),entry={preview,cleanup:mountSkinPreview(host,preview.skin,previewOptions())};mounted.set(node,entry);
   if(id===effective)$('#skin-description').textContent=[preview.skin.description,...(preview.skin.warnings||[])].filter(Boolean).join('\n');
  }catch(e){preview?.urls.forEach(URL.revokeObjectURL);if(alive){const host=node.querySelector('.skin-card-preview');host.textContent='プレビューを表示できません';host.setAttribute('aria-label','プレビューを表示できません');}}
  finally{pending.delete(node);if(alive&&node.dataset.skinCard!==id)mountCard(node);}
 }
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)mountCard(entry.target);else disposeCard(entry.target);}},{root:$('#sheet'),rootMargin:'120px'});
 grid.querySelectorAll('.skin-card').forEach(node=>observer.observe(node));
 function updateSelection(){
  grid.dataset.selection=selected;grid.dataset.effective=effective;
  grid.querySelectorAll('.skin-card').forEach(node=>{const active=node.dataset.skinCard===effective;node.classList.toggle('is-current',active);node.querySelector('.skin-use').setAttribute('aria-pressed',String(active));const host=node.querySelector('.skin-card-preview');if(active)host.id='skin-preview';else host.removeAttribute('id');});
  $$('[data-skin-color]').forEach(b=>b.setAttribute('aria-pressed',String(effective==='builtin:'+b.dataset.skinColor)));
  if($('#skin-inherit'))$('#skin-inherit').checked=!selected;
  $('#edit-controls').hidden=!effective.startsWith('builtin:');
  const entry=[...mounted.entries()].find(([node])=>node.dataset.skinCard===effective)?.[1];
  $('#skin-description').textContent=entry?[entry.preview.skin.description,...(entry.preview.skin.warnings||[])].filter(Boolean).join('\n'):'';
 }
 function refreshOrientation(){
  $$('[data-skin-orientation]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skinOrientation===skinOrientation)));
  grid.dataset.orientation=skinOrientation;
  for(const [node,entry] of mounted){entry.cleanup();entry.cleanup=mountSkinPreview(node.querySelector('.skin-card-preview'),entry.preview.skin,previewOptions());}
 }
 function enableControls(){
  if(!alive)return;
  grid.querySelectorAll('.skin-use,.skin-preview-open').forEach(b=>b.disabled=busy||editing);
  $$('[data-skin-color],#skin-inherit,#edit-controls,[data-skin-orientation]').forEach(b=>b.disabled=busy||editing);
  $('#manage-skins').disabled=busy||!saved.length;$('#import-skin').disabled=busy;
 }
 const apply=async(id,targetSystem=system)=>{
  if(game){await db.setGameSkin(game.id,id);game.skinId=id||undefined;}
  else{const next={...settings,skins:{...settings.skins,[targetSystem]:id}};localStorage.setItem('manic-settings',JSON.stringify(next));Object.assign(settings,next);applySettings();}
  await syncCurrent();await refresh();
 };
 const choose=async id=>{
  if(busy||editing)return;busy=true;enableControls();
  try{
   await apply(id);selected=id;effective=id||shared;
   if(effective.startsWith('builtin:')&&effective!==standardId){
    standardId=effective;disposeCard(standard);standard.dataset.skinCard=standardId;standard.querySelector('.skin-use').dataset.skinChoice=standardId;standard.querySelector('[data-preview-skin]').dataset.previewSkin=standardId;await mountCard(standard);
   }
   if(alive)updateSelection();
  }catch(e){error(e);}finally{busy=false;enableControls();}
 };
 grid.querySelectorAll('[data-skin-choice]').forEach(b=>b.onclick=guardUpdateTask(()=>choose(b.dataset.skinChoice)));
 $$('[data-skin-color]').forEach(b=>b.onclick=guardUpdateTask(()=>choose('builtin:'+b.dataset.skinColor)));
 if($('#skin-inherit'))$('#skin-inherit').onchange=guardUpdateTask(e=>choose(e.target.checked?'':effective));
 if($('#skin-system'))$('#skin-system').onchange=guardUpdateTask(e=>showSkins(e.target.value).catch(error));
 $('#edit-controls').onclick=()=>editControls(system,game,effective).catch(error);
 $$('[data-skin-orientation]').forEach(b=>b.onclick=()=>{skinOrientation=b.dataset.skinOrientation;refreshOrientation();});
 $('#manage-skins').onclick=()=>{editing=!editing;grid.classList.toggle('is-editing',editing);$('#manage-skins').textContent=editing?'完了':'編集';grid.querySelectorAll('[data-delete-skin]').forEach(b=>b.hidden=!editing);$('#import-skin').hidden=editing;enableControls();};
 async function openPreview(id){
  const preview=await previewSkin(system,id);if(!alive){preview.urls.forEach(URL.revokeObjectURL);return;}
  const zoom=document.createElement('dialog');zoom.className='skin-zoom';zoom.setAttribute('aria-label',preview.skin.name+'のプレビュー');
  zoom.innerHTML=`<header><h2>${esc(preview.skin.name)}</h2><button class="circle" aria-label="プレビューを閉じる">${icon('close')}</button></header><div class="skin-zoom-art" role="img"></div>`;
  document.body.append(zoom);zoom.showModal();const unmount=mountSkinPreview(zoom.querySelector('.skin-zoom-art'),preview.skin,previewOptions());
  let closed=false;const close=()=>{if(closed)return;closed=true;unmount();preview.urls.forEach(URL.revokeObjectURL);zoom.close();zoom.remove();zoomCleanups.delete(close);};zoomCleanups.add(close);zoom.querySelector('button').onclick=close;zoom.addEventListener('cancel',e=>{e.preventDefault();close();});
 }
 grid.querySelectorAll('[data-preview-skin]').forEach(b=>b.onclick=()=>openPreview(b.dataset.previewSkin).catch(error));
 $('#import-skin').onclick=()=>{$('#skin-input').onchange=guardUpdateTask(async e=>{const file=e.target.files[0];if(!file)return;try{toast('スキンを読み込み中…');const skin=await importSkin(file,game?.system);await apply(skin.id,skin.system);await showSkins(game?.system||skin.system,game);toast('スキンを追加しました。');}catch(e){error(e);}finally{e.target.value='';}});$('#skin-input').click();};
 grid.querySelectorAll('[data-delete-skin]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.deleteSkin,skin=saved.find(s=>s.id===id);
  sheet('スキンを削除しますか？',`<p class="sheet-note">${esc(skin.name)}</p><p class="sheet-note">このスキンを使っているゲームは、機種の設定に戻ります。ゲームやセーブは残ります。</p><div class="sheet-actions"><button class="secondary" id="cancel-skin-delete">キャンセル</button><button class="secondary danger" id="confirm-skin-delete">削除</button></div>`,!!runtime.engine);
  $('#cancel-skin-delete').onclick=()=>showSkins(system,game);
  $('#confirm-skin-delete').onclick=guardUpdateTask(async()=>{const button=$('#confirm-skin-delete');button.disabled=true;try{await db.removeSkin(id);for(const k of Object.keys(settings.skins||{}))if(settings.skins[k]===id)delete settings.skins[k];applySettings();await syncCurrent();await refresh();await showSkins(system,game);}catch(e){error(e);if(button.isConnected)button.disabled=false;}});
 });
 runtime.cleanup=()=>{alive=false;observer.disconnect();for(const close of [...zoomCleanups])close();for(const node of [...mounted.keys()])disposeCard(node);$('#sheet').classList.remove('skin-manager');};
 updateSelection();refreshOrientation();enableControls();await mountCard(standard);
}
 return {showSkins};
}
