const COMPOSE_IMAGE_LIMIT = 8 * 1024 * 1024;
let composeImageDraft = null;
let composeSubmitting = false;
let composeUploadAvailable = false;

function openCompose() {
  saveNavigationScroll();
  state.composeOpen = true;
  const m = document.getElementById('compose-modal');
  if (!m) return;
  m.classList.add('open');
  state.navigationOverlay = 'compose';
  recordNavigation();
  // garante campos admin visíveis se for admin
  document.querySelectorAll('#compose-modal .admin-only').forEach(el => {
    el.classList.toggle('hidden', !isUserAdmin());
  });
  document.getElementById('compose-caption')?.focus();
  if (!composeUploadAvailable && typeof fetch === 'function') {
    fetch('/api/post-image', { signal: AbortSignal.timeout(5000) }).then(response => {
      if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) return response.json();
    }).then(data => {
      if (data?.available === true) {
        composeUploadAvailable = true;
        document.getElementById('compose-upload')?.classList.remove('hidden');
      }
    }).catch(() => {});
  }
}

/** Abre o compose já como um NPC (atalho a partir do perfil). */
function openComposeAsNpc(handle, name) {
  if (!isUserAdmin()) return;
  const h = normalizeHandle(handle || '');
  const n = name || ((state.npcProfiles || {})[h]?.name) || h;
  openCompose();
  setTimeout(() => {
    const asEl = document.getElementById('compose-as');
    const nameEl = document.getElementById('compose-as-name');
    if (asEl) asEl.value = h;
    if (nameEl) nameEl.value = n;
    document.getElementById('compose-image')?.focus();
  }, 40);
}

function closeCompose(recordHistory = true) {
  if (recordHistory && state.navigationOverlay === 'compose' && goBackInApp()) return;
  if (state.navigationOverlay === 'compose') state.navigationOverlay = null;
  state.composeOpen = false;
  document.getElementById('compose-modal')?.classList.remove('open');
}

async function submitCompose(e) {
  e.preventDefault();
  if (composeSubmitting) return;
  const image = document.getElementById('compose-image')?.value?.trim() || '';
  const draft = composeImageDraft;
  if (draft && !draft.blob) {
    showToast(draft.error || 'Aguarde a preparação da imagem.', 'err');
    return;
  }
  const caption = document.getElementById('compose-caption')?.value || '';
  const asHandle = document.getElementById('compose-as')?.value || '';
  const asName = document.getElementById('compose-as-name')?.value || '';

  const profileOnly = document.getElementById('compose-profile-only')?.checked === true;
  const opts = { image, caption, profileOnly };
  if (asHandle.trim() && isUserAdmin()) {
    opts.asHandle = asHandle;
    opts.asName = asName || asHandle;
  }

  const form = document.getElementById('compose-form');
  const controls = Array.from(form?.querySelectorAll?.('input, textarea, button') || []).filter(el => !el.disabled);
  const button = form?.querySelector?.('[type="submit"]');
  composeSubmitting = true;
  controls.forEach(el => { el.disabled = true; });
  try {
    if (draft) {
      if (button) button.textContent = 'Enviando imagem…';
      opts.image = await uploadComposeImage(draft);
    }
    if (button) button.textContent = 'Publicando…';
    if (await createPost(opts)) {
      showToast(profileOnly ? 'Publicado só no perfil.' : 'No ar.');
      closeCompose();
      form?.reset();
      clearComposeImageDraft();
      renderComposeImage('');
    }
  } catch (error) {
    showToast(error.name === 'TimeoutError' ? 'O envio demorou. Tente publicar novamente.' : error.message, 'err');
  } finally {
    composeSubmitting = false;
    controls.forEach(el => { el.disabled = false; });
    if (button) button.textContent = 'Compartilhar';
  }
}

function clearComposeImageDraft() {
  if (composeImageDraft?.preview) URL.revokeObjectURL(composeImageDraft.preview);
  composeImageDraft = null;
  const file = document.getElementById('compose-file');
  if (file) file.value = '';
  const original = document.getElementById('compose-original');
  if (original) original.checked = false;
  const originalOption = document.getElementById('compose-original-option');
  originalOption?.classList.add('hidden');
  const status = document.getElementById('compose-upload-status');
  if (status) status.textContent = '';
  const link = document.getElementById('compose-image');
  if (link) link.required = true;
}

async function prepareComposeImage() {
  const input = document.getElementById('compose-file');
  const file = input.files[0];
  if (!file) return;
  const link = document.getElementById('compose-image');
  const status = document.getElementById('compose-upload-status');
  const keepOriginal = document.getElementById('compose-original').checked;
  document.getElementById('compose-original-option').classList.remove('hidden');
  link.value = '';
  link.required = false;
  if (composeImageDraft?.preview) URL.revokeObjectURL(composeImageDraft.preview);
  const draft = { id: crypto.randomUUID() };
  composeImageDraft = draft;
  renderComposeImage('');
  status.textContent = 'Preparando imagem…';
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
    }
    if (file.size > 32 * 1024 * 1024) throw new Error('Escolha um arquivo de até 32 MB.');
    const bitmap = await createImageBitmap(file);
    let blob = file;
    try {
      if (!keepOriginal && file.size > 250 * 1024) {
        const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
        canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const compressed = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.92));
        if (compressed?.type === 'image/webp' && compressed.size < file.size) blob = compressed;
      }
    } finally {
      bitmap.close();
    }
    if (blob.size > COMPOSE_IMAGE_LIMIT) throw new Error('A imagem para envio precisa ter até 8 MB.');
    if (composeImageDraft !== draft) return;
    draft.blob = blob;
    draft.preview = URL.createObjectURL(blob);
    renderComposeImage(draft.preview);
    const size = bytes => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('pt-BR')} KB`;
    status.textContent = blob === file ? `Original · ${size(file.size)}` : `${size(file.size)} → ${size(blob.size)} · Alta qualidade`;
  } catch (error) {
    if (composeImageDraft !== draft) return;
    draft.error = error instanceof DOMException ? 'Não foi possível abrir a imagem.' : error.message;
    status.textContent = draft.error;
  }
}

async function uploadComposeImage(draft) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Entre na sua conta para enviar uma imagem.');
  const response = await fetch('/api/post-image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': draft.blob.type, 'X-Upload-Id': draft.id },
    body: draft.blob,
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.url !== 'string') {
    throw new Error(data?.error || 'O envio de imagens está indisponível. Tente de novo ou cole um link.');
  }
  return data.url;
}

function openStoryCompose() {
  if (!isUserAdmin()) return;
  document.getElementById('story-compose-modal')?.classList.add('open');
}

function closeStoryCompose() {
  document.getElementById('story-compose-modal')?.classList.remove('open');
}

async function submitStory(e) {
  e.preventDefault();
  const ok = await createStory({
    image: document.getElementById('story-image')?.value,
    asHandle: document.getElementById('story-handle')?.value,
    asName: document.getElementById('story-name')?.value
  });
  if (ok) {
    closeStoryCompose();
    e.target.reset();
  }
}

function previewComposeImage() {
  clearComposeImageDraft();
  const url = document.getElementById('compose-image')?.value || '';
  renderComposeImage(url);
}

function renderComposeImage(url) {
  const box = document.getElementById('compose-preview');
  if (!box) return;
  if (!url) {
    box.innerHTML = '<span class="text-muted">Prévia da imagem</span>';
    return;
  }
  box.innerHTML = `<img src="${escapeHTML(url)}" alt="" onerror="this.parentElement.innerHTML='<span class=text-muted>URL inválida</span>'"/>`;
}
