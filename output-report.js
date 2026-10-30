/* Private abuse-report intake. Never includes media URLs or submits generation. */
(() => {
  'use strict';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let active=null;
  const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  function close(){if(!active)return;active.controller?.abort();active.dialog.remove();active=null;}
  window.neneOpenOutputReport=async ({kind,id,owner})=>{
    if(!['video','story','voice'].includes(kind)||!UUID.test(id||'')||!UUID.test(owner||''))return;
    if(owner!==await window.neneAuthGetUserId?.())return;
    close();
    const state={owner,dialog:node('dialog'),controller:null};active=state;
    const dialog=state.dialog;dialog.id='nene-output-report';
    dialog.style.cssText='background:#15120c;color:#f7edda;border:1px solid #967735;border-radius:18px;padding:22px;max-width:90vw';
    const form=node('form'),title=node('h2','Report AI content');title.id='output-report-title';dialog.setAttribute('aria-labelledby',title.id);
    const reason=node('select');reason.setAttribute('aria-label','Reason for report');
    for(const value of ['Abuse or harassment','Sexual or exploitative content','Violence or dangerous content','Impersonation or privacy','Other safety concern']){const option=node('option',value);option.value=value;reason.append(option);}
    const details=node('textarea');details.setAttribute('aria-label','Report details');details.maxLength=4000;details.required=true;details.placeholder='Describe the safety concern. Do not include passwords or payment details.';details.className='field';
    const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const submit=node('button','Send report');submit.type='submit';submit.className='btn gold';
    const cancel=node('button','Close');cancel.type='button';cancel.className='btn';cancel.onclick=close;
    const key=`nene_output_report_${kind}_${id}_v1:${owner}`;
    let pending=null;
    try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&UUID.test(saved.request_id)&&saved.kind==='abuse'&&typeof saved.message==='string'&&saved.message.startsWith(`AI ${kind} reference: ${id}\n`)&&saved.message.length<=5000)pending=saved;}catch(_){}
    function retryView(){reason.disabled=true;details.disabled=true;details.required=false;details.value=pending.message;submit.textContent='Retry saved report';status.textContent='A report is awaiting confirmation. Retry the same report to avoid submitting a duplicate.';}
    if(pending)retryView();
    form.append(reason,details,status,submit,cancel);
    dialog.append(title,node('p','Report this output without leaving the app. A receipt confirms it was recorded; it does not mean a moderator has reviewed it.'),form);
    document.body.append(dialog);dialog.addEventListener('cancel',close);dialog.showModal();
    form.onsubmit=async event=>{
      event.preventDefault();if(submit.disabled||active!==state)return;
      submit.disabled=true;
      try{
        if(owner!==await window.neneAuthGetUserId?.())throw Error('Account changed. Reopen the output from your account.');
        const token=await window.neneAuthGetAccessToken?.();let subject;
        try{subject=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}
        if(!token||subject!==owner)throw Error('Sign in again before sending this report.');
        const base=new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl||'');if(base.protocol!=='https:')throw Error('The secure reporting service is unavailable.');
        if(active!==state||owner!==await window.neneAuthGetUserId?.())return;
        if(!pending){if(!details.value.trim())throw Error('Describe the safety concern first.');pending={request_id:crypto.randomUUID(),kind:'abuse',message:`AI ${kind} reference: ${id}\nReason: ${reason.value}\n${details.value.trim()}`};}
        // Persist before POST so a lost response/reopen keeps the same request ID.
        localStorage.setItem(key,JSON.stringify(pending));retryView();
        state.controller=new AbortController();const timer=setTimeout(()=>state.controller.abort(),25000);
        let response,data;
        try{response=await fetch(base.href.replace(/\/$/,'')+'/api/account/reports',{method:'POST',cache:'no-store',signal:state.controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(pending)});data=await response.json().catch(()=>null);}finally{clearTimeout(timer);}
        if(active!==state||owner!==await window.neneAuthGetUserId?.())return;
        if(!response.ok||!UUID.test(data?.report?.id||''))throw Error('The report could not be confirmed. Retry this saved report.');
        localStorage.removeItem(key);status.textContent='Report recorded. Reference: '+data.report.id+'. Review is pending.';submit.remove();
      }catch(error){if(active===state)status.textContent=error.name==='AbortError'?'The request timed out. Retry the saved report to check whether it was received.':error.message;}
      finally{if(active===state)submit.disabled=false;}
    };
  };
  window.addEventListener('nene-auth-changed',close);
})();
