import type { AnswerRequest, BeginRequest, Catalogue, OptionId, Snapshot } from "./types";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 10000): string {
  if (typeof value !== "string" || !value.length || value.length > max) throw new Error("Invalid text");
  return value;
}
function integer(value: unknown, min = 0, max = 1000): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error("Invalid integer");
  return value;
}
function option(value: unknown): OptionId {
  if (value !== "A" && value !== "B" && value !== "C" && value !== "D") throw new Error("Invalid option");
  return value;
}
function unitId(value: unknown): string {
  const id = text(value, 32);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid unit");
  return id;
}
function uuid(value: unknown): string {
  const id = text(value, 36);
  if (!UUID.test(id)) throw new Error("Invalid ID");
  return id;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || keys.some(key => !(key in value))) throw new Error("Invalid fields");
}
export function parseBegin(value: unknown): BeginRequest {
  const v = object(value);
  exact(v, ["unit_id", "create_request_id"]);
  return { unit_id: unitId(v.unit_id), create_request_id: uuid(v.create_request_id) };
}
export function parseAnswer(value: unknown): AnswerRequest {
  const v = object(value);
  exact(v, ["step_index", "item_id", "option_id"]);
  return { step_index: integer(v.step_index), item_id: text(v.item_id, 64), option_id: option(v.option_id) };
}
// Rebuild every level: unexpected upstream fields cannot enter student JSON/props.
export function parseCatalogue(value: unknown): Catalogue {
  const v = object(value);
  if (v.contract_version !== 1 || !Array.isArray(v.units) || !v.units.length || v.units.length > 100) throw new Error("Invalid catalogue");
  const units = v.units.map(raw => {
    const u = object(raw);
    return { unit_id: unitId(u.unit_id), name: text(u.name, 256), item_count: integer(u.item_count, 1, 100000) };
  });
  if (new Set(units.map(u => u.unit_id)).size !== units.length) throw new Error("Duplicate unit");
  return { contract_version: 1, subject: text(v.subject, 256), question_budget: integer(v.question_budget, 1), units };
}
export function parseSnapshot(value: unknown): Snapshot {
  const v = object(value), u = object(v.unit);
  if (v.contract_version !== 1) throw new Error("Invalid version");
  const base = { contract_version: 1 as const, session_id: uuid(v.session_id),
    unit: { unit_id: unitId(u.unit_id), name: text(u.name, 256) },
    question_budget: integer(v.question_budget, 1), answered_count: integer(v.answered_count) };
  if (base.answered_count > base.question_budget) throw new Error("Invalid count");
  if (v.status === "complete" && v.question === null) return { ...base, status: "complete", question: null };
  if (v.status !== "in_progress" || base.answered_count >= base.question_budget) throw new Error("Invalid status");
  const q = object(v.question);
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.step_index !== base.answered_count) throw new Error("Invalid question");
  const options = q.options.map(raw => {
    const o = object(raw);
    return { option_id: option(o.option_id), text: text(o.text) };
  });
  if (options.map(o => o.option_id).join("") !== "ABCD") throw new Error("Invalid options");
  return { ...base, status: "in_progress", question: { step_index: integer(q.step_index),
    item_id: text(q.item_id, 64), stem: text(q.stem), options } };
}

export const ERROR_STATUS: Record<string, number> = {
  invalid_request: 422, session_unavailable: 404, unit_not_found: 404, session_expired: 410,
  create_conflict: 409, answer_conflict: 409, step_conflict: 409, item_conflict: 409,
  session_finished: 409, capacity_exceeded: 503, engine_unavailable: 503,
  engine_timeout: 504, engine_numeric_error: 500, invalid_origin: 403,
};
export function parseError(value: unknown, status: number): string {
  const e = object(object(value).error);
  if (typeof e.code !== "string" || ERROR_STATUS[e.code] !== status) throw new Error("Invalid error");
  return e.code;
}
