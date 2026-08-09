/* Rede Global — Admin com abas */

let adminTab = 'mesa';

function renderAdmin() {
  const el = document.getElementById('admin-root');
  if (!el) return;
  if (!isUserAdmin()) {
    el.innerHTML = `<div class="empty"><h3>Acesso restrito</h3><p>Só o núcleo da mesa.</p></div>`;
    return;
  }

  const tabs = [
    { id: 'mesa', label: 'Mesa' },
    { id: 'publicar', label: 'Publicar' },
    { id: 'npcs', label: 'NPCs' },
    { id: 'ia', label: 'IA' },
    { id: 'mod', label: 'Moderação' }
  ];

  el.innerHTML = `
    <div class="admin-wrap">
      <div class="admin-tabs">
        ${tabs.map(t => `
          <button type="button" class="admin-tab ${adminTab === t.id ? 'active' : ''}"
            onclick="adminTab='${t.id}';renderAdmin()">${t.label}</button>
        `).join('')}
      </div>
      <div class="admin-panel-body">
        ${adminTab === 'mesa' ? renderAdminMesa() : ''}
        ${adminTab === 'publicar' ? renderAdminPublicar() : ''}
        ${adminTab === 'npcs' ? renderAdminNpcs() : ''}
        ${adminTab === 'ia' ? renderAdminIA() : ''}
        ${adminTab === 'mod' ? renderAdminMod() : ''}
      </div>
    </div>`;
}

function renderAdminMesa() {
  const session = state.siteSettings?.session || {};
  const scheduled = state.posts.filter(p => p.publishAt && p.publishAt > Date.now());
  return `
    <section class="panel">
      <h3>Ações rápidas</h3>
      <div class="admin-actions">
        <button type="button" class="btn btn-primary" onclick="seedCityFeed()">Popular fio (seed)</button>
        <button type="button" class="btn btn-ghost" onclick="openSessionModal()">Modo sessão</button>
      </div>
      <p class="hint">Seed: 6 posts + perfis NPC. Sessão: destaque no topo do fio.</p>
      ${session.label || session.postId ? `
        <div class="session-banner" style="margin:12px 0 0">
          <strong>Ativo</strong>
          <span>${escapeHTML(session.label || 'Sessão')} ${session.postId ? '· post ' + escapeHTML(session.postId.slice(0,8)) + '…' : ''}</span>
        </div>` : ''}
    </section>
    <section class="panel">
      <h3>Fila agendada (${scheduled.length})</h3>
      <div class="mod-list">
        ${scheduled.map(p => `
          <div class="mod-row">
            <div>
              <strong>${displayHandle(p.handle)}</strong>
              <p>${new Date(p.publishAt).toLocaleString('pt-BR')} · ${escapeHTML((p.caption||'').slice(0,48))}</p>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="publishNow('${p.id}')">Agora</button>
          </div>
        `).join('') || '<p class="text-muted">Nada agendado.</p>'}
      </div>
    </section>
    <section class="panel">
      <h3>Story 24h</h3>
      <form onsubmit="adminSubmitStory(event)">
        <div class="form-row">
          <div class="form-group">
            <label>NPC</label>
            ${npcSelectHTML('adm-story-handle')}
          </div>
          <div class="form-group">
            <label>Nome (opcional)</label>
            <input class="input" id="adm-story-name" placeholder="auto do perfil"/>
          </div>
        </div>
        <div class="form-group">
          <label>Imagem URL</label>
          <input class="input" id="adm-story-image" type="url" required/>
        </div>
        <button type="submit" class="btn btn-primary">Subir story</button>
      </form>
    </section>`;
}

function npcSelectHTML(id, includeEmpty = true) {
  const npcs = Object.entries(state.npcProfiles || {})
    .map(([h, u]) => ({ handle: h, ...u }))
    .sort((a, b) => a.handle.localeCompare(b.handle));
  return `<select class="input" id="${id}">
    ${includeEmpty ? '<option value="">— escolher NPC —</option>' : ''}
    ${npcs.map(n => `<option value="${escapeHTML(n.handle)}">${escapeHTML(n.handle)} · ${escapeHTML(n.name || '')}</option>`).join('') || '<option value="">Nenhum NPC — crie na aba NPCs</option>'}
  </select>`;
}

function renderAdminPublicar() {
  const npcs = Object.keys(state.npcProfiles || {});
  return `
    <section class="panel">
      <h3>Publicar como NPC</h3>
      <p class="hint">Escolha um perfil já criado — nome e avatar vêm automaticamente.</p>
      ${!npcs.length ? '<p class="text-muted">Crie NPCs na aba <strong>NPCs</strong> primeiro.</p>' : ''}
      <form onsubmit="adminNpcPost(event)">
        <div class="form-group">
          <label>Conta</label>
          ${npcSelectHTML('adm-handle', true)}
        </div>
        <div class="form-group">
          <label>Imagem (URL)</label>
          <input class="input" id="adm-image" type="url" required placeholder="https://…"/>
        </div>
        <div class="form-group">
          <label>Legenda</label>
          <textarea class="input" id="adm-caption" rows="3" maxlength="500"></textarea>
        </div>
        <div class="form-group">
          <label>Agendar (opcional)</label>
          <input class="input" id="adm-schedule" type="datetime-local"/>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Publicar</button>
      </form>
    </section>
    <section class="panel">
      <h3>Atalhos por NPC</h3>
      <div class="npc-quick-grid">
        ${Object.entries(state.npcProfiles || {}).map(([h, u]) => `
          <button type="button" class="npc-quick" onclick="quickFillNpc('${escapeHTML(h)}')">
            ${avatarHTML({ handle: h, name: u.name, avatar: u.avatar }, 'sm')}
            <span>@${escapeHTML(h)}</span>
          </button>
        `).join('') || '<p class="text-muted">Nenhum NPC.</p>'}
      </div>
    </section>`;
}

function quickFillNpc(handle) {
  adminTab = 'publicar';
  renderAdmin();
  setTimeout(() => {
    const sel = document.getElementById('adm-handle');
    if (sel) sel.value = handle;
    document.getElementById('adm-caption')?.focus();
  }, 30);
}

function renderAdminNpcs() {
  const npcs = Object.entries(state.npcProfiles || {})
    .map(([h, u]) => ({ handle: h, ...u }))
    .sort((a, b) => a.handle.localeCompare(b.handle));
  const users = Object.entries(state.profiles || {})
    .map(([id, u]) => ({ id, ...u }));

  return `
    <section class="panel">
      <h3>Criar / editar NPC</h3>
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
          <input class="input" id="npc-bio" maxlength="160"/>
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
    </section>
    <section class="panel">
      <h3>NPCs (${npcs.length})</h3>
      <div class="mod-list">
        ${npcs.map(n => `
          <div class="mod-row">
            ${avatarHTML(n, 'sm')}
            <div>
              <strong>@${escapeHTML(n.handle)}</strong>
              <p>${escapeHTML(n.name || '')} · ${Number(n.followersCount)||0} seg.</p>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="openProfile('${escapeHTML(n.handle)}')">Ver</button>
            <button class="btn btn-ghost btn-sm" onclick="quickFillNpc('${escapeHTML(n.handle)}')">Postar</button>
            <button class="btn btn-ghost btn-sm" onclick="startDmWithHandle('${escapeHTML(n.handle)}')">DM</button>
          </div>
        `).join('') || '<p class="text-muted">Nenhum NPC.</p>'}
      </div>
    </section>
    <section class="panel">
      <h3>Contas reais</h3>
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
    </section>`;
}

function renderAdminIA() {
  return `
    <section class="panel">
      <h3>Gerar legenda</h3>
      <p class="hint">Firebase AI · gemini-3.6-flash</p>
      <div class="form-group">
        <label>NPC</label>
        ${npcSelectHTML('ai-handle')}
      </div>
      <div class="form-group">
        <label>Nome (opcional)</label>
        <input class="input" id="ai-name" placeholder="auto"/>
      </div>
      <div class="form-group">
        <label>Ideia</label>
        <textarea class="input" id="ai-idea" rows="2" placeholder="Show no porto…"></textarea>
      </div>
      <button type="button" class="btn btn-primary" id="btn-ai-gen" onclick="generatePostWithAI()">Gerar legenda</button>
      <p class="hint" id="ai-status"></p>
    </section>
    <section class="panel">
      <h3>Lote (3 legendas)</h3>
      <div class="form-group">
        <label>Arco da sessão</label>
        <textarea class="input" id="ai-batch-idea" rows="2"></textarea>
      </div>
      <button type="button" class="btn btn-primary" onclick="generateBatchCaptions()">Gerar lote</button>
      <div id="ai-batch-out" class="hint" style="margin-top:10px;white-space:pre-wrap"></div>
    </section>`;
}

function renderAdminMod() {
  return `
    <section class="panel">
      <h3>Posts recentes</h3>
      <div class="mod-list">
        ${state.posts.slice(0, 20).map(p => `
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
    </section>`;
}

async function adminNpcPost(e) {
  e.preventDefault();
  const handle = document.getElementById('adm-handle')?.value;
  if (!handle) {
    showToast('Escolha um NPC.', 'err');
    return;
  }
  const npc = state.npcProfiles?.[normalizeHandle(handle)] || {};
  const sched = document.getElementById('adm-schedule')?.value;
  let publishAt = null;
  if (sched) publishAt = new Date(sched).getTime();
  const ok = await createPost({
    image: document.getElementById('adm-image').value,
    caption: document.getElementById('adm-caption').value,
    asHandle: handle,
    asName: npc.name || handle,
    publishAt
  });
  if (ok) {
    showToast(publishAt && publishAt > Date.now() ? 'Post agendado.' : 'No ar.');
    e.target.reset();
  }
}

async function adminSubmitStory(e) {
  e.preventDefault();
  const handle = document.getElementById('adm-story-handle')?.value;
  if (!handle) {
    showToast('Escolha um NPC.', 'err');
    return;
  }
  const npc = state.npcProfiles?.[normalizeHandle(handle)] || {};
  const ok = await createStory({
    image: document.getElementById('adm-story-image')?.value,
    asHandle: handle,
    asName: document.getElementById('adm-story-name')?.value || npc.name || handle
  });
  if (ok) e.target.reset();
}

async function adminSaveNpcProfile(e) {
  e.preventDefault();
  const handle = normalizeHandle(document.getElementById('npc-handle')?.value);
  if (!handle) {
    showToast('Handle inválido.', 'err');
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

async function publishNow(postId) {
  try {
    await db.ref('posts/' + postId).update({ publishAt: null, scheduled: false, createdAt: Date.now() });
    showToast('No ar agora.');
  } catch (e) {
    showToast('Erro.', 'err');
  }
}

async function openSessionModal() {
  const posts = state.posts.filter(p => !p.publishAt || p.publishAt <= Date.now()).slice(0, 30);
  const data = await rgForm({
    title: 'Modo sessão',
    confirmLabel: 'Ativar',
    fields: [
      {
        name: 'postId',
        label: 'Post em destaque',
        type: 'select',
        value: state.siteSettings?.session?.postId || '',
        options: [
          { value: '', label: '— nenhum —' },
          ...posts.map(p => ({
            value: p.id,
            label: `@${p.handle} · ${(p.caption || '').slice(0, 32) || p.id.slice(0, 8)}`
          }))
        ]
      },
      {
        name: 'label',
        label: 'Rótulo',
        value: state.siteSettings?.session?.label || 'Sessão de hoje',
        placeholder: 'Noite do porto'
      }
    ]
  });
  if (!data) return;
  await setSessionMode({ postId: data.postId || null, label: data.label });
}
