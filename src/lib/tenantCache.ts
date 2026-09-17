/**
 * テナントキャッシュ安全隔離・パージユーティリティ（憲法3条・憲法9条 遵守）
 * ブラウザのLocalStorageに他社の情報が残存・漏洩することを物理的に遮断する。
 */

// テナント未分離（グローバル）の危険なレガシーキー一覧
const GLOBAL_LEGACY_KEYS = [
  'company_basic_info',
  'company_seal_image',
  'labor_contract_template',
  'company_departments',
  'company_qualifications',
  'company_employment_rules',
  'gemini_api_key_custom',
  'portal_announcements',
  'mock_company_holidays',
  'mock_rounding_unit',
  'revision_contracts',
  'onboarding_workflow_steps',
  'company_position_masters',
  'bonusDocMasterVersion',
  'bonusDocMasterFields',
  'employment_loss_doc_coordinates_custom_v1',
  'taxDocMasterFields',
];

// テナント分離プレフィックス一覧
const TENANT_KEY_PREFIXES = [
  'company_basic_settings_',
  'company_seal_image_',
  'company_leave_rules_',
  'company_employment_rules_',
  'labor_contract_template_',
  'company_departments_',
  'company_qualifications_',
  'gemini_api_key_',
  'portal_announcements_',
  'mock_company_holidays_',
  'mock_rounding_unit_',
  'revision_contracts_',
  'onboarding_workflow_steps_',
  'company_position_masters_',
  'user_positions_',
  'roster_custom_',
  'attendance_closing_',
  'mf_bonus_campaigns_',
  'maternity_leave_record_',
  'employee_master_backup_',
  'bonus_doc_coordinates_',
  'employment_loss_doc_coordinates_',
  'tax_doc_coordinates_',
];

/**
 * 1. テナント未分離の危険なレガシーグローバルキーを即座に完全抹消する
 */
export function purgeAllLegacyGlobalCache(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of GLOBAL_LEGACY_KEYS) {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('purgeAllLegacyGlobalCache error:', e);
  }
}

/**
 * 2. 指定されたテナント以外の全キャッシュ（他社キャッシュ）を物理パージする
 * @param currentTenantId 現在認証中の自社テナントID（未指定の場合は全テナントキャッシュをパージ）
 */
export function purgeTenantLocalStorageCache(currentTenantId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    // まずグローバルレガシーキーを消去
    purgeAllLegacyGlobalCache();

    // LocalStorageの全キーを走査
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // テナントプレフィックスに合致するか判定
      for (const prefix of TENANT_KEY_PREFIXES) {
        if (key.startsWith(prefix)) {
          // 自社テナントIDが指定されており、自社キーである場合は保持
          if (currentTenantId && key === `${prefix}${currentTenantId}`) {
            continue;
          }
          // 他社キーまたは currentTenantId 未指定の場合は消去対象
          keysToRemove.push(key);
          break;
        }
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch (e) {
    console.warn('purgeTenantLocalStorageCache error:', e);
  }
}
