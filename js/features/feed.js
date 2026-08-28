function renderFeed() {
  renderStories();
  const el = document.getElementById('feed');
  if (!el) return;

  if (!state.postsLoaded) {
    el.innerHTML = skeletonFeedHTML();
    return;
  }

  const now = Date.now();
  const session = state.siteSettings?.session || {};
  let posts = [...state.posts].filter(p => !p.publishAt || p.publishAt <= now || isUserAdmin());

  if (state.feedFilter === 'following') {
    posts = posts.filter(p => isFollowing(p.handle) || (state.profile && normalizeHandle(p.handle) === normalizeHandle(state.profile.handle)));
  } else if (state.feedFilter === 'tag' && state.feedTag) {
    const tag = state.feedTag.toLowerCase();
    posts = posts.filter(p => (p.caption || '').toLowerCase().includes('#' + tag));
  }

  posts.sort((a, b) => {
    if (session.postId) {
      if (a.id === session.postId && b.id !== session.postId) return -1;
      if (b.id === session.postId && a.id !== session.postId) return 1;
    }
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const filterBar = `
    <div class="feed-filters">
      <button type="button" class="ff-btn ${state.feedFilter === 'all' ? 'active' : ''}" onclick="setFeedFilter('all')">Para você</button>
      <button type="button" class="ff-btn ${state.feedFilter === 'following' ? 'active' : ''}" onclick="setFeedFilter('following')">Seguindo</button>
      ${state.feedFilter === 'tag' && state.feedTag ? `<button type="button" class="ff-btn active" onclick="setFeedFilter('all')">#${escapeHTML(state.feedTag)} ✕</button>` : ''}
      <button type="button" class="ff-btn ff-refresh" onclick="refreshFeed()" title="Atualizar">↻</button>
    </div>`;

  const sessionBanner = session.postId || session.label ? `
    <div class="session-banner">
      <strong>Sessão</strong>
      <span>${escapeHTML(session.label || 'No ar esta noite')}</span>
    </div>` : '';

  if (!posts.length) {
    el.innerHTML = filterBar + sessionBanner + `
      <div class="empty">
        <div class="empty-glow"></div>
        <h3>${state.feedFilter === 'following' ? 'Nada de quem você segue' : (state.feedFilter === 'tag' ? 'Nenhum post com #' + escapeHTML(state.feedTag || '') : 'Rede em silêncio')}</h3>
        <p>${state.feedFilter === 'following' ? 'Siga NPCs nos perfis — o fio fica só com o que importa pra você.' : 'A cidade ainda não postou. Explore ou publique.'}</p>
        <button class="btn btn-primary" onclick="setFeedFilter('all')">Ver tudo</button>
      </div>`;
    return;
  }

  el.innerHTML = filterBar + sessionBanner + posts.map(renderPostCard).join('');
  if (typeof renderRightRail === 'function') renderRightRail();
}

function skeletonFeedHTML() {
  return `<div class="feed-filters"><div class="sk sk-line"></div></div>` +
    [1,2,3].map(() => `
      <article class="ig-card sk-card">
        <div class="ig-head"><div class="sk sk-avatar"></div><div class="sk sk-line" style="flex:1"></div></div>
        <div class="sk sk-media"></div>
        <div class="ig-meta"><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>
      </article>`).join('');
}

function setFeedFilter(mode) {
  state.feedFilter = mode;
  if (mode !== 'tag') state.feedTag = null;
  renderFeed();
}

function filterByTag(tag) {
  state.feedFilter = 'tag';
  state.feedTag = String(tag || '').toLowerCase().replace(/^#/, '');
  showView('feed');
}

function refreshFeed() {
  state.postsLoaded = false;
  renderFeed();
  // force re-read
  db.ref('posts').limitToLast(1).once('value').then(() => {
    state.postsLoaded = true;
    renderFeed();
    showToast('Fio atualizado.');
  }).catch(() => {
    state.postsLoaded = true;
    renderFeed();
  });
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
  const saved = isSaved(p.id);
  const canMod = isUserAdmin() || p.uid === state.user?.uid;

  return `
    <article class="ig-card ${p.pinned ? 'pinned' : ''}" id="post-${p.id}">
      <header class="ig-head">
        ${avatarHTML(p, 'sm')}
        <div class="ig-user" style="cursor:pointer" onclick="openProfile('${escapeHTML(normalizeHandle(p.handle))}')">
          <strong>${nameWithVerified(p.name || p.handle, p.handle)}</strong>
          <span>${displayHandle(p.handle)} · <span data-ts="${p.createdAt || ''}">${timeAgo(p.createdAt)}</span></span>
        </div>
        ${p.pinned ? '<span class="pin-badge">Fixado</span>' : ''}
        ${p.publishAt && p.publishAt > Date.now() ? '<span class="pin-badge">Agendado</span>' : ''}
        ${state.siteSettings?.session?.postId === p.id ? '<span class="pin-badge">Sessão</span>' : ''}
        ${canMod ? `<button class="icon-btn" onclick="postMenu('${p.id}')" title="Opções">⋯</button>` : ''}
      </header>

      <div class="ig-media" ondblclick="heartBurst(event, '${p.id}')">
        <img src="${escapeHTML(p.image)}" alt="" loading="lazy"
             onerror="this.parentElement.classList.add('broken'); this.alt='imagem indisponível'"/>
      </div>

      <div class="ig-actions">
        <button class="icon-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${p.id}')" aria-label="Curtir">
          ${liked ? '♥' : '♡'}
        </button>
        <button class="icon-btn" onclick="openPostModal('${p.id}')" aria-label="Comentar">💬</button>
        <button class="icon-btn" onclick="sharePost('${p.id}')" title="Copiar link" aria-label="Compartilhar">↗</button>
        <button class="icon-btn ${saved ? 'saved' : ''}" onclick="toggleSave('${p.id}')" title="${saved ? 'Remover dos salvos' : 'Salvar'}" aria-label="Salvar">
          ${saved ? '★' : '☆'}
        </button>
        ${isUserAdmin() ? `<button class="icon-btn" onclick="togglePin('${p.id}')" title="Fixar">📌</button>` : ''}
      </div>

      <div class="ig-meta">
        <div class="ig-likes">${typeof formatCount === 'function' ? formatCount(p.likeCount || 0) : (p.likeCount || 0)} curtida${(p.likeCount || 0) === 1 ? '' : 's'}</div>
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
  document.body.classList.add('post-modal-open');
  if (location.hash !== '#post/' + id) {
    history.replaceState(null, '', '#post/' + id);
  }
}

function closePostModal() {
  state.activePost = null;
  state.replyTo = null;
  document.getElementById('post-modal')?.classList.remove('open');
  document.body.classList.remove('post-modal-open');
  if ((location.hash || '').startsWith('#post/')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function buildCommentTree(comments) {
  const roots = [];
  const byParent = {};
  comments.forEach(c => {
    if (c.parentId) {
      if (!byParent[c.parentId]) byParent[c.parentId] = [];
      byParent[c.parentId].push(c);
    } else {
      roots.push(c);
    }
  });
  // replies órfãos (parent apagado) sobem pra raiz
  comments.forEach(c => {
    if (c.parentId && !comments.find(x => x.id === c.parentId) && !roots.includes(c)) {
      roots.push(c);
    }
  });
  return { roots, byParent };
}

function renderCommentBlock(c, postId, byParent, depth = 0) {
  const replies = byParent[c.id] || [];
  const replyTo = state.replyTo;
  const isActive = replyTo && replyTo.id === c.id;
  const canDelete = isUserAdmin() || (state.user && c.uid === state.user.uid);
  return `
    <div class="ig-comment ${depth ? 'ig-comment-reply' : ''}" data-cid="${c.id}">
      <div class="ig-comment-body">
        ${avatarHTML({ handle: c.handle, name: c.name, avatar: c.avatar }, 'xs')}
        <div class="ig-comment-main">
          <div class="ig-comment-text">
            <strong class="ig-comment-user" onclick="openProfile('${escapeHTML(normalizeHandle(c.handle))}')">${nameWithVerified(c.handle, c.handle)}</strong>
            ${linkify(c.text)}
          </div>
          <div class="ig-comment-meta">
            <span class="c-time" data-ts="${c.createdAt || ''}">${timeAgo(c.createdAt)}</span>
            <button type="button" class="ig-comment-reply-btn ${isActive ? 'active' : ''}"
              onclick="startReply('${postId}','${c.id}','${escapeHTML(normalizeHandle(c.handle))}')">Responder</button>
            ${canDelete ? `<button type="button" class="ig-comment-delete-btn" onclick="deleteComment('${postId}','${c.id}')" title="Apagar comentário">Apagar</button>` : ''}
          </div>
        </div>
      </div>
      ${replies.length ? `
        <div class="ig-comment-thread">
          ${replies.map(r => renderCommentBlock(r, postId, byParent, depth + 1)).join('')}
        </div>` : ''}
    </div>`;
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
  const { roots, byParent } = buildCommentTree(comments);
  const liked = !!(state.user && p.likes && p.likes[state.user.uid]);
  const saved = isSaved(p.id);
  const replyTo = state.replyTo && state.replyTo.postId === id ? state.replyTo : null;

  root.innerHTML = `
    <div class="modal-post">
      <div class="modal-post-media">
        <img src="${escapeHTML(p.image)}" alt=""/>
      </div>
      <div class="modal-post-side">
        <div class="ig-head">
          ${avatarHTML(p, 'sm')}
          <div class="ig-user">
            <strong>${nameWithVerified(p.name || p.handle, p.handle)}</strong>
            <span>${displayHandle(p.handle)}</span>
          </div>
          <button class="icon-btn" onclick="closePostModal()">✕</button>
        </div>
        <div class="modal-comments">
          ${p.caption ? `
            <div class="ig-comment ig-caption-row">
              <div class="ig-comment-body">
                ${avatarHTML(p, 'xs')}
                <div class="ig-comment-main">
                  <div class="ig-comment-text">
                    <strong class="ig-comment-user" onclick="openProfile('${escapeHTML(normalizeHandle(p.handle))}')">${nameWithVerified(p.handle, p.handle)}</strong>
                    ${linkify(p.caption)}
                  </div>
                  <div class="ig-comment-meta">
                    <span class="c-time" data-ts="${p.createdAt || ''}">${timeAgo(p.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>` : ''}
          ${roots.length
            ? roots.map(c => renderCommentBlock(c, p.id, byParent)).join('')
            : '<p class="text-muted ig-comments-empty">Nenhum comentário ainda.</p>'}
        </div>
        <div class="modal-footer">
          <div class="ig-actions">
            <button class="icon-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${p.id}')">${liked ? '♥' : '♡'}</button>
            <button class="icon-btn" onclick="document.getElementById('comment-input')?.focus()" title="Comentar">💬</button>
            <button class="icon-btn" onclick="sharePost('${p.id}')" title="Copiar link">↗</button>
            <button class="icon-btn ${saved ? 'saved' : ''}" onclick="toggleSave('${p.id}')" title="${saved ? 'Remover dos salvos' : 'Salvar'}">${saved ? '★' : '☆'}</button>
            <span class="ig-likes">${typeof formatCount === 'function' ? formatCount(p.likeCount || 0) : (p.likeCount || 0)} curtidas</span>
          </div>
          ${isUserAdmin() ? `
            <div class="admin-post-bar">
              <select id="comment-as-handle" class="input input-sm comment-as-select" title="Comentar como"
                onchange="setCommentAsHandle(this.value)">
                <option value="">comentar como eu</option>
                ${Object.keys(state.npcProfiles || {}).map(h =>
                  `<option value="${escapeHTML(h)}" ${state.commentAsHandle === h ? 'selected' : ''}>@${escapeHTML(h)}</option>`
                ).join('')}
              </select>
              <button type="button" class="btn btn-ghost btn-sm mesa-controls-btn" onclick="openMesaControlsModal('${p.id}')">Controles da mesa</button>
            </div>
          ` : ''}
          ${replyTo ? `
            <div class="ig-reply-bar">
              <span>Respondendo a <strong>@${escapeHTML(replyTo.handle)}</strong></span>
              <button type="button" class="ig-reply-cancel" onclick="cancelReply()">✕</button>
            </div>` : ''}
          <form class="comment-form" onsubmit="submitComment(event, '${p.id}')">
            <input type="text" id="comment-input" maxlength="240"
              placeholder="${replyTo ? 'Responder a @' + escapeHTML(replyTo.handle) + '…' : 'Adicione um comentário…'}"
              class="input" autocomplete="off"/>
            <button type="submit" class="btn btn-ghost btn-sm comment-post-btn">Publicar</button>
          </form>
        </div>
      </div>
    </div>`;
}

function startReply(postId, commentId, handle) {
  state.replyTo = { postId, id: commentId, handle: normalizeHandle(handle) };
  renderPostModal(postId);
  setTimeout(() => {
    const input = document.getElementById('comment-input');
    if (input) {
      input.focus();
      const val = input.value || '';
      if (!val.includes('@' + state.replyTo.handle)) {
        input.value = '@' + state.replyTo.handle + ' ';
      }
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 30);
}

function cancelReply() {
  const postId = state.replyTo?.postId || state.activePost;
  state.replyTo = null;
  if (postId) renderPostModal(postId);
}

async function submitComment(e, postId) {
  e.preventDefault();
  const input = document.getElementById('comment-input');
  const text = input?.value || '';
  const asH = (document.getElementById('comment-as-handle')?.value || state.commentAsHandle || '').trim();
  let asNpc = null;
  if (asH && isUserAdmin()) {
    const npc = (state.npcProfiles || {})[normalizeHandle(asH)];
    asNpc = { handle: asH, name: npc?.name || asH, avatar: npc?.avatar || '' };
  }
  const replyTo = state.replyTo && state.replyTo.postId === postId ? state.replyTo : null;
  const ok = await addComment(postId, text, asNpc, replyTo);
  if (ok) {
    if (input) input.value = '';
    state.replyTo = null;
  }
}

function openStory(id) {
  const s = state.stories.find(x => x.id === id);
  if (!s) return;
  const modal = document.getElementById('story-modal');
  const body = document.getElementById('story-modal-body');
  if (!modal || !body) return;

  // registra viewer (player ou admin)
  recordStoryView(id);

  const viewers = Object.entries(s.viewers || {})
    .map(([uid, v]) => ({ uid, ...v }))
    .sort((a, b) => (b.at || 0) - (a.at || 0));

  const viewersHTML = isUserAdmin() ? `
    <div class="story-viewers" onclick="event.stopPropagation()">
      <div class="story-viewers-head">
        <strong>Quem viu</strong>
        <span>${viewers.length}</span>
      </div>
      ${viewers.length
        ? viewers.map(v => `
            <div class="story-viewer-row">
              <span class="sv-handle">@${escapeHTML(v.handle || '?')}</span>
              <span class="sv-name">${escapeHTML(v.name || '')}</span>
              <span class="sv-time">${timeAgo(v.at)}</span>
            </div>`).join('')
        : '<p class="text-muted" style="padding:8px 12px;margin:0">Ninguém ainda.</p>'}
    </div>` : '';

  body.innerHTML = `
    <div class="story-full" onclick="closeStory()">
      <div class="story-full-top">
        <strong>${displayHandle(s.handle)}${verifiedBadgeHTML(s.handle)}</strong>
        <span>${timeAgo(s.createdAt)}</span>
        ${isUserAdmin() && viewers.length ? `<span class="story-view-count">${viewers.length} viu</span>` : ''}
      </div>
      <img src="${escapeHTML(s.image)}" alt=""/>
      ${viewersHTML}
    </div>`;
  modal.classList.add('open');
}

function closeStory() {
  document.getElementById('story-modal')?.classList.remove('open');
}

async function sharePost(postId) {
  const url = `${location.origin}${location.pathname}#post/${postId}`;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    showToast('Link copiado.');
  } catch (e) {
    showToast('Não deu pra copiar. Link: ' + url, 'err');
  }
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
    <button type="button" class="rail-row" style="width:100%;text-align:left" onclick="openProfile('${escapeHTML(u.handle)}')">
      ${avatarHTML(u, 'sm')}
      <div class="rail-me-text">
        <strong>${escapeHTML(u.handle)}</strong>
        <span>${escapeHTML(u.name)}</span>
      </div>
      <span class="rail-tag">no ar</span>
    </button>
  `).join('');
}


/* —— Admin engagement tools —— */
async function adminSetLikes(postId) {
  if (!isUserAdmin()) return;
  const raw = document.getElementById('adm-like-count')?.value;
  const n = Math.max(0, parseInt(String(raw || '').replace(/\D/g, ''), 10) || 0);
  try {
    // likes map só precisa dos players reais (pra saber se o user curtiu).
    // likeCount é a fonte da verdade pro número exibido — sem criar dezenas de milhares de bot keys.
    const post = state.posts.find(p => p.id === postId);
    const real = {};
    if (post?.likes) {
      Object.entries(post.likes).forEach(([uid, v]) => {
        if (!String(uid).startsWith('bot_')) real[uid] = v;
      });
    }
    // limpa bots antigos se existirem (evita payload gigante no RTDB)
    await db.ref('posts/' + postId + '/likes').set(real);
    await db.ref('posts/' + postId + '/likeCount').set(n);
    showToast((typeof formatCount === 'function' ? formatCount(n) : n) + ' curtidas.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao definir likes.', 'err');
  }
}

async function adminGenerateLikes(postId) {
  if (!isUserAdmin()) return;
  const post = state.posts.find(p => p.id === postId);
  const current = Number(post?.likeCount) || 0;
  // bump +5 a +40 de forma "orgânica"
  const add = 5 + Math.floor(Math.random() * 36);
  const target = current + add;
  const input = document.getElementById('adm-like-count');
  if (input) input.value = target;
  await adminSetLikes(postId);
  showToast('+' + add + ' likes gerados.');
}

const COMMENT_POOL = [
  'isso aí',
  'alguém mais viu?',
  'cidade não para',
  'preciso disso',
  'marcando presença',
  'lenda',
  'foi ontem?',
  'núcleo em silêncio de novo',
  'print salvo',
  'quem tava no porto confirma',
  'estética perfeita',
  'medo e respeito',
  'manda o local',
  'isso não é oficial né',
  'a noite vai ser longa',
  'já sabia',
  'finalmente',
  'top demais',
  'conta mais',
  '👀'
];

function pickCommentText(caption) {
  const pool = [...COMMENT_POOL];
  if (caption && /#\w+/.test(caption)) {
    const tags = caption.match(/#\w+/g) || [];
    tags.forEach(t => pool.push(t + ' sempre'));
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function adminGenerateComments(postId, count = 3) {
  if (!isUserAdmin()) return;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const npcs = Object.entries(state.npcProfiles || {});
  const handles = npcs.length
    ? npcs.map(([h, u]) => ({ handle: h, name: u.name || h, avatar: u.avatar || '' }))
    : [
        { handle: 'porto_wire', name: 'Porto Wire', avatar: '' },
        { handle: 'nexo_pulse', name: 'Nexo Pulse', avatar: '' },
        { handle: 'dock_cam', name: 'Dock Cam', avatar: '' },
        { handle: 'subsolo_echo', name: 'Subsolo Echo', avatar: '' }
      ];

  try {
    for (let i = 0; i < count; i++) {
      const who = handles[Math.floor(Math.random() * handles.length)];
      const text = pickCommentText(post.caption);
      const av = who.avatar || (typeof resolveAvatar === 'function' ? resolveAvatar(who.handle) : '');
      await db.ref('posts/' + postId + '/comments').push({
        text,
        uid: 'npc_' + who.handle,
        handle: who.handle,
        name: who.name,
        avatar: av,
        createdAt: Date.now() - Math.floor(Math.random() * 3600000),
        bot: true
      });
    }
    const snap = await db.ref('posts/' + postId + '/comments').once('value');
    const n = snap.exists() ? Object.keys(snap.val()).length : 0;
    await db.ref('posts/' + postId + '/commentCount').set(n);
    showToast(count + ' comentário(s) gerado(s).');
  } catch (e) {
    console.error(e);
    showToast('Erro nos comentários.', 'err');
  }
}


function heartBurst(e, postId) {
  const media = e.currentTarget;
  const heart = document.createElement('div');
  heart.className = 'heart-burst';
  heart.textContent = '♥';
  media.appendChild(heart);
  requestAnimationFrame(() => heart.classList.add('show'));
  setTimeout(() => heart.remove(), 900);
  const post = state.posts.find(p => p.id === postId);
  const liked = !!(state.user && post?.likes && post.likes[state.user.uid]);
  if (!liked) toggleLike(postId);
}


async function adminOpenTimeEditor(postId) {
  if (!isUserAdmin()) return;
  const post = state.posts.find(p => p.id === postId);
  const data = await rgForm({
    title: 'Horário do post',
    confirmLabel: 'Aplicar',
    fields: [
      { name: 'mode', label: 'Modo', type: 'select', value: 'ago', options: [
        { value: 'ago', label: 'Há X minutos (relativo)' },
        { value: 'absolute', label: 'Data/hora exata' }
      ]},
      { name: 'minutes', label: 'Há quantos minutos?', type: 'number', value: '15', placeholder: '15' },
      { name: 'datetime', label: 'Ou data/hora', type: 'datetime-local', value: '' }
    ]
  });
  if (!data) return;
  if (data.mode === 'absolute' && data.datetime) {
    await adminSetPostTime(postId, data.datetime);
  } else {
    const m = Math.max(0, parseInt(data.minutes, 10) || 0);
    await adminSetPostTime(postId, m);
  }
}

async function adminPreviewComments(postId, count = 3) {
  if (!isUserAdmin()) return;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const npcs = Object.entries(state.npcProfiles || {});
  const handles = npcs.length
    ? npcs.map(([h, u]) => ({ handle: h, name: u.name || h, avatar: u.avatar || '' }))
    : [
        { handle: 'porto_wire', name: 'Porto Wire', avatar: '' },
        { handle: 'nexo_pulse', name: 'Nexo Pulse', avatar: '' },
        { handle: 'dock_cam', name: 'Dock Cam', avatar: '' }
      ];
  const draft = [];
  for (let i = 0; i < count; i++) {
    const who = handles[Math.floor(Math.random() * handles.length)];
    draft.push({ handle: who.handle, name: who.name, avatar: who.avatar, text: pickCommentText(post.caption) });
  }
  const body = draft.map((d, i) =>
    `<div style="text-align:left;margin:8px 0;padding:8px;background:#121212;border-radius:8px">
      <strong>@${escapeHTML(d.handle)}</strong><br/>${escapeHTML(d.text)}
    </div>`
  ).join('');
  const ok = await rgConfirm({
    title: 'Publicar comentários?',
    body: body,
    confirmLabel: 'Publicar ' + count
  });
  if (!ok) return;
  try {
    for (const d of draft) {
      const av = d.avatar || (typeof resolveAvatar === 'function' ? resolveAvatar(d.handle) : '');
      await db.ref('posts/' + postId + '/comments').push({
        text: d.text,
        uid: 'npc_' + d.handle,
        handle: d.handle,
        name: d.name,
        avatar: av,
        createdAt: Date.now() - Math.floor(Math.random() * 3600000),
        bot: true
      });
    }
    const snap = await db.ref('posts/' + postId + '/comments').once('value');
    const n = snap.exists() ? Object.keys(snap.val()).length : 0;
    await db.ref('posts/' + postId + '/commentCount').set(n);
    showToast(count + ' comentários publicados.');
  } catch (e) {
    showToast('Erro.', 'err');
  }
}


/* —— Modal Controles da mesa —— */
function openMesaControlsModal(postId) {
  if (!isUserAdmin()) return;
  const p = state.posts.find(x => x.id === postId);
  if (!p) return;
  ensureMesaControlsModal();
  const body = document.getElementById('mesa-controls-body');
  if (!body) return;

  const selectedAs = state.commentAsHandle || document.getElementById('comment-as-handle')?.value || '';

  body.innerHTML = `
    <div class="mesa-tools">
      <div class="apt-row">
        <label>Likes</label>
        <input type="number" id="adm-like-count" class="input input-sm" min="0" step="1" value="${p.likeCount || 0}" style="width:120px"/>
        <button type="button" class="btn btn-ghost btn-sm" onclick="adminSetLikes('${p.id}')">Aplicar</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="adminGenerateLikes('${p.id}')">+ auto</button>
      </div>
      <div class="apt-row">
        <label>Coments</label>
        <button type="button" class="btn btn-ghost btn-sm" onclick="adminPreviewComments('${p.id}', 3)">+3 preview</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="adminGenerateComments('${p.id}', 1)">+1 auto</button>
        <button type="button" class="btn btn-primary btn-sm" onclick="openAiCommentsReview('${p.id}', 3, false); closeMesaControlsModal()">✦ IA comentários</button>
      </div>
      <div class="apt-row">
        <label>Como</label>
        <select id="mesa-comment-as" class="input input-sm" onchange="setCommentAsHandle(this.value)">
          <option value="">comentar como eu</option>
          ${Object.keys(state.npcProfiles || {}).map(h =>
            `<option value="${escapeHTML(h)}" ${selectedAs === h ? 'selected' : ''}>@${escapeHTML(h)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="apt-row">
        <button type="button" class="btn btn-ghost btn-sm" onclick="togglePin('${p.id}'); closeMesaControlsModal()">${p.pinned ? 'Desafixar' : 'Fixar'}</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="setSessionMode({ postId: '${p.id}', label: 'Sessão' }); closeMesaControlsModal()">Sessão</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="adminOpenTimeEditor('${p.id}')">Horário</button>
        <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deletePost('${p.id}'); closeMesaControlsModal()">Apagar post</button>
      </div>
    </div>`;

  document.getElementById('mesa-controls-modal')?.classList.add('open');
}

function closeMesaControlsModal() {
  document.getElementById('mesa-controls-modal')?.classList.remove('open');
}

function setCommentAsHandle(handle) {
  state.commentAsHandle = handle || '';
  const sel = document.getElementById('comment-as-handle');
  if (sel) sel.value = state.commentAsHandle;
}

function ensureMesaControlsModal() {
  if (document.getElementById('mesa-controls-modal')) return;
  const d = document.createElement('div');
  d.id = 'mesa-controls-modal';
  d.className = 'modal ig-dialog';
  d.innerHTML = `
    <div class="ig-dialog-card mesa-controls-card" onclick="event.stopPropagation()">
      <div class="ig-dialog-title">Controles da mesa</div>
      <div class="ig-dialog-body" id="mesa-controls-body"></div>
      <div class="ig-dialog-actions">
        <button type="button" class="ig-dialog-btn" onclick="closeMesaControlsModal()">Fechar</button>
      </div>
    </div>`;
  d.addEventListener('click', e => { if (e.target === d) closeMesaControlsModal(); });
  document.body.appendChild(d);
}

async function deleteComment(postId, commentId) {
  if (!state.user) return;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const comment = (post.comments || {})[commentId];
  if (!comment) return;

  const isOwner = comment.uid === state.user.uid;
  if (!isUserAdmin() && !isOwner) {
    showToast('Sem permissão.', 'err');
    return;
  }

  const ok = await rgConfirm({
    title: 'Apagar comentário',
    body: 'Remover este comentário' + (comment.handle ? ' de <strong>@' + escapeHTML(comment.handle) + '</strong>' : '') + '?',
    confirmLabel: 'Apagar',
    danger: true
  });
  if (!ok) return;

  try {
    await db.ref('posts/' + postId + '/comments/' + commentId).remove();
    // recalcula count a partir do que restou (evita drift)
    const snap = await db.ref('posts/' + postId + '/comments').once('value');
    const n = snap.exists() ? Object.keys(snap.val() || {}).length : 0;
    await db.ref('posts/' + postId + '/commentCount').set(n);
    showToast('Comentário removido.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao apagar comentário.', 'err');
  }
}
