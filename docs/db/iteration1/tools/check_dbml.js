// Parse the DBML with @dbml/core and export it to PostgreSQL DDL, as a syntax check.
// @dbml/core is NOT a repo dependency: install it outside the repo and point NODE_PATH at it, e.g.
//   mkdir /tmp/dbml && cd /tmp/dbml && npm i @dbml/core@10.3.1
//   NODE_PATH=/tmp/dbml/node_modules node docs/db/iteration1/tools/check_dbml.js docs/db/iteration1/sonder_iteration1.dbml
const { Parser, exporter } = require('@dbml/core');
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const db = new Parser().parse(src, 'dbmlv2');
let tables = 0, cols = 0;
for (const s of db.schemas) for (const t of s.tables) { tables++; cols += t.fields.length; }
const sql = exporter.export(src, 'postgres');
console.log(`parsed OK: ${tables} tables, ${cols} columns; exported DDL has ${(sql.match(/CREATE TABLE/g) || []).length} CREATE TABLE and ${(sql.match(/FOREIGN KEY/g) || []).length} FOREIGN KEY`);
