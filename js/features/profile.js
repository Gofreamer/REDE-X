/* Rede Global — Profile (Instagram-like) */

function renderProfile() {
  const el = document.getElementById('profile-root');
  if (!el) return;

  const handle = state.viewProfileHandle || state.profile?.handle;
  if (!handle) {
    el.innerHTML = `<div class="empty"><h3>Sem perfil</h3></div>`;
    return;
  }

  const bundle = getProfileBundle(handle);
  const posts = postsForHandle(handle);
  const isMe = bundle.isMe;

  el.innerHTML = `
    <div class="ig-profile">
      <div class="ig-profile-top mobile-only">
        <strong>${escapeHTML(bundle.handle)}</strong>
        ${isMe ? `<button type="button" class="icon-btn" onclick="openEditProfile()">⚙</button>` : ''}
      </div>

      <div class="ig-profile-header">
        ${avatarHTML(bundle, 'xl')}
        <div class="ig-profile-meta">
          <div class="ig-profile-userline desktop-only">
            <h2 class="ig-username">${escapeHTML(bundle.handle)}</h2>
            ${isMe
              ? `<button type="button" class="btn btn-edit" onclick="openEditProfile()">Editar perfil</button>`
              : `<button type="button" class="btn btn-edit" onclick="startDmWithHandle('${escapeHTML(bundle.handle)}')">Mensagem</button>
                 ${isUserAdmin() ? `<button type="button" class="btn btn-edit" onclick="openEditNpc('${escapeHTML(bundle.handle)}')">Editar NPC</button>` : ''}`}
          </div>
          <div class="ig-stats">
            <div class="ig-stat"><strong>${posts.length}</strong><span>publicacoes</span></div>
            <div class="ig-stat"><strong>${formatCount(bundle.followers)}</strong><span>seguidores</span></div>
            <div class="ig-stat"><strong>${formatCount(bundle.following)}</strong><span>seguindo</span></div>
          </div>
          <div class="ig-profile-bio-block desktop-only">
            <div class="ig-display-name">${escapeHTML(bundle.name)}</div>
            ${bundle.bio ? `<div class="ig-bio">${linkify(bundle.bio)}</div>` : ''}
            ${bundle.kind === 'npc' ? `<div class="ig-badge-npc">Conta da mesa · NPC</div>` : ''}
          </div>
        </div>
      </div>

      <div class="ig-profile-bio-block mobile-only">
        <div class="ig-display-name">${escapeHTML(bundle.name)}</div>
        ${bundle.bio ? `<div class="ig-bio">${linkify(bundle.bio)}</div>` : ''}
        ${bundle.kind === 'npc' ? `<div class="ig-badge-npc">Conta da mesa · NPC</div>` : ''}
        ${isMe
          ? `<button type="button" class="btn btn-edit btn-block" style="margin-top:12px" onclick="openEditProfile()">Editar perfil</button>`
          : (isUserAdmin()
              ? `<button type="button" class="btn btn-edit btn-block" style="margin-top:12px" onclick="openEditProfile()">Editar NPC</button>`
              : '')}
      </div>

      ${renderHighlightsStrip(bundle.handle, isMe)}

      <div class="ig-profile-tabs">
        <button type="button" class="ig-tab active">Publicacoes</button>
      </div>

      <div class="profile-grid">
        ${posts.length
          ? posts.map(post => `
              <button type="button" class="grid-cell" onclick="openPostModal('${post.id}')">
                <img src="${escapeHTML(post.image)}" alt="" loading="lazy"/>
              </button>`).join('')
          : `<div class="grid-empty">Ainda nao ha publicacoes.</div>`}
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
              <label class="field"><span>Seguindo</span>
                <input id="ep-following" type="number" min="0" value="${bundle.following}"/>
              </label>
            </div>
            <p class="hint">Numeros de RP — admin ou dono da conta.</p>
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
      if (!isNaN(following)) data.followingCount = Math.max(0, following);
      await db.ref('users/' + uid).update(data);
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
  const title = prompt('Titulo do destaque (ex: Tour):', 'Destaque');
  if (title === null) return;
  const image = prompt('URL da imagem:');
  if (!image) return;
  await addHighlight(handle, { title, image });
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
