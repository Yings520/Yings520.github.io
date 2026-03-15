import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

const MERMAID_FENCE_PATTERNS = [
  /^flowchart\b/i,
  /^graph\b/i,
  /^sequenceDiagram\b/i,
  /^classDiagram\b/i,
  /^stateDiagram(?:-v2)?\b/i,
  /^erDiagram\b/i,
  /^journey\b/i,
  /^gantt\b/i,
  /^pie\b/i,
  /^mindmap\b/i,
  /^timeline\b/i,
  /^gitGraph\b/i,
  /^C4Context\b/i,
  /^C4Container\b/i,
  /^C4Component\b/i,
  /^C4Dynamic\b/i,
  /^C4Deployment\b/i
];

let renderToken = 0;
let themeObserverBound = false;

function looksLikeMermaid(source) {
  const text = String(source || '').trim();
  return MERMAID_FENCE_PATTERNS.some((pattern) => pattern.test(text));
}

function readFigureSource(figure) {
  const lines = figure.querySelectorAll('.code .line');

  if (lines.length) {
    return Array.from(lines)
      .map((line) => line.textContent.replace(/\u00a0/g, ' '))
      .join('\n')
      .trim();
  }

  const pre = figure.querySelector('pre');
  return pre ? pre.textContent.trim() : '';
}

function upgradeMermaidFigures(root) {
  const scope = root || document;
  const figures = scope.querySelectorAll('figure.highlight.plaintext');

  figures.forEach((figure) => {
    if (figure.dataset.mermaidReady === 'true') return;

    const source = readFigureSource(figure);
    if (!looksLikeMermaid(source)) return;

    const shell = document.createElement('div');
    shell.className = 'trm-mermaid-shell';
    shell.dataset.mermaidSource = source;

    const canvas = document.createElement('div');
    canvas.className = 'trm-mermaid-diagram';
    shell.appendChild(canvas);

    figure.dataset.mermaidReady = 'true';
    figure.replaceWith(shell);
  });
}

async function renderShell(shell, index, token) {
  const source = shell.dataset.mermaidSource;
  const canvas = shell.querySelector('.trm-mermaid-diagram');

  if (!source || !canvas || token !== renderToken) return;

  const renderId = `trm-mermaid-${index}-${Date.now()}`;

  shell.classList.add('is-rendering');

  try {
    const result = await mermaid.render(renderId, source);
    if (token !== renderToken) return;

    canvas.innerHTML = result.svg;
    shell.classList.remove('is-rendering');
    shell.classList.add('is-rendered');
  } catch (error) {
    console.error('Mermaid render failed:', error);
    canvas.innerHTML = `<pre class="trm-mermaid-fallback">${source.replace(/</g, '&lt;')}</pre>`;
    shell.classList.remove('is-rendering');
    shell.classList.add('is-failed');
  }
}

async function renderAllMermaid(root) {
  upgradeMermaidFigures(root);

  const shells = Array.from((root || document).querySelectorAll('.trm-mermaid-shell'));
  if (!shells.length) return;

  renderToken += 1;
  const token = renderToken;

  const darkMode = document.documentElement.classList.contains('dark');
  const themeVariables = darkMode
    ? {
        background: 'transparent',
        primaryColor: '#11384a',
        primaryBorderColor: '#34d0db',
        primaryTextColor: '#dcf8ff',
        secondaryColor: '#0f3142',
        secondaryBorderColor: '#2fbfd0',
        tertiaryColor: '#102f40',
        tertiaryBorderColor: '#2aaec2',
        lineColor: '#3bc4d6',
        textColor: '#dcf8ff',
        mainBkg: '#11384a',
        clusterBkg: '#123444',
        clusterBorder: '#2aaec2',
        edgeLabelBackground: '#0b3042',
        labelTextColor: '#effcff',
        fontFamily: 'inherit'
      }
    : {
        background: 'transparent',
        primaryColor: '#eefafc',
        primaryBorderColor: '#5fa6c4',
        primaryTextColor: '#14394f',
        secondaryColor: '#e8f6f9',
        secondaryBorderColor: '#6caec9',
        tertiaryColor: '#e2f2f6',
        tertiaryBorderColor: '#77b7d0',
        lineColor: '#5f95b2',
        textColor: '#14394f',
        mainBkg: '#eefafc',
        clusterBkg: '#edf8fa',
        clusterBorder: '#84b7cb',
        edgeLabelBackground: '#e8f6f9',
        labelTextColor: '#18445d',
        fontFamily: 'inherit'
      };

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    fontFamily: 'inherit',
    themeVariables,
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false,
      curve: 'basis'
    }
  });

  for (let index = 0; index < shells.length; index += 1) {
    await renderShell(shells[index], index, token);
  }
}

function initMermaid() {
  renderAllMermaid(document);

  if (!themeObserverBound) {
    const observer = new MutationObserver(() => {
      renderAllMermaid(document);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    themeObserverBound = true;
  }
}

document.addEventListener('DOMContentLoaded', initMermaid);
document.addEventListener('swup:contentReplaced', initMermaid);
