/* Owner-scoped Story jobs. Replays use the original paid request and key. */
(() => {
  'use strict';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  let busy=false;
  function key(owner){return 'nene_durable_story_v1:'+owner;}
  function save(state){localStorage.setItem(key(state.owner),JSON.stringify(state,(k,v)=>k==='reference'?undefined:v));}
  async function api(owner,path,options={}){
    const token=await window.neneAuthGetAccessToken?.();
    if(!token||owner!==await window.neneAuthGetUserId?.())throw Error('Sign in to the same account to continue this story.');
    let subject;try{subject=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;}catch(_){}
    if(subject!==owner)throw Error('Check your account before continuing.');
    const base=new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl||'');
    if(base.protocol!=='https:')throw Error('Story creation is temporarily unavailable.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(base.href.replace(/\/$/,'')+path,{...options,cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token,...options.headers}});
      const data=await response.json().catch(()=>({}));
      if(owner!==await window.neneAuthGetUserId?.())throw Error('Account changed. Reopen Story Studio.');
      if(!response.ok){const raw=typeof data.detail==='string'?data.detail:'';throw Error(/provider|database|worker|durable|LTX|configuration/i.test(raw)?'Story creation is temporarily unavailable.':raw||'Story request failed. Try continuing the saved story.');}
      return data;
    }catch(e){if(e.name==='AbortError')throw Error('The request timed out. Continue the saved story to check the same submission safely.');throw e;}
    finally{clearTimeout(timer);}
  }
  const send=(owner,path,body,method='POST',idempotency)=>api(owner,path,{method,headers:{'Content-Type':'application/json',...(idempotency?{'Idempotency-Key':idempotency}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  function message(text){let box=document.getElementById('neneStoryProgress');if(!box){box=node('div');box.id='neneStoryProgress';box.className='notice';box.setAttribute('role','status');document.querySelector('main')?.append(box);}box.textContent=text;}
  function prepare(plan){
    const duration=Number(document.getElementById('neneDuration')?.value),resolution=document.getElementById('neneResolution')?.value;
    if(![6,8,10].includes(duration)||!['720p','1080p'].includes(resolution))throw Error('Choose a supported scene length and quality.');
    return plan.scenes.map((scene,i)=>{
      const chars=scene.characters||[];
      const sound=String(scene.sound_direction||'').trim();
      if(sound.length>500)throw Error('Limit each sound direction to 500 characters.');
      const prompt=[`Scene ${i+1} of ${plan.scenes.length}: ${scene.title}. ${scene.brief}`,
        'Overall story: '+plan.storyPrompt,plan.characterDirection||'',
        'Visual style: '+(plan.genre||'Cinematic'),
        ...chars.map(c=>`Character guidance: ${c.name}. Appearance: ${c.appearance||''}. Wardrobe: ${c.wardrobe||''}. Personality: ${c.personality||''}. Preserve visual continuity.`),
        scene.generate_audio!==false&&sound?'Sound direction: '+sound:''].filter(Boolean).join('\n');
      if(prompt.length>5000)throw Error('Shorten your story and character descriptions to fit the scene prompt limit.');
      return {scene_index:i,prompt,duration_seconds:duration,generate_audio:scene.generate_audio!==false,sound_direction:sound,
        body:{type:chars.length===1&&chars[0].referenceImage?'image-to-video':'text-to-video',provider:'ltx',model:'ltx-2-5-fast',resolution,duration,aspect_ratio:'16:9',prompt,generate_audio:scene.generate_audio!==false},referenceCharacterId:chars.length===1?chars[0].id:null,reference:chars.length===1?chars[0].referenceImage:null};
    });
  }
  function review(state,cost,onConfirm){
    document.getElementById('neneStoryReview')?.remove();
    const dialog=node('dialog');dialog.id='neneStoryReview';dialog.style.cssText='background:#15120c;color:#f7edda;border:1px solid #967735;border-radius:18px;padding:22px;max-width:90vw';
    dialog.append(node('h2','Review story credits'),node('p',`${state.scenes.length} scenes · ${cost} paid credits per scene · ${Number(cost)*state.scenes.length} paid credits total.`),node('p','Each scene is charged when submitted. Completed scenes stay saved if a later scene stops. Scene sound is included in this quote.'));
    const cancel=node('button','Back');cancel.className='btn';cancel.onclick=()=>dialog.close();
    const confirm=node('button',`Generate story · ${Number(cost)*state.scenes.length} paid credits`);confirm.className='btn gold';confirm.onclick=()=>{dialog.close();onConfirm();};dialog.append(cancel,confirm);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  async function poll(state,path,extract,done){
    for(let i=0;i<130;i++){
      const data=extract(await api(state.owner,path));
      if(done(data))return data;
      if(['failed','cancelled','canceled','rejected'].includes(data?.status))throw Error('A story job stopped. Your saved story remains available; no replacement job was submitted.');
      await new Promise(resolve=>setTimeout(resolve,7000));
    }
    throw Error('Your story is still processing. Continue the saved story later to check it.');
  }
  async function run(state){
    if(busy)return;busy=true;
    try{
      // Saving before any paid request is mandatory. If storage fails, stop.
      save(state);
      // Confirm every private reference before the first paid scene request.
      for(const scene of state.scenes){
        if(scene.body.type!=='image-to-video'||scene.body.source_image_id)continue;
        if(!scene.reference&&UUID.test(scene.referenceCharacterId)){
          const character=await api(state.owner,`/api/characters/${scene.referenceCharacterId}`);
          scene.reference=character.profile?.referenceImage;
        }
        if(!scene.reference)throw Error('The saved character reference is unavailable. No new scene was submitted.');
        const uploaded=await send(state.owner,'/api/image-upload',{data_uri:scene.reference});
        if(uploaded.private!==true||!UUID.test(uploaded.source_image_id))throw Error('A private character reference could not be confirmed.');
        scene.body.source_image_id=uploaded.source_image_id;save(state);
      }
      if(!state.storyId){
        const created=await send(state.owner,'/api/stories',{title:state.title,prompt:state.prompt,character_lock:{character_ids:state.characterIds}});
        if(!UUID.test(created.id))throw Error('The saved story could not be confirmed.');
        state.storyId=created.id;save(state);
      }
      if(!state.scenesSaved){
        await send(state.owner,`/api/stories/${state.storyId}/scenes`,{scenes:state.scenes.map(({scene_index,prompt,duration_seconds,generate_audio,sound_direction})=>({scene_index,prompt,duration_seconds,generate_audio,sound_direction}))},'PUT');
        state.scenesSaved=true;save(state);
      }
      for(const scene of state.scenes){
        message(`Scene ${scene.scene_index+1}/${state.scenes.length}: checking saved progress…`);
        if(!scene.generationId){
          scene.requestKey=scene.requestKey||crypto.randomUUID();save(state);
          const accepted=await send(state.owner,'/api/generations',scene.body,'POST',scene.requestKey);
          if(!UUID.test(accepted.generation_id))throw Error('The scene submission could not be confirmed. Continue this saved story safely.');
          scene.generationId=accepted.generation_id;save(state);
        }
        if(!scene.linked){await send(state.owner,`/api/stories/${state.storyId}/scenes/${scene.scene_index}/generation`,{generation_id:scene.generationId});scene.linked=true;save(state);}
        await poll(state,`/api/generations/${scene.generationId}`,d=>d.generation||d,d=>d?.status==='succeeded');
      }
      message('Assembling your story with its scene sound…');
      await send(state.owner,`/api/stories/${state.storyId}/assemble`,undefined,'POST',`story:${state.storyId}:assembly:v1`);
      await poll(state,`/api/stories/${state.storyId}/assembly`,d=>d.assembly,d=>d?.status==='succeeded');
      const result=await api(state.owner,`/api/stories/${state.storyId}/video`);
      const url=new URL(result.video_url);if(url.protocol!=='https:')throw Error('A secure final video link is not available.');
      const video=node('video');video.dataset.storyResult='true';video.controls=true;video.playsInline=true;video.src=url.href;video.style.cssText='width:100%;border-radius:14px';document.querySelector('main')?.append(video);
      message('Your story is ready. Scene sound is preserved; silent scenes stay silent.');
      state.completed=true;save(state);
      try{await window.neneRefreshPaidWallet?.();}catch(_){}
    }catch(e){message(e.message+' Use Continue saved story to check or retry the same jobs.');}
    finally{busy=false;}
  }
  window.neneGenerateDurableStory=async plan=>{
    if(busy)return;
    try{
      const owner=await window.neneAuthGetUserId?.();
      if(!owner||plan?.owner!==owner)throw Error('Sign in and build a story plan in this account first.');
      const previous=JSON.parse(localStorage.getItem(key(owner))||'null');
      if(previous&&!previous.completed){message('Continue your saved story before starting another paid story.');return;}
      const state={owner,title:plan.title.slice(0,160),prompt:plan.storyPrompt,characterIds:plan.characters.map(c=>c.id),scenes:prepare(plan)};
      const available=await api(owner,'/api/generation-availability');
      if(!available.accepting_requests||!available.generate_audio_supported||!available.story_audio_supported)throw Error('Story creation is temporarily unavailable. Nothing was submitted and no credits were charged.');
      const body=state.scenes[0].body;
      const quote=await send(owner,'/api/pricing/quote',{provider:body.provider,model:body.model,resolution:body.resolution,duration:body.duration});
      const amount=Number(quote.recommended_credits);
      if(!Number.isFinite(amount)||amount<=0)throw Error('A valid paid credit quote is not available.');
      state.scenes.forEach(s=>s.body.credit_limit=String(quote.recommended_credits));
      // References remain in memory only; server private asset IDs are persisted.
      review(state,quote.recommended_credits,()=>run(state));
    }catch(e){message(e.message);}
  };
  window.addEventListener('nene-auth-changed',()=>{document.getElementById('neneStoryReview')?.remove();document.getElementById('neneStoryProgress')?.remove();document.querySelectorAll('video[data-story-result]').forEach(n=>n.remove());});
  const original=window.openTool;
  window.openTool=async function(type,...args){
    const result=await original.call(this,type,...args);
    if(type!=='story'||!document.getElementById('storyScenes'))return result;
    document.getElementById('neneDuration').innerHTML='<option value="6">6 seconds per scene</option><option value="8">8 seconds per scene</option><option value="10">10 seconds per scene</option>';
    document.getElementById('neneResolution').innerHTML='<option value="720p">720p</option><option value="1080p">1080p HD</option>';
    document.getElementById('neneProvider')?.closest('.block')?.remove();
    const notice=document.getElementById('neneProviderNotice');if(notice)notice.textContent='Choose sound for each scene. Review the total paid credit cost before generating. Final stories are assembled in landscape format.';
    const resume=node('button','Continue saved story');resume.className='btn';resume.type='button';resume.onclick=async()=>{try{const owner=await window.neneAuthGetUserId?.();const state=JSON.parse(localStorage.getItem(key(owner))||'null');if(!owner||!state||state.owner!==owner)throw Error('No saved story is waiting in this account on this device.');await run(state);}catch(e){message(e.message);}};
    document.querySelector('main')?.append(resume);
    return result;
  };
})();
