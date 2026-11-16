"use client";
import { useState, useEffect } from "react";
import { useRequireRole } from "@/hooks/useRequireRole";
import DashboardLayout from "@/components/DashboardLayout";
import { supervisorStudentApi, coursesApi } from "@/lib/api";

interface Course {
  course_id: number;
  title: string;
}

interface CreatedResult {
  first_name: string;
  last_name: string;
  email: string;
  generated_password: string;
}

export default function NewStudentPage() {
  const { user, loading } = useRequireRole("supervisor");
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "",
    phone_number: "", city: "", course_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.role === "supervisor") {
      coursesApi.list().then((res) => setCourses(res.data));
    }
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await supervisorStudentApi.create({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone_number: form.phone_number || undefined,
        city: form.city || undefined,
        course_id: form.course_id ? Number(form.course_id) : undefined,
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "تعذّر إنشاء الحساب");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.generated_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setForm({ first_name: "", last_name: "", email: "", phone_number: "", city: "", course_id: "" });
    setResult(null);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px",
    background: "var(--input-bg)", border: "1px solid var(--border)",
    borderRadius: 8, color: "var(--fg)", fontSize: 14,
  };
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 500, color: "var(--fg-2)", marginBottom: 6,
  };

  if (loading || !user) return <DashboardLayout><div /></DashboardLayout>;

  return (
    <DashboardLayout>
      <div style={{ padding: 24, maxWidth: 560 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--fg)", marginBottom: 20 }}>
          إنشاء حساب طالبة
        </h1>

        {result ? (
          <div style={{
            background: "var(--surface)", border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 16, padding: 24,
          }}>
            <p style={{ color: "#10B981", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              تم إنشاء الحساب بنجاح ✓
            </p>
            <p style={{ color: "var(--fg-2)", fontSize: 13, marginBottom: 4 }}>الاسم</p>
            <p style={{ color: "var(--fg)", fontSize: 15, marginBottom: 14 }}>
              {result.first_name} {result.last_name}
            </p>
            <p style={{ color: "var(--fg-2)", fontSize: 13, marginBottom: 4 }}>البريد الإلكتروني</p>
            <p style={{ color: "var(--fg)", fontSize: 15, marginBottom: 14 }}>{result.email}</p>

            <p style={{ color: "var(--fg-2)", fontSize: 13, marginBottom: 4 }}>
              كلمة المرور (احفظيها الآن، لن تظهر مرة أخرى)
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <code style={{
                flex: 1, padding: "10px 14px", background: "var(--input-bg)",
                border: "1px solid var(--border)", borderRadius: 8,
                fontSize: 16, fontWeight: 700, color: "var(--fg)", letterSpacing: 1,
              }}>
                {result.generated_password}
              </code>
              <button onClick={handleCopy} style={{
                padding: "10px 16px", background: "linear-gradient(135deg, #10B981, #059669)",
                border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                {copied ? "تم النسخ ✓" : "نسخ"}
              </button>
            </div>
            <p style={{ color: "#F59E0B", fontSize: 12, marginBottom: 20 }}>
              ⚠️ سلّمي كلمة المرور هذه للطالبة الآن — لن تتمكني من رؤيتها مرة أخرى بعد مغادرة هذه الصفحة.
            </p>

            <button onClick={handleReset} style={{
              width: "100%", padding: "11px", background: "transparent",
              border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--fg)", fontSize: 14, cursor: "pointer",
            }}>
              إنشاء حساب طالبة أخرى
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: 24,
          }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>الاسم الأول</label>
                <input required value={form.first_name} onChange={(e) => handleChange("first_name", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>اسم العائلة</label>
                <input required value={form.last_name} onChange={(e) => handleChange("last_name", e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>البريد الإلكتروني</label>
              <input required type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>رقم الهاتف</label>
                <input value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>المدينة</label>
                <input value={form.city} onChange={(e) => handleChange("city", e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>تسجيلها في دورة (اختياري)</label>
              <select value={form.course_id} onChange={(e) => handleChange("course_id", e.target.value)} style={inputStyle}>
                <option value="">— بدون تسجيل الآن —</option>
                {courses.map((c) => (
                  <option key={c.course_id} value={c.course_id}>{c.title}</option>
                ))}
              </select>
            </div>

            {error && (
              <div style={{
                background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 8, padding: "10px 14px", color: "#F87171", fontSize: 13, marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} style={{
              width: "100%", padding: "13px",
              background: submitting ? "var(--border)" : "linear-gradient(135deg, #10B981, #059669)",
              border: "none", borderRadius: 10, color: submitting ? "var(--fg-3)" : "white",
              fontSize: 15, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'Syne', sans-serif",
            }}>
              {submitting ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
            </button>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}