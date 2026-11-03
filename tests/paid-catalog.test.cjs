const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const code=fs.readFileSync(__dirname+'/../paid-access.js','utf8');
async function setup({mode='live',enabled=true,generation=true}={}){
 const w=new JSDOM('<div id="modalbox"></div>',{url:'https://nene.test',runScripts:'outside-only'}).window;
 w.showModal=html=>w.document.getElementById('modalbox').innerHTML=html;w.closeModal=()=>w.document.getElementById('modalbox').replaceChildren();
 w.neneAuthGetAccessToken=async()=>null;w.NENE_DIRECTOR_CONFIG={backendUrl:'https://api.test'};const calls=[];
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/packages')?{mode,live_payments_enabled:enabled,packages:[{name:'<img src=x>',credits:'400',amount_ngn:5000}]}:{accepting_requests:generation}};};
 w.eval(code);await w.neneOpenPaidCredits();return {w,calls};
}
test('credit catalog shows server prices safely and offers checkout only with live payments and generation',async()=>{
 const {w,calls}=await setup();assert.match(w.document.body.textContent,/400 credits · ₦5,000/);assert.equal(w.document.querySelector('img'),null);
 assert.equal(w.document.getElementById('paidCheckout').hidden,false);assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.options.method));w.close();
});
for(const flags of [{generation:false},{mode:'test'},{enabled:false}])test('unready purchase path stays closed '+JSON.stringify(flags),async()=>{
 const {w}=await setup(flags);assert.equal(w.document.getElementById('paidCheckout').hidden,true);assert.match(w.document.body.textContent,/temporarily closed/);w.close();
});
