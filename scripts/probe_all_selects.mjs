process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://phhrulzeaomqsvrregpc.supabase.co';
const supabaseAnonKey = 'sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const srcDir = path.resolve('src');

function getAllFiles(dir, exts) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) results = results.concat(getAllFiles(fullPath, exts));
    else if (exts.some(ext => file.endsWith(ext))) results.push(fullPath);
  }
  return results;
}

const files = getAllFiles(srcDir, ['.ts', '.tsx']);

// 1. Collect all .select(...) strings with their table
const selectQueries = []; // { file, line, table, selectArg }

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // match from('tableName')...select('...')
    const regex = /from\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)[\s\S]*?\.select\(\s*['"`]([^'"`]+)['"`]/g;
    // or look across a small window
    const windowText = lines.slice(i, Math.min(lines.length, i + 8)).join(' ');
    let m;
    while ((m = regex.exec(windowText)) !== null) {
      selectQueries.push({
        file: path.relative(process.cwd(), f),
        line: i + 1,
        table: m[1],
        selectArg: m[2]
      });
      break; // one per window
    }
  }
}

// Deduplicate by table + selectArg
const uniqueSelects = new Map();
for (const q of selectQueries) {
  const key = `${q.table}:::${q.selectArg}`;
  if (!uniqueSelects.has(key)) {
    uniqueSelects.set(key, q);
  }
}

console.log(`=== AUDITING ${uniqueSelects.size} UNIQUE SELECT QUERIES AGAINST LIVE DB ===\n`);

async function testSelects() {
  let errors = 0;
  for (const [key, q] of uniqueSelects.entries()) {
    try {
      const { data, error } = await supabase
        .from(q.table)
        .select(q.selectArg)
        .limit(0);

      if (error) {
        console.error(`🚨 SELECT ERROR on Table [${q.table}]:`);
        console.error(`   Query: .select("${q.selectArg}")`);
        console.error(`   Location: ${q.file}:${q.line}`);
        console.error(`   Error: ${error.code} - ${error.message}`);
        errors++;
      } else {
        // success
      }
    } catch (e) {
      console.error(`💥 Exception on [${q.table}].select("${q.selectArg}"):`, e.message);
      errors++;
    }
  }
  console.log(`\nSelect Query Audit Completed. Total queries tested: ${uniqueSelects.size}, Errors found: ${errors}`);
}

testSelects();
