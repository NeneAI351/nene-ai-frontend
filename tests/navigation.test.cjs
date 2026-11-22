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
