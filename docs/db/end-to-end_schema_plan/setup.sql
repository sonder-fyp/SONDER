-- Single entry point for the complete Sonder schema, including pgvector.
-- Run with psql, from the repository root, against the approved working branch:
--   psql -X --set=EMBEDDING_DIMENSION=<chosen_integer> --file=docs/db/setup.sql
-- Supply connection details through your normal secure psql configuration.
-- Replace <chosen_integer> with the chosen embedding model's actual dimension.
-- This is a psql script: relative includes are resolved against THIS file.
-- Keep the numbered files alongside it; they remain the authoritative DDL.
-- No database/project creation, application grants, model rows or content import.
-- Each tier commits independently. A later failure leaves earlier tiers applied.
-- Do not wrap this script in --single-transaction: tiers own their transactions.
-- Identical reruns are supported where practical; this does not migrate drift.
\set ON_ERROR_STOP on

-- Fail before schema creation if vector configuration is missing or unsuitable.
\if :{?EMBEDDING_DIMENSION}
\else
  \set EMBEDDING_DIMENSION ''
\endif
SELECT set_config('sonder.embedding_dimension', :'EMBEDDING_DIMENSION', false);
SET TIME ZONE 'UTC';
DO $$
DECLARE
 chosen_dimension integer;
 existing_dimension integer;
BEGIN
 IF current_setting('server_version_num')::integer < 160000 THEN
  RAISE EXCEPTION 'Sonder requires PostgreSQL 16 or newer';
 END IF;
 IF coalesce(current_setting('sonder.embedding_dimension', true), '') !~ '^[0-9]{1,4}$' THEN
  RAISE EXCEPTION 'Supply EMBEDDING_DIMENSION as the chosen model dimension (integer 1..2000)';
 END IF;
 chosen_dimension := current_setting('sonder.embedding_dimension')::integer;
 IF chosen_dimension NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'EMBEDDING_DIMENSION must be 1..2000 for this vector HNSW design';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
  RAISE EXCEPTION 'The vector extension must be available before complete setup';
 END IF;
 IF to_regprocedure('sonder.embedding_dimension()') IS NOT NULL THEN
  EXECUTE 'SELECT sonder.embedding_dimension()' INTO existing_dimension;
  IF existing_dimension <> chosen_dimension THEN
   RAISE EXCEPTION 'Dimension change requires an expand/contract migration, not setup rerun';
  END IF;
 END IF;
END $$;

\echo Applying core schema
\ir 01_core.sql
SET sonder.verify_through_tier = '1';
\ir 99_verify.sql

\echo Applying learning schema
\ir 02_learning.sql
SET sonder.verify_through_tier = '2';
\ir 99_verify.sql

\echo Applying messaging schema
\ir 03_messaging.sql
SET sonder.verify_through_tier = '3';
\ir 99_verify.sql

\echo Applying AI, trust and evaluation schema
\ir 04_ai_trust.sql
SET sonder.verify_through_tier = '4';
\ir 99_verify.sql

\echo Applying vector schema
\ir 05_vectors.sql
SET sonder.verify_through_tier = '5';
\ir 99_verify.sql

\echo Complete schema applied; all five structural verification stages passed.
-- Structural verification is not a substitute for later behavioral testing.
