"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { studentAuthApi } from "@/lib/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", password: "",
    phone_number: "", city: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await studentAuthApi.register(form);
      router.push("/dashboard");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail || "حدث خطأ أثناء التسجيل، حاولي مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px",
    background: "var(--input-bg)", border: "1px solid var(--border)",
    borderRadius: 10, color: "var(--fg)", fontSize: 14,
    outline: "none", transition: "border-color 0.2s",
  };

  const labelStyle = {
    display: "block", fontSize: 13, fontWeight: 500, color: "var(--fg-2)",
    marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" as const,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
      padding: "40px 0",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(var(--border-soft) 1px, transparent 1px), linear-gradient(90deg, var(--border-soft) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        opacity: 0.4,
      }} />
      <div style={{
        position: "absolute", width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)",
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 460, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 80, height: 80, borderRadius: "50%",
            background: "white", marginBottom: 16,
            boxShadow: "0 0 40px rgba(16,185,129,0.25), 0 0 20px rgba(14,165,233,0.15)",
            overflow: "hidden",
          }}>
            <img src="/logo.jpg" alt="LAC-T-Online" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6 }} />
          </div>
          <h1 style={{
            fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800,
            color: "var(--fg)", letterSpacing: "-0.5px", marginBottom: 6,
          }}>تسجيل طالبة جديدة</h1>
          <p style={{ color: "var(--fg-2)", fontSize: 14 }}>أنشئي حسابك للانضمام إلى الدورات</p>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <LanguageSwitcher />
          </div>
        </div>

        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 20, padding: "32px", boxShadow: "0 12px 40px rgba(15,23,42,0.08)",
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>الاسم الأول</label>
                <input
                  type="text" required value={form.first_name}
                  onChange={(e) => handleChange("first_name", e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>اسم العائلة</label>
                <input
                  type="text" required value={form.last_name}
                  onChange={(e) => handleChange("last_name", e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>البريد الإلكتروني</label>
              <input
                type="email" required value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>كلمة المرور</label>
              <input
                type="password" required value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder="••••••••"
                minLength={8}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>رقم الهاتف</label>
                <input
                  type="tel" value={form.phone_number}
                  onChange={(e) => handleChange("phone_number", e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>المدينة</label>
                <input
                  type="text" value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 8, padding: "10px 14px", color: "#F87171", fontSize: 13, marginBottom: 20,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", padding: "13px",
                background: loading ? "var(--border)" : "linear-gradient(135deg, #10B981, #059669)",
                border: "none", borderRadius: 10,
                color: loading ? "var(--fg-3)" : "white",
                fontSize: 16, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Syne', sans-serif", letterSpacing: "0.02em",
                boxShadow: loading ? "none" : "0 4px 20px rgba(16,185,129,0.35)",
              }}
            >
              {loading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب"}
            </button>
          </form>

          <p style={{ textAlign: "center", color: "var(--fg-3)", fontSize: 13, marginTop: 20, marginBottom: 0 }}>
            لديك حساب بالفعل؟{" "}
            <Link href="/login" style={{ color: "#10B981", textDecoration: "none", fontWeight: 600 }}>
              سجّلي دخولك
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}