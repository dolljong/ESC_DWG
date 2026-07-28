<?php
/**
 * Copy to secrets.php beside chat.php and paste your OpenRouter key.
 *
 * This file only returns a string, so requesting it directly in a browser
 * executes it and outputs nothing — the key is not exposed even if the
 * .htaccess deny rule is ignored by the host.
 *
 * Never commit secrets.php.
 */
return 'sk-or-v1-...';
