# Inversión $ Beneficios – Líneas Fotocopias (v4 FULL PRO)

## Qué cambia (FULL PRO)
- La web ya no llama directo a Binance/Stooq/Yahoo (CORS rompe).
- Ahora llama a **/api/quotes** (serverless en Vercel) y la API hace de proxy.

## Deploy en Vercel (rápido, sin humo)
1) Creá una carpeta y descomprimí este ZIP.
2) Subí el repo a GitHub (o importá carpeta en Vercel).
3) En Vercel: New Project → Import.
4) Framework: **Other**.
5) Deploy. Listo.

## Probar API
- POST /api/quotes
Body:
{
  "requests":[
    {"source":"Yahoo","symbol":"SUPV","key":"test1"},
    {"source":"Binance","symbol":"BTCUSDT","key":"test2"},
    {"source":"Stooq","symbol":"AAPL","key":"test3"}
  ]
}

Respuesta:
{ ok:true, results:[{key, price, error}] }

## Nota importante (Argentina / BYMA / Bonos)
- Esto ya es “PRO” por arquitectura.
- Si querés precio de BYMA/bonos/cedears AR **real**, se agrega un provider nuevo en `api/quotes.js`
  apuntando a tu fuente (IOL/PPI/ROFEX/ByMA data) — algunas requieren API key y/o login.


## Provider PPI (BYMA / Bonos / CEDEARs AR)
- La app soporta `source: PPI` en `/api/quotes`.
- Requiere credenciales en Vercel (ENV):
  - `PPI_BASE_URL` (prod) ejemplo: `https://clientapi.portfoliopersonal.com`
  - `PPI_API_VERSION` (default `1.0`)
  - `PPI_AUTHORIZED_CLIENT`
  - `PPI_CLIENT_KEY`
  - `PPI_API_KEY`
  - `PPI_API_SECRET`
- Para cotización: completar en la fila `PPI Type` y `PPI Settle` (default: `ACCIONES` + `INMEDIATA`).

## Provider DolarAPI (FX)
- Usar `source: DolarAPI` y `symbol` = `blue|oficial|bolsa|ccl|tarjeta|mayorista|cripto`.
