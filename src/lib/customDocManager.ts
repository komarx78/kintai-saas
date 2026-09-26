import { supabase } from './supabase';

export interface CustomDocField {
  id: string;
  label: string;
  sourceKey: string; // 'employee.name', 'employee.birth_date_wareki', 'company.name', 'employee.my_number', etc.
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt
  pitch?: number; // マス目文字間隔 (%)
  type: 'text' | 'circle' | 'check' | 'pitch_text';
}

export interface CustomDocTemplate {
  id: string;
  tenant_id?: string; // マルチテナント完全分離（所属テナント識別子）
  is_system_preset?: boolean; // プラットフォーム公式プリセットかどうか
  title: string;
  description?: string;
  category: 'tax' | 'social_insurance' | 'labor' | 'internal';
  pdfDataUrl: string; // Base64 or URL
  fields: CustomDocField[];
  createdAt: string;
  updatedAt: string;
}

// 🎯 ワンクリックで追加できる大元データ（SSOT）プリセット一覧
export const AVAILABLE_DATA_SOURCES = [
  { group: '会社情報', items: [
    { key: 'company.name', label: '会社名（事業所名）', defaultType: 'text', defaultFontSize: 11 },
    { key: 'company.postal_code', label: '会社郵便番号', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.address', label: '会社住所', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.representative_name', label: '代表者職氏名', defaultType: 'text', defaultFontSize: 11 },
    { key: 'company.representative_position', label: '代表者役職名', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.corporate_number', label: '法人番号 (13桁マス目)', defaultType: 'pitch_text', defaultFontSize: 12, defaultPitch: 1.82 },
    { key: 'company.labor_insurance_number', label: '労働保険番号 (14桁)', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.employment_insurance_office_number', label: '雇用保険適用事業所番号 (11桁)', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.phone', label: '会社電話番号', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.tax_office_name', label: '所轄税務署名', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.nenkin_office_name', label: '所轄年金事務所名', defaultType: 'text', defaultFontSize: 10 },
  ]},
  { group: '従業員 本人情報', items: [
    { key: 'employee.name', label: '氏名（漢字）', defaultType: 'text', defaultFontSize: 13 },
    { key: 'employee.name_kana', label: '氏名（フリガナ）', defaultType: 'text', defaultFontSize: 9 },
    { key: 'employee.birth_date_wareki_y', label: '生年月日 元号年 (和暦数字)', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.birth_date_m', label: '生年月日 月', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.birth_date_d', label: '生年月日 日', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.birth_date_seireki', label: '生年月日（西暦 YYYY-MM-DD）', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.address', label: '現住所', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.postal_code', label: '郵便番号', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.postal_code_pitch', label: '郵便番号 (7桁マス目)', defaultType: 'pitch_text', defaultFontSize: 11, defaultPitch: 2.1 },
    { key: 'employee.phone', label: '電話番号', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.householder_name', label: '世帯主氏名', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.householder_relation', label: '世帯主との続柄', defaultType: 'text', defaultFontSize: 10 },
  ]},
  { group: 'マイナンバー・社保番号', items: [
    { key: 'employee.my_number', label: 'マイナンバー (12桁マス目)', defaultType: 'pitch_text', defaultFontSize: 12, defaultPitch: 1.82 },
    { key: 'employee.pension_number', label: '基礎年金番号 (10桁)', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.employment_insurance_number', label: '雇用保険被保険者番号 (11桁)', defaultType: 'text', defaultFontSize: 11 },
  ]},
  { group: '雇用・給与・口座', items: [
    { key: 'employee.join_date_wareki', label: '入社年月日 (和暦)', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.join_date_seireki', label: '入社年月日 (西暦)', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.department', label: '所属部署名', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.position_name', label: '役職名', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.base_salary', label: '基本給 (月額円)', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.hourly_wage', label: '時給単価 (円)', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.bank_name', label: '振込銀行名', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.branch_name', label: '振込支店名', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.account_type', label: '口座種目 (普通/当座)', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.account_number', label: '口座番号 (7桁全銀協規格)', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.account_holder', label: '口座名義人', defaultType: 'text', defaultFontSize: 11 },
  ]},
  { group: '配偶者・扶養家族', items: [
    { key: 'employee.spouse_name', label: '配偶者 氏名', defaultType: 'text', defaultFontSize: 12 },
    { key: 'employee.spouse_name_kana', label: '配偶者 フリガナ', defaultType: 'text', defaultFontSize: 9 },
    { key: 'employee.spouse_birth_date', label: '配偶者 生年月日', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.spouse_income_estimate', label: '配偶者 所得見積額', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.dependents_count', label: '扶養親族等の数', defaultType: 'text', defaultFontSize: 12 },
    { key: 'employee.dep1_name', label: '扶養親族1 氏名', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.dep1_relation', label: '扶養親族1 続柄', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.dep1_birth_date', label: '扶養親族1 生年月日', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.dep2_name', label: '扶養親族2 氏名', defaultType: 'text', defaultFontSize: 11 },
    { key: 'employee.dep2_relation', label: '扶養親族2 続柄', defaultType: 'text', defaultFontSize: 10 },
    { key: 'employee.dep2_birth_date', label: '扶養親族2 生年月日', defaultType: 'text', defaultFontSize: 10 },
  ]},
  { group: '汎用マーク・固定文字', items: [
    { key: 'static.circle', label: '○ 印（元号選択・チェック用）', defaultType: 'circle', defaultFontSize: 12 },
    { key: 'static.check', label: '✓ チェックマーク', defaultType: 'check', defaultFontSize: 12 },
    { key: 'static.text', label: '固定テキスト（自由入力）', defaultType: 'text', defaultFontSize: 10 },
  ]}
];

// LocalStorage キー
const STORAGE_KEY = 'custom_doc_templates';

export const getCustomDocTemplatesFromStorage = (tenantId?: string): CustomDocTemplate[] => {
  try {
    const raw = localStorage.getItem(tenantId ? `${STORAGE_KEY}_${tenantId}` : STORAGE_KEY);
    if (raw) {
      const parsed: CustomDocTemplate[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (tenantId) {
          // 他テナントIDが付与された異物混入を物理フィルタリング
          return parsed.filter(t => !t.tenant_id || t.tenant_id === tenantId || t.is_system_preset);
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse custom doc templates:', e);
  }
  return [];
};

/**
 * データベース（tenants / system_settings）からカスタム書類テンプレートを同期取得
 * ※マルチテナント完全分離（憲法3条・4条）：他社データ混入を100%遮断
 */
export const fetchCustomDocTemplates = async (tenantId?: string): Promise<CustomDocTemplate[]> => {
  if (tenantId) {
    let list = getCustomDocTemplatesFromStorage(tenantId);
    try {
      // 1. 対象テナント専用のカスタム帳票を取得（tenants SSOT）
      const { data: tData, error: tErr } = await supabase
        .from('tenants')
        .select('custom_doc_templates')
        .eq('id', tenantId)
        .maybeSingle();

      if (!tErr && tData?.custom_doc_templates && Array.isArray(tData.custom_doc_templates) && tData.custom_doc_templates.length > 0) {
        list = tData.custom_doc_templates.map((t: CustomDocTemplate) => ({ ...t, tenant_id: tenantId }));
        localStorage.setItem(`${STORAGE_KEY}_${tenantId}`, JSON.stringify(list));
        return list;
      }

      // 2. テナント独自帳票が未登録の場合、システム公式プリセット（is_system_preset === true）のみを取得許可
      try {
        const { data: sData } = await supabase
          .from('system_settings')
          .select('custom_doc_templates')
          .limit(1)
          .maybeSingle();

        if (sData?.custom_doc_templates && Array.isArray(sData.custom_doc_templates)) {
          const presetsOnly = sData.custom_doc_templates.filter((t: CustomDocTemplate) => t.is_system_preset || !t.tenant_id);
          if (presetsOnly.length > 0) {
            list = presetsOnly;
            localStorage.setItem(`${STORAGE_KEY}_${tenantId}`, JSON.stringify(list));
            return list;
          }
        }
      } catch (_) {
        // 安全にフォールバック
      }
    } catch (err) {
      console.warn('fetchCustomDocTemplates error:', err);
    }
    return list;
  }

  // tenantId 未指定時（SuperAdmin・プラットフォーム共通プリセット管理）
  let globalList = getCustomDocTemplatesFromStorage();
  try {
    const { data: sData } = await supabase
      .from('system_settings')
      .select('custom_doc_templates')
      .limit(1)
      .maybeSingle();

    if (sData?.custom_doc_templates && Array.isArray(sData.custom_doc_templates)) {
      globalList = sData.custom_doc_templates;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(globalList));
      return globalList;
    }
  } catch (err) {
    console.warn('fetchCustomDocTemplates (global) error:', err);
  }
  return globalList;
};

export const saveCustomDocTemplateToStorage = (template: CustomDocTemplate, tenantId?: string) => {
  try {
    const targetTenantId = tenantId || template.tenant_id;
    const templateToSave: CustomDocTemplate = {
      ...template,
      tenant_id: targetTenantId || undefined,
      is_system_preset: !targetTenantId ? true : (template.is_system_preset || false),
      updatedAt: new Date().toISOString()
    };

    if (targetTenantId) {
      // 🔒 テナント専用保存（他社漏洩・system_settings汚染を物理遮断）
      const existing = getCustomDocTemplatesFromStorage(targetTenantId);
      const filtered = existing.filter(t => t.id !== templateToSave.id);
      const updated = [templateToSave, ...filtered];

      localStorage.setItem(`${STORAGE_KEY}_${targetTenantId}`, JSON.stringify(updated));

      // Supabase tenants テーブルのみを更新
      (async () => {
        try {
          await supabase.from('tenants').update({
            custom_doc_templates: updated
          }).eq('id', targetTenantId);
        } catch (err) {
          console.warn('Supabase tenant custom_doc_templates save error:', err);
        }
      })();
    } else {
      // 🌐 SuperAdmin用（全社共通・公式プリセット帳票）の保存
      const existing = getCustomDocTemplatesFromStorage();
      const filtered = existing.filter(t => t.id !== templateToSave.id);
      const updated = [templateToSave, ...filtered];

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      (async () => {
        try {
          const { data: sysRow } = await supabase.from('system_settings').select('id').limit(1).maybeSingle();
          if (sysRow?.id) {
            await supabase.from('system_settings').update({
              custom_doc_templates: updated,
              updated_at: new Date().toISOString()
            }).eq('id', sysRow.id);
          }
        } catch (err) {
          console.warn('Supabase global custom_doc_templates save error:', err);
        }
      })();
    }
  } catch (e) {
    console.warn('Failed to save custom doc template:', e);
  }
};

export const deleteCustomDocTemplateFromStorage = (templateId: string, tenantId?: string) => {
  try {
    if (tenantId) {
      // テナント専用の削除
      const existing = getCustomDocTemplatesFromStorage(tenantId);
      const updated = existing.filter(t => t.id !== templateId);
      localStorage.setItem(`${STORAGE_KEY}_${tenantId}`, JSON.stringify(updated));

      (async () => {
        try {
          await supabase.from('tenants').update({ custom_doc_templates: updated }).eq('id', tenantId);
        } catch (err) {
          console.warn('Supabase tenant custom_doc_templates delete error:', err);
        }
      })();
    } else {
      // SuperAdmin用の削除
      const existing = getCustomDocTemplatesFromStorage();
      const updated = existing.filter(t => t.id !== templateId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      (async () => {
        try {
          const { data: sysRow } = await supabase.from('system_settings').select('id').limit(1).maybeSingle();
          if (sysRow?.id) {
            await supabase.from('system_settings').update({
              custom_doc_templates: updated,
              updated_at: new Date().toISOString()
            }).eq('id', sysRow.id);
          }
        } catch (err) {
          console.warn('Supabase global custom_doc_templates delete error:', err);
        }
      })();
    }
  } catch (e) {
    console.warn('Failed to delete custom doc template:', e);
  }
};
