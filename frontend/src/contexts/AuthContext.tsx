"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authApi } from "@/lib/api";

interface AuthUser {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}
 
interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The token is in an httpOnly cookie — JS cannot read it.
    // We call /me and let the browser send the cookie automatically.
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => {/* not logged in, stay null */})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<string> => {
    const res = await authApi.login(email, password);
    const { role } = res.data;
    // The server sets the httpOnly cookie via Set-Cookie header — nothing to store here.
    const me = await authApi.me();
    setUser(me.data);
    return role;
  };

  const logout = async () => {
    // Only the server can clear an httpOnly cookie.
    await authApi.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
