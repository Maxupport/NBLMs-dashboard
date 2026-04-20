"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useProjects } from "./ProjectContext";
import { fetcher } from "@/lib/fetcher";

export default function DashboardPage() {
  const router = useRouter();
  const { projects, selectedProjectId, setSelectedProjectId, refreshProjects, userRole, userId, sortMethod, setSortMethod } = useProjects();
  const isAdmin = userRole === 'admin';
  
  // Modals Data
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editProjectData, setEditProjectData] = useState({ name: '', description: '' });

  // Add Link Modal
  const [isNewLinkModalOpen, setIsNewLinkModalOpen] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });

  // Copy Link Modal
  const [copyLinkModalState, setCopyLinkModalState] = useState<{ isOpen: boolean; link: any | null }>({ isOpen: false, link: null });
  const [copyTargetProjectId, setCopyTargetProjectId] = useState<number | ''>('');

  // Manage Members Modal
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [projectMembers, setProjectMembers] = useState<number[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  const activeProject = projects.find(p => p.id === selectedProjectId);
  const isOwnerOrAdmin = isAdmin || (activeProject && (activeProject as any).owner_id?.toString() === userId);
  const hasWriteAccessProjects = projects.filter((p: any) => isAdmin || p.owner_id?.toString() === userId);

  const { data: linksData, mutate: mutateLinks, isLoading: loadingLinks } = useSWR(
    selectedProjectId ? `/api/links?projectId=${selectedProjectId}` : null,
    fetcher
  );
  const rawLinks = linksData?.links || [];
  const links = rawLinks.filter((l: any) => 
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const internalLinks = links.filter((l: any) => l.url?.includes('dashboard?channel='));
  const externalLinks = links.filter((l: any) => !l.url?.includes('dashboard?channel='));

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
        description: copyLinkModalState.link.description
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
      toast.success('專案建立成功！');
      setIsNewProjectModalOpen(false);
      setNewProject({ name: '', description: '' });
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
      body: JSON.stringify(editProjectData)
    });
    if (res.ok) {
      toast.success('專案更新成功！');
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
      setNewLink({ title: '', url: '', description: '' });
      mutateLinks();
    } else {
      const data = await res.json();
      toast.error(data.error);
    }
  };

  const handleDeleteLink = async (id: number) => {
    if (!confirm('確定要刪除這個連結嗎？')) return;
    const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('已刪除連結');
      mutateLinks();
    }
  };

  const openMembersModal = async () => {
    // 取得所有使用者與該專案成員
    const [resMembers, resUsers] = await Promise.all([
      fetch(`/api/projects/${selectedProjectId}/members`),
      fetch('/api/admin/users')
    ]);
    if (resMembers.ok && resUsers.ok) {
      const dataMembers = await resMembers.json();
      const dataUsers = await resUsers.json();
      setProjectMembers(dataMembers.memberIds || []);
      setAllUsers(dataUsers.users || []);
      setIsMembersModalOpen(true);
    }
  };

  const handleSaveMembers = async () => {
    const res = await fetch(`/api/projects/${selectedProjectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: projectMembers })
    });
    if (res.ok) {
      setIsMembersModalOpen(false);
      toast.success('成員權限更新成功');
    } else {
      const data = await res.json();
      toast.error(data.error || '更新失敗');
    }
  };

  if (!selectedProjectId || !activeProject) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">
        {/* 歡迎區塊 */}
        <div className="p-8 rounded-3xl glass-panel relative overflow-hidden bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full mix-blend-screen filter blur-[80px] -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10">
            <h2 className="text-3xl font-semibold mb-3">歡迎來到 Workspace</h2>
            <p className="text-white/60 max-w-lg text-sm leading-relaxed">
              在這裡您可以集中管理所有散落的 NBLMs 專案。透過左側選單進入現有專案，或建立新專案以開始整理連結。
            </p>
            
            <div className="mt-8 flex gap-4">
              <button 
                onClick={() => setIsNewProjectModalOpen(true)}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-primary/20"
              >
                <span className="mr-2">+</span>馬上建立新專案
              </button>
            </div>
          </div>
        </div>

        {/* New Project Modal */}
        {isNewProjectModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
             <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl relative">
                <button onClick={() => setIsNewProjectModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
                <h3 className="text-xl font-medium mb-4">建立新專案</h3>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">專案名稱</label>
                    <input required autoFocus className="glass-input" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="例如: 2024 行銷企劃研究" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">專案描述 (選填)</label>
                    <textarea className="glass-input resize-none h-20" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} placeholder="簡述這個專案的目標與範圍..." />
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

  return (
    <div className="space-y-6 animate-in fade-in py-4">
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
                    setEditProjectData({ name: activeProject.name, description: activeProject.description || '' });
                    setIsEditProjectModalOpen(true);
                  }} 
                  className="text-white/20 hover:text-white/80 p-1 opacity-0 group-hover:opacity-100 transition-all rounded bg-white/5 hover:bg-white/10"
                  title="編輯專案設定"
                >
                  ✎
                </button>
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
        <div className="space-y-8 animate-in fade-in">
          {/* Internal Links Area (Always shown) */}
          <div>
            <h3 className="text-lg font-medium text-white/80 mb-4 flex items-center gap-2">
              <span>🗂️</span> 內部 Channel 連結
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
              {internalLinks.length > 0 ? internalLinks.map((link: any) => {
                const match = link.url.match(/channel=([^&]+)/);
                const targetChannelId = match ? match[1] : null;

                return (
                  <a 
                    key={link.id}
                    href={link.url}
                    onClick={(e) => {
                      if (targetChannelId) {
                        e.preventDefault();
                        setSelectedProjectId(Number(targetChannelId));
                        router.push(`/dashboard?channel=${targetChannelId}`);
                        window.scrollTo(0, 0);
                      }
                      fetch(`/api/projects/${selectedProjectId}/track`, { method: 'POST' }).catch(() => {});
                    }}
                    className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors group relative overflow-hidden flex flex-col h-full min-h-[160px]"
                  >
                     <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                       {hasWriteAccessProjects.length > 0 && (
                         <button 
                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCopyLinkModalState({ isOpen: true, link }); }}
                           className="text-white/40 hover:text-white transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md"
                           title="收錄至其他 Channel"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         </button>
                       )}
                       {isOwnerOrAdmin && (
                         <button 
                           onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLink(link.id); }}
                           className="text-white/40 hover:text-red-400 transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md"
                           title="刪除"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                       )}
                     </div>
                     <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-xl mb-4 border border-amber-500/30 shrink-0 shadow-[inset_0_2px_10px_rgba(245,158,11,0.2)]">
                       📂
                     </div>
                     <h4 className="font-medium text-amber-100/90 mb-1 line-clamp-2 leading-snug">{link.title}</h4>
                     <p className="text-xs text-amber-100/50 line-clamp-2 mb-4 flex-1">
                       {link.description || '無備註'}
                     </p>
                  </a>
                );
              }) : (
                <div className="col-span-full py-8 text-center text-white/30 text-sm italic">
                  目前尚未收錄任何內部 Channel 連結
                </div>
              )}
            </div>
          </div>

          {/* External Links Area (Always shown) */}
          <div>
            <h3 className="text-lg font-medium text-white/80 mb-4 flex items-center gap-2">
              <span>🔗</span> 外部網頁連結
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {externalLinks.length > 0 ? externalLinks.map((link: any) => (
                <a 
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    fetch(`/api/projects/${selectedProjectId}/track`, { method: 'POST' }).catch(() => {});
                  }}
                  className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group relative overflow-hidden flex flex-col h-full min-h-[160px]"
                >
                   <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                     {hasWriteAccessProjects.length > 0 && (
                       <button 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCopyLinkModalState({ isOpen: true, link }); }}
                         className="text-white/40 hover:text-white transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md"
                         title="收錄至其他 Channel"
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                       </button>
                     )}
                     {isOwnerOrAdmin && (
                       <button 
                         onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLink(link.id); }}
                         className="text-white/40 hover:text-red-400 transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md"
                         title="刪除"
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                     )}
                   </div>
                   <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl mb-4 border border-blue-500/30 shrink-0">
                     📓
                   </div>
                   <h4 className="font-medium text-white/90 mb-1 line-clamp-2 leading-snug">{link.title}</h4>
                   <p className="text-xs text-white/50 line-clamp-2 mb-4 flex-1">
                     {link.description || '無備註'}
                   </p>
                   <div className="flex items-center justify-between text-[10px] text-white/30 border-t border-white/5 pt-3 mt-auto shrink-0">
                     <span className="truncate pr-2">{new URL(link.url).hostname}</span>
                     <span>{new Date(link.created_at).toLocaleDateString()}</span>
                   </div>
                </a>
              )) : (
                <div className="col-span-full py-8 text-center text-white/30 text-sm italic glass-panel border-dashed border-white/5 rounded-xl">
                  目前尚未收錄任何外部連結
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {isEditProjectModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in transition-all">
             <div className="bg-card w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl relative">
                <button onClick={() => setIsEditProjectModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
                <h3 className="text-xl font-medium mb-4">編輯專案設定</h3>
                <form onSubmit={handleEditProject} className="space-y-4">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">專案名稱</label>
                    <input required autoFocus className="glass-input" value={editProjectData.name} onChange={e => setEditProjectData({...editProjectData, name: e.target.value})} placeholder="專案名稱" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">專案描述</label>
                    <textarea className="glass-input resize-none h-20" value={editProjectData.description} onChange={e => setEditProjectData({...editProjectData, description: e.target.value})} placeholder="簡述這個專案的目標與範圍..." />
                  </div>
                  <div className="flex justify-between items-center pt-4">
                    <button type="button" onClick={async () => {
                      if(confirm('確定要永久刪除此專案嗎？動作無法復原。')) {
                        const res = await fetch(`/api/projects/${selectedProjectId}`, { method: 'DELETE' });
                        if(res.ok) {
                          toast.success('已刪除專案');
                          setIsEditProjectModalOpen(false);
                          setSelectedProjectId(null);
                          await refreshProjects();
                        }
                      }
                    }} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">刪除專案</button>
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
                  <label className="text-xs text-white/50 block mb-1">簡單備註 (選填)</label>
                  <textarea className="glass-input resize-none h-20" value={newLink.description} onChange={e => setNewLink({...newLink, description: e.target.value})} placeholder="簡述這個筆記本的核心重點..." />
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
              <h3 className="text-xl font-medium mb-1">專案成員存取權限</h3>
              <p className="text-xs text-white/40 mb-4 pb-4 border-b border-white/10">打勾表示授權該使用者可以「唯讀」此專案的所有筆記本連結。</p>
              
              <div className="overflow-y-auto flex-1 space-y-2 mb-4">
                {allUsers.map(u => {
                  if (u.role === 'admin') return null; // Admin has global access
                  const isChecked = projectMembers.includes(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={(e) => {
                           if (e.target.checked) setProjectMembers([...projectMembers, u.id]);
                           else setProjectMembers(projectMembers.filter(id => id !== u.id));
                        }}
                        className="w-4 h-4 rounded border-white/20 bg-black/50 text-primary focus:ring-primary focus:ring-offset-background" 
                      />
                      <span className="text-sm font-medium">{u.username}</span>
                    </label>
                  );
                })}
                {allUsers.filter(u => u.role !== 'admin').length === 0 && (
                  <div className="text-sm text-white/40 text-center py-4">目前系統沒有任何 Member 成員可以授權。</div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10 shrink-0">
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
    </div>
  );
}
