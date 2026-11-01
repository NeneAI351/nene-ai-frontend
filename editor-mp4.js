/* Local H.264/AAC fallback. No media or account data is sent to the CDN. */
(() => {
  'use strict';
  const root=new URL('./',document.currentScript.src);
  const core='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/';
  let library;
  function loadLibrary(){
    if(window.FFmpegWASM)return Promise.resolve();
    if(!library)library=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL('vendor/ffmpeg/ffmpeg.js',root).href;
      script.onload=resolve;script.onerror=()=>{script.remove();library=null;reject(Error('The MP4 converter could not load. Check your connection and retry. No fee was charged.'));};document.head.append(script);
    });
    return library;
  }
  async function convert(blob,{signal,onStage=()=>{}}={}){
    if(signal?.aborted)throw Error('MP4 conversion cancelled. No fee was charged.');
    let ffmpeg;const urls=[],controller=new AbortController();let rejectAbort;
    const aborted=new Promise((_,reject)=>{rejectAbort=reject;});aborted.catch(()=>{});
    const stop=()=>{controller.abort();ffmpeg?.terminate();rejectAbort(Error('MP4 conversion cancelled or timed out. No fee was charged.'));};
    const timer=setTimeout(stop,240000);signal?.addEventListener('abort',stop,{once:true});
    const checked=promise=>Promise.race([promise,aborted]);
    async function asset(name,type){const response=await fetch(core+name,{credentials:'omit',signal:controller.signal,cache:'force-cache'});if(!response.ok)throw Error('The MP4 converter download failed. Check your connection and retry. No fee was charged.');const url=URL.createObjectURL(new Blob([await response.arrayBuffer()],{type}));urls.push(url);return url;}
    try{
      onStage('Loading MP4 converter · first use downloads about 32 MB. Video stays on this device.');
      await checked(loadLibrary());if(signal?.aborted)throw Error('MP4 conversion cancelled. No fee was charged.');
      ffmpeg=new window.FFmpegWASM.FFmpeg();
      const coreURL=await checked(asset('ffmpeg-core.js','text/javascript')),wasmURL=await checked(asset('ffmpeg-core.wasm','application/wasm'));
      await checked(ffmpeg.load({coreURL,wasmURL}));
      await checked(ffmpeg.writeFile('edit.webm',new Uint8Array(await blob.arrayBuffer())));
      onStage('Converting to MP4 · keep NENE AI visible. No credits charged.');
      const code=await checked(ffmpeg.exec(['-i','edit.webm','-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','ultrafast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-y','edit.mp4'],120000));
      if(code!==0)throw Error('MP4 conversion did not finish. Try a shorter film or WebM. No fee was charged.');
      const data=await checked(ffmpeg.readFile('edit.mp4'));
      if(!(data instanceof Uint8Array)||data.length<100||data.length>64*1024*1024)throw Error('The MP4 output could not be saved safely. Try a shorter film. No fee was charged.');
      return new Blob([data],{type:'video/mp4'});
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);controller.abort();ffmpeg?.terminate();urls.forEach(url=>URL.revokeObjectURL(url));}
  }
  window.NENEEditorMP4=Object.freeze({convert});
})();
