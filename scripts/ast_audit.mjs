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

// Map of tableName -> Map of colName -> Set of locations (file:line)
const tableColLocations = new Map();

function recordCol(table, col, file, line) {
  if (!table || !col) return;
  col = col.trim();
  if (!col || col === '*' || col.includes('(') || col.includes(')')) return;
  if (col.includes(':')) {
    // e.g. alias:col or col:alias
    const parts = col.split(':');
    col = parts[parts.length - 1].trim();
  }
  if (!/^[a-zA-Z0-9_]+$/.test(col)) return;

  if (!tableColLocations.has(table)) tableColLocations.set(table, new Map());
  const colMap = tableColLocations.get(table);
  if (!colMap.has(col)) colMap.set(col, new Set());
  colMap.get(col).add(`${path.relative(process.cwd(), file)}:${line}`);
}

// Map of variableName -> properties
// In addition to AST traversal, we will find table context
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  function getLine(node) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return line + 1;
  }

  // We want to detect calls to supabase.from('tableName')
  // and trace what is passed to .select, .insert, .update, .upsert, .eq, .in, etc.
  function visit(node) {
    if (ts.isCallExpression(node)) {
      // Check if this call is supabase.from('tableName')
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'from') {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          const tableName = arg.text;
          // Now trace up the parent chain to see chained calls
          let current = node.parent;
          while (current) {
            if (ts.isPropertyAccessExpression(current)) {
              const methodName = current.name.text;
              const parentCall = current.parent;
              if (ts.isCallExpression(parentCall) && parentCall.expression === current) {
                const line = getLine(parentCall);
                if (methodName === 'select') {
                  const selArg = parentCall.arguments[0];
                  if (selArg && ts.isStringLiteral(selArg)) {
                    selArg.text.split(',').forEach(c => recordCol(tableName, c, file, line));
                  }
                } else if (['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'order'].includes(methodName)) {
                  const colArg = parentCall.arguments[0];
                  if (colArg && ts.isStringLiteral(colArg)) {
                    recordCol(tableName, colArg.text, file, line);
                  }
                } else if (['insert', 'update', 'upsert'].includes(methodName)) {
                  const payloadArg = parentCall.arguments[0];
                  if (payloadArg) {
                    inspectPayload(tableName, payloadArg, file, line);
                  }
                }
              }
            }
            // Stop when statement ends
            if (ts.isStatement(current)) break;
            current = current.parent;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  function inspectPayload(tableName, exprNode, file, line) {
    if (ts.isObjectLiteralExpression(exprNode)) {
      for (const prop of exprNode.properties) {
        if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
          const propName = prop.name.text;
          recordCol(tableName, propName, file, line);
        }
      }
    } else if (ts.isArrayLiteralExpression(exprNode)) {
      for (const el of exprNode.elements) {
        inspectPayload(tableName, el, file, line);
      }
    } else if (ts.isIdentifier(exprNode)) {
      // Try to find identifier declaration in the same file
      const varName = exprNode.text;
      findVarProperties(varName, sourceFile, (propName, propLine) => {
        recordCol(tableName, propName, file, propLine);
      });
    }
  }

  function findVarProperties(varName, rootNode, cb) {
    function searchVar(n) {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === varName) {
        if (n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
          for (const prop of n.initializer.properties) {
            if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
              cb(prop.name.text, getLine(prop));
            }
          }
        }
      }
      ts.forEachChild(n, searchVar);
    }
    searchVar(rootNode);
  }

  visit(sourceFile);
}

console.log('=== AST PARSING COMPLETED ===');
let totalColsFound = 0;
for (const [table, colMap] of Array.from(tableColLocations.entries()).sort()) {
  console.log(`Table [${table}] (${colMap.size} columns detected): ${Array.from(colMap.keys()).join(', ')}`);
  totalColsFound += colMap.size;
}
console.log(`Total unique table-column pairs: ${totalColsFound}`);

async function runProbe() {
  console.log('\n=== RUNNING COMPREHENSIVE LIVE DB AUDIT ===\n');
  const missing = [];

  for (const [table, colMap] of Array.from(tableColLocations.entries()).sort()) {
    for (const [col, locs] of Array.from(colMap.entries()).sort()) {
      try {
        const { error } = await supabase.from(table).select(col).limit(0);
        if (error) {
          if (error.code === '42703' || error.message.includes('does not exist')) {
            const locList = Array.from(locs).join(', ');
            console.error(`❌ [MISSING COLUMN] Table: "${table}", Column: "${col}"`);
            console.error(`   Locations: ${locList}`);
            missing.push({ table, col, locs: Array.from(locs), message: error.message });
          } else {
            // Check if other error
            // console.warn(`   Notice: [${table}].[${col}] -> ${error.code} ${error.message}`);
          }
        }
      } catch (e) {
        console.error(`Exception on ${table}.${col}:`, e.message);
      }
    }
  }

  console.log('\n==============================================');
  console.log(`AUDIT COMPLETE. Missing columns detected: ${missing.length}`);
  console.log('==============================================');
  if (missing.length > 0) {
    fs.writeFileSync('scripts/missing_columns_report.json', JSON.stringify(missing, null, 2));
    console.log('Saved report to scripts/missing_columns_report.json');
  }
}

runProbe();
