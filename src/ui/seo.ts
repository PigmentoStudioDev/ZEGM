// Aplica title/description/JSON-LD tras el mount. El bundle no controla el <head>
// estático del host, pero Google sí recoge title/meta/JSON-LD inyectados por JS durante
// el render de la página (a diferencia de hreflang, que Google trata como no confiable
// si se inyecta por JS — eso necesita URLs por idioma reales a nivel de host, fuera del
// alcance de este bundle).
import type { Lang, Page } from '../core/types';
import { SEO, legalServiceSchema } from '../constants/seo';

function upsertDescription(content: string): void {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertJsonLd(id: string, data: Record<string, unknown>): void {
  let tag = document.querySelector<HTMLScriptElement>(`script[data-aa-jsonld="${id}"]`);
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.setAttribute('data-aa-jsonld', id);
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(data);
}

export function applySeo(page: Page, lang: Lang): void {
  const copy = SEO[page][lang];
  document.title = copy.title;
  upsertDescription(copy.description);
  upsertJsonLd('legal-service', { '@context': 'https://schema.org', ...legalServiceSchema(lang) });
}
