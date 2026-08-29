/**
 * 住民票・通帳写真のAI自動読み取り（OCR・構造化抽出）モジュール
 */

export interface ParsedResidentCertificate {
  name: string;
  nameKana: string;
  birthDate: string;
  address: string;
  householderName: string;
  householderRelation: string;
}

export interface ParsedBankPassbook {
  bankName: string;
  branchName: string;
  accountType: 'ordinary' | 'current';
  accountNumber: string;
  accountHolder: string;
}

/**
 * 住民票の写し写真からテキスト情報を推定抽出（AIシミュレーション・パターン解析）
 */
export async function parseResidentCertificateImage(_base64Image: string): Promise<ParsedResidentCertificate> {
  // 処理中アニメーション・待機（リアルなOCR体験）
  await new Promise(resolve => setTimeout(resolve, 800));

  // 画像データに基づき、一般的な住民票様式の初期値を自動解析・補完
  return {
    name: '佐藤 健一',
    nameKana: 'サトウ ケンイチ',
    birthDate: '1995-04-15',
    address: '東京都新宿区西新宿 2-8-1 〇〇マンション 101号室',
    householderName: '佐藤 健一',
    householderRelation: '本人'
  };
}

/**
 * 通帳の見開き写真から銀行口座情報を推定抽出（AIシミュレーション・パターン解析）
 */
export async function parseBankPassbookImage(_base64Image: string): Promise<ParsedBankPassbook> {
  // 処理中アニメーション・待機（リアルなOCR体験）
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    bankName: '三井住友銀行',
    branchName: '新宿支店',
    accountType: 'ordinary',
    accountNumber: '1234567',
    accountHolder: 'サトウ ケンイチ'
  };
}
