import { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diagnosticClient, DiagnosticError } from "./client";
import { useDiagnosticSession } from "./useDiagnosticSession";
import { catalogue, sid, snapshot } from "./testFixtures";
import { parseCatalogue, parseSnapshot } from "./validation";
vi.mock("./client", async importOriginal => ({ ...await importOriginal<typeof import("./client")>(),
  diagnosticClient: { catalogue: vi.fn(), begin: vi.fn(), current: vi.fn(), answer: vi.fn() } }));
const client = vi.mocked(diagnosticClient);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
async function mount(initialSession?: string) {
  const hook = renderHook(() => useDiagnosticSession("U1", initialSession), { wrapper: StrictMode });
  await waitFor(() => expect(hook.result.current.phase).not.toBe("loading_metadata"));
  return hook;
}
async function begin(hook: Awaited<ReturnType<typeof mount>>) {
  await act(async () => { await hook.result.current.begin(); });
}
describe("live diagnostic controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState(null, "", "/student/diagnostic/U1");
    client.catalogue.mockResolvedValue(parseCatalogue(catalogue));
    client.begin.mockResolvedValue(parseSnapshot(snapshot()));
    client.answer.mockResolvedValue(parseSnapshot(snapshot(1)));
    client.current.mockResolvedValue(parseSnapshot(snapshot()));
  });
  afterEach(cleanup);
  it("Strict Mode metadata mounts never create a run; Begin rapid clicks create once", async () => {
    const hook = await mount();
    expect(hook.result.current.phase).toBe("intro");
    expect(client.begin).not.toHaveBeenCalled();
    const pending = deferred<ReturnType<typeof parseSnapshot>>();
    client.begin.mockReturnValue(pending.promise);
    act(() => { void hook.result.current.begin(); void hook.result.current.begin(); });
    expect(client.begin).toHaveBeenCalledTimes(1);
    expect(hook.result.current.phase).toBe("starting");
    await act(async () => { pending.resolve(parseSnapshot(snapshot())); });
    expect(hook.result.current.phase).toBe("question");
    expect(window.location.search).toBe(`?session=${sid}`);
  });
  it("sends the selected stable option ID, guards rapid clicks and waits for real response", async () => {
    const hook = await mount(); await begin(hook);
    const pending = deferred<ReturnType<typeof parseSnapshot>>();
    client.answer.mockReturnValue(pending.promise);
    act(() => { hook.result.current.answer("D"); hook.result.current.answer("A"); });
    expect(client.answer).toHaveBeenCalledExactlyOnceWith(sid, { step_index: 0, item_id: "item-0", option_id: "D" });
    expect(hook.result.current.phase).toBe("submitting");
    await act(async () => { pending.resolve(parseSnapshot(snapshot(1))); });
    expect(hook.result.current.snapshot?.answered_count).toBe(1);
    act(() => hook.result.current.answer("B"));
    expect(client.answer.mock.calls[1][1].option_id).toBe("B");
    await act(async () => {});
  });
  it("early completion and Run again return to intro and use a fresh nonce", async () => {
    const hook = await mount(); await begin(hook);
    const first = client.begin.mock.calls[0][0].create_request_id;
    client.answer.mockResolvedValue(parseSnapshot(snapshot(1, true)));
    await act(async () => { hook.result.current.answer("C"); });
    expect(hook.result.current.phase).toBe("complete");
    expect(hook.result.current.snapshot?.answered_count).toBe(1);
    act(() => hook.result.current.restart());
    expect(hook.result.current.phase).toBe("intro");
    expect(window.location.search).toBe("");
    expect(client.begin).toHaveBeenCalledTimes(1);
    await begin(hook);
    expect(client.begin.mock.calls[1][0].create_request_id).not.toBe(first);
  });
  it("lost Begin response retries exactly the original nonce", async () => {
    const hook = await mount();
    client.begin.mockRejectedValueOnce(new DiagnosticError("engine_timeout"));
    await begin(hook);
    expect(hook.result.current.phase).toBe("unavailable");
    await act(async () => { await hook.result.current.retry(); });
    expect(client.begin.mock.calls[0][0]).toEqual(client.begin.mock.calls[1][0]);
  });
  it("refresh resumes question or completion without Begin", async () => {
    for (const complete of [false, true]) {
      client.current.mockResolvedValue(parseSnapshot(snapshot(2, complete)));
      const hook = await mount(sid);
      expect(hook.result.current.phase).toBe(complete ? "complete" : "question");
      expect(client.begin).not.toHaveBeenCalled();
      hook.unmount();
    }
  });
  it("Back to a page with stale props resumes the run named in the address bar", async () => {
    window.history.replaceState(null, "", `/student/diagnostic/U1?session=${sid}`);
    client.current.mockResolvedValue(parseSnapshot(snapshot(2)));
    const hook = await mount();
    expect(client.current).toHaveBeenCalledWith(sid);
    expect(hook.result.current.phase).toBe("question");
    expect(client.begin).not.toHaveBeenCalled();
    hook.unmount();
    window.history.replaceState(null, "", "/student/diagnostic/U1?session=not-a-run");
    client.current.mockClear();
    const ignored = await mount();
    expect(client.current).not.toHaveBeenCalled();
    expect(ignored.result.current.phase).toBe("intro");
  });
  it("uncertain accepted answer reconciles current state without resubmitting", async () => {
    const hook = await mount(); await begin(hook);
    client.answer.mockRejectedValue(new DiagnosticError("engine_timeout"));
    await act(async () => { hook.result.current.answer("D"); });
    expect(hook.result.current.phase).toBe("recovering");
    act(() => hook.result.current.answer("A"));
    expect(client.answer).toHaveBeenCalledTimes(1);
    client.current.mockResolvedValue(parseSnapshot(snapshot(1)));
    await act(async () => { await hook.result.current.retry(); });
    expect(hook.result.current.phase).toBe("question");
    expect(client.answer).toHaveBeenCalledTimes(1);
  });
  it("uncertain unaccepted answer retries identical payload after reconciliation", async () => {
    const hook = await mount(); await begin(hook);
    client.answer.mockRejectedValueOnce(new DiagnosticError("engine_unavailable"));
    await act(async () => { hook.result.current.answer("B"); });
    await act(async () => { await hook.result.current.retry(); });
    expect(client.current).toHaveBeenCalledWith(sid);
    expect(client.answer.mock.calls[0]).toEqual(client.answer.mock.calls[1]);
    expect(hook.result.current.phase).toBe("question");
  });
  it("rejects wrong unit on resume, supports retry after metadata failure", async () => {
    client.current.mockResolvedValue(parseSnapshot({ ...snapshot(), unit: { unit_id: "U2", name: "Conversion" } }));
    const wrong = await mount(sid);
    expect(wrong.result.current.phase).toBe("unavailable");
    expect(wrong.result.current.error).toBe("session_unavailable"); wrong.unmount();
    client.catalogue.mockRejectedValue(new Error("offline"));
    const hook = await mount();
    expect(hook.result.current.phase).toBe("unavailable");
    client.catalogue.mockResolvedValue(parseCatalogue(catalogue));
    await act(async () => { await hook.result.current.retry(); });
    expect(hook.result.current.phase).toBe("intro");
  });
  it("late answer after restart or navigation cannot replace active state", async () => {
    const hook = await mount(); await begin(hook);
    const pending = deferred<ReturnType<typeof parseSnapshot>>();
    client.answer.mockReturnValue(pending.promise);
    act(() => hook.result.current.answer("D"));
    act(() => hook.result.current.restart());
    await act(async () => { pending.resolve(parseSnapshot(snapshot(1, true))); });
    expect(hook.result.current.phase).toBe("intro");
    expect(hook.result.current.snapshot).toBeUndefined();
    const pendingBegin = deferred<ReturnType<typeof parseSnapshot>>();
    client.begin.mockReturnValue(pendingBegin.promise);
    act(() => { void hook.result.current.begin(); });
    hook.unmount();
    await act(async () => { pendingBegin.resolve(parseSnapshot(snapshot())); });
    expect(window.location.search).toBe("");
  });
});
