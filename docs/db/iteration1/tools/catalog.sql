SELECT json_build_object(
 'tables', (SELECT json_agg(json_build_object('name', c.relname, 'oid', c.oid,
   'columns', (SELECT json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
        'notnull', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
   'constraints', (SELECT json_agg(json_build_object('name', k.conname, 'type', k.contype, 'def', pg_get_constraintdef(k.oid),
        'cols', (SELECT json_agg(att.attname ORDER BY u.ord) FROM unnest(k.conkey) WITH ORDINALITY u(n, ord) JOIN pg_attribute att ON att.attrelid = k.conrelid AND att.attnum = u.n),
        'ref_table', (SELECT relname FROM pg_class WHERE oid = k.confrelid),
        'ref_cols', (SELECT json_agg(att.attname ORDER BY u.ord) FROM unnest(k.confkey) WITH ORDINALITY u(n, ord) JOIN pg_attribute att ON att.attrelid = k.confrelid AND att.attnum = u.n),
        'on_delete', k.confdeltype) ORDER BY k.contype, k.conname)
      FROM pg_constraint k WHERE k.conrelid = c.oid),
   'indexes', (SELECT json_agg(json_build_object('name', i.relname, 'def', pg_get_indexdef(i.oid)) ORDER BY i.relname)
      FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
      WHERE x.indrelid = c.oid AND NOT x.indisprimary AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.oid)),
   'triggers', (SELECT json_agg(json_build_object('name', g.tgname, 'def', pg_get_triggerdef(g.oid)) ORDER BY g.tgname)
      FROM pg_trigger g WHERE g.tgrelid = c.oid AND NOT g.tgisinternal)
   ) ORDER BY c.oid)
  FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = 'sonder' AND c.relkind = 'r'));
