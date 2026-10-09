// SPDX-License-Identifier: AGPL-3.0-or-later
// Rasterize the original SVG for iOS and PWA installation; no remote assets.
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright BROWSER_CHANNEL=msedge node scripts/build-icons.cjs
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'assets');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
  try{
    const page=await browser.newPage({deviceScaleFactor:1});
    const svg=fs.readFileSync(path.join(assets,'icon.svg'),'utf8');
    await page.route('**/*',route=>route.abort());
    for(const [size,name] of [[180,'apple-touch-icon.png'],[192,'icon-192.png'],[512,'icon-512.png']]){
      await page.setViewportSize({width:size,height:size});
      await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`);
      await page.screenshot({path:path.join(assets,name),omitBackground:false,animations:'disabled'});
      console.log(`Built assets/${name} (${size}×${size})`);
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
