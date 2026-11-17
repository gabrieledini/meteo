// Function schedulata: controlla se c'è una nuova allerta sul canale Telegram
// e invia una notifica push a tutti gli iscritti. Evita i duplicati memorizzando
// l'ultima allerta già notificata.
// Schedule impostato in netlify.toml (ogni 15 minuti).
const { getStore } = require("@netlify/blobs");
const webpush = require("web-push");

exports.handler = async () => {
  try{
    if(!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY){
      console.warn("Chiavi VAPID non impostate: push non inviabili.");
      return { statusCode:200, body:"no vapid keys" };
    }
    webpush.setVapidDetails("mailto:allerte@meteo-toscana.local", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

    // 1) leggi l'ultima allerta tramite la function telegram (stesso sito)
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL || "";
    const r = await fetch(`${base}/.netlify/functions/telegram`);
    const data = await r.json();
    if(!data.ok || !data.allerta){
      return { statusCode:200, body:"nessuna allerta attiva" };
    }
    const a = data.allerta;
    const id = a.link || String(a.ts); // identificatore univoco del post

    // 2) confronta con l'ultima notificata
    const stateStore = getStore("push-state");
    const last = await stateStore.get("last-notified");
    if(last === id){
      return { statusCode:200, body:"già notificata" };
    }

    // 3) invia push a tutti gli iscritti
    const subStore = getStore("push-subs");
    const { blobs } = await subStore.list();
    const payload = JSON.stringify({
      title: "⚠ Allerta meteo Toscana",
      body: (a.testo||"Nuova allerta pubblicata.").slice(0,180),
      url: a.link ? `https://t.me/${a.link}` : "./"
    });

    let inviate=0, rimosse=0;
    for(const b of blobs){
      const sub = await subStore.get(b.key, { type:"json" });
      if(!sub) continue;
      try{
        await webpush.sendNotification(sub, payload);
        inviate++;
      }catch(err){
        // subscription scaduta/non valida -> rimuovi
        if(err.statusCode===404 || err.statusCode===410){ await subStore.delete(b.key); rimosse++; }
        else console.warn("push err", err.statusCode, err.body);
      }
    }

    // 4) segna come notificata
    await stateStore.set("last-notified", id);
    return { statusCode:200, body:`notificate ${inviate}, rimosse ${rimosse}` };
  }catch(e){
    console.error("allerta-push:", e);
    return { statusCode:200, body:"errore: "+e.message };
  }
};
