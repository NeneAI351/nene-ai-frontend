const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://neneai351.github.io/nene-ai-frontend/',runScripts:'outside-only'});const w=dom.window;w.alert=()=>{};w.fetch=async()=>({ok:false});w.scrollTo=()=>{};w.eval([...w.document.querySelectorAll('script:not([src])')].map(x=>x.textContent).join('\n'));w.eval(fs.readFileSync('profile.js','utf8'));
let id='alice',allow=true,route;w.neneAuthGetUserId=async()=>id;w.neneRequireAccount=async()=>allow;w.neneOpenAuth=mode=>{route=mode||'signin';};w.neneSignOut=async()=>{id=null;};w.neneOpenPaidCredits=()=>{route='credits';};w.renderCreateHub=()=>{route='create';};w.renderCreations=()=>{route='creations';};w.renderJobCenter=()=>{route='jobs';};w.NENE_PAID_WALLET=17;
const click=async a=>{const el=w.document.querySelector(`[data-profile-action="${a}"]`);assert.ok(el,'Missing '+a);await el.onclick();};
(async()=>{
 await w.renderProfile();assert.match(w.document.getElementById('profilePaidBalance').textContent,/17/);
 for(const a of ['create','jobs','credits']){await click(a);assert.equal(route,a);}
 for(const a of ['safety','disclosure','rights','languages','teams','usage','account','privacy','export']){await click(a);assert.ok(w.document.querySelector('#modal').textContent.trim());await click('close');}
 await click('recovery');assert.equal(route,'jobs');
 await click('problem');let f=w.document.getElementById('profileForm');f.elements.message.value='<img onerror=evil()> Broken download';await f.onsubmit(new w.Event('submit',{cancelable:true}));assert.match(w.document.getElementById('modal').textContent,/Nothing has been sent/);await click('close');
 assert.equal(JSON.parse(w.localStorage.getItem('nene_profile_v1:alice')).reports[0].kind,'problem');
 await click('brand');f=w.document.getElementById('profileForm');f.elements.name.value='Brand A';await f.onsubmit(new w.Event('submit',{cancelable:true}));assert.equal(JSON.parse(w.localStorage.getItem('nene_profile_v1:alice')).brand.name,'Brand A');
 id='bob';await w.renderProfile();await click('brand');assert.equal(w.document.getElementById('profileForm').elements.name.value,'','Other account cannot load brand');await click('close');
 await click('account');await click('name');f=w.document.getElementById('profileForm');f.elements.displayName.value='<b>Bob</b>';await f.onsubmit(new w.Event('submit',{cancelable:true}));await new Promise(resolve=>setImmediate(resolve));assert.equal(w.document.getElementById('profileDisplayName').textContent,'<b>Bob</b>');assert.equal(w.document.querySelector('#profileDisplayName b'),null);
 await click('privacy');await click('clearDrafts');assert.ok(w.localStorage.getItem('nene_profile_v1:bob'));await click('confirmClear');await new Promise(resolve=>setImmediate(resolve));assert.equal(w.localStorage.getItem('nene_profile_v1:bob'),null);assert.ok(w.localStorage.getItem('nene_profile_v1:alice'));
 allow=false;await click('brand');assert.equal(w.document.querySelector('#profileForm'),null,'No signed-out brand editor');
 await click('signout');assert.equal(w.document.querySelector('[data-profile-action="signout"]').disabled,true);
 dom.window.close();console.log('Profile actions verified: navigation, informative unavailable states, account-specific persistent drafts, escaped text, brand save, confirmation and account isolation.');
})().catch(e=>{console.error(e);process.exit(1);});
