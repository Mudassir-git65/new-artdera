import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthService, MarketplaceService, SESSION_EXPIRED_EVENT } from "./services";
import type { User } from "./types";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  catalogVersion: number;
  /** True once the /api/bootstrap payload has been received and applied. */
  catalogReady: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider — initialises the marketplace session, then hydrates public
 * catalog data in the background. The UI shell renders immediately; only
 * truly auth-gated content waits for `ready`.
 *
 * Performance note: we split "session check" (fast, ~50ms) from "full
 * bootstrap" (slower, includes DB queries). The loading screen is only
 * shown until we know the session state — the heavy catalog fetch continues
 * in the background without blocking navigation.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // `ready` becomes true as soon as we know whether the user is logged in.
  // The full catalog bootstrap may still be running in the background.
  const [ready, setReady] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  // `catalogReady` flips to true once /api/bootstrap has been received.
  const [catalogReady, setCatalogReady] = useState(false);
  const [error, setError] = useState("");
  // Prevent double-init in React StrictMode
  const initialized = useRef(false);

  const refresh = async () => {
    const next = await AuthService.currentUser();
    setUser(next);
    if (next) setError("");
  };

  useEffect(() => {
    const sessionExpired = () => {
      setUser(null);
      setError("Your session expired. Sign in again to continue safely.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, sessionExpired);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Run session check AND catalog bootstrap in parallel so neither
    // blocks the other. The session result tells us if the user is logged in;
    // bootstrap populates the public catalog. Both can start immediately since
    // the public portion of bootstrap doesn't need auth data.
    const sessionPromise = AuthService.currentUser();
    const bootstrapPromise = MarketplaceService.bootstrap(true);

    sessionPromise
      .then((next) => {
        setUser(next);
        setReady(true);
      })
      .catch(() => {
        setReady(true);
      });

    bootstrapPromise
      .then(() => {
        setCatalogVersion((version) => version + 1);
        setCatalogReady(true);
      })
      .catch((initError: unknown) => {
        setError(
          initError instanceof Error
            ? initError.message
            : "ArtDera could not connect to its secure data service.",
        );
        setReady(true);
        // Even on error, unblock the UI so users aren't stuck on the loading screen.
        setCatalogReady(true);
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      catalogVersion,
      catalogReady,
      refresh,
      logout: async () => {
        setUser(null);
        await AuthService.logout();
      },
    }),
    [catalogReady, catalogVersion, ready, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {error && (
        <div
          role="alert"
          className="fixed inset-x-3 top-[calc(var(--header-height)+0.75rem)] z-[70] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg"
        >
          <span>{error} Public pages remain available; account actions may need a retry.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

// The provider and hook intentionally share one module so the authentication
// adapter can be replaced without changing consumers.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
