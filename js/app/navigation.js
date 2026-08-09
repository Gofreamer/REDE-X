function showView(view) {
  state.currentView = view;
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
  renderRightRail();
}
