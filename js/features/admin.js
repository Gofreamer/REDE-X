/* Rede X — Admin */

function renderAdmin() {
  const el = document.getElementById('admin-root');
  if (!el) return;

  if (!isUserAdmin()) {
    el.innerHTML = `<div class="empty-state"><h3>Acesso negado</h3><p>Só o núcleo opera este painel.</p></div>`;
    return;
  }

  const users = Object.entries(state.profiles || {})
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => (a.handle || '').localeCompare(b.handle || ''));

  el.innerHTML = `
    <div class="admin-grid">
      <div class="panel">
        <h3>Postar como NPC / mídia</h3>
        <p class="hint">Aparece na timeline com o @ que você definir. Não precisa de conta real.</p>
        <div class="form-group">
          <label>Handle</label>
          <input type="text" id="admin-npc-handle" class="input" placeholder="nina_riders"/>
        </div>
        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="admin-npc-name" class="input" placeholder="Nina Riders"/>
        </div>
        <div class="form-group">
          <label>Texto</label>
          <textarea id="admin-npc-text" class="input" maxlength="280" rows="3" placeholder="Breaking: …"></textarea>
        </div>
        <div class="form-group">
          <label>Imagem (URL)</label>
          <input type="url" id="admin-npc-image" class="input" placeholder="https://…"/>
        </div>
        <button type="button" class="btn btn-primary" onclick="adminNpcPost()">Publicar no fio</button>
      </div>

      <div class="panel">
        <h3>Contas</h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Handle</th><th>Nome</th><th>Admin</th><th>UID</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>${displayHandle(u.handle)}</td>
                  <td>${escapeHTML(u.name || '—')}</td>
                  <td>${u.isAdmin ? '✓' : '—'}</td>
                  <td><code class="uid-code">${escapeHTML(u.id)}</code></td>
                </tr>
              `).join('') || '<tr><td colspan="4">Nenhuma conta</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel panel-wide">
        <h3>Últimos posts</h3>
        <div class="admin-posts">
          ${state.posts.slice(0, 20).map(p => `
            <div class="admin-post-row">
              <div>
                <strong>${displayHandle(p.handle)}</strong>
                <span class="text-muted">${timeAgo(p.createdAt)}</span>
                <p>${escapeHTML((p.text || '').slice(0, 120))}</p>
              </div>
              <button class="btn btn-ghost btn-sm text-danger" onclick="deletePost('${p.id}')">Apagar</button>
            </div>
          `).join('') || '<p class="text-muted">Vazio.</p>'}
        </div>
      </div>
    </div>
  `;
}

async function adminNpcPost() {
  const handle = document.getElementById('admin-npc-handle')?.value || '';
  const name = document.getElementById('admin-npc-name')?.value || '';
  const text = document.getElementById('admin-npc-text')?.value || '';
  const image = document.getElementById('admin-npc-image')?.value || '';
  if (!normalizeHandle(handle)) {
    showToast('Handle obrigatório.', 'error');
    return;
  }
  const ok = await createPost({
    text,
    image,
    asHandle: handle,
    asName: name || handle
  });
  if (ok) {
    showToast('NPC no ar.');
    document.getElementById('admin-npc-text').value = '';
    document.getElementById('admin-npc-image').value = '';
  }
}
