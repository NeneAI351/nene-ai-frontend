/* Compact Studio discovery with native horizontal swiping and accessible controls. */
(() => {
  'use strict';
  const tools = [
    ['🎭','Character Studio','Create reusable characters, outfits and reference looks.','characters'],
    ['✍️','AI Script Writer','Hooks, scripts, scenes, dialogue and CTAs.','script'],
    ['🎙️','AI Voice','Narration, voices and lip-sync workflow.','voice'],
    ['🎵','Music + SFX','Generate or select music and sound effects.','audio'],
    ['💬','Captions','Caption styles and SRT workflow.','captions'],
    ['🌍','Translate & Dub','Localize videos for global audiences.','translate'],
    ['✂️','AI Video Editor','Join clips, add captions and sound, then export.','editor'],
    ['🏷️','Brand Kit','Logo, fonts, colors and brand-safe outputs.','brand'],
    ['🧩','Model Lab','Compare models for your next scene.','models'],
    ['📐','Formats & Reframe','Reframe videos for different platforms.','formats'],
    ['🪄','AI Image Studio','Reference images, scenes and product visuals.','images'],
    ['✨','Enhance & Upscale','Refine finished visuals.','enhance']
  ];
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const card = ([icon,title,description,key]) => {
    const button=node('button',undefined,'tool-mini');button.type='button';button.dataset.studioTool=key;
    const image=node('div',icon);image.setAttribute('aria-hidden','true');image.style.fontSize='22px';
    button.append(image,node('b',title),node('small',description));
    // Reuse the existing account-protected tool entry point.
    button.onclick=()=>window.openFeature(key);return button;
  };
  function mount(container){
    container.replaceChildren();
    const track=node('div',undefined,'studio-track');track.tabIndex=0;track.setAttribute('role','region');
    track.setAttribute('aria-roledescription','carousel');track.setAttribute('aria-label','AI Studio tools. Swipe left or right, or use the page controls.');
    const pages=[];
    for(let start=0;start<tools.length;start+=4){
      const page=node('div',undefined,'studio-page');page.setAttribute('role','group');page.setAttribute('aria-label',`Tools ${start+1} to ${Math.min(start+4,tools.length)} of ${tools.length}`);
      for(const tool of tools.slice(start,start+4))page.append(card(tool));track.append(page);pages.push(page);
    }
    const controls=node('div',undefined,'studio-controls');
    const previous=node('button','‹','studio-page-button'),next=node('button','›','studio-page-button');
    previous.type=next.type='button';previous.setAttribute('aria-label','Previous AI Studio page');next.setAttribute('aria-label','Next AI Studio page');
    const dots=node('div',undefined,'studio-dots');dots.setAttribute('role','group');dots.setAttribute('aria-label','Choose AI Studio page');
    const status=node('span','1 / 3','studio-page-status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
    let current=0;
    function update(index){current=Math.max(0,Math.min(pages.length-1,index));previous.disabled=current===0;next.disabled=current===pages.length-1;
      for(const [i,dot] of [...dots.children].entries())dot.setAttribute('aria-current',String(i===current));status.textContent=`${current+1} / ${pages.length}`;}
    function step(){return pages.length>1?(pages[1].offsetLeft-pages[0].offsetLeft || Math.max(1,track.clientWidth-12)):1;}
    function go(index){index=Math.max(0,Math.min(pages.length-1,index));update(index);
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(typeof track.scrollTo==='function')track.scrollTo({left:index*step(),behavior:reduced?'auto':'smooth'});else track.scrollLeft=index*step();}
    for(let index=0;index<pages.length;index++){
      const dot=node('button',undefined,'studio-dot');dot.type='button';dot.setAttribute('aria-label',`Show AI Studio page ${index+1} of ${pages.length}`);
      const indicator=node('span');indicator.setAttribute('aria-hidden','true');dot.append(indicator);dot.onclick=()=>go(index);dots.append(dot);
    }
    previous.onclick=()=>go(current-1);next.onclick=()=>go(current+1);
    track.addEventListener('scroll',()=>update(Math.round(track.scrollLeft/step())),{passive:true});
    track.addEventListener('keydown',event=>{
      if(event.target!==track)return;
      const target={ArrowRight:current+1,ArrowLeft:current-1,Home:0,End:pages.length-1}[event.key];
      if(target!==undefined){event.preventDefault();go(target);}
    });
    controls.append(previous,dots,status,next);container.append(track,controls);update(0);
  }
  window.neneMountStudioSections=()=>{
    document.querySelectorAll('[data-studio-carousel]').forEach(mount);
    document.querySelectorAll('.recent-projects [data-project-id]').forEach(button=>{
      button.onclick=()=>window.openProject(button.dataset.projectId);
    });
  };
  window.neneOpenStudio=()=>{
    const main=node('main');const header=node('div',undefined,'toolhead');const back=node('button','‹','back');back.type='button';back.setAttribute('aria-label','Back to Home');back.onclick=()=>window.renderHome();
    header.append(back,node('h1','AI Studio'));main.append(header,node('p','Explore all 12 Studio tools. Choose a tool to continue.','subtitle'));
    const grid=node('div',undefined,'studio-all-grid');for(const tool of tools)grid.append(card(tool));main.append(grid);
    window.setNav('create');document.getElementById('screen').replaceChildren(main);window.scrollTo?.({top:0,behavior:'auto'});
  };
  const fullscreenButton=document.getElementById('neneFullscreenButton');
  function fullscreenLabel(){if(!fullscreenButton)return;const on=!!document.fullscreenElement;fullscreenButton.setAttribute('aria-label',on?'Exit full screen':'Enter full screen');fullscreenButton.title=on?'Exit full screen':'Full screen';fullscreenButton.setAttribute('aria-pressed',String(on));}
  if(fullscreenButton){fullscreenButton.onclick=async()=>{
    try{
      if(document.fullscreenElement){if(document.exitFullscreen)await document.exitFullscreen();}
      else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else throw new Error('unsupported');
      fullscreenLabel();
    }catch(_){if(typeof window.toast==='function')window.toast('Full screen is unavailable here. Add NENE AI to your home screen for an app view.');}
  };document.addEventListener('fullscreenchange',fullscreenLabel);fullscreenLabel();}
  window.neneMountStudioSections();
})();
