const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; dashboard/1.0)',
        'Accept': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: null }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(204).end();
  }

  const raw    = (req.query && req.query.ticker) || '';
  const ticker = raw.trim().toUpperCase().replace(/[^A-Z0-9.\-^]/g, '');
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  const apiKey = process.env.STOCK_API_KEY;

  // Primary: Finnhub (requires STOCK_API_KEY env var)
  if (apiKey) {
    try {
      const q = await get(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`);
      if (q.status === 200 && q.body && q.body.c > 0) {
        let name = '';
        try {
          const p = await get(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`);
          if (p.status === 200 && p.body) name = p.body.name || '';
        } catch {}
        console.log(`[quote] Finnhub OK for ${ticker}: ${q.body.c}`);
        return res.status(200).json({ price: q.body.c, currency: 'USD', name, ts: Date.now() });
      }
      console.warn(`[quote] Finnhub status=${q.status} c=${q.body && q.body.c} for ${ticker}`);
    } catch (e) {
      console.error(`[quote] Finnhub error for ${ticker}:`, e.message);
    }
  }

  // Fallback: Yahoo Finance v7 (server-side, no CORS issue)
  try {
    const q = await get(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`);
    const r  = q.body && q.body.quoteResponse && q.body.quoteResponse.result && q.body.quoteResponse.result[0];
    if (q.status === 200 && r && r.regularMarketPrice != null) {
      console.log(`[quote] Yahoo v7 OK for ${ticker}: ${r.regularMarketPrice}`);
      return res.status(200).json({
        price:    r.regularMarketPrice,
        currency: r.currency || 'USD',
        name:     r.shortName || r.longName || '',
        ts:       Date.now()
      });
    }
    const yaErr = q.body && q.body.quoteResponse && q.body.quoteResponse.error;
    console.warn(`[quote] Yahoo v7 status=${q.status} for ${ticker}`, yaErr || '');
  } catch (e) {
    console.error(`[quote] Yahoo v7 error for ${ticker}:`, e.message);
  }

  // Second fallback: Yahoo Finance v8 chart
  try {
    const q = await get(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`);
    const m  = q.body && q.body.chart && q.body.chart.result && q.body.chart.result[0] && q.body.chart.result[0].meta;
    if (q.status === 200 && m && m.regularMarketPrice != null) {
      console.log(`[quote] Yahoo v8 OK for ${ticker}: ${m.regularMarketPrice}`);
      return res.status(200).json({
        price:    m.regularMarketPrice,
        currency: m.currency || 'USD',
        name:     m.shortName || m.longName || '',
        ts:       Date.now()
      });
    }
    console.warn(`[quote] Yahoo v8 status=${q.status} for ${ticker}`);
  } catch (e) {
    console.error(`[quote] Yahoo v8 error for ${ticker}:`, e.message);
  }

  return res.status(404).json({ error: 'price unavailable for ' + ticker });
};
