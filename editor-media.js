/* Shared canvas/Web Audio timeline: preview and export use the same edit. */
(() => {
  'use strict';
  const M=window.NENEEditorModel;
  function supportedTypes(){if(!window.MediaRecorder)return [];return ['video/mp4;codecs=avc1.42E01F,mp4a.40.2','video/mp4;codecs=avc1.4D401F,mp4a.40.2','video/webm;codecs=vp8,opus'].filter(type=>MediaRecorder.isTypeSupported(type));}
  const audioContext=()=>new (window.AudioContext||window.webkitAudioContext)();
  function unlock(){const context=audioContext();let ready;try{ready=context.resume();}catch(e){ready=Promise.reject(e);}ready=Promise.resolve(ready);ready.catch(()=>{});return {context,ready};}
  async function bounded(promise,message,signal,timeout=12000){let timer,abort;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),timeout);abort=()=>reject(Error('Export or preview cancelled. No fee was charged.'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();})]);}finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);}}
  function wait(element,event,timeout=12000,signal){return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);element.removeEventListener(event,success);element.removeEventListener('error',failure);signal?.removeEventListener('abort',abort);};
    const success=()=>{cleanup();resolve();},failure=()=>{cleanup();reject(Error('This media file could not be decoded. Try a standard MP4, MP3 or WAV file.'));},abort=()=>{cleanup();reject(Error('Export or preview cancelled.'));};
    const timer=setTimeout(()=>{cleanup();reject(Error('Media loading timed out. No export fee was charged.'));},timeout);
    element.addEventListener(event,success,{once:true});element.addEventListener('error',failure,{once:true});signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  });}
  async function seek(video,time,signal){if(video.readyState>=2&&Math.abs(video.currentTime-time)<.002)return;const ready=wait(video,'seeked',12000,signal);video.currentTime=time;await ready;}
  async function loadVideo(file){
    if(file.size>80*1024*1024)throw Error('Choose a video file under 80 MB.');
    const video=document.createElement('video'),url=URL.createObjectURL(file);video.preload='auto';video.playsInline=true;video.src=url;
    try{const ready=wait(video,'loadeddata');video.load();await ready;if(!Number.isFinite(video.duration)||video.duration<.2||video.duration>180||!video.videoWidth||!video.videoHeight)throw Error('Use a video between 0.2 seconds and three minutes. Trim the finished timeline to 60 seconds.');const source=await M.hash(await file.arrayBuffer());return {source,video,url,file,duration:video.duration};}catch(e){URL.revokeObjectURL(url);throw e;}
  }
  async function loadAudio(file){
    if(file.size>20*1024*1024)throw Error('Choose an audio file under 20 MB.');const context=audioContext();
    try{const raw=await bounded(file.arrayBuffer(),'The audio file could not be read. Save it on your phone and try again.'),buffer=await bounded(context.decodeAudioData(raw.slice(0)),'Audio decoding timed out. Try a shorter MP3 or WAV file.',undefined,30000);if(buffer.duration>180||buffer.duration<.1)throw Error('Use an audio track between 0.1 seconds and three minutes.');return {source:await M.hash(raw),file,buffer,duration:buffer.duration};}catch(e){throw Error(/^(Use an audio|The audio file|Audio decoding)/.test(e.message||'')?e.message:'This audio file could not be decoded. Try MP3 or WAV.');}finally{await context.close();}
  }
  async function validateBlob(blob,expected,signal){
    if(blob.size<100)throw Error('The video export was empty. No fee was charged.');
    const video=document.createElement('video'),url=URL.createObjectURL(blob);video.preload='auto';video.muted=true;video.playsInline=true;video.src=url;
    try{const ready=wait(video,'loadeddata',15000,signal);video.load();await ready;if(!video.videoWidth||!video.videoHeight)throw Error('The finished video could not be checked. No fee was charged.');if(Number.isFinite(video.duration)&&Math.abs(video.duration-expected)>Math.max(1,expected*.08))throw Error('The export duration was incomplete. Please retry. No fee was charged.');return {width:video.videoWidth,height:video.videoHeight};}finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  }
  async function run(project,resources,{canvas,record=false,mimeType,signal,playback,onStage=()=>{},onProgress=()=>{}}={}){
    const valid=M.validate(project,resources);project=valid.project;const [w,h]=M.FORMATS[project.format];canvas.width=w;canvas.height=h;
    if(record&&!supportedTypes().includes(mimeType))throw Error('This export format is not supported on this device.');
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('Video preview is unavailable on this device.');
    const context=playback?.context||audioContext(),destination=context.createMediaStreamDestination();let stream=null,recorder=null,recordingError=null,raf=null,finished=false;
    const chunks=[],nodes=[],audioSources=[];let bytes=0,failClip=null;
    let resolveDone,rejectDone;const done=new Promise((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});done.catch(()=>{});
    const mixer=context.createGain();mixer.gain.value=.8;const limiter=context.createDynamicsCompressor();mixer.connect(limiter);limiter.connect(destination);if(!record)limiter.connect(context.destination);
    const stopAudio=()=>{for(const node of audioSources.splice(0)){try{node.stop();node.disconnect();}catch(_){}}};
    const abort=()=>{recordingError=Error(document.hidden?'Keep NENE AI visible during export. No fee was charged.':'Export or preview cancelled. No new fee was charged.');resources.forEach(r=>r.video?.pause());nodes.forEach(n=>n.player.pause());failClip?.(recordingError);if(recorder?.state!=='inactive'&&recorder)recorder.stop();};
    const hidden=()=>{if(document.hidden)abort();};signal?.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',hidden);
    try{
      onStage('Starting sound…');await bounded(playback?.ready||context.resume(),'Audio playback could not start. Tap Preview again or try another browser. No fee was charged.',signal);if(signal?.aborted)throw Error('Export cancelled.');
      if(record){stream=canvas.captureStream(30);destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:4000000,audioBitsPerSecond:128000});recorder.ondataavailable=event=>{if(event.data.size){bytes+=event.data.size;if(bytes>64*1024*1024){recordingError=Error('The export is too large for this mobile editor. Shorten the timeline.');recorder.stop();}else chunks.push(event.data);}};recorder.onstop=resolveDone;recorder.onerror=()=>{recordingError=Error('The browser could not finish recording. No fee was charged.');rejectDone(recordingError);};}
      let offset=0,clipIndex=0;
      for(const clip of project.clips){
        if(recordingError||signal?.aborted)throw recordingError||Error('Export cancelled.');
        onStage('Loading clip '+(++clipIndex)+' of '+project.clips.length+'…');const resource=resources.get(clip.source),video=resource.video;
        if(recorder?.state==='recording')recorder.pause();
        video.pause();video.onseeked=null;
        // Media elements can have only one Web Audio source. A run owns its
        // context, so detach the source element afterwards and recreate on reload.
        const player=video.cloneNode();player.src=resource.url;player.preload='auto';player.playsInline=true;player.setAttribute('playsinline','');player.muted=false;player.style.cssText='position:fixed;width:1px;height:1px;opacity:.01;pointer-events:none;bottom:0;left:0';document.body.append(player);nodes.push({player});
        const loaded=wait(player,'loadeddata',12000,signal);player.load();await loaded;await seek(player,clip.start,signal);
        const original=context.createMediaElementSource(player),gain=context.createGain();gain.gain.value=clip.volume;original.connect(gain);gain.connect(mixer);Object.assign(nodes[nodes.length-1],{original,gain});
        M.draw(ctx,player,project,offset,w,h);
        if(recordingError||signal?.aborted)throw recordingError||Error('Export cancelled.');
        await bounded(player.play(),'Video playback could not start. Try another browser. No fee was charged.',signal);if(recorder){if(recorder.state==='inactive')recorder.start(250);else if(recorder.state==='paused')recorder.resume();}
        const clipLength=clip.end-clip.start;
        for(const name of ['music','voice']){
          const track=project[name];if(!track)continue;const resource=resources.get(track.source),elapsed=offset-track.start;
          if(!track.loop&&elapsed>=resource.buffer.duration)continue;
          const source=context.createBufferSource(),volume=context.createGain();source.buffer=resource.buffer;source.loop=track.loop;volume.gain.value=track.volume;source.connect(volume);volume.connect(mixer);audioSources.push(source);
          const delay=Math.max(0,-elapsed);if(delay<clipLength){const at=track.loop?Math.max(0,elapsed)%resource.buffer.duration:Math.max(0,elapsed);source.start(context.currentTime+delay,at);}
        }
        await new Promise((resolve,reject)=>{
          const started=performance.now();let completed=false;
          const finish=error=>{if(completed)return;completed=true;failClip=null;clearTimeout(deadline);cancelAnimationFrame(raf);player.removeEventListener('error',failure);signal?.removeEventListener('abort',cancel);if(error)reject(error);else resolve();};failClip=finish;
          const failure=()=>finish(Error('A clip stopped playing. No export fee was charged.')),cancel=()=>finish(Error('Export or preview cancelled.'));
          const deadline=setTimeout(()=>finish(Error('Playback stalled. No export fee was charged.')),clipLength*1000+20000);
          const tick=()=>{if(recordingError||signal?.aborted)return finish(recordingError||Error('Export cancelled.'));if(document.hidden)return finish(Error('Keep the app visible during export. No fee was charged.'));const progress=Math.min(clipLength,Math.max(0,player.currentTime-clip.start));M.draw(ctx,player,project,offset+progress,w,h);onProgress(offset+progress,valid.duration);if(player.currentTime>=clip.end-.015||(player.ended&&player.currentTime>=clip.end-.1))return finish();if(player.ended||performance.now()-started>(clipLength+18)*1000)return failure();raf=requestAnimationFrame(tick);};
          player.addEventListener('error',failure,{once:true});signal?.addEventListener('abort',cancel,{once:true});tick();
        });
        player.pause();stopAudio();original.disconnect();gain.disconnect();player.removeAttribute('src');player.load();offset+=clipLength;
      }
      finished=true;
      if(!record)return null;
      if(recorder.state!=='inactive')recorder.stop();await done;if(recordingError)throw recordingError;
      const actualType=recorder.mimeType||mimeType;if(actualType.split(';')[0]!==mimeType.split(';')[0])throw Error('The browser returned a different file format. No fee was charged.');
      const blob=new Blob(chunks,{type:actualType});await validateBlob(blob,valid.duration,signal);return {blob,mimeType:actualType,extension:actualType.startsWith('video/mp4')?'mp4':'webm',duration:valid.duration};
    }finally{
      signal?.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',hidden);cancelAnimationFrame(raf);stopAudio();for(const {player,original,gain} of nodes){player.pause();player.removeAttribute('src');player.load();player.remove();try{original?.disconnect();gain?.disconnect();}catch(_){}}if(recorder&&recorder.state!=='inactive')recorder.stop();stream?.getTracks().forEach(t=>t.stop());mixer.disconnect();await context.close();if(!finished)resolveDone?.();
    }
  }
  window.NENEEditorMedia=Object.freeze({supportedTypes,loadVideo,loadAudio,run,validateBlob,unlock});
})();
