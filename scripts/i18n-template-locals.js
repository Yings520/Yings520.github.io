'use strict';

function getLanguages(config) {
  const source = (config && config.language) || hexo.config.language;
  const langs = Array.isArray(source) ? source : String(source || '').split(',');
  return langs
    .map(item => String(item).trim())
    .filter(item => item && item !== 'default');
}

hexo.extend.filter.register('template_locals', function forceLangForPrefixedRoutes(locals) {
  if (!locals || !locals.page) return locals;
  if (locals.page.lang || locals.page.language) return locals;

  const langs = getLanguages(locals.config);
  const currentPath = String(locals.path || '').replace(/^\/+/, '');
  const matched = langs.find(lang => currentPath === lang || currentPath.startsWith(`${lang}/`));
  if (!matched) return locals;

  locals.page.lang = matched;
  locals.page.language = matched;
  return locals;
}, 5);
