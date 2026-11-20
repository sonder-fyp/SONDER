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
type Decision = { id: string; action: "approve" | "deny" };
export function RoleRequestList() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fetchRequests = useCallback(async () => {
    const response = await fetch("/api/admin/role-requests", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Could not load requests.");
    const result = await response.json();
    if (!Array.isArray(result.requests)) throw new Error("Invalid response.");
    return result.requests as RequestItem[];
  }, []);
  useEffect(() => {
    let active = true;
    fetchRequests()
      .then((rows) => {
        if (active) {
          setRequests(rows);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (active) {
          setError("We could not load access requests. Please try again.");
          setPhase("error");
        }
      });
    return () => {
      active = false;
    };
  }, [fetchRequests]);
  async function refresh() {
    setError(null);
    setPhase("loading");
    setConfirmation(null);
    try {
      setRequests(await fetchRequests());
      setPhase("ready");
    } catch {
      setError("We could not load access requests. Please try again.");
      setPhase("error");
    }
  }
  async function decide() {
    if (!confirmation || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/role-requests/${encodeURIComponent(confirmation.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: confirmation.action }),
        },
      );
      if (!response.ok) {
        setError(
          "This request could not be updated. Refresh the list before trying again.",
        );
        return;
      }
      setRequests((current) =>
        current.filter((request) => request.id !== confirmation.id),
      );
      setMessage(
        confirmation.action === "approve"
          ? "Access approved. The account can now open its workspace."
          : "Request declined. Access was not granted.",
      );
      setConfirmation(null);
    } catch {
      setError(
        "We could not confirm the update. Refresh the list to check its latest status.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="py-8">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <h2 className="text-xl font-semibold">Pending review</h2>
        <Button
          variant="ghost"
          disabled={phase === "loading" || busy}
          onClick={refresh}
        >
          Refresh
        </Button>
      </div>
      {phase === "loading" ? (
        <p role="status" className="py-8 text-muted-foreground">
          Loading access requests…
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="my-5 border-l-2 border-attention pl-4 text-sm text-attention"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="my-5 text-sm text-accent">
          {message}
        </p>
      ) : null}
      {phase === "error" ? <Button onClick={refresh}>Try again</Button> : null}
      {phase === "ready" && !requests.length ? (
        <div className="py-12">
          <h3 className="text-2xl font-semibold tracking-tight">
            You are up to date.
          </h3>
          <p className="mt-3 text-muted-foreground">
            There are no pending access requests.
          </p>
        </div>
      ) : null}
      {phase === "ready" ? (
        <ul className="divide-y divide-border">
          {requests.map((request) => (
            <li key={request.id} className="py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {request.display_name}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {request.email}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {request.requested_role === "teacher"
                      ? "Teacher"
                      : "Parent or guardian"}{" "}
                    registration ·{" "}
                    <time dateTime={request.requested_at}>
                      {new Date(request.requested_at).toLocaleDateString()}
                    </time>
                  </p>
                </div>
                <div className="flex shrink-0 gap-5">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setConfirmation({ id: request.id, action: "deny" });
                      setMessage(null);
                    }}
                  >
                    Decline
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setConfirmation({ id: request.id, action: "approve" });
                      setMessage(null);
                    }}
                  >
                    Approve
                  </Button>
                </div>
              </div>
              {confirmation?.id === request.id ? (
                <div className="mt-5 border border-border bg-muted/30 p-5">
                  <p className="text-sm leading-relaxed">
                    {confirmation.action === "approve"
                      ? `Grant ${request.requested_role} access to ${request.display_name}? Only approve after verifying their school relationship.`
                      : `Decline ${request.display_name}'s request? Their requested workspace will remain unavailable.`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-6">
                    <Button disabled={busy} onClick={decide}>
                      {busy ? "Saving…" : "Confirm decision"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setConfirmation(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
