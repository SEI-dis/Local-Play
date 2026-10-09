// SPDX-License-Identifier: AGPL-3.0-or-later
import {coreRegistry,supportsGame} from './core-registry.js';
const stores=['library','roms','saves','states','backups','recoveries','sessions','skins','coverCatalogs'];
const database=new Promise((resolve,reject)=>{
 const r=indexedDB.open('manicemu-web',4);let blocked=false;
 r.onupgradeneeded=()=>{for(const s of stores)if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s);};
 r.onblocked=()=>{blocked=true;reject(new Error('保存機能の更新が必要です。このアプリのほかのタブを閉じ、このページを開き直してください。サイトデータは削除しないでください。'));};
 r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);
});
function write(db,names){try{return db.transaction(names,'readwrite',{durability:'strict'});}catch(e){if(e instanceof TypeError)return db.transaction(names,'readwrite');throw e;}}
export async function get(store,key){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function all(store){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function put(store,key,data){const db=await database;return new Promise((resolve,reject)=>{const tx=write(db,store);tx.objectStore(store).put(data,key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('保存が中断されました。'));tx.onerror=()=>reject(tx.error);});}
export async function remove(store,key){const db=await database;return new Promise((resolve,reject)=>{const tx=write(db,store);tx.objectStore(store).delete(key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}
// Commit a confirmed selection of this game's manual states as one operation.
export async function removeStates(id,keys){
 if(!keys.length||keys.some(key=>typeof key!=='string'||!key.startsWith(id+':')))throw new Error('削除するステートを確認してください。');
 const db=await database;return new Promise((resolve,reject)=>{const tx=write(db,'states');for(const key of new Set(keys))tx.objectStore('states').delete(key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('削除できませんでした。'));});
}
export async function addGame(game,bytes){const db=await database;return new Promise((resolve,reject)=>{const tx=write(db,['library','roms']);tx.objectStore('library').put(game,game.id);tx.objectStore('roms').put(bytes,game.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}
// Update only artwork, atomically. A delayed download must neither resurrect a
// deleted game nor replace a hand-picked cover or newer game metadata.
export async function setGameCover(id,cover,{onlyMissing=false}={}){const db=await database;return new Promise((resolve,reject)=>{
 const tx=write(db,'library'),store=tx.objectStore('library'),request=store.get(id);let result=null;
 request.onsuccess=()=>{const game=request.result;if(!game||(onlyMissing&&game.cover&&game.coverSource!=='screenshot'))return;Object.assign(game,{cover:cover.cover,coverSource:cover.coverSource,coverTitle:cover.coverTitle||'',coverUrl:cover.coverUrl||''});store.put(game,id);result=game;};
 tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||new Error('カバーを保存できませんでした。'));tx.onerror=()=>{};
});}
// Change only the skin field; do not overwrite newer names, favorites or cheats.
export async function setGameSkin(id,skinId){const db=await database;return new Promise((resolve,reject)=>{
 const tx=write(db,['library']),store=tx.objectStore('library'),request=store.get(id);let failure;
 request.onsuccess=()=>{const game=request.result;if(!game){failure=new Error('ゲームが見つかりません。');tx.abort();return;}if(skinId)game.skinId=skinId;else delete game.skinId;store.put(game,id);};
 tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error||new Error('スキン設定を保存できませんでした。'));tx.onerror=()=>{};
});}
// Preserve ROM/save data and other game metadata when editing control positions.
export async function setGameControls(id,layout){const db=await database;return new Promise((resolve,reject)=>{
 const tx=write(db,['library']),store=tx.objectStore('library'),request=store.get(id);let failure;
 request.onsuccess=()=>{const game=request.result;if(!game){failure=new Error('ゲームが見つかりません。');tx.abort();return;}if(layout===null)delete game.controlLayout;else game.controlLayout=layout;store.put(game,id);};
 tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error||new Error('ボタンの設定を保存できませんでした。'));tx.onerror=()=>{};
});}
// Deleted skins cannot leave game-specific overrides pointing to missing artwork.
export async function removeSkin(id){const db=await database;return new Promise((resolve,reject)=>{
 const tx=write(db,['skins','library']);tx.objectStore('skins').delete(id);
 const request=tx.objectStore('library').openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const game=cursor.value;if(game.skinId===id){delete game.skinId;cursor.update(game);}cursor.continue();};
 tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('スキンを削除できませんでした。'));tx.onerror=()=>{};
});}
export async function removeGame(id){if(!navigator.locks)throw new Error('保存を保護するため、最新版のブラウザを使用してください。');return navigator.locks.request('local-game:'+id,{ifAvailable:true},lock=>{if(!lock)throw new Error('このゲームは別のタブでプレイ中です。終了してから削除してください。');return deleteGame(id);});}
export async function setGameCore(id,key){
 if(!navigator.locks)throw Error('最新版のブラウザを使用してください。');
 return navigator.locks.request('local-game:'+id,{ifAvailable:true},async lock=>{
  if(!lock)throw Error('このゲームはプレイ中です。終了してからコアを変更してください。');
  const db=await database;return new Promise((resolve,reject)=>{
   const tx=write(db,'library'),store=tx.objectStore('library'),request=store.get(id);let result,failure;
   request.onsuccess=()=>{const game=request.result,core=coreRegistry[game?.system]?.find(c=>c.key===key);if(!game||!core||!supportsGame(core,game)){failure=Error('このゲームで選択できるコアではありません。');tx.abort();return;}result={...game,coreKey:key};store.put(result,id);};
   tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error||Error('コアを変更できませんでした。'));tx.onerror=()=>{};
  });
 });
}
async function deleteGame(id){const db=await database;return new Promise((resolve,reject)=>{const tx=write(db,['library','roms','saves','states','backups','recoveries','sessions']);for(const s of ['library','roms','saves','backups','recoveries','sessions']){tx.objectStore(s).delete(id);if(s!=='library'&&s!=='roms')tx.objectStore(s).delete(IDBKeyRange.bound(id+'@',id+'@\uffff'));}tx.objectStore('states').delete(IDBKeyRange.bound(id+':',id+':\uffff'));tx.objectStore('states').delete(IDBKeyRange.bound(id+'@',id+'@\uffff'));tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});}
const equal=(a,b)=>!!a&&!!b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
// Save, retained generations and crash marker commit together, or none do.
// No asynchronous hashing/network calls are allowed inside this transaction.
export async function commitProtection(id,sessionId,save,recovery,clean=false){
 const db=await database;return new Promise((resolve,reject)=>{
  const tx=write(db,['saves','backups','recoveries','sessions']);let failure;
  const sessions=tx.objectStore('sessions'),request=sessions.get(id);
  request.onsuccess=()=>{
   const session=request.result;
   if(!session||session.id!==sessionId){failure=new Error('別のタブで保存中のため、このタブでの保存を中止しました。');tx.abort();return;}
   if(save?.bytes?.length){
    const saves=tx.objectStore('saves'),old=saves.get(id);
    old.onsuccess=()=>{
     if(old.result?.bytes?.length&&!equal(new Uint8Array(old.result.bytes),new Uint8Array(save.bytes))){
      const history=tx.objectStore('backups'),r=history.get(id);
      r.onsuccess=()=>history.put([old.result,...(r.result||[])].slice(0,5),id);
     }
     saves.put(save,id);
    };
   }
   if(recovery){const store=tx.objectStore('recoveries'),r=store.get(id);r.onsuccess=()=>store.put([recovery,...(r.result||[])].slice(0,5),id);}
   sessions.put({...session,dirty:!clean,checkedAt:Date.now()},id);
  };
  tx.oncomplete=resolve;tx.onabort=()=>reject(failure||tx.error||new Error('保存が中断されました。以前の保存データは残っています。'));tx.onerror=()=>{};
 });
}

export async function stateEntries(id){const db=await database;return new Promise((resolve,reject)=>{const list=[],r=db.transaction('states').objectStore('states').openCursor(IDBKeyRange.bound(id+':',id+':\uffff'));r.onsuccess=()=>{const c=r.result;if(!c){resolve(list);return;}list.push({key:c.key,value:c.value});c.continue();};r.onerror=()=>reject(r.error);});}
