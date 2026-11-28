(() => {
  'use strict';
  const element = (tag, text) => {
    const result = document.createElement(tag);
    if (text) result.textContent = text;
    return result;
  };
  async function api(owner, path, options = {}) {
    const token = await window.neneAuthGetAccessToken?.();
    if (!token || owner !== await window.neneAuthGetUserId?.()) throw Error('Sign in again to use lip-sync.');
    const base = new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl);
    if (base.protocol !== 'https:') throw Error('Secure video service unavailable.');
    const response = await fetch(new URL(path, base), {...options, cache:'no-store',
      headers:{Authorization:'Bearer '+token,...options.headers}});
    const data = await response.json();
    if (owner !== await window.neneAuthGetUserId?.()) throw Error('Account changed. Reopen lip-sync.');
    if (!response.ok) {
      const error = Error(typeof data.detail === 'string' ? data.detail : 'Lip-sync request could not finish.');
      error.status = response.status; throw error;
    }
    return data;
  }
  window.neneOpenLipSync = async () => {
    const root = element('main');
    const heading = element('div'); heading.className = 'toolhead';
    const back = element('button', '‹'); back.type = 'button'; back.className = 'back';
    back.setAttribute('aria-label', 'Back to Translate & Dub'); back.onclick = () => window.neneOpenTranslateSubtitles();
    heading.append(back, element('h1', 'Lip-sync'));
    const status = element('p', 'Checking availability…'); status.className = 'notice'; status.setAttribute('role','status');
    root.append(heading,status);
    window.setNav('create');
    document.getElementById('screen').replaceChildren(root);
    const owner = await window.neneAuthGetUserId?.();
    if (!owner) {status.textContent='Sign in to use saved videos and voice tracks.';return;}
    const stateKey = 'nene-lip-sync:' + owner;
    let saved = {};
    try {saved = JSON.parse(localStorage.getItem(stateKey) || '{}') || {};} catch {}
    const persist = () => localStorage.setItem(stateKey, JSON.stringify(saved));
    try {
      const data = await api(owner,'/api/lip-sync/options');
      if (!root.isConnected) return;
      if (!data.available) {status.textContent='Lip-sync is currently unavailable.';return;}
      status.textContent = '';
      const select = (label, choices) => {
        const wrap = element('label',label); wrap.className='block';
        const field = element('select');
        for (const [value,title] of choices) {
          const option = element('option',title); option.value=value;field.append(option);
        }
        wrap.append(field);root.append(wrap);return field;
      };
      const button = (label, action) => {
        const control = element('button',label);control.type='button';control.className='btn';control.onclick=action;root.append(control);return control;
      };
      root.append(element('p','Choose a saved video with visible mouth movement and a voice track for the same person.'));
      const video = select('Saved video',data.videos.map(item=>[item.id,(item.title||'Saved video')+' · '+item.duration+' s']));
      const voice = select('Saved voice track',data.voices.map(item=>[item.id,(item.title||'Saved voice')+' · '+item.duration.toFixed(1)+' s']));
      const duration = select('Length', [6,8,10].map(value=>[value,value+' seconds']));
      const output = element('section');
      let busy = false, displayed = saved.job;
      function setup(){
        const price = Number(duration.value)*data.credits_per_second;
        const validLength = data.videos.some(item=>item.id===video.value&&item.duration>=Number(duration.value))
          && data.voices.some(item=>item.id===voice.value&&item.duration>=Number(duration.value));
        submit.disabled=busy||(!saved.pending&&!validLength);
        submit.textContent=saved.pending?'Resume the same submission':'Confirm lip-sync · '+price+' paid credits';
        for (const field of [video,voice,duration])field.disabled=busy||!!saved.pending;
      }
      async function check(){
        if (!displayed || !root.isConnected) return;
        const job=displayed;
        try{
          const {generation}=await api(owner,'/api/generations/'+job);
          if (!root.isConnected || displayed!==job) return;
          if (generation.status==='succeeded') {
            const media=await api(owner,'/api/generations/'+job+'/media-url');
            if (!root.isConnected || displayed!==job) return;
            const url=new URL(media.url);
            if(url.protocol!=='https:')throw Error('Secure playback link unavailable.');
            const player=element('video');player.controls=true;player.playsInline=true;player.style.width='100%';player.src=url.href;
            const download=element('a','Open or download video');download.href=url.href;download.target='_blank';download.rel='noopener';
            output.replaceChildren(player,download);
            status.textContent='Ready. Your video is also in My Creations.';
          } else if (generation.status==='failed') {
            status.textContent='Lip-sync failed. Check your wallet for released credits.';
          } else {
            status.textContent='Creating…';
            setTimeout(()=>{if(displayed===job)void check();},9000);
          }
        } catch(error){if(root.isConnected&&displayed===job)status.textContent=error.message;}
      }
      const submit=button('Confirm lip-sync',async()=>{
        if(busy)return;
        if(!saved.pending){
          const credit_limit=Number(duration.value)*data.credits_per_second;
          if(!window.confirm('Use '+credit_limit+' paid credits and send the selected video and voice track to the lip-sync provider?'))return;
          saved.pending={key:crypto.randomUUID(),body:{video_id:video.value,audio_id:voice.value,duration:Number(duration.value),credit_limit}};
        }
        busy=true;setup();
        try{
          persist();status.textContent='Submitting…';
          const result=await api(owner,'/api/lip-sync/generations',{method:'POST',
            headers:{'Content-Type':'application/json','Idempotency-Key':saved.pending.key},
            body:JSON.stringify(saved.pending.body)});
          if(!/^[0-9a-f-]{36}$/i.test(result.generation_id))throw Error('Submission could not be confirmed. Resume the same request.');
          displayed=saved.job=result.generation_id;delete saved.pending;persist();output.replaceChildren();
          void check();
        }catch(error){
          if([400,401,402,403,404,422].includes(error.status)){delete saved.pending;persist();}
          status.textContent=error.message;
        }finally{busy=false;setup();}
      });
      button('Refresh result',()=>void check());
      root.append(output);
      duration.onchange=video.onchange=voice.onchange=setup;
      setup();void check();
      if(!video.value||!voice.value)status.textContent='Create a saved video and voice track before running lip-sync.';
      else if(!saved.pending&&!displayed&&submit.disabled)status.textContent='Both inputs must be at least as long as the selected length.';
    } catch(error){if(root.isConnected)status.textContent=error.message;}
  };
})();
