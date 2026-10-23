/* Profile actions. Local drafts are explicitly labelled and never claim server delivery. */
(() => {
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const button=(label,action)=>`<button type="button" class="btn" data-profile-action="${action}">${label}</button>`;
 let owner=null,epoch=0;
 function key(){if(!owner)throw Error('Sign in first.');return 'nene_profile_v1:'+owner;}
 function read(){try{return JSON.parse(localStorage.getItem(key())||'{}');}catch(_){return {};}}
 function save(value){try{localStorage.setItem(key(),JSON.stringify(value));return true;}catch(_){toast('Could not save. Browser storage may be full or blocked.');return false;}}
 function download(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function modal(title,text,actions=''){showModal(`<h2>${esc(title)}</h2><p class="subtitle">${esc(text)}</p><div class="list">${actions}${button('Close','close')}</div>`);bind(document.getElementById('modal')||document);}
 function bind(root){root.querySelectorAll('[data-profile-action]').forEach(el=>{el.onclick=()=>act(el.dataset.profileAction);});}
 async function authenticated(){if(!await window.neneRequireAccount?.())return false;owner=await window.neneAuthGetUserId?.();return !!owner;}
 const icons={create:'M12 5v14M5 12h14',characters:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M17 11h6',jobs:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',brand:'M20 13l-7 7L3 10V3h7zM7 7h.01',account:'M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8',privacy:'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 18h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',legal:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7'};
 const icon=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[key]||icons.help}"/></svg>`;
 const groups=[
 ['account','Account','Sign-in, preferences and workspace',[['Account & security','account'],['Languages & localization','languages','English · More coming soon'],['Teams & collaboration','teams','Coming soon'],['Export & publishing','export','Downloads · Auto publishing coming soon']]],
 ['privacy','Privacy & Safety','Your data, content and rights',[['Privacy Center','privacy'],['Safety & content controls','safety'],['AI content disclosure','disclosure'],['Rights & commercial use','rights'],['Report abuse','abuse','Drafts only']]],
 ['help','Help & Feedback','Get guidance and share your ideas',[['Rate NENE AI','rating','Local draft'],['Report a problem','problem','Local draft'],['Suggest a feature','suggestion','Local draft'],['Failed generation & credit recovery','recovery'],['Usage & fair use','usage']]],
 ['legal','Legal','Policies and service terms',[['Privacy notice','policy'],['Terms of Service','terms'],['Paid credits & refund policy','credits']]]
 ];
 const settingRow=([label,action,note])=>`<button type="button" class="profile-setting-row" data-profile-action="${action}"><span><span class="profile-row-label">${esc(label)}</span>${note?`<small class="profile-row-note">${esc(note)}</small>`:''}</span><span class="profile-chevron" aria-hidden="true">›</span></button>`;
 function paintPhoto(value){const slot=document.getElementById('profilePortrait');if(!slot)return;slot.replaceChildren();if(/^data:image\/(png|jpeg|webp);base64,/.test(value.photo||'')){const img=document.createElement('img');img.src=value.photo;img.alt='Your profile photo';slot.append(img);}else slot.textContent=(value.displayName||'N').slice(0,1).toUpperCase();}
 window.renderProfile=async()=>{
  const ticket=++epoch;setNav('profile');
  document.getElementById('screen').innerHTML=`<main data-profile-page class="profile-page"><div class="profile-page-heading"><div><div class="eyebrow">Your space</div><h1>Profile</h1></div><span class="profile-brand-label">NENE AI</span></div>
  <section class="profile-identity" aria-label="Your profile"><div id="profilePortrait" class="profile-portrait" aria-label="Profile picture">N</div><div class="profile-identity-copy"><h2 id="profileDisplayName">NENE AI Creator</h2><p id="neneAuthAccountName">Not signed in</p><span class="profile-status" id="profileStatus">Your creative workspace</span></div><button type="button" class="profile-edit" data-profile-action="name">Edit profile</button></section>
  <section class="profile-wallet" aria-label="Paid credits"><div><span class="profile-wallet-label">Your balance</span><p id="profilePaidBalance">Paid credits: checking…</p><small>For your next creation</small></div><button type="button" class="profile-credit-button" data-profile-action="credits">View credits <span aria-hidden="true">↗</span></button></section>
  <section aria-labelledby="profile-workspace-heading"><div class="profile-section-heading"><h2 id="profile-workspace-heading">Workspace</h2><span>Keep creating</span></div><div class="profile-shortcuts">${[['create','Create'],['characters','Characters'],['jobs','Generations'],['brand','Brand Kit']].map(([action,label])=>`<button type="button" class="profile-shortcut" data-profile-action="${action}"><span class="profile-shortcut-icon">${icon(action)}</span><span>${label}</span></button>`).join('')}</div></section>
  <section aria-labelledby="profile-settings-heading"><div class="profile-section-heading"><h2 id="profile-settings-heading">Settings & support</h2></div><div class="profile-groups">${groups.map(([key,title,description,items])=>`<details class="profile-group"><summary><span class="profile-group-icon">${icon(key)}</span><span class="profile-group-copy"><b>${title}</b><small>${description}</small></span><span class="profile-expand" aria-hidden="true">⌄</span></summary><div class="profile-group-content">${items.map(settingRow).join('')}</div></details>`).join('')}</div></section>
  <div class="profile-session-footer"><p id="neneAuthSummary" class="profile-auth-summary">Checking sign-in…</p><button type="button" class="profile-session-button" data-profile-action="signin">Account / Sign in</button><button type="button" class="profile-signout" data-profile-action="signout">Sign out</button></div></main>`;
  bind(document.querySelector('[data-profile-page]'));
  let id=null;try{id=await window.neneAuthGetUserId?.();}catch(_){}
  if(ticket!==epoch||!document.querySelector('[data-profile-page]'))return;
  owner=id;const value=read();document.getElementById('profileDisplayName').textContent=value.displayName||'NENE AI Creator';paintPhoto(value);document.getElementById('profileStatus').textContent=owner?'Personal workspace':'Sign in to create';document.querySelector('[data-profile-action=signin]').textContent=owner?'Manage account':'Sign in / Create account';
  document.getElementById('profilePaidBalance').textContent='Paid credits: '+(Number.isFinite(window.NENE_PAID_WALLET)?window.NENE_PAID_WALLET:'unavailable');
  document.querySelector('[data-profile-action="signout"]').disabled=!owner;
 };
 async function form(kind){
  if(!await authenticated())return;
  const state=read(), formOwner=owner;
  if(kind==='brand'){
   showModal(`<h2>Brand Kit</h2><p class="subtitle">Saved for this account in this browser. This is a creative brief; it does not automatically change generated videos.</p><form id="profileForm"><label>Brand name<input class="field" name="name" required maxlength="100"></label><label>Brand colors<input class="field" name="colors" maxlength="150" placeholder="e.g. black and gold"></label><label>Typography<input class="field" name="font" maxlength="100"></label><label>Brand rules<textarea name="rules" maxlength="3000"></textarea></label><button class="btn gold" type="submit">Save brand kit</button></form>${button('Download brand kit','downloadBrand')}${button('Close','close')}`);
   const f=document.getElementById('profileForm');for(const name of ['name','colors','font','rules'])f.elements[name].value=state.brand?.[name]||'';
   f.onsubmit=async e=>{e.preventDefault();if(formOwner!==await window.neneAuthGetUserId?.()){closeModal();toast('Account changed. Open this form again.');return;}owner=formOwner;const next=read();next.brand=Object.fromEntries(new FormData(f));if(save(next)){closeModal();toast('Brand kit saved in this browser.');}};
  }else{
   const titles={rating:'Rate NENE AI',problem:'Report a problem',suggestion:'Suggest a feature',abuse:'Report Abuse'};
   showModal(`<h2>${titles[kind]}</h2><p class="notice">Support delivery is not connected. Save and download your report below. It will stay in this browser; it has not been sent to NENE AI.</p><form id="profileForm">${kind==='rating'?'<label>Rating<select name="rating" required><option value="">Choose a rating</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>':''}<label>Your message<textarea name="message" maxlength="5000" required placeholder="Do not include passwords, API keys or card details."></textarea></label><button type="submit" class="btn gold">Save draft</button></form>${button('Download saved reports','downloadReports')}${button('Close','close')}`);
   const f=document.getElementById('profileForm');f.onsubmit=async e=>{e.preventDefault();if(formOwner!==await window.neneAuthGetUserId?.()){closeModal();toast('Account changed. Open this form again.');return;}owner=formOwner;const data=Object.fromEntries(new FormData(f));if(!String(data.message||'').trim())return;const next=read();next.reports=[{kind,...data,createdAt:new Date().toISOString()},...(next.reports||[])].slice(0,50);if(save(next)){closeModal();modal('Report draft saved','Saved in this browser only. Download it to keep a copy. Nothing has been sent.',button('Download saved reports','downloadReports'));}};
  }bind(document);
 }
 async function act(action){
  if(action==='close'){closeModal();return;}
  if(action==='signin'){window.neneOpenAuth();return;}
  if(action==='signout'){await window.neneSignOut();window.renderProfile();return;}
  if(action==='create'){closeModal();window.renderCreateHub();return;}
  if(action==='characters'){closeModal();window.openFeature('characters');return;}
  if(action==='jobs'||action==='recovery'){closeModal();window.renderJobCenter();return;}
  if(action==='credits'){window.neneOpenPaidCredits();return;}
  if(action==='terms'){window.location.href='./terms.html';return;}
  if(action==='policy'){window.location.href='./privacy.html';return;}
  if(['rating','problem','suggestion','abuse','brand'].includes(action)){await form(action);return;}
  if(action==='account'){modal('Account & Security','Manage sign-in and recovery. Account deletion is unavailable until the server-side deletion process is implemented.',button('Your account / Sign in','signin')+button('Account recovery','reset')+button('Edit profile','name'));return;}
  if(action==='reset'){window.neneOpenAuth('reset');return;}
  if(action==='name'){
   if(!await authenticated())return;showModal(`<h2>Edit profile</h2><p class="subtitle">Saved for this account in this browser.</p><form id="profileForm"><label>Name<input class="field" name="displayName" maxlength="80" required></label><label>Profile photo<input class="field" type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label><p class="subtitle">Optional PNG, JPEG or WebP, up to 400 KB. Your profile stays in this browser.</p><p id="profilePhotoError" role="status"></p><button class="btn gold">Save profile</button></form>${button('Close','close')}`);const formOwner=owner;const f=document.getElementById('profileForm');f.elements.displayName.value=read().displayName||'';f.onsubmit=async e=>{e.preventDefault();if(formOwner!==await window.neneAuthGetUserId?.()){closeModal();toast('Account changed. Open this form again.');return;}owner=formOwner;const next=read();next.displayName=f.elements.displayName.value.trim();const file=f.elements.photo.files?.[0];if(file){if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>400*1024){document.getElementById('profilePhotoError').textContent='Choose a PNG, JPEG or WebP photo smaller than 400 KB.';return;}try{const photo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});await new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=photo;});if(formOwner!==await window.neneAuthGetUserId?.()){closeModal();return;}next.photo=photo;}catch(_){document.getElementById('profilePhotoError').textContent='This image could not be opened. Choose another photo.';return;}}if(next.displayName&&save(next)){closeModal();window.renderProfile();}};bind(document);return;
  }
  if(action==='privacy'){modal('Privacy Center','Account authentication, private generation storage and server authorization protect your account data. Local brand kits and report drafts are stored in this browser. No toggle here can disable server retention or required security controls.',button('Read privacy notice','policy')+button('Download local profile data','downloadData')+button('Clear local profile drafts','clearDrafts'));return;}
  if(action==='clearDrafts'){if(!await authenticated())return;modal('Clear local profile drafts?','This clears this browser’s display name, brand kit and report drafts. It does not delete your account, server data, credits or videos. Download a copy first if needed.',button('Download local profile data','downloadData')+button('Confirm clear drafts','confirmClear'));return;}
  if(action==='confirmClear'){if(!await authenticated())return;try{localStorage.removeItem(key());closeModal();toast('Local profile drafts cleared.');window.renderProfile();}catch(_){toast('Could not clear local drafts.');}return;}
  if(['downloadData','downloadBrand','downloadReports'].includes(action)){if(!await authenticated())return;const data=read();download(action==='downloadBrand'?(data.brand||{}):action==='downloadReports'?(data.reports||[]):data,'nene-'+action+'.json');return;}
  if(action==='export'){modal('Export & Publishing','Open My Creations to view available outputs and their download controls. Automated social publishing and scheduled posting are not connected.',button('Open My Creations','creations'));return;}
  if(action==='creations'){closeModal();window.renderCreations();return;}
  const info={
   safety:['Safety & Content Controls','Only upload assets you own or have permission to use. Obtain consent for likeness and voice use. Do not create abusive, unlawful or impersonating content. Provider safety checks cannot be disabled here.'],
   disclosure:['AI Content Disclosure','Clearly label AI-generated content when publishing where required by the destination platform or applicable rules. NENE AI does not currently verify provenance metadata or automatically publish disclosure labels.'],
   rights:['Rights & Commercial Use','You must have rights to uploaded images, music, brands and voices. Output rights depend on the provider and the assets used; a paid credit purchase is not a guarantee of copyright or commercial clearance. Review the terms before commercial use.'],
   languages:['Languages & Localization','The interface is currently English. Translation and dubbing services are not connected, so this control cannot yet translate the interface or produce dubbed audio.'],
   teams:['Teams & Collaboration','Team invitations and shared editing are not connected. Your account does not grant anyone else access. Never share your password to collaborate.'],
   usage:['Usage & Fair Use','Generation requires paid credits and a server-approved price. Requests may be rate limited or queued. Retrying a request does not create a new paid job when the original request is still being resolved. See Generation Center before submitting again.']
  };
  if(info[action])modal(...info[action],action==='safety'?button('Prepare an abuse report','abuse'):action==='rights'?button('Read terms','terms'):'');
 }
 // Replace prototype feature routes before the authentication allowlist is installed.
 const original=window.openFeature;
 window.openFeature=function(type){if(['brand','privacy','safety','account'].includes(type))return act(type);return original.apply(this,arguments);};
 window.addEventListener('nene-auth-changed',()=>{owner=null;epoch++;if(document.querySelector('[data-profile-page]'))window.renderProfile();});
})();
