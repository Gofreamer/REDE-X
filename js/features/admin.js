/* Rede Global — Admin */

function renderAdmin() {
  const el = document.getElementById('admin-root');
  if (!el) return;
  if (!isUserAdmin()) {
    el.innerHTML = `<div class="empty"><h3>Acesso restrito</h3><p>So o nucleo da mesa.</p></div>`;
    return;
  }

  const users = Object.entries(state.profiles || {})
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => (a.handle || '').localeCompare(b.handle || ''));

  const npcs = Object.entries(state.npcProfiles || {})
    .map(([h, u]) => ({ handle: h, ...u }))
    .sort((a, b) => a.handle.localeCompare(b.handle));

  el.innerHTML = `
    <div class="admin-stack">
      <section class="panel">
        <h3>IA — gerar legenda</h3>
        <p class="hint">Firebase AI · gemini-3.6-flash (mesmo padrao GS). Voce so cola a URL da imagem depois.</p>
        <div class="form-row">
          <div class="form-group">
            <label>Handle NPC</label>
            <input class="input" id="ai-handle" placeholder="nina_riders"/>
          </div>
          <div class="form-group">
            <label>Nome</label>
            <input class="input" id="ai-name" placeholder="Nina Riders"/>
          </div>
        </div>
        <div class="form-group">
          <label>Ideia do post</label>
          <textarea class="input" id="ai-idea" rows="2" placeholder="Show no porto, boato de bloqueio, flex de compra GS…"></textarea>
        </div>
        <button type="button" class="btn btn-primary" id="btn-ai-gen" onclick="generatePostWithAI()">Gerar legenda</button>
        <p class="hint" id="ai-status"></p>
      </section>

      <section class="panel">
        <h3>Publicar como NPC / midia</h3>
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
            <input class="input" id="adm-image" type="url" placeholder="https://" required/>
          </div>
          <div class="form-group">
            <label>Legenda</label>
            <textarea class="input" id="adm-caption" rows="3" maxlength="500"></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Publicar no fio</button>
        </form>
      </section>

      <section class="panel">
        <h3>Perfil NPC (bio + seguidores)</h3>
        <p class="hint">Cria/atualiza ficha visivel na busca e no perfil.</p>
        <form onsubmit="adminSaveNpcProfile(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Handle</label>
              <input class="input" id="npc-handle" required placeholder="porto_wire"/>
            </div>
            <div class="form-group">
              <label>Nome</label>
              <input class="input" id="npc-name" placeholder="Porto Wire"/>
            </div>
          </div>
          <div class="form-group">
            <label>Bio</label>
            <input class="input" id="npc-bio" maxlength="160" placeholder="Noticias do porto."/>
          </div>
          <div class="form-group">
            <label>Avatar URL</label>
            <input class="input" id="npc-avatar" type="url"/>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Seguidores</label>
              <input class="input" id="npc-followers" type="number" min="0" value="1200"/>
            </div>
            <div class="form-group">
              <label>Seguindo</label>
              <input class="input" id="npc-following" type="number" min="0" value="80"/>
            </div>
          </div>
          <button type="submit" class="btn btn-primary">Salvar NPC</button>
        </form>
        <div class="mod-list" style="margin-top:12px">
          ${npcs.map(n => `
            <div class="mod-row">
              <div>
                <strong>@${escapeHTML(n.handle)}</strong>
                <p>${escapeHTML(n.name || '')} · ${Number(n.followersCount)||0} seg.</p>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="openProfile('${escapeHTML(n.handle)}')">Ver</button>
            </div>
          `).join('') || '<p class="text-muted">Nenhum NPC cadastrado ainda.</p>'}
        </div>
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
            <input class="input" id="adm-story-image" type="url" required/>
          </div>
          <button type="submit" class="btn btn-primary">Subir story</button>
        </form>
      </section>

      <section class="panel">
        <h3>Contas reais (${users.length})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>@</th><th>Nome</th><th>Seg.</th><th>Admin</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><button class="rail-link" onclick="openProfile('${escapeHTML(u.handle||'')}')">${displayHandle(u.handle)}</button></td>
                  <td>${escapeHTML(u.name || '—')}</td>
                  <td>${Number(u.followersCount)||0}</td>
                  <td>${u.isAdmin ? '✓' : '—'}</td>
                </tr>`).join('') || '<tr><td colspan="4">Vazio</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h3>Moderacao</h3>
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

async function adminSaveNpcProfile(e) {
  e.preventDefault();
  const handle = normalizeHandle(document.getElementById('npc-handle')?.value);
  if (!handle) {
    showToast('Handle invalido.', 'err');
    return;
  }
  try {
    await db.ref('npcProfiles/' + handle).update({
      name: document.getElementById('npc-name')?.value.trim() || handle,
      bio: document.getElementById('npc-bio')?.value.trim() || '',
      avatar: document.getElementById('npc-avatar')?.value.trim() || '',
      followersCount: Math.max(0, parseInt(document.getElementById('npc-followers')?.value, 10) || 0),
      followingCount: Math.max(0, parseInt(document.getElementById('npc-following')?.value, 10) || 0),
      updatedAt: Date.now()
    });
    showToast('NPC salvo.');
    e.target.reset();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar NPC.', 'err');
  }
}
