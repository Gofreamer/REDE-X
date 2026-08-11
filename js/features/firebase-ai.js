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
  let handle = normalizeHandleLocal(document.getElementById("ai-handle")?.value || "");
  const imagePrefill = (document.getElementById("ai-image")?.value || "").trim();
  const npc = (typeof state !== "undefined" && state.npcProfiles && handle)
    ? state.npcProfiles[handle] || state.npcProfiles[handle.toLowerCase()]
    : null;
  let name = document.getElementById("ai-name")?.value.trim() || npc?.name || handle || "";
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

  // se não escolheu NPC, deixa a IA sugerir handle+nome+legenda
  const needIdentity = !handle;
  const prompt = needIdentity
    ? `Você é social media da Rede Global (rede social in-world de RPG urbano/cyber, PT-BR).
Ideia do post: ${idea}

Gere UM post Instagram. Responda SOMENTE JSON válido:
{"handle":"sem_arroba","name":"Nome de exibição","caption":"legenda max 280 chars com 1-3 hashtags"}

Regras: handle realista de mídia/marca/pessoa da cidade; legenda natural; sem aspas extras; sem meta de RPG.`
    : `Você escreve legendas para a Rede Global, rede social in-world de RPG urbano/cyber.
Gere UMA legenda estilo Instagram (máx 280 caracteres) em português brasileiro.
Tom: cidade viva, realista, 1 a 3 hashtags. NÃO envolva em aspas.
Ideia: ${idea}
Conta: @${handle} (${name || handle})
Responda SOMENTE JSON: {"caption":"texto da legenda"}`;

  try {
    let raw = await jetStyleGenerate(prompt, "gemini-3.6-flash");
    raw = String(raw || "").trim();
    let caption = "";
    // tenta JSON
    const j0 = raw.indexOf("{");
    const j1 = raw.lastIndexOf("}");
    if (j0 !== -1 && j1 > j0) {
      try {
        const obj = JSON.parse(raw.slice(j0, j1 + 1));
        caption = String(obj.caption || obj.legenda || obj.text || "").trim();
        if (needIdentity) {
          if (obj.handle) handle = normalizeHandleLocal(obj.handle);
          if (obj.name) name = String(obj.name).trim();
        }
      } catch (_) { /* fallback texto puro */ }
    }
    if (!caption) {
      caption = raw.replace(/^["«]|["»]$/g, "").trim();
    }
    if (!caption) throw new Error("Resposta vazia");
    if (!handle) handle = "porto_wire";
    if (!name) {
      const n = (typeof state !== "undefined" && state.npcProfiles)
        ? state.npcProfiles[handle]
        : null;
      name = n?.name || handle;
    }

    openAiPostReview({
      handle,
      name,
      caption: caption.slice(0, 500),
      image: imagePrefill,
      idea
    });

    if (status) status.textContent = "Rascunho pronto — revise e publique.";
    if (typeof showToast === "function") showToast("Post gerado — revise no modal.");
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "Falha: " + (e?.message || "erro");
    if (typeof showToast === "function") {
      showToast("Erro na IA. Ative Gemini no Firebase AI Logic do projeto rede-x.", "err");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Gerar post";
    }
  }
}

/* Modal de revisão de post gerado por IA */
function ensureAiPostModal() {
  if (document.getElementById("ai-post-modal")) return;
  const d = document.createElement("div");
  d.id = "ai-post-modal";
  d.className = "modal aic-modal";
  d.onclick = (e) => { if (e.target === d) closeAiPostReview(); };
  d.innerHTML = `
    <div class="modal-sheet aic-sheet aip-sheet" onclick="event.stopPropagation()">
      <div class="aic-head">
        <div>
          <h3>Revisar post IA</h3>
          <p class="aic-sub" id="aip-status">gemini-3.6-flash</p>
        </div>
        <button type="button" class="icon-btn" onclick="closeAiPostReview()">✕</button>
      </div>
      <div class="aip-body">
        <div class="aip-preview" id="aip-preview">
          <span class="text-muted">URL da imagem</span>
        </div>
        <div class="aip-fields">
          <label class="field"><span>Handle</span>
            <input class="input" id="aip-handle" maxlength="24"/>
          </label>
          <label class="field"><span>Nome</span>
            <input class="input" id="aip-name" maxlength="40"/>
          </label>
          <label class="field"><span>Imagem (URL)</span>
            <input class="input" id="aip-image" type="url" placeholder="https://…" oninput="previewAiPostImage()"/>
          </label>
          <label class="field"><span>Legenda</span>
            <textarea class="input" id="aip-caption" rows="5" maxlength="500"></textarea>
          </label>
          <p class="hint" id="aip-idea-hint"></p>
        </div>
      </div>
      <div class="aic-foot">
        <button type="button" class="btn btn-ghost" onclick="closeAiPostReview()">Cancelar</button>
        <button type="button" class="btn btn-ghost" onclick="regenAiPostCaption()">↻ Regenerar legenda</button>
        <button type="button" class="btn btn-primary" id="aip-publish" onclick="publishAiPostReview()">Publicar</button>
      </div>
    </div>`;
  document.body.appendChild(d);
}

function openAiPostReview(draft) {
  ensureAiPostModal();
  window.__rgAiPostDraft = draft || {};
  document.getElementById("aip-handle").value = draft.handle || "";
  document.getElementById("aip-name").value = draft.name || "";
  document.getElementById("aip-image").value = draft.image || "";
  document.getElementById("aip-caption").value = draft.caption || "";
  const hint = document.getElementById("aip-idea-hint");
  if (hint) hint.textContent = draft.idea ? "Ideia: " + draft.idea : "";
  document.getElementById("aip-status").textContent = "Revise antes de publicar";
  previewAiPostImage();
  document.getElementById("ai-post-modal").classList.add("open");
}

function closeAiPostReview() {
  document.getElementById("ai-post-modal")?.classList.remove("open");
}

function previewAiPostImage() {
  const url = (document.getElementById("aip-image")?.value || "").trim();
  const box = document.getElementById("aip-preview");
  if (!box) return;
  if (url) {
    box.innerHTML = `<img src="${escapeHTMLSafe(url)}" alt="" onerror="this.parentElement.innerHTML='<span class=text-muted>Imagem inválida</span>'"/>`;
  } else {
    box.innerHTML = `<span class="text-muted">Cole a URL da imagem</span>`;
  }
}

async function regenAiPostCaption() {
  const handle = normalizeHandleLocal(document.getElementById("aip-handle")?.value);
  const name = document.getElementById("aip-name")?.value.trim() || handle;
  const idea = window.__rgAiPostDraft?.idea || document.getElementById("aip-caption")?.value || "";
  const status = document.getElementById("aip-status");
  if (status) status.textContent = "Regenerando…";
  try {
    const prompt = `Legenda Instagram (max 280 chars, PT-BR, 1-3 hashtags) para @${handle} (${name}).
Ideia: ${idea}
Só o texto da legenda, sem aspas.`;
    let text = await jetStyleGenerate(prompt, "gemini-3.6-flash");
    text = String(text || "").trim().replace(/^["«]|["»]$/g, "");
    document.getElementById("aip-caption").value = text.slice(0, 500);
    if (status) status.textContent = "Legenda regenerada";
  } catch (e) {
    if (status) status.textContent = "Falha ao regenerar";
    if (typeof showToast === "function") showToast("Erro ao regenerar.", "err");
  }
}

async function publishAiPostReview() {
  const handle = normalizeHandleLocal(document.getElementById("aip-handle")?.value);
  const name = document.getElementById("aip-name")?.value.trim() || handle;
  const image = (document.getElementById("aip-image")?.value || "").trim();
  const caption = (document.getElementById("aip-caption")?.value || "").trim();
  if (!handle) {
    if (typeof showToast === "function") showToast("Informe o handle.", "err");
    return;
  }
  if (!image) {
    if (typeof showToast === "function") showToast("Cole a URL da imagem.", "err");
    return;
  }
  const btn = document.getElementById("aip-publish");
  if (btn) { btn.disabled = true; btn.textContent = "Publicando…"; }
  try {
    const ok = await createPost({
      image,
      caption,
      asHandle: handle,
      asName: name
    });
    if (ok) {
      if (typeof showToast === "function") showToast("Post no ar.");
      closeAiPostReview();
      if (typeof showView === "function") showView("feed");
    }
  } catch (e) {
    console.error(e);
    if (typeof showToast === "function") showToast("Erro ao publicar.", "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Publicar"; }
  }
}

window.generatePostWithAI = generatePostWithAI;
window.jetStyleGenerate = jetStyleGenerate;
window.openAiPostReview = openAiPostReview;
window.closeAiPostReview = closeAiPostReview;
window.previewAiPostImage = previewAiPostImage;
window.regenAiPostCaption = regenAiPostCaption;
window.publishAiPostReview = publishAiPostReview;

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

async function openAiCommentsReview(postId, count = 3, autoGenerate = true) {
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
  const countEl = document.getElementById('aic-count');

  if (meta) {
    meta.innerHTML = `
      <div class="aic-post-preview">
        <strong>@${escapeHTMLSafe(post.handle)}</strong>
        <span>${escapeHTMLSafe((post.caption || '').slice(0, 120))}${(post.caption || '').length > 120 ? '…' : ''}</span>
      </div>`;
  }
  if (countEl) countEl.value = String(Math.max(1, Math.min(8, Number(count) || 3)));
  if (status) status.textContent = 'defina o tom e gere';
  modal.classList.add('open');

  if (autoGenerate) {
    await runAiCommentsGenerate();
  } else if (list && !(window.__rgAiComments || []).length) {
    list.innerHTML = `<div class="aic-empty"><p>Escolha o tom e toque em <strong>Gerar</strong>.</p></div>`;
  }
}

function getAiCommentsTone() {
  const el = document.getElementById('aic-tone');
  return (el?.value || '').trim();
}

function setAiCommentsTone(tone) {
  const el = document.getElementById('aic-tone');
  if (el) el.value = tone;
}

async function runAiCommentsGenerate() {
  const postId = window.__rgAiCommentsPostId;
  const post = (typeof state !== 'undefined' ? state.posts : []).find(p => p.id === postId);
  if (!post) return;

  const list = document.getElementById('ai-comments-list');
  const status = document.getElementById('ai-comments-status');
  const countEl = document.getElementById('aic-count');
  const n = Math.max(1, Math.min(8, parseInt(countEl?.value, 10) || 3));
  const tone = getAiCommentsTone();

  if (list) {
    list.innerHTML = `<div class="aic-loading"><div class="aic-spinner"></div><p>Gemini gerando com o tom escolhido…</p></div>`;
  }
  if (status) status.textContent = tone ? ('tom: ' + tone.slice(0, 40)) : 'gemini-3.6-flash';

  try {
    const drafts = await generateAiCommentDrafts(post, n, tone);
    window.__rgAiComments = drafts;
    renderAiCommentsList();
    if (status) status.textContent = drafts.length + ' rascunho(s) · revise antes de publicar';
  } catch (e) {
    console.error(e);
    if (list) {
      list.innerHTML = `<div class="aic-empty"><p>Falha na IA.</p><p class="hint">${escapeHTMLSafe(e?.message || 'erro')}</p>
        <button type="button" class="btn btn-ghost btn-sm" onclick="runAiCommentsGenerate()">Tentar de novo</button></div>`;
    }
    if (status) status.textContent = 'erro';
    if (typeof showToast === 'function') showToast('Erro na IA de comentários.', 'err');
  }
}

async function generateAiCommentDrafts(post, count, tone) {
  const pool = getNpcPoolForAI();
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.max(count, 3));
  const roster = shuffled.map(x => `@${x.handle} (${x.name})`).join(', ');
  const toneLine = (tone || '').trim()
    ? `TOM PEDIDO PELO MESTRE (prioridade máxima): ${tone.trim()}`
    : `Tom padrão: português BR de cidade, informal, seco, às vezes irônico; evitar "amei/parabéns/incrível".`;

  const prompt = `Você escreve comentários na Rede Global — rede social da cidade (cyberpunk/urbano brasileiro).
NÃO é Instagram genérico: é gente da rua, do porto, do setor, de marca underground.

Post de @${normalizeHandleLocal(post.handle)} (${post.name || post.handle}):
"${(post.caption || '(sem legenda)').slice(0, 400)}"

Gere EXATAMENTE ${count} comentários de contas diferentes.
Preferir handles desta lista: ${roster}

${toneLine}

Regras fixas:
- Máx 120 caracteres cada
- Zero meta (sem RPG, mestre, IA, personagem)
- Sem aspas envolvendo o texto
- Variar vozes entre os comentários
- Respeitar o tom pedido acima em TODOS os comentários

JSON only:
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
      <div class="aic-tone-block">
        <label class="aic-tone-label">Tom / instrução <span>(a IA segue isso na geração)</span></label>
        <textarea class="input aic-tone-input" id="aic-tone" rows="2" placeholder="Ex: fãs empolgados da marca · imprensa fria · rumor hostil do subsolo · zoação leve entre amigos…"></textarea>
        <div class="aic-tone-chips">
          <button type="button" class="aic-chip" onclick="setAiCommentsTone('fãs empolgados, elogio genuíno, energia de streetwear')">Fãs</button>
          <button type="button" class="aic-chip" onclick="setAiCommentsTone('imprensa e colunistas, tom frio e profissional')">Imprensa</button>
          <button type="button" class="aic-chip" onclick="setAiCommentsTone('rumor hostil do subsolo, desconfiança, tom seco')">Rumor hostil</button>
          <button type="button" class="aic-chip" onclick="setAiCommentsTone('zoação leve entre amigos da cidade, ironia sem ofensa pesada')">Zoação</button>
          <button type="button" class="aic-chip" onclick="setAiCommentsTone('hype de lançamento, urgência de quem quer comprar')">Hype</button>
          <button type="button" class="aic-chip" onclick="setAiCommentsTone('comentários curtos e secos, quase sem emoji')">Seco</button>
        </div>
        <div class="aic-gen-row">
          <label class="aic-count-label">Qtd
            <input type="number" class="input input-sm aic-count" id="aic-count" min="1" max="8" value="3"/>
          </label>
          <button type="button" class="btn btn-primary btn-sm" onclick="runAiCommentsGenerate()">✦ Gerar com este tom</button>
        </div>
      </div>
      <div class="aic-toolbar">
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
  const countEl = document.getElementById('aic-count');
  if (countEl && count) countEl.value = String(count);
  await runAiCommentsGenerate();
}
async function aiCommentRegenOne(i) {
  const postId = window.__rgAiCommentsPostId;
  const post = (typeof state !== 'undefined' ? state.posts : []).find(p => p.id === postId);
  const d = window.__rgAiComments[i];
  if (!post || !d) return;
  const tone = getAiCommentsTone();
  try {
    if (typeof showToast === 'function') showToast('Regenerando…');
    const toneLine = tone
      ? `TOM PEDIDO: ${tone}`
      : 'Tom: cidade cyberpunk BR, informal, seco.';
    const prompt = `1 comentário (máx 120 chars) como @${d.handle} (${d.name}) no post de @${post.handle}: "${(post.caption || '').slice(0, 300)}".
${toneLine}
Sem meta de RPG/IA. Sem aspas. Só o texto.`;
    let textOut = await jetStyleGenerate(prompt, 'gemini-3.6-flash');
    d.text = String(textOut || '').trim().replace(/^["'«»]|["'«»]$/g, '').slice(0, 240);
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
    const post = (typeof state !== 'undefined' ? state.posts : []).find(x => x.id === postId);
    for (const d of selected) {
      const h = normalizeHandleLocal(d.handle);
      const text = d.text.trim().slice(0, 240);
      await db.ref('posts/' + postId + '/comments').push({
        text,
        uid: 'npc_' + h,
        handle: h,
        name: d.name || d.handle,
        createdAt: Date.now() - Math.floor(Math.random() * 20 * 60000),
        bot: true,
        ai: true
      });
      // notifica dono do post (player) + menções
      if (typeof pushNotification === 'function' && post && post.uid && !String(post.uid).startsWith('npc_')) {
        await pushNotification(post.uid, {
          type: 'comment',
          fromHandle: h,
          postId,
          text: text.slice(0, 80)
        });
      }
      if (typeof notifyMentions === 'function') {
        await notifyMentions(text, postId, h, 'npc_' + h);
      }
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
window.runAiCommentsGenerate = runAiCommentsGenerate;
window.setAiCommentsTone = setAiCommentsTone;
window.getAiCommentsTone = getAiCommentsTone;
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

