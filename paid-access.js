/* Paid wallet display. Browser state is never payment evidence. */
(() => {
  'use strict';
  let requestNumber = 0;
  window.NENE_PAID_WALLET = null;
  const policy = 'After purchased credits are delivered to your account, change-of-mind cash refunds are not offered. Failed processing without delivery restores reserved credits to your NENE AI wallet, rather than issuing a cash refund. Applicable law and app-store/payment-platform refund rules still apply. Duplicate charges, unauthorized payments and paid credits not delivered remain eligible for investigation and any required remedy.';
  function draw() { if (typeof updateCredits === 'function') updateCredits(); }
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
  window.neneOpenPaidCredits = () => {
    showModal('<h2>Paid credits &amp; refund policy</h2><p class="subtitle">Registration and browsing are free. Video generation and AI planning require paid credits. There are no welcome or free generation credits.</p><p class="notice" id="paidRefundPolicy"></p><p class="subtitle">Purchases are not open yet. Payment verification and the complete generation journey must pass before paid access opens.</p><button class="btn gold" onclick="closeModal()">Close</button>');
    document.getElementById('paidRefundPolicy').textContent = policy;
  };
  window.addEventListener('nene-auth-changed', window.neneRefreshPaidWallet);
  window.addEventListener('focus', window.neneRefreshPaidWallet);
  window.neneRefreshPaidWallet();
})();
