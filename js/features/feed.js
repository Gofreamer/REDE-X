function renderFeed() {
  renderStories();
  const el = document.getElementById('feed');
  if (!el) return;

  const posts = [...state.posts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  if (!posts.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-glow"></div>
        <h3>Rede em silêncio</h3>
        <p>Nenhuma publicação ainda. O mundo visual começa com uma imagem.</p>
        <button class="btn btn-primary" onclick="openCompose()">Publicar</button>
      </div>`;
    return;
  }

  el.innerHTML = posts.map(renderPostCard).join('');
  if (typeof renderRightRail === 'function') renderRightRail();
}

function renderStories() {
  const el = document.getElementById('stories');
  if (!el) return;

  const byHandle = {};
  state.stories.forEach(s => {
    const h = normalizeHandle(s.handle);
    if (!byHandle[h]) byHandle[h] = s;
  });
  const list = Object.values(byHandle);

  if (!list.length) {
    el.innerHTML = `
      <div class="story-item story-add" onclick="${isUserAdmin() ? 'openStoryCompose()' : 'showToast(\"Stories vêm da mesa (admin).\",\"ok\")'}">
        <div class="story-ring"><div class="story-inner">+</div></div>
        <span>Seu story</span>
      </div>
      <div class="story-item muted">
        <div class="story-ring empty"><div class="story-inner">GS</div></div>
        <span>em breve</span>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="story-item story-add" onclick="${isUserAdmin() ? 'openStoryCompose()' : ''}">
      <div class="story-ring"><div class="story-inner">+</div></div>
      <span>Novo</span>
    </div>
    ${list.map(s => `
      <div class="story-item" onclick="openStory('${s.id}')">
        <div class="story-ring live"><div class="story-inner">${escapeHTML((s.name || s.handle || '?')[0].toUpperCase())}</div></div>
        <span>${escapeHTML(normalizeHandle(s.handle))}</span>
      </div>
    `).join('')}`;
}

function renderPostCard(p) {
  const liked = !!(state.user && p.likes && p.likes[state.user.uid]);
  const canMod = isUserAdmin() || p.uid === state.user?.uid;

  return `
    <article class="ig-card ${p.pinned ? 'pinned' : ''}">
      <header class="ig-head">
        ${avatarHTML(p, 'sm')}
        <div class="ig-user">
          <strong>${escapeHTML(p.name || p.handle)}</strong>
          <span>${displayHandle(p.handle)} · ${timeAgo(p.createdAt)}</span>
        </div>
        ${p.pinned ? '<span class="pin-badge">Fixado</span>' : ''}
        ${canMod ? `<button class="icon-btn" onclick="postMenu('${p.id}')" title="Opções">⋯</button>` : ''}
      </header>

      <div class="ig-media" ondblclick="toggleLike('${p.id}')">
        <img src="${escapeHTML(p.image)}" alt="" loading="lazy"
             onerror="this.parentElement.classList.add('broken'); this.alt='imagem indisponível'"/>
      </div>

      <div class="ig-actions">
        <button class="icon-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${p.id}')" aria-label="Curtir">
          ${liked ? '♥' : '♡'}
        </button>
        <button class="icon-btn" onclick="openPostModal('${p.id}')" aria-label="Comentar">💬</button>
        ${isUserAdmin() ? `<button class="icon-btn" onclick="togglePin('${p.id}')" title="Fixar">📌</button>` : ''}
      </div>

      <div class="ig-meta">
        <div class="ig-likes">${p.likeCount || 0} curtida${(p.likeCount || 0) === 1 ? '' : 's'}</div>
        ${p.caption ? `<div class="ig-caption"><strong>${escapeHTML(p.handle)}</strong> ${linkify(p.caption)}</div>` : ''}
        ${(p.commentCount || 0) > 0
          ? `<button class="ig-view-comments" onclick="openPostModal('${p.id}')">Ver ${p.commentCount} comentário${p.commentCount > 1 ? 's' : ''}</button>`
          : ''}
      </div>
    </article>`;
}

async function postMenu(id) {
  const post = state.posts.find(p => p.id === id);
  if (!post) return;
  const ok = await rgConfirm({
    title: 'Publicação',
    body: `<strong>${escapeHTML(post.handle)}</strong><br>${escapeHTML((post.caption || '').slice(0, 80))}`,
    confirmLabel: 'Apagar',
    danger: true
  });
  if (ok) deletePost(id);
}

function openPostModal(id) {
  state.activePost = id;
  renderPostModal(id);
  document.getElementById('post-modal')?.classList.add('open');
}

function closePostModal() {
  state.activePost = null;
  document.getElementById('post-modal')?.classList.remove('open');
}

function renderPostModal(id) {
  const root = document.getElementById('post-modal-body');
  if (!root) return;
  const p = state.posts.find(x => x.id === id);
  if (!p) {
    root.innerHTML = '<p class="text-muted">Post não encontrado.</p>';
    return;
  }
  const comments = Object.entries(p.comments || {})
    .map(([cid, c]) => ({ id: cid, ...c }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const liked = !!(state.user && p.likes && p.likes[state.user.uid]);

  root.innerHTML = `
    <div class="modal-post">
      <div class="modal-post-media">
        <img src="${escapeHTML(p.image)}" alt=""/>
      </div>
      <div class="modal-post-side">
        <div class="ig-head">
          ${avatarHTML(p, 'sm')}
          <div class="ig-user">
            <strong>${escapeHTML(p.name || p.handle)}</strong>
            <span>${displayHandle(p.handle)}</span>
          </div>
          <button class="icon-btn" onclick="closePostModal()">✕</button>
        </div>
        <div class="modal-comments">
          ${p.caption ? `<div class="comment-row"><strong>${escapeHTML(p.handle)}</strong> ${linkify(p.caption)}</div>` : ''}
          ${comments.map(c => `
            <div class="comment-row">
              <strong>${escapeHTML(c.handle)}</strong> ${linkify(c.text)}
              <span class="c-time">${timeAgo(c.createdAt)}</span>
            </div>`).join('') || '<p class="text-muted">Nenhum comentário.</p>'}
        </div>
        <div class="modal-footer">
          <div class="ig-actions">
            <button class="icon-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${p.id}')">${liked ? '♥' : '♡'}</button>
            <span class="ig-likes">${p.likeCount || 0} curtidas</span>
          </div>
          <form class="comment-form" onsubmit="submitComment(event, '${p.id}')">
            <input type="text" id="comment-input" maxlength="240" placeholder="Adicione um comentário…" class="input"/>
            <button type="submit" class="btn btn-ghost btn-sm">Publicar</button>
          </form>
        </div>
      </div>
    </div>`;
}

async function submitComment(e, postId) {
  e.preventDefault();
  const input = document.getElementById('comment-input');
  const text = input?.value || '';
  await addComment(postId, text);
  if (input) input.value = '';
}

function openStory(id) {
  const s = state.stories.find(x => x.id === id);
  if (!s) return;
  const modal = document.getElementById('story-modal');
  const body = document.getElementById('story-modal-body');
  if (!modal || !body) return;
  body.innerHTML = `
    <div class="story-full" onclick="closeStory()">
      <div class="story-full-top">
        <strong>${displayHandle(s.handle)}</strong>
        <span>${timeAgo(s.createdAt)}</span>
      </div>
      <img src="${escapeHTML(s.image)}" alt=""/>
    </div>`;
  modal.classList.add('open');
}

function closeStory() {
  document.getElementById('story-modal')?.classList.remove('open');
}


function renderRightRail() {
  const me = document.getElementById('rail-me');
  const list = document.getElementById('rail-suggestions');
  if (!me || !list) return;

  if (state.profile) {
    me.innerHTML = `
      <div class="rail-me-row">
        ${avatarHTML(state.profile, 'sm')}
        <div class="rail-me-text">
          <strong>${escapeHTML(state.profile.handle || '')}</strong>
          <span>${escapeHTML(state.profile.name || '')}</span>
        </div>
        <button type="button" class="rail-link" onclick="showView('profile')">Perfil</button>
      </div>`;
  } else {
    me.innerHTML = '';
  }

  // handles vistos nos posts (NPC + players), exceto você
  const myH = normalizeHandle(state.profile?.handle);
  const seen = {};
  state.posts.forEach(p => {
    const h = normalizeHandle(p.handle);
    if (!h || h === myH) return;
    if (!seen[h]) seen[h] = { handle: h, name: p.name || h, avatar: p.avatar || '' };
  });
  const items = Object.values(seen).slice(0, 6);

  if (!items.length) {
    list.innerHTML = `<p class="rail-empty">Quando a cidade postar, os perfis aparecem aqui.</p>`;
    return;
  }
  list.innerHTML = items.map(u => `
    <div class="rail-row">
      ${avatarHTML(u, 'sm')}
      <div class="rail-me-text">
        <strong>${escapeHTML(u.handle)}</strong>
        <span>${escapeHTML(u.name)}</span>
      </div>
      <span class="rail-tag">no ar</span>
    </div>
  `).join('');
}
