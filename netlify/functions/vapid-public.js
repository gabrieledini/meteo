// Espone la chiave VAPID pubblica (presa da env var) al frontend.
// La pubblica non è un segreto: così però le chiavi stanno in un solo posto (Netlify).
// Endpoint: /.netlify/functions/vapid-public
exports.handler = async () => {
  const key = process.env.VAPID_PUBLIC_KEY || "";
  return {
    statusCode: 200,
    headers: { "Content-Type":"application/json", "Cache-Control":"public, max-age=3600", "Access-Control-Allow-Origin":"*" },
    body: JSON.stringify({ ok: !!key, key })
  };
};
