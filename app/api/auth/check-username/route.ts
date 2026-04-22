import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: '缺少帳號參數' }, { status: 400 });
    }

    const db = await getDb();
    const res = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username]
    });

    const exists = res.rows.length > 0;

    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
