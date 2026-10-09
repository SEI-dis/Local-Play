/* Ported from ManicEMU GameOption / SaveStateListView / ASListPage.
   Copyright © 2026 Manic EMU. Created by Daiuno.
   Modified for Web on 2026-10-08. See sources/manicemu-ui/README.md. */
// SPDX-License-Identifier: AGPL-3.0-or-later
import {escapeHTML as esc,icon} from './shared.js';

// GameOption.defaultGroupAndSort, filtered by the current scene/core just as
// availableOptions does upstream. Empty groups are not rendered.
export const gameOptionGroups=[
 ['cover','skins'],
 ['stateList','importSave','shareSave','saveData'],
 ['switchCore'],
 ['cheatCode','manual'],
 ['saveState','quickLoadState','volume','fastForward','preservePitch','shaders','screenShot',
  'haptic','controllerSetting','deadZone','swapScreen','frameLimit','hideControls','screenScaling','showFps','netplay','fullScreen','reload','quit'],
 ['gameOptionSort','gameShortcut'],
 ['copyLink'],
 ['delete']
];
export const gameShortcuts=[['exit','終了','power'],['restart','再起動','reload'],['newState','セーブ','save'],['quickLoad','クイックロード','history']];
export function orderedOptionGroups(order=[]){
 const known=new Set(gameOptionGroups.flat()),seen=new Set(),groups=[];
 for(const group of Array.isArray(order)?order:[]){if(!Array.isArray(group))continue;const ids=group.filter(id=>known.has(id)&&!seen.has(id)&&seen.add(id));if(ids.length)groups.push(ids);}
 for(const group of gameOptionGroups){const missing=group.filter(id=>!seen.has(id));if(missing.length)groups.push(missing);}
 return groups;
}
export const groupedOptions=(cells,order)=>orderedOptionGroups(order).map(group=>group.filter(id=>cells[id]).map(id=>`<div class="native-option" data-menu-option="${id}">${cells[id]}</div>`).join('')).filter(Boolean).map(rows=>`<div class="settings-group">${rows}</div>`).join('');

export function nativeAction(label,id,ic,value='',extra=''){
 const tag=id?'button':'div';
 return `<${tag} class="row native-row ${extra}" ${id?`data-action="${id}"`:''}>${icon(ic)}<span class="native-label">${esc(label)}</span>${value?`<span class="native-value">${esc(value)}</span>`:''}${id?icon('chevron'):''}</${tag}>`;
}
export function nativeSelect(label,key,ic,options,value){
 const selected=options.find(([id])=>String(id)===String(value))||options[0];
 return `<label class="row native-row native-select">${icon(ic)}<span class="native-label">${esc(label)}</span><span class="native-value" aria-hidden="true">${esc(selected[1])}</span>${icon('chevron')}<select aria-label="${esc(label)}" data-setting="${key}">${options.map(([id,title])=>`<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(title)}</option>`).join('')}</select></label>`;
}
export function nativeToggle(label,key,ic,checked,{invert=false,detail=''}={}){
 return `<label class="row native-row">${icon(ic)}<span class="native-label">${esc(label)}${detail?`<small>${esc(detail)}</small>`:''}</span><input aria-label="${esc(label)}" data-setting="${key}" ${invert?'data-invert="true"':''} type="checkbox" ${checked?'checked':''}></label>`;
}
export function gamePlaySummary(game){
 if(!game.lastPlayed)return '未プレイ。冒険を始めましょう';
 const elapsed=Math.max(0,Date.now()-game.lastPlayed),minutes=Math.floor((game.playDuration||0)/60000);
 const ago=elapsed<60000?'たった今':elapsed<3600000?`${Math.floor(elapsed/60000)}分前`:elapsed<86400000?`${Math.floor(elapsed/3600000)}時間前`:elapsed<2592000000?`${Math.floor(elapsed/86400000)}日前`:`${Math.floor(elapsed/2592000000)}ヶ月前`;
 return `${ago}プレイ${game.playDuration==null?'':` · 合計${minutes>=60?`${Math.floor(minutes/60)}時間`:''}${minutes%60}分`}`;
}
// GameInfoDetailView's pinned title/subtitle/play/safe-mode block.
export function gameInfoHero(game){
 return `<header class="game-info-hero"><div class="game-info-title"><h2>${esc(game.name)}</h2><button data-action="rename" aria-label="名前を変更">${icon('pencil')}</button></div><p class="game-info-subtitle">${icon('starCircle')}<span>${gamePlaySummary(game)}</span></p><button class="game-info-play" data-action="play">${icon('play')}<span>プレイ</span></button><button class="game-info-safe" data-action="safeMode">セーフモード ${icon('arrowUpRight')}</button></header>`;
}
export const stateDate=at=>{const date=new Date(at);return `<time datetime="${date.toISOString()}">${esc(date.toLocaleDateString('ja-JP'))}<span>${esc(date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}))}</span></time>`;};

// SaveStateListView.getSaveStatesSection: thumbnail, title, date, then either
// a small Continue button or an edit-mode checkbox. No Save action in the list.
export function stateRow(state,index,{editing=false,compatible=true,automatic=false}={}){
 const title=`セーブ ${index+1}`;
 return `<article class="save-entry">${state.image?`<img class="save-thumb" src="${esc(state.image)}" alt="${title}の画面">`:`<div class="save-thumb save-empty">${icon('image')}</div>`}<div class="save-caption"><strong>${title}</strong>${stateDate(state.at)}${compatible?'':'<small class="danger">非対応のコア</small>'}</div>${editing?`<input type="checkbox" data-state-select="${index}" aria-label="${title}を選択">`:`<button class="state-continue" data-slot-load="${index}" ${automatic?`data-recover="${index}"`:''} aria-label="${title}から続ける" ${compatible?'':'disabled'}>${icon('play')}<span>続ける</span></button>`}</article>`;
}
