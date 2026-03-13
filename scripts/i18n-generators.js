'use strict';

const pagination = require('hexo-pagination');

function getLanguages(config) {
  const langs = Array.isArray(config.language) ? config.language : [config.language];
  return langs.filter(Boolean);
}

function getDefaultLang(config) {
  return getLanguages(config)[0] || 'en';
}

function normalizeLang(lang, defaultLang) {
  return (lang || defaultLang || 'en').toString().replace('_', '-');
}

function toArray(queryLike) {
  if (!queryLike) return [];
  if (typeof queryLike.toArray === 'function') return queryLike.toArray();
  return Array.isArray(queryLike) ? queryLike.slice() : Array.from(queryLike);
}

function filterPostsByLang(queryLike, lang, defaultLang, orderBy) {
  const sorted = queryLike && typeof queryLike.sort === 'function' ? queryLike.sort(orderBy) : queryLike;
  return toArray(sorted).filter(post => normalizeLang(post.lang || post.language, defaultLang) === lang);
}

function pathWithLang(lang, defaultLang, rawPath = '') {
  const segments = [];
  const cleaned = String(rawPath || '').replace(/^\/+|\/+$/g, '');
  if (lang !== defaultLang) segments.push(lang);
  if (cleaned) segments.push(cleaned);
  return segments.length ? `${segments.join('/')}/` : '';
}

function clonePaginationWithLang(basePath, posts, options = {}) {
  if (!posts.length) return [];
  return pagination(basePath, posts, options);
}

hexo.extend.generator.register('index', function i18nIndexGenerator(locals) {
  const config = this.config;
  const { Query } = this.model('Post');
  const languages = getLanguages(config);
  const defaultLang = getDefaultLang(config);
  const orderBy = config.index_generator.order_by;
  const paginationDir = config.index_generator.pagination_dir || config.pagination_dir || 'page';
  const indexPath = config.index_generator.path || '';
  const result = [];

  for (const lang of languages) {
    const posts = filterPostsByLang(locals.posts, normalizeLang(lang, defaultLang), defaultLang, orderBy);
    posts.sort((a, b) => (b.sticky || 0) - (a.sticky || 0));
    const queryPosts = new Query(posts);

    result.push(...clonePaginationWithLang(pathWithLang(lang, defaultLang, indexPath), queryPosts, {
      perPage: config.index_generator.per_page,
      layout: config.index_generator.layout || ['index', 'archive'],
      format: `${paginationDir}/%d/`,
      data: {
        __index: true,
        lang
      }
    }));
  }

  return result;
});

hexo.extend.generator.register('archive', function i18nArchiveGenerator(locals) {
  const { config } = this;
  const { Query } = this.model('Post');
  const languages = getLanguages(config);
  const defaultLang = getDefaultLang(config);
  const perPage = config.archive_generator.per_page;
  const paginationDir = config.pagination_dir || 'page';
  const orderBy = config.archive_generator.order_by || '-date';
  const result = [];

  for (const langRaw of languages) {
    const lang = normalizeLang(langRaw, defaultLang);
    const allPosts = filterPostsByLang(locals.posts, lang, defaultLang, orderBy);
    if (!allPosts.length) continue;

    let archiveDir = pathWithLang(lang, defaultLang, config.archive_dir);
    if (archiveDir[archiveDir.length - 1] !== '/') archiveDir += '/';

    const generate = (genPath, posts, options = {}) => {
      options.archive = true;
      options.lang = lang;
      result.push(...pagination(genPath, posts, {
        perPage,
        layout: ['archive', 'index'],
        format: `${paginationDir}/%d/`,
        data: options
      }));
    };

    generate(archiveDir, new Query(allPosts));

    if (!config.archive_generator.yearly) continue;

    const postsByYear = {};
    for (const post of allPosts) {
      const date = post.date;
      const year = date.year();
      const month = date.month() + 1;

      if (!Object.prototype.hasOwnProperty.call(postsByYear, year)) {
        postsByYear[year] = [[], [], [], [], [], [], [], [], [], [], [], [], []];
      }

      postsByYear[year][0].push(post);
      postsByYear[year][month].push(post);

      if (config.archive_generator.daily) {
        if (!Object.prototype.hasOwnProperty.call(postsByYear[year][month], 'day')) {
          postsByYear[year][month].day = {};
        }
        const day = date.date();
        (postsByYear[year][month].day[day] || (postsByYear[year][month].day[day] = [])).push(post);
      }
    }

    const years = Object.keys(postsByYear);
    for (const yearStr of years) {
      const year = +yearStr;
      const data = postsByYear[year];
      const yearPath = `${archiveDir}${year}/`;
      if (!data[0].length) continue;

      generate(yearPath, new Query(data[0]), { year });

      if (!config.archive_generator.monthly && !config.archive_generator.daily) continue;

      for (let month = 1; month <= 12; month++) {
        const monthData = data[month];
        if (!monthData.length) continue;
        const monthStr = month.toString().padStart(2, '0');

        if (config.archive_generator.monthly) {
          generate(`${yearPath}${monthStr}/`, new Query(monthData), { year, month });
        }

        if (!config.archive_generator.daily) continue;
        for (let day = 1; day <= 31; day++) {
          const dayData = monthData.day && monthData.day[day];
          if (!dayData || !dayData.length) continue;
          const dayStr = day.toString().padStart(2, '0');
          generate(`${yearPath}${monthStr}/${dayStr}/`, new Query(dayData), { year, month, day });
        }
      }
    }
  }

  return result;
});

hexo.extend.generator.register('category', function i18nCategoryGenerator(locals) {
  const config = this.config;
  const { Query } = this.model('Post');
  const languages = getLanguages(config);
  const defaultLang = getDefaultLang(config);
  const perPage = config.category_generator.per_page;
  const paginationDir = config.pagination_dir || 'page';
  const orderBy = config.category_generator.order_by || '-date';

  const result = [];
  const categories = toArray(locals.categories);

  for (const langRaw of languages) {
    const lang = normalizeLang(langRaw, defaultLang);
    for (const category of categories) {
      const posts = filterPostsByLang(category.posts, lang, defaultLang, orderBy);
      if (!posts.length) continue;

      result.push(...pagination(pathWithLang(lang, defaultLang, category.path), new Query(posts), {
        perPage,
        layout: ['category', 'archive', 'index'],
        format: `${paginationDir}/%d/`,
        data: {
          category: category.name,
          lang
        }
      }));
    }
  }

  return result;
});

hexo.extend.generator.register('tag', function i18nTagGenerator(locals) {
  const config = this.config;
  const { Query } = this.model('Post');
  const languages = getLanguages(config);
  const defaultLang = getDefaultLang(config);
  const perPage = config.tag_generator.per_page;
  const paginationDir = config.pagination_dir || 'page';
  const orderBy = config.tag_generator.order_by || '-date';
  const tags = toArray(locals.tags);
  const result = [];

  for (const langRaw of languages) {
    const lang = normalizeLang(langRaw, defaultLang);
    for (const tag of tags) {
      const posts = filterPostsByLang(tag.posts, lang, defaultLang, orderBy);
      if (!posts.length) continue;

      result.push(...pagination(pathWithLang(lang, defaultLang, tag.path), new Query(posts), {
        perPage,
        layout: ['tag', 'archive', 'index'],
        format: `${paginationDir}/%d/`,
        data: {
          tag: tag.name,
          lang
        }
      }));
    }

    if (config.tag_generator.enable_index_page) {
      let tagDir = String(config.tag_dir || 'tags').replace(/^\/+|\/+$/g, '');
      const base = pathWithLang(lang, defaultLang, tagDir);
      const langPosts = new Query(filterPostsByLang(locals.posts, lang, defaultLang, orderBy));
      result.push({
        path: base,
        layout: ['tag-index', 'tag', 'archive', 'index'],
        posts: langPosts,
        data: {
          base,
          total: 1,
          current: 1,
          current_url: base,
          posts: langPosts,
          prev: 0,
          prev_link: '',
          next: 0,
          next_link: '',
          tags,
          lang
        }
      });
    }
  }

  return result;
});
