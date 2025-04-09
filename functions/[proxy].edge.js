export default async function handler(request, context) {
  const response = await fetch(request);
  let modifiedResponse = response.clone();
  const contentType = response.headers.get('content-type');

  if (contentType && contentType.includes('text/html')) {
    let html = await response.text();

    const lyticsKey = context.env.LYTICS_KEY;

    const lyticsScript = `
      <script type="text/javascript">
        (function(){
          // Inject Lytics loader only when browser is idle (or fallback to load)
          const initLytics = () => {
            // Lytics bootstrap
            !function(){
              "use strict";
              var o=window.jstag||(window.jstag={}),r=[];
              function n(e){
                o[e]=function(){
                  for(var n=arguments.length,t=new Array(n),i=0;i<n;i++)t[i]=arguments[i];
                  r.push([e,t])
                }
              }
              n("send"),n("mock"),n("identify"),n("pageView"),n("unblock"),n("getid"),
              n("setid"),n("loadEntity"),n("getEntity"),n("on"),n("once"),n("call"),
              o.loadScript=function(n,t,i){
                var e=document.createElement("script");
                e.async=!0,e.src=n,e.onload=t,e.onerror=i;
                var o=document.getElementsByTagName("script")[0],r=o&&o.parentNode||document.head||document.body,
                    c=o||r.lastChild;
                return null!=c?r.insertBefore(e,c):r.appendChild(e),this
              },
              o.init=function n(t){
                return this.config=t,this.loadScript(t.src,function(){
                  if(o.init===n)throw new Error("Load error!");
                  o.init(o.config),function(){
                    for(var n=0;n<r.length;n++){
                      var t=r[n][0],i=r[n][1];
                      o[t].apply(o,i)
                    }
                    r=void 0
                  }()
                }),this
              }
            }();

            // Init Lytics
            jstag.init({
              src: 'https://c.lytics.io/api/tag/${lyticsKey}/latest.min.js',
            });

            // Initial pageView
            jstag.pageView();
            console.log("[Lytics] Initial pageView sent:", location.pathname);

            // Debounce repeated route changes
            let lastPath = location.pathname;

            const triggerLytics = () => {
              if (location.pathname === lastPath) return;
              lastPath = location.pathname;
              console.log("[Lytics] Route changed:", lastPath);

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
                jstag.loadEntity(function(profile) {
                  console.log("[Lytics] Profile refreshed", profile?.data || {});
                });
              }
            };

            // SPA routing hooks
            const wrapHistory = (fn) => function(){
              const result = fn.apply(this, arguments);
              window.dispatchEvent(new Event('lytics:navigation'));
              return result;
            };
            history.pushState = wrapHistory(history.pushState);
            history.replaceState = wrapHistory(history.replaceState);
            window.addEventListener("popstate", () => {
              window.dispatchEvent(new Event('lytics:navigation'));
            });

            // Bind trigger to navigation event
            window.addEventListener("lytics:navigation", triggerLytics);
          };

          if ('requestIdleCallback' in window) {
            requestIdleCallback(initLytics);
          } else {
            window.addEventListener("load", initLytics);
          }
        })();
      </script>
    `;

    // Inject script before </head>
    html = html.replace('</head>', `${lyticsScript}</head>`);

    modifiedResponse = new Response(html, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  return modifiedResponse;
}
