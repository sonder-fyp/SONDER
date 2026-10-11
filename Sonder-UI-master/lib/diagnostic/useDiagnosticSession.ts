"use client";

import { useEffect, useRef, useState } from "react";
import { diagnosticClient, DiagnosticError } from "./client";
import type { AnswerRequest, BeginRequest, Catalogue, OptionId, Snapshot } from "./types";
import { UUID } from "./validation";

type Phase = "loading_metadata" | "intro" | "starting" | "question" | "submitting" | "complete" | "recovering" | "unavailable";
type View = { phase: Phase; catalogue?: Catalogue; snapshot?: Snapshot; error?: string; chosen?: OptionId };

export function useDiagnosticSession(unitId: string, initialSession?: string) {
  const [view, setView] = useState<View>({ phase: "loading_metadata" });
  const current = useRef(view);
  const epoch = useRef(0), busy = useRef(false);
  const beginRequest = useRef<BeginRequest | undefined>(undefined);
  const pending = useRef<AnswerRequest | undefined>(undefined);
  const locator = useRef(initialSession);
  function update(next: View) { current.current = next; setView(next); }
  function failure(error: unknown) { return error instanceof DiagnosticError ? error.code : "engine_unavailable"; }
  function accept(snapshot: Snapshot, generation: number, expectedId?: string) {
    if (generation !== epoch.current) return;
    if (snapshot.unit.unit_id !== unitId || (expectedId && snapshot.session_id !== expectedId)) throw new DiagnosticError("session_unavailable");
    const old = current.current.snapshot;
    if (old && old.session_id === snapshot.session_id && snapshot.answered_count < old.answered_count) return;
    locator.current = snapshot.session_id;
    pending.current = undefined;
    update({ catalogue: current.current.catalogue, snapshot, phase: snapshot.status === "complete" ? "complete" : "question" });
  }
  async function load(generation: number) {
    try {
      const [catalogue, snapshot] = await Promise.all([
        diagnosticClient.catalogue(), locator.current ? diagnosticClient.current(locator.current) : Promise.resolve(undefined),
      ]);
      if (generation !== epoch.current) return;
      if (!catalogue.units.some(u => u.unit_id === unitId)) throw new DiagnosticError("unit_not_found");
      update({ phase: "intro", catalogue });
      if (snapshot) accept(snapshot, generation, locator.current);
    } catch (error) {
      if (generation === epoch.current) update({ ...current.current, phase: "unavailable", error: failure(error) });
    } finally { if (generation === epoch.current) busy.current = false; }
  }
  useEffect(() => {
    const generation = ++epoch.current;
    busy.current = true;
    // Begin adds ?session= with native replaceState, so a page restored by Back can
    // carry stale server props; the address bar is the authority for which run to resume.
    const fromUrl = new URLSearchParams(window.location.search).get("session") ?? undefined;
    locator.current = initialSession ?? (fromUrl && UUID.test(fromUrl) ? fromUrl : undefined);
    void load(generation);
    // This ref is an operation generation, deliberately incremented on cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { epoch.current++; };
    // A new route identity remounts DiagnosticClient; no session mutation runs here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, initialSession]);

  async function begin() {
    if (busy.current || !current.current.catalogue || current.current.snapshot) return;
    busy.current = true;
    const generation = epoch.current;
    beginRequest.current ??= { unit_id: unitId, create_request_id: crypto.randomUUID() };
    update({ ...current.current, phase: "starting", error: undefined });
    try {
      const snapshot = await diagnosticClient.begin(beginRequest.current);
      if (generation !== epoch.current) return;
      accept(snapshot, generation);
      window.history.replaceState(null, "", `/student/diagnostic/${encodeURIComponent(unitId)}?session=${snapshot.session_id}`);
    } catch (error) {
      if (generation === epoch.current) update({ ...current.current, phase: "unavailable", error: failure(error) });
    } finally { if (generation === epoch.current) busy.current = false; }
  }
  async function send(generation: number, sid: string, payload: AnswerRequest) {
    try { accept(await diagnosticClient.answer(sid, payload), generation, sid); }
    catch (error) {
      if (generation === epoch.current) update({ ...current.current, phase: "recovering", error: failure(error) });
    } finally { if (generation === epoch.current) busy.current = false; }
  }
  function answer(optionId: OptionId) {
    const snapshot = current.current.snapshot;
    if (busy.current || current.current.phase !== "question" || snapshot?.status !== "in_progress") return;
    busy.current = true;
    const payload = { step_index: snapshot.question.step_index, item_id: snapshot.question.item_id, option_id: optionId };
    pending.current = payload;
    update({ ...current.current, phase: "submitting", chosen: optionId, error: undefined });
    void send(epoch.current, snapshot.session_id, payload);
  }
  async function retry() {
    if (busy.current) return;
    if (beginRequest.current && !locator.current) { await begin(); return; }
    busy.current = true;
    const generation = epoch.current, sid = locator.current;
    if (!sid) { await load(generation); return; }
    update({ ...current.current, phase: "recovering", error: undefined });
    try {
      const snapshot = await diagnosticClient.current(sid);
      if (generation !== epoch.current) return;
      if (snapshot.unit.unit_id !== unitId || snapshot.session_id !== sid) throw new DiagnosticError("session_unavailable");
      const payload = pending.current;
      if (payload && snapshot.status === "in_progress" && snapshot.answered_count === payload.step_index
        && snapshot.question.item_id === payload.item_id) {
        await send(generation, sid, payload);
      } else accept(snapshot, generation, sid);
    } catch (error) {
      if (generation === epoch.current) update({ ...current.current, phase: "unavailable", error: failure(error) });
    } finally { if (generation === epoch.current) busy.current = false; }
  }
  function restart() {
    ++epoch.current;
    busy.current = false;
    locator.current = undefined;
    beginRequest.current = undefined;
    pending.current = undefined;
    window.history.replaceState(null, "", `/student/diagnostic/${encodeURIComponent(unitId)}`);
    if (current.current.catalogue) update({ phase: "intro", catalogue: current.current.catalogue });
    else { busy.current = true; void load(epoch.current); }
  }
  return { ...view, begin, answer, retry, restart };
}
