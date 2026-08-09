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
  const handle = document.getElementById("ai-handle")?.value.trim() || "porto_wire";
  const name = document.getElementById("ai-name")?.value.trim() || handle;
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

async function aiReplyComment(postId) {
  const post = (typeof state !== 'undefined' ? state.posts : []).find(p => p.id === postId);
  if (!post) return;
  const handle = document.getElementById('comment-as-handle')?.value?.trim() || 'nina_riders';
  const statusIdea = post.caption || '';
  try {
    if (typeof showToast === 'function') showToast('IA respondendo…');
    const prompt = `Responda em 1 comentário curto (max 120 chars) como @${handle} no post: "${statusIdea}".
Português BR, tom in-world. Só o texto do comentário.`;
    let text = await jetStyleGenerate(prompt, 'gemini-3.6-flash');
    text = String(text || '').trim().replace(/^["']|["']$/g, '').slice(0, 240);
    const input = document.getElementById('comment-input');
    if (input) input.value = text;
    if (typeof showToast === 'function') showToast('Reply pronto — publique.');
  } catch (e) {
    console.error(e);
    if (typeof showToast === 'function') showToast('Erro IA reply.', 'err');
  }
}

window.generateBatchCaptions = generateBatchCaptions;
window.applyBatchItem = applyBatchItem;
window.aiReplyComment = aiReplyComment;

