// home page: company counts per category come from the database (MarketStore), not sample data.
// Markup: dist/index.html, .industry-list a[data-industry] > .industry-count, [data-category-total].
(() => {
  const S = window.MarketStore;
  if (!S) return;
  const label = n => n + ' კომპანია';
  function render() {
    if (!S.isReady()) return;
    const live = S.isAvailable();
    document.querySelectorAll('.industry-list a[data-industry]').forEach(a => {
      const out = a.querySelector('.industry-count');
      const name = a.dataset.name || a.querySelector('.industry-title')?.textContent || '';
      if (!live) { if (out) out.textContent = ''; a.setAttribute('aria-label', name); return; }
      const n = S.listCompanies({ industry: a.dataset.industry }).length;
      if (out) out.textContent = label(n);
      a.setAttribute('aria-label', name + ' — ' + label(n));
    });
    const total = document.querySelector('[data-category-total]');
    if (total) total.textContent = Object.keys(S.categories).filter(k => k !== 'other').length;
  }
  S.subscribe(render);
  S.ready().then(render);
})();
