auth.onAuthStateChanged(user => {
  if (user) {
    state.user = user;
    showAppShell();
    listenProfile(user.uid);
    listenPosts();
    listenProfiles();
    listenStories();
    listenNpcProfiles();
    listenHighlights();
    listenSiteSettings();
    listenNotifications(user.uid);
    listenDMs(user.uid);
    listenFollowing(user.uid);
    listenMediaLibrary();
    listenSaves(user.uid);
    showView('feed');
    // Deep link: #post/ID
    handleHashRoute();
  } else {
    state.user = null;
    state.profile = null;
    state.posts = [];
    state.stories = [];
    state.notifications = [];
    state.dmThreads = [];
    state.saves = {};
    showAuth();
  }
});

function handleHashRoute() {
  const m = (location.hash || '').match(/^#post\/([A-Za-z0-9_-]+)/);
  if (m && m[1]) {
    const id = m[1];
    // espera posts carregarem
    const tryOpen = () => {
      if (state.postsLoaded && state.posts.find(p => p.id === id)) {
        openPostModal(id);
        return true;
      }
      return false;
    };
    if (!tryOpen()) {
      let tries = 0;
      const t = setInterval(() => {
        if (tryOpen() || ++tries > 20) clearInterval(t);
      }, 250);
    }
  }
}

window.addEventListener('hashchange', handleHashRoute);
