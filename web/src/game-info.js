/* Port of ManicEMU GameInfoView, GameInfoNavigationView and GameInfoDetailView.
   Copyright © 2026 Manic EMU. Original views by Daiuno.
   Modified for Web 2026-10-08. See sources/manicemu-ui/README.md. */
// SPDX-License-Identifier: AGPL-3.0-or-later
import {guardUpdateTask} from './update-activity.js';
import {systems,escapeHTML as esc,icon,bytesLabel} from './shared.js';
import {coreRegistry,coreFor,saveKey,supportsGame} from './core-registry.js';
import * as db from './storage.js';
import {gameInfoHero,groupedOptions,nativeAction,orderedOptionGroups,gameShortcuts} from './manic-ui.js';
import {createCoverDialog} from './cover-dialog.js';

export function createGameInfo(api){
 const coverDialog=createCoverDialog({...api,showGame:show});
 const $=s=>document.querySelector(s);
 const nativeSheet=(title,html)=>{api.sheet(title,html);$('#sheet').classList.add('native-menu');};
 const bind=handlers=>$('#sheet-body').querySelectorAll('[data-action]').forEach(b=>b.onclick=guardUpdateTask(()=>Promise.resolve().then(()=>handlers[b.dataset.action]?.()).catch(api.error)));
 async function update(game,changes){const fresh=await db.get('library',game.id);if(!fresh)throw Error('ゲームが見つかりません。');Object.assign(game,fresh,changes);await db.put('library',game.id,game);await api.refresh();}
 function info(game){
  nativeSheet('ゲーム情報',`<div class="settings-group">${nativeAction('ゲーム機','', 'game',systems[game.system].name)}${nativeAction('コア','','core',coreFor(game).name)}${nativeAction('ROM容量','','folder',bytesLabel(game.size))}</div><p class="sheet-note">ROM・セーブはこのブラウザ内に保存されます。操作・映像の設定は全ゲームで共通です。</p><p class="sheet-note"><a href="licenses.html">クレジット・ライセンス・対応ソース</a></p><button class="secondary wide-button" data-action="back">ゲーム詳細に戻る</button>`);
  bind({back:()=>show(game)});
 }
 function rename(game){
  nativeSheet('名前を変更',`<input class="text-input" id="new-name" value="${esc(game.name)}" maxlength="120" aria-label="ゲーム名"><div class="sheet-actions"><button class="secondary" data-action="back">キャンセル</button><button class="primary" id="save-name">保存</button></div>`);
  bind({back:()=>show(game)});$('#save-name').onclick=async()=>{try{const name=$('#new-name').value.trim();if(!name)return;await update(game,{name});show(game);}catch(e){api.error(e);}};
 }
 function remove(game){
  nativeSheet('ゲームを削除',`<p class="sheet-note">「${esc(game.name)}」と、このブラウザ内のセーブ・ステートを削除します。端末の元ファイルは残ります。</p><div class="sheet-actions"><button class="secondary" data-action="back">キャンセル</button><button class="secondary danger" id="confirm-delete">削除する</button></div>`);
  bind({back:()=>show(game)});$('#confirm-delete').onclick=async()=>{try{await db.removeGame(game.id);api.closeSheet();await api.refresh();}catch(e){api.error(e);}};
 }
 function safeMode(game){
  nativeSheet('セーフモード',`<p class="sheet-note">チートを無効にし、自動ステートを復旧せず、ゲーム内セーブから起動します。設定や保存データは保持されます。</p><div class="sheet-actions"><button class="secondary" data-action="back">キャンセル</button><button class="primary" data-action="start">プレイ</button></div>`);
  bind({back:()=>show(game),start:()=>{api.closeSheet();return api.launch(game,{safeMode:true});}});
 }
 async function exportSave(game){const record=await db.get('saves',saveKey(game));if(!record?.bytes?.length)throw Error('保存されたゲーム内セーブがありません。');api.download(record.bytes,game.name+'.'+coreFor(game).saveExtension);}
 function chooseCore(game){
  const selected=coreFor(game);
  nativeSheet('コアを変更',`<div class="settings-group">${coreRegistry[game.system].map(core=>`<button class="row native-row" data-core="${core.key}" ${supportsGame(core,game)?'':'disabled'}>${icon('core')}<span class="native-label">${esc(core.name)}${supportsGame(core,game)?'':`<small>このROM容量には未対応</small>`}</span>${selected.key===core.key?icon('check'):''}</button>`).join('')}</div><p class="sheet-note">セーブとステートはコアごとに保存します。元のコアに戻すと、以前の続きから遊べます。</p><button class="secondary wide-button" data-action="back">戻る</button>`);
  bind({back:()=>show(game)});
  $('#sheet-body').querySelectorAll('[data-core]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{const updated=await db.setGameCore(game.id,button.dataset.core);Object.assign(game,updated);await api.refresh();show(game);}catch(e){button.disabled=false;api.error(e);}});
 }
 async function copyLink(game){const url=new URL(location.href);url.search='';url.hash='game='+game.id;await navigator.clipboard.writeText(url.href);api.toast('このブラウザで開ける起動リンクをコピーしました。');}
 function more(game){nativeSheet(game.name,`<div class="settings-group">${nativeAction(game.favorite?'お気に入りから外す':'お気に入りに追加','favorite','starCircle')}${nativeAction('ゲーム情報','info','info')}${nativeAction('名前を変更','rename','pencil')}</div><button class="secondary wide-button" data-action="back">戻る</button>`);bind({favorite:async()=>{await update(game,{favorite:!game.favorite});show(game);},info:()=>info(game),rename:()=>rename(game),back:()=>show(game)});}
 function sortOptions(game,cells){
  const groups=orderedOptionGroups(api.settings().menuOrder),label=id=>{const element=document.createElement('div');element.innerHTML=cells[id]||'';return element.querySelector('.native-label')?.textContent||id;};
  nativeSheet('機能順序設定',`<p class="sheet-note">グループ内の表示順を変更します。プレイ中のメニューにも反映されます。</p>${groups.map((group,g)=>{const ids=group.filter(id=>cells[id]);return ids.length?`<div class="settings-group">${ids.map((id,i)=>`<div class="option-reorder"><span>${esc(label(id))}</span><button data-move="-1" data-group="${g}" data-option="${id}" aria-label="${esc(label(id))}を上へ" ${i===0?'disabled':''}>↑</button><button data-move="1" data-group="${g}" data-option="${id}" aria-label="${esc(label(id))}を下へ" ${i===ids.length-1?'disabled':''}>↓</button></div>`).join('')}</div>`:'';}).join('')}<div class="sheet-actions"><button class="secondary" data-action="reset">標準に戻す</button><button class="primary" data-action="back">完了</button></div>`);
  $('#sheet-body').querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const group=groups[Number(b.dataset.group)],ids=group.filter(id=>cells[id]),at=ids.indexOf(b.dataset.option),other=ids[at+Number(b.dataset.move)];if(!other)return;const a=group.indexOf(b.dataset.option),z=group.indexOf(other);[group[a],group[z]]=[group[z],group[a]];api.settings().menuOrder=groups;api.saveSettings();sortOptions(game,cells);});
  bind({reset:()=>{delete api.settings().menuOrder;api.saveSettings();sortOptions(game,cells);},back:()=>show(game)});
 }
 function shortcuts(game){
  const selected=api.settings().gameShortcuts||gameShortcuts.map(([id])=>id);
  nativeSheet('ゲームショートカット',`<p class="sheet-note">プレイ中のメニュー上部に表示する操作を選びます。</p><div class="settings-group">${gameShortcuts.map(([id,label,ic])=>`<label class="row native-row">${icon(ic)}<span class="native-label">${label}</span><input type="checkbox" data-shortcut-choice="${id}" ${selected.includes(id)?'checked':''}></label>`).join('')}</div><button class="primary wide-button" data-action="back">完了</button>`);
  $('#sheet-body').querySelectorAll('[data-shortcut-choice]').forEach(b=>b.onchange=()=>{api.settings().gameShortcuts=[...$('#sheet-body').querySelectorAll('[data-shortcut-choice]:checked')].map(el=>el.dataset.shortcutChoice);api.saveSettings();});bind({back:()=>show(game)});
 }
 function show(game){
  const cells={
   cover:nativeAction('カバー変更','cover','image'),skins:nativeAction('スキン設定','gameSkin','shirt'),
   stateList:nativeAction('セーブステートを確認','states','state'),importSave:nativeAction('セーブデータをインポート','importSave','saveImport'),shareSave:nativeAction('セーブデータをエクスポート','exportSaved','saveExport'),
   cheatCode:coreFor(game).cheats?nativeAction('チートコード','cheats','code'):'',
   switchCore:nativeAction('コアを変更','switchCore','core',coreFor(game).name),
   ...api.controlCells(game),gameOptionSort:nativeAction('機能順序設定','optionOrder','layers'),gameShortcut:nativeAction('ゲームショートカット','shortcuts','shortcuts'),
   copyLink:nativeAction('起動リンクをコピー','copyLink','link'),delete:nativeAction('ゲームを削除','delete','trash','','danger')
  };
  api.sheet(game.name,gameInfoHero(game)+`<div class="native-options" aria-label="ゲームの設定">${groupedOptions(cells,api.settings().menuOrder)}</div>`);
  $('#sheet').classList.add('native-menu','game-info');$('#sheet-cover').src=game.cover||'assets/controller.svg';$('#sheet-cover').hidden=false;
  $('#sheet-tools').innerHTML=`<button class="sheet-tool" id="game-info-button" aria-label="ゲーム情報">${icon('info')}</button><button class="sheet-tool" id="game-more-button" aria-label="その他の操作">${icon('more')}</button>`;
  $('#game-info-button').onclick=()=>info(game);$('#game-more-button').onclick=()=>more(game);
  api.bindSettings($('#sheet-body'));
  bind({switchCore:()=>chooseCore(game),play:()=>{api.closeSheet();return api.launch(game);},safeMode:()=>safeMode(game),rename:()=>rename(game),cover:()=>coverDialog.open(game),gameSkin:()=>api.showSkins(game.system,game),states:()=>api.showStates(game),importSave:()=>api.importSave(game),exportSaved:()=>exportSave(game),cheats:()=>api.showCheats(game),controllers:api.showControllers,optionOrder:()=>sortOptions(game,cells),shortcuts:()=>shortcuts(game),copyLink:()=>copyLink(game),delete:()=>remove(game)});
 }
 return {show};
}
