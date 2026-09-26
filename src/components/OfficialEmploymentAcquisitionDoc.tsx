import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Printer, ArrowLeft, User, Shield, Edit3, Move, ZoomIn, ZoomOut,
  CheckCircle2, RotateCcw, ChevronDown, ChevronUp, Sparkles, Check,
  Maximize2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { 
  loadEmploymentAcqCoordinates, 
  saveEmploymentAcqCoordinates,
  saveEmploymentAcqCoordinatesToDb,
  fetchEmploymentAcqCoordinatesFromDb,
  broadcastEmploymentAcqCoordinates,
  EMPLOYMENT_ACQ_COORDS_UPDATE_EVENT,
  type EmploymentAcqFieldConfig 
} from '../lib/employmentAcquisitionDocCoordinates';

export interface AcquisitionEmployee {
  id: string;
  name: string;
  name_kana?: string;
  birth_date?: string;
  gender?: string;
  my_number?: string;
  employment_insurance_number?: string;
  join_date: string;
  retirement_date?: string;
  base_salary: number;
  salary_type?: 'monthly' | 'hourly' | 'daily';
  employment_type?: string;
  weekly_hours?: number;
  address?: string;
  phone?: string;
  contract_type?: string;
  retirement_reason?: string;
}

export interface OfficialEmploymentAcquisitionDocProps {
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  officeNumber?: string; // 雇用保険適用事業所番号 (4桁-6桁-1桁)
  employees: AcquisitionEmployee[];
  selectedEmployeeId?: string;
  onSelectEmployee?: (id: string) => void;
  onBack?: () => void;
  customCoords?: EmploymentAcqFieldConfig[];
  hideHeader?: boolean; // 親コンポーネントでヘッダー描画時の二重ヘッダー抑止フラグ
}

// 和暦変換ヘルパー（元号コード: 1明治, 2大正, 3昭和, 4平成, 5令和）
function parseWarekiEraCode(dateStr?: string): { eraCode: string; year2: string; month2: string; day2: string } {
  if (!dateStr) return { eraCode: '5', year2: '08', month2: '04', day2: '01' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { eraCode: '5', year2: '08', month2: '04', day2: '01' };
  const y = d.getFullYear();
  const mNum = d.getMonth() + 1;
  const dNum = d.getDate();
  const m = String(mNum).padStart(2, '0');
  const day = String(dNum).padStart(2, '0');
  const ymdNum = y * 10000 + mNum * 100 + dNum;

  // 雇用保険元号コード: 1:明治, 2:大正, 3:昭和, 4:平成, 5:令和
  if (ymdNum >= 20190501) {
    const ry = y - 2018;
    return { eraCode: '5', year2: String(ry).padStart(2, '0'), month2: m, day2: day };
  } else if (ymdNum >= 19890108) {
    const hy = y - 1988;
    return { eraCode: '4', year2: String(hy).padStart(2, '0'), month2: m, day2: day };
  } else if (ymdNum >= 19261225) {
    const sy = y - 1925;
    return { eraCode: '3', year2: String(sy).padStart(2, '0'), month2: m, day2: day };
  } else if (ymdNum >= 19120730) {
    const ty = y - 1911;
    return { eraCode: '2', year2: String(ty).padStart(2, '0'), month2: m, day2: day };
  } else {
    const my = y - 1867;
    return { eraCode: '1', year2: String(my).padStart(2, '0'), month2: m, day2: day };
  }
}

export const OfficialEmploymentAcquisitionDoc: React.FC<OfficialEmploymentAcquisitionDocProps> = ({
  companyInfo,
  officeNumber = '2501-123456-7',
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

  // リアルタイム座標設定State（親からの指定があれば最優先）
  const [coords, setCoords] = useState<EmploymentAcqFieldConfig[]>(() => customCoords || loadEmploymentAcqCoordinates());

  // 🌐 マウント時にDBから最新の全社保存座標マスタを非同期取得・強制同期
  useEffect(() => {
    if (customCoords) return;
    let isCancelled = false;
    fetchEmploymentAcqCoordinatesFromDb().then(dbCoords => {
      if (!isCancelled && dbCoords && dbCoords.length > 0) {
        setCoords(dbCoords);
      }
    });
    return () => { isCancelled = true; };
  }, [customCoords]);

  // 親から渡された customCoords の変更に即時連動（SSOT保証）
  useEffect(() => {
    if (customCoords) {
      setCoords(customCoords);
    }
  }, [customCoords]);

  // 原本背景PDFのレンダリング画像URL
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [previewZoom, setPreviewZoom] = useState<number>(75);
  // 左側パネルの表示/折りたたみState（全画面プレビュー対応）
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(true);

  // ✏️ 提出直前の微調整アコーディオン開閉State（デフォルトは閉じてスッキリ表示）
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  // 各マス目・入力項目の入力State
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // 🌐 大元の入退社・労務書類管理システムから全項目を自動抽出・計算（SSOT完全流動）
  const calculateMasterValues = useCallback((emp: AcquisitionEmployee | undefined): Record<string, string> => {
    if (!emp) return {};

    const birth = parseWarekiEraCode(emp.birth_date);
    const join = parseWarekiEraCode(emp.join_date);

    // 事業所番号（数字のみ11桁）
    const cleanOffice = (officeNumber || '').replace(/[^0-9]/g, '').padEnd(11, ' ');
    // 被保険者番号（数字のみ11桁）
    const cleanIns = (emp.employment_insurance_number || '').replace(/[^0-9]/g, '');
    // マイナンバー（数字12桁）
    const cleanMyNumber = (emp.my_number || '').replace(/[^0-9]/g, '');

    // 雇用形態コード（3: パート、4: 有期、7: 正社員等）
    const isPart = emp.employment_type === 'part-time' || (emp.weekly_hours && emp.weekly_hours < 30);
    const isFixed = emp.contract_type === 'fixed_term' || emp.employment_type === 'contract';
    const formCode = isPart ? '3' : isFixed ? '4' : '7';

    // 賃金支払態様コード（1:月給, 2:週給, 3:日給, 4:時間給, 5:その他）
    let wageTypeCode = '1';
    if (emp.salary_type === 'hourly') {
      wageTypeCode = '4';
    } else if (emp.salary_type === 'daily') {
      wageTypeCode = '3';
    }

    // 賃金月額（千円単位、4桁）例: 250,000 -> 0250
    // ハローワーク取扱要領: 時給・日給の場合は週所定労働時間・所定労働日数から月額見込額を換算
    let estimatedMonthly = emp.base_salary || 0;
    if (emp.salary_type === 'hourly') {
      const hours = emp.weekly_hours || (isPart ? 20 : 40);
      estimatedMonthly = Math.round(estimatedMonthly * hours * 52 / 12);
    } else if (emp.salary_type === 'daily') {
      estimatedMonthly = Math.round(estimatedMonthly * 21.6);
    }
    const monthlyThousand = Math.round(estimatedMonthly / 1000);
    const wageStr = String(monthlyThousand).padStart(4, '0');

    // 氏名カタカナ（全角スペース空け）
    const rawKana = emp.name_kana || emp.name || 'コマイ　シュウイチロウ';

    // 性別コード（1:男, 2:女）
    const genderCode = emp.gender === '女' || emp.gender === 'female' ? '2' : '1';

    return {
      docTypeFixed: '19101',
      myNumber: cleanMyNumber,
      // 被保険者番号（元値および分割3ブロック）
      insuredNumber: cleanIns,
      insuredNumber_1: cleanIns.slice(0, 4),
      insuredNumber_2: cleanIns.slice(4, 10),
      insuredNumber_3: cleanIns.slice(10, 11),
      acqType: cleanIns.trim() ? '2' : '1', // 番号があれば再取得、なければ新規
      // 氏名
      nameKanji: emp.name || '',
      nameKana: rawKana,
      gender: genderCode,
      // 生年月日
      birthEra: birth.eraCode,
      birthYMD: `${birth.year2}${birth.month2}${birth.day2}`,
      birthYear: birth.year2,
      birthMonth: birth.month2,
      birthDay: birth.day2,
      // 事業所番号（元値および分割3ブロック）
      officeNumber: cleanOffice,
      officeNumber_1: cleanOffice.slice(0, 4),
      officeNumber_2: cleanOffice.slice(4, 10),
      officeNumber_3: cleanOffice.slice(10, 11),
      // 雇用条件・賃金・取得年月日
      causeCode: '2', // 新規雇用（中途・その他）
      wageType: wageTypeCode,
      wageAmount: wageStr,
      wageThousands: wageStr,
      joinEra: join.eraCode,
      acqYMD: `${join.year2}${join.month2}${join.day2}`,
      joinYear: join.year2,
      joinMonth: join.month2,
      joinDay: join.day2,
      employmentForm: formCode,
      jobCode: '03', // 事務的職業
      routeCode: '2', // 自己就職
      weeklyHours: String(emp.weekly_hours || (isPart ? 20 : 40)).padStart(2, '0'),
      weeklyMins: '00',
      contractFixed: isFixed ? '1' : '2', // 1:有, 2:無
      // 事業主情報
      employerAddress: companyInfo.address,
      employerName: companyInfo.name,
      employerRep: companyInfo.representative_name,
      employerPhone: companyInfo.phone_number,
      targetHelloWork: (companyInfo as any).hello_work_name || (companyInfo as any).competent_hello_work || (() => {
        const addr = companyInfo.address || '';
        const match = addr.match(/[都道府県]([^\s0-9丁目番地号]+?[市区町村])/);
        if (match) {
          return match[1].replace(/[市区町村]$/, '');
        }
        return '';
      })()
    };
  }, [officeNumber, companyInfo]);


  // 従業員切り替え時に初期値を自動計算・反映（SSOT連動）
  useEffect(() => {
    if (!currentEmployee) return;
    const values = calculateMasterValues(currentEmployee);
    setFormValues(values);
  }, [currentEmployee, calculateMasterValues]);

  // 🔄 大元マスタから最新データを強制再同期するハンドラー
  const handleSyncFromMaster = () => {
    if (!currentEmployee) return;
    const values = calculateMasterValues(currentEmployee);
    setFormValues(values);
  };

  // 座標変更イベントリスナー（統制本部での微調整が即時反映）
  useEffect(() => {
    const handleCoordsUpdate = (e: any) => {
      if (e.detail) {
        setCoords(e.detail);
      }
    };
    window.addEventListener(EMPLOYMENT_ACQ_COORDS_UPDATE_EVENT, handleCoordsUpdate);
    return () => window.removeEventListener(EMPLOYMENT_ACQ_COORDS_UPDATE_EVENT, handleCoordsUpdate);
  }, []);

  // 🖱️ 原本直接ドラッグ微調整State
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // リアルタイム座標更新 ＆ 保存
  const updateFieldCoord = useCallback((id: string, x: number, y: number) => {
    setCoords(prev => {
      const precision = 100;
      const finalX = Math.round(x * precision) / precision;
      const finalY = Math.round(y * precision) / precision;
      const updated = prev.map(f => f.id === id ? { ...f, x: finalX, y: finalY } : f);
      saveEmploymentAcqCoordinates(updated);
      broadcastEmploymentAcqCoordinates(updated);
      return updated;
    });
  }, []);

  // 🖱️ ドラッグ開始
  const handleStartDrag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingFieldId(id);

    const target = coords.find(f => f.id === id);
    if (!target) return;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: target.x,
      startY: target.y
    };
  };

  // 🖱️ グローバルマウス移動＆解放リスナー
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingFieldId || !dragStartRef.current || !previewContainerRef.current) return;

      const rect = previewContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaX = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, dragStartRef.current.startX + deltaX));
      const newY = Math.max(0, Math.min(100, dragStartRef.current.startY + deltaY));

      updateFieldCoord(draggingFieldId, newX, newY);
    };

    const handleGlobalMouseUp = async () => {
      if (draggingFieldId) {
        setDraggingFieldId(null);
        dragStartRef.current = null;
        // DBへも非同期で自動保存
        await saveEmploymentAcqCoordinatesToDb(coords);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingFieldId, updateFieldCoord, coords]);

  // PDF.js による原本第1面のCanvasレンダリング（原本画像の取得）
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
          url: '/employment_acquisition_template.pdf',
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
        console.warn('Could not load employment_acquisition_template.pdf, will use CSS layout:', err);
        setIsLoadingPdf(false);
      }
    };

    renderTemplate();
    return () => { isCancelled = true; };
  }, []);

  // 値変更ハンドラー（分割ブロックキーにも自動配分）
  const handleInputChange = (fieldId: string, val: string) => {
    setFormValues(prev => {
      const updated = { ...prev, [fieldId]: val };

      // 被保険者番号の自動分解（4桁-6桁-1桁）
      if (fieldId === 'insuredNumber') {
        const clean = val.replace(/[^0-9]/g, '');
        updated.insuredNumber_1 = clean.slice(0, 4);
        updated.insuredNumber_2 = clean.slice(4, 10);
        updated.insuredNumber_3 = clean.slice(10, 11);
      }
      // 事業所番号の自動分解（4桁-6桁-1桁）
      if (fieldId === 'officeNumber') {
        const clean = val.replace(/[^0-9]/g, '');
        updated.officeNumber_1 = clean.slice(0, 4);
        updated.officeNumber_2 = clean.slice(4, 10);
        updated.officeNumber_3 = clean.slice(10, 11);
      }
      // 生年月日YYMMDDの自動分解
      if (fieldId === 'birthYMD') {
        const clean = val.replace(/[^0-9]/g, '');
        updated.birthYear = clean.slice(0, 2);
        updated.birthMonth = clean.slice(2, 4);
        updated.birthDay = clean.slice(4, 6);
      }
      // 取得日YYMMDDの自動分解
      if (fieldId === 'acqYMD') {
        const clean = val.replace(/[^0-9]/g, '');
        updated.joinYear = clean.slice(0, 2);
        updated.joinMonth = clean.slice(2, 4);
        updated.joinDay = clean.slice(4, 6);
      }
      // 週所定労働時間の自動分解（時間2桁＋分2桁）
      if (fieldId === 'weeklyHoursRaw') {
        const clean = val.replace(/[^0-9]/g, '');
        updated.weeklyHours = clean.slice(0, 2);
        updated.weeklyMins = clean.slice(2, 4) || '00';
      }
      // 賃金月額の自動分解（千円単位4桁）
      if (fieldId === 'wageAmount') {
        const clean = val.replace(/[^0-9]/g, '').padStart(4, '0');
        updated.wageThousands = clean.slice(-4);
      }

      return updated;
    });
  };

  // 印刷
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 操作ヘッダーバー（hideHeader指定時または印刷時は非表示） */}
      {!hideHeader && (
        <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
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
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  ハローワーク様式第2号
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  公式原本リアルタイム直接入力 ＆ 自動転記
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                雇用保険被保険者 資格取得届（公式原本入力＆印刷）
              </h2>
            </div>
          </div>

          {/* 右側アクション */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 従業員選択 */}
            {employees && employees.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-500">対象従業員:</span>
                <select
                  value={currentEmpId}
                  onChange={(e) => onSelectEmployee && onSelectEmployee(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 outline-hidden cursor-pointer"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.join_date}雇入)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 印刷ボタン */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              公式A4原本印刷 / PDF保存
            </button>
          </div>
        </div>
      )}

      {/* メインレイアウト: 入力コントロールパネル ＆ 原本リアルタイムプレビュー */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start print:block print:w-[210mm] print:m-0 print:p-0">

        {/* ⬅️ 【入退社労務マスタ 自動転記ステータス＆微調整パネル】（印刷時非表示） */}
        {isSidePanelOpen && (
          <div className="print:hidden lg:col-span-4 space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto">
            {/* パネルヘッダー */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                入退社労務マスタ 自動転記ステータス
              </h3>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-black border border-emerald-200 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                二重入力ゼロ
              </span>
            </div>

            {/* SSOT自動連携バナー */}
            <div className="bg-emerald-50/80 border border-emerald-200/90 p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  大元台帳より全項目自動流動済
                </span>
                <button
                  type="button"
                  onClick={handleSyncFromMaster}
                  className="text-[11px] bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                  title="入退社労務書類管理システムから最新データを再同期"
                >
                  <RotateCcw className="w-3 h-3 text-emerald-600" />
                  大元から再同期
                </button>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                入退社・労務書類管理システム（従業員台帳・労働条件通知書・提出書類）の最新データが原本プレビューの各マス目へ<strong>100%自動で転記・印字</strong>されています。
              </p>
            </div>

            {/* 📋 自動転記データ確認カード（見やすいサマリー） */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="font-black text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  対象者データ（大元SSOT）
                </span>
                <span className="text-[10px] font-bold text-slate-500 font-mono">
                  {currentEmployee?.join_date} 雇入
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">氏名（漢字）:</span>
                  <span className="font-black text-slate-900">{formValues.nameKanji || currentEmployee?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">フリガナ:</span>
                  <span className="font-bold text-slate-800 font-mono">{formValues.nameKana}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">生年月日:</span>
                  <span className="font-bold text-slate-800">
                    {formValues.birthEra === '3' ? '昭和' : formValues.birthEra === '4' ? '平成' : '令和'}{formValues.birthYear}年{formValues.birthMonth}月{formValues.birthDay}日
                    <span className="text-slate-500 ml-1">（{formValues.gender === '1' ? '男' : '女'}）</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">個人番号（マイナンバー）:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formValues.myNumber ? `${formValues.myNumber.slice(0, 4)}******** (登録済)` : '未登録'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">雇用保険番号:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formValues.insuredNumber ? `${formValues.insuredNumber_1}-${formValues.insuredNumber_2}-${formValues.insuredNumber_3}` : '新規取得（番号なし）'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">賃金月額:</span>
                  <span className="font-black text-emerald-700">
                    ¥{Number(formValues.wageAmount ? Number(formValues.wageAmount) * 1000 : currentEmployee?.base_salary || 0).toLocaleString()}
                    <span className="text-[10px] text-slate-400 font-normal ml-1">（千円単位: {formValues.wageThousands}）</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">雇用形態 / 労働時間:</span>
                  <span className="font-bold text-slate-800">
                    {formValues.employmentForm === '3' ? 'パートタイム' : formValues.employmentForm === '4' ? '有期契約' : '正社員'}
                    <span className="text-slate-500 ml-1 font-mono">（週{formValues.weeklyHours}時間）</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">事業所番号:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formValues.officeNumber_1}-{formValues.officeNumber_2}-{formValues.officeNumber_3}
                  </span>
                </div>
              </div>
            </div>

            {/* ✏️ 提出直前の一時微調整（開閉アコーディオン） */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdjustOpen(!isAdjustOpen)}
                className="w-full bg-slate-50 hover:bg-slate-100 p-3 flex items-center justify-between text-xs font-black text-slate-800 transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  <span>提出用の一時微調整・項目上書き</span>
                  <span className="text-[10px] font-bold text-slate-400">（通常は編集不要）</span>
                </div>
                {isAdjustOpen ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {isAdjustOpen && (
                <div className="p-4 space-y-3.5 text-xs bg-white border-t border-slate-200">
                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[11px] text-amber-800">
                    ※ここでの編集内容は原本プレビューへ即時反映されますが、大元の台帳データは変更されません。
                  </div>

                  {/* 1. 個人番号 */}
                  <div>
                    <label className="text-slate-600 font-bold block mb-1">1. 個人番号（マイナンバー12桁）</label>
                    <input
                      type="text"
                      maxLength={12}
                      value={formValues.myNumber || ''}
                      onChange={(e) => handleInputChange('myNumber', e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-black text-slate-800 tracking-widest"
                      placeholder="123456789012"
                    />
                  </div>

                  {/* 2. 3. 被保険者番号 ＆ 取得区分 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">3. 取得区分</label>
                      <select
                        value={formValues.acqType || '1'}
                        onChange={(e) => handleInputChange('acqType', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-800"
                      >
                        <option value="1">1: 新規（初めて）</option>
                        <option value="2">2: 再取得（番号あり）</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">2. 被保険者番号</label>
                      <input
                        type="text"
                        maxLength={11}
                        value={formValues.insuredNumber || ''}
                        onChange={(e) => handleInputChange('insuredNumber', e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-mono font-black text-slate-800 tracking-wider"
                        placeholder="12345678901"
                      />
                    </div>
                  </div>

                  {/* 4. 氏名（漢字 ＆ カタカナフリガナ） */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">4. 被保険者氏名（漢字氏名）</label>
                      <input
                        type="text"
                        value={formValues.nameKanji || ''}
                        onChange={(e) => handleInputChange('nameKanji', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-black text-slate-800"
                        placeholder="山田　太郎"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">4. 被保険者氏名 フリガナ（カタカナ）</label>
                      <input
                        type="text"
                        value={formValues.nameKana || ''}
                        onChange={(e) => handleInputChange('nameKana', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                        placeholder="コマイ　シュウイチロウ"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">※ 姓と名の間は1マス空けて原本マス目に印字されます</span>
                    </div>
                  </div>

                  {/* 6. 性別 ＆ 7. 生年月日 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">6. 性別</label>
                      <select
                        value={formValues.gender || '1'}
                        onChange={(e) => handleInputChange('gender', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-800"
                      >
                        <option value="1">1: 男</option>
                        <option value="2">2: 女</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">7. 生年月日（元号 / 年月日）</label>
                      <div className="flex gap-1.5">
                        <select
                          value={formValues.birthEra || '5'}
                          onChange={(e) => handleInputChange('birthEra', e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 w-16 text-xs shrink-0"
                        >
                          <option value="3">昭和</option>
                          <option value="4">平成</option>
                          <option value="5">令和</option>
                        </select>
                        <input
                          type="text"
                          maxLength={6}
                          value={formValues.birthYMD || ''}
                          onChange={(e) => handleInputChange('birthYMD', e.target.value.replace(/[^0-9]/g, ''))}
                          className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-mono font-bold text-slate-800 tracking-wider text-xs"
                          placeholder="020510"
                          title="年2桁・月2桁・日2桁（例: 020510）"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 8. 事業所番号 */}
                  <div>
                    <label className="text-slate-600 font-bold block mb-1">8. 事業所番号（4桁-6桁-1桁）</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={formValues.officeNumber || ''}
                      onChange={(e) => handleInputChange('officeNumber', e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-black text-slate-800 tracking-wider"
                      placeholder="25011234567"
                    />
                  </div>

                  {/* 9. 原因 ＆ 10. 賃金態様 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">9. 原因コード</label>
                      <select
                        value={formValues.causeCode || '2'}
                        onChange={(e) => handleInputChange('causeCode', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 text-xs"
                      >
                        <option value="1">1: 新規学卒</option>
                        <option value="2">2: 中途・その他雇用</option>
                        <option value="3">3: 日雇からの切替</option>
                        <option value="4">4: その他</option>
                        <option value="8">8: 出向元復帰(65歳以上)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">10. 賃金態様</label>
                      <select
                        value={formValues.wageType || '1'}
                        onChange={(e) => handleInputChange('wageType', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 text-xs"
                      >
                        <option value="1">1: 月給</option>
                        <option value="2">2: 週給</option>
                        <option value="3">3: 日給</option>
                        <option value="4">4: 時間給</option>
                        <option value="5">5: その他</option>
                      </select>
                    </div>
                  </div>

                  {/* 賃金月額 ＆ 11. 取得年月日 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">賃金月額（千円単位 4桁）</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={formValues.wageAmount || ''}
                        onChange={(e) => handleInputChange('wageAmount', e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-black text-slate-800 text-right pr-3"
                        placeholder="0250"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">11. 取得年月日</label>
                      <div className="flex gap-1.5">
                        <select
                          value={formValues.joinEra || '5'}
                          onChange={(e) => handleInputChange('joinEra', e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 w-16 text-xs shrink-0"
                        >
                          <option value="4">平成</option>
                          <option value="5">令和</option>
                        </select>
                        <input
                          type="text"
                          maxLength={6}
                          value={formValues.acqYMD || ''}
                          onChange={(e) => handleInputChange('acqYMD', e.target.value.replace(/[^0-9]/g, ''))}
                          className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-mono font-bold text-slate-800 tracking-wider text-xs"
                          placeholder="080401"
                          title="年2桁・月2桁・日2桁（例: 080401）"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 12. 雇用形態 ＆ 13. 職種 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">12. 雇用形態コード</label>
                      <select
                        value={formValues.employmentForm || '7'}
                        onChange={(e) => handleInputChange('employmentForm', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 text-xs"
                      >
                        <option value="7">7: その他（正社員等）</option>
                        <option value="3">3: パートタイム</option>
                        <option value="4">4: 有期契約労働者</option>
                        <option value="2">2: 派遣</option>
                        <option value="1">1: 日雇</option>
                        <option value="5">5: 季節的雇用</option>
                        <option value="6">6: 船員</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">13. 職種コード（01〜11）</label>
                      <select
                        value={formValues.jobCode || '03'}
                        onChange={(e) => handleInputChange('jobCode', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 text-xs"
                      >
                        <option value="01">01: 管理的職業</option>
                        <option value="02">02: 専門・技術的職業</option>
                        <option value="03">03: 事務的職業</option>
                        <option value="04">04: 販売の職業</option>
                        <option value="05">05: サービスの職業</option>
                        <option value="06">06: 保安の職業</option>
                        <option value="07">07: 農林漁業の職業</option>
                        <option value="08">08: 生産工程の職業</option>
                        <option value="09">09: 輸送・機械運転</option>
                        <option value="10">10: 建設・採掘の職業</option>
                        <option value="11">11: 運搬・清掃・包装</option>
                      </select>
                    </div>
                  </div>

                  {/* 14. 就職経路 ＆ 16. 契約期間の定め */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">14. 就職経路コード</label>
                      <select
                        value={formValues.routeCode || '2'}
                        onChange={(e) => handleInputChange('routeCode', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 text-xs"
                      >
                        <option value="1">1: 安定所紹介</option>
                        <option value="2">2: 自己就職</option>
                        <option value="3">3: 民間紹介</option>
                        <option value="4">4: 把握していない</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">16. 契約期間の定め</label>
                      <select
                        value={formValues.contractFixed || '2'}
                        onChange={(e) => handleInputChange('contractFixed', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 font-bold text-slate-800 text-xs"
                      >
                        <option value="2">2: 無（期間の定めなし）</option>
                        <option value="1">1: 有（有期雇用契約）</option>
                      </select>
                    </div>
                  </div>

                  {/* 15. 週所定労働時間 */}
                  <div>
                    <label className="text-slate-600 font-bold block mb-1">15. 週所定労働時間（時間分 4桁）</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={formValues.weeklyHoursRaw || (formValues.weeklyHours ? `${formValues.weeklyHours}${formValues.weeklyMins || '00'}` : '4000')}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        handleInputChange('weeklyHoursRaw', raw);
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800"
                      placeholder="4000（40時間00分）"
                    />
                  </div>

                  {/* 🏢 事業主・事業所情報（原本最下部に自動印字） */}
                  <div className="border-t border-slate-200 pt-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        🏢 事業所・事業主情報（原本下部印字）
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">原本最下部へ反映</span>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-0.5 text-[11px]">事業主 所在地</label>
                      <input
                        type="text"
                        value={formValues.employerAddress || ''}
                        onChange={(e) => handleInputChange('employerAddress', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs"
                        placeholder="滋賀県大津市..."
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-0.5 text-[11px]">事業主 名称</label>
                      <input
                        type="text"
                        value={formValues.employerName || ''}
                        onChange={(e) => handleInputChange('employerName', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs"
                        placeholder="株式会社cocotte"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-600 font-bold block mb-0.5 text-[11px]">代表者職氏名</label>
                        <input
                          type="text"
                          value={formValues.employerRep || ''}
                          onChange={(e) => handleInputChange('employerRep', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs"
                          placeholder="代表取締役 山田 太郎"
                        />
                      </div>
                      <div>
                        <label className="text-slate-600 font-bold block mb-0.5 text-[11px]">電話番号</label>
                        <input
                          type="text"
                          value={formValues.employerPhone || ''}
                          onChange={(e) => handleInputChange('employerPhone', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-800 text-xs"
                          placeholder="03-1234-5678"
                        />
                      </div>

                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-0.5 text-[11px]">所轄公共職業安定所名</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={formValues.targetHelloWork || '大津'}
                          onChange={(e) => handleInputChange('targetHelloWork', e.target.value)}
                          className="w-28 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs"
                        />
                        <span className="text-slate-600 font-bold text-xs">公共職業安定所長 殿</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* ➡️ 【原本リアルタイムプレビュー ＆ 印刷原本】 */}
        <div className={`${isSidePanelOpen ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col items-center overflow-x-auto print:block print:w-[210mm] print:p-0 print:m-0 print:overflow-visible pb-12 print:pb-0 transition-all duration-200`}>
          {/* ドラッグ操作案内 ＆ ズームバー（印刷時非表示） */}
          <div className="print:hidden mb-2 w-full max-w-[210mm] flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* パネル折りたたみトグル */}
              <button
                type="button"
                onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold transition cursor-pointer shadow-2xs"
                title={isSidePanelOpen ? "左の入力欄を閉じて原本を画面いっぱいに広げる" : "左の入力欄を表示する"}
              >
                {isSidePanelOpen ? (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">入力欄を畳む</span>
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>入力欄を表示</span>
                  </>
                )}
              </button>

              {/* ズーム拡大・縮小バー */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
                <span className="text-[11px] text-slate-500">ズーム:</span>
                <button 
                  type="button"
                  onClick={() => setPreviewZoom(z => Math.max(50, z - 10))} 
                  className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                  title="縮小"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <span className="w-9 text-center font-mono text-xs">{previewZoom}%</span>
                <button 
                  type="button"
                  onClick={() => setPreviewZoom(z => Math.min(150, z + 10))} 
                  className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                  title="拡大"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>

              {/* 全体表示（Fit）ボタン */}
              <button
                type="button"
                onClick={() => setPreviewZoom(isSidePanelOpen ? 75 : 90)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 border shadow-2xs ${
                  previewZoom <= 80 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="用紙全体が枠内に美しく収まる最適倍率に切り替え"
              >
                <Maximize2 className="w-3 h-3 text-emerald-600" />
                <span>全体表示(Fit)</span>
              </button>

              {/* 100%原寸ボタン */}
              <button
                type="button"
                onClick={() => setPreviewZoom(100)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 border shadow-2xs ${
                  previewZoom === 100 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="A4実寸サイズ(100%)で表示"
              >
                <span>原寸100%</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
              <Move className="w-3.5 h-3.5 text-emerald-600" />
              <span>原本上の文字を直接ドラッグして位置微調整可能</span>
            </div>
          </div>

          {/* 原本スケーリングサイザー（スケーリング時の余計な空白・はみ出し見切れを完全防止） */}
          <div 
            style={{ 
              width: `${210 * (previewZoom / 100)}mm`, 
              height: `${297 * (previewZoom / 100)}mm`,
              maxWidth: '100%'
            }} 
            className="relative transition-[width,height] duration-100 ease-out print:w-[210mm] print:h-[297mm]"
          >
            <div 
              ref={previewContainerRef}
              style={{ 
                transform: `scale(${previewZoom / 100})`, 
                transformOrigin: 'top left',
                containerType: 'inline-size',
                width: '210mm',
                height: '297mm',
                aspectRatio: '210 / 297'
              }}
              className="official-acq-print-container w-[210mm] h-[297mm] bg-white absolute top-0 left-0 shadow-xl border border-slate-300 text-slate-900 font-mono print:shadow-none print:border-none print:p-0 print:m-0 print:w-[210mm] print:h-[297mm] print:transform-none overflow-hidden select-none"
            >
            
            {/* 原本PDF画像背景 */}
            {bgPdfImg ? (
              <img
                src={bgPdfImg}
                alt="雇用保険被保険者資格取得届原本"
                className="w-full h-full object-fill pointer-events-none"
              />
            ) : isLoadingPdf ? (
              <div className="w-full h-[297mm] bg-slate-50 flex items-center justify-center text-slate-400">
                原本PDFをレンダリング中...
              </div>
            ) : (
              <div className="w-full h-[297mm] bg-slate-50 flex items-center justify-center text-slate-400">
                原本PDFが見つかりません
              </div>
            )}

            {/* 各マス目へのオーバーレイ入力文字印字（直接ドラッグ微調整可能） */}
            {coords.map((field) => {
              if (field.disabled) return null;
              // 旧キー（一括キーや非正規キー）はブロック分割表示のためスキップ
              if (['docTypeFixed', 'officeNumber', 'insuredNumber', 'birthYMD', 'acqYMD', 'weeklyHoursRaw', 'wageAmount'].includes(field.id)) return null;

              const val = formValues[field.id] || '';
              const isDraggingThis = draggingFieldId === field.id;

              // ピッチ（マス目間隔）指定がある場合は1文字ずつマス目に配置
              if (field.pitch && field.pitch > 0) {
                const chars = val.split('');
                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => handleStartDrag(field.id, e)}
                    style={{
                      position: 'absolute',
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: 'max-content',
                      cursor: isDraggingThis ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      touchAction: 'none',
                      zIndex: isDraggingThis ? 50 : 10
                    }}
                    className={`transition-all duration-75 p-0 rounded-xs print:ring-0 print:bg-transparent print:p-0 ${
                      isDraggingThis 
                        ? 'ring-2 ring-amber-500 bg-amber-500/25 shadow-md scale-105' 
                        : 'hover:ring-1 hover:ring-emerald-400 hover:bg-emerald-50/40'
                    }`}
                    title={`${field.name} (ドラッグで位置微調整可能)`}
                  >
                    <div className="flex items-center pointer-events-none">
                      {chars.map((ch, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: 'inline-block',
                            width: `${(field.pitch || 2.86) * 2.1}mm`,
                            fontSize: `${field.fontSize}pt`,
                            fontWeight: 900,
                            color: isDraggingThis ? '#b45309' : '#0f172a',
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            lineHeight: 1
                          }}
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }

              // 単一の文字またはテキスト枠
              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => handleStartDrag(field.id, e)}
                  style={{
                    position: 'absolute',
                    left: `${field.x}%`,
                    top: `${field.y}%`,
                    width: field.width ? `${field.width * 2.1}mm` : 'auto',
                    fontSize: `${field.fontSize}pt`,
                    fontWeight: 900,
                    color: isDraggingThis ? '#b45309' : '#0f172a',
                    fontFamily: field.id.includes('employer') ? 'sans-serif' : 'monospace',
                    lineHeight: 1,
                    cursor: isDraggingThis ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                    zIndex: isDraggingThis ? 50 : 10,
                    whiteSpace: 'nowrap'
                  }}
                  className={`transition-all duration-75 p-0 rounded-xs print:ring-0 print:bg-transparent print:p-0 ${
                    isDraggingThis 
                      ? 'ring-2 ring-amber-500 bg-amber-500/25 shadow-md scale-105' 
                      : 'hover:ring-1 hover:ring-emerald-400 hover:bg-emerald-50/40'
                  }`}
                  title={`${field.name} (ドラッグで位置微調整可能)`}
                >
                  <span className="pointer-events-none">{val}</span>
                </div>
              );
            })}

          </div>
        </div>
        </div>

      </div>

      {/* 🖨️ A4縦・マージンゼロ・等倍印刷CSS（荀彧 帳票門番規定） */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .official-acq-print-container {
            width: 210mm !important;
            height: 297mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            transform: none !important;
            container-type: inline-size !important;
            position: relative !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          .official-acq-print-container img {
            width: 210mm !important;
            height: 297mm !important;
            object-fit: fill !important;
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};
