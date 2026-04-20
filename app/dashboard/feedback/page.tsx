"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import { useProjects } from "../ProjectContext";

export default function FeedbackPage() {
  const { userRole, userId } = useProjects();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch feedback list
  const { data, mutate, isLoading } = useSWR('/api/feedbacks', fetcher);
  // Fetch settings to check if board is open
  const { data: settingsData } = useSWR('/api/admin/settings', fetcher);

  const feedbacks = data?.feedbacks || [];
  const isOpen = settingsData?.settings?.feedback_board_open === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        toast.success("留言發佈成功！");
        setContent("");
        mutate();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || '發佈失敗');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定要刪除這則留言嗎？')) return;
    const res = await fetch(`/api/feedbacks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success("留言已刪除");
      mutate();
    } else {
      const errorData = await res.json();
      toast.error(errorData.error || '刪除失敗');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in py-6 p-4">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">💬 公共留言板</h2>
          <p className="text-white/50 text-sm mt-1">您可以在這裡留下建議、回報問題，或是與其他夥伴交流</p>
        </div>
      </div>

      {!isOpen && userRole !== 'admin' ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl text-sm flex items-center justify-center gap-2">
          <span>🔒</span> 管理員目前已關閉留言板的發言功能，僅供檢視。
        </div>
      ) : (
        <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <form relative="z-10" onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <textarea 
                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-y min-h-[100px] transition-all"
                placeholder="有什麼想告訴大家的嗎？若有圖片需求，請貼上您個人的雲端硬碟圖片連結..."
                value={content}
                onChange={e => setContent(e.target.value)}
                required
                disabled={isSubmitting || (!isOpen && userRole === 'admin')}
              />
            </div>
            
            <div className="flex justify-between items-center text-xs text-white/40">
              <div className="flex items-center gap-1.5">
                <span>💡</span> 支援直接貼上 Google Drive 或 Imgur 的公開圖片網址
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting || !content.trim() || (!isOpen && userRole === 'admin')}
                className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg transition-colors font-medium shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '發佈中...' : '送出留言'}
              </button>
            </div>
            {!isOpen && userRole === 'admin' && (
              <p className="text-red-400 text-xs mt-2">提示：留言板目前已被您關閉，若要發言請先至後台開啟。</p>
            )}
          </form>
        </div>
      )}

      {/* 留言列表 */}
      <div className="space-y-4 pt-4">
        {isLoading ? (
          <div className="flex justify-center py-10"><span className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /></div>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm glass-panel rounded-2xl border-dashed">
            <span className="text-4xl block mb-3 opacity-30">📭</span>
            目前還沒有任何留言，搶先發個聲吧！
          </div>
        ) : (
          feedbacks.map((fb: any) => {
            const isMine = fb.user_id?.toString() === userId;
            const canDelete = isMine || userRole === 'admin';
            
            // 簡易的 URL Parser，用來將文字中的網址轉成可點擊的連結（選用）
            const renderContent = (text: string) => {
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const parts = text.split(urlRegex);
              return parts.map((part, i) => {
                if (part.match(urlRegex)) {
                  return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">{part}</a>;
                }
                return part;
              });
            };

            return (
              <div key={fb.id} className={`p-5 rounded-2xl border transition-all ${isMine ? 'bg-indigo-900/10 border-indigo-500/20 shadow-lg shadow-indigo-500/5' : 'bg-card/40 border-white/5 shadow-md'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${!fb.username ? 'text-white/30 italic' : 'text-white/90'}`}>
                        {fb.username || '已刪除的使用者'}
                      </span>
                      {fb.role === 'admin' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-amber-500/20 text-amber-300">Admin</span>
                      )}
                      {isMine && <span className="text-[10px] text-white/30 border border-white/10 px-1.5 rounded-full">You</span>}
                    </div>
                    <span className="text-[10px] text-white/30 mt-0.5">{new Date(fb.created_at + 'Z').toLocaleString('zh-TW')}</span>
                  </div>
                  
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(fb.id)}
                      className="text-white/20 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                      title={userRole === 'admin' && !isMine ? '使用管理員權限刪除' : '刪除留言'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
                
                <div className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed mt-3 break-words">
                  {renderContent(fb.content)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
