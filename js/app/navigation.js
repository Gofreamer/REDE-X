/* Rede X — Navigation */

function showView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + view)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });

  if (view === 'home') renderTimeline();
  if (view === 'profile') renderProfile();
  if (view === 'admin') renderAdmin();
}
