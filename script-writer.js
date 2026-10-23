/* Script Writer shares the authenticated, paid, durable planning service. */
(() => {
 'use strict';
 const marker='NENE_SCRIPT_V1\n';
 let active=null,epoch=0,inflight=null;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const live=view=>active===view&&view.isConnected;
 const message=(view,text)=>{if(live(view))view.querySelector('[data-script-status]').textContent=text;};
 const pendingKey=owner=>'nene_script_request_v1:'+owner;
 function readPending(owner){try{const p=JSON.parse(sessionStorage.getItem(pendingKey(owner))||'null');return p?.owner===owner?p:null;}catch(_){return null;}}
 async function sameOwner(owner){if(owner!==await window.neneAuthGetUserId?.())throw Error('Account changed. Reopen AI Script Writer.');}
 async function api(owner,path,options={}){
  const token=await window.neneAuthGetAccessToken?.();await sameOwner(owner);
  let sub;try{sub=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}
  if(!token||sub!==owner)throw Error('Sign in again to use AI Script Writer.');
  const base=window.NENE_DIRECTOR_CONFIG?.backendUrl;if(!base||new URL(base).protocol!=='https:')throw Error('Secure AI planning is unavailable.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);
  try{
   const response=await fetch(base.replace(/\/$/,'')+'/api/director'+path,{...options,cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...options.headers}});
   await sameOwner(owner);let data;try{data=await response.json();}catch(_){throw Error('The server response could not be confirmed. Reload saved scripts before retrying.');}
   if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'AI Script Writer could not complete this request.');return data;
  }catch(error){if(error.name==='AbortError')throw Error('The request timed out. Reload saved scripts, then retry this request using its saved key.');throw error;}
  finally{clearTimeout(timer);}
 }
 function select(label,name,values){const block=node('label',label,'block');block.style.display='block';const field=node('select');field.name=name;for(const value of values){const option=node('option',String(value));option.value=String(value);field.append(option);}block.append(field);return block;}
 function textField(label,name,max,multiline=false){const block=node('label',label,'block');block.style.display='block';const field=node(multiline?'textarea':'input');field.name=name;field.maxLength=max;if(!multiline)field.className='field';block.append(field);return block;}
 function scriptText(record){
  const p=record.plan;if(!p||!Array.isArray(p.scenes))throw Error('This saved script could not be displayed.');
  return [p.title,p.summary,...p.scenes.map((s,i)=>`SCENE ${i+1}: ${s.title}\nVisual direction: ${s.visual_prompt}\nSpoken script / dialogue: ${s.narration||'None'}\nOn-screen text: ${s.on_screen_text||'None'}\nSound direction: ${s.sound_direction||'None'}`),`Continuity notes: ${p.continuity_notes||'None'}`].join('\n\n');
 }
 function showRecord(view,owner,record){
  if(!live(view))return;
  const result=view.querySelector('[data-script-result]');result.replaceChildren();
  const text=scriptText(record);result.append(node('h2',record.plan.title),node('p','Original script saved to your account. You can edit the copy below; these edits are included when you copy or download, and do not overwrite the saved original.','notice'));
  const editor=node('textarea');editor.value=text;editor.rows=20;editor.setAttribute('aria-label','Editable script copy');result.append(editor);
  const copy=node('button','Copy script','btn');copy.type='button';copy.onclick=async()=>{try{await sameOwner(owner);await navigator.clipboard.writeText(editor.value);message(view,'Script copied.');}catch(_){message(view,'Copy is unavailable. Select the script text or download it.');}};
  const download=node('button','Download script (.txt)','btn');download.type='button';download.onclick=async()=>{try{await sameOwner(owner);const url=URL.createObjectURL(new Blob([editor.value],{type:'text/plain;charset=utf-8'})),a=node('a');a.href=url;a.download='nene-ai-script.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){message(view,error.message);}};
  const row=node('div',undefined,'row');row.append(copy,download);result.append(row,node('p','This is a written script and production brief. Voice, video, music and subtitle files have not been generated. Review facts and wording before publishing.','subtitle'));
 }
 async function saved(view,owner){
  const data=await api(owner,'/plans');if(!live(view))return;
  const list=view.querySelector('[data-script-saved]');list.replaceChildren();
  const records=(data.items||[]).filter(r=>r.brief?.idea?.startsWith(marker));
  for(const record of records){const button=node('button',record.plan?.title||'Saved script','btn');button.type='button';button.onclick=()=>{try{showRecord(view,owner,record);}catch(error){message(view,error.message);}};list.append(button);}
  if(!records.length)list.append(node('p','No scripts in your 20 most recent planning records.','subtitle'));
 }
 function briefFor(form){
  const get=key=>form.elements[key].value.trim();
  if(get('idea').length<10)throw Error('Describe your script in at least 10 characters.');
  const idea=marker+`Write a ready-to-use ${get('language')} video script in a ${get('tone')} tone. Include a strong opening hook, clear spoken narration or dialogue for each scene, and a purposeful ending. Keep spoken lines within the requested seconds per scene. Put spoken words in narration, visual instructions in visual_prompt, and short display copy in on_screen_text. Do not invent product claims or verified facts.\nAudience: ${get('audience')||'General audience'}\nDesired ending / call to action: ${get('cta')||'A suitable ending for this brief'}\nUser brief:\n${get('idea')}`;
  if(idea.length>6000)throw Error('Shorten your brief before generating.');
  return {idea,goal:get('goal'),scene_count:Number(get('scenes')),scene_seconds:Number(get('seconds')),aspect_ratio:get('ratio')};
 }
 async function open(){
  if(inflight){toast('Wait for the current script request to finish.');return;}
  if(!await window.neneRequireAccount?.())return;
  const owner=await window.neneAuthGetUserId?.();if(!owner)return;
  const ticket=++epoch;setNav('create');const view=node('main');active=view;
  const header=node('div',undefined,'toolhead'),back=node('button','‹','back');back.type='button';back.setAttribute('aria-label','Back to AI Studio');back.onclick=()=>{if(!inflight){active=null;window.renderCreateHub();}};header.append(back,node('h1','AI Script Writer'));view.append(header,node('p','Turn an idea into a short video script with an opening hook, scene directions, spoken lines and an ending.','subtitle'),node('p','Uses the paid AI planning service. The server confirms availability and price below. Video and audio generation cost credits separately. Your brief is sent to the AI provider only when you press Generate script.','notice'));
  const form=node('form');form.append(textField('Your script idea','idea',4500,true),textField('Audience (optional)','audience',300),textField('Ending / call to action (optional)','cta',300),select('Script purpose','goal',['Social video','Business ad','Educational video','Story film']),select('Tone','tone',['Engaging','Professional','Warm','Cinematic','Funny']),select('Language','language',['English','Igbo','Yoruba','French','Spanish','Portuguese']),select('Number of scenes','scenes',[3,2,4,5,6]),select('Seconds per scene','seconds',[6,8,10]),select('Aspect ratio','ratio',['9:16','16:9','1:1']));
  const status=node('p','Checking paid planning availability…','notice');status.dataset.scriptStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const generate=node('button','Generate script','btn gold');generate.type='submit';generate.disabled=true;
  const retry=node('button','Retry saved request','btn');retry.type='button';retry.disabled=true;
  const abandon=node('button','Clear saved request','btn');abandon.type='button';
  const check=node('button','Reload availability and saved scripts','btn');check.type='button';
  const pendingNote=node('p',undefined,'subtitle');
  const result=node('div');result.dataset.scriptResult='';const list=node('div',undefined,'list');list.dataset.scriptSaved='';
  let state=null,pending=readPending(owner);
  function pendingUi(){retry.hidden=!pending;abandon.hidden=!pending;retry.disabled=!state?.available;pendingNote.textContent=pending?'A request key is saved in this browser tab. Retry retrieves the same result without a second charge. Reload saved scripts before clearing an uncertain request.':'';}
  async function refresh(){
   check.disabled=true;
   try{const value=await api(owner,'/status');if(!live(view)||ticket!==epoch)return;state=value;generate.disabled=!state.available;generate.textContent=state.available?`Generate script · ${state.credit_cost} paid credits`:'Script generation unavailable';message(view,state.available?`Each new script costs ${state.credit_cost} paid credits. Video generation is separate.`:'Paid AI script planning is not enabled for this account. No request has been sent and no credits have been charged.');pendingUi();await saved(view,owner);}
   catch(error){if(live(view)){state=null;generate.disabled=true;retry.disabled=true;message(view,error.message);}}
   finally{check.disabled=false;}
  }
  async function send(request){
   if(inflight||!state?.available||!live(view))return;
   const operation={owner,view};inflight=operation;for(const e of form.elements)e.disabled=true;check.disabled=true;retry.disabled=true;abandon.disabled=true;message(view,'Writing your script…');
   try{const record=await api(owner,'/plans',{method:'POST',headers:{'Idempotency-Key':request.key},body:JSON.stringify(request.brief)});if(!live(view))return;showRecord(view,owner,record);message(view,'Script saved to your account. The same request can retrieve it without a new charge.');try{await saved(view,owner);}catch(_){message(view,'Script saved. The recent-scripts list could not refresh; reload it when connected.');}}
   catch(error){message(view,error.message+' Your request key is retained. Reload saved scripts or retry this saved request.');}
   finally{if(inflight===operation){inflight=null;if(live(view)){for(const e of form.elements)e.disabled=false;generate.disabled=!state?.available;check.disabled=false;abandon.disabled=false;pendingUi();}await window.neneRefreshPaidWallet?.();}}
  }
  form.onsubmit=async event=>{
   event.preventDefault();if(inflight||!state?.available)return;
   try{await sameOwner(owner);const brief=briefFor(form);if(pending&&JSON.stringify(pending.brief)!==JSON.stringify(brief)){message(view,'A previous request is still saved. Review or retry it before clearing it to start a different script.');return;}
    if(!pending){pending={owner,key:crypto.randomUUID(),brief};try{sessionStorage.setItem(pendingKey(owner),JSON.stringify(pending));}catch(_){pending=null;throw Error('Request recovery storage is unavailable. Allow browser storage before generating.');}}
    pendingUi();await send(pending);
   }catch(error){message(view,error.message);}
  };
  retry.onclick=()=>{if(pending)send(pending);};
  abandon.onclick=()=>{if(inflight)return;try{sessionStorage.removeItem(pendingKey(owner));pending=null;pendingUi();message(view,'Saved request key cleared. Creating another script is a new paid request. Existing requests and charges are unchanged.');}catch(_){message(view,'Could not clear the saved request.');}};
  check.onclick=()=>{if(!inflight)refresh();};form.append(generate);view.append(form,status,pendingNote,retry,abandon,check,result,node('h2','Recent saved scripts'),list);document.getElementById('screen').replaceChildren(view);pendingUi();await refresh();
 }
 window.neneOpenScriptWriter=open;
 const original=window.openFeature;window.openFeature=function(type){return type==='script'?open():original.apply(this,arguments);};
 window.addEventListener('nene-auth-changed',()=>{epoch++;if(active?.isConnected)active.replaceChildren(node('h1','Account changed'),node('p','Reopen AI Script Writer for the signed-in account.','notice'));active=null;inflight=null;});
})();
