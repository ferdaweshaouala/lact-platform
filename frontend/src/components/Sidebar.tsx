"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/lib/i18n";

const navItems: Record<string, { labelKey: string; href: string; icon: string }[]> = {
  admin: [
    { labelKey: "nav.dashboard", href: "/dashboard/admin", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { labelKey: "nav.users", href: "/dashboard/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { labelKey: "nav.analytics", href: "/dashboard/admin/analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { labelKey: "nav.reports", href: "/dashboard/admin/reports", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  ],
  teacher: [
    { labelKey: "nav.dashboard", href: "/dashboard/teacher", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { labelKey: "nav.my_students", href: "/dashboard/teacher/students", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { labelKey: "nav.courses", href: "/dashboard/teacher/courses", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  ],
  supervisor: [
    { labelKey: "nav.dashboard", href: "/dashboard/supervisor", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { labelKey: "nav.students", href: "/dashboard/supervisor/students", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { labelKey: "nav.new_student", href: "/dashboard/supervisor/students/new", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
    { labelKey: "nav.courses", href: "/dashboard/supervisor/courses", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { labelKey: "nav.enrollments", href: "/dashboard/supervisor/enrollments", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    { labelKey: "nav.import", href: "/dashboard/supervisor/import", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  ],
  student: [
    { labelKey: "nav.dashboard", href: "/dashboard/student", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  ],
};

const roleColors: Record<string, string> = { admin: "#10B981", teacher: "#0EA5E9", supervisor: "#F59E0B", student: "#8B5CF6" };
interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

export default function Sidebar({ mobileOpen = false, onClose, isMobile = false }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t, dir } = useT();
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => { await logout(); router.push("/login"); };
  const items = navItems[user?.role || "admin"] || [];
  const roleColor = roleColors[user?.role || "admin"];
  const isRtl = dir === "rtl";

  const transform = isMobile
    ? mobileOpen ? "translateX(0)" : (isRtl ? "translateX(100%)" : "translateX(-100%)")
    : "none";

  return (
    <aside style={{
      width: 240, minHeight: "100vh",
      background: "var(--sidebar)",
      [isRtl ? "borderLeft" : "borderRight"]: "1px solid var(--border)",
      display: "flex", flexDirection: "column", padding: "24px 0",
      position: "fixed", top: 0,
      [isRtl ? "right" : "left"]: 0,
      zIndex: 50,
      transform,
      transition: "transform 0.25s ease",
      boxShadow: isMobile && mobileOpen ? "4px 0 24px rgba(15,23,42,0.12)" : "none",
    } as React.CSSProperties}>

      {isMobile && (
        <button onClick={onClose}
          style={{ position: "absolute", top: 10,insetInlineEnd: 10, width: 44, height: 44, background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-2)", fontSize: 20, lineHeight: 1, padding: 4 }}>
          ✕
        </button>
      )}

      <div style={{ padding: "0 20px 24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 0 12px rgba(16,185,129,0.25)" }}>
            <img src="/logo.jpg" alt="LAC-T-Online" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2 }} />
          </div>
          <span style={{ fontFamily: "inherit", fontWeight: 800, fontSize: 14, color: "var(--fg)", letterSpacing: "-0.3px" }}>{t("app.name")}</span>
        </div>
      </div>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, background: `${roleColor}18`, border: `1px solid ${roleColor}40`, color: roleColor, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          {t(`role.${user?.role}`)}
        </div>
        <p style={{ color: "var(--fg)", fontWeight: 500, fontSize: 14 }}>{user?.first_name} {user?.last_name}</p>
        <p style={{ color: "var(--fg-2)", fontSize: 13 }}>{user?.email}</p>
      </div>

      <nav style={{ flex: 1, padding: "16px 12px" }}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} onClick={() => isMobile && onClose?.()}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "0 12px", minHeight: isMobile ? 52 : 40, borderRadius: 12,  marginBottom: 4,
                background: active ? `${roleColor}15` : "transparent",
                border: active ? `1px solid ${roleColor}30` : "1px solid transparent",
                color: active ? roleColor : "var(--fg-2)",
                fontSize: isMobile ? 16 : 14, fontWeight: active ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
                textDecoration: "none", userSelect: "none",
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "0 12px" }}>
        <button onClick={handleLogout}
          style={{ width: "100%", minHeight: isMobile ? 52 : 40, padding: "0 12px", background: "transparent", border: "1px solid var(--border)", borderRadius: 10, color: "var(--fg-2)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit", transition: "all 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F87171"; e.currentTarget.style.color = "#F87171"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--fg-2)"; }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {t("common.sign_out")}
        </button>
      </div>
    </aside>
  );
}
