/* One-time account agreement. No checkbox on ordinary login or checkout. */
(() => {
  'use strict';
  const version = '2026-10-23-account-v1';
  const acceptedUsers = new Set();
  const pending = new Map();
  const link = '<a href="./terms.html" target="_blank" rel="noopener" style="color:#ffe7a1">Terms of Service and Refund Policy</a>';
  async function api(session, method = 'GET') {
    const base = window.NENE_DIRECTOR_CONFIG?.backendUrl;
    if (!base || !session?.access_token) throw new Error('Sign in to finish account setup.');
    const response = await fetch(base.replace(/\/$/, '') + '/api/account/agreement', {
      method, cache:'no-store', headers:{Authorization:'Bearer ' + session.access_token,
        ...(method === 'POST' ? {'Content-Type':'application/json'} : {})},
      ...(method === 'POST' ? {body:JSON.stringify({accepted:true,terms_version:version})} : {})
    });
    if (!response.ok) throw new Error('Account setup could not be verified. Please try again.');
    return response.json();
  }
  async function sync(session) {
    const id = session?.user?.id;
    if (!id) return false;
    if (acceptedUsers.has(id)) return true;
    if (pending.has(id)) return pending.get(id);
    const task = (async () => {
      let record = await api(session);
      const metadata = session.user.user_metadata || {};
      // This explicit assertion was collected by the signup checkbox. After
      // email confirmation, persist it on the authenticated account once.
      if (!record.accepted && metadata.nene_terms_accepted === true && metadata.nene_terms_version === version)
        record = await api(session, 'POST');
      if (record.accepted === true) acceptedUsers.add(id);
      return record.accepted === true;
    })();
    pending.set(id,task);
    try { return await task; } finally { pending.delete(id); }
  }
  function open(session) {
    showModal('<h2>Complete account setup</h2><p class="subtitle">Read the '+link+'. Paid credits are required for generation. Change-of-mind cash refunds are not offered after credit delivery; required legal/store refunds and failed-generation credit restoration remain.</p><label class="notice" style="display:block;margin:12px 0"><input id="neneSetupAgreement" type="checkbox" required> I agree to the Terms of Service and Refund Policy.</label><p id="neneSetupMessage" role="status" aria-live="polite"></p><button id="neneSetupSubmit" class="btn gold">Finish account setup</button><button class="btn" style="margin-top:10px" onclick="closeModal()">Cancel</button>');
    const button=document.getElementById('neneSetupSubmit');
    button.onclick=async () => {
      const message=document.getElementById('neneSetupMessage');
      if (!document.getElementById('neneSetupAgreement').checked) {
        message.textContent='Read and accept the agreement to finish account setup.';return;
      }
      button.disabled=true;
      try {
        const result=await api(session,'POST');
        if (result.accepted !== true) throw new Error('Account setup was not completed.');
        acceptedUsers.add(session.user.id);
        message.textContent='Account setup complete. You will not be asked again at sign-in or purchase.';
        button.textContent='Done';button.disabled=false;button.onclick=()=>closeModal();
      } catch(error) {message.textContent=error.message;button.disabled=false;}
    };
  }
  window.neneAccountSetup={version,link,sync,open,async require(session) {
    try {if (await sync(session)) return true;open(session);}
    catch(error) {if (typeof toast === 'function') toast(error.message);}
    return false;
  }};
})();
