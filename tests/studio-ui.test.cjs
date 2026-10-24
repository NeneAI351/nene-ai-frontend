const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const OWNER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const read=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
async function settle(){for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));}
async function setup(tool,{signed=true,available=false}={}){
 const dom=new JSDOM('<div id="screen"></div>',{url:'https://nene.test',runScripts:'outside-only'}),w=dom.window;let owner=signed?OWNER:null;const calls=[];
 w.setNav=()=>{};w.renderHome=()=>{};w.renderCreateHub=()=>{};w.toast=()=>{};w.openFeature=()=>{};w.neneOpenAuth=()=>{};w.neneRequireAccount=async()=>true;
 w.neneAuthGetUserId=async()=>owner;w.neneAuthGetAccessToken=async()=>owner?'x.'+Buffer.from(JSON.stringify({sub:owner})).toString('base64url')+'.x':null;w.NENE_DIRECTOR_CONFIG={backendUrl:'https://api.test'};
 w.fetch=async(url,options={})=>{calls.push({url,options});let data=url.includes('/pricing/quote')?{recommended_credits:120}:url.endsWith('/plans')?{items:[]}:url.endsWith('/status')?{available,credit_cost:'10',message:available?'10 paid credits':'Planning is not enabled yet.'}:{accepting_requests:available,message:'Paid generation is not enabled yet.',generate_audio_supported:true};return {ok:true,json:async()=>data};};
 w.eval(read('studio-ui.js'));w.eval(read(tool+'.js'));
 const open=()=>tool==='ad-studio'?w.neneOpenAdvertisement():tool==='social-content'?w.neneOpenSocialContent():tool==='director'?w.neneOpenDirector():w.neneOpenVideoStudio('text');
 await open();await settle();return {w,dom,calls,open,setOwner:id=>owner=id};
}
for(const tool of ['ad-studio','social-content','video-studio','director'])test(tool+': sign-in action follows actual session and private work clears on account change',async()=>{
 const s=await setup(tool),d=s.w.document,signin=d.querySelector('.studio-account button');assert.equal(signin.hidden,true);assert.match(d.querySelector('.studio-account-status').textContent,/Signed in/);
 s.setOwner(null);s.w.dispatchEvent(new s.w.Event('nene-auth-changed'));await settle();assert.equal(signin.hidden,false);assert.match(d.querySelector('.studio-account-status').textContent,/Sign in/);assert.equal(d.querySelector('[id$="-generate"],#directorGenerate').disabled,true);
 assert.equal(s.calls.filter(c=>c.options.method==='POST').length,0);s.dom.window.close();
});
for(const [tool,prefix] of [['ad-studio','ad'],['social-content','social'],['video-studio','video']])test(tool+': review precedes generate, disabled generation stays blocked and editing invalidates price',async()=>{
 const s=await setup(tool),d=s.w.document;
 for(const [name,value] of Object.entries({product:'Bread shop',audience:'Families',benefit:'Freshly baked bread',cta:'Visit today',idea:'A baker opens the oven to show fresh bread'})){const field=d.querySelector(`[name="${name}"]`);if(field)field.value=value;}
 const review=d.getElementById(prefix+'-review'),generate=d.getElementById(prefix+'-generate');assert.equal(review.hidden,false);assert.equal(generate.hidden,true);
 review.click();await settle();assert.equal(review.hidden,true);assert.equal(generate.hidden,false);assert.equal(generate.disabled,true);generate.click();await settle();assert.equal(s.calls.filter(c=>c.url.endsWith('/api/generations')).length,0);
 const field=d.querySelector('textarea');field.value+=' edited';field.dispatchEvent(new s.w.Event('input',{bubbles:true}));await settle();assert.equal(review.hidden,false);assert.equal(generate.hidden,true);s.dom.window.close();
});
test('AI Director rejects a previous account’s delayed plan response after switching accounts',async()=>{
 const s=await setup('director',{available:true});let release;let first=true;
 s.w.fetch=async(url)=>{if(url.endsWith('/status'))return {ok:true,json:async()=>({available:true,credit_cost:'10',message:'10 paid credits'})};if(first){first=false;await new Promise(r=>release=r);return {ok:true,json:async()=>({items:[{plan:{title:'PRIVATE OLD ACCOUNT PLAN',scenes:[]}}]})};}return {ok:true,json:async()=>({items:[{plan:{title:'New account plan',scenes:[]}}]})};};
 const opening=s.open();await settle();assert.ok(release);s.setOwner(OTHER);s.w.dispatchEvent(new s.w.Event('nene-auth-changed'));await settle();release();await opening;await settle();assert.doesNotMatch(s.w.document.body.textContent,/PRIVATE OLD ACCOUNT PLAN/);assert.match(s.w.document.body.textContent,/New account plan/);s.dom.window.close();
});
