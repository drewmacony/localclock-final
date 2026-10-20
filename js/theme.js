/* Theme: 'light' | 'dark' | 'system' */
const Theme = (() => {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  let mode = 'system';
  function apply(m) {
    if (m) mode = m;
    document.documentElement.dataset.theme = mode === 'system' ? (mq.matches ? 'dark' : 'light') : mode;
  }
  mq.addEventListener('change', () => apply());
  return { apply };
})();
