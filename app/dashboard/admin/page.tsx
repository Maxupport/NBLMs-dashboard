"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'users' | 'applications' | 'channels'>('users');
  
  // New User Form State
  const [newUser, setNewUser] = useState({ username: '', role: 'member' });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Channel Members Management State
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedChannelForMembers, setSelectedChannelForMembers] = useState<any>(null);
  const [projectMembers, setProjectMembers] = useState<{ id: number; role: string }[]>([]);
  const [allEligibleUsers, setAllEligibleUsers] = useState<any[]>([]);

  const { data: usersData, mutate: mutateUsers, isLoading: loadingUsers } = useSWR('/api/admin/users', fetcher, {
    onError: (err) => {
      if (err.message.includes('拒絕存取')) router.push('/dashboard');
    }
  });
  
  const { data: appsData, mutate: mutateApps, isLoading: loadingApps } = useSWR('/api/admin/applications', fetcher);
  const { data: settingsData, mutate: mutateSettings } = useSWR('/api/admin/settings', fetcher);
  const { data: channelsData, mutate: mutateChannels, isLoading: loadingChannels } = useSWR('/api/admin/channels', fetcher);

  const usersRaw = usersData?.users || [];
  // Sort users: Normal members first, Admins/Ghost at the bottom
  const users = [...usersRaw].sort((a, b) => {
    const isSpecialA = a.role === 'admin' || a.username === 'Ghost';
    const isSpecialB = b.role === 'admin' || b.username === 'Ghost';
    if (isSpecialA && !isSpecialB) return 1;
    if (!isSpecialA && isSpecialB) return -1;
    return 0;
  });
  const applications = appsData?.applications || [];
  const channels = channelsData?.channels || [];
  const loading = loadingUsers || loadingApps || loadingChannels;
  const fbOpen = settingsData?.settings?.feedback_board_open === 'true';

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setGeneratedPassword("");
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('帳號建立成功！');
        setGeneratedPassword(data.user.generatedPassword);
        setNewUser({ username: '', role: 'member' });
        mutateUsers(); // reload
      } else {
        toast.error(data.error || '建立失敗');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleApprove = async (id: number) => {
    const res = await fetch('/api/admin/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'approve' })
    });
    if (res.ok) {
      toast.success('已核准並自動建立帳號');
      mutateApps();
      mutateUsers();
    } else {
      const data = await res.json();
      toast.error(data.error || '操作失敗');
    }
  };

  const handleReject = async (id: number) => {
    const res = await fetch('/api/admin/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'reject' })
    });
    if (res.ok) {
      toast.success('已拒絕該申請');
      mutateApps();
    } else {
      const data = await res.json();
      toast.error(data.error || '操作失敗');
    }
  };

  const toggleFeedbackBoard = async () => {
    const newVal = fbOpen ? 'false' : 'true';
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'feedback_board_open', value: newVal })
    });
    if (res.ok) {
      toast.success(newVal === 'true' ? '留言板已開放' : '留言板已強制關閉');
      mutateSettings();
    } else {
      toast.error('設定失敗');
    }
  };

  const openMembersModal = async (channel: any) => {
    setSelectedChannelForMembers(channel);
    const res = await fetch(`/api/projects/${channel.id}/members`);
    if (res.ok) {
      const data = await res.json();
      setProjectMembers(data.members || []);
      setAllEligibleUsers(data.allEligibleUsers || []);
      setIsMembersModalOpen(true);
    }
  };

  const handleSaveMembers = async () => {
    if (!selectedChannelForMembers) return;
    const res = await fetch(`/api/projects/${selectedChannelForMembers.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: projectMembers })
    });
    if (res.ok) {
      setIsMembersModalOpen(false);
      toast.success('頻道成員權限更新成功');
      mutateChannels();
    } else {
      const data = await res.json();
      toast.error(data.error || '更新失敗');
    }
  };


  // Password Visibility Toggle
  const [showUserPwdIds, setShowUserPwdIds] = useState<number[]>([]);
  const toggleUserPwd = (id: number) => {
    setShowUserPwdIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const [showAppPwdIds, setShowAppPwdIds] = useState<number[]>([]);
  const toggleAppPwd = (id: number) => {
    setShowAppPwdIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const pendingCount = applications.filter((a: any) => a.status === 'pending').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in py-6">
      <div className="flex items-center justify-between bg-card/30 p-6 rounded-2xl border border-white/5 shadow-xl">
        <div>
          <h2 className="text-2xl font-semibold">系統與帳號管理</h2>
          <p className="text-white/50 text-sm mt-1">管理所有系統成員、註冊申請與全域設定</p>
        </div>
        <div className="flex gap-4 items-center">
           <div className="flex flex-col items-end">
              <span className="text-xs text-white/50 mb-1">使用者回饋 (互動留言板) 開放狀態</span>
              <button 
                onClick={toggleFeedbackBoard} 
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fbOpen ? 'bg-green-500' : 'bg-white/20'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fbOpen ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
           </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border pl-2">
        <button 
          className={`pb-3 px-1 text-sm font-medium transition-colors interactive-card ${activeTab === 'users' ? 'text-primary border-b-2 border-primary' : 'text-white/50 hover:text-white'}`}
          onClick={() => setActiveTab('users')}
        >
          現有成員
        </button>
        <button 
          className={`pb-3 px-1 text-sm font-medium transition-colors relative flex items-center gap-2 interactive-card ${activeTab === 'applications' ? 'text-primary border-b-2 border-primary' : 'text-white/50 hover:text-white'}`}
          onClick={() => setActiveTab('applications')}
        >
          待審核申請
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-lg shadow-red-500/20">
              {pendingCount}
            </span>
          )}
        </button>
        <button 
          className={`pb-3 px-1 text-sm font-medium transition-colors interactive-card ${activeTab === 'channels' ? 'text-primary border-b-2 border-primary' : 'text-white/50 hover:text-white'}`}
          onClick={() => setActiveTab('channels')}
        >
          📂 頻道總管
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center"><span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : activeTab === 'users' ? (
        <div className="flex flex-col gap-8">
          
          <div className="glass-panel rounded-xl overflow-hidden order-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/20 text-white/50">
                <tr>
                  <th className="p-4 font-medium">帳號</th>
                  <th className="p-4 font-medium">權限</th>
                  <th className="p-4 font-medium text-center whitespace-nowrap">狀態</th>
                  <th className="p-4 font-medium">密碼</th>
                  <th className="p-4 font-medium text-center whitespace-nowrap">頻道</th>
                  <th className="p-4 font-medium whitespace-nowrap">最後登入</th>
                  <th className="p-4 font-medium whitespace-nowrap">管理</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {users.map((u: any) => (
                  <tr key={u.id} className={`transition-colors ${u.status === 'disabled' ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'}`}>
                    <td className="p-4 font-medium">{u.username}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs ${u.status === 'disabled' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {u.status === 'disabled' ? '已停用' : '正常'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white/70 w-24 truncate">
                          {showUserPwdIds.includes(u.id) ? (u.raw_password || "舊資料無紀錄") : "••••••••"}
                        </span>
                        <button 
                          onClick={() => toggleUserPwd(u.id)} 
                          className={`text-[10px] px-2 py-0.5 rounded border transition-all whitespace-nowrap shrink-0 ${showUserPwdIds.includes(u.id) ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                        >
                          {showUserPwdIds.includes(u.id) ? "隱藏" : "查看"}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono whitespace-nowrap">
                      <span className="text-white/80">{u.channel_count || 0}</span> 
                      {u.role === 'admin' ? (
                        <span className="text-amber-500/50 text-[10px] ml-1">∞</span>
                      ) : (
                        <span className="text-white/30 text-[10px] ml-1">/ 10</span>
                      )}
                    </td>
                    <td className="p-4 text-white/50 text-[10px] whitespace-nowrap">
                      {u.last_login_at ? new Date(u.last_login_at + 'Z').toLocaleString('zh-TW', { hour12: false }) : '從未登入'}
                    </td>
                    <td className="p-4">
                      {u.role !== 'admin' && u.username !== 'Ghost' && (
                        <div className="flex gap-2 whitespace-nowrap">
                          <button 
                            onClick={async () => {
                              const newStatus = u.status === 'disabled' ? 'active' : 'disabled';
                              if (!confirm(`確定要將該帳號設為 ${newStatus === 'disabled' ? '停用' : '啟用'} 嗎？`)) return;
                              const res = await fetch(`/api/admin/users/${u.id}/status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: newStatus })
                              });
                              if (res.ok) {
                                toast.success(`帳號已${newStatus === 'disabled' ? '停用' : '啟用'}`);
                                mutateUsers();
                              }
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${u.status === 'disabled' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'}`}
                          >
                            {u.status === 'disabled' ? '啟用' : '停用'}
                          </button>
                          
                          <button 
                            onClick={async () => {
                              if (!confirm(`⚠️ 危險操作：確定要【永久刪除】使用者「${u.username}」嗎？\n此動作將一併刪除該帳號建立的所有頻道與資料，且無法還原！`)) return;
                              const res = await fetch(`/api/admin/users/${u.id}`, {
                                method: 'DELETE'
                              });
                              if (res.ok) {
                                toast.success('帳號已永久刪除');
                                mutateUsers();
                              } else {
                                const data = await res.json();
                                toast.error(data.error || '刪除失敗');
                              }
                            }}
                            className="px-2 py-1 rounded text-xs font-medium border bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            刪除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 手動建立帳位區 - 移動至下方 */}
          <div className="glass-panel p-6 rounded-xl order-2">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>👤</span> 主動建立新帳號
            </h3>
            <p className="text-sm text-white/50 mb-6 font-light">
              管理員可直接為夥伴建立帳號。建立後，系統會自動授權該成員進入所有的「全域使用說明頻道」。
            </p>
            
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="text-xs text-white/50 mb-1 block">使用者名稱 Username</label>
                <input required type="text" className="glass-input text-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} placeholder="例如: Partner_A" />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">權限角色 Role</label>
                <select className="glass-input text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="member">一般成員 (Member)</option>
                  <option value="admin">管理員 (Admin)</option>
                </select>
              </div>
              <button disabled={isCreating} type="submit" className="glass-button py-2 text-sm">建立帳號並產生密碼</button>
            </form>

            {generatedPassword && (
              <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg animate-in slide-in-from-top-2">
                <p className="text-xs text-primary mb-2 font-medium">✅ 帳號建立成功！請複製以下資訊給使用者：</p>
                <div className="bg-black/40 p-3 rounded text-sm font-mono tracking-wide flex justify-between items-center group border border-white/5">
                  <div className="text-white/70">密碼：<span className="text-white ml-2 select-all break-all">{generatedPassword}</span></div>
                  <button 
                    type="button"
                    onClick={() => {
                       navigator.clipboard.writeText(generatedPassword);
                       toast.success('密碼已成功複製至剪貼簿！');
                    }}
                    className="p-1 px-3 bg-white/10 hover:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-all text-xs flex items-center gap-1 text-white border border-white/10"
                  >
                    <span>📋</span> 複製
                  </button>
                </div>
                <p className="text-[10px] text-white/40 mt-2">提示：這是隨機產生的高強度密碼，為了安全系統不會明文儲存，請立刻複製。</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'applications' ? (
        /* 申請列表 */
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
              <thead className="bg-black/20 text-white/50">
                <tr>
                  <th className="p-4 font-medium">帳號</th>
                  <th className="p-4 font-medium">信箱</th>
                  <th className="p-4 font-medium">密碼</th>
                  <th className="p-4 font-medium">備註</th>
                  <th className="p-4 font-medium">審核</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {applications.filter((a: any) => a.status === 'pending').map((app: any) => (
                  <tr key={app.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-medium">{app.username}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-white/70 w-24 truncate">
                          {showAppPwdIds.includes(app.id) ? (app.raw_password || "舊資料無紀錄") : "••••••••"}
                        </span>
                        <button 
                          onClick={() => toggleAppPwd(app.id)} 
                          className={`text-xs px-1.5 py-0.5 rounded border transition-all ${showAppPwdIds.includes(app.id) ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                        >
                          {showAppPwdIds.includes(app.id) ? "隱藏" : "查看"}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-white/50 italic max-w-xs truncate">{app.note || '無'}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(app.id)} className="px-3 py-1 bg-green-500/20 text-green-300 hover:bg-green-500/30 rounded transition-colors text-xs font-medium">核准</button>
                        <button onClick={() => handleReject(app.id)} className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded transition-colors text-xs font-medium">拒絕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {applications.filter((a: any) => a.status === 'pending').length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-white/40">目前沒有待審核的申請。</td></tr>
                )}
              </tbody>
          </table>
        </div>
      ) : (
        /* 頻道管理列表 */
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm">
              <thead className="bg-black/20 text-white/50">
                <tr>
                  <th className="p-4 font-medium">頻道名稱</th>
                  <th className="p-4 font-medium">建立者</th>
                  <th className="p-4 font-medium text-center">狀態</th>
                  <th className="p-4 font-medium">密碼</th>
                  <th className="p-4 font-medium text-center">參與人數</th>
                  <th className="p-4 font-medium">最後檢視 (外部連結)</th>
                  <th className="p-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {channels.map((c: any) => (
                  <tr key={c.id} className={`transition-colors ${c.status === 'disabled' ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'}`}>
                    <td className="p-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{c.icon}</span> <span className={`${c.status === 'disabled' ? 'line-through text-white/40' : 'text-white'}`}>{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${c.owner_role === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'bg-green-500/20 text-green-300'}`}>
                        {c.owner_username}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${c.status === 'disabled' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {c.status === 'disabled' ? '已停用' : '正常'}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono">
                      <span className="text-white/80">{c.member_count}</span> <span className="text-white/30 text-xs">人</span>
                    </td>
                    <td className="p-4 text-white/50 text-xs">
                      {c.last_viewed_at ? new Date(c.last_viewed_at + 'Z').toLocaleString('zh-TW', { hour12: false }) : '無活動紀錄'}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => openMembersModal(c)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white/80 transition-colors flex items-center gap-1"
                        >
                          <span>👥</span> 權限
                        </button>
                          <button 
                            onClick={async () => {
                              if (!confirm(`⚠️ 確定要【永久刪除】頻道「${c.name}」嗎？\n此動作將一併刪除所有子頻道、連結與權限資料，且無法還原！`)) return;
                              const res = await fetch(`/api/projects/${c.id}`, {
                                method: 'DELETE'
                              });
                              if (res.ok) {
                                toast.success('頻道已成功永久刪除');
                                mutateChannels();
                              } else {
                                const data = await res.json();
                                toast.error(data.error || '刪除失敗');
                              }
                            }}
                            className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 transition-colors"
                          >
                            刪除
                          </button>
                          
                          <button 
                            onClick={async () => {
                              const newStatus = c.status === 'disabled' ? 'active' : 'disabled';
                              if (c.owner_role === 'admin') {
                                return toast.error('系統保護：無法變更管理員建立的頻道狀態');
                              }
                              const res = await fetch(`/api/admin/channels/${c.id}/status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: newStatus })
                              });
                              if (res.ok) {
                                toast.success(`頻道已${newStatus === 'disabled' ? '停用' : '啟用'}`);
                                mutateChannels();
                              } else {
                                const data = await res.json();
                                toast.error(data.error || '操作失敗');
                              }
                            }}
                            className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${c.status === 'disabled' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20'}`}
                          >
                            {c.status === 'disabled' ? '啟用' : '停用'}
                          </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {channels.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-white/40">目前沒有任何頻道資料。</td></tr>
                )}
              </tbody>
            </table>
        </div>
      )}

      {/* Manage Members Modal */}
      {isMembersModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
           <div className="bg-card w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl relative flex flex-col max-h-[80vh]">
              <button onClick={() => setIsMembersModalOpen(false)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
              <h3 className="text-xl font-medium mb-1">頻道成員存取權限控管</h3>
              <p className="text-xs text-white/40 mb-2">正在設定：{selectedChannelForMembers?.name}</p>
              <p className="text-xs text-white/30 mb-4 pb-4 border-b border-white/10">設定此頻道允許存取的名單與權限。加入後，該成員登入時將可在 Sidebar 看到並存取此頻道。</p>
              
              <div className="overflow-y-auto flex-1 space-y-2 mb-4">
                {/* 顯示已授權成員 */}
                {projectMembers.map(memberRecord => {
                  const u = allEligibleUsers.find(user => user.id === memberRecord.id);
                  if (!u) return null;
                  
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{u.username}</span>
                          <span className="text-[10px] text-white/30">{u.email || '無電子信箱'}</span>
                        </div>
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
              
              {/* 新增成員區塊 */}
              <div className="pt-4 border-t border-white/10 shrink-0 mb-4">
                <label className="text-xs text-white/50 block mb-2">新增授權成員</label>
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
                    {allEligibleUsers.filter(u => !projectMembers.find(m => m.id === u.id)).map(u => (
                      <option key={u.id} value={u.id} className="bg-[#1a1a1a]">{u.username} ({u.email || '無信箱'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setIsMembersModalOpen(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 transition-colors">取消</button>
                <button type="button" onClick={handleSaveMembers} className="px-4 py-2 rounded-lg text-sm bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">儲存並立即生效</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
