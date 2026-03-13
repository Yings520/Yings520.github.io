'use strict';

const { stripHTML } = require('hexo-util');

function toArray(collection) {
  if (!collection) return [];
  if (typeof collection.toArray === 'function') return collection.toArray();
  if (Array.isArray(collection)) return collection;
  return [];
}

function normalizeText(value) {
  return stripHTML(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildEntries(locals) {
  const posts = toArray(locals.posts).filter(post => post && post.published !== false);
  const pages = toArray(locals.pages).filter(
    page =>
      page &&
      page.published !== false &&
      page.layout &&
      page.layout !== '404'
  );
  const docs = [...posts, ...pages];

  return docs
    .map(doc => {
      const path = String(doc.path || '').replace(/^\/+/, '');
      if (!path) return null;
      if (/\.(js|css|json|xml|png|jpe?g|gif|svg|ico|woff2?)$/i.test(path)) return null;

      const title = normalizeText(doc.title || '');
      const content = normalizeText(doc.content || doc._content || doc.excerpt || '').slice(0, 4000);
      if (!path || (!title && !content)) return null;

      return {
        title,
        content,
        url: `/${path}`
      };
    })
    .filter(Boolean);
}

hexo.extend.generator.register('local-search-index', function localSearchIndexGenerator(locals) {
  const rawPath = String((hexo.config.search && hexo.config.search.path) || 'search.json').replace(/^\/+/, '');
  const entries = buildEntries(locals);
  const isXml = rawPath.endsWith('.xml');

  if (isXml) {
    const body = entries
      .map(item => [
        '  <entry>',
        `    <title>${xmlEscape(item.title)}</title>`,
        `    <url>${xmlEscape(item.url)}</url>`,
        `    <content>${xmlEscape(item.content)}</content>`,
        '  </entry>'
      ].join('\n'))
      .join('\n');

    return {
      path: rawPath,
      data: `<?xml version="1.0" encoding="utf-8"?>\n<searchdata>\n${body}\n</searchdata>\n`
    };
  }

  return {
    path: rawPath,
    data: JSON.stringify(entries)
  };
});
