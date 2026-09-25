import time
from playwright.sync_api import Page
from ..config import BASE_URL

# テスト用デモアカウント情報（環境変数または既定テスト値）
import os
TEST_EMAIL = os.getenv("PATROL_USER_EMAIL", "admin@example.com")
TEST_PASSWORD = os.getenv("PATROL_USER_PASSWORD", "password123")

def login_if_needed(page: Page) -> bool:
    """必要に応じてログイン画面でログインを自動実行"""
    try:
        # 現在のURLがログイン画面かチェック
        current_url = page.url
        is_login_page = ("login" in current_url or current_url.rstrip("/") == BASE_URL.rstrip("/"))
        
        email_input = page.locator("input[type='email']")
        if email_input.count() > 0:
            print("🔑 ログインフォームを検知しました。自動ログインを試行中...")
            email_input.fill(TEST_EMAIL)
            password_input = page.locator("input[type='password']")
            if password_input.count() > 0:
                password_input.fill(TEST_PASSWORD)
            
            submit_btn = page.locator("button:has-text('ログイン')").first
            if submit_btn.count() > 0:
                submit_btn.click()
                page.wait_for_timeout(3000)
                print(f"   ログイン試行完了（遷移後URL: {page.url}）")
                return True
        return False
    except Exception as e:
        print(f"⚠️ 自動ログイン試行例外: {e}")
        return False
