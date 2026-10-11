"""Throwaway import probe: load data/Maths_v2 into the Iteration 1 schema and report what fits.

It prints SQL that runs inside ONE transaction and ends with ROLLBACK, so nothing is kept.
It also declares the seven diagnostic units of spec v2 (docs/ENGINE_SPEC_DRAFT.md sections 1.2 and
2.1), freezes the pack, and tries to freeze response models built with the spec's likelihood
(section 3.1) at two guess rates, to show where rule P1 bites.
Each item is loaded in its own sub-block; a rejected item is recorded with the database's
reason and the load continues. This is NOT the real importer (task T05.07): accounts are
synthetic placeholders and review attribution is not resolved (see the plan, section 12).

Usage (from the repository root):
    python docs/db/iteration1/tests/import_probe.py data/Maths_v2 | psql -X -q -d <scratch_db>
"""
import collections
import csv
import hashlib
import os
import sys

root = sys.argv[1]
items_path = os.path.join(root, "bank", "items.csv")
rows = list(csv.DictReader(open(items_path, encoding="utf-8-sig")))
topics = list(csv.DictReader(open(os.path.join(root, "topics.csv"), encoding="utf-8-sig")))
pack_sha = hashlib.sha256(open(items_path, "rb").read()).hexdigest()


def lit(s):
    return "'" + str(s).replace("'", "''") + "'"


items = collections.OrderedDict()
for r in rows:
    items.setdefault(r["item_id"], []).append(r)
topic_names = collections.OrderedDict()
home = {}
for t in topics:
    pre = t["topic"].split(" ")[0]           # T1..T7
    topic_names[pre] = t["topic"]
    home[t["MisconceptionId"]] = pre
stems = collections.defaultdict(list)
for iid, opts in items.items():
    stems[opts[0]["stem"].strip()].append(iid)
family = {i: min(ids) for ids in stems.values() if len(ids) > 1 for i in ids}

UNITS = [  # (code, name, items.csv labels, companion misconceptions)
    ("U1", "Rounding", ["T1 Rounding"], []),
    ("U2", "Conversion", ["T2 Fractions, decimals and percentage conversion"], []),
    ("U3", "Percentage of an amount", ["T3 Percentage of an amount"], ["MATH-1074", "MATH-1651", "MATH-2359"]),
    ("U4", "Choosing the operation", ["T4 Choosing the operation", "T5 cross-concept (operation version)"], ["MATH-2093"]),
    ("U5", "Powers and roots", ["T5 Powers and roots"], []),
    ("U6", "Time and unit conversion", ["T6 Time and unit conversion (seconds and hours)", "T6 x multiplication/division (operation version)",
                                        "T6 x percentage / more / less than (time version)"], ["MATH-1416", "MATH-2359"]),
    ("U7", "Negatives, inverse operations, fraction bar", ["T7 Negatives, inverse operations, fraction bar"], ["MATH-1514", "MATH-1773", "MATH-1715"]),
]
own = collections.defaultdict(list)
for t in topics:
    own[t["topic"].split(" ")[0]].append(t["MisconceptionId"])

out = []
w = out.append
w("\\set ON_ERROR_STOP on")
w("BEGIN;")
w("SET LOCAL search_path = sonder, public;")
w("CREATE TEMP TABLE probe_reject (item_id text, label text, reason text) ON COMMIT DROP;")
w("INSERT INTO app_user (id,email,role,display_name) VALUES "
  "('00000000-0000-0000-0000-00000000aa01','probe-author@example.test','admin','Probe author (stands in for Harris)'),"
  "('00000000-0000-0000-0000-00000000aa02','probe-reviewer@example.test','admin','Probe reviewer (stands in for a non-author reviewer)');")
w("INSERT INTO subject (id,code,name) VALUES ('00000000-0000-0000-0000-00000000bb01','MATH','Mathematics');")
w("INSERT INTO content_version (id,subject_id,version_code,note) VALUES ('00000000-0000-0000-0000-00000000bb02',"
  "'00000000-0000-0000-0000-00000000bb01','Maths_v2','Import probe of data/Maths_v2/bank/items.csv');")
for pre, name in topic_names.items():
    w(f"INSERT INTO topic (subject_id,external_id) VALUES ('00000000-0000-0000-0000-00000000bb01',{lit(pre)});")
    w(f"INSERT INTO topic_revision (topic_id,content_version_id,name) SELECT id,'00000000-0000-0000-0000-00000000bb02',{lit(name)} "
      f"FROM topic WHERE external_id = {lit(pre)};")
for t in topics:
    mid = t["MisconceptionId"]
    w(f"INSERT INTO misconception (subject_id,code,external_id) VALUES ('00000000-0000-0000-0000-00000000bb01',{lit(mid.split('-')[1])},{lit(mid)});")
    w(f"INSERT INTO misconception_revision (misconception_id,content_version_id,name,description,status,engine_tier) "
      f"SELECT id,'00000000-0000-0000-0000-00000000bb02',{lit(t['MisconceptionName'].strip())},{lit(t['MisconceptionName'].strip())},'validated',1 "
      f"FROM misconception WHERE external_id = {lit(mid)};")
    w(f"INSERT INTO topic_misconception (topic_revision_id,misconception_revision_id,membership,target_minimum,old_topic_label,review_note) "
      f"SELECT tr.id, mr.id, 'home', {int(t['target_questions'])}, {lit(t['old_topic_label'])}, {lit(t['comments'])} "
      f"FROM topic_revision tr JOIN topic tp ON tp.id = tr.topic_id, misconception_revision mr JOIN misconception m ON m.id = mr.misconception_id "
      f"WHERE tp.external_id = {lit(home[mid])} AND m.external_id = {lit(mid)};")
# cross-topic memberships for targets owned by another topic
cross = sorted({(iid.split("-")[0], opts[0]["target"], opts[0]["topic"]) for iid, opts in items.items()
                if home.get(opts[0]["target"]) not in (None, iid.split("-")[0])})
for pre, mid, label in cross:
    w(f"INSERT INTO topic_misconception (topic_revision_id,misconception_revision_id,membership,target_minimum,review_note) "
      f"SELECT tr.id, mr.id, 'cross_topic', NULL, {lit('Cross-topic target in Maths_v2 (bank label: ' + label + ')')} "
      f"FROM topic_revision tr JOIN topic tp ON tp.id = tr.topic_id, misconception_revision mr JOIN misconception m ON m.id = mr.misconception_id "
      f"WHERE tp.external_id = {lit(pre)} AND m.external_id = {lit(mid)} ON CONFLICT DO NOTHING;")

note = "Generated by Claude (LLM) in batches; approved by Harris (data/Maths_v2/MANIFEST.md)"
for iid, opts in items.items():
    f = opts[0]
    pre = iid.split("-")[0]
    fam = lit(family[iid]) if iid in family else "NULL"
    body = [f"DECLARE it uuid := gen_random_uuid(); op uuid; BEGIN",
            f" INSERT INTO item (id,topic_revision_id,target_misconception_revision_id,external_id,stem,batch,origin,author_id,llm_assisted,assistance_note,twin_group) "
            f" SELECT it, tr.id, mr.id, {lit(iid)}, {lit(f['stem'])}, {lit(f['batch'])}, 'authored', '00000000-0000-0000-0000-00000000aa01', true, {lit(note)}, {fam} "
            f" FROM topic_revision tr JOIN topic tp ON tp.id = tr.topic_id, misconception_revision mr JOIN misconception m ON m.id = mr.misconception_id "
            f" WHERE tp.external_id = {lit(pre)} AND m.external_id = {lit(f['target'])};"]
    for o in sorted(opts, key=lambda r: r["option_id"]):
        body.append(f" INSERT INTO item_option (id,item_id,label,option_text,is_correct) VALUES (gen_random_uuid(), it, {lit(o['option_id'])}, {lit(o['option_text'])}, {o['is_correct'] == 'True'}) RETURNING id INTO op;")
        for m in [x for x in o["misconceptions"].split("|") if x]:
            body.append(f" INSERT INTO option_misconception (option_id,misconception_revision_id,rationale) SELECT op, mr.id, 'Imported from bank/items.csv (the source has no per-link rationale)' "
                        f"FROM misconception_revision mr JOIN misconception m ON m.id = mr.misconception_id WHERE m.external_id = {lit(m)};")
    body += [" SET CONSTRAINTS ALL IMMEDIATE;",
             " UPDATE item SET review_status = 'in_review' WHERE id = it;",
             " INSERT INTO item_review (item_id,review_round,reviewer_id,decision,note) VALUES (it,1,'00000000-0000-0000-0000-00000000aa02','approved','Probe: stands in for the recorded approval');",
             " SET CONSTRAINTS ALL DEFERRED;",
             f"EXCEPTION WHEN others THEN INSERT INTO probe_reject VALUES ({lit(iid)}, {lit(f['topic'])}, SQLERRM); END"]
    w("DO $imp$ " + "\n".join(body) + " $imp$;")

w("INSERT INTO hypothesis (content_version_id,kind,misconception_revision_id) SELECT '00000000-0000-0000-0000-00000000bb02','misconception',id FROM misconception_revision;")
w("INSERT INTO hypothesis (content_version_id,kind) VALUES ('00000000-0000-0000-0000-00000000bb02','none'),('00000000-0000-0000-0000-00000000bb02','unmodelled');")
for code, name, labels, companions in UNITS:
    pre = labels[0].split(" ")[0]
    hyps = own[pre] + companions
    w(f"INSERT INTO diagnostic_unit (content_version_id,unit_code,name) VALUES ('00000000-0000-0000-0000-00000000bb02',{lit(code)},{lit(name)});")
    for slot, mid in enumerate(hyps):
        w(f"INSERT INTO unit_hypothesis (unit_id,hypothesis_id,slot) SELECT u.id, h.id, {slot} FROM diagnostic_unit u, hypothesis h "
          f"JOIN misconception_revision mr ON mr.id = h.misconception_revision_id JOIN misconception m ON m.id = mr.misconception_id "
          f"WHERE u.unit_code = {lit(code)} AND m.external_id = {lit(mid)};")
    # Pack order = the order of items.csv (positions 0..n-1); the engine breaks exact EIG ties by it.
    members = [x for x, o in items.items() if o[0]["topic"] in labels]
    values = ",".join(f"({lit(x)},{pos})" for pos, x in enumerate(members))
    w(f"INSERT INTO unit_item (unit_id,item_id,position) SELECT u.id, i.id, v.pos FROM diagnostic_unit u "
      f"JOIN (VALUES {values}) v(ext, pos) ON true JOIN item i ON i.external_id = v.ext WHERE u.unit_code = {lit(code)};")
w(f"""DO $f$ BEGIN
 UPDATE content_version SET pack_sha256 = {lit(pack_sha)}, status = 'frozen' WHERE id = '00000000-0000-0000-0000-00000000bb02';
 RAISE NOTICE 'FREEZE: pack froze successfully (items.csv sha256 {pack_sha[:12]}...)';
EXCEPTION WHEN others THEN RAISE NOTICE 'FREEZE: refused -> %', SQLERRM; END $f$;""")
w("""CREATE FUNCTION pg_temp.try_model(ver text, g numeric) RETURNS void LANGUAGE plpgsql AS $m$
DECLARE ep uuid := gen_random_uuid(); rm uuid := gen_random_uuid();
BEGIN
 INSERT INTO engine_params (id,params_version,params_sha256,slip,guess,prior_none,prior_unmodelled,theta,theta_unmodelled,min_support,min_support_none,delta_sep,eig_floor,default_budget,k_max,w_sound,w_stretch)
 VALUES (ep,ver,encode(sha256(convert_to(ver,'UTF8')),'hex'),0.10,g,0.25,0.05,0.80,0.50,3,3,0.05,0.01,8,8,1.0,0.5);
 INSERT INTO response_model (id,content_version_id,engine_params_id,model_code,source,calibration_note)
 VALUES (rm,'00000000-0000-0000-0000-00000000bb02',ep,ver,'prior','Spec v2 3.1 likelihood; assumed parameters');
 -- Spec v2 3.1: P(o|h,i) = (1-e)/|P| on the predicted set, e/(4-|P|) elsewhere; UNMODELLED uniform.
 INSERT INTO response_probability (response_model_id,hypothesis_id,option_id,probability)
 SELECT rm, h.id, o.id,
        CASE WHEN h.kind = 'unmodelled' THEN 0.25
             WHEN s.n > 0 THEN CASE WHEN s.linked THEN (1 - g) / s.n ELSE g / (4 - s.n) END
             ELSE CASE WHEN o.is_correct THEN 0.90 ELSE 0.10 / 3 END END
 FROM hypothesis h CROSS JOIN item_option o JOIN item i ON i.id = o.item_id
 CROSS JOIN LATERAL (SELECT count(*) FILTER (WHERE om.misconception_revision_id = h.misconception_revision_id) AS n,
                            bool_or(om.option_id = o.id AND om.misconception_revision_id = h.misconception_revision_id) AS linked
                     FROM item_option o2 LEFT JOIN option_misconception om ON om.option_id = o2.id WHERE o2.item_id = i.id) s
 WHERE h.content_version_id = '00000000-0000-0000-0000-00000000bb02' AND i.review_status = 'approved';
 UPDATE response_model SET status = 'frozen' WHERE id = rm;
 RAISE NOTICE 'RESPONSE MODEL %: froze (guess %)', ver, g;
EXCEPTION WHEN others THEN RAISE NOTICE 'RESPONSE MODEL %: refused -> %', ver, SQLERRM;
END $m$;""")
w("SELECT pg_temp.try_model('spec-default-guess-0.30', 0.30);")
w("SELECT pg_temp.try_model('guess-0.24', 0.24);")
w("\\echo '== loaded'")
w("SELECT (SELECT count(*) FROM item) AS items, (SELECT count(*) FROM item_option) AS options, "
  "(SELECT count(*) FROM option_misconception) AS links, (SELECT count(*) FROM item WHERE twin_group IS NOT NULL) AS twin_items, "
  "(SELECT count(*) FROM topic_misconception WHERE membership = 'cross_topic') AS cross_topic_rows;")
w("\\echo '== loaded by group (operation-version twins = bank labels containing \"operation version\")'")
w("SELECT CASE WHEN b.label LIKE '%operation version%' THEN 'operation-version twins' ELSE 'eligible (non-twin)' END AS grp, count(*) AS bank_items, "
  "count(*) FILTER (WHERE i.id IS NOT NULL) AS loaded, count(*) FILTER (WHERE r.item_id IS NOT NULL) AS rejected "
  "FROM (VALUES " + ",".join(f"({lit(i)},{lit(o[0]['topic'])})" for i, o in items.items()) + ") b(item_id,label) "
  "LEFT JOIN item i ON i.external_id = b.item_id LEFT JOIN probe_reject r ON r.item_id = b.item_id GROUP BY 1 ORDER BY 1;")
w("\\echo '== units: k (hypotheses) and items'")
w("SELECT u.unit_code, (SELECT count(*) FROM unit_hypothesis WHERE unit_id = u.id) AS k, (SELECT count(*) FROM unit_item WHERE unit_id = u.id) AS items "
  "FROM diagnostic_unit u ORDER BY u.unit_code;")
w("\\echo '== items in no unit'")
w("SELECT external_id FROM item i WHERE NOT EXISTS (SELECT 1 FROM unit_item ui WHERE ui.item_id = i.id) ORDER BY external_id;")
w("\\echo '== rejected items and reasons'")
w("SELECT item_id, label, reason FROM probe_reject ORDER BY item_id;")
w("ROLLBACK;")
sys.stdout.reconfigure(encoding="utf-8")  # stems use U+2212, √, ∛, superscripts
print("\n".join(out))
