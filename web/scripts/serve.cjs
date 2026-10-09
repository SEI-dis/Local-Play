const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.data':'application/octet-stream'};
function createStaticServer(){return http.createServer((req,res)=>{
 // This preview server has no write, upload, proxy or logging route.
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD','Cache-Control':'no-store'}).end();return;}
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end('Not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':fs.statSync(file).size});
 if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
});}
module.exports={createStaticServer};
if(require.main===module){const server=createStaticServer();server.listen(Number(process.env.PORT??4173),'127.0.0.1',()=>{console.log('Manic EMU Web: http://127.0.0.1:'+server.address().port);process.send?.({port:server.address().port});});if(process.send)process.on('disconnect',()=>server.close());}
