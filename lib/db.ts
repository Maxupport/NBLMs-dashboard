import { createClient, Client } from '@libsql/client';

let _db: Client | null = null;
let _initPromise: Promise<void> | null = null;

export async function getDb(): Promise<Client> {
  if (!_db) {
    // 建立連線：優先使用環境變數設定的 Turso URL。
    // 若未設定，則使用本機檔案庫便於開發階段測試。
    const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

    _db = createClient({
      url,
      authToken,
    });

    _initPromise = initSchema(_db);
  }

  // 確保 schema 初始化完成後才回傳（避免 Vercel Serverless cold-start race condition）
  await _initPromise;
  return _db;
}

async function initSchema(db: Client) {
  try {
    // libSQL 不支援一次執行多個語句 (Transaction 若要用 executeMultiple 必須分開或用 batch)
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        username    TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'member', 
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS registration_applications (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        username     TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email        TEXT NOT NULL,
        note         TEXT,
        status       TEXT DEFAULT 'pending', 
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        description TEXT,
        icon        TEXT DEFAULT '📁',
        color       TEXT DEFAULT '#6366f1',
        owner_id    INTEGER NOT NULL,
        sort_order  INTEGER DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS project_members (
        project_id  INTEGER NOT NULL,
        user_id     INTEGER NOT NULL,
        PRIMARY KEY (project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notebook_links (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id  INTEGER NOT NULL,
        title       TEXT NOT NULL,
        url         TEXT NOT NULL,
        description TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);

    // 檢查是否有管理員
    const res = await db.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (res.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('maxupport1238', 12);
      await db.execute({
        sql: "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
        args: ['Maxupport', hash]
      });
      console.log('✅ 預設管理員帳號已建立：Maxupport / maxupport1238');
    }

    try {
      await db.execute('ALTER TABLE projects ADD COLUMN is_global_welcome INTEGER DEFAULT 0');
    } catch (e) {
      // Column might already exist, safe to ignore
    }

    // ─────────────────────────────
    // 版本二：進階後台升級 Schema
    // ─────────────────────────────
    try {
      await db.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
    } catch (e) {}

    try {
      await db.execute("ALTER TABLE users ADD COLUMN last_login_at DATETIME");
    } catch (e) {}

    try {
      await db.execute("ALTER TABLE users ADD COLUMN email TEXT");
    } catch (e) {}

    try {
      await db.execute("ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'");
    } catch (e) {}

    try {
      await db.execute("ALTER TABLE projects ADD COLUMN last_viewed_at DATETIME");
    } catch (e) {}

    try {
      await db.execute("ALTER TABLE notebook_links ADD COLUMN sort_order INTEGER DEFAULT 0");
    } catch (e) {}

    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER,
        content     TEXT NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL
      );
    `);

    // 初始化設定：留言板預設為開啟
    const fbSettingRes = await db.execute("SELECT key FROM system_settings WHERE key = 'feedback_board_open'");
    if (fbSettingRes.rows.length === 0) {
      await db.execute({
        sql: "INSERT INTO system_settings (key, value) VALUES ('feedback_board_open', 'true')",
        args: []
      });
    }

    // 確保有全域歡迎區專案
    const welcomeRes = await db.execute("SELECT id FROM projects WHERE is_global_welcome = 1");
    if (welcomeRes.rows.length === 0) {
      const adminRes = await db.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
      if (adminRes.rows.length > 0) {
        await db.execute({
          sql: "INSERT INTO projects (name, description, icon, owner_id, is_global_welcome) VALUES ('全域歡迎區', '系統預設配置的全域存取空間', '🌟', ?, 1)",
          args: [adminRes.rows[0].id]
        });
        console.log('✅ 預設全域歡迎區專案已建立');
      }
    }
  } catch (err) {
    console.error('Database Init Error:', err);
  }
}
