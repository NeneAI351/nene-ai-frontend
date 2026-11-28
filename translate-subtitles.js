(() => {
  'use strict';
  const languages = { en:'English', fr:'French', es:'Spanish', pt:'Portuguese', ar:'Arabic', hi:'Hindi', de:'German', it:'Italian', yo:'Yoruba', ig:'Igbo' };
  const node = (tag, text) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    return element;
  };
  window.neneOpenTranslateSubtitles = () => {
    const main = node('main');
    const heading = node('div'); heading.className = 'toolhead';
    const back = node('button', '‹'); back.type = 'button'; back.className = 'back';
    back.setAttribute('aria-label', 'Back to AI Studio'); back.onclick = () => window.renderCreateHub();
    heading.append(back, node('h1', 'Translate subtitles'));
    const status = node('p'); status.className = 'notice'; status.setAttribute('role', 'status');
    const language = (label, value) => {
      const wrap = node('label', label); wrap.className = 'block';
      const select = node('select');
      for (const [code, title] of Object.entries(languages)) {
        const option = node('option', title); option.value = code; select.append(option);
      }
      select.value = value; wrap.append(select); main.append(wrap);
      return select;
    };
    main.append(heading);
    const from = language('Original language', 'en');
    const to = language('Translate into', 'fr');
    const fileLabel = node('label', 'Import timed subtitles (.srt)'); fileLabel.className = 'block';
    const file = node('input'); file.type = 'file'; file.accept = '.srt,application/x-subrip,text/plain'; fileLabel.append(file);
    const scriptLabel = node('label', 'Or enter your script'); scriptLabel.className = 'block';
    const script = node('textarea'); script.maxLength = 4000; scriptLabel.append(script);
    const cues = node('div'); cues.className = 'list';
    const translated = node('textarea'); translated.hidden = true; translated.setAttribute('aria-label', 'Review translated script');
    let entries = [], inputs = [], busy = false;
    const button = (label, action) => {
      const control = node('button', label); control.type = 'button'; control.className = 'btn'; control.onclick = action;
      return control;
    };
    const download = button('Download translated SRT', () => {
      if (!entries.length) return;
      const reviewed = entries.map((cue, i) => ({...cue,text:inputs[i].value.trim()}));
      if (reviewed.some(cue => !cue.text || cue.text.length > 120 || /\n\s*\n/.test(cue.text))) {
        status.textContent = 'Each subtitle needs 1–120 characters without blank lines.'; return;
      }
      const url = URL.createObjectURL(new Blob([window.NENEEditorModel.srt(reviewed)], {type:'application/x-subrip'}));
      const link = node('a'); link.href = url; link.download = 'translated-subtitles.srt'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Subtitles ready. Import the SRT in Video Editor → Captions.';
    });
    download.hidden = true;
    async function translateOnServer(source) {
      const owner = await window.neneAuthGetUserId?.();
      const token = await window.neneAuthGetAccessToken?.();
      if (!owner || !token) throw Error('Sign in to translate on this device.');
      if (source.reduce((sum,text) => sum + Array.from(text).length, 0) > 4000) throw Error('Use up to 4,000 characters per translation.');
      const base = new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl);
      if (base.protocol !== 'https:') throw Error('The secure translation service is unavailable.');
      const endpoint = new URL('/api/translation',base);
      const availability = await fetch(endpoint.href + '/availability',{cache:'no-store'});
      const quote = await availability.json();
      if (!availability.ok || !quote.available || !Number.isInteger(quote.credit_cost) || quote.credit_cost < 1) {
        throw Error('Automatic translation is unavailable. You can still edit subtitle wording manually.');
      }
      if (!window.confirm('Translate for ' + quote.credit_cost + ' paid credits?')) return null;
      if (owner !== await window.neneAuthGetUserId?.()) throw Error('Account changed. Reopen Translate & Dub.');
      const body = JSON.stringify({source:from.value,target:to.value,segments:source,credit_limit:quote.credit_cost});
      const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
      const digest = Array.from(new Uint8Array(hash),value=>value.toString(16).padStart(2,'0')).join('');
      const keyName = 'nene-translation:' + owner + ':' + digest;
      const key = localStorage.getItem(keyName) || crypto.randomUUID();
      localStorage.setItem(keyName,key);
      const response = await fetch(endpoint,{method:'POST',cache:'no-store',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':key},body});
      const data = await response.json();
      if (owner !== await window.neneAuthGetUserId?.()) throw Error('Account changed. Reopen Translate & Dub.');
      if (!response.ok) throw Error(data.detail || 'Translation could not finish.');
      if (!Array.isArray(data.segments) || data.segments.length !== source.length) throw Error('Translation could not be displayed. Retry the same text to recover it.');
      void window.neneRefreshPaidWallet?.();
      return data.segments;
    }
    const translate = button('Translate', async () => {
      if (busy) return;
      const source = entries.length ? entries.map(cue => cue.text) : [script.value.trim()];
      if (!source[0]) { status.textContent = 'Enter a script or import an SRT file.'; return; }
      if (from.value === to.value) { status.textContent = 'Choose a different target language.'; return; }
      busy = true;
      for (const field of [from,to,file,script,translate,download,translated,...inputs]) field.disabled = true;
      let translator;
      try {
        if (!window.Translator?.availability || !window.Translator?.create) {
          status.textContent = 'Checking translation price…';
          const results = await translateOnServer(source);
          if (!results || !main.isConnected) return;
          if (entries.length) inputs.forEach((input,i) => {input.value = results[i];});
          else {translated.hidden = false;translated.value = results[0];}
          status.textContent = 'Review the translation before using it.';
          return;
        }
        const options = {sourceLanguage:from.value,targetLanguage:to.value};
        if (await window.Translator.availability(options) === 'unavailable') {
          status.textContent = 'This language pair is unavailable. Choose another pair or enter the translation yourself.'; return;
        }
        status.textContent = 'Preparing the browser translator…';
        translator = await window.Translator.create(options);
        const results = [];
        for (const text of source) {
          if (!main.isConnected) return;
          status.textContent = 'Translating…';
          results.push(await translator.translate(text));
        }
        if (entries.length) inputs.forEach((input, i) => {input.value = results[i];});
        else {translated.hidden = false; translated.value = results[0];}
        status.textContent = 'Review the translation before using it.';
      } catch (error) {
        status.textContent = error.message || 'Translation could not finish. Retry the same text or enter translated wording manually.';
      } finally {
        translator?.destroy?.();
        busy = false;
        for (const field of [from,to,file,script,translate,download,translated,...inputs]) field.disabled = false;
      }
    });
    file.onchange = async () => {
      const picked = file.files?.[0];
      if (!picked || busy) return;
      try {
        if (picked.size > 64000) throw Error('Use an SRT file under 64 KB.');
        const parsed = window.NENEEditorModel.parseSrt(await picked.text());
        if (file.files?.[0] !== picked || !main.isConnected) return;
        entries = parsed; inputs = []; cues.replaceChildren();
        for (const [index, cue] of entries.entries()) {
          const label = node('label', (index + 1) + '. ' + cue.text); label.className = 'block';
          const textarea = node('textarea'); textarea.maxLength = 120; textarea.value = cue.text;
          inputs.push(textarea); label.append(textarea); cues.append(label);
        }
        scriptLabel.hidden = true; translated.hidden = true; download.hidden = false;
        status.textContent = 'Edit or translate each subtitle. Original timings are kept.';
      } catch (error) { status.textContent = error.message; }
    };
    const clear = button('Use a script instead', () => {
      if (busy) return;
      entries = []; inputs = []; cues.replaceChildren(); file.value = ''; scriptLabel.hidden = false;
      download.hidden = true; translated.hidden = true; status.textContent = '';
    });
    const voice = button('Use reviewed text in AI Voice', async () => {
      if (busy) return;
      const text = (entries.length ? inputs.map(input=>input.value.trim()).join(' ') : translated.value).trim();
      if (!text || text.length > 120) {
        status.textContent = 'Use reviewed text of 1–120 characters for a voice track.';return;
      }
      const owner = await window.neneAuthGetUserId?.();
      if (!owner) {status.textContent = 'Sign in to create a voice track.';return;}
      await window.neneOpenVideoStudio?.('talking',{voiceOnly:true});
      if (owner !== await window.neneAuthGetUserId?.()) return;
      const dialogue = document.getElementById('talking-dialogue');
      if (dialogue && !dialogue.value) {
        dialogue.value = text;
        dialogue.dispatchEvent(new Event('input',{bubbles:true}));
      }
    });
    const editor = button('Open Video Editor', () => window.neneOpenVideoEditor?.({tool:'Captions'}));
    main.append(fileLabel, scriptLabel, clear, translate, status, cues, translated, download, voice, editor);
    window.setNav('create');
    document.getElementById('screen').replaceChildren(main);
  };
})();
