export default async function handler(request, context) {
  const response = await fetch(request);
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    const lyticsKey = context.env.LYTICS_KEY;
    let html = await response.text();

    const lyticsScript = `
      <script>
        (function(){
          // Setup Lytics API queue
          window.jstag = window.jstag || {};
          window._lyticsQueue = [];
          ["send","mock","identify","pageView","unblock","getid","setid","loadEntity","getEntity","on","once","call"]
            .forEach(fn => {
              window.jstag[fn] = (...args) => {
                window._lyticsQueue.push([fn, args]);
              };
            });

          const loadLytics = () => {
            const script = document.createElement("script");
            script.src = "https://c.lytics.io/api/tag/${lyticsKey}/latest.min.js";
            script.async = true;
            script.onload = () => {
              // Replay queued calls
              window._lyticsQueue.forEach(([fn, args]) => {
                try { window.jstag[fn](...args); } catch (e) { console.warn("[Lytics] Failed:", fn); }
              });
              window._lyticsQueue = [];

              jstag.pageView();
              console.log("[Lytics] pageView sent:", location.pathname);

              const trigger = () => {
                jstag.pageView();
                if (jstag.loadEntity) {
                  jstag.config.pathfora = jstag.config.pathfora || {};
                  jstag.config.pathfora.publish = {
                    candidates: { experiences: [], variations: [], legacyABTests: [] }
                  };
                  window._pfacfg = {};
                  if (window.pathfora?.clearAll) window.pathfora.clearAll();
                  jstag.loadEntity(p => console.log("[Lytics] Profile refreshed", p?.data || {}));
                }
              };

              const patchRouter = () => {
                const wrap = (fn) => function() {
                  const r = fn.apply(this, arguments);
                  window.dispatchEvent(new Event("lytics:navigation"));
                  return r;
                };
                history.pushState = wrap(history.pushState);
                history.replaceState = wrap(history.replaceState);
              };

              const observeDOM = () => {
                let lastPath = location.pathname;
                setInterval(() => {
                  if (location.pathname !== lastPath) {
                    lastPath = location.pathname;
                    window.dispatchEvent(new Event("lytics:navigation"));
                  }
                }, 500);

                const mo = new MutationObserver(() => {
                  const path = location.pathname;
                  if (path !== lastPath) {
                    lastPath = path;
                    window.dispatchEvent(new Event("lytics:navigation"));
                  }
                });
                mo.observe(document.body, { childList: true, subtree: true });
              };

              window.addEventListener("lytics:navigation", trigger);
              patchRouter();
              observeDOM();
              console.log("[Lytics] SPA route tracking ready.");
            };
            document.head.appendChild(script);
          };

          if ('requestIdleCallback' in window) {
            requestIdleCallback(loadLytics);
          } else {
            window.addEventListener("load", loadLytics);
          }
        })();
      </script>
    `;

    // Inject before </head>
    html = html.replace('</head>', `${lyticsScript}</head>`);
    return new Response(html, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
  return response;
}
