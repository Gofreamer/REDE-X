const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness({ failures = {}, tokenError, initError } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../js/features/firebase-ai.js'), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').split('function normalizeHandleLocal')[0];
  const calls = { init: 0, events: [], models: [], options: [] };
  const context = vm.createContext({
    console: { warn() {} },
    initializeApp: () => ({}),
    initializeAppCheck: () => {
      calls.init++;
      if (initError && calls.init === 1) throw initError;
      return {};
    },
    ReCaptchaEnterpriseProvider: function(key) { assert.match(key, /^6L/); },
    getToken: async () => {
      calls.events.push('token');
      if (tokenError) throw tokenError;
      return { token: 'mock' };
    },
    GoogleAIBackend: function() {},
    getAI: (_app, options) => { calls.options.push(options); return {}; },
    getGenerativeModel: (_ai, { model }) => ({ generateContent: async () => {
      calls.events.push('generate');
      calls.models.push(model);
      if (failures[model]) throw new Error(failures[model]);
      return { response: { text: () => 'ok' } };
    } })
  });
  vm.runInContext(source, context);
  return { calls, run: () => vm.runInContext("jetStyleGenerate('prompt')", context),
    friendly: message => context.getFirebaseAIErrorMessage(new Error(message)) };
}

test('usa Gemini 3.8 com token validado e tokens de uso único', async () => {
  const h = harness();
  assert.equal(await h.run(), 'ok');
  assert.equal(await h.run(), 'ok');
  assert.equal(h.calls.init, 1);
  assert.deepEqual(h.calls.events, ['token', 'generate', 'token', 'generate']);
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash', 'gemini-3.8-flash']);
  assert.ok(h.calls.options.every(options => options.useLimitedUseAppCheckTokens === true));
});

for (const message of ['[403] Firebase AI Logic has been deactivated', '[429] quota exceeded', '[401] unauthenticated', 'network failed']) {
  test('não repete chamadas ao receber ' + message, async () => {
    const h = harness({ failures: { 'gemini-3.8-flash': message } });
    await assert.rejects(h.run());
    assert.deepEqual(h.calls.models, ['gemini-3.8-flash']);
  });
}

test('modelo indisponível permite fallback sem duplicar modelos', async () => {
  const h = harness({ failures: { 'gemini-3.8-flash': '[404] model not found', 'gemini-3.6-flash': '[404] model not found' } });
  assert.equal(await h.run(), 'ok');
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
});

test('alta demanda temporária permite usar o modelo alternativo', async () => {
  const h = harness({ failures: { 'gemini-3.8-flash': '[500] This model is currently experiencing high demand' } });
  assert.equal(await h.run(), 'ok');
  assert.deepEqual(h.calls.models, ['gemini-3.8-flash', 'gemini-3.6-flash']);
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
