// Runs at Vercel build time.
// If GOOGLE_CLIENT_ID is present in the environment, it overwrites calendar-config.js.
// If not, calendar-config.js is left as-is so a manually-pasted value survives redeploys.
const fs = require('fs');
const clientId = process.env.GOOGLE_CLIENT_ID || '';
if (clientId) {
  fs.writeFileSync(
    'calendar-config.js',
    `window.GCAL_CONFIG = ${JSON.stringify({ clientId })};\n`
  );
  console.log('calendar-config.js written from GOOGLE_CLIENT_ID env var.');
} else {
  console.log('GOOGLE_CLIENT_ID not set in build env — calendar-config.js left unchanged.');
}
