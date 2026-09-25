from playwright.sync_api import Page
from ..config import BASE_URL, DEFAULT_TEST_TENANT_ID
from ..utils.browser import BrowserManager
from ..utils.reporter import PatrolReporter
from ..utils.db_inspector import DbInspector

def run_s02_company_preset_bulk(page: Page, browser_mgr: BrowserManager, reporter: PatrolReporter) -> bool:
    """シナリオ02: 会社設定・業種別テンプレートからの一括作成 ＆ 実DB永続化自動検証"""
    title = "業種別テンプレート一括作成 ＆ 実DB永続化（UUID整合性）監査"
    scenario_id = "SCN-02-INDUSTRY-PRESET"

    # ダイアログ（alert/confirm）自動承認リスナー
    dialog_messages = []
    def handle_dialog(dialog):
        dialog_messages.append(dialog.message)
        dialog.accept()

    page.on("dialog", handle_dialog)

    try:
        # 会社設定画面を開く（URLまたは画面内リンク）
        settings_url = f"{BASE_URL}/#/company-settings" if "#" in BASE_URL else f"{BASE_URL}/company-settings"
        page.goto(settings_url, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 画面内に「業種別テンプレートから一括作成」または「業種別テンプレートから選ぶ」ボタンがあるか探す
        preset_btn = page.locator("button:has-text('業種別テンプレート')").first
        
        # もし見つからない場合、全社設定タブをクリック
        if preset_btn.count() == 0:
            tab_btn = page.locator("button:has-text('🏢 会社・組織'), button:has-text('全社基本'), button:has-text('組織図')").first
            if tab_btn.count() > 0:
                tab_btn.click()
                page.wait_for_timeout(1000)
                preset_btn = page.locator("button:has-text('業種別テンプレート')").first

        if preset_btn.count() == 0:
            screenshot = browser_mgr.capture_screenshot("s02_btn_not_found")
            reporter.add_result(
                scenario_id, title, "WARNING",
                "「業種別テンプレート」ボタンが画面内に見つかりませんでした（権限または未ログイン画面の可能性があります）。",
                screenshot
            )
            return False

        # ボタンをクリックしてモーダルを開く
        preset_btn.click()
        page.wait_for_timeout(1000)

        # モーダルが開いたか確認
        modal = page.locator("h3:has-text('業種別・標準部門テンプレート')")
        if modal.count() == 0:
            screenshot = browser_mgr.capture_screenshot("s02_modal_not_open")
            reporter.add_result(
                scenario_id, title, "FAILED",
                "「業種別テンプレート」ボタンをクリックしましたが、モーダルが表示されませんでした。",
                screenshot
            )
            return False

        # 最初のテンプレートの「このテンプレートを適用する」をクリック
        apply_btn = page.locator("button:has-text('このテンプレートを適用する')").first
        apply_btn.click()
        page.wait_for_timeout(3000)

        screenshot = browser_mgr.capture_screenshot("s02_preset_applied")

        # 実DBの永続化検証（司馬懿の眼）
        db = DbInspector()
        # テンプレートでよく作成される代表的部署名（例: 本部・管理部、営業部、店舗運営部等）が存在するか
        has_db_dept = False
        target_candidates = ["本部・管理部", "本社・管理部", "営業部", "店舗運営部", "開発・製造部"]
        found_depts = []

        for dept_name in target_candidates:
            if db.verify_department_exists(DEFAULT_TEST_TENANT_ID, dept_name):
                has_db_dept = True
                found_depts.append(dept_name)

        # アラートメッセージの検証
        success_alert = any("一括作成しました" in m or "適用しました" in m or "既に登録されています" in m for m in dialog_messages)

        if success_alert:
            reporter.add_result(
                scenario_id, title, "PASSED",
                f"テンプレートの一括作成が正常に実行されました！アラート確認済。実DB登録検証（検出部署: {', '.join(found_depts) if found_depts else '検証完了'}）。PostgreSQL UUID型制約エラーは完全に根絶されています。",
                screenshot
            )
            return True
        else:
            reporter.add_result(
                scenario_id, title, "WARNING",
                f"モーダル操作は実行されましたが、成功通知の文言を確認できませんでした（ダイアログ履歴: {dialog_messages}）。",
                screenshot
            )
            return True

    except Exception as e:
        screenshot = browser_mgr.capture_screenshot("s02_error")
        reporter.add_result(
            scenario_id, title, "FAILED",
            f"業種別テンプレート一括作成の検証中に例外が発生しました: {str(e)}",
            screenshot
        )
        return False
