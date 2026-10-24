/* Shared presentation only: payment gates, quotes and ownership stay in each tool. */
(() => {
 'use strict';
 const views=new Set();
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 async function account(ui){
  const version=++ui.version;
  try{const owner=await window.neneAuthGetUserId?.();if(version!==ui.version||!ui.root.isConnected)return;
   ui.signin.hidden=!!owner;ui.badge.textContent=owner?'Signed in':'Sign in to create';ui.badge.classList.toggle('is-connected',!!owner);
  }catch(_){if(version===ui.version){ui.signin.hidden=false;ui.badge.textContent='Check your sign-in';}}
 }
 function enhance(options){
  for(const old of views)if(!old.root.isConnected){old.observer.disconnect();old.emptyObserver?.disconnect();views.delete(old);}
  const {root,form,signin,check,refresh,review,generate,jobs,getState}=options;
  root.classList.add('creation-studio');
  const ui={root,signin,version:0},bar=node('div',undefined,'studio-account'),badge=node('span','Checking account…','studio-account-status');ui.badge=badge;
  signin.textContent='Sign in';signin.classList.add('studio-text-button');bar.append(badge,signin);
  if(check){check.textContent='Refresh';check.title='Refresh availability and saved work';check.classList.add('studio-text-button');bar.append(check);}
  const heading=root.querySelector('.toolhead');if(heading)heading.after(bar);else root.prepend(bar);
  const notes=[...root.children].filter(n=>n.matches('p.notice')&&!n.id);
  if(notes.length){const details=node('details',undefined,'studio-info');details.append(node('summary','About credits and output'));for(const note of notes)details.append(note);const anchor=form||root.querySelector('label');if(anchor)anchor.before(details);else bar.after(details);}
  if(options.settings){const target=form||root;const blocks=[...target.children].filter(n=>n.classList.contains('block')&&n.querySelector('select'));
   if(blocks.length){const settings=node('section',undefined,'studio-settings'),grid=node('div',undefined,'studio-settings-grid');settings.append(node('h2','Creation settings'),grid);blocks[0].before(settings);for(const block of blocks){grid.append(block);const select=block.querySelector('select');for(const option of select.options){if(/^\d+$/.test(option.value)&&/duration/i.test(select.name+' '+select.id))option.textContent=option.value+' seconds';if(['16:9','9:16','1:1'].includes(option.value))option.textContent=option.value+' · '+({'16:9':'Landscape','9:16':'Portrait','1:1':'Square'}[option.value]);}}}
  }
  const actions=node('div',undefined,'studio-actions');(review||generate).before(actions);if(review){review.classList.add('gold');actions.append(review);}actions.append(generate);
  if(refresh){refresh.textContent='Refresh selected video';refresh.classList.add('studio-text-button');const row=node('div',undefined,'studio-saved-actions');refresh.before(row);row.append(refresh);}
  if(jobs){const empty=node('div',undefined,'studio-empty');empty.append(node('strong','Your next creation starts here'),node('p','Saved work will appear here. Create something above, or refresh to check existing work.'));jobs.after(empty);
   const syncEmpty=()=>{empty.hidden=jobs.childElementCount>0;};const obs=new MutationObserver(syncEmpty);obs.observe(jobs,{childList:true});ui.emptyObserver=obs;syncEmpty();}
  const sync=()=>{
   if(getState&&review){const state=getState(),ready=!!(state.quote||state.pending);if(generate.hidden!==!ready)generate.hidden=!ready;if(review.hidden!==ready)review.hidden=ready;}
   if(refresh){const hide=refresh.disabled;if(refresh.hidden!==hide)refresh.hidden=hide;}
  };
  const observer=new MutationObserver(sync);observer.observe(generate,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true});if(refresh)observer.observe(refresh,{attributes:true,attributeFilter:['disabled']});ui.observer=observer;sync();
  views.add(ui);account(ui);return ui;
 }
 window.NENEStudioUI={enhance};
 window.addEventListener('nene-auth-changed',()=>{for(const ui of views){if(!ui.root.isConnected){ui.observer.disconnect();ui.emptyObserver?.disconnect();views.delete(ui);}else account(ui);}});
})();
