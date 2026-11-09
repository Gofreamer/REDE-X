const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(hash = '') {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { innerHTML: '', value: '', focus() {}, classList: {
        add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c),
        toggle: (c, on) => on ? classes.add(c) : classes.delete(c)
      } });
    }
    return elements.get(id);
  }
  const listeners = {};
  const location = { hash, href: 'https://example.com/' + hash };
  const entries = [{ state: null, url: location.href }];
  let index = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const updateLocation = url => { location.href = new URL(url, location.href).href; location.hash = new URL(location.href).hash; };
  const history = {
    get state() { return clone(entries[index].state); },
    pushState(value, _title, url) { entries.splice(index + 1); entries.push({ state: clone(value), url }); index++; updateLocation(url); },
    replaceState(value, _title, url) { entries[index] = { state: clone(value), url }; updateLocation(url); },
    back() { if (index > 0) { index--; updateLocation(entries[index].url); listeners.popstate({ state: history.state }); } },
    forward() { if (index < entries.length - 1) { index++; updateLocation(entries[index].url); listeners.popstate({ state: history.state }); } }
  };
  const state = {
    user: { uid: 'u1' }, profile: { handle: 'me' }, posts: [{ id: 'p1' }, { id: 'p2' }],
    currentView: 'feed', profileTab: 'posts', feedFilter: 'all', profilePosts: { handle: null }
  };
  const context = vm.createContext({
    state, location, history, URL,
    document: { getElementById: element, querySelectorAll: () => [], body: element('body') },
    window: { scrollY: 0, addEventListener: (name, fn) => { listeners[name] = fn; }, scrollTo: (_x, y) => { context.window.scrollY = y; } },
    requestAnimationFrame: fn => fn(), setTimeout: fn => fn(),
    normalizeHandle: h => String(h || '').toLowerCase(), isUserAdmin: () => true,
    loadProfilePosts: async handle => { state.profilePosts = { handle }; },
    getPostFromMemory: id => state.posts.find(p => p.id === id)
  });
  for (const file of ['js/features/feed.js', 'js/features/search.js', 'js/features/compose.js', 'js/features/profile.js', 'js/features/dms.js', 'js/app/navigation.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  for (const name of ['renderFeed', 'renderProfile', 'renderAdmin', 'renderNotifications', 'renderDMs', 'renderRightRail', 'renderSearchResults', 'renderPostModal']) context[name] = () => {};
  return { context, state, history, entries, element, location };
}

test('Voltar e Avançar percorrem perfis, mantendo a posição anterior do feed', () => {
  const h = harness();
  h.context.initializeNavigation();
  h.context.window.scrollY = 600;
  h.context.openProfile('ana');
  h.context.openProfile('bia');
  h.history.back();
  assert.equal(h.state.viewProfileHandle, 'ana');
  h.history.back();
  assert.equal(h.state.currentView, 'feed');
  assert.equal(h.context.window.scrollY, 600);
  h.history.forward();
  assert.equal(h.state.currentView, 'profile');
  assert.equal(h.state.viewProfileHandle, 'ana');
  assert.equal(h.entries.length, 3);
});

test('publicação cria entrada própria e fechar retorna ao perfil de origem', async () => {
  const h = harness();
  h.context.initializeNavigation();
  h.context.openProfile('ana');
  await h.context.openPostModal('p1');
  assert.equal(h.location.hash, '#post/p1');
  h.context.closePostModal();
  assert.equal(h.state.currentView, 'profile');
  assert.equal(h.state.viewProfileHandle, 'ana');
  assert.equal(h.state.activePost, null);
  assert.equal(h.element('post-modal').classList.contains('open'), false);
  h.history.forward();
  assert.equal(h.state.activePost, 'p1');
  assert.equal(h.element('post-modal').classList.contains('open'), true);
});

test('perfil aberto de dentro de um post volta ao post com seu contexto', async () => {
  const h = harness();
  h.context.initializeNavigation();
  await h.context.openPostModal('p1');
  h.context.openProfile('ana');
  assert.equal(h.state.activePost, null);
  h.history.back();
  assert.equal(h.state.currentView, 'feed');
  assert.equal(h.state.activePost, 'p1');
});

test('link direto abre post fora do feed e Voltar leva ao feed', () => {
  const h = harness('#post/older-post');
  h.context.fetchPostById = async id => ({ id });
  h.context.initializeNavigation();
  assert.equal(h.state.activePost, 'older-post');
  assert.equal(h.entries.length, 2);
  h.history.back();
  assert.equal(h.state.activePost, null);
  assert.equal(h.location.hash, '#feed');
});

test('recarregar a rota não duplica entradas e mantém o perfil sob o post', async () => {
  const h = harness();
  h.context.initializeNavigation();
  h.context.openProfile('ana');
  await h.context.openPostModal('p1');
  h.context.initializeNavigation();
  assert.equal(h.entries.length, 3);
  assert.equal(h.state.viewProfileHandle, 'ana');
  h.history.back();
  assert.equal(h.state.currentView, 'profile');
  assert.equal(h.state.activePost, null);
});

test('busca e criação fecham com Voltar e não duplicam a tela atual', () => {
  const h = harness();
  h.context.initializeNavigation();
  h.context.showView('feed');
  assert.equal(h.entries.length, 1);
  h.context.openSearch();
  h.context.openProfile('ana');
  h.history.back();
  assert.equal(h.state.navigationOverlay, 'search');
  assert.equal(h.element('search-modal').classList.contains('open'), true);
  h.context.closeSearch();
  assert.equal(h.state.navigationOverlay, null);
  h.context.openCompose();
  h.history.back();
  assert.equal(h.state.composeOpen, false);
  h.history.forward();
  assert.equal(h.state.composeOpen, true);
});

test('filtros, aba de salvos e conversa restauram sua seleção', () => {
  const h = harness();
  h.context.initializeNavigation();
  h.context.setFeedFilter('following');
  h.context.goMyProfile();
  h.context.setProfileTab('saved');
  h.context.showView('dms');
  h.context.selectDm('thread1');
  h.context.closeDm();
  assert.equal(h.state.activeDmId, null);
  h.history.back();
  assert.equal(h.state.currentView, 'profile');
  assert.equal(h.state.profileTab, 'saved');
  h.history.back();
  h.history.back();
  assert.equal(h.state.currentView, 'feed');
  assert.equal(h.state.feedFilter, 'following');
});
