// ══════════════════════════════════════════════════════════════════════════
// 🏛️ 健康保険・厚生年金保険 被保険者資格喪失届（日本年金機構 様式コード2201）
//    公式原本PDF精密印字＆直接入力コンポーネント（SSOT完全連動）
// ══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Printer, ArrowLeft, ZoomIn, ZoomOut, User, RefreshCw, 
  Maximize2, Shield, Edit3, AlertCircle
} from 'lucide-react';
import { 
  loadHealthPensionLossCoordinates,
  fetchHealthPensionLossCoordinatesFromDb,
  HEALTH_PENSION_LOSS_UPDATE_EVENT,
  type HealthPensionLossFieldConfig
} from '../lib/healthPensionLossDocCoordinates';

export interface HealthPensionLossEmployee {
  id: string;
  name: string;
  name_kana?: string;
  birth_date?: string;
  gender?: string;
  my_number?: string;
  pension_number?: string;
  join_date?: string;
  retirement_date?: string;
  address?: string;
  address_kana?: string;
  zip_code?: string;
  [key: string]: any;
}

interface OfficialHealthPensionLossDocProps {
  companyInfo?: any;
  officeSymbol?: string;
  officeNumber?: string;
  employees: HealthPensionLossEmployee[];
  selectedEmployeeId?: string;
  onSelectEmployee?: (id: string) => void;
  onBack?: () => void;
  hideHeader?: boolean;
}

// 西暦から和暦への安全変換関数
function toWareki(dateStr?: string): { eraCode: string; eraName: string; year2: string; month2: string; day2: string } {
  if (!dateStr) return { eraCode: '9', eraName: '令和', year2: '', month2: '', day2: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { eraCode: '9', eraName: '令和', year2: '', month2: '', day2: '' };

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // 日本年金機構元号コード: 5:昭和 (1926/12/25〜1989/01/07), 7:平成 (1989/01/08〜2019/04/30), 9:令和 (2019/05/01〜)
  if (y > 2019 || (y === 2019 && (d.getMonth() > 3 || (d.getMonth() === 3 && d.getDate() >= 1)))) {
    const wy = y - 2018;
    return { eraCode: '9', eraName: '令和', year2: String(wy).padStart(2, '0'), month2: m, day2: day };
  } else if (y > 1989 || (y === 1989 && (d.getMonth() > 0 || (d.getMonth() === 0 && d.getDate() >= 8)))) {
    const wy = y - 1988;
    return { eraCode: '7', eraName: '平成', year2: String(wy).padStart(2, '0'), month2: m, day2: day };
  } else {
    const wy = y - 1925;
    return { eraCode: '5', eraName: '昭和', year2: String(wy).padStart(2, '0'), month2: m, day2: day };
  }
}

// 退職日の翌日（資格喪失日）を計算する関数
function getLossDate(retireDateStr?: string): string {
  if (!retireDateStr) return '';
  const d = new Date(retireDateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const OfficialHealthPensionLossDoc: React.FC<OfficialHealthPensionLossDocProps> = ({
  companyInfo,
  officeSymbol = '',
  officeNumber = '',
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack,
  hideHeader = false
}) => {
  const [coords, setCoords] = useState<HealthPensionLossFieldConfig[]>(() => loadHealthPensionLossCoordinates());
  const [printMode, setPrintMode] = useState<'full' | 'text_only'>('full');
  const [zoom, setZoom] = useState<number>(100);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

  // 原本背景画像
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // 現在選択中の従業員
  const currentEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  // フォーム値State（手動修正可能）
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // 座標設定のリアルタイム同期＆DB同期
  useEffect(() => {
    fetchHealthPensionLossCoordinatesFromDb().then(dbCoords => {
      setCoords(dbCoords);
    });

    const handleCoordsUpdate = (e: any) => {
      if (e.detail) setCoords(e.detail);
    };
    window.addEventListener(HEALTH_PENSION_LOSS_UPDATE_EVENT, handleCoordsUpdate);
    return () => window.removeEventListener(HEALTH_PENSION_LOSS_UPDATE_EVENT, handleCoordsUpdate);
  }, []);

  // 大元マスタ（SSOT）から初期値を一括自動計算
  const calculateMasterValues = useCallback((emp: HealthPensionLossEmployee) => {
    const today = new Date();
    const todayWareki = toWareki(today.toISOString().slice(0, 10));

    // 提出日
    const subY = todayWareki.year2;
    const subM = todayWareki.month2;
    const subD = todayWareki.day2;

    // 事業所整理記号・番号
    let symLeft = '';
    let symRight = '';
    const cleanSym = (officeSymbol || companyInfo?.office_symbol || '').trim();
    const match = cleanSym.match(/^([0-9A-Za-z\u3040-\u309F\u30A0-\u30FF]+?)[\s\-_・]*([0-9]+)$/);
    if (match) {
      symLeft = match[1];
      symRight = match[2];
    } else {
      symLeft = cleanSym.slice(0, 4);
      symRight = cleanSym.slice(4);
    }
    const offNum = (officeNumber || companyInfo?.office_number || '').trim();

    // 従業員の氏名分割
    const nameFull = (emp.name || '').trim();
    const [sei, ...meiArr] = nameFull.split(/[\s　]+/);
    const mei = meiArr.join(' ');

    const nameKanaFull = (emp.name_kana || '').trim();
    const [seiKana, ...meiKanaArr] = nameKanaFull.split(/[\s　]+/);
    const meiKana = meiKanaArr.join(' ');

    // 生年月日
    const birth = toWareki(emp.birth_date);

    // 基礎年金番号 または マイナンバー
    const rawMyNumber = (emp.my_number || '').replace(/[^0-9]/g, '');
    const rawPension = (emp.pension_number || '').replace(/[^0-9]/g, '');
    const idNumber = rawMyNumber ? rawMyNumber : rawPension;

    // 退職日および資格喪失日（退職日翌日）
    const retDateStr = emp.retirement_date || '';
    const lossDateStr = getLossDate(retDateStr);
    const retWareki = toWareki(retDateStr);
    const lossWareki = toWareki(lossDateStr);

    return {
      submitYear: subY,
      submitMonth: subM,
      submitDay: subD,
      officeSymbol_1: symLeft,
      officeSymbol_2: symRight,
      officeNumber: offNum,
      officeZipCode: (companyInfo?.postal_code || '5200001').replace(/[^0-9]/g, ''),
      officeAddress: companyInfo?.address || '滋賀県大津市坂本3丁目21-16',
      officeName: companyInfo?.company_name || '株式会社cocotte',
      ownerName: companyInfo?.representative_name ? `代表取締役 ${companyInfo.representative_name}` : '代表取締役 駒井 秀一朗',
      officeTel_area: '077',
      officeTel_local: '574',
      officeTel_number: '6907',

      // 被保険者1
      insuredPersonNumber_1: '001',
      nameKana_1: [seiKana, meiKana].filter(Boolean).join(' '),
      nameKanji_1: [sei, mei].filter(Boolean).join(' '),
      birthEra_1: birth.eraCode,
      birthYear_1: birth.year2,
      birthMonth_1: birth.month2,
      birthDay_1: birth.day2,
      myNumberOrPension_1: idNumber,

      // 喪失年月日（退職日翌日）
      lossYear_1: lossWareki.year2,
      lossMonth_1: lossWareki.month2,
      lossDay_1: lossWareki.day2,

      // 喪失原因（退職日の設定がある場合は 4:退職等）
      lossReason_1: retDateStr ? '4' : '4',
      retireYear_1: retWareki.year2,
      retireMonth_1: retWareki.month2,
      retireDay_1: retWareki.day2,

      // 備考
      remarks_1: '',
      remarks_other_text_1: '',
      card_returned_count_1: '1', // デフォルト1枚添付
      card_uncollected_count_1: '',

      // 70歳以上被用者不該当
      over70_not_applicable_1: '',
      over70_year_1: '',
      over70_month_1: '',
      over70_day_1: ''
    };
  }, [officeSymbol, officeNumber, companyInfo]);

  // 従業員切り替え時に初期値を自動計算・反映
  useEffect(() => {
    if (!currentEmployee) return;
    const values = calculateMasterValues(currentEmployee);
    setFormValues(values);
  }, [currentEmployee, calculateMasterValues]);

  // 大元マスタから最新データを再同期
  const handleSyncFromMaster = () => {
    if (!currentEmployee) return;
    const values = calculateMasterValues(currentEmployee);
    setFormValues(values);
  };

  // PDF.jsによる原本背景描画（1ページ目）
  useEffect(() => {
    let isCancelled = false;
    const renderTemplate = async () => {
      setIsLoadingPdf(true);
      try {
        // @ts-ignore
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          await new Promise(resolve => { script.onload = resolve; });
        }
        // @ts-ignore
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const cMapUrl = window.location.origin ? (window.location.origin + '/cmaps/') : '/cmaps/';
        const standardFontDataUrl = window.location.origin ? (window.location.origin + '/standard_fonts/') : '/standard_fonts/';

        const loadingTask = pdfjsLib.getDocument({
          url: '/health_pension_loss_template.pdf',
          cMapUrl: cMapUrl,
          cMapPacked: true,
          standardFontDataUrl: standardFontDataUrl,
          enableXfa: true
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const scale = 2.0;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (isCancelled) return;

        setBgPdfImg(canvas.toDataURL('image/png'));
        setIsLoadingPdf(false);
      } catch (err) {
        console.warn('Could not load health_pension_loss_template.pdf:', err);
        setIsLoadingPdf(false);
      }
    };

    renderTemplate();
    return () => { isCancelled = true; };
  }, []);

  const handleInputChange = (fieldId: string, val: string) => {
    setFormValues(prev => ({ ...prev, [fieldId]: val }));
  };

  const handlePrint = () => {
    window.print();
  };

  if (!currentEmployee) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 font-bold text-sm">対象の従業員データが見つかりません。</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
            戻る
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans print:m-0 print:p-0">
      {/* 🧭 操作ヘッダーバー（印刷時は非表示） */}
      {!hideHeader && (
        <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition cursor-pointer"
                title="戻る"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  日本年金機構 / 協会けんぽ公式様式（コード2201）
                </span>
                <span className="text-xs text-slate-400 font-bold">A4縦・公的届出書</span>
              </div>
              <h2 className="text-lg font-black text-slate-800 mt-1 flex items-center gap-2">
                健康保険・厚生年金保険 被保険者資格喪失届
                <span className="text-xs text-slate-500 font-normal">（兼 70歳以上被用者不該当届）</span>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 従業員選択ドロップダウン */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
              <User className="w-4 h-4 text-rose-600 shrink-0" />
              <select
                value={currentEmployee.id}
                onChange={(e) => onSelectEmployee && onSelectEmployee(e.target.value)}
                className="bg-transparent text-slate-800 text-xs font-black outline-hidden cursor-pointer"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.retirement_date ? `退職日: ${emp.retirement_date}` : `${emp.join_date}入社 / 在職中`})
                  </option>
                ))}
              </select>
            </div>

            {/* 大元マスタ再同期ボタン */}
            <button
              onClick={handleSyncFromMaster}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              title="大元台帳マスタ（SSOT）から最新の情報を再取得してフォームに流し込みます"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              マスタ再同期
            </button>

            {/* 印刷モード切替 */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintMode('full')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  printMode === 'full' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="原本PDF枠線・背景を含めて白紙A4用紙へまるごと印刷します"
              >
                原本枠ごと印刷
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('text_only')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  printMode === 'text_only' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="年金機構の公式OCR用紙をプリンタにセットし、文字だけを所定マス目に印字します"
              >
                OCR用紙へ文字印字
              </button>
            </div>

            {/* ズーム＆全体表示コントロール */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(40, z - 5))}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                title="縮小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(isSidePanelOpen ? 70 : 85)}
                className={`px-2 py-0.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  zoom <= 75 ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
                title="画面枠内にA4用紙全体がすっぽり収まる最適倍率"
              >
                <Maximize2 className="w-3 h-3" />
                <span>全体表示</span>
              </button>
              <button
                type="button"
                onClick={() => setZoom(100)}
                className={`px-2 py-0.5 rounded-lg text-xs font-black transition cursor-pointer ${
                  zoom === 100 ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-200'
                }`}
                title="A4実寸100%で表示"
              >
                100%
              </button>
              <span className="text-xs font-mono font-black px-1 text-slate-700">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(150, z + 5))}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                title="拡大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 編集パネル折りたたみトグルボタン */}
            <button
              type="button"
              onClick={() => setIsSidePanelOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                isSidePanelOpen
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs'
              }`}
              title={isSidePanelOpen ? '編集パネルを閉じてプレビューを画面最大化します' : '編集パネルを表示します'}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isSidePanelOpen ? 'パネルを閉じる' : '編集パネル表示'}</span>
            </button>

            {/* 印刷・PDF保存ボタン */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              公的A4印刷 / PDF保存
            </button>
          </div>
        </div>
      )}

      {/* 🖥️ メイン作業エリア（プレビュー＋入力パネル） */}
      <div className="flex flex-col lg:flex-row items-start gap-4 print:block">
        
        {/* 左側：リアルタイム原本プレビューコンテナ */}
        <div className="flex-1 w-full overflow-x-auto flex flex-col items-center bg-slate-200/80 p-2 sm:p-5 rounded-2xl border border-slate-300 print:bg-white print:p-0 print:border-none print:overflow-visible">
          
          {/* 原本スケーリングサイザー */}
          <div 
            style={{ 
              width: `${210 * (zoom / 100)}mm`, 
              height: `${297 * (zoom / 100)}mm`,
              maxWidth: '100%'
            }} 
            className="relative transition-[width,height] duration-150 ease-out print:w-[210mm] print:h-[297mm]"
          >
            {/* A4縦 実寸コンテナ (210mm × 297mm) */}
            <div 
              ref={previewContainerRef}
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: '210mm',
                height: '297mm'
              }}
              className="bg-white relative shadow-2xl border border-slate-400 overflow-hidden select-none box-border print:shadow-none print:border-none print:transform-none print:w-full print:h-[297mm]"
            >
              {/* 原本背景画像（PDF.jsレンダリング） */}
              {bgPdfImg ? (
                <img 
                  src={bgPdfImg} 
                  alt="資格喪失届 原本背景" 
                  className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
                    printMode === 'text_only' ? 'print:hidden opacity-90' : 'opacity-100'
                  }`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                  {isLoadingPdf ? '原本PDFを読み込み中...' : '原本背景なし'}
                </div>
              )}

              {/* 各印字項目の配置 */}
              {coords.filter(c => !c.disabled).map(field => {
                let val = formValues[field.id] !== undefined ? formValues[field.id] : field.example;

                // 📮 郵便番号（上3桁・下4桁）の自動分配
                if (field.id === 'officeZipCode_first') {
                  const raw = String(formValues['officeZipCode'] || '').replace(/[^0-9]/g, '');
                  val = raw ? raw.slice(0, 3) : field.example;
                } else if (field.id === 'officeZipCode_last') {
                  const raw = String(formValues['officeZipCode'] || '').replace(/[^0-9]/g, '');
                  val = raw ? raw.slice(3, 7) : field.example;
                }

                // ⭕ 丸囲み項目の特別レンダリング
                if (field.isCircle) {
                  if (field.circleValueKey && field.circleActiveValue) {
                    const currentVal = formValues[field.circleValueKey];
                    if (currentVal !== field.circleActiveValue) {
                      return null; // 現在選択されていない選択肢の〇は印字しない
                    }
                  }

                  const circleW = field.circleWidth || 24;
                  const circleH = field.circleHeight || 16;

                  return (
                    <div
                      key={field.id}
                      style={{
                        position: 'absolute',
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${circleW}px`,
                        height: `${circleH}px`,
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '9999px',
                        border: '1.8px solid #0f172a',
                        pointerEvents: 'none'
                      }}
                    />
                  );
                }

                // チェックボックス（70歳以上不該当）
                if (field.id === 'over70_not_applicable_1') {
                  const isChecked = formValues['over70_not_applicable_1'] === '1' || formValues['over70_not_applicable_1'] === 'true';
                  if (!isChecked) return null;
                  return (
                    <div
                      key={field.id}
                      style={{
                        position: 'absolute',
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        fontSize: '13px',
                        fontWeight: '900',
                        color: '#0f172a',
                        fontFamily: 'sans-serif',
                        lineHeight: 1,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      ✓
                    </div>
                  );
                }

                // マス目印字（pitch指定あり：原本幅210mm比率 % ➔ (pitch * 2.1)mm 換算）
                if (field.pitch && field.pitch > 0 && val) {
                  const chars = String(val).split('');
                  return (
                    <div
                      key={field.id}
                      style={{
                        position: 'absolute',
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        fontSize: `${field.fontSize || 10}px`,
                        fontWeight: 'bold',
                        color: '#0f172a',
                        fontFamily: 'monospace',
                        lineHeight: 1,
                        width: 'max-content',
                        whiteSpace: 'nowrap'
                      }}
                      className="flex items-center pointer-events-none"
                    >
                      {chars.map((char, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: 'inline-block',
                            width: `${(field.pitch || 2.5) * 2.1}mm`,
                            textAlign: 'center',
                            fontSize: `${field.fontSize || 10}px`,
                            fontFamily: 'monospace',
                            lineHeight: 1,
                            flexShrink: 0
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  );
                }

                // 通常テキスト印字
                return (
                  <div
                    key={field.id}
                    style={{
                      position: 'absolute',
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      fontSize: `${field.fontSize || 10}px`,
                      fontWeight: 'bold',
                      color: '#0f172a',
                      fontFamily: field.id.includes('Name') || field.id.includes('Kana') ? 'sans-serif' : 'monospace',
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      maxWidth: field.width ? `${field.width}mm` : undefined
                    }}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 右側：直接手入力・上書き編集サイドバーパネル */}
        {isSidePanelOpen && (
          <div className="w-full lg:w-96 print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 shrink-0 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-rose-600" />
                  資格喪失届 手入力・上書き
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">変更内容は即座にプレビューへ反映されます</p>
              </div>
            </div>

            {/* 被保険者 氏名・整理番号 */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="font-black text-slate-700 block text-xs">【被保険者 本人情報】</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">氏名フリガナ</label>
                  <input
                    type="text"
                    value={formValues['nameKana_1'] || ''}
                    onChange={(e) => handleInputChange('nameKana_1', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">氏名漢字</label>
                  <input
                    type="text"
                    value={formValues['nameKanji_1'] || ''}
                    onChange={(e) => handleInputChange('nameKanji_1', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">整理番号</label>
                  <input
                    type="text"
                    value={formValues['insuredPersonNumber_1'] || ''}
                    onChange={(e) => handleInputChange('insuredPersonNumber_1', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">マイナンバー/年金番号</label>
                  <input
                    type="text"
                    value={formValues['myNumberOrPension_1'] || ''}
                    onChange={(e) => handleInputChange('myNumberOrPension_1', e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-xs bg-white font-mono"
                  />
                </div>
              </div>

              {/* 生年月日 */}
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">③ 生年月日</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <select
                    value={formValues['birthEra_1'] || '5'}
                    onChange={(e) => handleInputChange('birthEra_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-bold text-xs bg-white"
                  >
                    <option value="5">5.昭和 〇</option>
                    <option value="7">7.平成 〇</option>
                    <option value="9">9.令和 〇</option>
                  </select>
                  <input
                    type="text"
                    value={formValues['birthYear_1'] || ''}
                    onChange={(e) => handleInputChange('birthYear_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold"
                    placeholder="年"
                  />
                  <input
                    type="text"
                    value={formValues['birthMonth_1'] || ''}
                    onChange={(e) => handleInputChange('birthMonth_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold"
                    placeholder="月"
                  />
                  <input
                    type="text"
                    value={formValues['birthDay_1'] || ''}
                    onChange={(e) => handleInputChange('birthDay_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold"
                    placeholder="日"
                  />
                </div>
              </div>
            </div>

            {/* 資格喪失日 ＆ 喪失原因 */}
            <div className="space-y-3 bg-rose-50/50 p-3.5 rounded-xl border border-rose-200">
              <span className="font-black text-rose-800 block text-xs flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                【資格喪失・退職情報】
              </span>

              {/* ⑤ 資格喪失年月日（退職日翌日） */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-rose-800 font-bold block">⑤ 資格喪失年月日（退職日翌日）</label>
                  <span className="text-[10px] text-rose-600 font-bold bg-white px-1.5 py-0.5 rounded border border-rose-200">
                    原本固定: 9.令和
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="p-1.5 bg-rose-100 border border-rose-300 rounded font-bold text-xs text-rose-800 flex items-center justify-center">
                    令和
                  </div>
                  <input
                    type="text"
                    value={formValues['lossYear_1'] || ''}
                    onChange={(e) => handleInputChange('lossYear_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold bg-white"
                    placeholder="年"
                  />
                  <input
                    type="text"
                    value={formValues['lossMonth_1'] || ''}
                    onChange={(e) => handleInputChange('lossMonth_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold bg-white"
                    placeholder="月"
                  />
                  <input
                    type="text"
                    value={formValues['lossDay_1'] || ''}
                    onChange={(e) => handleInputChange('lossDay_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold bg-white"
                    placeholder="日"
                  />
                </div>
              </div>

              {/* ⑥ 喪失（不該当）原因 */}
              <div>
                <label className="text-[10px] text-slate-700 font-bold block mb-1">⑥ 喪失原因（〇で囲む）</label>
                <select
                  value={formValues['lossReason_1'] || '4'}
                  onChange={(e) => handleInputChange('lossReason_1', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-bold text-xs bg-white"
                >
                  <option value="4">4. 退職等 〇（退職・適用除外）</option>
                  <option value="5">5. 死亡 〇</option>
                  <option value="7">7. 75歳到達 〇（後期高齢者移行）</option>
                  <option value="9">9. 障害認定 〇（健保のみ喪失）</option>
                  <option value="11">11. 社会保障協定 〇</option>
                </select>
              </div>

              {/* 退職等の年月日 */}
              <div>
                <label className="text-[10px] text-slate-700 font-bold block mb-1">⑥ 退職等（または死亡）当日年月日</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="p-1.5 bg-slate-100 border border-slate-300 rounded font-bold text-xs text-slate-600 flex items-center justify-center">
                    令和
                  </div>
                  <input
                    type="text"
                    value={formValues['retireYear_1'] || ''}
                    onChange={(e) => handleInputChange('retireYear_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold bg-white"
                    placeholder="年"
                  />
                  <input
                    type="text"
                    value={formValues['retireMonth_1'] || ''}
                    onChange={(e) => handleInputChange('retireMonth_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold bg-white"
                    placeholder="月"
                  />
                  <input
                    type="text"
                    value={formValues['retireDay_1'] || ''}
                    onChange={(e) => handleInputChange('retireDay_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold bg-white"
                    placeholder="日"
                  />
                </div>
              </div>
            </div>

            {/* ⑦ 備考 ＆ 資格確認書回収 */}
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="font-black text-slate-700 block text-xs">【備考・資格確認書回収】</span>

              <div>
                <label className="text-[10px] text-slate-600 font-bold block mb-1">⑦ 備考（該当がある場合〇）</label>
                <select
                  value={formValues['remarks_1'] || ''}
                  onChange={(e) => handleInputChange('remarks_1', e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-bold text-xs bg-white"
                >
                  <option value="">該当なし</option>
                  <option value="1">1. 二以上事業所勤務者の喪失 〇</option>
                  <option value="2">2. 退職後の継続再雇用者の喪失 〇</option>
                  <option value="3">3. その他 〇</option>
                </select>
              </div>

              {formValues['remarks_1'] === '3' && (
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">その他の理由</label>
                  <input
                    type="text"
                    value={formValues['remarks_other_text_1'] || ''}
                    onChange={(e) => handleInputChange('remarks_other_text_1', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded text-xs"
                    placeholder="転勤、加入員同月得喪 など"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">資格確認書 添付枚数</label>
                  <input
                    type="text"
                    value={formValues['card_returned_count_1'] || ''}
                    onChange={(e) => handleInputChange('card_returned_count_1', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono text-center"
                    placeholder="枚"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">返不能枚数</label>
                  <input
                    type="text"
                    value={formValues['card_uncollected_count_1'] || ''}
                    onChange={(e) => handleInputChange('card_uncollected_count_1', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded text-xs font-mono text-center"
                    placeholder="枚"
                  />
                </div>
              </div>
            </div>

            {/* ⑧ 70歳以上被用者不該当 */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formValues['over70_not_applicable_1'] === '1'}
                  onChange={(e) => handleInputChange('over70_not_applicable_1', e.target.checked ? '1' : '')}
                  className="w-4 h-4 text-rose-600 rounded"
                />
                <span>⑧ 70歳以上被用者不該当</span>
              </label>

              {formValues['over70_not_applicable_1'] === '1' && (
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">不該当年月日</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="text"
                      value={formValues['over70_year_1'] || ''}
                      onChange={(e) => handleInputChange('over70_year_1', e.target.value)}
                      className="p-1 border border-slate-300 rounded font-mono text-center"
                      placeholder="年"
                    />
                    <input
                      type="text"
                      value={formValues['over70_month_1'] || ''}
                      onChange={(e) => handleInputChange('over70_month_1', e.target.value)}
                      className="p-1 border border-slate-300 rounded font-mono text-center"
                      placeholder="月"
                    />
                    <input
                      type="text"
                      value={formValues['over70_day_1'] || ''}
                      onChange={(e) => handleInputChange('over70_day_1', e.target.value)}
                      className="p-1 border border-slate-300 rounded font-mono text-center"
                      placeholder="日"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
