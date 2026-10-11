# Prestige Gold · Web

Interfaz del **Sistema Integral de Control de Materiales, Talleres, Producción y Finanzas** de Prestige Gold.
**React 19 · Vite 8 · TypeScript · Tailwind v4 · TanStack Router/Query · Radix**. API en
[api-prestige](https://github.com/david0ql/api-prestige).

## Desarrollo

```bash
cp .env.example .env      # VITE_API_PROXY_TARGET=http://localhost:3300
npm ci
npm run dev               # http://localhost:5180 (proxy /api → API)
```

## Producción

```bash
npm ci && npm run build   # genera dist/ (estático); el servidor web publica /api hacia la API
```

La web consume la API en la ruta relativa `/api` del mismo dominio (sin CORS). Ejemplo de nginx: `deploy/nginx.conf`.

## Pruebas

| Comando | Qué valida |
|---|---|
| `npm test` | Unitarias (Vitest + Testing Library), incluida la balanza Mettler Toledo MT-SICS simulada |
| `npm run test:e2e` | Clics de punta a punta con Playwright (requiere la API clonada en `../api-prestige` o `API_DIR`) |
