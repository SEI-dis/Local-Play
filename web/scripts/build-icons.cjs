// SPDX-License-Identifier: AGPL-3.0-or-later
// Rasterize the original SVG for iOS and PWA installation; no remote assets.
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_CHANNEL=msedge node scripts/build-icons.cjs
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'assets');
const sizes=[[180,'apple-touch-icon.png'],[192,'icon-192.png'],[512,'icon-512.png']];
function metadata(check=false){
  const names=new Map();
  for(const [size,name] of sizes){
    const bytes=fs.readFileSync(path.join(assets,name));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
    const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12),versioned=name.replace('.png','-'+hash+'.png');
    if(check)assert.deepEqual(fs.readFileSync(path.join(assets,versioned)),bytes,'Versioned icon differs: '+versioned);
    else fs.writeFileSync(path.join(assets,versioned),bytes);
    names.set(size,'assets/'+versioned);
  }
  // Different URLs prevent an earlier home-screen image from being reused.
  // Keep the unversioned PNGs for existing pages and installed applications.
  for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.html'))){
    const file=path.join(root,name),html=fs.readFileSync(file,'utf8'),pattern=/(<link rel="apple-touch-icon"[^>]*href=")[^"]+("[^>]*>)/;
    assert.match(html,pattern,'Missing touch icon: '+name);
    const updated=html.replace(pattern,(_,before,after)=>before+names.get(180)+after);
    if(check)assert.equal(html,updated,'Stale touch icon: '+name);else fs.writeFileSync(file,updated);
  }
  const file=path.join(root,'manifest.webmanifest'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  const icons=[{src:names.get(192),sizes:'192x192',type:'image/png',purpose:'any'},{src:names.get(512),sizes:'512x512',type:'image/png',purpose:'any maskable'}];
  // Installation metadata uses PNGs; the editable SVG remains the browser icon.
  if(check)assert.deepEqual(manifest.icons,icons,'Stale installation icons');
  else{manifest.icons=icons;fs.writeFileSync(file,JSON.stringify(manifest)+'\n');}
  console.log('PASS: all installation pages use current PNG icons with content-specific URLs.');
}
(async()=>{
  if(process.argv.includes('--check')){metadata(true);return;}
  if(process.argv.includes('--metadata-only')){metadata();return;}
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  try{
    const page=await browser.newPage({deviceScaleFactor:1});
    const svg=fs.readFileSync(path.join(assets,'icon.svg'),'utf8');
    await page.route('**/*',route=>route.abort());
    for(const [size,name] of sizes){
      await page.setViewportSize({width:size,height:size});
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
      await page.screenshot({path:path.join(assets,name),omitBackground:false,animations:'disabled'});
      console.log(`Built assets/${name} (${size}×${size})`);
    }
  }finally{await browser.close();}
  metadata();
})().catch(error=>{console.error(error);process.exitCode=1;});
