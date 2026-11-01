/* Read-only account diagnostics; credentials stay in the authentication SDK. */
(() => {
  'use strict';
  const status = document.getElementById('account-status');
  const results = document.getElementById('account-results');
  const button = document.getElementById('account-check');
  let revision = 0;
  function clear() { revision++; results.replaceChildren(); status.textContent = 'Ready to check.'; }
  window.addEventListener('nene-auth-changed', clear);
  document.getElementById('account-signin').onclick = () => window.neneOpenAuth('signin');
  document.getElementById('account-signup').onclick = () => window.neneOpenAuth('signup');
  document.getElementById('account-signout').onclick = async () => {
    try { await window.nenePrivacyLocalSignOut(); clear(); status.textContent = 'Signed out on this device.'; }
    catch (_) { clear(); status.textContent = 'Sign-out could not be confirmed. Please retry.'; }
  };
  button.onclick = async () => {
    clear(); button.disabled = true;
    const run = revision;
    try {
      const owner = await window.neneAuthGetUserId();
      const token = await window.neneAuthGetAccountToken();
      if (!owner || !token) throw new Error('Sign in to your production account first.');
      const base = window.NENE_DIRECTOR_CONFIG.backendUrl;
      const checks = [
        ['/api/account/profile', 'Profile access verified'],
        ['/api/account/agreement', 'Account setup status verified'],
        ['/api/wallet', 'Wallet access verified']
      ];
      const messages = [];
      for (const [path, label] of checks) {
        const response = await fetch(base + path, {cache:'no-store', headers:{Authorization:'Bearer ' + token}});
        if (!response.ok) throw new Error(response.status === 401 ? 'Your sign-in expired or was rejected. Sign in again.' : 'The production account service could not complete the check. Please retry.');
        await response.json();
        messages.push(label);
      }
      if (run !== revision || owner !== await window.neneAuthGetUserId()) return;
      for (const message of messages) { const li = document.createElement('li'); li.textContent = message; results.append(li); }
      status.textContent = 'Production account connection passed. Session persistence still requires closing and reopening this page. Cross-account isolation requires a separate second account test.';
    } catch (error) {
      if (run === revision) status.textContent = error.message || 'Unable to check the account connection.';
    } finally { button.disabled = false; }
  };
})();
