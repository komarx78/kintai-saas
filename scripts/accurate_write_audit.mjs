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

const writeOperations = []; // { file, line, table, op, keys: [] }

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function getLine(pos) {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  // Find enclosing function/block for a node
  function getEnclosingScope(node) {
    let curr = node.parent;
    while (curr) {
      if (ts.isFunctionDeclaration(curr) || ts.isArrowFunction(curr) || ts.isFunctionExpression(curr) || ts.isMethodDeclaration(curr)) {
        return curr;
      }
      curr = curr.parent;
    }
    return sourceFile;
  }

  function extractKeys(expr, scopeNode) {
    const keys = new Set();
    if (!expr) return keys;

    if (ts.isObjectLiteralExpression(expr)) {
      for (const p of expr.properties) {
        if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
          if (p.name && ts.isIdentifier(p.name)) keys.add(p.name.text);
          else if (p.name && ts.isStringLiteral(p.name)) keys.add(p.name.text);
        }
      }
    } else if (ts.isArrayLiteralExpression(expr)) {
      for (const el of expr.elements) {
        extractKeys(el, scopeNode).forEach(k => keys.add(k));
      }
    } else if (ts.isIdentifier(expr)) {
      const varName = expr.text;
      // Search ONLY within the enclosing scope for the declaration
      function searchInScope(n) {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === varName) {
          if (n.initializer) {
            extractKeys(n.initializer, n).forEach(k => keys.add(k));
          }
        }
        ts.forEachChild(n, searchInScope);
      }
      searchInScope(scopeNode);
    }
    return keys;
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && ['insert', 'update', 'upsert'].includes(expr.name.text)) {
        const op = expr.name.text;
        let chainTarget = expr.expression;
        while (chainTarget && ts.isCallExpression(chainTarget)) {
          const subExpr = chainTarget.expression;
          if (ts.isPropertyAccessExpression(subExpr) && subExpr.name.text === 'from') {
            const tableArg = chainTarget.arguments[0];
            if (tableArg && ts.isStringLiteral(tableArg)) {
              const table = tableArg.text;
              const payloadArg = node.arguments[0];
              const scope = getEnclosingScope(node);
              const keys = extractKeys(payloadArg, scope);
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

console.log(`Found ${writeOperations.length} scoped write operations.`);

const tableWriteKeys = new Map();
for (const w of writeOperations) {
  if (!tableWriteKeys.has(w.table)) tableWriteKeys.set(w.table, new Map());
  const colMap = tableWriteKeys.get(w.table);
  for (const k of w.keys) {
    if (!colMap.has(k)) colMap.set(k, new Set());
    colMap.get(k).add(`${w.file}:${w.line} (${w.op})`);
  }
}

async function audit() {
  console.log('\n=== SCOPED WRITE AUDIT AGAINST LIVE DB ===\n');
  let missingCount = 0;
  for (const [table, colMap] of Array.from(tableWriteKeys.entries()).sort()) {
    console.log(`Table [${table}] (${colMap.size} keys):`);
    for (const [col, locs] of Array.from(colMap.entries()).sort()) {
      try {
        const { error } = await supabase.from(table).select(col).limit(0);
        if (error) {
          if (error.code === '42703' || error.message.includes('does not exist')) {
            console.error(`  🚨 [MISSING COLUMN] Table: "${table}", Column: "${col}"`);
            for (const loc of locs) {
              console.error(`       at ${loc}`);
            }
            missingCount++;
          }
        }
      } catch (e) {
        console.error(`Exception on ${table}.${col}:`, e.message);
      }
    }
  }

  console.log(`\n==============================================`);
  console.log(`SCOPED AUDIT COMPLETE. Missing write columns detected: ${missingCount}`);
  console.log('==============================================');
}

audit();
