(() => {
  const CLEANUP_KEY = '__ASYNC_LOCAL_SEARCH_CLEANUP__';
  const SEARCH_STATE = {
    fetched: false,
    entries: [],
    fetchPromise: null
  };

  const toText = value => String(value || '');

  const escapeHtml = value =>
    toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const escapeRegExp = value => toText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const normalizeUrl = (root, path) => {
    if (/^https?:\/\//i.test(toText(path))) return toText(path);
    const normalizedRoot = toText(root || '/').replace(/\/+$/, '');
    const normalizedPath = toText(path).replace(/^\/+/, '');
    return `${normalizedRoot}/${normalizedPath}`.replace(/\/{2,}/g, '/');
  };

  const parseXmlEntries = xmlText => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const entries = Array.from(xmlDoc.querySelectorAll('entry'));
    return entries.map(entry => ({
      title: toText(entry.querySelector('title')?.textContent),
      content: toText(entry.querySelector('content')?.textContent),
      url: toText(entry.querySelector('url')?.textContent)
    }));
  };

  const normalizeEntries = rows =>
    rows
      .map(row => {
        const rawUrl = toText(row.url || row.path).trim();
        const url = rawUrl.startsWith('/') || /^https?:\/\//i.test(rawUrl) ? rawUrl : `/${rawUrl}`;
        const title = toText(row.title).trim();
        const content = toText(row.content).replace(/\s+/g, ' ').trim();
        if (!url || (!title && !content)) return null;
        return {
          title,
          content,
          url,
          _titleLower: title.toLowerCase(),
          _contentLower: content.toLowerCase()
        };
      })
      .filter(Boolean);

  const ensureIndex = async () => {
    if (SEARCH_STATE.fetched) return SEARCH_STATE.entries;
    if (SEARCH_STATE.fetchPromise) return SEARCH_STATE.fetchPromise;

    const config = window.ASYNC_CONFIG || {};
    const searchConfig = config.search || {};
    const path = searchConfig.path;
    if (!path) {
      console.warn('Search index path is missing. Set `search.path` in _config.yml.');
      SEARCH_STATE.fetched = true;
      return [];
    }

    const indexUrl = normalizeUrl(config.root, path);
    const parseAsJson = /\.json($|\?)/i.test(path);

    SEARCH_STATE.fetchPromise = fetch(indexUrl, { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) throw new Error(`Failed to fetch ${indexUrl}: ${response.status}`);
        if (parseAsJson) return response.json();
        return response.text();
      })
      .then(payload => {
        const rows = parseAsJson
          ? (Array.isArray(payload) ? payload : Array.isArray(payload.posts) ? payload.posts : [])
          : parseXmlEntries(payload);
        SEARCH_STATE.entries = normalizeEntries(rows);
        SEARCH_STATE.fetched = true;
        return SEARCH_STATE.entries;
      })
      .catch(error => {
        console.error('[search] Index load failed:', error);
        SEARCH_STATE.entries = [];
        SEARCH_STATE.fetched = true;
        return [];
      })
      .finally(() => {
        SEARCH_STATE.fetchPromise = null;
      });

    return SEARCH_STATE.fetchPromise;
  };

  const buildSnippet = (content, tokens) => {
    if (!content) return '';
    const lower = content.toLowerCase();
    let start = 0;
    for (const token of tokens) {
      const idx = lower.indexOf(token);
      if (idx >= 0) {
        start = Math.max(0, idx - 30);
        break;
      }
    }
    const length = 150;
    const end = Math.min(content.length, start + length);
    let snippet = content.slice(start, end);
    if (start > 0) snippet = `...${snippet}`;
    if (end < content.length) snippet = `${snippet}...`;
    return snippet;
  };

  const markTokens = (text, tokens) => {
    let html = escapeHtml(text);
    for (const token of tokens) {
      if (!token) continue;
      const pattern = new RegExp(`(${escapeRegExp(escapeHtml(token))})`, 'ig');
      html = html.replace(pattern, '<mark>$1</mark>');
    }
    return html;
  };

  const searchEntries = (entries, tokens) =>
    entries
      .map(entry => {
        let hitCount = 0;
        let includedCount = 0;
        for (const token of tokens) {
          const inTitle = entry._titleLower.includes(token);
          const inContent = entry._contentLower.includes(token);
          if (!inTitle && !inContent) return null;
          if (inTitle) {
            includedCount += 1;
            hitCount += 8;
          }
          if (inContent) hitCount += 2;
        }
        return { entry, hitCount, includedCount };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.includedCount !== a.includedCount) return b.includedCount - a.includedCount;
        return b.hitCount - a.hitCount;
      });

  const renderResults = ({ query, tokens, entries, container, stats, i18n, resultPlaceholder }) => {
    if (!query) {
      container.innerHTML = `<div class="trm-search-empty">${escapeHtml(resultPlaceholder || '')}</div>`;
      stats.innerHTML = '';
      return;
    }

    const matched = searchEntries(entries, tokens).slice(0, 50);
    if (!matched.length) {
      const empty = toText(i18n.empty || 'No results').replace(/\$\{query}/g, query);
      container.innerHTML = `<div class="trm-search-empty">${escapeHtml(empty)}</div>`;
      stats.innerHTML = '';
      return;
    }

    const resultHtml = matched
      .map(({ entry }) => {
        const title = markTokens(entry.title || entry.url, tokens);
        const snippet = markTokens(buildSnippet(entry.content, tokens), tokens);
        return [
          '<li>',
          `  <a class="search-result-title" href="${escapeHtml(entry.url)}">${title}</a>`,
          `  <p>${snippet}</p>`,
          '</li>'
        ].join('\n');
      })
      .join('\n');

    container.innerHTML = `<ul class="search-result-list">${resultHtml}</ul>`;
    stats.innerHTML = toText(i18n.hits || '${hits} results').replace(/\$\{hits}/g, matched.length.toString());
  };

  const initSearch = () => {
    const oldCleanup = window[CLEANUP_KEY];
    if (typeof oldCleanup === 'function') oldCleanup();

    const config = window.ASYNC_CONFIG || {};
    const searchConfig = config.search;
    if (!searchConfig) return;

    const popup = document.querySelector('.trm-search-popup');
    const openBtn = document.querySelector('#trm-search-btn');
    const closeBtn = document.querySelector('.trm-search-btn-close');
    const input = document.querySelector('.trm-search-input');
    const resultContainer = document.querySelector('.trm-search-result-container');
    const stats = document.querySelector('.trm-search-stats');
    if (!popup || !openBtn || !closeBtn || !input || !resultContainer || !stats) return;

    const i18n = (config.i18n || {});
    const resultPlaceholder = toText(
      resultContainer.querySelector('.trm-search-empty')?.textContent || 'Please enter keywords to search'
    );
    const doSearch = async () => {
      const query = input.value.trim().toLowerCase();
      const tokens = query.split(/[-\s]+/).filter(Boolean);
      const entries = await ensureIndex();
      renderResults({
        query,
        tokens,
        entries,
        container: resultContainer,
        stats,
        i18n: {
          empty: i18n.empty,
          hits: i18n.hits
        },
        resultPlaceholder
      });
    };

    const closePopup = () => popup.classList.remove('show');
    const openPopup = async () => {
      popup.classList.add('show');
      setTimeout(() => input.focus(), 150);
      await ensureIndex();
    };

    const onOverlayClick = event => {
      if (event.target === popup) closePopup();
    };
    const onEscape = event => {
      if (event.key === 'Escape') {
        closePopup();
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onResultClick = event => {
      const target = event.target.closest('a');
      if (target) closePopup();
    };
    const onInput = () => {
      doSearch();
    };
    const onEnter = event => {
      if (event.key === 'Enter') doSearch();
    };

    openBtn.addEventListener('click', openPopup);
    closeBtn.addEventListener('click', closePopup);
    popup.addEventListener('click', onOverlayClick);
    window.addEventListener('keydown', onEscape);
    resultContainer.addEventListener('click', onResultClick);

    if (searchConfig.trigger === 'auto') input.addEventListener('input', onInput);
    else input.addEventListener('keypress', onEnter);

    if (searchConfig.preload) ensureIndex();

    window[CLEANUP_KEY] = () => {
      openBtn.removeEventListener('click', openPopup);
      closeBtn.removeEventListener('click', closePopup);
      popup.removeEventListener('click', onOverlayClick);
      window.removeEventListener('keydown', onEscape);
      resultContainer.removeEventListener('click', onResultClick);
      input.removeEventListener('input', onInput);
      input.removeEventListener('keypress', onEnter);
    };
  };

  initSearch();
  if (window.ASYNC_CONFIG && window.ASYNC_CONFIG.swup) {
    document.addEventListener('swup:contentReplaced', initSearch);
  }
})();
