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

  return (
    <div className="k-auth" style={{ alignItems: "flex-start" }}>
      <div className="k-auth-box" style={{ paddingTop: "1rem", paddingBottom: "2rem" }}>
        <div className="k-center" style={{ marginBottom: "1.5rem" }}>
          <div className="k-logo">
            <img src="/logo.jpg" alt="LAC-T-Online" />
          </div>
          <h1 className="k-title" style={{ fontSize: "1.5rem", margin: ".75rem 0 .25rem" }}>🎓 تسجيل طالبة جديدة</h1>
          <p className="k-muted">أنشئي حسابك للانضمام إلى الدورات</p>
          <div style={{ marginTop: ".75rem", display: "flex", justifyContent: "center" }}>
            <LanguageSwitcher />
          </div>
        </div>

        <div className="k-card" style={{ padding: "1.5rem" }}>
          <form onSubmit={handleSubmit} className="k-stack" style={{ gap: "1rem" }}>
            <div className="k-fields">
              <div className="k-field">
                <label className="k-label" htmlFor="reg-first">الاسم الأول</label>
                <input id="reg-first" className="k-input" type="text" required autoComplete="given-name"
                  value={form.first_name} onChange={(e) => handleChange("first_name", e.target.value)} />
              </div>
              <div className="k-field">
                <label className="k-label" htmlFor="reg-last">اسم العائلة</label>
                <input id="reg-last" className="k-input" type="text" required autoComplete="family-name"
                  value={form.last_name} onChange={(e) => handleChange("last_name", e.target.value)} />
              </div>
            </div>

            <div className="k-field">
              <label className="k-label" htmlFor="reg-email">البريد الإلكتروني</label>
              <input id="reg-email" className="k-input" type="email" dir="ltr" required autoComplete="email"
                value={form.email} onChange={(e) => handleChange("email", e.target.value)}
                placeholder="you@example.com" />
            </div>

            <div className="k-field">
              <label className="k-label" htmlFor="reg-password">كلمة المرور</label>
              <input id="reg-password" className="k-input" type="password" dir="ltr" required minLength={8}
                autoComplete="new-password"
                value={form.password} onChange={(e) => handleChange("password", e.target.value)}
                placeholder="••••••••" />
              <p className="k-muted" style={{ marginTop: ".35rem" }}>٨ أحرف على الأقل</p>
            </div>

            <div className="k-fields">
              <div className="k-field">
                <label className="k-label" htmlFor="reg-phone">رقم الهاتف</label>
                <input id="reg-phone" className="k-input" type="tel" dir="ltr" inputMode="tel" autoComplete="tel"
                  value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} />
              </div>
              <div className="k-field">
                <label className="k-label" htmlFor="reg-city">المدينة</label>
                <input id="reg-city" className="k-input" type="text" autoComplete="address-level2"
                  value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
              </div>
            </div>

            {error && <p className="k-alert" role="alert">{error}</p>}

            <button type="submit" disabled={loading} className="k-btn k-btn-primary">
              {loading ? "⏳ جارٍ إنشاء الحساب..." : "إنشاء حساب"}
            </button>
          </form>

          <p className="k-muted k-center" style={{ marginTop: "1rem" }}>
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="k-link">سجّلي دخولك</Link>
          </p>
        </div>
      </div>
    </div>
  );
}