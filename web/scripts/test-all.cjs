// SPDX-License-Identifier: AGPL-3.0-or-later
// Run isolated synthetic tests; never attach to the user's browser profile.
const fs=require('node:fs'),path=require('node:path'),{spawnSync,fork}=require('node:child_process');
const root=path.resolve(__dirname,'..'),scripts=require('../package.json').scripts;
const webkit=process.argv.includes('--webkit');
const supported=new Set(['browser','visibility','state-ui','responsive-skins','layout-sizing','layout-alignment','runtime-performance','speed-control','pitch-audio','privacy','native-menu','nds-browser','nds-skin','system-skins','link-panel','room-link','covers','multicore','skin-compatibility','skins','bundled-skins','skin-orientation','update','extended-save']);
const output=path.join(root,'test-results','suite-'+(webkit?'webkit':'chromium'));fs.mkdirSync(output,{recursive:true});
async function startServer(){
 if(!process.argv.includes('--serve'))return null;
 const server=fork(path.join(__dirname,'serve.cjs'),[],{env:{...process.env,PORT:'0'},windowsHide:true,stdio:['ignore','ignore','inherit','ipc']});
 try{
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Test server did not become ready')),10000);
   server.once('message',message=>{clearTimeout(timer);resolve(message.port);});
   server.once('error',error=>{clearTimeout(timer);reject(error);});
   server.once('exit',code=>{clearTimeout(timer);reject(Error('Test server exited: '+code));});
  });
  process.env.TEST_URL=`http://127.0.0.1:${port}/`;return server;
 }catch(error){server.kill();throw error;}
}
function runSuite(){
const results=[];
for(const [name,command]of Object.entries(scripts)){
 if(name!=='test'&&(!name.startsWith('test:')||name==='test:all'))continue;
 const match=command.match(/^(node|python) (.+)$/);if(!match)throw Error('Unsupported test command: '+command);
 const args=match[2].split(' '),test=path.basename(args.at(-1),'.cjs');
 if(webkit&&!supported.has(test))continue;
 const executable=match[1]==='node'?process.execPath:process.env.PYTHON||(process.platform==='win32'?'python':'python3');
 const start=Date.now(),run=spawnSync(executable,args,{cwd:root,env:{...process.env,BROWSER_ENGINE:webkit?'webkit':'chromium'},encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});
 const log=[run.stdout,run.stderr,run.error?.message].filter(Boolean).join('\n');fs.writeFileSync(path.join(output,test+'.log'),log);
 const passed=run.status===0;results.push({name,passed,milliseconds:Date.now()-start});
 console.log(`${passed?'PASS':'FAIL'} ${name} (${((Date.now()-start)/1000).toFixed(1)}s)`);
 if(!passed)console.error(log.slice(-6000));
}
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({engine:webkit?'webkit':'chromium',results},null,2)+'\n');
console.log(`${results.filter(r=>r.passed).length}/${results.length} suites passed. Logs: ${output}`);
if(!results.length||results.some(r=>!r.passed))process.exitCode=1;
}
(async()=>{const server=await startServer();try{runSuite();}finally{server?.kill();}})().catch(error=>{console.error(error.message);process.exitCode=1;});
