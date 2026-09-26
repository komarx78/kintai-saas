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
  if (parts.length < 3) return birthDateStr;
  const y = parseInt(parts[0], 10);
  const m = String(parseInt(parts[1], 10)).padStart(2, '0');
  const d = String(parseInt(parts[2], 10)).padStart(2, '0');

  let eraCode = '9';
  let eraYear = 1;

  if (y >= 2019) {
    eraCode = '9';
    eraYear = y - 2018;
  } else if (y >= 1989) {
    eraCode = '7';
    eraYear = y - 1988;
  } else if (y >= 1926) {
    eraCode = '5';
    eraYear = y - 1925;
  } else if (y >= 1912) {
    eraCode = '3';
    eraYear = y - 1911;
  } else {
    eraCode = '1';
    eraYear = y - 1867;
  }

  const eraYearStr = String(eraYear).padStart(2, '0');
  return `${eraCode}-${eraYearStr}${m}${d}`;
};

/**
 * 年月（YYYY-MM）を年金機構和暦形式（元号年-月）に変換
 */
export const formatNenkinYM = (ymStr?: string): string => {
  if (!ymStr) return '';
  const parts = ymStr.split('-');
  if (parts.length < 2) return ymStr;
  const y = parseInt(parts[0], 10);
  const m = String(parseInt(parts[1], 10)).padStart(2, '0');
  const eraY = y >= 2019 ? y - 2018 : y - 1988;
  return `${eraY}-${m}`;
};

export const OfficialMonthlyRevisionDoc: React.FC<MonthlyRevisionDocProps> = ({
  data,
  canEditCoordinates = false,
  customCoords,
  tenantId,
  onClose,
  onOpenInspector
}) => {
  // 表示モード切替: 'exact_pdf' (添付原本下敷き印字) | 'print_only' (専用OCR用紙・文字のみ印字)
  const [renderMode, setRenderMode] = useState<'exact_pdf' | 'print_only'>('exact_pdf');

  // 印字座標ステート
  const [coords, setCoords] = useState<MonthlyRevisionDocFieldConfig[]>(() => {
    return customCoords || loadMonthlyRevisionDocCoordinates(tenantId);
  });

  useEffect(() => {
    if (customCoords) {
      setCoords(customCoords);
      return;
    }
    const updateHandler = (e: any) => {
      if (e.detail) setCoords(e.detail);
    };
    window.addEventListener(MONTHLY_REVISION_COORDS_UPDATE_EVENT, updateHandler);

    fetchMonthlyRevisionDocCoordinatesFromDb(tenantId).then(dbCoords => {
      if (dbCoords && dbCoords.length > 0) {
        setCoords(dbCoords);
      }
    });

    return () => {
      window.removeEventListener(MONTHLY_REVISION_COORDS_UPDATE_EVENT, updateHandler);
    };
  }, [customCoords, tenantId]);

  const fieldMap = useMemo(() => {
    const map = new Map<string, MonthlyRevisionDocFieldConfig>();
    coords.forEach(f => map.set(f.id, f));
    return map;
  }, [coords]);

  const getF = (id: string, defX: number, defY: number, defSize: number, defWidth?: number) => {
    const item = fieldMap.get(id);
    return {
      x: item?.x !== undefined ? item.x : defX,
      y: item?.y !== undefined ? item.y : defY,
      fontSize: item?.fontSize !== undefined ? item.fontSize : defSize,
      pitch: item?.pitch,
      width: item?.width !== undefined ? item.width : defWidth
    };
  };

  const rowBaseTop = fieldMap.get('rowBaseTop')?.y ?? 31.6;
  const rowPitchY = fieldMap.get('rowPitchY')?.y ?? 11.93;

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

  const fSubY = getF('subDateY', 14.5, 5.7, 11, 3.5);
  const fSubM = getF('subDateM', 19.5, 5.7, 11, 3.5);
  const fSubD = getF('subDateD', 24.2, 5.7, 11, 3.5);

  const fDigits = getF('symbolDigits', 14.8, 8.4, 13, 9.8);
  const fKana = getF('symbolKana', 26.6, 8.4, 12.5, 9.8);

  const fZip = getF('companyZip', 12.0, 11.2, 9.5, 15.0);
  const fAddress = getF('companyAddress', 12.0, 13.0, 9.0, 36.0);
  const fName = getF('companyName', 12.0, 16.5, 10.5, 36.0);
  const fOwner = getF('companyOwnerName', 12.0, 19.2, 10.5, 36.0);
  const fPhone = getF('companyPhone', 13.0, 21.8, 9.5, 22.0);
  const fSharoushi = getF('sharoushiName', 54.0, 19.5, 9.5, 38.0);

  const digitChars = symbolDigits ? symbolDigits.split('').slice(0, 4) : [];
  while (digitChars.length < 4) digitChars.push('');
  const kanaChars = symbolKana ? symbolKana.split('').slice(0, 4) : [];
  while (kanaChars.length < 4) kanaChars.push('');

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm min-h-screen py-8 px-4 flex flex-col items-center">
      {/* 画面上部コントロールバー（印刷時は非表示） */}
      <div className="max-w-4xl w-full bg-white rounded-2xl p-4 mb-6 shadow-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-md">
            📄
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-slate-800 text-base">被保険者報酬月額変更届（様式コード 2221）</h2>
              <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full font-mono">
                FORM-2221-EXACT-PDF
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              日本年金機構公式届出用紙 原本下敷き印字 ｜ 対象被保険者: {data.employees.length}名 ｜ 全 {pageChunks.length} ページ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 表示・印刷モード切替 */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setRenderMode('exact_pdf')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                renderMode === 'exact_pdf' ? 'bg-purple-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🖼️ 日本年金機構 原本PDF完全一致（原本下敷き）</span>
              <span className="text-[9px] bg-purple-400 text-white px-1.5 py-0.2 rounded font-mono">推奨</span>
            </button>
            <button
              onClick={() => setRenderMode('print_only')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                renderMode === 'print_only' ? 'bg-purple-600 text-white shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📄 文字のみ（年金事務所OCR専用用紙用）</span>
            </button>
          </div>

          {canEditCoordinates && onOpenInspector && (
            <button
              onClick={onOpenInspector}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-300 shadow-2xs"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-600" />
              <span>印字座標を微調整</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
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
            className="official-monthly-revision-page relative bg-white shadow-2xl print:shadow-none print:m-0 overflow-hidden text-slate-900 select-none page-break-after-always"
            style={{
              width: '210mm',
              height: '297mm',
              aspectRatio: '2480 / 3508',
              containerType: 'inline-size',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            {/* 📄 日本年金機構原本用紙（下敷き原本：添付PDFそのものを100%確実に表示） */}
            {renderMode === 'exact_pdf' && (
              <img
                src="/nenkin_monthly_revision_template_page1.png"
                alt="日本年金機構公式届出用紙（コード2221）"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0 print:w-full print:h-full"
                draggable={false}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* 🔤 印字オーバーレイレイヤー（原本PDFのマス目・枠内にピタッと印字） */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            <div className="absolute inset-0 z-10 pointer-events-none text-slate-900">
              {/* 提出年月日 */}
              <div
                className="absolute font-mono font-bold text-center"
                style={{
                  top: `${fSubY.y}%`,
                  left: `${fSubY.x}%`,
                  width: `${fSubY.width || 3.5}%`,
                  fontSize: `${(fSubY.fontSize || 11) * 0.115}cqi`
                }}
              >
                {subDate.y}
              </div>
              <div
                className="absolute font-mono font-bold text-center"
                style={{
                  top: `${fSubM.y}%`,
                  left: `${fSubM.x}%`,
                  width: `${fSubM.width || 3.5}%`,
                  fontSize: `${(fSubM.fontSize || 11) * 0.115}cqi`
                }}
              >
                {subDate.m}
              </div>
              <div
                className="absolute font-mono font-bold text-center"
                style={{
                  top: `${fSubD.y}%`,
                  left: `${fSubD.x}%`,
                  width: `${fSubD.width || 3.5}%`,
                  fontSize: `${(fSubD.fontSize || 11) * 0.115}cqi`
                }}
              >
                {subDate.d}
              </div>

              {/* 事業所整理記号（左4マス数字、右4マスカタカナ） */}
              <div
                className="absolute flex items-center justify-between"
                style={{
                  top: `${fDigits.y}%`,
                  left: `${fDigits.x}%`,
                  width: `${fDigits.width || 9.8}%`
                }}
              >
                {digitChars.map((ch, idx) => (
                  <span
                    key={`d-${idx}`}
                    className="font-mono font-bold text-center inline-block"
                    style={{
                      width: `${fDigits.pitch || 2.30}%`,
                      fontSize: `${(fDigits.fontSize || 13) * 0.115}cqi`
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>

              <div
                className="absolute flex items-center justify-between"
                style={{
                  top: `${fKana.y}%`,
                  left: `${fKana.x}%`,
                  width: `${fKana.width || 9.8}%`
                }}
              >
                {kanaChars.map((ch, idx) => (
                  <span
                    key={`k-${idx}`}
                    className="font-bold text-center inline-block"
                    style={{
                      width: `${fKana.pitch || 2.30}%`,
                      fontSize: `${(fKana.fontSize || 12.5) * 0.115}cqi`
                    }}
                  >
                    {ch}
                  </span>
                ))}
              </div>

              {/* 事業所所在地・名称・事業主氏名・電話 */}
              {data.companyZip && (
                <div
                  className="absolute font-mono text-xs font-medium"
                  style={{
                    top: `${fZip.y}%`,
                    left: `${fZip.x}%`,
                    fontSize: `${(fZip.fontSize || 9.5) * 0.115}cqi`
                  }}
                >
                  〒{data.companyZip}
                </div>
              )}
              <div
                className="absolute text-xs leading-tight font-medium truncate"
                style={{
                  top: `${fAddress.y}%`,
                  left: `${fAddress.x}%`,
                  width: `${fAddress.width || 36.0}%`,
                  fontSize: `${(fAddress.fontSize || 9.0) * 0.115}cqi`
                }}
              >
                {data.companyAddress}
              </div>
              <div
                className="absolute text-xs font-bold truncate"
                style={{
                  top: `${fName.y}%`,
                  left: `${fName.x}%`,
                  width: `${fName.width || 36.0}%`,
                  fontSize: `${(fName.fontSize || 10.5) * 0.115}cqi`
                }}
              >
                {data.companyName}
              </div>
              <div
                className="absolute text-xs font-bold truncate"
                style={{
                  top: `${fOwner.y}%`,
                  left: `${fOwner.x}%`,
                  width: `${fOwner.width || 36.0}%`,
                  fontSize: `${(fOwner.fontSize || 10.5) * 0.115}cqi`
                }}
              >
                {data.companyOwnerName}
              </div>
              <div
                className="absolute font-mono text-xs"
                style={{
                  top: `${fPhone.y}%`,
                  left: `${fPhone.x}%`,
                  width: `${fPhone.width || 22.0}%`,
                  fontSize: `${(fPhone.fontSize || 9.5) * 0.115}cqi`
                }}
              >
                {data.companyPhone}
              </div>

              {/* 社会保険労務士記載欄 */}
              {data.sharoushiName && (
                <div
                  className="absolute text-xs font-medium truncate"
                  style={{
                    top: `${fSharoushi.y}%`,
                    left: `${fSharoushi.x}%`,
                    width: `${fSharoushi.width || 38.0}%`,
                    fontSize: `${(fSharoushi.fontSize || 9.5) * 0.115}cqi`
                  }}
                >
                  {data.sharoushiName}
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════════════ */}
              {/* 👥 従業員データ 行レンダリング（1行〜5行） */}
              {/* ══════════════════════════════════════════════════════════════════════ */}
              {chunk.map((emp, rowIdx) => {
                const rowTop = rowBaseTop + rowIdx * rowPitchY;
                const m1 = emp.month1 || { ym: '', monthNum: 0, days: 0, cash: 0, inKind: 0, total: 0 };
                const m2 = emp.month2 || { ym: '', monthNum: 0, days: 0, cash: 0, inKind: 0, total: 0 };
                const m3 = emp.month3 || { ym: '', monthNum: 0, days: 0, cash: 0, inKind: 0, total: 0 };

                // 個人番号12桁の分解
                const myNumChars = emp.myNumber ? emp.myNumber.replace(/-/g, '').slice(0, 12).split('') : [];
                while (myNumChars.length < 12) myNumChars.push('');

                const fEmpNum = getF('empInsuranceNumber', 9.8, 0.6, 11, 11.0);
                const fEmpNm = getF('empName', 21.6, 0.6, 11, 22.0);
                const fEmpBth = getF('empBirth', 44.2, 0.6, 10.5, 18.0);
                const fEmpRevYM = getF('empRevisionYearMonth', 63.0, 0.6, 10.5, 9.5);
                const fEmpMyNo = getF('empMyNumber', 73.6, 0.6, 10, 21.0);

                const fCurH = getF('empCurrentHealthStandard', 9.8, 2.8, 10.5, 10.5);
                const fCurP = getF('empCurrentPensionStandard', 21.0, 2.8, 10.5, 10.5);
                const fPrevYM = getF('empPreviousRevisionYM', 32.5, 2.8, 9.5, 11.0);
                const fChange = getF('empWageChangeType', 44.5, 2.8, 9.5, 12.0);
                const fRetro = getF('empRetroactiveAmount', 57.2, 2.8, 9.5, 15.5);
                const fRem = getF('empRemarks', 73.6, 2.8, 8.5, 21.0);

                // 千円単位換算（例: 300,000円 -> 300千円）
                const healthInThousands = Math.round((emp.currentHealthStandard || 0) / 1000);
                const pensionInThousands = Math.round((emp.currentPensionStandard || 0) / 1000);

                return (
                  <React.Fragment key={emp.id || rowIdx}>
                    {/* ── 1段目 ── */}
                    {/* ① 被保険者整理番号 */}
                    <div
                      className="absolute font-mono font-bold text-center"
                      style={{
                        top: `${rowTop + fEmpNum.y}%`,
                        left: `${fEmpNum.x}%`,
                        width: `${fEmpNum.width || 11.0}%`,
                        fontSize: `${(fEmpNum.fontSize || 11) * 0.115}cqi`
                      }}
                    >
                      {emp.insuranceNumber}
                    </div>

                    {/* ② 被保険者氏名 */}
                    <div
                      className="absolute font-bold truncate"
                      style={{
                        top: `${rowTop + fEmpNm.y}%`,
                        left: `${fEmpNm.x}%`,
                        width: `${fEmpNm.width || 22.0}%`,
                        fontSize: `${(fEmpNm.fontSize || 11) * 0.115}cqi`
                      }}
                    >
                      {emp.name}
                    </div>

                    {/* ③ 生年月日（元号形式: 5-630503 等） */}
                    <div
                      className="absolute font-mono font-bold text-center tracking-wider"
                      style={{
                        top: `${rowTop + fEmpBth.y}%`,
                        left: `${fEmpBth.x}%`,
                        width: `${fEmpBth.width || 18.0}%`,
                        fontSize: `${(fEmpBth.fontSize || 10.5) * 0.115}cqi`
                      }}
                    >
                      {formatNenkinBirthDate(emp.birthDate)}
                    </div>

                    {/* ④ 改定年月 */}
                    <div
                      className="absolute font-mono font-bold text-center"
                      style={{
                        top: `${rowTop + fEmpRevYM.y}%`,
                        left: `${fEmpRevYM.x}%`,
                        width: `${fEmpRevYM.width || 9.5}%`,
                        fontSize: `${(fEmpRevYM.fontSize || 10.5) * 0.115}cqi`
                      }}
                    >
                      {formatNenkinYM(emp.revisionYearMonth)}
                    </div>

                    {/* ⑰ 個人番号（70歳以上被用者・12マス） */}
                    {emp.isOver70 && (
                      <div
                        className="absolute flex items-center justify-between"
                        style={{
                          top: `${rowTop + fEmpMyNo.y}%`,
                          left: `${fEmpMyNo.x}%`,
                          width: `${fEmpMyNo.width || 21.0}%`
                        }}
                      >
                        {myNumChars.map((ch, idx) => (
                          <span
                            key={`myn-${idx}`}
                            className="font-mono font-bold text-center inline-block"
                            style={{
                              width: `${fEmpMyNo.pitch || 1.65}%`,
                              fontSize: `${(fEmpMyNo.fontSize || 10) * 0.115}cqi`
                            }}
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ── 2段目 ── */}
                    {/* ⑤ 従前の標準報酬（健康保険・千円） */}
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        top: `${rowTop + fCurH.y}%`,
                        left: `${fCurH.x}%`,
                        width: `${fCurH.width || 10.5}%`,
                        fontSize: `${(fCurH.fontSize || 10.5) * 0.115}cqi`
                      }}
                    >
                      {healthInThousands.toLocaleString()}
                    </div>

                    {/* ⑤ 従前の標準報酬（厚生年金・千円） */}
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        top: `${rowTop + fCurP.y}%`,
                        left: `${fCurP.x}%`,
                        width: `${fCurP.width || 10.5}%`,
                        fontSize: `${(fCurP.fontSize || 10.5) * 0.115}cqi`
                      }}
                    >
                      {pensionInThousands.toLocaleString()}
                    </div>

                    {/* ⑥ 従前改定月 */}
                    <div
                      className="absolute font-mono text-center text-xs"
                      style={{
                        top: `${rowTop + fPrevYM.y}%`,
                        left: `${fPrevYM.x}%`,
                        width: `${fPrevYM.width || 11.0}%`,
                        fontSize: `${(fPrevYM.fontSize || 9.5) * 0.115}cqi`
                      }}
                    >
                      {formatNenkinYM(emp.previousRevisionYM)}
                    </div>

                    {/* ⑦ 昇(降)給（区分 ＆ 年月） */}
                    <div
                      className="absolute font-bold text-center text-xs"
                      style={{
                        top: `${rowTop + fChange.y}%`,
                        left: `${fChange.x}%`,
                        width: `${fChange.width || 12.0}%`,
                        fontSize: `${(fChange.fontSize || 9.5) * 0.115}cqi`
                      }}
                    >
                      {emp.wageChangeType} {formatNenkinYM(emp.wageChangeYM)}
                    </div>

                    {/* ⑧ 遡及支払額 */}
                    <div
                      className="absolute font-mono text-right text-xs"
                      style={{
                        top: `${rowTop + fRetro.y}%`,
                        left: `${fRetro.x}%`,
                        width: `${fRetro.width || 15.5}%`,
                        fontSize: `${(fRetro.fontSize || 9.5) * 0.115}cqi`
                      }}
                    >
                      {(emp.retroactiveAmount || 0) > 0 ? emp.retroactiveAmount?.toLocaleString() : ''}
                    </div>

                    {/* ⑱ 備考 */}
                    <div
                      className="absolute text-xs truncate"
                      style={{
                        top: `${rowTop + fRem.y}%`,
                        left: `${fRem.x}%`,
                        width: `${fRem.width || 21.0}%`,
                        fontSize: `${(fRem.fontSize || 8.5) * 0.115}cqi`
                      }}
                    >
                      {emp.remarks || (emp.isShortTimeWorker ? '3.短時間労働者' : '4.昇給・降給の理由')}
                    </div>

                    {/* ── 3段目：3ヶ月支給実績 ── */}
                    {/* 1ヶ月目 */}
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        top: `${rowTop + 5.6}%`,
                        left: '9.5%',
                        width: '4.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m1.monthNum || ''}
                    </div>
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        top: `${rowTop + 5.6}%`,
                        left: '14.0%',
                        width: '7.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m1.days || ''}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        top: `${rowTop + 5.6}%`,
                        left: '21.5%',
                        width: '10.5%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m1.cash ? m1.cash.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        top: `${rowTop + 5.6}%`,
                        left: '32.5%',
                        width: '10.5%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m1.inKind ? m1.inKind.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        top: `${rowTop + 5.6}%`,
                        left: '43.5%',
                        width: '13.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m1.total ? m1.total.toLocaleString() : ''}
                    </div>

                    {/* 2ヶ月目 */}
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        top: `${rowTop + 7.7}%`,
                        left: '9.5%',
                        width: '4.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m2.monthNum || ''}
                    </div>
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        top: `${rowTop + 7.7}%`,
                        left: '14.0%',
                        width: '7.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m2.days || ''}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        top: `${rowTop + 7.7}%`,
                        left: '21.5%',
                        width: '10.5%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m2.cash ? m2.cash.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        top: `${rowTop + 7.7}%`,
                        left: '32.5%',
                        width: '10.5%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m2.inKind ? m2.inKind.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        top: `${rowTop + 7.7}%`,
                        left: '43.5%',
                        width: '13.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m2.total ? m2.total.toLocaleString() : ''}
                    </div>

                    {/* 3ヶ月目 */}
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        top: `${rowTop + 9.8}%`,
                        left: '9.5%',
                        width: '4.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m3.monthNum || ''}
                    </div>
                    <div
                      className="absolute font-mono text-center"
                      style={{
                        top: `${rowTop + 9.8}%`,
                        left: '14.0%',
                        width: '7.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m3.days || ''}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        top: `${rowTop + 9.8}%`,
                        left: '21.5%',
                        width: '10.5%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m3.cash ? m3.cash.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        top: `${rowTop + 9.8}%`,
                        left: '32.5%',
                        width: '10.5%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m3.inKind ? m3.inKind.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        top: `${rowTop + 9.8}%`,
                        left: '43.5%',
                        width: '13.0%',
                        fontSize: '1.05cqi'
                      }}
                    >
                      {m3.total ? m3.total.toLocaleString() : ''}
                    </div>

                    {/* 総計・平均額・修正平均額 */}
                    <div
                      className="absolute font-mono font-bold text-right"
                      style={{
                        top: `${rowTop + 5.6}%`,
                        left: '57.2%',
                        width: '15.5%',
                        fontSize: '1.15cqi'
                      }}
                    >
                      {emp.totalWage ? emp.totalWage.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono font-black text-right"
                      style={{
                        top: `${rowTop + 7.7}%`,
                        left: '57.2%',
                        width: '15.5%',
                        fontSize: '1.20cqi'
                      }}
                    >
                      {emp.averageWage ? emp.averageWage.toLocaleString() : ''}
                    </div>
                    <div
                      className="absolute font-mono text-right"
                      style={{
                        top: `${rowTop + 9.8}%`,
                        left: '57.2%',
                        width: '15.5%',
                        fontSize: '1.15cqi'
                      }}
                    >
                      {(emp.modifiedAverageWage && emp.modifiedAverageWage !== emp.averageWage)
                        ? emp.modifiedAverageWage.toLocaleString()
                        : ''}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .official-monthly-revision-page {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: always !important;
            position: relative !important;
          }
          .official-monthly-revision-page img {
            display: ${renderMode === 'exact_pdf' ? 'block' : 'none'} !important;
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
};
