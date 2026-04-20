import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

async function checkAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const { status } = await request.json(); // 'active' or 'disabled'

    if (status !== 'active' && status !== 'disabled') {
      return NextResponse.json({ error: '無效的狀態' }, { status: 400 });
    }

    const db = await getDb();
    await db.execute({
      sql: 'UPDATE users SET status = ? WHERE id = ? AND role != \'admin\'',
      args: [status, params.id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
