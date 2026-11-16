"use client";
import { useState, useEffect, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useT, Lang } from "@/lib/i18n";
import { useTheme } from "@/contexts/ThemeContext";
import Sidebar from "./Sidebar";
import { studentsApi } from "@/lib/api";

interface SearchResult {
  student_id: number;
  first_name: string;
  last_name: string;
  student_number: string;
  enrollments: { enrollment_id: number; course_title: string; status: string }[];
}

const statusColor: Record<string, string> = {
  Ongoing: "#0EA5E9",
  Completed: "#10B981",
  Dropped: "#F87171",
};

function GlobalSearch() {
  const { user } = useAuth();
  const { t } = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await studentsApi.search(query);
        setResults(res.data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const goToStudent = (id: number) => {
    setOpen(false); setQuery("");
    if (user?.role === "teacher") router.push(`/dashboard/teacher/students/${id}`);
    else if (user?.role === "supervisor") router.push(`/dashboard/supervisor/students/${id}`);
    else router.push(`/dashboard/admin/students/${id}`);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 320 }}>
      <div style={{ position: "relative" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", insetInlineStart: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
          style={{ width: "100%", paddingInlineStart: 32, paddingInlineEnd: 12, minHeight: 44 , border: "1px solid var(--border)", borderRadius: 12, fontSize: 16, background: "var(--input-bg)", color: "var(--fg)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
        />
        {loading && (
          <div style={{ position: "absolute", insetInlineEnd: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "#0EA5E9", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.15)", zIndex: 100, maxHeight: 380, overflowY: "auto" }}>
          {results.map(r => (
            <button key={r.student_id} onClick={() => goToStudent(r.student_id)}
              style={{ width: "100%", textAlign: "start", padding: "12px 14px", background: "transparent", border: "none", borderBottom: "1px solid var(--border-soft)", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{r.first_name} {r.last_name}</span>
                <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "monospace" }}>{r.student_number}</span>
              </div>
              {r.enrollments.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {r.enrollments.slice(0, 3).map(e => (
                    <span key={e.enrollment_id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: `${statusColor[e.status] ?? "#94A3B8"}18`, color: statusColor[e.status] ?? "#94A3B8", border: `1px solid ${statusColor[e.status] ?? "#94A3B8"}30` }}>
                      {e.course_title} · {e.status}
                    </span>
                  ))}
                  {r.enrollments.length > 3 && <span style={{ fontSize: 11, color: "var(--fg-3)" }}>+{r.enrollments.length - 3} more</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px", fontSize: 13, color: "var(--fg-3)", textAlign: "center", boxShadow: "0 8px 24px rgba(15,23,42,0.1)", zIndex: 100 }}>
          {t('search.no_results', { query })}
        </div>
      )}
    </div>
  );
}

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useT();
  const { theme, toggleTheme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const isDark = theme === 'dark';

  return (
    <div ref={ref} className="settings-panel" style={{
      position: "absolute", top: "calc(100% + 8px)", insetInlineEnd: 0,
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 16, boxShadow: "0 12px 40px rgba(15,23,42,0.18)",
      zIndex: 200, width: 280, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ color: "var(--fg)", fontSize: 16, fontWeight: 700, fontFamily: "inherit" }}>
          {t('settings.title')}
        </p>
      </div>

      {/* Language */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)" }}>
        <p style={{ color: "var(--fg-2)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          {t('settings.language')}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "0 12px", minHeight: 48, borderRadius: 12, width: "100%",
                background: lang === l.code ? "#10B98115" : "transparent",
                border: `1px solid ${lang === l.code ? "#10B98140" : "transparent"}`,
                cursor: "pointer", textAlign: "start",
              }}>
              <span style={{ color: lang === l.code ? "#10B981" : "var(--fg)", fontSize: 15, fontWeight: lang === l.code ? 600 : 400 }}>
                {l.label}
              </span>
              {lang === l.code && (
                <svg style={{ marginInlineStart: "auto", flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div style={{ padding: "14px 18px" }}>
        <p style={{ color: "var(--fg-2)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          {t('settings.theme')}
        </p>
        <div style={{ display: "flex", background: "var(--bg)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
          {[
            { value: 'light', labelKey: 'settings.light' },
            { value: 'dark',  labelKey: 'settings.dark' },
          ].map(opt => {
            const active = theme === opt.value;
            return (
              <button key={opt.value}
                onClick={() => { if (!active) toggleTheme(); }}
                style={{
                  flex: 1, minHeight: 44, padding: "0 12px", borderRadius: 8,
                  background: active ? "var(--surface)" : "transparent",
                  border: `1px solid ${active ? "var(--border)" : "transparent"}`,
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  cursor: active ? "default" : "pointer",
                  color: active ? "var(--fg)" : "var(--fg-3)",
                  fontSize: 15, fontWeight: active ? 600 : 400,
                  transition: "all 0.15s",
                }}>
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t, dir } = useT();
  const isRtl = dir === 'rtl';
  const router = useRouter();

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { if (!mobile) setOpen(false); }, [mobile]);

  return (
    <div style={{ display: "flex", background: "var(--bg)", minHeight: "100vh" }}>
      {mobile && open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 40 }} />
      )}

      <Sidebar mobileOpen={open} onClose={() => setOpen(false)} isMobile={mobile} />

      <main style={{ marginInlineStart: mobile ? 0 : 240, flex: 1, minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 30,
          background: "var(--topbar-bg)", backdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--border)",
          padding: mobile ? "10px 16px" : "10px 48px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          {mobile && (
            <button onClick={() => setOpen(true)} aria-label="Open menu"
              style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, width: 44, height: 44, justifyContent: "center", padding: 0, cursor: "pointer", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          <button
            onClick={() => router.back()}
            aria-label="Go back"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "transparent", border: "1px solid transparent", cursor: "pointer", color: "var(--fg-2)", flexShrink: 0, transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isRtl
                ? <polyline points="9 18 15 12 9 6" />
                : <polyline points="15 18 9 12 15 6" />}
            </svg>
          </button>

          <GlobalSearch />

          {/* Settings button */}
          <div style={{ marginInlineStart: "auto", position: "relative" }}>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              aria-label={t('settings.title')}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 44, height: 44, borderRadius: 12,
                background: settingsOpen ? "var(--surface-2)" : "transparent",
                border: `1px solid ${settingsOpen ? "var(--border)" : "transparent"}`,
                cursor: "pointer", color: "var(--fg-2)",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (!settingsOpen) { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.borderColor = "var(--border)"; } }}
              onMouseLeave={e => { if (!settingsOpen) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}
            >
              {/* Gear icon */}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>

            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
          </div>
        </div>

        <div style={{ padding: mobile ? "20px 16px" : "40px 48px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
