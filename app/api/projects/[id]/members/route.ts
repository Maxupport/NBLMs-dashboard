import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// Helper: check if user is owner or admin of the project
async function isOwnerOrAdmin(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === 'admin') return true;
  const db = await getDb();
  const res = await db.execute({
    sql: `
      SELECT 1 FROM projects 
      WHERE id = ? AND (owner_id = ? OR parent_id IN (SELECT id FROM projects WHERE owner_id = ?))
    `,
    args: [projectId, userId, userId]
  });
  return res.rows.length > 0;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const allowed = await isOwnerOrAdmin(user.sub, user.role, params.id);
    if (!allowed) return NextResponse.json({ error: '拒絕存取' }, { status: 403 });

    const db = await getDb();
    
    // 如果不是管理員，只能看到「已經是該頻道成員」的使用者資料
    const sqlCondition = user.role === 'admin' ? "u.role != 'admin'" : "u.role != 'admin' AND pm.user_id IS NOT NULL";
    
    const res = await db.execute({
      sql: `
        SELECT u.id, u.username, u.role as user_global_role, pm.role as project_role,
               CASE WHEN pm.user_id IS NOT NULL THEN 1 ELSE 0 END as is_member
        FROM users u
        LEFT JOIN project_members pm ON u.id = pm.user_id AND pm.project_id = ?
        WHERE ${sqlCondition}
        ORDER BY u.username
      `,
      args: [params.id]
    });
    // Return objects with id and role for existing members
    const members = res.rows
      .filter((r: any) => r.is_member)
      .map((r: any) => ({ id: r.id, role: r.project_role || 'viewer' }));
    
    return NextResponse.json({ members, allEligibleUsers: res.rows });
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

    const { members } = await request.json(); // Array of {id, role}

    // 安全防護：過濾掉任何 admin 帳號，確保管理員永遠不會被寫入 project_members
    const db = await getDb();
    const adminCheck = await db.execute(`SELECT id FROM users WHERE role = 'admin'`);
    const adminIds = new Set(adminCheck.rows.map((r: any) => r.id?.toString()));
    const safeMembers = (members as any[]).filter(m => !adminIds.has(m.id?.toString()));

    // libSQL transaction by batch
    const queries: any[] = [];
    queries.push({
      sql: 'DELETE FROM project_members WHERE project_id = ?',
      args: [params.id]
    });
    for (const m of safeMembers) {
      queries.push({
        sql: 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
        args: [params.id, m.id, m.role || 'viewer']
      });
    }
    
    await db.batch(queries, 'write');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
