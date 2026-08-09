/* Rede Global — DMs (player ↔ NPC da mesa) */

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
          <button type="button" class="btn btn-ghost btn-sm" onclick="openNewDmModal()">Nova</button>
        </div>
        ${threads.length ? threads.map(t => {
          const other = otherMember(t);
          const last = lastMessage(t);
          return `
            <button type="button" class="dm-thread-row ${t.id === state.activeDmId ? 'active' : ''}"
              onclick="selectDm('${t.id}')">
              ${avatarHTML({ name: other?.name, handle: other?.handle, avatar: other?.avatar || '' }, 'sm')}
              <div class="rail-me-text">
                <strong>${escapeHTML(other?.handle || '—')}</strong>
                <span>${escapeHTML((last?.text || '').slice(0, 40))}</span>
              </div>
            </button>`;
        }).join('') : `<p class="text-muted" style="padding:16px">Nenhuma conversa. Toque em Nova.</p>`}
      </div>
      <div class="dm-chat">
        ${active ? renderDmChat(active) : `<div class="empty"><h3>DMs</h3><p>Converse com seus resenheiros aqui.</p></div>`}
      </div>
    </div>`;
}

function otherMember(thread) {
  const members = thread.members || {};
  const my = state.user?.uid;
  for (const [uid, m] of Object.entries(members)) {
    if (uid !== my) return { uid, ...m };
  }
  if (isUserAdmin()) {
    for (const [uid, m] of Object.entries(members)) {
      if (!String(uid).startsWith('npc_')) return { uid, ...m };
    }
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

  markDmRead(thread.id);

  const npcOptions = Object.entries(state.npcProfiles || {})
    .map(([h, u]) => ({ handle: h, name: u.name || h }));

  const asNpcBar = isUserAdmin() ? `
    <div class="dm-as-npc">
      <label>Responder como</label>
      <select id="dm-as-npc" class="input input-sm">
        <option value="">eu (admin)</option>
        ${npcOptions.map(n =>
          `<option value="${escapeHTML(n.handle)}" ${thread.npcHandle === n.handle ? 'selected' : ''}>@${escapeHTML(n.handle)}</option>`
        ).join('')}
      </select>
    </div>` : '';

  return `
    <div class="dm-chat-head">
      <button type="button" class="icon-btn mobile-only" onclick="state.activeDmId=null;renderDMs()">←</button>
      <strong>${displayHandle(other?.handle)}</strong>
      <button type="button" class="btn btn-ghost btn-sm" onclick="openProfile('${escapeHTML(other?.handle || '')}')">Perfil</button>
      ${isUserAdmin() || true ? `<button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteDmThread('${thread.id}')">Apagar</button>` : ''}
    </div>
    <div class="dm-messages" id="dm-messages">
      ${msgs.map(m => `
        <div class="dm-bubble ${m.fromUid === state.user?.uid && !m.asNpc ? 'mine' : (m.asNpc ? 'npc' : '')}">
          ${m.asNpc || (m.fromHandle && m.fromUid !== state.user?.uid)
            ? `<div class="dm-from">${displayHandle(m.fromHandle)}</div>` : ''}
          <div>${linkify(m.text)}</div>
          <span class="c-time">${timeAgo(m.createdAt)}</span>
        </div>
      `).join('') || '<p class="text-muted">Sem mensagens ainda.</p>'}
    </div>
    ${asNpcBar}
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
  if (!text.trim()) return;
  const asNpc = document.getElementById('dm-as-npc')?.value?.trim();
  if (asNpc && isUserAdmin()) {
    await sendDmAsNpc(threadId, text, asNpc);
  } else {
    await sendDm(threadId, text);
  }
  if (input) input.value = '';
}

async function sendDmAsNpc(threadId, text, handle) {
  if (!state.user) return;
  const h = normalizeHandle(handle);
  const body = text.trim().slice(0, 500);
  try {
    await db.ref(`dms/${threadId}/messages`).push({
      text: body,
      fromUid: 'npc_' + h,
      fromHandle: h,
      asNpc: true,
      createdAt: Date.now(),
      read: false
    });
    await db.ref(`dms/${threadId}/updatedAt`).set(Date.now());
    const thread = state.dms[threadId];
    const members = thread?.members || {};
    for (const uid of Object.keys(members)) {
      if (!String(uid).startsWith('npc_') && uid !== state.user.uid) {
        await pushNotification(uid, {
          type: 'dm',
          fromHandle: h,
          text: body.slice(0, 80)
        });
      }
    }
  } catch (e) {
    showToast('Erro ao enviar DM.', 'err');
  }
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

async function openNewDmModal() {
  const npcs = Object.entries(state.npcProfiles || {})
    .map(([h, u]) => ({ handle: h, name: u.name || h }))
    .sort((a, b) => a.handle.localeCompare(b.handle));

  if (!npcs.length) {
    showToast('Crie NPCs no Admin antes de usar DM.', 'err');
    return;
  }

  if (isUserAdmin()) {
    const players = Object.entries(state.profiles || {})
      .filter(([, u]) => !u.isAdmin)
      .map(([id, u]) => ({ id, handle: u.handle, name: u.name }));

    const fields = [
      {
        name: 'npc',
        label: 'NPC (você fala por ele)',
        type: 'select',
        required: true,
        options: npcs.map(n => ({ value: n.handle, label: '@' + n.handle + ' · ' + n.name }))
      }
    ];
    if (players.length) {
      fields.push({
        name: 'player',
        label: 'Player',
        type: 'select',
        required: true,
        options: players.map(p => ({ value: p.id, label: '@' + p.handle + ' · ' + (p.name || '') }))
      });
    }

    const data = await rgForm({ title: 'Nova conversa', confirmLabel: 'Abrir', fields });
    if (!data) return;

    const npc = normalizeHandle(data.npc);
    const npcUid = 'npc_' + npc;
    const npcProf = state.npcProfiles[npc] || {};

    if (data.player) {
      const player = state.profiles[data.player];
      const tid = dmThreadId(data.player, npcUid);
      const ref = db.ref('dms/' + tid);
      const snap = await ref.once('value');
      if (!snap.exists()) {
        await ref.set({
          members: {
            [data.player]: { handle: player.handle, name: player.name, avatar: player.avatar || '' },
            [npcUid]: { handle: npc, name: npcProf.name || npc, avatar: npcProf.avatar || '' }
          },
          npcHandle: npc,
          updatedAt: Date.now(),
          messages: {}
        });
      } else {
        await ref.update({ npcHandle: npc });
      }
      state.activeDmId = tid;
      showView('dms');
    } else {
      await openOrCreateDm(npcUid, npc, npcProf.name || npc);
    }
    return;
  }

  const data = await rgForm({
    title: 'Nova conversa',
    confirmLabel: 'Abrir',
    fields: [{
      name: 'npc',
      label: 'Conversar com',
      type: 'select',
      required: true,
      options: npcs.map(n => ({ value: n.handle, label: '@' + n.handle + ' · ' + n.name }))
    }]
  });
  if (!data) return;
  await startDmWithHandle(data.npc);
}

async function startDmWithHandle(handle) {
  const h = normalizeHandle(handle);
  const npc = state.npcProfiles?.[h];
  const userEntry = Object.entries(state.profiles || {}).find(([, u]) => normalizeHandle(u.handle) === h);

  if (!npc && !userEntry) {
    showToast('Só DM com NPCs/contas existentes.', 'err');
    return;
  }

  if (npc || !userEntry) {
    const npcUid = 'npc_' + h;
    const name = npc?.name || h;
    if (!state.user) return;

    if (isUserAdmin()) {
      const players = Object.entries(state.profiles || {}).filter(([, u]) => !u.isAdmin);
      if (players.length === 1) {
        const [pid, player] = players[0];
        const tid = dmThreadId(pid, npcUid);
        const ref = db.ref('dms/' + tid);
        const snap = await ref.once('value');
        if (!snap.exists()) {
          await ref.set({
            members: {
              [pid]: { handle: player.handle, name: player.name, avatar: player.avatar || '' },
              [npcUid]: { handle: h, name, avatar: npc?.avatar || '' }
            },
            npcHandle: h,
            updatedAt: Date.now(),
            messages: {}
          });
        }
        state.activeDmId = tid;
        showView('dms');
        return;
      }
    }

    await openOrCreateDm(npcUid, h, name);
    try {
      const tid = dmThreadId(state.user.uid, npcUid);
      await db.ref('dms/' + tid).update({ npcHandle: h });
    } catch {}
    return;
  }

  await openOrCreateDm(userEntry[0], h, userEntry[1].name || h);
}

async function adminStartDmPrompt() {
  await openNewDmModal();
}


async function deleteDmThread(threadId) {
  const ok = await rgConfirm({
    title: 'Apagar conversa',
    body: 'Remove o histórico inteiro do Firebase. Não dá pra desfazer.',
    confirmLabel: 'Apagar',
    danger: true
  });
  if (!ok) return;
  try {
    await db.ref('dms/' + threadId).remove();
    if (state.activeDmId === threadId) state.activeDmId = null;
    showToast('Conversa apagada.');
    renderDMs();
  } catch (e) {
    showToast('Erro ao apagar DM.', 'err');
  }
}
