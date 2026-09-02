import { type CustomDocField } from './customDocManager';

// 官公庁様式・社内文書の自動判定プリセット定義
export interface DocumentPresetRule {
  keywords: string[];
  fields: Omit<CustomDocField, 'id'>[];
}

export const OFFICIAL_DOC_PRESETS: DocumentPresetRule[] = [
  // 1. 雇用保険被保険者資格取得届
  {
    keywords: ['雇用保険', '資格取得', 'ハローワーク', '公共職業安定所'],
    fields: [
      { label: '事業所名', sourceKey: 'company.name', x: 22.0, y: 14.5, fontSize: 11, type: 'text' },
      { label: '法人番号', sourceKey: 'company.corporate_number', x: 22.0, y: 11.5, fontSize: 12, pitch: 1.82, type: 'pitch_text' },
      { label: '被保険者番号', sourceKey: 'employee.employment_insurance_number', x: 22.0, y: 19.5, fontSize: 12, pitch: 1.82, type: 'pitch_text' },
      { label: '氏名（フリガナ）', sourceKey: 'employee.name_kana', x: 22.0, y: 24.0, fontSize: 9, type: 'text' },
      { label: '氏名（漢字）', sourceKey: 'employee.name', x: 22.0, y: 27.5, fontSize: 13, type: 'text' },
      { label: '生年月日(和暦年)', sourceKey: 'employee.birth_date_wareki_y', x: 27.0, y: 32.5, fontSize: 11, type: 'text' },
      { label: '生年月日(月)', sourceKey: 'employee.birth_date_m', x: 33.5, y: 32.5, fontSize: 11, type: 'text' },
      { label: '生年月日(日)', sourceKey: 'employee.birth_date_d', x: 39.5, y: 32.5, fontSize: 11, type: 'text' },
      { label: '現住所', sourceKey: 'employee.address', x: 22.0, y: 38.0, fontSize: 10, type: 'text' },
      { label: '入社年月日(和暦)', sourceKey: 'employee.join_date_wareki', x: 22.0, y: 44.0, fontSize: 11, type: 'text' },
      { label: '基本給(賃金月額)', sourceKey: 'employee.base_salary', x: 22.0, y: 50.0, fontSize: 11, type: 'text' },
      { label: 'マイナンバー', sourceKey: 'employee.my_number', x: 22.0, y: 56.5, fontSize: 12, pitch: 1.82, type: 'pitch_text' },
    ]
  },
  // 2. 健康保険・厚生年金保険 被保険者資格取得届
  {
    keywords: ['健康保険', '厚生年金', '年金機構', '年金事務所', '社会保険'],
    fields: [
      { label: '事業所名', sourceKey: 'company.name', x: 25.0, y: 13.0, fontSize: 11, type: 'text' },
      { label: '事業所所在地', sourceKey: 'company.address', x: 25.0, y: 16.5, fontSize: 10, type: 'text' },
      { label: '代表者氏名', sourceKey: 'company.representative_name', x: 25.0, y: 20.0, fontSize: 11, type: 'text' },
      { label: '被保険者氏名', sourceKey: 'employee.name', x: 30.0, y: 29.0, fontSize: 13, type: 'text' },
      { label: '氏名フリガナ', sourceKey: 'employee.name_kana', x: 30.0, y: 26.0, fontSize: 9, type: 'text' },
      { label: '生年月日(和暦年)', sourceKey: 'employee.birth_date_wareki_y', x: 34.0, y: 34.5, fontSize: 11, type: 'text' },
      { label: '生年月日(月)', sourceKey: 'employee.birth_date_m', x: 40.0, y: 34.5, fontSize: 11, type: 'text' },
      { label: '生年月日(日)', sourceKey: 'employee.birth_date_d', x: 46.0, y: 34.5, fontSize: 11, type: 'text' },
      { label: '基礎年金番号', sourceKey: 'employee.pension_number', x: 30.0, y: 40.0, fontSize: 12, pitch: 1.82, type: 'pitch_text' },
      { label: 'マイナンバー', sourceKey: 'employee.my_number', x: 30.0, y: 45.5, fontSize: 12, pitch: 1.82, type: 'pitch_text' },
      { label: '月額報酬(基本給)', sourceKey: 'employee.base_salary', x: 30.0, y: 52.0, fontSize: 11, type: 'text' },
      { label: '入社年月日', sourceKey: 'employee.join_date_wareki', x: 30.0, y: 58.0, fontSize: 11, type: 'text' },
    ]
  },
  // 3. 身元保証書・入社誓約書・秘密保持誓約書
  {
    keywords: ['身元保証', '誓約書', '秘密保持', '入社承諾', '同意書'],
    fields: [
      { label: '会社名（宛先）', sourceKey: 'company.name', x: 15.0, y: 16.0, fontSize: 13, type: 'text' },
      { label: '代表者名', sourceKey: 'company.representative_name', x: 15.0, y: 20.0, fontSize: 12, type: 'text' },
      { label: '入社年月日', sourceKey: 'employee.join_date_wareki', x: 65.0, y: 72.0, fontSize: 11, type: 'text' },
      { label: '本人現住所', sourceKey: 'employee.address', x: 65.0, y: 76.5, fontSize: 10, type: 'text' },
      { label: '本人氏名', sourceKey: 'employee.name', x: 65.0, y: 81.5, fontSize: 13, type: 'text' },
    ]
  }
];

// 汎用帳票のスマートデフォルト配置（帳票の上・中・下に黄金比で配置）
export const GENERAL_SMART_FIELDS: Omit<CustomDocField, 'id'>[] = [
  { label: '会社名', sourceKey: 'company.name', x: 20.0, y: 12.0, fontSize: 11, type: 'text' },
  { label: '代表者名', sourceKey: 'company.representative_name', x: 20.0, y: 15.5, fontSize: 11, type: 'text' },
  { label: '社員氏名', sourceKey: 'employee.name', x: 25.0, y: 24.0, fontSize: 13, type: 'text' },
  { label: 'フリガナ', sourceKey: 'employee.name_kana', x: 25.0, y: 21.0, fontSize: 9, type: 'text' },
  { label: '生年月日(和暦)', sourceKey: 'employee.birth_date_wareki_y', x: 25.0, y: 28.5, fontSize: 11, type: 'text' },
  { label: '現住所', sourceKey: 'employee.address', x: 25.0, y: 34.0, fontSize: 10, type: 'text' },
  { label: '電話番号', sourceKey: 'employee.phone', x: 25.0, y: 39.0, fontSize: 10, type: 'text' },
  { label: '入社日', sourceKey: 'employee.join_date_wareki', x: 25.0, y: 44.5, fontSize: 11, type: 'text' },
  { label: '所属部署', sourceKey: 'employee.department', x: 25.0, y: 50.0, fontSize: 11, type: 'text' },
  { label: '基本給', sourceKey: 'employee.base_salary', x: 25.0, y: 55.5, fontSize: 11, type: 'text' },
  { label: '振込銀行', sourceKey: 'employee.bank_name', x: 25.0, y: 62.0, fontSize: 10, type: 'text' },
  { label: '口座番号', sourceKey: 'employee.account_number', x: 25.0, y: 66.5, fontSize: 11, type: 'text' },
  { label: '口座名義人', sourceKey: 'employee.account_holder', x: 25.0, y: 71.0, fontSize: 11, type: 'text' },
];

/**
 * 🤖 AIによる帳票自動解析 ＆ フィールド初期配置
 * @param title 書類名
 * @param fileName ファイル名
 * @param canvasImageBase64 PDFの1ページ目画像 (任意: Gemini Vision解析用)
 * @param apiKey Gemini APIキー (任意)
 */
export async function detectFieldsWithAi(
  title: string,
  fileName: string,
  canvasImageBase64?: string,
  apiKey?: string
): Promise<{ fields: CustomDocField[]; matchedPresetName: string }> {
  const combinedText = `${title} ${fileName}`.toLowerCase();

  // 1. Gemini Vision APIキーがある場合、高度な視覚認識を実行
  if (apiKey && canvasImageBase64) {
    try {
      const prompt = `あなたは日本の労務・税務公的書類のOCR解析エンジンです。
添付された官公庁PDF画像（A4用紙）を解析し、記入欄・マス目の位置（X座標%, Y座標% : 0〜100）を特定してください。
以下のJSON形式のみを出力してください（Markdownコードブロックなし）。
[
  { "label": "氏名", "sourceKey": "employee.name", "x": 25.0, "y": 28.0, "fontSize": 12, "type": "text" },
  { "label": "マイナンバー", "sourceKey": "employee.my_number", "x": 25.0, "y": 45.0, "fontSize": 12, "pitch": 1.82, "type": "pitch_text" }
]
利用可能なsourceKey: company.name, company.address, company.corporate_number, company.representative_name, employee.name, employee.name_kana, employee.birth_date_wareki_y, employee.birth_date_m, employee.birth_date_d, employee.address, employee.phone, employee.my_number, employee.pension_number, employee.employment_insurance_number, employee.join_date_wareki, employee.base_salary, employee.bank_name, employee.account_number, employee.account_holder, employee.spouse_name`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: canvasImageBase64.replace(/^data:image\/\w+;base64,/, '') } }
            ]
          }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });

      if (res.ok) {
        const json = await res.json();
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const detected = parsed.map((item: any, idx: number) => ({
              id: `field_ai_${Date.now()}_${idx}`,
              label: item.label || '項目',
              sourceKey: item.sourceKey || 'employee.name',
              x: Number(item.x) || 30,
              y: Number(item.y) || 30,
              fontSize: Number(item.fontSize) || 11,
              pitch: item.pitch ? Number(item.pitch) : undefined,
              type: item.type || 'text'
            }));
            return { fields: detected, matchedPresetName: 'Gemini Vision 高度画像認識' };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini Vision document detection failed, falling back to smart rules:', e);
    }
  }

  // 2. キーワード・公的様式スマートプリセット認識
  for (const preset of OFFICIAL_DOC_PRESETS) {
    if (preset.keywords.some(kw => combinedText.includes(kw.toLowerCase()))) {
      const generated = preset.fields.map((f, idx) => ({
        ...f,
        id: `field_preset_${Date.now()}_${idx}`
      }));
      return { fields: generated, matchedPresetName: `${preset.keywords[0]} 公式様式プリセット` };
    }
  }

  // 3. 汎用スマートデフォルト配置
  const defaultFields = GENERAL_SMART_FIELDS.map((f, idx) => ({
    ...f,
    id: `field_gen_${Date.now()}_${idx}`
  }));
  return { fields: defaultFields, matchedPresetName: '汎用労務申請書 スマート自動配置' };
}
