import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// Helper: check if user is owner or admin of the project
async function isOwnerOrAdmin(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === 'admin') return true;
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT owner_id FROM projects WHERE id = ?',
    args: [projectId]
  });
  if (res.rows.length === 0) return false;
  return (res.rows[0] as any).owner_id?.toString() === userId;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const allowed = await isOwnerOrAdmin(user.sub, user.role, params.id);
    if (!allowed) return NextResponse.json({ error: '拒絕存取' }, { status: 403 });

    const db = getDb();
    const res = await db.execute({
      sql: `
        SELECT u.id, u.username, u.role,
               CASE WHEN pm.user_id IS NOT NULL THEN 1 ELSE 0 END as is_member
        FROM users u
        LEFT JOIN project_members pm ON u.id = pm.user_id AND pm.project_id = ?
        WHERE u.role != 'admin'  -- 管理員不能被加入成員列表（隱身保障）
        ORDER BY u.username
      `,
      args: [params.id]
    });
    const memberIds = res.rows.filter((r: any) => r.is_member).map((r: any) => r.user_id || r.id);
    return NextResponse.json({ memberIds, allEligibleUsers: res.rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const allowed = await isOwnerOrAdmin(user.sub, user.role, params.id);
    if (!allowed) return NextResponse.json({ error: '拒絕存取' }, { status: 403 });

    const { memberIds } = await request.json(); // Array of user IDs

    // 安全防護：過濾掉任何 admin 帳號，確保管理員永遠不會被寫入 project_members
    const db = getDb();
    const adminCheck = await db.execute(`SELECT id FROM users WHERE role = 'admin'`);
    const adminIds = new Set(adminCheck.rows.map((r: any) => r.id?.toString()));
    const safeMemberIds = (memberIds as string[]).filter(id => !adminIds.has(id.toString()));

    // libSQL transaction by batch
    const queries: any[] = [];
    queries.push({
      sql: 'DELETE FROM project_members WHERE project_id = ?',
      args: [params.id]
    });
    for (const uid of safeMemberIds) {
      queries.push({
        sql: 'INSERT INTO project_members (project_id, user_id) VALUES (?, ?)',
        args: [params.id, uid]
      });
    }
    
    await db.batch(queries, 'write');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
