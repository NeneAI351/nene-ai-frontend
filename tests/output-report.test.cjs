const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../output-report.js'),'utf8');
const OWNER='11111111-1111-4111-8111-111111111111',ID='22222222-2222-4222-8222-222222222222';
const RECEIPT='33333333-3333-4333-8333-333333333333';
async function settle(){for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));}
function setup(){
 const dom=new JSDOM('',{url:'https://nene.test',runScripts:'outside-only'}),w=dom.window;
 let owner=OWNER;const calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.neneAuthGetUserId=async()=>owner;
 w.neneAuthGetAccessToken=async()=>'x.'+Buffer.from(JSON.stringify({sub:owner})).toString('base64url')+'.x';
 w.NENE_DIRECTOR_CONFIG={backendUrl:'https://api.test'};
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({report:{id:RECEIPT}})};};w.eval(source);
 return {w,dom,calls,switchOwner(){owner='44444444-4444-4444-8444-444444444444';w.dispatchEvent(new w.Event('nene-auth-changed'));}};
}
async function open(s){await s.w.neneOpenOutputReport({kind:'video',id:ID,owner:OWNER});}
async function send(s){s.w.document.querySelector('form').dispatchEvent(new s.w.Event('submit',{cancelable:true}));await settle();}
test('reporting requires explicit submission and sends only authenticated text and an output reference',async()=>{
 const s=setup();await open(s);assert.equal(s.calls.length,0);
 s.w.document.querySelector('textarea').value='<unsafe content>';await send(s);
 assert.equal(s.calls.length,1);const call=s.calls[0],body=JSON.parse(call.options.body);
 assert.equal(call.url,'https://api.test/api/account/reports');assert.match(call.options.headers.Authorization,/^Bearer /);
 assert.deepEqual(Object.keys(body).sort(),['kind','message','request_id']);assert.equal(body.kind,'abuse');assert.match(body.message,new RegExp(ID));assert.ok(!body.message.includes('https://'));
 assert.match(s.w.document.body.textContent,/Report recorded/);assert.equal(s.w.document.querySelectorAll('unsafe').length,0);s.dom.window.close();
});
test('lost report response survives reopening and retries the identical request, including double taps',async()=>{
 const s=setup();await open(s);s.w.document.querySelector('textarea').value='Safety issue';
 s.w.fetch=async(url,options)=>{s.calls.push({url,options});throw Error('Connection lost');};
 const form=s.w.document.querySelector('form');form.dispatchEvent(new s.w.Event('submit',{cancelable:true}));form.dispatchEvent(new s.w.Event('submit',{cancelable:true}));await settle();assert.equal(s.calls.length,1);
 await open(s);assert.equal(s.w.document.querySelector('textarea').disabled,true);
 s.w.fetch=async(url,options)=>{s.calls.push({url,options});return {ok:true,json:async()=>({report:{id:RECEIPT}})};};await send(s);
 assert.equal(s.calls[0].options.body,s.calls[1].options.body);assert.equal(s.w.localStorage.length,0);s.dom.window.close();
});
test('account switching removes the report and cannot send the previous owner draft',async()=>{
 const s=setup();await open(s);s.switchOwner();assert.equal(s.w.document.querySelector('dialog'),null);await open(s);assert.equal(s.w.document.querySelector('dialog'),null);assert.equal(s.calls.length,0);s.dom.window.close();
});
test('a failed or malformed response never claims the report was recorded',async()=>{
 const s=setup();await open(s);s.w.document.querySelector('textarea').value='Safety issue';s.w.fetch=async()=>({ok:false,json:async()=>({})});await send(s);
 assert.doesNotMatch(s.w.document.body.textContent,/Report recorded/);assert.equal(s.w.localStorage.length,1);s.dom.window.close();
});
