const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync('director.js', 'utf8');
const plan = { id:'plan-1', status:'succeeded', brief:{scene_seconds:6}, plan:{title:'<img src=x onerror=alert(1)>',summary:'A real plan',continuity_notes:'Same apron',scenes:[{title:'Opening',visual_prompt:'A baker opens her shop.',narration:'Welcome',on_screen_text:'Open',sound_direction:'Quiet'}]} };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function setup({ signedIn=true, available=true, fail=false }={}) {
  const dom = new JSDOM('<div id="screen"></div>', { url:'https://neneai351.github.io/nene-ai-frontend/', runScripts:'outside-only' });
  const w=dom.window, calls=[];
  w.setNav=()=>{};w.renderCreateHub=()=>{};w.toast=()=>{};
  w.neneAuthGetAccessToken=async()=>signedIn?'test-token':null;
  w.NENE_DIRECTOR_CONFIG={backendUrl:'https://staging.example'};
  w.openTool=()=>{w.document.getElementById('screen').innerHTML='<textarea id="prompt"></textarea><select id="neneDuration"><option value="6">6</option></select>';};
  w.fetch=async(url, options)=>{
    calls.push({url,options});
    let data;
    if(url.endsWith('/status'))data={available,message:available?'Ready':'Not enabled yet'};
    else if(options.method==='POST') {
      if(fail)return {ok:false,status:503,json:async()=>({detail:'Planning provider is not configured.'})};
      data=plan;
    } else data={items:[]};
    return {ok:true,status:200,json:async()=>data};
  };
  w.eval(source);await w.neneOpenDirector();return {dom,w,calls};
}
(async()=>{
  {
    const {dom,w,calls}=await setup();
    w.document.getElementById('directorIdea').value='A baker opens a shop.';
    await w.neneBuildDirectorPlan();await w.neneBuildDirectorPlan();
    const submits=calls.filter(x=>x.options.method==='POST');
    assert.equal(submits.length,2);
    assert.equal(submits[0].options.headers['Idempotency-Key'],submits[1].options.headers['Idempotency-Key']);
    assert.equal(submits[0].options.headers.Authorization,'Bearer test-token');
    assert.equal(JSON.parse(submits[0].options.body).idea,'A baker opens a shop.');
    assert.ok(w.document.getElementById('directorResult').textContent.includes(plan.plan.title));
    assert.equal(w.document.querySelector('#directorResult img'),null,'Model text must not execute as HTML');
    [...w.document.querySelectorAll('button')].find(x=>x.textContent==='Use visual prompt in Text → Video').click();
    assert.equal(w.document.getElementById('prompt').value,'A baker opens her shop.');
    assert.equal(submits.length,2,'Opening a scene must not generate a video');
    dom.window.close();
  }
  {
    const {dom,w}=await setup({fail:true});
    w.document.getElementById('directorIdea').value='Keep my original idea.';
    await w.neneBuildDirectorPlan();
    assert.equal(w.document.getElementById('directorIdea').value,'Keep my original idea.');
    assert.match(w.document.getElementById('directorMessage').textContent,/not configured/);
    assert.equal(w.document.getElementById('directorResult').children.length,0);
    dom.window.close();
  }
  {
    const {dom,w,calls}=await setup({signedIn:false});
    assert.equal(calls.length,0);
    assert.equal(w.document.getElementById('directorGenerate').disabled,true);
    assert.match(w.document.getElementById('directorMessage').textContent,/sign in/i);
    dom.window.close();
  }
  {
    const {dom,w}=await setup({available:false});
    assert.equal(w.document.getElementById('directorGenerate').disabled,true);
    assert.match(w.document.getElementById('directorMessage').textContent,/Not enabled/);
    dom.window.close();
  }
  {
    // Exercise the actual home/Create card handler, not just the module.
    const html=fs.readFileSync('index.html','utf8');
    const dom=new JSDOM(html,{url:'https://neneai351.github.io/nene-ai-frontend/',runScripts:'outside-only'});
    const w=dom.window;
    w.alert=()=>{};w.fetch=async()=>({ok:true,status:200,json:async()=>({available:false,message:'Not enabled',items:[]})});
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if(!/\bsrc\s*=/.test(match[1]) && match[2].trim())w.eval(match[2]);
    }
    w.neneAuthGetAccessToken=async()=>null;
    w.NENE_DIRECTOR_CONFIG={backendUrl:'https://staging.example'};
    w.eval(source);
    const card=[...w.document.querySelectorAll('button')].find(x=>x.textContent.includes('AI Director'));
    assert.ok(card,'Home Director card exists');
    w.eval(card.getAttribute('onclick'));await tick();
    assert.equal(w.document.querySelector('#screen h1').textContent,'AI Director');
    assert.ok(w.document.getElementById('directorIdea'));
    assert.ok(!w.document.getElementById('screen').textContent.includes('undefined'));
    dom.window.close();
  }
  console.log('Director UI verified: auth, availability, real request, stable retry key, safe output, scene transfer and preserved input on failure.');
})().catch(error=>{console.error(error);process.exitCode=1;});
