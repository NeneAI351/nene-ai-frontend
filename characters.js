/* Character Studio: server-confirmed, owner-scoped profiles and reference images. */
(() => {
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let owner=null,epoch=0,form=null,reference=null,referenceReady=true;
 const page=()=>document.querySelector('[data-character-studio]');
 const message=text=>{const el=document.getElementById('characterStatus');if(el)el.textContent=text;};
 function clear(){epoch++;owner=null;characters.splice(0);form=null;reference=null;referenceReady=true;window.neneCharacterReferenceData=null;window.neneCurrentStoryPlan=null;}
 async function account(){
  if(!await window.neneRequireAccount?.())throw Error('Sign in to open your characters.');
  const id=await window.neneAuthGetUserId?.();if(!id)throw Error('Sign in again to continue.');
  if(owner!==id){clear();owner=id;}return id;
 }
 async function api(path='',options={},expected=owner){
  const token=await window.neneAuthGetAccessToken?.();
  if(!token||!expected||expected!==await window.neneAuthGetUserId?.())throw Error('Account changed. Reopen Character Studio.');
  // Check the token subject too, so an account switch between session reads cannot
  // send a previous owner's form using the next account's token.
  let sub;try{sub=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}
  if(sub!==expected)throw Error('Account changed. Reopen Character Studio.');
  const base=window.NENE_DIRECTOR_CONFIG?.backendUrl;if(!base)throw Error('Character storage is unavailable.');
  const response=await fetch(base.replace(/\/$/,'')+'/api/characters'+path,{...options,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}});
  if(expected!==owner||expected!==await window.neneAuthGetUserId?.())throw Error('Account changed. Reopen Character Studio.');
  if(response.status===204)return null;
  let data;try{data=await response.json();}catch(_){throw Error('The save could not be confirmed. Retry from this form to check the same character.');}
  if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Character request failed. Check your fields and try again.');
  return data;
 }
 const fromServer=row=>({id:row.id,name:row.name,appearance:row.profile?.appearance||'',personality:row.profile?.personality||'',wardrobe:row.profile?.wardrobe||'',style:row.profile?.style||'Realistic',referenceImage:row.profile?.referenceImage||null,desc:String(row.profile?.appearance||'').slice(0,90),icon:'🎭'});
 async function load(expected=owner){
  const data=await api('?limit=100',{},expected);
  if(!Array.isArray(data.items))throw Error('Your character list could not be loaded.');
  characters.splice(0,characters.length,...data.items.map(fromServer));return characters;
 }
 async function render(){
  if(form?.busy)return;
  try{await account();}catch(error){if(page())message(error.message);return;}
  const ticket=++epoch;form=null;reference=null;
  document.getElementById('screen').innerHTML=`<main data-character-studio><div class="toolhead"><button class="back" type="button" id="characterBack" aria-label="Back to AI Studio">‹</button><div><div class="eyebrow">Your cast</div><h1>Character Studio</h1></div></div><p class="subtitle">Save a character’s appearance, personality, wardrobe and reference privately to your account.</p><div class="notice">Character guidance reuses your descriptions in story scenes. A single-character scene can use its reference image. Multiple-character scenes use descriptions; identical faces across outputs are not guaranteed.</div><p id="characterStatus" role="status" aria-live="polite">Loading your characters…</p><div id="characterList" class="list"></div><div class="block"><button class="btn gold" id="newCharacter" type="button" disabled>Create character</button><button class="btn" id="refreshCharacters" type="button" style="margin-top:8px">Reload characters</button></div><div id="characterEditor"></div></main>`;
  const draftKey='nene_story_draft:'+owner;
  let hasStoryDraft=false;try{hasStoryDraft=!!sessionStorage.getItem(draftKey);}catch(_){}
  if(hasStoryDraft){
   const backToStory=document.createElement('button');
   backToStory.type='button';backToStory.className='btn';backToStory.id='returnToStory';
   backToStory.textContent='← Return to unfinished story';
   backToStory.onclick=()=>{if(form?.busy)return;window.openTool('story');};
   document.getElementById('characterBack').after(backToStory);
  }
  document.getElementById('characterBack').onclick=()=>window.renderCreateHub();
  document.getElementById('refreshCharacters').onclick=render;
  document.getElementById('newCharacter').onclick=()=>edit();
  try{await load();if(ticket!==epoch||!page())return;paint();document.getElementById('newCharacter').disabled=false;message('Synced to your account.');}
  catch(error){if(ticket===epoch&&page())message(error.message+' Reload to try again.');}
 }
 function paint(){
  const list=document.getElementById('characterList');if(!list)return;
  list.innerHTML=characters.length?characters.map(c=>`<div class="creation"><div class="thumb" data-character-image="${esc(c.id)}">🎭</div><div style="flex:1;min-width:0"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small><div class="row" style="margin-top:8px"><button class="btn" type="button" data-edit-character="${esc(c.id)}">Edit</button><button class="btn" type="button" data-delete-character="${esc(c.id)}">Delete</button></div></div></div>`).join(''):'<p class="notice">No saved characters yet. Create your first character below.</p>';
  for(const el of list.querySelectorAll('[data-character-image]')){const c=characters.find(c=>c.id===el.dataset.characterImage);if(/^data:image\/(png|jpeg|webp);base64,/.test(c?.referenceImage||'')){const img=document.createElement('img');img.alt='Character reference';img.src=c.referenceImage;img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:12px';el.replaceChildren(img);}}
  for(const el of list.querySelectorAll('[data-edit-character]'))el.onclick=()=>edit(el.dataset.editCharacter);
  for(const el of list.querySelectorAll('[data-delete-character]'))el.onclick=()=>remove(el.dataset.deleteCharacter);
 }
 function edit(id){
  if(form?.busy)return;
  const saved=characters.find(c=>c.id===id);if(id&&!saved)return;
  const ticket=++epoch;reference=saved?.referenceImage||null;referenceReady=true;
  form={owner,id:saved?.id||crypto.randomUUID(),existing:!!saved,busy:false,pending:null,ticket};
  const box=document.getElementById('characterEditor');box.innerHTML=`<form id="characterForm"><h2>${saved?'Edit character':'New character'}</h2><label class="block" style="display:block">Name<input class="field" name="name" maxlength="120" required></label><label class="block" style="display:block">Appearance<textarea name="appearance" maxlength="3000" required></textarea></label><label class="block" style="display:block">Personality<textarea name="personality" maxlength="2000"></textarea></label><label class="block" style="display:block">Wardrobe<textarea name="wardrobe" maxlength="2000"></textarea></label><label class="block" style="display:block">Style<select name="style">${['Realistic','Cinematic','Animated','3D','Fantasy','Fashion'].map(s=>`<option>${s}</option>`).join('')}</select></label><label class="block" style="display:block">Reference image<input class="field" name="reference" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="subtitle">PNG, JPEG or WebP, up to 20 MB. Larger photos are resized automatically before private storage.</p><p id="characterReferenceStatus" role="status"></p><img id="characterReferencePreview" alt="Selected character reference" style="display:none;width:120px;border-radius:12px"><button class="btn" id="clearCharacterReference" type="button">Remove reference</button><p id="characterFormStatus" role="status" aria-live="polite"></p><div class="row"><button class="btn" id="cancelCharacter" type="button">Cancel</button><button class="btn gold" type="submit">Save to account</button></div></form>`;
  const f=document.getElementById('characterForm');let imageTicket=0;for(const key of ['name','appearance','personality','wardrobe','style'])if(saved?.[key])f.elements[key].value=saved[key];
  const preview=()=>{const img=document.getElementById('characterReferencePreview');img.style.display=reference?'block':'none';if(reference)img.src=reference;else img.removeAttribute('src');document.getElementById('characterReferenceStatus').textContent=reference?'Reference ready to save.':'No reference selected.';};preview();
  document.getElementById('clearCharacterReference').onclick=()=>{if(form?.busy)return;imageTicket++;reference=null;referenceReady=true;f.elements.reference.value='';preview();};
  f.elements.reference.onchange=async()=>{
   const selected=++imageTicket;
   const file=f.elements.reference.files?.[0];referenceReady=false;
   if(!file){referenceReady=true;return;}
   try{
    const data=await prepareReference(file);
    if(ticket!==epoch||selected!==imageTicket||!form)return;reference=data;referenceReady=true;preview();
   }catch(error){if(ticket===epoch&&selected===imageTicket)document.getElementById('characterReferenceStatus').textContent=error.message+' Choose another image or remove the reference before saving.';}
  };
  document.getElementById('cancelCharacter').onclick=()=>{if(form?.busy)return;form=null;reference=null;box.replaceChildren();};
  f.onsubmit=save;box.scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 async function prepareReference(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');
  if(file.size>20*1024*1024)throw Error('This photo is too large to process (20 MB maximum).');
  const decode=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('This image could not be opened.'));img.src=src;});
  let img,objectUrl=null;
  try{
   // Android WebViews can reject FileReader for photos selected from gallery providers.
   // Decode the selected File through a temporary blob URL instead.
   if(typeof URL.createObjectURL==='function'){
    objectUrl=URL.createObjectURL(file);
    img=await decode(objectUrl);
   }
  }catch(error){img=null;}
  finally{if(objectUrl)URL.revokeObjectURL(objectUrl);}
  if(!img){
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read this photo. Try selecting it from your gallery again.'));reader.readAsDataURL(file);});
   img=await decode(data);
  }
  if(!img.naturalWidth||!img.naturalHeight)throw Error('This image has invalid dimensions.');
  for(const maxEdge of [1600,1280,1024,800,640,480,320]){
   const scale=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image compression is unavailable on this device.');
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [0.86,0.72,0.58,0.42]){
    const compressed=canvas.toDataURL('image/jpeg',quality);
    if(!compressed.startsWith('data:image/jpeg;base64,'))throw Error('Image compression is unavailable on this device.');
    if(Math.floor((compressed.length-compressed.indexOf(',')-1)*3/4)<=400*1024)return compressed;
   }
  }
  throw Error('Could not compress this image safely. Please choose another photo.');
 }
 async function save(event){
  event.preventDefault();const state=form;if(!state||state.busy)return;
  const f=event.currentTarget,status=document.getElementById('characterFormStatus');
  if(!referenceReady){status.textContent='Finish selecting or remove the reference image first.';return;}
  const body={name:f.elements.name.value.trim(),profile:{appearance:f.elements.appearance.value.trim(),personality:f.elements.personality.value.trim(),wardrobe:f.elements.wardrobe.value.trim(),style:f.elements.style.value,referenceImage:reference}};
  if(!body.name||!body.profile.appearance){status.textContent='Enter a name and appearance.';return;}
  // Freeze an unconfirmed request: retry the same ID and exact body first.
  // A lost HTTP response must not create a duplicate or overwrite another draft.
  if(!state.pending)state.pending=body;
  const payload=state.existing?state.pending:{...state.pending,id:state.id};
  state.busy=true;for(const el of f.elements)el.disabled=true;status.textContent='Saving to your account…';
  try{
   const row=await api(state.existing?'/'+encodeURIComponent(state.id):'',{method:state.existing?'PATCH':'POST',body:JSON.stringify(payload)},state.owner);
   if(state!==form||state.ticket!==epoch)return;
   const character=fromServer(row),index=characters.findIndex(c=>c.id===character.id);if(index<0)characters.unshift(character);else characters[index]=character;
   form=null;reference=null;document.getElementById('characterEditor').replaceChildren();paint();message('Character saved to your account.');
  }catch(error){if(state===form){status.textContent=error.message+' Save again to retry the same details. To change the draft, cancel and reload first.';}}
  finally{state.busy=false;if(state===form)for(const el of f.elements)el.disabled=el.tagName!=='BUTTON';}
 }
 function remove(id){
  if(form?.busy)return;const character=characters.find(c=>c.id===id);if(!character)return;
  const expected=owner;showModal(`<h2>Delete character?</h2><p class="subtitle">Delete ${esc(character.name)} from your account? Existing story snapshots are unchanged.</p><p id="characterDeleteStatus" role="status"></p><div class="row"><button class="btn" id="cancelCharacterDelete" type="button">Cancel</button><button class="btn gold" id="confirmCharacterDelete" type="button">Delete character</button></div>`);
  document.getElementById('cancelCharacterDelete').onclick=closeModal;
  const btn=document.getElementById('confirmCharacterDelete');btn.onclick=async()=>{btn.disabled=true;try{await api('/'+encodeURIComponent(id),{method:'DELETE'},expected);if(owner!==expected)return;const index=characters.findIndex(c=>c.id===id);if(index>=0)characters.splice(index,1);if(form?.id===id){form=null;reference=null;document.getElementById('characterEditor')?.replaceChildren();}closeModal();paint();message('Character deleted.');}catch(error){document.getElementById('characterDeleteStatus').textContent=error.message;btn.disabled=false;}};
 }
 const oldFeature=window.openFeature;
 window.openFeature=function(type){return type==='characters'?render():oldFeature.apply(this,arguments);};
 const oldTool=window.openTool;
 window.openTool=async function(type){
  if(type!=='story')return oldTool.apply(this,arguments);
  try{const expected=await account();await load(expected);if(expected!==owner)return;return oldTool.apply(this,arguments);}
  catch(error){toast(error.message);}
 };
 const oldPlan=window.buildStoryPlan;
 window.buildStoryPlan=function(){if(!owner){toast('Reopen Story to load your account characters.');return;}const result=oldPlan.apply(this,arguments);if(window.neneCurrentStoryPlan)window.neneCurrentStoryPlan.owner=owner;return result;};
 const oldGenerate=window.generateStoryScenes;
 window.generateStoryScenes=async function(){
  const id=await window.neneAuthGetUserId?.();
  if(!id||window.neneCurrentStoryPlan?.owner!==id){toast('Reopen Story and build a plan for this account.');return;}
  return oldGenerate.apply(this,arguments);
 };
 window.addEventListener('nene-auth-changed',()=>{const visible=page()||document.getElementById('storyCharacterList');clear();if(visible){document.getElementById('screen').innerHTML='<main><h1>Account changed</h1><p class="notice">Reopen Character Studio or Story to load the signed-in account’s characters.</p></main>';closeModal();}});
 window.NENECharacters={load,render,get owner(){return owner;}};
})();
