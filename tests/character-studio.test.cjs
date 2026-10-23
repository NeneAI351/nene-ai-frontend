const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const code=fs.readFileSync(path.join(__dirname,'../characters.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<15;i++)await tick();}
function setup(){
 const dom=new JSDOM('<div id="screen"></div><div id="modal"></div>',{runScripts:'outside-only',url:'https://nene.test/'});
 const w=dom.window;let user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',fail=false,hold=null,posts=0,tool=null;
 const records=new Map(),calls=[];
 w.eval('var characters=[];');w.neneRequireAccount=async()=>!!user;w.neneAuthGetUserId=async()=>user;
 w.neneAuthGetAccessToken=async()=>user?'x.'+Buffer.from(JSON.stringify({sub:user})).toString('base64url')+'.x':null;
 w.NENE_DIRECTOR_CONFIG={backendUrl:'https://api.test'};w.openFeature=()=>{};w.openTool=t=>{tool=t;};w.buildStoryPlan=()=>{};w.generateStoryScenes=()=>{};
 w.toast=()=>{};w.renderCreateHub=()=>{};w.showModal=html=>w.document.getElementById('modal').innerHTML=html;w.closeModal=()=>w.document.getElementById('modal').replaceChildren();
 w.fetch=async(url,options)=>{
  const owner=JSON.parse(Buffer.from(options.headers.Authorization.split(' ')[1].split('.')[1],'base64url')).sub;
  const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
  calls.push({owner,method,url,body});
  if(method==='POST')posts++;
  if(hold)await hold;
  let data,status=200;
  if(method==='GET')data={items:[...records.values()].filter(r=>r.user_id===owner)};
  if(method==='POST'){data={...body,user_id:owner};records.set(body.id,data);if(fail){fail=false;throw Error('Connection lost');}}
  if(method==='PATCH'){const id=url.split('/').pop();data={...records.get(id),...body};records.set(id,data);}
  if(method==='DELETE'){records.delete(url.split('/').pop());status=204;}
  return {ok:true,status,json:async()=>data};
 };
 w.eval(code);
 return {w,dom,records,calls,get posts(){return posts;},get tool(){return tool;},setUser:id=>{user=id;w.dispatchEvent(new w.CustomEvent('nene-auth-changed'));},failNext:()=>fail=true,hold:p=>hold=p};
}
async function createForm(s,name='Amara'){
 await s.w.openFeature('characters');s.w.document.getElementById('newCharacter').click();
 const f=s.w.document.getElementById('characterForm');f.elements.name.value=name;f.elements.appearance.value='Gold coat';return f;
}
function submit(w,f){f.dispatchEvent(new w.Event('submit',{cancelable:true}));}
test('server-confirmed create, reload, edit, safe rendering and delete',async()=>{
 const s=setup(),{w}=s;const f=await createForm(s,'<img src=x onerror=alert(1)>');submit(w,f);await settle();
 assert.equal(s.posts,1);assert.equal(w.characters.length,1);assert.equal(w.document.querySelectorAll('#characterList img').length,0);
 assert.match(w.document.getElementById('characterStatus').textContent,/saved to your account/);
 await w.openFeature('characters');assert.equal(w.characters.length,1);
 w.document.querySelector('[data-edit-character]').click();const edit=w.document.getElementById('characterForm');edit.elements.name.value='Updated';submit(w,edit);await settle();
 assert.equal(w.characters[0].name,'Updated');
 w.document.querySelector('[data-delete-character]').click();w.document.getElementById('confirmCharacterDelete').click();await settle();
 assert.equal(w.characters.length,0);assert.equal(s.records.size,0);s.dom.window.close();
});
test('lost save response retries the same UUID and payload without duplicate characters',async()=>{
 const s=setup(),f=await createForm(s);s.failNext();submit(s.w,f);await settle();
 assert.equal(s.w.characters.length,0);assert.match(s.w.document.getElementById('characterFormStatus').textContent,/retry the same details/);
 submit(s.w,f);await settle();assert.equal(s.posts,2);assert.equal(s.records.size,1);
 const saves=s.calls.filter(c=>c.method==='POST');assert.deepEqual(saves[0].body,saves[1].body);s.dom.window.close();
});
test('double submit and navigation during save do not create duplicate requests',async()=>{
 const s=setup(),f=await createForm(s);let release;s.hold(new Promise(r=>release=r));
 submit(s.w,f);submit(s.w,f);await settle();s.w.document.getElementById('newCharacter').click();await s.w.openFeature('characters');
 assert.equal(s.posts,1);release();await settle();assert.equal(s.records.size,1);s.dom.window.close();
});
test('account changes discard characters and ignore an in-flight previous-owner response',async()=>{
 const s=setup(),f=await createForm(s);let release;s.hold(new Promise(r=>release=r));submit(s.w,f);await settle();
 s.setUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');release();await settle();
 assert.equal(s.w.characters.length,0);assert.equal(s.w.document.querySelector('[data-character-studio]'),null);
 s.hold(null);await s.w.openFeature('characters');assert.equal(s.w.characters.length,0);s.dom.window.close();
});
test('story entry loads only the current account characters and ignores legacy shared data',async()=>{
 const s=setup();s.w.localStorage.setItem('nene_ai_characters_v1',JSON.stringify([{name:'Other account'}]));
 const f=await createForm(s);submit(s.w,f);await settle();await s.w.openTool('story');
 assert.equal(s.tool,'story');assert.equal(s.w.characters.length,1);assert.equal(s.w.characters[0].name,'Amara');
 s.setUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');await s.w.openTool('story');assert.equal(s.w.characters.length,0);s.dom.window.close();
});
