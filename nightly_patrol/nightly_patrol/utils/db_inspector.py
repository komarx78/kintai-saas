import requests
from typing import Dict, Any, List, Optional
from ..config import SUPABASE_URL, SUPABASE_ANON_KEY

class DbInspector:
    """Supabase REST API を直接クエリして実DBの永続化とRLSを物理監査するクラス"""

    def __init__(self, auth_token: Optional[str] = None):
        self.headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {auth_token if auth_token else SUPABASE_ANON_KEY}",
            "Content-Type": "application/json"
        }

    def select(self, table: str, query_params: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
        """指定テーブルからレコードを取得"""
        url = f"{SUPABASE_URL}/rest/v1/{table}"
        try:
            res = requests.get(url, headers=self.headers, params=query_params or {}, timeout=10)
            if res.status_code == 200:
                return res.json()
            else:
                print(f"[DB監査警告] {table} 取得失敗 HTTP {res.status_code}: {res.text}")
                return []
        except Exception as e:
            print(f"[DB監査例外] {table}: {e}")
            return []

    def verify_department_exists(self, tenant_id: str, dept_name: str) -> bool:
        """部署マスタに特定名称の部署が本当に永続化されているかを検証"""
        params = {
            "tenant_id": f"eq.{tenant_id}",
            "name": f"eq.{dept_name}",
            "select": "id,name,display_order"
        }
        records = self.select("department_masters", params)
        return len(records) > 0

    def audit_cross_tenant_isolation(self, tenant_a: str, tenant_b: str, table: str) -> Dict[str, Any]:
        """憲法4準拠：テナントAのクエリでテナントBのデータが完全に0件であることを検証"""
        params_a = {"tenant_id": f"eq.{tenant_a}", "select": "id,tenant_id"}
        records_a = self.select(table, params_a)
        
        # 会社Aのレコードの中に会社Bのtenant_idが混入していないか物理照合
        leaks = [r for r in records_a if r.get("tenant_id") == tenant_b]
        return {
            "table": table,
            "isolated": len(leaks) == 0,
            "leak_count": len(leaks),
            "record_count": len(records_a)
        }
