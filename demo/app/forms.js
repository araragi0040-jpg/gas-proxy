export default async function handler(req, res) {
  const gasUrl = process.env.GAS_URL; // 例: https://script.google.com/macros/s/.../exec
  if (!gasUrl) return res.status(500).json({ ok: false, message: "GAS_URL is not set" });

  try {
    if (req.method === "GET") {
      // クエリをそのままGASへ転送（action=config など）
      const qs = new URLSearchParams(req.query).toString();
      const url = qs ? `${gasUrl}?${qs}` : gasUrl;

      const r = await fetch(url, { method: "GET" });
      const text = await r.text(); // GASがエラーHTML返すケースもあるので一旦 text

      // JSONならJSONとして返す
      try {
        const json = JSON.parse(text);
        return res.status(200).json(json);
      } catch {
        return res.status(200).send(text);
      }
    }

    if (req.method === "POST") {
      // GASへPOST（JSON文字列をそのまま投げる）
      const r = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // preflight回避寄り
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });

      const text = await r.text();
      try {
        const json = JSON.parse(text);
        return res.status(200).json(json);
      } catch {
        return res.status(200).send(text);
      }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ ok: false, message: "Method not allowed" });

  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || String(e) });
  }
}
