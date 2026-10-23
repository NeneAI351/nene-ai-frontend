const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://neneai351.github.io/nene-ai-frontend/',runScripts:'outside-only'});const w=dom.window;w.alert=()=>{};w.fetch=async()=>({ok:false});w.scrollTo=()=>{};w.eval([...w.document.querySelectorAll('script:not([src])')].map(x=>x.textContent).join('\n'));w.eval(fs.readFileSync('profile.js','utf8'));
let downloaded;w.URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){assert.match(this.download,/^nene-/);};
let id='alice',allow=true,route;w.neneAuthGetUserId=async()=>id;w.neneRequireAccount=async()=>allow;w.neneOpenAuth=mode=>{route=mode||'signin';};w.neneSignOut=async()=>{id=null;};w.neneOpenPaidCredits=()=>{route='credits';};w.renderCreateHub=()=>{route='create';};w.renderCreations=()=>{route='creations';};w.renderJobCenter=()=>{route='jobs';};w.NENE_PAID_WALLET=17;
const profiles=new Map(),reports=new Map();let loseReply=false,lastRequests=[];
w.NENE_DIRECTOR_CONFIG={backendUrl:'https://backend.test'};
w.neneAuthGetAccessToken=async()=>id?'a.'+Buffer.from(JSON.stringify({sub:id})).toString('base64url')+'.z':null;
w.fetch=async(url,options={})=>{
 const user=JSON.parse(Buffer.from(options.headers.Authorization.split('.')[1],'base64url')).sub;
 const path=new URL(url).pathname;let data;
 if(path.endsWith('/profile')){
  if(options.method==='PATCH')profiles.set(user,{...(profiles.get(user)||{}),...JSON.parse(options.body)});
  data={profile:profiles.get(user)||{}};
 }else if(path.endsWith('/reports')){
  if(options.method==='POST'){
   const body=JSON.parse(options.body);lastRequests.push(body.request_id);const list=reports.get(user)||[];let report=list.find(r=>r.request_id===body.request_id);if(!report){report={...body,id:'ticket-'+list.length,status:'received'};list.push(report);reports.set(user,list);}data={report};
   if(loseReply){loseReply=false;throw Error('Network disconnected');}
  }else data={reports:reports.get(user)||[]};
 }
 return {ok:true,json:async()=>data};
};
const click=async a=>{const el=w.document.querySelector(`[data-profile-action="${a}"]`);assert.ok(el,'Missing '+a);await el.onclick();};
(async()=>{
 await w.renderProfile();assert.equal(w.document.querySelectorAll('.profile-shortcut').length,4);assert.equal(w.document.querySelectorAll('.profile-group').length,4);assert.equal(w.document.querySelectorAll('.profile-group[open]').length,0);assert.match(w.document.querySelector('.profile-groups').textContent,/Coming soon/);assert.ok(w.document.querySelector('.profile-session-footer [data-profile-action=signout]'));assert.match(w.document.getElementById('profilePaidBalance').textContent,/17/);
 for(const a of ['create','jobs','credits']){await click(a);assert.equal(route,a);}
 for(const a of ['safety','disclosure','rights','languages','teams','usage','account','privacy','export']){await click(a);assert.ok(w.document.querySelector('#modal').textContent.trim());await click('close');}
 await click('recovery');assert.equal(route,'jobs');
 await click('problem');let f=w.document.getElementById('profileForm');f.elements.message.value='<img onerror=evil()> Broken download';await f.onsubmit(new w.Event('submit',{cancelable:true}));assert.match(w.document.getElementById('modal').textContent,/Report received/);await click('close');
 assert.equal(JSON.parse(w.localStorage.getItem('nene_profile_v1:alice')).reports[0].kind,'problem');
 await click('brand');f=w.document.getElementById('profileForm');f.elements.name.value='Brand A';await f.onsubmit(new w.Event('submit',{cancelable:true}));assert.equal(JSON.parse(w.localStorage.getItem('nene_profile_v1:alice')).brand.name,'Brand A');await click('brand');await click('downloadBrand');assert.ok(downloaded);await click('close');await click('suggestion');f=w.document.getElementById('profileForm');f.elements.message.value='Account switch test';id='bob';await f.onsubmit(new w.Event('submit',{cancelable:true}));assert.equal(w.localStorage.getItem('nene_profile_v1:bob'),null,'Stale form cannot save under a different account');
 id='bob';await w.renderProfile();await click('brand');assert.equal(w.document.getElementById('profileForm').elements.name.value,'','Other account cannot load brand');await click('close');
 await click('account');await click('name');f=w.document.getElementById('profileForm');f.elements.displayName.value='<b>Bob</b>';await f.onsubmit(new w.Event('submit',{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));assert.equal(w.document.getElementById('profileDisplayName').textContent,'<b>Bob</b>');assert.equal(w.document.querySelector('#profileDisplayName b'),null);
 await click('privacy');await click('clearDrafts');assert.ok(w.localStorage.getItem('nene_profile_v1:bob'));await click('confirmClear');await new Promise(resolve=>setImmediate(resolve));assert.equal(profiles.get('bob').display_name,'<b>Bob</b>','Clearing the browser copy does not delete server data');assert.ok(w.localStorage.getItem('nene_profile_v1:alice'));
 await w.renderProfile();await click('problem');f=w.document.getElementById('profileForm');f.elements.message.value='Retry me';loseReply=true;await f.onsubmit(new w.Event('submit',{cancelable:true}));assert.equal(w.document.getElementById('profileForm'),f,'Unconfirmed request keeps the form');await f.onsubmit(new w.Event('submit',{cancelable:true}));assert.equal(lastRequests.at(-1),lastRequests.at(-2),'Retry preserves request ID');assert.equal((reports.get('bob')||[]).length,1,'Lost reply does not duplicate a report');await click('close');w.localStorage.removeItem('nene_profile_v1:bob');await w.renderProfile();assert.equal(w.document.getElementById('profileDisplayName').textContent,'<b>Bob</b>','Profile returns from server after browser data is cleared');await click('reports');assert.match(w.document.getElementById('modal').textContent,/Retry me/);await click('close');
 allow=false;await click('brand');assert.equal(w.document.querySelector('#profileForm'),null,'No signed-out brand editor');
 await click('signout');assert.equal(w.document.querySelector('[data-profile-action="signout"]').disabled,true);
 dom.window.close();console.log('Profile actions verified: navigation, informative unavailable states, server profile sync, report receipts, lost-reply idempotency, report history, escaped text, brand save and account isolation.');
})().catch(e=>{console.error(e);process.exit(1);});
