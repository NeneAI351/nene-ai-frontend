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
    const translate = button('Translate', async () => {
      if (busy) return;
      const source = entries.length ? entries.map(cue => cue.text) : [script.value.trim()];
      if (!source[0]) { status.textContent = 'Enter a script or import an SRT file.'; return; }
      if (!window.Translator?.availability || !window.Translator?.create) {
        status.textContent = 'Automatic translation is unavailable in this browser. You can enter translated wording manually.';
        return;
      }
      if (from.value === to.value) { status.textContent = 'Choose a different target language.'; return; }
      busy = true;
      for (const field of [from,to,file,script,translate,download,translated,...inputs]) field.disabled = true;
      let translator;
      try {
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
      } catch {
        status.textContent = 'Translation could not finish. Try again or enter translated wording manually.';
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
    const editor = button('Open Video Editor', () => window.neneOpenVideoEditor?.({tool:'Captions'}));
    main.append(fileLabel, scriptLabel, clear, translate, status, cues, translated, download, editor);
    if (!window.Translator?.create) {
      translate.disabled = true;
      status.textContent = 'Automatic translation is unavailable in this browser. Import an SRT and enter your translated wording to keep the original timing.';
    }
    window.setNav('create');
    document.getElementById('screen').replaceChildren(main);
  };
})();
