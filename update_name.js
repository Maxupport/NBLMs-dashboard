const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });
client.execute("UPDATE projects SET name = '使用者說明＆關於我' WHERE name = '全域歡迎區'")
  .then(() => console.log('success'))
  .catch(console.error);
