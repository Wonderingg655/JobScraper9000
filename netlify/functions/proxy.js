const https = require('https');

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

exports.handler = async (event) => {
  try {
    const targetUrl = event.queryStringParameters.url;
    if (!targetUrl) {
      return { statusCode: 400, headers: CORS_HEADERS, body: 'Missing url param' };
    }

    let u;
    try { u = new URL(targetUrl); }
    catch (e) {
      return { statusCode: 400, headers: CORS_HEADERS, body: 'Bad URL: ' + e.message };
    }

    const body = await new Promise((resolve, reject) => {
      const req = https.get({
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, html: data }));
      });
      req.on('timeout', () => { req.destroy(); resolve({ status: 504, html: 'Gateway timeout' }); });
      req.on('error', (err) => resolve({ status: 502, html: 'Proxy error: ' + err.message }));
    });

    return {
      statusCode: body.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
      body: body.html
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: 'Internal error: ' + err.message };
  }
};
