/* Production ownership checks use the signed-in SDK session, never shared tokens. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let revision = 0, busy = false;
  const controls = ['isolation-create','isolation-copy','isolation-test','isolation-verify'];
  const key = owner => 'nene-isolation-v1:' + owner;
  function read(owner) { try { return JSON.parse(localStorage.getItem(key(owner)) || 'null'); } catch (_) { return null; } }
  function write(owner, state) { localStorage.setItem(key(owner), JSON.stringify(state)); }
  function show(message) { $('isolation-status').textContent = message; }
  function link(state) { const url = new URL(location.pathname, location.origin); url.hash = new URLSearchParams({project:state.id,check:state.check}).toString(); return url.href; }
  function display(state) { $('isolation-share').value = state?.id ? link(state) : ''; }
  async function context() {
    const owner = await window.neneAuthGetUserId();
    if (!owner) throw new Error('Sign in to your production account first.');
    const run = revision;
    async function request(path, options = {}) {
      if (run !== revision || owner !== await window.neneAuthGetUserId()) throw new Error('Account changed. Run the check again.');
      const token = await window.neneAuthGetAccountToken();
      if (!token) throw new Error('Sign in again.');
      const response = await fetch(window.NENE_DIRECTOR_CONFIG.backendUrl + path, {...options,cache:'no-store',headers:{'Content-Type':'application/json',Authorization:'Bearer ' + token}});
      if (run !== revision || owner !== await window.neneAuthGetUserId()) throw new Error('Account changed. Run the check again.');
      return response;
    }
    return {owner, request};
  }
  async function run(action) {
    if (busy) return;
    busy = true; const started = revision; controls.forEach(id => $(id).disabled = true);
    try { await action(); } catch (error) { if (started === revision) show(error.message || 'Check could not finish. Please retry.'); }
    finally { busy = false; controls.forEach(id => $(id).disabled = false); }
  }
  $('isolation-create').onclick = () => run(async () => {
    const {owner,request} = await context();
    let state = read(owner);
    if (state?.id) { display(state); show('Your existing test project is ready. Copy its link to the other account.'); return; }
    if (state?.pending) {
      const response = await request('/api/projects?limit=100');
      if (!response.ok) throw new Error('Could not recover the previous creation attempt. No new project was requested.');
      const data = await response.json();
      const found = data.items?.find(p => p.name === state.name && p.description === state.description && p.user_id === owner);
      if (!found) throw new Error('The earlier creation result is still unknown. No duplicate project was requested. Retry this check later.');
      state.id = found.id; state.pending = false; write(owner,state); display(state); show('Recovered your existing test project. Copy its link to the other account.'); return;
    }
    state = {check:crypto.randomUUID(),pending:true};
    state.name = 'NENE AI isolation test ' + state.check;
    state.description = 'Ownership check only. Original marker: ' + state.check;
    write(owner,state);
    const response = await request('/api/projects',{method:'POST',body:JSON.stringify({name:state.name,description:state.description})});
    if (!response.ok) {
      if (response.status < 500) localStorage.removeItem(key(owner));
      throw new Error('Test project could not be created. Please check your account connection.');
    }
    const project = await response.json();
    if (!uuid.test(project.id) || project.user_id !== owner || project.description !== state.description) throw new Error('Unexpected project ownership response. Stop this test.');
    state.id = project.id; state.pending = false; write(owner,state); display(state);
    show('Test project created for this account. Copy the link and open it while signed in to the other account. No credits were used.');
  });
  $('isolation-copy').onclick = () => run(async () => {
    const owner = await window.neneAuthGetUserId(), state = owner && read(owner);
    if (!state?.id) throw new Error('Create your own test project first.');
    display(state);
    try { await navigator.clipboard.writeText(link(state)); show('Test link copied. Send it to the other phone.'); }
    catch (_) { $('isolation-share').focus(); $('isolation-share').select(); show('Select and copy the test link shown above.'); }
  });
  $('isolation-test').onclick = () => run(async () => {
    const {owner,request} = await context();
    let url; try { url = new URL($('isolation-other').value || location.href); } catch (_) { throw new Error('Paste the test link from the other phone.'); }
    const params = new URLSearchParams(url.hash.slice(1)), id = params.get('project'), check = params.get('check');
    if (url.origin !== location.origin || url.pathname !== location.pathname || !uuid.test(id || '') || !uuid.test(check || '')) throw new Error('Use a valid test-project link from this page.');
    const own = read(owner);
    if (own?.id === id) throw new Error('This is your own project. Open the link using the other account.');
    const response = await request('/api/projects/' + id);
    if (response.status !== 404) throw new Error(response.ok ? 'FAILED: this account could read the other project. Stop and report this result.' : 'Read check was inconclusive. Confirm sign-in and retry.');
    const edit = await request('/api/projects/' + id,{method:'PATCH',body:JSON.stringify({description:'Isolation test unexpected foreign edit: ' + check})});
    if (edit.status !== 404) throw new Error(edit.ok ? 'FAILED: this account could edit the other project. Stop and report this result.' : 'Edit check was inconclusive. Confirm sign-in and retry.');
    show('PASS: this account was blocked from reading and editing that test project (404 for both). On the owner phone, tap Verify my project unchanged. Repeat in the opposite direction.');
  });
  $('isolation-verify').onclick = () => run(async () => {
    const {owner,request} = await context(), state = read(owner);
    if (!state?.id) throw new Error('Create your test project on this account first.');
    const response = await request('/api/projects/' + state.id);
    if (!response.ok) throw new Error('Could not read your own test project.');
    const project = await response.json();
    if (project.user_id !== owner || project.name !== state.name || project.description !== state.description) throw new Error('FAILED: your test project changed unexpectedly. Stop and report this result.');
    show('PASS: your account can read its own project and the original name and description are unchanged.');
  });
  window.addEventListener('nene-auth-changed', () => { revision++; display(null); show('Account changed. Sign in and run the checks for this account.'); });
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.has('project')) { $('isolation-other').value = location.href; show('Test link loaded. Sign in to the OTHER account, then tap Check other account project.'); }
})();
