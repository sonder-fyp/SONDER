-- LATE REVISION: decide exact model + dimension before executing this file.
-- Set sonder.embedding_dimension on THIS connection before applying; no default is guessed.
-- Example syntax (value intentionally a placeholder): SET sonder.embedding_dimension = '<chosen integer>';
BEGIN;
SET LOCAL search_path = sonder, public;
CREATE EXTENSION IF NOT EXISTS vector;
DO $$
DECLARE
 EMBEDDING_DIMENSION CONSTANT integer := nullif(current_setting('sonder.embedding_dimension',true),'')::integer;
 existing_dimension integer;
BEGIN
 IF EMBEDDING_DIMENSION IS NULL OR EMBEDDING_DIMENSION NOT BETWEEN 1 AND 2000 THEN
  RAISE EXCEPTION 'Choose/set EMBEDDING_DIMENSION (1..2000 for vector HNSW) before tier 5';
 END IF;
 IF to_regprocedure('sonder.embedding_dimension()') IS NOT NULL THEN
  EXECUTE 'SELECT sonder.embedding_dimension()' INTO existing_dimension;
  IF existing_dimension<>EMBEDDING_DIMENSION THEN RAISE EXCEPTION 'Dimension change requires expand/contract migration, not rerunning tier 5'; END IF;
 END IF;
 EXECUTE format('CREATE OR REPLACE FUNCTION sonder.embedding_dimension() RETURNS integer LANGUAGE sql IMMUTABLE AS %L', 'SELECT '||EMBEDDING_DIMENSION);
 EXECUTE format('CREATE TABLE IF NOT EXISTS item_embedding (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES item ON DELETE RESTRICT,
 model_id uuid NOT NULL REFERENCES ai_model ON DELETE RESTRICT,
 text_hash text NOT NULL CHECK(text_hash ~ %L), indexed_at timestamptz NOT NULL DEFAULT now(),
 embedding vector(%s) NOT NULL CHECK(vector_norm(embedding)>0), UNIQUE(item_id,model_id))', '^[0-9a-f]{64}$',EMBEDDING_DIMENSION);
 EXECUTE format('CREATE TABLE IF NOT EXISTS concept_chunk_embedding (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chunk_id uuid NOT NULL REFERENCES concept_doc_chunk ON DELETE RESTRICT,
 model_id uuid NOT NULL REFERENCES ai_model ON DELETE RESTRICT,
 text_hash text NOT NULL CHECK(text_hash ~ %L), indexed_at timestamptz NOT NULL DEFAULT now(),
 embedding vector(%s) NOT NULL CHECK(vector_norm(embedding)>0), UNIQUE(chunk_id,model_id))', '^[0-9a-f]{64}$',EMBEDDING_DIMENSION);
END $$;
CREATE OR REPLACE FUNCTION embedding_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, sonder AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM ai_model WHERE id=NEW.model_id AND kind='embedding') THEN RAISE EXCEPTION 'Embedding model kind required'; END IF;
 IF TG_TABLE_NAME='item_embedding' THEN
  IF NOT EXISTS(SELECT 1 FROM item i JOIN topic_revision t ON t.id=i.topic_revision_id JOIN content_version c ON c.id=t.content_version_id WHERE i.id=NEW.item_id AND i.review_status='approved' AND c.status='frozen') THEN RAISE EXCEPTION 'Only approved frozen exemplars'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM concept_doc_chunk c JOIN concept_doc_approval a ON a.concept_doc_id=c.concept_doc_id WHERE c.id=NEW.chunk_id) THEN RAISE EXCEPTION 'Only approved tutor corpus'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON item_embedding FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE OR REPLACE TRIGGER immutable BEFORE UPDATE OR DELETE ON concept_chunk_embedding FOR EACH ROW EXECUTE FUNCTION reject_mutation();
CREATE OR REPLACE TRIGGER embedding_scope BEFORE INSERT ON item_embedding FOR EACH ROW EXECUTE FUNCTION embedding_guard();
CREATE OR REPLACE TRIGGER embedding_scope BEFORE INSERT ON concept_chunk_embedding FOR EACH ROW EXECUTE FUNCTION embedding_guard();
CREATE INDEX IF NOT EXISTS item_embedding_model_idx ON item_embedding(model_id,item_id);
CREATE INDEX IF NOT EXISTS chunk_embedding_model_idx ON concept_chunk_embedding(model_id,chunk_id);
CREATE INDEX IF NOT EXISTS item_embedding_hnsw ON item_embedding USING hnsw(embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunk_embedding_hnsw ON concept_chunk_embedding USING hnsw(embedding vector_cosine_ops);
-- Both uses of item retrieval share one index. Resource Finder has NO persisted vectors.
REVOKE ALL ON ALL TABLES IN SCHEMA sonder FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sonder FROM PUBLIC;
COMMIT;
