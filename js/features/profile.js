/* Rede Global — Profile (Instagram-like) */

function renderProfile() {
  const el = document.getElementById('profile-root');
  if (!el) return;

  if (!state.postsLoaded && !state.profile) {
    el.innerHTML = `<div class="ig-profile"><div class="ig-profile-header"><div class="sk sk-avatar xl"></div><div style="flex:1"><div class="sk sk-line"></div><div class="sk sk-line short"></div></div></div></div>`;
    return;
  }

  const handle = state.viewProfileHandle || state.profile?.handle;
  if (!handle) {
    el.innerHTML = `<div class="empty"><h3>Sinal fraco</h3><p>Nenhum perfil neste handle.</p></div>`;
    return;
  }

  const bundle = getProfileBundle(handle);
  const hNorm = normalizeHandle(handle);
  // Preferência: histórico indexado do perfil; fallback feed enquanto carrega
  const pp = state.profilePosts;
  const usingIndex = pp && pp.handle === hNorm && (pp.items.length || pp.loading || pp.count != null);
  const posts = usingIndex
    ? (pp.items || [])
    : postsForHandle(handle);
  const postCountDisplay = usingIndex && typeof pp.count === 'number'
    ? pp.count
    : posts.length;
  const isMe = bundle.isMe;
  const suspended = !!(bundle.suspended || bundle.banned);
  const banned = !!bundle.banned;

  // se ainda não começou o load do índice para este handle, dispara
  if (state.profileTab !== 'saved' && (!pp || pp.handle !== hNorm) && typeof loadProfilePosts === 'function') {
    loadProfilePosts(hNorm, true).catch(() => {});
  }

  el.innerHTML = `
    <div class="ig-profile ${banned ? 'profile-banned' : (suspended ? 'profile-suspended' : '')}">
      ${banned ? `<div class="account-status-banner banned"><strong>Conta banida</strong><span>Esta conta foi desativada permanentemente pela Rede Global.</span></div>` : ''}
      ${suspended && !banned ? `<div class="account-status-banner suspended"><strong>Conta suspensa</strong><span>Atividade limitada · decisão da moderação da cidade.</span></div>` : ''}
      <div class="ig-profile-top mobile-only">
        <strong>${escapeHTML(bundle.handle)}${verifiedBadgeHTML(!!bundle.verified)}</strong>
        ${isMe ? `<button type="button" class="icon-btn" onclick="openEditProfile()">⚙</button>` : ''}
      </div>

      <div class="ig-profile-header">
        ${avatarHTML(bundle, 'xl')}
        <div class="ig-profile-meta">
          <div class="ig-profile-userline desktop-only">
            <h2 class="ig-username">${escapeHTML(bundle.handle)}${verifiedBadgeHTML(!!bundle.verified)}</h2>
            ${isMe
              ? `<button type="button" class="btn btn-edit" onclick="openEditProfile()">Editar perfil</button>`
              : `${bundle.kind === 'npc' || !bundle.isMe ? `
                  <button type="button" class="btn ${isFollowing(bundle.handle) ? 'btn-edit' : 'btn-follow'}" onclick="toggleFollow('${escapeHTML(bundle.handle)}')">
                    ${isFollowing(bundle.handle) ? 'Seguindo' : 'Seguir'}
                  </button>` : ''}
                 <button type="button" class="btn btn-edit" onclick="startDmWithHandle('${escapeHTML(bundle.handle)}')">Mensagem</button>
                 ${isUserAdmin() ? `<button type="button" class="btn btn-edit" onclick="openEditNpc('${escapeHTML(bundle.handle)}')">Editar NPC</button>` : ''}`}
            ${isUserAdmin() ? `<button type="button" class="btn btn-edit" onclick="toggleVerified('${escapeHTML(bundle.handle)}','${escapeHTML(bundle.kind)}')">${bundle.verified ? 'Remover ✓' : 'Verificar ✓'}</button>` : ''}
          </div>
          <div class="ig-stats">
            <div class="ig-stat"><strong>${formatCount(postCountDisplay)}</strong><span>publicacoes</span></div>
            <div class="ig-stat"><strong>${formatCount(bundle.followers)}</strong><span>seguidores</span></div>
            <div class="ig-stat"><strong>${formatCount(bundle.following)}</strong><span>seguindo</span></div>
          </div>
          ${isUserAdmin() ? `
            <div class="admin-post-tools" style="margin-top:12px">
              <div class="apt-title">Mesa · este perfil</div>
              <div class="apt-row">
                <button type="button" class="btn btn-ghost btn-sm" onclick="openEditProfile()">Editar stats</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="adminBoostProfile('${escapeHTML(bundle.handle)}')">Boost seguidores</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="startDmWithHandle('${escapeHTML(bundle.handle)}')">DM</button>
                ${bundle.kind === 'npc' ? `<button type="button" class="btn btn-ghost btn-sm" onclick="quickFillNpc('${escapeHTML(bundle.handle)}')">Postar como</button>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" onclick="adminSuspendAccount('${escapeHTML(bundle.handle)}','${escapeHTML(bundle.kind)}',false)">Suspender</button>
                <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="adminSuspendAccount('${escapeHTML(bundle.handle)}','${escapeHTML(bundle.kind)}',true)">Banir</button>
                ${bundle.kind === 'npc' ? `<button type="button" class="btn btn-ghost btn-sm text-danger" onclick="adminDeleteNpc('${escapeHTML(bundle.handle)}')">Apagar NPC</button>` : ''}
                ${bundle.suspended || bundle.banned ? `<button type="button" class="btn btn-ghost btn-sm" onclick="adminUnsuspend('${escapeHTML(bundle.handle)}','${escapeHTML(bundle.kind)}')">Reativar</button>` : ''}
              </div>
            </div>
          ` : ''}
          <div class="ig-profile-bio-block desktop-only">
            <div class="ig-display-name">${escapeHTML(bundle.name)}${verifiedBadgeHTML(!!bundle.verified)}</div>
            ${bundle.bio ? `<div class="ig-bio">${linkify(bundle.bio)}</div>` : ''}
            ${bundle.kind === 'npc' ? `<div class="ig-badge-npc">Conta da mesa · NPC</div>` : ''}
          </div>
        </div>
      </div>

      <div class="ig-profile-bio-block mobile-only">
        <div class="ig-display-name">${escapeHTML(bundle.name)}${verifiedBadgeHTML(!!bundle.verified)}</div>
        ${bundle.bio ? `<div class="ig-bio">${linkify(bundle.bio)}</div>` : ''}
        ${bundle.kind === 'npc' ? `<div class="ig-badge-npc">Conta da mesa · NPC</div>` : ''}
        ${isMe
          ? `<button type="button" class="btn btn-edit btn-block" style="margin-top:12px" onclick="openEditProfile()">Editar perfil</button>`
          : `<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
              <button type="button" class="btn ${isFollowing(bundle.handle) ? 'btn-edit' : 'btn-follow'}" style="flex:1" onclick="toggleFollow('${escapeHTML(bundle.handle)}')">${isFollowing(bundle.handle) ? 'Seguindo' : 'Seguir'}</button>
              <button type="button" class="btn btn-edit" style="flex:1" onclick="startDmWithHandle('${escapeHTML(bundle.handle)}')">Mensagem</button>
            </div>
            ${isUserAdmin() ? `<button type="button" class="btn btn-edit btn-block" style="margin-top:8px" onclick="openEditProfile()">Editar NPC</button>` : ''}`}
      </div>

      ${renderHighlightsStrip(bundle.handle, isMe)}

      <div class="ig-profile-tabs">
        <button type="button" class="ig-tab ${state.profileTab !== 'saved' ? 'active' : ''}" onclick="setProfileTab('posts')">Publicações</button>
        ${isMe ? `<button type="button" class="ig-tab ${state.profileTab === 'saved' ? 'active' : ''}" onclick="setProfileTab('saved')">Salvos</button>` : ''}
      </div>

      <div class="profile-grid">
        ${(() => {
          if (isMe && state.profileTab === 'saved') {
            const savedIds = Object.keys(state.saves || {});
            if (!savedIds.length) {
              return `<div class="grid-empty">Nenhum post salvo.<br><span class="text-muted">Toque na estrela nos posts pra guardar evidências.</span></div>`;
            }
            // resolve da memória; IDs sem post em cache disparam fetch em background
            const savedPosts = savedIds
              .map(id => {
                const p = typeof getPostFromMemory === 'function' ? getPostFromMemory(id) : (state.posts || []).find(x => x.id === id);
                if (!p && typeof fetchPostById === 'function') {
                  fetchPostById(id).then(fp => {
                    if (fp && state.currentView === 'profile' && state.profileTab === 'saved') renderProfile();
                  }).catch(() => {});
                }
                return p;
              })
              .filter(Boolean)
              .sort((a, b) => (state.saves[b.id]?.at || 0) - (state.saves[a.id]?.at || 0));
            if (!savedPosts.length) {
              return `<div class="grid-empty">Carregando salvos…</div>`;
            }
            return savedPosts.map(post => `
              <button type="button" class="grid-cell" onclick="openPostModal('${post.id}')">
                <img src="${escapeHTML(post.image)}" alt="" loading="lazy"/>
              </button>`).join('');
          }

          if (usingIndex && pp.loading && !posts.length) {
            return `<div class="grid-empty">Carregando publicações…</div>`;
          }

          const grid = posts.length
            ? posts.map(post => `
                <button type="button" class="grid-cell" onclick="openPostModal('${post.id}')">
                  <img src="${escapeHTML(post.image)}" alt="" loading="lazy"/>
                </button>`).join('')
            : `<div class="grid-empty">Ainda não há publicações.</div>`;

          const moreBtn = usingIndex && pp.hasMore
            ? `<div class="profile-load-more">
                <button type="button" class="btn btn-ghost btn-sm" ${pp.loading ? 'disabled' : ''} onclick="loadMoreProfilePosts()">
                  ${pp.loading ? 'Carregando…' : 'Carregar mais'}
                </button>
              </div>`
            : '';

          return grid + moreBtn;
        })()}
      </div>
    </div>

    <div id="edit-profile-modal" class="modal" onclick="if(event.target===this)closeEditProfile()">
      <div class="modal-sheet">
        <div class="sheet-head">
          <h3>Editar perfil</h3>
          <button type="button" class="icon-btn" onclick="closeEditProfile()">✕</button>
        </div>
        <form id="edit-profile-form" onsubmit="submitEditProfile(event)">
          <input type="hidden" id="ep-handle" value="${escapeHTML(bundle.handle)}"/>
          <input type="hidden" id="ep-kind" value="${escapeHTML(bundle.kind)}"/>
          <label class="field"><span>Nome</span>
            <input id="ep-name" value="${escapeHTML(bundle.name)}" maxlength="40" required/>
          </label>
          <label class="field"><span>Bio</span>
            <textarea id="ep-bio" rows="3" maxlength="160">${escapeHTML(bundle.bio)}</textarea>
          </label>
          <label class="field"><span>Avatar (URL)</span>
            <input id="ep-avatar" type="url" value="${escapeHTML(bundle.avatar)}" placeholder="https://"/>
          </label>
          ${isUserAdmin() || isMe ? `
            <div class="form-row">
              <label class="field"><span>Seguidores</span>
                <input id="ep-followers" type="number" min="0" value="${bundle.followers}"/>
              </label>
              <label class="field"><span>Seguindo (base RP)</span>
                <input id="ep-following" type="number" min="0" value="${bundle.kind === 'user' ? (bundle.followingBase || 0) : bundle.following}"/>
              </label>
            </div>
            <p class="hint">Base RP de “seguindo”. Follows reais somam em cima (ex.: 30 + 1 NPC = 31).</p>
          ` : ''}
          ${isMe ? `
            <label class="field"><span>UID</span>
              <code class="uid">${escapeHTML(state.user?.uid || '')}</code>
            </label>
          ` : ''}
          <button type="submit" class="btn btn-primary btn-block">Salvar</button>
        </form>
      </div>
    </div>
  `;
}

function formatCount(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + ' M';
  if (n >= 10000) return Math.floor(n / 1000) + ' mil';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + ' mil';
  return String(n);
}

function setProfileTab(tab) {
  state.profileTab = tab === 'saved' ? 'saved' : 'posts';
  renderProfile();
}

function openEditProfile() {
  document.getElementById('edit-profile-modal')?.classList.add('open');
}

function openEditNpc(handle) {
  state.viewProfileHandle = normalizeHandle(handle);
  renderProfile();
  setTimeout(() => openEditProfile(), 50);
}

function closeEditProfile() {
  document.getElementById('edit-profile-modal')?.classList.remove('open');
}

async function submitEditProfile(e) {
  e.preventDefault();
  const handle = normalizeHandle(document.getElementById('ep-handle')?.value);
  const kind = document.getElementById('ep-kind')?.value;
  const name = document.getElementById('ep-name')?.value.trim();
  const bio = document.getElementById('ep-bio')?.value.trim();
  const avatar = document.getElementById('ep-avatar')?.value.trim();
  const followers = parseInt(document.getElementById('ep-followers')?.value, 10);
  const following = parseInt(document.getElementById('ep-following')?.value, 10);

  try {
    if (kind === 'user') {
      const entry = Object.entries(state.profiles || {}).find(([, u]) => normalizeHandle(u.handle) === handle);
      if (!entry) throw new Error('user');
      const uid = entry[0];
      if (uid !== state.user?.uid && !isUserAdmin()) {
        showToast('Sem permissao.', 'err');
        return;
      }
      const data = { name, bio, avatar, updatedAt: Date.now() };
      if (!isNaN(followers)) data.followersCount = Math.max(0, followers);
      await db.ref('users/' + uid).update(data);
      // base fictícia + follows reais (não zera o RP)
      if (!isNaN(following) && typeof setFollowingBase === 'function') {
        await setFollowingBase(uid, following);
      } else if (!isNaN(following)) {
        await db.ref('users/' + uid).update({
          followingBase: Math.max(0, following),
          followingCount: Math.max(0, following)
        });
      }
      if (handle) await db.ref('handles/' + handle).update({ name });
    } else {
      if (!isUserAdmin()) {
        showToast('So admin edita NPC.', 'err');
        return;
      }
      await db.ref('npcProfiles/' + handle).update({
        name, bio, avatar,
        followersCount: isNaN(followers) ? 0 : Math.max(0, followers),
        followingCount: isNaN(following) ? 0 : Math.max(0, following),
        updatedAt: Date.now()
      });
    }
    showToast('Perfil salvo.');
    closeEditProfile();
    renderProfile();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar.', 'err');
  }
}


function renderHighlightsStrip(handle, isMe) {
  const h = normalizeHandle(handle);
  const items = Object.entries(state.highlights?.[h] || {})
    .map(([id, x]) => ({ id, ...x }));
  const canEdit = isMe || isUserAdmin();
  if (!items.length && !canEdit) return '';
  return `
    <div class="ig-highlights">
      ${canEdit ? `
        <button type="button" class="hl-item" onclick="promptAddHighlight('${escapeHTML(h)}')">
          <div class="hl-ring"><span>+</span></div>
          <span>Novo</span>
        </button>` : ''}
      ${items.map(it => `
        <button type="button" class="hl-item" onclick="openHighlight('${escapeHTML(h)}','${it.id}')">
          <div class="hl-ring"><img src="${escapeHTML(it.image)}" alt="" onerror="this.remove()"/></div>
          <span>${escapeHTML(it.title || 'Destaque')}</span>
        </button>
      `).join('')}
    </div>`;
}

async function promptAddHighlight(handle) {
  const data = await rgForm({
    title: 'Novo destaque',
    confirmLabel: 'Adicionar',
    fields: [
      { name: 'title', label: 'Título', value: 'Destaque', required: true, placeholder: 'Tour' },
      { name: 'image', label: 'URL da imagem', type: 'url', required: true, placeholder: 'https://…' }
    ]
  });
  if (!data) return;
  await addHighlight(handle, { title: data.title, image: data.image });
  renderProfile();
}

function openHighlight(handle, hid) {
  const it = state.highlights?.[normalizeHandle(handle)]?.[hid];
  if (!it) return;
  const modal = document.getElementById('story-modal');
  const body = document.getElementById('story-modal-body');
  if (!modal || !body) return;
  body.innerHTML = `
    <div class="story-full" onclick="closeStory()">
      <div class="story-full-top">
        <strong>${escapeHTML(it.title || 'Destaque')}</strong>
        ${isUserAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteHighlight('${escapeHTML(handle)}','${hid}');closeStory();renderProfile()">Apagar</button>` : ''}
      </div>
      <img src="${escapeHTML(it.image)}" alt=""/>
    </div>`;
  modal.classList.add('open');
}


async function adminBoostProfile(handle) {
  if (!isUserAdmin()) return;
  const data = await rgForm({
    title: 'Boost · @' + handle,
    confirmLabel: 'Aplicar',
    fields: [
      { name: 'followers', label: 'Seguidores', type: 'number', value: String(getProfileBundle(handle).followers || 0) },
      { name: 'following', label: 'Seguindo', type: 'number', value: String(getProfileBundle(handle).following || 0) },
      { name: 'add', label: 'Ou somar seguidores (+)', type: 'number', value: '50', placeholder: '50' }
    ]
  });
  if (!data) return;
  let followers = parseInt(data.followers, 10);
  const add = parseInt(data.add, 10);
  if (!isNaN(add) && add !== 0) followers = (isNaN(followers) ? 0 : followers) + add;
  const following = parseInt(data.following, 10);
  const h = normalizeHandle(handle);
  const bundle = getProfileBundle(h);
  try {
    if (bundle.kind === 'user' && bundle.uid) {
      const payload = { followersCount: Math.max(0, followers || 0) };
      await db.ref('users/' + bundle.uid).update(payload);
      if (!isNaN(following) && typeof setFollowingBase === 'function') {
        await setFollowingBase(bundle.uid, following);
      } else if (!isNaN(following)) {
        await db.ref('users/' + bundle.uid).update({
          followingBase: Math.max(0, following),
          followingCount: Math.max(0, following)
        });
      }
    } else {
      await db.ref('npcProfiles/' + h).update({
        followersCount: Math.max(0, followers || 0),
        followingCount: Math.max(0, isNaN(following) ? 0 : following)
      });
    }
    showToast('Perfil atualizado.');
    renderProfile();
  } catch (e) {
    showToast('Erro no boost.', 'err');
  }
}


async function adminSuspendAccount(handle, kind, ban) {
  if (!isUserAdmin()) return;
  const ok = await rgConfirm({
    title: ban ? 'Banir conta' : 'Suspender conta',
    body: ban
      ? 'Ban permanente visual em @' + handle + '. Pode reativar depois.'
      : 'Suspende @' + handle + ' com aviso no perfil.',
    confirmLabel: ban ? 'Banir' : 'Suspender',
    danger: true
  });
  if (!ok) return;
  const h = normalizeHandle(handle);
  const payload = ban
    ? { banned: true, suspended: true, statusAt: Date.now() }
    : { suspended: true, banned: false, statusAt: Date.now() };
  try {
    if (kind === 'user') {
      const entry = Object.entries(state.profiles || {}).find(([, u]) => normalizeHandle(u.handle) === h);
      if (entry) await db.ref('users/' + entry[0]).update(payload);
    } else {
      await db.ref('npcProfiles/' + h).update(payload);
    }
    showToast(ban ? 'Conta banida.' : 'Conta suspensa.');
    renderProfile();
  } catch (e) {
    showToast('Erro.', 'err');
  }
}

async function adminUnsuspend(handle, kind) {
  if (!isUserAdmin()) return;
  const h = normalizeHandle(handle);
  const payload = { banned: false, suspended: false, statusAt: Date.now() };
  try {
    if (kind === 'user') {
      const entry = Object.entries(state.profiles || {}).find(([, u]) => normalizeHandle(u.handle) === h);
      if (entry) await db.ref('users/' + entry[0]).update(payload);
    } else {
      await db.ref('npcProfiles/' + h).update(payload);
    }
    showToast('Conta reativada.');
    renderProfile();
  } catch (e) {
    showToast('Erro.', 'err');
  }
}

async function adminDeleteNpc(handle) {
  if (!isUserAdmin()) return;
  const h = normalizeHandle(handle);
  const ok = await rgConfirm({
    title: 'Apagar NPC',
    body: 'Remove @' + h + ' do Firebase (perfil). Posts antigos permanecem no fio.',
    confirmLabel: 'Apagar',
    danger: true
  });
  if (!ok) return;
  try {
    await db.ref('npcProfiles/' + h).remove();
    await db.ref('highlights/' + h).remove();
    showToast('NPC removido.');
    state.viewProfileHandle = state.profile?.handle || null;
    showView('feed');
  } catch (e) {
    showToast('Erro ao apagar NPC.', 'err');
  }
}
