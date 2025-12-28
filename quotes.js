export default async function handler(req, res) {
  // CORS (por si consumís desde otro dominio)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Use POST");

  const body = req.body || {};
  const requests = Array.isArray(body.requests) ? body.requests : [];
  const now = new Date().toISOString();

  async function qBinance(symbol){
    const u = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(String(symbol).toUpperCase().replace("/", ""))}`;
    const r = await fetch(u);
    if(!r.ok) throw new Error("Binance HTTP " + r.status);
    const j = await r.json();
    const p = Number(j.price);
    if(!Number.isFinite(p)) throw new Error("Binance price inválido");
    return p;
  }

  async function qStooq(symbol){
    // Stooq espera ejemplo: AAPL.US (si no viene con .US, se agrega)
    const s = String(symbol).includes(".") ? String(symbol) : `${symbol}.US`;
    const u = `https://stooq.com/q/l/?s=${encodeURIComponent(s.toLowerCase())}&f=sd2t2ohlcv&h&e=csv`;
    const r = await fetch(u);
    if(!r.ok) throw new Error("Stooq HTTP " + r.status);
    const t = await r.text();
    const lines = t.trim().split("\n");
    if(lines.length < 2) throw new Error("Stooq sin datos");
    const cols = lines[1].split(",");
    const close = Number(cols[6]);
    if(!Number.isFinite(close)) throw new Error("Stooq close inválido");
    return close;
  }

  async function qYahoo(symbol){
    // Endpoint público (sin key), puede cambiar con el tiempo.
    const u = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" }});
    if(!r.ok) throw new Error("Yahoo HTTP " + r.status);
    const j = await r.json();
    const it = j?.quoteResponse?.result?.[0];
    const p = Number(it?.regularMarketPrice);
    if(!Number.isFinite(p)) throw new Error("Yahoo price inválido");
    return p;
  }

  async function qDolarApi(symbol){
    // Docs: https://dolarapi.com/docs/argentina/
    // symbol ejemplos: "blue" | "oficial" | "bolsa" | "ccl" | "tarjeta" | "mayorista" | "cripto"
    const s = String(symbol||"").toLowerCase().trim();
    const map = {
      "blue":"blue","oficial":"oficial","bolsa":"bolsa","mep":"bolsa","ccl":"contadoconliqui","tarjeta":"tarjeta","mayorista":"mayorista","cripto":"cripto"
    };
    const path = map[s] || s;
    if(!path) throw new Error("DolarAPI: symbol vacío");
    const u = `https://dolarapi.com/v1/dolares/${encodeURIComponent(path)}`;
    const r = await fetch(u);
    if(!r.ok) throw new Error("DolarAPI HTTP " + r.status);
    const j = await r.json();
    // la API suele devolver compra/venta y/o promedio. Preferimos 'venta' si existe.
    const p = Number(j?.venta ?? j?.promedio ?? j?.compra);
    if(!Number.isFinite(p)) throw new Error("DolarAPI precio inválido");
    return p;
  }

  async function ppiLogin(){
    const base = process.env.PPI_BASE_URL || "https://clientapi.portfoliopersonal.com";
    const v = process.env.PPI_API_VERSION || "1.0";
    const url = `${base}/api/${v}/Account/LoginApi`;

    const headers = {
      "Content-Type":"application/json",
      "AuthorizedClient": process.env.PPI_AUTHORIZED_CLIENT || "",
      "ClientKey": process.env.PPI_CLIENT_KEY || "",
      "ApiKey": process.env.PPI_API_KEY || "",
      "ApiSecret": process.env.PPI_API_SECRET || "",
    };
    // Validación simple
    for (const k of ["AuthorizedClient","ClientKey","ApiKey","ApiSecret"]){
      if(!headers[k] || headers[k].trim()==="") throw new Error("PPI: faltan credenciales en ENV ("+k+")");
    }
    const r = await fetch(url, { method:"POST", headers });
    if(!r.ok) throw new Error("PPI Login HTTP " + r.status);
    const j = await r.json();
    const tok = Array.isArray(j) ? j[0]?.accessToken : j?.accessToken;
    if(!tok) throw new Error("PPI: accessToken vacío");
    return { base, v, token: tok };
  }

  async function qPPI({ticker, type, settlement}){
    // Docs: /api/{v}/MarketData/Current (Ticker, Type, Settlement)
    const { base, v, token } = await ppiLogin();
    const u = new URL(`${base}/api/${v}/MarketData/Current`);
    u.searchParams.set("Ticker", ticker);
    u.searchParams.set("Type", type);
    u.searchParams.set("Settlement", settlement);

    const headers = {
      "Authorization": `Bearer ${token}`,
      "AuthorizedClient": process.env.PPI_AUTHORIZED_CLIENT || "",
      "ClientKey": process.env.PPI_CLIENT_KEY || "",
    };
    const r = await fetch(u.toString(), { headers });
    if(!r.ok) throw new Error("PPI Current HTTP " + r.status);
    const j = await r.json();
    const p = Number(j?.price);
    if(!Number.isFinite(p)) throw new Error("PPI price inválido");
    return p;
  }

  async function quoteOne(reqItem){
    const src = String(reqItem.source||"").toLowerCase();
    const symbol = String(reqItem.symbol||"").trim();
    if(!symbol) throw new Error("symbol vacío");

    if(src === "binance") return qBinance(symbol);
    if(src === "stooq") return qStooq(symbol);
    if(src === "yahoo") return qYahoo(symbol);
    if(src === "dolarapi") return qDolarApi(symbol);
    if(src === "ppi"){
      const type = String(reqItem.ppiType||"").trim() || "ACCIONES";
      const settlement = String(reqItem.ppiSettle||"").trim() || "INMEDIATA";
      return qPPI({ticker: symbol, type, settlement});
    }
    throw new Error("Fuente no soportada");
  }

  const results = await Promise.all(requests.map(async (it) => {
    const key = it.key ?? null;
    try{
      const price = await quoteOne(it);
      return { key, source: it.source, symbol: it.symbol, price, ts: now, error: null };
    }catch(e){
      return { key, source: it.source, symbol: it.symbol, price: null, ts: now, error: String(e?.message || e) };
    }
  }));

  res.status(200).json({ ok:true, ts: now, results });
}
