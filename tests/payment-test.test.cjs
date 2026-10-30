const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../payment-test.html'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'../payment-test.js'),'utf8');
const REF='nene_'+'a'.repeat(32);
async function settle(){for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));}
async function setup({mode='test',owner='owner-a',url='https://checkout.paystack.com/test-token',saved=null}={}){
 const dom=new JSDOM(html,{url:'https://nene.test/payment-test.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.NENE_DIRECTOR_CONFIG={backendUrl:'https://nene-ai-staging.onrender.com'};
 w.neneAuthGetUserId=async()=>owner;w.neneAuthGetAccessToken=async()=>'test-auth-token';
 w.neneOpenAuth=()=>{};w.neneOpenAccountAgreement=()=>{};
 if(saved)w.localStorage.setItem('nene-payment-test-v1:'+owner,JSON.stringify(saved));
 w.fetch=async(endpoint,options)=>{
  calls.push({endpoint,options});let data;
  if(endpoint.endsWith('/packages'))data={mode,live_payments_enabled:mode==='live',packages:[{id:'starter',name:'Starter',amount_ngn:5000,credits:'400'}]};
  else if(endpoint.endsWith('/checkout'))data={mode:'test',reference:REF,authorization_url:url};
  else if(endpoint.endsWith('/verify'))data={credited:true,reference:REF,duplicate:true};
  else if(endpoint.endsWith('/wallet'))data={wallet:{available_credits:'400'}};
  else if(endpoint.includes('/ledger?'))data={items:[{id:'receipt-1',entry_type:'purchase',amount:'400',metadata:{provider:'paystack',reference:REF}}]};
  else data={paid_available_credits:'400',free_generation:false};
  return {ok:true,json:async()=>data};
 };
 w.eval(source);await settle();
 return {w,dom,calls,switchOwner(id){owner=id;w.dispatchEvent(new w.Event('nene-auth-changed'));}};
}
async function create(s){s.w.document.getElementById('testEmail').value='buyer@example.test';s.w.document.getElementById('testCheckoutForm').dispatchEvent(new s.w.Event('submit',{cancelable:true}));await settle();}
test('checkout requires an explicit click and pins test mode in its authenticated request',async()=>{
 const s=await setup();assert.equal(s.calls.length,1);await create(s);
 const c=s.calls.find(c=>c.endpoint.endsWith('/checkout'));
 assert.deepEqual(JSON.parse(c.options.body),{package_id:'starter',email:'buyer@example.test',expected_mode:'test'});
 assert.equal(c.options.headers.Authorization,'Bearer test-auth-token');
 assert.equal(s.w.document.getElementById('testCheckoutLink').hidden,false);
 assert.equal(JSON.parse(s.w.localStorage.getItem('nene-payment-test-v1:owner-a')).reference,REF);
 s.dom.window.close();
});
test('live mode and signed-out users cannot create checkout',async()=>{
 for(const config of [{mode:'live'},{owner:null}]){
  const s=await setup(config);await create(s);
  assert.equal(s.calls.filter(c=>c.endpoint.endsWith('/checkout')).length,0);
  assert.equal(s.w.document.getElementById('testCreate').disabled,true);s.dom.window.close();
 }
});
test('untrusted checkout links are never displayed',async()=>{
 for(const url of ['https://evil.test/checkout','http://checkout.paystack.com/token','https://checkout.paystack.com.evil.test/token','https://user@checkout.paystack.com/token']){
  const s=await setup({url});await create(s);assert.equal(s.w.document.getElementById('testCheckoutLink').hidden,true);
  assert.equal(s.w.localStorage.length,0);s.dom.window.close();
 }
});
test('double clicks cannot create concurrent checkouts or replace the saved reference',async()=>{
 const s=await setup();const form=s.w.document.getElementById('testCheckoutForm');s.w.document.getElementById('testEmail').value='buyer@example.test';
 form.dispatchEvent(new s.w.Event('submit',{cancelable:true}));form.dispatchEvent(new s.w.Event('submit',{cancelable:true}));await settle();await create(s);
 assert.equal(s.calls.filter(c=>c.endpoint.endsWith('/checkout')).length,1);s.dom.window.close();
});
test('rechecking uses the saved reference and displays only the server wallet balance',async()=>{
 const s=await setup({saved:{owner:'owner-a',reference:REF,url:'https://checkout.paystack.com/test-token'}});
 for(let i=0;i<2;i++){s.w.document.getElementById('testVerify').click();await settle();}
 assert.equal(s.calls.filter(c=>c.endpoint.endsWith('/checkout')).length,0);
 const checks=s.calls.filter(c=>c.endpoint.endsWith('/verify'));assert.equal(checks.length,2);
 assert.ok(checks.every(c=>JSON.parse(c.options.body).reference===REF));
 assert.match(s.w.document.getElementById('testStatus').textContent,/No additional credits/);
 assert.match(s.w.document.getElementById('testBalance').textContent,/400/);s.dom.window.close();
});
test('account switch hides a previous owner payment and ignores a delayed checkout response',async()=>{
 const s=await setup();let resolve;const original=s.w.fetch;
 s.w.fetch=(url,options)=>url.endsWith('/checkout')?new Promise(r=>{resolve=r;}):original(url,options);
 const task=create(s);await settle();s.switchOwner('owner-b');await settle();
 resolve({ok:true,json:async()=>({mode:'test',reference:REF,authorization_url:'https://checkout.paystack.com/test-token'})});await task;
 assert.equal(s.w.document.getElementById('testCheckoutLink').hidden,true);assert.equal(s.w.localStorage.length,0);s.dom.window.close();
});
test('failed or mismatched verification never claims credits were delivered',async()=>{
 const s=await setup({saved:{owner:'owner-a',reference:REF}});const original=s.w.fetch;
 s.w.fetch=(url,options)=>url.endsWith('/verify')?Promise.resolve({ok:true,json:async()=>({credited:true,reference:'nene_'+'b'.repeat(32)})}):original(url,options);
 s.w.document.getElementById('testVerify').click();await settle();
 assert.match(s.w.document.getElementById('testStatus').textContent,/not confirmed/);assert.match(s.w.document.getElementById('testBalance').textContent,/400/);s.dom.window.close();
});
test('a failed reference still displays the independently checked wallet balance',async()=>{
 const s=await setup({saved:{owner:'owner-a',reference:REF}});const original=s.w.fetch;
 s.w.fetch=(url,options)=>url.endsWith('/verify')?Promise.resolve({ok:true,json:async()=>({credited:false,status:'failed'})}):original(url,options);
 s.w.document.getElementById('testVerify').click();await settle();
 assert.match(s.w.document.getElementById('testStatus').textContent,/reference as failed/);
 assert.match(s.w.document.getElementById('testBalance').textContent,/400/);s.dom.window.close();
});
test('returning from checkout reloads the latest owner-scoped reference',async()=>{
 const s=await setup({saved:{owner:'owner-a',reference:REF}}),next='nene_'+'b'.repeat(32);
 s.w.localStorage.setItem('nene-payment-test-v1:owner-a',JSON.stringify({owner:'owner-a',reference:next}));
 s.w.dispatchEvent(new s.w.Event('focus'));await settle();
 assert.match(s.w.document.getElementById('testReference').textContent,new RegExp(next));
 assert.equal(s.calls.filter(c=>c.endpoint.endsWith('/checkout')).length,0);s.dom.window.close();
});
test('an older tab cannot silently verify a stale reference after another checkout was saved',async()=>{
 const s=await setup({saved:{owner:'owner-a',reference:REF}}),next='nene_'+'c'.repeat(32);
 s.w.localStorage.setItem('nene-payment-test-v1:owner-a',JSON.stringify({owner:'owner-a',reference:next}));
 s.w.document.getElementById('testVerify').click();await settle();
 assert.equal(s.calls.filter(c=>c.endpoint.endsWith('/verify')).length,0);
 assert.match(s.w.document.getElementById('testReference').textContent,new RegExp(next));
 assert.match(s.w.document.getElementById('testStatus').textContent,/newer checkout/);s.dom.window.close();
});
test('test delivery is confirmed from the ledger even when live spendable balance is zero',async()=>{
 const s=await setup({saved:{owner:'owner-a',reference:REF}}),original=s.w.fetch;
 s.w.fetch=(url,options)=>url.endsWith('/paid')?Promise.resolve({ok:true,json:async()=>({paid_available_credits:'0',free_generation:false})}):original(url,options);
 for(let i=0;i<2;i++){s.w.document.getElementById('testVerify').click();await settle();}
 assert.match(s.w.document.getElementById('testBalance').textContent,/includes test credits\): 400/);
 assert.match(s.w.document.getElementById('testBalance').textContent,/live payments: 0/);
 assert.match(s.w.document.getElementById('testReceipt').textContent,/400 test credits.*one purchase entry/);
 assert.equal(s.calls.filter(c=>c.endpoint.endsWith('/checkout')).length,0);s.dom.window.close();
});
test('an unrelated purchase cannot confirm the current payment receipt',async()=>{
 const s=await setup({saved:{owner:'owner-a',reference:REF}}),original=s.w.fetch;
 s.w.fetch=(url,options)=>url.includes('/ledger?')?Promise.resolve({ok:true,json:async()=>({items:[{entry_type:'purchase',amount:'400',metadata:{provider:'paystack',reference:'nene_'+'f'.repeat(32)}}]})}):original(url,options);
 s.w.document.getElementById('testVerify').click();await settle();
 assert.match(s.w.document.getElementById('testReceipt').textContent,/No purchase entry/);s.dom.window.close();
});
