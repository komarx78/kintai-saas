import sys
import os
import time
import subprocess
import datetime
import requests

# WindowsコンソールでのUTF-8絵文字・日本語出力を完全保証
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# モジュール検索パスにプロジェクトルートを追加
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from nightly_patrol.config import BASE_URL, HEADLESS, BROWSER_CHANNEL
from nightly_patrol.utils.browser import BrowserManager
from nightly_patrol.utils.reporter import PatrolReporter
from nightly_patrol.scenarios.s01_app_health_and_ui import run_s01_health_check
from nightly_patrol.scenarios.s02_company_preset_bulk import run_s02_company_preset_bulk
from nightly_patrol.scenarios.s03_fuzzing_edge_cases import run_s03_fuzzing_edge_cases

def is_server_reachable(url: str) -> bool:
    """サーバーが既に応答可能か確認"""
    try:
        res = requests.get(url, timeout=2)
        return res.status_code in [200, 304, 404]
    except Exception:
        return False

def ensure_server_running() -> subprocess.Popen:
    """夜間無人実行時にローカルViteサーバーが停止していれば自動起動"""
    if is_server_reachable(BASE_URL):
        print(f"📡 テスト対象サーバーは既に稼働中です ({BASE_URL})")
        return None

    if "localhost" in BASE_URL or "127.0.0.1" in BASE_URL:
        print("⚡ [自律起動] ローカル開発サーバーが停止しているため、Viteサーバーを自動起動中...")
        try:
            # プロジェクトルートで npm run dev をバックグラウンド起動
            proc = subprocess.Popen(
                "cmd.exe /c npm run dev",
                cwd=parent_dir,
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            # サーバーが立ち上がるまで最大15秒待機
            for _ in range(15):
                time.sleep(1)
                if is_server_reachable(BASE_URL):
                    print(f"   Viteサーバーの自律起動に成功いたしました！ ({BASE_URL})\n")
                    return proc
            print("   ⚠️ サーバー起動待機がタイムアウトしました。テストを継続します。\n")
            return proc
        except Exception as e:
            print(f"   ⚠️ サーバー自動起動試行例外: {e}\n")
            return None
    return None

def main():
    run_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    print("================================================================")
    print("🛡️ 【孔明軍団・夜間自動巡回 要塞防衛パトロール部隊】出撃")
    print(f"⏰ 実行開始時刻: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🌐 対象URL: {BASE_URL} (ブラウザ: {BROWSER_CHANNEL}, ヘッドレス: {HEADLESS})")
    print("================================================================\n")

    server_process = ensure_server_running()

    reporter = PatrolReporter(run_id)
    browser_mgr = BrowserManager()

    try:
        print("🚀 [STEP 1/4] ブラウザを起動中...")
        page = browser_mgr.start()
        print("   ブラウザ起動完了（Microsoft Edge 正常待機）\n")

        # ----------------------------------------------------
        # シナリオ 01: アプリ基本稼働 ＆ コンソールエラー監査
        # ----------------------------------------------------
        print("🔍 [STEP 2/4] シナリオ01: アプリ基本稼働 ＆ コンソールエラーゼロ監査を実行中...")
        s01_ok = run_s01_health_check(page, browser_mgr, reporter)
        print(f"   シナリオ01 判定: {'✅ PASSED' if s01_ok else '❌ FAILED'}\n")

        # ----------------------------------------------------
        # シナリオ 02: 業種別テンプレート一括作成 ＆ DB永続化
        # ----------------------------------------------------
        print("🏢 [STEP 3/4] シナリオ02: 業種別テンプレート一括作成 ＆ 実DB永続化監査を実行中...")
        s02_ok = run_s02_company_preset_bulk(page, browser_mgr, reporter)
        print(f"   シナリオ02 判定: {'✅ PASSED' if s02_ok else '❌ FAILED'}\n")

        # ----------------------------------------------------
        # シナリオ 03: イレギュラー・限界値ファジング耐性
        # ----------------------------------------------------
        print("💥 [STEP 4/4] シナリオ03: イレギュラー・限界値・異常入力ファジング耐性を実行中...")
        s03_ok = run_s03_fuzzing_edge_cases(page, browser_mgr, reporter)
        print(f"   シナリオ03 判定: {'✅ PASSED' if s03_ok else '❌ FAILED'}\n")

    except Exception as e:
        print(f"🚨 [致命的パトロール例外]: {e}")
        reporter.add_result("FATAL-ERROR", "巡回実行中の致命的例外", "FAILED", str(e))

    finally:
        print("🛑 ブラウザを安全にシャットダウン中...")
        browser_mgr.close()
        print("   ブラウザシャットダウン完了")

        if server_process:
            print("🛑 自動起動したViteサーバープロセスを終了中...")
            try:
                subprocess.call(f"taskkill /F /T /PID {server_process.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass
            print("   サーバー終了完了\n")

    # 診断レポート生成
    latest_report_path = reporter.generate_markdown()
    print("================================================================")
    print("📋 【夜間巡回完了】毎朝の要塞健康診断カルテを生成いたしました！")
    print(f"📄 最新カルテ: {latest_report_path}")
    print("================================================================")

if __name__ == "__main__":
    main()
