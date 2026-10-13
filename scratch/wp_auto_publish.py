# -*- coding: utf-8 -*-
import requests
import urllib3
import re
import json

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

print("[1] Getting login cookies...")
session.get(LOGIN_URL)

print("[1.5] Logging in...")
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
    print("Login failed!")
    exit(1)

print("[2] Login SUCCESS! Fetching post-new.php for REST nonce...")
r_new = session.get(NEW_PAGE_URL)

# wpApiSettings の nonce を抽出
nonce_match = re.search(r'wpApiSettings\s*=\s*\{[^}]*"nonce"\s*:\s*"([^"]+)"', r_new.text)
if not nonce_match:
    # 別の形式
    nonce_match = re.search(r'"nonce"\s*:\s*"([^"]+)"', r_new.text)

if nonce_match:
    nonce = nonce_match.group(1)
    print(f"[3] Found WP REST Nonce: {nonce}")
else:
    print("Could not find nonce directly, searching in text...")
    for line in r_new.text.split("\n"):
        if "wpApiSettings" in line or "_wpnonce" in line:
            print("Line match:", line[:150])
    exit(1)

# LP HTML ファイルを読み込む
lp_path = "rakumaru_lp.html"
with open(lp_path, "r", encoding="utf-8") as f:
    lp_content = f.read()

# 既存のページに 'rakumaru' スラッグがあるか確認
session.headers.update({"X-WP-Nonce": nonce})
r_check = session.get(f"{REST_PAGES_URL}?slug=rakumaru&status=any")
existing_pages = r_check.json() if r_check.status_code == 200 else []

# Gutenberg カスタムHTMLブロック形式でラップする
block_content = f"<!-- wp:html -->\n{lp_content}\n<!-- /wp:html -->"

page_payload = {
    "title": "みんなのらくまる労務",
    "slug": "rakumaru",
    "status": "publish",
    "content": block_content
}

if existing_pages and len(existing_pages) > 0:
    page_id = existing_pages[0]["id"]
    print(f"[4] Existing page found (ID: {page_id}). Updating...")
    r_post = session.post(f"{REST_PAGES_URL}/{page_id}", json=page_payload)
else:
    print("[4] Creating NEW page...")
    r_post = session.post(REST_PAGES_URL, json=page_payload)

print(f"Result Status: {r_post.status_code}")
if r_post.status_code in [200, 201]:
    res_data = r_post.json()
    print("SUCCESS!")
    print(f"Page ID: {res_data.get('id')}")
    print(f"Page Link: {res_data.get('link')}")
else:
    print("Error response:")
    print(r_post.text[:1000])
