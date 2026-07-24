// Página "Acerca de ZEGM": heading sans (override display→sans, igual que Services) +
// bloque "Profesionales" (col der, izq vacía) + banda hero de 200px con el nombre de la
// firma centrado + bloque "Historia" (label abajo-izq / cuerpo der). Diseño estático; el
// grid de abogados (data del Sheet) se agrega después sobre esta base.
import type { Lang } from '../core/types';
import { el } from '../core/dom';
import { ACERCA, FOOTER } from '../constants/content';
import { HERO } from '../constants/assets';
import { revealGroup } from '../ui/reveal-group';

// Abogado del grid: nombre (col A del Sheet) + foto opcional (col B: link/ID de Drive).
interface Lawyer {
  name: string;
  pic: string;
}

// Google Sheet público (gviz/tq → JSON). CORS ok: gviz refleja el Origin del host, así que
// el fetch cliente no necesita proxy. Col A = nombre; col B (opcional) = foto de Drive.
const SHEET_ID = '12_x3i8w7ivX__YIHLZDI0i45yUufQqVnAq56sE-7kHw';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

// Shape mínimo de la respuesta gviz (v desconocido → se normaliza a string en el parse).
interface GvizCell {
  v: unknown;
}
interface GvizRow {
  c: (GvizCell | null)[];
}
interface GvizResponse {
  table?: { rows?: GvizRow[] };
}

// Convierte un share URL o fileID de Drive a la URL de thumbnail (estable, con tamaño fijo
// y sin el redirect intermedio de uc?export=view). Si no reconoce un ID, devuelve la
// entrada tal cual (asume que ya es una URL directa).
function driveThumb(input: string): string {
  const match = input.match(/\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/);
  const id = match?.[1] ?? match?.[2] ?? (/^[\w-]{10,}$/.test(input) ? input : '');
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w600` : input;
}

// gviz envuelve el JSON en `/*O_o*/\ngoogle.visualization.Query.setResponse( … );`. Se
// recorta entre el primer '(' y el último ')' (robusto ante el prefijo multilínea).
function parseGviz(text: string): Lawyer[] {
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start < 0 || end <= start) return [];
  const data = JSON.parse(text.slice(start + 1, end)) as GvizResponse;
  const rows = data.table?.rows ?? [];
  return rows
    .map((r): Lawyer => {
      const name = String(r.c?.[0]?.v ?? '').trim();
      const rawPic = String(r.c?.[1]?.v ?? '').trim();
      return { name, pic: rawPic ? driveThumb(rawPic) : '' };
    })
    .filter((l) => l.name.length > 0);
}

// Iniciales para el avatar de respaldo cuando aún no hay foto (col B vacía).
function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

// Nombre con la última palabra en bold. Se construye con nodos DOM (no innerHTML): el
// nombre viene del Sheet (dato externo) → evita inyección. El bold arranca en el último
// token que empieza con letra, así "Julio Esponda †" resalta "Esponda †" (no el símbolo).
function lawyerName(name: string): HTMLElement {
  const p = el('p', 'aa-team__name');
  const tokens = name.trim().split(/\s+/);
  let boldFrom = tokens.length - 1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/\p{L}/u.test(tokens[i])) {
      boldFrom = i;
      break;
    }
  }
  const head = tokens.slice(0, boldFrom).join(' ');
  if (head) p.append(document.createTextNode(`${head} `));
  const strong = el('strong');
  strong.textContent = tokens.slice(boldFrom).join(' ');
  p.append(strong);
  return p;
}

function lawyerCard(person: Lawyer): HTMLElement {
  const card = el('div', 'aa-team__card');
  const picWrap = el('div', 'aa-team__pic-wrap');
  if (person.pic) {
    picWrap.append(
      el('img', 'aa-team__pic', {
        src: person.pic,
        alt: person.name,
        loading: 'lazy',
        decoding: 'async',
      }),
    );
  } else {
    // Sin foto: avatar de iniciales en el mismo contenedor 1:1 (layout idéntico).
    const fallback = el('div', 'aa-team__pic-fallback', { 'aria-hidden': 'true' });
    fallback.textContent = initials(person.name);
    picWrap.append(fallback);
  }
  card.append(picWrap, lawyerName(person.name));
  return card;
}

// Puebla el grid: una card por abogado + celdas vacías aleatorias como respiro. El spacer
// se inserta SOLO tras una card (nunca tras otro spacer → jamás dos vacías seguidas) y
// nunca tras la última. Al hacer wrap (menos columnas) el CSS los oculta → todas se llenan.
// Los spacers llevan data-ignore para no consumir un slot de stagger del reveal.
function fillTeamGrid(grid: HTMLElement, lawyers: Lawyer[]): void {
  grid.replaceChildren();
  lawyers.forEach((person, i) => {
    grid.append(lawyerCard(person));
    if (i < lawyers.length - 1 && Math.random() < 0.28) {
      grid.append(el('div', 'aa-team__spacer', { 'aria-hidden': 'true', 'data-ignore': 'true' }));
    }
  });
}

// Fetch al Sheet → puebla el grid → arma el reveal en scroll sobre las cards ya inyectadas.
// El grid se rinde vacío en el render síncrono; este async corre tras el boot (el grid ya
// está en el DOM), así que revealGroup calcula bien el ScrollTrigger. Si el fetch falla o
// vuelve vacío, el grid queda vacío y el reveal es no-op.
async function loadTeam(grid: HTMLElement): Promise<void> {
  try {
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lawyers = parseGviz(await res.text());
    if (lawyers.length) fillTeamGrid(grid, lawyers);
  } catch {
    // Silencioso: sin data no hay cards; el resto de la página no se ve afectado.
  } finally {
    grid.removeAttribute('aria-busy');
    revealGroup(grid);
  }
}

// Fila de dos columnas 50/50. `slots` ya son los nodos de cada columna (una puede ir
// vacía). El modifier compone SOBRE la clase base (no la reemplaza). reveal-group engancha
// el fade al montar (initRevealGroup).
function row(modifier: string, slots: [HTMLElement, HTMLElement]): HTMLElement {
  const cls = modifier ? `aa-acerca__row aa-acerca__row--${modifier}` : 'aa-acerca__row';
  const r = el('div', cls, { 'data-reveal-group': 'mount' });
  r.append(slots[0], slots[1]);
  return r;
}

export function renderAcerca(root: HTMLElement, lang: Lang): void {
  const t = ACERCA[lang];
  const f = FOOTER[lang];

  const section = el('section', 'aa-acerca', {
    'data-aa-section-theme': 'light',
    id: 'acerca',
  });
  const inner = el('div', 'aa-acerca__inner');

  // ─── Heading sans (data-aa-split → reveal por palabra, como Services) ──────────
  const heading = el('h1', 'aa-acerca__heading aa-h-xl');
  heading.textContent = t.heading;
  heading.setAttribute('data-aa-split', 'mount'); // above-the-fold: dispara en mount (scroll-trigger no fiable ahi)

  // ─── Bloque "Profesionales": col izq vacía + col der (label bold + cuerpo) ─────
  const proCol = el('div', 'aa-acerca__col');
  const proLabel = el('p', 'aa-acerca__label');
  proLabel.textContent = t.proLabel;
  const proBody = el('p', 'aa-p-l aa-acerca__body');
  proBody.innerHTML = t.proBody;
  proCol.append(proLabel, proBody);
  const proRow = row('', [el('div', 'aa-acerca__col'), proCol]);

  // ─── Banda hero (mismo asset, alto fijo 200px) + firma centrada encima ────────
  // La firma reusa el brand del footer (mismo markup/clases). El figure se declara dark:
  // remapea --aa-fg a claro → el brand se lee sobre la foto (idéntico a como luce en el
  // footer dark). data-aa-split lo anima igual (initSplitText).
  const banner = el('figure', 'aa-acerca__banner', {
    'data-aa-section-theme': 'dark',
    'data-reveal-group': 'mount',
  });
  banner.append(
    el('img', 'aa-acerca__banner-img', {
      src: HERO.main,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
    }),
  );
  const brand = el('p', 'aa-footer__brand aa-acerca__banner-caption');
  const brandMain = el('span', 'aa-footer__brand-main');
  brandMain.textContent = f.brand;
  brandMain.setAttribute('data-aa-split', 'mount'); // el banner ya revela en mount → el split coincide
  const brandSub = el('span', 'aa-footer__brand-sub');
  brandSub.textContent = f.brandSub;
  brand.append(brandMain, brandSub);
  banner.append(brand);

  // ─── Bloque "Historia": col izq (label bold, abajo-izq) + col der (cuerpo) ─────
  const histLabelCol = el('div', 'aa-acerca__col aa-acerca__col--label');
  const histLabel = el('p', 'aa-acerca__label');
  histLabel.textContent = t.historyLabel;
  histLabelCol.append(histLabel);
  const histBodyCol = el('div', 'aa-acerca__col');
  const histBody = el('p', 'aa-p-l aa-acerca__body');
  histBody.innerHTML = t.historyBody;
  histBodyCol.append(histBody);
  const histRow = row('history', [histLabelCol, histBodyCol]);

  // ─── "Nuestro Equipo": mismo heading que el de la página + grid de abogados ────
  // El grid se rinde vacío; loadTeam lo puebla con la data del Sheet y arma su reveal.
  const teamHeading = el('h2', 'aa-acerca__heading aa-h-xl');
  teamHeading.textContent = t.teamHeading;
  teamHeading.setAttribute('data-aa-split', '');
  const teamGrid = el('div', 'aa-team__grid', { 'aria-busy': 'true' });

  inner.append(heading, proRow, banner, histRow, teamHeading, teamGrid);
  section.append(inner);
  root.append(section);

  // Solo en navegador: durante el prerender (Node) no hay a quién animar y un fetch al Sheet
  // colgaría el build. El grid queda vacío en el HTML estático y se puebla al montar.
  if (typeof window !== 'undefined') void loadTeam(teamGrid);
}
