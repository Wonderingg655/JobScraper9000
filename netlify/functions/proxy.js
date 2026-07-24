const https = require('https');

exports.handler = (event, context, callback) => {
  const targetUrl = event.queryStringParameters.url;
  if (!targetUrl) {
    return callback(null, { statusCode: 400, body: 'Missing url param' });
  }

  const u = new URL(targetUrl);
  const options = {
    hostname: u.hostname,
    port: 443,
    path: u.pathname + u.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  };

  https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      callback(null, {
        statusCode: res.statusCode,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        },
        body: data
      });
    });
  }).on('error', (err) => {
    callback(null, { statusCode: 502, body: 'Proxy fetch failed: ' + err.message });
  });
};
