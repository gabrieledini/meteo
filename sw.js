const CACHE="meteo-vr-v22";
const ASSETS=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
];

self.addEventListener("install",e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}).then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  const isApi=url.hostname.endsWith("open-meteo.com");
  // le function (allerta ufficiale + telegram) devono sempre passare dalla rete
  const isFunc=url.pathname.includes("/.netlify/functions/");
  if(isFunc) return; // niente intercettazione SW

  if(isApi){
    // network-first: dati freschi, fallback alla cache se offline
    e.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }).catch(()=>caches.match(req))
    );
  } else {
    // cache-first per gli asset statici
    e.respondWith(
      caches.match(req).then(hit=>hit||fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }))
    );
  }
});

// ---- notifiche push ----
self.addEventListener("push", e=>{
  let d={};
  try{ d=e.data ? e.data.json() : {}; }catch(_){ d={ body: e.data ? e.data.text() : "" }; }
  const title=d.title||"Allerta meteo Toscana";
  const opts={
    body:d.body||"Nuova allerta pubblicata sul canale.",
    icon:"icon-192.png", badge:"icon-192.png",
    tag:"allerta-meteo", renotify:true,
    data:{ url:d.url||"./" }
  };
  e.waitUntil(self.registration.showNotification(title,opts));
});
self.addEventListener("notificationclick", e=>{
  e.notification.close();
  const url=(e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(wins=>{
      for(const w of wins){ if("focus" in w){ w.navigate && w.navigate(url); return w.focus(); } }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
