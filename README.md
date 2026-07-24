# zegm-web

Sitio ZEGM. La lógica y estilos se sirven desde **Vercel** (estático); el host
(Elementor/CMS) solo aporta un **punto de montaje**. Stack: esbuild + TypeScript + GSAP,
sin React/Tailwind. Todo el CSS está scopeado bajo `.aa-landing`.

## Embed en el host

Widget HTML con el mount + loader:

```html
<div data-aa-mount data-aa-theme="light" data-aa-lang="es"></div>
<script src="https://<proyecto>.vercel.app/loader.js" data-cfasync="false"></script>
```

Atributos: `data-aa-theme` (`light|dark`, default `light`) · `data-aa-lang` (`es|en`, default `es`).
`data-cfasync="false"` es obligatorio: los plugins de optimización de WordPress difieren el JS
hasta la primera interacción y el widget nunca llegaría a montarse.

## Distribución (Vercel)

`git push` a `main` → Vercel corre `npm run build` y sirve `dist/`.

El build emite `dist/assets/landing.[hash].js` (+ chunks) + `dist/assets/styles.[hash].css` y
**genera** `dist/loader.js` con esos nombres ya resueltos. Los assets hasheados se cachean como
inmutables; `loader.js` se cachea 5 min. No hay que taggear, versionar ni purgar caché a mano.

El build también prerenderiza las 5 páginas de preview a `dist/` (`prerender.mjs`): corre la fase
de render en Node con linkedom y hornea el DOM dentro del div de montaje, junto con el `<head>`,
el JSON-LD, `robots.txt` y `sitemap.xml`. Sin eso, el HTML servido era un div vacío y los crawlers
que no ejecutan JavaScript no veían nada.

`dist/` no se commitea (lo construye Vercel). Si venías de la distribución jsDelivr, corre
`git rm -r --cached dist` una vez para dejar de trackearlo.

## Desarrollo

```bash
npm install
npm run typecheck            # tsc --noEmit
npm run build                # genera dist/ (assets hasheados + loader + preview)
PORT=8770 npm run dev        # watch + server; sirve dist/ en http://localhost:8770/
```

En dev el server sirve `dist/` igual que producción (sin hash). Las páginas de preview montan la
landing vía `./loader.js`. Idioma conmutable con `?lang=en`.

## Reglas

- CSS prefijado `.aa-*` — nunca selectores globales (colisionan con el host).
- No meter secretos: el bundle es público.
- Comentarios = WHY, no WHAT. Sin emojis.
