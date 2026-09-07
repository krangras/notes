(() => {
  const copyButtons = document.querySelectorAll('[data-copy-ticket]');

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }

  copyButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const ticket = button.closest('[data-ticket]');
      const source = ticket?.querySelector('[data-ticket-source]')?.value ?? '';
      if (!source) return;

      const oldText = button.textContent;
      try {
        await copyText(source);
        button.textContent = 'Скопировано';
        button.classList.add('is-copied');
      } catch {
        button.textContent = 'Не удалось';
      }
      window.setTimeout(() => {
        button.textContent = oldText;
        button.classList.remove('is-copied');
      }, 1400);
    });
  });

  const search = document.querySelector('[data-catalog-search]');
  if (search) {
    const cards = [...document.querySelectorAll('[data-doc-card]')];
    const groups = [...document.querySelectorAll('[data-doc-group]')];

    search.addEventListener('input', () => {
      const value = search.value.trim().toLocaleLowerCase('ru');
      cards.forEach((card) => {
        const haystack = card.textContent.toLocaleLowerCase('ru');
        card.hidden = value !== '' && !haystack.includes(value);
      });
      groups.forEach((group) => {
        const hasVisible = [...group.querySelectorAll('[data-doc-card]')].some((card) => !card.hidden);
        group.hidden = !hasVisible;
      });
    });
  }

  const progress = document.querySelector('[data-reading-progress]');
  if (progress) {
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
      progress.style.transform = `scaleX(${ratio})`;
    };
    update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
  }

  const navLinks = [...document.querySelectorAll('.toc-link')];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      navLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`));
    }, { rootMargin: '-15% 0px -72% 0px' });
    sections.forEach((section) => observer.observe(section));
  }
})();
