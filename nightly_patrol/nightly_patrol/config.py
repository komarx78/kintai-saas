import os

# 🌐 テスト対象ターゲット設定
# ローカル開発サーバー(http://localhost:5173) または 本番/ステージングURL
BASE_URL = os.getenv("PATROL_TARGET_URL", "http://localhost:5173")

# 🖥️ ブラウザ実行設定
# 夜間無人時は True（画面非表示で超高速実行）、日中デバッグ時は False（画面を見ながら実行）
HEADLESS = os.getenv("PATROL_HEADLESS", "true").lower() == "true"
BROWSER_CHANNEL = "msedge"  # Windows標準のMicrosoft Edgeを活用
DEFAULT_TIMEOUT_MS = 15000  # 各アクションの最大待機時間（15秒）

# 🛡️ Supabase 実DB直接監査設定（司馬懿の眼）
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://phhrulzeaomqsvrregpc.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_8_P6N71OloWQOjDU8vQcCw_HG4Yl71Y")

# 🏢 テスト用テナント設定
# 既存の本番会社を壊さないためのテスト用識別子
DEFAULT_TEST_TENANT_ID = os.getenv("TEST_TENANT_ID", "demo-tenant-id")

# 📋 レポート保存先
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")
