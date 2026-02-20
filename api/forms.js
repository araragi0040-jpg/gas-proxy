export default async function handler(req, res) {
  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    return res.status(500).json({ ok:false, message:"GAS_URL is not set" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const url = new URL(GAS_URL);

    Object.entries(req.query || {}).forEach(([k,v])=>{
      url.searchParams.set(k,v);
    });

    const init = {
      method: req.method,
      headers: { "Content-Type":"application/json" },
    };

    if (req.method === "POST") {
      init.body = JSON.stringify(req.body || {});
    }

    const resp = await fetch(url.toString(), init);
    const text = await resp.text();

    try {
      return res.status(resp.status).json(JSON.parse(text));
    } catch {
      return res.status(resp.status).send(text);
    }

  } catch (e) {
    return res.status(500).json({ ok:false, message: e.message });
  }
}
