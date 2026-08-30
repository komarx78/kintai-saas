import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Printer, Download, Eye, CheckCircle2, Loader2, Sparkles, FileText } from 'lucide-react';
import { TAX_DOC_DEFAULT_MAP } from '../lib/taxDocCoordinates';

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
      if (y >= 2019) return { era: '令', year: String(y - 2018), month: parts[1], day: parts[2] };
      if (y >= 1989) return { era: '平', year: String(y - 1988), month: parts[1], day: parts[2] };
      if (y >= 1926) return { era: '昭', year: String(y - 1925), month: parts[1], day: parts[2] };
    }
    return { era: '令', year: ' ', month: ' ', day: ' ' };
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1);
  const day = String(d.getDate());
  if (y >= 2019) return { era: '令', year: String(y - 2018 === 1 ? '元' : y - 2018), month: m, day };
  if (y >= 1989) return { era: '平', year: String(y - 1988 === 1 ? '元' : y - 1988), month: m, day };
  if (y >= 1926) return { era: '昭', year: String(y - 1925 === 1 ? '元' : y - 1925), month: m, day };
  return { era: '明', year: String(y - 1867), month: m, day };
}

export const OfficialTaxExemptionDoc: React.FC<TaxExemptionDocProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'canvas_doc' | 'pdf_view' | 'guide_view'>('canvas_doc');
  const [isRendering, setIsRendering] = useState(true);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const under16Dependents = (data.dependents || []).filter(d => d.isUnder16);
  const regularDependents = (data.dependents || []).filter(d => !d.isUnder16);
  const empBirth = parseJapaneseEraDate(data.birthDate);
  const spouseBirth = parseJapaneseEraDate(data.spouseBirthDate);

  /**
   * 販売者マスタ設定（localStorage / システムマスタ）を読み込んで国税庁PDF原本に直接精密印字
   */
  useEffect(() => {
    let isCancelled = false;

    const renderCanvas = async () => {
      setIsRendering(true);
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

        // 国税庁原本PDF（2026bun_01.pdf）をロード
        const loadingTask = pdfjsLib.getDocument('/2026bun_01.pdf');
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const scale = 2.5; // 高精細A4印刷解像度（幅約3000px）
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. 国税庁PDF原本の下敷きを描画
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (isCancelled) return;

        // フォントのロード完了を確実に待機（Canvasの文字ズレ・代替フォント化を完全防止）
        if (document.fonts) {
          await document.fonts.ready;
        }

        const W = canvas.width;
        const H = canvas.height;

        // 2. 販売者マスター設定（カスタマイズ座標）の読み込み（localStorage優先で即時反映）
        let masterMap: Record<string, { x: number; y: number; fontSize: number; pitch?: number }> = {};
        try {
          // まずローカルストレージの最新編集を確認
          const saved = localStorage.getItem('taxDocMasterFields');
          let parsed: any[] | null = saved ? JSON.parse(saved) : null;

          // なければSupabase全社マスタを確認
          if (!parsed) {
            const { data: sysSettings } = await supabase.from('system_settings').select('tax_doc_coordinates').limit(1).single();
            parsed = sysSettings?.tax_doc_coordinates || null;
          }

          if (parsed && Array.isArray(parsed)) {
            parsed.forEach((f: any) => {
              masterMap[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize, pitch: f.pitch };
            });
          }
        } catch (_) {}

        // フォールバック関数（マスター設定・プレビューと100%同一の計算式）
        const getField = (id: string) => {
          const custom = masterMap[id];
          const def = TAX_DOC_DEFAULT_MAP.get(id);
          const x = custom ? custom.x : (def ? def.x : 0);
          const y = custom ? custom.y : (def ? def.y : 0);
          const fontSize = custom ? custom.fontSize : (def ? def.fontSize : 10);
          const pitch = custom && custom.pitch !== undefined ? custom.pitch : (def ? def.pitch : undefined);

          return {
            x: x / 100, // 0.0〜1.0 (CanvasのW, Hに対する比率)
            y: y / 100,
            fontSizePt: fontSize,
            fontSizePx: Math.max(10, Math.round((fontSize * 0.115 / 100) * W)), // マスター画面の fontSize * 0.115 cqw と完全同一！
            pitch: pitch ? pitch / 100 : undefined
          };
        };

        // マス目数字（マイナンバー・法人番号など）をマスタープレビューと100%同じ中央寄せピッチで印字
        const renderPitchText = (text: string, f: ReturnType<typeof getField>, fontStyle: string = '"Courier New", monospace') => {
          ctx.font = `bold ${f.fontSizePx}px ${fontStyle}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const pitchPx = (f.pitch || 0.018) * W;
          for (let i = 0; i < text.length; i++) {
            const cx = W * f.x + i * pitchPx + pitchPx * 0.5;
            ctx.fillText(text[i], cx, H * f.y);
          }
        };

        // 通常テキスト印字
        const renderText = (text: string, f: ReturnType<typeof getField>, align: 'left' | 'right' | 'center' = 'left', isBold: boolean = true, fontFamily: string = '"Noto Sans JP", sans-serif') => {
          ctx.font = `${isBold ? 'bold ' : ''}${f.fontSizePx}px ${fontFamily}`;
          ctx.textAlign = align;
          ctx.textBaseline = 'middle';
          ctx.fillText(text, W * f.x, H * f.y);
        };

        ctx.fillStyle = '#0f172a';

        // 🏢 給与支払者
        renderText(data.taxOfficeName || '千代田', getField('taxOffice'));
        renderText(data.municipalityName || '千代田区', getField('municipality'));
        renderText(data.companyName || '株式会社KAP', getField('companyName'));
        
        const corpNumStr = (data.corporateNumber || '1010001999999').replace(/[^0-9]/g, '').padEnd(13, ' ').slice(0, 13);
        renderPitchText(corpNumStr, getField('corporateNumber'));
        
        renderText(data.companyAddress || '本社所在地', getField('companyAddress'));

        // 👤 申告者本人
        renderText(data.employeeNameKana || 'テスト タロウ', getField('empKana'), 'left', false);
        renderText(data.employeeName || '駒井 秀一朗', getField('empName'), 'left', true);

        // 12桁マイナンバーマス目
        const myNumStr = data.myNumber ? data.myNumber.replace(/[^0-9]/g, '') : '123456789012';
        renderPitchText(myNumStr, getField('empMyNumber'));

        // 住所・郵便番号
        renderText(data.postalCode || '160-0023', getField('empPostal'));
        renderText(data.employeeAddress || '京都市山科区大塚西浦町3-57', getField('empAddress'));

        // 生年月日
        renderText(empBirth.year, getField('empBirthY'));
        renderText(empBirth.month, getField('empBirthM'));
        renderText(empBirth.day, getField('empBirthD'));

        // 世帯主・続柄
        renderText(data.householderName || data.employeeName || '駒井 秀一朗', getField('householderName'));
        renderText(data.householderRelation || '本人', getField('householderRel'));

        // 配偶者有無（○印）
        if (data.hasSpouse) {
          const fSpCircle = getField('hasSpouseYes');
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = Math.max(2, Math.round(W * 0.0008));
          const radius = (1.4 / 100 * W) * 0.5;
          ctx.beginPath();
          ctx.arc(W * fSpCircle.x + radius, H * fSpCircle.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Ａ. 源泉控除対象配偶者
        if (data.hasSpouse && data.spouseName) {
          renderText(data.spouseNameKana || '', getField('spouseKana'), 'left', false);
          renderText(data.spouseName, getField('spouseName'));
          
          const spNumStr = data.spouseMyNumber ? data.spouseMyNumber.replace(/[^0-9]/g, '') : '************';
          renderPitchText(spNumStr, getField('spouseMyNumber'));

          renderText(spouseBirth.year, getField('spouseBirthY'));
          renderText(spouseBirth.month, getField('spouseBirthM'));
          renderText(spouseBirth.day, getField('spouseBirthD'));

          renderText(`${(data.spouseIncomeEstimate || 0).toLocaleString()}`, getField('spouseIncome'), 'right');
          renderText(data.spouseIsLivingTogether !== false ? '同居' : '別居', getField('spouseLiving'), 'left', false);
          renderText(data.spouseAddress || data.employeeAddress || '', getField('spouseAddress'), 'left', false);
        }

        // Ｂ. 控除対象扶養親族（1人目〜4人目 フル対応）
        regularDependents.slice(0, 4).forEach((dep, idx) => {
          if (!dep) return;
          const bDate = parseJapaneseEraDate(dep.birthDate);
          
          renderText(dep.nameKana || '', getField(`dep${idx}Kana`), 'left', false);
          renderText(dep.name, getField(`dep${idx}Name`));

          const depNumStr = dep.myNumber ? dep.myNumber.replace(/[^0-9]/g, '') : '************';
          renderPitchText(depNumStr, getField(`dep${idx}MyNumber`));

          renderText(dep.relation || '', getField(`dep${idx}Rel`));
          renderText(bDate.year, getField(`dep${idx}BirthY`));
          renderText(bDate.month, getField(`dep${idx}BirthM`));
          renderText(bDate.day, getField(`dep${idx}BirthD`));

          renderText(`${(dep.incomeEstimate || 0).toLocaleString()}`, getField(`dep${idx}Income`), 'right');
          renderText(dep.isLivingTogether !== false ? '同居' : (dep.livingTogetherFact || '別居'), getField(`dep${idx}Living`), 'left', false);
          renderText(dep.address || data.employeeAddress || '', getField(`dep${idx}Address`), 'left', false);
        });

        // Ｃ. 障害者等
        ctx.fillStyle = '#2563eb';
        if (data.isDisability) renderText('✓', getField('specialDisabled'), 'left', true, 'sans-serif');
        if (data.isWidow) renderText('✓', getField('specialWidow'), 'left', true, 'sans-serif');
        if (data.isSingleParent) renderText('✓', getField('specialSingle'), 'left', true, 'sans-serif');
        if (data.isWorkingStudent) renderText('✓', getField('specialStudent'), 'left', true, 'sans-serif');

        ctx.fillStyle = '#0f172a';
        if (data.disabilityDetails) {
          renderText(data.disabilityDetails, getField('specialDetails'));
        } else if (data.isWorkingStudent) {
          renderText(`学校: ${data.workingStudentSchool || '〇〇大学'}`, getField('specialDetails'));
        }

        // 住民税（16歳未満 1人目〜2人目 原本枠準拠）
        under16Dependents.slice(0, 2).forEach((uDep, idx) => {
          if (!uDep) return;
          const ubDate = parseJapaneseEraDate(uDep.birthDate);

          renderText(uDep.nameKana || '', getField(`u16_${idx}Kana`), 'left', false);
          renderText(uDep.name, getField(`u16_${idx}Name`));

          const uNumStr = uDep.myNumber ? uDep.myNumber.replace(/[^0-9]/g, '') : '************';
          renderPitchText(uNumStr, getField(`u16_${idx}MyNumber`));

          renderText(uDep.relation || '', getField(`u16_${idx}Rel`));
          renderText(ubDate.year, getField(`u16_${idx}BirthY`));
          renderText(ubDate.month, getField(`u16_${idx}BirthM`));
          renderText(ubDate.day, getField(`u16_${idx}BirthD`));

          renderText(uDep.address || data.employeeAddress || '', getField(`u16_${idx}Address`), 'left', false);
          renderText(`${(uDep.incomeEstimate || 0).toLocaleString()}`, getField(`u16_${idx}Income`), 'right');
        });

        const url = canvas.toDataURL('image/png');
        setCanvasUrl(url);
        setIsRendering(false);
      } catch (err) {
        console.error('PDF Render Error:', err);
        setIsRendering(false);
      }
    };

    renderCanvas();
    return () => { isCancelled = true; };
  }, [data]);

  return (
    <div className="w-full bg-slate-100 py-3 print:bg-white print:py-0 select-text font-sans">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: white !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-sheet { width: 100vw !important; height: 100vh !important; margin: 0 !important; border: none !important; }
        }
      `}</style>

      {/* 🧭 トップツールバー */}
      <div className="max-w-[1150px] mx-auto mb-3 flex flex-wrap items-center justify-between gap-2 px-2 no-print">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-xs border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('canvas_doc')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'canvas_doc' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            ① 令和8年分 扶養控除等申告書（提出用プレビュー）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pdf_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pdf_view' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            ② 国税庁原本PDF（2026bun_01）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'guide_view' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            ③ 裏面手引き
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/2026bun_01.pdf"
            download="令和8年分_給与所得者の扶養控除等申告書_国税庁原本.pdf"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
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

      {/* 📄 ① 国税庁公式原本 データ直接印字ビュー */}
      {activeTab === 'canvas_doc' && (
        <div className="max-w-[1150px] mx-auto bg-white p-3 rounded-2xl shadow-2xl border border-slate-300 print:p-0 print:border-none print:shadow-none">
          {isRendering && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-600">国税庁公式原本（2026bun_01）に高精細印字中...</p>
            </div>
          )}

          {/* 隠しCanvas */}
          <canvas ref={canvasRef} className="hidden" />

          {canvasUrl && (
            <div className="w-full overflow-x-auto">
              <img
                src={canvasUrl}
                alt="令和8年分 給与所得者の扶養控除等（異動）申告書"
                className="w-full h-auto rounded-lg border border-slate-200 print:border-none print:rounded-none print-sheet shadow-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* 📄 ② 国税庁原本PDF */}
      {activeTab === 'pdf_view' && (
        <div className="max-w-[1150px] mx-auto bg-white p-4 rounded-2xl shadow-xl border border-slate-200 space-y-3 no-print">
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

      {/* 📄 ③ 裏面手引き */}
      {activeTab === 'guide_view' && (
        <div className="max-w-[1150px] mx-auto bg-white p-5 rounded-2xl shadow-xl border border-slate-200 font-sans text-xs space-y-4 no-print">
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
