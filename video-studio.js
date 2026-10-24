/* Paid text and image video studio: no prototype grants or legacy submission. */
(() => {
  'use strict';
  let active = null;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const fields = ['idea','style','shot','camera','lighting','motion','duration','resolution','ratio','audio','sound','dialogue','speechMode','ttsVoice'];
  const el = (tag,text,cls) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const displayValue=(name,value)=>name==='duration'?value+' seconds':name==='ratio'?({'16:9':'16:9 · Landscape','9:16':'9:16 · Portrait','1:1':'1:1 · Square'}[value]||value):value;
  function say(v,text){if(active===v && v.root.isConnected)v.message.textContent=text;}
  function storageKey(v,suffix){return `nene_video_${v.mode}_${suffix}_v1:${v.owner}`;}
  function read(v,suffix,fallback){try{return JSON.parse(localStorage.getItem(storageKey(v,suffix))||'null')||fallback;}catch(_){return fallback;}}
  function write(v,suffix,value){localStorage.setItem(storageKey(v,suffix),JSON.stringify(value));}
  function lock(v,locked){for(const name of fields){v.form.elements[name].disabled=locked;const button=v.form.querySelector('[data-choice-for="'+name+'"]');if(button)button.disabled=locked;}if(v.file)v.file.disabled=locked;if(v.audioFile)v.audioFile.disabled=locked;if(v.form.elements.audio?.value==='Silent')v.form.elements.sound.disabled=true;v.review.disabled=locked;}
  function alive(v){return active===v && v.root.isConnected;}
  async function api(v,path,options={}){
    const owner=await window.neneAuthGetUserId?.();
    const token=await window.neneAuthGetAccessToken?.();
    let subject;try{subject=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}
    if(!owner || !token || subject!==owner || owner!==v.owner || owner!==await window.neneAuthGetUserId?.())throw new Error('Sign in to the same account, then check your account again.');
    const base=new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl||'');
    if(base.protocol!=='https:')throw new Error('The secure video service is not configured.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(base.href.replace(/\/$/,'')+path,{...options,cache:'no-store',signal:controller.signal,
        headers:{Authorization:'Bearer '+token,...options.headers}});
      const data=await response.json().catch(()=>({}));
      if(await window.neneAuthGetUserId?.()!==owner || v.owner!==owner)throw new Error('The account changed. Reopen Video Studio.');
      if(!response.ok){const raw=typeof data.detail==='string'?data.detail:'The video service could not complete this request.';const e=new Error(/LTX|Pixazo|Magic Hour|provider|durable|configuration|worker|database/i.test(raw)?'Video creation is temporarily unavailable. Please try again later.':raw);e.status=response.status;throw e;}
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('The request timed out. Retry the same pending submission safely; do not create another copy.');throw error;}
    finally{clearTimeout(timer);}
  }
  function draft(v){const data={};for(const name of fields)data[name]=v.form.elements[name].value.trim();if(v.mode==='talking'){data.audioId=v.audioAsset?.source_audio_id||null;data.imageRevision=v.imageRevision||null;}return data;}
  function payload(v,d){
    if(!v.audioSupported)throw new Error('Sound settings are updating. Check availability again before generating.');
    if(!['AI scene sound','Silent'].includes(d.audio))throw new Error('Choose a supported sound setting.');
    if(!d.idea)throw new Error('Describe your scene or motion first.');
    let prompt=[d.idea,'Production preferences (the scene description takes priority):',
      `Style: ${d.style}. Shot: ${d.shot}. Camera: ${d.camera}. Lighting: ${d.lighting}. Motion: ${d.motion}.`,
      'Keep the main action clear and visual details consistent across frames.'].join('\n');
    if(window.NENEPromptAssist){const prepared=window.NENEPromptAssist.forGeneration(v.form.elements.idea,prompt);if(prepared===null)throw new Error('Review the enhanced prompt again after changing production controls.');prompt=prepared;}
    if(['image','talking'].includes(v.mode)){
      if(!v.imageData&&!v.sourceImageId)throw new Error('Choose a source image first.');
      prompt+='\nUse the supplied source image as the visual anchor. Preserve its subject and appearance while applying only the requested motion. Exact visual identity is not guaranteed.';
    }
    if(d.audio==='AI scene sound'&&d.sound)prompt+='\nSound direction: '+d.sound;
    if(v.mode==='talking'){
      if(d.audio!=='AI scene sound')throw Error('Talking characters require sound.');
      prompt+='\nA single character faces the camera. Keep the mouth visible and synchronize natural lip movements to the speech. No subtitles or other speakers.';
      if(!v.audioAsset?.source_audio_id)throw Error('Create and approve a voice track, or upload a recording, before reviewing the video price.');
      if(d.speechMode==='Write dialogue'&&(!v.approvedSpeech||v.approvedSpeech.script!==d.dialogue||v.approvedSpeech.voice!==d.ttsVoice||v.approvedSpeech.id!==v.audioAsset.source_audio_id))throw Error('Create and approve the voice track for this script and voice first.');
      if(d.dialogue)prompt+='\nSpeech transcript for context only: '+d.dialogue;

    }
    if(prompt.length>5000)throw new Error('Shorten the prompt and sound description to fit within 5,000 characters.');
    return {...(v.mode==='talking'?{source_audio_id:v.audioAsset.source_audio_id}:{}),generate_audio:d.audio==='AI scene sound',type:v.mode==='talking'?'audio-to-video':v.mode==='image'?'image-to-video':'text-to-video',provider:'ltx',model:'ltx-2-5-fast',resolution:d.resolution,duration:v.mode==='talking'?v.audioAsset.billable_seconds:Number(d.duration),aspect_ratio:d.ratio,prompt};
  }
  async function checkAccount(v){
    if(v.busy)return;
    v.generate.disabled=true;v.quote=null;clearTimeout(v.timer);
    try{
      const owner=await window.neneAuthGetUserId?.();
      if(!owner){v.owner=null;say(v,'Sign in to review pricing and create a paid video.');return;}
      if(!alive(v))return;v.owner=owner;
      const state=await api(v,'/api/generation-availability');if(!alive(v))return;
      v.accepting=state.accepting_requests===true;v.audioSupported=state.generate_audio_supported===true&&(v.mode!=='talking'||state.talking_character_supported===true);say(v,v.accepting?'Choose your options, then review the price.':'Video creation is temporarily unavailable. Your work has not been submitted and no credits were charged.');
      v.pending=read(v,'pending',null);
      if(v.pending?.payload && v.pending?.key && v.pending?.draft){
        for(const name of fields)if(v.pending.draft[name]!==undefined){v.form.elements[name].value=v.pending.draft[name];const button=v.form.querySelector('[data-choice-for="'+name+'"]');if(button)button.textContent=displayValue(name,v.pending.draft[name]);}
        v.updateSpeechUI?.();lock(v,true);v.generate.textContent='Retry pending submission safely';v.generate.disabled=!v.accepting||!v.audioSupported;
        say(v,'A pending submission is saved on this device. Retry it with the same request key to avoid duplicate charges. '+(v.accepting?'':'Video creation is temporarily unavailable.'));
      }else{v.pending=null;lock(v,false);v.generate.textContent='Generate video';}
      renderJobs(v);if(v.mode==='talking')renderSpeechJobs(v);
    }catch(error){say(v,error.message);}
  }
  async function review(v){
    if(v.busy || v.pending)return;
    try{
      if(!await window.neneRequireAccount?.('Sign in to review your video.'))return;
      if(!v.owner)await checkAccount(v);
      v.busy=true;v.review.disabled=true;
      const recordingData=v.audioData;
      if(v.mode==='talking'&&v.form.elements.speechMode.value==='Upload voice recording'&&!v.audioAsset){
        if(!v.audioData)throw Error('Choose a voice recording first.');
        const data=await api(v,'/api/speech-assets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data_uri:v.audioData})});
        if(data.private!==true||!UUID.test(data.source_audio_id)||!Number.isInteger(data.billable_seconds)||data.billable_seconds<2||data.billable_seconds>10)throw Error('A private voice upload could not be confirmed.');
        if(recordingData!==v.audioData)throw Error('The recording changed. Review its price again.');
        v.audioAsset=data;
      }
      const d=draft(v),body=payload(v,d);v.busy=true;v.review.disabled=true;v.generate.disabled=true;
      const q=await api(v,'/api/pricing/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:body.provider,model:body.model,resolution:body.resolution,duration:body.duration})});
      const amount=Number(q.recommended_credits);
      if(!Number.isFinite(amount)||amount<=0)throw new Error('No valid paid price is available for this video.');
      if(!alive(v))return;
      if(JSON.stringify(d)!==JSON.stringify(draft(v)))throw Error('Your settings changed. Review the current price again.');
      v.quote={draft:JSON.stringify(d),body,cost:String(q.recommended_credits)};
      v.generate.textContent=`Generate video · ${q.recommended_credits} paid credits`;
      v.generate.disabled=!v.accepting||!v.audioSupported;
      say(v,`${q.recommended_credits} paid credits for this video.${body.type==='audio-to-video'?' Recording: '+v.audioAsset.duration_seconds+' seconds; priced for '+body.duration+' whole seconds.':''} Credits are reserved when you submit. ${v.accepting?'Review your brief, then choose Generate video.':'Paid generation is not enabled yet; nothing has been submitted.'}`);
    }catch(error){say(v,error.message);}finally{v.busy=false;if(alive(v)&&!v.pending)v.review.disabled=false;}
  }
  function rememberJob(v,id,title){
    if(!UUID.test(id))throw new Error('The server did not return a valid generation ID. Retry the saved submission safely.');
    const old=read(v,'jobs',[]);const jobs=Array.isArray(old)?old:[];
    write(v,'jobs',[{id,title},...jobs.filter(x=>x.id!==id)].slice(0,20));
  }
  async function submit(v){
    if(v.busy || !v.accepting || !v.audioSupported)return;
    if(!v.pending && (!v.quote || v.quote.draft!==JSON.stringify(draft(v)))){say(v,'Review the current price before generating.');return;}
    v.busy=true;v.generate.disabled=true;lock(v,true);
    let requestStarted=false;
    const hadPending=!!v.pending;
    try{
      if(!v.pending){
        v.pending={key:crypto.randomUUID(),uncertain:true,draft:draft(v),payload:{...v.quote.body,credit_limit:v.quote.cost,...(['image','talking'].includes(v.mode)&&v.sourceImageId?{source_image_id:v.sourceImageId}:{})}};
        // Persist before the request: uncertain responses can reuse the same key
        // after a page reload. Never persist tokens or signed video URLs.
      }
      if(['image','talking'].includes(v.mode)&&!v.pending.payload.source_image_id){
        const uploaded=await api(v,'/api/image-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data_uri:v.imageData})});
        if(uploaded.private!==true||!UUID.test(uploaded.source_image_id))throw new Error('A private image upload could not be confirmed. No video was submitted.');
        v.sourceImageId=uploaded.source_image_id;v.pending.payload.source_image_id=uploaded.source_image_id;
      }
      write(v,'pending',v.pending);
      requestStarted=true;
      say(v,'Submitting your paid video once…');
      const result=await api(v,'/api/generations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':v.pending.key},body:JSON.stringify(v.pending.payload)});
      if(!alive(v))return;
      rememberJob(v,result.generation_id,v.pending.draft.idea.slice(0,100));
      localStorage.removeItem(storageKey(v,'pending'));v.pending=null;v.quote=null;
      v.generate.textContent='Review price before creating another video';renderJobs(v);
      await poll(v,result.generation_id,0);
      try{await window.neneRefreshPaidWallet?.();}catch(_){}
    }catch(error){
      if(!requestStarted){
        v.pending=null;say(v,error.message+' No video was submitted. Review your settings before trying again.');return;
      }
      const definiteRejection=[400,401,402,403,422].includes(error.status)||(error.status===409 && /price increased/i.test(error.message));
      if(definiteRejection && (!hadPending || (error.status===409 && /price increased/i.test(error.message)))){
        localStorage.removeItem(storageKey(v,'pending'));v.pending=null;v.quote=null;
        v.generate.textContent='Review price before generating';
      }else {
        if(v.pending){v.pending.uncertain=true;try{write(v,'pending',v.pending);}catch(_) {}}
        v.generate.textContent='Retry pending submission safely';
      }
      say(v,error.message+(v.pending?' Your submission is saved. Retry this same request safely.':''));
    }finally{
      v.busy=false;if(alive(v)){lock(v,!!v.pending);v.generate.disabled=!(v.pending&&v.accepting&&v.audioSupported);}
    }
  }
  function renderJobs(v){
    v.jobs.replaceChildren();const jobs=read(v,'jobs',[]);
    if(!Array.isArray(jobs))return;
    for(const job of jobs){if(!UUID.test(job.id))continue;const button=el('button',job.title||'Saved video','btn');button.type='button';button.onclick=()=>poll(v,job.id,0);v.jobs.append(button);}
  }
  async function media(v,id){
    const data=await api(v,`/api/generations/${id}/media-url`);if(!alive(v)||v.selected!==id)return;
    const url=new URL(data.url);if(url.protocol!=='https:')throw new Error('A secure video link is not available.');
    v.output.replaceChildren();const video=el('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.style.width='100%';video.src=url.href;
    const download=el('a','Open / download video','btn');download.href=url.href;download.target='_blank';download.rel='noopener noreferrer';download.style.display='block';
    v.output.append(video,download);
  }
  async function poll(v,id,attempt){
    if(!alive(v)||!UUID.test(id))return;clearTimeout(v.timer);v.selected=id;v.refresh.disabled=false;
    try{
      const data=await api(v,`/api/generations/${id}`);if(!alive(v)||v.selected!==id)return;
      const job=data.generation||{};v.output.replaceChildren();
      if(job.status==='succeeded'){
        say(v,'Your video is ready. The private viewing link expires; refresh it here when needed.');await media(v,id);
        try{await window.neneRefreshPaidWallet?.();}catch(_){}return;
      }
      if(job.status==='failed'){
        say(v,'Video generation failed. Check your wallet for restored credits. Creating another video is a separate paid request.');
        try{await window.neneRefreshPaidWallet?.();}catch(_){}return;
      }
      say(v,`Video status: ${String(job.status||'pending')}. Keep this saved job; do not submit another copy.`);
      if(attempt<120)v.timer=setTimeout(()=>poll(v,id,attempt+1),7000);
    }catch(error){say(v,error.message+' Your job remains saved. Use Refresh saved video status.');}
  }
  function choose(v,title,select,trigger){
    const overlay=el('div',undefined,'video-choice-overlay'),panel=el('section',undefined,'video-choice-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);
    const heading=el('h2',title),group=el('div');group.setAttribute('role','radiogroup');group.setAttribute('aria-label',title);panel.append(heading,group);const buttons=[];
    const close=()=>{overlay.remove();if(trigger.isConnected)trigger.focus();};
    for(const option of select.options){const button=el('button',displayValue(select.name,option.value),'video-choice-option');button.type='button';button.setAttribute('role','radio');button.setAttribute('aria-checked',String(option.value===select.value));button.onclick=()=>{if(!alive(v)||select.disabled){close();return;}select.value=option.value;trigger.textContent=displayValue(select.name,option.value);trigger.setAttribute('aria-label',title+': '+option.value);select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));close();};group.append(button);buttons.push(button);}
    const cancel=el('button','Cancel','btn');cancel.type='button';cancel.onclick=close;panel.append(cancel);overlay.append(panel);document.body.append(overlay);overlay.onclick=e=>{if(e.target===overlay)close();};
    overlay.onkeydown=e=>{const list=[...buttons,cancel],index=list.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){e.preventDefault();list[(index+(e.shiftKey?-1:1)+list.length)%list.length].focus();}else if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const current=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(current+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1)+buttons.length)%buttons.length].focus();}};
    buttons[[...select.options].findIndex(o=>o.value===select.value)]?.focus();
  }
  function speechDraft(v){return {text:v.form.elements.dialogue.value.trim(),voice:v.form.elements.ttsVoice.value};}
  function speechSay(v,text){if(alive(v))v.voiceMessage.textContent=text;}
  function renderSpeechJobs(v){
    v.voiceJobs.replaceChildren();const jobs=read(v,'speech_jobs',[]);
    for(const job of Array.isArray(jobs)?jobs:[]){if(!UUID.test(job.id))continue;const b=el('button',job.text||'Saved voice track','btn');b.type='button';b.onclick=()=>pollSpeech(v,job,0);v.voiceJobs.append(b);}
    const pending=read(v,'speech_pending',null);
    if(pending?.key&&pending?.body){v.speechPending=pending;v.voiceGenerate.textContent='Review availability to retry saved voice';v.voiceGenerate.disabled=true;speechSay(v,'A voice submission is pending. Review availability, then retry the same request safely.');}
  }
  async function reviewSpeech(v){
    if(v.busy)return;
    try{
      if(!await window.neneRequireAccount?.('Sign in to create a voice track.'))return;
      if(!v.owner)await checkAccount(v);
      const pending=read(v,'speech_pending',null),d=pending?.body||speechDraft(v);
      if(!d.text||!d.voice)throw Error('Write your script and choose an AI voice preset first.');
      v.busy=true;v.voiceReview.disabled=true;v.voiceGenerate.disabled=true;
      const availability=await api(v,'/api/speech/availability');v.speechAccepting=availability.accepting_requests===true;
      const q=await api(v,'/api/speech/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:d.text,voice:d.voice})});
      if(!Number.isFinite(Number(q.recommended_credits))||Number(q.recommended_credits)<=0)throw Error('A valid speech price is unavailable.');
      if(!alive(v))return;
      if(!pending&&JSON.stringify(d)!==JSON.stringify(speechDraft(v)))throw Error('The script or voice changed. Review the voice price again.');
      v.speechQuote={draft:JSON.stringify(speechDraft(v)),cost:String(q.recommended_credits)};v.speechPending=pending;
      v.voiceGenerate.textContent=pending?'Retry saved voice submission safely':`Generate voice · ${q.recommended_credits} paid credits`;
      v.voiceGenerate.disabled=!v.speechAccepting;
      speechSay(v,`${pending?pending.body.credit_limit:q.recommended_credits} paid credits for the voice track only. Video creation is priced after you approve the speech.${v.speechAccepting?'':' Voice generation is not enabled yet; nothing has been submitted.'}`);
    }catch(e){speechSay(v,e.message);}finally{v.busy=false;if(alive(v))v.voiceReview.disabled=false;}
  }
  async function submitSpeech(v){
    if(v.busy||!v.speechAccepting)return;
    const pending=read(v,'speech_pending',null);
    if(!pending&&(!v.speechQuote||v.speechQuote.draft!==JSON.stringify(speechDraft(v)))){speechSay(v,'Review the current voice price first.');return;}
    v.busy=true;v.voiceGenerate.disabled=true;lock(v,true);let started=false;
    try{
      const request=pending||{key:crypto.randomUUID(),body:{...speechDraft(v),credit_limit:v.speechQuote.cost}};
      write(v,'speech_pending',request);v.speechPending=request;started=true;
      const result=await api(v,'/api/speech/generations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':request.key},body:JSON.stringify(request.body)});
      if(!UUID.test(result.generation_id))throw Error('The voice job could not be confirmed. Retry this saved request.');
      const job={id:result.generation_id,text:request.body.text,voice:request.body.voice};
      const old=read(v,'speech_jobs',[]);write(v,'speech_jobs',[job,...(Array.isArray(old)?old:[]).filter(j=>j.id!==job.id)].slice(0,20));
      localStorage.removeItem(storageKey(v,'speech_pending'));v.speechPending=null;v.speechQuote=null;renderSpeechJobs(v);await pollSpeech(v,job,0);
    }catch(e){if(e.status===409&&/price increased/i.test(e.message)){localStorage.removeItem(storageKey(v,'speech_pending'));v.speechPending=null;v.speechQuote=null;started=false;}speechSay(v,e.message+(started?' The voice request is saved. Review availability and retry the same request safely.':''));}
    finally{v.busy=false;if(alive(v)){lock(v,!!v.pending);v.voiceGenerate.disabled=true;v.voiceGenerate.textContent='Review voice price / pending request';}}
  }
  async function pollSpeech(v,job,attempt){
    if(!alive(v))return;clearTimeout(v.speechTimer);v.speechSelected=job.id;v.approvedSpeech=null;v.audioAsset=null;v.quote=null;v.generate.disabled=true;
    try{
      const result=await api(v,`/api/speech/generations/${job.id}`);if(!alive(v)||v.speechSelected!==job.id)return;
      if(result.status==='succeeded'){
        const data=result.audio;if(data?.private!==true||!UUID.test(data.source_audio_id))throw Error('A private voice track could not be confirmed.');
        const url=new URL(data.url);if(url.protocol!=='https:')throw Error('A secure voice preview is unavailable.');
        v.voiceOutput.replaceChildren();const preview=el('audio');preview.controls=true;preview.src=url.href;preview.style.width='100%';v.voiceOutput.append(el('p',job.text),preview);
        const approve=el('button','Use this voice and script for video','btn gold');approve.type='button';approve.id='voice-approve';approve.disabled=data.can_animate!==true;
        approve.onclick=()=>{if(!alive(v)||v.speechSelected!==job.id)return;v.form.elements.dialogue.value=job.text;v.form.elements.ttsVoice.value=job.voice;v.form.querySelector('[data-choice-for="ttsVoice"]').textContent=job.voice;v.audioAsset=data;v.approvedSpeech={script:job.text,voice:job.voice,id:data.source_audio_id};v.quote=null;v.generate.disabled=true;speechSay(v,'Voice approved. Review the video price below; the saved voice will be used without another voice-generation charge.');};v.voiceOutput.append(approve);
        speechSay(v,data.can_animate?`Voice ready · ${data.duration_seconds} seconds. Listen, approve it, then review the video price.`:'Voice ready. This track is outside the 2–10 second video limit. Shorten or split the script before creating another paid voice track.');
        try{await window.neneRefreshPaidWallet?.();}catch(_){}return;
      }
      if(result.status==='failed'){speechSay(v,'Voice creation failed. Check your wallet for released credits. A new voice is a separate paid request.');return;}
      speechSay(v,'Voice status: '+result.status+'. This saved job is being checked; no replacement is submitted.');
      if(attempt<120)v.speechTimer=setTimeout(()=>pollSpeech(v,job,attempt+1),5000);
    }catch(e){speechSay(v,e.message+' Use Saved voice tracks to check the same job again.');}
  }
  window.neneOpenVideoStudio=async function(mode='text'){
    if(!['text','image','talking'].includes(mode))return;
    if(active?.busy){toast('Please wait for the current video request.');return;}
    if(active){clearTimeout(active.timer);clearTimeout(active.speechTimer);}
    const root=el('main'),v={root,mode,owner:null,quote:null,pending:null,accepting:false,busy:false,imageData:null,sourceImageId:null};active=v;
    setNav('create');const back=el('button','‹','back');back.type='button';back.setAttribute('aria-label','Back to Home');back.onclick=()=>{clearTimeout(v.timer);clearTimeout(v.speechTimer);active=null;renderHome();};
    const heading=el('div',undefined,'toolhead');heading.append(back,el('h1',mode==='talking'?'Talking Character':mode==='image'?'Image → Video':'Text → Video'));root.append(heading,
      el('p',mode==='talking'?'Give your character dialogue or a voice recording.':mode==='image'?'Bring your image to life with a clear motion brief.':'Describe your scene. Choose your look. Create your video.','subtitle'));
    v.form=el('form');v.form.onsubmit=e=>e.preventDefault();
    if(['image','talking'].includes(mode)){
      const label=el('label','Source image','label');v.file=el('input');v.file.type='file';v.file.accept='image/png,image/jpeg,image/webp';v.file.id='video-source';label.htmlFor=v.file.id;
      const hint=el('p','PNG, JPEG or WebP · up to 7 MB. Uploaded privately when you submit.','subtitle');const preview=el('img');preview.alt='Your source image';preview.style.cssText='display:none;max-height:200px;max-width:100%;border-radius:14px';
      v.file.onchange=async()=>{v.imageRevision=crypto.randomUUID();v.imageData=null;v.sourceImageId=null;v.quote=null;v.generate.disabled=true;preview.style.display='none';const file=v.file.files?.[0];if(!file)return;
        try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>7*1024*1024)throw Error('Choose a PNG, JPEG or WebP up to 7 MB.');
          const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The image could not be read.'));reader.readAsDataURL(file);});
          await new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(Error('Choose an image your browser can open.'));image.src=data;});
          if(!alive(v)||v.file.files?.[0]!==file)return;v.imageData=data;preview.src=data;preview.style.display='block';say(v,'Image ready. Review the price when your motion brief is complete.');
        }catch(error){say(v,error.message);}
      };v.form.append(label,v.file,hint,preview);v.preview=preview;
    }
    const dialogue=el('textarea');dialogue.name='dialogue';dialogue.id='talking-dialogue';dialogue.maxLength=120;
    const speechMode=el('select');speechMode.name='speechMode';speechMode.hidden=true;
    for(const value of ['Write dialogue','Upload voice recording']){const option=el('option',value);option.value=value;speechMode.append(option);}
    if(mode==='talking'){
      const label=el('label','What should your character say?','label');label.htmlFor=dialogue.id;dialogue.placeholder='Write a short line, or add a transcript for your recording…';
      const choice=el('button','Write dialogue','video-choice');choice.type='button';choice.dataset.choiceFor='speechMode';choice.setAttribute('aria-label','Speech input');choice.onclick=()=>choose(v,'Speech input',speechMode,choice);
      const hint=el('p','Your script becomes a separate AI-generated voice track. Listen and approve the speech before animating your character. Voice creation and video generation have separate paid credit reviews.','notice');
      v.audioFile=el('input');v.audioFile.id='talking-recording';v.audioFile.type='file';v.audioFile.accept='audio/wav,audio/mpeg,audio/mp4,audio/ogg,.m4a';
      const recordingLabel=el('label','Voice recording · WAV, MP3, M4A or OGG · 2–10 seconds · up to 8 MB','label');recordingLabel.htmlFor=v.audioFile.id;
      v.audioFile.onchange=async()=>{v.audioAsset=null;v.audioData=null;v.quote=null;v.generate.disabled=true;const file=v.audioFile.files?.[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('Choose audio up to 8 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The recording could not be read.'));reader.readAsDataURL(file);});if(!alive(v)||v.audioFile.files?.[0]!==file)return;v.audioData=String(data).replace(/^data:[^;]*/, 'data:audio/wav');say(v,'Recording ready. Review price to validate its length and upload it privately.');}catch(e){say(v,e.message);}};
      v.form.append(choice,label,dialogue,speechMode,hint,recordingLabel,v.audioFile);v.recordingLabel=recordingLabel;
    }else{dialogue.hidden=true;v.form.append(dialogue,speechMode);}
    const ttsVoice=el('select');ttsVoice.name='ttsVoice';ttsVoice.hidden=true;
    for(const value of ['', 'Anne Hathaway','Morgan Freeman','David Attenborough']){const option=el('option',value||'Choose an AI voice preset');option.value=value;ttsVoice.append(option);}
    v.form.append(ttsVoice);
    if(mode==='talking'){
      v.speechBox=el('section');v.speechBox.className='block';
      const voiceChoice=el('button','Choose an AI voice preset','video-choice');voiceChoice.type='button';voiceChoice.dataset.choiceFor='ttsVoice';voiceChoice.setAttribute('aria-label','AI voice preset');voiceChoice.onclick=()=>choose(v,'AI voice preset',ttsVoice,voiceChoice);
      v.voiceReview=el('button','Review voice price','btn');v.voiceReview.type='button';v.voiceReview.id='voice-review';v.voiceReview.onclick=()=>reviewSpeech(v);
      v.voiceGenerate=el('button','Generate voice track','btn gold');v.voiceGenerate.type='button';v.voiceGenerate.id='voice-generate';v.voiceGenerate.disabled=true;v.voiceGenerate.onclick=()=>submitSpeech(v);
      v.voiceMessage=el('p','AI voice presets are synthetic voices. Voice creation is paid separately from animation.','notice');v.voiceMessage.id='voice-message';v.voiceMessage.setAttribute('role','status');
      v.voiceOutput=el('div');v.voiceOutput.id='voice-output';v.voiceJobs=el('div');v.voiceJobs.id='voice-jobs';
      v.speechBox.append(voiceChoice,v.voiceMessage,v.voiceReview,v.voiceGenerate,v.voiceOutput,el('h3','Saved voice tracks'),v.voiceJobs);v.form.append(v.speechBox);
      for(const input of [dialogue,ttsVoice]){input.addEventListener('input',()=>{v.speechQuote=null;v.approvedSpeech=null;v.audioAsset=null;v.voiceGenerate.disabled=true;v.voiceGenerate.textContent='Review voice price before generating';});}
    }
    const block=el('div',undefined,'block'),label=el('label',mode==='image'?'Describe the motion':'Your prompt','label'),input=el('textarea');input.id='prompt';input.name='idea';input.maxLength=10000;input.placeholder=mode==='image'?'What should move? Describe the action and camera direction…':'Describe the subject, action, setting and mood…';label.htmlFor=input.id;block.append(label,input);
    if(mode==='text'){const assist=el('button','✨ Enhance my prompt','btn');assist.type='button';assist.onclick=()=>window.enhanceNenePrompt?.();block.append(assist,el('small','Preview and edit your prompt before applying changes.','subtitle'));}v.form.append(block);
    const idFor={style:'neneStyle',shot:'neneShot',camera:'neneCamera',lighting:'neneLighting',motion:'neneMotion',duration:'neneDuration',resolution:'neneResolution',ratio:'neneAspectRatio',audio:'neneAudio'};
    const group=el('div',undefined,'video-options');
    for(const [name,label,options] of [['style','Visual style',['Cinematic','Photorealistic','Animated','3D','Documentary']],['shot','Framing',['Medium shot','Close-up','Wide establishing shot','Tracking shot']],['camera','Camera',['Smooth cinematic camera','Static locked camera','Slow dolly-in','Gentle tracking shot','Slow orbit']],['lighting','Lighting',['Natural cinematic lighting','Golden-hour lighting','Soft diffused lighting','Dramatic high-contrast lighting']],['motion','Motion',['Natural, realistic movement','Slow, elegant movement','Subtle movement with stable framing','Energetic dynamic movement']],['duration','Duration',['6','8','10']],['resolution','Resolution',['720p','1080p']],['ratio','Format',['16:9','9:16','1:1']],['audio','Sound',['AI scene sound','Silent']]]){
      const block=el('div',undefined,'block'),caption=el('label',label,'label'),select=el('select');select.name=name;select.id=idFor[name];select.hidden=true;select.setAttribute('aria-hidden','true');select.tabIndex=-1;caption.htmlFor='choice-'+name;
      for(const value of options){const option=el('option',value);option.value=value;select.append(option);}
      const button=el('button',displayValue(name,options[0]),'video-choice');button.id='choice-'+name;button.type='button';button.dataset.choiceFor=name;button.setAttribute('aria-label',label+': '+options[0]);button.setAttribute('aria-haspopup','dialog');button.onclick=()=>choose(v,label,select,button);select.addEventListener('change',()=>{button.textContent=displayValue(name,select.value);button.setAttribute('aria-label',label+': '+select.value);select.dispatchEvent(new Event('input',{bubbles:true}));});block.append(caption,select,button);group.append(block);
    }v.form.append(group);
    const soundBlock=el('div',undefined,'block'),soundLabel=el('label','Sound description (optional)','label'),sound=el('input');sound.name='sound';sound.id='video-sound';sound.className='field';sound.maxLength=500;sound.placeholder='e.g. birdsong, flowing water, soft wind';soundLabel.htmlFor=sound.id;soundBlock.append(soundLabel,sound,el('small','AI sound follows the scene and your description. Specific dialogue, music or voices are not guaranteed.','subtitle'));v.form.append(soundBlock);v.form.elements.audio.addEventListener('change',()=>{sound.disabled=v.form.elements.audio.value==='Silent';});
    if(mode==='talking'){
      v.form.elements.audio.value='AI scene sound';v.form.elements.audio.closest('.block').hidden=true;
      v.updateSpeechUI=()=>{const recorded=speechMode.value==='Upload voice recording';v.audioFile.hidden=!recorded;v.recordingLabel.hidden=!recorded;v.form.elements.duration.closest('.block').hidden=true;v.form.elements.sound.closest('.block').hidden=true;v.speechBox.hidden=recorded;};
      speechMode.addEventListener('change',()=>{v.audioAsset=null;v.approvedSpeech=null;v.quote=null;v.generate.disabled=true;v.updateSpeechUI();});v.updateSpeechUI();
    }
    v.form.addEventListener('input',()=>{if(!v.pending){v.quote=null;v.generate.disabled=true;v.generate.textContent='Review price before generating';}});
    v.message=el('p','Checking paid generation availability…','notice');v.message.id='video-message';v.message.setAttribute('role','status');v.message.setAttribute('aria-live','polite');
    v.review=el('button','Review price','btn');v.review.type='button';v.review.id='video-review';v.review.onclick=()=>review(v);
    v.generate=el('button','Generate video','btn gold');v.generate.type='button';v.generate.id='video-generate';v.generate.disabled=true;v.generate.onclick=()=>submit(v);
    const signin=el('button','Sign in / account','btn');signin.onclick=()=>window.neneOpenAuth?.();
    const check=el('button','Check account and availability','btn');check.onclick=()=>checkAccount(v);
    v.refresh=el('button','Refresh saved video status / link','btn');v.refresh.disabled=true;v.refresh.onclick=()=>v.selected&&poll(v,v.selected,0);
    v.output=el('div');v.output.id='video-output';v.jobs=el('div',undefined,'list');v.jobs.id='video-jobs';
    root.append(v.form,el('p','Review your credit price before generating. AI scene sound is generated with the video when selected. Captions, separate music tracks and voice cloning are not included. Watermark-free export is not guaranteed; exact text, logos and visual consistency may need editing.','notice'),v.message,v.review,v.generate,signin,check,v.refresh,v.output,el('h2','Your saved videos'),v.jobs,
      el('p','Pending submissions and job IDs are saved on this device for this account. Finished videos are retrieved through your private account.','subtitle'));
    document.getElementById('screen').replaceChildren(root);await checkAccount(v);
  };
  const oldFeature=window.openFeature;
  window.openFeature=function(type,...args){return type==='voice'?window.neneOpenVideoStudio('talking'):oldFeature.call(this,type,...args);};
  window.addEventListener('nene-auth-changed',()=>{
    const v=active;if(!v||!alive(v))return;
    document.querySelectorAll('.video-choice-overlay').forEach(e=>e.remove());clearTimeout(v.timer);v.owner=null;v.quote=null;v.pending=null;v.accepting=false;v.selected=null;v.output.replaceChildren();v.jobs.replaceChildren();v.form.reset();v.updateSpeechUI?.();v.imageData=null;v.sourceImageId=null;v.audioData=null;v.audioAsset=null;v.approvedSpeech=null;v.speechQuote=null;v.speechSelected=null;clearTimeout(v.speechTimer);if(v.voiceOutput)v.voiceOutput.replaceChildren();if(v.voiceJobs)v.voiceJobs.replaceChildren();if(v.voiceGenerate)v.voiceGenerate.disabled=true;if(v.audioFile)v.audioFile.value='';if(v.preview){v.preview.removeAttribute('src');v.preview.style.display='none';}for(const button of v.form.querySelectorAll('[data-choice-for]'))button.textContent=displayValue(button.dataset.choiceFor,v.form.elements[button.dataset.choiceFor].value);lock(v,false);v.generate.disabled=true;
    say(v,'Account changed. Check your account and availability before continuing.');
  });
})();



