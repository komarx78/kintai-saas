import React, { useMemo, useState, useEffect } from 'react';
import { 
  loadMonthlyRevisionDocCoordinates, 
  fetchMonthlyRevisionDocCoordinatesFromDb, 
  MONTHLY_REVISION_COORDS_UPDATE_EVENT, 
  type MonthlyRevisionDocFieldConfig 
} from '../lib/monthlyRevisionDocCoordinates';
import { Printer, X, Sliders } from 'lucide-react';

export interface MonthlyRevisionEmployeeDocData {
  id: string;
  insuranceNumber?: string; // ① 被保険者整理番号
  name: string; // ② 被保険者氏名
  birthDate?: string; // ③ 生年月日 ('1988-05-03' 等)
  revisionYearMonth: string; // ④ 改定年月 ('2026-09')
  currentHealthStandard: number; // ⑤ 従前標準報酬（健保）
  currentPensionStandard: number; // ⑤ 従前標準報酬（厚年）
  previousRevisionYM?: string; // ⑥ 従前改定年月
  wageChangeType: '1.昇給' | '2.降給'; // ⑦ 昇(降)給
  wageChangeYM?: string; // ⑦ 昇降給年月
  retroactiveAmount?: number; // ⑧ 遡及支払額
  month1: { ym: string; monthNum: number; days: number; cash: number; inKind: number; total: number };
  month2: { ym: string; monthNum: number; days: number; cash: number; inKind: number; total: number };
  month3: { ym: string; monthNum: number; days: number; cash: number; inKind: number; total: number };
  totalWage: number; // ⑭ 総計
  averageWage: number; // ⑮ 平均額
  modifiedAverageWage?: number; // ⑯ 修正平均額
  myNumber?: string; // ⑰ 個人番号（70歳以上のみ）
  isOver70?: boolean;
  isShortTimeWorker?: boolean;
  remarks?: string; // ⑱ 備考
}

export interface MonthlyRevisionDocProps {
  data: {
    submissionDate?: string; // '2026-09-15'
    officeSymbol?: string; // 事業所整理記号 (例: '25-カア')
    officeCityCode?: string; // 25
    officeSymbolKana?: string; // カア
    companyZip?: string;
    companyAddress?: string;
    companyName?: string;
    companyOwnerName?: string;
    companyPhone?: string;
    sharoushiName?: string;
    employees: MonthlyRevisionEmployeeDocData[];
  };
  canEditCoordinates?: boolean;
  customCoords?: MonthlyRevisionDocFieldConfig[];
  tenantId?: string;
  onClose?: () => void;
  onOpenInspector?: () => void;
}

/**
 * 生年月日を年金機構公式元号コード（元号数字-YYMMDD）に変換
 * 元号: 1.明治 3.大正 5.昭和 7.平成 9.令和
 */
export const formatNenkinBirthDate = (birthDateStr?: string): string => {
  if (!birthDateStr) return '';
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return birthDateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return birthDateStr;

  const pad = (n: number) => String(n).padStart(2, '0');
  const mmdd = `${pad(m)}${pad(d)}`;

  if (y >= 2019) {
    const eraY = y - 2018;
    return `9-${pad(eraY)}${mmdd}`;
  } else if (y >= 1989) {
    const eraY = y - 1988;
    return `7-${pad(eraY)}${mmdd}`;
  } else if (y >= 1926) {
    const eraY = y - 1925;
    return `5-${pad(eraY)}${mmdd}`;
  } else if (y >= 1912) {
    const eraY = y - 1911;
    return `3-${pad(eraY)}${mmdd}`;
  } else {
    const eraY = y - 1867;
    return `1-${pad(eraY)}${mmdd}`;
  }
};

/**
 * 西暦年月を年金機構公式の和暦年月表記（例: '08年09月'）に変換
 */
export const formatNenkinYearMonth = (ymStr?: string): string => {
  if (!ymStr) return '';
  const parts = ymStr.split('-');
  if (parts.length < 2) return ymStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return ymStr;

  const eraY = y >= 2019 ? y - 2018 : y >= 1989 ? y - 1988 : y - 1925;
  return `${String(eraY).padStart(2, '0')}年${String(m).padStart(2, '0')}月`;
};

export const OfficialMonthlyRevisionDoc: React.FC<MonthlyRevisionDocProps> = ({
  data,
  canEditCoordinates = false,
  customCoords,
  tenantId,
  onClose,
  onOpenInspector
}) => {
  const [coords, setCoords] = useState<MonthlyRevisionDocFieldConfig[]>(() => {
    return customCoords || loadMonthlyRevisionDocCoordinates(tenantId);
  });

  const [bgMode, setBgMode] = useState<'with_form' | 'print_only'>('with_form');

  useEffect(() => {
    if (customCoords) {
      setCoords(customCoords);
    }
  }, [customCoords]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail?.fields) {
        setCoords(e.detail.fields);
      }
    };
    window.addEventListener(MONTHLY_REVISION_COORDS_UPDATE_EVENT, handleUpdate);
    fetchMonthlyRevisionDocCoordinatesFromDb(tenantId).then(dbCoords => {
      if (dbCoords && !customCoords) {
        setCoords(dbCoords);
      }
    });
    return () => window.removeEventListener(MONTHLY_REVISION_COORDS_UPDATE_EVENT, handleUpdate);
  }, [tenantId, customCoords]);

  const fieldMap = useMemo(() => {
    const map = new Map<string, MonthlyRevisionDocFieldConfig>();
    coords.forEach(f => map.set(f.id, f));
    return map;
  }, [coords]);

  const rowBaseTop = fieldMap.get('rowBaseTop')?.y ?? 31.8;
  const rowPitchY = fieldMap.get('rowPitchY')?.y ?? 12.60;

  // 1ページあたり5名でチャンク分割
  const pageChunks = useMemo(() => {
    const list = data.employees || [];
    if (list.length === 0) return [[]];
    const chunks: MonthlyRevisionEmployeeDocData[][] = [];
    for (let i = 0; i < list.length; i += 5) {
      chunks.push(list.slice(i, i + 5));
    }
    return chunks;
  }, [data.employees]);

  // 提出年月日の分割
  const subDate = useMemo(() => {
    if (!data.submissionDate) {
      const now = new Date();
      const eraY = now.getFullYear() - 2018;
      return { y: String(eraY), m: String(now.getMonth() + 1), d: String(now.getDate()) };
    }
    const [y, m, d] = data.submissionDate.split('-').map(Number);
    const eraY = y ? (y >= 2019 ? y - 2018 : y - 1988) : 8;
    return { y: String(eraY), m: String(m || 1), d: String(d || 1) };
  }, [data.submissionDate]);

  // 整理記号の分解
  const { symbolDigits, symbolKana } = useMemo(() => {
    let digits = data.officeCityCode || '';
    let kana = data.officeSymbolKana || '';
    if (data.officeSymbol && (!digits || !kana)) {
      const parts = data.officeSymbol.split('-');
      if (parts.length >= 2) {
        digits = parts[0];
        kana = parts[1];
      } else {
        digits = data.officeSymbol;
      }
    }
    return { symbolDigits: digits, symbolKana: kana };
  }, [data.officeSymbol, data.officeCityCode, data.officeSymbolKana]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm min-h-screen py-8 px-4 flex flex-col items-center">
      {/* 画面上部コントロールバー（印刷時は非表示） */}
      <div className="max-w-4xl w-full bg-white rounded-2xl p-4 mb-6 shadow-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md">
            📄
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-slate-800 text-base">被保険者報酬月額変更届（様式コード 2221）</h2>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                日本年金機構公式様式
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              対象被保険者: {data.employees.length}名 ｜ 全 {pageChunks.length} ページ（5名/頁）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 背景モード切替 */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs">
            <button
              onClick={() => setBgMode('with_form')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                bgMode === 'with_form' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              用紙枠線あり（白紙印刷用）
            </button>
            <button
              onClick={() => setBgMode('print_only')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                bgMode === 'print_only' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              文字のみ（専用OCR用紙用）
            </button>
          </div>

          {canEditCoordinates && onOpenInspector && (
            <button
              onClick={onOpenInspector}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-300 shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>印字座標を微調整</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>A4印刷 / PDF保存</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer ml-1"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 📄 A4用紙プレビュー群（1ページに最大5名、超過時は自動改ページ） */}
      <div className="space-y-8 print:space-y-0">
        {pageChunks.map((chunk, pageIndex) => (
          <div
            key={pageIndex}
            className="relative bg-white shadow-2xl print:shadow-none print:m-0 overflow-hidden text-slate-900 select-none page-break-after-always"
            style={{
              width: '210mm',
              height: '297mm',
              boxSizing: 'border-box'
            }}
          >
            {/* 📜 原本枠線・見出しレイアウト（bgMode === 'with_form' のみ表示） */}
            {bgMode === 'with_form' && (
              <div className="absolute inset-0 p-[8mm] pointer-events-none text-slate-800 font-sans">
                {/* 最上部：様式コード ＆ タイトル */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2">
                  <div className="border border-slate-900 px-2 py-0.5 text-center">
                    <div className="text-[8px] font-bold">様式コード</div>
                    <div className="text-sm font-mono font-black tracking-widest">2 2 2 1</div>
                  </div>

                  <div className="text-center flex-1 mx-4">
                    <div className="text-[10px] font-bold tracking-wider">健康保険 厚生年金保険</div>
                    <h1 className="text-xl font-black tracking-wider">被保険者報酬月額変更届</h1>
                    <div className="text-[9px] font-bold text-slate-600 mt-0.5">
                      (兼) 厚生年金保険 70歳以上被用者月額変更届
                    </div>
                  </div>

                  <div className="border border-slate-900 w-24 h-16 flex flex-col justify-between p-1 text-center">
                    <div className="text-[9px] font-bold text-slate-500">受付印</div>
                  </div>
                </div>

                {/* 提出者記入欄 */}
                <div className="mt-2 grid grid-cols-12 border border-slate-900 text-[10px]">
                  <div className="col-span-1 bg-slate-100 border-r border-slate-900 flex items-center justify-center p-1 font-black text-center text-[10px] leading-tight">
                    提出者<br/>記入欄
                  </div>

                  <div className="col-span-7 p-2 space-y-2 border-r border-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">事業所整理記号:</span>
                      <div className="flex items-center gap-1 font-mono font-bold text-sm">
                        <span className="border border-slate-700 px-2 py-0.5 rounded-sm">____</span>
                        <span>-</span>
                        <span className="border border-slate-700 px-2 py-0.5 rounded-sm">____</span>
                      </div>
                    </div>
                    <div className="text-[10px] leading-tight space-y-1">
                      <div><span className="text-slate-500 font-bold">所在地: </span></div>
                      <div><span className="text-slate-500 font-bold">名　称: </span></div>
                      <div><span className="text-slate-500 font-bold">事業主: </span></div>
                      <div><span className="text-slate-500 font-bold">電　話: </span></div>
                    </div>
                  </div>

                  <div className="col-span-4 p-2 flex flex-col justify-between">
                    <div className="text-[9px] text-slate-500 font-bold">社会保険労務士記載欄</div>
                    <div className="border-t border-dashed border-slate-300 pt-1 text-[9px] text-slate-400 text-center">
                      氏名等
                    </div>
                  </div>
                </div>

                {/* 項目名ヘッダーバー */}
                <div className="mt-2 border border-slate-900 bg-slate-100 text-[9px] font-bold p-1 text-center flex items-center justify-between">
                  <span>① 整理番号 ｜ ② 氏名 ｜ ③ 生年月日 ｜ ④ 改定年月 ｜ ⑰ 個人番号（70歳以上）</span>
                  <span>⑤ 従前標準報酬 ｜ ⑥ 従前改定月 ｜ ⑦ 昇降給 ｜ ⑧ 遡及支払額 ｜ ⑱ 備考</span>
                  <span>⑨ 支給月 ｜ ⑩ 基礎日数 ｜ ⑪ 通貨 ｜ ⑫ 現物 ｜ ⑬ 合計 ｜ ⑭ 総計 ｜ ⑮ 平均額</span>
                </div>

                {/* 5行分の枠線プレースホルダー */}
                <div className="mt-1 space-y-1">
                  {[0, 1, 2, 3, 4].map(idx => (
                    <div key={idx} className="border border-slate-900 h-[33mm] relative p-1.5 flex flex-col justify-between text-[9px]">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                        <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">{idx + 1}</span>
                        <div className="flex-1 grid grid-cols-5 gap-2 px-2 text-slate-400">
                          <span>① 被保険者整理番号</span>
                          <span>② 被保険者氏名</span>
                          <span>③ 生年月日</span>
                          <span>④ 改定年月</span>
                          <span>⑰ 個人番号</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-2 py-1 text-slate-400 border-b border-slate-200">
                        <span>⑤ 従前標準報酬 (健 / 厚)</span>
                        <span>⑥ 従前改定月</span>
                        <span>⑦ 昇降給</span>
                        <span>⑧ 遡及支払額</span>
                        <span>⑱ 備考</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1 pt-1 text-slate-400 text-[8px]">
                        <span>支給月</span>
                        <span>基礎日数</span>
                        <span>通貨による額</span>
                        <span>現物による額</span>
                        <span>合計(⑪+⑫)</span>
                        <span>総計・平均額</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 脚注 */}
                <div className="mt-2 text-[8px] text-slate-500 flex items-center justify-between">
                  <span>※ ⑨支給月とは、給与の対象となった計算月ではなく実際に給与の支払いを行った月となります。</span>
                  <span>ページ {pageIndex + 1} / {pageChunks.length}</span>
                </div>
              </div>
            )}

            {/* 🎯 精密座標によるデータ直接印字オーバーレイ */}
            <div className="absolute inset-0 pointer-events-none">
              {/* 提出年月日 */}
              <div 
                className="absolute font-mono font-bold text-center"
                style={{
                  left: `${fieldMap.get('subDateY')?.x ?? 17.5}%`,
                  top: `${fieldMap.get('subDateY')?.y ?? 7.0}%`,
                  fontSize: `${fieldMap.get('subDateY')?.fontSize ?? 11}pt`,
                  width: `${fieldMap.get('subDateY')?.width ?? 3.5}%`
                }}
              >
                {subDate.y}
              </div>
              <div 
                className="absolute font-mono font-bold text-center"
                style={{
                  left: `${fieldMap.get('subDateM')?.x ?? 21.8}%`,
                  top: `${fieldMap.get('subDateM')?.y ?? 7.0}%`,
                  fontSize: `${fieldMap.get('subDateM')?.fontSize ?? 11}pt`,
                  width: `${fieldMap.get('subDateM')?.width ?? 3.5}%`
                }}
              >
                {subDate.m}
              </div>
              <div 
                className="absolute font-mono font-bold text-center"
                style={{
                  left: `${fieldMap.get('subDateD')?.x ?? 26.0}%`,
                  top: `${fieldMap.get('subDateD')?.y ?? 7.0}%`,
                  fontSize: `${fieldMap.get('subDateD')?.fontSize ?? 11}pt`,
                  width: `${fieldMap.get('subDateD')?.width ?? 3.5}%`
                }}
              >
                {subDate.d}
              </div>

              {/* 事業所整理記号 */}
              <div 
                className="absolute font-mono font-bold text-center tracking-widest"
                style={{
                  left: `${fieldMap.get('symbolDigits')?.x ?? 15.0}%`,
                  top: `${fieldMap.get('symbolDigits')?.y ?? 8.8}%`,
                  fontSize: `${fieldMap.get('symbolDigits')?.fontSize ?? 13}pt`,
                  width: `${fieldMap.get('symbolDigits')?.width ?? 9.8}%`
                }}
              >
                {symbolDigits}
              </div>
              <div 
                className="absolute font-bold text-center tracking-widest"
                style={{
                  left: `${fieldMap.get('symbolKana')?.x ?? 27.2}%`,
                  top: `${fieldMap.get('symbolKana')?.y ?? 8.8}%`,
                  fontSize: `${fieldMap.get('symbolKana')?.fontSize ?? 12.5}pt`,
                  width: `${fieldMap.get('symbolKana')?.width ?? 9.8}%`
                }}
              >
                {symbolKana}
              </div>

              {/* 所在地・名称・代表者・電話 */}
              <div 
                className="absolute truncate"
                style={{
                  left: `${fieldMap.get('companyAddress')?.x ?? 14.5}%`,
                  top: `${fieldMap.get('companyAddress')?.y ?? 14.0}%`,
                  fontSize: `${fieldMap.get('companyAddress')?.fontSize ?? 9}pt`,
                  width: `${fieldMap.get('companyAddress')?.width ?? 33}%`
                }}
              >
                {data.companyZip && <span className="mr-1.5 font-mono">〒{data.companyZip}</span>}
                {data.companyAddress}
              </div>
              <div 
                className="absolute font-bold truncate"
                style={{
                  left: `${fieldMap.get('companyName')?.x ?? 14.5}%`,
                  top: `${fieldMap.get('companyName')?.y ?? 18.2}%`,
                  fontSize: `${fieldMap.get('companyName')?.fontSize ?? 10.5}pt`,
                  width: `${fieldMap.get('companyName')?.width ?? 33}%`
                }}
              >
                {data.companyName}
              </div>
              <div 
                className="absolute truncate"
                style={{
                  left: `${fieldMap.get('companyOwnerName')?.x ?? 14.5}%`,
                  top: `${fieldMap.get('companyOwnerName')?.y ?? 21.6}%`,
                  fontSize: `${fieldMap.get('companyOwnerName')?.fontSize ?? 10.5}pt`,
                  width: `${fieldMap.get('companyOwnerName')?.width ?? 33}%`
                }}
              >
                {data.companyOwnerName}
              </div>
              <div 
                className="absolute font-mono truncate"
                style={{
                  left: `${fieldMap.get('companyPhone')?.x ?? 18.0}%`,
                  top: `${fieldMap.get('companyPhone')?.y ?? 23.6}%`,
                  fontSize: `${fieldMap.get('companyPhone')?.fontSize ?? 9.5}pt`,
                  width: `${fieldMap.get('companyPhone')?.width ?? 25}%`
                }}
              >
                {data.companyPhone}
              </div>
              <div 
                className="absolute truncate"
                style={{
                  left: `${fieldMap.get('sharoushiName')?.x ?? 54.0}%`,
                  top: `${fieldMap.get('sharoushiName')?.y ?? 20.5}%`,
                  fontSize: `${fieldMap.get('sharoushiName')?.fontSize ?? 10}pt`,
                  width: `${fieldMap.get('sharoushiName')?.width ?? 38}%`
                }}
              >
                {data.sharoushiName}
              </div>

              {/* ── 5名分の各行印字 ── */}
              {chunk.map((emp, rowIdx) => {
                const rowTopY = rowBaseTop + rowIdx * rowPitchY;

                return (
                  <React.Fragment key={emp.id || rowIdx}>
                    {/* ① 被保険者整理番号 */}
                    <div
                      className="absolute font-mono font-bold text-center"
                      style={{
                        left: `${fieldMap.get('empInsuranceNumber')?.x ?? 9.8}%`,
                        top: `${rowTopY + (fieldMap.get('empInsuranceNumber')?.y ?? 1.2)}%`,
                        fontSize: `${fieldMap.get('empInsuranceNumber')?.fontSize ?? 10.5}pt`,
                        width: `${fieldMap.get('empInsuranceNumber')?.width ?? 11.5}%`
                      }}
                    >
                      {emp.insuranceNumber || emp.id.substring(0, 4)}
                    </div>

                    {/* ② 被保険者氏名 */}
                    <div
                      className="absolute font-bold truncate"
                      style={{
                        left: `${fieldMap.get('empName')?.x ?? 23.0}%`,
                        top: `${rowTopY + (fieldMap.get('empName')?.y ?? 1.0)}%`,
                        fontSize: `${fieldMap.get('empName')?.fontSize ?? 11.0}pt`,
                        width: `${fieldMap.get('empName')?.width ?? 23.0}%`
                      }}
                    >
                      {emp.name}
                    </div>

                    {/* ③ 生年月日 */}
                    <div
                      className="absolute font-mono font-bold text-center tracking-wider"
                      style={{
                        left: `${fieldMap.get('empBirth')?.x ?? 47.8}%`,
                        top: `${rowTopY + (fieldMap.get('empBirth')?.y ?? 1.2)}%`,
                        fontSize: `${fieldMap.get('empBirth')?.fontSize ?? 10.5}pt`,
                        width: `${fieldMap.get('empBirth')?.width ?? 14.5}%`
                      }}
                    >
                      {formatNenkinBirthDate(emp.birthDate)}
                    </div>

                    {/* ④ 改定年月 */}
                    <div
                      className="absolute font-mono font-bold text-center"
                      style={{
                        left: `${fieldMap.get('empRevisionYearMonth')?.x ?? 64.0}%`,
                        top: `${rowTopY + (fieldMap.get('empRevisionYearMonth')?.y ?? 1.2)}%`,
                        fontSize: `${fieldMap.get('empRevisionYearMonth')?.fontSize ?? 10.5}pt`,
                        width: `${fieldMap.get('empRevisionYearMonth')?.width ?? 8.5}%`
                      }}
                    >
                      {formatNenkinYearMonth(emp.revisionYearMonth)}
                    </div>

                    {/* ⑰ 個人番号（70歳以上被用者） */}
                    <div
                      className="absolute font-mono font-bold text-center tracking-widest"
                      style={{
                        left: `${fieldMap.get('empMyNumber')?.x ?? 74.0}%`,
                        top: `${rowTopY + (fieldMap.get('empMyNumber')?.y ?? 1.2)}%`,
                        fontSize: `${fieldMap.get('empMyNumber')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('empMyNumber')?.width ?? 20.0}%`
                      }}
                    >
                      {emp.isOver70 ? (emp.myNumber || '') : ''}
                    </div>

                    {/* ⑤ 従前の標準報酬月額（健保 / 厚年・千円単位） */}
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        left: `${fieldMap.get('empCurrentHealthStandard')?.x ?? 10.5}%`,
                        top: `${rowTopY + (fieldMap.get('empCurrentHealthStandard')?.y ?? 3.8)}%`,
                        fontSize: `${fieldMap.get('empCurrentHealthStandard')?.fontSize ?? 10.5}pt`,
                        width: `${fieldMap.get('empCurrentHealthStandard')?.width ?? 9.0}%`
                      }}
                    >
                      {Math.round(emp.currentHealthStandard / 1000).toLocaleString()}
                    </div>
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        left: `${fieldMap.get('empCurrentPensionStandard')?.x ?? 21.2}%`,
                        top: `${rowTopY + (fieldMap.get('empCurrentPensionStandard')?.y ?? 3.8)}%`,
                        fontSize: `${fieldMap.get('empCurrentPensionStandard')?.fontSize ?? 10.5}pt`,
                        width: `${fieldMap.get('empCurrentPensionStandard')?.width ?? 9.0}%`
                      }}
                    >
                      {Math.round(emp.currentPensionStandard / 1000).toLocaleString()}
                    </div>

                    {/* ⑥ 従前改定年月 */}
                    <div
                      className="absolute font-mono text-center text-xs"
                      style={{
                        left: `${fieldMap.get('empPreviousRevisionYM')?.x ?? 32.5}%`,
                        top: `${rowTopY + (fieldMap.get('empPreviousRevisionYM')?.y ?? 3.8)}%`,
                        fontSize: `${fieldMap.get('empPreviousRevisionYM')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('empPreviousRevisionYM')?.width ?? 12.0}%`
                      }}
                    >
                      {formatNenkinYearMonth(emp.previousRevisionYM)}
                    </div>

                    {/* ⑦ 昇(降)給 */}
                    <div
                      className="absolute font-bold text-center text-xs"
                      style={{
                        left: `${fieldMap.get('empWageChangeType')?.x ?? 46.5}%`,
                        top: `${rowTopY + (fieldMap.get('empWageChangeType')?.y ?? 3.8)}%`,
                        fontSize: `${fieldMap.get('empWageChangeType')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('empWageChangeType')?.width ?? 15.0}%`
                      }}
                    >
                      {emp.wageChangeType} {emp.wageChangeYM ? formatNenkinYearMonth(emp.wageChangeYM) : ''}
                    </div>

                    {/* ⑧ 遡及支払額 */}
                    <div
                      className="absolute font-mono text-right text-xs"
                      style={{
                        left: `${fieldMap.get('empRetroactiveAmount')?.x ?? 63.5}%`,
                        top: `${rowTopY + (fieldMap.get('empRetroactiveAmount')?.y ?? 3.8)}%`,
                        fontSize: `${fieldMap.get('empRetroactiveAmount')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('empRetroactiveAmount')?.width ?? 9.0}%`
                      }}
                    >
                      {emp.retroactiveAmount ? emp.retroactiveAmount.toLocaleString() : ''}
                    </div>

                    {/* ⑱ 備考 */}
                    <div
                      className="absolute text-xs truncate"
                      style={{
                        left: `${fieldMap.get('empRemarks')?.x ?? 74.0}%`,
                        top: `${rowTopY + (fieldMap.get('empRemarks')?.y ?? 3.8)}%`,
                        fontSize: `${fieldMap.get('empRemarks')?.fontSize ?? 9.0}pt`,
                        width: `${fieldMap.get('empRemarks')?.width ?? 20.0}%`
                      }}
                    >
                      {emp.remarks || (emp.isShortTimeWorker ? '短時間労働者' : '基本給改定のため')}
                    </div>

                    {/* ── 3ヶ月各月の給与実績テーブル ── */}
                    {/* 月1 */}
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        left: `${fieldMap.get('m1Month')?.x ?? 10.0}%`,
                        top: `${rowTopY + (fieldMap.get('m1Month')?.y ?? 6.2)}%`,
                        fontSize: `${fieldMap.get('m1Month')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('m1Month')?.width ?? 4.5}%`
                      }}
                    >
                      {emp.month1.monthNum}月
                    </div>
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        left: `${fieldMap.get('m1Days')?.x ?? 16.5}%`,
                        top: `${rowTopY + (fieldMap.get('m1Days')?.y ?? 6.2)}%`,
                        fontSize: `${fieldMap.get('m1Days')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('m1Days')?.width ?? 5.0}%`
                      }}
                    >
                      {emp.month1.days}日
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        left: `${fieldMap.get('m1Cash')?.x ?? 23.0}%`,
                        top: `${rowTopY + (fieldMap.get('m1Cash')?.y ?? 6.2)}%`,
                        fontSize: `${fieldMap.get('m1Cash')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m1Cash')?.width ?? 9.5}%`
                      }}
                    >
                      {emp.month1.cash.toLocaleString()}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        left: `${fieldMap.get('m1InKind')?.x ?? 33.5}%`,
                        top: `${rowTopY + (fieldMap.get('m1InKind')?.y ?? 6.2)}%`,
                        fontSize: `${fieldMap.get('m1InKind')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m1InKind')?.width ?? 7.5}%`
                      }}
                    >
                      {emp.month1.inKind > 0 ? emp.month1.inKind.toLocaleString() : '0'}
                    </div>
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        left: `${fieldMap.get('m1Total')?.x ?? 42.0}%`,
                        top: `${rowTopY + (fieldMap.get('m1Total')?.y ?? 6.2)}%`,
                        fontSize: `${fieldMap.get('m1Total')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m1Total')?.width ?? 10.5}%`
                      }}
                    >
                      {emp.month1.total.toLocaleString()}
                    </div>

                    {/* 月2 */}
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        left: `${fieldMap.get('m2Month')?.x ?? 10.0}%`,
                        top: `${rowTopY + (fieldMap.get('m2Month')?.y ?? 8.2)}%`,
                        fontSize: `${fieldMap.get('m2Month')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('m2Month')?.width ?? 4.5}%`
                      }}
                    >
                      {emp.month2.monthNum}月
                    </div>
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        left: `${fieldMap.get('m2Days')?.x ?? 16.5}%`,
                        top: `${rowTopY + (fieldMap.get('m2Days')?.y ?? 8.2)}%`,
                        fontSize: `${fieldMap.get('m2Days')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('m2Days')?.width ?? 5.0}%`
                      }}
                    >
                      {emp.month2.days}日
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        left: `${fieldMap.get('m2Cash')?.x ?? 23.0}%`,
                        top: `${rowTopY + (fieldMap.get('m2Cash')?.y ?? 8.2)}%`,
                        fontSize: `${fieldMap.get('m2Cash')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m2Cash')?.width ?? 9.5}%`
                      }}
                    >
                      {emp.month2.cash.toLocaleString()}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        left: `${fieldMap.get('m2InKind')?.x ?? 33.5}%`,
                        top: `${rowTopY + (fieldMap.get('m2InKind')?.y ?? 8.2)}%`,
                        fontSize: `${fieldMap.get('m2InKind')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m2InKind')?.width ?? 7.5}%`
                      }}
                    >
                      {emp.month2.inKind > 0 ? emp.month2.inKind.toLocaleString() : '0'}
                    </div>
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        left: `${fieldMap.get('m2Total')?.x ?? 42.0}%`,
                        top: `${rowTopY + (fieldMap.get('m2Total')?.y ?? 8.2)}%`,
                        fontSize: `${fieldMap.get('m2Total')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m2Total')?.width ?? 10.5}%`
                      }}
                    >
                      {emp.month2.total.toLocaleString()}
                    </div>

                    {/* 月3 */}
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        left: `${fieldMap.get('m3Month')?.x ?? 10.0}%`,
                        top: `${rowTopY + (fieldMap.get('m3Month')?.y ?? 10.2)}%`,
                        fontSize: `${fieldMap.get('m3Month')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('m3Month')?.width ?? 4.5}%`
                      }}
                    >
                      {emp.month3.monthNum}月
                    </div>
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        left: `${fieldMap.get('m3Days')?.x ?? 16.5}%`,
                        top: `${rowTopY + (fieldMap.get('m3Days')?.y ?? 10.2)}%`,
                        fontSize: `${fieldMap.get('m3Days')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('m3Days')?.width ?? 5.0}%`
                      }}
                    >
                      {emp.month3.days}日
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        left: `${fieldMap.get('m3Cash')?.x ?? 23.0}%`,
                        top: `${rowTopY + (fieldMap.get('m3Cash')?.y ?? 10.2)}%`,
                        fontSize: `${fieldMap.get('m3Cash')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m3Cash')?.width ?? 9.5}%`
                      }}
                    >
                      {emp.month3.cash.toLocaleString()}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        left: `${fieldMap.get('m3InKind')?.x ?? 33.5}%`,
                        top: `${rowTopY + (fieldMap.get('m3InKind')?.y ?? 10.2)}%`,
                        fontSize: `${fieldMap.get('m3InKind')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m3InKind')?.width ?? 7.5}%`
                      }}
                    >
                      {emp.month3.inKind > 0 ? emp.month3.inKind.toLocaleString() : '0'}
                    </div>
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        left: `${fieldMap.get('m3Total')?.x ?? 42.0}%`,
                        top: `${rowTopY + (fieldMap.get('m3Total')?.y ?? 10.2)}%`,
                        fontSize: `${fieldMap.get('m3Total')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('m3Total')?.width ?? 10.5}%`
                      }}
                    >
                      {emp.month3.total.toLocaleString()}
                    </div>

                    {/* ⑭ 総計 ＆ ⑮ 平均額 */}
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        left: `${fieldMap.get('empTotalWage')?.x ?? 58.0}%`,
                        top: `${rowTopY + (fieldMap.get('empTotalWage')?.y ?? 6.8)}%`,
                        fontSize: `${fieldMap.get('empTotalWage')?.fontSize ?? 10.0}pt`,
                        width: `${fieldMap.get('empTotalWage')?.width ?? 13.0}%`
                      }}
                    >
                      {emp.totalWage.toLocaleString()}
                    </div>
                    <div
                      className="absolute font-mono font-black text-right"
                      style={{
                        left: `${fieldMap.get('empAverageWage')?.x ?? 58.0}%`,
                        top: `${rowTopY + (fieldMap.get('empAverageWage')?.y ?? 9.2)}%`,
                        fontSize: `${fieldMap.get('empAverageWage')?.fontSize ?? 10.5}pt`,
                        width: `${fieldMap.get('empAverageWage')?.width ?? 13.0}%`
                      }}
                    >
                      {emp.averageWage.toLocaleString()}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        left: `${fieldMap.get('empModifiedAverage')?.x ?? 58.0}%`,
                        top: `${rowTopY + (fieldMap.get('empModifiedAverage')?.y ?? 11.2)}%`,
                        fontSize: `${fieldMap.get('empModifiedAverage')?.fontSize ?? 9.5}pt`,
                        width: `${fieldMap.get('empModifiedAverage')?.width ?? 13.0}%`
                      }}
                    >
                      {emp.modifiedAverageWage ? emp.modifiedAverageWage.toLocaleString() : ''}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
