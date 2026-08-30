import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, Eye, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

interface DependentItem {
  name: string;
  nameKana?: string;
  myNumber?: string;
  relation: string;
  birthDate: string;
  isLivingTogether?: boolean;
  incomeEstimate?: number;
  isUnder16?: boolean;
  isSpecific?: boolean;
  isElderly?: boolean;
  isNonResident?: boolean;
  nonResidentReason?: '16_30_70' | 'study_abroad' | 'disabled' | 'payment_380k';
  livingTogetherFact?: string;
  address?: string;
  changeDateReason?: string;
}

interface TaxExemptionDocProps {
  data: {
    year?: number;
    companyName: string;
    companyAddress?: string;
    corporateNumber?: string;
    taxOfficeName?: string;
    municipalityName?: string;
    employeeName: string;
    employeeNameKana?: string;
    employeeAddress: string;
    postalCode?: string;
    myNumber?: string;
    birthDate?: string;
    householderName?: string;
    householderRelation?: string;
    hasSpouse?: boolean;
    spouseName?: string;
    spouseNameKana?: string;
    spouseMyNumber?: string;
    spouseBirthDate?: string;
    spouseIncomeEstimate?: number;
    spouseIsLivingTogether?: boolean;
    spouseIsNonResident?: boolean;
    spouseAddress?: string;
    spouseChangeDateReason?: string;
    dependents?: DependentItem[];
    isDisability?: boolean;
    disabilityType?: 'general' | 'special' | 'living_special';
    disabilityTarget?: 'self' | 'spouse' | 'dependent';
    disabilityCount?: number;
    isWidow?: boolean;
    isSingleParent?: boolean;
    isWorkingStudent?: boolean;
    disabilityDetails?: string;
    workingStudentSchool?: string;
    otherTaxPayerDependents?: Array<{
      dependentName: string;
      relation: string;
      birthDate: string;
      address: string;
      otherTaxPayerName: string;
      otherTaxPayerRelation: string;
      otherTaxPayerAddress: string;
      changeDateReason?: string;
    }>;
    retirementDependents?: Array<{
      name: string;
      nameKana?: string;
      myNumber?: string;
      relation: string;
      birthDate: string;
      address: string;
      incomeEstimate?: number;
      isDisability?: boolean;
      changeDateReason?: string;
    }>;
    appliedDate: string;
    isSecondarySalary?: boolean;
  };
}

/**
 * 西暦日付を国税庁公式の和暦（元号・年・月・日）に分解
 */
function parseJapaneseEraDate(dateStr?: string): { era: string; year: string; month: string; day: string } {
  if (!dateStr) return { era: '令', year: ' ', month: ' ', day: ' ' };
  
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.replace(/[^0-9]/g, ' ').trim().split(/\s+/);
    if (parts.length >= 3) {
      const y = parseInt(parts[0], 10);
      const m = parts[1];
      const day = parts[2];
      if (y >= 2019) return { era: '令', year: String(y - 2018), month: m, day };
      if (y >= 1989) return { era: '平', year: String(y - 1988), month: m, day };
      if (y >= 1926) return { era: '昭', year: String(y - 1925), month: m, day };
    }
    return { era: '令', year: ' ', month: ' ', day: ' ' };
  }

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1);
  const day = String(d.getDate());

  if (y >= 2019) return { era: '令', year: String(y - 2018 === 1 ? '元' : y - 2018), month: m, day };
  if (y >= 1989) return { era: '平', year: String(y - 1988 === 1 ? '元' : y - 1988), month: m, day };
  if (y >= 1926) return { era: '昭', year: String(y - 1925 === 1 ? '元' : y - 1925), month: m, day };
  if (y >= 1912) return { era: '大', year: String(y - 1911 === 1 ? '元' : y - 1911), month: m, day };
  return { era: '明', year: String(y - 1867), month: m, day };
}

export const OfficialTaxExemptionDoc: React.FC<TaxExemptionDocProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'canvas_doc' | 'pdf_view' | 'guide_view'>('canvas_doc');
  const [isRendering, setIsRendering] = useState(true);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const under16Dependents = (data.dependents || []).filter(d => d.isUnder16);
  const regularDependents = (data.dependents || []).filter(d => !d.isUnder16);

  // 4名分の枠
  const bRows: Array<DependentItem | null> = [...regularDependents.slice(0, 4)];
  while (bRows.length < 4) bRows.push(null);

  // 16歳未満 2名分の枠
  const u16Rows: Array<DependentItem | null> = [...under16Dependents.slice(0, 2)];
  while (u16Rows.length < 2) u16Rows.push(null);

  const empBirth = parseJapaneseEraDate(data.birthDate);
  const spouseBirth = parseJapaneseEraDate(data.spouseBirthDate);

  /**
   * PDF.js を動的ロードして国税庁公式PDF原本（/2026bun_01.pdf）をキャンバスに描画し、
   * その上に直接データを完全な位置精度で印字する！
   */
  useEffect(() => {
    let isCancelled = false;

    const renderPdfWithData = async () => {
      setIsRendering(true);
      try {
        // PDF.js ライブラリをCDNからロード
        // @ts-ignore
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          await new Promise(resolve => {
            script.onload = resolve;
          });
        }

        // @ts-ignore
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // 国税庁公式PDFをロード
        const loadingTask = pdfjsLib.getDocument('/2026bun_01.pdf');
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        // 高解像度レンダリング（2.0倍スケール = 約2400px幅）
        const scale = 2.0;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        // 1. 国税庁PDF原本の下敷きを描画
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        await page.render(renderContext).promise;

        if (isCancelled) return;

        // 2. 原本の上にデータを精密オーバーレイ印字！
        const W = canvas.width;
        const H = canvas.height;

        ctx.fillStyle = '#0f172a'; // くっきりした濃紺/黒インク
        ctx.textBaseline = 'middle';

        // 🏢 給与支払者
        ctx.font = 'bold 22px "Noto Sans JP", sans-serif';
        ctx.fillText(data.taxOfficeName || '千代田', W * 0.115, H * 0.178);
        ctx.fillText(data.municipalityName || '千代田区', W * 0.095, H * 0.265);

        ctx.font = 'bold 25px "Noto Sans JP", sans-serif';
        ctx.fillText(data.companyName, W * 0.295, H * 0.180);

        ctx.font = 'bold 24px "Courier New", monospace';
        ctx.fillText(data.corporateNumber || '1010001999999', W * 0.295, H * 0.220);

        ctx.font = 'bold 19px "Noto Sans JP", sans-serif';
        ctx.fillText(data.companyAddress || '本社所在地', W * 0.295, H * 0.258);

        // 👤 あなたの情報
        ctx.font = '16px "Noto Sans JP", sans-serif';
        ctx.fillText(data.employeeNameKana || 'テスト', W * 0.535, H * 0.156);

        ctx.font = '900 32px "Noto Sans JP", sans-serif';
        ctx.fillText(data.employeeName, W * 0.535, H * 0.184);

        // 個人番号（12桁マス目印字）
        const myNumStr = data.myNumber ? data.myNumber.replace(/[^0-9]/g, '') : '123456789012';
        ctx.font = 'bold 24px "Courier New", monospace';
        const numStartX = W * 0.538;
        const numSpacing = W * 0.0215;
        for (let i = 0; i < 12; i++) {
          const char = myNumStr[i] || '*';
          ctx.fillText(char, numStartX + i * numSpacing, H * 0.222);
        }

        // 住所 ＆ 郵便番号
        ctx.font = 'bold 18px "Noto Sans JP", sans-serif';
        ctx.fillText(data.postalCode || '160-0023', W * 0.590, H * 0.255);
        ctx.font = 'bold 20px "Noto Sans JP", sans-serif';
        ctx.fillText(data.employeeAddress, W * 0.490, H * 0.272);

        // 生年月日
        ctx.font = 'bold 20px "Noto Sans JP", sans-serif';
        ctx.fillText(empBirth.year, W * 0.775, H * 0.160);
        ctx.fillText(empBirth.month, W * 0.835, H * 0.160);
        ctx.fillText(empBirth.day, W * 0.885, H * 0.160);

        // 世帯主 ＆ 続柄 ＆ 配偶者
        ctx.fillText(data.householderName || data.employeeName, W * 0.770, H * 0.192);
        ctx.fillText(data.householderRelation || '本人', W * 0.770, H * 0.228);

        // 配偶者の有無（○印を描画）
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        if (data.hasSpouse) {
          ctx.beginPath();
          ctx.arc(W * 0.762, H * 0.262, 14, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(W * 0.792, H * 0.262, 14, 0, Math.PI * 2);
          ctx.stroke();
        }

        // ─────────────────────────────────────────────────────────────────
        // Ａ. 源泉控除対象配偶者
        // ─────────────────────────────────────────────────────────────────
        if (data.hasSpouse && data.spouseName) {
          ctx.font = '15px "Noto Sans JP", sans-serif';
          ctx.fillText(data.spouseNameKana || '', W * 0.185, H * 0.345);

          ctx.font = 'bold 24px "Noto Sans JP", sans-serif';
          ctx.fillText(data.spouseName, W * 0.185, H * 0.362);

          // 配偶者マイナンバー
          const spNumStr = data.spouseMyNumber ? data.spouseMyNumber.replace(/[^0-9]/g, '') : '************';
          ctx.font = 'bold 18px "Courier New", monospace';
          ctx.fillText(spNumStr, W * 0.285, H * 0.360);

          ctx.font = 'bold 20px "Noto Sans JP", sans-serif';
          ctx.fillText('妻', W * 0.365, H * 0.360);

          // 生年月日
          ctx.fillText(spouseBirth.year, W * 0.440, H * 0.360);
          ctx.fillText(spouseBirth.month, W * 0.478, H * 0.360);
          ctx.fillText(spouseBirth.day, W * 0.512, H * 0.360);

          // 所得見積額
          ctx.textAlign = 'right';
          ctx.fillText(`${(data.spouseIncomeEstimate || 0).toLocaleString()} 円`, W * 0.582, H * 0.360);
          ctx.textAlign = 'left';

          // 生計一事実 ＆ 住所
          ctx.font = '18px "Noto Sans JP", sans-serif';
          ctx.fillText(data.spouseIsLivingTogether !== false ? '同居' : '別居', W * 0.615, H * 0.360);
          ctx.fillText(data.spouseAddress || data.employeeAddress, W * 0.685, H * 0.360);
        }

        // ─────────────────────────────────────────────────────────────────
        // Ｂ. 控除対象扶養親族（1〜4行）
        // ─────────────────────────────────────────────────────────────────
        const bYOffsets = [0.445, 0.505, 0.565, 0.625];
        const bKanaYOffsets = [0.425, 0.485, 0.545, 0.605];

        bRows.forEach((dep, idx) => {
          if (!dep) return;
          const y = H * bYOffsets[idx];
          const yk = H * bKanaYOffsets[idx];
          const bDate = parseJapaneseEraDate(dep.birthDate);

          ctx.font = '14px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.nameKana || '', W * 0.185, yk);

          ctx.font = 'bold 22px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.name, W * 0.185, y);

          // マイナンバー
          ctx.font = 'bold 18px "Courier New", monospace';
          ctx.fillText(dep.myNumber || '************', W * 0.285, y);

          // 続柄
          ctx.font = 'bold 20px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.relation, W * 0.365, y);

          // 生年月日
          ctx.fillText(bDate.year, W * 0.440, y);
          ctx.fillText(bDate.month, W * 0.478, y);
          ctx.fillText(bDate.day, W * 0.512, y);

          // チェックボックス（老人・特定扶養）
          ctx.fillStyle = '#2563eb';
          if (dep.isElderly) {
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('✓', W * 0.536, y - H * 0.012);
          }
          if (dep.isSpecific) {
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('✓', W * 0.536, y + H * 0.010);
          }
          ctx.fillStyle = '#0f172a';

          // 所得見積額
          ctx.textAlign = 'right';
          ctx.fillText(`${(dep.incomeEstimate || 0).toLocaleString()} 円`, W * 0.582, y);
          ctx.textAlign = 'left';

          // 生計一 ＆ 住所
          ctx.font = '17px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.isLivingTogether !== false ? '同居' : '別居', W * 0.615, y);
          ctx.fillText(dep.address || data.employeeAddress, W * 0.685, y);
        });

        // ─────────────────────────────────────────────────────────────────
        // Ｃ. 障害者、寡婦、ひとり親又は勤労学生
        // ─────────────────────────────────────────────────────────────────
        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 22px sans-serif';
        if (data.isDisability) ctx.fillText('✓', W * 0.142, H * 0.678);
        if (data.isWidow) ctx.fillText('✓', W * 0.368, H * 0.678);
        if (data.isSingleParent) ctx.fillText('✓', W * 0.408, H * 0.678);
        if (data.isWorkingStudent) ctx.fillText('✓', W * 0.458, H * 0.678);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px "Noto Sans JP", sans-serif';
        if (data.disabilityDetails) {
          ctx.fillText(data.disabilityDetails, W * 0.530, H * 0.682);
        } else if (data.isWorkingStudent) {
          ctx.fillText(`学校: ${data.workingStudentSchool || '〇〇大学'}`, W * 0.530, H * 0.682);
        }

        // ─────────────────────────────────────────────────────────────────
        // 住民税に関する事項（16歳未満の扶養親族 2名分）
        // ─────────────────────────────────────────────────────────────────
        const u16YOffsets = [0.865, 0.910];
        const u16KanaYOffsets = [0.848, 0.892];

        u16Rows.forEach((dep, idx) => {
          if (!dep) return;
          const y = H * u16YOffsets[idx];
          const yk = H * u16KanaYOffsets[idx];
          const bDate = parseJapaneseEraDate(dep.birthDate);

          ctx.font = '14px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.nameKana || '', W * 0.185, yk);

          ctx.font = 'bold 22px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.name, W * 0.185, y);

          ctx.font = 'bold 18px "Courier New", monospace';
          ctx.fillText(dep.myNumber || '************', W * 0.285, y);

          ctx.font = 'bold 20px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.relation, W * 0.365, y);

          ctx.fillText(bDate.year, W * 0.440, y);
          ctx.fillText(bDate.month, W * 0.478, y);
          ctx.fillText(bDate.day, W * 0.512, y);

          ctx.font = '17px "Noto Sans JP", sans-serif';
          ctx.fillText(dep.address || data.employeeAddress, W * 0.560, y);

          ctx.textAlign = 'right';
          ctx.fillText('0 円', W * 0.780, y);
          ctx.textAlign = 'left';
        });

        // 画像URLを生成してセット
        const url = canvas.toDataURL('image/png');
        setCanvasUrl(url);
        setIsRendering(false);
      } catch (err) {
        console.error('PDF Canvas Render Error:', err);
        setIsRendering(false);
      }
    };

    renderPdfWithData();

    return () => {
      isCancelled = true;
    };
  }, [data]);

  return (
    <div className="w-full bg-slate-200/60 py-3 print:bg-white print:py-0 select-text font-sans">
      {/* 🖨️ 印刷用CSS設定（A4横向き・国税庁原本に完全準拠） */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-sheet {
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            object-fit: contain !important;
          }
        }
      `}</style>

      {/* 🧭 画面操作ツールバー（国税庁原本印字ビュー・PDFダウンロード・印刷） */}
      <div className="max-w-[1120px] mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 px-3 no-print">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-xs border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('canvas_doc')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'canvas_doc'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            ① 国税庁公式原本 データ直接印字ビュー（そのまま提出可能）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pdf_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pdf_view'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            ② 入力用PDF原本（2026bun_01）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'guide_view'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ③ 裏面手引き（控除要件）
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/2026bun_01.pdf"
            download="令和8年分_給与所得者の扶養控除等申告書_国税庁原本.pdf"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="国税庁公式の入力用原本PDFをダウンロード"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            原本PDF保存
          </a>

          <button
            type="button"
            onClick={() => {
              setActiveTab('canvas_doc');
              setTimeout(() => window.print(), 150);
            }}
            className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            そのままA4印刷（提出用）
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ① 国税庁公式原本 データ直接印字ビュー（マス目に文字が直接入った本物の申告書） */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'canvas_doc' && (
        <div className="max-w-[1120px] mx-auto bg-white p-3 rounded-2xl shadow-2xl border border-slate-300 print:p-0 print:border-none print:shadow-none">
          {isRendering && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-600">国税庁公式原本（2026bun_01）に文字を精密印字中...</p>
            </div>
          )}

          {/* 隠しCanvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* 印字済みの高精細画像（画面表示 ＆ A4印刷） */}
          {canvasUrl && (
            <div className="w-full overflow-x-auto">
              <img
                src={canvasUrl}
                alt="令和8年分 給与所得者の扶養控除等（異動）申告書"
                className="w-full h-auto rounded-lg border border-slate-200 print:border-none print:rounded-none print-full-sheet shadow-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ② 国税庁公式 入力用原本PDF インラインプレビュー */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pdf_view' && (
        <div className="max-w-[1120px] mx-auto bg-white p-4 rounded-2xl shadow-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">国税庁公式 令和8年分 扶養控除等（異動）申告書 入力用PDF原本</h3>
                <p className="text-xs text-slate-400">国税庁が配布している「2026bun_01.pdf」の原本ファイルです。</p>
              </div>
            </div>
            <a
              href="/2026bun_01.pdf"
              download="2026bun_01.pdf"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> PDF保存
            </a>
          </div>

          <div className="w-full h-[750px] border border-slate-300 rounded-xl overflow-hidden shadow-inner bg-slate-100">
            <iframe
              src="/2026bun_01.pdf#toolbar=1&navpanes=0&scrollbar=1"
              className="w-full h-full"
              title="国税庁原本PDFプレビュー"
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ③ 裏面手引き（控除要件・記入上の注意） */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'guide_view' && (
        <div className="max-w-[1120px] mx-auto bg-white p-5 rounded-2xl shadow-xl border border-slate-200 font-sans text-xs space-y-4">
          <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
            <h2 className="font-bold text-sm text-slate-800">
              給与所得者の扶養控除等（異動）申告書　裏面手引（令和８年分）
            </h2>
            <span className="text-[11px] text-slate-500 font-serif">国税庁 申告手引き</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[11px] leading-relaxed">
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                  １　申告についてのご注意
                </h3>
                <p className="text-slate-700">
                  (1) この申告書は、令和８年の最初の給与の支払を受ける日の前日までに、給与の支払者に提出してください。<br />
                  (2) ２か所以上から給与の支払を受け、１か所から受ける給与だけでは控除額の全額が控除しきれない場合には、「従たる給与についての扶養控除等申告書」を提出することができます。
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                  ２　記載についてのご注意
                </h3>
                <p className="text-slate-700 space-y-1">
                  (1) 「あなたの個人番号」欄には、あなたのマイナンバーを記載してください。<br />
                  (2) 「令和８年中の所得の見積額」欄には、収入金額から給与所得控除額等を差し引いた金額を記載してください。
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                ４　扶養親族等の範囲（令和８年分）
              </h3>
              <div className="space-y-1.5 text-slate-700">
                <div>
                  <strong className="text-slate-900">【同一生計配偶者】</strong> 所得者と生計を一にする配偶者で、所得見積額が58万円以下（給与のみの場合123万円以下）の人。
                </div>
                <div>
                  <strong className="text-slate-900">【源泉控除対象配偶者】</strong> 所得者（所得900万円以下）と生計を一にする配偶者で、所得見積額が95万円以下（給与のみの場合160万円以下）の人。
                </div>
                <div>
                  <strong className="text-slate-900">【控除対象扶養親族】</strong> 扶養親族のうち、年齢16歳以上の人（平成23年1月1日以前生まれ）。
                </div>
                <div>
                  <strong className="text-slate-900">【特定扶養親族】</strong> 控除対象扶養親族のうち、年齢19歳以上23歳未満の人（平成16年1月2日〜平成20年1月1日生まれ）。
                </div>
                <div>
                  <strong className="text-slate-900">【老人扶養親族】</strong> 控除対象扶養親族のうち、年齢70歳以上の人（昭和32年1月1日以前生まれ）。
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
