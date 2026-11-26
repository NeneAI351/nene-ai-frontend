/* Photo Design is displayed only when the backend enables paid edits. */
(() => {
  'use strict';
  const limit = 7 * 1024 * 1024;
  const formats = new Set(['image/png', 'image/jpeg', 'image/webp']);

  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };

  async function request(owner, path, options = {}) {
    const token = await window.neneAuthGetAccessToken?.();
    if (!token || await window.neneAuthGetUserId?.() !== owner) {
      throw new Error('Sign in again to continue editing.');
    }
    const base = new URL(window.NENE_DIRECTOR_CONFIG?.backendUrl);
    if (base.protocol !== 'https:') throw new Error('Photo Design is unavailable.');
    const response = await fetch(new URL('/api/photo-design/' + path, base), {
      ...options,
      cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, ...options.headers },
    });
    if (await window.neneAuthGetUserId?.() !== owner) {
      throw new Error('The account changed. Reopen Photo Design.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.detail === 'string' ? data.detail : 'Photo Design is unavailable.');
    }
    return data;
  }

  window.neneLoadSavedPhotos = async container => {
    if (!container) return;
    const owner = await window.neneAuthGetUserId?.();
    if (!owner) return;
    try {
      const { edits } = await request(owner, 'edits');
      if (!container.isConnected || !edits?.length) return;
      container.append(node('h2', 'Saved photos'));
      for (const edit of edits) {
        const url = new URL(edit.image_url);
        if (url.protocol !== 'https:') continue;
        const link = node('a');
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener';
        const image = node('img');
        image.src = url.href;
        image.alt = 'Open edited photo';
        image.loading = 'lazy';
        image.style.maxWidth = '100%';
        link.append(image);
        container.append(link);
      }
    } catch {
      if (container.isConnected) container.append(node('p', 'Saved photos are unavailable right now.'));
    }
  };

  window.neneOpenPhotoDesign = async () => {
    const screen = document.getElementById('screen');
    const root = node('main');
    const head = node('div', '', 'toolhead');
    const back = node('button', '‹', 'back');
    back.setAttribute('aria-label', 'Back to AI Studio');
    back.onclick = () => window.neneOpenStudio();
    head.append(back, node('h1', 'Photo Design'));
    const status = node('p', 'Checking availability…', 'notice');
    status.setAttribute('role', 'status');
    root.append(head, status);
    window.setNav('create');
    screen.replaceChildren(root);
    const owner = await window.neneAuthGetUserId?.();
    if (!owner) {
      status.textContent = 'Sign in to use Photo Design.';
      const signIn = node('button', 'Sign in', 'btn gold');
      signIn.onclick = () => window.neneOpenAuth?.();
      root.append(signIn);
      return;
    }

    let availability;
    try {
      availability = await request(owner, 'availability');
    } catch {
      status.textContent = 'Photo Design is unavailable right now.';
      return;
    }
    if (!root.isConnected) return;
    if (!availability.available) {
      status.textContent = 'Photo Design is unavailable right now.';
      return;
    }

    const form = node('form', '', 'list');
    const fileLabel = node('label', 'Upload a photo', 'block');
    const file = node('input');
    file.type = 'file';
    file.accept = [...formats].join(',');
    file.required = true;
    fileLabel.append(file);
    const promptLabel = node('label', 'Describe what to change', 'block');
    const prompt = node('textarea');
    prompt.required = true;
    prompt.maxLength = 2000;
    prompt.placeholder = 'Change my shirt to a navy blazer. Keep my face, pose, and background the same.';
    promptLabel.append(prompt);
    const original = node('img');
    original.alt = 'Original photo';
    original.hidden = true;
    const edited = node('img');
    edited.alt = 'Edited photo';
    edited.hidden = true;
    for (const image of [original, edited]) image.style.maxWidth = '100%';
    const button = node('button', 'Review credit cost', 'btn gold');
    button.type = 'submit';
    const save = node('button', 'Save to My Creations', 'btn');
    save.type = 'button';
    save.hidden = true;
    form.append(fileLabel, promptLabel, button);
    root.append(form, original, edited, save);

    let quote;
    let edit;
    let objectUrl;
    let busy = false;
    status.textContent = 'Choose a PNG, JPEG, or WebP photo up to 7 MB. Describe the change you want, such as changing an outfit, replacing the background, or removing an object.';

    function reset() {
      quote = undefined;
      edit = undefined;
      edited.removeAttribute('src');
      edited.hidden = true;
      save.hidden = true;
      button.textContent = 'Review credit cost';
    }

    function clearPreview() {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
      original.removeAttribute('src');
      original.hidden = true;
    }

    const observer = new MutationObserver(() => {
      if (!root.isConnected) {
        observer.disconnect();
        clearPreview();
      }
    });
    observer.observe(screen, { childList: true });
    file.onchange = () => {
      reset();
      clearPreview();
      const photo = file.files[0];
      if (photo && formats.has(photo.type) && photo.size > 0 && photo.size <= limit) {
        objectUrl = URL.createObjectURL(photo);
        original.src = objectUrl;
        original.hidden = false;
      }
    };
    prompt.oninput = reset;

    form.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      const photo = file.files[0];
      const direction = prompt.value.trim();
      if (!photo || !formats.has(photo.type) || !photo.size || photo.size > limit || !direction) {
        status.textContent = 'Choose a supported photo up to 7 MB and describe the edit.';
        return;
      }
      busy = file.disabled = prompt.disabled = button.disabled = true;
      try {
        if (!quote) {
          const body = new FormData();
          body.append('image', photo);
          body.append('prompt', direction);
          status.textContent = 'Checking the price…';
          const reviewed = await request(owner, 'quote', { method: 'POST', body });
          if (!reviewed.quote_id || !Number.isFinite(Number(reviewed.credit_cost)) || Number(reviewed.credit_cost) <= 0) {
            throw new Error('A valid price could not be confirmed.');
          }
          quote = reviewed;
          button.textContent = `Edit photo · ${quote.credit_cost} paid credits`;
          status.textContent = `This edit costs ${quote.credit_cost} paid credits.`;
          return;
        }
        status.textContent = 'Editing your photo…';
        const result = await request(owner, 'edits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quote_id: quote.quote_id }),
        });
        const url = new URL(result.image_url);
        if (!result.id || url.protocol !== 'https:') throw new Error('The edited photo is unavailable.');
        if (!root.isConnected) return;
        edit = result;
        quote = undefined;
        edited.src = url.href;
        edited.hidden = save.hidden = false;
        button.textContent = 'Review credit cost';
        status.textContent = 'Compare the original and edited photos, then save your result.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = file.disabled = prompt.disabled = button.disabled = false;
      }
    };

    save.onclick = async () => {
      if (!edit || busy || save.disabled) return;
      const current = edit;
      save.disabled = true;
      try {
        await request(owner, 'edits/' + encodeURIComponent(current.id) + '/save', { method: 'POST' });
        if (edit === current) {
          status.textContent = 'Saved to My Creations.';
          save.hidden = true;
        }
      } catch (error) {
        if (edit === current) status.textContent = error.message;
      } finally {
        save.disabled = false;
      }
    };
  };
})();
