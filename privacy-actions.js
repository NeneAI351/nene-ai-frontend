/* Public, account-independent entry points for NENE AI privacy requests. */
(() => {
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const el=id=>document.getElementById(id);
 const message=text=>{if(el('privacy-status'))el('privacy-status').textContent=text;};
 let busy=false,timer=null;
 async function api(path,options={},owner=null){
  const base=new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl||'');if(base.protocol!=='https:')throw Error('The secure account service is unavailable.');
  const headers={'Content-Type':'application/json'};
  if(owner){const token=await window.neneAuthGetAccountToken?.();let subject;try{subject=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}if(!token||subject!==owner||owner!==await window.neneAuthGetUserId?.())throw Error('Account changed. Sign in to the account you want to delete.');headers.Authorization='Bearer '+token;}
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  try{const response=await fetch(base.href.replace(/\/$/,'')+'/api/privacy'+path,{...options,headers,cache:'no-store',signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'The privacy request could not be confirmed.');return data;}
  catch(e){if(e.name==='AbortError')throw Error('The request timed out. Retry this same request to check whether it was received.');throw e;}
  finally{clearTimeout(timeout);}
 }
 function clearOwnerData(owner,includeLegacy){
  const keys=Object.keys(localStorage);
  for(const key of keys)if(key.startsWith('nene_')&&key.endsWith(':'+owner))localStorage.removeItem(key);
  if(includeLegacy)for(const key of ['nene_ai_state_v1','nene_ai_projects_v1','nene_ai_jobs_v1','nene_pending_job','nene_generation_idempotency','nene_story_scene_results_v1'])localStorage.removeItem(key);
 }
 async function receipt(id,attempt=0){
  if(!UUID.test(id)){message('Enter a valid deletion receipt.');return;}
  clearTimeout(timer);
  try{const data=await api('/deletions/'+id);if(el('receipt-value'))el('receipt-value').textContent=id;
   const text=data.status==='completed'?'Your NENE AI account, sign-in identity and stored creative data have been deleted.' : 'Your deletion request is recorded. Account access is blocked while identity and private-data cleanup finishes. You can close this page and return with your receipt.';
   message(text+(data.provider_follow_up_pending?' Service-provider erasure follow-up is still pending.':''));
   if(data.status!=='completed'&&attempt<60)timer=setTimeout(()=>receipt(id,attempt+1),15000);
  }catch(e){message(e.message+' Keep your receipt and check again later.');}
 }
 async function refreshAccount(){
  if(!el('delete-submit'))return;
  try{const owner=await window.neneAuthGetUserId?.();el('delete-submit').disabled=!owner;if(el('delete-account-summary'))el('delete-account-summary').textContent=owner?'Signed in. The request will delete only this signed-in NENE AI account.':'Sign in to the NENE AI account you want to delete. You do not need to reinstall the app or accept new terms.';}
  catch(_){el('delete-submit').disabled=true;}
 }
 async function removeAccount(event){
  event.preventDefault();if(busy)return;
  const owner=await window.neneAuthGetUserId?.();if(!owner){window.neneOpenAuth?.('signin');return;}
  if(!el('delete-confirm')?.checked){message('Confirm that you understand the permanent deletion.');return;}
  busy=true;el('delete-submit').disabled=true;
  const storageKey='nene_privacy_delete_pending_v1:'+owner;
  try{let id=localStorage.getItem(storageKey);if(!UUID.test(id||'')){id=crypto.randomUUID();localStorage.setItem(storageKey,id);}
   const data=await api('/account-deletion',{method:'POST',body:JSON.stringify({request_id:id,confirm_delete:true})},owner);
   if(!UUID.test(data.receipt_id))throw Error('A deletion receipt could not be confirmed. Retry this same request.');
   const stillOwner=owner===await window.neneAuthGetUserId?.();clearOwnerData(owner,stillOwner);
   localStorage.setItem('nene_privacy_deletion_receipt',data.receipt_id);
   if(stillOwner)try{await window.nenePrivacyLocalSignOut?.();}catch(_){}
   window.location.replace('./delete-account.html?receipt='+data.receipt_id);
  }catch(e){message(e.message+' Your pending request reference is kept on this device for a safe retry.');}
  finally{busy=false;await refreshAccount();}
 }
 function bindContact(){
  const form=el('privacy-contact-form');if(!form)return;let pending=null;
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;const values={email:form.elements.email.value.trim(),kind:form.elements.kind.value,message:form.elements.message.value.trim()};const fingerprint=JSON.stringify(values);if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,body:{...values,request_id:crypto.randomUUID()}};
   busy=true;el('privacy-contact-submit').disabled=true;
   try{const data=await api('/enquiries',{method:'POST',body:JSON.stringify(pending.body)});if(data.received!==true||!UUID.test(data.receipt_id))throw Error('A privacy receipt could not be confirmed.');message('Request received. Reference: '+data.receipt_id+'. This confirms receipt, not completed account deletion. Requests made without signing in require ownership verification before any account is deleted.');}
   catch(e){message(e.message);}finally{busy=false;el('privacy-contact-submit').disabled=false;}
  };
 }
 document.addEventListener('DOMContentLoaded',()=>{
  bindContact();el('delete-form')?.addEventListener('submit',removeAccount);el('privacy-signin')?.addEventListener('click',()=>window.neneOpenAuth?.('signin'));
  el('receipt-check')?.addEventListener('click',()=>receipt(el('receipt-input').value.trim()));
  const id=new URLSearchParams(window.location.search).get('receipt');if(id&&UUID.test(id)){el('delete-form')?.setAttribute('hidden','');el('privacy-signin')?.setAttribute('hidden','');receipt(id);}else refreshAccount();
 });
 window.addEventListener('nene-auth-changed',refreshAccount);
 window.addEventListener('pagehide',()=>clearTimeout(timer));
})();
