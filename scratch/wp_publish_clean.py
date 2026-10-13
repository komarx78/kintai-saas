# -*- coding: utf-8 -*-
import requests
import urllib3
import re
import json
import sys

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

print("[1] ログイン中...")
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
if "wp-admin" not in r_login.url:
    print("❌ ログイン失敗！")
    exit(1)

r_new = session.get(NEW_PAGE_URL)
nonce_match = re.search(r'wpApiSettings\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"', r_new.text)
nonce = nonce_match.group(1) if nonce_match else ""
session.headers.update({
    "X-WP-Nonce": nonce,
    "Content-Type": "application/json"
})

# WAFに弾かれないか、安全なHTMLブロックでテスト
test_content = "<!-- wp:paragraph --><p>みんなのらくまる労務の公式LPページです。</p><!-- /wp:paragraph -->"

page_payload = {
    "title": "みんなのらくまる労務",
    "slug": "rakumaru",
    "status": "publish",
    "content": test_content
}

# 既存のページ（ID 13等）を探す
r_pages = session.get(f"{REST_PAGES_URL}?per_page=50")
pages = r_pages.json() if r_pages.status_code == 200 else []

target_page_id = None
for p in pages:
    if p.get("slug") == "rakumaru" or p.get("title", {}).get("raw") == "みんなのらくまる労務" or p.get("id") == 13:
        target_page_id = p["id"]
        break

if target_page_id:
    print(f"[2] 既存ページ(ID: {target_page_id})を更新中...")
    r_res = session.post(f"{REST_PAGES_URL}/{target_page_id}", json=page_payload)
else:
    print("[2] 新規固定ページを作成・公開中...")
    r_res = session.post(REST_PAGES_URL, json=page_payload)

print(f"ステータスコード: {r_res.status_code}")
if r_res.status_code in [200, 201]:
    res_data = r_res.json()
    print("🎉【公開大成功！！】")
    print(f"ページID: {res_data.get('id')}")
    print(f"公開URL: {res_data.get('link')}")
else:
    print("エラーレスポンス:")
    print(r_res.text[:500])
