"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import type { AppAccount } from "@/lib/auth/types";

type SessionValue = {
  account: AppAccount | null;
  email: string | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [account, setAccount] = useState<AppAccount | null>(null);
  const [loadedForUser, setLoadedForUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (isPending || !userId) return;

    const controller = new AbortController();
    void fetch("/api/account/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load account details.");
        const result: { account: AppAccount | null } = await response.json();
        setAccount(result.account);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setAccount(null);
        setError(cause instanceof Error ? cause.message : "Unable to load account details.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedForUser(userId);
      });

    return () => controller.abort();
  }, [isPending, userId]);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await authClient.signOut();
    if (signOutError) throw new Error("Unable to sign out. Please try again.");
    setAccount(null);
    setLoadedForUser(null);
    router.replace("/");
    router.refresh();
  }, [router]);

  const accountForUser = userId && loadedForUser === userId ? account : null;
  const accountLoading = isPending || (!!userId && loadedForUser !== userId);

  const value = useMemo<SessionValue>(() => ({
    account: accountForUser,
    email: session?.user.email ?? null,
    loading: isPending || accountLoading,
    error,
    signOut,
  }), [accountForUser, accountLoading, error, isPending, session?.user.email, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <SessionProvider>");
  return context;
}
