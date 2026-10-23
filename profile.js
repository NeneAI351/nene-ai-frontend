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
 const sections=[
 ['Workspace',[['＋ Create','create'],['🎭 Characters','characters'],['⚙️ Generation Center','jobs'],['🏷️ Brand Kit','brand'],['🔐 Privacy Center','privacy'],['👤 Account & Security','account']]],
 ['Credits & Plans',[['＋ Paid credits & refund policy','credits']]],
 ['Reviews & Feedback',[['⭐ Rate NENE AI','rating'],['⚠️ Report a problem','problem'],['💡 Suggest a feature','suggestion']]],
 ['Safety & Trust',[['🛡️ Safety & Content Controls','safety'],['🏷️ AI Content Disclosure','disclosure'],['© Rights & Commercial Use','rights']]],
 ['Global & Business',[['🌍 Languages & Localization','languages'],['👥 Teams & Collaboration','teams'],['📤 Export & Publishing','export'],['↻ Failed Generation & Credit Recovery','recovery'],['🚩 Report Abuse','abuse'],['⚖️ Usage & Fair Use','usage']]],
 ['Legal',[['Privacy Policy','policy'],['Terms of Service','terms']]]
 ];
 window.renderProfile=async()=>{
  const ticket=++epoch;setNav('profile');
  document.getElementById('screen').innerHTML=`<main data-profile-page><div class="eyebrow">Account</div><h1>Your Profile</h1><div class="profile-card"><h2 id="profileDisplayName">NENE AI Creator</h2><p class="subtitle">Your creative workspace</p><p id="profilePaidBalance" class="notice">Paid credits: checking…</p></div><h2>Secure account</h2><div class="notice" id="neneAuthSummary">Checking sign-in…</div><p id="neneAuthAccountName">Not signed in</p><div class="list">${button('Account / Sign in','signin')}${button('Sign out','signout')}</div>${sections.map(([name,items])=>`<h2 class="section-title">${esc(name)}</h2><div class="list">${items.map(([label,action])=>button(label,action)).join('')}</div>`).join('')}</main>`;
  bind(document.querySelector('[data-profile-page]'));
  let id=null;try{id=await window.neneAuthGetUserId?.();}catch(_){}
  if(ticket!==epoch||!document.querySelector('[data-profile-page]'))return;
  owner=id;const value=read();document.getElementById('profileDisplayName').textContent=value.displayName||'NENE AI Creator';
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
  if(action==='account'){modal('Account & Security','Manage sign-in and recovery. Account deletion is unavailable until the server-side deletion process is implemented.',button('Your account / Sign in','signin')+button('Account recovery','reset')+button('Edit display name','name'));return;}
  if(action==='reset'){window.neneOpenAuth('reset');return;}
  if(action==='name'){
   if(!await authenticated())return;showModal(`<h2>Display name</h2><p class="subtitle">Saved for this account in this browser.</p><form id="profileForm"><label>Name<input class="field" name="displayName" maxlength="80" required></label><button class="btn gold">Save name</button></form>${button('Close','close')}`);const formOwner=owner;const f=document.getElementById('profileForm');f.elements.displayName.value=read().displayName||'';f.onsubmit=async e=>{e.preventDefault();if(formOwner!==await window.neneAuthGetUserId?.()){closeModal();toast('Account changed. Open this form again.');return;}owner=formOwner;const next=read();next.displayName=f.elements.displayName.value.trim();if(next.displayName&&save(next)){closeModal();window.renderProfile();}};bind(document);return;
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
