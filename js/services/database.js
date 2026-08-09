function listenProfile(uid) {
  db.ref('users/' + uid).on('value', snap => {
    state.profile = snap.val();
    updateChrome();
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'admin') renderAdmin();
  });
}

function listenPosts() {
  db.ref('posts').orderByChild('createdAt').limitToLast(60).on('value', snap => {
    const data = snap.val() || {};
    state.posts = Object.entries(data)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'feed') renderFeed();
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'admin') renderAdmin();
    if (state.activePost) renderPostModal(state.activePost);
  });
}

function listenProfiles() {
  db.ref('users').on('value', snap => {
    state.profiles = snap.val() || {};
    if (state.currentView === 'feed') renderFeed();
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
}

async function createPost({ caption, image, asHandle, asName }) {
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
    avatar = '';
  }

  const post = {
    caption: text,
    image: img,
    uid, handle, name, avatar,
    likes: {},
    likeCount: 0,
    comments: {},
    commentCount: 0,
    pinned: false,
    createdAt: Date.now()
  };

  try {
    await db.ref('posts').push(post);
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
    }
  } catch (e) {
    showToast('Erro no like.', 'err');
  }
}

async function addComment(postId, text) {
  if (!state.user || !state.profile) return;
  const body = (text || '').trim().slice(0, 240);
  if (!body) return;
  const c = {
    text: body,
    uid: state.user.uid,
    handle: state.profile.handle,
    name: state.profile.name,
    createdAt: Date.now()
  };
  try {
    await db.ref(`posts/${postId}/comments`).push(c);
    const post = state.posts.find(p => p.id === postId);
    await db.ref(`posts/${postId}/commentCount`).set((post?.commentCount || 0) + 1);
  } catch (e) {
    showToast('Erro no comentário.', 'err');
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
