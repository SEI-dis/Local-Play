// SPDX-License-Identifier: AGPL-3.0-or-later
// Test-only loopback harness for the unmodified pinned GPL Celio classes.
const path=require('node:path'),http=require('node:http'),{pathToFileURL}=require('node:url');
const root=process.env.CELIO_SERVER_ROOT,modules=require('node:module').createRequire(path.join(root,'package.json'));
(async()=>{
 const {Server}=modules('socket.io'),{Client}=await import(pathToFileURL(path.join(root,'test-built/client.js'))),{SessionManager}=await import(pathToFileURL(path.join(root,'test-built/sessionManager.js')));
 const server=http.createServer(),io=new Server(server,{cors:{origin:'*'},transports:['websocket'],pingInterval:500,pingTimeout:2000}),manager=new SessionManager(),clients=new Map();console.log=console.warn=()=>{};
 io.on('connection',socket=>{const id=socket.handshake.auth.clientId;socket.onAny((event,...args)=>process.send?.({event,args:args.filter(v=>typeof v!=='function')}));clients.set(id,new Client(id,socket,manager,id=>clients.delete(id)));});
 process.on('message',m=>{if(m==='drop')io.disconnectSockets(true);if(m==='stop'){io.close();server.close();process.exit(0);}});
 server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
})().catch(e=>{console.error(e);process.exit(1);});
