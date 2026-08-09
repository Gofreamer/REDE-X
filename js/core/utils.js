function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function showToast(msg, type = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  box.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 280);
  }, 2800);
}

function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return Math.floor(s / 60) + ' min';
  if (s < 86400) return Math.floor(s / 3600) + ' h';
  if (s < 604800) return Math.floor(s / 86400) + ' d';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function isUserAdmin() {
  if (state.user && ADMIN_UIDS.includes(state.user.uid)) return true;
  const v = state.profile?.isAdmin;
  return v === true || v === 'true' || v === 1;
}

function normalizeHandle(h) {
  return String(h || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 24);
}

function displayHandle(h) {
  const n = normalizeHandle(h);
  return n ? '@' + n : '@—';
}

function linkify(text) {
  return escapeHTML(text || '')
    .replace(/@([a-z0-9_]{2,24})/gi, '<span class="tag">@$1</span>')
    .replace(/#([a-z0-9_]{2,32})/gi, '<span class="tag">#$1</span>')
    .replace(/\n/g, '<br>');
}

function avatarHTML(p, sizeClass = '') {
  const letter = ((p?.name || p?.handle || '?')[0] || '?').toUpperCase();
  if (p?.avatar) {
    return `<div class="avatar ${sizeClass}"><img src="${escapeHTML(p.avatar)}" alt="" onerror="this.parentElement.innerHTML='<span>${letter}</span>'"/></div>`;
  }
  return `<div class="avatar ${sizeClass}"><span>${letter}</span></div>`;
}

let _confirmResolve = null;
function rgConfirm({ title = 'Confirmar', body = '', confirmLabel = 'OK', danger = false } = {}) {
  ensureConfirm();
  const m = document.getElementById('rg-confirm');
  document.getElementById('rg-confirm-title').textContent = title;
  document.getElementById('rg-confirm-body').innerHTML = body || '';
  const ok = document.getElementById('rg-confirm-ok');
  ok.textContent = confirmLabel;
  ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
  m.classList.add('open');
  return new Promise(r => { _confirmResolve = r; });
}
function ensureConfirm() {
  if (document.getElementById('rg-confirm')) return;
  const d = document.createElement('div');
  d.id = 'rg-confirm';
  d.className = 'modal';
  d.innerHTML = `
    <div class="modal-sheet">
      <h3 id="rg-confirm-title">Confirmar</h3>
      <p id="rg-confirm-body" class="modal-body"></p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="rg-confirm-cancel">Cancelar</button>
        <button type="button" class="btn btn-primary" id="rg-confirm-ok">OK</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  const close = (v) => {
    d.classList.remove('open');
    const r = _confirmResolve; _confirmResolve = null; if (r) r(v);
  };
  d.addEventListener('click', e => { if (e.target === d) close(false); });
  document.getElementById('rg-confirm-cancel').onclick = () => close(false);
  document.getElementById('rg-confirm-ok').onclick = () => close(true);
}
