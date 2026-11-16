"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useT } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function ForgotPasswordPage() {
  const { t, dir } = useT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      // Always show success to prevent email enumeration
      setLoading(false);
      setDone(true);
    }
  };

  return (
    <div dir={dir} className="k-auth">
      <div className="k-auth-top">
        <LanguageSwitcher />
      </div>

      <div className="k-auth-box">
        <div className="k-center" style={{ marginBottom: "1.5rem" }}>
          <h1 className="k-title" style={{ fontSize: "1.5rem", margin: 0 }}>{t("app.name")}</h1>
        </div>

        <div className="k-card" style={{ padding: "1.5rem" }}>
          {done ? (
            <div className="k-center k-stack" style={{ alignItems: "stretch" }}>
              <p className="k-emoji">✅</p>
              <p style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--k-ok)" }}>
                {t("forgot.success")}
              </p>
              <Link href="/login" className="k-btn k-btn-primary">{t("forgot.back")}</Link>
            </div>
          ) : (
            <>
              <h2 className="k-title" style={{ marginBottom: ".25rem" }}>🔑 {t("forgot.title")}</h2>
              <p className="k-muted" style={{ marginBottom: "1.25rem" }}>{t("forgot.subtitle")}</p>

              <form onSubmit={handleSubmit} className="k-stack" style={{ gap: "1rem" }}>
                <div className="k-field">
                  <label className="k-label" htmlFor="forgot-email">{t("common.email")}</label>
                  <input
                    id="forgot-email"
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

                <button type="submit" disabled={loading} className="k-btn k-btn-primary">
                  {loading ? `⏳ ${t("forgot.sending")}` : t("forgot.submit")}
                </button>
              </form>

              <p className="k-center" style={{ marginTop: ".75rem" }}>
                <Link href="/login" className="k-link k-link-quiet">← {t("forgot.back")}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}