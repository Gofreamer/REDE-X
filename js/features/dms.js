function renderDMs() {
  const el = document.getElementById('dms-root');
  if (!el) return;

  const threads = state.dmThreads || [];
  const active = state.activeDmId
    ? threads.find(t => t.id === state.activeDmId)
    : null;

  el.innerHTML = `
    <div class="dm-layout">
      <div class="dm-list ${active ? 'has-active' : ''}">
        <div class="dm-list-head">
          <strong>Mensagens</strong>
          ${isUserAdmin() ? `<button type="button" class="btn btn-ghost btn-sm" onclick="adminStartDmPrompt()">Nova</button>` : ''}
        </div>
        ${threads.length ? threads.map(t => {
          const other = otherMember(t);
          const last = lastMessage(t);
          return `
            <button type="button" class="dm-thread-row ${t.id === state.activeDmId ? 'active' : ''}"
              onclick="selectDm('${t.id}')">
              ${avatarHTML({ name: other?.name, handle: other?.handle, avatar: '' }, 'sm')}
              <div class="rail-me-text">
                <strong>${escapeHTML(other?.handle || '—')}</strong>
                <span>${escapeHTML((last?.text || '').slice(0, 40))}</span>
              </div>
            </button>`;
        }).join('') : `<p class="text-muted" style="padding:16px">Nenhuma conversa.</p>`}
      </div>
      <div class="dm-chat">
        ${active ? renderDmChat(active) : `<div class="empty"><h3>DMs</h3><p>Escolha uma conversa ou inicie pelo perfil.</p></div>`}
      </div>
    </div>`;
}

function otherMember(thread) {
  const members = thread.members || {};
  const my = state.user?.uid;
  for (const [uid, m] of Object.entries(members)) {
    if (uid !== my) return { uid, ...m };
  }
  return Object.entries(members).map(([uid, m]) => ({ uid, ...m }))[0];
}

function lastMessage(thread) {
  const msgs = Object.entries(thread.messages || {})
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return msgs[msgs.length - 1];
}

function renderDmChat(thread) {
  const other = otherMember(thread);
  const msgs = Object.entries(thread.messages || {})
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  // mark read
  markDmRead(thread.id);

  return `
    <div class="dm-chat-head">
      <button type="button" class="icon-btn mobile-only" onclick="state.activeDmId=null;renderDMs()">←</button>
      <strong>${displayHandle(other?.handle)}</strong>
      <button type="button" class="btn btn-ghost btn-sm" onclick="openProfile('${escapeHTML(other?.handle || '')}')">Perfil</button>
    </div>
    <div class="dm-messages" id="dm-messages">
      ${msgs.map(m => `
        <div class="dm-bubble ${m.fromUid === state.user?.uid ? 'mine' : ''}">
          <div>${linkify(m.text)}</div>
          <span class="c-time">${timeAgo(m.createdAt)}</span>
        </div>
      `).join('') || '<p class="text-muted">Sem mensagens ainda.</p>'}
    </div>
    <form class="dm-compose" onsubmit="submitDm(event, '${thread.id}')">
      <input class="input" id="dm-input" maxlength="500" placeholder="Mensagem…" autocomplete="off"/>
      <button type="submit" class="btn btn-primary btn-sm">Enviar</button>
    </form>`;
}

function selectDm(id) {
  state.activeDmId = id;
  renderDMs();
  setTimeout(() => {
    const box = document.getElementById('dm-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }, 50);
}

async function submitDm(e, threadId) {
  e.preventDefault();
  const input = document.getElementById('dm-input');
  const text = input?.value || '';
  await sendDm(threadId, text);
  if (input) input.value = '';
}

async function markDmRead(threadId) {
  if (!state.user) return;
  const thread = state.dms[threadId];
  if (!thread?.messages) return;
  const updates = {};
  Object.entries(thread.messages).forEach(([id, m]) => {
    if (!m.read && m.fromUid !== state.user.uid) {
      updates[`dms/${threadId}/messages/${id}/read`] = true;
    }
  });
  if (Object.keys(updates).length) {
    try { await db.ref().update(updates); } catch {}
  }
}

async function startDmWithHandle(handle) {
  const h = normalizeHandle(handle);
  const entry = Object.entries(state.profiles || {}).find(([, u]) => normalizeHandle(u.handle) === h);
  if (!entry) {
    // NPC: use synthetic uid
    const npcUid = 'npc_' + h;
    const npc = state.npcProfiles?.[h] || {};
    await openOrCreateDm(npcUid, h, npc.name || h);
    return;
  }
  await openOrCreateDm(entry[0], h, entry[1].name || h);
}

async function adminStartDmPrompt() {
  const h = prompt('Handle para DM (@):');
  if (!h) return;
  await startDmWithHandle(h);
}
