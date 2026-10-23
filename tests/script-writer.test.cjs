const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../script-writer.js'),'utf8');
async function settle(){for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));}
const marker='NENE_SCRIPT_V1\n';
function setup(){
 const dom=new JSDOM('<div id="screen"></div>',{url:'https://nene.test',runScripts:'outside-only'}),w=dom.window;
 let user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',enabled=true,fail=false,hold=null;
 const calls=[],records=new Map();
 w.neneRequireAccount=async()=>!!user;w.neneAuthGetUserId=async()=>user;
 w.neneAuthGetAccessToken=async()=>user?'x.'+Buffer.from(JSON.stringify({sub:user})).toString('base64url')+'.x':null;
 w.NENE_DIRECTOR_CONFIG={backendUrl:'https://api.test'};w.setNav=()=>{};w.renderCreateHub=()=>{};w.openFeature=()=>{throw Error('Prototype called');};w.toast=()=>{};
 w.fetch=async(url,options)=>{
  const owner=JSON.parse(Buffer.from(options.headers.Authorization.split(' ')[1].split('.')[1],'base64url')).sub;
  calls.push({url,options,owner});if(hold)await hold;
  let data;
  if(url.endsWith('/status'))data={available:enabled,credit_cost:'10'};
  else if(!options.method)data={items:[...records.values()].filter(r=>r.owner===owner)};
  else{const brief=JSON.parse(options.body),key=owner+options.headers['Idempotency-Key'];if(!records.has(key))records.set(key,{id:key,owner,brief,plan:{title:'<img src=x onerror=alert(1)>',summary:'The opening day',continuity_notes:'Same apron',scenes:[{title:'Hook',visual_prompt:'The baker opens her shop.',narration:'Welcome to opening day!',on_screen_text:'Welcome',sound_direction:'Soft music'}]}});data=records.get(key);if(fail){fail=false;throw Error('Connection lost');}}
  return {ok:true,status:200,json:async()=>data};
 };
 w.eval(code);
 return {dom,w,calls,records,setEnabled:v=>enabled=v,failNext:()=>fail=true,hold:p=>hold=p,setUser:id=>{user=id;w.dispatchEvent(new w.CustomEvent('nene-auth-changed'));}};
}
async function generate(s){await s.w.openFeature('script');const f=s.w.document.querySelector('form');f.elements.idea.value='A baker opens her first neighbourhood shop.';f.dispatchEvent(new s.w.Event('submit',{cancelable:true}));await settle();return f;}
test('script route checks paid availability and never fabricates a result while disabled',async()=>{
 const s=setup();s.setEnabled(false);await s.w.openFeature('script');assert.equal(s.w.document.querySelector('button[type=submit]').disabled,true);assert.match(s.w.document.querySelector('[data-script-status]').textContent,/not enabled/);assert.equal(s.calls.filter(c=>c.options.method==='POST').length,0);s.dom.window.close();
});
test('real planning contract, private save list, safe editable output and no automatic video',async()=>{
 const s=setup();await generate(s);const post=s.calls.find(c=>c.options.method==='POST');assert.equal(post.url,'https://api.test/api/director/plans');const body=JSON.parse(post.options.body);assert.ok(body.idea.startsWith(marker));assert.equal(body.scene_count,3);assert.equal(body.scene_seconds,6);assert.ok(post.options.headers['Idempotency-Key']);assert.equal(s.records.size,1);
 const editor=s.w.document.querySelector('[aria-label="Editable script copy"]');assert.match(editor.value,/Welcome to opening day!/);assert.equal(s.w.document.querySelectorAll('[data-script-result] img').length,0);assert.equal(s.calls.some(c=>c.url.includes('/generate')),false);assert.equal(s.w.document.querySelector('[data-script-saved] button').textContent,'<img src=x onerror=alert(1)>');s.dom.window.close();
});
test('lost response, double submit and screen reopen keep the same paid request key',async()=>{
 const s=setup();s.failNext();const f=await generate(s);const first=s.calls.find(c=>c.options.method==='POST');
 assert.match(s.w.document.querySelector('[data-script-status]').textContent,/retained/);
 await s.w.openFeature('script');s.w.document.querySelectorAll('button').forEach(b=>{if(b.textContent==='Retry saved request'){b.click();b.click();}});await settle();
 const posts=s.calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,2);assert.equal(posts[1].options.headers['Idempotency-Key'],first.options.headers['Idempotency-Key']);assert.equal(posts[1].options.body,first.options.body);assert.equal(s.records.size,1);s.dom.window.close();
});
test('changed brief cannot silently start a second paid request',async()=>{
 const s=setup();const f=await generate(s);f.elements.idea.value='A completely different paid script idea.';f.dispatchEvent(new s.w.Event('submit',{cancelable:true}));await settle();assert.equal(s.calls.filter(c=>c.options.method==='POST').length,1);assert.match(s.w.document.querySelector('[data-script-status]').textContent,/previous request/);s.dom.window.close();
});
test('account switch clears output and ignores a stale request response',async()=>{
 const s=setup();await s.w.openFeature('script');let release;s.hold(new Promise(r=>release=r));const f=s.w.document.querySelector('form');f.elements.idea.value='A baker opens her first neighbourhood shop.';f.dispatchEvent(new s.w.Event('submit',{cancelable:true}));await settle();s.setUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');release();await settle();assert.equal(s.w.document.querySelector('[aria-label="Editable script copy"]'),null);s.hold(null);await s.w.openFeature('script');assert.equal(s.w.document.querySelector('[data-script-saved] button'),null);assert.ok([...s.w.document.querySelectorAll('button')].find(b=>b.textContent==='Retry saved request').hidden);s.dom.window.close();
});
