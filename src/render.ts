// Fase de render, aislada del resto del boot: arma el DOM completo de una página sin tocar
// GSAP, Lenis, sessionStorage ni ninguna API de navegador.
//
// Vive separada de index.ts para que el prerender (prerender.mjs) pueda importarla en Node:
// index.ts arrastra ui/gsap-env, que registra ScrollTrigger al importarse y necesita un
// navegador real. Aquí solo entran secciones, que son constructores de DOM puros.
//
// Las animaciones NO se ejecutan en prerender a propósito: los initX() aplican
// gsap.set(el, { autoAlpha: 0 }), que serializaría el contenido con opacity:0 y
// visibility:hidden. Contenido oculto es peor que ausente para un crawler.
import type { Lang, Page, Theme } from './core/types';
import { AREAS } from './constants/content';
import { renderNavbar } from './sections/navbar';
import { renderLoader } from './sections/loader';
import { renderAbout } from './sections/about';
import { renderQuote } from './sections/quote';
import { renderServices } from './sections/services';
import { renderContact } from './sections/contact';
import { renderPageHeading } from './sections/page-heading';
import { renderPracticeAreas } from './sections/practice-areas';
import { renderNosotrosRows } from './sections/nosotros-rows';
import { renderAcerca } from './sections/acerca';
import { renderFooter } from './sections/footer';

// Reexportados para que prerender.mjs los obtenga del mismo bundle que renderPage, sin
// necesitar un segundo punto de entrada solo para los metadatos.
export { SEO, SITE_ORIGIN, PAGE_PATHS, legalServiceSchema } from './constants/seo';

// Home: hero (siempre) + overlay del loader (solo en cliente, primer mount) + secciones.
function renderHome(root: HTMLElement, lang: Lang, loaderOverlay: boolean): void {
  renderLoader(root, lang, loaderOverlay);
  renderAbout(root, lang);
  renderQuote(root, lang);
  renderServices(root, lang);
}

function renderAreas(root: HTMLElement, lang: Lang): void {
  renderPageHeading(root, AREAS[lang], 'areas');
  renderPracticeAreas(root, lang);
}

// Registro página → render. Agregar una página es una entrada más y TypeScript exige cubrir
// todas las claves de Page (exhaustividad).
const PAGE_RENDERERS: Record<Page, (root: HTMLElement, lang: Lang, loaderOverlay: boolean) => void> = {
  home: renderHome,
  nosotros: renderNosotrosRows,
  areas: renderAreas,
  acerca: renderAcerca,
  contacto: renderContact,
};

// Construye el root `.aa-landing` con navbar + página + footer y lo devuelve SIN insertarlo,
// para que el llamador decida dónde va (boot lo monta en el div del host; el prerender lo
// serializa a HTML).
export function renderPage(
  page: Page,
  lang: Lang,
  theme: Theme,
  loaderOverlay = false,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'aa-landing';
  root.setAttribute('data-aa-theme', theme);
  root.setAttribute('data-aa-lang', lang);

  renderNavbar(root, lang, page);
  PAGE_RENDERERS[page](root, lang, loaderOverlay);
  renderFooter(root, lang, page);

  return root;
}
