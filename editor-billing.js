/* Only export metadata crosses the network. Server owns price and receipts. */
(() => {
  'use strict';
  async function ownerIs(owner){if(!owner||owner!==await window.neneAuthGetUserId?.())throw Error('Account changed. Reopen the editor for the signed-in account.');}
  async function api(owner,path,options={}){
    await ownerIs(owner);const token=await (window.neneAuthGetAccountToken||window.neneAuthGetAccessToken)?.();let subject;
    try{subject=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}
    if(!token||subject!==owner)throw Error('Sign in again before reviewing or purchasing an export.');
    const base=new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl||'');if(base.protocol!=='https:')throw Error('The secure export service is unavailable.');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{const response=await fetch(base.href.replace(/\/$/,'')+'/api/editor'+path,{...options,cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token,...options.headers}});await ownerIs(owner);const data=await response.json().catch(()=>null);if(!response.ok){const error=Error(typeof data?.detail==='string'?data.detail:'Export billing could not be confirmed. Check this saved export before retrying.');error.status=response.status;throw error;}if(!data)throw Error('The export response was incomplete. Check this saved export before retrying.');return data;}
    catch(error){if(error.name==='AbortError')throw Error('The response timed out. Your file is kept. Check the saved export before retrying; the same edit is never charged twice.');throw error;}finally{clearTimeout(timeout);}
  }
  function receipt(data,digest){if(data?.paid!==true||data.project_digest!==digest||!Number.isFinite(Number(data.credit_cost))||Number(data.credit_cost)<=0||!/^[0-9a-f-]{36}$/i.test(data.receipt_id||''))throw Error('The paid export receipt could not be verified. Check the saved export again.');return data;}
  async function review(owner,digest){if(!/^[a-f0-9]{64}$/.test(digest))throw Error('Invalid export reference.');const old=await api(owner,'/exports/'+digest);if(old.paid)return receipt(old,digest);const available=await api(owner,'/availability');if(available.available!==true)throw Error('New export purchases are temporarily unavailable. Your local file is kept.');const price=Number(available.credit_cost);if(!Number.isFinite(price)||price!==10)throw Error('The agreed export price could not be confirmed. No purchase was sent.');return {paid:false,credit_cost:String(price)};}
  async function purchase(owner,record,quote){
    if(!record.blob?.size||!record.requestKey||quote?.paid||Number(quote?.credit_cost)!==10)throw Error('Prepare the finished file and review its price before confirming.');
    const data=await api(owner,'/exports/'+record.digest+'/purchase',{method:'POST',headers:{'Idempotency-Key':record.requestKey},body:JSON.stringify({credit_limit:quote.credit_cost})});return receipt(data,record.digest);
  }
  window.NENEEditorBilling=Object.freeze({review,purchase,ownerIs});
})();
