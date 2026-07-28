<?php
/**
 * OpenRouter proxy — written for PHP 4.
 *
 * The target host runs PHP 4.4.9 with no json extension, so this file uses no
 * type hints, no `??`, no const, no closures, and no json_encode/json_decode.
 * Its 2008-era CA bundle also rejects OpenRouter's certificate as expired, so
 * a current cacert.pem is shipped alongside and pinned via CURLOPT_CAINFO.
 *
 * Contract matches the Vite dev middleware in web/vite.config.mjs: POST a
 * chat-completions body, get OpenRouter's reply back untouched.
 *
 * Install: upload chat.php, cacert.pem and secrets.php to <site>/api/llm/.
 */

define('OPENROUTER',  'https://openrouter.ai/api/v1/chat/completions');
define('MODEL_ID',    'deepseek/deepseek-v4-flash');
define('MAX_TOKENS',  16000);
define('TIMEOUT_SEC', 120);

header('Content-Type: application/json; charset=utf-8');

/** Emit a JSON error and stop. Hand-built, because json_encode does not exist. */
function fail($status, $message)
{
    $texts = array(
        400 => 'Bad Request', 405 => 'Method Not Allowed',
        500 => 'Internal Server Error', 502 => 'Bad Gateway',
    );
    $text = isset($texts[$status]) ? $texts[$status] : 'Error';
    header('HTTP/1.1 ' . $status . ' ' . $text);

    // Escape the few characters that can break a JSON string literal.
    $safe = str_replace(
        array('\\', '"', "\r", "\n", "\t"),
        array('\\\\', '\\"', '\\r', '\\n', '\\t'),
        $message
    );
    echo '{"error":{"message":"' . $safe . '"}}';
    exit;
}

// ── Method ──────────────────────────────────────────────────────────────────
if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] != 'POST') {
    fail(405, 'POST only');
}

// ── Key ─────────────────────────────────────────────────────────────────────
// secrets.php only returns a string, so requesting it directly outputs nothing.
$key = getenv('OPENROUTER_API_KEY');
if (!$key) {
    $secrets = dirname(__FILE__) . '/secrets.php';
    if (file_exists($secrets)) {
        $value = include $secrets;
        if (is_string($value)) $key = trim($value);
    }
}
if (!$key) {
    fail(500, 'Server is missing OPENROUTER_API_KEY (set the env var or create secrets.php).');
}

// ── Request body ────────────────────────────────────────────────────────────
$raw = '';
$fp = @fopen('php://input', 'r');
if ($fp) {
    while (!feof($fp)) $raw .= fread($fp, 8192);
    fclose($fp);
}
if ($raw === '' && isset($GLOBALS['HTTP_RAW_POST_DATA'])) {
    $raw = $GLOBALS['HTTP_RAW_POST_DATA']; // PHP 4 fallback
}
if ($raw === '') fail(400, 'Empty request body');

$trimmed = ltrim($raw);
if (substr($trimmed, 0, 1) != '{') fail(400, 'Request body must be a JSON object');

// ── Spend guard ─────────────────────────────────────────────────────────────
// Without a JSON parser the model is checked textually. Requiring exactly one
// occurrence of "model" means the one the parser will see is the one checked
// here — a second copy hidden in message content would be rejected outright.
$modelCount = substr_count($raw, '"model"');
if ($modelCount != 1) {
    fail(400, 'Request must name exactly one model.');
}
if (!preg_match('#"model"\s*:\s*"' . preg_quote(MODEL_ID, '#') . '"#', $raw)) {
    fail(400, 'Only ' . MODEL_ID . ' is allowed here.');
}
// These must be server-controlled, so refuse a body that already sets them
// rather than trying to rewrite JSON with string surgery.
if (strpos($raw, '"max_tokens"') !== false || strpos($raw, '"stream"') !== false) {
    fail(400, 'max_tokens and stream may not be set by the client.');
}

// Safe because the body is a JSON object and neither key is present.
$payload = '{"max_tokens":' . MAX_TOKENS . ',"stream":false,' . substr($trimmed, 1);

// ── Forward ─────────────────────────────────────────────────────────────────
$scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] && $_SERVER['HTTPS'] != 'off') ? 'https' : 'http';
$host   = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';

$ch = curl_init(OPENROUTER);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_TIMEOUT, TIMEOUT_SEC);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Content-Type: application/json',
    'Authorization: Bearer ' . $key,
    'HTTP-Referer: ' . $scheme . '://' . $host,
    'X-Title: ESC_DWG',
    'Expect:', // old curl adds "Expect: 100-continue" and then stalls
));

// The host's own CA bundle predates every current root certificate.
$ca = dirname(__FILE__) . '/cacert.pem';
if (file_exists($ca)) {
    curl_setopt($ch, CURLOPT_CAINFO, $ca);
}
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 1);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

$response = curl_exec($ch);
$status   = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($response === false || $response === '') {
    fail(502, 'Upstream request failed: ' . ($curlErr ? $curlErr : 'empty response'));
}

// Pass the payload straight through so the client can unwrap the provider's
// own error message rather than a generic one.
if ($status >= 200 && $status < 600) {
    header('HTTP/1.1 ' . $status . ' Upstream');
}
echo $response;
