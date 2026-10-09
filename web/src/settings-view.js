// SettingsListView / SettingItem port: Daiuno, Copyright 2025 Manic EMU.
// SPDX-License-Identifier: AGPL-3.0-or-later
import {row,action,detail,settingsGroup,switchControl} from './ui.js';
import {escapeHTML as esc,icon,bytesLabel} from './shared.js';
import {supportsHaptics,hapticNote} from './haptics.js';
import {videoFilters} from './video.js';
export function videoFilterNote(filter){return `<p class="sheet-note" id="video-filter-note" ${filter==='edge4x'?'':'hidden'}>輪郭補正4倍は、元の色を保ちながら斜めの線や角を細かく整えます。処理負荷が増えるため、動作が重い場合は2倍やピクセルに戻してください。</p>`;}
export function createSettingsView(api){
 const {settings,applySettings,bindSettings,bindActions,sheet,showSkins,showOffline}=api;
 const $=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
// SettingsListView / SettingItem port: Daiuno, Copyright 2025 Manic EMU, AGPL-3.0-or-later.
function renderSettings(){
 const appearance=`<div class="appearance-control" role="group" aria-label="外観">${
  [['dark','ダーク'],['light','ライト'],['auto','自動']].map(([value,label])=>
   `<button data-theme-choice="${value}" aria-pressed="${settings.theme===value}">${label}</button>`).join('')
 }</div>`;
 const general=settingsGroup('一般',[
  row('外観',appearance,'image'),
  detail('自動ステート保存','約20秒ごとに保存（直近5回分）',switchControl('recovery',settings.recovery),'save'),
  action('スキン','skins','game')
 ]);
 const advanced=settingsGroup('詳細',[
  action('コントローラー・キーボード','controllers','game'),
  action('映像とフレームレート','video','image'),
  action('音量と速度','audio','volume'),
  detail('タッチの振動',hapticNote(),switchControl('haptics',supportsHaptics()&&settings.haptics,{disabled:!supportsHaptics()}),'game'),
  action('セーブと保存容量','storage','save'),
  action('まとめてバックアップ','backup','save')
 ]);
 const support=settingsGroup('サポート',[
  action('オフラインで使う','offline','import'),
  action('保存・復旧の使い方','saveHelp','save'),
  action('クラッシュ診断','diagnostics','info')
 ]);
 const links=settingsGroup('その他',[
  ['update.html','アプリの更新','import'],
  ['privacy.html','プライバシーと利用条件','folder'],
  ['licenses.html','クレジット・ライセンス','folder']
 ].map(([href,label,ic])=>`<a class="row" href="${href}">${icon(ic)}<span>${label}</span>${icon('chevron')}</a>`));
 // Describe the loaded distribution, including while offline or an update waits.
 const version=$('meta[name=app-version]').content,build=$('meta[name=app-build]').content;
 $('#content').innerHTML=`<div class="page settings-page"><h1>設定</h1><p class="sheet-note">ゲームで変更した項目には、そのゲームの個別設定を使います。</p>${general}${advanced}${support}${links}<p class="settings-footer" title="ビルド ${esc(build)}">PalmoEMU · ${esc(version)} (${esc(build.slice(0,8))})</p></div>`;
 bindSettings($('#content'));bindActions($('#content'),{controllers:showControllers,skins:()=>showSkins(),storage:showStorage,offline:showOffline,video:showVideoSettings,audio:showAudioSettings,saveHelp:showSaveHelp,diagnostics:api.showDiagnostics,backup:api.showBackup});
 $$('[data-theme-choice]').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.themeChoice;applySettings();renderSettings();});
}
function showVideoSettings(){sheet('映像とフレームレート',`<div class="settings-group">${row('映像フィルター',`<select aria-label="映像フィルター" aria-describedby="video-filter-note" data-setting="filter">${videoFilters.map(([v,t])=>`<option value="${v}" ${settings.filter===v?'selected':''}>${t}</option>`).join('')}</select>`,'image')}${row('画面ボタン',`<input data-setting="touchControls" type="checkbox" ${settings.touchControls?'checked':''}>`,'game')}${row('FPS表示',`<input data-setting="showFps" type="checkbox" ${settings.showFps?'checked':''}>`,'bolt')}</div><p class="sheet-note">通常は約60fpsで動作します。速度は端末の性能によって変わります。フィルターは見た目を調整する機能で、ゲーム内部の解像度は変わりません。</p>${videoFilterNote(settings.filter)}`);bindSettings($('#sheet-body'));}
function showAudioSettings(){sheet('音量と速度',`<div class="settings-group">${row('音量',`<input aria-label="音量" data-setting="volume" type="range" min="0" max="1" step=".05" value="${settings.volume}">`,'volume')}${row('プレイ速度',`<select data-setting="speed">${[1,2,3,4,5].map(n=>`<option value="${n}" ${settings.speed===n?'selected':''}>${n}倍</option>`).join('')}</select>`,'bolt')}${detail('倍速中も音程を維持','テンポは倍速、音の高さはそのまま。',switchControl('preservePitch',settings.preservePitch),'volume')}</div><p class="sheet-note">音程維持は初期状態でオンです。オフにすると従来どおり音程も上がります。高倍率では音質が変化し、処理負荷が増えます。</p><p class="sheet-note">速度ボタンかTabキーで、1〜5倍を順に切り替えます。通信中は1倍速です。</p>`);bindSettings($('#sheet-body'));}
function showSaveHelp(){sheet('保存・復旧の使い方',`<p class="sheet-note"><strong>ゲーム内セーブ</strong>：ゲームの「レポート」などで保存した内容です。自動保存では約10秒ごとに端末へ保存し、変更前の内容も最大5回分残します。レポート操作を自動で行う機能ではありません。</p><p class="sheet-note"><strong>ステート</strong>：プレイ中の状態を丸ごと保存したものです。自動保存をオンにすると約20秒ごとに保存し、直近5回分を残します。異常終了後の復旧に使えます。通信中は保存しません。</p><p class="sheet-note">手動のステート保存は毎回新しく追加されます。「セーブステート」の手動／自動から再開できます。削除は「編集」で選んでから行います。</p><p class="sheet-note">端末の故障やサイトデータの削除に備え、大切なセーブはファイルにも書き出してください。強制終了の直前まで復旧できるとは限りません。</p>`);}
function showControllers(){return api.showInputControls();}
function showStorage(){
 const storage=navigator.storage;
 sheet('保存容量',`<p class="sheet-note" id="storage-usage">容量を確認中…</p><div class="settings-group">${row('セーブを端末に自動保存',`<input data-setting="autosave" type="checkbox" ${settings.autosave?'checked':''}>`,'save')}</div><p class="sheet-note">自動ステートをオンにした場合も、セーブを一緒に保存します。</p><button class="secondary" id="persistent" aria-describedby="persistent-status" disabled>保存データを保護</button><p class="sheet-note" id="persistent-status" role="status" aria-live="polite">保護状態を確認中…</p><p class="sheet-note">空き容量不足による自動削除を防ぐ設定です。手動でのサイトデータ削除や端末故障に備え、セーブはファイルにも書き出してください。</p>`);
 bindSettings($('#sheet-body'));
 const button=$('#persistent'),status=$('#persistent-status'),usage=$('#storage-usage');
 const supported=typeof storage?.persist==='function';let pending=false,waitTimer;
 api.onClose(()=>clearTimeout(waitTimer));
 const render=(message,state,disabled=!supported)=>{
  if(!button.isConnected)return;
  status.textContent=message;status.dataset.state=state;
  button.disabled=disabled;button.textContent=state==='granted'?'保護済み':state==='pending'?'確認中…':'保存データを保護';
 };
 const ready=()=>render(supported?'自動削除からの保護は無効です。':'このブラウザでは保護を設定できません。',supported?'inactive':'unsupported');
 button.onclick=async()=>{
  if(pending||!supported||button.disabled)return;
  pending=true;render('ブラウザに確認しています…','pending',true);
  waitTimer=setTimeout(()=>render('ブラウザの応答を待っています。確認画面が出ている場合は選択してください。','pending',true),10000);
  try{
   // Call directly from the click handler, preserving user activation where needed.
   const granted=await storage.persist();
   render(granted?'自動削除から保護されています。':'ブラウザが保護を許可しませんでした。',granted?'granted':'denied',granted);
  }catch{render('保護を設定できませんでした。もう一度お試しください。','error',false);}
  finally{pending=false;clearTimeout(waitTimer);}
 };
 (async()=>{
  try{
   const stat=await storage?.estimate?.();
   if(usage.isConnected)usage.textContent=stat?`使用量： ${bytesLabel(stat.usage||0)}\n保存上限（目安）： ${bytesLabel(stat.quota||0)}`:'保存容量を取得できません。';
  }catch{if(usage.isConnected)usage.textContent='保存容量を取得できません。';}
 })();
 (async()=>{
  if(typeof storage?.persisted!=='function'){if(supported)render('現在の保護状態を確認できません。','unknown',false);else ready();return;}
  let timer;
  try{
   const granted=await Promise.race([storage.persisted(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Storage status timed out')),5000);})]);
   if(granted)render('自動削除から保護されています。','granted',true);else ready();
  }catch{if(supported)render('保護状態を確認できませんでした。','unknown',false);else ready();}
  finally{clearTimeout(timer);}
 })();
}
 return {renderSettings,showVideoSettings,showAudioSettings,showSaveHelp,showControllers,showStorage};
}
