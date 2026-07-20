import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as loginRequest, type User } from '@workspace/api-client-react';

const TOKEN_KEY = 'cg26-mobile-token';
const USER_KEY = 'cg26-mobile-user';

// Module-level token cache so the api-client's auth token getter (registered
// once at the root) can read the current token synchronously before requests.
let currentToken: string | null = null;
export function getCurrentToken(): string | null {
  return currentToken;
}

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isReferee: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken) {
          currentToken = storedToken;
          setToken(storedToken);
        }
        if (storedUser) setUser(JSON.parse(storedUser) as User);
      } catch {
        // Ignore corrupt storage — user simply needs to log in again.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await loginRequest({ username, password });
    currentToken = res.token;
    setToken(res.token);
    setUser(res.user);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, res.token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user)),
    ]);
  }, []);

  const signOut = useCallback(async () => {
    currentToken = null;
    setToken(null);
    setUser(null);
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isReferee: !!token,
      signIn,
      signOut,
    }),
    [user, token, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
