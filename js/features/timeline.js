/* Rede X — Timeline */

function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el) return;

  renderComposer();

  const posts = state.posts.filter(p => !p.replyTo);
  if (!posts.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📡</div>
        <h3>Rede em silêncio</h3>
        <p>Nenhum sinal ainda. Seja o primeiro a postar no fio.</p>
      </div>
    `;
    return;
  }

  el.innerHTML = posts.map(renderPostCard).join('');
}

function getReplies(postId) {
  return state.posts
    .filter(p => p.replyTo === postId)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function renderPostCard(p) {
  const liked = !!(state.user && p.likes && p.likes[state.user.uid]);
  const canDelete = isUserAdmin() || (state.user && p.uid === state.user.uid);
  const replies = getReplies(p.id);
  const img = p.image
    ? `<div class="post-media"><img src="${escapeHTML(p.image)}" alt="" onerror="this.parentElement.remove()"/></div>`
    : '';

  return `
    <article class="post-card" id="post-${p.id}">
      <div class="post-avatar">${avatarLetter(p)}</div>
      <div class="post-body">
        <div class="post-meta">
          <strong class="post-name">${escapeHTML(p.name || p.handle || '—')}</strong>
          <span class="post-handle">${displayHandle(p.handle)}</span>
          <span class="post-time">${timeAgo(p.createdAt)}</span>
        </div>
        <div class="post-text">${linkifyText(p.text)}</div>
        ${img}
        <div class="post-actions">
          <button class="post-action ${liked ? 'liked' : ''}" onclick="toggleLike('${p.id}')" title="Curtir">
            ${liked ? '♥' : '♡'} <span>${typeof formatCount === 'function' ? formatCount(p.likeCount || 0) : (p.likeCount || 0)}</span>
          </button>
          <button class="post-action" onclick="setReplyTo('${p.id}')" title="Responder">
            ↩ <span>${replies.length || ''}</span>
          </button>
          ${canDelete ? `<button class="post-action danger" onclick="deletePost('${p.id}')" title="Apagar">✕</button>` : ''}
        </div>
        ${replies.length ? `<div class="post-replies">${replies.map(renderReply).join('')}</div>` : ''}
      </div>
    </article>
  `;
}

function renderReply(p) {
  const canDelete = isUserAdmin() || (state.user && p.uid === state.user.uid);
  return `
    <div class="reply-card">
      <div class="post-meta">
        <strong>${escapeHTML(p.name || p.handle)}</strong>
        <span class="post-handle">${displayHandle(p.handle)}</span>
        <span class="post-time">${timeAgo(p.createdAt)}</span>
        ${canDelete ? `<button class="post-action danger" onclick="deletePost('${p.id}')">✕</button>` : ''}
      </div>
      <div class="post-text">${linkifyText(p.text)}</div>
    </div>
  `;
}

function avatarLetter(p) {
  const letter = (p.name || p.handle || '?')[0].toUpperCase();
  if (p.avatar) {
    return `<img src="${escapeHTML(p.avatar)}" alt="" onerror="this.outerHTML='<span>${letter}</span>'"/>`;
  }
  return `<span>${letter}</span>`;
}

function renderComposer() {
  const box = document.getElementById('composer');
  if (!box) return;

  const reply = state.replyTo ? state.posts.find(p => p.id === state.replyTo) : null;
  const adminBit = isUserAdmin()
    ? `<div class="composer-admin">
         <label>Postar como (admin)</label>
         <input type="text" id="compose-as" class="input" placeholder="deixe vazio = você · ou nina_riders" value="${escapeHTML(state.composeAs || '')}"/>
       </div>`
    : '';

  box.innerHTML = `
    <div class="composer-card">
      ${reply ? `
        <div class="composer-reply-banner">
          Respondendo a ${displayHandle(reply.handle)}
          <button type="button" class="btn btn-ghost btn-sm" onclick="clearReplyTo()">Cancelar</button>
        </div>
      ` : ''}
      <textarea id="compose-text" class="composer-input" maxlength="280" placeholder="O que está acontecendo na cidade?"></textarea>
      <div class="composer-row">
        <input type="url" id="compose-image" class="input input-sm" placeholder="URL de imagem (opcional)"/>
        <span class="composer-count" id="compose-count">0/280</span>
      </div>
      ${adminBit}
      <div class="composer-actions">
        <button type="button" class="btn btn-primary" onclick="submitPost()">Publicar</button>
      </div>
    </div>
  `;

  const ta = document.getElementById('compose-text');
  const count = document.getElementById('compose-count');
  if (ta && count) {
    ta.addEventListener('input', () => {
      count.textContent = `${ta.value.length}/280`;
    });
  }
}

function setReplyTo(postId) {
  state.replyTo = postId;
  renderComposer();
  document.getElementById('compose-text')?.focus();
  document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearReplyTo() {
  state.replyTo = null;
  renderComposer();
}

async function submitPost() {
  const text = document.getElementById('compose-text')?.value || '';
  const image = document.getElementById('compose-image')?.value || '';
  const asRaw = document.getElementById('compose-as')?.value || '';
  state.composeAs = asRaw;

  const opts = {
    text,
    image,
    replyTo: state.replyTo || null
  };

  if (asRaw.trim() && isUserAdmin()) {
    opts.asHandle = asRaw;
    opts.asName = asRaw.replace(/^@/, '');
  }

  const ok = await createPost(opts);
  if (ok) {
    showToast(state.replyTo ? 'Resposta publicada.' : 'No ar.');
    state.replyTo = null;
    const ta = document.getElementById('compose-text');
    const img = document.getElementById('compose-image');
    if (ta) ta.value = '';
    if (img) img.value = '';
    renderComposer();
  }
}
