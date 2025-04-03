export default async function handler(request, context) {
  const response = await fetch(request);
  let modifiedResponse = response.clone();
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('text/html')) {
    let html = await response.text();
    const lyticsKey = context.env.LYTICS_KEY;

    // Framework-agnostic Lytics tracking injection
    const lyticsScript = `
      <script type="text/javascript">
        (function(){
          // Set up jstag preload queue
          window.jstag = window.jstag || {};
          window._lyticsQueue = [];
          const queueFunc = (fn) => {
            window.jstag[fn] = (...args) => {
              window._lyticsQueue.push([fn, args]);
            };
          };
          ["send","mock","identify","pageView","unblock","getid","setid","loadEntity","getEntity","on","once","call"].forEach(queueFunc);

          const lytics = document.createElement("script");
          lytics.src = "https://c.lytics.io/api/tag/${lyticsKey}/latest.min.js";
          lytics.async = true;
          lytics.onload = () => {
            // Replay pre-init API calls
            window._lyticsQueue.forEach(([fn, args]) => {
              try { window.jstag[fn](...args); } catch(e) { console.warn("[Lytics] Failed:", fn, e); }
            });
            window._lyticsQueue = [];

            // Initial pageView
            jstag.pageView();

            // Main tracking function
            const triggerLytics = () => {
              console.log("[Lytics] Route changed:", location.pathname);
              jstag.pageView();
              if (jstag.loadEntity) {
                jstag.config.pathfora = jstag.config.pathfora || {};
                jstag.config.pathfora.publish = {
                  candidates: { experiences: [], variations: [], legacyABTests: [] }
                };
                window._pfacfg = {};
                if (window.pathfora && window.pathfora.clearAll) {
                  window.pathfora.clearAll();
                }
                jstag.loadEntity((profile) => {
                  console.log("[Lytics] Profile loaded", profile?.data || {});
                });
              }
            };

            // History API patching
            const patchHistory = () => {
              const wrap = (fn) => function() {
                const result = fn.apply(this, arguments);
                window.dispatchEvent(new Event("lytics:navigation"));
                return result;
              };
              history.pushState = wrap(history.pushState);
              history.replaceState = wrap(history.replaceState);
            };

            // Pathname polling fallback
            let lastPath = location.pathname;
            setInterval(() => {
              if (location.pathname !== lastPath) {
                lastPath = location.pathname;
                window.dispatchEvent(new Event("lytics:navigation"));
              }
            }, 400);

            // DOM observer fallback (for router-in-DOM setups)
            const observer = new MutationObserver(() => {
              const newPath = location.pathname;
              if (newPath !== lastPath) {
                lastPath = newPath;
                window.dispatchEvent(new Event("lytics:navigation"));
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // Hook all tracking methods
            window.addEventListener("lytics:navigation", triggerLytics);
            patchHistory();

            console.log("[Lytics] SPA tracking enabled");
          };

          document.head.appendChild(lytics);
        })();
      </script>
    `;

    // Inject just before </head>
    html = html.replace('</head>', `${lyticsScript}</head>`);

    modifiedResponse = new Response(html, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  return modifiedResponse;
}
