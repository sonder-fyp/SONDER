-- Behaviour test for sonder_iteration1.sql (revision 3). Synthetic data only; never run on Neon main.
-- Run on an EMPTY throwaway database after applying the schema script:
--   psql -X -q -d <scratch_db> -f docs/db/iteration1/tests/behaviour_test.sql
-- Output: one "ok" NOTICE per rejected case (Nxx) and a "PASS" NOTICE per positive check (Pxx).
-- Any WARNING "FAIL" or any ERROR means the schema does not behave as the plan says.
\set ON_ERROR_STOP on
SET search_path = sonder, public;

-- expect_fail runs one statement (or DO block) in a subtransaction, forces deferred checks,
-- and reports ok/FAIL. Nothing it does survives.
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'UNEXPECTED_SUCCESS';
  EXCEPTION WHEN others THEN
    IF SQLERRM = 'UNEXPECTED_SUCCESS' THEN RAISE WARNING 'FAIL  %: statement was accepted', label;
    ELSE RAISE NOTICE 'ok    % -> %', label, SQLERRM; END IF;
  END;
END $$;
CREATE OR REPLACE FUNCTION pg_temp.check(label text, cond boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF cond THEN RAISE NOTICE 'PASS  %', label; ELSE RAISE WARNING 'FAIL  %', label; END IF;
END $$;

-- ================================================================ P1 users, subjects, classes
BEGIN;
INSERT INTO app_user (id,email,role,display_name) VALUES
 ('00000000-0000-0000-0000-0000000000a1','author@example.test','admin','Synthetic author'),
 ('00000000-0000-0000-0000-0000000000a2','reviewer@example.test','admin','Synthetic reviewer'),
 ('00000000-0000-0000-0000-0000000000b1','teacher@example.test','teacher','Synthetic teacher'),
 ('00000000-0000-0000-0000-0000000000c1','student1@example.test','student','Synthetic student 1'),
 ('00000000-0000-0000-0000-0000000000c2','student2@example.test','student','Synthetic student 2');
INSERT INTO subject (id,code,name) VALUES ('00000000-0000-0000-0000-000000000011','MATH','Mathematics'),
                                          ('00000000-0000-0000-0000-000000000012','PHYS','Physics');
INSERT INTO classroom (id,name,join_code) VALUES ('00000000-0000-0000-0000-000000000021','Grade 8 A','MATH8A01'),
                                                 ('00000000-0000-0000-0000-000000000022','Grade 8 B','MATH8B01');
INSERT INTO class_subject (class_id,subject_id) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011');
INSERT INTO class_teacher (class_id,teacher_id) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000b1');
INSERT INTO enrolment (id,class_id,student_id) VALUES
 ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000c1'),
 ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-0000000000c1');
COMMIT;

-- ================================================================ P2 draft pack: two topics, cross-topic membership, four items
BEGIN;
INSERT INTO content_version (id,subject_id,version_code) VALUES
 ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011','math-v1'),
 ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000012','phys-draft');
INSERT INTO topic (id,subject_id,external_id) VALUES
 ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000011','FRACTIONS'),
 ('00000000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000011','PERCENT');
INSERT INTO topic_revision (id,topic_id,content_version_id,name) VALUES
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000031','Fractions'),
 ('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000031','Percentages');
INSERT INTO misconception (id,subject_id,code,external_id) VALUES
 ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000011','M1','MATH-0001'),
 ('00000000-0000-0000-0000-000000000052','00000000-0000-0000-0000-000000000011','M2','MATH-0002'),
 ('00000000-0000-0000-0000-000000000058','00000000-0000-0000-0000-000000000011','M3','MATH-0003'),
 ('00000000-0000-0000-0000-000000000053','00000000-0000-0000-0000-000000000012','M1','PHYS-0001');
INSERT INTO misconception_revision (id,misconception_id,content_version_id,name,description,status,engine_tier) VALUES
 ('00000000-0000-0000-0000-000000000054','00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000031','Adds denominators','Adds tops and bottoms','validated',1),
 ('00000000-0000-0000-0000-000000000055','00000000-0000-0000-0000-000000000052','00000000-0000-0000-0000-000000000031','Bigger denominator is bigger','Compares by denominator','validated',1),
 ('00000000-0000-0000-0000-000000000057','00000000-0000-0000-0000-000000000058','00000000-0000-0000-0000-000000000031','Adds instead of multiplies','Owned by the Percent topic','validated',1),
 ('00000000-0000-0000-0000-000000000056','00000000-0000-0000-0000-000000000053','00000000-0000-0000-0000-000000000032','Physics M1','Synthetic','pending',2);
INSERT INTO topic_misconception (topic_revision_id,misconception_revision_id,membership,target_minimum,review_note) VALUES
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000054','home',3,''),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000055','home',3,''),
 ('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000057','home',3,''),
 ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000057','cross_topic',NULL,'Cross-concept item: fraction stem testing the Percent topic misconception');
INSERT INTO source_reference (id,citation_key,citation,licence) VALUES ('00000000-0000-0000-0000-000000000061','synthetic2026','Synthetic source','CC-BY-4.0');
INSERT INTO item (id,topic_revision_id,target_misconception_revision_id,external_id,stem,origin,author_id,llm_assisted,assistance_note,twin_group) VALUES
 ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000054','MATH-Q1','1/2 + 1/3 = ?','curated','00000000-0000-0000-0000-0000000000a1',true,'Drafted with an LLM, checked by the author','FAM-Q1'),
 ('00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000055','MATH-Q2','Which is larger?','authored','00000000-0000-0000-0000-0000000000a1',false,'',NULL),
 ('00000000-0000-0000-0000-000000000073','00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000055','MATH-Q1B','1/2 + 1/3 = ?','authored','00000000-0000-0000-0000-0000000000a1',false,'','FAM-Q1'),
 ('00000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000057','MATH-Q4','3 groups of 1/4 = ?','authored','00000000-0000-0000-0000-0000000000a1',false,'',NULL);
INSERT INTO item_option (id,item_id,label,option_text,is_correct) VALUES
 ('00000000-0000-0000-0000-00000000007a','00000000-0000-0000-0000-000000000071','A','5/6',true),
 ('00000000-0000-0000-0000-00000000007b','00000000-0000-0000-0000-000000000071','B','2/5',false),
 ('00000000-0000-0000-0000-00000000007c','00000000-0000-0000-0000-000000000071','C','2/6',false),
 ('00000000-0000-0000-0000-00000000007d','00000000-0000-0000-0000-000000000071','D','1/6',false),
 ('00000000-0000-0000-0000-00000000008a','00000000-0000-0000-0000-000000000072','A','1/8',false),
 ('00000000-0000-0000-0000-00000000008b','00000000-0000-0000-0000-000000000072','B','1/2',true),
 ('00000000-0000-0000-0000-00000000008c','00000000-0000-0000-0000-000000000072','C','1/4',false),
 ('00000000-0000-0000-0000-00000000008d','00000000-0000-0000-0000-000000000072','D','Same size',false),
 ('00000000-0000-0000-0000-00000000009a','00000000-0000-0000-0000-000000000073','A','1/5',false),
 ('00000000-0000-0000-0000-00000000009b','00000000-0000-0000-0000-000000000073','B','5/6',true),
 ('00000000-0000-0000-0000-00000000009c','00000000-0000-0000-0000-000000000073','C','2/6',false),
 ('00000000-0000-0000-0000-00000000009d','00000000-0000-0000-0000-000000000073','D','6/5',false),
 ('00000000-0000-0000-0000-000000000f41','00000000-0000-0000-0000-000000000074','A','3 1/4',false),
 ('00000000-0000-0000-0000-000000000f42','00000000-0000-0000-0000-000000000074','B','3/4',true),
 ('00000000-0000-0000-0000-000000000f43','00000000-0000-0000-0000-000000000074','C','3/12',false),
 ('00000000-0000-0000-0000-000000000f44','00000000-0000-0000-0000-000000000074','D','1/12',false);
INSERT INTO option_misconception (option_id,misconception_revision_id,rationale) VALUES
 ('00000000-0000-0000-0000-00000000007b','00000000-0000-0000-0000-000000000054','adds tops and bottoms'),
 ('00000000-0000-0000-0000-00000000007c','00000000-0000-0000-0000-000000000054','adds tops, keeps product'),
 ('00000000-0000-0000-0000-00000000007c','00000000-0000-0000-0000-000000000055','two links on one wrong option'),
 ('00000000-0000-0000-0000-00000000008a','00000000-0000-0000-0000-000000000055','bigger denominator'),
 ('00000000-0000-0000-0000-00000000008c','00000000-0000-0000-0000-000000000054','synthetic'),
 ('00000000-0000-0000-0000-00000000009a','00000000-0000-0000-0000-000000000055','synthetic'),
 ('00000000-0000-0000-0000-00000000009c','00000000-0000-0000-0000-000000000054','synthetic'),
 -- P-rev2: one option shared by THREE misconceptions (like Maths_v2 T7-003 A) is allowed.
 ('00000000-0000-0000-0000-000000000f41','00000000-0000-0000-0000-000000000054','three-way shared answer'),
 ('00000000-0000-0000-0000-000000000f41','00000000-0000-0000-0000-000000000055','three-way shared answer'),
 ('00000000-0000-0000-0000-000000000f41','00000000-0000-0000-0000-000000000057','three-way shared answer'),
 ('00000000-0000-0000-0000-000000000f43','00000000-0000-0000-0000-000000000057','adds instead of multiplies');
INSERT INTO item_source (item_id,source_id,locator) VALUES ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000061','Q4');
INSERT INTO hypothesis (id,content_version_id,kind,misconception_revision_id) VALUES
 ('00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000031','misconception','00000000-0000-0000-0000-000000000054'),
 ('00000000-0000-0000-0000-000000000092','00000000-0000-0000-0000-000000000031','misconception','00000000-0000-0000-0000-000000000055'),
 ('00000000-0000-0000-0000-000000000098','00000000-0000-0000-0000-000000000031','misconception','00000000-0000-0000-0000-000000000057'),
 ('00000000-0000-0000-0000-000000000093','00000000-0000-0000-0000-000000000031','none',NULL),
 ('00000000-0000-0000-0000-000000000094','00000000-0000-0000-0000-000000000031','unmodelled',NULL);
-- Units (spec v2 2.1): UA uses the cross-topic companion M3; UB is the two-misconception core.
INSERT INTO diagnostic_unit (id,content_version_id,unit_code,name) VALUES
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000031','UA','Fractions with a Percent companion'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000031','UB','Fractions core');
INSERT INTO unit_hypothesis (unit_id,hypothesis_id,slot) VALUES
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000091',0),('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000092',1),('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000098',2),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000091',0),('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000092',1);
INSERT INTO unit_item (unit_id,item_id) VALUES
 ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000071'),('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000072'),('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000073'),('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000074'),
 ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000071'),('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000072');
COMMIT;
SELECT pg_temp.check('P41 three-link option and cross-topic target item committed',
  (SELECT count(*) FROM option_misconception WHERE option_id = '00000000-0000-0000-0000-000000000f41') = 3
  AND EXISTS (SELECT 1 FROM item WHERE id = '00000000-0000-0000-0000-000000000074'));

-- ---------------------------------------------------------------- negative content checks (draft pack)
SELECT pg_temp.expect_fail('N01 item with only three options',
 $q$DO $d$ BEGIN
   INSERT INTO sonder.item (id,topic_revision_id,target_misconception_revision_id,external_id,stem,origin,author_id) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000054','MATH-QX','x','authored','00000000-0000-0000-0000-0000000000a1');
   INSERT INTO sonder.item_option (item_id,label,option_text,is_correct) VALUES ('00000000-0000-0000-0000-0000000000f1','A','a',true),('00000000-0000-0000-0000-0000000000f1','B','b',false),('00000000-0000-0000-0000-0000000000f1','C','c',false);
 END $d$$q$);
SELECT pg_temp.expect_fail('N02 two correct options',
 $q$UPDATE sonder.item_option SET is_correct = true WHERE id = '00000000-0000-0000-0000-00000000007b'$q$);
SELECT pg_temp.expect_fail('N03 fifth option label E',
 $q$INSERT INTO sonder.item_option (item_id,label,option_text,is_correct) VALUES ('00000000-0000-0000-0000-000000000071','E','e',false)$q$);
SELECT pg_temp.expect_fail('N04 misconception link on the correct option',
 $q$INSERT INTO sonder.option_misconception (option_id,misconception_revision_id,rationale) VALUES ('00000000-0000-0000-0000-00000000007a','00000000-0000-0000-0000-000000000054','x')$q$);
SELECT pg_temp.expect_fail('N05 FOUR misconceptions on one wrong option (cap is three)',
 $q$DO $d$ BEGIN
   INSERT INTO sonder.misconception (id,subject_id,code,external_id) VALUES ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000011','M4','MATH-0004');
   INSERT INTO sonder.misconception_revision (id,misconception_id,content_version_id,name,description,status,engine_tier) VALUES ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-000000000031','M4','m4','validated',1);
   INSERT INTO sonder.option_misconception (option_id,misconception_revision_id,rationale) VALUES ('00000000-0000-0000-0000-000000000f41','00000000-0000-0000-0000-0000000000f3','fourth');
 END $d$$q$);
SELECT pg_temp.expect_fail('N06 Physics misconception linked to a Math option',
 $q$INSERT INTO sonder.option_misconception (option_id,misconception_revision_id,rationale) VALUES ('00000000-0000-0000-0000-00000000007d','00000000-0000-0000-0000-000000000056','cross-subject')$q$);
SELECT pg_temp.expect_fail('N07 duplicate misconception code within a subject',
 $q$INSERT INTO sonder.misconception (subject_id,code,external_id) VALUES ('00000000-0000-0000-0000-000000000011','M1','MATH-9999')$q$);
SELECT pg_temp.expect_fail('N08 item authored by a student',
 $q$INSERT INTO sonder.item (topic_revision_id,target_misconception_revision_id,external_id,stem,origin,author_id) VALUES ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000054','MATH-QS','x','authored','00000000-0000-0000-0000-0000000000c1')$q$);
SELECT pg_temp.expect_fail('N09 LLM-assisted item without an assistance note',
 $q$UPDATE sonder.item SET assistance_note = '' WHERE id = '00000000-0000-0000-0000-000000000071'$q$);
SELECT pg_temp.expect_fail('N10 review of a draft item (not yet in review)',
 $q$INSERT INTO sonder.item_review (item_id,review_round,reviewer_id,decision,note) VALUES ('00000000-0000-0000-0000-000000000071',1,'00000000-0000-0000-0000-0000000000a2','approved','ok')$q$);
INSERT INTO option_misconception (option_id,misconception_revision_id,rationale,link_grade) VALUES ('00000000-0000-0000-0000-00000000007d','00000000-0000-0000-0000-000000000054','third option for M1 (stretch)','T');
SELECT pg_temp.check('P48 spec v2 V11: one misconception on three options of an item is accepted, stored as a stretch link',
  (SELECT count(*) FROM option_misconception om JOIN item_option o ON o.id = om.option_id WHERE o.item_id = '00000000-0000-0000-0000-000000000071' AND om.misconception_revision_id = '00000000-0000-0000-0000-000000000054') = 3
  AND (SELECT link_grade FROM option_misconception WHERE option_id = '00000000-0000-0000-0000-00000000007d') = 'T');
SELECT pg_temp.expect_fail('N41 link grade other than S or T',
 $q$INSERT INTO sonder.option_misconception (option_id,misconception_revision_id,rationale,link_grade) VALUES ('00000000-0000-0000-0000-00000000008d','00000000-0000-0000-0000-000000000055','x','X')$q$);
SELECT pg_temp.expect_fail('N64 a unit hypothesis that is NONE (units list misconceptions only)',
 $q$INSERT INTO sonder.unit_hypothesis (unit_id,hypothesis_id,slot) VALUES ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000093',2)$q$);
SELECT pg_temp.expect_fail('N42 cross-topic membership without a reason',
 $q$INSERT INTO sonder.topic_misconception (topic_revision_id,misconception_revision_id,membership,target_minimum,review_note) VALUES ('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000054','cross_topic',NULL,'')$q$);
SELECT pg_temp.expect_fail('N43 a second home topic for the same misconception',
 $q$INSERT INTO sonder.topic_misconception (topic_revision_id,misconception_revision_id,membership,target_minimum) VALUES ('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000054','home',3)$q$);
SELECT pg_temp.expect_fail('N44 cross-topic membership with a coverage target',
 $q$INSERT INTO sonder.topic_misconception (topic_revision_id,misconception_revision_id,membership,target_minimum,review_note) VALUES ('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000055','cross_topic',3,'why')$q$);
SELECT pg_temp.expect_fail('N45 item target not kept by its topic',
 $q$INSERT INTO sonder.item (topic_revision_id,target_misconception_revision_id,external_id,stem,origin,author_id) VALUES ('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000054','MATH-QP','x','authored','00000000-0000-0000-0000-0000000000a1')$q$);

-- ---------------------------------------------------------------- review workflow
UPDATE item SET review_status = 'in_review' WHERE topic_revision_id = '00000000-0000-0000-0000-000000000042';
SELECT pg_temp.expect_fail('N11 author reviews own item',
 $q$INSERT INTO sonder.item_review (item_id,review_round,reviewer_id,decision,note) VALUES ('00000000-0000-0000-0000-000000000071',1,'00000000-0000-0000-0000-0000000000a1','approved','self')$q$);
SELECT pg_temp.expect_fail('N12 approve by direct UPDATE without a review row',
 $q$UPDATE sonder.item SET review_status = 'approved' WHERE id = '00000000-0000-0000-0000-000000000071'$q$);
SELECT pg_temp.expect_fail('N13 edit an option while the item is in review',
 $q$UPDATE sonder.item_option SET option_text = 'changed' WHERE id = '00000000-0000-0000-0000-00000000007b'$q$);
SELECT pg_temp.expect_fail('N14 skip a review round number',
 $q$INSERT INTO sonder.item_review (item_id,review_round,reviewer_id,decision,note) VALUES ('00000000-0000-0000-0000-000000000071',2,'00000000-0000-0000-0000-0000000000a2','approved','skip')$q$);
SELECT pg_temp.expect_fail('N15 freeze while items are still in review',
 $q$UPDATE sonder.content_version SET pack_sha256 = repeat('a',64), status = 'frozen' WHERE id = '00000000-0000-0000-0000-000000000031'$q$);
INSERT INTO item_review (item_id,review_round,reviewer_id,decision,note) VALUES ('00000000-0000-0000-0000-000000000072',1,'00000000-0000-0000-0000-0000000000a2','rejected','Option D wording is ambiguous');
UPDATE item SET review_status = 'draft' WHERE id = '00000000-0000-0000-0000-000000000072';
UPDATE item_option SET option_text = 'Both are the same size' WHERE id = '00000000-0000-0000-0000-00000000008d';
UPDATE item SET review_status = 'in_review' WHERE id = '00000000-0000-0000-0000-000000000072';
INSERT INTO item_review (item_id,review_round,reviewer_id,decision,note) VALUES
 ('00000000-0000-0000-0000-000000000071',1,'00000000-0000-0000-0000-0000000000a2','approved','Checked'),
 ('00000000-0000-0000-0000-000000000072',2,'00000000-0000-0000-0000-0000000000a2','approved','Fixed wording verified'),
 ('00000000-0000-0000-0000-000000000073',1,'00000000-0000-0000-0000-0000000000a2','approved','Twin checked'),
 ('00000000-0000-0000-0000-000000000074',1,'00000000-0000-0000-0000-0000000000a2','approved','Cross-topic item checked');
SELECT pg_temp.check('P42 reject-fix-approve cycle leaves four approved items',
  (SELECT count(*) FROM item WHERE review_status = 'approved') = 4 AND (SELECT count(*) FROM item_review) = 5);
SELECT pg_temp.expect_fail('N16 edit an approved item stem',
 $q$UPDATE sonder.item SET stem = 'changed' WHERE id = '00000000-0000-0000-0000-000000000071'$q$);
SELECT pg_temp.expect_fail('N17 delete an approved item',
 $q$DELETE FROM sonder.item WHERE id = '00000000-0000-0000-0000-000000000071'$q$);
SELECT pg_temp.expect_fail('N18 alter a recorded review',
 $q$UPDATE sonder.item_review SET note = 'rewritten' WHERE item_id = '00000000-0000-0000-0000-000000000071'$q$);
SELECT pg_temp.expect_fail('N65 V5'': freeze with a unit item whose link is outside the unit',
 $q$DO $d$ BEGIN
   INSERT INTO sonder.diagnostic_unit (id,content_version_id,unit_code,name) VALUES ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-000000000031','UBAD','Missing M3');
   INSERT INTO sonder.unit_hypothesis (unit_id,hypothesis_id,slot) VALUES ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-000000000091',0),('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-000000000092',1);
   INSERT INTO sonder.unit_item (unit_id,item_id) VALUES ('00000000-0000-0000-0000-0000000000d9','00000000-0000-0000-0000-000000000074');
   UPDATE sonder.content_version SET pack_sha256 = repeat('ab',32), status = 'frozen' WHERE id = '00000000-0000-0000-0000-000000000031';
 END $d$$q$);
SELECT pg_temp.expect_fail('N66 unit slots with a gap',
 $q$DO $d$ BEGIN
   INSERT INTO sonder.diagnostic_unit (id,content_version_id,unit_code,name) VALUES ('00000000-0000-0000-0000-0000000000d8','00000000-0000-0000-0000-000000000031','UGAP','Gap');
   INSERT INTO sonder.unit_hypothesis (unit_id,hypothesis_id,slot) VALUES ('00000000-0000-0000-0000-0000000000d8','00000000-0000-0000-0000-000000000091',0),('00000000-0000-0000-0000-0000000000d8','00000000-0000-0000-0000-000000000092',2);
   INSERT INTO sonder.unit_item (unit_id,item_id) VALUES ('00000000-0000-0000-0000-0000000000d8','00000000-0000-0000-0000-000000000072');
   UPDATE sonder.content_version SET pack_sha256 = repeat('ab',32), status = 'frozen' WHERE id = '00000000-0000-0000-0000-000000000031';
 END $d$$q$);
SELECT pg_temp.expect_fail('N19 freeze without a pack hash',
 $q$UPDATE sonder.content_version SET status = 'frozen' WHERE id = '00000000-0000-0000-0000-000000000031'$q$);

-- ================================================================ P5 freeze; engine params; response model
UPDATE content_version SET pack_sha256 = repeat('ab',32), status = 'frozen' WHERE id = '00000000-0000-0000-0000-000000000031';
SELECT pg_temp.expect_fail('N20 rename a topic in the frozen pack',
 $q$UPDATE sonder.topic_revision SET name = 'Renamed' WHERE id = '00000000-0000-0000-0000-000000000042'$q$);
SELECT pg_temp.expect_fail('N21 add an item to the frozen pack',
 $q$INSERT INTO sonder.item (topic_revision_id,target_misconception_revision_id,external_id,stem,origin,author_id) VALUES ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000054','MATH-Q9','x','authored','00000000-0000-0000-0000-0000000000a1')$q$);
SELECT pg_temp.expect_fail('N67 add an item to a unit of the frozen pack',
 $q$INSERT INTO sonder.unit_item (unit_id,item_id) VALUES ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-000000000074')$q$);
SELECT pg_temp.expect_fail('N22 unfreeze the pack',
 $q$UPDATE sonder.content_version SET status = 'draft' WHERE id = '00000000-0000-0000-0000-000000000031'$q$);
SELECT pg_temp.expect_fail('N46 engine params with theta + theta_unmodelled <= 1 (P3)',
 $q$INSERT INTO sonder.engine_params (params_version,params_sha256,slip,guess,prior_none,prior_unmodelled,theta,theta_unmodelled,min_support,min_support_none,delta_sep,eig_floor,default_budget,k_max,w_sound,w_stretch)
    VALUES ('bad',repeat('d',64),0.1,0.3,0.25,0.05,0.6,0.3,3,3,0.05,0.01,8,8,1.0,0.5)$q$);
SELECT pg_temp.expect_fail('N47 engine params with guess >= 0.5 (P1)',
 $q$INSERT INTO sonder.engine_params (params_version,params_sha256,slip,guess,prior_none,prior_unmodelled,theta,theta_unmodelled,min_support,min_support_none,delta_sep,eig_floor,default_budget,k_max,w_sound,w_stretch)
    VALUES ('bad2',repeat('e',64),0.1,0.5,0.25,0.05,0.8,0.5,3,3,0.05,0.01,8,8,1.0,0.5)$q$);
SELECT pg_temp.expect_fail('N48 engine params with min_support_none < min_support (P4)',
 $q$INSERT INTO sonder.engine_params (params_version,params_sha256,slip,guess,prior_none,prior_unmodelled,theta,theta_unmodelled,min_support,min_support_none,delta_sep,eig_floor,default_budget,k_max,w_sound,w_stretch)
    VALUES ('bad3',repeat('f',64),0.1,0.3,0.25,0.05,0.8,0.5,3,2,0.05,0.01,8,8,1.0,0.5)$q$);
BEGIN;
INSERT INTO engine_params (id,params_version,params_sha256,slip,guess,prior_none,prior_unmodelled,theta,theta_unmodelled,min_support,min_support_none,delta_sep,eig_floor,default_budget,k_max,w_sound,w_stretch)
 VALUES ('00000000-0000-0000-0000-000000000099','params-v1',repeat('c',64),0.10,0.20,0.25,0.05,0.80,0.50,3,3,0.05,0.01,8,8,1.0,0.5);
INSERT INTO response_model (id,content_version_id,engine_params_id,model_code,source,calibration_note) VALUES
 ('00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000099','prior-v1','prior','Assumed slip/guess; not calibrated');
INSERT INTO response_parameter (response_model_id,hypothesis_id,slip,guess)
 SELECT '00000000-0000-0000-0000-000000000095', id, 0.1, 0.3 FROM hypothesis WHERE content_version_id = '00000000-0000-0000-0000-000000000031';
INSERT INTO response_probability (response_model_id,hypothesis_id,option_id,probability)
 SELECT '00000000-0000-0000-0000-000000000095', h.id, o.id, w.weight / sum(w.weight) OVER (PARTITION BY o.item_id, h.id)
 FROM hypothesis h CROSS JOIN item_option o
 CROSS JOIN LATERAL (SELECT CASE
     WHEN h.kind = 'none' AND o.is_correct THEN 9.0
     WHEN h.kind = 'misconception' AND EXISTS (SELECT 1 FROM option_misconception m WHERE m.option_id = o.id AND m.misconception_revision_id = h.misconception_revision_id) THEN 7.0
     ELSE 1.0 END AS weight) w
 WHERE h.content_version_id = '00000000-0000-0000-0000-000000000031';
COMMIT;
SELECT pg_temp.expect_fail('N23 freeze a response model with a non-normalised distribution',
 $q$DO $d$ BEGIN
   UPDATE sonder.response_probability SET probability = probability + 0.01 WHERE option_id = '00000000-0000-0000-0000-00000000007a' AND hypothesis_id = '00000000-0000-0000-0000-000000000093';
   UPDATE sonder.response_model SET status = 'frozen' WHERE id = '00000000-0000-0000-0000-000000000095';
 END $d$$q$);
CREATE OR REPLACE FUNCTION pg_temp.try_model(ver text, guess numeric, kmax integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE ep uuid := gen_random_uuid(); rm uuid := gen_random_uuid();
BEGIN
 INSERT INTO sonder.engine_params (id,params_version,params_sha256,slip,guess,prior_none,prior_unmodelled,theta,theta_unmodelled,min_support,min_support_none,delta_sep,eig_floor,default_budget,k_max,w_sound,w_stretch)
 VALUES (ep,ver,encode(sha256(convert_to(ver,'UTF8')),'hex'),0.10,guess,0.25,0.05,0.80,0.50,3,3,0.05,0.01,8,kmax,1.0,0.5);
 INSERT INTO sonder.response_model (id,content_version_id,engine_params_id,model_code,source,calibration_note) VALUES (rm,'00000000-0000-0000-0000-000000000031',ep,ver,'prior','test');
 INSERT INTO sonder.response_probability (response_model_id,hypothesis_id,option_id,probability)
 SELECT rm, hypothesis_id, option_id, probability FROM sonder.response_probability WHERE response_model_id = '00000000-0000-0000-0000-000000000095';
 UPDATE sonder.response_model SET status = 'frozen' WHERE id = rm;
END $$;
SELECT pg_temp.expect_fail('N68 P1: guess 0.30 with a misconception on three options of a unit item',
 $q$SELECT pg_temp.try_model('p1-test',0.30,8)$q$);
SELECT pg_temp.expect_fail('N69 k_max smaller than the largest unit',
 $q$SELECT pg_temp.try_model('kmax-test',0.20,2)$q$);
UPDATE response_model SET status = 'frozen' WHERE id = '00000000-0000-0000-0000-000000000095';
INSERT INTO engine_release (id,release_code,code_hash,selection_policy)
 VALUES ('00000000-0000-0000-0000-000000000096','engine-0.1.0',repeat('c',40),'max EIG rounded to 1e-9; ties -> pack order');
SELECT pg_temp.expect_fail('N49 change engine params after use',
 $q$UPDATE sonder.engine_params SET theta = 0.9 WHERE id = '00000000-0000-0000-0000-000000000099'$q$);

-- Helper: start a run with ordered slots (M1, M2, M3, NONE, UNMODELLED) and spec priors, show one item
-- with a candidate ranking whose rank 1 is that item. Used by several cases below.
CREATE OR REPLACE FUNCTION pg_temp.start_run(sid uuid, rkey text, first_item uuid, extra_candidates uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE qid uuid := gen_random_uuid(); c uuid; r integer := 1;
BEGIN
 INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key)
 VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d1',3,rkey);
 INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
  (sid,'00000000-0000-0000-0000-000000000091',0,0.7/3),(sid,'00000000-0000-0000-0000-000000000092',1,0.7/3),
  (sid,'00000000-0000-0000-0000-000000000098',2,0.7/3),(sid,'00000000-0000-0000-0000-000000000093',3,0.25),
  (sid,'00000000-0000-0000-0000-000000000094',4,0.05);
 INSERT INTO sonder.session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig)
 VALUES (qid,sid,0,first_item,'max expected information gain',2.0,0.5);
 INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES (qid,first_item,1,0.5);
 FOREACH c IN ARRAY extra_candidates LOOP
  r := r + 1;
  INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES (qid,c,r,0.5 - 0.1*r);
 END LOOP;
 RETURN qid;
END $$;

-- ================================================================ P6 diagnosed run with ranking, notes, support
BEGIN;
SELECT pg_temp.start_run('00000000-0000-0000-0001-000000000001','start-1','00000000-0000-0000-0000-000000000071',
  ARRAY['00000000-0000-0000-0000-000000000072','00000000-0000-0000-0000-000000000074','00000000-0000-0000-0000-000000000073']::uuid[]);
COMMIT;
SELECT pg_temp.expect_fail('N24 present a second question while the first is unanswered',
 $q$INSERT INTO sonder.session_question (session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES ('00000000-0000-0000-0001-000000000001',0,'00000000-0000-0000-0000-000000000072','x',1,0.1)$q$);
SELECT pg_temp.expect_fail('N25 answer with an option from a different item',
 $q$INSERT INTO sonder.session_step (session_id,step_index,session_question_id,answer_option_id,request_key,calculation_ms,answer_note) SELECT '00000000-0000-0000-0001-000000000001',0,id,'00000000-0000-0000-0000-00000000008a','ans-x',3,'x' FROM sonder.session_question WHERE session_id = '00000000-0000-0000-0001-000000000001'$q$);
SELECT pg_temp.expect_fail('N26 posterior that does not sum to 1',
 $q$DO $d$ DECLARE st uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.session_step (id,session_id,step_index,session_question_id,answer_option_id,request_key,calculation_ms,answer_note) SELECT st,'00000000-0000-0000-0001-000000000001',0,id,'00000000-0000-0000-0000-00000000007b','ans-bad',3,'note' FROM sonder.session_question WHERE session_id = '00000000-0000-0000-0001-000000000001';
   INSERT INTO sonder.step_posterior (step_id,session_hypothesis_id,probability) SELECT st, id, 0.3 FROM sonder.session_hypothesis WHERE session_id = '00000000-0000-0000-0001-000000000001';
 END $d$$q$);
SELECT pg_temp.expect_fail('N27 add a prior after the first question',
 $q$INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES ('00000000-0000-0000-0001-000000000001','00000000-0000-0000-0000-000000000091',9,0)$q$);
SELECT pg_temp.expect_fail('N50 blank answer note',
 $q$DO $d$ DECLARE st uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.session_step (id,session_id,step_index,session_question_id,answer_option_id,request_key,calculation_ms,answer_note) SELECT st,'00000000-0000-0000-0001-000000000001',0,id,'00000000-0000-0000-0000-00000000007b','ans-blank',3,'  ' FROM sonder.session_question WHERE session_id = '00000000-0000-0000-0001-000000000001';
 END $d$$q$);

BEGIN;
INSERT INTO session_step (id,session_id,step_index,session_question_id,answer_option_id,request_key,calculation_ms,answer_note)
 SELECT '00000000-0000-0000-0001-000000000031','00000000-0000-0000-0001-000000000001',0,id,'00000000-0000-0000-0000-00000000007b','ans-1',4.2,
        'Answer B (2/5) is linked to M1. M1 now 0.600.' FROM session_question WHERE session_id = '00000000-0000-0000-0001-000000000001' AND step_index = 0;
INSERT INTO step_posterior (step_id,session_hypothesis_id,probability)
 SELECT '00000000-0000-0000-0001-000000000031', id, CASE slot WHEN 0 THEN 0.6 WHEN 1 THEN 0.1 WHEN 2 THEN 0.1 WHEN 3 THEN 0.1 ELSE 0.1 END
 FROM session_hypothesis WHERE session_id = '00000000-0000-0000-0001-000000000001';
INSERT INTO session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES
 ('00000000-0000-0000-0001-000000000022','00000000-0000-0000-0001-000000000001',1,'00000000-0000-0000-0000-000000000072','max expected information gain',1.57,0.33);
INSERT INTO question_candidate (session_question_id,item_id,rank,eig) VALUES
 ('00000000-0000-0000-0001-000000000022','00000000-0000-0000-0000-000000000072',1,0.33),
 ('00000000-0000-0000-0001-000000000022','00000000-0000-0000-0000-000000000074',2,0.20);
COMMIT;
SELECT pg_temp.expect_fail('N51 candidate that is a twin of an item already shown',
 $q$INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES ('00000000-0000-0000-0001-000000000022','00000000-0000-0000-0000-000000000073',3,0.1)$q$);
SELECT pg_temp.expect_fail('N52 candidate that was already shown earlier',
 $q$INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES ('00000000-0000-0000-0001-000000000022','00000000-0000-0000-0000-000000000071',3,0.1)$q$);
SELECT pg_temp.expect_fail('N28 answer that reuses an earlier request key (idempotency)',
 $q$INSERT INTO sonder.session_step (session_id,step_index,session_question_id,answer_option_id,request_key,calculation_ms,answer_note) VALUES ('00000000-0000-0000-0001-000000000001',1,'00000000-0000-0000-0001-000000000022','00000000-0000-0000-0000-00000000008a','ans-1',3,'n')$q$);
SELECT pg_temp.expect_fail('N53 candidate ranking that increases in EIG',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); q uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'rising-eig');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
    (sid,'00000000-0000-0000-0000-000000000091',0,0.35),(sid,'00000000-0000-0000-0000-000000000092',1,0.35),(sid,'00000000-0000-0000-0000-000000000093',2,0.25),(sid,'00000000-0000-0000-0000-000000000094',3,0.05);
   INSERT INTO sonder.session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (q,sid,0,'00000000-0000-0000-0000-000000000071','x',2,0.5);
   INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES (q,'00000000-0000-0000-0000-000000000071',1,0.5),(q,'00000000-0000-0000-0000-000000000072',2,0.9);
 END $d$$q$);
SELECT pg_temp.expect_fail('N63 alter a recorded candidate ranking',
 $q$UPDATE sonder.question_candidate SET eig = 0.9 WHERE session_question_id = '00000000-0000-0000-0001-000000000022'$q$);
BEGIN;
INSERT INTO session_step (id,session_id,step_index,session_question_id,answer_option_id,request_key,calculation_ms,answer_note) VALUES
 ('00000000-0000-0000-0001-000000000032','00000000-0000-0000-0001-000000000001',1,'00000000-0000-0000-0001-000000000022','00000000-0000-0000-0000-00000000008b','ans-2',3.9,
  'Answer B (1/2) is correct. M1 now 0.850.');
INSERT INTO step_posterior (step_id,session_hypothesis_id,probability)
 SELECT '00000000-0000-0000-0001-000000000032', id, CASE slot WHEN 0 THEN 0.85 ELSE 0.0375 END
 FROM session_hypothesis WHERE session_id = '00000000-0000-0000-0001-000000000001';
COMMIT;
SELECT pg_temp.expect_fail('N54 present the twin of an item already shown in this run',
 $q$DO $d$ DECLARE q uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (q,'00000000-0000-0000-0001-000000000001',2,'00000000-0000-0000-0000-000000000073','x',1,0.1);
 END $d$$q$);
SELECT pg_temp.check('P43 step_support view: M1 support 1 after step 0; NONE support 1 after step 1',
  (SELECT support FROM step_support WHERE step_id = '00000000-0000-0000-0001-000000000031' AND slot = 0) = 1
  AND (SELECT support FROM step_support WHERE step_id = '00000000-0000-0000-0001-000000000031' AND slot = 3) = 0
  AND (SELECT support FROM step_support WHERE step_id = '00000000-0000-0000-0001-000000000032' AND slot = 3) = 1
  AND (SELECT support FROM step_support WHERE step_id = '00000000-0000-0000-0001-000000000032' AND slot = 0) = 1);
SELECT pg_temp.expect_fail('N29 rewrite a stored answer',
 $q$UPDATE sonder.session_step SET answer_option_id = '00000000-0000-0000-0000-00000000007a' WHERE id = '00000000-0000-0000-0001-000000000031'$q$);
SELECT pg_temp.expect_fail('N30 mark diagnosed without a diagnosis row',
 $q$UPDATE sonder.diagnostic_session SET status = 'diagnosed', ended_at = now() WHERE id = '00000000-0000-0000-0001-000000000001'$q$);
BEGIN;
UPDATE diagnostic_session SET status = 'diagnosed', ended_at = now() WHERE id = '00000000-0000-0000-0001-000000000001';
INSERT INTO diagnosis (id,session_id) VALUES ('00000000-0000-0000-0001-000000000041','00000000-0000-0000-0001-000000000001');
INSERT INTO diagnosis_candidate (diagnosis_id,session_hypothesis_id,rank)
 SELECT '00000000-0000-0000-0001-000000000041', id, slot + 1 FROM session_hypothesis WHERE session_id = '00000000-0000-0000-0001-000000000001' AND slot IN (0,1);
COMMIT;
SELECT pg_temp.expect_fail('N31 reopen a finished session',
 $q$UPDATE sonder.diagnostic_session SET status = 'in_progress', ended_at = NULL WHERE id = '00000000-0000-0000-0001-000000000001'$q$);
SELECT pg_temp.expect_fail('N32 question in a finished session',
 $q$INSERT INTO sonder.session_question (session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES ('00000000-0000-0000-0001-000000000001',2,'00000000-0000-0000-0000-000000000074','x',1,0.1)$q$);

-- ================================================================ slot, prior and ranking checks on new runs
SELECT pg_temp.expect_fail('N55 duplicate hypothesis slot in a run',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'dup-slot');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES (sid,'00000000-0000-0000-0000-000000000091',0,0.35),(sid,'00000000-0000-0000-0000-000000000092',0,0.35);
 END $d$$q$);
SELECT pg_temp.expect_fail('N56 NONE placed before the misconceptions (slot order)',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); q uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'bad-order');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
    (sid,'00000000-0000-0000-0000-000000000093',0,0.25),(sid,'00000000-0000-0000-0000-000000000091',1,0.35),(sid,'00000000-0000-0000-0000-000000000092',2,0.35),(sid,'00000000-0000-0000-0000-000000000094',3,0.05);
   INSERT INTO sonder.session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (q,sid,0,'00000000-0000-0000-0000-000000000071','x',2,0.5);
   INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES (q,'00000000-0000-0000-0000-000000000071',1,0.5);
 END $d$$q$);
SELECT pg_temp.expect_fail('N57 NONE prior differs from the pinned engine parameters',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); q uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'bad-prior');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
    (sid,'00000000-0000-0000-0000-000000000091',0,0.3),(sid,'00000000-0000-0000-0000-000000000092',1,0.3),(sid,'00000000-0000-0000-0000-000000000093',2,0.35),(sid,'00000000-0000-0000-0000-000000000094',3,0.05);
   INSERT INTO sonder.session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (q,sid,0,'00000000-0000-0000-0000-000000000071','x',2,0.5);
   INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES (q,'00000000-0000-0000-0000-000000000071',1,0.5);
 END $d$$q$);
SELECT pg_temp.expect_fail('N70 run shows an item that is not in its unit',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'out-of-unit');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
    (sid,'00000000-0000-0000-0000-000000000091',0,0.35),(sid,'00000000-0000-0000-0000-000000000092',1,0.35),(sid,'00000000-0000-0000-0000-000000000093',2,0.25),(sid,'00000000-0000-0000-0000-000000000094',3,0.05);
   INSERT INTO sonder.session_question (session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (sid,0,'00000000-0000-0000-0000-000000000074','x',2,0.5);
 END $d$$q$);
SELECT pg_temp.expect_fail('N71 run prior for a misconception outside its unit',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'foreign-hyp');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES (sid,'00000000-0000-0000-0000-000000000098',0,0.35);
 END $d$$q$);
SELECT pg_temp.expect_fail('N72 run that omits one of its unit''s hypotheses',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); q uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d1',3,'short-list');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
    (sid,'00000000-0000-0000-0000-000000000091',0,0.35),(sid,'00000000-0000-0000-0000-000000000092',1,0.35),(sid,'00000000-0000-0000-0000-000000000093',2,0.25),(sid,'00000000-0000-0000-0000-000000000094',3,0.05);
   INSERT INTO sonder.session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (q,sid,0,'00000000-0000-0000-0000-000000000071','x',2,0.5);
   INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES (q,'00000000-0000-0000-0000-000000000071',1,0.5);
 END $d$$q$);
SELECT pg_temp.expect_fail('N58 question without a candidate ranking',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'no-rank');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
    (sid,'00000000-0000-0000-0000-000000000091',0,0.35),(sid,'00000000-0000-0000-0000-000000000092',1,0.35),(sid,'00000000-0000-0000-0000-000000000093',2,0.25),(sid,'00000000-0000-0000-0000-000000000094',3,0.05);
   INSERT INTO sonder.session_question (session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (sid,0,'00000000-0000-0000-0000-000000000071','x',2,0.5);
 END $d$$q$);
SELECT pg_temp.expect_fail('N59 rank-1 candidate is not the presented item',
 $q$DO $d$ DECLARE sid uuid := gen_random_uuid(); q uuid := gen_random_uuid(); BEGIN
   INSERT INTO sonder.diagnostic_session (id,enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES (sid,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',3,'wrong-rank1');
   INSERT INTO sonder.session_hypothesis (session_id,hypothesis_id,slot,prior_probability) VALUES
    (sid,'00000000-0000-0000-0000-000000000091',0,0.35),(sid,'00000000-0000-0000-0000-000000000092',1,0.35),(sid,'00000000-0000-0000-0000-000000000093',2,0.25),(sid,'00000000-0000-0000-0000-000000000094',3,0.05);
   INSERT INTO sonder.session_question (id,session_id,step_index,item_id,selection_reason,entropy_before,expected_ig) VALUES (q,sid,0,'00000000-0000-0000-0000-000000000071','x',2,0.5);
   INSERT INTO sonder.question_candidate (session_question_id,item_id,rank,eig) VALUES (q,'00000000-0000-0000-0000-000000000072',1,0.5),(q,'00000000-0000-0000-0000-000000000071',2,0.4);
 END $d$$q$);

-- ================================================================ P7 refusals: three-way tie stored; bad tie sets rejected
-- refuse(sid, key, n_candidates, leader_in_set): one answer on the three-link item, then a no-separator refusal.
CREATE OR REPLACE FUNCTION pg_temp.refuse(sid uuid, rkey text, n_cand integer, leader_in_set boolean, lead_override uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE qid uuid; st uuid := gen_random_uuid(); e uuid := gen_random_uuid(); lead uuid;
BEGIN
 qid := pg_temp.start_run(sid, rkey, '00000000-0000-0000-0000-000000000074');
 INSERT INTO sonder.session_step (id,session_id,step_index,session_question_id,answer_option_id,request_key,calculation_ms,answer_note)
 VALUES (st,sid,0,qid,'00000000-0000-0000-0000-000000000f41','ans-1',4,'Answer A (3 1/4) is linked to M1, M2, M3.');
 INSERT INTO sonder.step_posterior (step_id,session_hypothesis_id,probability)
 SELECT st, id, CASE WHEN slot < 3 THEN 0.3 ELSE 0.05 END FROM sonder.session_hypothesis WHERE session_id = sid;
 UPDATE sonder.diagnostic_session SET status = 'escalated_no_separator', ended_at = now() WHERE id = sid;
 SELECT id INTO lead FROM sonder.session_hypothesis WHERE session_id = sid AND slot = CASE WHEN leader_in_set THEN 0 ELSE 3 END;
 lead := coalesce(lead_override, lead);
 INSERT INTO sonder.escalation (id,session_id,reason,leader_session_hypothesis_id) VALUES (e,sid,'M1, M2 and M3 tied; no remaining item separates them',lead);
 INSERT INTO sonder.escalation_candidate (escalation_id,session_hypothesis_id,rank)
 SELECT e, id, slot + 1 FROM sonder.session_hypothesis WHERE session_id = sid AND slot < n_cand;
END $$;
BEGIN;
SELECT pg_temp.refuse('00000000-0000-0000-0002-000000000001','start-2',3,true);
COMMIT;
SELECT pg_temp.check('P44 three-way no-separator refusal stored with its leader',
  (SELECT count(*) FROM escalation_candidate c JOIN escalation e ON e.id = c.escalation_id WHERE e.session_id = '00000000-0000-0000-0002-000000000001') = 3);
SELECT pg_temp.expect_fail('N60 no-separator refusal with a single candidate',
 $q$SELECT pg_temp.refuse('00000000-0000-0000-0002-0000000000a1','start-x1',1,true)$q$);
SELECT pg_temp.expect_fail('N61 refusal leader not in the tied set',
 $q$SELECT pg_temp.refuse('00000000-0000-0000-0002-0000000000a2','start-x2',3,false)$q$);
SELECT pg_temp.expect_fail('N62 escalation leader from another session',
 $q$SELECT pg_temp.refuse('00000000-0000-0000-0002-0000000000a3','start-x3',3,true,
    (SELECT id FROM sonder.session_hypothesis WHERE session_id = '00000000-0000-0000-0001-000000000001' AND slot = 0))$q$);
-- Ceiling is derived, not stored: p(leader) / p(tied set) from the last posterior.
SELECT pg_temp.check('P45 ceiling derives to 1/3 for the three-way tie',
  abs((SELECT max(p.probability) FILTER (WHERE sh.id = e.leader_session_hypothesis_id) / sum(p.probability)
       FROM escalation e JOIN escalation_candidate c ON c.escalation_id = e.id
       JOIN session_hypothesis sh ON sh.id = c.session_hypothesis_id
       JOIN step_posterior p ON p.session_hypothesis_id = sh.id
       WHERE e.session_id = '00000000-0000-0000-0002-000000000001') - 1.0/3) < 1e-9);

BEGIN;
SELECT pg_temp.start_run('00000000-0000-0000-0003-000000000001','start-3','00000000-0000-0000-0000-000000000072');
UPDATE diagnostic_session SET status = 'abandoned', ended_at = now() WHERE id = '00000000-0000-0000-0003-000000000001';
COMMIT;
SELECT pg_temp.check('P46 abandoned run keeps its pending question', (SELECT count(*) FROM session_question WHERE session_id = '00000000-0000-0000-0003-000000000001') = 1);

-- ================================================================ class / context checks (unchanged rules)
SELECT pg_temp.expect_fail('N33 Math run in a class that does not teach Math',
 $q$INSERT INTO sonder.diagnostic_session (enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-000000000095','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',5,'x')$q$);
SELECT pg_temp.expect_fail('N34 enrol a teacher account as a student',
 $q$INSERT INTO sonder.enrolment (class_id,student_id) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000b1')$q$);
SELECT pg_temp.expect_fail('N35 enrol the same student twice in one class',
 $q$INSERT INTO sonder.enrolment (class_id,student_id) VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000c1')$q$);
SELECT pg_temp.expect_fail('N36 join an archived class',
 $q$DO $d$ BEGIN
   UPDATE sonder.classroom SET status = 'archived' WHERE id = '00000000-0000-0000-0000-000000000022';
   INSERT INTO sonder.enrolment (class_id,student_id) VALUES ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-0000000000c2');
 END $d$$q$);
SELECT pg_temp.expect_fail('N37 lower-case or short join code',
 $q$INSERT INTO sonder.classroom (name,join_code) VALUES ('x','abc')$q$);
SELECT pg_temp.expect_fail('N38 change a user''s role',
 $q$UPDATE sonder.app_user SET role = 'teacher' WHERE id = '00000000-0000-0000-0000-0000000000c1'$q$);
SELECT pg_temp.expect_fail('N39 run against a draft (unfrozen) response model',
 $q$DO $d$ BEGIN
   INSERT INTO sonder.response_model (id,content_version_id,engine_params_id,model_code,source,calibration_note) VALUES ('00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000099','draft-model','prior','x');
   INSERT INTO sonder.diagnostic_session (enrolment_id,response_model_id,engine_release_id,unit_id,question_budget,request_key) VALUES ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000f9','00000000-0000-0000-0000-000000000096','00000000-0000-0000-0000-0000000000d2',5,'y');
 END $d$$q$);
SELECT pg_temp.expect_fail('N40 delete audit history',
 $q$DELETE FROM sonder.audit_event$q$);

SELECT pg_temp.check('P47 audit recorded the pack and response-model freezes',
  (SELECT count(*) FROM audit_event WHERE event_type = 'frozen') = 2);
