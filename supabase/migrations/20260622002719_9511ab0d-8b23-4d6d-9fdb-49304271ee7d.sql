DROP INDEX IF EXISTS public.document_embeddings_file_chunk_version_unique;

CREATE UNIQUE INDEX document_embeddings_file_chunk_version_unique
  ON public.document_embeddings (file_id, chunk_index, embedding_version, model_name);