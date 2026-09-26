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
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      if (exts.some(ext => file.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

const files = getAllFiles(srcDir, ['.ts', '.tsx']);

// Map of tableName -> Set of columnNames
const tableColumns = new Map();

function addCol(table, col) {
  if (!table || !col) return;
  col = col.trim();
  if (!col || col === '*' || col.includes('(') || col.includes(')') || col.includes(':')) return; // ignore relations or expressions
  if (!tableColumns.has(table)) tableColumns.set(table, new Set());
  tableColumns.get(table).add(col);
}

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');

  // Find all chains: supabase.from('tableName')....
  // We can look for from('tableName') and then match subsequent calls within reasonable distance
  const tableRegex = /supabase\s*\.\s*from\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)([^;]+)/g;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const table = match[1];
    const chain = match[2];

    // Check .select('...')
    const selectMatches = chain.matchAll(/\.select\(\s*['"`]([^'"`]+)['"`]/g);
    for (const sm of selectMatches) {
      const cols = sm[1].split(',');
      for (let c of cols) {
        c = c.trim();
        // Handle aliases like alias:col or relations like users(id, name)
        if (c.includes('(')) continue; // ignore nested relations for simple probe
        if (c.includes(':')) c = c.split(':')[1].trim();
        addCol(table, c);
      }
    }

    // Check .eq('col', ...), .neq, .in, .gte, .lte, .gt, .lt, .is, .order
    const opMatches = chain.matchAll(/\.(eq|neq|in|gte|lte|gt|lt|is|order)\(\s*['"]([a-zA-Z0-9_]+)['"]/g);
    for (const om of opMatches) {
      addCol(table, om[2]);
    }
  }

  // Also check object literals in insert/update/upsert if table is nearby
  // Let's do a more direct regex for from('table').insert/update/upsert
  const writeRegex = /supabase\s*\.\s*from\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)\s*\.\s*(insert|update|upsert)\(\s*(\{[\s\S]*?\}|\[[\s\S]*?\])/g;
  let wMatch;
  while ((wMatch = writeRegex.exec(content)) !== null) {
    const table = wMatch[1];
    const body = wMatch[2];
    // extract keys like `key:` or `'key':` or `"key":`
    const keyMatches = body.matchAll(/([a-zA-Z0-9_]+)\s*:/g);
    for (const km of keyMatches) {
      const k = km[1];
      if (['onConflict', 'ignoreDuplicates', 'count'].includes(k)) continue;
      addCol(table, k);
    }
  }
}

console.log('=== EXTRACTED COLUMNS PER TABLE ===');
for (const [table, cols] of Array.from(tableColumns.entries()).sort()) {
  console.log(`Table [${table}]: ${Array.from(cols).join(', ')}`);
}

async function probe() {
  console.log('\n=== REAL DB COLUMN PROBING ===');
  let totalErrors = 0;
  let totalChecked = 0;

  for (const [table, cols] of Array.from(tableColumns.entries()).sort()) {
    console.log(`\n--- Testing table: ${table} ---`);
    for (const col of Array.from(cols).sort()) {
      totalChecked++;
      try {
        const { error } = await supabase.from(table).select(col).limit(0);
        if (error) {
          if (error.code === 'PGRST204' || error.message.includes('Could not find') || error.message.includes('schema cache')) {
            console.error(`🚨 MISSING COLUMN: [${table}].[${col}] - ${error.message}`);
            totalErrors++;
          } else {
            // Other errors (e.g. permission/RLS or syntax)
            console.warn(`⚠️ Warning on [${table}].[${col}]: ${error.code} - ${error.message}`);
          }
        } else {
          // OK!
          process.stdout.write(`.` );
        }
      } catch (err) {
        console.error(`💥 Exception probing [${table}].[${col}]:`, err.message);
      }
    }
    console.log('');
  }

  console.log(`\n========================================`);
  console.log(`PROBE SUMMARY: Checked ${totalChecked} columns. Found ${totalErrors} MISSING COLUMNS!`);
  console.log(`========================================`);
}

probe();
