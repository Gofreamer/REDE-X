/* Rede X — Start */

auth.onAuthStateChanged((user) => {
  if (user) {
    state.user = user;
    showApp();
    listenProfile(user.uid);
    listenPosts();
    listenProfiles();
    showView('home');
  } else {
    state.user = null;
    state.profile = null;
    state.posts = [];
    showAuthScreen();
  }
});
