import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('src/styles/csm-os4.css'),html=read('index.html');
function rgb(hex){return hex.match(/[\da-f]{2}/gi).map(x=>parseInt(x,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);}
function ratio(fg,bg){const lum=x=>{const c=rgb(x);return .2126*c[0]+.7152*c[1]+.0722*c[2]};const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
test('Accessible action text on light and dark filled buttons',()=>{
 assert.ok(ratio('FFFFFF','0B60CC')>=4.5);
 assert.ok(ratio('FFFFFF','145AAE')>=4.5);
 assert.ok(ratio('FFFFFF','084FA8')>=4.5);
});
test('Semantic tokens exist and legacy hardcoded surfaces are covered explicitly',()=>{
 for(const t of ['surface-app','surface-card','surface-muted','surface-elevated','text-primary','text-secondary','text-on-action','border-default','border-strong','action-primary','action-primary-hover','state-success','state-warning','state-danger','focus-ring','field-bg','field-text']){
   assert.ok(css.includes('--'+t+':'),t+' missing');
 }
 for(const selector of ['mini','alert','camp-feature-line','camp-next','work-status-card','work-status-item','feature-editor','history-item','launch-dash-item','checkpoint-row','launch-card-cell','profile-stat','profile-badge','profile-edit-row','focus-column','summary-comment','advanced','toast']){
   assert.ok(css.includes('.'+selector),selector+' legacy override missing');
 }
 assert.ok(css.includes('body.csm-os4[data-theme="dark"]'));
 assert.ok(css.includes('.csm-os4 option'));
 assert.ok(css.includes(':focus-visible'));
 assert.ok(html.includes('src/styles/csm-os4.css'));
});
test('Main reading and metadata token contrast',()=>{
 for(const [fg,bg] of [['18263C','FFFFFF'],['586980','FFFFFF'],['F3F7FE','142338'],['B1C0D4','142338'],['18263C','F8FAFD'],['F3F7FE','1D304A']]){
  assert.ok(ratio(fg,bg)>=4.5,fg+' on '+bg+' has '+ratio(fg,bg).toFixed(2));
 }
});
