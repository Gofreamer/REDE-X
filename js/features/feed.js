function renderFeed() {
  renderStories();
  const el = document.getElementById('feed');
  if (!el) return;

  const now = Date.now();
  const session = state.siteSettings?.session || {};
  let posts = [...state.posts].filter(p => !p.publishAt || p.publishAt <= now || isUserAdmin());
  posts.sort((a, b) => {
    if (session.postId) {
      if (a.id === session.postId && b.id !== session.postId) return -1;
      if (b.id === session.postId && a.id !== session.postId) return 1;
    }
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const sessionBanner = session.postId || session.label ? `
    <div class="session-banner">
      <strong>Sessão</strong>
      <span>${escapeHTML(session.label || 'No ar esta noite')}</span>
    </div>` : '';

  if (!posts.length) {
    el.innerHTML = sessionBanner + `
      <div class="empty">
        <div class="empty-glow"></div>
        <h3>Rede em silêncio</h3>
        <p>Nenhuma publicação ainda. O mundo visual começa com uma imagem.</p>
        <button class="btn btn-primary" onclick="openCompose()">Publicar</button>
      </div>`;
    return;
  }

  el.innerHTML = sessionBanner + posts.map(renderPostCard).join('');
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
        <div class="ig-user" style="cursor:pointer" onclick="openProfile('${escapeHTML(normalizeHandle(p.handle))}')">
          <strong>${escapeHTML(p.name || p.handle)}</strong>
          <span>${displayHandle(p.handle)} · ${timeAgo(p.createdAt)}</span>
        </div>
        ${p.pinned ? '<span class="pin-badge">Fixado</span>' : ''}
        ${p.publishAt && p.publishAt > Date.now() ? '<span class="pin-badge">Agendado</span>' : ''}
        ${state.siteSettings?.session?.postId === p.id ? '<span class="pin-badge">Sessão</span>' : ''}
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
          ${isUserAdmin() ? `
            <div class="admin-post-tools" id="admin-post-tools">
              <div class="apt-title">Controles da mesa</div>
              <div class="apt-row">
                <label>Likes</label>
                <input type="number" id="adm-like-count" class="input input-sm" min="0" value="${p.likeCount || 0}" style="width:90px"/>
                <button type="button" class="btn btn-ghost btn-sm" onclick="adminSetLikes('${p.id}')">Aplicar</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="adminGenerateLikes('${p.id}')">+ auto</button>
              </div>
              <div class="apt-row">
                <label>Coments</label>
                <button type="button" class="btn btn-ghost btn-sm" onclick="adminGenerateComments('${p.id}', 3)">+3 auto</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="adminGenerateComments('${p.id}', 1)">+1 auto</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="aiReplyComment('${p.id}')">IA reply</button>
              </div>
              <div class="apt-row">
                <select id="comment-as-handle" class="input input-sm">
                  <option value="">comentar como eu</option>
                  ${Object.keys(state.npcProfiles || {}).map(h =>
                    `<option value="${escapeHTML(h)}">@${escapeHTML(h)}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="apt-row">
                <button type="button" class="btn btn-ghost btn-sm" onclick="togglePin('${p.id}')">${p.pinned ? 'Desafixar' : 'Fixar'}</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="setSessionMode({ postId: '${p.id}', label: 'Sessão' })">Sessão</button>
                <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deletePost('${p.id}')">Apagar</button>
              </div>
            </div>
          ` : ''}
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
  const asH = document.getElementById('comment-as-handle')?.value?.trim();
  const asNpc = asH && isUserAdmin() ? { handle: asH, name: asH } : null;
  await addComment(postId, text, asNpc);
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
  const n = Math.max(0, parseInt(document.getElementById('adm-like-count')?.value, 10) || 0);
  try {
    // rebuild likes map with fake keys to match count (keep real user likes)
    const post = state.posts.find(p => p.id === postId);
    const real = {};
    if (post?.likes) {
      Object.entries(post.likes).forEach(([uid, v]) => {
        if (!String(uid).startsWith('bot_')) real[uid] = v;
      });
    }
    const realCount = Object.keys(real).length;
    const botsNeeded = Math.max(0, n - realCount);
    const likes = { ...real };
    for (let i = 0; i < botsNeeded; i++) {
      likes['bot_' + i + '_' + postId.slice(0, 6)] = Date.now() - i * 1000;
    }
    await db.ref('posts/' + postId + '/likes').set(likes);
    await db.ref('posts/' + postId + '/likeCount').set(n);
    showToast(n + ' curtidas.');
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
    ? npcs.map(([h, u]) => ({ handle: h, name: u.name || h }))
    : [
        { handle: 'porto_wire', name: 'Porto Wire' },
        { handle: 'nexo_pulse', name: 'Nexo Pulse' },
        { handle: 'dock_cam', name: 'Dock Cam' },
        { handle: 'subsolo_echo', name: 'Subsolo Echo' }
      ];

  try {
    for (let i = 0; i < count; i++) {
      const who = handles[Math.floor(Math.random() * handles.length)];
      const text = pickCommentText(post.caption);
      await db.ref('posts/' + postId + '/comments').push({
        text,
        uid: 'npc_' + who.handle,
        handle: who.handle,
        name: who.name,
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
