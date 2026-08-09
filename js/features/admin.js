function renderAdmin() {
  const el = document.getElementById('admin-root');
  if (!el) return;
  if (!isUserAdmin()) {
    el.innerHTML = `<div class="empty"><h3>Acesso restrito</h3><p>Só o núcleo da mesa.</p></div>`;
    return;
  }

  const users = Object.entries(state.profiles || {})
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => (a.handle || '').localeCompare(b.handle || ''));

  el.innerHTML = `
    <div class="admin-stack">
      <section class="panel">
        <h3>Publicar como NPC / mídia</h3>
        <p class="hint">Conta fictícia no fio — sem login real.</p>
        <form onsubmit="adminNpcPost(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Handle</label>
              <input class="input" id="adm-handle" placeholder="nina_riders" required/>
            </div>
            <div class="form-group">
              <label>Nome</label>
              <input class="input" id="adm-name" placeholder="Nina Riders"/>
            </div>
          </div>
          <div class="form-group">
            <label>Imagem (URL)</label>
            <input class="input" id="adm-image" type="url" placeholder="https://…" required/>
          </div>
          <div class="form-group">
            <label>Legenda</label>
            <textarea class="input" id="adm-caption" rows="3" maxlength="500" placeholder="#NinaLive no porto…"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Publicar no fio</button>
        </form>
      </section>

      <section class="panel">
        <h3>Story (24h)</h3>
        <form onsubmit="adminSubmitStory(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Handle</label>
              <input class="input" id="adm-story-handle" placeholder="porto_wire"/>
            </div>
            <div class="form-group">
              <label>Nome</label>
              <input class="input" id="adm-story-name" placeholder="Porto Wire"/>
            </div>
          </div>
          <div class="form-group">
            <label>Imagem</label>
            <input class="input" id="adm-story-image" type="url" required placeholder="https://…"/>
          </div>
          <button type="submit" class="btn btn-primary">Subir story</button>
        </form>
      </section>

      <section class="panel">
        <h3>Contas (${users.length})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>@</th><th>Nome</th><th>Admin</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${displayHandle(u.handle)}</td>
                  <td>${escapeHTML(u.name || '—')}</td>
                  <td>${u.isAdmin ? '✓' : '—'}</td>
                </tr>`).join('') || '<tr><td colspan="3">Vazio</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h3>Moderação rápida</h3>
        <div class="mod-list">
          ${state.posts.slice(0, 15).map(p => `
            <div class="mod-row">
              <img src="${escapeHTML(p.image)}" alt="" onerror="this.style.display='none'"/>
              <div>
                <strong>${displayHandle(p.handle)}</strong>
                <p>${escapeHTML((p.caption || '').slice(0, 60))}</p>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="togglePin('${p.id}')">${p.pinned ? 'Desafixar' : 'Fixar'}</button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="deletePost('${p.id}')">Apagar</button>
            </div>
          `).join('') || '<p class="text-muted">Sem posts.</p>'}
        </div>
      </section>
    </div>`;
}

async function adminNpcPost(e) {
  e.preventDefault();
  const ok = await createPost({
    image: document.getElementById('adm-image').value,
    caption: document.getElementById('adm-caption').value,
    asHandle: document.getElementById('adm-handle').value,
    asName: document.getElementById('adm-name').value
  });
  if (ok) {
    showToast('NPC publicado.');
    e.target.reset();
  }
}


async function adminSubmitStory(e) {
  e.preventDefault();
  const ok = await createStory({
    image: document.getElementById('adm-story-image')?.value,
    asHandle: document.getElementById('adm-story-handle')?.value,
    asName: document.getElementById('adm-story-name')?.value
  });
  if (ok) e.target.reset();
}
