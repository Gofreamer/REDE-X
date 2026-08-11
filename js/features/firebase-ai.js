/* Rede Global — Firebase AI Logic (mesmo padrão GS / Jet League) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app-check.js";

const aiFirebaseConfig = {
  apiKey: "AIzaSyAbc_DWHKEambENHQUTFpWLrQxWqkq8Imw",
  authDomain: "rede-x.firebaseapp.com",
  databaseURL: "https://rede-x-default-rtdb.firebaseio.com",
  projectId: "rede-x",
  storageBucket: "rede-x.firebasestorage.app",
  messagingSenderId: "599992301936",
  appId: "1:599992301936:web:3a7656cf52732bd076b7b5"
};

// Deixe vazio para NÃO ativar App Check (igual GS).
const APP_CHECK_SITE_KEY = "";

let aiApp = null;
let appCheckReady = false;

function getAIApp() {
  if (!aiApp) aiApp = initializeApp(aiFirebaseConfig, "rgAI");
  if (!appCheckReady && APP_CHECK_SITE_KEY) {
    try {
      initializeAppCheck(aiApp, {
        provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    } catch (e) {
      console.warn("App Check:", e?.message || e);
    }
    appCheckReady = true;
  }
  return aiApp;
}

async function jetStyleGenerate(prompt, modelName = "gemini-3.6-flash") {
  const ai = getAI(getAIApp(), { backend: new GoogleAIBackend() });
  const candidates = [modelName, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash"];
  const tried = new Set();
  let lastErr;
  for (const m of candidates) {
    if (tried.has(m)) continue;
    tried.add(m);
    try {
      const model = getGenerativeModel(ai, { model: m });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      lastErr = e;
      console.warn("AI model failed:", m, e?.message || e);
    }
  }
  throw lastErr || new Error("Nenhum modelo Gemini disponível");
}

function normalizeHandleLocal(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

async function generatePostWithAI() {
  const idea = document.getElementById("ai-idea")?.value.trim();
  const handle = (document.getElementById("ai-handle")?.value || "").trim() || "porto_wire";
  const npc = (typeof state !== "undefined" && state.npcProfiles)
    ? state.npcProfiles[handle] || state.npcProfiles[(handle || "").toLowerCase()]
    : null;
  const name = document.getElementById("ai-name")?.value.trim() || npc?.name || handle;
  const status = document.getElementById("ai-status");
  const btn = document.getElementById("btn-ai-gen");

  if (!idea) {
    if (typeof showToast === "function") showToast("Descreva a ideia do post.", "err");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Gerando…";
  }
  if (status) status.textContent = "Firebase AI · gemini-3.6-flash…";

  const prompt = `Você escreve legendas para a Rede Global, rede social in-world de RPG urbano/cyber.
Gere UMA legenda de post estilo Instagram (máximo 280 caracteres) em português brasileiro.
Tom: cidade viva, realista, pode usar 1 a 3 hashtags.
NÃO envolva a resposta em aspas.
Ideia: ${idea}
Conta: @${normalizeHandleLocal(handle)} (${name})
Responda APENAS com a legenda.`;

  try {
    let text = await jetStyleGenerate(prompt, "gemini-3.6-flash");
    text = String(text || "")
      .trim()
      .replace(/^["«]|["»]$/g, "");
    if (!text) throw new Error("Resposta vazia");

    const captionEl = document.getElementById("adm-caption");
    const handleEl = document.getElementById("adm-handle");
    const nameEl = document.getElementById("adm-name");
    if (captionEl) captionEl.value = text.slice(0, 500);
    if (handleEl) handleEl.value = normalizeHandleLocal(handle);
    if (nameEl) nameEl.value = name;
    if (status) status.textContent = "Legenda pronta — cole a URL da imagem e publique.";
    if (typeof showToast === "function") showToast("Legenda gerada (gemini-3.6-flash).");
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "Falha: " + (e?.message || "erro");
    if (typeof showToast === "function") {
      showToast("Erro na IA. Ative Gemini no Firebase AI Logic do projeto rede-x.", "err");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Gerar legenda";
    }
  }
}

window.generatePostWithAI = generatePostWithAI;
window.jetStyleGenerate = jetStyleGenerate;

async function generateBatchCaptions() {
  const idea = document.getElementById('ai-batch-idea')?.value.trim();
  const out = document.getElementById('ai-batch-out');
  if (!idea) {
    if (typeof showToast === 'function') showToast('Descreva o arco da sessão.', 'err');
    return;
  }
  if (out) out.textContent = 'Gerando lote…';
  const prompt = `Você é social media da Rede Global (RPG in-world).
Dado o arco: ${idea}
Gere EXATAMENTE 3 posts em JSON array:
[{"handle":"sem_@","name":"Nome","caption":"legenda max 200 chars com hashtag"}]
Handles inventados de mídia/NPC da cidade. Só o JSON.`;
  try {
    let text = await jetStyleGenerate(prompt, 'gemini-3.6-flash');
    const a = text.indexOf('[');
    const b = text.lastIndexOf(']');
    let arr = [];
    if (a !== -1 && b > a) arr = JSON.parse(text.slice(a, b + 1));
    if (!Array.isArray(arr) || !arr.length) throw new Error('JSON inválido');
    window.__rgAiBatch = arr;
    if (out) {
      out.innerHTML = arr.map((x, i) =>
        `<div style="margin:8px 0;padding:8px;border:1px solid #333;border-radius:8px">
          <strong>@${x.handle}</strong> — ${x.name}<br/>${x.caption}
          <br/><button type="button" class="btn btn-ghost btn-sm" onclick="applyBatchItem(${i})">Usar no form</button>
        </div>`
      ).join('');
    }
    if (typeof showToast === 'function') showToast('Lote gerado.');
  } catch (e) {
    console.error(e);
    if (out) out.textContent = 'Falha: ' + (e.message || e);
  }
}

function applyBatchItem(i) {
  const x = (window.__rgAiBatch || [])[i];
  if (!x) return;
  const h = document.getElementById('adm-handle');
  const n = document.getElementById('adm-name');
  const c = document.getElementById('adm-caption');
  if (h) h.value = String(x.handle || '').replace(/^@/, '');
  if (n) n.value = x.name || x.handle || '';
  if (c) c.value = x.caption || '';
  if (typeof showToast === 'function') showToast('Preenchido — cole a imagem e publique.');
}

/* ── IA: comentários com revisão ── */
window.__rgAiComments = [];
window.__rgAiCommentsPostId = null;

function getNpcPoolForAI() {
  const npcs = Object.entries((typeof state !== 'undefined' && state.npcProfiles) || {});
  if (npcs.length) {
    return npcs.map(([h, u]) => ({
      handle: normalizeHandleLocal(h),
      name: u.name || h
    }));
  }
  return [
    { handle: 'porto_wire', name: 'Porto Wire' },
    { handle: 'nexo_pulse', name: 'Nexo Pulse' },
    { handle: 'dock_cam', name: 'Dock Cam' },
    { handle: 'subsolo_echo', name: 'Subsolo Echo' },
    { handle: 'rua_livre', name: 'Rua Livre' }
  ];
}

async function aiReplyComment(postId) {
  // atalho antigo → abre o fluxo novo com 1 comentário
  openAiCommentsReview(postId, 1);
}

async function openAiCommentsReview(postId, count = 3) {
  if (typeof isUserAdmin === 'function' && !isUserAdmin()) {
    if (typeof showToast === 'function') showToast('Só admin.', 'err');
    return;
  }
  const post = (typeof state !== 'undefined' ? state.posts : []).find(p => p.id === postId);
  if (!post) {
    if (typeof showToast === 'function') showToast('Post não encontrado.', 'err');
    return;
  }

  window.__rgAiCommentsPostId = postId;
  ensureAiCommentsModal();
  const modal = document.getElementById('ai-comments-modal');
  const list = document.getElementById('ai-comments-list');
  const status = document.getElementById('ai-comments-status');
  const meta = document.getElementById('ai-comments-meta');

  if (meta) {
    meta.innerHTML = `
      <div class="aic-post-preview">
        <strong>@${escapeHTMLSafe(post.handle)}</strong>
        <span>${escapeHTMLSafe((post.caption || '').slice(0, 120))}${(post.caption || '').length > 120 ? '…' : ''}</span>
      </div>`;
  }
  if (list) {
    list.innerHTML = `<div class="aic-loading"><div class="aic-spinner"></div><p>Gemini gerando comentários…</p></div>`;
  }
  if (status) status.textContent = 'gemini-3.6-flash';
  modal.classList.add('open');

  const n = Math.max(1, Math.min(8, Number(count) || 3));
  try {
    const drafts = await generateAiCommentDrafts(post, n);
    window.__rgAiComments = drafts;
    renderAiCommentsList();
    if (status) status.textContent = drafts.length + ' rascunho(s) · revise antes de publicar';
  } catch (e) {
    console.error(e);
    if (list) {
      list.innerHTML = `<div class="aic-empty"><p>Falha na IA.</p><p class="hint">${escapeHTMLSafe(e?.message || 'erro')}</p>
        <button type="button" class="btn btn-ghost btn-sm" onclick="openAiCommentsReview('${postId}', ${n})">Tentar de novo</button></div>`;
    }
    if (status) status.textContent = 'erro';
    if (typeof showToast === 'function') showToast('Erro na IA de comentários.', 'err');
  }
}

async function generateAiCommentDrafts(post, count) {
  const pool = getNpcPoolForAI();
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.max(count, 3));
  const roster = shuffled.map(x => `@${x.handle} (${x.name})`).join(', ');

  const prompt = `Você escreve comentários para a Rede Global, rede social in-world de RPG urbano/cyberpunk brasileiro.
Poste de @${normalizeHandleLocal(post.handle)} (${post.name || post.handle}):
"${(post.caption || '(sem legenda)').slice(0, 400)}"

Gere EXATAMENTE ${count} comentários diferentes de contas da cidade.
Use APENAS handles desta lista (ou invente handles realistas se precisar): ${roster}

Regras:
- Português brasileiro natural, tom de rede social
- Cada comentário: máximo 140 caracteres
- Variar tom: elogio, piada, rumor, pergunta, reação curta
- Nada de meta (não fale de RPG, mestre, IA)
- NÃO use aspas envolvendo o texto

Responda SOMENTE com JSON array válido:
[{"handle":"sem_arroba","name":"Nome","text":"comentário"}]`;

  let text = await jetStyleGenerate(prompt, 'gemini-3.6-flash');
  text = String(text || '').trim();
  const a = text.indexOf('[');
  const b = text.lastIndexOf(']');
  if (a === -1 || b <= a) throw new Error('Resposta sem JSON');
  let arr = JSON.parse(text.slice(a, b + 1));
  if (!Array.isArray(arr) || !arr.length) throw new Error('JSON vazio');

  return arr.slice(0, count).map((item, i) => {
    const h = normalizeHandleLocal(item.handle || shuffled[i % shuffled.length].handle);
    const fromPool = pool.find(p => p.handle === h) || shuffled[i % shuffled.length];
    return {
      id: 'd' + i + '_' + Date.now(),
      handle: h,
      name: item.name || fromPool.name || h,
      text: String(item.text || '').trim().replace(/^["'«»]|["'«»]$/g, '').slice(0, 240),
      keep: true
    };
  }).filter(d => d.text);
}

function escapeHTMLSafe(str) {
  if (typeof escapeHTML === 'function') return escapeHTML(str);
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ensureAiCommentsModal() {
  if (document.getElementById('ai-comments-modal')) return;
  const d = document.createElement('div');
  d.id = 'ai-comments-modal';
  d.className = 'modal aic-modal';
  d.onclick = (e) => { if (e.target === d) closeAiCommentsModal(); };
  d.innerHTML = `
    <div class="modal-sheet aic-sheet" onclick="event.stopPropagation()">
      <div class="aic-head">
        <div>
          <h3>Comentários IA</h3>
          <p class="aic-sub" id="ai-comments-status">gemini-3.6-flash</p>
        </div>
        <button type="button" class="icon-btn" onclick="closeAiCommentsModal()" title="Fechar">✕</button>
      </div>
      <div id="ai-comments-meta" class="aic-meta"></div>
      <div class="aic-toolbar">
        <button type="button" class="btn btn-ghost btn-sm" onclick="aiCommentsRegenerate(3)">↻ 3 novos</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="aiCommentsRegenerate(5)">↻ 5 novos</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="aiCommentsSelectAll(true)">Marcar todos</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="aiCommentsSelectAll(false)">Desmarcar</button>
      </div>
      <div id="ai-comments-list" class="aic-list"></div>
      <div class="aic-foot">
        <button type="button" class="btn btn-ghost" onclick="closeAiCommentsModal()">Cancelar</button>
        <button type="button" class="btn btn-primary" id="ai-comments-publish" onclick="publishAiComments()">Publicar selecionados</button>
      </div>
    </div>`;
  document.body.appendChild(d);
}

function renderAiCommentsList() {
  const list = document.getElementById('ai-comments-list');
  if (!list) return;
  const drafts = window.__rgAiComments || [];
  const pool = getNpcPoolForAI();

  if (!drafts.length) {
    list.innerHTML = `<div class="aic-empty"><p>Nenhum rascunho.</p>
      <button type="button" class="btn btn-ghost btn-sm" onclick="aiCommentsRegenerate(3)">Gerar</button></div>`;
    return;
  }

  list.innerHTML = drafts.map((d, i) => `
    <div class="aic-card ${d.keep ? '' : 'aic-card-off'}" data-idx="${i}">
      <div class="aic-card-top">
        <label class="aic-check">
          <input type="checkbox" ${d.keep ? 'checked' : ''} onchange="aiCommentToggle(${i}, this.checked)"/>
          <span>publicar</span>
        </label>
        <button type="button" class="icon-btn aic-trash" onclick="aiCommentRemove(${i})" title="Remover">🗑</button>
      </div>
      <div class="aic-card-who">
        <select class="input input-sm aic-handle" onchange="aiCommentSetHandle(${i}, this.value)">
          ${pool.map(p =>
            `<option value="${escapeHTMLSafe(p.handle)}" ${p.handle === d.handle ? 'selected' : ''}>@${escapeHTMLSafe(p.handle)}</option>`
          ).join('')}
          ${pool.some(p => p.handle === d.handle) ? '' :
            `<option value="${escapeHTMLSafe(d.handle)}" selected>@${escapeHTMLSafe(d.handle)}</option>`}
        </select>
        <input class="input input-sm aic-name" value="${escapeHTMLSafe(d.name)}" maxlength="40"
          oninput="aiCommentSetName(${i}, this.value)" placeholder="Nome"/>
      </div>
      <textarea class="input aic-text" rows="2" maxlength="240"
        oninput="aiCommentSetText(${i}, this.value)">${escapeHTMLSafe(d.text)}</textarea>
      <div class="aic-card-foot">
        <span class="aic-chars">${(d.text || '').length}/240</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="aiCommentRegenOne(${i})">↻ este</button>
      </div>
    </div>`).join('');

  const btn = document.getElementById('ai-comments-publish');
  const n = drafts.filter(x => x.keep && (x.text || '').trim()).length;
  if (btn) btn.textContent = n ? `Publicar ${n}` : 'Publicar selecionados';
}

function aiCommentToggle(i, on) {
  if (!window.__rgAiComments[i]) return;
  window.__rgAiComments[i].keep = !!on;
  renderAiCommentsList();
}
function aiCommentRemove(i) {
  window.__rgAiComments.splice(i, 1);
  renderAiCommentsList();
}
function aiCommentSetHandle(i, handle) {
  const d = window.__rgAiComments[i];
  if (!d) return;
  d.handle = normalizeHandleLocal(handle);
  const pool = getNpcPoolForAI().find(p => p.handle === d.handle);
  if (pool) d.name = pool.name;
  renderAiCommentsList();
}
function aiCommentSetName(i, name) {
  if (window.__rgAiComments[i]) window.__rgAiComments[i].name = name;
}
function aiCommentSetText(i, text) {
  if (!window.__rgAiComments[i]) return;
  window.__rgAiComments[i].text = text;
  const card = document.querySelector(`.aic-card[data-idx="${i}"] .aic-chars`);
  if (card) card.textContent = `${text.length}/240`;
}
function aiCommentsSelectAll(on) {
  (window.__rgAiComments || []).forEach(d => { d.keep = !!on; });
  renderAiCommentsList();
}
async function aiCommentsRegenerate(count) {
  const postId = window.__rgAiCommentsPostId;
  if (postId) openAiCommentsReview(postId, count);
}
async function aiCommentRegenOne(i) {
  const postId = window.__rgAiCommentsPostId;
  const post = (typeof state !== 'undefined' ? state.posts : []).find(p => p.id === postId);
  const d = window.__rgAiComments[i];
  if (!post || !d) return;
  try {
    if (typeof showToast === 'function') showToast('Regenerando…');
    const prompt = `Escreva 1 comentário (max 140 chars) como @${d.handle} (${d.name}) no post de @${post.handle}: "${(post.caption || '').slice(0, 300)}".
Português BR, rede social in-world, sem aspas. Só o texto.`;
    let text = await jetStyleGenerate(prompt, 'gemini-3.6-flash');
    d.text = String(text || '').trim().replace(/^["'«»]|["'«»]$/g, '').slice(0, 240);
    renderAiCommentsList();
  } catch (e) {
    if (typeof showToast === 'function') showToast('Falha ao regenerar.', 'err');
  }
}

function closeAiCommentsModal() {
  document.getElementById('ai-comments-modal')?.classList.remove('open');
}

async function publishAiComments() {
  const postId = window.__rgAiCommentsPostId;
  const selected = (window.__rgAiComments || []).filter(d => d.keep && (d.text || '').trim());
  if (!postId || !selected.length) {
    if (typeof showToast === 'function') showToast('Nenhum comentário selecionado.', 'err');
    return;
  }
  const btn = document.getElementById('ai-comments-publish');
  if (btn) { btn.disabled = true; btn.textContent = 'Publicando…'; }

  try {
    for (const d of selected) {
      await db.ref('posts/' + postId + '/comments').push({
        text: d.text.trim().slice(0, 240),
        uid: 'npc_' + normalizeHandleLocal(d.handle),
        handle: normalizeHandleLocal(d.handle),
        name: d.name || d.handle,
        createdAt: Date.now() - Math.floor(Math.random() * 20 * 60000),
        bot: true,
        ai: true
      });
    }
    const snap = await db.ref('posts/' + postId + '/comments').once('value');
    const n = snap.exists() ? Object.keys(snap.val()).length : 0;
    await db.ref('posts/' + postId + '/commentCount').set(n);
    if (typeof showToast === 'function') showToast(selected.length + ' comentário(s) publicados.');
    closeAiCommentsModal();
    if (typeof renderPostModal === 'function') renderPostModal(postId);
  } catch (e) {
    console.error(e);
    if (typeof showToast === 'function') showToast('Erro ao publicar comentários.', 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Publicar selecionados'; }
  }
}

window.generateBatchCaptions = generateBatchCaptions;
window.applyBatchItem = applyBatchItem;
window.aiReplyComment = aiReplyComment;
window.openAiCommentsReview = openAiCommentsReview;
window.closeAiCommentsModal = closeAiCommentsModal;
window.publishAiComments = publishAiComments;
window.aiCommentsRegenerate = aiCommentsRegenerate;
window.aiCommentsSelectAll = aiCommentsSelectAll;
window.aiCommentToggle = aiCommentToggle;
window.aiCommentRemove = aiCommentRemove;
window.aiCommentSetHandle = aiCommentSetHandle;
window.aiCommentSetName = aiCommentSetName;
window.aiCommentSetText = aiCommentSetText;
window.aiCommentRegenOne = aiCommentRegenOne;

