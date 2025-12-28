
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Use POST");
  }

  const body = req.body || {};
  const requests = Array.isArray(body.requests) ? body.requests : [];

  async function binance(symbol) {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("Binance error");
    const j = await r.json();
    return Number(j.price);
  }

  async function yahoo(symbol) {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!r.ok) throw new Error("Yahoo error");
    const j = await r.json();
    return Number(j.quoteResponse.result[0].regularMarketPrice);
  }

  async function getQuote({ source, symbol }) {
    if (source === "Binance") return binance(symbol);
    if (source === "Yahoo") return yahoo(symbol);
    throw new Error("Fuente no soportada");
  }

  const results = await Promise.all(
    requests.map(async (r) => {
      try {
        const price = await getQuote(r);
        return { ...r, price, ok: true };
      } catch (e) {
        return { ...r, price: null, ok: false, error: e.message };
      }
    })
  );

  res.status(200).json({
    ok: true,
    results,
    timestamp: new Date().toISOString()
  });
}
