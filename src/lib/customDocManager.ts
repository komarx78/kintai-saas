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
    { key: 'company.address', label: '会社住所', defaultType: 'text', defaultFontSize: 10 },
    { key: 'company.representative_name', label: '代表者職氏名', defaultType: 'text', defaultFontSize: 11 },
    { key: 'company.corporate_number', label: '法人番号 (13桁マス目)', defaultType: 'pitch_text', defaultFontSize: 12, defaultPitch: 1.82 },
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
    { key: 'employee.account_number', label: '口座番号', defaultType: 'text', defaultFontSize: 11 },
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
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse custom doc templates:', e);
  }
  return [];
};

export const saveCustomDocTemplateToStorage = (template: CustomDocTemplate, tenantId?: string) => {
  try {
    const existing = getCustomDocTemplatesFromStorage(tenantId);
    const filtered = existing.filter(t => t.id !== template.id);
    const updated = [template, ...filtered];
    
    localStorage.setItem(tenantId ? `${STORAGE_KEY}_${tenantId}` : STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Supabase バックアップ非同期保存
    if (tenantId) {
      (async () => {
        try {
          await supabase.from('system_settings').upsert({
            tenant_id: tenantId,
            custom_doc_templates: updated,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tenant_id' });
        } catch (err) {
          console.warn('Supabase custom_doc_templates backup error:', err);
        }
      })();
    }
  } catch (e) {
    console.warn('Failed to save custom doc template:', e);
  }
};

export const deleteCustomDocTemplateFromStorage = (templateId: string, tenantId?: string) => {
  try {
    const existing = getCustomDocTemplatesFromStorage(tenantId);
    const updated = existing.filter(t => t.id !== templateId);
    localStorage.setItem(tenantId ? `${STORAGE_KEY}_${tenantId}` : STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to delete custom doc template:', e);
  }
};
