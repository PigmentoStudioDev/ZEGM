// title/description por página+idioma, más los datos que el prerender necesita para el
// canonical y el sitemap.
//
// Estos metadatos se aplican en DOS momentos, desde esta única fuente:
//   - en build, horneados en el <head> de cada HTML (prerender.mjs) — lo único que ven los
//     crawlers que no ejecutan JavaScript, o sea todos los de IA;
//   - en runtime (src/ui/seo.ts), como respaldo si el bundle se monta en un host que sirve
//     su propio <head>, p. ej. Elementor con las 5 páginas compartiendo el mismo HTML.
import type { Lang, Page } from '../core/types';
import { FOOTER } from './content';

export interface SeoCopy {
  title: string;
  description: string;
}

// Dominio público. Hoy el sitio solo vive en el deploy de Vercel; cuando exista el dominio
// definitivo se cambia aquí y el canonical y el sitemap lo siguen solos.
export const SITE_ORIGIN = 'https://zegm.vercel.app';

export const PAGE_PATHS: Record<Page, string> = {
  home: '/',
  nosotros: '/nosotros',
  areas: '/areas',
  acerca: '/acerca',
  contacto: '/contacto',
};

// Reusa los mismos datos de contacto que el footer — nunca duplicar la fuente de verdad.
// Vive aquí (y no en ui/seo.ts) para que el prerender pueda importarlo sin arrastrar DOM.
export function legalServiceSchema(lang: Lang): Record<string, unknown> {
  const f = FOOTER[lang];
  return {
    '@type': 'LegalService',
    name: f.brand,
    description: f.addressLead,
    address: {
      '@type': 'PostalAddress',
      streetAddress: f.addressLines[1] ?? f.addressLines[0],
      addressLocality: 'Ciudad de México',
      addressCountry: 'MX',
    },
    telephone: f.phones,
    email: f.email,
  };
}

export const SEO: Record<Page, Record<Lang, SeoCopy>> = {
  home: {
    es: {
      title: 'ZEGM Abogados — Defensa penal en delitos de cuello blanco',
      description:
        'Defensa penal en delitos de cuello blanco, con experiencia en casos complejos a nivel nacional e internacional.',
    },
    en: {
      title: 'ZEGM Abogados — White-Collar Criminal Defense',
      description:
        'White-collar criminal defense, with experience in complex cases at the national and international level.',
    },
  },
  nosotros: {
    es: {
      title: 'Nosotros | ZEGM Abogados',
      description:
        'Despacho de abogados en México especializado en delitos de cuello blanco, con amplio historial representando instituciones y personas en casos penales complejos.',
    },
    en: {
      title: 'About Us | ZEGM Abogados',
      description:
        'Law firm in Mexico specialized in white-collar crime, with an extensive track record representing institutions and individuals in complex criminal cases.',
    },
  },
  areas: {
    es: {
      title: 'Áreas y Experiencia | ZEGM Abogados',
      description: 'Áreas de práctica en litigio penal, compliance e investigaciones regulatorias.',
    },
    en: {
      title: 'Experience and Areas | ZEGM Abogados',
      description: 'Practice areas in criminal litigation, compliance, and regulatory investigations.',
    },
  },
  acerca: {
    es: {
      title: 'Acerca de ZEGM | ZEGM Abogados',
      description:
        'Fundada en 1992 por Alberto Zinser y Julio Esponda. Equipo de 14 abogados especializados en litigio penal en Ciudad de México.',
    },
    en: {
      title: 'About ZEGM | ZEGM Abogados',
      description:
        'Founded in 1992 by Alberto Zinser and Julio Esponda. A team of 14 attorneys specialized in criminal litigation in Mexico City.',
    },
  },
  contacto: {
    es: {
      title: 'Contacto | ZEGM Abogados',
      description:
        'Despacho penal en Ciudad de México especializado en delitos de cuello blanco. Sierra Nevada #156, Lomas de Chapultepec, CDMX.',
    },
    en: {
      title: 'Contact | ZEGM Abogados',
      description:
        'Criminal law firm in Mexico City specialized in white-collar crimes. Sierra Nevada #156, Lomas de Chapultepec, CDMX.',
    },
  },
};
