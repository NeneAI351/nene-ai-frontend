/* Local prompt formatting. No model call, generation request or wallet mutation. */
(() => {
 'use strict';
 const history=new WeakMap();
 const fields=[['Visual style','neneStyle'],['Shot','neneShot'],['Camera','neneCamera'],['Lighting','neneLighting'],['Motion','neneMotion']];
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const controls=()=>fields.map(([label,id])=>[label,document.getElementById(id)?.value]).filter(([,value])=>value);
 function compose(idea){
  return `Scene brief:\n${idea}\n\nProduction guidance:\nPreserve the subjects, setting, actions, mood and artistic style in the scene brief. Explicit instructions in the brief take priority over the preferences below. Keep the main action readable and visual details consistent across frames; avoid unintended flicker or distortion.\n\nProduction preferences (only where compatible with the scene brief):\n${controls().map(([label,value])=>`${label}: ${value}`).join('\n')}`;
 }
 function undoButton(field){
  let button=document.getElementById('neneUndoPrompt');
  if(!button){button=node('button','Undo last enhancement','btn');button.id='neneUndoPrompt';button.type='button';field.parentNode.append(button);}
  button.onclick=()=>{
   const saved=history.get(field);if(!saved)return;
   if(field.value!==saved.enhanced){toast('Your prompt has changed. Undo will not overwrite your edits.');return;}
   field.value=saved.before;history.delete(field);button.remove();field.dispatchEvent(new Event('input',{bubbles:true}));toast('Original prompt restored.');
  };
 }
 window.enhanceNenePrompt=function(){
  const field=document.getElementById('prompt');if(!field)return;
  if(!field.value.trim()){toast('Describe your idea first, then preview the enhancement.');field.focus();return;}
  const saved=history.get(field),before=field.value;
  const alreadyStructured=saved&&before.includes('\n\nProduction guidance:\n')&&before.includes('\n\nProduction preferences (only where compatible with the scene brief):\n');
  const manual=alreadyStructured&&(saved.manual||before!==saved.enhanced);
  const idea=saved&&(before===saved.enhanced||alreadyStructured)?saved.idea:before.trim();
  if(idea.length>6000){toast('Shorten your idea to 6,000 characters before using Prompt Assist.');return;}
  const suggested=manual?before:compose(idea),root=node('div');
  root.append(node('h2','Review your enhanced prompt'),node('p','Prompt Assist keeps your wording and organizes it with the production controls you selected. It runs on this device without an AI request or credit charge. It does not invent story details or guarantee output quality.','notice'));
  const original=node('details'),summary=node('summary','Your current prompt'),copy=node('p',before,'subtitle');copy.style.whiteSpace='pre-wrap';original.append(summary,copy);root.append(original);
  const label=node('label','Suggested prompt','label');label.htmlFor='nenePromptSuggestion';const editor=node('textarea');editor.id='nenePromptSuggestion';editor.value=suggested;editor.rows=14;root.append(label,editor);
  const status=node('p');status.setAttribute('role','status');root.append(status);
  const row=node('div',undefined,'row'),cancel=node('button','Keep original','btn'),apply=node('button','Use this prompt','btn gold');cancel.type=apply.type='button';row.append(cancel,apply);root.append(row);
  showModal('');document.getElementById('modalbox').replaceChildren(root);
  cancel.onclick=closeModal;
  apply.onclick=()=>{
   if(!field.isConnected||field!==document.getElementById('prompt')){closeModal();return;}
   if(field.value!==before){status.textContent='Your original prompt changed while this preview was open. Close and preview again to preserve those edits.';return;}
   const value=editor.value.trim();if(!value||value.length>10000){status.textContent='Use a prompt between 1 and 10,000 characters.';return;}
   // Repeated previews rebuild from the same original idea instead of appending
   // another guidance block. A new manual edit becomes the next original.
   history.set(field,{idea,before:saved&&before===saved.enhanced?saved.before:before,enhanced:value,manual:manual||value!==suggested,preferences:JSON.stringify(controls())});field.value=value;undoButton(field);field.dispatchEvent(new Event('input',{bubbles:true}));closeModal();toast('Prompt updated. Undo is available.');
  };
 };
 window.NENEPromptAssist={
  forGeneration(field,originalFallback){
   const state=history.get(field);
   // Applied text already contains production preferences. Do not append a
   // second block; if preferences changed, ask the user to review again.
   if(state){
    if(state.preferences!==JSON.stringify(controls())){toast('Production controls changed. Preview and apply the prompt again before generating.');return null;}
    return field.value.trim();
   }
   return originalFallback;
  }
 };
})();
