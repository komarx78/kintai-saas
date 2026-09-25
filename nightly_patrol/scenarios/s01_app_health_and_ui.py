from playwright.sync_api import Page
from ..config import BASE_URL
from ..utils.browser import BrowserManager
from ..utils.reporter import PatrolReporter

def run_s01_health_check(page: Page, browser_mgr: BrowserManager, reporter: PatrolReporter) -> bool:
    """シナリオ01: アプリ基本起動・画面描画・コンソールエラーゼロ検証"""
    title = "システム基本稼働 ＆ コンソールエラーゼロ監査"
    scenario_id = "SCN-01-APP-HEALTH"

    try:
        # アプリトップへアクセス
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 画面タイトル取得
        page_title = page.title()
        
        # 画面上に主要UI（ナビゲーションやヘッダー）が存在するか
        has_nav = page.locator("header, nav, #root, [class*='navbar']").count() > 0

        # コンソールエラーのチェック
        critical_errors = [e for e in browser_mgr.console_errors if "favicon" not in e.lower()]
        has_page_crash = len(browser_mgr.page_errors) > 0

        screenshot = browser_mgr.capture_screenshot("s01_top_page")

        if has_page_crash:
            reporter.add_result(
                scenario_id, title, "FAILED",
                f"ページ内で未補足のJavaScript例外を検知しました: {browser_mgr.page_errors[0]}",
                screenshot, browser_mgr.page_errors
            )
            return False
        elif len(critical_errors) > 0:
            reporter.add_result(
                scenario_id, title, "WARNING",
                f"画面描画は成功（タイトル: '{page_title}'）しましたが、コンソールエラーが {len(critical_errors)} 件検出されました。",
                screenshot, critical_errors
            )
            return True
        else:
            reporter.add_result(
                scenario_id, title, "PASSED",
                f"アプリは正常に稼働しています（タイトル: '{page_title}'、コンソールエラー: 0件、画面クラッシュ: なし）。",
                screenshot
            )
            return True

    except Exception as e:
        screenshot = browser_mgr.capture_screenshot("s01_error")
        reporter.add_result(
            scenario_id, title, "FAILED",
            f"アプリへのアクセス中に致命的エラーが発生しました: {str(e)}",
            screenshot
        )
        return False
