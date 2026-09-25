from ..config import DEFAULT_TEST_TENANT_ID
from ..utils.reporter import PatrolReporter
from ..utils.db_inspector import DbInspector

def run_s07_multitenant_isolation(reporter: PatrolReporter) -> bool:
    """シナリオ07: マルチテナント完全分離 ＆ 他社情報漏洩（RLS）物理監査（憲法3・4）"""
    title = "マルチテナント完全分離 ＆ 他社情報漏洩（company_id拘束）物理監査"
    scenario_id = "SCN-07-MULTITENANT-RLS"

    db = DbInspector()
    target_tables = [
        "department_masters",
        "attendance_records",
        "payslips",
        "employee_onboarding_profiles",
        "store_masters"
    ]

    dummy_tenant_other = "other-company-uuid-0000"
    audit_reports = []
    has_leak = False

    for tbl in target_tables:
        res = db.audit_cross_tenant_isolation(DEFAULT_TEST_TENANT_ID, dummy_tenant_other, tbl)
        if not res["isolated"]:
            has_leak = True
            audit_reports.append(f"❌ {tbl}: 他社データ漏洩 {res['leak_count']}件検知！")
        else:
            audit_reports.append(f"🛡️ {tbl}: 漏洩0件（完全不可視・安全）")

    summary_text = " / ".join(audit_reports)

    if has_leak:
        reporter.add_result(scenario_id, title, "FAILED", f"【重大警報】他社データ混入を検知いたしました: {summary_text}")
        return False
    else:
        reporter.add_result(scenario_id, title, "PASSED", f"全主要テーブル（{', '.join(target_tables)}）において他社データ漏洩は完全に0件。マルチテナント防壁は鉄壁です。{summary_text}")
        return True
