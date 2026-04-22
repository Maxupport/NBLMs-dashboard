import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// GET: 取出目前登入者「具備權限」的專案清單
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const db = await getDb();
    let projects;

    if (user.role === 'admin') {
      // Admin can see ALL projects with owner info
      const res = await db.execute(`
        SELECT p.*, 
               CASE WHEN u.role = 'admin' THEN u.username || ' (管理員)' ELSE u.username END as owner_username 
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        ORDER BY p.sort_order ASC, p.created_at DESC
      `);
      projects = res.rows;
    } else {
      // Member 看見：自己建立(owner_id)的 OR 被加入授權(project_members)的
      const res = await db.execute({
        sql: `
          SELECT DISTINCT p.*, 
                 CASE WHEN u.role = 'admin' THEN u.username || ' (管理員)' ELSE u.username END as owner_username
          FROM projects p
          LEFT JOIN users u ON p.owner_id = u.id
          LEFT JOIN project_members pm ON p.id = pm.project_id
          WHERE p.owner_id = ? 
             OR pm.user_id = ? 
             OR p.is_global_welcome = 1
             OR p.parent_id IN (SELECT id FROM projects WHERE owner_id = ?)
             OR p.parent_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
          ORDER BY p.sort_order ASC, p.created_at DESC
        `,
        args: [user.sub, user.sub, user.sub, user.sub]
      });
      projects = res.rows;
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

const projectSchema = z.object({
  name: z.string().min(1, '專案名稱不得為空'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parent_id: z.number().nullable().optional()
});

// POST: 建立新專案（任何登入使用者皆可）
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    // 任何登入使用者都能建立專案
    if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const body = await request.json();
    const parsed = projectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { name, description, icon, color, parent_id } = parsed.data;

    const db = await getDb();
    
    // Check channel limit for members (only for parent channels)
    if (user.role !== 'admin' && !parent_id) {
      const limitRes = await db.execute({
        sql: 'SELECT COUNT(*) as count FROM projects WHERE owner_id = ? AND parent_id IS NULL',
        args: [user.sub]
      });
      const currentCount = parseInt((limitRes.rows[0]?.count as any) || 0);
      if (currentCount >= 10) {
        return NextResponse.json({ error: '一般成員最多只能建立 10 個頂層頻道專案' }, { status: 403 });
      }
    }

    // Get max sort_order within the same level
    const maxSortRes = await db.execute({
      sql: 'SELECT MAX(sort_order) as maxOrder FROM projects WHERE (parent_id = ? OR (? IS NULL AND parent_id IS NULL))',
      args: [parent_id || null, parent_id || null]
    });
    const nextOrder = (parseInt((maxSortRes.rows[0]?.maxOrder as any) || 0)) + 1;

    const result = await db.execute({
      sql: `INSERT INTO projects (name, description, icon, color, owner_id, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [name, description || '', icon || '📁', color || '#6366f1', user.sub, nextOrder, parent_id || null]
    });

    return NextResponse.json({ success: true, projectId: result.lastInsertRowid?.toString() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
