"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Link from "next/link";

export default function LoginPage() {
  const { user, login, logout, loading: authLoading } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const role = await login(email, password);
      router.push(`/dashboard/${role}`);
    } catch {
      setError(t('login.invalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = () => {
    logout();
  };

  return (
    <div className="k-auth">
      <div className="k-auth-box">
        <div className="k-center" style={{ marginBottom: "1.5rem" }}>
          <div className="k-logo">
            <img src="/logo.jpg" alt="LAC-T-Online" />
          </div>
          <h1 className="k-title" style={{ fontSize: "1.5rem", margin: ".75rem 0 .25rem" }}>{t('app.name')}</h1>
          <p className="k-muted">{t('app.tagline')}</p>
          <div style={{ marginTop: ".75rem", display: "flex", justifyContent: "center" }}>
            <LanguageSwitcher />
          </div>
        </div>

        {authLoading ? (
          <div className="k-card k-center k-muted" style={{ padding: "2rem" }}>
            ⏳ {t('common.loading')}
          </div>
        ) : user ? (
          <div className="k-card k-center k-stack" style={{ padding: "1.5rem", alignItems: "stretch" }}>
            <div>
              <span className="k-avatar">{user.first_name[0]}{user.last_name[0]}</span>
            </div>
            <p style={{ fontSize: "1.125rem", fontWeight: 700 }}>{user.first_name} {user.last_name}</p>
            <p className="k-muted">{user.email}</p>
            <div><span className="k-role">{t(`role.${user.role}`)}</span></div>
            <p className="k-muted">{t('login.already_logged_in', { email: user.email })}</p>
            <Link href={`/dashboard/${user.role}`} className="k-btn k-btn-primary">
              {t('login.go_to_dashboard')}
            </Link>
            <button type="button" onClick={handleSwitchAccount} className="k-btn k-btn-light">
              {t('login.switch_account')}
            </button>
          </div>
        ) : (
          <div className="k-card" style={{ padding: "1.5rem" }}>
            <h2 className="k-title" style={{ marginBottom: ".25rem" }}>{t('login.title')}</h2>
            <p className="k-muted" style={{ marginBottom: "1.25rem" }}>{t('login.subtitle')}</p>

            <form onSubmit={handleSubmit} className="k-stack" style={{ gap: "1rem" }}>
              <div className="k-field">
                <label className="k-label" htmlFor="login-email">{t('common.email')}</label>
                <input
                  id="login-email"
                  className="k-input"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@dtms.com"
                />
              </div>

              <div className="k-field">
                <label className="k-label" htmlFor="login-password">{t('login.password')}</label>
                <input
                  id="login-password"
                  className="k-input"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
                <div>
                  <Link href="/forgot-password" className="k-link">{t('login.forgot_password')}</Link>
                </div>
              </div>

              {error && <p className="k-alert" role="alert">{error}</p>}

              <button type="submit" disabled={loading} className="k-btn k-btn-primary">
                {loading ? `⏳ ${t('common.signing_in')}` : t('common.sign_in')}
              </button>

              <p className="k-muted k-center">
                طالبة جديدة؟{" "}
                <Link href="/register" className="k-link">سجّلي حساب جديد</Link>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}