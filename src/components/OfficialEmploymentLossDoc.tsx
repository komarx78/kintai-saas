import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Printer, ArrowLeft, Edit3, Move, ZoomIn, ZoomOut,
  CheckCircle2, RotateCcw, ChevronDown, ChevronUp, Sparkles, Check, UserMinus
} from 'lucide-react';
import { 
  loadEmploymentLossCoordinates, 
  saveEmploymentLossCoordinates,
  saveEmploymentLossCoordinatesToDb,
  fetchEmploymentLossCoordinatesFromDb,
  broadcastEmploymentLossCoordinates,
  EMPLOYMENT_LOSS_COORDS_UPDATE_EVENT,
  type EmploymentLossFieldConfig 
} from '../lib/employmentLossDocCoordinates';

export interface LossEmployee {
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

export interface OfficialEmploymentLossDocProps {
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  officeNumber?: string; // 雇用保険適用事業所番号 (4桁-6桁-1桁)
  employees: LossEmployee[];
  selectedEmployeeId?: string;
  onSelectEmployee?: (id: string) => void;
  onBack?: () => void;
  customCoords?: EmploymentLossFieldConfig[];
  hideHeader?: boolean;
}

// 和暦変換ヘルパー（元号コード: 2大正, 3昭和, 4平成, 5令和）
function parseWarekiEraCode(dateStr?: string): { eraCode: string; eraName: string; year2: string; month2: string; day2: string } {
  if (!dateStr) return { eraCode: '5', eraName: '令和', year2: '08', month2: '09', day2: '30' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { eraCode: '5', eraName: '令和', year2: '08', month2: '09', day2: '30' };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (y >= 2019) {
    const ry = y - 2018;
    return { eraCode: '5', eraName: '令和', year2: String(ry).padStart(2, '0'), month2: m, day2: day };
  } else if (y >= 1989) {
    const hy = y - 1988;
    return { eraCode: '4', eraName: '平成', year2: String(hy).padStart(2, '0'), month2: m, day2: day };
  } else if (y >= 1926) {
    const sy = y - 1925;
    return { eraCode: '3', eraName: '昭和', year2: String(sy).padStart(2, '0'), month2: m, day2: day };
  } else {
    return { eraCode: '2', eraName: '大正', year2: '01', month2: m, day2: day };
  }
}

// 全角カタカナ正規化
function toKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

export const OfficialEmploymentLossDoc: React.FC<OfficialEmploymentLossDocProps> = ({
  companyInfo,
  officeNumber = '2501-123456-7',
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack,
  customCoords,
  hideHeader = false
}) => {
  // 退職者を優先して選択（退職者がいれば先頭の退職者、なければ全従業員の先頭）
  const retiredEmps = employees.filter(e => !!e.retirement_date);
  const defaultEmpId = selectedEmployeeId || (retiredEmps.length > 0 ? retiredEmps[0].id : employees[0]?.id || '');
  const currentEmpId = defaultEmpId;
  const currentEmployee = employees.find(e => e.id === currentEmpId) || employees[0];

  // リアルタイム座標設定State
  const [coords, setCoords] = useState<EmploymentLossFieldConfig[]>(() => customCoords || loadEmploymentLossCoordinates());

  // マウント時にDBから最新の全社保存座標マスタを取得
  useEffect(() => {
    if (customCoords) return;
    let isCancelled = false;
    fetchEmploymentLossCoordinatesFromDb().then(dbCoords => {
      if (!isCancelled && dbCoords && dbCoords.length > 0) {
        setCoords(dbCoords);
      }
    });
    return () => { isCancelled = true; };
  }, [customCoords]);

  useEffect(() => {
    if (customCoords) {
      setCoords(customCoords);
    }
  }, [customCoords]);

  // ズーム倍率
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // ドラッグ操作State
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // 原本PDF画像State
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // 開閉アコーディオン（通常は自動転記で二重入力不要）
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  // 大元マスタ（SSOT）からの全項目自動計算ロジック
  const calculateLossMasterValues = useCallback((emp: LossEmployee): Record<string, string> => {
    if (!emp) return {};

    const cleanOffice = officeNumber.replace(/[^0-9]/g, '');
    const cleanInsured = (emp.employment_insurance_number || '').replace(/[^0-9]/g, '');
    const cleanMyNumber = (emp.my_number || '').replace(/[^0-9]/g, '');

    const joinWareki = parseWarekiEraCode(emp.join_date);
    const lossDateStr = emp.retirement_date || new Date().toISOString().split('T')[0];
    const lossWareki = parseWarekiEraCode(lossDateStr);
    const birthWareki = parseWarekiEraCode(emp.birth_date);

    // 喪失原因コードの自動判別
    const reasonText = (emp.retirement_reason || '').trim();
    let lossCode = '2'; // デフォルト: 2（3以外の離職＝自己都合・定年等）
    if (reasonText.includes('解雇') || reasonText.includes('会社都合') || reasonText.includes('倒産') || reasonText.includes('勧奨')) {
      lossCode = '3'; // 3: 事業主の都合による離職
    } else if (reasonText.includes('死亡') || reasonText.includes('役員') || reasonText.includes('出向') || reasonText.includes('兼任')) {
      lossCode = '1'; // 1: 離職以外の理由
    }

    const isPart = (emp.employment_type || '').includes('part') || (emp.employment_type || '').includes('パート') || (emp.employment_type || '').includes('アルバイト');
    const weeklyHoursNum = emp.weekly_hours || (isPart ? 20 : 40);

    const today = new Date();
    const submitWareki = parseWarekiEraCode(today.toISOString().split('T')[0]);

    const rawKana = emp.name_kana || emp.name || 'コマイ　シュウイチロウ';
    const cleanKana = toKatakana(rawKana.replace(/[\s　]+/g, ' ')).trim();

    return {
      docTypeNumber: '17191',
      myNumber: cleanMyNumber,
      // 被保険者番号（4桁-6桁-1桁）
      insuredNumber_1: cleanInsured.slice(0, 4),
      insuredNumber_2: cleanInsured.slice(4, 10),
      insuredNumber_3: cleanInsured.slice(10, 11),
      // 事業所番号（4桁-6桁-1桁）
      officeNumber_1: cleanOffice.slice(0, 4),
      officeNumber_2: cleanOffice.slice(4, 10),
      officeNumber_3: cleanOffice.slice(10, 11),
      // 4. 資格取得年月日
      acqEra: joinWareki.eraCode,
      acqYear: joinWareki.year2,
      acqMonth: joinWareki.month2,
      acqDay: joinWareki.day2,
      // 5. 離職等年月日
      lossEra: lossWareki.eraCode,
      lossYear: lossWareki.year2,
      lossMonth: lossWareki.month2,
      lossDay: lossWareki.day2,
      // 6. 喪失原因 (1/2/3)
      lossReasonCode: lossCode,
      // 7. 離職票交付希望 (1:有 / 2:無)
      separationCertHope: '1',
      // 8. 1週間の所定労働時間
      weeklyHours: String(weeklyHoursNum).padStart(2, '0'),
      weeklyMins: '00',
      // 9. 補充採用予定の有無 (空白:無 / 1:有)
      replenishCode: '',
      // 10. 新氏名
      newNameKana: '',
      // 20. 被保険者氏名
      empNameKana: cleanKana,
      empName: emp.name,
      // 21. 性別（原本に「男 ・ 女」がプレプリントされているため○印を付加）
      genderCircle_male: emp.gender === 'female' || emp.gender === '女' ? '' : '○',
      genderCircle_female: emp.gender === 'female' || emp.gender === '女' ? '○' : '',
      // 22. 生年月日（原本に元号選択肢と年月日の文字がプレプリントされているため、元号○印と数字を分割印字）
      birthEra_taisho: birthWareki.eraCode === '2' ? '○' : '',
      birthEra_showa: birthWareki.eraCode === '3' ? '○' : '',
      birthEra_heisei: birthWareki.eraCode === '4' ? '○' : '',
      birthEra_reiwa: birthWareki.eraCode === '5' ? '○' : '',
      birthYear: String(parseInt(birthWareki.year2, 10)),
      birthMonth: String(parseInt(birthWareki.month2, 10)),
      birthDay: String(parseInt(birthWareki.day2, 10)),
      // 23. 被保険者の住所
      empAddress: emp.address || '滋賀県大津市坂本3丁目21-16',
      // 24. 事業所名称
      officeName: companyInfo.name,
      // 26. 喪失原因詳細
      lossReasonDetail: reasonText || '自己都合退職（一身上の都合による退職）',
      // 届出日
      submitYear: String(parseInt(submitWareki.year2, 10)),
      submitMonth: String(parseInt(submitWareki.month2, 10)),
      submitDay: String(parseInt(submitWareki.day2, 10)),
      // 事業主情報
      employerAddress: companyInfo.address,
      employerName: `${companyInfo.name} 代表取締役 ${companyInfo.representative_name}`,
      employerPhone: companyInfo.phone_number,
      targetHelloWork: '大津'
    };
  }, [officeNumber, companyInfo]);

  // 入力値State
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    return currentEmployee ? calculateLossMasterValues(currentEmployee) : {};
  });

  // 従業員切り替え時に初期値を自動計算・反映（SSOT連動）
  useEffect(() => {
    if (!currentEmployee) return;
    const values = calculateLossMasterValues(currentEmployee);
    setFormValues(values);
  }, [currentEmployee, calculateLossMasterValues]);

  // 大元マスタから最新データを強制再同期するハンドラー
  const handleSyncFromMaster = () => {
    if (!currentEmployee) return;
    const values = calculateLossMasterValues(currentEmployee);
    setFormValues(values);
  };

  // 座標変更イベントリスナー
  useEffect(() => {
    const handleCoordsUpdate = (e: any) => {
      if (e.detail) {
        setCoords(e.detail);
      }
    };
    window.addEventListener(EMPLOYMENT_LOSS_COORDS_UPDATE_EVENT, handleCoordsUpdate);
    return () => window.removeEventListener(EMPLOYMENT_LOSS_COORDS_UPDATE_EVENT, handleCoordsUpdate);
  }, []);

  // 座標微調整ハンドラー
  const updateFieldCoord = useCallback((id: string, x: number, y: number) => {
    setCoords(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) } : f);
      saveEmploymentLossCoordinates(updated);
      broadcastEmploymentLossCoordinates(updated);
      return updated;
    });
  }, []);

  // ドラッグ開始
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

  // グローバルマウス移動＆解放リスナー
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
        await saveEmploymentLossCoordinatesToDb(coords);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingFieldId, updateFieldCoord, coords]);

  // PDF.js による原本第1面のCanvasレンダリング
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

        const loadingTask = pdfjsLib.getDocument('/employment_loss_template.pdf');
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
        console.warn('Could not load employment_loss_template.pdf, fallback to canvas:', err);
        setIsLoadingPdf(false);
      }
    };

    renderTemplate();
    return () => { isCancelled = true; };
  }, []);

  // 値変更ハンドラー
  const handleInputChange = (fieldId: string, val: string) => {
    setFormValues(prev => {
      const updated = { ...prev, [fieldId]: val };
      if (fieldId === 'insuredNumber') {
        const clean = val.replace(/[^0-9]/g, '');
        updated.insuredNumber_1 = clean.slice(0, 4);
        updated.insuredNumber_2 = clean.slice(4, 10);
        updated.insuredNumber_3 = clean.slice(10, 11);
      }
      if (fieldId === 'officeNumber') {
        const clean = val.replace(/[^0-9]/g, '');
        updated.officeNumber_1 = clean.slice(0, 4);
        updated.officeNumber_2 = clean.slice(4, 10);
        updated.officeNumber_3 = clean.slice(10, 11);
      }
      if (fieldId === 'genderSelect') {
        updated.genderCircle_male = val === 'male' ? '○' : '';
        updated.genderCircle_female = val === 'female' ? '○' : '';
      }
      if (fieldId === 'birthEraSelect') {
        updated.birthEra_taisho = val === '2' ? '○' : '';
        updated.birthEra_showa = val === '3' ? '○' : '';
        updated.birthEra_heisei = val === '4' ? '○' : '';
        updated.birthEra_reiwa = val === '5' ? '○' : '';
      }
      return updated;
    });
  };

  // 印刷ハンドラー
  const handlePrint = () => {
    window.print();
  };

  if (!currentEmployee) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
        <UserMinus className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="font-bold text-slate-700">従業員データが見つかりません</h3>
        <p className="text-xs text-slate-500">左上の「戻る」ボタンから従業員台帳をご確認ください。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 print:space-y-0 print:m-0 print:p-0">
      {/* 操作ヘッダーバー（hideHeader指定時は親側で統合） */}
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
                <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-rose-50 text-rose-700 border border-rose-200">
                  ハローワーク様式第4号
                </span>
                <span className="text-xs text-slate-500 font-bold">雇用保険被保険者資格喪失届（公式原本）</span>
              </div>
              <h2 className="text-lg font-black text-slate-800 mt-1 flex items-center gap-2">
                <span>{currentEmployee.name} 殿</span>
                <span className="text-xs font-normal text-slate-500">
                  {currentEmployee.retirement_date ? `（${currentEmployee.retirement_date} 退職）` : `（${currentEmployee.join_date} 入社）`}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 対象者選択 */}
            {onSelectEmployee && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">対象者:</span>
                <select
                  value={currentEmployee.id}
                  onChange={(e) => onSelectEmployee(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2 cursor-pointer max-w-[220px] truncate"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.retirement_date ? `(${emp.retirement_date}退職)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              A4原本下書き印刷 / PDF保存
            </button>
          </div>
        </div>
      )}

      {/* メインレイアウト: 入力コントロールパネル ＆ 原本リアルタイムプレビュー */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start print:block print:w-[210mm] print:m-0 print:p-0">

        {/* ⬅️ 【入退社労務マスタ 自動転記ステータス＆微調整パネル】（印刷時非表示） */}
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

            {/* 🌟 自動連携ガイドカード */}
            <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-3.5 rounded-xl border border-emerald-200/80 text-xs space-y-2">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                入退社・労務台帳より全項目自動流動済
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                退職年月日・喪失原因・被保険者番号・マイナンバー・氏名（漢字・カナ）・所定労働時間・事業所情報は、大元の退職手続き台帳から100%自動転記されています。届出書面での再入力は不要です。
              </p>
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-emerald-700 font-bold">
                  SSOT連携元: 入退社労務書類管理システム
                </span>
                <button
                  type="button"
                  onClick={handleSyncFromMaster}
                  className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-300 shadow-2xs flex items-center gap-1 cursor-pointer transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  大元マスタから再同期
                </button>
              </div>
            </div>

            {/* 📋 自動反映中データ確認カード */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="font-black text-slate-700 flex items-center justify-between border-b border-slate-200 pb-1.5">
                <span>反映中データ確認</span>
                <span className="text-[10px] text-slate-400 font-normal">原本プレビューに即時反映中</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500">被保険者氏名:</span>
                  <span className="font-bold text-slate-800">{currentEmployee.name}（{formValues.empNameKana || '未登録'}）</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500">退職・離職年月日:</span>
                  <span className="font-bold text-rose-700">{currentEmployee.retirement_date || '未設定（在職中）'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500">喪失原因区分:</span>
                  <span className="font-bold text-slate-800">
                    {formValues.lossReasonCode === '3' ? '3: 事業主都合による離職' : formValues.lossReasonCode === '1' ? '1: 離職以外の理由' : '2: 3以外の離職（自己都合等）'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500">雇用保険被保険者番号:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {currentEmployee.employment_insurance_number || `${formValues.insuredNumber_1}-${formValues.insuredNumber_2}-${formValues.insuredNumber_3}` || '未登録'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500">個人番号（マイナンバー）:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formValues.myNumber ? `${formValues.myNumber.slice(0, 4)} **** ****` : '未登録'}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-500">資格取得年月日:</span>
                  <span className="font-bold text-slate-800">{currentEmployee.join_date}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">1週の所定労働時間:</span>
                  <span className="font-bold text-slate-800">{formValues.weeklyHours || '40'}時間 {formValues.weeklyMins || '00'}分</span>
                </div>
              </div>
            </div>

            {/* ⚙️ 開閉式 提出用一時微調整パネル（通常は閉じておく） */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdjustOpen(!isAdjustOpen)}
                className="w-full bg-slate-100/70 hover:bg-slate-100 px-3.5 py-2.5 text-xs font-bold text-slate-700 flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  提出用 一時微調整フォーム（任意）
                </span>
                {isAdjustOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>

              {isAdjustOpen && (
                <div className="p-3.5 bg-white space-y-3 border-t border-slate-200 text-xs">
                  <p className="text-[10px] text-slate-400">
                    ※通常は入力不要です。ハローワーク窓口での指示等により、今回限り提出データを微調整したい場合のみ編集してください。
                  </p>

                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">6. 喪失原因コード</label>
                      <select
                        value={formValues.lossReasonCode || '2'}
                        onChange={(e) => handleInputChange('lossReasonCode', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                      >
                        <option value="1">1: 死亡、役員就任その他離職以外の理由</option>
                        <option value="2">2: 自己都合、定年、契約期間満了等（3以外の離職）</option>
                        <option value="3">3: 解雇、倒産、事業主勧奨等（事業主都合）</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">7. 離職票交付希望</label>
                      <select
                        value={formValues.separationCertHope || '1'}
                        onChange={(e) => handleInputChange('separationCertHope', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                      >
                        <option value="1">1: 有（離職票を希望する）</option>
                        <option value="2">2: 無（離職票を希望しない）</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">9. 補充採用予定の有無</label>
                      <select
                        value={formValues.replenishCode || ''}
                        onChange={(e) => handleInputChange('replenishCode', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                      >
                        <option value="">空白: 無（補充予定なし）</option>
                        <option value="1">1: 有（ハローワーク等の紹介による補充採用予定あり）</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">26. 喪失原因の具体的事由</label>
                      <input
                        type="text"
                        value={formValues.lossReasonDetail || ''}
                        onChange={(e) => handleInputChange('lossReasonDetail', e.target.value)}
                        placeholder="例: 自己都合退職（転職のため）"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                      />
                    </div>

                    {/* 21. 性別 */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">21. 性別（原本プレプリント「男・女」への○印）</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleInputChange('genderSelect', 'male')}
                          className={`py-1.5 px-3 rounded-lg font-black text-xs transition border cursor-pointer ${
                            formValues.genderCircle_male === '○'
                              ? 'bg-amber-100 border-amber-500 text-amber-950 ring-1 ring-amber-500'
                              : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          男性（男に○）
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInputChange('genderSelect', 'female')}
                          className={`py-1.5 px-3 rounded-lg font-black text-xs transition border cursor-pointer ${
                            formValues.genderCircle_female === '○'
                              ? 'bg-amber-100 border-amber-500 text-amber-950 ring-1 ring-amber-500'
                              : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          女性（女に○）
                        </button>
                      </div>
                    </div>

                    {/* 22. 生年月日 */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">22. 生年月日（元号○印 ＆ 年・月・日）</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        <select
                          value={
                            formValues.birthEra_reiwa === '○' ? '5' :
                            formValues.birthEra_heisei === '○' ? '4' :
                            formValues.birthEra_showa === '○' ? '3' : '2'
                          }
                          onChange={(e) => handleInputChange('birthEraSelect', e.target.value)}
                          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 font-bold text-slate-800"
                        >
                          <option value="5">令和(○)</option>
                          <option value="4">平成(○)</option>
                          <option value="3">昭和(○)</option>
                          <option value="2">大正(○)</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={formValues.birthYear || ''}
                            onChange={(e) => handleInputChange('birthYear', e.target.value)}
                            placeholder="年"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-1.5 text-center font-bold text-slate-800"
                          />
                          <span className="text-[10px] text-slate-500">年</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={formValues.birthMonth || ''}
                            onChange={(e) => handleInputChange('birthMonth', e.target.value)}
                            placeholder="月"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-1.5 text-center font-bold text-slate-800"
                          />
                          <span className="text-[10px] text-slate-500">月</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={formValues.birthDay || ''}
                            onChange={(e) => handleInputChange('birthDay', e.target.value)}
                            placeholder="日"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-1.5 text-center font-bold text-slate-800"
                          />
                          <span className="text-[10px] text-slate-500">日</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 印刷前案内 */}
            <div className="pt-2">
              <button
                onClick={handlePrint}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                A4原本下書き印刷 / PDF保存
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-1.5">
                ※印刷時は背景の公式原本と文字が完全一致した状態でA4縦1枚に出力されます。
              </p>
            </div>
          </div>
        </div>

        {/* ➡️ 【原本リアルタイムプレビュー ＆ 印刷原本】 */}
        <div className="lg:col-span-8 flex flex-col items-center overflow-x-auto print:block print:w-[210mm] print:p-0 print:m-0 print:overflow-visible pb-12 print:pb-0">
          {/* ドラッグ操作案内 ＆ ズームバー（印刷時非表示） */}
          <div className="print:hidden mb-2 w-full max-w-[210mm] flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
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

            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs">
              <Move className="w-3.5 h-3.5 text-rose-600" />
              <span>原本上の文字を直接ドラッグして位置微調整可能（全社自動保存）</span>
            </div>
          </div>

          <div 
            ref={previewContainerRef}
            style={{ 
              transform: `scale(${previewZoom / 100})`, 
              transformOrigin: 'top center',
              containerType: 'inline-size',
              width: '210mm',
              height: '297mm',
              aspectRatio: '210 / 297'
            }}
            className="official-loss-print-container w-[210mm] h-[297mm] bg-white relative shadow-xl border border-slate-300 text-slate-900 font-mono print:shadow-none print:border-none print:p-0 print:m-0 print:w-[210mm] print:h-[297mm] print:transform-none overflow-hidden select-none"
          >
            
            {/* 原本PDF画像背景 */}
            {bgPdfImg ? (
              <img
                src={bgPdfImg}
                alt="雇用保険被保険者資格喪失届原本"
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
                        : 'hover:ring-1 hover:ring-rose-400 hover:bg-rose-50/40'
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
                    fontFamily: field.id.includes('employer') || field.id.includes('Name') || field.id.includes('Address') ? 'sans-serif' : 'monospace',
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
                      : 'hover:ring-1 hover:ring-rose-400 hover:bg-rose-50/40'
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
          .official-loss-print-container {
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
          .official-loss-print-container img {
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
