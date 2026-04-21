"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteProjectId = searchParams.get('invite');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (inviteProjectId) {
      setIsLogin(false); // 透過邀請連結進來時，預設顯示註冊區
    }
  }, [inviteProjectId]);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    note: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("兩次輸入的密碼不一致");
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin ? formData : { ...formData, inviteProjectId: inviteProjectId ? Number(inviteProjectId) : undefined };
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "發生未知錯誤");
      }

      if (isLogin) {
        // Login success, redirect to dashboard
        router.push("/dashboard");
      } else {
        // Registration push success
        if (inviteProjectId) {
          setSuccess("註冊成功！系統已為您開通受邀頻道的存取權限。");
        } else {
          setSuccess("申請已送出！請等待管理員核准後方可登入。");
        }
        setIsLogin(true); // switch back to login tab
        setFormData({ username: "", password: "", confirmPassword: "", email: "", note: "" });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-70 animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/20 rounded-full mix-blend-screen filter blur-[120px] opacity-50 pointer-events-none" />

      <article className="relative z-10 w-full max-w-md p-8 glass-panel rounded-2xl mx-4">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-white/20 shadow-lg overflow-hidden">
            <img src="/logo.png" alt="NBLMs LinkStation Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">NBLMs LinkStation</h1>
          <p className="text-white/60 text-sm mt-1 whitespace-nowrap">NBLM 連結總站</p>
          <div className="mt-4">
            <p className="text-white/40 text-xs tracking-wide uppercase font-medium">
              {inviteProjectId && !isLogin ? (
                <span className="text-amber-300 flex items-center justify-center gap-1 animate-pulse">
                  🎁 受邀註冊中...
                </span>
              ) : isLogin ? "登入以管理您的知識庫" : "申請帳號以加入工作區"}
            </p>
          </div>
        </header>

        {/* Tab Toggle */}
        <nav className="flex p-1 bg-black/40 rounded-xl mb-8">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 ${
              isLogin ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white"
            }`}
            onClick={() => { setIsLogin(true); setError(""); setSuccess(""); }}
          >
            登入系統
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all active:scale-95 ${
              !isLogin ? "bg-white/10 text-white shadow" : "text-white/50 hover:text-white"
            }`}
            onClick={() => { setIsLogin(false); setError(""); setSuccess(""); }}
          >
            申請帳號
          </button>
        </nav>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm animate-in fade-in zoom-in duration-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm animate-in fade-in zoom-in duration-200">
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <section>
            <label className="block text-xs font-medium text-white/60 mb-1 ml-1">帳號 Username</label>
            <input
              type="text"
              name="username"
              required
              className="glass-input"
              placeholder="輸入您的帳號"
              value={formData.username}
              onChange={handleChange}
            />
          </section>

          <section className="relative">
            <label className="block text-xs font-medium text-white/60 mb-1 ml-1">密碼 Password</label>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              required
              className="glass-input pr-10"
              placeholder={isLogin ? "輸入您的密碼" : "設定高強度密碼"}
              value={formData.password}
              onChange={handleChange}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-white/40 hover:text-white transition-colors"
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </section>

          {!isLogin && (
            <section className="relative animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-xs font-medium text-white/60 mb-1 ml-1">確認密碼 Confirm Password</label>
              <input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                required
                className="glass-input pr-10"
                placeholder="再次輸入密碼以確認"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </section>
          )}

          {!isLogin && (
            <>
              <section className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-medium text-white/60 mb-1 ml-1">信箱 Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="glass-input"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </section>
              <section className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-medium text-white/60 mb-1 ml-1">申請備註 (選填)</label>
                <textarea
                  name="note"
                  className="glass-input min-h-[80px] resize-none"
                  placeholder="請簡述您的單位或申請原因"
                  value={formData.note}
                  onChange={handleChange}
                />
              </section>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="glass-button mt-6 flex items-center justify-center gap-2 active:scale-95"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isLogin ? (
              "登入"
            ) : (
              "送出申請"
            )}
          </button>
        </form>

        <footer className="mt-12 text-center">
           <p className="text-[10px] text-white/20 uppercase tracking-[0.2em]">Powered by Nathan & Maxupport</p>
        </footer>
      </article>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
      <AuthContent />
    </Suspense>
  );
}
