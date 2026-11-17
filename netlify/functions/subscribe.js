// Salva/rimuove le subscription push in Netlify Blobs.
// Endpoint: /.netlify/functions/subscribe  (POST)
const { getStore } = require("@netlify/blobs");

function json(obj, code=200){
  return { statusCode:code, headers:{ "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }, body:JSON.stringify(obj) };
}
// chiave stabile dall'endpoint (base64url, no caratteri speciali)
function keyFor(endpoint){
  return Buffer.from(endpoint).toString("base64").replace(/[^a-zA-Z0-9]/g,"").slice(0,200);
}

exports.handler = async (event) => {
  if(event.httpMethod!=="POST") return json({ ok:false, error:"method not allowed" }, 405);
  try{
    const body = JSON.parse(event.body||"{}");
    const store = getStore("push-subs");

    if(body.action==="unsubscribe"){
      if(body.endpoint) await store.delete(keyFor(body.endpoint));
      return json({ ok:true });
    }

    const sub = body.subscription;
    if(!sub || !sub.endpoint) return json({ ok:false, error:"subscription mancante" }, 400);
    await store.setJSON(keyFor(sub.endpoint), sub);
    return json({ ok:true });
  }catch(e){
    return json({ ok:false, error:e.message }, 500);
  }
};
