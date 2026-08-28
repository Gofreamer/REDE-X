function renderNotifications() {
  const el = document.getElementById('notifications-root');
  if (!el) return;
  markNotifsRead();

  if (!state.notifications.length) {
    el.innerHTML = `<div class="empty"><div class="empty-glow"></div><h3>Tudo quieto</h3><p>Quando curtirem, comentarem ou te mencionarem, o sinal chega aqui.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="notif-head">
      <span class="notif-head-count">${state.notifications.length} notificaç${state.notifications.length === 1 ? 'ão' : 'ões'}</span>
      <button type="button" class="btn btn-ghost btn-sm notif-clear-all" onclick="clearAllNotifications()">Limpar todas</button>
    </div>
    <div class="notif-list">
      ${state.notifications.map(n => {
        const label = n.type === 'like' ? 'curtiu sua publicação'
          : n.type === 'comment' ? 'comentou: ' + escapeHTML(n.text || '')
          : n.type === 'reply' ? 'respondeu: ' + escapeHTML(n.text || '')
          : n.type === 'mention' ? 'mencionou você'
          : n.type === 'dm' ? 'enviou mensagem'
          : 'atividade';
        const openAction = n.postId
          ? `openPostModal('${n.postId}')`
          : (n.type === 'dm' ? `showView('dms')` : '');
        return `
          <div class="notif-row ${n.read ? '' : 'unread'}">
            <button type="button" class="notif-row-main"
              onclick="${openAction || 'void(0)'}">
              <div>
                <strong>${displayHandle(n.fromHandle)}</strong>
                <span> ${label}</span>
                <div class="c-time">${timeAgo(n.createdAt)}</div>
              </div>
            </button>
            <button type="button" class="notif-delete" title="Apagar"
              onclick="event.stopPropagation(); deleteNotification('${n.id}')"
              aria-label="Apagar notificação">✕</button>
          </div>`;
      }).join('')}
    </div>`;
}

async function deleteNotification(id) {
  if (!state.user || !id) return;
  try {
    await db.ref('notifications/' + state.user.uid + '/' + id).remove();
    // listener atualiza a lista; fallback local se necessário
    state.notifications = state.notifications.filter(n => n.id !== id);
    state.unreadNotifs = state.notifications.filter(n => !n.read).length;
    updateNotifBadge();
    if (state.currentView === 'notifications') renderNotifications();
  } catch (e) {
    console.error(e);
    showToast('Erro ao apagar.', 'err');
  }
}

async function clearAllNotifications() {
  if (!state.user) return;
  if (!state.notifications.length) return;
  const ok = await rgConfirm({
    title: 'Limpar notificações',
    body: 'Apagar todas as ' + state.notifications.length + ' notificaç' +
      (state.notifications.length === 1 ? 'ão' : 'ões') + '? Isso libera espaço no servidor.',
    confirmLabel: 'Limpar todas',
    danger: true
  });
  if (!ok) return;
  try {
    await db.ref('notifications/' + state.user.uid).remove();
    state.notifications = [];
    state.unreadNotifs = 0;
    updateNotifBadge();
    renderNotifications();
    showToast('Notificações limpas.');
  } catch (e) {
    console.error(e);
    showToast('Erro ao limpar.', 'err');
  }
}
