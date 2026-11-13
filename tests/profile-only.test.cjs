const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(context, file) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
}

test('publicação salva a escolha e mantém o índice do perfil, para player e NPC', async () => {
  const written = [];
  const indexed = [];
  const context = vm.createContext({
    state: { user: { uid: 'u1' }, profile: { handle: 'ana', name: 'Ana' }, npcProfiles: {} },
    db: { ref: p => {
      assert.equal(p, 'posts');
      return { push: async post => { written.push(post); return { key: 'p' + written.length }; } };
    } },
    isUserAdmin: () => true,
    normalizeHandle: h => h.replace(/^@/, ''),
    indexPostByAuthor: async (id, post) => indexed.push([id, post.uid]),
    notifyMentions: async () => {},
    showToast: () => {}, console
  });
  load(context, 'js/services/database.js');
  // Substitui apenas o acesso ao índice pelo registro de chamadas acima.
  context.indexPostByAuthor = async (id, post) => indexed.push([id, post.uid]);
  for (const opts of [{}, { profileOnly: false }, { profileOnly: true }, { profileOnly: true, asHandle: '@nina' }]) {
    assert.equal(await context.createPost({ image: 'https://example.com/photo.jpg', ...opts }), true);
  }
  assert.deepEqual(written.map(p => p.profileOnly), [false, false, true, true]);
  assert.deepEqual(indexed, [['p1', 'u1'], ['p2', 'u1'], ['p3', 'u1'], ['p4', 'npc_nina']]);
});

for (const admin of [false, true]) {
  for (const filter of ['all', 'following', 'tag']) {
    test(`só no perfil fica fora do feed ${filter}, admin=${admin}, e continua no perfil`, () => {
      const el = { innerHTML: '' };
      const context = vm.createContext({
        state: {
          postsLoaded: true, feedFilter: filter, feedTag: 'cidade',
          profile: { handle: 'ana' },
          posts: [
            { id: 'old', handle: 'ana', caption: '#cidade' },
            { id: 'normal', handle: 'ana', caption: '#cidade', profileOnly: false },
            { id: 'profile', handle: 'ana', caption: '#cidade', profileOnly: true, pinned: true },
            { id: 'future', handle: 'ana', publishAt: Date.now() + 60000, caption: '#cidade' }
          ],
          siteSettings: { session: { postId: 'profile' } }
        },
        document: { getElementById: () => el }, renderStories: () => {},
        isUserAdmin: () => admin, isFollowing: () => true,
        normalizeHandle: h => h, escapeHTML: h => h
      });
      load(context, 'js/features/feed.js');
      load(context, 'js/features/search.js');
      load(context, 'js/services/database.js');
      context.renderPostCard = p => `<article>${p.id}</article>`;
      context.renderStories = () => {};
      context.renderRightRail = () => {};
      context.renderFeed();
      assert.ok(el.innerHTML.includes('<article>old</article>'));
      assert.ok(el.innerHTML.includes('<article>normal</article>'));
      assert.ok(!el.innerHTML.includes('<article>profile</article>'));
      assert.equal(el.innerHTML.includes('<article>future</article>'), admin);
      assert.ok(context.postsForHandle('ana').some(p => p.id === 'profile'));
      assert.equal(context.isPostVisibleToViewer(context.state.posts[2]), true);
      assert.equal(context.state.posts.length, 4);
    });
  }
}

test('formulário transmite a caixinha e só a limpa depois de publicar com sucesso', async () => {
  const fields = {
    'compose-image': { value: 'https://example.com/photo.jpg' },
    'compose-caption': { value: 'Foto' },
    'compose-profile-only': { checked: true }
  };
  let succeed = false;
  const submitted = [];
  const form = { reset: () => { fields['compose-profile-only'].checked = false; } };
  const context = vm.createContext({
    state: {}, document: { getElementById: id => fields[id] || (id === 'compose-form' ? form : null) },
    createPost: async opts => { submitted.push(opts); return succeed; },
    isUserAdmin: () => false, showToast: () => {}
  });
  load(context, 'js/features/compose.js');
  const event = { preventDefault() {}, target: {} };
  await context.submitCompose(event);
  assert.equal(fields['compose-profile-only'].checked, true);
  succeed = true;
  await context.submitCompose(event);
  assert.equal(fields['compose-profile-only'].checked, false);
  await context.submitCompose(event);
  assert.deepEqual(submitted.map(p => p.profileOnly), [true, true, false]);
});
