/* Rede X — Utils */

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function isUserAdmin() {
  if (state.user && ADMIN_UIDS.includes(state.user.uid)) return true;
  const v = state.profile?.isAdmin;
  return v === true || v === 'true' || v === 1 || v === '1';
}

function normalizeHandle(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

function displayHandle(h) {
  const n = normalizeHandle(h);
  return n ? '@' + n : '@—';
}

function linkifyText(text) {
  const safe = escapeHTML(text || '');
  return safe
    .replace(/@([a-z0-9_]{2,24})/gi, '<span class="mention">@$1</span>')
    .replace(/#([a-z0-9_]{2,32})/gi, '<span class="hashtag">#$1</span>')
    .replace(/\n/g, '<br>');
}

let _rxConfirmResolver = null;

function rxConfirm(opts) {
  const {
    title = 'Confirmar',
    body = '',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    danger = false
  } = opts || {};

  ensureConfirmModal();
  const modal = document.getElementById('rx-confirm-modal');
  document.getElementById('rx-confirm-title').textContent = title;
  const bodyEl = document.getElementById('rx-confirm-body');
  bodyEl.innerHTML = body || '';
  bodyEl.classList.toggle('hidden', !body);
  const okBtn = document.getElementById('rx-confirm-ok');
  okBtn.textContent = confirmLabel;
  okBtn.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
  document.getElementById('rx-confirm-cancel').textContent = cancelLabel;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  return new Promise((resolve) => {
    _rxConfirmResolver = resolve;
  });
}

function ensureConfirmModal() {
  if (document.getElementById('rx-confirm-modal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'rx-confirm-modal';
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="modal-dialog">
      <div class="confirm-card">
        <h3 id="rx-confirm-title">Confirmar</h3>
        <p id="rx-confirm-body" class="confirm-body"></p>
        <div class="confirm-actions">
          <button type="button" class="btn btn-ghost" id="rx-confirm-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" id="rx-confirm-ok">Confirmar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  const close = (val) => {
    wrap.classList.remove('open');
    document.body.style.overflow = '';
    const r = _rxConfirmResolver;
    _rxConfirmResolver = null;
    if (r) r(val);
  };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(false); });
  document.getElementById('rx-confirm-cancel').onclick = () => close(false);
  document.getElementById('rx-confirm-ok').onclick = () => close(true);
}
