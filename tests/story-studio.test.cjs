const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const USER='11111111-1111-4111-8111-111111111111',STORY='22222222-2222-4222-8222-222222222222',JOB='33333333-3333-4333-8333-333333333333';
const source=fs.readFileSync(__dirname+'/../story-studio.js','utf8');
async function settle(){for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));}
async function setup({enabled=true,fail=false,saved}={}){
 const dom=new JSDOM('<main><select id="neneDuration"></select><select id="neneResolution"></select><select id="storyScenes"></select><div class="block"><select id="neneProvider"></select></div><div id="neneProviderNotice"></div></main>',{url:'https://app.test',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.remove();};
 w.openTool=async()=>{};w.neneAuthGetUserId=async()=>USER;w.neneAuthGetAccessToken=async()=>'x.'+Buffer.from(JSON.stringify({sub:USER})).toString('base64url')+'.x';w.NENE_DIRECTOR_CONFIG={backendUrl:'https://api.test'};
 if(saved)w.localStorage.setItem('nene_durable_story_v1:'+USER,JSON.stringify(saved));
 w.fetch=async(url,options={})=>{calls.push({url,options});let data={};if(url.endsWith('/api/generation-availability'))data={accepting_requests:enabled,generate_audio_supported:true,story_audio_supported:true};else if(url.endsWith('/api/pricing/quote'))data={recommended_credits:120};else if(url.endsWith('/api/stories'))data={id:STORY};else if(url.endsWith('/api/generations')){if(fail)throw Error('Connection lost');data={generation_id:JOB};}else if(url.endsWith('/assembly'))data={assembly:{status:'succeeded'}};else if(url.endsWith('/video'))data={video_url:'https://private.test/story.mp4?signature=secret'};else data={generation:{status:'succeeded'}};return {ok:true,json:async()=>data};};
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
test('closed launch gate never creates a story or paid scene',async()=>{const s=await setup({enabled:false});await s.w.neneGenerateDurableStory(plan);assert.equal(paid(s).length,0);assert.equal(s.calls.some(c=>c.url.endsWith('/api/stories')),false);assert.equal(s.w.document.querySelector('dialog'),null);assert.match(s.w.document.body.textContent,/no credits were charged/);s.dom.window.close();});
test('actual story planner retains per-scene sound choices after character selection changes',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');const start=html.indexOf('function getSelectedStoryCharacters(){'),end=html.indexOf('async function generateStoryScenes(){',start);
 const dom=new JSDOM('<main><textarea id="prompt">River friends</textarea><input type="checkbox" class="storyCharacterCheck" checked value="0"><select id="storyScenes"><option value="3">3</option></select><div id="storySceneCharacters"></div><button id="neneGenerateBtn"></button></main>',{url:'https://app.test',runScripts:'outside-only'}),w=dom.window;
 w.eval('const characters=[{id:"'+USER+'",name:"Ada"}];'+html.slice(start,end));w.NENECharacters={owner:USER};w.escapeNeneText=String;w.toast=()=>{};w.generateStoryScenes=()=>{};
 w.renderStoryCharacterAssignments();const choices=w.document.querySelectorAll('.storySceneAudio');assert.equal(choices.length,3);choices[1].value='silent';w.document.querySelector('.storySceneSound').value='River water';w.renderStoryCharacterAssignments();assert.equal(w.document.querySelectorAll('.storySceneAudio')[1].value,'silent');w.buildStoryPlan();assert.equal(w.neneCurrentStoryPlan.scenes[0].sound_direction,'River water');assert.equal(w.neneCurrentStoryPlan.scenes[1].generate_audio,false);dom.window.close();
});
