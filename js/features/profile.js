function renderProfile() {
  const el = document.getElementById('profile-root');
  if (!el || !state.profile) return;
  const p = state.profile;
  const mine = state.posts.filter(x => x.uid === state.user?.uid);

  el.innerHTML = `
    <div class="profile-hero">
      ${avatarHTML(p, 'xl')}
      <div class="profile-info">
        <h2>${escapeHTML(p.name || '—')}</h2>
        <div class="handle-line">${displayHandle(p.handle)}</div>
        <div class="profile-stats">
          <div><strong>${mine.length}</strong> publicações</div>
        </div>
        ${p.bio ? `<p class="bio">${escapeHTML(p.bio)}</p>` : ''}
      </div>
    </div>

    <form class="panel form-panel" onsubmit="submitProfileForm(event)">
      <h3>Editar perfil</h3>
      <div class="form-group">
        <label>Nome</label>
        <input class="input" id="pf-name" maxlength="40" value="${escapeHTML(p.name || '')}" required/>
      </div>
      <div class="form-group">
        <label>Bio</label>
        <textarea class="input" id="pf-bio" maxlength="160" rows="3">${escapeHTML(p.bio || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Avatar (URL)</label>
        <input class="input" id="pf-avatar" type="url" value="${escapeHTML(p.avatar || '')}" placeholder="https://…"/>
      </div>
      <div class="form-group">
        <label>UID (admin)</label>
        <code class="uid">${escapeHTML(state.user?.uid || '')}</code>
      </div>
      <button type="submit" class="btn btn-primary">Salvar</button>
    </form>

    <h3 class="grid-title">Publicações</h3>
    <div class="profile-grid">
      ${mine.length
        ? mine.map(post => `
            <button type="button" class="grid-cell" onclick="openPostModal('${post.id}')">
              <img src="${escapeHTML(post.image)}" alt="" loading="lazy"/>
            </button>`).join('')
        : '<p class="text-muted">Nenhuma publicação ainda.</p>'}
    </div>`;
}

async function submitProfileForm(e) {
  e.preventDefault();
  await saveProfile({
    name: document.getElementById('pf-name').value.trim(),
    bio: document.getElementById('pf-bio').value.trim(),
    avatar: document.getElementById('pf-avatar').value.trim()
  });
}
