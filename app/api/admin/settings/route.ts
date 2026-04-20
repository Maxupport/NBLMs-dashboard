import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

async function checkAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const res = await db.execute("SELECT key, value FROM system_settings");
    const settings = res.rows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const { key, value } = await request.json();
    if (!key || value === undefined) return NextResponse.json({ error: '參數不齊全' }, { status: 400 });

    const db = getDb();
    await db.execute({
      sql: 'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
      args: [key, value.toString(), value.toString()]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
