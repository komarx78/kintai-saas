import os
from typing import Tuple, List
from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext
from ..config import HEADLESS, BROWSER_CHANNEL, DEFAULT_TIMEOUT_MS, REPORTS_DIR

class BrowserManager:
    """Windows標準のEdgeを活用したPlaywrightブラウザマネージャー"""

    def __init__(self):
        self.playwright = None
        self.browser: Browser = None
        self.context: BrowserContext = None
        self.page: Page = None
        self.console_errors: List[str] = []
        self.page_errors: List[str] = []

    def start(self) -> Page:
        self.playwright = sync_playwright().start()
        
        # WindowsのMicrosoft Edgeで起動
        try:
            self.browser = self.playwright.chromium.launch(
                channel=BROWSER_CHANNEL,
                headless=HEADLESS,
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
        except Exception as e:
            print(f"[ブラウザ起動フォールバック] Edge起動失敗のためChromeを試行: {e}")
            self.browser = self.playwright.chromium.launch(
                channel="chrome",
                headless=HEADLESS,
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )

        self.context = self.browser.new_context(
            viewport={"width": 1440, "height": 900},
            ignore_https_errors=True
        )
        self.page = self.context.new_page()
        self.page.set_default_timeout(DEFAULT_TIMEOUT_MS)

        # 🚨 ブラウザコンソールエラー ＆ 未補足JS例外リスナー（画面クラッシュを1ミリも見逃さない）
        self.console_errors = []
        self.page_errors = []

        self.page.on("console", lambda msg: self.console_errors.append(msg.text) if msg.type == "error" else None)
        self.page.on("pageerror", lambda err: self.page_errors.append(str(err)))

        return self.page

    def capture_screenshot(self, name: str) -> str:
        """検証結果の証拠スクリーンショットを保存"""
        os.makedirs(os.path.join(REPORTS_DIR, "screenshots"), exist_ok=True)
        file_path = os.path.join(REPORTS_DIR, "screenshots", f"{name}.png")
        try:
            self.page.screenshot(path=file_path, full_page=True)
            return file_path
        except Exception as e:
            print(f"スクリーンショット保存失敗: {e}")
            return ""

    def close(self):
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
