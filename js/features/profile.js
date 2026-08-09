/* Rede X — Profile */

function renderProfile() {
  const el = document.getElementById('profile-root');
  if (!el || !state.profile) return;

  const p = state.profile;
  const myPosts = state.posts.filter(x => x.uid === state.user?.uid && !x.replyTo);

  el.innerHTML = `
    <div class="profile-card">
      <div class="profile-head">
        <div class="profile-avatar-lg">${avatarLetter(p)}</div>
        <div>
          <h2>${escapeHTML(p.name || '—')}</h2>
          <div class="post-handle">${displayHandle(p.handle)}</div>
          ${p.bio ? `<p class="profile-bio">${escapeHTML(p.bio)}</p>` : ''}
        </div>
      </div>

      <form class="profile-form" onsubmit="submitProfile(event)">
        <div class="form-group">
          <label>Nome de exibição</label>
          <input type="text" id="pf-name" class="input" maxlength="40" value="${escapeHTML(p.name || '')}" required/>
        </div>
        <div class="form-group">
          <label>Bio</label>
          <textarea id="pf-bio" class="input" maxlength="160" rows="3">${escapeHTML(p.bio || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Avatar (URL)</label>
          <input type="url" id="pf-avatar" class="input" value="${escapeHTML(p.avatar || '')}" placeholder="https://…"/>
        </div>
        <div class="form-group">
          <label>Handle</label>
          <input type="text" class="input" value="${displayHandle(p.handle)}" disabled/>
          <p class="hint">O @ não muda depois do cadastro.</p>
        </div>
        <div class="form-group">
          <label>UID</label>
          <code class="uid-code">${escapeHTML(state.user?.uid || '')}</code>
          <p class="hint">Copie para marcar isAdmin no Firebase.</p>
        </div>
        <button type="submit" class="btn btn-primary">Salvar perfil</button>
      </form>
    </div>

    <h3 class="section-title">Seus posts</h3>
    <div class="timeline-mini">
      ${myPosts.length
        ? myPosts.map(renderPostCard).join('')
        : '<p class="text-muted">Você ainda não publicou.</p>'}
    </div>
  `;
}

async function submitProfile(e) {
  e.preventDefault();
  await saveProfile({
    name: document.getElementById('pf-name').value.trim(),
    bio: document.getElementById('pf-bio').value.trim(),
    avatar: document.getElementById('pf-avatar').value.trim()
  });
}
