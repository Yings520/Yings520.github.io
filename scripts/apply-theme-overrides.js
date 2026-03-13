const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const overrides = [
  {
    source: path.join(rootDir, 'theme-overrides', 'post-next-prev.ejs'),
    target: path.join(
      rootDir,
      'node_modules',
      'hexo-theme-async',
      'layout',
      '_partial',
      'post',
      'post-next-prev.ejs'
    )
  },
  {
    source: path.join(rootDir, 'theme-overrides', 'post-info.ejs'),
    target: path.join(
      rootDir,
      'node_modules',
      'hexo-theme-async',
      'layout',
      '_partial',
      'post',
      'post-info.ejs'
    )
  },
  {
    source: path.join(rootDir, 'theme-overrides', 'sidebar-index.ejs'),
    target: path.join(
      rootDir,
      'node_modules',
      'hexo-theme-async',
      'layout',
      '_partial',
      'sidebar',
      'index.ejs'
    )
  },
  {
    source: path.join(rootDir, 'theme-overrides', 'sidebar-user.ejs'),
    target: path.join(
      rootDir,
      'node_modules',
      'hexo-theme-async',
      'layout',
      '_partial',
      'sidebar',
      'card',
      'user.ejs'
    )
  },
  {
    source: path.join(rootDir, 'theme-overrides', 'sidebar-info.ejs'),
    target: path.join(
      rootDir,
      'node_modules',
      'hexo-theme-async',
      'layout',
      '_partial',
      'sidebar',
      'card',
      'info.ejs'
    )
  },
  {
    source: path.join(rootDir, 'theme-overrides', 'sidebar-social.ejs'),
    target: path.join(
      rootDir,
      'node_modules',
      'hexo-theme-async',
      'layout',
      '_partial',
      'sidebar',
      'card',
      'social.ejs'
    )
  },
  {
    source: path.join(rootDir, 'theme-overrides', 'sidebar-email.ejs'),
    target: path.join(
      rootDir,
      'node_modules',
      'hexo-theme-async',
      'layout',
      '_partial',
      'sidebar',
      'card',
      'email.ejs'
    )
  }
];

for (const { source, target } of overrides) {
  if (!fs.existsSync(source)) {
    throw new Error(`Override source not found: ${source}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`Applied theme override: ${path.relative(rootDir, target)}`);
}
