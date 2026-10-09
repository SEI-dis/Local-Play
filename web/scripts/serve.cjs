const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.data':'application/octet-stream'};
function createStaticServer({threeDSBuild=process.env.LOCAL_PLAY_3DS_BUILD}={}){
 let development=null;
 if(threeDSBuild){
  const manifest=JSON.parse(fs.readFileSync(path.resolve(threeDSBuild,'../build-manifest.json'),'utf8'));
  if(!/^[a-f0-9]{40}$/.test(manifest.stateABI))throw Error('Invalid 3DS build identity');
  for(const name of ['local_3ds.js','local_3ds.wasm']){
   const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(threeDSBuild,name))).digest('hex');
   if(hash!==manifest.files[name]?.sha256)throw Error('3DS build manifest mismatch: '+name);
  }
  development={stateABI:manifest.stateABI};
 }
 return http.createServer((req,res)=>{
 // This preview server has no write, upload, proxy or logging route.
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD','Cache-Control':'no-store'}).end();return;}
 if(development){
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/dev-capabilities.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':'globalThis.__LOCAL_PLAY_DEV_3DS__=true;globalThis.__LOCAL_PLAY_3DS_ABI__='+JSON.stringify(development.stateABI)+';');return;}
  const asset={'/__dev3ds__/local_3ds.js':'local_3ds.js','/__dev3ds__/local_3ds.wasm':'local_3ds.wasm'}[pathname];
  if(asset){res.writeHead(200,{'Content-Type':asset.endsWith('.wasm')?'application/wasm':'text/javascript','Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(path.join(threeDSBuild,asset)).pipe(res);return;}
 }
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':fs.statSync(file).size});
 if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
});}
module.exports={createStaticServer};
if(require.main===module){const server=createStaticServer();server.listen(Number(process.env.PORT??4173),'127.0.0.1',()=>{console.log('PalmoEMU: http://127.0.0.1:'+server.address().port);process.send?.({port:server.address().port});});if(process.send)process.on('disconnect',()=>server.close());}
