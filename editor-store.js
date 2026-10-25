/* Owner-scoped device storage. Originals/drafts/exports never go to the API. */
(() => {
  'use strict';
  const DB='nene-editor-v2';let opening=null;
  function open(){
    if(!window.indexedDB)return Promise.reject(Error('Device storage is unavailable. Enable browser storage before purchasing an export.'));
    if(!opening)opening=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{const store=req.result.createObjectStore('items',{keyPath:'key'});store.createIndex('owner','owner');};req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();opening=null;};resolve(req.result);};req.onerror=()=>{opening=null;reject(Error('Device storage could not open. No credits were charged.'));};req.onblocked=()=>reject(Error('Close other NENE AI tabs, then reopen the editor.'));});return opening;
  }
  async function operation(mode,fn){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('items',mode),store=tx.objectStore('items');let value;tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(Error('This device could not save the file. Free some storage and try again. No export purchase was sent.'));fn(store,v=>{value=v;});});}
  const key=(owner,id)=>owner+':'+id;
  const get=(owner,id)=>operation('readonly',(store,set)=>{store.get(key(owner,id)).onsuccess=e=>set(e.target.result||null);});
  const put=(owner,id,data)=>operation('readwrite',(store,set)=>{const value={...data,key:key(owner,id),owner,id,updatedAt:Date.now()};store.put(value);set(value);});
  const remove=(owner,id)=>operation('readwrite',store=>store.delete(key(owner,id)));
  const list=owner=>operation('readonly',(store,set)=>{store.index('owner').getAll(owner).onsuccess=e=>set(e.target.result.filter(v=>v.id.startsWith('export:')).sort((a,b)=>b.updatedAt-a.updatedAt));});
  async function clearOwner(owner){return operation('readwrite',store=>{const req=store.index('owner').openCursor(IDBKeyRange.only(owner));req.onsuccess=()=>{const cursor=req.result;if(cursor){cursor.delete();cursor.continue();}};});}
  window.NENEEditorStore=Object.freeze({get,put,remove,list,clearOwner});
})();
