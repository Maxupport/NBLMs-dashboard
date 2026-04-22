import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '未授權' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) return NextResponse.json({ error: '缺少頻道 ID' }, { status: 400 });

    const db = await getDb();
    
    // Admin can always access; others must be owner or member
    let hasAccess = false;
    if (user.role === 'admin') {
      hasAccess = true;
    } else {
      const res = await db.execute({
        sql: `
          SELECT 1 FROM projects 
          WHERE (id = ? OR id = (SELECT parent_id FROM projects WHERE id = ?)) 
          AND owner_id = ?
          UNION
          SELECT 1 FROM project_members 
          WHERE (project_id = ? OR project_id = (SELECT parent_id FROM projects WHERE id = ?)) 
          AND user_id = ?
        `,
        args: [projectId, projectId, user.sub, projectId, projectId, user.sub]
      });
      if (res.rows.length > 0) hasAccess = true;
    }

    if (!hasAccess) return NextResponse.json({ error: '拒絕存取' }, { status: 403 });

    const linksRes = await db.execute({
      sql: 'SELECT * FROM notebook_links WHERE project_id = ? ORDER BY sort_order ASC, created_at DESC',
      args: [projectId]
    });
    
    await db.execute({
      sql: 'UPDATE projects SET last_viewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [projectId]
    });
    
    return NextResponse.json({ links: linksRes.rows });
  } catch (error) {
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}

const linkSchema = z.object({
  projectId: z.number().or(z.string().transform(Number)),
  title: z.string().min(1, '標題不得為空'),
  url: z.string().url('必須輸入有效的網址格式'),
  description: z.string().optional(),
  category: z.enum(['ai_tool', 'other']).default('other')
});

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: '請先登入' }, { status: 401 });

    const body = await request.json();
    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { projectId, title, url, description, category } = parsed.data;

    const db = await getDb();

    // 驗證：必須是 admin 或該專案的 owner_id 才能寫入連結
    let canWrite = false;
    if (user.role === 'admin') {
      canWrite = true;
    } else {
      const res = await db.execute({
        sql: `
          SELECT 1 FROM projects 
          WHERE (id = ? OR id = (SELECT parent_id FROM projects WHERE id = ?)) 
          AND owner_id = ?
        `,
        args: [projectId, projectId, user.sub]
      });
      if (res.rows.length > 0) canWrite = true;
    }

    if (!canWrite) return NextResponse.json({ error: '只有頻道建立者或管理員可以新增連結' }, { status: 403 });

    const result = await db.execute({
      sql: `INSERT INTO notebook_links (project_id, title, url, description, category) VALUES (?, ?, ?, ?, ?)`,
      args: [projectId, title, url, description || '', category]
    });

    return NextResponse.json({ success: true, linkId: result.lastInsertRowid?.toString() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
