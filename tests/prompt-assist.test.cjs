const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../prompt-assist.js'),'utf8');
function setup(){
 const dom=new JSDOM('<div id="screen"><div><textarea id="prompt"></textarea></div><select id="neneStyle"><option>3D</option><option>Cinematic</option></select><select id="neneShot"><option>Wide shot</option></select><select id="neneCamera"><option>Static locked camera</option></select><select id="neneLighting"><option>Soft studio light</option></select><select id="neneMotion"><option>Gentle movement</option></select></div><div id="modalbox"></div>',{url:'https://nene.test',runScripts:'outside-only'});
 const w=dom.window;let requests=0,notice='';w.fetch=()=>{requests++;throw Error('No remote requests allowed');};w.credits=123;w.toast=text=>notice=text;w.showModal=()=>{};w.closeModal=()=>w.document.getElementById('modalbox').replaceChildren();w.eval(source);
 const field=w.document.getElementById('prompt');const button=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===text);
 return {dom,w,field,button,get requests(){return requests;},get notice(){return notice;}};
}
test('preview preserves the idea and selected style without submitting or charging',()=>{
 const s=setup();s.field.value='An animated blue bird lands on a branch. Keep the camera still.';s.w.enhanceNenePrompt();
 const draft=s.w.document.getElementById('nenePromptSuggestion').value;assert.ok(draft.includes(s.field.value));assert.match(draft,/Visual style: 3D/);assert.match(draft,/Camera: Static locked camera/);assert.doesNotMatch(draft,/photorealistic|natural human motion/);assert.equal(s.requests,0);assert.equal(s.w.credits,123);
 s.button('Keep original').click();assert.equal(s.field.value,'An animated blue bird lands on a branch. Keep the camera still.');s.dom.window.close();
});
test('apply is explicit and undo restores the exact original text',()=>{
 const s=setup(),original='  A blue bird in a painted world.  ';s.field.value=original;s.w.enhanceNenePrompt();assert.equal(s.field.value,original);s.button('Use this prompt').click();assert.match(s.field.value,/Production guidance/);s.w.document.getElementById('neneUndoPrompt').click();assert.equal(s.field.value,original);s.dom.window.close();
});
test('repeated enhancement never stacks guidance or changes the original undo target',()=>{
 const s=setup();s.field.value='A paper boat floats downstream.';for(let i=0;i<3;i++){s.w.enhanceNenePrompt();s.button('Use this prompt').click();}
 assert.equal(s.field.value.split('Production guidance:').length-1,1);assert.equal(s.w.document.querySelectorAll('#neneUndoPrompt').length,1);s.w.document.getElementById('neneUndoPrompt').click();assert.equal(s.field.value,'A paper boat floats downstream.');s.dom.window.close();
});
test('manual edits survive repeated previews and undo does not overwrite later edits',()=>{
 const s=setup();s.field.value='A bird on a branch.';s.w.enhanceNenePrompt();s.button('Use this prompt').click();s.field.value+='\nUse a hand-painted texture.';const manual=s.field.value;
 s.w.enhanceNenePrompt();assert.equal(s.w.document.getElementById('nenePromptSuggestion').value,manual);s.button('Use this prompt').click();s.w.enhanceNenePrompt();assert.equal(s.w.document.getElementById('nenePromptSuggestion').value,manual);s.button('Keep original').click();s.field.value+=' More leaves.';s.w.document.getElementById('neneUndoPrompt').click();assert.ok(s.field.value.endsWith('More leaves.'));assert.match(s.notice,/not overwrite/);s.dom.window.close();
});
test('stale previews cannot overwrite edits or a different screen',()=>{
 const s=setup();s.field.value='Original idea';s.w.enhanceNenePrompt();s.field.value='New idea';s.button('Use this prompt').click();assert.equal(s.field.value,'New idea');assert.match(s.w.document.querySelector('[role=status]').textContent,/changed/);s.dom.window.close();
});
test('generation uses the reviewed prompt once and requires review after control changes',()=>{
 const s=setup();s.field.value='An animated bird';s.w.enhanceNenePrompt();s.button('Use this prompt').click();assert.equal(s.w.NENEPromptAssist.forGeneration(s.field,'duplicated fallback'),s.field.value);s.w.document.getElementById('neneStyle').value='Cinematic';assert.equal(s.w.NENEPromptAssist.forGeneration(s.field,'fallback'),null);s.w.enhanceNenePrompt();s.button('Use this prompt').click();assert.match(s.field.value,/Visual style: Cinematic/);assert.equal(s.w.NENEPromptAssist.forGeneration(s.field,'fallback'),s.field.value);s.dom.window.close();
});
test('empty input and HTML-like ideas are handled safely',()=>{
 const s=setup();s.w.enhanceNenePrompt();assert.equal(s.w.document.getElementById('nenePromptSuggestion'),null);assert.match(s.notice,/Describe your idea/);s.field.value='<img src=x onerror=alert(1)> balloon';s.w.enhanceNenePrompt();assert.equal(s.w.document.querySelector('#modalbox img'),null);assert.match(s.w.document.getElementById('nenePromptSuggestion').value,/<img/);s.dom.window.close();
});
