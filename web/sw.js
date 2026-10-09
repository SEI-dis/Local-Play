// SPDX-License-Identifier: AGPL-3.0-or-later
importScripts('./offline-manifest.js');
const base=new URL('./',self.location.href),prefix='manic-web:'+base.pathname+':',cacheName=prefix+APP_OFFLINE.version;
const urls=APP_OFFLINE.files.map(f=>new URL(f,base).href),allowed=new Set(urls);
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(cacheName);await cache.addAll(APP_OFFLINE.shell.map(f=>new URL(f,base).href));})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(prefix)&&name!==cacheName)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 // Reject accidental writes before they reach any HTTP server once this worker
 // controls the page. First-load protection still depends on the app and CSP.
 if(!['GET','HEAD'].includes(e.request.method)){e.respondWith(new Response(null,{status:405,headers:{Allow:'GET, HEAD'}}));return;}
 const u=new URL(e.request.url);u.hash=''; // Tab/game fragments are local UI state, not a different app file.
 if(e.request.mode!=='navigate'&&(u.origin!==base.origin||u.search)){e.respondWith(new Response(null,{status:403}));return;}
 if(e.request.method!=='GET'||u.origin!==base.origin||u.search)return;
 if(u.href===base.href)u.pathname+='index.html';if(!allowed.has(u.href))return;
 e.respondWith((async()=>{const cache=await caches.open(cacheName),hit=await cache.match(u.href);if(hit)return hit;const response=await fetch(u.href);if(response.ok)await cache.put(u.href,response.clone());return response;})());
});
self.addEventListener('message',e=>{
 const port=e.ports[0];if(!port)return;
 if(e.data?.type==='activate-update'){
  e.waitUntil((async()=>{const sender=e.source?.url?new URL(e.source.url):null;if(!sender||sender.href!==new URL('update.html',base).href)throw new Error('更新画面から操作してください。');const open=await self.clients.matchAll({type:'window',includeUncontrolled:true});if(open.some(c=>c.id!==e.source.id&&c.url.startsWith(base.href)))throw new Error('この画面以外のアプリのタブを閉じてください。');port.postMessage({ok:true});await self.skipWaiting();})().catch(err=>port.postMessage({error:err.message})));
  return;
 }
 e.waitUntil((async()=>{const cache=await caches.open(cacheName);if(e.data?.type==='download'){
   let done=0;for(const url of urls){if(!await cache.match(url)){const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error('ダウンロードに失敗しました。接続を確認してください。');await cache.put(url,response);}port.postMessage({progress:++done,total:urls.length});}
 }else if(e.data?.type!=='status')throw new Error('オフライン保存を開始できませんでした。画面を開き直してください。');
 let count=0;for(const url of urls)if(await cache.match(url))count++;port.postMessage({done:true,ready:count===urls.length,cached:count,total:urls.length,bytes:APP_OFFLINE.bytes,version:APP_OFFLINE.version});
 })().catch(err=>port.postMessage({done:true,error:err.message})));
});
