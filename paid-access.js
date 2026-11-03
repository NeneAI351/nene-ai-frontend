/* Paid wallet display. Browser state is never payment evidence. */
(() => {
  'use strict';
  let requestNumber = 0;
  window.NENE_PAID_WALLET = null;
  const policy = 'After purchased credits are delivered to your account, change-of-mind cash refunds are not offered. Failed processing without delivery restores reserved credits to your NENE AI wallet, rather than issuing a cash refund. Applicable law and app-store/payment-platform refund rules still apply. Duplicate charges, unauthorized payments and paid credits not delivered remain eligible for investigation and any required remedy.';
  function draw() { if (typeof updateCredits === 'function') updateCredits(); const profile=document.getElementById('profilePaidBalance'); if(profile) profile.textContent='Paid credits: '+(Number.isFinite(window.NENE_PAID_WALLET)?window.NENE_PAID_WALLET:'unavailable'); }
  window.neneRefreshPaidWallet = async () => {
    const current = ++requestNumber;
    window.NENE_PAID_WALLET = null; draw();
    try {
      const token = await window.neneAuthGetAccessToken?.();
      if (!token) return;
      const base = window.NENE_DIRECTOR_CONFIG?.backendUrl;
      if (!base) return;
      const response = await fetch(base.replace(/\/$/, '') + '/api/wallet/paid', {
        headers: {Authorization: 'Bearer ' + token}, cache: 'no-store'
      });
      if (!response.ok) return;
      const data = await response.json();
      const value = Number(data.paid_available_credits);
      if (current === requestNumber && Number.isFinite(value) && value >= 0 && data.free_generation === false)
        window.NENE_PAID_WALLET = value;
    } catch (_) { /* Unavailable is not a fabricated balance. */ }
    finally { if (current === requestNumber) draw(); }
  };
  let modalRevision = 0;
  window.neneOpenPaidCredits = async () => {
    const revision = ++modalRevision;
    showModal('<h2>Paid credits &amp; refund policy</h2><p class="subtitle">Video generation and AI planning require paid credits. There are no free generation credits.</p><div id="paidPackageList"></div><p class="notice" id="paidCheckoutStatus" role="status">Checking purchase availability…</p><p class="notice" id="paidRefundPolicy"></p><a id="paidCheckout" class="btn gold" href="./credits.html" hidden>Buy credits</a><button class="btn secondary" onclick="closeModal()">Close</button>');
    const status = document.getElementById('paidCheckoutStatus');
    document.getElementById('paidRefundPolicy').textContent = policy;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const base = window.NENE_DIRECTOR_CONFIG?.backendUrl?.replace(/\/$/, '');
      if (!base) throw Error('unavailable');
      const responses = await Promise.all(['/api/payments/packages', '/api/generation-availability'].map(path => fetch(base + path, {cache:'no-store', signal:controller.signal})));
      if (responses.some(response => !response.ok)) throw Error('unavailable');
      const [catalog, generation] = await Promise.all(responses.map(response => response.json()));
      if (revision !== modalRevision || !status.isConnected) return;
      if (!Array.isArray(catalog.packages)) throw Error('unavailable');
      for (const item of catalog.packages) {
        const amount = Number(item.amount_ngn), count = Number(item.credits);
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(count) || count <= 0) continue;
        const row = document.createElement('p');
        row.textContent = String(item.name) + ' · ' + count.toLocaleString() + ' credits · ₦' + amount.toLocaleString();
        document.getElementById('paidPackageList').append(row);
      }
      const available = catalog.mode === 'live' && catalog.live_payments_enabled === true && generation.accepting_requests === true;
      status.textContent = available ? 'Review the package and refund policy before paying. Credits are added after payment verification.' : 'Credit purchases are temporarily closed while video generation is prepared. Please check back before buying.';
      document.getElementById('paidCheckout').hidden = !available;
    } catch (_) {
      if (revision === modalRevision && status.isConnected) status.textContent = 'Purchases are temporarily unavailable. Please try again later.';
    } finally { clearTimeout(timeout); }
  };
  window.addEventListener('nene-auth-changed', () => { modalRevision++; if (document.getElementById('paidCheckoutStatus')) window.closeModal?.(); });
  window.addEventListener('nene-auth-changed', window.neneRefreshPaidWallet);
  window.addEventListener('focus', window.neneRefreshPaidWallet);
  window.neneRefreshPaidWallet();
})();
