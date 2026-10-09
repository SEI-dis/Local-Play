/* Adapted from ManicEMU. Copyright © 2024–2026 Manic EMU.
   Created by Aoshuang Lee / Max / Daiuno. Modified for Web on 2026-10-08. See NOTICES.md. */
// SPDX-License-Identifier: AGPL-3.0-or-later
// UI port based on ManicEMU's GamesNavigationView, GameListView and HomeTabBar.
import {systems,detectSystem,escapeHTML as esc,icon,hash,bytesLabel} from './shared.js';
import * as db from './storage.js';
import {createCore} from './core-factory.js';
import {coreFor,saveKey,cheatsFor,defaultCore} from './core-registry.js';
import {videoFilters} from './video.js';
import {setupOffline,offlineStatus} from './offline.js';
import {startAutoUpdates} from './auto-update.js';
import {guardUpdateTask} from './update-activity.js';
let appReady=false;
import {RoomLink} from './room-link.js';
import {LinkSafety} from './link-safety.js';
import {SaveProtection} from './save-safety.js';
import {loadSkin,releaseSkin} from './skins.js';
import {chooseRepresentation} from './skin-format.js';
import {mountSkinScreens} from './skin-screens.js';
import {mountSkinInputs} from './skin-inputs.js';
import {builtinLayout} from './skin-art.js';
import {screenBounds} from './control-layout.js';
import {ndsDisplayLayout} from './nds-skin.js';
import {createSkinSettings} from './skin-settings.js';
import {createStateDialogs} from './state-dialogs.js';
import {groupedOptions,gameShortcuts,stateDate,nativeAction,nativeSelect,nativeToggle} from './manic-ui.js';
import {createGameInfo} from './game-info.js';
import {floatingPanel} from './floating-panel.js';
import {row,action} from './ui.js';
import {createSettingsView,videoFilterNote} from './settings-view.js';
let link=null,linkMessage='',linkStarting=false,linkSaveBlocked=false,exiting=false,sheetCleanup=()=>{};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let library=[],tab=tabFromHash(),filter='all',query='',favorites=false,engine=null,current=null,skinData=null,paused=false,toastTimer,saveLock=null,launching=false,importing=false,dialogResume=false;
let savedSettings={};try{savedSettings=JSON.parse(localStorage.getItem('manic-settings')||'{}');}catch{}
let settings={theme:'dark',volume:.7,speed:1,preservePitch:true,autosave:true,recovery:true,haptics:true,filter:'pixel',showFps:false,touchControls:true,...savedSettings};
delete settings.autoCovers;
const {renderSettings,showVideoSettings,showAudioSettings,showSaveHelp,showControllers,showStorage}=createSettingsView({
 settings,applySettings,bindSettings,bindActions,sheet,toast,showSkins,showOffline,onClose:cleanup=>{sheetCleanup=cleanup;}
});
const runtime={get engine(){return engine;},get current(){return current;},get link(){return link;},get protection(){return protection;},get skinData(){return skinData;},set skinData(value){skinData=value;},set cleanup(value){sheetCleanup=value;}};
const skinSettings=createSkinSettings({runtime,settings,setPause,sheet,applySettings,layoutSkin,refresh,toast,error,controlLayout,playerSize,frameStyle});
const keybits={a:0,b:1,select:2,start:3,right:4,left:5,up:6,down:7,r:8,r1:8,l:9,l1:9,x:10,y:11,c:12,z:13};
const pressed=new Map();
// Suppress browser callouts on controls, including dynamically rendered buttons.
// Keep native selection, copy and paste in room numbers and other text fields.
for(const type of ['contextmenu','selectstart','dragstart'])document.addEventListener(type,e=>{
 const target=e.target instanceof Element?e.target:e.target.parentElement;
 if(!target||target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(target.closest('button,[role="button"],a.row,a.primary,a.secondary,summary,#skin,.edit-preview'))e.preventDefault();
},{capture:true});
let saveImportTarget=null,playRunAt=0;
let dpadViews=[];
const linkPanel=floatingPanel($('#link-panel'),{handle:$('#link-panel-drag'),trigger:$('#player-link'),close:$('#link-panel-close'),onInteract:release});
$('#player-link').innerHTML=icon('wifi');$('#link-panel-icon').innerHTML=icon('wifi');$('#link-panel-close').innerHTML=icon('close');
$('#player-link').onclick=()=>linkPanel.visible?linkPanel.hide():showLink();
function toast(text){const el=$('#toast');($('#sheet').open?$('#sheet'):document.body).append(el);el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3500);}
function error(e){console.error(e);toast(e?.name==='QuotaExceededError'?'保存容量が不足しています。セーブをファイルに書き出してください。':e.message||String(e));}
function applySettings(){$$('#quick-actions button').forEach(b=>b.disabled=!!link);document.documentElement.dataset.theme=settings.theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):settings.theme;$('#screen').className=settings.filter==='smooth'?'smooth':settings.filter==='scanlines'?'scanlines':'';engine?.setVolume(settings.muted?0:settings.volume);$('#screen').dataset.scaling=settings.screenScaling||'fit';engine?.setSpeed(link?1:settings.speed);engine?.setPreservePitch?.(settings.preservePitch);updateSpeedButton();updateLinkButton();engine?.setFilter?.(settings.filter);engine?.setRenderLimit?.(settings.ndsPowerSave!==false);$('#fps-meter').hidden=!settings.showFps;localStorage.setItem('manic-settings',JSON.stringify(settings));}
function bindActions(root,handlers){root.querySelectorAll('[data-action]').forEach(el=>el.onclick=guardUpdateTask(()=>Promise.resolve().then(()=>handlers[el.dataset.action]?.()).catch(error)));}
function sheet(title,html,resume=false){
 sheetCleanup();sheetCleanup=()=>{};const dialog=$('#sheet');if(dialog.open)dialog.close();
 dialog.classList.remove('port-menu','states-view','save-data','native-menu','game-info');$('#sheet-cover').hidden=true;$('#sheet-cover').removeAttribute('src');$('#sheet-tools').replaceChildren();$('#close-sheet').removeAttribute('data-action');$('#close-sheet').setAttribute('aria-label','閉じる');
 linkPanel.hide();dialogResume=resume;$('#sheet-title').textContent=title;$('#sheet-body').innerHTML=html;dialog.showModal();dialog.scrollTop=0;
}
function menuTools(tools,handlers){$('#sheet-tools').innerHTML=tools.map(([id,label,ic])=>`<button class="sheet-tool ${id==='exit'?'danger':''}" data-shortcut="${id}" aria-label="${label}" title="${label}">${icon(ic)}</button>`).join('');$$('[data-shortcut]').forEach(b=>b.onclick=guardUpdateTask(()=>Promise.resolve().then(()=>handlers[b.dataset.shortcut]()).catch(error)));}
function closeSheet(){sheetCleanup();sheetCleanup=()=>{};const resume=dialogResume;dialogResume=false;$('#sheet').close();if(resume&&engine)setPause(false);}
$('#close-sheet').innerHTML=icon('close');$('#close-sheet').onclick=closeSheet;
$('#sheet').addEventListener('cancel',e=>{e.preventDefault();closeSheet();});
// A modal dialog paints above all ordinary z-index layers, including body toasts.
$('#sheet').addEventListener('close',()=>{if(!$('#sheet').open)document.body.append($('#toast'));});
$('#sheet').addEventListener('click',e=>{if(e.target===$('#sheet')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet();}});
$('#controllers').innerHTML=icon('game');$('#controllers').onclick=showControllers;
$('#history').innerHTML=icon('history');$('#history').onclick=showHistory;
$('#player-menu').innerHTML=icon('more');$('#player-menu').onclick=showGameMenu;
function tabFromHash(){return location.hash==='#settings'?'settings':location.hash==='#imports'?'imports':'games';}
function setTab(id){
 tab=id;
 // Keep the selected tab when returning from a separate settings page.
 const url=new URL(location.href);url.hash=id==='games'?'':id;
 history.replaceState(history.state,'',url);
}
for(const [id,ic,label] of [['games','game','ゲーム'],['imports','import','インポート'],['settings','settings','設定']]){const b=$(`[data-tab="${id}"]`);b.innerHTML=icon(ic)+`<span>${label}</span>`;b.onclick=()=>{setTab(id);render();};}
async function refresh(){library=await db.all('library');render();}
function render(){if(engine)return;$$('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false');});if(tab==='games')renderGames();else if(tab==='imports')renderImports();else renderSettings();}
function renderGames(){
 $('#content').innerHTML=`${library.length?`<div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="ゲームを検索" aria-label="ゲームを検索" value="${esc(query)}"></label><button class="favorite-filter ${favorites?'selected':''}" id="favorites" aria-label="お気に入りだけを表示" aria-pressed="${favorites}">${icon('heart')}</button><select id="system-filter" aria-label="機種で絞り込み"><option value="all">すべて</option>${Object.entries(systems).map(([k,s])=>`<option value="${k}" ${filter===k?'selected':''}>${s.short}</option>`).join('')}</select></div>`:''}<div id="library" class="library"></div>`;
 if($('#search')){$('#search').oninput=e=>{query=e.target.value;renderLibrary();};$('#system-filter').onchange=e=>{filter=e.target.value;renderLibrary();};$('#favorites').onclick=()=>{favorites=!favorites;renderGames();};}renderLibrary();
}
function renderLibrary(){const games=library.filter(g=>(filter==='all'||g.system===filter)&&(!favorites||g.favorite)&&g.name.toLowerCase().includes(query.toLowerCase()));
 if(!games.length){$('#library').innerHTML=`<div class="empty-library"><img src="assets/${library.length?'empty':'icon'}.svg" class="${library.length?'':'app-icon'}" alt=""><h2>${library.length?'ゲームが見つかりません':'ゲームを追加しましょう'}</h2><p>${library.length?'検索や絞り込み条件を変更してください。':'お気に入りのゲームを、いつでもここから。<br>端末内のROMを選んでライブラリに追加できます。'}</p><button class="primary" id="add-first">${icon('plus')}ゲームを追加</button></div>`;$('#add-first').onclick=()=>$('#rom-input').click();return;}
 $('#library').innerHTML=Object.entries(systems).map(([k,s])=>{const group=games.filter(g=>g.system===k).sort((a,b)=>a.name.localeCompare(b.name,'ja'));if(!group.length)return '';return `<section class="system-section"><h2 class="section-title"><span>${s.short}</span><span class="count">${group.length}</span>${icon('chevron')}</h2><div class="game-grid">${group.map(g=>`<article class="game-card"><button class="game-launch" data-game="${g.id}" aria-label="${esc(g.name)}の設定を開く" aria-haspopup="dialog"><div class="cover ${g.cover?'':'empty-cover'}" style="--system-color:${s.color}"><img src="${g.cover||`assets/controller.svg`}" alt=""><span class="badge">${g.size===67108864&&k==='gba'?'64 MB':s.short}</span>${g.favorite?`<span class="heart-mark">${icon('heart')}</span>`:''}</div><h3 class="game-name">${esc(g.name)}</h3></button><button class="game-options" data-details="${g.id}" aria-label="${esc(g.name)}のメニュー">${icon('more')}</button></article>`).join('')}</div></section>`;}).join('');
 $$('[data-game]').forEach(b=>b.onclick=()=>showDetails(library.find(g=>g.id===b.dataset.game)));$$('[data-details]').forEach(b=>b.onclick=()=>showDetails(library.find(g=>g.id===b.dataset.details)));
}
// ManicEMU ImportServiceListView and its motto, file, service and footer cells.
// Copyright © 2025–2026 Manic EMU. Daiuno / Max. Ported 2026-10-09.
// Local Files, skin settings and game-specific save import; original Web artwork.
function renderImports(){
 $('#content').innerHTML=`<section class="page import-page" aria-label="インポート"><header class="import-hero"><img src="assets/icon.svg" alt=""></header>
  <button class="import-file" id="choose-rom"><span class="import-file-icon">${icon('folder')}</span><span><strong>ファイル</strong><small>端末内のROMを追加</small></span></button>
  <div class="import-services"><button class="import-service" id="import-skins"><span class="import-service-icon skin-service">${icon('image')}</span><strong>スキン</strong><small>追加・変更</small></button><button class="import-service" id="import-saves" ${library.length?'':'disabled'}><span class="import-service-icon save-service">${icon('saveImport')}</span><strong>セーブデータ</strong><small>${library.length?'ゲームを選んで読み込む':'先にゲームを追加'}</small></button></div>
  <div class="import-drop"><span class="import-drop-icon">${icon('import')}</span><span><strong>ドラッグ＆ドロップ</strong><small>ROMをこの画面にドロップ</small></span></div>
  <details class="import-formats"><summary>対応する形式</summary><p class="sheet-note">${Object.values(systems).map(s=>`${s.short}：${s.ext.map(ext=>'.'+ext).join(' / ')}`).join('<br>')}</p><p class="sheet-note">ZIPは解凍してください。ROMとセーブは端末内に保存します。利用する権利のあるROMを使用してください。</p></details></section>`;
 $('#choose-rom').onclick=()=>$('#rom-input').click();
 $('#import-skins').onclick=()=>showSkins();
 $('#import-saves').onclick=()=>{
  sheet('セーブデータ','<p class="sheet-note">読み込み先のゲームを選んでください。</p><div class="settings-group">'+library.map(game=>`<button class="row" data-import-save="${esc(game.id)}">${icon('game')}<span>${esc(game.name)}</span>${icon('chevron')}</button>`).join('')+'</div>');
  $$('[data-import-save]').forEach(button=>button.onclick=()=>{const game=library.find(game=>game.id===button.dataset.importSave);if(game)chooseSaveImport(game);});
 };
}

function bindSettings(root){root.querySelectorAll('[data-setting]').forEach(el=>el.onchange=()=>{settings[el.dataset.setting]=el.type==='checkbox'?(el.dataset.invert?!el.checked:el.checked):['volume','speed','hapticStrength','deadZone'].includes(el.dataset.setting)?Number(el.value):el.value;if(el.dataset.setting==='hapticStrength')settings.haptics=!!settings.hapticStrength;const value=el.closest('.native-select')?.querySelector('.native-value');if(value)value.textContent=el.selectedOptions[0].textContent;applySettings();if($('#video-filter-note'))$('#video-filter-note').hidden=settings.filter!=='edge4x';if(['touchControls','showFps','ndsSwapScreens'].includes(el.dataset.setting))layoutSkin();});}
async function importFiles(files){if(importing){toast('追加が終わるまでお待ちください。');return;}importing=true;let count=0;try{for(const file of files){const system=detectSystem(file.name);if(!system){toast(`${file.name}: 未対応の形式です。`);continue;}const maxMiB=system==='nds'?512:64;if(file.size>maxMiB*1048576||!file.size){toast(`${file.name}: 空のファイル、または${maxMiB}MBを超えるファイルは追加できません。`);continue;}toast(`${file.name} を追加中…`);const bytes=new Uint8Array(await file.arrayBuffer());const id=await hash(bytes);if(await db.get('library',id)){toast('このゲームは追加済みです。');continue;}const game={id,name:file.name.replace(/\.[^.]+$/,''),filename:file.name,system,size:file.size,added:Date.now(),lastPlayed:0,favorite:false};await db.addGame(game,bytes);count++;}if(count){setTab('games');filter='all';query='';favorites=false;await refresh();toast(`${count}本のゲームを追加しました。`);}}catch(e){error(e);}finally{importing=false;$('#rom-input').value='';}}
$('#rom-input').onchange=guardUpdateTask(e=>importFiles([...e.target.files]));
let dragDepth=0;window.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();dragDepth++;document.body.classList.add('drop-active');}});window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('dragleave',()=>{if(--dragDepth<=0)document.body.classList.remove('drop-active');});window.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;document.body.classList.remove('drop-active');if(!engine)importFiles([...e.dataTransfer.files]);});
function menuControlCells(game=current){return {
 swapScreen:game?.system==='nds'?nativeToggle('画面切り替え','ndsSwapScreens','layers',!!settings.ndsSwapScreens):'',
 frameLimit:game?.system==='nds'&&coreFor(game).renderLimit?nativeToggle('省電力モード','ndsPowerSave','bolt',settings.ndsPowerSave!==false,{detail:'描画を約30fpsに抑えて負荷を軽減'}):'',
 volume:nativeToggle('音量','muted','volume',!settings.muted,{invert:true}),
 fastForward:nativeSelect('早送り','speed','fast',[[1,'通常速度'],...[2,3,4,5].map(n=>[n,n+'倍速'])],settings.speed),
 preservePitch:nativeToggle('倍速中も音程を維持','preservePitch','volume',settings.preservePitch,{detail:'テンポは倍速のまま、音の高さを保ちます'}),
 shaders:nativeSelect('シェーダー','filter','image',videoFilters,settings.filter)+videoFilterNote(settings.filter),
 haptic:nativeSelect('触覚','hapticStrength','haptic',[[0,'オフ'],[8,'弱振動'],[20,'強振動']],settings.haptics?(settings.hapticStrength||8):0),
 controllerSetting:nativeAction('コントローラー設定','controllers','game'),
 deadZone:nativeSelect('デッドゾーン','deadZone','joystick',[[.1,'10%'],[.2,'20%'],[.3,'30%'],[.4,'40%'],[.5,'50%']],settings.deadZone??.4),
 hideControls:nativeToggle('コントロール非表示','touchControls','hide',!settings.touchControls,{invert:true}),
 screenScaling:nativeSelect('画面スケーリング','screenScaling','expand',[['fit','アスペクト比を維持'],['stretch','引き伸ばし'],['fill','画面を埋める']],settings.screenScaling||'fit')
};}
const gameInfo=createGameInfo({sheet,closeSheet,launch,refresh,error,toast,download,showSkins,showControllers,showCheats,
 showStates:game=>showStates(null,false,{game}),importSave:game=>chooseSaveImport(game),
 onClose:cleanup=>{sheetCleanup=cleanup;},settings:()=>settings,saveSettings:applySettings,controlCells:menuControlCells,bindSettings});
// ManicEMU Game.handleTapAction's normal selection route. Core startup belongs
// to GameInfoDetailView's explicit Play action (or an explicit state resume).
function showDetails(game){gameInfo.show(game);}
function showHistory(){const games=library.filter(g=>g.lastPlayed).sort((a,b)=>b.lastPlayed-a.lastPlayed);sheet('プレイ履歴',games.length?`<div class="settings-group">${games.slice(0,15).map(g=>action(esc(g.name),g.id,'chevron')).join('')}</div>`:'<p class="sheet-note">まだプレイしたゲームはありません。</p>');bindActions($('#sheet-body'),Object.fromEntries(games.map(g=>[g.id,()=>showDetails(g)])));}
function controlLayout(system,game){return game?.controlLayout??settings.controlLayouts?.[system]??{};}
// WebKit can retain a stale computed dvh height on the hidden player. Use the
// current viewport for library previews, and actual bounds during gameplay.
function playerSize(){const stage=$('#player'),style=getComputedStyle(stage);return {width:(stage.clientWidth||window.innerWidth)-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),height:(stage.clientHeight||window.innerHeight)-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)};}
function showSkins(...args){return guardUpdateTask(()=>skinSettings.showSkins(...args))();}
const protection=new SaveProtection(status=>{
 const el=$('#save-status');el.hidden=!engine;
 el.classList.toggle('save-error',!!status.error);
 const at=status.stateAt||status.at,time=at?new Date(at).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false}):'';
 el.textContent=status.error?'保存失敗':status.busy?'保存中…':at?'保存済み '+time:'未保存';
 const details=[status.stateAt?'再開用データ：'+new Date(status.stateAt).toLocaleString('ja-JP'):'',status.at?'ゲーム内セーブ：'+new Date(status.at).toLocaleString('ja-JP'):''].filter(Boolean).join(' ／ ');
 el.dataset.detail=status.error?'保存失敗：'+status.error:status.busy?'保存中…':details||'まだ保存されていません';el.title=el.dataset.detail;el.setAttribute('aria-label',el.dataset.detail);
 const note=$('#protection-status');if(note)note.textContent=el.dataset.detail;
});
const stateDialogs=createStateDialogs({runtime,sheet,closeSheet,setPause,persist,launch,showGameMenu,toast,error});
async function launch(game,{safeMode=false,skipRecovery=false}={}){
 if(engine||launching)return;launching=true;current=game;$('#player').hidden=false;$('#loading').hidden=false;$('#loading').textContent='コアを読み込んでいます…';
 try{
  const stored=await db.get('library',game.id);if(!stored)throw new Error('ゲームが見つかりません。');current=game=stored;
  const previous=await protection.open(game,coreFor(game).id);
  const bytes=await db.get('roms',game.id);if(!bytes)throw new Error('ROMが見つかりません。もう一度追加してください。');
  skinData=await loadSkin(game.system,game.skinId||settings.skins?.[game.system],settings.skins?.[game.system]);$('#screen').replaceChildren();
  engine=createCore($('#screen'),game);
  engine.onError=e=>{setPause(true);error(e);};engine.unlockAudio()?.catch?.(()=>{});await engine.load(bytes,game,systems[game.system]);
  if(previous.save?.bytes)engine.restore(await protection.verify(previous.save));
  engine.setCheats?.(safeMode||!coreFor(game).cheats?[]:cheatsFor(game));game.lastPlayed=Date.now();await db.put('library',game.id,game);paused=false;playRunAt=Date.now();$('#resume-game').hidden=true;applySettings();layoutSkin();$('#loading').hidden=true;$('#save-status').hidden=false;engine.unlockAudio()?.catch?.(()=>{});startPadPoll();
  if(!safeMode&&!skipRecovery&&previous.interrupted&&previous.recoveries.some(r=>protection.compatible(r))){setPause(true);await showRecovery(true);}
 }catch(e){engine?.close();engine=null;current=null;await protection.close();$('#player').hidden=true;$('#loading').hidden=true;throw e;}finally{launching=false;}
}
function frameStyle(frame,map){return `left:${frame.x/map.width*100}%;top:${frame.y/map.height*100}%;width:${frame.width/map.width*100}%;height:${frame.height/map.height*100}%;`;}
let layoutFrame=null,lastLayoutSize='',skinScreenCleanup=()=>{},skinInputs=null;
function clearImportedSkin(){skinScreenCleanup();skinScreenCleanup=()=>{};skinInputs?.destroy();skinInputs=null;$('#skin .imported-art')?.remove();}
function scheduleSkinLayout(){if(layoutFrame!==null)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=null;layoutSkin(false);});}
function layoutSkin(force=true){if(!current||!skinData)return;
 const stage=$('#player'),{width,height}=playerSize(),builtin=skinData.id.startsWith('builtin:'),padding=getComputedStyle(stage),sizeKey=[width,height,padding.paddingLeft,padding.paddingTop,padding.paddingRight,padding.paddingBottom].join(':');
 // ResizeObserver, viewport and window can report the same resize. Do not
 // rebuild held buttons or generate the SVG again when geometry is unchanged.
 if(!force&&sizeKey===lastLayoutSize)return;lastLayoutSize=sizeKey;release();clearImportedSkin();
 stage.dataset.system=current.system;stage.dataset.builtin=String(builtin);stage.dataset.displayOnly=String(!settings.touchControls);$('#quick-actions').hidden=!builtin||!settings.touchControls;$('#boost').hidden=!settings.touchControls;
 const landscape=width>height;
 let rep=builtin?builtinLayout(skinData,width,height,controlLayout(current.system,current)[landscape?'landscape':'portrait'],current.system==='gba'?48:32):chooseRepresentation(skinData,width,height);
 if(!settings.touchControls&&current.system==='nds')rep=ndsDisplayLayout(width,height,controlLayout('nds',current)[landscape?'landscape':'portrait']);
 else if(!settings.touchControls){const aspect=['gb','gbc'].includes(current.system)?160/144:current.system==='gba'?1.5:4/3,sw=Math.min(width,height*aspect),customScreen=builtin&&controlLayout(current.system,current)[landscape?'landscape':'portrait']?.screen;rep={mappingSize:{width,height},assets:{},items:[],wide:customScreen?rep.wide:undefined,screens:[{outputFrame:customScreen?{...rep.screens[0].outputFrame}:{x:(width-sw)/2,y:(height-sw/aspect)/2,width:sw,height:sw/aspect}}]};}
 engine?.setLayout?.(rep.wide??landscape,!!settings.ndsSwapScreens,rep);stage.dataset.wide=String(rep.wide??landscape);stage.style.setProperty('--skin-side',(rep.side||130)+'px');
 const imported=!builtin&&settings.touchControls;
 $('#boost').hidden=!settings.touchControls||(imported&&rep.items.some(item=>Array.isArray(item.inputs)&&item.inputs.some(key=>key==='toggleFastForward'||/^fastForward/.test(key))));
 const map=rep.mappingSize,ratio=Math.min(width/map.width,height/map.height);const skin=$('#skin');skin.style.width=map.width*ratio+'px';skin.style.height=map.height*ratio+'px';skin.style.backgroundImage=rep.assets.resizable?`url("${skinData.images[rep.assets.resizable]}")`:"none";$('#screen').style.cssText=frameStyle(screenBounds(rep),map)+`border-radius:${skinData.screenRadius||0}px;`;
 if(imported){
  skin.style.backgroundImage='none';$('#screen').style.cssText='left:0;top:0;width:100%;height:100%;';
  skinScreenCleanup=mountSkinScreens($('#screen'),engine,rep,current.system,{swap:!!settings.ndsSwapScreens,ratio});
  const art=document.createElement('div');art.className='imported-art';art.style.cssText=frameStyle(rep.artFrame||{x:0,y:0,...map},map);art.style.backgroundImage=rep.assets.resizable?`url("${skinData.images[rep.assets.resizable]}")`:'none';skin.append(art);
 }
 for(const id of ['quick-load','quick-save','player-menu','boost'])$('#'+id).removeAttribute('style');
 const skinRect=skin.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
 for(const id of ['fps-meter','save-status']){
  const badge=$('#'+id);badge.removeAttribute('style');
  if(builtin&&settings.touchControls){const maxWidth=current.system==='nds'?(skinRect.width-30)/2:rep.wide?rep.side*ratio-20:(skinRect.width-30)/2;badge.style.top=skinRect.top-stageRect.top+8+'px';badge.style.maxWidth=Math.max(1,maxWidth)+'px';if(id==='fps-meter')badge.style.left=skinRect.left-stageRect.left+10+'px';else badge.style.right=stageRect.right-skinRect.right+10+'px';}
 }
 for(const a of rep.actions||[]){const f=a.frame;$('#'+a.id).style.cssText=`left:${skinRect.left-stageRect.left+f.x*ratio}px;top:${skinRect.top-stageRect.top+f.y*ratio}px;width:${f.width*ratio}px;height:${f.height*ratio}px;right:auto;bottom:auto;min-width:0;padding:0;opacity:${a.opacity??1};`;}
 if(imported){dpadViews=[];skinInputs=mountSkinInputs($('#touch-controls'),rep,skinData.images,{keybits,pressed,updateKeys,action:skinAction,engine,ratio,swap:!!settings.ndsSwapScreens,selected:command=>({volume:settings.muted,reverseScreens:settings.ndsSwapScreens,toggleControlls:!settings.touchControls})[command],paused:()=>paused,haptic:()=>{if(settings.haptics)navigator.vibrate?.(settings.hapticStrength||8);}});return;}
 $('#touch-controls').innerHTML=rep.items.map((item,i)=>{const pad=!Array.isArray(item.inputs),inputs=pad?['dpad']:item.inputs;return `<button class="skin-button${pad?' dpad':''}" data-item="${i}" aria-label="${pad?'十字キー':esc(item.label||inputs.join('+').toUpperCase())}" style='${frameStyle(item.frame,map)}opacity:${item.opacity??1};background-image:url("${skinData.images[item.asset?.normal]||''}")'>${pad?['up','down','left','right'].map(d=>`<span class="dpad-direction${item.asset?.normal?'':' baked'}" data-direction="${d}" aria-hidden="true" hidden></span>`).join(''):''}</button>`;}).join('');
 dpadViews=$$('.dpad-direction').map(el=>{const inputs=rep.items[Number(el.parentElement.dataset.item)].inputs,key=keybits[inputs[el.dataset.direction]];return {el,mask:key===undefined?0:1<<key,on:false};});
 $$('.skin-button').forEach(btn=>{const item=rep.items[Number(btn.dataset.item)];function input(e){if(Array.isArray(item.inputs)){if(item.inputs.includes('menu'))return;pressed.set(e.pointerId,item.inputs.reduce((v,k)=>v|(keybits[k]===undefined?0:1<<keybits[k]),0));}else{const r=btn.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;let bits=0;for(const [d,on] of [['left',x<-.15],['right',x>.15],['up',y<-.15],['down',y>.15]])if(on&&keybits[item.inputs[d]]!==undefined)bits|=1<<keybits[item.inputs[d]];pressed.set(e.pointerId,bits);}btn.classList.add('pressed');updateKeys();}
 btn.onpointerdown=e=>{e.preventDefault();engine?.unlockAudio();if(item.inputs.includes?.('menu')){showGameMenu();return;}if(paused)return;if($('#link-panel').contains(document.activeElement))document.activeElement.blur();btn.setPointerCapture(e.pointerId);if(settings.haptics)navigator.vibrate?.(settings.hapticStrength||8);input(e);};btn.onpointermove=e=>{if(pressed.has(e.pointerId)&&!Array.isArray(item.inputs))input(e);};const up=e=>{pressed.delete(e.pointerId);btn.classList.remove('pressed');updateKeys();};btn.onpointerup=up;btn.onpointercancel=up;btn.onlostpointercapture=up;});}
function updateKeys(){let keys=0;for(const mask of pressed.values())keys|=mask;if(paused)keys=0;engine?.setKeys(keys);for(const view of dpadViews){const on=!!(keys&view.mask);if(on!==view.on){view.on=on;view.el.hidden=!on;}}}
function release(){skinInputs?.release();pressed.clear();updateKeys();$$('.pressed').forEach(b=>b.classList.remove('pressed'));}
function setPause(v){if(!v&&(linkStarting||link?.closed))return;if(v&&playRunAt&&current){current.playDuration=(current.playDuration||0)+Math.max(0,Date.now()-playRunAt);playRunAt=0;}else if(!v&&!playRunAt&&engine)playRunAt=Date.now();paused=v;$('#resume-game').hidden=!v;release();engine?.pause(v);if(!v)engine?.unlockAudio();}
$('#resume-game').onclick=()=>{if(engine&&!document.hidden)setPause(false);};
function backgroundPause(){if(!engine)return;const wasPaused=paused,wasLinked=!!link;setPause(true);if(link?.connected)link.close('画面を離れたため接続を終了しました。');if(!wasPaused&&!wasLinked)persist({checkpoint:settings.recovery,reason:'background'}).catch(error);}
function syncResume(){if(engine)$('#resume-game').hidden=!paused;}
new ResizeObserver(scheduleSkinLayout).observe($('#player'));
window.visualViewport?.addEventListener('resize',scheduleSkinLayout);
window.addEventListener('resize',scheduleSkinLayout);window.addEventListener('blur',backgroundPause);window.addEventListener('focus',syncResume);
document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();else syncResume();});
window.addEventListener('pagehide',backgroundPause);window.addEventListener('pageshow',event=>{if(event.persisted&&engine)setPause(true);syncResume();});
document.addEventListener('freeze',backgroundPause);document.addEventListener('resume',syncResume);
const keyboard={KeyX:'a',KeyZ:'b',KeyA:'l',KeyS:'r',KeyW:'x',KeyQ:'y',KeyC:'c',KeyE:'z',Enter:'start',ShiftLeft:'select',ShiftRight:'select',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
window.addEventListener('keydown',e=>{if(!engine||$('#sheet').open)return;if(e.target.closest?.('#link-panel,input,textarea,select,[contenteditable=true]'))return;if(e.code==='Escape'&&linkPanel.visible){e.preventDefault();linkPanel.hide({focus:true});return;}if(e.target.closest?.('#player-link')&&['Enter','Space'].includes(e.code))return;if(e.code==='Tab'){if(linkPanel.visible)return;if(!paused&&!e.shiftKey){e.preventDefault();if(!e.repeat)cycleSpeed();}return;}if(e.code==='Escape'){e.preventDefault();showGameMenu();return;}if(keyboard[e.code]){e.preventDefault();engine.unlockAudio();pressed.set(e.code,1<<keybits[keyboard[e.code]]);updateKeys();}});window.addEventListener('keyup',e=>{if(keyboard[e.code]){pressed.delete(e.code);updateKeys();}});
function startPadPoll(){
 const buttons=Object.entries({0:'a',1:'b',2:'y',3:'x',4:current?.system==='md'?'c':'l',5:current?.system==='md'?'z':'r',8:'select',9:'start',12:'up',13:'down',14:'left',15:'right'}).map(([i,k])=>[Number(i),1<<keybits[k]]);
 engine.beforeFrame=()=>{let bits=0;for(const pad of navigator.getGamepads?.()||[]){if(!pad)continue;for(const [i,mask] of buttons)if(pad.buttons[i]?.pressed)bits|=mask;if(pad.axes[0]<-(settings.deadZone??.4))bits|=1<<5;if(pad.axes[0]>(settings.deadZone??.4))bits|=1<<4;if(pad.axes[1]<-(settings.deadZone??.4))bits|=1<<6;if(pad.axes[1]>(settings.deadZone??.4))bits|=1<<7;}if(bits!==(pressed.get('pad')||0)){pressed.set('pad',bits);updateKeys();}};
}
function persist(options={}){if(!engine||!current||link||linkStarting||linkSaveBlocked)return Promise.resolve();return protection.save(engine,options);}
setInterval(()=>{if(engine&&!paused&&(settings.autosave||settings.recovery)){const checkpoint=settings.recovery&&!link&&Date.now()-protection.stateAt>=20000;persist({checkpoint}).catch(error);}},10000);
// Crash recovery uses the native automatic-save tab, not a separate menu.
async function showRecovery(interrupted=false){if(!engine)return;setPause(true);await showStates('auto',false,{interrupted});}
function exportGameSave(){const bytes=engine.save();if(!bytes?.length){toast('ゲーム内でセーブしてから書き出してください。');return;}download(bytes,current.name+'.'+coreFor(current).saveExtension);}
function showSaveData(){
 sheet('セーブデータ',`<p class="sheet-note">ゲーム内の「レポート」などで保存したデータです。</p><div class="settings-group">${action('読み込む','restore','folder')}${action('書き出す','export','import')}</div><div class="settings-group">${action('バックアップ','backups','history')}</div>`,true);$('#sheet').classList.add('save-data');
 bindActions($('#sheet-body'),{restore:()=>chooseSaveImport(current),export:exportGameSave,backups:showBackups});
}
async function showBackups(){
 const game=current,history=await db.get('backups',saveKey(game))||[];
 sheet('バックアップ',`<div class="settings-group">${history.map((record,i)=>`<article class="backup-entry"><div class="save-caption"><strong>セーブ ${i+1}</strong>${stateDate(record.at)}</div><button class="sheet-tool" data-backup-export="${i}" aria-label="セーブ ${i+1}を書き出す">${icon('import')}</button><button class="state-continue" data-backup-restore="${i}">復元</button></article>`).join('')||'<p class="sheet-note">バックアップはまだありません。</p>'}</div>`,true);$('#sheet').classList.add('save-data');
 $$('[data-backup-export]').forEach(b=>b.onclick=async()=>{try{const record=history[Number(b.dataset.backupExport)];download(await protection.verify(record),game.name+'-backup-'+record.at+'.'+coreFor(game).saveExtension);}catch(e){error(e);}});
 $$('[data-backup-restore]').forEach(b=>b.onclick=()=>{
  const record=history[Number(b.dataset.backupRestore)];sheet('バックアップを復元',`<p class="sheet-note">${new Date(record.at).toLocaleString('ja-JP')} のセーブで再起動します。現在のセーブもバックアップに残します。</p><div class="sheet-actions"><button class="secondary" id="cancel-backup">キャンセル</button><button class="primary" id="confirm-backup">復元</button></div>`,true);
  $('#cancel-backup').onclick=showBackups;$('#confirm-backup').onclick=async()=>{const button=$('#confirm-backup');button.disabled=true;try{if(game!==current)throw new Error('ゲームが変更されました。');const bytes=await protection.verify(record);await persist({reason:'before-restore'});engine.restore(bytes);engine.reset();await persist({checkpoint:true,reason:'backup-restore'});closeSheet();toast('復元しました。');}catch(e){error(e);button.disabled=false;}};
 });
}
// GameOptionsView.getListPage / GameOption.defaultGroupAndSort, with native-only
// actions removed. Browser-only functions use the same grouped row components.
function showGameMenu(){
 if(!engine||linkStarting||exiting)return;if(link){showConnectedMenu();return;}setPause(true);
 const cells={
  skins:nativeAction('スキン設定','skins','shirt'),stateList:nativeAction('セーブステートを確認','states','state'),
  importSave:nativeAction('セーブデータをインポート','importSave','saveImport'),shareSave:nativeAction('セーブデータをエクスポート','export','saveExport'),saveData:nativeAction('セーブデータ・バックアップ','saveData','folder'),
  cheatCode:coreFor(current).cheats?nativeAction('チートコード','cheats','code'):'',saveState:nativeAction('セーブ','newState','save'),quickLoadState:nativeAction('クイックロード','quickLoad','history'),
  ...menuControlCells(),screenShot:nativeAction('スクリーンショット','screenshot','image'),
  showFps:nativeToggle('FPS表示','showFps','bolt',settings.showFps),
  netplay:current.system==='gba'&&coreFor(current).link?nativeAction('通信（実験版）','link','wifi'):'',fullScreen:nativeAction('全画面','fullscreen','expand'),reload:nativeAction('再起動','restart','reload'),quit:nativeAction('終了','exit','power','','danger')
 };
 sheet('MENU',groupedOptions(cells,settings.menuOrder),true);$('#sheet').classList.add('port-menu','native-menu');$('#close-sheet').dataset.action='play';$('#close-sheet').setAttribute('aria-label','ゲームに戻る');
 const handlers={importSave:()=>chooseSaveImport(current),export:exportGameSave,link:showLink,states:()=>showStates(),newState:()=>confirmStateSave(),quickLoad:showQuickLoad,saveData:showSaveData,cheats:showCheats,skins:()=>showSkins(current.system,current),controllers:()=>{showControllers();dialogResume=true;},
  screenshot:()=>{const a=document.createElement('a');a.href=engine.screenshot();a.download=current.name+'.png';a.click();},
  fullscreen:async()=>{if(document.fullscreenElement)await document.exitFullscreen();else if($('#player').requestFullscreen)await $('#player').requestFullscreen();else toast('Safariでは共有メニューからホーム画面に追加すると全画面で開けます。');},restart:confirmRestart,exit:exitGame};
 bindSettings($('#sheet-body'));bindActions($('#sheet-body'),handlers);menuTools(gameShortcuts.filter(([id])=>!Array.isArray(settings.gameShortcuts)||settings.gameShortcuts.includes(id)),handlers);
}
function confirmRestart(){
 sheet('再起動しますか？','<p class="sheet-note">ゲーム内セーブから起動します。現在の状態も自動保存に残します。</p><div class="sheet-actions"><button class="secondary" id="cancel-restart">キャンセル</button><button class="primary" id="confirm-restart">再起動</button></div>',true);
 $('#cancel-restart').onclick=showGameMenu;$('#confirm-restart').onclick=async()=>{const button=$('#confirm-restart');button.disabled=true;try{await persist({checkpoint:true,reason:'before-restart'});engine.reset();closeSheet();}catch(e){error(e);button.disabled=false;}};
}
function showStates(...args){return guardUpdateTask(()=>stateDialogs.showStates(...args))();}
function confirmStateSave(...args){return stateDialogs.confirmStateSave(...args);}
function showQuickLoad(){return stateDialogs.showQuickLoad();}
function chooseSaveImport(game){saveImportTarget=game;$('#save-input').click();}
$('#save-input').onchange=guardUpdateTask(async e=>{
 const file=e.target.files[0],game=saveImportTarget||current;saveImportTarget=null;if(!file||!game)return;
 let temporaryCore,temporaryProtection;
 try{
  const core=coreFor(game),extension=file.name.split('.').pop().toLowerCase();
  if(extension==='jgsav'&&core.adapter!=='jgenesis')throw Error('このセーブはjgenesis用です。コアを変更してから読み込んでください。');
  const extensions=core.adapter==='jgenesis'?['sav','srm','jgsav']:game.system==='nds'?['sav','srm','dsv']:['sav','srm'];
  if(!extensions.includes(extension))throw Error('対応するセーブファイルを選択してください（'+extensions.map(value=>'.'+value).join(' / ')+'）。');
  if(!file.size||file.size>core.maxSave)throw Error('セーブファイルのサイズを確認してください。');
  const bytes=new Uint8Array(await file.arrayBuffer());if(!bytes.length||bytes.length>core.maxSave)throw Error('セーブファイルのサイズを確認してください。');
  if(coreFor(game).adapter!=='jgenesis'&&(/\.jgsav$/i.test(file.name)||new TextDecoder().decode(bytes.subarray(0,8))==='LPJGSV01'))throw Error('このセーブはjgenesis用です。コアを変更してから読み込んでください。');
  if(engine){
   if(current?.id!==game.id)throw Error('プレイ中のゲームを終了してから読み込んでください。');
   await persist({reason:'before-import'});engine.restore(bytes);await persist({reason:'import'});engine.reset();closeSheet();toast('セーブを読み込みました。ゲームを再起動します。');
  }else{
   temporaryProtection=new SaveProtection(()=>{});await temporaryProtection.open(game,coreFor(game).id);
   const rom=await db.get('roms',game.id);if(!rom)throw Error('ROMが見つかりません。');
   temporaryCore=createCore(document.createElement('div'),game);
   await temporaryCore.load(rom,game);temporaryCore.pause(true);temporaryCore.restore(bytes);
   await temporaryProtection.save(temporaryCore,{clean:true,reason:'import'});
   showDetails(game);toast('セーブデータをインポートしました。');
  }
 }catch(errorValue){error(errorValue);}finally{temporaryCore?.close();await temporaryProtection?.close();e.target.value='';}
});
async function exitGame(){if(linkStarting||exiting)return;exiting=true;try{const wasLinked=!!link;await link?.close();if(!engine)return;setPause(true);await persist({checkpoint:settings.recovery&&!wasLinked,clean:true,reason:'exit'});if(current&&!current.cover){try{const cover=engine.screenshot(),updated=await db.setGameCover(current.id,{cover,coverSource:'screenshot'},{onlyMissing:true});if(updated)Object.assign(current,updated);}catch(e){console.warn('Cover image could not be stored:',e.name);}}if(current){const stored=await db.get('library',current.id);if(stored)await db.put('library',current.id,{...stored,playDuration:current.playDuration||0});}dialogResume=false;$('#sheet').close();clearImportedSkin();engine.close();await protection.close();releaseSkin();engine=null;current=null;linkPanel.reset();updateLinkButton();linkMessage='';linkSaveBlocked=false;skinData=null;pressed.clear();$('#screen').replaceChildren();$('#player').hidden=true;if(document.fullscreenElement)await document.exitFullscreen();await refresh();}finally{exiting=false;}}
function download(bytes,name){const url=URL.createObjectURL(new Blob([bytes]));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function updateSpeedButton(){
 const speed=link?1:settings.speed,button=$('#boost');
 button.querySelector('span').textContent=speed+'×';button.disabled=!!link;button.classList.toggle('fast',speed>1);
 button.setAttribute('aria-label',link?'通信中は1倍速':`速度 ${speed}倍。押すと${speed%5+1}倍`);button.title=link?'通信中は1倍速':'速度切替（1〜5倍） / Tab';
}
function skinAction(command){
 if(link||linkStarting){if(command==='menu')showGameMenu();else toast('通信中はこの操作を使えません。');return;}
 if(/^fastForward(?:[234]x)?$/.test(command)){engine.setSpeed(Number(command.match(/[234]/)?.[0]||5));return()=>engine?.setSpeed(settings.speed);}
 const actions={menu:showGameMenu,quickSave:()=>{setPause(true);confirmStateSave(true);},quickLoad:showQuickLoad,toggleFastForward:cycleSpeed,
  saveStates:()=>{setPause(true);showStates();},skins:()=>{setPause(true);showSkins(current.system,current);},
  cheatCodes:()=>{if(coreFor(current).cheats){setPause(true);showCheats();}else toast('このコアではチートを使えません。');},
  filters:()=>{setPause(true);showVideoSettings();dialogResume=true;},resolution:()=>{setPause(true);showVideoSettings();dialogResume=true;},
  controllers:()=>{setPause(true);showControllers();dialogResume=true;},
  volume:()=>{settings.muted=!settings.muted;applySettings();},haptics:()=>{settings.haptics=!settings.haptics;applySettings();toast(settings.haptics?'振動：オン':'振動：オフ');},
  reverseScreens:()=>{if(current.system!=='nds'){toast('2画面のゲームで使えます。');return;}settings.ndsSwapScreens=!settings.ndsSwapScreens;applySettings();layoutSkin();},
  toggleControlls:()=>{settings.touchControls=!settings.touchControls;applySettings();layoutSkin();},restart:()=>{setPause(true);confirmRestart();},quit:()=>{setPause(true);sheet('ゲームを終了しますか？','<div class="sheet-actions"><button class="secondary" id="skin-stay">キャンセル</button><button class="primary" id="skin-exit">終了</button></div>',true);$('#skin-stay').onclick=closeSheet;$('#skin-exit').onclick=()=>exitGame().catch(error);},
  screenshot:()=>{const a=document.createElement('a');a.href=engine.screenshot();a.download=current.name+'.png';a.click();}
 };
 const handler=actions[command];if(!handler){toast('このスキンの操作はWeb版では使えません。');return;}
 try{Promise.resolve(handler()).catch(error);}catch(e){error(e);}
}
function cycleSpeed(){if(!engine||paused||link)return;settings.speed=settings.speed%5+1;applySettings();}
$('#boost').onclick=cycleSpeed;
$('#boost').onkeydown=e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();e.stopPropagation();if(!e.repeat)cycleSpeed();}};
let fpsEngine=null,fpsAt=0,fpsFrames=0;
setInterval(()=>{const now=performance.now(),frames=engine?.frameCount?.()||0;if(!engine||paused||engine!==fpsEngine){fpsEngine=engine;fpsAt=now;fpsFrames=frames;$('#fps-meter').textContent=paused?'一時停止':'計測中…';return;}if(now-fpsAt>=1000){const fps=Math.max(0,(frames-fpsFrames)*1000/(now-fpsAt));$('#fps-meter').textContent=$('#player').dataset.builtin==='true'?`${fps.toFixed(1)} fps · ${link?1:settings.speed}×`:`処理 ${fps.toFixed(1)} fps · ${link?1:settings.speed}倍`;fpsAt=now;fpsFrames=frames;}},250);
async function showOffline(){
 sheet('オフラインで使う','<p class="sheet-note" id="offline-status">保存状態を確認しています…</p><button class="primary" id="offline-download" disabled>ダウンロード</button><p class="sheet-note">必要なファイルをダウンロードすると、ネットに接続せず遊べます。ROMはあらかじめライブラリに追加してください。</p>');
 const button=$('#offline-download'),status=$('#offline-status');
 const update=s=>{if(status.isConnected)status.textContent=s.ready?'オフラインで遊べます。':`${s.cached} / ${s.total} ファイル保存済み（全体 ${bytesLabel(s.bytes)}）`;};
 try{update(await offlineStatus());}catch(e){if(status.isConnected)status.textContent=e.message;}
 button.onclick=guardUpdateTask(async()=>{
  button.disabled=true;
  try{
   const result=await offlineStatus(true,p=>{if(status.isConnected)status.textContent=`保存中… ${p.progress} / ${p.total}`;});
   update(result);toast('ダウンロードが完了しました。');
  }catch(e){error(e);}finally{button.disabled=false;}
 });
 // Register the handler before enabling input; never accept a click during the
 // asynchronous status query. Captured elements cannot update a later sheet.
 button.disabled=false;
}
async function applyCheats(next,game=current){const old=cheatsFor(game),live=current?.id===game.id?engine:null;try{live?.setCheats(next);const fresh=await db.get('library',game.id);if(!fresh)throw Error('ゲームが見つかりません。');const changes=defaultCore(game)?{cheats:next}:{coreCheats:{...fresh.coreCheats,[coreFor(game).key]:next}};await db.put('library',game.id,{...fresh,...changes});Object.assign(game,changes);}catch(e){live?.setCheats(old);throw e;}}
function showCheats(game=current){if(!coreFor(game).cheats)return;const list=cheatsFor(game),mgba=coreFor(game).adapter==='mgba';const formats=game.system==='gba'?[[0,'自動判定'],[1,'CodeBreaker'],[2,'GameShark'],[3,'Action Replay'],[4,'VBA（アドレス:値）']]:[[0,'自動判定'],[1,'GameShark'],[2,'Game Genie'],[3,'VBA（アドレス:値）']];
 sheet('チート',`<p class="sheet-note">ゲームのバージョンに合うコードを入力してください。使用前にセーブを書き出しておきましょう。</p><div class="settings-group">${list.map((c,i)=>`<div class="row"><label class="cheat-toggle"><input type="checkbox" data-cheat-toggle="${i}" ${c.enabled?'checked':''}> ${esc(c.name)}</label><button class="danger" data-cheat-delete="${i}">削除</button></div>`).join('')}</div><div class="label">追加</div><div class="stack"><input class="text-input" id="cheat-name" aria-label="チート名" maxlength="100" placeholder="名前"><select class="text-input" id="cheat-type" aria-label="コード形式">${(mgba?formats:[[0,'コアのコード形式']]).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select><textarea class="text-input" id="cheat-code" aria-label="チートコード" rows="5" maxlength="16384" placeholder="コードを1行ずつ入力"></textarea><button class="primary" id="cheat-add">有効にして追加</button></div>${mgba?'':'<p class="sheet-note">追加したコードが効いているかは、ゲーム内で確認してください。</p>'}`,true);
 $$('[data-cheat-toggle]').forEach(b=>b.onchange=async()=>{try{await applyCheats(list.map((c,i)=>i===+b.dataset.cheatToggle?{...c,enabled:b.checked}:c),game);showCheats(game);}catch(e){b.checked=!b.checked;error(e);}});
 $$('[data-cheat-delete]').forEach(b=>b.onclick=async()=>{try{await applyCheats(list.filter((_,i)=>i!==+b.dataset.cheatDelete),game);showCheats(game);}catch(e){error(e);}});
 $('#cheat-add').onclick=async()=>{const button=$('#cheat-add'),code=$('#cheat-code').value.trim();if(!code){toast('コードを入力してください。');return;}if(list.length>=100){toast('チートは100件までです。');return;}button.disabled=true;try{await applyCheats([...list,{name:$('#cheat-name').value.trim()||`チート ${list.length+1}`,code,type:Number($('#cheat-type').value),enabled:true}],game);showCheats(game);toast('チートを追加しました。');}catch(e){error(e);button.disabled=false;}};
}
function showConnectedMenu(){release();sheet('MENU',`<p class="sheet-note">通信中は1倍速です。ステート・チートの変更はできません。</p><div class="settings-group">${action('ゲームに戻る','play','play')}${action('通信の状態','link','wifi')}${action('通信を中止','disconnect','back')}${action('ライブラリに戻る','exit','back')}</div>`,true);bindActions($('#sheet-body'),{play:closeSheet,link:showLink,disconnect:async()=>{await link?.close();closeSheet();},exit:exitGame});}
function updateLinkButton(){
 const button=$('#player-link'),state=linkStarting?'connecting':link?.closed?'connecting':link?.connected?'connected':link?.joined?'waiting':link?'connecting':'idle';
 button.hidden=!engine||current?.system!=='gba'||!coreFor(current).link;button.dataset.state=state;
 const label=state==='connected'?'GBA通信：接続中':state==='waiting'?`GBA通信：部屋 ${link.room} で待機中`:state==='connecting'?'GBA通信：準備中':'GBA通信';
 button.setAttribute('aria-label',label);button.title=label;
}
function showLink(){
 if(!engine||current?.system!=='gba'||!coreFor(current).link||exiting)return;
 if($('#sheet').open)closeSheet();release();renderLinkPanel();linkPanel.show();
}
function renderLinkPanel(){
  const active=link,body=$('#link-panel-body');
  body.innerHTML=`<p id="link-status" role="status">${esc(linkMessage||'部屋を作るか、相手の部屋に参加します。')}</p>${active?`<div class="stack"><label for="link-room-number">部屋番号</label><div class="link-room-field"><input class="text-input" id="link-room-number" readonly inputmode="none" value="${esc(active.room||'準備中…')}"><button class="link-copy" id="link-copy" aria-label="部屋番号をコピー" ${active.joined&&!active.closed?'':'disabled'}>${icon('copy')}<span>コピー</span></button></div><button class="secondary danger" id="link-stop" ${active.closed?'disabled':''}>通信を中止</button></div>`:`<div class="stack"><button class="primary" id="link-create" ${linkStarting?'disabled':''}>部屋を作る</button><label for="link-input">部屋番号で参加</label><div class="link-room-field"><input class="text-input" id="link-input" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="4桁の番号" ${linkStarting?'disabled':''}><button class="secondary" id="link-join" ${linkStarting?'disabled':''}>参加</button></div></div>`}<p class="sheet-note">開始すると中継サーバーに接続します。ROM・セーブファイルは送信しません。</p><details class="sheet-note"><summary>通信について</summary><p>パネル上部をドラッグすると移動できます。閉じても通信は続きます。</p><p>Celio方式に対応するGBAゲーム用です。相手も同じ中継サーバーを使ってください。部屋番号はパスワードではありません。</p><p>ゲームの通信データ（プレイヤー情報や交換内容など）は、中継サーバー経由で相手に届きます。</p><p>開始前に端末内へバックアップします。切断や中止時は通信前に戻ります。ゲーム内で通信を終えると結果を保存します。接続後に別のタブやアプリへ移ると切断します。</p><p><a href="privacy.html" target="_blank" rel="noopener">プライバシー</a></p></details>`;
  const update=text=>{linkMessage=text;const el=$('#link-status');if(el)el.textContent=text;const number=$('#link-room-number');if(number&&link)number.value=link.room||'準備中…';const copy=$('#link-copy');if(copy)copy.disabled=!link?.joined||!!link?.closed;updateLinkButton();};
  const start=async room=>{
    if(link||linkStarting)return;
    if(room!==''&&!/^\d{4}$/.test(room)){toast('4桁の部屋番号を入力してください。');return;}
    linkStarting=true;setPause(true);update('バックアップを保存しています…');body.querySelectorAll('button,input').forEach(b=>b.disabled=true);
    const core=engine,game=current,safety=new LinkSafety(protection,core);
    try{
      await safety.begin();if(engine!==core||current!==game)throw new Error('ゲームが変更されました。');
      const n=new RoomLink(core.linkIO(),{onStatus:text=>{if(n.connected&&document.hidden){n.close('画面を離れたため接続を終了しました。');return;}update(text);},onEnd:async(text,{keep})=>{
        setPause(true);update('通信を終了しています…');if($('#link-stop'))$('#link-stop').disabled=true;
        try{await safety.finish(keep);linkMessage=text+(keep?'':' 通信前に戻しました。');}
        catch(e){linkSaveBlocked=true;linkMessage='復旧を完了できませんでした。保存済みのバックアップを残して終了します。';error(e);}
        finally{if(link===n)link=null;core.setCheats(game.cheats||[]);applySettings();}
        if(linkSaveBlocked){await exitGame();toast(linkMessage);return;}
        if(current?.system==='gba')renderLinkPanel();toast(linkMessage);
      }});
      link=n;core.setCheats([]);linkStarting=false;applySettings();setPause(false);n.start(room);renderLinkPanel();
    }catch(e){if(link)await link.close(e.message);else{linkMessage=e.message;error(e);}}
    finally{linkStarting=false;updateLinkButton();if(!link&&current?.system==='gba')renderLinkPanel();}
  };
  if($('#link-create'))$('#link-create').onclick=()=>start('');
  if($('#link-join'))$('#link-join').onclick=()=>{const number=$('#link-input').value.trim();if(!/^\d{4}$/.test(number)){toast('4桁の部屋番号を入力してください。');return;}return start(number);};
  if($('#link-input'))$('#link-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#link-join').click();}};
  if($('#link-copy'))$('#link-copy').onclick=async()=>{if(!link?.joined||link.closed)return;try{await navigator.clipboard.writeText(link.room);toast('コピーしました。');}catch{const input=$('#link-room-number');input?.focus();input?.select();toast('部屋番号を選択してコピーしてください。');}};
  if($('#link-stop'))$('#link-stop').onclick=async()=>{const button=$('#link-stop');button.disabled=true;await link?.close();};
  updateLinkButton();linkPanel.place();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(settings.theme==='auto')applySettings();});
setupOffline().catch(e=>console.warn('Offline setup:',e.message));
function openGameLink(){if(engine||!location.hash.startsWith('#game='))return;const game=library.find(g=>g.id===location.hash.slice(6));if(game)showDetails(game);else toast('このブラウザにゲームがありません。先にROMを追加してください。');}
window.addEventListener('hashchange',()=>{if(engine)return;tab=tabFromHash();render();openGameLink();});
if(await startAutoUpdates(()=>appReady&&!engine&&!launching&&!importing&&!exiting&&!link&&!linkStarting&&!saveLock&&tab!=='imports',()=>toast('更新しました。'))!==false){
 applySettings();refresh().then(()=>{openGameLink();appReady=true;}).catch(e=>{error(e);$('#content').innerHTML='<div class="empty-library"><h2>保存データを開けませんでした</h2><p>プライベートブラウズを終了するか、ブラウザの保存設定を確認してください。</p></div>';});
}
