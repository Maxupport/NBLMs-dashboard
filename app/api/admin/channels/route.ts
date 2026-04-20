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
    if (!await checkAdmin(request)) {
      return NextResponse.json({ error: '拒絕存取' }, { status: 403 });
    }

    const db = getDb();
    const res = await db.execute(`
      SELECT p.*,
             u.username as owner_username,
             u.role as owner_role,
             (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) + 1 AS member_count
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    return NextResponse.json({ channels: res.rows });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
