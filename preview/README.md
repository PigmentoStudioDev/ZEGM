# Preview — demo hosteada para cliente

Páginas fuente que renderizan **el bundle real** de ZEGM en todas sus rutas, para mostrarle al
cliente el despliegue navegable con URLs limpias. Es el mismo embed que va en el host (Elementor):
un `mount` + el `loader.js` mismo-origen.

El build (`esbuild.config.mjs`) copia estas páginas a `dist/` en cada `npm run build`. Vercel sirve
`dist/`, así que la demo vive en el mismo dominio que el `loader.js` y los assets.

## Rutas

| URL          | Archivo            | `data-aa-page` |
| ------------ | ------------------ | -------------- |
| `/`          | `index.html`       | `home`         |
| `/nosotros`  | `nosotros.html`    | `nosotros`     |
| `/areas`     | `areas.html`       | `areas`        |
| `/acerca`    | `acerca.html`      | `acerca`       |
| `/contacto`  | `contacto.html`    | `contacto`     |

- Idioma: agrega `?lang=en` a cualquier ruta (p. ej. `/nosotros?lang=en`).
- El navbar del sitio navega con `?page=`; también funciona (el `?page=` de la URL tiene prioridad
  sobre el `data-aa-page` del mount).

