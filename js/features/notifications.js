function renderNotifications() {
  const el = document.getElementById('notifications-root');
  if (!el) return;
  markNotifsRead();

  if (!state.notifications.length) {
    el.innerHTML = `<div class="empty"><div class="empty-glow"></div><h3>Tudo quieto</h3><p>Quando curtirem, comentarem ou te mencionarem, o sinal chega aqui.</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="notif-list">
      ${state.notifications.map(n => {
        const label = n.type === 'like' ? 'curtiu sua publicação'
          : n.type === 'comment' ? 'comentou: ' + escapeHTML(n.text || '')
          : n.type === 'mention' ? 'mencionou você'
          : n.type === 'dm' ? 'enviou mensagem'
          : 'atividade';
        return `
          <button type="button" class="notif-row ${n.read ? '' : 'unread'}"
            onclick="${n.postId ? `openPostModal('${n.postId}')` : (n.type === 'dm' ? `showView('dms')` : '')}">
            <div>
              <strong>${displayHandle(n.fromHandle)}</strong>
              <span> ${label}</span>
              <div class="c-time">${timeAgo(n.createdAt)}</div>
            </div>
          </button>`;
      }).join('')}
    </div>`;
}
