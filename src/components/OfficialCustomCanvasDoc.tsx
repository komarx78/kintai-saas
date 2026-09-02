import { useEffect, useRef, useState } from 'react';
import { type CustomDocTemplate, type CustomDocField } from '../lib/customDocManager';

export interface CustomDocRenderProps {
  template: CustomDocTemplate;
  employeeData: any;
  companyData: any;
  scale?: number;
}

// 和暦変換ヘルパー
const toWareki = (dateStr?: string) => {
  if (!dateStr) return { era: '令', year: '8', month: '1', day: '1', fullWareki: '令和8年1月1日' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { era: '令', year: '8', month: '1', day: '1', fullWareki: '令和8年1月1日' };
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  if (d >= new Date('2019-05-01')) {
    const wy = y - 2018;
    return { era: '令', year: wy === 1 ? '元' : String(wy), month: String(m), day: String(day), fullWareki: `令和${wy === 1 ? '元' : wy}年${m}月${day}日` };
  } else if (d >= new Date('1989-01-08')) {
    const wy = y - 1988;
    return { era: '平', year: wy === 1 ? '元' : String(wy), month: String(m), day: String(day), fullWareki: `平成${wy === 1 ? '元' : wy}年${m}月${day}日` };
  } else if (d >= new Date('1926-12-25')) {
    const wy = y - 1925;
    return { era: '昭', year: wy === 1 ? '元' : String(wy), month: String(m), day: String(day), fullWareki: `昭和${wy === 1 ? '元' : wy}年${m}月${day}日` };
  }
  return { era: '令', year: '8', month: '1', day: '1', fullWareki: '令和8年1月1日' };
};

export default function OfficialCustomCanvasDoc({ template, employeeData, companyData, scale = 2.5 }: CustomDocRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  // データ値の解決ヘルパー
  const resolveFieldValue = (field: CustomDocField): string => {
    const key = field.sourceKey;
    const emp = employeeData || {};
    const comp = companyData || {};
    const birthWareki = toWareki(emp.birth_date);
    const joinWareki = toWareki(emp.join_date);

    switch (key) {
      // 会社情報
      case 'company.name': return comp.name || '株式会社KAP';
      case 'company.address': return comp.address || '滋賀県大津市坂本3丁目21-16';
      case 'company.representative_name': return comp.representative_name || '代表取締役 駒井 秀一朗';
      case 'company.corporate_number': return comp.corporate_number || '1010001999999';
      case 'company.phone': return comp.phone || '';
      case 'company.tax_office_name': return comp.tax_office_name || '大津';
      case 'company.nenkin_office_name': return comp.nenkin_office_name || '大津年金事務所';

      // 従業員基本
      case 'employee.name': return emp.name || '従業員';
      case 'employee.name_kana': return emp.name_kana || '';
      case 'employee.birth_date_wareki_y': return birthWareki.year;
      case 'employee.birth_date_m': return birthWareki.month;
      case 'employee.birth_date_d': return birthWareki.day;
      case 'employee.birth_date_seireki': return emp.birth_date ? String(emp.birth_date).substring(0, 10) : '';
      case 'employee.address': return emp.address || '';
      case 'employee.postal_code': return emp.postal_code || '';
      case 'employee.phone': return emp.phone || '';
      case 'employee.householder_name': return emp.householder_name || emp.name || '';
      case 'employee.householder_relation': return emp.householder_relation || '本人';

      // マイナンバー・社保
      case 'employee.my_number': return emp.my_number ? emp.my_number.replace(/[^0-9]/g, '') : '************';
      case 'employee.pension_number': return emp.pension_number || '';
      case 'employee.employment_insurance_number': return emp.employment_insurance_number || '';

      // 雇用・給与・口座
      case 'employee.join_date_wareki': return joinWareki.fullWareki;
      case 'employee.join_date_seireki': return emp.join_date ? String(emp.join_date).substring(0, 10) : '';
      case 'employee.department': return emp.department || '営業部';
      case 'employee.position_name': return emp.position_name || '';
      case 'employee.base_salary': return emp.base_salary ? `¥${Number(emp.base_salary).toLocaleString()}` : '';
      case 'employee.hourly_wage': return emp.hourly_wage ? `¥${Number(emp.hourly_wage).toLocaleString()}` : '';
      case 'employee.bank_name': return emp.bank_name || '';
      case 'employee.branch_name': return emp.branch_name || '';
      case 'employee.account_type': return emp.account_type === 'current' ? '当座' : '普通';
      case 'employee.account_number': return emp.account_number || '';
      case 'employee.account_holder': return emp.account_holder || emp.name || '';

      // 配偶者・扶養
      case 'employee.spouse_name': return emp.spouse_name || '';
      case 'employee.spouse_name_kana': return emp.spouse_name_kana || '';
      case 'employee.spouse_birth_date': return emp.spouse_birth_date ? String(emp.spouse_birth_date).substring(0, 10) : '';
      case 'employee.spouse_income_estimate': return emp.spouse_income_estimate ? `¥${Number(emp.spouse_income_estimate).toLocaleString()}` : '';
      case 'employee.dependents_count': return emp.dependents_count !== undefined ? `${emp.dependents_count}名` : '0名';
      case 'employee.dep1_name': return emp.dependents?.[0]?.name || '';
      case 'employee.dep1_relation': return emp.dependents?.[0]?.relation || '';
      case 'employee.dep1_birth_date': return emp.dependents?.[0]?.birthDate || '';
      case 'employee.dep2_name': return emp.dependents?.[1]?.name || '';
      case 'employee.dep2_relation': return emp.dependents?.[1]?.relation || '';
      case 'employee.dep2_birth_date': return emp.dependents?.[1]?.birthDate || '';

      // 汎用
      case 'static.text': return field.label || '';
      default: return '';
    }
  };

  useEffect(() => {
    let isCancelled = false;

    const renderPdfCanvas = async () => {
      setIsRendering(true);
      try {
        // @ts-ignore
        if (!window.pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          document.head.appendChild(script);
          await new Promise(res => { script.onload = res; });
        }
        // @ts-ignore
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        let pdfDoc: any = null;
        if (template.pdfDataUrl) {
          const loadingTask = pdfjsLib.getDocument(template.pdfDataUrl);
          pdfDoc = await loadingTask.promise;
        }

        if (!pdfDoc) return;
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. PDF背景原本を描画
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (isCancelled) return;

        // フォント待機
        if (document.fonts) await document.fonts.ready;

        const W = canvas.width;
        const H = canvas.height;

        // 2. カスタムフィールドの自動印字
        template.fields.forEach(f => {
          const fontSizePx = Math.max(10, Math.round((f.fontSize * 0.115 / 100) * W));
          const textValue = resolveFieldValue(f);

          if (f.type === 'circle') {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = Math.max(2, Math.round(W * 0.0008));
            const radius = (1.4 / 100 * W) * 0.5;
            ctx.beginPath();
            ctx.arc((f.x / 100) * W + radius, (f.y / 100) * H, radius, 0, Math.PI * 2);
            ctx.stroke();
          } else if (f.type === 'check') {
            ctx.fillStyle = '#2563eb';
            ctx.font = `bold ${fontSizePx}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', (f.x / 100) * W, (f.y / 100) * H);
          } else if (f.type === 'pitch_text' && f.pitch) {
            ctx.fillStyle = '#0f172a';
            ctx.font = `bold ${fontSizePx}px "Courier New", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const pitchPx = (f.pitch / 100) * W;
            for (let i = 0; i < textValue.length; i++) {
              const cx = (f.x / 100) * W + i * pitchPx + pitchPx * 0.5;
              ctx.fillText(textValue[i], cx, (f.y / 100) * H);
            }
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.font = `bold ${fontSizePx}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(textValue, (f.x / 100) * W, (f.y / 100) * H);
          }
        });

      } catch (err) {
        console.error('Custom Canvas Doc Render error:', err);
      } finally {
        if (!isCancelled) setIsRendering(false);
      }
    };

    renderPdfCanvas();
    return () => { isCancelled = true; };
  }, [template, employeeData, companyData, scale]);

  return (
    <div className="relative flex justify-center items-center bg-slate-900/5 p-4 rounded-2xl border border-slate-200 overflow-auto">
      {isRendering && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs bg-white px-4 py-2 rounded-full shadow-lg border border-indigo-100">
            <span className="animate-spin text-sm">⏳</span> 高精細原本Canvasを生成中...
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="max-w-full h-auto shadow-2xl rounded-sm border border-slate-300 bg-white print:shadow-none print:border-none print:max-w-none" />
    </div>
  );
}
