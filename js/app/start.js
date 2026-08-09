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
    showView('feed');
  } else {
    state.user = null;
    state.profile = null;
    state.posts = [];
    state.stories = [];
    state.notifications = [];
    state.dmThreads = [];
    showAuth();
  }
});
