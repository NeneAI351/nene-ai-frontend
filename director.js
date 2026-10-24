/* AI Director: authenticated planning only. No browser keys or automatic videos. */
(function () {
  'use strict';
  let activeView = null;
  let busy = false;
  let retryRequest = null;

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  async function api(view, path, options = {}) {
    const owner=view.owner;
    if(!owner || owner!==await window.neneAuthGetUserId?.())throw new Error('Sign in to use AI Director.');
    const configured = window.NENE_DIRECTOR_CONFIG?.backendUrl || window.NENEBackend?.getUrl?.();
    if (!configured) throw new Error('AI Director is not connected yet. Your idea has not been sent.');
    const origin = new URL(configured);
    if (origin.protocol !== 'https:') throw new Error('AI Director requires a secure connection.');
    const token = await window.neneAuthGetAccessToken?.();
    let subject;try{subject=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}
    if (!token || subject!==owner || owner!==await window.neneAuthGetUserId?.() || owner!==view.owner) throw new Error('Please sign in to the same account to use AI Director.');
    const headers = { Authorization: 'Bearer ' + token, ...options.headers };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch(origin.href.replace(/\/$/, '') + '/api/director' + path,
        { ...options, headers, signal: controller.signal, cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if(owner!==view.owner || owner!==await window.neneAuthGetUserId?.())throw new Error('Account changed. Your previous account’s plans are hidden.');
      if (!response.ok) {
        if (response.status === 401) throw new Error('Your sign-in expired. Sign in again; your idea remains here.');
        throw new Error(typeof body.detail === 'string' ? body.detail : 'AI Director could not complete this request. Your idea remains here.');
      }
      return body;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Planning timed out. Check saved plans before retrying. A retry of this idea will reuse the same request key.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function selected(label, id, options) {
    const block = node('div', undefined, 'block');
    const caption = node('label', label, 'label'); caption.htmlFor = id;
    const field = node('select'); field.id = id;
    for (const value of options) { const opt = node('option', String(value)); opt.value = value; field.append(opt); }
    block.append(caption, field); return block;
  }
  function message(view, text) { view.querySelector('#directorMessage').textContent = text; }
  function showPlan(view, record) {
    if (activeView !== view || !view.isConnected) return;
    const result = view.querySelector('#directorResult'); result.replaceChildren();
    if (!record?.plan || !Array.isArray(record.plan.scenes)) throw new Error('The saved plan could not be displayed.');
    result.append(node('h2', record.plan.title), node('p', record.plan.summary, 'subtitle'),
      node('p', 'Production plan saved to your account. Video, narration audio, music and captions have not been rendered.', 'notice'),
      node('p', record.plan.continuity_notes, 'subtitle'));
    record.plan.scenes.forEach((scene, index) => {
      const card = node('section', undefined, 'block');
      card.append(node('h3', `${index + 1}. ${scene.title}`));
      for (const [label, value] of [['Visual direction', scene.visual_prompt], ['Narration script', scene.narration],
        ['On-screen text', scene.on_screen_text], ['Sound direction', scene.sound_direction]]) {
        card.append(node('strong', label), node('p', value || 'None', 'subtitle'));
      }
      const use = node('button', 'Use visual prompt in Text → Video', 'btn'); use.type = 'button';
      use.onclick = async () => {
        if (busy) return;
        await openTool('text');
        const prompt = document.getElementById('prompt'); if (prompt) prompt.value = scene.visual_prompt;
        const duration = document.getElementById('neneDuration'); if (duration) { duration.value = String(record.brief.scene_seconds); duration.dispatchEvent(new Event('change',{bubbles:true})); }
        const ratio = document.getElementById('neneAspectRatio'); if (ratio) { ratio.value = record.brief.aspect_ratio; ratio.dispatchEvent(new Event('change',{bubbles:true})); }
      };
      card.append(use); result.append(card);
    });
    const download = node('button', 'Download production plan', 'btn'); download.type = 'button';
    download.onclick = () => {
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'nene-ai-production-plan.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    result.append(download);
  }
  async function loadPlans(view) {
    const data = await api(view, '/plans');
    if (activeView !== view || !view.isConnected) return;
    const list = view.querySelector('#directorSaved'); list.replaceChildren();
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) list.append(node('p', 'No saved AI Director plans yet.', 'subtitle'));
    for (const item of items) {
      const button = node('button', item.plan?.title || 'Saved plan', 'btn'); button.type = 'button';
      button.onclick = () => { try { showPlan(view, item); } catch (e) { message(view, e.message); } };
      list.append(button);
    }
  }
  window.neneBuildDirectorPlan = async function () {
    const view = activeView; if (!view?.isConnected || busy || !view.available) return;
    const owner=view.owner;
    const idea = view.querySelector('#directorIdea').value.trim();
    if (idea.length < 10) { message(view, 'Describe your idea in at least 10 characters.'); return; }
    const brief = { idea, goal: view.querySelector('#directorGoal').value,
      scene_count: Number(view.querySelector('#directorScenes').value),
      scene_seconds: Number(view.querySelector('#directorDuration').value),
      aspect_ratio: view.querySelector('#directorRatio').value };
    const serialized = JSON.stringify(brief);
    if (!retryRequest || retryRequest.brief !== serialized) retryRequest = { brief: serialized, key: crypto.randomUUID() };
    const button = view.querySelector('#directorGenerate'); busy = true; button.disabled = true;
    message(view, 'Planning your script and scenes… Please keep this screen open.');
    try {
      const record = await api(view, '/plans', { method: 'POST', headers: { 'Content-Type': 'application/json',
        'Idempotency-Key': retryRequest.key }, body: serialized });
      showPlan(view, record);
      message(view, 'Your production plan is ready. Review the scenes before choosing any video generation.');
      // Keep the same key until the brief changes: repeated clicks retrieve the
      // saved result rather than charging the model for identical work again.
      await loadPlans(view);
      await window.neneRefreshPaidWallet?.();
    } catch (error) { if (activeView === view) message(view, error.message); }
    finally { busy = false; if (view.isConnected) button.disabled = !view.available || owner!==view.owner; }
  };
  window.neneOpenDirector = async function () {
    if (busy) { toast('Please wait for the current planning request.'); return; }
    setNav('create');
    const view = node('main'); view.owner=null;view.available=false;activeView = view;
    const header = node('div', undefined, 'toolhead');
    const back = node('button', '‹', 'back'); back.setAttribute('aria-label', 'Back to Create');
    back.onclick = () => { if (!busy) { activeView = null; renderCreateHub(); } };
    header.append(back, node('h1', 'AI Director')); view.append(header);
    view.append(node('p', 'Turn your idea into a script, visual scene prompts and production directions.', 'subtitle'),
      node('p', 'Paid credits are required for each new production plan. The price is shown below when paid planning is available. Video generation is charged separately. Your brief is sent to our AI planning provider when you choose Create production plan.', 'notice'));
    const label = node('label', 'Your idea', 'label'); label.htmlFor = 'directorIdea';
    const idea = node('textarea'); idea.id = 'directorIdea'; idea.maxLength = 6000;
    idea.placeholder = 'Describe your story, audience, characters, setting and desired ending…';
    view.append(label, idea, selected('Production goal', 'directorGoal', ['Story film', 'Business ad', 'Educational video', 'Social video']),
      selected('Number of scenes', 'directorScenes', [3, 2, 4, 5, 6]),
      selected('Seconds per scene', 'directorDuration', [6, 8, 10]),
      selected('Aspect ratio', 'directorRatio', ['16:9', '9:16', '1:1']));
    const status = node('p', 'Checking AI planning availability…', 'notice'); status.id = 'directorMessage';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); view.append(status);
    const generate = node('button', 'Create production plan', 'btn gold'); generate.type = 'button'; generate.id = 'directorGenerate'; generate.disabled = true;
    generate.onclick = window.neneBuildDirectorPlan;
    const signIn = node('button', 'Sign in', 'btn'); signIn.type = 'button'; signIn.onclick = () => window.neneOpenAuth?.();
    const check = node('button', 'Check connection / refresh saved plans', 'btn'); check.type = 'button';
    async function refresh() {
      const ticket=(view.refreshTicket||0)+1;view.refreshTicket=ticket;
      check.disabled = true;generate.disabled=true;
      view.owner=await window.neneAuthGetUserId?.();
      if(!view.owner){view.available=false;message(view,'Sign in to view your plans and check planning availability.');check.disabled=false;return;}
      try {
        const state = await api(view, '/status');
        if (activeView !== view || !view.isConnected) return;
        if(ticket!==view.refreshTicket)return;
        view.available=state.available===true;generate.disabled = !view.available; message(view, state.message);
        generate.textContent = state.available && state.credit_cost ? `Create production plan · ${state.credit_cost} paid credits` : 'Create production plan';
        await loadPlans(view);
      } catch (error) { if (activeView === view && ticket===view.refreshTicket) { generate.disabled = true; message(view, error.message); } }
      finally { check.disabled = false; }
    }
    check.onclick = () => { if (!busy) refresh(); };
    const results = node('div'); results.id = 'directorResult';
    const saved = node('div', undefined, 'list'); saved.id = 'directorSaved';
    view.append(generate, signIn, check, results, node('h2', 'Saved production plans'), saved);
    document.getElementById('screen').replaceChildren(view);view.refresh=refresh;
    window.NENEStudioUI?.enhance({root:view,signin:signIn,check,generate,jobs:saved,settings:true});
    await refresh();
  };
  window.addEventListener('nene-auth-changed',()=>{
    const view=activeView;if(!view?.isConnected)return;
    view.owner=null;view.available=false;view.refreshTicket=(view.refreshTicket||0)+1;retryRequest=null;
    view.querySelector('#directorGenerate').disabled=true;view.querySelector('#directorSaved').replaceChildren();view.querySelector('#directorResult').replaceChildren();
    view.querySelector('#directorIdea').value='';
    message(view,'Account changed. Refresh to load this account’s saved plans.');
    if(!busy)view.refresh?.();
  });
})();

