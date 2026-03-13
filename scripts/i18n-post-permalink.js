'use strict';

const basePostPermalinkFilter = require('hexo/dist/plugins/filter/post_permalink');

function getLanguages(config) {
  const langs = Array.isArray(config.language) ? config.language : [config.language];
  return langs.filter(Boolean);
}

function normalizeLang(lang, defaultLang) {
  return (lang || defaultLang || 'en').toString().replace('_', '-');
}

function prefixLanguagePath(path, lang, defaultLang) {
  if (!path || lang === defaultLang) return path;
  if (/^(https?:)?\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === `/${lang}` || normalized.startsWith(`/${lang}/`)) return normalized;
  return `/${lang}${normalized}`;
}

function stripLanguageFileSuffix(path, lang) {
  if (!path) return path;
  const escaped = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return path.replace(new RegExp(`\\.${escaped}(?=\\/|\\.html$|$)`), '');
}

const registered = hexo.extend.filter.list('post_permalink').slice();
for (const fn of registered) {
  hexo.extend.filter.unregister('post_permalink', fn);
}

hexo.extend.filter.register('post_permalink', function i18nPostPermalinkFilter(post) {
  const rawPath = basePostPermalinkFilter.call(this, post);
  const langs = getLanguages(this.config);
  const defaultLang = langs[0] || 'en';
  const lang = normalizeLang(post && (post.lang || post.language), defaultLang);
  return prefixLanguagePath(stripLanguageFileSuffix(rawPath, lang), lang, defaultLang);
});
