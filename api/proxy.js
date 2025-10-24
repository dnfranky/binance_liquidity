export default async function handler(req, res) {
  try {
    const { p = "" } = req.query;
    if (!p) return res.status(400).json({ error: "missing p" });
    const url = "https://fapi.binance.com" + p;
    const resp = await fetch(url, { headers: { "User-Agent": "rev6_walltracker" } });
    const text = await resp.text();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(resp.status).send(text);
  } catch (e) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: String(e) });
  }
}
