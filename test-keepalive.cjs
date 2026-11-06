const fs = require('fs');
const path = require('path');
const workflow = path.join(__dirname, '.github', 'workflows', 'supabase-keepalive.yml');

if (!fs.existsSync(workflow)) {
  console.error('Missing Supabase keep-alive workflow');
  process.exit(1);
}

const text = fs.readFileSync(workflow, 'utf8');
const required = [
  'schedule:',
  "cron: '17 3 */3 * *'",
  'workflow_dispatch:',
  'SUPABASE_URL: ${{ secrets.SUPABASE_URL }}',
  'SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}',
  '/rest/v1/staff?select=id&limit=1',
  'apikey: $SUPABASE_ANON_KEY',
  'Authorization: Bearer $SUPABASE_ANON_KEY',
  'curl --fail --silent --show-error',
];

const missing = required.filter(item => !text.includes(item));
if (missing.length) {
  console.error('Keep-alive workflow missing: ' + missing.join(', '));
  process.exit(1);
}
if (/service[_-]?role/i.test(text)) {
  console.error('Keep-alive workflow must not use a service-role key');
  process.exit(1);
}
console.log('Keep-alive workflow verified');
