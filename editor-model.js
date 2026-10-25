/* Pure edit model shared by preview, export, persistence and paid entitlements. */
(() => {
  'use strict';
  const FORMATS = {'9:16':[720,1280], '16:9':[1280,720], '1:1':[720,720], '4:5':[720,900]};
  const finite = (v,min,max,label) => {const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(label);return Math.round(n*1000)/1000;};
  function validate(project, resources) {
    if(!project.clips?.length||project.clips.length>6)throw Error('Add between one and six video clips.');
    if(!FORMATS[project.format]||!['contain','cover'].includes(project.fit))throw Error('Choose a supported video format and crop.');
    let duration=0;
    const clips=project.clips.map(clip=>{
      const source=resources.get(clip.source);if(!source)throw Error('A source file is missing. Add it again.');
      const start=finite(clip.start,0,source.duration,'Choose a valid clip start.');
      const end=finite(clip.end,0,source.duration,'Choose a valid clip end.');
      if(end-start<.2)throw Error('Each clip must be at least 0.2 seconds long.');
      duration+=end-start;
      return {source:clip.source,start,end,volume:finite(clip.volume,0,1,'Set clip volume between 0 and 100%.')};
    });
    if(duration>60.001)throw Error('Trim the timeline to 60 seconds or less for this mobile editor.');
    const title=String(project.title||'').trim();if(title.length>80)throw Error('Keep the title within 80 characters.');
    if((project.captions||[]).length>100)throw Error('Use no more than 100 captions.');
    const captions=(project.captions||[]).map(c=>{
      const start=finite(c.start,0,duration,'Caption start must be inside the timeline.'),end=finite(c.end,0,duration,'Caption end must be inside the timeline.'),text=String(c.text||'').trim();
      if(end<=start||!text||text.length>120)throw Error('Each caption needs text up to 120 characters and a valid time range.');
      return {start,end,text};
    }).sort((a,b)=>a.start-b.start||a.end-b.end||a.text.localeCompare(b.text));
    const result={version:2,clips,format:project.format,fit:project.fit,title,captions};
    for(const key of ['music','voice']){
      const audio=project[key];if(!audio){result[key]=null;continue;}
      if(!resources.get(audio.source)?.buffer)throw Error('An audio file is missing. Add it again.');
      result[key]={source:audio.source,start:finite(audio.start,0,duration-.001,'Audio start must be inside the timeline.'),volume:finite(audio.volume,0,1,'Set audio volume between 0 and 100%.'),loop:key==='music'&&!!audio.loop};
    }
    return {project:result,duration:Math.round(duration*1000)/1000};
  }
  async function hash(data){const bytes=typeof data==='string'?new TextEncoder().encode(data):data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
  async function digest(project,resources){return hash(JSON.stringify(validate(project,resources).project));}
  function parseSrt(text){
    if(text.length>64000)throw Error('Use an SRT file under 64 KB.');
    const time=s=>{const m=s.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})$/);if(!m||Number(m[2])>59||Number(m[3])>59)throw Error('Invalid subtitle time. Use HH:MM:SS,mmm.');return Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;};
    const blocks=text.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/);
    if(blocks.length>100)throw Error('Use no more than 100 captions.');
    return blocks.map(block=>{const lines=block.split('\n');if(/^\d+$/.test(lines[0].trim()))lines.shift();const parts=(lines.shift()||'').split('-->');if(parts.length!==2)throw Error('This subtitle file is not valid SRT.');const content=lines.join('\n').trim();if(!content||content.length>120)throw Error('Keep each caption within 120 characters.');return {start:time(parts[0]),end:time(parts[1]),text:content};});
  }
  function timestamp(value){const ms=Math.round(value*1000),h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');}
  function srt(captions){return captions.map((c,i)=>`${i+1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}\n`).join('\n');}
  function frameRect(sw,sh,dw,dh,fit){const scale=fit==='cover'?Math.max(dw/sw,dh/sh):Math.min(dw/sw,dh/sh),w=sw*scale,h=sh*scale;return {x:(dw-w)/2,y:(dh-h)/2,w,h};}
  function lines(ctx,text,width){
    const out=[];for(const paragraph of text.split('\n')){let line='';for(const char of paragraph){if(line&&ctx.measureText(line+char).width>width){out.push(line.trim());line=char;}else line+=char;}out.push(line.trim());}return out;
  }
  function overlay(ctx,text,w,h,top){
    const size=Math.round(Math.min(w,h)*.055);ctx.font=`bold ${size}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    const words=lines(ctx,text,w*.86).slice(0,top?2:3);const lineHeight=size*1.28;const y=top?h*.10:h*.84-(words.length-1)*lineHeight/2;
    ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(w*.04,y-lineHeight*.6,w*.92,lineHeight*words.length+size*.15);ctx.fillStyle='#fff';words.forEach((line,i)=>ctx.fillText(line,w/2,y+i*lineHeight,w*.88));
  }
  function draw(ctx,video,project,time,w,h){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);const r=frameRect(video.videoWidth,video.videoHeight,w,h,project.fit);ctx.drawImage(video,r.x,r.y,r.w,r.h);if(project.title)overlay(ctx,project.title,w,h,true);const active=project.captions.filter(c=>time>=c.start&&time<c.end).map(c=>c.text).join('\n');if(active)overlay(ctx,active,w,h,false);}
  window.NENEEditorModel=Object.freeze({FORMATS,validate,hash,digest,parseSrt,srt,frameRect,draw});
})();
