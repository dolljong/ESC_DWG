<?php
/**
 * Throwaway probe — confirms this host can run the proxy.
 * PHP 4 syntax throughout, so it reports rather than dying on an old
 * interpreter. Delete once chat.php works.
 */
header('Content-Type: text/plain; charset=utf-8');

echo "php=" . phpversion() . "\n";
echo "curl=" . (function_exists('curl_init') ? 'yes' : 'NO') . "\n";
echo "json=" . (function_exists('json_encode') ? 'yes' : 'NO') . "\n";

// In old PHP curl_version() returns a string, not an array.
if (function_exists('curl_version')) {
    $v = curl_version();
    echo "curl_version=" . (is_array($v) ? $v['version'] . ' ' . $v['ssl_version'] : $v) . "\n";
}

$ca = dirname(__FILE__) . '/cacert.pem';
echo "cacert_present=" . (file_exists($ca) ? 'yes (' . filesize($ca) . " bytes)" : 'NO') . "\n";
echo "secrets_present=" . (file_exists(dirname(__FILE__) . '/secrets.php') ? 'yes' : 'NO') . "\n";

if (!function_exists('curl_init')) exit;

/** Try reaching OpenRouter, optionally pinning our own CA bundle. */
function probe($label, $useCa)
{
    $ch = curl_init('https://openrouter.ai/api/v1/models');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_NOBODY, 1);
    if ($useCa) {
        $ca = dirname(__FILE__) . '/cacert.pem';
        if (!file_exists($ca)) { echo $label . "=skipped (no cacert.pem)\n"; return; }
        curl_setopt($ch, CURLOPT_CAINFO, $ca);
    }
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
    $ok = curl_exec($ch);
    echo $label . '=' . ($ok === false
        ? 'FAIL: ' . curl_error($ch)
        : 'ok HTTP ' . curl_getinfo($ch, CURLINFO_HTTP_CODE)) . "\n";
    curl_close($ch);
}

probe('tls_host_castore', false);   // the host's own bundle — expected to fail
probe('tls_with_cacert', true);     // with the bundle we shipped — must succeed
