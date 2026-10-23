const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const setupSource=fs.readFileSync('account-setup.js','utf8');
const authSource=fs.readFileSync('auth.js','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function flush(){for(let i=0;i<5;i++)await tick();}
function browser(){
 const dom=new JSDOM('<div id="screen"></div><div id="modal"><div id="modalbox"></div></div>',{url:'https://neneai351.github.io/nene-ai-frontend/',runScripts:'outside-only'});
 const w=dom.window,calls=[];
 let session=null,recorded=false;
 w.showModal=html=>{w.document.getElementById('modalbox').innerHTML=html;};w.closeModal=()=>{};w.toast=()=>{};
 w.NENE_AUTH_CONFIG={supabaseUrl:'https://auth.example',supabaseAnonKey:'public-test-configuration'};
 w.NENE_DIRECTOR_CONFIG={backendUrl:'https://staging.example'};
 const sdk={
  onAuthStateChange:()=>({data:{subscription:{}}}),
  getSession:async()=>({data:{session},error:null}),
  signUp:async payload=>{calls.push({kind:'signup',payload});return {data:{user:{id:'signup-user'},session:null},error:null};},
  signInWithPassword:async payload=>{calls.push({kind:'signin',payload});session={access_token:'signed-in-test-token',user:{id:'existing-user',user_metadata:{}}};recorded=true;return {data:{user:session.user,session},error:null};},
  signOut:async()=>{session=null;return {error:null};}
 };
 w.supabase={createClient:()=>({auth:sdk})};
 w.fetch=async(url,options)=>{
  calls.push({kind:'agreement',url,options});
  if(options.method==='POST')recorded=true;
  return {ok:true,json:async()=>({accepted:recorded})};
 };
 w.eval(setupSource);w.eval(authSource);
 return {dom,w,calls,setSession:value=>{session=value;},setRecorded:value=>{recorded=value;}};
}
(async()=>{
 {
  const {dom,w,calls}=browser();await flush();
  w.neneOpenAuth('signup');
  const box=w.document.getElementById('neneSignupAgreement');
  assert.ok(box);assert.equal(box.checked,false,'Consent must never be prechecked');
  assert.equal(box.required,true);
  const link=w.document.querySelector('a[href="./terms.html"]');assert.ok(link);assert.equal(link.target,'_blank');
  w.document.getElementById('neneAuthEmail').value='test@example.test';
  w.document.getElementById('neneAuthPassword').value='TestPassphrase2026!';
  w.document.getElementById('neneAuthForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(calls.filter(x=>x.kind==='signup').length,0,'Unchecked agreement blocks account creation');
  assert.match(w.document.getElementById('neneAuthMessage').textContent,/accept the Terms/);
  box.checked=true;
  w.document.getElementById('neneAuthForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  const signup=calls.find(x=>x.kind==='signup');
  assert.equal(signup.payload.options.data.nene_terms_accepted,true);
  assert.equal(signup.payload.options.data.nene_terms_version,w.neneAccountSetup.version);
  assert.match(w.document.getElementById('neneAuthMessage').textContent,/Check your email/);
  w.neneOpenAuth('signin');
  assert.equal(w.document.querySelector('input[type="checkbox"]'),null,'Normal login never asks for agreement');
  w.document.getElementById('neneAuthEmail').value='test@example.test';
  w.document.getElementById('neneAuthPassword').value='TestPassphrase2026!';
  w.document.getElementById('neneAuthForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();
  assert.equal(calls.filter(x=>x.kind==='signin').length,1);
  assert.equal(calls.filter(x=>x.kind==='agreement' && x.options.method==='POST').length,0);
  await w.neneAuthGetAccessToken();await w.neneAuthGetAccessToken();
  assert.equal(calls.filter(x=>x.kind==='agreement' && x.options.method==='POST').length,0,'No repeated acceptance after sign-in');
  dom.window.close();
 }
 {
  const {dom,w,calls}=browser();await flush();
  const session={access_token:'confirmed-new-user-token',user:{id:'new-user',user_metadata:{nene_terms_accepted:true,nene_terms_version:w.neneAccountSetup.version}}};
  assert.equal(await w.neneAccountSetup.sync(session),true);
  assert.equal(await w.neneAccountSetup.sync(session),true);
  const posts=calls.filter(x=>x.kind==='agreement' && x.options.method==='POST');
  assert.equal(posts.length,1,'Signup acceptance is stored once after confirmation');
  assert.deepEqual(JSON.parse(posts[0].options.body),{accepted:true,terms_version:w.neneAccountSetup.version});
  assert.equal(posts[0].options.headers.Authorization,'Bearer confirmed-new-user-token');
  dom.window.close();
 }
 {
  const {dom,w,calls}=browser();await flush();
  const session={access_token:'legacy-user-token',user:{id:'legacy-user',user_metadata:{}}};
  assert.equal(await w.neneAccountSetup.require(session),false);
  const box=w.document.getElementById('neneSetupAgreement');assert.equal(box.checked,false);
  w.document.getElementById('neneSetupSubmit').click();await flush();
  assert.equal(calls.filter(x=>x.kind==='agreement' && x.options.method==='POST').length,0);
  box.checked=true;w.document.getElementById('neneSetupSubmit').click();await flush();
  assert.equal(calls.filter(x=>x.kind==='agreement' && x.options.method==='POST').length,1);
  assert.equal(await w.neneAccountSetup.require(session),true);
  assert.equal(calls.filter(x=>x.kind==='agreement' && x.options.method==='POST').length,1);
  dom.window.close();
 }
 const terms=fs.readFileSync('terms.html','utf8');
 assert.match(terms,/Terms of Service and Refund Policy/);
 assert.match(terms,/2026-10-23-account-v1/);
 assert.match(terms,/change-of-mind cash refunds/);
 console.log('Account setup verified: unchecked signup agreement, blocked unchecked signup, linked terms, confirmation persistence, no login checkbox and one-time legacy setup.');
})().catch(error=>{console.error(error);process.exit(1);});
