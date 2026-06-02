// Netlify Function: legge la pagina ufficiale Allerta Meteo della Regione Toscana
// lato server (niente CORS), estrae emissione, livelli e mappe del giorno.
// Endpoint risultante: /.netlify/functions/allerta

const SOURCE = "https://www.regione.toscana.it/allertameteo";
const RISKS = ["idrogeologico","idraulico","vento","mareggiate","neve","ghiaccio","temporali"];

// mesi italiani per parsare "Domenica, 31 Maggio 2026, ore 12.09"
const MESI = {gennaio:0,febbraio:1,marzo:2,aprile:3,maggio:4,giugno:5,
              luglio:6,agosto:7,settembre:8,ottobre:9,novembre:10,dicembre:11};

function parseEmissione(html){
  // cerca "Emissione di <giorno>, <gg> <mese> <aaaa>, ore <hh>.<mm>"
  const m = html.match(/Emissione di\s+[^,]+,\s*(\d{1,2})\s+([A-Za-zàèéìòù]+)\s+(\d{4}),\s*ore\s+(\d{1,2})[.:](\d{2})/i);
  if(!m) return null;
  const [,gg,mese,aaaa,hh,mm] = m;
  const mi = MESI[mese.toLowerCase()];
  if(mi===undefined) return null;
  const d = new Date(Number(aaaa), mi, Number(gg), Number(hh), Number(mm));
  return { iso: d.toISOString(), label: m[0].replace(/^Emissione di\s+/i,"") };
}

// NOTA: la pagina elenca sempre la legenda completa (Verde/Giallo/Arancione/Rosso),
// quindi NON è possibile dedurre il livello reale dal testo: il colore per zona
// è codificato solo nelle mappe PNG. Restituiamo le mappe e lasciamo la lettura
// visiva all'utente, segnalando solo che esiste un bollettino fresco.
function emissioneFresca(emissione){
  if(!emissione) return {fresca:false,ageHours:null};
  const ts=new Date(emissione.iso).getTime();
  const ageHours=(Date.now()-ts)/3600000;
  return {fresca: ageHours<=24, ageHours};
}

// costruisce gli URL delle mappe per una certa data (AAAAMMGG)
function mappe(dateObj){
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth()+1).padStart(2,"0");
  const d = String(dateObj.getDate()).padStart(2,"0");
  const stamp = `${y}${m}${d}`;
  const base = "https://www.sir.toscana.it/supports/images/risks_395";
  const r = {};
  for(const k of RISKS) r[k] = `${base}/${stamp}_${k}.png`;
  return { stamp, risks: r };
}

exports.handler = async function(){
  try{
    const res = await fetch(SOURCE, { headers: { "User-Agent": "Mozilla/5.0 MeteoVR" } });
    if(!res.ok) throw new Error("HTTP "+res.status);
    const html = await res.text();

    const emissione = parseEmissione(html);
    const { fresca, ageHours } = emissioneFresca(emissione);

    const oggi = new Date();
    const domani = new Date(Date.now()+86400000);
    const mappeOggi = mappe(oggi);
    const mappeDomani = mappe(domani);

    // mostriamo il banner quando c'è un bollettino emesso nelle ultime 24h.
    // Il livello cromatico per Viareggio si legge sulle mappe (link inclusi).
    const allerta = fresca;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=900",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        ok: true,
        fonte: SOURCE,
        emissione,
        ageHours,
        fresca,
        allerta,
        mappe: { oggi: mappeOggi, domani: mappeDomani }
      })
    };
  }catch(e){
    return {
      statusCode: 200,
      headers: { "Content-Type":"application/json","Access-Control-Allow-Origin":"*" },
      body: JSON.stringify({ ok:false, error: e.message })
    };
  }
};
