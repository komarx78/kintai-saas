import os
import datetime
from typing import List, Dict, Any
from ..config import REPORTS_DIR

class PatrolReporter:
    """夜間自動巡回の結果を美しいMarkdownカルテとして生成するレポーター"""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.start_time = datetime.datetime.now()
        self.results: List[Dict[str, Any]] = []

    def add_result(self, scenario_id: str, title: str, status: str, detail: str, screenshot_path: str = "", console_errors: List[str] = None):
        """
        status: 'PASSED' (成功) | 'FAILED' (失敗) | 'WARNING' (警告)
        """
        self.results.append({
            "id": scenario_id,
            "title": title,
            "status": status,
            "detail": detail,
            "screenshot": screenshot_path,
            "console_errors": console_errors or []
        })

    def generate_markdown(self) -> str:
        end_time = datetime.datetime.now()
        duration_sec = (end_time - self.start_time).total_seconds()

        passed_count = sum(1 for r in self.results if r["status"] == "PASSED")
        failed_count = sum(1 for r in self.results if r["status"] == "FAILED")
        warn_count = sum(1 for r in self.results if r["status"] == "WARNING")
        total_count = len(self.results)

        is_all_clean = (failed_count == 0 and warn_count == 0)

        lines = []
        lines.append(f"# 🛡️ 【孔明軍団・夜間自動巡回 要塞健康診断カルテ】")
        lines.append(f"**巡回実施日時**: `{self.start_time.strftime('%Y-%m-%d %H:%M:%S')}` 〜 `{end_time.strftime('%H:%M:%S')}` （所要時間: {duration_sec:.1f}秒）\n")

        # 総合判定サマリーバナー
        if is_all_clean:
            lines.append("> ### 🏆 総合判定: 【完全合格（ALL GREEN）】")
            lines.append("> 全検証シナリオがエラーゼロ・DB整合性100%で通過いたしました！我が君、本日のシステムは鉄壁でございます。\n")
        else:
            lines.append(f"> ### ⚠️ 総合判定: 【要修正箇所あり】（不具合: {failed_count}件 / 警告: {warn_count}件）")
            lines.append("> 以下の検出不具合カルテを確認し、日中にピンポイント外科手術を行ってください。\n")

        # 集計テーブル
        lines.append("| 項目 | 件数 | 状態 |")
        lines.append("| :--- | :--- | :--- |")
        lines.append(f"| 🧪 総検証項目数 | **{total_count}** 件 | 完走 |")
        lines.append(f"| ✅ 成功（正常通過） | **{passed_count}** 件 | 合格 |")
        lines.append(f"| ❌ 失敗（不具合検知） | **{failed_count}** 件 | {'🚨 要対応' if failed_count > 0 else 'なし'} |")
        lines.append(f"| ⚠️ 警告（軽微な注意） | **{warn_count}** 件 | {'注視' if warn_count > 0 else 'なし'} |")
        lines.append("")

        # 詳細カルテ
        lines.append("## 🔍 各シナリオ検証詳細カルテ")
        for idx, r in enumerate(self.results, 1):
            badge = "✅ [PASSED]" if r["status"] == "PASSED" else "❌ [FAILED]" if r["status"] == "FAILED" else "⚠️ [WARNING]"
            lines.append(f"### {idx}. {badge} {r['title']} (`{r['id']}`)")
            lines.append(f"- **結果概要**: {r['detail']}")
            
            if r.get("screenshot"):
                lines.append(f"- **証拠スクショ**: `{os.path.basename(r['screenshot'])}`")

            if r.get("console_errors"):
                lines.append(f"- **🚨 ブラウザ内部エラー（JS例外）**:")
                for err in r["console_errors"][:5]:
                    lines.append(f"  - `{err}`")

            lines.append("")

        lines.append("---")
        lines.append("※ 本レポートは Python Nightly Patrol Bot により完全無人で自動生成されました。")

        content = "\n".join(lines)

        # ファイルに書き出し
        report_file = os.path.join(REPORTS_DIR, f"patrol_report_{self.start_time.strftime('%Y%m%d_%H%M%S')}.md")
        latest_file = os.path.join(REPORTS_DIR, "latest_patrol_report.md")

        with open(report_file, "w", encoding="utf-8") as f:
            f.write(content)
        with open(latest_file, "w", encoding="utf-8") as f:
            f.write(content)

        return latest_file
