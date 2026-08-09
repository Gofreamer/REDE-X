function openCompose() {
  state.composeOpen = true;
  const m = document.getElementById('compose-modal');
  if (!m) return;
  m.classList.add('open');
  document.getElementById('compose-caption')?.focus();
}

function closeCompose() {
  state.composeOpen = false;
  document.getElementById('compose-modal')?.classList.remove('open');
}

async function submitCompose(e) {
  e.preventDefault();
  const image = document.getElementById('compose-image')?.value || '';
  const caption = document.getElementById('compose-caption')?.value || '';
  const asHandle = document.getElementById('compose-as')?.value || '';
  const asName = document.getElementById('compose-as-name')?.value || '';

  const opts = { image, caption };
  if (asHandle.trim() && isUserAdmin()) {
    opts.asHandle = asHandle;
    opts.asName = asName || asHandle;
  }

  const ok = await createPost(opts);
  if (ok) {
    showToast('No ar.');
    closeCompose();
    e.target.reset?.();
    document.getElementById('compose-form')?.reset();
  }
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
  const url = document.getElementById('compose-image')?.value || '';
  const box = document.getElementById('compose-preview');
  if (!box) return;
  if (!url) {
    box.innerHTML = '<span class="text-muted">Prévia da imagem</span>';
    return;
  }
  box.innerHTML = `<img src="${escapeHTML(url)}" alt="" onerror="this.parentElement.innerHTML='<span class=text-muted>URL inválida</span>'"/>`;
}
