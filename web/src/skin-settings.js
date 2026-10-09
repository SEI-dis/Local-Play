/* SkinSettingsView / FlexSkinSettingViewController Web port.
   Copyright © 2025–2026 Manic EMU. Created by Daiuno. Modified 2026-10-09.
   See sources/manicemu-ui/README.md. */
// SPDX-License-Identifier: AGPL-3.0-or-later
import * as db from './storage.js';
import {systems,escapeHTML as esc} from './shared.js';
import {row} from './ui.js';
import {builtins,loadSkin,importSkin,previewSkin,skinSupportsSystem} from './skins.js';
import {builtinLayout} from './skin-art.js';
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
async function showSkins(system='gba',game=null){
 if(game){const record=await db.get('library',game.id);if(!record)throw new Error('ゲームが見つかりません。');game.skinId=record.skinId;game.controlLayout=record.controlLayout;system=game.system;}
 const saved=(await db.all('skins')).filter(s=>skinSupportsSystem(s.system,system));
 const choices=[...builtins.map(([id,name])=>({id:'builtin:'+id,name})),...saved];
 const shared=choices.some(s=>s.id===settings.skins?.[system])?settings.skins[system]:'builtin:classic';
 const selected=game?(choices.some(s=>s.id===game.skinId)?game.skinId:''):shared,effective=selected||shared;
 const syncCurrent=async()=>{if(runtime.current){runtime.current.skinId=(await db.get('library',runtime.current.id))?.skinId;runtime.skinData=await loadSkin(runtime.current.system,runtime.current.skinId||settings.skins?.[runtime.current.system],settings.skins?.[runtime.current.system]);layoutSkin();}};

 sheet('スキン',`${game?`<p class="sheet-note skin-target">${esc(game.name)} の設定</p>`:'<p class="sheet-note">機種ごとの共通設定です。ゲーム別の指定がある場合は、そちらを優先します。</p>'}<div class="settings-group">${game?row('機種',`<span class="value">${systems[system].short}</span>`,'game'):row('機種',`<select id="skin-system">${Object.entries(systems).map(([k,s])=>`<option value="${k}" ${k===system?'selected':''}>${s.short}</option>`).join('')}</select>`,'game')}${row('スキン',`<select id="skin-select">${game?`<option value="" ${!selected?'selected':''}>機種の設定を使う</option>`:''}${choices.map(s=>`<option value="${esc(s.id)}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>`,'image')}</div><div class="segmented skin-orientation" role="group" aria-label="プレビューの向き"><button data-skin-orientation="portrait">縦</button><button data-skin-orientation="landscape">横</button></div><div id="skin-preview" role="img" aria-label="スキンのプレビュー"></div><p class="sheet-note" id="skin-description" hidden></p><div id="skin-colors" aria-label="標準スキンの色">${builtins.map(([id,name])=>`<button data-skin-color="${id}" aria-label="${name}" aria-pressed="${effective==='builtin:'+id}" title="${name}"><i class="swatch-${id}"></i></button>`).join('')}</div>${effective.startsWith('builtin:')?'<button class="secondary" id="edit-controls">画面・ボタンのレイアウト</button>':'<p class="sheet-note">配置の編集は標準スキンで使えます。</p>'}<button class="primary" id="import-skin">スキンファイルを追加</button>${selected.startsWith('skin:')?'<button class="secondary danger" id="delete-skin">このスキンを削除</button>':''}<p class="sheet-note">Delta／Manic形式に対応しています。スキンは端末内だけで使用します。作者の利用条件をご確認ください。</p><details class="sheet-note"><summary>対応するスキン</summary>PNG・JPEG・WebP・PDFを使った1画面のスキンに対応しています。複数画面や特殊フィルターには対応していません。</details><a class="row" href="https://faq.deltaemulator.com/using-delta/controller-skins" target="_blank" rel="noopener">Delta公式のスキン案内</a>`,!!runtime.engine);
 if($('#edit-controls'))$('#edit-controls').onclick=()=>editControls(system,game,effective).catch(error);
 if($('#skin-system'))$('#skin-system').onchange=e=>showSkins(e.target.value);
 const apply=async(id,targetSystem=system)=>{
  if(game){await db.setGameSkin(game.id,id);game.skinId=id||undefined;}
  else{settings.skins={...settings.skins,[targetSystem]:id};applySettings();}
  await syncCurrent();await refresh();
 };
 const choose=async id=>{const controls=$$('#sheet-body button,#sheet-body select');controls.forEach(b=>b.disabled=true);try{await apply(id);await showSkins(system,game);}catch(e){error(e);controls.forEach(b=>{if(b.isConnected)b.disabled=false;});}};
 $('#skin-select').onchange=e=>choose(e.target.value);
 $$('[data-skin-color]').forEach(b=>b.onclick=()=>choose('builtin:'+b.dataset.skinColor));
 const host=$('#skin-preview'),preview=await previewSkin(system,effective);
 if(!host.isConnected){preview.urls.forEach(URL.revokeObjectURL);return;}
 $('#skin-description').textContent=preview.skin.description||'';$('#skin-description').hidden=!preview.skin.description;
 runtime.cleanup=()=>preview.urls.forEach(URL.revokeObjectURL);
 const drawPreview=()=>{
  const skin=preview.skin,wide=skinOrientation==='landscape',size=playerSize(),short=Math.min(size.width,size.height),long=Math.max(size.width,size.height);
  const rep=skin.id.startsWith('builtin:')?builtinLayout(skin,wide?long:short,wide?short:long,controlLayout(system,game)[skinOrientation]):skin[skinOrientation]||skin.portrait||skin.landscape;
  const map=rep.mappingSize,scale=Math.min(host.clientWidth/map.width,240/map.height);
  host.innerHTML=`<div class="skin-mini" style='width:${map.width*scale}px;height:${map.height*scale}px;background-image:url("${skin.images[rep.assets.resizable]}")'>${rep.screens.map(s=>`<div class="skin-mini-screen" style="${frameStyle(s.outputFrame,map)}"><span>${s.label||'LOCAL PLAY'}</span></div>`).join('')}${rep.items.map(item=>`<span class="skin-mini-button" style='${frameStyle(item.frame,map)}opacity:${item.opacity??1};background-image:url("${skin.images[item.asset?.normal]||''}")'></span>`).join('')}${(rep.actions||[]).map(a=>`<span class="skin-mini-tool" data-control="${a.id}" style="${frameStyle(a.frame,map)}opacity:${a.opacity??1};font-size:${Math.max(3,11*scale)}px">${a.label}</span>`).join('')}</div>`;
  host.setAttribute('aria-label',`${skin.name}・${wide?'横':'縦'}画面のプレビュー`);
  $$('[data-skin-orientation]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.skinOrientation===skinOrientation));
 };
 $$('[data-skin-orientation]').forEach(b=>b.onclick=()=>{skinOrientation=b.dataset.skinOrientation;drawPreview();});
 const observer=new ResizeObserver(drawPreview);observer.observe(host);window.addEventListener('resize',drawPreview);runtime.cleanup=()=>{observer.disconnect();window.removeEventListener('resize',drawPreview);preview.urls.forEach(URL.revokeObjectURL);};drawPreview();

 $('#import-skin').onclick=()=>{$('#skin-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{toast('スキンを読み込み中…');const skin=await importSkin(file,game?.system);await apply(skin.id,skin.system);await showSkins(game?.system||skin.system,game);toast('スキンを追加しました。');}catch(e){error(e);}finally{e.target.value='';}};$('#skin-input').click();};
 if($('#delete-skin'))$('#delete-skin').onclick=()=>{
  sheet('スキンを削除しますか？','<p class="sheet-note">このスキンを使っているゲームは、機種の設定に戻ります。ゲームやセーブは残ります。</p><div class="sheet-actions"><button class="secondary" id="cancel-skin-delete">キャンセル</button><button class="secondary danger" id="confirm-skin-delete">削除</button></div>',!!runtime.engine);
  $('#cancel-skin-delete').onclick=()=>showSkins(system,game);
  $('#confirm-skin-delete').onclick=async()=>{const button=$('#confirm-skin-delete');button.disabled=true;try{await db.removeSkin(selected);for(const k of Object.keys(settings.skins||{}))if(settings.skins[k]===selected)delete settings.skins[k];applySettings();await syncCurrent();await refresh();await showSkins(system,game);}catch(e){error(e);button.disabled=false;}};
 };

}
 return {showSkins};
}
