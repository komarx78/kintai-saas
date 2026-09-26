process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
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

// We will find all:
// supabase.from('tableName').insert(obj)
// supabase.from('tableName').update(obj)
// supabase.from('tableName').upsert(obj)
// and inspect all keys in `obj` (whether inline object, array, or variable declared above)

const writeOperations = []; // { file, line, table, op, keys: [] }

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function getLine(pos) {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function extractKeysFromNode(expr, currentDepth = 0) {
    const keys = new Set();
    if (currentDepth > 3 || !expr) return keys;

    if (ts.isObjectLiteralExpression(expr)) {
      for (const p of expr.properties) {
        if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
          if (p.name && ts.isIdentifier(p.name)) keys.add(p.name.text);
          else if (p.name && ts.isStringLiteral(p.name)) keys.add(p.name.text);
        } else if (ts.isSpreadAssignment(p)) {
          // If spreading a variable, try to resolve that variable
          if (ts.isIdentifier(p.expression)) {
            const spreadKeys = findVarKeys(p.expression.text, sourceFile);
            spreadKeys.forEach(k => keys.add(k));
          }
        }
      }
    } else if (ts.isArrayLiteralExpression(expr)) {
      for (const el of expr.elements) {
        const sub = extractKeysFromNode(el, currentDepth + 1);
        sub.forEach(k => keys.add(k));
      }
    } else if (ts.isIdentifier(expr)) {
      const varKeys = findVarKeys(expr.text, sourceFile);
      varKeys.forEach(k => keys.add(k));
    } else if (ts.isCallExpression(expr)) {
      // e.g. sanitizePayload(foo) or map(...)
      // trace arguments
      for (const arg of expr.arguments) {
        if (ts.isIdentifier(arg)) {
          const varKeys = findVarKeys(arg.text, sourceFile);
          varKeys.forEach(k => keys.add(k));
        } else if (ts.isObjectLiteralExpression(arg)) {
          const sub = extractKeysFromNode(arg, currentDepth + 1);
          sub.forEach(k => keys.add(k));
        }
      }
    }
    return keys;
  }

  function findVarKeys(varName, root) {
    const keys = new Set();
    function search(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === varName) {
        if (node.initializer) {
          const sub = extractKeysFromNode(node.initializer, 1);
          sub.forEach(k => keys.add(k));
        }
      }
      ts.forEachChild(node, search);
    }
    search(root);
    return keys;
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && ['insert', 'update', 'upsert'].includes(expr.name.text)) {
        const op = expr.name.text;
        // check if parent chain has .from('table')
        let chainTarget = expr.expression;
        while (chainTarget && ts.isCallExpression(chainTarget)) {
          const subExpr = chainTarget.expression;
          if (ts.isPropertyAccessExpression(subExpr) && subExpr.name.text === 'from') {
            const tableArg = chainTarget.arguments[0];
            if (tableArg && ts.isStringLiteral(tableArg)) {
              const table = tableArg.text;
              const payloadArg = node.arguments[0];
              const keys = extractKeysFromNode(payloadArg);
              writeOperations.push({
                file: path.relative(process.cwd(), file),
                line: getLine(node.getStart()),
                table,
                op,
                keys: Array.from(keys).filter(k => !['onConflict', 'ignoreDuplicates', 'count'].includes(k))
              });
            }
          }
          chainTarget = subExpr.expression;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

console.log(`Found ${writeOperations.length} write operations in codebase.`);

// Group keys to test per table
const tableWriteKeys = new Map(); // table -> Map of key -> Set of locations
for (const w of writeOperations) {
  if (!tableWriteKeys.has(w.table)) tableWriteKeys.set(w.table, new Map());
  const colMap = tableWriteKeys.get(w.table);
  for (const k of w.keys) {
    if (!colMap.has(k)) colMap.set(k, new Set());
    colMap.get(k).add(`${w.file}:${w.line} (${w.op})`);
  }
}

async function auditWrites() {
  console.log('=== TESTING ALL WRITE KEYS AGAINST LIVE DB ===\n');
  let missingCount = 0;
  let totalKeysChecked = 0;

  for (const [table, colMap] of Array.from(tableWriteKeys.entries()).sort()) {
    console.log(`Auditing Table [${table}] (${colMap.size} unique keys sent in writes)...`);
    for (const [col, locs] of Array.from(colMap.entries()).sort()) {
      totalKeysChecked++;
      try {
        const { error } = await supabase.from(table).select(col).limit(0);
        if (error) {
          if (error.code === '42703' || error.message.includes('does not exist')) {
            console.error(`🚨 MISSING COLUMN IN WRITE: Table [${table}], Column [${col}]`);
            for (const loc of locs) {
              console.error(`     at ${loc}`);
            }
            missingCount++;
          } else {
            // Other error
          }
        } else {
          // OK!
        }
      } catch (err) {
        console.error(`Exception on ${table}.${col}:`, err.message);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`WRITE AUDIT COMPLETE: Checked ${totalKeysChecked} keys across ${tableWriteKeys.size} tables.`);
  console.log(`Total missing columns in write operations: ${missingCount}`);
  console.log(`======================================================`);
}

auditWrites();
