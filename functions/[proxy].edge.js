export default async function handler(request, context) {
    const response = await fetch(request);
    let modifiedResponse = response.clone();
    const contentType = response.headers.get('content-type');
  
    if (contentType && contentType.includes('text/html')) {
      let html = await response.text();
  
      // Access environment variable for Google Analytics key
      const googleAnalyticsKey = context.env.GOOGLE_ANALYTICS_KEY;
  
      // Google Analytics tracking code with environment variable
      const googleAnalyticsScript = `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsKey}"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${googleAnalyticsKey}');
        </script>
      `;
  
      // Insert the Google Analytics script before the closing </head> tag
      html = html.replace('</head>', `${googleAnalyticsScript}</head>`);
  
      modifiedResponse = new Response(html, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }
  
    return modifiedResponse;
  }
  