const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(__dirname+'/../layout.js','utf8');
const wait=()=>new Promise(r=>setTimeout(r,30));
function setup(){const dom=new JSDOM('<div id="screen"><main><b id="homePaidBalance">194</b></main></div>',{url:'https://neneai.app/',runScripts:'outside-only'}),w=dom.window;
 w.renderHome=()=>{w.document.getElementById('screen').innerHTML='<main><b id="homePaidBalance">194</b></main>';};w.closeModal=()=>{};w.eval(source);return {dom,w,screen:w.document.getElementById('screen')};}
test('system Back returns from chat or tool to dashboard with no reload or exit',async()=>{const {dom,w,screen}=setup();const initial=w.history.length;
 screen.innerHTML='<main>AI Director chat</main>';await wait();assert.equal(w.history.length,initial+1);assert.equal(w.history.state.neneView,'tool');
 screen.innerHTML='<main>Another conversation</main>';await wait();assert.equal(w.history.length,initial+1);
 w.history.back();await wait();assert.ok(screen.querySelector('#homePaidBalance'));assert.equal(w.history.state.neneView,'home');dom.window.close();});
test('Home button consumes the tool entry and opening another tool still supports Back',async()=>{const {dom,w,screen}=setup();screen.innerHTML='<main>Story Studio</main>';await wait();w.renderHome();await wait();assert.equal(w.history.state.neneView,'home');
 screen.innerHTML='<main>Profile</main>';await wait();assert.equal(w.history.state.neneView,'tool');w.history.back();await wait();assert.ok(screen.querySelector('#homePaidBalance'));dom.window.close();});
test('dashboard refreshes do not add history entries or trap Back',async()=>{const {dom,w}=setup();const initial=w.history.length;w.renderHome();await wait();w.renderHome();await wait();assert.equal(w.history.length,initial);dom.window.close();});

function refreshSetup({saved,owner='owner-a',historyState}={}){const dom=new JSDOM('<div id="screen"><main><b id="homePaidBalance">194</b></main></div>',{url:'https://neneai.app/',runScripts:'outside-only'}),w=dom.window;
 if(saved)w.sessionStorage.setItem('nene_last_page_v1',JSON.stringify(saved));if(historyState){w.history.replaceState({neneView:'home'},'');w.history.pushState(historyState,'');}
 w.neneAuthGetUserId=async()=>owner;w.syncLocalAccount=async()=>{};w.closeModal=()=>{};
 w.renderHome=()=>{w.document.getElementById('screen').innerHTML='<main><b id="homePaidBalance">194</b></main>';};
 w.openFeature=kind=>{w.document.getElementById('screen').innerHTML='<main>'+kind+'</main>';};w.eval(source);return {dom,w};}
test('refresh restores the same account page and Back still returns Home',async()=>{const {dom,w}=refreshSetup({saved:{owner:'owner-a',method:'openFeature',arg:'director'},historyState:{neneView:'tool'}});const initial=w.history.length;await wait();assert.equal(w.document.getElementById('screen').textContent,'director');assert.equal(w.history.length,initial);w.history.back();await wait();assert.ok(w.document.getElementById('homePaidBalance'));dom.window.close();});
test('page changes are remembered and Home replaces the remembered tool',async()=>{const {dom,w}=refreshSetup();await wait();w.openFeature('story');await wait();assert.equal(JSON.parse(w.sessionStorage.getItem('nene_last_page_v1')).arg,'story');w.renderHome();await wait();assert.equal(JSON.parse(w.sessionStorage.getItem('nene_last_page_v1')).method,'renderHome');dom.window.close();});
test('refresh never restores another account or an unapproved action',async()=>{for(const saved of [{owner:'other',method:'openFeature',arg:'director'},{owner:'owner-a',method:'neneGenerateDurableStory',arg:'story'}]){const {dom,w}=refreshSetup({saved});await wait();assert.ok(w.document.getElementById('homePaidBalance'));assert.equal(w.sessionStorage.getItem('nene_last_page_v1'),null);dom.window.close();}});
