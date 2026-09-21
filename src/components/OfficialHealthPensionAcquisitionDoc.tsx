import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Printer, ArrowLeft, User, Shield, Edit3, ZoomIn, ZoomOut, RefreshCw
} from 'lucide-react';
import { 
  loadHealthPensionAcqCoordinates, 
  saveHealthPensionAcqCoordinates,
  saveHealthPensionAcqCoordinatesToDb,
  fetchHealthPensionAcqCoordinatesFromDb,
  broadcastHealthPensionAcqCoordinates,
  HEALTH_PENSION_ACQ_COORDS_UPDATE_EVENT,
  type HealthPensionAcqFieldConfig 
} from '../lib/healthPensionAcquisitionDocCoordinates';

export interface HealthPensionAcquisitionEmployee {
  id: string;
  name: string;
  name_kana?: string;
  last_name?: string;
  first_name?: string;
  last_name_kana?: string;
  first_name_kana?: string;
  birth_date?: string;
  gender?: string;
  my_number?: string;
  basic_pension_number?: string;
  insurance_number?: string; // 被保険者整理番号
  join_date: string;
  retirement_date?: string;
  base_salary: number;
  monthly_remuneration?: number; // 報酬月額（通貨）
  goods_remuneration?: number; // 報酬月額（現物）
  dependents_count?: number;
  employment_type?: string;
  address?: string;
  zip_code?: string;
}

export interface OfficialHealthPensionAcquisitionDocProps {
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
    zip_code?: string;
  };
  officeSymbol?: string; // 事業所整理記号 (例: 01-イロ)
  officeNumber?: string; // 事業所番号 (例: 12345)
  employees: HealthPensionAcquisitionEmployee[];
  selectedEmployeeId?: string;
  onSelectEmployee?: (id: string) => void;
  onBack?: () => void;
  customCoords?: HealthPensionAcqFieldConfig[];
  hideHeader?: boolean;
}

// 和暦変換ヘルパー（元号コード: 5昭和, 7平成, 9令和）
function parseWarekiEraCode(dateStr?: string): { eraCode: string; year2: string; month2: string; day2: string } {
  if (!dateStr) return { eraCode: '9', year2: '08', month2: '04', day2: '01' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { eraCode: '9', year2: '08', month2: '04', day2: '01' };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (y >= 2019) {
    const ry = y - 2018;
    return { eraCode: '9', year2: String(ry).padStart(2, '0'), month2: m, day2: day };
  } else if (y >= 1989) {
    const hy = y - 1988;
    return { eraCode: '7', year2: String(hy).padStart(2, '0'), month2: m, day2: day };
  } else if (y >= 1926) {
    const sy = y - 1925;
    return { eraCode: '5', year2: String(sy).padStart(2, '0'), month2: m, day2: day };
  } else {
    return { eraCode: '3', year2: '01', month2: m, day2: day };
  }
}

export const OfficialHealthPensionAcquisitionDoc: React.FC<OfficialHealthPensionAcquisitionDocProps> = ({
  companyInfo,
  officeSymbol = '01-イロ',
  officeNumber = '12345',
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack,
  customCoords,
  hideHeader = false
}) => {
  // 対象従業員
  const currentEmpId = selectedEmployeeId || employees[0]?.id || '';
  const currentEmployee = employees.find(e => e.id === currentEmpId) || employees[0];

  // リアルタイム座標設定State
  const [coords, setCoords] = useState<HealthPensionAcqFieldConfig[]>(() => customCoords || loadHealthPensionAcqCoordinates());

  // マウント時にDBから最新座標を取得
  useEffect(() => {
    if (customCoords) return;
    let isCancelled = false;
    fetchHealthPensionAcqCoordinatesFromDb().then(dbCoords => {
      if (!isCancelled && dbCoords && dbCoords.length > 0) {
        setCoords(dbCoords);
      }
    });
    return () => { isCancelled = true; };
  }, [customCoords]);

  // 印刷モード: 'full' (原本PDF枠ごと印刷) | 'text_only' (OCR用紙への文字だけ印字)
  const [printMode, setPrintMode] = useState<'full' | 'text_only'>('full');

  // 表示ズーム率
  const [zoom, setZoom] = useState<number>(100);

  // 原本背景画像（PDF.jsレンダリング）
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);

  // フォーム入力値State
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // 大元マスタ（SSOT）からの自動算出・バインド
  const calculateMasterValues = useCallback((emp: HealthPensionAcquisitionEmployee) => {
    const today = new Date();
    const todayEra = parseWarekiEraCode(today.toISOString().split('T')[0]);
    const birth = parseWarekiEraCode(emp.birth_date);
    const join = parseWarekiEraCode(emp.join_date);

    // 事業所整理記号の分解
    const parts = (officeSymbol || '').split('-');
    const symCode = parts[0] || '01';
    const symKana = parts[1] || 'イロ';

    // マイナンバーまたは基礎年金番号
    const cleanMyNumber = (emp.my_number || '').replace(/[^0-9]/g, '');
    const cleanPension = (emp.basic_pension_number || '').replace(/[^0-9]/g, '');
    const idNumber = cleanMyNumber || cleanPension;

    // 性別コード（1:男, 2:女）
    const genderCode = emp.gender === '女' || emp.gender === 'female' ? '2' : '1';

    // 報酬月額（通貨・現物・合計）
    const currencyVal = emp.monthly_remuneration || emp.base_salary || 0;
    const goodsVal = emp.goods_remuneration || 0;
    const totalVal = currencyVal + goodsVal;

    // 被扶養者（0:無, 1:有）
    const depCode = (emp.dependents_count && emp.dependents_count > 0) ? '1' : '0';

    // 氏名の分割（SSOT連携 & スペース自動分解フォールバック）
    let sei = emp.last_name || '';
    let mei = emp.first_name || '';
    if (!sei && !mei && emp.name) {
      const nameParts = emp.name.trim().split(/[\s　]+/);
      sei = nameParts[0] || '';
      mei = nameParts.slice(1).join(' ') || '';
    }

    // フリガナの分割（SSOT連携 & スペース自動分解フォールバック）
    let seiKana = emp.last_name_kana || '';
    let meiKana = emp.first_name_kana || '';
    if (!seiKana && !meiKana && emp.name_kana) {
      const kanaParts = emp.name_kana.trim().split(/[\s　]+/);
      seiKana = kanaParts[0] || '';
      meiKana = kanaParts.slice(1).join(' ') || '';
    }

    return {
      submitYear: todayEra.year2,
      submitMonth: todayEra.month2,
      submitDay: todayEra.day2,
      officeSymbolCode: symCode,
      officeSymbolKana: symKana,
      officeNumber: officeNumber || '',
      officeZipCode: (companyInfo.zip_code || '5200000').replace(/[^0-9]/g, ''),
      officeAddress: companyInfo.address || '',
      officeName: companyInfo.name || '',
      employerName: companyInfo.representative_name || '',
      employerPhone: companyInfo.phone_number || '',
      srName: '',
      // 被保険者1
      insuredNo_1: emp.insurance_number || '',
      nameKanjiSei_1: sei,
      nameKanjiMei_1: mei,
      nameKanaSei_1: seiKana,
      nameKanaMei_1: meiKana,
      nameKana_1: [seiKana, meiKana].filter(Boolean).join(' '),
      nameKanji_1: [sei, mei].filter(Boolean).join(' '),
      birthEra_1: birth.eraCode,
      birthYear_1: birth.year2,
      birthMonth_1: birth.month2,
      birthDay_1: birth.day2,
      gender_1: genderCode,
      acqCategory_1: '1', // 1:健保・厚年
      myNumberOrPension_1: idNumber,
      acqEra_1: join.eraCode,
      acqYear_1: join.year2,
      acqMonth_1: join.month2,
      acqDay_1: join.day2,
      dependents_1: depCode,
      currencyRemuneration_1: currencyVal ? String(currencyVal) : '',
      goodsRemuneration_1: goodsVal ? String(goodsVal) : '',
      totalRemuneration_1: totalVal ? String(totalVal) : '',
      remarks_1: '',
      zipCode_1: (emp.zip_code || '5200001').replace(/[^0-9]/g, ''),
      address_1: emp.address || '',
      certIssue_1: ''
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

  // 座標変更イベントリスナー
  useEffect(() => {
    const handleCoordsUpdate = (e: any) => {
      if (e.detail) {
        setCoords(e.detail);
      }
    };
    window.addEventListener(HEALTH_PENSION_ACQ_COORDS_UPDATE_EVENT, handleCoordsUpdate);
    return () => window.removeEventListener(HEALTH_PENSION_ACQ_COORDS_UPDATE_EVENT, handleCoordsUpdate);
  }, []);

  // 原本ドラッグ微調整
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  const updateFieldCoord = useCallback((id: string, x: number, y: number) => {
    setCoords(prev => {
      const precision = 100;
      const finalX = Math.round(x * precision) / precision;
      const finalY = Math.round(y * precision) / precision;
      const updated = prev.map(f => f.id === id ? { ...f, x: finalX, y: finalY } : f);
      saveHealthPensionAcqCoordinates(updated);
      broadcastHealthPensionAcqCoordinates(updated);
      return updated;
    });
  }, []);

  const handleStartDrag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const f = coords.find(item => item.id === id);
    if (!f) return;
    setDraggingFieldId(id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: f.x,
      startY: f.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingFieldId || !dragStartRef.current || !previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, dragStartRef.current.startX + deltaX));
      const newY = Math.max(0, Math.min(100, dragStartRef.current.startY + deltaY));
      updateFieldCoord(draggingFieldId, newX, newY);
    };

    const handleMouseUp = () => {
      if (draggingFieldId) {
        setDraggingFieldId(null);
        dragStartRef.current = null;
        saveHealthPensionAcqCoordinatesToDb(coords);
      }
    };

    if (draggingFieldId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingFieldId, coords, updateFieldCoord]);

  // PDF.js による原本背景レンダリング
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
          url: '/health_pension_acquisition_template.pdf',
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

        const imgUrl = canvas.toDataURL('image/png');
        setBgPdfImg(imgUrl);
        setIsLoadingPdf(false);
      } catch (err) {
        console.warn('Could not load health_pension_acquisition_template.pdf:', err);
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
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  日本年金機構 / 協会けんぽ公式様式（コード2200）
                </span>
                <span className="text-xs text-slate-400 font-bold">A4縦・公的届出書</span>
              </div>
              <h2 className="text-lg font-black text-slate-800 mt-1 flex items-center gap-2">
                健康保険・厚生年金保険 被保険者資格取得届
                <span className="text-xs text-slate-500 font-normal">（兼 70歳以上被用者該当届）</span>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 従業員選択ドロップダウン */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
              <User className="w-4 h-4 text-indigo-600 shrink-0" />
              <select
                value={currentEmployee.id}
                onChange={(e) => onSelectEmployee && onSelectEmployee(e.target.value)}
                className="bg-transparent text-slate-800 text-xs font-black outline-hidden cursor-pointer"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.join_date} 入社 / 基本給 ¥{(emp.base_salary || 0).toLocaleString()})
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
                  printMode === 'full' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="原本PDF枠線・背景を含めて白紙A4用紙へまるごと印刷します"
              >
                原本枠ごと印刷
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('text_only')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  printMode === 'text_only' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="年金機構の公式OCR用紙をプリンタにセットし、文字だけを所定マス目に印字します"
              >
                OCR用紙へ文字印字
              </button>
            </div>

            {/* ズーム */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
              <button
                onClick={() => setZoom(z => Math.max(50, z - 10))}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                title="縮小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold px-2 text-slate-700">{zoom}%</span>
              <button
                onClick={() => setZoom(z => Math.min(150, z + 10))}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 cursor-pointer"
                title="拡大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* 印刷・PDF保存ボタン */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition cursor-pointer"
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
        <div className="flex-1 w-full overflow-x-auto flex justify-center bg-slate-200/80 p-4 sm:p-8 rounded-2xl border border-slate-300 print:bg-white print:p-0 print:border-none print:overflow-visible">
          
          {/* A4縦 実寸コンテナ (210mm × 297mm) */}
          <div 
            ref={previewContainerRef}
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="w-[210mm] h-[297mm] bg-white shadow-2xl relative border border-slate-400 print:shadow-none print:border-none print:transform-none print:w-full print:h-[297mm] overflow-hidden select-none box-border"
          >
            {/* 原本背景画像（PDF.jsレンダリング） */}
            {bgPdfImg ? (
              <img 
                src={bgPdfImg} 
                alt="資格取得届 原本背景" 
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
              if (field.id === 'officeZipCode' || field.id === 'zipCode_1') {
                val = String(val || '').replace(/[^0-9]/g, '');
              }
              const isDragging = draggingFieldId === field.id;

              // ⭕ 丸囲み項目の特別レンダリング（原本の選択肢を〇で囲む）
              if (field.isCircle) {
                // 連動キー（例: 'gender_1'）と有効値（例: '1'）が指定されている場合
                if (field.circleValueKey && field.circleActiveValue) {
                  const currentVal = formValues[field.circleValueKey];
                  if (currentVal !== field.circleActiveValue) {
                    return null; // 現在選択されていない選択肢の〇は表示しない
                  }
                } else if (!val) {
                  return null;
                }

                const circleW = 24;
                const circleH = 16;

                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => handleStartDrag(field.id, e)}
                    style={{
                      position: 'absolute',
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: `${circleW}px`,
                      height: `${circleH}px`,
                      cursor: 'move',
                      zIndex: isDragging ? 50 : 25
                    }}
                    className={`flex items-center justify-center transition-colors pointer-events-auto select-none ${
                      isDragging ? 'ring-2 ring-amber-500 rounded-full bg-amber-300/40' : 'hover:ring-1 hover:ring-indigo-400 rounded-full'
                    } print:ring-0`}
                    title={`${field.name} (ドラッグで微調整可能)`}
                  >
                    <svg viewBox="0 0 32 24" className="w-full h-full overflow-visible text-slate-950 print:text-black">
                      <ellipse
                        cx="16"
                        cy="12"
                        rx="14"
                        ry="9.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      />
                    </svg>
                  </div>
                );
              }

              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => handleStartDrag(field.id, e)}
                  style={{
                    position: 'absolute',
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    fontSize: `${field.fontSize}pt`,
                    width: field.pitch && field.pitch > 0 ? 'max-content' : (field.width ? `${field.width * 2.1}mm` : 'auto'),
                    cursor: 'move',
                    zIndex: isDragging ? 50 : 10
                  }}
                  className={`leading-none font-mono font-black text-slate-950 transition-colors ${
                    isDragging ? 'bg-amber-300/60 ring-2 ring-amber-500 rounded' : 'hover:bg-indigo-500/20 hover:ring-1 hover:ring-indigo-400 rounded-xs'
                  } print:bg-transparent print:ring-0`}
                  title={`${field.name} (クリック＆ドラッグで微調整)`}
                >
                  {/* マス目ピッチ指定がある場合は1文字ずつ等間隔印字 */}
                  {field.pitch && field.pitch > 0 && val ? (
                    <div className="flex items-center pointer-events-none">
                      {val.split('').map((char, charIdx) => (
                        <span 
                          key={charIdx} 
                          style={{ 
                            display: 'inline-block',
                            width: `${(field.pitch || 2.5) * 2.1}mm`,
                            textAlign: 'center',
                            fontSize: `${field.fontSize}pt`,
                            fontFamily: 'monospace',
                            lineHeight: 1,
                            flexShrink: 0
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span>{val}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右側：直接値入力・微調整パネル（印刷時非表示） */}
        <div className="w-full lg:w-96 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4 print:hidden shrink-0">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800">印字内容ダイレクト編集</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-bold">画面プレビュー即時反映</span>
          </div>

          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 text-xs">
            {/* 提出日 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 block text-[11px]">📅 提出年月日</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">令和（年）</label>
                  <input
                    type="text"
                    value={formValues['submitYear'] || ''}
                    onChange={(e) => handleInputChange('submitYear', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">月</label>
                  <input
                    type="text"
                    value={formValues['submitMonth'] || ''}
                    onChange={(e) => handleInputChange('submitMonth', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">日</label>
                  <input
                    type="text"
                    value={formValues['submitDay'] || ''}
                    onChange={(e) => handleInputChange('submitDay', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* 事業所情報 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 block text-[11px]">🏢 提出者（事業所）情報</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">整理記号(数字)</label>
                  <input
                    type="text"
                    value={formValues['officeSymbolCode'] || ''}
                    onChange={(e) => handleInputChange('officeSymbolCode', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">整理記号(カナ)</label>
                  <input
                    type="text"
                    value={formValues['officeSymbolKana'] || ''}
                    onChange={(e) => handleInputChange('officeSymbolKana', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">事業所番号</label>
                  <input
                    type="text"
                    value={formValues['officeNumber'] || ''}
                    onChange={(e) => handleInputChange('officeNumber', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500">事業所所在地</label>
                <input
                  type="text"
                  value={formValues['officeAddress'] || ''}
                  onChange={(e) => handleInputChange('officeAddress', e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">事業所名称</label>
                <input
                  type="text"
                  value={formValues['officeName'] || ''}
                  onChange={(e) => handleInputChange('officeName', e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">事業主氏名</label>
                <input
                  type="text"
                  value={formValues['employerName'] || ''}
                  onChange={(e) => handleInputChange('employerName', e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">電話番号</label>
                <input
                  type="text"
                  value={formValues['employerPhone'] || ''}
                  onChange={(e) => handleInputChange('employerPhone', e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold"
                />
              </div>
            </div>

            {/* 被保険者情報 */}
            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-200 space-y-2">
              <span className="font-bold text-indigo-900 block text-[11px]">👤 被保険者（対象者）情報</span>
              
              {/* 氏名（漢字）：氏・名 分割 */}
              <div>
                <label className="text-[10px] text-slate-700 font-bold block mb-1">② 氏名（漢字）</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-500 block mb-0.5">（氏 / 名字）</label>
                    <input
                      type="text"
                      value={formValues['nameKanjiSei_1'] ?? ''}
                      onChange={(e) => {
                        const sei = e.target.value;
                        handleInputChange('nameKanjiSei_1', sei);
                        const mei = formValues['nameKanjiMei_1'] || '';
                        handleInputChange('nameKanji_1', [sei, mei].filter(Boolean).join(' '));
                      }}
                      placeholder="山田"
                      className="w-full p-1.5 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 block mb-0.5">（名 / お名前）</label>
                    <input
                      type="text"
                      value={formValues['nameKanjiMei_1'] ?? ''}
                      onChange={(e) => {
                        const mei = e.target.value;
                        handleInputChange('nameKanjiMei_1', mei);
                        const sei = formValues['nameKanjiSei_1'] || '';
                        handleInputChange('nameKanji_1', [sei, mei].filter(Boolean).join(' '));
                      }}
                      placeholder="太郎"
                      className="w-full p-1.5 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 氏名（フリガナ）：セイ・メイ 分割 */}
              <div>
                <label className="text-[10px] text-slate-700 font-bold block mb-1">② フリガナ（カタカナ）</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-500 block mb-0.5">（セイ / カタカナ）</label>
                    <input
                      type="text"
                      value={formValues['nameKanaSei_1'] ?? ''}
                      onChange={(e) => {
                        const seiK = e.target.value;
                        handleInputChange('nameKanaSei_1', seiK);
                        const meiK = formValues['nameKanaMei_1'] || '';
                        handleInputChange('nameKana_1', [seiK, meiK].filter(Boolean).join(' '));
                      }}
                      placeholder="ヤマダ"
                      className="w-full p-1.5 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 block mb-0.5">（メイ / カタカナ）</label>
                    <input
                      type="text"
                      value={formValues['nameKanaMei_1'] ?? ''}
                      onChange={(e) => {
                        const meiK = e.target.value;
                        handleInputChange('nameKanaMei_1', meiK);
                        const seiK = formValues['nameKanaSei_1'] || '';
                        handleInputChange('nameKana_1', [seiK, meiK].filter(Boolean).join(' '));
                      }}
                      placeholder="タロウ"
                      className="w-full p-1.5 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500">個人番号（マイナンバー）または基礎年金番号</label>
                <input
                  type="text"
                  value={formValues['myNumberOrPension_1'] || ''}
                  onChange={(e) => handleInputChange('myNumberOrPension_1', e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold tracking-wider"
                  placeholder="12桁マイナンバーまたは10桁年金番号"
                />
              </div>

              {/* 生年月日 */}
              <div>
                <label className="text-[10px] text-slate-700 font-bold block mb-1">③ 生年月日（年号は〇で囲む）</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <select
                    value={formValues['birthEra_1'] || '7'}
                    onChange={(e) => handleInputChange('birthEra_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-bold text-xs bg-white"
                    title="原本の年号（5.昭和/7.平成/9.令和）を〇で囲みます"
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

              {/* 性別種別 ＆ 取得区分（〇で囲む） */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-700 font-bold block mb-1">④ 種別（〇で囲む）</label>
                  <select
                    value={formValues['gender_1'] || '1'}
                    onChange={(e) => handleInputChange('gender_1', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-bold text-xs bg-white"
                  >
                    <option value="1">1. 男 〇</option>
                    <option value="2">2. 女 〇</option>
                    <option value="3">3. 坑内員 〇</option>
                    <option value="5">5. 男(基金) 〇</option>
                    <option value="6">6. 女(基金) 〇</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 font-bold block mb-1">⑤ 取得区分（〇で囲む）</label>
                  <select
                    value={formValues['acqCategory_1'] || '1'}
                    onChange={(e) => handleInputChange('acqCategory_1', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-bold text-xs bg-white"
                  >
                    <option value="1">1. 健保・厚年 〇</option>
                    <option value="3">3. 共済出向 〇</option>
                    <option value="4">4. 船保任継 〇</option>
                  </select>
                </div>
              </div>

              {/* 資格取得年月日 ＆ 被扶養者 */}
              <div>
                <label className="text-[10px] text-slate-700 font-bold block mb-1">⑦ 資格取得年月日（入社日・元号〇）</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <select
                    value={formValues['acqEra_1'] || '9'}
                    onChange={(e) => handleInputChange('acqEra_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-bold text-xs bg-white"
                  >
                    <option value="9">9.令和 〇</option>
                  </select>
                  <input
                    type="text"
                    value={formValues['acqYear_1'] || ''}
                    onChange={(e) => handleInputChange('acqYear_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold"
                    placeholder="年"
                  />
                  <input
                    type="text"
                    value={formValues['acqMonth_1'] || ''}
                    onChange={(e) => handleInputChange('acqMonth_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold"
                    placeholder="月"
                  />
                  <input
                    type="text"
                    value={formValues['acqDay_1'] || ''}
                    onChange={(e) => handleInputChange('acqDay_1', e.target.value)}
                    className="p-1.5 border border-slate-300 rounded font-mono text-center font-bold"
                    placeholder="日"
                  />
                </div>
              </div>

              {/* 被扶養者 ＆ 備考 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-700 font-bold block mb-1">⑧ 被扶養者（〇で囲む）</label>
                  <select
                    value={formValues['dependents_1'] || '0'}
                    onChange={(e) => handleInputChange('dependents_1', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-bold text-xs bg-white"
                  >
                    <option value="0">0. 無 〇</option>
                    <option value="1">1. 有 〇（異動届別途）</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-700 font-bold block mb-1">⑩ 備考（〇で囲む）</label>
                  <select
                    value={formValues['remarks_1'] || ''}
                    onChange={(e) => handleInputChange('remarks_1', e.target.value)}
                    className="w-full p-1.5 border border-slate-300 rounded font-bold text-xs bg-white"
                  >
                    <option value="">（該当なし）</option>
                    <option value="1">1. 70歳以上被用者 〇</option>
                    <option value="2">2. 二以上事業所 〇</option>
                    <option value="3">3. 短時間労働者 〇</option>
                    <option value="4">4. 再雇用者 〇</option>
                    <option value="5">5. その他 〇</option>
                  </select>
                </div>
              </div>

              {/* 報酬月額 */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500">㋐ 通貨（円）</label>
                  <input
                    type="number"
                    value={formValues['currencyRemuneration_1'] || ''}
                    onChange={(e) => {
                      const cur = Number(e.target.value) || 0;
                      const goods = Number(formValues['goodsRemuneration_1']) || 0;
                      handleInputChange('currencyRemuneration_1', e.target.value);
                      handleInputChange('totalRemuneration_1', String(cur + goods));
                    }}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold text-right"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">㋑ 現物（円）</label>
                  <input
                    type="number"
                    value={formValues['goodsRemuneration_1'] || ''}
                    onChange={(e) => {
                      const goods = Number(e.target.value) || 0;
                      const cur = Number(formValues['currencyRemuneration_1']) || 0;
                      handleInputChange('goodsRemuneration_1', e.target.value);
                      handleInputChange('totalRemuneration_1', String(cur + goods));
                    }}
                    className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold text-right"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold text-indigo-700">㋒ 合計（円）</label>
                  <input
                    type="number"
                    value={formValues['totalRemuneration_1'] || ''}
                    onChange={(e) => handleInputChange('totalRemuneration_1', e.target.value)}
                    className="w-full p-1.5 border border-indigo-300 bg-white rounded font-mono font-black text-right text-indigo-900"
                  />
                </div>
              </div>

              {/* 住所 */}
              <div>
                <label className="text-[10px] text-slate-500">郵便番号 ＆ 住所</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={formValues['zipCode_1'] || ''}
                    onChange={(e) => handleInputChange('zipCode_1', e.target.value)}
                    className="col-span-1 p-1.5 border border-slate-300 rounded font-mono font-bold"
                    placeholder="〒郵便番号"
                  />
                  <input
                    type="text"
                    value={formValues['address_1'] || ''}
                    onChange={(e) => handleInputChange('address_1', e.target.value)}
                    className="col-span-2 p-1.5 border border-slate-300 rounded font-bold"
                    placeholder="住民票住所"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
