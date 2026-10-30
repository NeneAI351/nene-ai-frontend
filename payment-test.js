/* Opt-in browser checkout test. Never opens sales or supplies payment evidence. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = window.NENE_DIRECTOR_CONFIG?.backendUrl?.replace(/\/$/, '');
  const referencePattern = /^nene_[0-9a-f]{32}$/;
  const storageKey = owner => 'nene-payment-test-v1:' + owner;
  let epoch = 0, owner = null, busy = false, ready = false, order = null;
  const status = message => { $('testStatus').textContent = message; };
  function checkoutUrl(value) {
    if (typeof value !== 'string' || /[\s\\]/.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'checkout.paystack.com' &&
        !url.username && !url.password && (!url.port || url.port === '443') && url.pathname.length > 1;
    } catch (_) { return false; }
  }
  function draw() {
    $('testCreate').disabled = busy || !ready || !owner || !!order;
    $('testPackage').disabled = busy || !ready || !!order;
    $('testEmail').disabled = busy || !!order;
    $('testVerify').disabled = busy || !ready || !owner || !order;
    $('testNew').disabled = busy || !order;
    $('testCheckoutLink').hidden = busy || !ready || !order?.url;
    if (order?.url) $('testCheckoutLink').href = order.url;
    else $('testCheckoutLink').removeAttribute('href');
    $('testReference').textContent = order ? 'Reference: ' + order.reference : '';
  }
  async function api(path, options = {}) {
    const response = await fetch(base + path, {cache:'no-store', ...options});
    const data = await response.json();
    if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'Request failed. Please retry.');
    return data;
  }
  async function session(version) {
    const id = await window.neneAuthGetUserId?.();
    const token = await window.neneAuthGetAccessToken?.();
    if (version !== epoch || !id || id !== owner || !token) throw Error('Sign in to your NENE AI test account first.');
    return {Authorization:'Bearer ' + token, 'Content-Type':'application/json'};
  }
  async function sync() {
    const version = ++epoch;
    owner = null; order = null; ready = false; busy = false;
    $('testBalance').textContent = ''; draw();
    try {
      if (base !== 'https://nene-ai-staging.onrender.com') throw Error('This test screen only connects to NENE AI staging.');
      const id = await window.neneAuthGetUserId?.();
      const packages = await api('/api/payments/packages');
      if (version !== epoch) return;
      if (packages.mode !== 'test' || packages.live_payments_enabled !== false) throw Error('Test checkout is locked because the server is not in test mode.');
      if (!Array.isArray(packages.packages) || !packages.packages.length) throw Error('Test packages are unavailable.');
      $('testPackage').replaceChildren();
      for (const item of packages.packages) {
        const option = document.createElement('option'); option.value = item.id;
        option.textContent = item.name + ' · ' + item.credits + ' credits · ₦' + Number(item.amount_ngn).toLocaleString() + ' (test)';
        $('testPackage').append(option);
      }
      owner = id || null; ready = true;
      if (owner) {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(storageKey(owner))); } catch (_) { /* No reusable reference. */ }
        if (saved?.owner === owner && referencePattern.test(saved.reference))
          order = {reference:saved.reference, url:checkoutUrl(saved.url) ? saved.url : null};
      }
      status(owner ? (order ? 'Saved test payment restored. Check its status before starting another.' : 'Ready. Create a test checkout when you are ready.') : 'Sign in with a NENE AI account, then finish account setup.');
    } catch (error) { if (version === epoch) status(error.message); }
    finally { if (version === epoch) draw(); }
  }
  $('testSignIn').onclick = () => window.neneOpenAuth();
  $('testAccount').onclick = () => window.neneOpenAccountAgreement();
  $('testCheckoutForm').onsubmit = async event => {
    event.preventDefault();
    if (busy || !ready || !owner || order) return;
    const version = epoch, id = owner;
    busy = true; draw(); status('Creating a test checkout…');
    try {
      const headers = await session(version);
      const data = await api('/api/payments/checkout', {method:'POST', headers,
        body:JSON.stringify({package_id:$('testPackage').value, email:$('testEmail').value.trim(), expected_mode:'test'})});
      if (version !== epoch || owner !== id) return;
      if (data.mode !== 'test' || !referencePattern.test(data.reference) || !checkoutUrl(data.authorization_url))
        throw Error('Invalid test checkout response. No payment link was opened.');
      order = {reference:data.reference, url:data.authorization_url};
      try { localStorage.setItem(storageKey(id), JSON.stringify({...order, owner:id})); }
      catch (_) { status('Checkout created. Keep this page open: the browser could not save the reference.'); return; }
      status('Open Paystack test checkout below. Complete it using test details, return here, then check payment and wallet.');
    } catch (error) { if (version === epoch) status(error.message); }
    finally { if (version === epoch) { busy = false; draw(); } }
  };
  $('testVerify').onclick = async () => {
    if (busy || !ready || !owner || !order) return;
    let latest;
    try { latest = JSON.parse(localStorage.getItem(storageKey(owner))); } catch (_) { /* Current reference remains usable. */ }
    if (latest?.owner === owner && referencePattern.test(latest.reference) && latest.reference !== order.reference) {
      await sync();
      status('A newer checkout was saved in another tab. Its reference is now loaded; check payment again.');
      return;
    }
    const version = epoch, id = owner, reference = order.reference;
    busy = true; draw(); status('Checking this payment with Paystack…');
    try {
      const headers = await session(version);
      const result = await api('/api/payments/verify', {method:'POST', headers, body:JSON.stringify({reference})});
      if (version !== epoch || owner !== id) return;
      if (result.credited !== true || result.reference !== reference) {
        const messages = {
          failed:'Paystack reports this reference as failed. It has not confirmed delivery for this payment.',
          abandoned:'Paystack reports this reference as abandoned. It has not confirmed delivery for this payment.',
          pending:'Paystack reports this reference as pending. Check again after checkout completes.',
          ongoing:'Paystack reports this reference as ongoing. Check again after checkout completes.',
          processing:'Paystack is still processing this reference. Check again shortly.'
        };
        status(messages[result.status] || 'Payment is not confirmed as delivered for this reference. The wallet balance below is checked separately.');
      } else status(result.duplicate ? 'Payment was already delivered. No additional credits were added.' : 'Test payment verified and credits delivered.');
      const wallet = await api('/api/wallet/paid', {headers});
      if (version !== epoch || owner !== id) return;
      const balance = Number(wallet.paid_available_credits);
      if (wallet.free_generation !== false || !Number.isFinite(balance) || balance < 0) throw Error('Wallet balance could not be confirmed. Keep this reference and retry.');
      $('testBalance').textContent = 'Server wallet balance: ' + balance.toLocaleString() + ' paid credits.';
    } catch (error) { if (version === epoch) status(error.message); }
    finally { if (version === epoch) { busy = false; draw(); } }
  };
  $('testNew').onclick = () => {
    if (busy || !order || !owner) return;
    if (!window.confirm('Keep the reference if you still need to check this payment. Start a separate test checkout?')) return;
    try { localStorage.removeItem(storageKey(owner)); } catch (_) { /* In-memory state still resets. */ }
    order = null; $('testBalance').textContent = ''; status('Ready for another test checkout.'); draw();
  };
  window.addEventListener('nene-auth-changed', sync);
  window.addEventListener('focus', () => { if (!busy) sync(); });
  window.addEventListener('storage', event => {
    if (!busy && owner && event.key === storageKey(owner)) sync();
  });
  sync();
})();
