import re

with open('app/dashboard/page.tsx', 'r') as f:
    content = f.read()

# 1. State Additions
state_patch = """
  // Edit Link Modal
  const [isEditLinkModalOpen, setIsEditLinkModalOpen] = useState(false);
  const [editLinkData, setEditLinkData] = useState({ id: 0, title: '', url: '', description: '' });

  // Drag and Drop State for Links
  const [draggedLinkId, setDraggedLinkId] = useState<number | null>(null);
  const [draggedLinkType, setDraggedLinkType] = useState<string | null>(null);
"""
content = content.replace("  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });", "  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' });\n" + state_patch)

# 2. Filter Logic Update
old_filters = """  const internalLinks = links.filter((l: any) => l.url?.includes('dashboard?channel='));
  const externalLinks = links.filter((l: any) => !l.url?.includes('dashboard?channel='));"""

new_filters = """  const internalLinks = links.filter((l: any) => l.url?.includes('dashboard?channel='));
  const notebookLMLinks = links.filter((l: any) => !l.url?.includes('dashboard?channel=') && l.url?.includes('notebooklm.google.com'));
  const otherLinks = links.filter((l: any) => !l.url?.includes('dashboard?channel=') && !l.url?.includes('notebooklm.google.com'));"""

content = content.replace(old_filters, new_filters)

# 3. Handlers Additions
handlers_patch = """
  const handleEditLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/links/${editLinkData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editLinkData.title, url: editLinkData.url, description: editLinkData.description })
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
    const finalOrderedIds = [...newArray.map(l => l.id), ...allOtherLinks.map(l => l.id)];
    
    // Optimistic update
    mutateLinks({ links: [...links].sort((a,b) => finalOrderedIds.indexOf(a.id) - finalOrderedIds.indexOf(b.id)) }, false);

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
"""
content = content.replace("  const handleDeleteLink = async (id: number) => {", handlers_patch + "\n  const handleDeleteLink = async (id: number) => {")

# 4. Extract card rendering logic into a helper function inside the component to avoid code duplication
# We define renderLinksSection helper before the return statement

render_helper = """
  const renderLinksSection = (title: string, icon: string, linkArray: any[], type: string, emptyMessage: string, bgClass = 'bg-white/5', borderClass = 'border-white/10', iconBg = 'bg-blue-500/20', iconBorder = 'border-blue-500/30', emoji = '📓') => (
    <div>
      <h3 className="text-lg font-medium text-white/80 mb-4 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${type==='internal' ? 'bg-black/20 p-4 rounded-2xl border border-white/5' : ''}`}>
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
              className={`p-5 rounded-xl ${bgClass} border ${borderClass} hover:opacity-80 transition-all group relative overflow-hidden flex flex-col h-full min-h-[160px] cursor-pointer ${draggedLinkId === link.id ? 'opacity-50 blur-sm scale-95' : ''}`}
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
                   <>
                     <button
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditLinkData({ id: link.id, title: link.title, url: link.url, description: link.description || '' }); setIsEditLinkModalOpen(true); }}
                       className="text-white/40 hover:text-white transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md"
                       title="編輯"
                     >
                       ✎
                     </button>
                     <button 
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteLink(link.id); }}
                       className="text-white/40 hover:text-red-400 transition-colors bg-black/40 p-1.5 rounded-md backdrop-blur-md"
                       title="刪除"
                     >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     </button>
                   </>
                 )}
               </div>
               <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center text-xl mb-4 border ${iconBorder} shrink-0`}>
                 {emoji}
               </div>
               <h4 className="font-medium text-white/90 mb-1 line-clamp-2 leading-snug">{link.title}</h4>
               <p className="text-xs text-white/50 line-clamp-2 mb-4 flex-1">
                 {link.description || '無備註'}
               </p>
               {!isInternal && (
                 <div className="flex items-center justify-between text-[10px] text-white/30 border-t border-white/5 pt-3 mt-auto shrink-0">
                   <span className="truncate pr-2">{new URL(link.url).hostname}</span>
                   <span>{new Date(link.created_at).toLocaleDateString()}</span>
                 </div>
               )}
            </a>
          );
        }) : (
          <div className="col-span-full py-8 text-center text-white/30 text-sm italic glass-panel border-dashed border-white/5 rounded-xl">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
"""

# Replace the giant render block with the helper function and the 3 sections call
render_replacement = """          {/* Internal Links */}
          {renderLinksSection("內部 Channel 連結", "🗂️", internalLinks, "internal", "目前尚未收錄任何內部 Channel 連結", "bg-amber-500/10", "border-amber-500/20", "bg-amber-500/20 shadow-[inset_0_2px_10px_rgba(245,158,11,0.2)]", "border-amber-500/30", "📂")}

          {/* NotebookLM Links */}
          {renderLinksSection("NotebookLM 專用", "📓", notebookLMLinks, "notebooklm", "目前尚未收錄任何 NotebookLM 連結", "bg-blue-500/10", "border-blue-500/20", "bg-blue-500/20", "border-blue-500/30", "📝")}

          {/* Other External Links */}
          {renderLinksSection("其他外部連結", "🔗", otherLinks, "other", "目前尚未收錄任何外部連結", "bg-white/5", "border-white/10", "bg-white/10", "border-white/20", "🌐")}
"""

# We need to inject render_helper right before `if (!selectedProjectId || !activeProject) {`
content = content.replace("  if (!selectedProjectId || !activeProject) {", render_helper + "\n  if (!selectedProjectId || !activeProject) {")

# Then replace the original DOM
# From `{/* Internal Links Area (Always shown) */}` to the end of `{/* External Links Area (Always shown) */}`
old_dom_pattern = r"\{/\* Internal Links Area \(Always shown\) \*/\}(.*?)\{/\* External Links Area \(Always shown\) \*/\}(.*?)\</div>\s*</div>"

# Use regex to replace
content = re.sub(old_dom_pattern, render_replacement, content, flags=re.DOTALL)


# 5. Add Edit Link Modal UI
edit_modal_ui = """
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
                  <label className="text-xs text-white/50 block mb-1">簡單備註 (選填)</label>
                  <textarea className="glass-input resize-none h-20" value={editLinkData.description} onChange={e => setEditLinkData({...editLinkData, description: e.target.value})} placeholder="簡述這個筆記本的核心重點..." />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setIsEditLinkModalOpen(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors">取消</button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">儲存變更</button>
                </div>
              </form>
           </div>
        </div>
      )}
"""

content = content.replace("{/* Delete Link Confirm Modal */}", "{/* Delete Link Confirm Modal */}\n" + edit_modal_ui)


with open('app/dashboard/page.tsx', 'w') as f:
    f.write(content)
print("done")
