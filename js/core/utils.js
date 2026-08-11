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
  if (s < 5) return 'agora';
  if (s < 60) return s + ' s';
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return 'há ' + m + ' min';
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return 'há ' + h + ' h';
  }
  if (s < 604800) {
    const d = Math.floor(s / 86400);
    return 'há ' + d + ' d';
  }
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

let _timeTicker = null;
function startTimeTicker() {
  if (_timeTicker) return;
  _timeTicker = setInterval(() => {
    document.querySelectorAll('[data-ts]').forEach(el => {
      const ts = Number(el.getAttribute('data-ts'));
      if (ts) el.textContent = timeAgo(ts);
    });
  }, 30000);
}
startTimeTicker();

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
    .replace(/@([a-z0-9_]{2,24})/gi, '<button type="button" class="tag mention-link" onclick="event.stopPropagation();openProfile(\'$1\')">@$1</button>')
    .replace(/#([a-z0-9_]{2,32})/gi, '<button type="button" class="tag hashtag-link" onclick="event.stopPropagation();filterByTag(\'$1\')">#$1</button>')
    .replace(/\n/g, '<br>');
}

function avatarHTML(p, sizeClass = '') {
  const letter = ((p?.name || p?.handle || '?')[0] || '?').toUpperCase();
  if (p?.avatar) {
    return `<div class="avatar ${sizeClass}"><img src="${escapeHTML(p.avatar)}" alt="" onerror="this.parentElement.innerHTML='<span>${letter}</span>'"/></div>`;
  }
  return `<div class="avatar ${sizeClass}"><span>${letter}</span></div>`;
}

function verifiedBadgeHTML(handleOrFlag) {
  let ok = false;
  if (typeof handleOrFlag === 'boolean') ok = handleOrFlag;
  else if (typeof isVerifiedProfile === 'function') ok = isVerifiedProfile(handleOrFlag);
  if (!ok) return '';
  return `<span class="verified-badge" title="Verificado" aria-label="Verificado">✓</span>`;
}

function nameWithVerified(name, handle) {
  return `${escapeHTML(name || handle || '')}${verifiedBadgeHTML(handle)}`;
}

let _confirmResolve = null;
function rgConfirm({ title = 'Confirmar', body = '', confirmLabel = 'OK', danger = false } = {}) {
  ensureConfirm();
  const m = document.getElementById('rg-confirm');
  document.getElementById('rg-confirm-title').textContent = title;
  document.getElementById('rg-confirm-body').innerHTML = body || '';
  const ok = document.getElementById('rg-confirm-ok');
  ok.textContent = confirmLabel;
  ok.className = 'ig-dialog-btn ig-dialog-btn-primary' + (danger ? ' ig-dialog-btn-danger' : '');
  ok.style.background = '';
  m.classList.add('open');
  return new Promise(r => { _confirmResolve = r; });
}
function ensureConfirm() {
  if (document.getElementById('rg-confirm')) return;
  const d = document.createElement('div');
  d.id = 'rg-confirm';
  d.className = 'modal ig-dialog';
  d.innerHTML = `
    <div class="ig-dialog-card">
      <div class="ig-dialog-title" id="rg-confirm-title">Confirmar</div>
      <div class="ig-dialog-body" id="rg-confirm-body"></div>
      <div class="ig-dialog-actions">
        <button type="button" class="ig-dialog-btn" id="rg-confirm-cancel">Cancelar</button>
        <button type="button" class="ig-dialog-btn ig-dialog-btn-primary" id="rg-confirm-ok">OK</button>
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


let _formResolve = null;
/**
 * Modal de formulário (substitui prompt nativo)
 * fields: [{ name, label, type, value, placeholder, required, options:[{value,label}] }]
 */
function rgForm({ title = 'Formulário', fields = [], confirmLabel = 'OK', cancelLabel = 'Cancelar' } = {}) {
  ensureFormModal();
  const m = document.getElementById('rg-form-modal');
  document.getElementById('rg-form-title').textContent = title;
  const body = document.getElementById('rg-form-fields');
  body.innerHTML = fields.map((f, i) => {
    const id = 'rgf-' + f.name;
    if (f.type === 'select') {
      const opts = (f.options || []).map(o =>
        `<option value="${escapeHTML(o.value)}" ${String(o.value) === String(f.value || '') ? 'selected' : ''}>${escapeHTML(o.label)}</option>`
      ).join('');
      return `<label class="ig-field"><span>${escapeHTML(f.label || f.name)}</span>
        <select id="${id}" class="ig-select" ${f.required ? 'required' : ''}>${opts}</select></label>`;
    }
    if (f.type === 'textarea') {
      return `<label class="ig-field"><span>${escapeHTML(f.label || f.name)}</span>
        <textarea id="${id}" class="ig-input" rows="${f.rows || 3}" placeholder="${escapeHTML(f.placeholder || '')}" ${f.required ? 'required' : ''}>${escapeHTML(f.value || '')}</textarea></label>`;
    }
    return `<label class="ig-field"><span>${escapeHTML(f.label || f.name)}</span>
      <input id="${id}" class="ig-input" type="${f.type || 'text'}" value="${escapeHTML(f.value || '')}"
        placeholder="${escapeHTML(f.placeholder || '')}" ${f.required ? 'required' : ''}/></label>`;
  }).join('');
  document.getElementById('rg-form-ok').textContent = confirmLabel;
  const cancelBtn = document.getElementById('rg-form-cancel');
  if (cancelBtn) cancelBtn.textContent = cancelLabel;
  m.classList.add('open');
  const first = body.querySelector('input, textarea, select');
  if (first) setTimeout(() => first.focus(), 50);
  return new Promise(resolve => { _formResolve = resolve; });
}

function ensureFormModal() {
  if (document.getElementById('rg-form-modal')) return;
  const d = document.createElement('div');
  d.id = 'rg-form-modal';
  d.className = 'modal ig-dialog';
  d.innerHTML = `
    <div class="ig-dialog-card ig-dialog-form">
      <div class="ig-dialog-head">
        <button type="button" class="ig-dialog-x" id="rg-form-x">✕</button>
        <div class="ig-dialog-title" id="rg-form-title">Formulário</div>
        <button type="button" class="ig-dialog-done" id="rg-form-ok">OK</button>
      </div>
      <div class="ig-dialog-fields" id="rg-form-fields"></div>
      <div class="ig-dialog-actions ig-dialog-actions-bottom">
        <button type="button" class="ig-dialog-btn" id="rg-form-cancel">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  const close = (val) => {
    d.classList.remove('open');
    const r = _formResolve; _formResolve = null; if (r) r(val);
  };
  d.addEventListener('click', e => { if (e.target === d) close(null); });
  document.getElementById('rg-form-cancel').onclick = () => close(null);
  document.getElementById('rg-form-x').onclick = () => close(null);
  document.getElementById('rg-form-ok').onclick = () => {
    const fields = [...document.querySelectorAll('#rg-form-fields [id^="rgf-"]')];
    const data = {};
    for (const el of fields) {
      const name = el.id.replace(/^rgf-/, '');
      if (el.required && !String(el.value || '').trim()) {
        el.focus();
        return;
      }
      data[name] = el.value;
    }
    close(data);
  };
}

// fix danger button style on confirm
