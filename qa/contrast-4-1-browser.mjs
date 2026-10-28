import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const page=await context.newPage();
const base='http://127.0.0.1:8777/?demo=1';
const records=[],errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.fulfill({status:200,contentType:'application/javascript',body:'/* offline QA dependency */'}));
mkdirSync('qa/artifacts/contrast-4-1',{recursive:true});
async function measure(selector,mode,view,width){
 const entries=await page.evaluate(sel=>{
   const parse=s=>{const match=s.match(/rgba?\(([^)]+)\)/);if(!match)return null;let p=match[1].split(',').map(x=>Number(x.trim()));return [p[0],p[1],p[2],p[3]??1]};
   const composite=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));
   const lum=c=>{let rgb=c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};
   return [...document.querySelectorAll(sel)].filter(el=>{
     const css=getComputedStyle(el),box=el.getBoundingClientRect();
     return box.width>1&&box.height>1&&css.display!=='none'&&css.visibility!=='hidden'&&css.opacity!=='0';
   }).slice(0,4).map(el=>{
     const foreground=parse(getComputedStyle(el).color)||[0,0,0,1];
     let background=[255,255,255],node=el,backgroundRules=[];
     let layers=[];while(node){const style=getComputedStyle(node),clr=parse(style.backgroundColor);
       if(clr&&clr[3])layers.push(clr);
       if(style.backgroundImage!=='none')backgroundRules.push(node.tagName.toLowerCase()+'.'+node.className);
       node=node.parentElement;
     }
     for(const layer of layers.reverse())background=composite(layer,background);
     const color=composite(foreground,background);
     const a=lum(color),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
     return {selector:sel,tag:el.tagName,element:(el.textContent||'').trim().slice(0,75),foreground:getComputedStyle(el).color,background:background.map(x=>Math.round(x)),ratio:+ratio.toFixed(2),gradients:backgroundRules};
   });
 },selector);
 for(const x of entries)records.push({mode,view,width,...x});
 return entries;
}
const checks=['.os-hero h2','.os-hero p','.os-metric span','.os-metric b','.os-panel h3',
  '.os-client-pick-top strong','.os-client-pick-middle','.os-inspector-sub','.os-report-context p',
  '.sidebar-brand small','.side-nav button.active','.btn.primary',
  '.mini span','.work-status-item span','.history-item b','.launch-card-cell span',
  '.profile-stat span','.profile-badge','.advanced summary','.os-status-pill'];
try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('body.csm-os4').waitFor({timeout:15000});
 for(const mode of ['light','dark']){
   await page.evaluate(v=>{document.body.dataset.theme=v;localStorage.setItem('campbox-csm-os-theme',v)},mode);
   for(const width of [375,430,768,900,1024,1440,1920]){
     await page.setViewportSize({width,height:950});
     for(const [view,section] of [['dashboard','#viewDashboard'],['camps','#viewCamps'],['profile','#viewProfile'],['report','#viewReport']]){
       await page.evaluate(v=>setView(v),view);
       await page.locator(section).waitFor({state:'visible',timeout:8000});
       await page.screenshot({path:'qa/artifacts/contrast-4-1/'+mode+'-'+width+'-'+view+'.png',fullPage:true});
       for(const selector of checks)await measure(selector,mode,view,width);
       const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
       assert.ok(overflow<=4,mode+'/'+view+'/'+width+' horizontal overflow '+overflow);
     }
     if(width===1440){
       await page.evaluate(()=>{setView('camps');openCampModal(camps.find(c=>c.active)?.id||camps[0].id);});
       await page.locator('.camp-edit-modal').waitFor({state:'visible'});
       await page.screenshot({path:'qa/artifacts/contrast-4-1/'+mode+'-'+width+'-modal.png',fullPage:true});
       for(const selector of ['.modal-head h3','.os-modal-tabset button[aria-selected="true"]','.field label','.advanced summary','.btn.primary'])await measure(selector,mode,'modal',width);
       await page.evaluate(()=>closeModal());
     }
   }
 }
 const failing=records.filter(r=>r.ratio<4.5&&!r.gradients.length);
 writeFileSync('qa/artifacts/contrast-4-1/computed-contrast.json',JSON.stringify({records,failures:failing},null,2));
 assert.equal(errors.length,0,'Uncaught browser errors '+errors.slice(0,3).join('; '));
 assert.deepEqual(failing.slice(0,30),[],'Computed contrast ratio below WCAG AA for tested text');
 assert.ok(records.length>100,'Insufficient visible UI samples');
 console.log('PASS: '+records.length+' computed contrast samples in light/dark across 7 widths, 4 views, and modals');
} finally{await browser.close()}
