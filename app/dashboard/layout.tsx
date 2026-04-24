"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

import { ProjectProvider, useProjects } from "./ProjectContext";

function Sidebar({ width }: { width: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, selectedProjectId, setSelectedProjectId, userRole, sortMethod, setSortMethod, reorderProjects } = useProjects();
  const [hiddenProjects, setHiddenProjects] = useState<Set<number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_hidden_projects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });
  const [showAllAdmin, setShowAllAdmin] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(new Set());
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const isCollapsed = width <= 100;

  const toggleParentCollapse = (id: number) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id.toString());
  };

  const dragOverIdRef = useRef<number | null>(null);

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (draggedId !== id && dragOverIdRef.current !== id) {
      dragOverIdRef.current = id;
      setDragOverId(id);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (draggedId === null || draggedId === targetId) return;

    const newProjects = [...projects];
    const draggedIdx = newProjects.findIndex(p => p.id === draggedId);
    const targetIdx = newProjects.findIndex(p => p.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [removed] = newProjects.splice(draggedIdx, 1);
      newProjects.splice(targetIdx, 0, removed);
      await reorderProjects(newProjects);
    }
    setDraggedId(null);
    setDragOverId(null);
    dragOverIdRef.current = null;
  };

  const toggleHideProject = (id: number) => {
    setHiddenProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('admin_hidden_projects', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const visibleProjects = userRole === 'admin'
    ? (showAllAdmin ? projects : projects.filter(p => !hiddenProjects.has(p.id)))
    : projects;

  const hiddenCount = hiddenProjects.size;

  const specialProject = visibleProjects.find(p => p.is_global_welcome === 1);
  const ghostProjects = userRole === 'admin' ? visibleProjects.filter(p => p.owner_username === 'Ghost') : [];
  const normalProjects = visibleProjects.filter(p => p.id !== specialProject?.id && p.owner_username !== 'Ghost');

  // Grouping logic: Identify projects that should be top-level in the current view
  const accessibleProjectIds = new Set(normalProjects.map(p => p.id));
  
  const parentProjects = normalProjects.filter(p => {
    if (!p.parent_id) return true;
    if (!accessibleProjectIds.has(p.parent_id)) return true;
    return false;
  });

  const ghostParentProjects = ghostProjects.filter(p => !p.parent_id || !ghostProjects.find(gp => gp.id === p.parent_id));

  const childProjectsMap = visibleProjects.reduce((acc, p) => {
    if (p.parent_id) {
      if (!acc[p.parent_id]) acc[p.parent_id] = [];
      acc[p.parent_id].push(p);
    }
    return acc;
  }, {} as Record<number, any[]>);

  const renderProjectItem = (p: any, isChild = false, parentColor?: string) => {
    const hasChildren = childProjectsMap[p.id] && childProjectsMap[p.id].length > 0;
    const isParentCollapsed = collapsedParents.has(p.id);
    const channelColor = isChild ? (parentColor || p.color || '#6366f1') : (p.color || '#6366f1');

    return (
      <div key={p.id} className="space-y-0.5">
        <div 
          className={`group relative transition-all duration-300 ${draggedId === p.id ? 'opacity-30' : ''} ${dragOverId === p.id ? 'pt-8' : ''} ${isChild && !isCollapsed ? 'ml-4' : ''}`}
          draggable={sortMethod === 'manual'}
          onDragStart={(e) => handleDragStart(e, p.id)}
          onDragOver={(e) => handleDragOver(e, p.id)}
          onDrop={(e) => handleDrop(e, p.id)}
          onDragEnd={() => { setDraggedId(null); setDragOverId(null); dragOverIdRef.current = null; }}
        >
          {dragOverId === p.id && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/50 animate-pulse pointer-events-none" />
          )}
          
          <div className="flex items-center gap-1">
            {/* Collapse Toggle for Parents */}
            {!isCollapsed && !isChild && (
              <button 
                onClick={(e) => { e.stopPropagation(); toggleParentCollapse(p.id); }}
                className={`w-4 h-4 flex items-center justify-center text-[10px] text-white/20 hover:text-white/60 transition-all ${hasChildren ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                <span className={`transition-transform duration-200 ${isParentCollapsed ? '-rotate-90' : ''}`}>▼</span>
              </button>
            )}

            <button
              onClick={() => {
                if (p.status !== 'disabled') {
                  setSelectedProjectId(p.id);
                  if (pathname !== '/dashboard') {
                    router.push(`/dashboard?channel=${p.id}`);
                  }
                }
              }}
              disabled={p.status === 'disabled'}
              title={isCollapsed ? p.name : ""}
              className={`flex-1 text-left transition-all text-sm flex items-center relative interactive-card ${isCollapsed ? 'justify-center p-2 rounded-xl' : 'px-2 py-1.5 rounded-lg gap-2 pr-8'} ${
                p.status === 'disabled' ? 'opacity-60 cursor-not-allowed bg-red-900/10 text-white/40 border border-red-500/10' :
                selectedProjectId === p.id ? 'bg-white/10 text-white border border-white/20 shadow-lg' : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              {!isCollapsed && (
                <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-[1px] bg-white/10 group-hover:bg-white/30 transition-colors ${isChild ? 'w-2.5' : ''}`} />
              )}
              
              {/* Channel Icon: large colored folder for parent, small page icon for child */}
              {isChild ? (
                <span
                  className="shrink-0 flex items-center justify-center w-4 h-4 rounded"
                  style={{ color: channelColor + '99', backgroundColor: channelColor + '1a' }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
              ) : (
                <span
                  className="shrink-0 flex items-center justify-center w-5 h-5 rounded-md"
                  style={{ color: channelColor, backgroundColor: channelColor + '25' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                  </svg>
                </span>
              )}

              {!isCollapsed && <span className={`truncate text-[13px] ${p.status === 'disabled' ? 'line-through' : ''} ${selectedProjectId === p.id ? 'font-medium' : ''}`}>{p.name}</span>}
              
              {!isCollapsed && sortMethod === 'manual' && (
                <span className="opacity-0 group-hover:opacity-40 text-[10px] ml-auto font-mono pointer-events-none">⠿</span>
              )}
            </button>

            {/* Quick Add Sub-channel for Parents */}
            {!isCollapsed && !isChild && (userRole === 'admin' || p.my_role === 'owner') && (
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  window.dispatchEvent(new CustomEvent('open-new-project-modal', { detail: { parent_id: p.id, parent_name: p.name } }));
                }}
                className="p-1 opacity-0 group-hover:opacity-100 text-white/30 hover:text-primary transition-all rounded-md hover:bg-primary/10"
                title="新增子頻道"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            )}

            {(userRole === 'admin' || p.my_role === 'owner') && !isCollapsed && (
              <div className="flex items-center">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleHideProject(p.id); }}
                  className="p-1 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70 transition-all rounded-md hover:bg-white/10"
                  title={hiddenProjects.has(p.id) ? '顯示此頻道' : '從側邊欄隱藏'}
                >
                  {hiddenProjects.has(p.id) ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  )}
                </button>
                
                {/* Delete Button for Owners */}
                {p.my_role === 'owner' && (
                  <button
                    onClick={async (e) => { 
                      e.stopPropagation(); 
                      if (!confirm(`⚠️ 確定要永久刪除頻道「${p.name}」嗎？\n此動作將一併刪除所有子頻道、成員授權與連結，且無法復原！`)) return;
                      const res = await fetch(`/api/projects/${p.id}`, { method: 'DELETE' });
                      if (res.ok) {
                        toast.success('頻道已成功刪除');
                        window.location.reload(); // 重新整理以更新 Quota 與列表
                      } else {
                        const data = await res.json();
                        toast.error(data.error || '刪除失敗');
                      }
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all rounded-md hover:bg-red-500/10 ml-0.5"
                    title="永久刪除頻道"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Children Rendering - pass parent color down */}
        {!isCollapsed && hasChildren && !isParentCollapsed && (
          <div className="ml-2 pl-2 border-l border-white/5 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
            {childProjectsMap[p.id].map(child => renderProjectItem(child, true, channelColor))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {!isCollapsed && (
          <div className="flex items-center justify-between mb-3 px-1 animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/30">Channels</div>
              <div className="relative group/sort">
                <button className="text-[10px] text-white/20 hover:text-white/60 transition-colors flex items-center gap-0.5">
                  {sortMethod === 'manual' ? '⇅ 自定義' : sortMethod === 'name' ? '🔤 名稱' : '👤 建立者'}
                </button>
                <div className="absolute left-0 top-full mt-1 w-28 bg-card border border-white/10 rounded-lg shadow-2xl opacity-0 invisible group-hover/sort:opacity-100 group-hover/sort:visible transition-all z-20 overflow-hidden backdrop-blur-md">
                  <button onClick={() => setSortMethod('manual')} className={`w-full text-left px-3 py-2 text-[10px] hover:bg-white/5 transition-colors ${sortMethod === 'manual' ? 'text-primary' : 'text-white/60'}`}>⇅ 手動排序</button>
                  <button onClick={() => setSortMethod('name')} className={`w-full text-left px-3 py-2 text-[10px] hover:bg-white/5 transition-colors ${sortMethod === 'name' ? 'text-primary' : 'text-white/60'}`}>🔤 依名稱排序</button>
                  <button onClick={() => setSortMethod('creator')} className={`w-full text-left px-3 py-2 text-[10px] hover:bg-white/5 transition-colors ${sortMethod === 'creator' ? 'text-primary' : 'text-white/60'}`}>👤 依建立者排序</button>
                </div>
              </div>
            </div>

            {userRole === 'admin' && hiddenCount > 0 && (
              <button 
                onClick={() => setShowAllAdmin(p => !p)}
                className="text-[10px] text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
                title={showAllAdmin ? '隱藏被排除的頻道' : `顯示 ${hiddenCount} 個已隱藏頻道`}
              >
                {showAllAdmin ? (
                  <><span>👁️</span></>
                ) : (
                  <><span className="font-bold text-white/60">{hiddenCount}</span>↗</>
                )}
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => {
             setSelectedProjectId(null);
             if (pathname !== '/dashboard') {
               router.push('/dashboard');
               // Give the new page time to mount and register the event listener
               setTimeout(() => {
                 window.dispatchEvent(new CustomEvent('open-new-project-modal', { detail: { parent_id: null } }));
               }, 100);
             } else {
               window.dispatchEvent(new CustomEvent('open-new-project-modal', { detail: { parent_id: null } }));
             }
          }}
          title={isCollapsed ? "新增頂層 Channel" : ""}
          className={`w-full transition-all flex items-center mb-4 border interactive-card ${isCollapsed ? 'justify-center py-3 rounded-2xl' : 'px-4 py-2.5 rounded-xl gap-3'} ${
            selectedProjectId === null && !pathname?.includes('/feedback') 
              ? 'bg-primary/10 text-primary-foreground border-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)] font-semibold' 
              : 'border-white/5 bg-white/[0.02] text-white/70 hover:bg-white/10 hover:border-white/10 hover:text-white font-medium'
          }`}
        >
          <span className="text-lg opacity-90 shrink-0">🏠</span> 
          {!isCollapsed && <span className="truncate">新增頂層 Channel</span>}
        </button>

      <div className={`${isCollapsed ? 'space-y-2' : 'space-y-1'}`}>
        {parentProjects.map(p => renderProjectItem(p))}
      </div>
      
      {/* Ghost Channels Section (Admin Only) */}
      {!isCollapsed && userRole === 'admin' && ghostParentProjects.length > 0 && (
        <div className="mt-8 pt-4 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between px-2 mb-2">
             <div className="text-[10px] uppercase tracking-widest font-bold text-red-400/50 flex items-center gap-2">
               <span>👻</span> Recycle Bin
             </div>
             <span className="text-[10px] bg-red-500/10 text-red-400/60 px-1.5 py-0.5 rounded-full font-mono">{ghostParentProjects.length}</span>
          </div>
          <div className="space-y-0.5 opacity-60 hover:opacity-100 transition-opacity">
            {ghostParentProjects.map(p => renderProjectItem(p))}
          </div>
        </div>
      )}

      {normalProjects.length === 0 && ghostParentProjects.length === 0 && !isCollapsed && (
        <div className="text-xs text-white/30 italic p-3 text-center">
          {userRole === 'admin' && hiddenCount > 0 && !showAllAdmin
            ? `${hiddenCount} 個頻道已隱藏`
            : '尚無頻道'}
        </div>
      )}
      </div>
      
      {/* Bottom Global Links */}
      <div className={`p-4 border-t border-white/5 bg-black/10 space-y-2`}>
        {specialProject && (
          <button
            onClick={() => {
              if (specialProject.status !== 'disabled') {
                setSelectedProjectId(specialProject.id);
                if (pathname !== '/dashboard') {
                  router.push(`/dashboard?channel=${specialProject.id}`);
                }
              }
            }}
            disabled={specialProject.status === 'disabled'}
            title={isCollapsed ? "使用說明＆關於我" : ""}
            className={`w-full text-left transition-colors text-sm flex items-center interactive-card ${isCollapsed ? 'justify-center p-2 rounded-xl' : 'px-3 py-2 rounded-lg gap-2'} ${
              selectedProjectId === specialProject.id ? 'bg-white/10 text-white border border-white/20 shadow-lg' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className={`shrink-0 ${specialProject.status === 'disabled' ? 'opacity-50 grayscale' : ''}`}>📄</span> 
            {!isCollapsed && <span className={`truncate ${specialProject.status === 'disabled' ? 'line-through' : ''}`}>使用說明＆關於我</span>}
          </button>
        )}

        <button
          onClick={() => {
             router.push('/dashboard/feedback');
          }}
          title={isCollapsed ? "使用者回饋 (互動留言板)" : ""}
          className={`w-full text-left transition-colors text-sm flex items-center interactive-card ${isCollapsed ? 'justify-center p-2 rounded-xl' : 'px-3 py-2 rounded-lg gap-2'} ${
            pathname?.includes('/feedback') ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10' : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          <span className="shrink-0">💬</span>
          {!isCollapsed && <span className="truncate">使用者回饋 (互動留言板)</span>}
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Resize & Mobile logic
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isResizing = useRef(false);

  useEffect(() => {
    const savedWidth = localStorage.getItem('sidebar_width');
    if (savedWidth) {
      setSidebarWidth(Number(savedWidth));
    }
  }, []);

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    
    let newWidth = e.clientX;
    const maxWidth = window.innerWidth * 0.5;
    
    // Snap to collapsed mode
    if (newWidth < 120) {
      newWidth = 88;
    } else if (newWidth > maxWidth) {
      newWidth = maxWidth;
    }

    setSidebarWidth(newWidth);
    localStorage.setItem('sidebar_width', newWidth.toString());
  }, []);

  // Change Password state
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '' });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
        } else {
          router.push('/');
        }
      })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const pathname = usePathname();
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pwdForm)
    });
    if (res.ok) {
      toast.success('密碼變更成功！請重新登入');
      setIsPwdModalOpen(false);
      handleLogout();
    } else {
      const data = await res.json();
      toast.error(data.error || '變更失敗');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const isCollapsed = sidebarWidth <= 100;

  return (
    <ProjectProvider userRole={user.role} userId={(user.id || (user as any).sub)?.toString() || ''}>
      <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden relative">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-card/80 backdrop-blur-md z-40 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20 shrink-0 text-xs">
              N
            </div>
            <h2 className="font-semibold text-sm tracking-tight text-white/90">NBLMs LinkStation</h2>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-white/60 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </header>

        {/* Sidebar Backdrop (Mobile) */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside 
          style={{ width: `${sidebarWidth}px` }}
          className={`
            fixed md:relative inset-y-0 left-0 z-50 md:z-auto
            border-r border-border bg-card/95 md:bg-card/50 flex flex-col pt-4 
            transition-all duration-300 ease-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            max-w-[85vw]
          `}
        >
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden absolute top-4 right-4 p-2 text-white/30 hover:text-white"
          >
            ✕
          </button>

          {/* Logo Section (Desktop only or Drawer top) */}
          <div className={`${isCollapsed ? 'px-2 justify-center' : 'px-6'} pb-4 border-b border-white/5 flex items-center gap-3 transition-all`}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20 shrink-0">
              N
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <h2 className="font-semibold text-sm tracking-tight text-white/90">NBLMs LinkStation</h2>
                <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Workspace</p>
              </div>
            )}
          </div>

          <Sidebar width={sidebarWidth} />

          {/* User Section */}
          <div className={`${isCollapsed ? 'p-2' : 'p-4'} border-t border-border bg-black/20 mt-auto transition-all`}>
            <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'justify-between'}`}>
              {!isCollapsed ? (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-white/90 truncate">{user.username}</span>
                  <span className="text-xs text-white/50 capitalize flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${user.role === 'admin' ? 'bg-amber-400' : 'bg-green-400'}`} />
                    {user.role}
                  </span>
                </div>
              ) : (
                <div 
                  className={`w-8 h-8 rounded-full border-2 ${user.role === 'admin' ? 'border-amber-400' : 'border-green-400'} flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-4 ring-white/5`}
                  title={`${user.username} (${user.role})`}
                >
                  {user.username[0].toUpperCase()}
                </div>
              )}
              
              <div className={`flex ${isCollapsed ? 'flex-col gap-2' : 'gap-1'}`}>
                {user.role === 'admin' && (
                  <button 
                    onClick={() => router.push('/dashboard/admin')}
                    className="p-2 hover:bg-amber-500/20 hover:text-amber-300 rounded-lg transition-colors text-white/50 interactive-card"
                    title="管理網頁後台"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                )}
                <button 
                  onClick={() => setIsPwdModalOpen(true)}
                  className="p-2 hover:bg-white/10 hover:text-white rounded-lg transition-colors text-white/50 interactive-card"
                  title="帳號安全設定"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.836l8.74-8.74A6 6 0 0115 7z" /></svg>
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition-colors text-white/50 interactive-card"
                  title="安全登出"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Resizer Handle (Desktop only) */}
          <div 
            onMouseDown={startResizing}
            className="hidden md:block absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50 group"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-white/10 rounded-full group-hover:bg-primary/50 transition-colors" />
          </div>
        </aside>

        {/* content area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      {isPwdModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
           <div className="bg-card w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl relative">
              <button onClick={() => setIsPwdModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
              <h3 className="text-xl font-medium mb-4">變更個人密碼</h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="relative">
                  <label className="text-xs text-white/50 block mb-1">目前舊密碼</label>
                  <input required type={showOldPassword ? "text" : "password"} autoFocus className="glass-input pr-10" value={pwdForm.oldPassword} onChange={e => setPwdForm({...pwdForm, oldPassword: e.target.value})} />
                  <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-[26px] text-white/40 hover:text-white transition-colors">
                    {showOldPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                <div className="relative">
                  <label className="text-xs text-white/50 block mb-1">新密碼 (至少 8 碼)</label>
                  <input required type={showNewPassword ? "text" : "password"} minLength={8} className="glass-input pr-10" value={pwdForm.newPassword} onChange={e => setPwdForm({...pwdForm, newPassword: e.target.value})} />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-[26px] text-white/40 hover:text-white transition-colors">
                    {showNewPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors w-full">儲存並重新登入</button>
                </div>
              </form>
           </div>
        </div>
      )}
    </ProjectProvider>
  );
}
