import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Printer, ZoomIn, ZoomOut, 
  Maximize2 
} from 'lucide-react';
import { 
  loadSpouseDocCoordinates, 
  fetchSpouseDocCoordinatesFromDb,
  SPOUSE_DOC_COORDS_UPDATE_EVENT,
  type SpouseDocFieldConfig 
} from '../lib/spouseDocCoordinates';

export interface SpouseDeductionDocData {
  year?: number;
  companyName: string;
  companyAddress: string;
  corporateNumber?: string;
  taxOfficeName?: string;
  employeeName: string;
  employeeNameKana?: string;
  employeeAddress: string;
  employeeMyNumber?: string;
  employeeIncomeEstimate?: number; // 本人の所得見積額
  hasSpouse: boolean;
  spouseName?: string;
  spouseNameKana?: string;
  spouseBirthDate?: string;
  spouseIncomeEstimate?: number; // 配偶者の所得見積額
  spouseAddress?: string;
  spouseMyNumber?: string;
  appliedDate?: string;
}

interface OfficialSpouseDeductionDocProps {
  data: SpouseDeductionDocData;
  customCoords?: SpouseDocFieldConfig[];
}

export default function OfficialSpouseDeductionDoc({ 
  data, 
  customCoords 
}: OfficialSpouseDeductionDocProps) {
  const year = data.year || 2026;
  const reiwaYear = year - 2018; // 2026 -> 8
  const spIncome = data.spouseIncomeEstimate ?? 0;
  const empIncome = data.employeeIncomeEstimate ?? 3560000;

  // 1. 本人の区分判定（A: 900万以下, B: 900万超950万以下, C: 950万超1000万以下）
  const empCategory = useMemo(() => {
    if (empIncome <= 9000000) return { label: 'A (900万円以下)', code: 'A', deduction: 480000 };
    if (empIncome <= 9500000) return { label: 'B (900万円超950万円以下)', code: 'B', deduction: 320000 };
    if (empIncome <= 10000000) return { label: 'C (950万円超1000万円以下)', code: 'C', deduction: 160000 };
    return { label: '対象外 (1000万円超)', code: 'OUT', deduction: 0 };
  }, [empIncome]);

  // 配偶者の老人判定（昭和32年1月1日以前生まれ = 70歳以上）
  const isElderlySpouse = useMemo(() => {
    if (!data.spouseBirthDate) return false;
    const bDate = new Date(data.spouseBirthDate);
    const threshold = new Date('1957-01-01T23:59:59');
    return bDate <= threshold;
  }, [data.spouseBirthDate]);

  // 2. 配偶者の所得区分・控除額判定
  const spouseDeductionResult = useMemo(() => {
    if (!data.hasSpouse || !data.spouseName) {
      return {
        type: 'なし',
        bracket: '対象外',
        judgeCode: null as string | null,
        category2: '' as string,
        isSpouseDeduction: false,
        isSpecialDeduction: false,
        deductionAmount: 0,
        explanation: '配偶者なし、または未申告です。'
      };
    }

    if (empCategory.code === 'OUT') {
      return {
        type: '適用なし',
        bracket: '本人の所得上限超過',
        judgeCode: null,
        category2: '',
        isSpouseDeduction: false,
        isSpecialDeduction: false,
        deductionAmount: 0,
        explanation: '申告者本人の合計所得金額が1,000万円を超えるため、配偶者控除・特別控除は適用できません。'
      };
    }

    // ① 48万円以下
    if (spIncome <= 480000) {
      if (isElderlySpouse) {
        return {
          type: '配偶者控除（老人）',
          bracket: '① 48万円以下（老人控除対象配偶者）',
          judgeCode: '1',
          category2: '①',
          isSpouseDeduction: true,
          isSpecialDeduction: false,
          deductionAmount: empCategory.code === 'A' ? 480000 : (empCategory.code === 'B' ? 320000 : 160000),
          explanation: '老人控除対象配偶者として、配偶者控除（最高48万円）が適用されます。'
        };
      } else {
        return {
          type: '配偶者控除（一般）',
          bracket: '② 48万円以下（一般の控除対象配偶者）',
          judgeCode: '2',
          category2: '②',
          isSpouseDeduction: true,
          isSpecialDeduction: false,
          deductionAmount: empCategory.code === 'A' ? 380000 : (empCategory.code === 'B' ? 260000 : 130000),
          explanation: '一般の配偶者控除（最高38万円）が適用されます。'
        };
      }
    }

    // ② 48万円超〜95万円以下（給与年収150万円以下）
    if (spIncome <= 950000) {
      return {
        type: '配偶者特別控除（満額）',
        bracket: '③ 48万円超〜95万円以下（年収150万円以下）',
        judgeCode: '3',
        category2: '③',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 380000 : (empCategory.code === 'B' ? 260000 : 130000),
        explanation: '配偶者特別控除の最高額（38万円）が満額適用されます。'
      };
    }

    // ③ 95万円超〜100万円以下
    if (spIncome <= 1000000) {
      return {
        type: '配偶者特別控除',
        bracket: '④ 95万円超〜100万円以下',
        judgeCode: '4',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 380000 : (empCategory.code === 'B' ? 260000 : 130000),
        explanation: '配偶者特別控除（38万円）が適用されます。'
      };
    }

    // ④ 100万円超〜105万円以下
    if (spIncome <= 1050000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑤ 100万円超〜105万円以下',
        judgeCode: '5',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 360000 : (empCategory.code === 'B' ? 240000 : 120000),
        explanation: '配偶者特別控除（36万円）が適用されます。'
      };
    }

    // ⑤ 105万円超〜110万円以下
    if (spIncome <= 1100000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑥ 105万円超〜110万円以下',
        judgeCode: '6',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 310000 : (empCategory.code === 'B' ? 210000 : 110000),
        explanation: '配偶者特別控除（31万円）が適用されます。'
      };
    }

    // ⑥ 110万円超〜115万円以下
    if (spIncome <= 1150000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑦ 110万円超〜115万円以下',
        judgeCode: '7',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 260000 : (empCategory.code === 'B' ? 180000 : 90000),
        explanation: '配偶者特別控除（26万円）が適用されます。'
      };
    }

    // ⑦ 115万円超〜120万円以下
    if (spIncome <= 1200000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑧ 115万円超〜120万円以下',
        judgeCode: '8',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 210000 : (empCategory.code === 'B' ? 140000 : 70000),
        explanation: '配偶者特別控除（21万円）が適用されます。'
      };
    }

    // ⑧ 120万円超〜125万円以下
    if (spIncome <= 1250000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑨ 120万円超〜125万円以下',
        judgeCode: '9',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 160000 : (empCategory.code === 'B' ? 110000 : 60000),
        explanation: '配偶者特別控除（16万円）が適用されます。'
      };
    }

    // ⑨ 125万円超〜130万円以下
    if (spIncome <= 1300000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑩ 125万円超〜130万円以下',
        judgeCode: '10',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 110000 : (empCategory.code === 'B' ? 80000 : 40000),
        explanation: '配偶者特別控除（11万円）が適用されます。'
      };
    }

    // ⑩ 130万円超〜133万円以下
    if (spIncome <= 1330000) {
      return {
        type: '配偶者特別控除',
        bracket: '⑪ 130万円超〜133万円以下',
        judgeCode: '11',
        category2: '④',
        isSpouseDeduction: false,
        isSpecialDeduction: true,
        deductionAmount: empCategory.code === 'A' ? 30000 : (empCategory.code === 'B' ? 20000 : 10000),
        explanation: '配偶者特別控除（3万円）が適用されます。'
      };
    }

    return {
      type: '控除対象外',
      bracket: '133万円超（配偶者控除・特別控除対象外）',
      judgeCode: null,
      category2: '',
      isSpouseDeduction: false,
      isSpecialDeduction: false,
      deductionAmount: 0,
      explanation: '配偶者の所得が133万円を超えるため、控除は受けられません。'
    };
  }, [data.hasSpouse, data.spouseName, spIncome, empCategory, isElderlySpouse]);

  // 3. 座標マスタ（DBまたはLocalStorage、外部指定）
  const [coords, setCoords] = useState<SpouseDocFieldConfig[]>(() => {
    return customCoords || loadSpouseDocCoordinates();
  });

  useEffect(() => {
    if (customCoords) {
      setCoords(customCoords);
      return;
    }
    let isCancelled = false;
    fetchSpouseDocCoordinatesFromDb().then(dbCoords => {
      if (!isCancelled && dbCoords && dbCoords.length > 0) {
        setCoords(dbCoords);
      }
    });
    const handleCoordsUpdate = (e: any) => {
      if (e.detail) setCoords(e.detail);
    };
    window.addEventListener(SPOUSE_DOC_COORDS_UPDATE_EVENT, handleCoordsUpdate);
    return () => {
      isCancelled = true;
      window.removeEventListener(SPOUSE_DOC_COORDS_UPDATE_EVENT, handleCoordsUpdate);
    };
  }, [customCoords]);

  // 4. 原本背景画像（PDF.js描画）
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const renderPdf = async () => {
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
          url: '/spouse_deduction_template.pdf',
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
        console.warn('Spouse PDF load warning:', err);
        setIsLoadingPdf(false);
      }
    };
    renderPdf();
    return () => { isCancelled = true; };
  }, []);

  // 5. ズーム倍率 ＆ Fit機能
  const [zoomScale, setZoomScale] = useState<number>(100);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleFit = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 32;
    // A4横幅 297mm ≈ 1122px (at 96dpi)
    const baseWidthPx = 1122;
    const fitPercent = Math.min(100, Math.max(40, Math.floor((containerWidth / baseWidthPx) * 100)));
    setZoomScale(fitPercent);
  };

  useEffect(() => {
    handleFit();
  }, []);

  // 6. 各フィールドの値マッピング辞書
  const fieldValueMap = useMemo(() => {
    const map = new Map<string, { value: string; isCircle?: boolean; isCheck?: boolean }>();

    // ① ヘッダー
    map.set('taxOffice', { value: data.taxOfficeName || '' });
    map.set('companyName', { value: data.companyName || '' });
    map.set('corporateNumber', { value: data.corporateNumber || '' });
    map.set('companyAddress', { value: data.companyAddress || '' });
    map.set('empKana', { value: data.employeeNameKana || '' });
    map.set('empName', { value: data.employeeName || '' });
    map.set('empAddress', { value: data.employeeAddress || '' });

    // ② 基礎控除申告書
    const salaryEst = empIncome > 0 ? (empIncome + 550000) : 0; // 概算収入
    map.set('basicSalaryIncome', { value: salaryEst > 0 ? salaryEst.toLocaleString() : '' });
    map.set('basicSalaryCalc', { value: empIncome > 0 ? empIncome.toLocaleString() : '' });
    map.set('basicOtherIncome', { value: '0' });
    map.set('basicTotalIncome', { value: empIncome > 0 ? empIncome.toLocaleString() : '' });
    
    // 基礎判定チェック
    if (empCategory.code === 'A') map.set('basicJudgeA', { value: '✓', isCheck: true });
    if (empCategory.code === 'B') map.set('basicJudgeB', { value: '✓', isCheck: true });
    if (empCategory.code === 'C') map.set('basicJudgeC', { value: '✓', isCheck: true });
    map.set('basicCategory1', { value: empCategory.code !== 'OUT' ? empCategory.code : '' });
    map.set('basicDeductionAmount', { 
      value: empCategory.deduction > 0 ? empCategory.deduction.toLocaleString() : '' 
    });

    // ③ 配偶者控除等申告書
    if (data.hasSpouse && data.spouseName) {
      map.set('spouseKana', { value: data.spouseNameKana || '' });
      map.set('spouseName', { value: data.spouseName || '' });
      map.set('spouseMyNumber', { value: data.spouseMyNumber || '' });

      // 配偶者生年月日分解
      if (data.spouseBirthDate) {
        const b = new Date(data.spouseBirthDate);
        if (!isNaN(b.getTime())) {
          const y = b.getFullYear();
          const m = b.getMonth() + 1;
          const d = b.getDate();
          if (y <= 1989) {
            map.set('spouseEraShowa', { value: '○', isCircle: true });
            map.set('spouseBirthY', { value: String(y - 1925) });
          } else if (y <= 2019) {
            map.set('spouseEraHeisei', { value: '○', isCircle: true });
            map.set('spouseBirthY', { value: String(y - 1988) });
          } else {
            map.set('spouseEraReiwa', { value: '○', isCircle: true });
            map.set('spouseBirthY', { value: String(y - 2018) });
          }
          map.set('spouseBirthM', { value: String(m) });
          map.set('spouseBirthD', { value: String(d) });
        }
      }

      map.set('spouseAddress', { value: data.spouseAddress || '同居' });
      const spSalaryEst = spIncome > 0 ? (spIncome + 550000) : 0;
      map.set('spouseSalaryIncome', { value: spSalaryEst > 0 ? spSalaryEst.toLocaleString() : '' });
      map.set('spouseSalaryCalc', { value: spIncome > 0 ? spIncome.toLocaleString() : '0' });
      map.set('spouseOtherIncome', { value: '0' });
      map.set('spouseTotalIncome', { value: spIncome > 0 ? spIncome.toLocaleString() : '0' });

      // 配偶者判定
      if (spouseDeductionResult.judgeCode === '1') map.set('spouseJudge1', { value: '✓', isCheck: true });
      if (spouseDeductionResult.judgeCode === '2') map.set('spouseJudge2', { value: '✓', isCheck: true });
      if (spouseDeductionResult.judgeCode === '3') map.set('spouseJudge3', { value: '✓', isCheck: true });
      if (spouseDeductionResult.judgeCode === '4') map.set('spouseJudge4', { value: '✓', isCheck: true });
      if (spouseDeductionResult.judgeCode === '5') map.set('spouseJudge5', { value: '✓', isCheck: true });

      map.set('spouseCategory2', { value: spouseDeductionResult.category2 });

      if (spouseDeductionResult.isSpouseDeduction && spouseDeductionResult.deductionAmount > 0) {
        map.set('spouseDeductionAmount', { 
          value: spouseDeductionResult.deductionAmount.toLocaleString() 
        });
      }
      if (spouseDeductionResult.isSpecialDeduction && spouseDeductionResult.deductionAmount > 0) {
        map.set('spouseSpecialDeductionAmount', { 
          value: spouseDeductionResult.deductionAmount.toLocaleString() 
        });
      }
    }

    return map;
  }, [data, empIncome, spIncome, empCategory, spouseDeductionResult]);

  return (
    <div className="space-y-4 font-sans print:m-0 print:p-0">
      
      {/* 🖨️ A4横 印刷専用CSS（荀彧門番：改ページ崩れ・横はみ出し完全防止） */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .spouse-print-container {
            width: 297mm !important;
            height: 210mm !important;
            max-width: 297mm !important;
            max-height: 210mm !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: hidden !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* 🧭 上部操作・サマリーツールバー（画面表示時のみ） */}
      <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base">🏛️</span>
            <h2 className="text-sm font-black text-white">
              国税庁 令和{reiwaYear}年分 基礎・配偶者・特定親族・所得調整控除申告書
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              A4横原本連動
            </span>
          </div>
          <p className="text-xs text-slate-400">
            原本PDFの正確なマス目位置に実データを自動注入し、A4横で1ミリの狂いもなく印刷できます。
          </p>
        </div>

        {/* 判定バッジサマリー */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <span className="text-slate-400 text-[10px] block">本人基礎控除</span>
            <span className="font-mono font-black text-amber-400">
              {empCategory.deduction > 0 ? `¥${empCategory.deduction.toLocaleString()}` : '対象外'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">({empCategory.code})</span>
          </div>

          <div className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
            <span className="text-slate-400 text-[10px] block">配偶者控除・特別控除</span>
            <span className="font-mono font-black text-emerald-400">
              {spouseDeductionResult.deductionAmount > 0 
                ? `¥${spouseDeductionResult.deductionAmount.toLocaleString()}` 
                : '¥0'}
            </span>
            <span className="text-[10px] text-slate-400 ml-1">({spouseDeductionResult.type})</span>
          </div>

          {/* 拡大縮小 ＆ Fitボタン */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={handleFit}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition cursor-pointer"
              title="画面幅に合わせてフィット"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Fit</span>
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(z => Math.max(40, z - 10))}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="縮小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold text-amber-400 px-1">{zoomScale}%</span>
            <button
              type="button"
              onClick={() => setZoomScale(z => Math.min(150, z + 10))}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="拡大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(100)}
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 cursor-pointer text-[10px] font-bold"
              title="原寸100%"
            >
              100%
            </button>
          </div>

          {/* 🖨️ A4横 印刷ボタン */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>A4横 印刷する</span>
          </button>
        </div>
      </div>

      {/* 🖼️ 原本A4横キャンバス プレビューエリア */}
      <div 
        ref={containerRef}
        className="overflow-auto p-4 bg-slate-950/60 rounded-2xl border border-slate-800 flex justify-center items-start min-h-[600px] print:p-0 print:border-none print:bg-transparent"
      >
        <div
          className="spouse-print-container relative bg-white shadow-2xl overflow-hidden transition-transform duration-100"
          style={{
            width: `${297 * (zoomScale / 100)}mm`,
            minHeight: `${210 * (zoomScale / 100)}mm`,
            aspectRatio: '297 / 210',
            backgroundImage: bgPdfImg ? `url(${bgPdfImg})` : undefined,
            backgroundSize: '100% 100%',
            backgroundRepeat: 'no-repeat',
            transformOrigin: 'top center'
          }}
        >
          {/* 原本ローダー */}
          {isLoadingPdf && (
            <div className="no-print absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
              <span className="text-xs font-bold text-slate-700">原本PDFを読み込み中...</span>
            </div>
          )}

          {/* 各フィールドの絶対配置オーバーレイ */}
          {coords.map(field => {
            if (field.disabled) return null;
            const mapped = fieldValueMap.get(field.id);
            const val = mapped ? mapped.value : field.example;
            if (!val && val !== '0') return null;

            const isCircle = mapped?.isCircle !== undefined ? mapped.isCircle : field.isCircle;
            const isCheck = mapped?.isCheck !== undefined ? mapped.isCheck : field.isCheck;

            return (
              <div
                key={field.id}
                style={{
                  position: 'absolute',
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  zIndex: 20,
                  pointerEvents: 'none'
                }}
              >
                {/* ○印（二重丸にならず綺麗な単一の○印を描画） */}
                {isCircle ? (
                  <div
                    className="rounded-full border-2 border-red-600"
                    style={{
                      width: `${(field.fontSize || 10) * 1.5}pt`,
                      height: `${(field.fontSize || 10) * 1.5}pt`
                    }}
                  />
                ) : isCheck ? (
                  /* ✓チェック */
                  <div
                    className="font-black text-red-600"
                    style={{
                      fontSize: `${field.fontSize || 11}pt`,
                      lineHeight: 1
                    }}
                  >
                    ✓
                  </div>
                ) : field.pitch && field.pitch > 0 ? (
                  /* マス目間隔ピッチ */
                  <div className="flex items-center">
                    {val.split('').map((ch, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-block',
                          width: `${(field.pitch || 1.45) * 2.97}mm`,
                          fontSize: `${field.fontSize}pt`,
                          fontWeight: 700,
                          color: '#0f172a',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          lineHeight: 1
                        }}
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                ) : (
                  /* 通常文字 */
                  <span
                    style={{
                      fontSize: `${field.fontSize}pt`,
                      fontWeight: 700,
                      color: '#0f172a',
                      fontFamily: 'sans-serif',
                      lineHeight: 1,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {val}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
