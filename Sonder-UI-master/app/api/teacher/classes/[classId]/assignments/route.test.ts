// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), query: vi.fn(), origin: vi.fn(), engine: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/access", () => ({
  AccessError: class AccessError extends Error { constructor(public status: 401 | 403, message: string) { super(message); } },
  requireAccess: mocks.access,
}));
vi.mock("@/lib/auth/origin", () => ({ isSameOrigin: mocks.origin }));
vi.mock("@/lib/auth/database", () => ({ database: () => mocks.query }));
vi.mock("@/lib/diagnostic/server", async (original) => ({
  ...(await original<typeof import("@/lib/diagnostic/server")>()),
  engine: mocks.engine,
}));
import { BoundaryError } from "@/lib/diagnostic/server";
import { GET, POST } from "./route";
import { PATCH } from "./[assignmentId]/route";
import { GET as UNITS } from "../../../units/route";
import { GET as STUDENT } from "../../../../student/assignments/route";

const teacher = "00000000-0000-4000-8000-000000000007";
const classId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "55555555-5555-4555-8555-555555555555";
const room = {
  class_id: classId, name: "Grade 8 Blue", note: "", join_code: "ABCDEFGHJK", grade_level: 8,
  status: "active", student_count: 1, created_at: "2026-11-18T09:00:00.000Z",
};
const assignment = {
  assignment_id: assignmentId, class_id: classId, title: "Rounding check", unit_code: "U1", unit_name: "Rounding",
  version_code: "Maths_v2-U1-dev", status: "open", attempt_rule: "single", created_at: new Date("2026-11-18T10:00:00Z"),
};
const req = (method: string, body?: unknown) => new Request("http://localhost/api", {
  method, headers: { origin: "http://localhost" }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
});
const ctx = { params: Promise.resolve({ classId }) };
const one = (id = assignmentId) => ({ params: Promise.resolve({ classId, assignmentId: id }) });
const productError = (code: string) => Object.assign(new Error(code), { code: "SN001" });
const sql = (call: unknown[]) => (call[0] as string[]).join("?");
const health = (release: string | null) => mocks.engine.mockImplementationOnce(async (path: string, parser: (v: unknown) => unknown) => {
  expect(path).toBe("/engine/health");
  return parser({ contract_version: 2, mode: "postgres", ready: true, release, engine_release: "0.1.0+x" });
});

describe("assignment routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ appUserId: teacher, role: "teacher" });
    mocks.origin.mockReturnValue(true);
  });

  it("lists a class's assignments for its teacher only", async () => {
    mocks.query.mockResolvedValueOnce([room]).mockResolvedValueOnce([assignment]);
    const res = await GET(req("GET"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).assignments[0]).toMatchObject({ assignment_id: assignmentId, created_at: "2026-11-18T10:00:00.000Z" });
    expect(sql(mocks.query.mock.calls[1])).toContain("sonder.class_assignments(");
    mocks.query.mockResolvedValueOnce([]);
    expect((await GET(req("GET"), ctx)).status).toBe(404);
  });

  it("assigns a unit in the content version the service runs, not one from the browser", async () => {
    mocks.query.mockResolvedValueOnce([room]).mockResolvedValueOnce([{ assignment_id: assignmentId }]).mockResolvedValueOnce([assignment]);
    health("Maths_v2-U1-dev/spec-v2-prior");
    const res = await POST(req("POST", { unit_id: "U1", title: " Rounding check ", attempt_rule: "single", version_code: "evil" }), ctx);
    expect(res.status).toBe(201);
    expect((await res.json()).assignment.assignment_id).toBe(assignmentId);
    expect(sql(mocks.query.mock.calls[1])).toContain("sonder.create_assignment(");
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([teacher, classId, "Maths_v2-U1-dev", "U1", "Rounding check", "single"]);
  });

  it("validates the body before asking the service", async () => {
    const cases: [unknown, string][] = [
      [{ title: "A" }, "unit_not_found"], [{ unit_id: "U 1", title: "A" }, "unit_not_found"],
      [{ unit_id: "U1" }, "assignment_title_invalid"], [{ unit_id: "U1", title: "t".repeat(121) }, "assignment_title_invalid"],
      [{ unit_id: "U1", title: "A", attempt_rule: "twice" }, "attempt_rule_invalid"], ["nope", "invalid_request"],
    ];
    for (const [body, code] of cases) {
      mocks.query.mockResolvedValueOnce([room]);
      const res = await POST(req("POST", body), ctx);
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: { code } });
    }
    expect(mocks.engine).not.toHaveBeenCalled();
  });

  it("refuses when the service cannot say which release it runs", async () => {
    for (const release of [null, "no-model-part"]) {
      mocks.query.mockResolvedValueOnce([room]);
      health(release);
      const res = await POST(req("POST", { unit_id: "U1", title: "A" }), ctx);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: { code: "assignments_unavailable" } });
    }
    mocks.query.mockResolvedValueOnce([room]);
    mocks.engine.mockRejectedValueOnce(new BoundaryError(503, "engine_unavailable"));
    expect(await (await POST(req("POST", { unit_id: "U1", title: "A" }), ctx)).json()).toEqual({ error: { code: "engine_unavailable" } });
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });

  it("maps database refusals", async () => {
    for (const [code, status] of [["class_archived", 409], ["unit_not_found", 422]] as const) {
      mocks.query.mockResolvedValueOnce([room]).mockRejectedValueOnce(productError(code));
      health("Maths_v2-U1-dev/spec-v2-prior");
      const res = await POST(req("POST", { unit_id: "U1", title: "A" }), ctx);
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: { code } });
    }
  });

  it("closes an assignment of this class and refuses others", async () => {
    mocks.query.mockResolvedValueOnce([assignment]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([{ ...assignment, status: "closed" }]);
    const res = await PATCH(req("PATCH", { status: "closed" }), one());
    expect(res.status).toBe(200);
    expect((await res.json()).assignment.status).toBe("closed");
    expect(mocks.query.mock.calls[1].slice(1)).toEqual([teacher, assignmentId, "closed"]);
    mocks.query.mockResolvedValueOnce([assignment]);
    expect((await PATCH(req("PATCH", { status: "closed" }), one("66666666-6666-4666-8666-666666666666"))).status).toBe(404);
    expect((await PATCH(req("PATCH", { status: "closed" }), one("bad"))).status).toBe(404);
    const bad = await PATCH(req("PATCH", { status: "archived" }), one());
    expect(await bad.json()).toEqual({ error: { code: "assignment_status_invalid" } });
    expect(mocks.query).toHaveBeenCalledTimes(4);
  });

  it("refuses cross-origin changes and non-teachers before any query", async () => {
    mocks.origin.mockReturnValue(false);
    expect((await POST(req("POST", { unit_id: "U1", title: "A" }), ctx)).status).toBe(403);
    expect((await PATCH(req("PATCH", { status: "closed" }), one())).status).toBe(403);
    mocks.origin.mockReturnValue(true);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.access).toHaveBeenCalledTimes(0);
  });

  it("offers teachers the units the service runs", async () => {
    mocks.engine.mockImplementationOnce(async (path: string, parser: (v: unknown) => unknown) => {
      expect(path).toBe("/engine/units");
      return parser({ contract_version: 2, subject: "Mathematics", question_budget: 8, units: [{ unit_id: "U1", name: "Rounding", item_count: 20 }] });
    });
    const res = await UNITS(req("GET"), {});
    expect(await res.json()).toEqual({ units: [{ unit_id: "U1", name: "Rounding" }], question_budget: 8 });
    expect(mocks.access).toHaveBeenCalledWith(["teacher"]);
  });

  it("lists a student's open assignments with student-safe fields only", async () => {
    mocks.access.mockResolvedValue({ appUserId: "00000000-0000-4000-8000-000000000003", role: "student" });
    mocks.query.mockResolvedValueOnce([{
      assignment_id: assignmentId, class_id: classId, class_name: "Grade 8 Blue", title: "Rounding check", unit_code: "U1",
      unit_name: "Rounding", attempt_rule: "single", created_at: new Date("2026-11-18T10:00:00Z"), correct_option: "B",
    }]);
    const res = await STUDENT(req("GET"), {});
    const body = await res.json();
    expect(Object.keys(body.assignments[0]).sort()).toEqual(
      ["assignment_id", "attempt_rule", "class_id", "class_name", "created_at", "title", "unit_code", "unit_name"]);
    expect(JSON.stringify(body)).not.toContain("correct_option");
    expect(mocks.access).toHaveBeenCalledWith(["student"]);
  });
});
