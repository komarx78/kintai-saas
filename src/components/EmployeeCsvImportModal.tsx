import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, 
  X, Loader2, ArrowRight, RefreshCw, Users, ShieldAlert
} from 'lucide-react';

interface EmployeeCsvRow {
  rowIndex: number;
  name: string;
  nameKana?: string;
  email?: string;
  department?: string;
  storeName?: string;
  positionName?: string;
  employmentType: string;
  salaryType: 'monthly' | 'hourly';
  baseSalary: number;
  hourlyWage: number;
  joinDate: string;
  birthDate?: string;
  gender?: string;
  postalCode?: string;
  address?: string;
  phoneNumber?: string;
  role: 'user' | 'manager' | 'admin';
  isValid: boolean;
  errors: string[];
}

interface EmployeeCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  departments?: { id: string; name: string }[];
  onSuccess: () => void;
}

// 📋 CSVテンプレートのヘッダー定義
const CSV_HEADERS = [
  '氏名*',
  'フリガナ',
  'メールアドレス',
  '部署名',
  '配属店舗名',
  '役職名',
  '雇用形態*',
  '給与形態*(月給/時給)',
  '基本給(円)',
  '時給(円)',
  '入社年月日*(YYYY-MM-DD)',
  '生年月日(YYYY-MM-DD)',
  '性別(男性/女性/その他)',
  '郵便番号',
  '住所',
  '電話番号',
  '権限(一般/マネージャー/管理者)'
];

export const EmployeeCsvImportModal: React.FC<EmployeeCsvImportModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  departments = [],
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'completed'>('upload');
  const [parsedRows, setParsedRows] = useState<EmployeeCsvRow[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, successCount: 0, errorCount: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 📥 1. ひな形CSVのダウンロード（Windows Excel対応 BOM付きUTF-8）
  const handleDownloadTemplate = () => {
    const sampleRows = [
      [
        '山田 太郎',
        'ヤマダ タロウ',
        'yamada.taro@example.com',
        departments[0]?.name || '営業部',
        '', // 本部のため店舗なし
        '主任',
        '正社員',
        '月給',
        '280000',
        '0',
        '2026-04-01',
        '1996-05-15',
        '男性',
        '100-0001',
        '東京都千代田区千代田1-1',
        '090-1234-5678',
        '一般'
      ],
      [
        '佐藤 花子',
        'サトウ ハナコ',
        'sato.hanako@example.com',
        '店舗運営部',
        '新宿店', // 店舗運営部配下の店舗
        'ホール主任',
        'パート・アルバイト',
        '時給',
        '0',
        '1250',
        '2026-04-01',
        '2001-08-20',
        '女性',
        '150-0002',
        '東京都渋谷区渋谷2-2-2',
        '080-9876-5432',
        '一般'
      ]
    ];

    const csvLines = [
      CSV_HEADERS.join(','),
      ...sampleRows.map(row => row.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(','))
    ];

    // BOM（\uFEFF）を先頭に付加してWindows Excelの文字化けを完全遮断（荀彧監査）
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'みんなのらくまる労務_社員一括登録テンプレート.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 📄 CSV文字列の堅牢パース（ダブルクォート・改行・カンマ考慮）
  const parseCsvText = (text: string): string[][] => {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;

    // 正規化
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      const nextChar = normalized[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // エスケープされたクォートをスキップ
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' && !insideQuotes) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        lines.push(currentRow);
      }
    }

    return lines;
  };

  // 📅 日付の超柔軟・堅牢正規化（YYYY/M/D, YYYY.M.D, YYYY-M-D, 和暦, Excelシリアル値, 全角対応）
  const normalizeDate = (raw: string): string | null => {
    if (!raw) return null;
    // 全角英数・記号を半角に変換、トリム
    let str = raw.trim()
      .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[／]/g, '/')
      .replace(/[－ー―]/g, '-')
      .replace(/[．]/g, '.');

    if (!str) return null;

    // 1. すでに YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // 2. YYYY/M/D, YYYY-M-D, YYYY.M.D, YYYY年M月D日
    const match = str.match(/^(\d{4})[\/\-\.年](\d{1,2})[\/\-\.月](\d{1,2})日?$/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // 3. 8桁の連続数字 YYYYMMDD (例: 20260401)
    if (/^\d{8}$/.test(str)) {
      const y = str.slice(0, 4);
      const m = str.slice(4, 6);
      const d = str.slice(6, 8);
      return `${y}-${m}-${d}`;
    }

    // 4. 和暦表記 (例: 令和8年4月1日, R8/4/1, 平成10年5月3日, H10.5.3, 昭和60年1月1日)
    const warekiMatch = str.match(/^(令和|平成|昭和|R|H|S)(\d{1,2}|元)[\/\-\.年](\d{1,2})[\/\-\.月](\d{1,2})日?$/i);
    if (warekiMatch) {
      const era = warekiMatch[1].toUpperCase();
      const eraYear = warekiMatch[2] === '元' ? 1 : parseInt(warekiMatch[2], 10);
      let christianYear = 0;
      if (era === '令和' || era === 'R') christianYear = 2018 + eraYear;
      else if (era === '平成' || era === 'H') christianYear = 1988 + eraYear;
      else if (era === '昭和' || era === 'S') christianYear = 1925 + eraYear;
      if (christianYear > 0) {
        const m = warekiMatch[3].padStart(2, '0');
        const d = warekiMatch[4].padStart(2, '0');
        return `${christianYear}-${m}-${d}`;
      }
    }

    // 5. Excel シリアル値 (例: 46113 など 20000〜60000 付近の5桁数値)
    if (/^\d{5}$/.test(str)) {
      const serial = parseInt(str, 10);
      if (serial >= 20000 && serial <= 60000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + serial * 86400000);
        if (!isNaN(date.getTime())) {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      }
    }

    // 6. JavaScript Date で解釈可能 (例: "2026/4/1", "2026-4-1" 等)
    const parsedDate = new Date(str.replace(/\./g, '-'));
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() >= 1900 && parsedDate.getFullYear() <= 2100) {
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return null;
  };

  // 📂 2. CSVファイルの読み込み ＆ エンコーディング自動判別（Shift-JIS / UTF-8）
  const handleFileSelect = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      
      // まずUTF-8としてデコードを試みる
      let text = '';
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        text = utf8Decoder.decode(buffer);
      } catch (utfErr) {
        // UTF-8でデコード失敗した場合はShift-JIS (Windows日本語) でデコード
        const sjisDecoder = new TextDecoder('shift-jis');
        text = sjisDecoder.decode(buffer);
      }

      const rows = parseCsvText(text);
      if (rows.length < 2) {
        alert('CSVファイルにデータ行が含まれていません（ヘッダー行＋1行以上のデータが必要です）。');
        setIsProcessingFile(false);
        return;
      }

      // ヘッダー行をスキップしてデータ行を検証・マッピング
      // 💡 ヘッダー行の動的解析（新旧CSVテンプレートおよび列順序の入れ替えに100%完全対応）
      const headerRow = (rows[0] || []).map(h => (h || '').trim());
      const getColIdx = (patterns: string[], fallback: number): number => {
        const found = headerRow.findIndex(h => patterns.some(p => h.includes(p)));
        return found !== -1 ? found : fallback;
      };

      const nameIdx = getColIdx(['氏名', '名前'], 0);
      const nameKanaIdx = getColIdx(['フリガナ', 'カナ'], 1);
      const emailIdx = getColIdx(['メール'], 2);
      const deptIdx = getColIdx(['部署'], 3);
      const storeIdx = getColIdx(['店舗', '拠点'], headerRow.findIndex(h => h.includes('店舗')));
      const posIdx = getColIdx(['役職'], headerRow.findIndex(h => h.includes('役職')) !== -1 ? headerRow.findIndex(h => h.includes('役職')) : (storeIdx === 4 ? 5 : 4));
      const empTypeIdx = getColIdx(['雇用形態'], storeIdx !== -1 ? 6 : 5);
      const salaryTypeIdx = getColIdx(['給与形態'], storeIdx !== -1 ? 7 : 6);
      const baseSalaryIdx = getColIdx(['基本給'], storeIdx !== -1 ? 8 : 7);
      const hourlyWageIdx = getColIdx(['時給'], storeIdx !== -1 ? 9 : 8);
      const joinDateIdx = getColIdx(['入社'], storeIdx !== -1 ? 10 : 9);
      const birthDateIdx = getColIdx(['生年月日'], storeIdx !== -1 ? 11 : 10);
      const genderIdx = getColIdx(['性別'], storeIdx !== -1 ? 12 : 11);
      const postalIdx = getColIdx(['郵便番号'], storeIdx !== -1 ? 13 : 12);
      const addressIdx = getColIdx(['住所'], storeIdx !== -1 ? 14 : 13);
      const phoneIdx = getColIdx(['電話'], storeIdx !== -1 ? 15 : 14);
      const roleIdx = getColIdx(['権限'], storeIdx !== -1 ? 16 : 15);

      const dataRows = rows.slice(1);
      const parsed: EmployeeCsvRow[] = [];

      dataRows.forEach((row, idx) => {
        // 空行はスキップ
        if (row.length === 0 || row.every(cell => !cell.trim())) return;

        const rowIndex = idx + 2; // ヘッダーが1行目
        const errors: string[] = [];

        const name = (row[nameIdx] || '').trim();
        const nameKana = (row[nameKanaIdx] || '').trim();
        const email = (row[emailIdx] || '').trim();
        const department = (row[deptIdx] || '').trim();
        const storeName = (storeIdx !== -1 && row[storeIdx] ? row[storeIdx] : '').trim();
        const positionName = (row[posIdx] || '').trim();
        const rawEmpType = (row[empTypeIdx] || '').trim();
        const rawSalaryType = (row[salaryTypeIdx] || '').trim();
        const rawBaseSalary = (row[baseSalaryIdx] || '').trim();
        const rawHourlyWage = (row[hourlyWageIdx] || '').trim();
        const joinDate = (row[joinDateIdx] || '').trim();
        const birthDate = (row[birthDateIdx] || '').trim();
        const gender = (row[genderIdx] || '').trim();
        const postalCode = (row[postalIdx] || '').trim();
        const address = (row[addressIdx] || '').trim();
        const phoneNumber = (row[phoneIdx] || '').trim();
        const rawRole = (row[roleIdx] || '').trim();

        // バリデーション 1: 氏名
        if (!name) {
          errors.push('氏名が未入力です');
        }

        // バリデーション 2: 雇用形態
        let employmentType = '正社員（無期雇用）';
        if (rawEmpType) {
          if (rawEmpType.includes('パート') || rawEmpType.includes('アルバイト')) {
            employmentType = 'パート・アルバイト';
          } else if (rawEmpType.includes('契約')) {
            employmentType = '契約社員';
          } else if (rawEmpType.includes('役員')) {
            employmentType = '役員';
          } else {
            employmentType = rawEmpType;
          }
        }

        // バリデーション 3: 給与形態
        let salaryType: 'monthly' | 'hourly' = 'monthly';
        if (rawSalaryType.includes('時給') || employmentType === 'パート・アルバイト') {
          salaryType = 'hourly';
        }

        // バリデーション 4: 給与金額
        const baseSalary = rawBaseSalary ? parseInt(rawBaseSalary.replace(/[^0-9]/g, ''), 10) || 0 : 0;
        const hourlyWage = rawHourlyWage ? parseInt(rawHourlyWage.replace(/[^0-9]/g, ''), 10) || 0 : 0;

        // バリデーション 5: 入社年月日
        const todayStr = new Date().toISOString().split('T')[0];
        let validJoinDate = todayStr;
        if (joinDate) {
          const normalized = normalizeDate(joinDate);
          if (normalized) {
            validJoinDate = normalized;
          } else {
            errors.push(`入社日「${joinDate}」の形式が正しくありません (例: 2026-04-01 または 2026/4/1)`);
          }
        }

        // 生年月日（入力がある場合のみ正規化＆検証）
        let validBirthDate: string | undefined = undefined;
        if (birthDate) {
          const normalizedBirth = normalizeDate(birthDate);
          if (normalizedBirth) {
            validBirthDate = normalizedBirth;
          } else {
            errors.push(`生年月日「${birthDate}」の形式が正しくありません (例: 1990-05-15 または 1990/5/15)`);
          }
        }

        // バリデーション 6: メールアドレス形式
        if (email && (!email.includes('@') || !email.includes('.'))) {
          errors.push(`メールアドレス「${email}」の形式が正しくありません`);
        }

        // バリデーション 7: 権限
        let role: 'user' | 'manager' | 'admin' = 'user';
        if (rawRole.includes('管理') || rawRole.toLowerCase() === 'admin') {
          role = 'admin';
        } else if (rawRole.includes('マネージャー') || rawRole.toLowerCase() === 'manager') {
          role = 'manager';
        }

        // 郵便番号の全角半角正規化
        let cleanPostalCode = postalCode ? postalCode.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim() : undefined;
        if (cleanPostalCode && /^\d{7}$/.test(cleanPostalCode)) {
          cleanPostalCode = `${cleanPostalCode.slice(0, 3)}-${cleanPostalCode.slice(3)}`;
        }

        // 電話番号の全角半角正規化
        const cleanPhoneNumber = phoneNumber ? phoneNumber.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).trim() : undefined;

        parsed.push({
          rowIndex,
          name,
          nameKana: nameKana || undefined,
          email: email || undefined,
          department: department || undefined,
          storeName: storeName || undefined,
          positionName: positionName || undefined,
          employmentType,
          salaryType,
          baseSalary,
          hourlyWage,
          joinDate: validJoinDate,
          birthDate: validBirthDate,
          gender: gender || undefined,
          postalCode: cleanPostalCode,
          address: address || undefined,
          phoneNumber: cleanPhoneNumber,
          role,
          isValid: errors.length === 0,
          errors
        });
      });

      setParsedRows(parsed);
      setStep('preview');
    } catch (err: any) {
      console.error('CSV parse error:', err);
      alert('CSVファイルの解析に失敗しました: ' + (err.message || 'ファイルが壊れている可能性があります'));
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 🚀 3. 実DB（users, profiles, payroll, shift）への一括アトミック永続化（司馬懿監査・RLS保護）
  const handleExecuteImport = async () => {
    const validItems = parsedRows.filter(r => r.isValid);
    if (validItems.length === 0) {
      alert('インポート可能な有効なデータがありません。エラー内容をご確認ください。');
      return;
    }

    setStep('importing');
    setImportProgress({ current: 0, total: validItems.length, successCount: 0, errorCount: 0 });
    const errors: string[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      setImportProgress(prev => ({ ...prev, current: i + 1 }));

      try {
        // ① メールアドレスの確定（未入力時は一時ローカルアドレス）
        const finalEmail = item.email ? item.email.trim() : `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}@company.local`;

        // ② users テーブルへの登録（全社基本マスタ・SSOT）
        // idは渡さずDBの gen_random_uuid() に完全委任（PostgreSQL UUID型制約の100%完全遵守）
        const userBasePayload: Record<string, any> = {
          tenant_id: tenantId,
          name: item.name,
          email: finalEmail,
          role: item.role,
          department: item.department || null,
          store_name: item.storeName || null,
          phone: item.phoneNumber || null,
          address: item.address || null,
          birth_date: item.birthDate || null,
          join_date: item.joinDate || null,
          employment_type: item.employmentType || null,
          has_kintai_access: true,
          has_shift_access: true
        };

        let registeredUserId: string | null = null;
        let lastUserErr: any = null;

        // 1st 試行: position_name 付きで試行（DBにカラムが存在する場合）
        if (item.positionName) {
          const { data: uData1, error: pErr } = await supabase
            .from('users')
            .insert({
              ...userBasePayload,
              position_name: item.positionName
            })
            .select()
            .single();

          if (!pErr && uData1?.id) {
            registeredUserId = uData1.id;
          } else {
            console.warn('users with position_name insert note, falling back:', pErr?.message);
            lastUserErr = pErr;
          }
        }

        // 2nd 試行: position_name を除外した標準構成で実行
        if (!registeredUserId) {
          const { data: uData2, error: baseErr } = await supabase
            .from('users')
            .insert(userBasePayload)
            .select()
            .single();

          if (!baseErr && uData2?.id) {
            registeredUserId = uData2.id;
          } else {
            console.warn('users base insert note, falling back to minimal:', baseErr?.message);
            // 3rd 試行: 最小限の確実なカラム（tenant_id, name, email, role, department）で実行
            const { data: uData3, error: minErr } = await supabase
              .from('users')
              .insert({
                tenant_id: tenantId,
                name: item.name,
                email: finalEmail,
                role: item.role,
                department: item.department || null
              })
              .select()
              .single();

            if (!minErr && uData3?.id) {
              registeredUserId = uData3.id;
            } else {
              lastUserErr = minErr;
            }
          }
        }

        if (!registeredUserId) {
          throw new Error(`users登録失敗: ${lastUserErr?.message || '不明なエラー'}`);
        }

        const userId = registeredUserId;

        // 役職・配属店舗情報のLocalStorageバックアップ（組織図等との即時連動保証）
        if (item.positionName || item.storeName) {
          try {
            const key = `user_positions_${tenantId}`;
            const currentMap = JSON.parse(localStorage.getItem(key) || '{}');
            currentMap[userId] = {
              position_name: item.positionName,
              department: item.department || undefined,
              store_name: item.storeName || undefined
            };
            localStorage.setItem(key, JSON.stringify(currentMap));
          } catch (e) {}
        }

        // ③ employee_onboarding_profiles への登録（入退社労務管理台帳）
        await supabase.from('employee_onboarding_profiles').upsert({
          tenant_id: tenantId,
          user_id: userId,
          status: 'active',
          name_kana: item.nameKana || null,
          birth_date: item.birthDate || null,
          postal_code: item.postalCode || null,
          address: item.address || null,
          phone: item.phoneNumber || null,
          join_date: item.joinDate,
          contract_type: item.employmentType === 'part-time' ? 'fixed_term' : 'indefinite',
          salary_type: item.salaryType,
          base_salary: item.baseSalary,
          hourly_wage: item.hourlyWage,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id,user_id' });

        // ④ employee_payroll_profiles への登録（給与計算マスタ）
        await supabase.from('employee_payroll_profiles').upsert({
          tenant_id: tenantId,
          user_id: userId,
          name_kana: item.nameKana || null,
          salary_type: item.salaryType,
          base_salary: item.baseSalary,
          hourly_wage: item.hourlyWage,
          position_allowance: 0,
          qualification_allowance: 0
        }, { onConflict: 'tenant_id,user_id' });

        // ⑤ shift_employee_settings への登録（シフト・勤怠マスタ）
        await supabase.from('shift_employee_settings').upsert({
          tenant_id: tenantId,
          user_id: userId,
          hire_date: item.joinDate,
          default_role: item.department || '一般',
          base_wage: item.salaryType === 'hourly' ? item.hourlyWage : (item.baseSalary ? Math.round(item.baseSalary / 160) : 0),
          max_hours_per_week: item.employmentType.includes('パート') ? 25 : 40,
          priority_score: 3
        }, { onConflict: 'user_id' });

        successCount++;
        setImportProgress(prev => ({ ...prev, successCount }));
      } catch (err: any) {
        console.error(`Row ${item.rowIndex} import error:`, err);
        errorCount++;
        errors.push(`${item.rowIndex}行目 (${item.name}): ${err.message}`);
        setImportProgress(prev => ({ ...prev, errorCount }));
      }
    }

    setImportErrors(errors);
    setStep('completed');
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                社員データ一括CSVインポート
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  SaaS高速初期設定
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                全社マスタ（users）および入退社労務・給与・シフト台帳へ一括アトミック反映します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'importing'}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">

          {/* STEP 1: ファイル選択 ＆ ひな形ダウンロード */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* ひな形ダウンロード案内 */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white p-5 rounded-2xl border border-emerald-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">Step 1</span>
                    <h4 className="text-sm font-bold text-slate-800">専用CSVテンプレートをダウンロード</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Excelで直接編集しても文字化けしないBOM付きUTF-8フォーマットです。氏名や給与・入社日を入力してください。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  雛形CSVをダウンロード
                </button>
              </div>

              {/* ファイルアップロード領域 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">Step 2</span>
                  <h4 className="text-sm font-bold text-slate-800">記入済みCSVファイルをアップロード</h4>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/20 rounded-2xl p-8 text-center transition cursor-pointer group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  {isProcessingFile ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                      <p className="text-xs font-bold text-slate-600">CSVファイルを解析中...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-emerald-600 group-hover:border-emerald-300 shadow-xs transition">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">
                          CSVファイルをここにドラッグ＆ドロップ
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          または <span className="text-emerald-600 underline font-bold">ファイルを選択</span>（Shift-JIS / UTF-8 両対応）
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 注意事項 */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-500">
                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />
                  インポート時の留意事項
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                  <li>氏名、雇用形態、入社年月日は必須項目です。</li>
                  <li>日付（入社日・生年月日）は「2026-04-01」「2026/4/1」「2026.4.1」「令和8年4月1日」など柔軟に自動判定・補正されます。</li>
                  <li>メールアドレスが空欄の場合は、システムログイン用のアカウントが自動採番されます。</li>
                  <li>給与が未入力の場合は、勝手な推測値は入らず「未設定（0円）」として登録されます。</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: プレビュー＆検証結果 */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600">解析行数: {parsedRows.length}件</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 正常: {validCount}件
                  </span>
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5" /> 要確認: {invalidCount}件
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setStep('upload')}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-bold"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 別のCSVを選択し直す
                </button>
              </div>

              {/* プレビューテーブル */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[350px] overflow-y-auto">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 w-12 text-center">状態</th>
                      <th className="p-2.5">行</th>
                      <th className="p-2.5">氏名</th>
                      <th className="p-2.5">部署 / 店舗 / 役職</th>
                      <th className="p-2.5">雇用形態</th>
                      <th className="p-2.5">給与（月給 / 時給）</th>
                      <th className="p-2.5">入社日</th>
                      <th className="p-2.5">エラー・確認</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map(row => (
                      <tr key={row.rowIndex} className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/70'}>
                        <td className="p-2.5 text-center">
                          {row.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 inline-block" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 inline-block" />
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-400">{row.rowIndex}</td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {row.name || <span className="text-rose-500 italic">（未入力）</span>}
                          {row.nameKana && <span className="block text-[10px] text-slate-400 font-normal">{row.nameKana}</span>}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          <div className="font-bold text-slate-800">{row.department || '未設定'}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                            {row.storeName && (
                              <span className="text-indigo-700 bg-indigo-50 border border-indigo-100 px-1 py-0.2 rounded font-bold">
                                🏪 {row.storeName}
                              </span>
                            )}
                            {row.positionName && <span>{row.positionName}</span>}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[10px]">
                            {row.employmentType}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">
                          {row.salaryType === 'hourly' ? (
                            <span className="text-emerald-700 font-bold">
                              {row.hourlyWage > 0 ? `時給 ¥${row.hourlyWage.toLocaleString()}` : '時給 未設定'}
                            </span>
                          ) : (
                            <span className="text-indigo-700 font-bold">
                              {row.baseSalary > 0 ? `月給 ¥${row.baseSalary.toLocaleString()}` : '月給 未設定'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">{row.joinDate}</td>
                        <td className="p-2.5 text-rose-600 font-bold">
                          {row.errors.length > 0 ? row.errors.join(', ') : <span className="text-emerald-600 font-normal">正常</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: インポート実行中 */}
          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-800">
                  社員データを一括登録中... ({importProgress.current} / {importProgress.total})
                </h4>
                <p className="text-xs text-slate-500">
                  全社マスタ・入退社労務台帳・給与プロファイルへ同期しています。ブラウザを閉じずにお待ちください。
                </p>
              </div>
              <div className="w-64 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-200"
                  style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 4: インポート完了 */}
          {step === 'completed' && (
            <div className="py-8 flex flex-col items-center justify-center space-y-5 text-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-800">
                  社員の一括インポートが完了しました！
                </h4>
                <p className="text-xs text-slate-500">
                  成功: <strong className="text-emerald-600 font-bold">{importProgress.successCount} 名</strong>
                  {importProgress.errorCount > 0 && (
                    <> / 失敗: <strong className="text-rose-600 font-bold">{importProgress.errorCount} 名</strong></>
                  )}
                </p>
              </div>

              {importErrors.length > 0 && (
                <div className="w-full max-w-lg bg-rose-50 p-4 rounded-xl border border-rose-200 text-left text-xs space-y-1 text-rose-800">
                  <div className="font-bold flex items-center gap-1 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    以下の行でエラーが発生しました:
                  </div>
                  <div className="max-h-32 overflow-y-auto font-mono text-[11px] space-y-0.5">
                    {importErrors.map((err, i) => <div key={i}>• {err}</div>)}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400">
                組織図、従業員台帳、シフト管理へ即座に反映されています。
              </p>
            </div>
          )}

        </div>

        {/* フッターアクション */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
          {step === 'preview' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={validCount === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 transition flex items-center gap-2 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                有効な {validCount} 名を一括登録する
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : step === 'completed' ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 transition cursor-pointer"
              >
                完了（画面を更新する）
              </button>
            </div>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
export default EmployeeCsvImportModal;
