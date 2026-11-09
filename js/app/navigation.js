let navigationReady = false;
let restoringNavigation = false;
let navigationBackPending = false;
const navigationViews = ['feed', 'profile', 'admin', 'notifications', 'dms'];

function currentNavigationRoute() {
  return {
    view: state.currentView,
    profileHandle: state.viewProfileHandle || null,
    profileTab: state.profileTab || 'posts',
    feedFilter: state.feedFilter || 'all',
    feedTag: state.feedTag || null,
    dmId: state.activeDmId || null,
    postId: state.activePost || null,
    overlay: state.navigationOverlay || null
  };
}

function navigationHash(route) {
  if (route.overlay) return '#' + route.overlay;
  if (route.postId) return '#post/' + encodeURIComponent(route.postId);
  if (route.view === 'profile') return '#profile/' + encodeURIComponent(route.profileHandle || '');
  if (route.view === 'feed' && route.feedFilter === 'tag' && route.feedTag) return '#tag/' + encodeURIComponent(route.feedTag);
  if (route.view === 'feed' && route.feedFilter === 'following') return '#following';
  return '#' + route.view;
}

function routeFromHash() {
  const route = { view: 'feed', profileHandle: null, profileTab: 'posts', feedFilter: 'all', feedTag: null, dmId: null, postId: null, overlay: null };
  const hash = location.hash || '';
  const post = hash.match(/^#post\/([A-Za-z0-9_-]+)$/);
  const profile = hash.match(/^#profile\/([a-zA-Z0-9_]{1,24})$/);
  const tag = hash.match(/^#tag\/([a-zA-Z0-9_]{1,32})$/);
  if (post) route.postId = post[1];
  else if (profile) { route.view = 'profile'; route.profileHandle = normalizeHandle(profile[1]); }
  else if (tag) { route.feedFilter = 'tag'; route.feedTag = tag[1].toLowerCase(); }
  else if (hash === '#following') route.feedFilter = 'following';
  else if (hash === '#search' || hash === '#compose') route.overlay = hash.slice(1);
  else if (navigationViews.includes(hash.slice(1))) route.view = hash.slice(1);
  return route;
}

function saveNavigationScroll() {
  if (!navigationReady || restoringNavigation || !history.state?.rgNavigation) return;
  history.replaceState({ ...history.state, scrollY: window.scrollY || 0 }, '', location.href);
}

function recordNavigation() {
  if (!navigationReady || restoringNavigation) return;
  const route = currentNavigationRoute();
  const previous = history.state;
  if (previous?.rgNavigation && JSON.stringify(previous.route) === JSON.stringify(route)) return;
  history.pushState({ rgNavigation: true, route, depth: (previous?.depth || 0) + 1, scrollY: 0 }, '', navigationHash(route));
}

function goBackInApp() {
  if (!navigationReady || !history.state?.rgNavigation || history.state.depth < 1) return false;
  if (!navigationBackPending) {
    navigationBackPending = true;
    history.back();
  }
  return true;
}

function restoreNavigation(entry) {
  restoringNavigation = true;
  try {
    const route = entry.route;
    // Overlays belong to the screen being left, not to the restored screen.
    if (typeof closeAiCommentsModal === 'function') closeAiCommentsModal();
    if (typeof closeCompose === 'function') closeCompose();
    document.querySelectorAll('.modal.open, .ig-dialog-backdrop.open').forEach(el => el.classList.remove('open'));
    state.viewProfileHandle = route.profileHandle;
    state.profileTab = route.profileTab;
    state.feedFilter = route.feedFilter;
    state.feedTag = route.feedTag;
    state.activeDmId = route.dmId;
    showView(navigationViews.includes(route.view) ? route.view : 'feed');
    if (route.postId) openPostModal(route.postId, false);
    if (route.overlay === 'search') openSearch();
    if (route.overlay === 'compose') openCompose();
    requestAnimationFrame(() => window.scrollTo(0, entry.scrollY || 0));
  } finally {
    restoringNavigation = false;
    navigationBackPending = false;
  }
}

function initializeNavigation() {
  const saved = history.state;
  const route = saved?.rgNavigation && navigationHash(saved.route) === location.hash ? saved.route : routeFromHash();
  if (saved?.rgNavigation) {
    const entry = { ...saved, route };
    history.replaceState(entry, '', navigationHash(route));
    navigationReady = true;
    restoreNavigation(entry);
    return;
  }
  // A direct post/profile link gets a feed entry underneath it.
  const base = { ...route, view: 'feed', profileHandle: null, profileTab: 'posts', feedFilter: 'all', feedTag: null, dmId: null, postId: null, overlay: null };
  history.replaceState({ rgNavigation: true, route: base, depth: 0, scrollY: 0 }, '', '#feed');
  navigationReady = true;
  restoreNavigation({ route: base, scrollY: 0 });
  if (JSON.stringify(route) !== JSON.stringify(base)) {
    restoreNavigation({ route, scrollY: 0 });
    recordNavigation();
  }
}

window.addEventListener('popstate', event => {
  if (!navigationReady || !state.user) return;
  const entry = event.state?.rgNavigation ? event.state : { rgNavigation: true, route: routeFromHash(), depth: 0, scrollY: 0 };
  if (!event.state?.rgNavigation) history.replaceState(entry, '', navigationHash(entry.route));
  restoreNavigation(entry);
});

function showView(view) {
  saveNavigationScroll();
  if (state.activePost) closePostModal(false);
  closeSearch(false);
  closeCompose(false);
  state.currentView = view;
  if (view === 'profile' && !state.viewProfileHandle && state.profile?.handle) {
    state.viewProfileHandle = state.profile.handle;
  }
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view)?.classList.remove('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('.side-link[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  if (view === 'feed') renderFeed();
  if (view === 'profile') {
    renderProfile();
    const h = state.viewProfileHandle || state.profile?.handle;
    if (h && typeof loadProfilePosts === 'function') {
      const need = !state.profilePosts || state.profilePosts.handle !== normalizeHandle(h);
      if (need) loadProfilePosts(h, true).catch(() => {});
    }
  }
  if (view === 'admin') renderAdmin();
  if (view === 'notifications') renderNotifications();
  if (view === 'dms') renderDMs();
  if (typeof renderRightRail === 'function') renderRightRail();
  recordNavigation();
}

function goMyProfile() {
  state.viewProfileHandle = state.profile?.handle || null;
  state.profileTab = 'posts';
  showView('profile');
}
