function showView(view) {
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
  if (view === 'profile') renderProfile();
  if (view === 'admin') renderAdmin();
  if (view === 'notifications') renderNotifications();
  if (view === 'dms') renderDMs();
  if (typeof renderRightRail === 'function') renderRightRail();
}

function goMyProfile() {
  state.viewProfileHandle = state.profile?.handle || null;
  state.profileTab = 'posts';
  showView('profile');
}
