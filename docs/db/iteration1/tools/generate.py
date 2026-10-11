"""Generate the Iteration 1 DBML, table PDF and plan appendix from the live catalogue JSON.

Usage (see tools/README.md):
    python generate.py <catalog.json> <sonder_iteration1.sql> <out_dir> <DB_SCHEMA_PLAN_ITERATION_1.md>

catalog.json is the output of tools/catalog.sql run against a database built by the SQL.
Writes <out_dir>/sonder_iteration1.dbml and <out_dir>/sonder_iteration1_tables.pdf, and
replaces the text between the APPENDIX markers in the plan. Needs reportlab.
"""
import hashlib, json, re, sys
from xml.sax.saxutils import escape

CAT, SQL, OUT, PLAN = sys.argv[1:5]
tables = json.load(open(CAT, encoding="utf-8"))["tables"]
T = {t["name"]: t for t in tables}
sql_hash = hashlib.sha256(open(SQL, "rb").read()).hexdigest()

GROUPS = [
    ("Users and access", "#3B82F6", ["app_user", "password_credential", "auth_session"]),
    ("Classes", "#10B981", ["classroom", "class_teacher", "enrolment", "class_subject"]),
    ("Math content pack", "#8B5CF6", ["subject", "content_version", "topic", "topic_revision", "misconception",
        "misconception_revision", "topic_misconception", "source_reference", "misconception_source", "item",
        "item_option", "option_misconception", "item_source", "item_review"]),
    ("Diagnostic units", "#0EA5E9", ["diagnostic_unit", "unit_hypothesis", "unit_item"]),
    ("Engine model (frozen inputs)", "#F59E0B", ["hypothesis", "engine_release", "engine_params", "response_model",
        "response_parameter", "response_probability"]),
    ("Diagnostic runs", "#EF4444", ["diagnostic_session", "session_hypothesis", "session_question",
        "question_candidate", "session_step",
        "step_posterior", "diagnosis", "diagnosis_candidate", "escalation", "escalation_candidate"]),
    ("Audit", "#64748B", ["audit_event"]),
]
assert sorted(n for _, _, ns in GROUPS for n in ns) == sorted(T), "group list must cover every table exactly once"

PURPOSE = {
 "app_user": "One account per person with a single role; deactivation keeps history.",
 "password_credential": "The account's password hash, kept apart from the profile.",
 "auth_session": "A login session: hashed token, expiry and revocation.",
 "classroom": "A class a teacher creates and students join with a unique join code.",
 "class_teacher": "Which teachers teach a class (many-to-many); departure keeps attribution.",
 "enrolment": "A student's membership of one class; one row per (class, student).",
 "class_subject": "Which subjects a class studies; a run needs its class to teach the pack's subject.",
 "subject": "A subject (Mathematics now; Physics and Chemistry later) that scopes codes and IDs.",
 "content_version": "One versioned content pack per subject; frozen packs are immutable and carry the pack file hash.",
 "topic": "Stable topic identity within a subject (external ID).",
 "topic_revision": "The topic as it appears in one pack version (name, blurb).",
 "misconception": "Stable misconception identity: code unique per subject, plus external ID such as MATH-1379.",
 "misconception_revision": "The misconception's definition and engine readiness in one pack version.",
 "topic_misconception": "Which misconceptions a topic covers: its home topic (with a coverage target) or a cross-topic membership (with a reason).",
 "source_reference": "A citable source with its licence.",
 "misconception_source": "Sources behind a misconception definition.",
 "item": "A four-option question: stem, topic, target misconception, author, LLM-assistance disclosure, review state, twin group for A/B twins.",
 "item_option": "One of the four labelled options (A-D); exactly one is correct.",
 "option_misconception": "Q-matrix: a wrong option's link to up to three misconceptions, with rationale and link grade (S sound, T stretch).",
 "diagnostic_unit": "The session scope (spec v2): a named unit of a pack with its own hypothesis list and item list.",
 "unit_hypothesis": "A unit's misconception hypotheses in slot order 0..k-1 (NONE and UNMODELLED follow implicitly).",
 "unit_item": "Which items a unit may ask, in pack order (position 0..n-1, used to break exact EIG ties); an item may belong to several units, and all its links must be unit hypotheses.",
 "item_source": "Sources behind an item (required at freeze for curated items).",
 "item_review": "A recorded review decision (approved or rejected) by someone other than the author.",
 "hypothesis": "The engine's candidate states in a pack: each misconception plus NONE and UNMODELLED.",
 "engine_release": "An engine code build and its selection policy, pinned by every run.",
 "engine_params": "One versioned, hashed engine parameter file: slip, guess, reserved priors, thresholds, support rules, budget, K_MAX, link weights (all assumed).",
 "response_model": "A versioned set of answer likelihoods for a frozen pack, built from one engine_params file.",
 "response_parameter": "Slip and guess assumptions per hypothesis in a response model.",
 "response_probability": "P(option | hypothesis) for every approved item; four values summing to 1.",
 "diagnostic_session": "One diagnostic run for one enrolment on one diagnostic unit, pinned to a response model and engine release; outcome status.",
 "session_hypothesis": "Each hypothesis in a run (exactly its unit's list plus NONE and UNMODELLED), its slot and its prior probability.",
 "session_question": "A question shown at a step, with why it was chosen (entropy, expected information gain).",
 "question_candidate": "The ranked EIG of every candidate item considered for a shown question; rank 1 is the shown item.",
 "session_step": "The student's answer to a shown question and the engine's answer note; append-only, idempotent by request key.",
 "step_posterior": "The posterior probability of each hypothesis after an answer.",
 "diagnosis": "The engine's conclusion for a diagnosed run.",
 "diagnosis_candidate": "Rank 1 and rank 2 hypotheses of a diagnosis (confidence read from the last posterior).",
 "escalation": "The engine's explicit refusal: reason and leading hypothesis (no separator, budget exhausted, unmodelled).",
 "escalation_candidate": "The tied set behind a refusal (two or more for no separator), ranked; includes the leader.",
 "audit_event": "Append-only log of important inserts, updates and freezes (who, what, when).",
}

INDEX_PURPOSE = {
 "auth_session_user_idx": "Sign-in/sign-out: a user's live sessions by expiry.",
 "teacher_classes_idx": "Teacher dashboard and class list: a teacher's active classes.",
 "student_classes_idx": "Student class list and run start: a student's enrolments.",
 "misconception_catalogue_idx": "Admin catalogue and pack validation: misconceptions in a pack by status.",
 "item_topic_idx": "Engine pack export and topic picker: approved items under a topic.",
 "item_target_idx": "Coverage check: approved items per target misconception.",
 "option_mapping_reverse_idx": "Q-matrix inspection: which options point at a misconception.",
 "session_roster_idx": "Student history and teacher class view: an enrolment's runs, newest first.",
 "session_outcome_idx": "Teacher dashboard: finished runs by outcome (diagnosed, refused, abandoned).",
 "audit_time_idx": "Audit review: events in a time window.",
 "topic_misconception_home_idx": "Integrity: each misconception has at most one home topic per pack (unique, partial).",
}
assert set(INDEX_PURPOSE) == {i["name"] for t in tables for i in (t["indexes"] or [])}

def pretty_check(d):
    d = re.sub(r"^CHECK \((.*)\)$", r"\1", d)
    d = re.sub(r"::(text|numeric|integer|smallint)(\[\])?", "", d)
    d = re.sub(r"= ANY \(ARRAY\[(.*?)\]\)", r"IN (\1)", d)
    return d

def q(s):
    return s.replace("'", "\\'")

ON_DELETE = {"a": "no action", "r": "restrict", "c": "cascade", "n": "set null", "d": "set default"}

def cons(t, kind):
    return [k for k in (t["constraints"] or []) if k["type"] == kind]

def fk_map(t):
    return {k["cols"][0]: k for k in cons(t, "f")}

def notnull(t, col):
    return next(c["notnull"] for c in t["columns"] if c["name"] == col)

def candidate_keys(t):
    keys, cond = [], []
    for k in cons(t, "p") + cons(t, "u"):
        nnd = "NULLS NOT DISTINCT" in k["def"]
        (keys if all(notnull(t, c) for c in k["cols"]) or nnd else cond).append((k["cols"], nnd))
    return keys, cond

def state_machine(t):
    for g in (t["triggers"] or []):
        m = re.search(r"state_guard\('(\w+)', '([^']*)', '([^']*)'\)", g["def"])
        if m:
            return m.group(1), m.group(2).split(","), m.group(3).split(",")
    return None

def guards(t):
    out = []
    for g in (t["triggers"] or []):
        fn = re.search(r"EXECUTE (?:FUNCTION|PROCEDURE) (?:\w+\.)?(\w+)\(", g["def"]).group(1)
        timing = "deferred " if "DEFERRABLE" in g["def"] else ""
        out.append(f"{g['name']} ({timing}{fn})")
    return out

# ------------------------------------------------------------------ DBML
def dbml_default(d):
    if d is None:
        return None
    d = re.sub(r"::(text|jsonb|smallint|integer|numeric)$", "", d)
    return d

lines = [
 "// Sonder - Iteration 1 (Mid-1) schema. Paste into https://dbdiagram.io/ to draw the ERD.",
 "// Generated from the PostgreSQL catalogue after running sonder_iteration1.sql; the SQL is authoritative.",
 "// Triggers (freeze, review, four-option, append-only and trace checks) are not expressible in DBML; see the plan.",
 "// The derived view sonder.step_support (support counts per step) is not drawn; see the plan.",
 f"// Coverage: {len(tables)} tables, {sum(len(t['columns']) for t in tables)} columns, "
 f"{sum(len(cons(t,'f')) for t in tables)} foreign keys, {sum(len(t['indexes'] or []) for t in tables)} secondary indexes.",
 f"// sonder_iteration1.sql SHA-256: {sql_hash}",
 "",
 "Project Sonder_Iteration_1 {",
 "  database_type: 'PostgreSQL'",
 "  Note: 'Iteration 1 slice: users, classes, versioned Math content pack with review and Q-matrix, frozen response model, diagnostic runs with posteriors and refusals, audit. One schema: sonder.'",
 "}",
 "",
]
refs = []
for gname, colour, names in GROUPS:
    for n in names:
        t = T[n]; fks = fk_map(t)
        single_unique = {k["cols"][0] for k in cons(t, "u") if len(k["cols"]) == 1}
        lines.append(f"Table sonder.{n} [headercolor: {colour}] {{")
        for c in t["columns"]:
            attrs = []
            if [c["name"]] == cons(t, "p")[0]["cols"]: attrs.append("pk")
            if c["notnull"]: attrs.append("not null")
            if c["name"] in single_unique: attrs.append("unique")
            dflt = dbml_default(c["default"])
            if dflt is not None: attrs.append(f"default: `{dflt}`")
            lines.append(f"  {c['name']} {c['type'].replace(' ', '_') if ' ' in c['type'] and c['type'] != 'timestamp with time zone' else ('timestamptz' if c['type']=='timestamp with time zone' else c['type'])}"
                         + (f" [{', '.join(attrs)}]" if attrs else ""))
        multi = [k for k in cons(t, "u") if len(k["cols"]) > 1]
        if multi or t["indexes"]:
            lines += ["", "  indexes {"]
            for k in multi:
                note = ", note: 'NULLS NOT DISTINCT'" if "NULLS NOT DISTINCT" in k["def"] else ""
                lines.append(f"    ({', '.join(k['cols'])}) [unique, name: '{k['name']}'{note}]")
            for i in (t["indexes"] or []):
                cols = re.search(r"USING btree \((.*?)\)", i["def"]).group(1)
                cols = ", ".join(x.split()[0] for x in cols.split(", "))
                where = re.search(r" WHERE (.*)$", i["def"])
                note = INDEX_PURPOSE[i["name"]] + (f" Partial: WHERE {where.group(1)}." if where else "")
                uniq = "unique, " if i["def"].startswith("CREATE UNIQUE") else ""
                lines.append(f"    ({cols}) [{uniq}name: '{i['name']}', note: '{q(note)}']")
            lines.append("  }")
        checks = [k for k in cons(t, "c")]
        if checks:
            lines += ["", "  checks {"]
            for k in checks:
                lines.append(f"    `{pretty_check(k['def'])}`")
            lines.append("  }")
        sm = state_machine(t)
        note = PURPOSE[n] + (f" State machine on {sm[0]}: starts {' or '.join(sm[1])}; allowed {', '.join(e.replace('>', ' -> ') for e in sm[2])}." if sm else "")
        lines += ["", f"  Note: '{q(gname)}. {q(note)}'", "}", ""]
        for k in cons(t, "f"):
            col = k["cols"][0]; pt, pc = k["ref_table"], k["ref_cols"][0]
            rel = "-" if col in single_unique else ">"
            if rel == "-":
                refs.append(f"Ref: sonder.{pt}.{pc} - sonder.{n}.{col} [delete: {ON_DELETE[k['on_delete']]}]")
            else:
                refs.append(f"Ref: sonder.{n}.{col} > sonder.{pt}.{pc} [delete: {ON_DELETE[k['on_delete']]}]")
for gname, colour, names in GROUPS:
    lines.append(f"TableGroup \"{gname}\" [color: {colour}] {{")
    lines += [f"  sonder.{n}" for n in names] + ["}", ""]
lines += refs
open(f"{OUT}/sonder_iteration1.dbml", "w", encoding="utf-8").write("\n".join(lines) + "\n")

# ------------------------------------------------------------------ plan appendix (markdown)
md = []
for gname, _, names in GROUPS:
    md.append(f"### {gname}\n")
    for n in names:
        t = T[n]
        keys, cond = candidate_keys(t)
        md.append(f"#### `{n}`\n")
        md.append(PURPOSE[n] + "\n")
        cols = ", ".join(f"`{c['name']} {c['type']}{'' if c['notnull'] else ' NULL'}`" for c in t["columns"])
        md.append(f"- **Columns:** {cols}.")
        md.append("- **Candidate keys:** " + "; ".join(f"({', '.join(k)})" + (" with NULLS NOT DISTINCT" if nnd else "") for k, nnd in keys)
                  + ". Each determines every other column of the row.")
        if cond:
            md.append("- **Conditional uniqueness (not a candidate key, column nullable):** " + "; ".join(f"({', '.join(k)})" for k, _ in cond) + ".")
        fks = cons(t, "f")
        md.append("- **Foreign keys:** " + ("; ".join(f"`{k['cols'][0]}` → `{k['ref_table']}.{k['ref_cols'][0]}` ON DELETE {ON_DELETE[k['on_delete']].upper()}" for k in fks) if fks else "none") + ".")
        ch = [pretty_check(k['def']) for k in cons(t, "c")]
        if ch:
            md.append("- **Checks:** " + "; ".join(f"`{c}`" for c in ch) + ".")
        ix = t["indexes"] or []
        if ix:
            md.append("- **Secondary indexes:** " + "; ".join(f"`{i['name']}`: {INDEX_PURPOSE[i['name']]}" for i in ix))
        sm = state_machine(t)
        if sm:
            md.append(f"- **State machine (database-enforced):** `{sm[0]}` starts as {' or '.join(sm[1])}; allowed transitions {', '.join(e.replace('>', ' → ') for e in sm[2])}.")
        g = guards(t)
        if g:
            md.append("- **Triggers:** " + ", ".join(g) + ".")
        md.append("")
plan = open(PLAN, encoding="utf-8").read()
BEGIN, END = "<!-- APPENDIX:BEGIN (generated by tools/generate.py; do not edit by hand) -->", "<!-- APPENDIX:END -->"
assert plan.count(BEGIN) == 1 and plan.count(END) == 1, "plan needs exactly one APPENDIX marker pair"
plan = plan[:plan.index(BEGIN) + len(BEGIN)] + "\n\n" + "\n".join(md).rstrip("\n") + "\n\n" + plan[plan.index(END):]
open(PLAN, "w", encoding="utf-8", newline="\n").write(plan)

# ------------------------------------------------------------------ PDF
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, KeepTogether

INK, MUTED, ACC = colors.HexColor("#111827"), colors.HexColor("#6B7280"), colors.HexColor("#1D4ED8")
s_title = ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=INK, spaceAfter=4)
s_sub = ParagraphStyle("s", fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED, spaceAfter=10)
s_grp = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=colors.white, backColor=INK,
                       borderPadding=(4, 6, 4, 6), spaceBefore=8, spaceAfter=10)
s_tab = ParagraphStyle("tb", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=ACC, spaceBefore=7)
s_pur = ParagraphStyle("p", fontName="Helvetica", fontSize=7.3, leading=9, textColor=MUTED, spaceAfter=2)
s_col = ParagraphStyle("c", fontName="Courier", fontSize=8, leading=10.2, textColor=INK, leftIndent=8)

def col_line(t, c):
    tags = []
    if [c["name"]] == cons(t, "p")[0]["cols"]: tags.append('<font color="#B45309">PK</font>')
    fk = fk_map(t).get(c["name"])
    if fk: tags.append(f'<font color="#047857">FK -&gt; {escape(fk["ref_table"])}.{escape(fk["ref_cols"][0])}</font>')
    s = escape(c["name"])
    if tags: s += '  <font name="Helvetica" size="7">(' + ", ".join(tags) + ")</font>"
    return Paragraph(s, s_col)

W, H = A4; M = 36; GAP = 18; colw = (W - 2 * M - GAP) / 2
def footer(cv, doc):
    cv.saveState(); cv.setFont("Helvetica", 7.5); cv.setFillColor(MUTED)
    cv.drawString(M, 20, "Sonder Iteration 1 schema - table and column reference (generated from sonder_iteration1.sql)")
    cv.drawRightString(W - M, 20, f"Page {doc.page}"); cv.restoreState()
doc = BaseDocTemplate(f"{OUT}/sonder_iteration1_tables.pdf", pagesize=A4, leftMargin=M, rightMargin=M, topMargin=M,
                      bottomMargin=36, title="Sonder Iteration 1 database tables", author="Sonder team")
frames = [Frame(M, 36, colw, H - M - 36, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0),
          Frame(M + colw + GAP, 36, colw, H - M - 36, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)]
doc.addPageTemplates([PageTemplate(id="two", frames=frames, onPage=footer)])
story = [Paragraph("Sonder - Iteration 1 database tables", s_title),
         Paragraph(f"{len(tables)} tables, {sum(len(t['columns']) for t in tables)} columns, grouped by domain. "
                   "PK = primary key. FK -&gt; table.column shows the table and column a foreign key points to. "
                   "All tables live in the <b>sonder</b> schema.", s_sub)]
for gname, _, names in GROUPS:
    story.append(Paragraph(f"{escape(gname)} ({len(names)} table{'' if len(names) == 1 else 's'})", s_grp))
    for n in names:
        t = T[n]
        story.append(KeepTogether([Paragraph(escape(n), s_tab), Paragraph(escape(PURPOSE[n]), s_pur)]
                                  + [col_line(t, c) for c in t["columns"]]))
doc.build(story)
print("generated: dbml, pdf, appendix;", len(tables), "tables; sql sha256", sql_hash[:12])
