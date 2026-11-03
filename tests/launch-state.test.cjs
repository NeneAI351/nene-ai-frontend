const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), {JSDOM}=require('jsdom');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
async function setup(){
 const dom=new JSDOM(html,{url:'https://nene.test',runScripts:'outside-only'}),w=dom.window;
 w.fetch=async()=>({ok:false});w.alert=()=>{};w.localStorage.setItem('nene_ai_projects_v1',JSON.stringify([{id:'project_secret',name:'Unowned private project'}]));
 w.localStorage.setItem('nene_ai_state_v1',JSON.stringify({credits:999999,creations:[{name:'Unowned private video'}]}));
 w.eval([...w.document.querySelectorAll('script:not([src])')].map(n=>n.textContent).join('\n'));
 await settle();return {w,dom};
}
test('fresh and signed-out homes have no sample or unowned work and no fabricated wallet balance',async()=>{
 const {w}=await setup();assert.doesNotMatch(w.document.body.textContent,/Welcome Demo|Brand Story|Launch Campaign|My Story Series|Unowned private/);
 assert.equal(w.document.getElementById('homePaidBalance').textContent,'—');assert.equal(w.document.querySelectorAll('.recent-projects .creation').length,0);w.close();
});
test('account switches clear projects immediately, reject stale responses and load only the current owner',async()=>{
 const {w}=await setup();let resolve;
 w.localStorage.setItem('nene_ai_projects_v2:owner-b',JSON.stringify([{id:'project_b',name:'B private',type:'Creative',status:'Draft'}]));
 w.localStorage.setItem('nene_ai_projects_v2:owner-a',JSON.stringify([{id:'project_a',name:'A private',type:'Creative',status:'Draft'}]));
 w.neneAuthGetUserId=async()=>'owner-a';await w.syncLocalAccount();assert.match(w.document.body.textContent,/A private/);
 w.neneAuthGetUserId=()=>new Promise(r=>resolve=r);const old=w.syncLocalAccount();assert.doesNotMatch(w.document.body.textContent,/A private/);
 w.neneAuthGetUserId=async()=>'owner-b';await w.syncLocalAccount();resolve('owner-a');await old;
 assert.match(w.document.body.textContent,/B private/);assert.doesNotMatch(w.document.body.textContent,/A private/);
 w.neneAuthGetUserId=async()=>null;w.dispatchEvent(new w.Event('nene-auth-changed'));assert.doesNotMatch(w.document.body.textContent,/B private/);await settle();w.close();
});
test('project names render as text in list, open and rename views',async()=>{
 const {w}=await setup();w.neneAuthGetUserId=async()=>'owner';
 const name='<img src=x onerror=alert(1)>';
 w.localStorage.setItem('nene_ai_projects_v2:owner',JSON.stringify([{id:'project_x',name,type:'<svg onload=alert(1)>',status:'Draft'}]));
 await w.syncLocalAccount();
 for(const action of [()=>w.renderProjects(),()=>w.openProject('project_x'),()=>w.renameProject('project_x')]){action();assert.equal(w.document.querySelector('#screen img:not(.hero img),#modalbox img'),null);}
 assert.equal(w.document.getElementById('renameProjectInput').value,name);w.close();
});
