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

const tableUsage = new Map(); // table -> Set of files
const rpcUsage = new Map(); // rpc -> Set of files

// Regexes
const fromRegex = /supabase\s*\.\s*from\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;
const rpcRegex = /supabase\s*\.\s*rpc\(\s*['"]([a-zA-Z0-9_-]+)['"]/g;

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = fromRegex.exec(content)) !== null) {
    const table = match[1];
    if (!tableUsage.has(table)) tableUsage.set(table, new Set());
    tableUsage.get(table).add(path.relative(process.cwd(), f));
  }
  while ((match = rpcRegex.exec(content)) !== null) {
    const rpcName = match[1];
    if (!rpcUsage.has(rpcName)) rpcUsage.set(rpcName, new Set());
    rpcUsage.get(rpcName).add(path.relative(process.cwd(), f));
  }
}

console.log('=== DISCOVERED TABLES IN CODE ===');
for (const [table, fileSet] of Array.from(tableUsage.entries()).sort()) {
  console.log(`- ${table} (in ${fileSet.size} files)`);
}

console.log('\n=== DISCOVERED RPCS IN CODE ===');
for (const [rpcName, fileSet] of Array.from(rpcUsage.entries()).sort()) {
  console.log(`- ${rpcName} (in ${fileSet.size} files)`);
}

async function audit() {
  console.log('\n=== TESTING TABLES AGAINST REAL DB ===');
  for (const table of Array.from(tableUsage.keys()).sort()) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.error(`❌ Table [${table}]: ERROR ${error.code} - ${error.message} (details: ${error.details || ''})`);
      } else {
        const columns = data && data.length > 0 ? Object.keys(data[0]) : '(empty table - schema accessible)';
        console.log(`✅ Table [${table}]: OK. Sample keys: ${Array.isArray(columns) ? columns.slice(0, 8).join(', ') + '...' : columns}`);
      }
    } catch (err) {
      console.error(`💥 Table [${table}]: EXCEPTION`, err.message);
    }
  }

  console.log('\n=== TESTING RPCS AGAINST REAL DB ===');
  for (const rpcName of Array.from(rpcUsage.keys()).sort()) {
    try {
      const { data, error } = await supabase.rpc(rpcName, {});
      if (error) {
        // If error code is 42883 (function does not exist), that's a missing RPC
        // If error is missing arguments (P0001 or 42883 with param signature), function might exist
        console.log(`RPC [${rpcName}]: returned error: ${error.code} - ${error.message}`);
      } else {
        console.log(`✅ RPC [${rpcName}]: OK! Result:`, typeof data);
      }
    } catch (err) {
      console.log(`RPC [${rpcName}]: exception:`, err.message);
    }
  }
}

audit();
