// Netlify Function: legge il canale Telegram pubblico lato server (niente CORS,
// niente proxy di terzi), trova l'ultima "allerta" nelle ultime 48h e la
// restituisce come JSON già pronto per la pagina.
// Endpoint: /.netlify/functions/telegram

const CHANNEL = "gianieugenio";
const SOURCE = `https://t.me/s/${CHANNEL}`;
const WINDOW_MS = 24 * 3600 * 1000; // finestra 24h (durata dell'allerta)

// decodifica le entità HTML più comuni (il testo dei post è HTML-escaped)
function decodeEntities(s){
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")          // togli tag residui
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// estrae i post dal markup di t.me/s/<canale>
function parsePosts(html){
  const posts = [];
  // ogni messaggio è un blocco con class "tgme_widget_message ..."; usiamo i marcatori
  // data-post="canale/NNN" come punti di taglio affidabili.
  const parts = html.split('data-post="');
  for(let i=1;i<parts.length;i++){
    const seg = parts[i];
    const link = seg.slice(0, seg.indexOf('"'));            // es. gianieugenio/12345
    // testo del messaggio
    let txt = "";
    const tMatch = seg.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    if(tMatch) txt = decodeEntities(tMatch[1]);
    // timestamp ISO
    let ts = null;
    const dMatch = seg.match(/datetime="([^"]+)"/);
    if(dMatch){ const t = Date.parse(dMatch[1]); if(!isNaN(t)) ts = t; }
    // immagine (background-image nel wrap foto o thumb video)
    let img = null;
    const iMatch = seg.match(/(?:tgme_widget_message_photo_wrap|tgme_widget_message_video_thumb)[^>]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if(iMatch) img = iMatch[1];
    if(txt || ts) posts.push({ link, txt, ts, img });
  }
  return posts;
}

exports.handler = async function(){
  try{
    const res = await fetch(SOURCE, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MeteoVR/1.0)" }
    });
    if(!res.ok) throw new Error("HTTP "+res.status);
    const html = await res.text();

    const posts = parsePosts(html);
    const now = Date.now();

    // scorri dal più recente: i post sono in ordine cronologico, l'ultimo è in fondo
    let found = null, recenti = 0, fuoriFinestra = 0;
    for(let i = posts.length - 1; i >= 0; i--){
      const p = posts[i];
      if(p.ts == null) continue;
      const isAllerta = /allert/i.test(p.txt);
      if(now - p.ts > WINDOW_MS){ if(isAllerta) fuoriFinestra++; continue; }
      recenti++;
      if(!isAllerta) continue;
      found = p;
      break;
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        ok: true,
        canale: CHANNEL,
        postTotali: posts.length,
        recenti,
        fuoriFinestra,
        allerta: found ? {
          testo: found.txt,
          ts: found.ts,
          link: found.link,       // "gianieugenio/NNNNN"
          img: found.img
        } : null
      })
    };
  }catch(e){
    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ ok:false, error: e.message })
    };
  }
};
