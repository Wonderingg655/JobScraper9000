<?php
$url = isset($_GET['url']) ? $_GET['url'] : '';

if (!$url) {
  http_response_code(400);
  exit('Missing url parameter');
}

$ch = curl_init();
curl_setopt_array($ch, [
  CURLOPT_URL => $url,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_SSL_VERIFYPEER => false,
  CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  CURLOPT_HTTPHEADER => [
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language: en-US,en;q=0.9',
  ],
  CURLOPT_ENCODING => '',
]);

$html = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($html === false || $html === '') {
  http_response_code(502);
  exit('Proxy error: ' . $error);
}

header('Content-Type: text/html; charset=utf-8');
http_response_code($httpCode);
echo $html;
