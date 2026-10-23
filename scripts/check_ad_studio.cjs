const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('ad-studio.js','utf8');
const USER='11111111-1111-4111-8111-111111111111';
const JOB='22222222-2222-4222-8222-222222222222';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
async function flush(){for(let i=0;i<8;i++)await tick();}
async function setup({signedIn=true,available=true,postError=null,pending=null,jobStatus='succeeded'}={}){
 const dom=new JSDOM('<div id="screen"></div>',{url:'https://neneai351.github.io/nene-ai-frontend/',runScripts:'outside-only'});
 const w=dom.window,calls=[];let owner=signedIn?USER:null;
 w.setNav=()=>{};w.renderHome=()=>{};w.toast=()=>{};w.neneOpenAuth=()=>{};
 w.credits=12345;w.NENE_DIRECTOR_CONFIG={backendUrl:'https://staging.example'};
 w.neneAuthGetUserId=async()=>owner;w.neneAuthGetAccessToken=async()=>owner?'test-token':null;
 w.neneRequireAccount=async()=>!!owner;w.neneRefreshPaidWallet=async()=>{};
 if(pending)w.localStorage.setItem('nene_ad_pending_v1:'+USER,JSON.stringify(pending));
 w.fetch=async(url,options={})=>{
  calls.push({url,options});let data;
  if(url.endsWith('/api/generation-availability'))data={accepting_requests:available,message:available?'Paid video submissions are enabled.':'Paid video generation is not enabled yet.'};
  else if(url.endsWith('/api/pricing/quote'))data={recommended_credits:120};
  else if(url.endsWith('/api/generations')){
   if(postError==='network')throw new TypeError('Network request failed');
   if(postError)return {ok:false,status:postError,json:async()=>({detail:postError===409?'The price increased. Review the current price; no credits were reserved.':'Insufficient paid credits.'})};
   data={generation_id:JOB,status:'queued'};
  }else if(url.endsWith('/media-url'))data={url:'https://private.example/video.mp4?short-lived-signature=example'};
  else data={generation:{id:JOB,status:jobStatus}};
  return {ok:true,status:200,json:async()=>data};
 };
 w.eval(source);await w.neneOpenAdvertisement();
 return {dom,w,calls,setOwner:value=>{owner=value;},setFetch:value=>{w.fetch=value;}};
}
function fill(w){for(const [id,value] of Object.entries({product:'<img src=x onerror=alert(1)> bakery',audience:'Local families',benefit:'Fresh bread baked every morning',offer:'',cta:'Visit our shop'}))w.document.getElementById('ad-'+id).value=value;}
const posts=calls=>calls.filter(x=>x.url.endsWith('/api/generations'));
(async()=>{
 {
  const {dom,w,calls}=await setup();fill(w);
  w.document.getElementById('ad-review').click();await flush();
  assert.match(w.document.getElementById('ad-generate').textContent,/120 paid credits/);
  assert.equal(posts(calls).length,0,'Reviewing the price must not submit paid work');
  w.document.getElementById('ad-generate').click();w.document.getElementById('ad-generate').click();await flush();
  assert.equal(posts(calls).length,1,'Double clicks submit only once');
  const submit=posts(calls)[0],body=JSON.parse(submit.options.body);
  assert.equal(submit.options.headers.Authorization,'Bearer test-token');
  assert.ok(submit.options.headers['Idempotency-Key']);
  assert.equal(body.type,'text-to-video');assert.equal(body.credit_limit,'120');assert.equal(body.duration,6);
  assert.match(body.prompt,/Local families/);assert.match(body.prompt,/Visit our shop/);assert.match(body.prompt,/Do not invent/);
  assert.equal(w.document.querySelector('#ad-output video').src,'https://private.example/video.mp4?short-lived-signature=example');
  assert.equal(w.document.querySelector('#ad-jobs img'),null,'Product text must not execute as HTML');
  assert.equal(w.credits,12345,'The UI must not invent wallet mutations');
  assert.ok(!Object.values(w.localStorage).some(x=>String(x).includes('short-lived-signature')),'Never persist signed links');
  assert.equal(w.localStorage.getItem('nene_ad_pending_v1:'+USER),null);
  dom.window.close();
 }
 {
  const {dom,w,calls}=await setup({signedIn:false});
  assert.match(w.document.getElementById('ad-message').textContent,/Sign in/);
  assert.equal(w.document.getElementById('ad-generate').disabled,true);
  assert.equal(calls.length,0);dom.window.close();
 }
 {
  const {dom,w,calls}=await setup({available:false});fill(w);
  w.document.getElementById('ad-review').click();await flush();
  assert.equal(w.document.getElementById('ad-generate').disabled,true);
  assert.match(w.document.getElementById('ad-message').textContent,/not enabled/);
  assert.equal(posts(calls).length,0);dom.window.close();
 }
 {
  const {dom,w,calls}=await setup();
  w.document.getElementById('ad-review').click();await flush();
  assert.match(w.document.getElementById('ad-message').textContent,/Enter the product/);
  assert.equal(calls.filter(x=>x.url.endsWith('/quote')).length,0);dom.window.close();
 }
 {
  const {dom,w,calls}=await setup();fill(w);
  w.document.getElementById('ad-review').click();await flush();
  w.document.getElementById('ad-product').value='A different product';
  w.document.getElementById('ad-generate').click();await flush();
  assert.equal(posts(calls).length,0,'Changed inputs require a new price review');dom.window.close();
 }
 for(const status of [402,409]){
  const {dom,w,calls}=await setup({postError:status});fill(w);
  w.document.getElementById('ad-review').click();await flush();
  w.document.getElementById('ad-generate').click();await flush();
  assert.equal(posts(calls).length,1);
  assert.equal(w.localStorage.getItem('nene_ad_pending_v1:'+USER),null);
  assert.ok(w.document.getElementById('ad-product').value.includes('bakery'));
  assert.equal(w.document.getElementById('ad-generate').disabled,true);dom.window.close();
 }
 {
  const first=await setup({postError:'network'});fill(first.w);
  first.w.document.getElementById('ad-review').click();await flush();
  first.w.document.getElementById('ad-generate').click();await flush();
  const pending=JSON.parse(first.w.localStorage.getItem('nene_ad_pending_v1:'+USER));
  assert.ok(pending.key);assert.match(first.w.document.getElementById('ad-generate').textContent,/Retry pending/);
  first.dom.window.close();
  const retry=await setup({pending});
  assert.equal(retry.w.document.getElementById('ad-product').disabled,true);
  retry.w.document.getElementById('ad-generate').click();await flush();
  assert.equal(posts(retry.calls)[0].options.headers['Idempotency-Key'],pending.key);
  assert.deepEqual(JSON.parse(posts(retry.calls)[0].options.body),pending.payload);retry.dom.window.close();
 }
 {
  const {dom,w,calls,setOwner}=await setup();fill(w);
  w.document.getElementById('ad-review').click();await flush();
  setOwner(null);w.dispatchEvent(new w.Event('nene-auth-changed'));
  assert.equal(w.document.getElementById('ad-product').value,'');
  assert.equal(w.document.getElementById('ad-generate').disabled,true);
  assert.equal(w.document.getElementById('ad-output').children.length,0);dom.window.close();
 }
 {
  const html=fs.readFileSync('index.html','utf8');
  const dom=new JSDOM(html,{url:'https://neneai351.github.io/nene-ai-frontend/',runScripts:'outside-only'});
  const w=dom.window;w.alert=()=>{};w.fetch=async()=>({ok:false});
  const inline=[...w.document.querySelectorAll('script:not([src])')].map(t=>t.textContent).join('\n');w.eval(inline);
  let opens=0;w.neneOpenAdvertisement=()=>{opens++;};
  const ad=[...w.document.querySelectorAll('button')].find(x=>x.textContent.includes('AI Advertisement'));
  assert.ok(ad);w.eval(ad.getAttribute('onclick'));assert.equal(opens,1,'Actual home card must open the working ad studio');
  w.openFeature('ad');assert.equal(opens,2);dom.window.close();
 }
 console.log('Ad studio verified: real card wiring, auth, reviewed credit limit, no free wallet changes, duplicate-click safety, restart-safe retries, failure handling, private playback and account isolation.');
})().catch(e=>{console.error(e);process.exit(1);});
