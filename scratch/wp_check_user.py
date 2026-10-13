# -*- coding: utf-8 -*-
import requests
import urllib3
import re
import json
import sys

# Windows UTF-8 出力対策
sys.stdout.reconfigure(encoding='utf-8')

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

WP_URL = "https://kap-cocotte.com"
LOGIN_URL = f"{WP_URL}/wp-login.php"
ADMIN_URL = f"{WP_URL}/wp-admin/"
NEW_PAGE_URL = f"{WP_URL}/wp-admin/post-new.php?post_type=page"
REST_PAGES_URL = f"{WP_URL}/wp-json/wp/v2/pages"

USERNAME = "koma@kap-cocotte.com"
PASSWORD = "Z7CV2rYJs7UmYbpG"

session = requests.Session()
session.verify = False
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})

session.get(LOGIN_URL)
login_data = {
    "log": USERNAME,
    "pwd": PASSWORD,
    "rememberme": "forever",
    "wp-submit": "ログイン",
    "redirect_to": ADMIN_URL,
    "testcookie": "1"
}
r_login = session.post(LOGIN_URL, data=login_data, allow_redirects=True)
print("Login success:", "wp-admin" in r_login.url)

r_new = session.get(NEW_PAGE_URL)

# wpApiSettings の nonce を抽出
nonce_match = re.search(r'wpApiSettings\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"', r_new.text)
nonce = nonce_match.group(1) if nonce_match else ""
print(f"Nonce: {nonce}")

# どのような権限エラーか見る
session.headers.update({
    "X-WP-Nonce": nonce,
    "Content-Type": "application/json"
})

# まずユーザー情報 /wp-json/wp/v2/users/me を取得
r_me = session.get(f"{WP_URL}/wp-json/wp/v2/users/me")
print("Me status:", r_me.status_code)
print("Me response:", r_me.text)

# 固定ページ作成テスト
r_post = session.post(REST_PAGES_URL, json={
    "title": "テストページ",
    "status": "draft"
})
print("Post status:", r_post.status_code)
print("Post response:", r_post.text)
