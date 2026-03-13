'use strict';

function getLanguages(config) {
  const source = (config && config.language) || hexo.config.language;
  const langs = Array.isArray(source) ? source : String(source || '').split(',');
  return langs
    .map(item => String(item).trim())
    .filter(item => item && item !== 'default');
}

hexo.extend.filter.register('after_render:html', function patchHtmlLang(html, data) {
  if (typeof html !== 'string' || !html.includes('<html')) return html;

  const langs = getLanguages(data && data.config);
  let lang = data && data.page && (data.page.lang || data.page.language);

  if (!lang && data && data.path) {
    const path = `/${String(data.path).replace(/^\/+/, '')}`;
    lang = langs.find(item => path === `/${item}` || path.startsWith(`/${item}/`));
  }

  if (!lang) return html;

  return html.replace(/<html\s+lang="[^"]*"/i, `<html lang="${String(lang)}"`);
}, 20);
