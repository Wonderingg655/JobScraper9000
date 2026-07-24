exports.handler = async (event) => {
  const url = event.queryStringParameters.url;
  if (!url) return { statusCode: 400, body: 'Missing url param' };

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });
    const body = await resp.text();
    return {
      statusCode: resp.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body
    };
  } catch (err) {
    return { statusCode: 502, body: 'Proxy fetch failed: ' + err.message };
  }
};
