/* Paid advertisement video workflow: no prototype grants or legacy submission. */
(() => {
  'use strict';
  let active = null;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const fields = ['product','audience','benefit','offer','cta','style','duration','resolution','ratio'];
  const el = (tag,text,cls) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  function say(v,text){if(active===v && v.root.isConnected)v.message.textContent=text;}
  function storageKey(v,suffix){return `nene_ad_${suffix}_v1:${v.owner}`;}
  function read(v,suffix,fallback){try{return JSON.parse(localStorage.getItem(storageKey(v,suffix))||'null')||fallback;}catch(_){return fallback;}}
  function write(v,suffix,value){localStorage.setItem(storageKey(v,suffix),JSON.stringify(value));}
  function lock(v,locked){for(const name of fields)v.form.elements[name].disabled=locked;v.review.disabled=locked;}
  function alive(v){return active===v && v.root.isConnected;}
  async function api(v,path,options={}){
    const owner=await window.neneAuthGetUserId?.();
    const token=await window.neneAuthGetAccessToken?.();
    if(!owner || !token || owner!==v.owner)throw new Error('Sign in to the same account, then check your account again.');
    const base=new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl||'');
    if(base.protocol!=='https:')throw new Error('The secure video service is not configured.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(base.href.replace(/\/$/,'')+path,{...options,cache:'no-store',signal:controller.signal,
        headers:{Authorization:'Bearer '+token,...options.headers}});
      const data=await response.json().catch(()=>({}));
      if(await window.neneAuthGetUserId?.()!==owner || v.owner!==owner)throw new Error('The account changed. Reopen AI Advertisement.');
      if(!response.ok){const e=new Error(typeof data.detail==='string'?data.detail:'The video service could not complete this request.');e.status=response.status;throw e;}
      return data;
    }catch(error){if(error.name==='AbortError')throw new Error('The request timed out. Retry the same pending submission safely; do not create another copy.');throw error;}
    finally{clearTimeout(timer);}
  }
  function draft(v){const data={};for(const name of fields)data[name]=v.form.elements[name].value.trim();return data;}
  function payload(d){
    if(!d.product || !d.audience || !d.benefit || !d.cta)throw new Error('Enter the product, audience, benefit and call to action.');
    return {type:'text-to-video',provider:'ltx',model:'ltx-2-5-fast',resolution:d.resolution,duration:Number(d.duration),aspect_ratio:d.ratio,
      prompt:[`Create a ${d.duration}-second ${d.style} advertisement video.`,
        `Product or business: ${d.product}. Audience: ${d.audience}.`,
        `Supplied benefit: ${d.benefit}. Offer: ${d.offer||'No special offer supplied'}.`,
        `Call to action: ${d.cta}.`,
        'Open with a clear visual hook, show the product or service benefit, then finish with a clear product focus and space for the call to action.',
        'Use only the supplied facts. Do not invent statistics, medical claims, endorsements or testimonials. Keep subjects and product appearance consistent.'].join('\n')};
  }
  async function checkAccount(v){
    if(v.busy)return;
    v.generate.disabled=true;v.quote=null;clearTimeout(v.timer);
    try{
      const owner=await window.neneAuthGetUserId?.();
      if(!owner){v.owner=null;say(v,'Sign in to review pricing and create a paid advertisement.');return;}
      if(!alive(v))return;v.owner=owner;
      const state=await api(v,'/api/generation-availability');if(!alive(v))return;
      v.accepting=state.accepting_requests===true;say(v,state.message||'Check the current generation price before continuing.');
      v.pending=read(v,'pending',null);
      if(v.pending?.payload && v.pending?.key && v.pending?.draft){
        for(const name of fields)if(v.pending.draft[name]!==undefined)v.form.elements[name].value=v.pending.draft[name];
        lock(v,true);v.generate.textContent='Retry pending submission safely';v.generate.disabled=!v.accepting;
        say(v,'A pending submission is saved on this device. Retry it with the same request key to avoid duplicate charges. '+(v.accepting?'':state.message));
      }else{v.pending=null;lock(v,false);v.generate.textContent='Generate advertisement';}
      renderJobs(v);
    }catch(error){say(v,error.message);}
  }
  async function review(v){
    if(v.busy || v.pending)return;
    try{
      if(!await window.neneRequireAccount?.('Sign in to review your advertisement.'))return;
      if(!v.owner)await checkAccount(v);
      const d=draft(v),body=payload(d);v.busy=true;v.review.disabled=true;v.generate.disabled=true;
      const q=await api(v,'/api/pricing/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:body.provider,model:body.model,resolution:body.resolution,duration:body.duration})});
      const amount=Number(q.recommended_credits);
      if(!Number.isFinite(amount)||amount<=0)throw new Error('No valid paid price is available for this advertisement.');
      if(!alive(v))return;
      v.quote={draft:JSON.stringify(d),body,cost:String(q.recommended_credits)};
      v.generate.textContent=`Generate advertisement · ${q.recommended_credits} paid credits`;
      v.generate.disabled=!v.accepting;
      say(v,`${q.recommended_credits} paid credits for this video. Credits are reserved when you submit. ${v.accepting?'Review your brief, then choose Generate advertisement.':'Paid generation is not enabled yet; nothing has been submitted.'}`);
    }catch(error){say(v,error.message);}finally{v.busy=false;if(alive(v)&&!v.pending)v.review.disabled=false;}
  }
  function rememberJob(v,id,title){
    if(!UUID.test(id))throw new Error('The server did not return a valid generation ID. Retry the saved submission safely.');
    const old=read(v,'jobs',[]);const jobs=Array.isArray(old)?old:[];
    write(v,'jobs',[{id,title},...jobs.filter(x=>x.id!==id)].slice(0,20));
  }
  async function submit(v){
    if(v.busy || !v.accepting)return;
    if(!v.pending && (!v.quote || v.quote.draft!==JSON.stringify(draft(v)))){say(v,'Review the current price before generating.');return;}
    v.busy=true;v.generate.disabled=true;lock(v,true);
    let requestStarted=false;
    const hadPending=!!v.pending;
    try{
      if(!v.pending){
        v.pending={key:crypto.randomUUID(),uncertain:true,draft:draft(v),payload:{...v.quote.body,credit_limit:v.quote.cost}};
        // Persist before the request: uncertain responses can reuse the same key
        // after a page reload. Never persist tokens or signed video URLs.
      }
      write(v,'pending',v.pending);
      requestStarted=true;
      say(v,'Submitting your paid advertisement once…');
      const result=await api(v,'/api/generations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':v.pending.key},body:JSON.stringify(v.pending.payload)});
      if(!alive(v))return;
      rememberJob(v,result.generation_id,v.pending.draft.product);
      localStorage.removeItem(storageKey(v,'pending'));v.pending=null;v.quote=null;
      v.generate.textContent='Review price before creating another ad';renderJobs(v);
      await poll(v,result.generation_id,0);
      try{await window.neneRefreshPaidWallet?.();}catch(_){}
    }catch(error){
      if(!requestStarted){
        v.pending=null;say(v,'Could not save a safe pending request on this device. No generation was submitted.');return;
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
      v.busy=false;if(alive(v)){lock(v,!!v.pending);v.generate.disabled=!(v.pending&&v.accepting);}
    }
  }
  function renderJobs(v){
    v.jobs.replaceChildren();const jobs=read(v,'jobs',[]);
    if(!Array.isArray(jobs))return;
    for(const job of jobs){if(!UUID.test(job.id))continue;const button=el('button',job.title||'Saved advertisement','btn');button.type='button';button.onclick=()=>poll(v,job.id,0);v.jobs.append(button);}
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
        say(v,'Your advertisement video is ready. The private viewing link expires; refresh it here when needed.');await media(v,id);
        try{await window.neneRefreshPaidWallet?.();}catch(_){}return;
      }
      if(job.status==='failed'){
        say(v,'Advertisement generation failed. Check your wallet for restored credits. Creating another ad is a separate paid request.');
        try{await window.neneRefreshPaidWallet?.();}catch(_){}return;
      }
      say(v,`Advertisement status: ${String(job.status||'pending')}. Keep this saved job; do not submit another copy.`);
      if(attempt<120)v.timer=setTimeout(()=>poll(v,id,attempt+1),7000);
    }catch(error){say(v,error.message+' Your job remains saved. Use Refresh saved video status.');}
  }
  window.neneOpenAdvertisement=async function(){
    if(active?.busy){toast('Please wait for the current advertisement request.');return;}
    if(active)clearTimeout(active.timer);
    const root=el('main'),v={root,owner:null,quote:null,pending:null,accepting:false,busy:false};active=v;
    setNav('create');const back=el('button','‹','back');back.onclick=()=>{clearTimeout(v.timer);active=null;renderHome();};
    const heading=el('div',undefined,'toolhead');heading.append(back,el('h1','AI Advertisement'));root.append(heading,
      el('p','Create a short product or business video from your brief.','subtitle'),
      el('p','Paid credits are required. Exact logos, written text, voiceovers and captions may need editing after generation.','notice'));
    v.form=el('form');v.form.onsubmit=e=>e.preventDefault();
    for(const [name,label,max] of [['product','Product or business',160],['audience','Target audience',300],['benefit','Product benefit and visual brief',2000],['offer','Offer (optional)',500],['cta','Call to action',300]]){
      const block=el('div',undefined,'block'),caption=el('label',label,'label');const input=el(name==='benefit'?'textarea':'input');input.id='ad-'+name;input.name=name;input.maxLength=max;input.className='field';caption.htmlFor=input.id;block.append(caption,input);v.form.append(block);
    }
    for(const [name,label,options] of [['style','Visual style',['Cinematic','Product showcase','Luxury','Minimalist']],['duration','Video duration',['6','8','10']],['resolution','Resolution',['720p','1080p']],['ratio','Aspect ratio',['16:9','9:16','1:1']]]){
      const block=el('div',undefined,'block'),caption=el('label',label,'label'),select=el('select');select.name=name;select.id='ad-'+name;caption.htmlFor=select.id;
      for(const value of options){const option=el('option',value);option.value=value;select.append(option);}block.append(caption,select);v.form.append(block);
    }
    v.form.addEventListener('input',()=>{if(!v.pending){v.quote=null;v.generate.disabled=true;v.generate.textContent='Review price before generating';}});
    v.message=el('p','Checking paid generation availability…','notice');v.message.id='ad-message';v.message.setAttribute('role','status');v.message.setAttribute('aria-live','polite');
    v.review=el('button','Review price','btn');v.review.type='button';v.review.id='ad-review';v.review.onclick=()=>review(v);
    v.generate=el('button','Generate advertisement','btn gold');v.generate.type='button';v.generate.id='ad-generate';v.generate.disabled=true;v.generate.onclick=()=>submit(v);
    const signin=el('button','Sign in / account','btn');signin.onclick=()=>window.neneOpenAuth?.();
    const check=el('button','Check account and availability','btn');check.onclick=()=>checkAccount(v);
    v.refresh=el('button','Refresh saved video status / link','btn');v.refresh.disabled=true;v.refresh.onclick=()=>v.selected&&poll(v,v.selected,0);
    v.output=el('div');v.output.id='ad-output';v.jobs=el('div',undefined,'list');v.jobs.id='ad-jobs';
    root.append(v.form,v.message,v.review,v.generate,signin,check,v.refresh,v.output,el('h2','Saved advertisements'),v.jobs,
      el('p','Pending submissions and job IDs are saved on this device for this account. Finished videos are retrieved through your private account.','subtitle'));
    document.getElementById('screen').replaceChildren(root);await checkAccount(v);
  };
  window.addEventListener('nene-auth-changed',()=>{
    const v=active;if(!v||!alive(v))return;
    clearTimeout(v.timer);v.owner=null;v.quote=null;v.pending=null;v.accepting=false;v.selected=null;v.output.replaceChildren();v.jobs.replaceChildren();v.form.reset();lock(v,false);v.generate.disabled=true;
    say(v,'Account changed. Check your account and availability before continuing.');
  });
})();
