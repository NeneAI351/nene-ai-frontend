/* Local single-clip editor. No uploads or paid AI requests. */
(() => {
'use strict';
let dispose=()=>{};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
function range(start,end,duration){start=Number(start);end=Number(end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration||end-start<0.2)throw Error('Choose a valid range of at least 0.2 seconds within the clip.');return {start,end};}
window.neneEditorRange=range;
window.neneOpenVideoEditor=async()=>{
 if(!await window.neneRequireAccount?.())return;
 dispose();setNav('create');
 const view=el('main'),header=el('div',null,'toolhead'),back=el('button','‹','back');back.setAttribute('aria-label','Back to AI Studio');back.onclick=()=>{dispose();window.renderCreateHub();};header.append(back,el('h1','AI Video Editor'));view.append(header,el('p','Trim a clip, preview it and download an edited copy.','subtitle'),el('p','Local editing uses no credits. Your file stays on this device. AI commands, multi-clip timelines and automatic captions are not available here yet. Download your result before leaving this screen.','notice'));
 const input=el('input');input.type='file';input.accept='video/*';input.setAttribute('aria-label','Choose a video');
 const video=el('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.style.cssText='width:100%;max-height:360px;background:#000';
 const fields=el('div',null,'row');
 function number(label){const wrap=el('label',label,'block'),n=el('input');n.type='number';n.min='0';n.step='0.1';n.disabled=true;n.className='field';wrap.append(n);fields.append(wrap);return n;}
 const start=number('Start (seconds)'),end=number('End (seconds)');
 const muteLabel=el('label',' Remove original audio '),mute=el('input');mute.type='checkbox';muteLabel.prepend(mute);
 const preview=el('button','Preview trim','btn'),exportBtn=el('button','Download trimmed video','btn gold'),cancel=el('button','Cancel export','btn');preview.disabled=exportBtn.disabled=true;cancel.hidden=true;
 const status=el('p','Choose a video up to 80 MB and 60 seconds. Exports use WebM and take approximately the selected duration.','notice');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const download=el('a','Save edited video','btn gold');download.hidden=true;
 const actions=el('div',null,'row');actions.append(preview,exportBtn,cancel);view.append(input,video,fields,muteLabel,actions,status,download);document.getElementById('screen').replaceChildren(view);
 let source=null,output=null,recorder=null,stream=null,context=null,audioSource=null,frame=null,watch=null,playing=false,busy=false,aborted=false,dead=false;
 const supported=!!(window.MediaRecorder&&HTMLCanvasElement.prototype.captureStream&&(window.AudioContext||window.webkitAudioContext));
 const update=()=>{const ready=!!source&&Number.isFinite(video.duration)&&video.duration>0&&video.duration<=60;preview.disabled=!ready||busy;exportBtn.disabled=!ready||busy||!supported;start.disabled=end.disabled=input.disabled=mute.disabled=busy;cancel.hidden=!busy;};
 const stop=()=>{cancel.hidden=true;if(recorder?.state==='recording')recorder.stop();video.pause();playing=false;clearInterval(watch);cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());stream=null;audioSource?.disconnect();};
 dispose=()=>{if(dead)return;dead=true;aborted=true;stop();if(source)URL.revokeObjectURL(source);if(output)URL.revokeObjectURL(output);context?.close().catch(()=>{});context=null;video.removeAttribute('src');video.load();observer.disconnect();};
 function invalidate(){download.hidden=true;if(output){URL.revokeObjectURL(output);output=null;}}
 start.oninput=end.oninput=mute.onchange=invalidate;
 const observer=new MutationObserver(()=>{if(!view.isConnected)dispose();});observer.observe(document.getElementById('screen'),{childList:true});
 input.onchange=()=>{stop();source&&URL.revokeObjectURL(source);output&&URL.revokeObjectURL(output);source=output=null;download.hidden=true;preview.disabled=exportBtn.disabled=true;const file=input.files[0];if(!file)return;if(!file.type.startsWith('video/')||file.size>80*1024*1024){status.textContent='Choose a video file under 80 MB.';return;}source=URL.createObjectURL(file);video.src=source;video.load();status.textContent='Loading video…';};
 video.onloadedmetadata=()=>{start.value='0';end.value=Number.isFinite(video.duration)?String(Math.floor(video.duration*10)/10):'';start.max=end.max=String(video.duration);update();status.textContent=video.duration>60||!Number.isFinite(video.duration)?'Use a video no longer than 60 seconds.':supported?'Set the start and end, then preview or download. Keep this screen open during export.':'Preview is available. Video export is not supported by this browser; try the latest Chrome.';};
 video.onerror=()=>{status.textContent='This video format could not be opened. Try an MP4 video.';source&&URL.revokeObjectURL(source);source=null;update();};
 function bounds(){return range(start.value,end.value,video.duration);}
 video.ontimeupdate=()=>{if(playing&&!busy&&video.currentTime>=Number(end.value)){video.pause();playing=false;}};
 preview.onclick=async()=>{try{const r=bounds();video.currentTime=r.start;video.muted=mute.checked;if(audioSource){audioSource.disconnect();audioSource.connect(context.destination);await context.resume();}playing=true;await video.play();}catch(e){status.textContent=e.message;}};
 cancel.onclick=()=>{aborted=true;stop();};
 exportBtn.onclick=async()=>{
  if(busy||!supported)return;
  let timer;try{
   const r=bounds();busy=true;aborted=false;update();download.hidden=true;video.pause();audioSource?.disconnect();
   await new Promise((resolve,reject)=>{timer=setTimeout(()=>{video.onseeked=null;reject(Error('Video seek timed out. Try again.'));},8000);video.onseeked=()=>{clearTimeout(timer);video.onseeked=null;resolve();};if(Math.abs(video.currentTime-r.start)<0.001){clearTimeout(timer);video.onseeked=null;resolve();}else video.currentTime=r.start;});
   if(dead||aborted)throw Error('Export cancelled.');
   const canvas=el('canvas'),scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.max(2,Math.round(video.videoWidth*scale/2)*2);canvas.height=Math.max(2,Math.round(video.videoHeight*scale/2)*2);const ctx=canvas.getContext('2d');
   stream=canvas.captureStream(30);
   if(!mute.checked){if(!context){context=new (window.AudioContext||window.webkitAudioContext)();audioSource=context.createMediaElementSource(video);}await context.resume();const destination=context.createMediaStreamDestination();audioSource.connect(destination);destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));}
   const type=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('WebM export is unavailable in this browser.');
   recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4000000});const chunks=[];
   const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=resolve;recorder.onerror=()=>reject(Error('Export failed. Please try a shorter clip.'));});
   function draw(){ctx.drawImage(video,0,0,canvas.width,canvas.height);frame=requestAnimationFrame(draw);}draw();video.muted=false;
   recorder.start(250);await video.play();
   const halt=()=>stop();
   watch=setInterval(()=>{if(dead||aborted||video.currentTime>=r.end||video.ended)halt();else status.textContent='Exporting… '+Math.round((video.currentTime-r.start)/(r.end-r.start)*100)+'%';},40);
   const timeout=setTimeout(()=>{aborted=true;halt();},(r.end-r.start+15)*1000);
   try{await done;}finally{clearTimeout(timeout);halt();}
   if(dead||aborted)throw Error('Export cancelled. No edited file was saved.');
   const blob=new Blob(chunks,{type});if(!blob.size)throw Error('No video was captured. Try another browser.');output&&URL.revokeObjectURL(output);output=URL.createObjectURL(blob);download.href=output;download.download='nene-ai-edited.webm';download.hidden=false;status.textContent='Edited copy ready. Tap Save edited video to keep it. The original is unchanged.';
  }catch(e){if(!dead)status.textContent=e.message;}finally{clearTimeout(timer);stop();busy=false;if(!dead)update();}
 };
};
window.addEventListener('nene-auth-changed',()=>{dispose();const view=document.getElementById('screen');if(view?.querySelector('h1')?.textContent==='AI Video Editor')view.replaceChildren(el('p','Account changed. Reopen AI Video Editor.','notice'));});
})();
