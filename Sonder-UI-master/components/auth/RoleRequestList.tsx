"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type RequestItem = {
  id: string;
  requested_role: "teacher" | "parent";
  requested_at: string;
  email: string;
  display_name: string;
};

export function RoleRequestList() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/role-requests", { cache: "no-store" });
    const result: { requests?: RequestItem[]; error?: string } = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to load role requests.");
    setRequests(result.requests ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(load).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load role requests.");
    });
    return () => { active = false; };
  }, [load]);

  async function decide(id: string, decision: "approve" | "deny") {
    setError(null);
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/role-requests/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to review this request.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to review this request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-10">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="label text-accent">Access control</p>
          <h2 className="mt-3 text-2xl font-semibold">Role requests</h2>
        </div>
        <Button variant="ghost" onClick={() => {
          setError(null);
          void load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load role requests."));
        }}>
          Refresh
        </Button>
      </div>
      {error ? <p role="alert" className="mt-5 text-sm text-attention">{error}</p> : null}
      {requests.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">No pending requests.</p>
      ) : (
        <ul className="divide-y divide-border">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{request.display_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{request.email} · {request.requested_role}</p>
                <time className="label mt-2 block text-faint" dateTime={request.requested_at}>
                  {new Date(request.requested_at).toLocaleDateString()}
                </time>
              </div>
              <div className="flex gap-5">
                <Button variant="ghost" disabled={busyId === request.id} onClick={() => void decide(request.id, "deny")}>
                  Deny
                </Button>
                <Button disabled={busyId === request.id} onClick={() => void decide(request.id, "approve")}>
                  Approve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
