const https = require('https');

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' };

exports.handler = (event, context, callback) => {
  const targetUrl = event.queryStringParameters.url;
  if (!targetUrl) {
    return callback(null, { statusCode: 400, headers: CORS_HEADERS, body: 'Missing url param' });
  }

  let u;
  try { u = new URL(targetUrl); }
  catch (e) { return callback(null, { statusCode: 400, headers: CORS_HEADERS, body: 'Bad URL: ' + e.message }); }

  const req = https.get({
    hostname: u.hostname,
    port: 443,
    path: u.pathname + u.search,
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      callback(null, {
        statusCode: res.statusCode,
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
        body: data
      });
    });
  });

  req.on('timeout', () => { req.destroy(); callback(null, { statusCode: 504, headers: CORS_HEADERS, body: 'Gateway timeout' }); });
  req.on('error', (err) => callback(null, { statusCode: 502, headers: CORS_HEADERS, body: 'Proxy error: ' + err.message }));
};
