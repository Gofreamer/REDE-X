/* Rede X — Database */

function listenProfile(uid) {
  db.ref('users/' + uid).on('value', (snap) => {
    state.profile = snap.val() || null;
    updateHeaderUser();
    updateAdminVisibility();
    if (state.currentView === 'profile') renderProfile();
    if (state.currentView === 'admin') renderAdmin();
  });
}

function listenPosts() {
  db.ref('posts').orderByChild('createdAt').limitToLast(80).on('value', (snap) => {
    const data = snap.val() || {};
    state.posts = Object.entries(data)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (state.currentView === 'home') renderTimeline();
    if (state.currentView === 'admin') renderAdmin();
  });
}

function listenProfiles() {
  db.ref('users').on('value', (snap) => {
    state.profiles = snap.val() || {};
    if (state.currentView === 'home') renderTimeline();
    if (state.currentView === 'admin') renderAdmin();
  });
}

function updateHeaderUser() {
  const el = document.getElementById('header-user');
  if (!el || !state.profile) return;
  el.textContent = displayHandle(state.profile.handle);
}

function updateAdminVisibility() {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isUserAdmin());
  });
}

async function createPost({ text, image, replyTo, asHandle, asName }) {
  if (!state.user || !state.profile) {
    showToast('Faça login.', 'error');
    return false;
  }
  const body = (text || '').trim().slice(0, 280);
  if (!body) {
    showToast('Escreva algo.', 'error');
    return false;
  }

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
    text: body,
    image: (image || '').trim() || null,
    uid,
    handle,
    name,
    avatar,
    replyTo: replyTo || null,
    likes: {},
    likeCount: 0,
    createdAt: Date.now()
  };

  try {
    await db.ref('posts').push(post);
    return true;
  } catch (e) {
    console.error(e);
    showToast('Erro ao postar.', 'error');
    return false;
  }
}

async function deletePost(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const mine = post.uid === state.user?.uid;
  if (!mine && !isUserAdmin()) {
    showToast('Sem permissão.', 'error');
    return;
  }
  const ok = await rxConfirm({
    title: 'Apagar post',
    body: 'Remover este post da rede?',
    confirmLabel: 'Apagar',
    danger: true
  });
  if (!ok) return;
  try {
    await db.ref('posts/' + postId).remove();
    showToast('Post removido.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao apagar.', 'error');
  }
}

async function toggleLike(postId) {
  if (!state.user) return;
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;
  const path = `posts/${postId}/likes/${state.user.uid}`;
  const liked = !!(post.likes && post.likes[state.user.uid]);
  try {
    if (liked) {
      await db.ref(path).remove();
      const count = Math.max(0, (Number(post.likeCount) || 0) - 1);
      await db.ref(`posts/${postId}/likeCount`).set(count);
    } else {
      await db.ref(path).set(Date.now());
      const count = (Number(post.likeCount) || 0) + 1;
      await db.ref(`posts/${postId}/likeCount`).set(count);
    }
  } catch (e) {
    console.error(e);
    showToast('Erro no like.', 'error');
  }
}

async function saveProfile(data) {
  if (!state.user) return false;
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
    showToast('Perfil atualizado.');
    return true;
  } catch (e) {
    console.error(e);
    showToast('Erro ao salvar perfil.', 'error');
    return false;
  }
}
