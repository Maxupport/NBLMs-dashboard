"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useProjects } from "./ProjectContext";
import { fetcher } from "@/lib/fetcher";

export default function DashboardPage() {
  const router = useRouter();
  const { projects, selectedProjectId, setSelectedProjectId, refreshProjects, userRole, userId, sortMethod, setSortMethod } = useProjects();
  const isAdmin = userRole === 'admin';
  const hasAutoSelected = useRef(false);
  
  // Modals Data
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', parent_id: null as number | null });

  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editProjectData, setEditProjectData] = useState({ name: '', description: '', parent_id: null as number | null, color: '#6366f1' });

  // Add Link Modal
  const [isNewLinkModalOpen, setIsNewLinkModalOpen] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '', category: 'ai_tool' });

  // Edit Link Modal
  const [isEditLinkModalOpen, setIsEditLinkModalOpen] = useState(false);
  const [editLinkData, setEditLinkData] = useState({ id: 0, title: '', url: '', description: '', category: 'other' });

  // Drag and Drop State for Links
  const [draggedLinkId, setDraggedLinkId] = useState<number | null>(null);
  const [draggedLinkType, setDraggedLinkType] = useState<string | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      const { parent_id } = e.detail;
      setNewProject({ name: '', description: '', parent_id: parent_id || null });
      setIsNewProjectModalOpen(true);
    };
    window.addEventListener('open-new-project-modal', handleOpenModal);
    return () => window.removeEventListener('open-new-project-modal', handleOpenModal);
  }, []);

  useEffect(() => {
    // 如果首頁進來沒有選中專案，自動尋找特殊的「全域歡迎區」
    // 為了避免與「新增專案」按鈕衝突，我們只在初次載入（或專案列表載入）時執行一次
    if (!hasAutoSelected.current && projects.length > 0) {
      hasAutoSelected.current = true;
      if (!selectedProjectId) {
        const global = projects.find(p => p.is_global_welcome === 1);
        if (global) {
          setSelectedProjectId(global.id);
        }
      }
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);
  const [copyLinkModalState, setCopyLinkModalState] = useState<{ isOpen: boolean; link: any | null }>({ isOpen: false, link: null });
  const [copyTargetProjectId, setCopyTargetProjectId] = useState<number | ''>('');

  // Manage Members Modal
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [projectMembers, setProjectMembers] = useState<{ id: number; role: string }[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const activeProject = projects.find(p => p.id === selectedProjectId);
  const parentProject = activeProject?.parent_id ? projects.find(p => p.id === activeProject.parent_id) : null;
  const isOwnerOrAdmin = !!(isAdmin || 
    (activeProject && (activeProject as any).my_role === 'owner'));
  
  const hasWriteAccessProjects = useMemo(() => projects.filter((p: any) => {
    return isAdmin || p.my_role === 'owner' || p.my_role === 'editor';
  }), [projects, isAdmin]);

  const { data: linksData, mutate: mutateLinks, isLoading: loadingLinks } = useSWR(
    selectedProjectId ? `/api/links?projectId=${selectedProjectId}` : null,
    fetcher,
    { dedupingInterval: 10000, revalidateOnFocus: false }
  );
  const rawLinks: any[] = linksData?.links || [];
  const links = useMemo(() => rawLinks.filter((l: any) => 
    !searchQuery ||
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ), [rawLinks, searchQuery]);

  const { internalLinks, aiToolLinks, otherLinks, allInternalLinks } = useMemo(() => {
    const internalLinks = links.filter((l: any) => l.url?.includes('dashboard?channel='));
    const subChannelLinks = projects
      .filter(p => p.parent_id === selectedProjectId)
      .map(p => ({
        id: `sub-${p.id}`,
        title: p.name,
        url: `/dashboard?channel=${p.id}`,
        description: p.description || '子頻道',
        created_at: (p as any).created_at || new Date().toISOString(),
        icon: p.icon
      }));
    const allInternalLinks = [...subChannelLinks, ...internalLinks];
    const aiToolLinks = links.filter((l: any) => !l.url?.includes('dashboard?channel=') && l.category === 'ai_tool');
    const otherLinks = links.filter((l: any) => !l.url?.includes('dashboard?channel=') && l.category !== 'ai_tool');
    return { internalLinks, aiToolLinks, otherLinks, allInternalLinks };
  }, [links, projects, selectedProjectId]);

  const handleCopyLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copyTargetProjectId || !copyLinkModalState.link) return;
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: Number(copyTargetProjectId),
        title: copyLinkModalState.link.title,
        url: copyLinkModalState.link.url,
        description: copyLinkModalState.link.description,
        category: copyLinkModalState.link.category || 'other'
      })
    });
    if (res.ok) {
      toast.success(`已經成功將該連結收錄至指定的 Channel 中！`);
      setCopyLinkModalState({ isOpen: false, link: null });
      setCopyTargetProjectId('');
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });
    if (res.ok) {
      toast.success('頻道建立成功！');
      setIsNewProjectModalOpen(false);
      setNewProject({ name: '', description: '', parent_id: null });
      await refreshProjects();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    const res = await fetch(`/api/projects/${selectedProjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editProjectData.name, description: editProjectData.description, parent_id: editProjectData.parent_id, color: editProjectData.color })
    });
    if (res.ok) {
      toast.success('頻道更新成功！');
      setIsEditProjectModalOpen(false);
      await refreshProjects();
    } else {
      const data = await res.json();
      toast.error(data.error || '更新失敗');
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLink, projectId: selectedProjectId })
    });
    if (res.ok) {
      toast.success('成功加入收錄！');
      setIsNewLinkModalOpen(false);
      setNewLink({ title: '', url: '', description: '', category: 'ai_tool' });
      mutateLinks();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  };


  const handleEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/links/${editLinkData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editLinkData.title, url: editLinkData.url, description: editLinkData.description, category: editLinkData.category })
    });
    if (res.ok) {
      toast.success('連結更新成功！');
      setIsEditLinkModalOpen(false);
      mutateLinks();
    } else {
      const data = await res.json();
      toast.error(data.error || '更新失敗');
    }
  };

  const handleLinkDrop = async (sourceArray: any[], dropId: number, type: string) => {
    if (!draggedLinkId || draggedLinkId === dropId || draggedLinkType !== type) return;
    
    const oldIndex = sourceArray.findIndex(l => l.id === draggedLinkId);
    const newIndex = sourceArray.findIndex(l => l.id === dropId);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const newArray = [...sourceArray];
    const [movedItem] = newArray.splice(oldIndex, 1);
    newArray.splice(newIndex, 0, movedItem);

    const allOtherLinks = links.filter((l: any) => !sourceArray.find(sl => sl.id === l.id));
    const finalOrderedIds = [...newArray.map((l: any) => l.id), ...allOtherLinks.map((l: any) => l.id)];
    
    // Optimistic update
    mutateLinks({ links: [...links].sort((a: any, b: any) => finalOrderedIds.indexOf(a.id) - finalOrderedIds.indexOf(b.id)) }, false);

    try {
      const res = await fetch('/api/links/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: finalOrderedIds, projectId: selectedProjectId })
      });
      if (!res.ok) throw new Error('API Reorder failed');
      mutateLinks();
    } catch(err) {
       mutateLinks(); // Rollback
    }
    
    setDraggedLinkId(null);
    setDraggedLinkType(null);
  };

  const handleDeleteLink = useCallback(async (id: number) => {
    if (!confirm('確定要刪除這個連結嗎？')) return;
    const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('已刪除連結');
      mutateLinks();
    }
  }, [mutateLinks]);

  const openMembersModal = async () => {
    const resMembers = await fetch(`/api/projects/${selectedProjectId}/members`);
    if (resMembers.ok) {
      const dataMembers = await resMembers.json();
      setProjectMembers(dataMembers.members || []);
      setAllUsers(dataMembers.allEligibleUsers || []);
      setIsMembersModalOpen(true);
    } else {
      toast.error('無法取得成員資料');
    }
  };

  const handleSaveMembers = async () => {
    const res = await fetch(`/api/projects/${selectedProjectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: projectMembers })
    });
    if (res.ok) {
      setIsMembersModalOpen(false);
      toast.success('成員權限更新成功');
      await refreshProjects(); // 重新整理以獲取最新權限
    } else {
      const data = await res.json();
      toast.error(data.error || '更新失敗');
    }
  };


  const renderLinksSection = (title: string, icon: string, linkArray: any[], type: string, emptyMessage: string, bgClass = 'bg-white/5', borderClass = 'border-white/10', iconBg = 'bg-blue-500/20', iconBorder = 'border-blue-500/30', emoji = '📓') => (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2 px-1">
        <span>{icon}</span> {title}
      </h3>
      <div className={`flex flex-row overflow-x-auto gap-3 pb-3 custom-scrollbar scroll-smooth p-2.5 rounded-2xl bg-black/20 border border-white/5 ${type==='internal' ? 'shadow-[inset_0_2px_10px_rgba(245,158,11,0.05)]' : ''}`}>
        {linkArray.length > 0 ? linkArray.map((link: any) => {
          const isInternal = type === 'internal';
          const match = isInternal ? link.url.match(/channel=([^&]+)/) : null;
          const targetChannelId = match ? match[1] : null;

          return (
            <a 
              key={link.id}
              href={link.url}
              target={isInternal ? undefined : "_blank"}
              rel={isInternal ? undefined : "noopener noreferrer"}
              draggable={isOwnerOrAdmin}
              onDragStart={(e) => {
                if (!isOwnerOrAdmin) return;
                setDraggedLinkId(link.id);
                setDraggedLinkType(type);
                e.dataTransfer.effectAllowed = 'move';
                // Small hack to hide original element slightly while dragging
                setTimeout(() => { if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5'; }, 0);
              }}
              onDragEnd={(e) => {
                if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
                setDraggedLinkId(null);
                setDraggedLinkType(null);
              }}
              onDragOver={(e) => {
                if (draggedLinkType === type && draggedLinkId !== link.id) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedLinkType === type) {
                  handleLinkDrop(linkArray, link.id, type);
                }
              }}
              onClick={(e) => {
                if (isInternal && targetChannelId) {
                  e.preventDefault();
                  setSelectedProjectId(Number(targetChannelId));
                  router.push(`/dashboard?channel=${targetChannelId}`);
                  window.scrollTo(0, 0);
                }
                fetch(`/api/projects/${selectedProjectId}/track`, { method: 'POST' }).catch(() => {});
              }}
              className={`p-4 rounded-xl ${bgClass} border ${borderClass} hover:opacity-80 transition-all group relative overflow-hidden flex flex-col h-full min-h-[130px] w-64 shrink-0 cursor-pointer interactive-card ${draggedLinkId === link.id ? 'opacity-50 blur-sm scale-95' : ''}`}
            >
               <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                 {hasWriteAccessProjects.length > 0 && (
                   <button 
                     onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCopyLinkModalState({ isOpen: true, link }); }}
                     className="text-white/40 hover:text-white transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md interactive-card"
                     title="收錄至其他 Channel"
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                   </button>
                 )}
                 {isOwnerOrAdmin && (
                   <>
                     <button
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditLinkData({ id: link.id, title: link.title, url: link.url, description: link.description || '', category: link.category || 'other' }); setIsEditLinkModalOpen(true); }}
                       className="text-white/40 hover:text-white transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md interactive-card"
                       title="編輯系統"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                     </button>
                     <button 
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLink(link.id); }}
                       className="text-white/40 hover:text-red-400 transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md interactive-card"
                       title="刪除"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     </button>
                   </>
                 )}
               </div>
               <div className={`w-8 h-8 rounded-md ${iconBg} flex items-center justify-center text-lg mb-3 border ${iconBorder} shrink-0`}>
                 {(link as any).icon || emoji}
               </div>
                     <div className="text-xs font-semibold text-white/90 truncate pr-6 group-hover:text-primary transition-colors leading-tight mb-1">{link.title}</div>
                     <div className="text-[10px] text-white/40 line-clamp-2 leading-relaxed mb-auto">{link.description || '無備註'}</div>
               {!isInternal && (
                 <div className="flex items-center justify-between text-[10px] text-white/30 border-t border-white/5 pt-3 mt-auto shrink-0">
                   <span className="truncate pr-2">{new URL(link.url).hostname}</span>
                   <span>{new Date(link.created_at).toLocaleDateString()}</span>
                 </div>
               )}
            </a>
          );
        }) : (
          <div className="w-full py-6 text-center text-white/20 text-xs italic glass-panel border-dashed border-white/5 rounded-xl shrink-0">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );

  if (!selectedProjectId || !activeProject) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">
        {/* 歡迎區塊 */}
        <div className="p-8 rounded-3xl glass-panel relative overflow-hidden bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full mix-blend-screen filter blur-[80px] -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <h2 className="text-3xl font-semibold mb-3">歡迎來到 Workspace</h2>
            <p className="text-white/60 max-w-lg text-sm leading-relaxed">
              在這裡您可以集中管理所有散落的 NBLMs 頻道。透過左側選單進入現有頻道，或建立新頻道以開始整理連結。
            </p>
            
            <div className="mt-8 flex gap-4">
              <button 
                onClick={() => setIsNewProjectModalOpen(true)}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-primary/20"
              >
                <span className="mr-2">+</span>馬上建立新頻道
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in py-2">
      {/* 專案標題區 */}
      <div className="flex items-center justify-between pb-4 border-b border-border gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-2xl shrink-0">
            {activeProject.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 group">
              <h2 className="text-2xl font-semibold text-white/90">{activeProject.name}</h2>
              {isOwnerOrAdmin && (
                <button 
                  onClick={() => {
                    setEditProjectData({ name: activeProject.name, description: activeProject.description || '', parent_id: activeProject.parent_id || null, color: (activeProject as any).color || '#6366f1' });
                    setIsEditProjectModalOpen(true);
                  }} 
                  className="text-white/20 hover:text-white/80 p-1 opacity-0 group-hover:opacity-100 transition-all rounded bg-white/5 hover:bg-white/10"
                  title="編輯頻道設定"
                >
                  ✎
                </button>
              )}
              {activeProject.parent_id && (
                <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/40 font-medium">
                  子頻道
                </div>
              )}
              <button
                onClick={() => {
                  const url = `${window.location.origin}/dashboard?channel=${activeProject.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success('已複製此頻道專屬連結！');
                }}
                className="text-white/20 hover:text-white/80 p-1 opacity-0 group-hover:opacity-100 transition-all rounded bg-white/5 hover:bg-white/10"
                title="複製專屬網址，可供其他 Channel 收錄"
              >
                🔗
              </button>
            </div>
            <p className="text-white/40 text-sm mt-1">{activeProject.description || '無描述'}</p>
          </div>
        </div>
        <div className="flex gap-3 shrink-0 items-center">
          {/* Search & Sort */}
          <div className="flex gap-2">
            {!activeProject.parent_id ? (
              <button 
                onClick={() => {
                  setNewProject({ name: '', description: '', parent_id: activeProject.id });
                  setIsNewProjectModalOpen(true);
                }}
                className="h-10 px-4 bg-primary/10 border border-primary/20 rounded-lg text-xs text-primary hover:bg-primary/20 transition-all flex items-center gap-2 font-medium"
              >
                <span>➕</span> 新增子頻道
              </button>
            ) : (
              <div className="relative group/sort">
                <button className="h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white hover:border-white/20 transition-all flex items-center gap-2">
                  {sortMethod === 'manual' ? '⇅ 自定義' : sortMethod === 'name' ? '🔤 名稱' : '👤 建立者'}
                  <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/sort:opacity-100 group-hover/sort:visible transition-all z-20 overflow-hidden backdrop-blur-md">
                  <button onClick={() => setSortMethod('manual')} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors ${sortMethod === 'manual' ? 'bg-primary/10 text-primary font-medium' : 'text-white/60'}`}>⇅ 手動排序</button>
                  <button onClick={() => setSortMethod('name')} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors ${sortMethod === 'name' ? 'bg-primary/10 text-primary font-medium' : 'text-white/60'}`}>🔤 依名稱排序</button>
                  <button onClick={() => setSortMethod('creator')} className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors ${sortMethod === 'creator' ? 'bg-primary/10 text-primary font-medium' : 'text-white/60'}`}>👤 依建立者排序</button>
                </div>
              </div>
            )}

            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="搜尋筆記本..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20 transition-colors w-40 h-10 focus:w-56"
              />
            </div>
          </div>
          {isOwnerOrAdmin && (
            <>
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/?invite=${activeProject.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success('已複製外部邀請專屬網址！受邀者透過此網址註冊將自動取得本區權限。', { duration: 4000 });
                }}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm text-amber-200 transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/5 group"
                title="外部使用者透過此連結註冊，系統將自動允許其進入此頻道"
              >
                <span className="group-hover:rotate-12 transition-transform">🎁</span> 邀請連結
              </button>
              {isAdmin && (
                <button onClick={openMembersModal} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/80 transition-colors flex items-center gap-2">
                  <span>👥</span> 權限
                </button>
              )}
              <button onClick={() => setIsNewLinkModalOpen(true)} className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary-foreground rounded-lg text-sm transition-colors shadow-lg shadow-primary/10 flex items-center gap-2">
                <span>+</span> 新增
              </button>
            </>
          )}
        </div>
      </div>

      {/* 連結卡片牆 */}
      {loadingLinks ? (
        <div className="py-12 flex justify-center"><span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4 animate-in fade-in">
          {/* Internal Links */}
          {renderLinksSection("內部 Channel 連結", "🗂️", allInternalLinks, "internal", "目前尚未收錄任何內部 Channel 連結", "bg-amber-500/10", "border-amber-500/20", "bg-amber-500/20 shadow-[inset_0_2px_10px_rgba(245,158,11,0.2)]", "border-amber-500/30", "📂")}

          {/* AI Tools & Project Tracking Links */}
          {renderLinksSection("常用 AI 工具 (例如 NotebookLM 筆記本) ＆ 專案追蹤管理", "🤖", aiToolLinks, "ai_tool", "目前尚未收錄任何 AI 工具連結", "bg-blue-500/10", "border-blue-500/20", "bg-blue-500/20", "border-blue-500/30", "✨")}

          {/* Other External Links */}
          {renderLinksSection("其他外部連結", "🔗", otherLinks, "other", "目前尚未收錄任何外部連結", "bg-white/5", "border-white/10", "bg-white/10", "border-white/20", "🌐")}
        </div>
      )}

        {isEditProjectModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in transition-all">
             <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl relative">
                <button onClick={() => setIsEditProjectModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
                <h3 className="text-xl font-medium mb-4">編輯頻道設定</h3>
                <form onSubmit={handleEditProject} className="space-y-4">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">頻道名稱</label>
                    <input required autoFocus className="glass-input" value={editProjectData.name} onChange={e => setEditProjectData({...editProjectData, name: e.target.value})} placeholder="頻道名稱" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">所屬母頻道 (Parent Channel)</label>
                    <select 
                      className="glass-input w-full appearance-none bg-black/30"
                      value={editProjectData.parent_id || ''} 
                      onChange={e => setEditProjectData({...editProjectData, parent_id: e.target.value ? Number(e.target.value) : null})}
                    >
                      <option value="">無 (設定為頂層頻道)</option>
                      {projects.filter(p => !p.parent_id && p.id !== selectedProjectId && p.is_global_welcome !== 1).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">頻道描述</label>
                    <textarea className="glass-input resize-none h-20" value={editProjectData.description} onChange={e => setEditProjectData({...editProjectData, description: e.target.value})} placeholder="簡述這個頻道的目標與範圍..." />
                  </div>
                  {/* Color Picker - only for parent channels */}
                  {!editProjectData.parent_id && (
                    <div>
                      <label className="text-xs text-white/50 block mb-2">頻道主題色</label>
                      <div className="flex flex-wrap gap-2">
                        {['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6','#64748b','#a8a29e'].map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEditProjectData({...editProjectData, color})}
                            className={`w-6 h-6 rounded-full transition-all hover:scale-110 ${editProjectData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-card scale-110' : ''}`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-4">
                    <button type="button" onClick={async () => {
                      if(confirm('確定要永久刪除此頻道嗎？動作無法復原。')) {
                        const res = await fetch(`/api/projects/${selectedProjectId}`, { method: 'DELETE' });
                        if(res.ok) {
                          toast.success('已刪除頻道');
                          setIsEditProjectModalOpen(false);
                          setSelectedProjectId(null);
                          await refreshProjects();
                        }
                      }
                    }} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">刪除頻道</button>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setIsEditProjectModalOpen(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors">取消</button>
                      <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">儲存變更</button>
                    </div>
                  </div>
                </form>
             </div>
          </div>
        )}

        {/* Delete Link Confirm Modal */}

      {/* Edit Link Modal */}
      {isEditLinkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
           <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl relative">
              <button onClick={() => setIsEditLinkModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
              <h3 className="text-xl font-medium mb-4">編輯連結</h3>
              <form onSubmit={handleEditLink} className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">連結標題 Title</label>
                  <input required autoFocus className="glass-input" value={editLinkData.title} onChange={e => setEditLinkData({...editLinkData, title: e.target.value})} placeholder="例如: 2024 Q3 行銷素材 Notebook" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">筆記本 URL</label>
                  <input required type="url" className="glass-input" value={editLinkData.url} onChange={e => setEditLinkData({...editLinkData, url: e.target.value})} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">顯示區域</label>
                  <div className="flex gap-4 p-2 bg-black/20 rounded-lg border border-white/5">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" checked={editLinkData.category === 'ai_tool'} onChange={() => setEditLinkData({...editLinkData, category: 'ai_tool'})} className="accent-primary" />
                      <span className="text-xs text-white/60 group-hover:text-white transition-colors">常用 AI 工具 & 專案追蹤管理</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" checked={editLinkData.category === 'other'} onChange={() => setEditLinkData({...editLinkData, category: 'other'})} className="accent-primary" />
                      <span className="text-xs text-white/60 group-hover:text-white transition-colors">其他外部連結</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">簡單備註 (選填)</label>
                  <textarea className="glass-input resize-none h-20" value={editLinkData.description} onChange={e => setEditLinkData({...editLinkData, description: e.target.value})} placeholder="簡述這個連結的核心重點..." />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setIsEditLinkModalOpen(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors">取消</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">儲存變更</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {isNewLinkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
           <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl relative">
              <button onClick={() => setIsNewLinkModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
              <h3 className="text-xl font-medium mb-4">新增 NBLMs 連結</h3>
              <form onSubmit={handleCreateLink} className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">連結標題 Title</label>
                  <input required autoFocus className="glass-input" value={newLink.title} onChange={e => setNewLink({...newLink, title: e.target.value})} placeholder="例如: 2024 Q3 行銷素材 Notebook" />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">筆記本 URL (通常為 notebooklm.google.com/...)</label>
                  <input required type="url" className="glass-input" value={newLink.url} onChange={e => setNewLink({...newLink, url: e.target.value})} placeholder="https://..." />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">顯示區域</label>
                  <div className="flex gap-4 p-2 bg-black/20 rounded-lg border border-white/5">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" checked={newLink.category === 'ai_tool'} onChange={() => setNewLink({...newLink, category: 'ai_tool'})} className="accent-primary" />
                      <span className="text-xs text-white/60 group-hover:text-white transition-colors">常用 AI 工具 & 專案追蹤管理</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" checked={newLink.category === 'other'} onChange={() => setNewLink({...newLink, category: 'other'})} className="accent-primary" />
                      <span className="text-xs text-white/60 group-hover:text-white transition-colors">其他外部連結</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">簡單備註 (選填)</label>
                  <textarea className="glass-input resize-none h-20" value={newLink.description} onChange={e => setNewLink({...newLink, description: e.target.value})} placeholder="簡述這個連結的核心重點..." />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setIsNewLinkModalOpen(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors">取消</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">儲存連結</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
           <div className="bg-card w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl relative flex flex-col max-h-[80vh]">
              <button onClick={() => setIsMembersModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
              <h3 className="text-xl font-medium mb-1">頻道成員存取權限</h3>
              <p className="text-xs text-white/40 mb-4 pb-4 border-b border-white/10">設定此頻道允許存取的名單與權限。</p>
              
              <div className="overflow-y-auto flex-1 space-y-2 mb-4">
                {/* 顯示已授權成員 */}
                {projectMembers.map(memberRecord => {
                  const u = allUsers.find(user => user.id === memberRecord.id);
                  if (!u) return null;
                  
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{u.username}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <select 
                          value={memberRecord.role}
                          onChange={(e) => {
                            setProjectMembers(projectMembers.map(m => m.id === u.id ? { ...m, role: e.target.value } : m));
                          }}
                          className="text-[10px] bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 text-white/80 hover:text-white cursor-pointer transition-colors outline-none focus:border-primary/50"
                        >
                          <option value="viewer">👁️ 只能檢視</option>
                          <option value="editor">✍️ 可新增編輯</option>
                        </select>
                        <button 
                          type="button"
                          onClick={() => setProjectMembers(projectMembers.filter(m => m.id !== u.id))}
                          className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="移除成員"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
                {projectMembers.length === 0 && (
                  <div className="text-sm text-white/30 text-center py-6 bg-white/5 rounded-xl border border-white/5 border-dashed">目前尚無授權任何成員</div>
                )}
              </div>
              
              {/* 新增成員區塊 (僅限管理員) */}
              {isAdmin && (
                <div className="pt-4 border-t border-white/10 shrink-0 mb-4">
                  <label className="text-xs text-white/50 block mb-2">新增授權成員 (僅管理員可用)</label>
                  <div className="flex gap-2">
                    <select 
                      className="glass-input flex-1 text-sm py-2 px-3 appearance-none bg-black/20"
                      onChange={(e) => {
                        const uid = Number(e.target.value);
                        if (uid && !projectMembers.find(m => m.id === uid)) {
                          setProjectMembers([...projectMembers, { id: uid, role: 'viewer' }]);
                          e.target.value = ""; // reset after selection
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>-- 從名單中選擇要加入的使用者 --</option>
                      {allUsers.filter(u => u.role !== 'admin' && !projectMembers.find(m => m.id === u.id)).map(u => (
                        <option key={u.id} value={u.id} className="bg-[#1a1a1a]">{u.username}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setIsMembersModalOpen(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors">取消</button>
                <button type="button" onClick={handleSaveMembers} className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">儲存權限設定</button>
              </div>
           </div>
        </div>
      )}

      {/* Copy Link Modal */}
      {copyLinkModalState.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
           <div className="bg-card w-full max-w-sm rounded-2xl border border-white/10 p-6 shadow-2xl relative">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCopyLinkModalState({ isOpen: false, link: null });
                }} 
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-xl font-medium mb-4">收錄連結至其他 Channel</h3>
              <p className="text-xs text-white/50 mb-4 line-clamp-2 bg-white/5 p-2 rounded border border-white/10 border-dashed">
                即將收錄：{copyLinkModalState.link?.title}
              </p>
              <form onSubmit={handleCopyLink} className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">選擇目標 Channel</label>
                  <select 
                    required 
                    className="glass-input w-full appearance-none bg-black/30"
                    value={copyTargetProjectId} 
                    onChange={e => setCopyTargetProjectId(Number(e.target.value))}
                  >
                    <option value="" disabled>請選擇要收錄至哪一區...</option>
                    {hasWriteAccessProjects.filter(p => p.id !== selectedProjectId).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">確認收錄</button>
                </div>
              </form>
           </div>
        </div>
      )}
      {/* Global New Project Modal - always rendered so sidebar + button works */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
           <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl relative">
              <button onClick={() => setIsNewProjectModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
              <h3 className="text-xl font-medium mb-4">{newProject.parent_id ? '新增子頻道' : '建立新頻道'}</h3>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">{newProject.parent_id ? '子頻道名稱' : '頻道名稱'}</label>
                  <input required autoFocus className="glass-input" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder={newProject.parent_id ? '例如: 2024 Q1 報告' : '例如: 2024 行銷企劃研究'} />
                </div>
                {!newProject.parent_id && (
                  <div>
                    <label className="text-xs text-white/50 block mb-1">所屬母頻道 (Parent Channel)</label>
                    <select 
                      className="glass-input w-full appearance-none bg-black/30"
                      value={newProject.parent_id || ''} 
                      onChange={e => setNewProject({...newProject, parent_id: e.target.value ? Number(e.target.value) : null})}
                    >
                      <option value="">無 (設定為頂層頻道)</option>
                      {projects.filter(p => !p.parent_id && p.is_global_welcome !== 1).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {newProject.parent_id && (
                  <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/10 text-xs text-white/50">
                    所屬父頻道：<span className="text-white/80 font-medium">{projects.find(p => p.id === newProject.parent_id)?.name}</span>
                  </div>
                )}
                <div>
                  <label className="text-xs text-white/50 block mb-1">頻道描述 (選填)</label>
                  <textarea className="glass-input resize-none h-20" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} placeholder="簡述這個頻道的目標與範圍..." />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setIsNewProjectModalOpen(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors">取消</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">確認建立</button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
