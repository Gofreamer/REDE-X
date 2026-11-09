const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness({ failures = {}, tokenError, initError, tokenPending, modelPending, emptyResponse } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../js/features/firebase-ai.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').split('function normalizeHandleLocal')[0];
  const calls = { init: 0, events: [], models: [], options: [], appCheckOptions: [], requests: [], signals: [], timers: new Map() };
  let timerId = 0;
  const context = vm.createContext({
    AbortController,
    setTimeout: (callback, ms) => { const id = ++timerId; calls.timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => calls.timers.delete(id),
    console: { warn() {} },
    initializeApp: () => ({}),
    initializeAppCheck: (_app, options) => {
      calls.appCheckOptions.push(options);
      calls.init++;
      if (initError && calls.init === 1) throw initError;
      return {};
    },
    ReCaptchaEnterpriseProvider: function(key) { assert.match(key, /^6L/); },
    getToken: () => { throw new Error('Não deve solicitar token comum antes do token de uso único'); },
    GoogleAIBackend: function() {},
    getAI: (_app, options) => { calls.options.push(options); return {}; },
    getGenerativeModel: (_ai, { model }, options) => ({ generateContent: async (_prompt, request) => {
      calls.requests.push(options);
      calls.signals.push(request.signal);
      // O SDK solicita o token de uso único dentro de generateContent.
      calls.events.push('token');
      if (tokenError) throw tokenError;
      if (tokenPending) return new Promise(() => {});
      calls.events.push('generate');
      calls.models.push(model);
      if (failures[model]) throw typeof failures[model] === 'string' ? new Error(failures[model]) : failures[model];
      if (modelPending) return new Promise(() => {});
      return { response: { text: () => emptyResponse ? '' : 'ok' } };
    } })
  });
  vm.runInContext(source, context);
  return { calls, run: () => vm.runInContext("jetStyleGenerate('prompt')", context),
    expire: ms => { const timer = [...calls.timers.values()].find(t => t.ms === ms); assert.ok(timer); timer.callback(); },
    friendly: message => context.getFirebaseAIErrorMessage(typeof message === 'string' ? new Error(message) : message) };
}

test('usa Gemini 3.8 com token validado e tokens de uso único', async () => {
  const h = harness();
  assert.equal(await h.run(), 'ok');
  assert.equal(await h.run(), 'ok');
  assert.equal(h.calls.init, 1);
  assert.deepEqual(h.calls.events, ['token', 'generate', 'token', 'generate']);
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash', 'gemini-3.8-flash']);
  assert.ok(h.calls.options.every(options => options.useLimitedUseAppCheckTokens === true));
  assert.ok(h.calls.appCheckOptions.every(options => options.isTokenAutoRefreshEnabled === false));
  assert.ok(h.calls.requests.every(options => options.timeout === 30000));
  assert.equal(h.calls.timers.size, 0);
});

for (const message of ['[403] Firebase AI Logic has been deactivated', '[429] quota exceeded', '[401] unauthenticated', 'network failed']) {
  test('não repete chamadas ao receber ' + message, async () => {
    const h = harness({ failures: { 'gemini-3.8-flash': message } });
    await assert.rejects(h.run());
    assert.deepEqual(h.calls.models, ['gemini-3.8-flash']);
  });
}

test('modelo indisponível permite fallback sem duplicar modelos', async () => {
  const h = harness({ failures: { 'gemini-3.8-flash': '[404] model not found', 'gemini-3.5-flash-lite': '[404] model not found' } });
  assert.equal(await h.run(), 'ok');
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash']);
});

test('alta demanda temporária permite usar o modelo alternativo', async () => {
  const h = harness({ failures: { 'gemini-3.8-flash': '[500] This model is currently experiencing high demand' } });
  assert.equal(await h.run(), 'ok');
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
});

test('falha no App Check não envia pedido à IA', async () => {
  const h = harness({ tokenError: new Error('appCheck/recaptcha-error') });
  await assert.rejects(h.run(), /recaptcha/);
  assert.deepEqual(h.calls.models, []);
  assert.match(h.friendly('appCheck/recaptcha-error'), /validar o App Check/);
});

test('falha de inicialização pode ser recuperada na próxima tentativa', async () => {
  const h = harness({ initError: new Error('initialization failed') });
  await assert.rejects(h.run(), /initialization/);
  assert.equal(await h.run(), 'ok');
  assert.equal(h.calls.init, 2);
});

test('validação App Check pendente encerra com erro em vez de aguardar para sempre', async () => {
  const h = harness({ tokenPending: true });
  const pending = h.run();
  const rejected = assert.rejects(pending, error => error.code === 'rg-ai/request-timeout' && /35 segundos/.test(h.friendly(error)));
  h.expire(35000);
  await rejected;
  assert.deepEqual(h.calls.models, []);
  assert.equal(h.calls.timers.size, 0);
});

test('geração pendente é abortada e não dispara chamadas extras', async () => {
  const h = harness({ modelPending: true });
  const pending = h.run();
  const rejected = assert.rejects(pending, error => error.code === 'rg-ai/request-timeout');
  // Deixa a validação de token e seus finally terminarem.
  for (let i = 0; i < 10; i++) await Promise.resolve();
  h.expire(35000);
  await rejected;
  assert.equal(h.calls.signals[0].aborted, true);
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash']);
  assert.equal(h.calls.timers.size, 0);
});

test('resposta vazia é um erro visível, sem repetir requisições', async () => {
  const h = harness({ emptyResponse: true });
  await assert.rejects(h.run(), /resposta vazia/);
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash']);
});

test('bloqueio 403 do App Check conserva o motivo e não tenta outros modelos', async () => {
  const message = 'AppCheck: Requests throttled due to previous 403 error. Attempts allowed again after 23h:59m:22s (appCheck/throttled).';
  const h = harness({ tokenError: new Error(message) });
  await assert.rejects(h.run(), /403/);
  assert.deepEqual(h.calls.events, ['token']);
  assert.deepEqual(h.calls.models, []);
  assert.match(h.friendly(message), /23h:59m:22s/);
  assert.ok(!h.friendly(message).includes('localhost'));
});

test('todas as gerações compartilham trava, liberada ao encerrar a tentativa', async () => {
  const h = harness({ modelPending: true });
  const pending = h.run();
  const rejected = assert.rejects(pending, error => error.code === 'rg-ai/request-timeout');
  await assert.rejects(h.run(), error => error.code === 'rg-ai/busy');
  assert.equal(h.calls.models.length, 1);
  h.expire(35000);
  await rejected;
  const next = h.run();
  const nextRejected = assert.rejects(next, error => error.code === 'rg-ai/request-timeout');
  assert.equal(h.calls.models.length, 2);
  h.expire(35000);
  await nextRejected;
});

test('timeout abortado pelo SDK permite tentar Flash-Lite', async () => {
  const error = new Error('Timeout has expired.');
  error.name = 'AbortError';
  const h = harness({ failures: { 'gemini-3.8-flash': error } });
  assert.equal(await h.run(), 'ok');
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash', 'gemini-3.5-flash-lite']);
  assert.match(h.friendly(error), /excedeu o tempo/);
});

test('comentários bloqueiam cliques duplicados e saem do carregamento após erro', async () => {
  const elements = Object.fromEntries(['ai-comments-list', 'ai-comments-status', 'ai-comments-generate', 'ai-comments-publish']
    .map(id => [id, { innerHTML: '', textContent: '', disabled: false }]));
  let rejectRequest;
  let requests = 0;
  const context = vm.createContext({
    window: {}, state: { posts: [{ id: 'p1', handle: 'ana' }] },
    document: { getElementById: id => elements[id] || null },
    showToast: () => {}, console: { error() {} }
  });
  loadFullSource(context);
  context.window.__rgAiCommentsPostId = 'p1';
  context.generateAiCommentDrafts = async (_post, _count, _tone, _mode, progress) => {
    requests++;
    progress('Validando acesso à IA…');
    return new Promise((_, reject) => { rejectRequest = reject; });
  };
  const pending = context.runAiCommentsGenerate();
  await context.runAiCommentsGenerate();
  assert.equal(requests, 1);
  assert.equal(elements['ai-comments-generate'].disabled, true);
  assert.equal(elements['ai-comments-publish'].disabled, true);
  assert.match(elements['ai-comments-list'].innerHTML, /Validando acesso/);
  rejectRequest(new Error('Falha simulada'));
  await pending;
  assert.equal(elements['ai-comments-generate'].disabled, false);
  assert.equal(elements['ai-comments-publish'].disabled, false);
  assert.match(elements['ai-comments-list'].innerHTML, /Falha simulada/);
  assert.ok(!elements['ai-comments-list'].innerHTML.includes('aic-spinner'));
});

function loadFullSource(context) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/features/firebase-ai.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, ''), context);
}

test('rascunhos manuais sobrevivem a uma resposta pendente de IA e não fazem chamada nova', async () => {
  const elements = Object.fromEntries(['ai-comments-list', 'ai-comments-status', 'ai-comments-generate', 'ai-comments-publish']
    .map(id => [id, { innerHTML: '', textContent: '', disabled: false }]));
  let finish;
  const context = vm.createContext({ window: {}, state: { posts: [{ id: 'p1' }] },
    document: { getElementById: id => elements[id] || null }, console, isUserAdmin: () => true });
  loadFullSource(context);
  context.window.__rgAiCommentsPostId = 'p1';
  context.window.__rgAiComments = [];
  context.generateAiCommentDrafts = () => new Promise(resolve => { finish = resolve; });
  const pending = context.runAiCommentsGenerate();
  context.addManualCommentDrafts(3);
  assert.equal(context.window.__rgAiComments.length, 3);
  assert.ok(context.window.__rgAiComments.every(d => d.manual && !d.text && !d.handle));
  finish([{ text: 'resposta atrasada' }]);
  await pending;
  assert.equal(context.window.__rgAiComments.length, 3);
  assert.match(elements['ai-comments-list'].innerHTML, /Escrito por você/);
  assert.equal(elements['ai-comments-publish'].disabled, false);
});

test('publicação manual grava só comentários sem criar contas ou perfis e exige handle', async () => {
  const writes = [];
  const context = vm.createContext({ window: {}, state: { posts: [{ id: 'p1', uid: 'npc_post' }] },
    document: { getElementById: () => null }, console, showToast() {},
    db: { ref: path => ({ push: async value => { writes.push({ path, value }); },
      once: async () => ({ exists: () => true, val: () => ({ c1: {} }) }), set: async () => {} }) } });
  loadFullSource(context);
  context.window.__rgAiCommentsPostId = 'p1';
  context.window.__rgAiComments = [{ keep: true, manual: true, handle: '', text: 'Texto meu', name: 'Pessoa' }];
  await context.publishAiComments();
  assert.equal(writes.length, 0);
  context.window.__rgAiComments[0].handle = '@vizinho';
  await context.publishAiComments();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, 'posts/p1/comments');
  assert.equal(writes[0].value.uid, 'npc_vizinho');
  assert.equal(writes[0].value.ai, false);
  assert.equal(writes[0].value.text, 'Texto meu');
});

test('comentários usam Flash-Lite e pedem JSON, sem depender primeiro do 3.8', async () => {
  const context = vm.createContext({ window: {}, state: {}, document: { getElementById: () => null } });
  loadFullSource(context);
  let requestedModel;
  let requestedConfig;
  context.jetStyleGenerate = async (_prompt, model, _progress, config) => {
    requestedModel = model;
    requestedConfig = config;
    return '[{"handle":"torcedor","name":"Torcedor","text":"Bora pro título!"}]';
  };
  const drafts = await context.generateAiCommentDrafts({ handle: 'asgard', caption: 'Novo time' }, 1, '', 'random');
  assert.equal(requestedModel, 'gemini-3.5-flash-lite');
  assert.equal(requestedConfig.responseMimeType, 'application/json');
  assert.equal(drafts[0].text, 'Bora pro título!');
});
