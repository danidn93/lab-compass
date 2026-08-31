import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface User {
  id: string;
  username: string;
  role: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  loading: boolean;
  login: (user: User, sessionToken?: string | null) => void;
  logout: () => void;
  isAuthenticated: boolean;
  validateSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/*
 * Se conserva la clave "user" que ya utilizaba tu aplicación para no romper
 * otros componentes que pudieran leerla directamente.
 */
const USER_STORAGE_KEY = 'user';
const SESSION_TOKEN_STORAGE_KEY = 'lab_session_token';

function normalizeUser(value: unknown): User | null {
  if (!value || typeof value !== 'object') return null;

  const item = value as Record<string, unknown>;

  const id = String(item.id ?? '').trim();
  const username = String(item.username ?? '').trim();
  const role = String(item.role ?? '').trim();
  const name = String(item.name ?? '').trim();

  if (!id || !username || !role || !name) return null;

  return {
    id,
    username,
    role,
    name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearLocalSession = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
    setUser(null);
    setSessionToken(null);
  };

  const persistSession = (
    nextUser: User,
    nextSessionToken: string,
  ) => {
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify(nextUser),
    );

    localStorage.setItem(
      SESSION_TOKEN_STORAGE_KEY,
      nextSessionToken,
    );

    setUser(nextUser);
    setSessionToken(nextSessionToken);
  };

  const validateRemoteSession = async (
    token: string,
  ): Promise<{
    valid: boolean;
    user: User | null;
  }> => {
    try {
      const { data, error } =
        await supabase.functions.invoke(
          'usuario-session',
          {
            headers: {
              'x-lab-session-token': token,
            },
            body: {
              action: 'validate',
            },
          },
        );

      if (error) {
        console.error(
          'Error validando sesión del laboratorio:',
          error,
        );

        return {
          valid: false,
          user: null,
        };
      }

      const validatedUser =
        normalizeUser(data?.user);

      return {
        valid:
          data?.ok === true &&
          data?.valid === true &&
          !!validatedUser,
        user: validatedUser,
      };
    } catch (error) {
      console.error(
        'Error inesperado validando sesión del laboratorio:',
        error,
      );

      return {
        valid: false,
        user: null,
      };
    }
  };

  /* ==========================================================
     RESTAURAR SESIÓN AL RECARGAR
  ========================================================== */
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const storedUserRaw =
          localStorage.getItem(
            USER_STORAGE_KEY,
          );

        const storedToken =
          localStorage
            .getItem(
              SESSION_TOKEN_STORAGE_KEY,
            )
            ?.trim() || '';

        if (
          !storedUserRaw ||
          !storedToken
        ) {
          if (mounted) {
            clearLocalSession();
          }
          return;
        }

        let storedUser: User | null = null;

        try {
          storedUser = normalizeUser(
            JSON.parse(storedUserRaw),
          );
        } catch {
          storedUser = null;
        }

        if (!storedUser) {
          if (mounted) {
            clearLocalSession();
          }
          return;
        }

        const remote =
          await validateRemoteSession(
            storedToken,
          );

        if (!mounted) return;

        if (
          !remote.valid ||
          !remote.user
        ) {
          clearLocalSession();
          return;
        }

        persistSession(
          remote.user,
          storedToken,
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     LOGIN

     El segundo parámetro es opcional para no romper otros lugares que
     todavía llamen login(user), pero el LoginPage nuevo siempre enviará
     el token seguro creado por usuario-session.
  ========================================================== */
  const login = (
    userData: User,
    token?: string | null,
  ) => {
    const normalizedUser =
      normalizeUser(userData);

    if (!normalizedUser) {
      throw new Error(
        'Los datos del usuario no son válidos.',
      );
    }

    const cleanToken =
      String(token ?? '').trim();

    if (!cleanToken) {
      throw new Error(
        'No se recibió la sesión segura del laboratorio.',
      );
    }

    persistSession(
      normalizedUser,
      cleanToken,
    );
  };

  /* ==========================================================
     LOGOUT

     Se limpia inmediatamente la sesión local. La revocación remota se hace
     en segundo plano para conservar tu firma original logout(): void.
  ========================================================== */
  const logout = () => {
    const token =
      sessionToken ||
      localStorage.getItem(
        SESSION_TOKEN_STORAGE_KEY,
      ) ||
      '';

    clearLocalSession();

    if (token) {
      void supabase.functions
        .invoke(
          'usuario-session',
          {
            headers: {
              'x-lab-session-token': token,
            },
            body: {
              action: 'revoke',
            },
          },
        )
        .catch((error) => {
          console.warn(
            'No se pudo revocar la sesión remota:',
            error,
          );
        });
    }
  };

  /* ==========================================================
     VALIDAR SESIÓN MANUALMENTE
  ========================================================== */
  const validateSession = async () => {
    const token =
      sessionToken ||
      localStorage.getItem(
        SESSION_TOKEN_STORAGE_KEY,
      ) ||
      '';

    if (!token) {
      clearLocalSession();
      return false;
    }

    const remote =
      await validateRemoteSession(token);

    if (
      !remote.valid ||
      !remote.user
    ) {
      clearLocalSession();
      return false;
    }

    persistSession(
      remote.user,
      token,
    );

    return true;
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      sessionToken,
      loading,
      login,
      logout,
      isAuthenticated:
        !!user && !!sessionToken,
      validateSession,
    }),
    [
      user,
      sessionToken,
      loading,
    ],
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx =
    useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider',
    );
  }

  return ctx;
}
