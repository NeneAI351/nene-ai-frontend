const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const USER='11111111-1111-4111-8111-111111111111',STORY='22222222-2222-4222-8222-222222222222',JOB='33333333-3333-4333-8333-333333333333';
const source=fs.readFileSync(__dirname+'/../story-studio.js','utf8');
async function settle(){for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));}
async function setup({enabled=true,fail=false,saved,sceneFailure=false,brokenQuote=false,provider="ltx"}={}){
 const dom=new JSDOM('<main><select id="neneDuration"></select><select id="neneResolution"></select><select id="storyScenes"></select><div class="block"><select id="neneProvider"></select></div><div id="neneProviderNotice"></div></main>',{url:'https://app.test',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.remove();};
 w.openTool=async()=>{};w.neneAuthGetUserId=async()=>USER;w.neneAuthGetAccessToken=async()=>'x.'+Buffer.from(JSON.stringify({sub:USER})).toString('base64url')+'.x';w.NENE_DIRECTOR_CONFIG={backendUrl:'https://api.test'};
 if(saved)w.localStorage.setItem('nene_durable_story_v1:'+USER,JSON.stringify(saved));
 let retried=false,assembled=false;w.HTMLMediaElement.prototype.play=async()=>{};w.fetch=async(url,options={})=>{calls.push({url,options});let data={};if(url.endsWith('/api/generation-availability'))data={accepting_requests:enabled,generate_audio_supported:true,story_audio_supported:true,story_generation:{provider,model:provider==="magic-hour"?"minimax-h3":"ltx-2-5-fast",resolutions:provider==="magic-hour"?["480p","720p","1080p"]:["720p","1080p"],reference_aspect_ratio:provider==="magic-hour"?null:"16:9"}};else if(url.endsWith('/api/stories/quote')){const scenes=JSON.parse(options.body).scenes;data={scenes:scenes.map((_,i)=>({scene_index:i,credits:'120'})),total_credits:brokenQuote?'invalid':String(scenes.length*120)};}else if(url.endsWith('/api/stories'))data=options.method?{id:STORY}:{items:[]};else if(url.endsWith('/api/generations')){if(fail)throw Error('Connection lost');data={generation_id:JOB};}else if(url.endsWith('/retry')){retried=true;data={generation_id:JOB};}else if(url.endsWith('/assemble')){assembled=true;data={};}else if(url.endsWith('/api/stories/'+STORY))data={title:'River story',status:assembled?'completed':'generating',scenes:[{scene_index:0,generation_id:saved&&!saved.scenes[0]?.generationId?null:JOB,status:sceneFailure&&!retried?'failed':'succeeded'},{scene_index:1,generation_id:saved&&!saved.scenes[1]?.generationId?null:JOB,status:'succeeded'}]};else if(url.endsWith('/media-url'))data={url:'https://private.test/scene.mp4?signature=secret'};else if(url.endsWith('/assembly'))data={assembly:{status:'succeeded'}};else if(url.endsWith('/video'))data={video_url:'https://private.test/story.mp4?signature=secret'};else data={generation:{status:sceneFailure&&!retried?'failed':'succeeded'}};return {ok:true,json:async()=>data};};
 w.eval(source);await w.openTool('story');return {w,dom,calls};
}
const plan={owner:USER,title:'River story',storyPrompt:'Friends cross a river',characters:[{id:USER}],scenes:[{title:'Opening',brief:'Establish river',generate_audio:true,sound_direction:'Flowing water',characters:[]},{title:'Ending',brief:'Reach home',generate_audio:false,sound_direction:'ignored',characters:[]}]};
const paid=s=>s.calls.filter(c=>c.url.endsWith('/api/generations'));
test('story reviews the total, saves sound settings, submits durable scenes and privately assembles',async()=>{
 const s=await setup();await s.w.neneGenerateDurableStory(plan);assert.equal(paid(s).length,0);assert.match(s.w.document.querySelector('dialog').textContent,/240 paid credits total/);s.w.document.querySelector('dialog .gold').click();await settle();assert.equal(paid(s).length,2);
 const bodies=paid(s).map(c=>JSON.parse(c.options.body));assert.equal(bodies[0].generate_audio,true);assert.match(bodies[0].prompt,/Flowing water/);assert.equal(bodies[1].generate_audio,false);assert.doesNotMatch(bodies[1].prompt,/ignored/);assert.equal(bodies[0].credit_limit,'120');
 assert.ok(s.calls.some(c=>c.url.endsWith('/api/stories/'+STORY+'/assemble')));assert.ok(s.w.document.querySelector('video'));assert.ok(!s.calls.some(c=>/\/api\/(generate|story\/assemble)$/.test(c.url)));assert.doesNotMatch(s.w.localStorage.getItem('nene_durable_story_v1:'+USER),/signature=|Bearer|data:image/);s.dom.window.close();
});
test('a lost submission response replays exactly the same paid scene key and payload',async()=>{
 const first=await setup({fail:true});await first.w.neneGenerateDurableStory(plan);first.w.document.querySelector('dialog .gold').click();await settle();const saved=JSON.parse(first.w.localStorage.getItem('nene_durable_story_v1:'+USER)),before=paid(first)[0];first.dom.window.close();
 const next=await setup({saved});[...next.w.document.querySelectorAll('button')].find(n=>n.textContent==='Continue saved story').click();await settle();assert.equal(paid(next)[0].options.headers['Idempotency-Key'],before.options.headers['Idempotency-Key']);assert.equal(paid(next)[0].options.body,before.options.body);next.dom.window.close();
});
test('closed launch gate never creates a story or paid scene',async()=>{const s=await setup({enabled:false});await s.w.neneGenerateDurableStory(plan);assert.equal(paid(s).length,0);assert.equal(s.calls.some(c=>c.url.endsWith('/api/stories')&&c.options.method==='POST'),false);assert.equal(s.w.document.querySelector('dialog'),null);assert.match(s.w.document.body.textContent,/no credits were charged/);s.dom.window.close();});
test('actual story planner retains per-scene sound choices after character selection changes',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');const start=html.indexOf('function getSelectedStoryCharacters(){'),end=html.indexOf('async function generateStoryScenes(){',start);
 const dom=new JSDOM('<main><textarea id="prompt">River friends</textarea><input type="checkbox" class="storyCharacterCheck" checked value="0"><select id="storyScenes"><option value="3">3</option></select><div id="storySceneCharacters"></div><button id="neneGenerateBtn"></button></main>',{url:'https://app.test',runScripts:'outside-only'}),w=dom.window;
 w.eval('const characters=[{id:"'+USER+'",name:"Ada"}];'+html.slice(start,end));w.NENECharacters={owner:USER};w.escapeNeneText=String;w.toast=()=>{};w.generateStoryScenes=()=>{};
 w.renderStoryCharacterAssignments();const choices=w.document.querySelectorAll('.storySceneAudio');assert.equal(choices.length,3);choices[1].value='silent';w.document.querySelector('.storySceneSound').value='River water';w.renderStoryCharacterAssignments();assert.equal(w.document.querySelectorAll('.storySceneAudio')[1].value,'silent');w.buildStoryPlan();assert.equal(w.neneCurrentStoryPlan.scenes[0].sound_direction,'River water');assert.equal(w.neneCurrentStoryPlan.scenes[1].generate_audio,false);dom.window.close();
});

test('editable scene titles and visual descriptions survive character assignment rerender',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const start=html.indexOf('function getSelectedStoryCharacters(){'),end=html.indexOf('async function generateStoryScenes(){',start);
 const dom=new JSDOM('<main><textarea id="prompt">River friends</textarea><input type="checkbox" class="storyCharacterCheck" checked value="0"><select id="storyScenes"><option value="2">2</option></select><div id="storySceneCharacters"></div><button id="neneGenerateBtn"></button></main>',{url:'https://app.test',runScripts:'outside-only'}),w=dom.window;
 w.eval('const characters=[{id:"'+USER+'",name:"Ada"}];'+html.slice(start,end));w.NENECharacters={owner:USER};w.escapeNeneText=String;w.toast=()=>{};w.generateStoryScenes=()=>{};
 w.renderStoryCharacterAssignments();
 w.document.querySelectorAll('.storySceneTitle')[0].value='Crossing';
 w.document.querySelectorAll('.storySceneBrief')[0].value='Ada crosses the river at sunset.';
 w.renderStoryCharacterAssignments();
 assert.equal(w.document.querySelectorAll('.storySceneTitle')[0].value,'Crossing');
 assert.equal(w.document.querySelectorAll('.storySceneBrief')[0].value,'Ada crosses the river at sunset.');
 w.buildStoryPlan();
 assert.equal(w.neneCurrentStoryPlan.scenes[0].title,'Crossing');
 assert.equal(w.neneCurrentStoryPlan.scenes[0].brief,'Ada crosses the river at sunset.');
 dom.window.close();
});
test('story guidance requires approval and keeps original when cancelled',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const start=html.indexOf('function neneEnhanceStoryIdea(){'),end=html.indexOf('function neneSaveStoryDraft(){',start);
 const dom=new JSDOM('<textarea id="prompt">A river journey</textarea>',{url:'https://app.test',runScripts:'outside-only'}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.dispatchEvent(new w.Event('close'));};
 w.eval(html.slice(start,end));
 w.neneEnhanceStoryIdea();
 assert.equal(w.document.getElementById('prompt').value,'A river journey');
 w.document.querySelector('dialog button').click();
 assert.equal(w.document.getElementById('prompt').value,'A river journey');
 w.neneEnhanceStoryIdea();w.document.querySelector('dialog .gold').click();
 assert.match(w.document.getElementById('prompt').value,/Story direction/);
 dom.window.close();
});

test('character studio round-trip restores story text, scene edits, audio and character assignments',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const start=html.indexOf('function neneSaveStoryDraft(){'),end=html.indexOf('function openTool(type){',start);
 const plannerStart=html.indexOf('function getSelectedStoryCharacters(){'),plannerEnd=html.indexOf('function buildStoryPlan(){',plannerStart);
 const markup='<main><textarea id="prompt">Original story</textarea><textarea id="storyCharacter">Blue jacket</textarea><label><input type="checkbox" class="storyCharacterCheck" value="0" checked></label><select id="storyScenes"><option value="2">2</option></select><select id="neneDuration"><option value="6">6</option><option value="8">8</option></select><select id="neneResolution"><option value="720p">720p</option></select><div id="storySceneCharacters"></div></main>';
 const dom=new JSDOM(markup,{url:'https://app.test',runScripts:'outside-only'}),w=dom.window;
 w.eval('const characters=[{id:"'+USER+'",name:"Ada"}];'+html.slice(plannerStart,plannerEnd)+html.slice(start,end));
 w.NENECharacters={owner:USER,render:()=>{}};w.escapeNeneText=String;w.toast=()=>{};
 w.renderStoryCharacterAssignments();
 w.document.querySelector('.storySceneTitle').value='A new beginning';
 w.document.querySelector('.storySceneBrief').value='Ada boards the ferry.';
 w.document.querySelector('.storySceneAudio').value='silent';
 assert.equal(w.neneSaveStoryDraft(),true);
 w.document.getElementById('prompt').value='';
 w.document.querySelector('.storyCharacterCheck').checked=false;
 w.renderStoryCharacterAssignments();
 w.neneRestoreStoryDraft();
 assert.equal(w.document.getElementById('prompt').value,'Original story');
 assert.equal(w.document.querySelector('.storyCharacterCheck').checked,true);
 assert.equal(w.document.querySelector('.storySceneTitle').value,'A new beginning');
 assert.equal(w.document.querySelector('.storySceneBrief').value,'Ada boards the ferry.');
 assert.equal(w.document.querySelector('.storySceneAudio').value,'silent');
 dom.window.close();
});

test('story planner refuses a blank scene title without preparing a plan',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const start=html.indexOf('function getSelectedStoryCharacters(){'),end=html.indexOf('async function generateStoryScenes(){',start);
 const dom=new JSDOM('<main><textarea id="prompt">River friends</textarea><input type="checkbox" class="storyCharacterCheck" checked value="0"><select id="storyScenes"><option value="2">2</option></select><div id="storySceneCharacters"></div><button id="neneGenerateBtn"></button></main>',{url:'https://app.test',runScripts:'outside-only'}),w=dom.window;
 w.eval('const characters=[{id:"'+USER+'",name:"Ada"}];'+html.slice(start,end));
 w.NENECharacters={owner:USER};w.escapeNeneText=String;w.toast=()=>{};
 let warning='';w.alert=message=>{warning=message;};
 w.renderStoryCharacterAssignments();
 w.document.querySelector('.storySceneTitle').value=' ';
 w.buildStoryPlan();
 assert.match(warning,/Give scene 1 a title/);
 assert.equal(w.neneCurrentStoryPlan,undefined);
 assert.equal(w.document.getElementById('neneGenerateBtn').disabled,false);
 dom.window.close();
});


test('five-scene estimate comes from the server and confirmation pins every scene limit',async()=>{
 const s=await setup(),five={...plan,scenes:Array.from({length:5},()=>plan.scenes[0])};await s.w.neneGenerateDurableStory(five);
 const request=s.calls.find(c=>c.url.endsWith('/api/stories/quote'));assert.equal(JSON.parse(request.options.body).scenes.length,5);
 assert.match(s.w.document.querySelector('dialog').textContent,/600 paid credits total/);assert.equal(paid(s).length,0);
 s.w.document.querySelector('dialog .gold').click();await settle();assert.equal(paid(s).length,5);assert.ok(paid(s).every(c=>JSON.parse(c.options.body).credit_limit==='120'));s.dom.window.close();
});
test('invalid total never permits a paid story request',async()=>{const s=await setup({brokenQuote:true});await s.w.neneGenerateDurableStory(plan);assert.equal(s.w.document.querySelector('dialog'),null);assert.equal(paid(s).length,0);s.dom.window.close();});
test('failed scene requires a fresh review and uses the safe retry endpoint before continuing',async()=>{
 const s=await setup({sceneFailure:true});await s.w.neneGenerateDurableStory(plan);s.w.document.querySelector('dialog .gold').click();await settle();
 const b=[...s.w.document.querySelectorAll('button')].find(b=>b.textContent==='Review retry for scene 1');assert.ok(b);b.click();await settle();assert.equal(s.calls.filter(c=>c.url.endsWith('/retry')).length,0);
 s.w.document.querySelector('dialog .gold').click();await settle();const retries=s.calls.filter(c=>c.url.endsWith('/retry'));assert.equal(retries.length,1);assert.equal(JSON.parse(retries[0].options.body).failed_generation_id,JOB);assert.equal(JSON.parse(retries[0].options.body).credit_limit,'120');assert.ok([...s.w.document.querySelectorAll('button')].some(b=>b.textContent==='Watch finished film'));s.dom.window.close();
});
test('scene preview advances in order through private GET links without further generation',async()=>{
 const s=await setup();await s.w.neneGenerateDurableStory(plan);s.w.document.querySelector('dialog .gold').click();await settle();const count=paid(s).length;
 const b=[...s.w.document.querySelectorAll('button')].find(b=>b.textContent==='Preview scenes in order');b.click();await settle();const player=s.w.document.querySelector('#neneStoryWorkspace video');assert.equal(player.getAttribute('aria-label'),'Scene 1');player.onended();await settle();assert.equal(player.getAttribute('aria-label'),'Scene 2');assert.equal(paid(s).length,count);s.dom.window.close();
});

test('a configured story provider is pinned in all reviewed scene submissions',async()=>{
 const s=await setup({provider:'magic-hour'});await s.w.neneGenerateDurableStory(plan);s.w.document.querySelector('dialog .gold').click();await settle();assert.ok(paid(s).every(c=>JSON.parse(c.options.body).provider==='magic-hour'&&JSON.parse(c.options.body).model==='minimax-h3'));s.dom.window.close();
});
test('reference-led Magic Hour scenes preserve source format instead of claiming unsupported crop',async()=>{
 const s=await setup({provider:'magic-hour'}),p={...plan,scenes:[{...plan.scenes[0],characters:[{id:USER,name:'Ada',referenceImage:'data:image/png;base64,eA=='}]}]};
 const original=s.w.fetch;s.w.fetch=async(url,o)=>url.endsWith('/api/image-upload')?{ok:true,json:async()=>({private:true,source_image_id:USER})}:original(url,o);
 await s.w.neneGenerateDurableStory(p);s.w.document.querySelector('dialog .gold').click();await settle();const body=JSON.parse(paid(s)[0].options.body);assert.equal(body.type,'image-to-video');assert.equal(body.aspect_ratio,null);assert.equal(body.source_image_id,USER);s.dom.window.close();
});

test('480p is offered only for a supporting story adapter',async()=>{
 for(const provider of ['magic-hour','ltx']){
  const {dom}=await setup({provider});await dom.window.openTool('story');
  const values=[...dom.window.document.getElementById('neneResolution').options].map(o=>o.value);
  assert.equal(values.includes('480p'),provider==='magic-hour');dom.window.close();
 }
});

test('creating stays visible until the backend completes the film; errors never show Done',async()=>{
 const s=await setup();const button=s.w.document.createElement('button');button.id='neneGenerateStoryScenesBtn';s.w.document.querySelector('main').append(button);
 const original=s.w.fetch;let finish;
 s.w.fetch=async(url,options)=>url.endsWith('/assembly')?new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({assembly:{status:'succeeded'}})});}):original(url,options);
 await s.w.neneGenerateDurableStory(plan);s.w.document.querySelector('dialog .gold').click();
 assert.equal(button.textContent,'Creating…');assert.equal(button.disabled,true);
 await settle();assert.equal(button.textContent,'Combining…');assert.doesNotMatch(s.w.document.getElementById('neneStoryProgress').textContent,/^Done/);
 finish();await settle();assert.equal(button.textContent,'Done');assert.match(s.w.document.getElementById('neneStoryProgress').textContent,/saved to My Creations/);s.dom.window.close();
 const failed=await setup({fail:true});await failed.w.neneGenerateDurableStory(plan);failed.w.document.querySelector('dialog .gold').click();await settle();assert.equal(failed.w.document.getElementById('neneStoryProgress').dataset.state,'Check saved progress');failed.dom.window.close();
});
