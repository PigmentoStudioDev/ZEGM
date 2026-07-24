# zegm-web

Sitio ZEGM. **El host (Elementor/CMS) solo aporta un punto de montaje.**
Lógica + estilos servidos desde Vercel (estático). Build: esbuild + TypeScript + GSAP. Sin React/Tailwind.

Arquitectura scaffoldeada desde el patrón "Mount Point Pattern" de `ATFX_PeruLP`.

## Arquitectura (Mount Point Pattern)

```
Host (widget HTML)
  └─ <div data-aa-mount data-aa-theme="light" data-aa-lang="es"></div>
  └─ <script src=".../loader.js"></script>   → inyecta dist/assets/landing.[hash].css + .js
        └─ boot() en src/index.ts: lee atributos del mount, crea .aa-landing, renderiza secciones
```

- **`src/index.ts`** — `boot()`: resuelve `theme` y `lang` (el `?lang=` de la URL gana sobre
  `data-aa-lang`), crea el root `.aa-landing`, llama a cada `renderX(root, lang)` en orden y
  luego a los `initX(root)` (comportamiento/animaciones GSAP).
- **Secciones** = funciones que crean DOM (`src/sections/*.ts`). Una por strip.
- **UI/átomos** = `src/ui/*.ts`. GSAP centralizado en `src/ui/gsap-env.ts`.
- **Estilos** = `src/styles/*.css`, agregados por `landing.css` (entry con `@import`).
- **Constantes/contenido** = `src/constants/*.ts` (bilingüe `Record<Lang, {...}>`).
- Build: `esbuild.config.mjs` → `dist/assets/landing.[hash].js` (+ chunks) + `dist/assets/styles.[hash].css`.

## Estructura actual (esqueleto)

```
src/
├── index.ts              # boot: mount → .aa-landing → render + init
├── core/{types,dom}.ts   # Theme/Lang + helpers ($, $$, el)
├── sections/hero.ts      # sección demo bilingüe
├── ui/{gsap-env,motion}.ts
├── constants/content.ts  # shape de contenido bilingüe
└── styles/               # tokens, typography, layout, components, section-theme, hero, landing(entry)
```

## Sistema de tema (light/dark por strip)

`src/styles/section-theme.css`. Cada sección declara `data-aa-section-theme="light|dark"`;
eso remapea los tokens `--aa-*` → los componentes leen tokens y se adaptan solos.
- **Gotcha de overdraw**: una sección cuyo tema COINCIDE con el root se pinta
  `background-color: transparent` (deja ver `.aa-landing::before`). Si necesitas un fondo
  visible ahí, píntalo con `background-image: linear-gradient(var(--aa-bg), var(--aa-bg))`.

## Tipografía (capa semántica)

`src/styles/typography.css`. Títulos → `.aa-h-*`; cuerpo → `.aa-p-*`; etiqueta → `.aa-eyebrow`.
NUNCA `font-size: var(--aa-text-*)` crudo (rompe jerarquía y pierde la fuente display).

## i18n (ES/EN)

Patrón por constante: `const COPY: Record<Lang, {...}> = { es:{}, en:{} }`. `boot()` resuelve
`lang` con `?lang=` (prioridad) → `data-aa-lang`. Toggle futuro: links a `?lang=es|en`.

## Desarrollo

```bash
npm install
npm run typecheck
npm run build
PORT=8770 npm run dev
```

## Deploy (Vercel)

- `git push main` → Vercel corre `npm run build` (== `node esbuild.config.mjs`) y sirve `dist/`.
- El build emite `dist/assets/landing.[hash].{js,css}` (+ chunks) y **genera** `dist/loader.js`
  con esos nombres ya resueltos + auto-localizado (`document.currentScript`). Assets inmutables;
  `loader.js` cachea 5 min (`vercel.json`). Cero tags, cero CI, cero purga.
- El build prerenderiza las 5 páginas de preview a `dist/` (`prerender.mjs`): ejecuta la fase
  de render en Node con linkedom y hornea el DOM dentro del div de montaje, más `<head>`
  (title/description/canonical/OG), JSON-LD, `robots.txt` y `sitemap.xml`. Los `initX()` NO
  corren: aplicarían `autoAlpha: 0` y serializarían el contenido oculto.
- `dist/` está gitignoreado (lo construye Vercel). No editar `loader.js` a mano: es generado.
- Embed en el host: `<script src="https://<proyecto>.vercel.app/loader.js" data-cfasync="false">`.

## Reglas de operación

- CSS siempre `.aa-*` (nunca global) · sin secretos en el bundle · comentarios = WHY · sin emojis.
- Push / deploy son operaciones bloqueadas: pedir OK explícito.

## Scoping CSS — nota de sostenibilidad

Todos los selectores llevan el prefijo `.aa-landing` a mano (~230 reglas). Es la garantía
de aislamiento contra el host (Elementor), pero depende de la disciplina: un selector sin
prefijo se fuga al host globalmente. Si el proyecto crece, evaluar forzar el scope en build
(`postcss-prefixwrap`) o migrar a `@scope { … }` nativo — así el aislamiento deja de ser
manual. Por ahora se mantiene el prefijo explícito (cero dependencias nuevas).

## Fuentes

Self-hosted en `src/fonts/` como WOFF2. DM Sans es un único archivo VARIABLE (eje wght
100–1000, opsz fijado a 18pt, subset latino ES/EN) → un `@font-face` cubre 300/400/700.
Para regenerar tras cambiar charset/pesos: `fontTools varLib.instancer` + `fontTools.subset`
con `--flavor=woff2` (requiere `woff2`/`fontTools`, no son deps del proyecto).
