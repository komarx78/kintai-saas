/**
 * 🏛️ 【孔明軍団・自律開発要塞】実DB永続化 ＆ LocalStorage逃避（ハリボテ）静的監査チェッカー
 * 
 * 目的:
 * ・SaaSとして致命傷となる「他PCでデータが消える/同期しない問題」を撲滅する。
 * ・コード内に存在する「実DB保存を伴わない単独LocalStorage保存」や
 *   「DBエラー時にLocalStorageで誤魔化すハリボテ構造」を機械的に全自動検知・警告する。
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');

function getAllFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx']) {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== '.git' && item.name !== 'dist') {
        files = files.concat(getAllFiles(fullPath, exts));
      }
    } else if (exts.includes(path.extname(item.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getAllFiles(SRC_DIR);

console.log('================================================================');
console.log('🔍 【実DB永続化 ＆ LocalStorage逃避 機械的自動監査レポート】');
console.log('================================================================');

let totalSetItems = 0;
let suspiciousIsolatedSetItems = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.includes('localStorage.setItem(')) {
      totalSetItems++;
      const lineNum = idx + 1;
      const relPath = path.relative(__dirname, file);

      // 前後30行のコンテキストを取得し、supabase.from や fetch などのDB永続化呼び出しがあるか判定
      const start = Math.max(0, idx - 25);
      const end = Math.min(lines.length, idx + 25);
      const context = lines.slice(start, end).join('\n');

      const hasDbOperation = context.includes('supabase.from(') || 
                             context.includes('supabase.rpc(') ||
                             context.includes('saveStoresUnified') ||
                             context.includes('ToDb(') ||
                             context.includes('fromDb(');

      // 許容される一時的UIステート（ズーム、タブ、一時選択等）
      const isUiState = line.includes('zoom') || line.includes('tab') || line.includes('theme') || line.includes('sidebar');

      if (!hasDbOperation && !isUiState) {
        suspiciousIsolatedSetItems.push({
          file: relPath,
          line: lineNum,
          code: line.trim()
        });
      }
    }

    // 🚨 役職・マスタ保存関数の tenantId 引数欠落検知
    if (line.includes('savePositionsToStorage(') && !line.includes('tenantId') && !line.includes('tenantIdData') && !line.includes('tid') && !line.includes('activeTenantId')) {
      // 関数の定義行自体は除外
      if (!line.includes('export const savePositionsToStorage')) {
        console.warn(`⚠️ [引数欠落警告] ${path.relative(__dirname, file)}:${idx + 1} -> savePositionsToStorage に tenantId が渡されていません: ${line.trim()}`);
      }
    }
  });
});

console.log(`📊 検査ファイル数: ${allFiles.length} 件`);
console.log(`📌 localStorage.setItem 検出総数: ${totalSetItems} 件`);
console.log(`🚨 【実DB永続化の形跡がない孤立LocalStorage保存（要修正候補）】: ${suspiciousIsolatedSetItems.length} 件\n`);

if (suspiciousIsolatedSetItems.length > 0) {
  suspiciousIsolatedSetItems.slice(0, 15).forEach((item, i) => {
    console.log(`[${i + 1}] ${item.file}:${item.line}`);
    console.log(`    ${item.code}\n`);
  });
  if (suspiciousIsolatedSetItems.length > 15) {
    console.log(`    ... 他 ${suspiciousIsolatedSetItems.length - 15} 件\n`);
  }
}

console.log('================================================================');
console.log('💡 判定結果:');
if (suspiciousIsolatedSetItems.length === 0) {
  console.log('✅ すべてのLocalStorage保存は実DB（Supabase）と連動またはUI専用です。合格！');
} else {
  console.log('⚠️ 実DBへの保存を伴わずブラウザ単独で保持している箇所が存在します。');
  console.log('   これらを実DBテーブルへ永続化するマイグレーションが今後必要です。');
}
console.log('================================================================');
