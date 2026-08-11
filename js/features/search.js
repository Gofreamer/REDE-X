/* Rede Global — Search & public profiles */

function openSearch() {
  document.getElementById('search-modal')?.classList.add('open');
  const input = document.getElementById('search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  renderSearchResults('');
}

function closeSearch() {
  document.getElementById('search-modal')?.classList.remove('open');
}

function onSearchInput() {
  const q = document.getElementById('search-input')?.value || '';
  renderSearchResults(q);
}

function collectSearchableProfiles() {
  const map = {};

  Object.entries(state.profiles || {}).forEach(([id, u]) => {
    const h = normalizeHandle(u.handle);
    if (!h) return;
    map[h] = {
      kind: 'user',
      uid: id,
      handle: h,
      name: u.name || h,
      avatar: u.avatar || '',
      bio: u.bio || '',
      followers: Number(u.followersCount) || 0,
      following: Number(u.followingCount) || 0
    };
  });

  Object.entries(state.npcProfiles || {}).forEach(([hRaw, u]) => {
    const h = normalizeHandle(hRaw);
    if (!h) return;
    map[h] = {
      kind: 'npc',
      handle: h,
      name: u.name || h,
      avatar: u.avatar || '',
      bio: u.bio || '',
      followers: Number(u.followersCount) || 0,
      following: Number(u.followingCount) || 0
    };
  });

  // handles only seen on posts
  state.posts.forEach(p => {
    const h = normalizeHandle(p.handle);
    if (!h || map[h]) return;
    map[h] = {
      kind: 'npc',
      handle: h,
      name: p.name || h,
      avatar: p.avatar || '',
      bio: '',
      followers: 0,
      following: 0
    };
  });

  return Object.values(map).sort((a, b) => a.handle.localeCompare(b.handle));
}

function renderSearchResults(query) {
  const el = document.getElementById('search-results');
  if (!el) return;
  const q = normalizeHandle(query) || String(query || '').trim().toLowerCase();
  let list = collectSearchableProfiles();
  if (q) {
    list = list.filter(p =>
      p.handle.includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.bio || '').toLowerCase().includes(q)
    );
  }
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="padding:32px 12px"><h3>Nada no radar</h3><p>Nenhum @ ou nome bate com a busca. A cidade é grande.</p></div>`;
    return;
  }
  el.innerHTML = list.slice(0, 40).map(p => `
    <button type="button" class="search-row" onclick="openProfile('${escapeHTML(p.handle)}')">
      ${avatarHTML(p, 'sm')}
      <div class="rail-me-text">
        <strong>${escapeHTML(p.handle)}</strong>
        <span>${escapeHTML(p.name)}${p.kind === 'npc' ? ' · NPC' : ''}</span>
      </div>
    </button>
  `).join('');
}

function openProfile(handle) {
  closeSearch();
  state.viewProfileHandle = normalizeHandle(handle);
  state.profileTab = 'posts';
  showView('profile');
}

function getProfileBundle(handle) {
  const h = normalizeHandle(handle);
  const userEntry = Object.entries(state.profiles || {}).find(([, u]) => normalizeHandle(u.handle) === h);
  if (userEntry) {
    const [uid, u] = userEntry;
    const isMe = !!(state.user && uid === state.user.uid);
    // "seguindo" do player: conta real da lista following/
    let followingN = Number(u.followingCount) || 0;
    if (isMe) {
      followingN = Object.keys(state.following || {}).length;
    }
    return {
      kind: 'user',
      uid,
      handle: h,
      name: u.name || h,
      bio: u.bio || '',
      avatar: u.avatar || '',
      followers: Number(u.followersCount) || 0,
      following: followingN,
      isMe,
      verified: !!u.verified,
      suspended: !!u.suspended,
      banned: !!u.banned
    };
  }
  const npc = (state.npcProfiles || {})[h] || {};
  // fallback from posts
  const post = state.posts.find(p => normalizeHandle(p.handle) === h);
  return {
    kind: 'npc',
    handle: h,
    name: npc.name || post?.name || h,
    bio: npc.bio || '',
    avatar: npc.avatar || post?.avatar || '',
    followers: Number(npc.followersCount) || 0,
    following: Number(npc.followingCount) || 0,
    isMe: false,
    verified: !!npc.verified,
    suspended: !!npc.suspended,
    banned: !!npc.banned
  };
}

function postsForHandle(handle) {
  const h = normalizeHandle(handle);
  return state.posts.filter(p => normalizeHandle(p.handle) === h);
}
