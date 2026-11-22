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
  function prepare(plan,profile){
    const duration=Number(document.getElementById('neneDuration')?.value),resolution=document.getElementById('neneResolution')?.value;
    if(![6,8,10].includes(duration)||!(profile.resolutions||['720p','1080p']).includes(resolution))throw Error('Choose a supported scene length and quality.');
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
        body:{type:chars.length===1&&chars[0].referenceImage?'image-to-video':'text-to-video',provider:profile.provider,model:profile.model,resolution,duration,aspect_ratio:chars.length===1&&chars[0].referenceImage?profile.reference_aspect_ratio:'16:9',prompt,generate_audio:scene.generate_audio!==false},referenceCharacterId:chars.length===1?chars[0].id:null,reference:chars.length===1?chars[0].referenceImage:null};
    });
  }
  function review(state,quote,onConfirm){
    document.getElementById('neneStoryReview')?.remove();
    const dialog=node('dialog');dialog.id='neneStoryReview';dialog.style.cssText='background:#15120c;color:#f7edda;border:1px solid #967735;border-radius:18px;padding:22px;max-width:90vw';
    dialog.append(node('h2','Review story credits'),node('p',`${state.scenes.length} scenes · ${quote.total_credits} paid credits total.`));
    quote.scenes.forEach((scene,i)=>dialog.append(node('p',`Scene ${i+1}: ${scene.credits} paid credits`)));
    dialog.append(node('p','Scene sound and combining the film are included. Editing preview is free; an edited export has its own price confirmation. Failed scene reservations are released before a paid replacement.'));
    const cancel=node('button','Back');cancel.className='btn';cancel.onclick=()=>dialog.close();
    const confirm=node('button',`Generate story · ${quote.total_credits} paid credits`);confirm.className='btn gold';confirm.onclick=()=>{confirm.disabled=true;dialog.close();onConfirm();};dialog.append(cancel,confirm);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  async function storyQuote(owner,scenes){
    const quote=await send(owner,'/api/stories/quote',{scenes:scenes.map(s=>{const b=s.body;return {provider:b.provider,model:b.model,resolution:b.resolution,duration:b.duration};})});
    if(!Array.isArray(quote.scenes)||quote.scenes.length!==scenes.length||!Number.isFinite(Number(quote.total_credits))||Number(quote.total_credits)<=0||quote.scenes.some((s,i)=>s.scene_index!==i||!Number.isFinite(Number(s.credits))||Number(s.credits)<=0))throw Error('A valid total story quote is not available. Nothing was submitted.');
    return quote;
  }
  function action(label,fn){const b=node('button',label);b.type='button';b.className='btn';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){message(e.message);}finally{b.disabled=false;}};return b;}
  async function secureMedia(owner,path){const data=await api(owner,path),url=new URL(data.url||data.video_url);if(url.protocol!=='https:')throw Error('A secure playback link is unavailable.');return url.href;}
  async function workspace(state){
    const story=await api(state.owner,`/api/stories/${state.storyId}`);
    if(!Array.isArray(story.scenes))return;
    if(!state.scenes.length&&story.scenes.every(s=>s.generation_request)){
      state.scenes=story.scenes.map(s=>({...s,body:s.generation_request,generationId:s.generation_id,linked:true}));state.scenesSaved=true;state.title=story.title;state.prompt=story.prompt;
    }
    let box=document.getElementById('neneStoryWorkspace');if(!box){box=node('section');box.id='neneStoryWorkspace';document.querySelector('main')?.append(box);}
    box.replaceChildren(node('h2',story.title||state.title||'Your story'));
    const player=node('video');player.controls=true;player.playsInline=true;player.style.cssText='width:100%;border-radius:14px';box.append(player);
    const scenes=[...story.scenes].sort((a,b)=>a.scene_index-b.scene_index);
    let current=-1;
    async function playScene(index,autoplay=true){if(state.owner!==await window.neneAuthGetUserId?.()||!box.isConnected)return;const scene=scenes[index];if(!scene||scene.status!=='succeeded')return;const url=await secureMedia(state.owner,`/api/generations/${scene.generation_id}/media-url`);if(!box.isConnected)return;current=index;player.src=url;player.setAttribute('aria-label',`Scene ${index+1}`);if(autoplay)try{await player.play();}catch(_){message('Tap play on the video to continue.');}}
    player.onended=()=>{if(scenes[current+1]?.status==='succeeded')void playScene(current+1).catch(e=>message(e.message));};
    box.append(action('Preview scenes in order',()=>playScene(0)));
    for(const scene of scenes){
      const row=node('div');row.append(node('p',`Scene ${scene.scene_index+1} · ${scene.status}`));
      if(scene.status==='succeeded')row.append(action('Preview scene '+(scene.scene_index+1),()=>playScene(scene.scene_index)));
      if(scene.status==='failed')row.append(action('Review retry for scene '+(scene.scene_index+1),async()=>{
        if(busy)return;
        const local=state.scenes?.find(s=>s.scene_index===scene.scene_index);
        if(!local?.body)throw Error('Open this story on its original device to review the exact failed scene settings.');
        const quote=await storyQuote(state.owner,[local]);
        const retryState={...state,scenes:[local]};
        review(retryState,quote,async()=>{if(busy)return;busy=true;try{
          const result=await send(state.owner,`/api/stories/${state.storyId}/scenes/${scene.scene_index}/retry`,{failed_generation_id:scene.generation_id,credit_limit:String(quote.scenes[0].credits)});
          if(!UUID.test(result.generation_id))throw Error('Retry could not be confirmed. Check saved progress.');
          local.generationId=result.generation_id;local.linked=true;local.requestKey='story-retry:'+scene.generation_id;save(state);
          message('Failed reservation released. Checking the same replacement job safely.');
        }catch(e){message(e.message+' Use Continue saved story to recover the same retry safely.');return;}finally{busy=false;}await run(state);});
      }));
      box.append(row);
    }
    if(scenes.length&&scenes.every(s=>s.status==='succeeded'))box.append(action('Combine into film',()=>assemble(state)));
    if(story.status==='completed'){
      box.append(action('Report AI content',()=>window.neneOpenOutputReport?.({kind:'story',id:state.storyId,owner:state.owner})),action('Watch finished film',async()=>{player.src=await secureMedia(state.owner,`/api/stories/${state.storyId}/video`);player.onended=null;try{await player.play();}catch(_){};}),
        action('Edit finished film',async()=>{
          const url=await secureMedia(state.owner,`/api/stories/${state.storyId}/video`);
          const response=await fetch(url);if(!response.ok)throw Error('Film download failed. Retry without generating again.');
          const blob=await response.blob();if(!blob.size||blob.size>160*1024*1024)throw Error('Film exceeds the editor import limit.');
          if(state.owner!==await window.neneAuthGetUserId?.())throw Error('Account changed.');
          await window.neneOpenVideoEditor?.({owner:state.owner,importFiles:[new File([blob],'story-film.mp4',{type:'video/mp4'})],format:'16:9'});
        }),action('Saved to My Creations · Open',()=>window.renderCreations?.()));
    }
    return story;
  }
  async function assemble(state){
    if(state.owner!==await window.neneAuthGetUserId?.())throw Error('Sign in to the same account.');
    message('Combining your story with its scene sound…');
    await send(state.owner,`/api/stories/${state.storyId}/assemble`,undefined,'POST',`story:${state.storyId}:assembly:v1`);
    await poll(state,`/api/stories/${state.storyId}/assembly`,d=>d.assembly,d=>d?.status==='succeeded');
    const url=await secureMedia(state.owner,`/api/stories/${state.storyId}/video`);
    document.querySelectorAll('video[data-story-result]').forEach(n=>n.remove());
    const video=node('video');video.dataset.storyResult='true';video.controls=true;video.playsInline=true;video.src=url;video.style.cssText='width:100%;border-radius:14px';document.querySelector('main')?.append(video);
    state.completed=true;save(state);await workspace(state);message('Your story film is saved to My Creations. Preview, edit or watch it here.');
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
      if(state.storyId){const stored=await api(state.owner,`/api/stories/${state.storyId}`);for(const scene of state.scenes){const remote=stored.scenes?.find(s=>s.scene_index===scene.scene_index);if(remote?.generation_id){scene.generationId=remote.generation_id;scene.linked=true;}}}
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
      await workspace(state);
      await assemble(state);
      try{await window.neneRefreshPaidWallet?.();}catch(_){}
    }catch(e){message(e.message+' Continue saved story checks the same jobs; use Review retry only for confirmed failed scenes.');if(state.storyId)try{await workspace(state);}catch(_){} }
    finally{busy=false;}
  }
  window.neneGenerateDurableStory=async plan=>{
    if(busy)return;
    try{
      const owner=await window.neneAuthGetUserId?.();
      if(!owner||plan?.owner!==owner)throw Error('Sign in and build a story plan in this account first.');
      const previous=JSON.parse(localStorage.getItem(key(owner))||'null');
      if(previous&&!previous.completed){message('Continue your saved story before starting another paid story.');return;}
      const state={owner,title:plan.title.slice(0,160),prompt:plan.storyPrompt,characterIds:plan.characters.map(c=>c.id),scenes:[]};
      const available=await api(owner,'/api/generation-availability');
      if(!available.accepting_requests||!available.generate_audio_supported||!available.story_audio_supported)throw Error('Story creation is temporarily unavailable. Nothing was submitted and no credits were charged.');
      const profile=available.story_generation;
      if(!profile||!['ltx','magic-hour'].includes(profile.provider)||!profile.model)throw Error('Story creation is temporarily unavailable. No credits were charged.');
      state.scenes=prepare(plan,profile);
      const quote=await storyQuote(owner,state.scenes);
      quote.scenes.forEach((q,i)=>state.scenes[i].body.credit_limit=String(q.credits));
      review(state,quote,()=>run(state));
    }catch(e){message(e.message);}
  };
  window.addEventListener('nene-auth-changed',()=>{document.getElementById('neneStoryReview')?.remove();document.getElementById('neneStoryProgress')?.remove();document.getElementById('neneStoryWorkspace')?.remove();document.getElementById('neneStoryLibrary')?.replaceChildren();document.getElementById('neneStoryFilms')?.replaceChildren();document.querySelectorAll('video[data-story-result]').forEach(n=>n.remove());});
  window.neneLoadStoryLibrary=async root=>{
    if(!root)return;const owner=await window.neneAuthGetUserId?.();root.textContent='Loading your story films…';
    try{if(!owner)throw Error('Sign in to see your stories.');const data=await api(owner,'/api/stories');if(!root.isConnected)return;root.replaceChildren();
      for(const story of data.items||[]){if(!UUID.test(story.id))continue;const row=node('article');row.className='block';row.append(node('h3',story.title),node('p',story.status));
        row.append(action('Open story',async()=>{const saved=JSON.parse(localStorage.getItem(key(owner))||'null');await workspace(saved?.storyId===story.id?saved:{owner,storyId:story.id,title:story.title,scenes:[]});}));root.append(row);}
      if(!root.children.length)root.textContent='No saved story films yet.';
    }catch(e){if(root.isConnected)root.textContent=e.message;}
  };
  const original=window.openTool;
  window.openTool=async function(type,...args){
    const result=await original.call(this,type,...args);
    if(type!=='story'||!document.getElementById('storyScenes'))return result;
    document.getElementById('neneDuration').innerHTML='<option value="6">6 seconds per scene</option><option value="8">8 seconds per scene</option><option value="10">10 seconds per scene</option>';
    const count=document.getElementById('storyScenes');
    if(![...count.options].some(o=>o.value==='1')){const one=node('option','1 scene');one.value='1';count.prepend(one);}
    count.value='1';
    window.renderStoryCharacterAssignments?.();
    const quality=document.getElementById('neneResolution');
    quality.replaceChildren();
    try{const owner=await window.neneAuthGetUserId?.();const availability=await api(owner,'/api/generation-availability');
      for(const r of availability.story_generation?.resolutions||['720p','1080p']){if(!['480p','720p','1080p'].includes(r))continue;const option=node('option',r==='480p'?'480p — Standard':r==='720p'?'720p — HD':'1080p — Full HD');option.value=r;quality.append(option);}
    }catch(e){message('Story quality options are temporarily unavailable.');}
    document.getElementById('neneProvider')?.closest('.block')?.remove();
    const notice=document.getElementById('neneProviderNotice');if(notice)notice.textContent='Choose sound for each scene. Review the total paid credit cost before generating. Final stories are assembled in landscape format.';
    const resume=node('button','Continue saved story');resume.className='btn';resume.type='button';resume.onclick=async()=>{try{const owner=await window.neneAuthGetUserId?.();const state=JSON.parse(localStorage.getItem(key(owner))||'null');if(!owner||!state||state.owner!==owner)throw Error('No saved story is waiting in this account on this device.');await run(state);}catch(e){message(e.message);}};
    document.querySelector('main')?.append(resume);const library=node('section');library.id='neneStoryLibrary';document.querySelector('main')?.append(library);void window.neneLoadStoryLibrary(library);
    return result;
  };
})();
