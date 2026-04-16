import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearAuthSession,
  getCurrentUser,
  getStoredAuthUser,
  hasStoredAuthToken,
  login as loginApi,
  logout as logoutApi,
  signup as signupApi,
  type ApiUser,
  type LoginPayload,
  type SignupPayload,
} from "@/lib/api";

interface AuthContextValue {
  user: ApiUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(() => getStoredAuthUser());
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const nextUser = await getCurrentUser();
    setUser(nextUser);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      if (!hasStoredAuthToken()) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        await refreshUser();
      } catch {
        clearAuthSession();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginApi(payload);
    setUser(response.user);
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const response = await signupApi(payload);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (hasStoredAuthToken()) {
        await logoutApi();
      }
    } finally {
      clearAuthSession();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      signup,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
