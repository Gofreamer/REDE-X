auth.onAuthStateChanged(user => {
  if (user) {
    state.user = user;
    showAppShell();
    listenProfile(user.uid);
    listenPosts();
    listenProfiles();
    listenStories();
    listenNpcProfiles();
    showView('feed');
  } else {
    state.user = null;
    state.profile = null;
    state.posts = [];
    state.stories = [];
    showAuth();
  }
});
