function listenProfile(uid) {
  db.ref('users/' + uid).on('value', snap => {
    state.profile = snap.val();
    updateChrome();
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'admin') renderAdmin();
  });
}

function listenPosts() {
  db.ref('posts').orderByChild('createdAt').limitToLast(100).on('value', snap => {
    const data = snap.val() || {};
    const now = Date.now();
    state.posts = Object.entries(data)
      .map(([id, p]) => ({ id, ...p }))
      .filter(p => {
        if (!p.publishAt || p.publishAt <= now) return true;
        return isUserAdmin(); // admin ve fila agendada
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'feed') renderFeed();
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'admin') renderAdmin();
    if (state.activePost) renderPostModal(state.activePost);
    state.postsLoaded = true;
    checkNotifFromPosts();
  });
}

function listenProfiles() {
  db.ref('users').on('value', snap => {
    state.profiles = snap.val() || {};
    if (state.currentView === 'feed') renderFeed();
  });
}

function listenNpcProfiles() {
  db.ref('npcProfiles').on('value', snap => {
    state.npcProfiles = snap.val() || {};
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'admin') renderAdmin();
  });
}

function listenStories() {
  db.ref('stories').orderByChild('createdAt').limitToLast(30).on('value', snap => {
    const data = snap.val() || {};
    const now = Date.now();
    state.stories = Object.entries(data)
      .map(([id, s]) => ({ id, ...s }))
      .filter(s => !s.expiresAt || s.expiresAt > now)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'feed') renderStories();
  });
}

function updateChrome() {
  const h = document.getElementById('chrome-handle');
  if (h && state.profile) h.textContent = displayHandle(state.profile.handle);
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isUserAdmin());
  });
  if (typeof renderRightRail === 'function') renderRightRail();
}

async function createPost({ caption, image, asHandle, asName, publishAt }) {
  if (!state.user || !state.profile) return false;
  const img = (image || '').trim();
  if (!img) {
    showToast('Instagram in-world precisa de imagem (URL).', 'err');
    return false;
  }
  const text = (caption || '').trim().slice(0, 500);

  let handle = state.profile.handle;
  let name = state.profile.name;
  let uid = state.user.uid;
  let avatar = state.profile.avatar || '';

  if (asHandle && isUserAdmin()) {
    handle = normalizeHandle(asHandle);
    name = asName || handle;
    uid = 'npc_' + handle;
    avatar = (state.npcProfiles?.[handle]?.avatar) || '';
  }

  const now = Date.now();
  const post = {
    caption: text,
    image: img,
    uid, handle, name, avatar,
    likes: {},
    likeCount: 0,
    comments: {},
    commentCount: 0,
    pinned: false,
    createdAt: now
  };
  if (publishAt && Number(publishAt) > now) {
    post.publishAt = Number(publishAt);
    post.scheduled = true;
  }

  try {
    const ref = await db.ref('posts').push(post);
    await notifyMentions(text, ref.key, handle);
    if (isUserAdmin() && img) {
      try { await saveMediaUrl(img, handle); } catch (_) {}
    }
    return true;
  } catch (e) {
    console.error(e);
    showToast('Erro ao publicar.', 'err');
    return false;
  }
}

async function deletePost(id) {
  const post = state.posts.find(p => p.id === id);
  if (!post) return;
  if (post.uid !== state.user?.uid && !isUserAdmin()) {
    showToast('Sem permissão.', 'err');
    return;
  }
  const ok = await rgConfirm({ title: 'Apagar post', body: 'Remover esta publicação?', confirmLabel: 'Apagar', danger: true });
  if (!ok) return;
  try {
    await db.ref('posts/' + id).remove();
    if (state.activePost === id) closePostModal();
    showToast('Removido.');
  } catch (e) {
    showToast('Erro ao apagar.', 'err');
  }
}

async function toggleLike(postId) {
  if (!state.user) return;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const liked = !!(post.likes && post.likes[state.user.uid]);
  try {
    if (liked) {
      await db.ref(`posts/${postId}/likes/${state.user.uid}`).remove();
      await db.ref(`posts/${postId}/likeCount`).set(Math.max(0, (post.likeCount || 0) - 1));
    } else {
      await db.ref(`posts/${postId}/likes/${state.user.uid}`).set(Date.now());
      await db.ref(`posts/${postId}/likeCount`).set((post.likeCount || 0) + 1);
      if (post.uid && post.uid !== state.user.uid && !String(post.uid).startsWith('npc_')) {
        await pushNotification(post.uid, {
          type: 'like',
          fromHandle: state.profile?.handle,
          postId
        });
      }
    }
  } catch (e) {
    showToast('Erro no like.', 'err');
  }
}

async function addComment(postId, text, asNpc) {
  if (!state.user) {
    showToast('Faça login para comentar.', 'err');
    return;
  }
  if (!state.profile) {
    showToast('Perfil ainda carregando… tente de novo.', 'err');
    return;
  }
  const body = (text || '').trim().slice(0, 240);
  if (!body) return;

  let handle = normalizeHandle(state.profile.handle);
  let name = state.profile.name || handle;
  let uid = state.user.uid;

  if (asNpc && isUserAdmin()) {
    handle = normalizeHandle(asNpc.handle || asNpc);
    name = asNpc.name || handle;
    uid = 'npc_' + handle;
  }

  if (!handle) {
    showToast('Seu @ não está definido.', 'err');
    return;
  }

  const c = {
    text: body,
    uid, handle, name,
    createdAt: Date.now()
  };
  try {
    await db.ref('posts/' + postId + '/comments').push(c);
    try {
      const post = state.posts.find(p => p.id === postId);
      const next = (post?.commentCount || 0) + 1;
      await db.ref('posts/' + postId + '/commentCount').set(next);
      if (post && post.uid && post.uid !== uid && !String(post.uid).startsWith('npc_')) {
        await pushNotification(post.uid, {
          type: 'comment',
          fromHandle: handle,
          postId,
          text: body.slice(0, 80)
        });
      }
    } catch (e2) {
      console.warn('comment meta', e2);
    }
  } catch (e) {
    console.error('addComment', e);
    showToast('Erro no comentário (permissão?).', 'err');
  }
}

async function saveProfile(data) {
  if (!state.user) return;
  try {
    await db.ref('users/' + state.user.uid).update({
      name: data.name,
      bio: data.bio,
      avatar: data.avatar,
      updatedAt: Date.now()
    });
    if (state.profile?.handle) {
      await db.ref('handles/' + state.profile.handle).update({ name: data.name });
    }
    showToast('Perfil salvo.');
  } catch (e) {
    showToast('Erro ao salvar.', 'err');
  }
}

async function createStory({ image, asHandle, asName }) {
  if (!state.user || !isUserAdmin()) {
    showToast('Só admin cria story por enquanto.', 'err');
    return false;
  }
  const img = (image || '').trim();
  if (!img) {
    showToast('URL da imagem obrigatória.', 'err');
    return false;
  }
  const handle = normalizeHandle(asHandle || state.profile.handle);
  const story = {
    image: img,
    handle,
    name: asName || handle,
    uid: state.user.uid,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 3600 * 1000
  };
  try {
    await db.ref('stories').push(story);
    showToast('Story no ar (24h).');
    return true;
  } catch (e) {
    showToast('Erro no story.', 'err');
    return false;
  }
}

async function togglePin(postId) {
  if (!isUserAdmin()) return;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  try {
    await db.ref(`posts/${postId}/pinned`).set(!post.pinned);
    showToast(post.pinned ? 'Desafixado.' : 'Fixado no topo.');
  } catch (e) {
    showToast('Erro ao fixar.', 'err');
  }
}


function listenSiteSettings() {
  db.ref('siteSettings').on('value', snap => {
    state.siteSettings = snap.val() || {};
    if (state.currentView === 'feed') renderFeed();
    if (state.currentView === 'admin') renderAdmin();
  });
}

function listenHighlights() {
  db.ref('highlights').on('value', snap => {
    state.highlights = snap.val() || {};
    if (state.currentView === 'profile') renderProfile();
  });
}

function listenNotifications(uid) {
  db.ref('notifications/' + uid).orderByChild('createdAt').limitToLast(40).on('value', snap => {
    const data = snap.val() || {};
    state.notifications = Object.entries(data)
      .map(([id, n]) => ({ id, ...n }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    state.unreadNotifs = state.notifications.filter(n => !n.read).length;
    updateNotifBadge();
    if (state.currentView === 'notifications') renderNotifications();
  });
}

function listenDMs(uid) {
  db.ref('dms').on('value', snap => {
    const data = snap.val() || {};
    state.dms = data;
    // threads involving me
    const threads = [];
    Object.entries(data).forEach(([id, t]) => {
      if (!t) return;
      const members = t.members || {};
      if (members[uid] || isUserAdmin()) {
        threads.push({ id, ...t });
      }
    });
    threads.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    state.dmThreads = threads;
    state.unreadDms = threads.reduce((s, t) => {
      const msgs = Object.values(t.messages || {});
      return s + msgs.filter(m => !m.read && m.fromUid !== uid).length;
    }, 0);
    updateDmBadge();
    if (state.currentView === 'dms') renderDMs();
  });
}

function updateNotifBadge() {
  document.querySelectorAll('.badge-notif').forEach(el => {
    const n = state.unreadNotifs || 0;
    el.textContent = n > 9 ? '9+' : String(n);
    el.classList.toggle('hidden', n === 0);
  });
}

function updateDmBadge() {
  document.querySelectorAll('.badge-dm').forEach(el => {
    const n = state.unreadDms || 0;
    el.textContent = n > 9 ? '9+' : String(n);
    el.classList.toggle('hidden', n === 0);
  });
}

async function pushNotification(toUid, payload) {
  if (!toUid || String(toUid).startsWith('npc_')) return;
  try {
    await db.ref('notifications/' + toUid).push({
      ...payload,
      read: false,
      createdAt: Date.now()
    });
  } catch (e) { console.warn('notif', e); }
}

async function notifyMentions(text, postId, fromHandle) {
  const re = /@([a-z0-9_]{2,24})/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(text || ''))) {
    const h = normalizeHandle(m[1]);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    const entry = Object.entries(state.profiles || {}).find(([, u]) => normalizeHandle(u.handle) === h);
    if (entry) {
      await pushNotification(entry[0], {
        type: 'mention',
        fromHandle,
        postId,
        text: (text || '').slice(0, 80)
      });
    }
  }
}

function checkNotifFromPosts() {
  // no-op hook; likes handled in toggleLike
}

async function markNotifsRead() {
  if (!state.user) return;
  const updates = {};
  state.notifications.filter(n => !n.read).forEach(n => {
    updates[`notifications/${state.user.uid}/${n.id}/read`] = true;
  });
  if (Object.keys(updates).length) {
    try { await db.ref().update(updates); } catch (e) { console.warn(e); }
  }
}

async function setSessionMode({ postId, storyId, label }) {
  if (!isUserAdmin()) return;
  try {
    await db.ref('siteSettings/session').set({
      postId: postId || null,
      storyId: storyId || null,
      label: label || 'Sessão',
      updatedAt: Date.now()
    });
    showToast('Modo sessão atualizado.');
  } catch (e) {
    showToast('Erro no modo sessão.', 'err');
  }
}

async function addHighlight(handle, { title, image }) {
  if (!isUserAdmin() && normalizeHandle(handle) !== normalizeHandle(state.profile?.handle)) {
    showToast('Sem permissão.', 'err');
    return false;
  }
  const h = normalizeHandle(handle);
  const img = (image || '').trim();
  if (!img) {
    showToast('URL da imagem obrigatória.', 'err');
    return false;
  }
  try {
    await db.ref('highlights/' + h).push({
      title: (title || 'Destaque').slice(0, 24),
      image: img,
      createdAt: Date.now()
    });
    showToast('Destaque adicionado.');
    return true;
  } catch (e) {
    showToast('Erro no destaque.', 'err');
    return false;
  }
}

async function deleteHighlight(handle, hid) {
  if (!isUserAdmin()) return;
  try {
    await db.ref(`highlights/${normalizeHandle(handle)}/${hid}`).remove();
    showToast('Destaque removido.');
  } catch (e) {
    showToast('Erro.', 'err');
  }
}

/** DM: thread id is sorted pair of uids, or admin-npc special */
function dmThreadId(a, b) {
  return [a, b].sort().join('__');
}

async function openOrCreateDm(otherUid, otherHandle, otherName) {
  if (!state.user) return;
  const my = state.user.uid;
  const tid = dmThreadId(my, otherUid);
  const ref = db.ref('dms/' + tid);
  const snap = await ref.once('value');
  if (!snap.exists()) {
    await ref.set({
      members: {
        [my]: { handle: state.profile?.handle, name: state.profile?.name },
        [otherUid]: { handle: otherHandle, name: otherName }
      },
      updatedAt: Date.now(),
      messages: {}
    });
  }
  state.activeDmId = tid;
  showView('dms');
}

async function sendDm(threadId, text) {
  if (!state.user || !text.trim()) return;
  const body = text.trim().slice(0, 500);
  try {
    await db.ref(`dms/${threadId}/messages`).push({
      text: body,
      fromUid: state.user.uid,
      fromHandle: state.profile?.handle,
      createdAt: Date.now(),
      read: false
    });
    await db.ref(`dms/${threadId}/updatedAt`).set(Date.now());
  } catch (e) {
    showToast('Erro ao enviar DM.', 'err');
  }
}

async function seedCityFeed() {
  if (!isUserAdmin()) return;
  const samples = [
    { handle: 'porto_wire', name: 'Porto Wire', caption: 'Movimento atípico no cais. Núcleo observa. #porto', image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800' },
    { handle: 'nina_riders', name: 'Nina Riders', caption: 'ensaio. luz errada. perfeito. #NinaLive', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800' },
    { handle: 'gs_official', name: 'Global Smith', caption: 'Catálogo estável. Rank sobe com entrega — não com rumor.', image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?w=800' },
    { handle: 'subsolo_echo', name: 'Subsolo Echo', caption: 'se voce viu o lote da noite, nao viu. #subsolo', image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800' },
    { handle: 'dock_cam', name: 'Dock Cam', caption: '03:12 · neblina · zero ocorrencias oficiais', image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800' },
    { handle: 'nexo_pulse', name: 'Nexo Pulse', caption: 'A cidade respira em posts. Voce so escuta se abrir o fio.', image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800' }
  ];
  try {
    for (const s of samples) {
      await db.ref('posts').push({
        caption: s.caption,
        image: s.image,
        uid: 'npc_' + s.handle,
        handle: s.handle,
        name: s.name,
        avatar: '',
        likes: {},
        likeCount: Math.floor(Math.random() * 40),
        comments: {},
        commentCount: 0,
        pinned: false,
        createdAt: Date.now() - Math.floor(Math.random() * 86400000)
      });
      await db.ref('npcProfiles/' + s.handle).update({
        name: s.name,
        bio: 'Conta da mesa',
        followersCount: 500 + Math.floor(Math.random() * 8000),
        followingCount: 50 + Math.floor(Math.random() * 200),
        updatedAt: Date.now()
      });
    }
    showToast('Cidade no ar · 6 posts seed.');
  } catch (e) {
    console.error(e);
    showToast('Erro no seed.', 'err');
  }
}


function listenFollowing(uid) {
  db.ref('following/' + uid).on('value', snap => {
    state.following = snap.val() || {};
    if (state.currentView === 'feed') renderFeed();
    if (state.currentView === 'profile') renderProfile();
  });
}

function listenMediaLibrary() {
  db.ref('mediaLibrary').on('value', snap => {
    const data = snap.val() || {};
    state.mediaLibrary = Object.entries(data)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'admin') renderAdmin();
  });
}

function isFollowing(handle) {
  const h = normalizeHandle(handle);
  return !!(state.following && state.following[h]);
}

async function toggleFollow(handle) {
  if (!state.user) return;
  const h = normalizeHandle(handle);
  if (!h) return;
  // player NÃO grava em npcProfiles (rules = só admin) — só em following/{uid}
  const path = 'following/' + state.user.uid + '/' + h;
  try {
    if (isFollowing(h)) {
      await db.ref(path).remove();
      showToast('Deixou de seguir @' + h);
    } else {
      await db.ref(path).set({ at: Date.now(), handle: h });
      showToast('Seguindo @' + h);
    }
  } catch (e) {
    console.error('toggleFollow', e);
    showToast('Erro ao seguir (permissão?).', 'err');
  }
}

async function saveMediaUrl(url, label) {
  if (!isUserAdmin() || !(url || '').trim()) return;
  try {
    await db.ref('mediaLibrary').push({
      url: url.trim(),
      label: (label || '').slice(0, 40),
      createdAt: Date.now()
    });
    showToast('Salvo na biblioteca.');
  } catch (e) {
    showToast('Erro na biblioteca.', 'err');
  }
}

async function deleteMediaItem(id) {
  if (!isUserAdmin()) return;
  try {
    await db.ref('mediaLibrary/' + id).remove();
  } catch (e) {
    showToast('Erro.', 'err');
  }
}

async function adminSetPostTime(postId, isoOrOffset) {
  if (!isUserAdmin()) return;
  // isoOrOffset: datetime-local string OR minutes ago number prefixed with -
  try {
    let ts = Date.now();
    if (typeof isoOrOffset === 'number') {
      ts = Date.now() - isoOrOffset * 60000;
    } else if (isoOrOffset) {
      const t = new Date(isoOrOffset).getTime();
      if (!isNaN(t)) ts = t;
    }
    await db.ref('posts/' + postId).update({
      createdAt: ts,
      timeOverride: true
    });
    showToast('Horário do post ajustado.');
  } catch (e) {
    showToast('Erro no horário.', 'err');
  }
}
