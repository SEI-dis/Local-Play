// SPDX-License-Identifier: AGPL-3.0-or-later
// Distribution is pinned. User data never participates in downloading a core.
const MiB=1048576;
const definition=(key,name,adapter,id,directory,{maxRom=64*MiB,cheats=true,link=false,saveExtension='sav',maxSave=MiB,...extra}={})=>Object.freeze({key,name,adapter,id,directory,maxRom,cheats,link,saveExtension,maxSave,...extra});
const mgba=definition('mgba','mGBA Celio (64 MB)','mgba','mgba-rom64-link-v1','mgba',{link:true});
const jgenesis=definition('jgenesis','jgenesis','jgenesis','jgenesis-0.14.1-web-v1','jgenesis',{cheats:false,saveExtension:'jgsav',maxSave:4*MiB});
export const coreRegistry=Object.freeze({
 gba:[mgba,definition('vba-next','VBA-Next','retro','vba-next-web-v1','vba-next',{maxRom:32*MiB,cheats:false})],
 gb:[mgba,jgenesis],gbc:[mgba,jgenesis],
 nes:[definition('fceumm','FCEUmm','retro','fceumm-web-v1','nes'),jgenesis],
 snes:[definition('mesen-s','Mesen-S','retro','mesen-s-web-v1','snes'),jgenesis],
 md:[definition('clownmdemu','ClownMDEmu','retro','clownmdemu-web-v1','md'),jgenesis],
 nds:[definition('desmume2015','DeSmuME 2015','nds','desmume2015-web-v1','nds',{maxRom:512*MiB,maxSave:64*MiB,renderLimit:true}),definition('melonds','melonDS','nds','melonds-0.9.3-web-v1','melonds',{maxRom:512*MiB,maxSave:8*MiB,cheats:false,renderLimit:false})]
});
export function coreFor(game){const cores=coreRegistry[game.system];if(!cores)throw Error('未対応のゲーム機です。');return cores.find(c=>c.key===game.coreKey)||cores[0];}
export function defaultCore(game){return coreRegistry[game.system][0].key===coreFor(game).key;}
export function saveKey(game){return defaultCore(game)?game.id:game.id+'@'+coreFor(game).key;}
export function cheatsFor(game){return defaultCore(game)?game.cheats||[]:game.coreCheats?.[coreFor(game).key]||[];}
export function supportsGame(core,game){return game.size<=core.maxRom;}
