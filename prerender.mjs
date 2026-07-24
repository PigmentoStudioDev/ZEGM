// Prerender: ejecuta la fase de render en Node y hornea el DOM resultante dentro del div de
// montaje de cada HTML, para que un crawler que no ejecuta JavaScript reciba la página entera.
//
// Por qué existe: el bundle inyecta todo en cliente, así que el HTML servido era
// `<div data-aa-mount></div>` y nada más. Googlebot lo renderiza con retraso y sin garantías;
// los crawlers de IA (GPTBot, PerplexityBot, ClaudeBot) directamente no ejecutan JS, así que
// para ellos el sitio estaba vacío. src/ui/seo.ts ya aplicaba title y JSON-LD, pero en runtime:
// exactamente lo que esos crawlers nunca llegan a ver.
//
// Solo corre `renderPage` (src/render.ts). NUNCA los initX(): esos aplican
// gsap.set(el, { autoAlpha: 0 }) y serializarían el contenido con opacity:0 + visibility:hidden.
// En cliente, boot() vuelve a renderizar sobre el mismo módulo y engancha las animaciones.
import * as esbuild from 'esbuild';
import { parseHTML } from 'linkedom';

const DOM_GLOBALS = [
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'DocumentFragment',
  'CSSStyleDeclaration',
];

function installGlobals(win) {
  for (const key of DOM_GLOBALS) {
    if (win[key] !== undefined) globalThis[key] = win[key];
  }
}

// Empaqueta src/render.ts para Node una sola vez. De ahí salen tanto renderPage como los
// metadatos SEO, así el prerender no necesita un segundo punto de entrada.
async function loadRenderer() {
  const result = await esbuild.build({
    entryPoints: ['src/render.ts'],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: ['es2022'],
    write: false,
    logLevel: 'silent',
  });

  const code = result.outputFiles[0].text;
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(url);
}

// Escribe una etiqueta de <head> reemplazando la que ya exista, para que el prerender sea
// idempotente si un HTML de preview ya trae la suya.
function upsertMeta(document, selector, attrs) {
  const existing = document.head.querySelector(selector);
  if (existing) existing.remove();
  const tag = document.createElement(attrs.rel ? 'link' : 'meta');
  for (const [key, value] of Object.entries(attrs)) tag.setAttribute(key, value);
  document.head.appendChild(tag);
}

// Favicons y webmanifest, servidos desde la raíz del deploy (ver public/ y esbuild.config.mjs).
// Rutas absolutas a propósito: estas etiquetas solo existen en el HTML que sirve Vercel; cuando
// el bundle se monta en un host, el <head> es suyo y el favicon lo pone él.
const ICONS = [
  { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  { rel: 'shortcut icon', href: '/favicon.ico' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
  { rel: 'manifest', href: '/site.webmanifest' },
];

function injectIcons(document) {
  for (const attrs of ICONS) {
    upsertMeta(document, `link[rel="${attrs.rel}"][href="${attrs.href}"]`, attrs);
  }
}

// El canonical apunta al dominio público aunque la página se sirva desde otro lado: es lo que
// evita que el deploy compita con el sitio real por contenido duplicado.
function injectHead(document, copy, url, lang) {
  const title = document.querySelector('title') ?? document.head.appendChild(document.createElement('title'));
  title.textContent = copy.title;

  upsertMeta(document, 'meta[name="description"]', { name: 'description', content: copy.description });
  upsertMeta(document, 'link[rel="canonical"]', { rel: 'canonical', href: url });

  upsertMeta(document, 'meta[property="og:type"]', { property: 'og:type', content: 'website' });
  upsertMeta(document, 'meta[property="og:title"]', { property: 'og:title', content: copy.title });
  upsertMeta(document, 'meta[property="og:description"]', { property: 'og:description', content: copy.description });
  upsertMeta(document, 'meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta(document, 'meta[property="og:locale"]', {
    property: 'og:locale',
    content: lang === 'en' ? 'en_US' : 'es_MX',
  });

  upsertMeta(document, 'meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta(document, 'meta[name="twitter:title"]', { name: 'twitter:title', content: copy.title });
  upsertMeta(document, 'meta[name="twitter:description"]', { name: 'twitter:description', content: copy.description });

  injectIcons(document);
}

// JSON-LD: LegalService identifica al despacho en todas las páginas y WebPage describe la
// página concreta. Ambos salen de la misma fuente que el contenido visible, porque Google
// descarta el schema que no corresponde a lo que la página muestra.
function injectSchema(document, legalService, copy, url, lang) {
  const existing = document.head.querySelector('script[type="application/ld+json"]');
  if (existing) existing.remove();

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { ...legalService, '@id': `${new URL(url).origin}/#firm` },
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: copy.title,
        description: copy.description,
        inLanguage: lang === 'en' ? 'en-US' : 'es-MX',
        isPartOf: { '@id': `${new URL(url).origin}/#firm` },
      },
    ],
  };

  const tag = document.createElement('script');
  tag.setAttribute('type', 'application/ld+json');
  tag.textContent = JSON.stringify(schema);
  document.head.appendChild(tag);
}

// robots.txt permisivo a propósito: Googlebot necesita poder descargar /loader.js y /assets/
// para renderizar el sitio montado en el host. De la duplicación se encarga el canonical, no
// un Disallow. Los crawlers de IA se listan explícitamente porque no ejecutan JavaScript y
// dependen por completo del HTML prerenderizado.
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
];

function buildRobots(origin) {
  const agents = ['*', ...AI_BOTS].map((ua) => `User-agent: ${ua}\nAllow: /`).join('\n\n');
  return `${agents}\n\nSitemap: ${origin}/sitemap.xml\n`;
}

function buildSitemap(paths, origin) {
  const urls = Object.values(paths)
    .map((path) => `  <url>\n    <loc>${origin}${path}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function createPrerenderer() {
  const { renderPage, SEO, SITE_ORIGIN, PAGE_PATHS, legalServiceSchema } = await loadRenderer();

  const robots = buildRobots(SITE_ORIGIN);
  const sitemap = buildSitemap(PAGE_PATHS, SITE_ORIGIN);

  // prerender: devuelve el HTML de entrada con el div de montaje ya relleno y el <head>
  // horneado. Si el archivo no declara mount, se devuelve intacto (p. ej. la página de
  // documentación, que no monta el bundle).
  function prerender(html, { page, lang, theme }) {
    const { document } = parseHTML(html);
    const mount = document.querySelector('[data-aa-mount]');
    if (!mount) return html;

    // parseHTML crea un documento nuevo por página: los globals se reinstalan para que el
    // renderer construya nodos que pertenezcan a ESTE documento.
    installGlobals(document.defaultView ?? { document });
    globalThis.document = document;

    const copy = SEO[page][lang];
    const url = `${SITE_ORIGIN}${PAGE_PATHS[page]}`;

    mount.innerHTML = renderPage(page, lang, theme).outerHTML;
    injectHead(document, copy, url, lang);
    injectSchema(document, legalServiceSchema(lang), copy, url, lang);
    return document.toString();
  }

  return { prerender, robots, sitemap };
}
