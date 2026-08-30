import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, Eye, CheckCircle2, Loader2, Sparkles, FileText } from 'lucide-react';
import { TAX_DOC_2026_COORDINATES as DEFAULT_POS } from '../lib/taxDocCoordinates';

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

        const W = canvas.width;
        const H = canvas.height;

        // 2. 販売者マスター設定（カスタマイズ座標）の読み込み
        let masterMap: Record<string, { x: number; y: number; fontSize: number; pitch?: number }> = {};
        try {
          const saved = localStorage.getItem('taxDocMasterFields');
          if (saved) {
            const parsed = JSON.parse(saved);
            parsed.forEach((f: any) => {
              masterMap[f.id] = { x: f.x, y: f.y, fontSize: f.fontSize, pitch: f.pitch };
            });
          }
        } catch (_) {}

        // フォールバック関数（マスター設定と100%同一のフォントサイズ比率）
        const getField = (id: string, defX: number, defY: number, defSize: number, defPitch?: number) => {
          if (masterMap[id]) {
            return {
              x: masterMap[id].x / 100,
              y: masterMap[id].y / 100,
              size: Math.max(10, Math.round((masterMap[id].fontSize / 1000) * W * 1.05)),
              pitch: masterMap[id].pitch ? masterMap[id].pitch / 100 : defPitch
            };
          }
          return {
            x: defX,
            y: defY,
            size: Math.max(10, Math.round((defSize / 1000) * W * 1.05)),
            pitch: defPitch
          };
        };

        ctx.fillStyle = '#0f172a';
        ctx.textBaseline = 'middle';

        // 🏢 給与支払者
        const fTaxOffice = getField('taxOffice', DEFAULT_POS.header.taxOffice.x, DEFAULT_POS.header.taxOffice.y, 18);
        ctx.font = `bold ${fTaxOffice.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.taxOfficeName || '千代田', W * fTaxOffice.x, H * fTaxOffice.y);

        const fMunicipality = getField('municipality', DEFAULT_POS.header.municipality.x, DEFAULT_POS.header.municipality.y, 18);
        ctx.font = `bold ${fMunicipality.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.municipalityName || '千代田区', W * fMunicipality.x, H * fMunicipality.y);

        const fCompany = getField('companyName', DEFAULT_POS.header.companyName.x, DEFAULT_POS.header.companyName.y, 22);
        ctx.font = `bold ${fCompany.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.companyName, W * fCompany.x, H * fCompany.y);

        const fCorpNum = getField('corporateNumber', DEFAULT_POS.header.corporateNumber.x, DEFAULT_POS.header.corporateNumber.y, 20);
        ctx.font = `bold ${fCorpNum.size}px "Courier New", monospace`;
        ctx.fillText(data.corporateNumber || '1010001999999', W * fCorpNum.x, H * fCorpNum.y);

        const fCompAddr = getField('companyAddress', DEFAULT_POS.header.companyAddress.x, DEFAULT_POS.header.companyAddress.y, 16);
        ctx.font = `bold ${fCompAddr.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.companyAddress || '本社所在地', W * fCompAddr.x, H * fCompAddr.y);

        // 👤 申告者本人
        const fEmpKana = getField('empKana', DEFAULT_POS.header.empKana.x, DEFAULT_POS.header.empKana.y, 14);
        ctx.font = `${fEmpKana.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.employeeNameKana || 'テスト', W * fEmpKana.x, H * fEmpKana.y);

        const fEmpName = getField('empName', DEFAULT_POS.header.empName.x, DEFAULT_POS.header.empName.y, 28);
        ctx.font = `900 ${fEmpName.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.employeeName, W * fEmpName.x, H * fEmpName.y);

        // 12桁マイナンバーマス目
        const fMyNum = getField('empMyNumber', DEFAULT_POS.header.empMyNumberStart.x, DEFAULT_POS.header.empMyNumberStart.y, 20, DEFAULT_POS.header.empMyNumberStart.pitch);
        const myNumStr = data.myNumber ? data.myNumber.replace(/[^0-9]/g, '') : '123456789012';
        ctx.font = `bold ${fMyNum.size}px "Courier New", monospace`;
        const numPitch = W * (fMyNum.pitch || DEFAULT_POS.header.empMyNumberStart.pitch);
        for (let i = 0; i < 12; i++) {
          ctx.fillText(myNumStr[i] || '*', W * fMyNum.x + i * numPitch, H * fMyNum.y);
        }

        // 住所・郵便番号
        const fPostal = getField('empPostal', DEFAULT_POS.header.empPostal.x, DEFAULT_POS.header.empPostal.y, 16);
        ctx.font = `bold ${fPostal.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.postalCode || '160-0023', W * fPostal.x, H * fPostal.y);

        const fAddress = getField('empAddress', DEFAULT_POS.header.empAddress.x, DEFAULT_POS.header.empAddress.y, 17);
        ctx.font = `bold ${fAddress.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(data.employeeAddress, W * fAddress.x, H * fAddress.y);

        // 生年月日
        const fBirthY = getField('empBirthY', DEFAULT_POS.header.empBirthY.x, DEFAULT_POS.header.empBirthY.y, 18);
        ctx.font = `bold ${fBirthY.size}px "Noto Sans JP", sans-serif`;
        ctx.fillText(empBirth.year, W * fBirthY.x, H * fBirthY.y);

        const fBirthM = getField('empBirthM', DEFAULT_POS.header.empBirthM.x, DEFAULT_POS.header.empBirthM.y, 18);
        ctx.fillText(empBirth.month, W * fBirthM.x, H * fBirthM.y);

        const fBirthD = getField('empBirthD', DEFAULT_POS.header.empBirthD.x, DEFAULT_POS.header.empBirthD.y, 18);
        ctx.fillText(empBirth.day, W * fBirthD.x, H * fBirthD.y);

        // 世帯主・続柄
        const fHouseName = getField('householderName', DEFAULT_POS.header.householderName.x, DEFAULT_POS.header.householderName.y, 18);
        ctx.fillText(data.householderName || data.employeeName, W * fHouseName.x, H * fHouseName.y);

        const fHouseRel = getField('householderRel', DEFAULT_POS.header.householderRel.x, DEFAULT_POS.header.householderRel.y, 18);
        ctx.fillText(data.householderRelation || '本人', W * fHouseRel.x, H * fHouseRel.y);

        // 配偶者有無（○印）
        const fSpouseCircle = getField('hasSpouseYes', DEFAULT_POS.header.hasSpouseYes.x, DEFAULT_POS.header.hasSpouseYes.y, 18);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.5;
        if (data.hasSpouse) {
          ctx.beginPath();
          ctx.arc(W * fSpouseCircle.x, H * fSpouseCircle.y, 12, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const fSpouseNo = getField('hasSpouseNo', DEFAULT_POS.header.hasSpouseNo.x, DEFAULT_POS.header.hasSpouseNo.y, 18);
          ctx.beginPath();
          ctx.arc(W * fSpouseNo.x, H * fSpouseNo.y, 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Ａ. 源泉控除対象配偶者
        if (data.hasSpouse && data.spouseName) {
          const fSpKana = getField('spouseKana', DEFAULT_POS.spouse.kana.x, DEFAULT_POS.spouse.kana.y, 13);
          ctx.font = `${fSpKana.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(data.spouseNameKana || '', W * fSpKana.x, H * fSpKana.y);

          const fSpName = getField('spouseName', DEFAULT_POS.spouse.name.x, DEFAULT_POS.spouse.name.y, 20);
          ctx.font = `bold ${fSpName.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(data.spouseName, W * fSpName.x, H * fSpName.y);

          const fSpMyNum = getField('spouseMyNumber', DEFAULT_POS.spouse.myNumberStart.x, DEFAULT_POS.spouse.myNumberStart.y, 16, DEFAULT_POS.spouse.myNumberStart.pitch);
          const spNumStr = data.spouseMyNumber ? data.spouseMyNumber.replace(/[^0-9]/g, '') : '************';
          ctx.font = `bold ${fSpMyNum.size}px "Courier New", monospace`;
          const spNumPitch = W * (fSpMyNum.pitch || DEFAULT_POS.spouse.myNumberStart.pitch);
          for (let i = 0; i < 12; i++) {
            ctx.fillText(spNumStr[i] || '*', W * fSpMyNum.x + i * spNumPitch, H * fSpMyNum.y);
          }

          const fSpRel = getField('spouseRel', DEFAULT_POS.spouse.relation.x, DEFAULT_POS.spouse.relation.y, 18);
          ctx.font = `bold ${fSpRel.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText('妻', W * fSpRel.x, H * fSpRel.y);

          const fSpBirthY = getField('spouseBirthY', DEFAULT_POS.spouse.birthY.x, DEFAULT_POS.spouse.birthY.y, 18);
          ctx.fillText(spouseBirth.year, W * fSpBirthY.x, H * fSpBirthY.y);

          const fSpBirthM = getField('spouseBirthM', DEFAULT_POS.spouse.birthM.x, DEFAULT_POS.spouse.birthM.y, 18);
          ctx.fillText(spouseBirth.month, W * fSpBirthM.x, H * fSpBirthM.y);

          const fSpBirthD = getField('spouseBirthD', DEFAULT_POS.spouse.birthD.x, DEFAULT_POS.spouse.birthD.y, 18);
          ctx.fillText(spouseBirth.day, W * fSpBirthD.x, H * fSpBirthD.y);

          const fSpIncome = getField('spouseIncome', DEFAULT_POS.spouse.income.x, DEFAULT_POS.spouse.income.y, 17);
          ctx.textAlign = 'right';
          ctx.fillText(`${(data.spouseIncomeEstimate || 0).toLocaleString()} 円`, W * fSpIncome.x, H * fSpIncome.y);
          ctx.textAlign = 'left';

          const fSpLiving = getField('spouseLiving', DEFAULT_POS.spouse.livingFact.x, DEFAULT_POS.spouse.livingFact.y, 15);
          ctx.font = `${fSpLiving.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(data.spouseIsLivingTogether !== false ? '同居' : '別居', W * fSpLiving.x, H * fSpLiving.y);

          const fSpAddr = getField('spouseAddress', DEFAULT_POS.spouse.address.x, DEFAULT_POS.spouse.address.y, 15);
          ctx.fillText(data.spouseAddress || data.employeeAddress, W * fSpAddr.x, H * fSpAddr.y);
        }

        // Ｂ. 控除対象扶養親族（1人目）
        if (regularDependents[0]) {
          const dep = regularDependents[0];
          const bDate = parseJapaneseEraDate(dep.birthDate);

          const fDep0Kana = getField('dep0Kana', DEFAULT_POS.depCols.kanaX, DEFAULT_POS.dependents[0].kanaY, 13);
          ctx.font = `${fDep0Kana.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(dep.nameKana || '', W * fDep0Kana.x, H * fDep0Kana.y);

          const fDep0Name = getField('dep0Name', DEFAULT_POS.depCols.nameX, DEFAULT_POS.dependents[0].rowY, 19);
          ctx.font = `bold ${fDep0Name.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(dep.name, W * fDep0Name.x, H * fDep0Name.y);

          const fDep0Num = getField('dep0MyNumber', DEFAULT_POS.depCols.myNumStartX, DEFAULT_POS.dependents[0].rowY, 16, DEFAULT_POS.depCols.myNumPitch);
          const depNumStr = dep.myNumber ? dep.myNumber.replace(/[^0-9]/g, '') : '************';
          ctx.font = `bold ${fDep0Num.size}px "Courier New", monospace`;
          const depPitch = W * (fDep0Num.pitch || DEFAULT_POS.depCols.myNumPitch);
          for (let i = 0; i < 12; i++) {
            ctx.fillText(depNumStr[i] || '*', W * fDep0Num.x + i * depPitch, H * fDep0Num.y);
          }

          const fDep0Rel = getField('dep0Rel', DEFAULT_POS.depCols.relationX, DEFAULT_POS.dependents[0].rowY, 17);
          ctx.font = `bold ${fDep0Rel.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(dep.relation, W * fDep0Rel.x, H * fDep0Rel.y);

          const fDep0BirthY = getField('dep0BirthY', DEFAULT_POS.depCols.birthYX, DEFAULT_POS.dependents[0].rowY, 17);
          ctx.fillText(bDate.year, W * fDep0BirthY.x, H * fDep0BirthY.y);

          const fDep0BirthM = getField('dep0BirthM', DEFAULT_POS.depCols.birthMX, DEFAULT_POS.dependents[0].rowY, 17);
          ctx.fillText(bDate.month, W * fDep0BirthM.x, H * fDep0BirthM.y);

          const fDep0BirthD = getField('dep0BirthD', DEFAULT_POS.depCols.birthDX, DEFAULT_POS.dependents[0].rowY, 17);
          ctx.fillText(bDate.day, W * fDep0BirthD.x, H * fDep0BirthD.y);

          const fDep0Income = getField('dep0Income', DEFAULT_POS.depCols.incomeX, DEFAULT_POS.dependents[0].rowY, 17);
          ctx.textAlign = 'right';
          ctx.fillText(`${(dep.incomeEstimate || 0).toLocaleString()} 円`, W * fDep0Income.x, H * fDep0Income.y);
          ctx.textAlign = 'left';

          const fDep0Living = getField('dep0Living', DEFAULT_POS.depCols.livingFactX, DEFAULT_POS.dependents[0].rowY, 15);
          ctx.font = `${fDep0Living.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(dep.isLivingTogether !== false ? '同居' : (dep.livingTogetherFact || '別居'), W * fDep0Living.x, H * fDep0Living.y);

          const fDep0Addr = getField('dep0Address', DEFAULT_POS.depCols.addressX, DEFAULT_POS.dependents[0].rowY, 15);
          ctx.fillText(dep.address || data.employeeAddress, W * fDep0Addr.x, H * fDep0Addr.y);
        }

        // Ｃ. 障害者等
        const fSpecDis = getField('specialDisabled', DEFAULT_POS.special.checkDisabled.x, DEFAULT_POS.special.checkDisabled.y, 20);
        ctx.fillStyle = '#2563eb';
        ctx.font = `bold ${fSpecDis.size}px sans-serif`;
        if (data.isDisability) ctx.fillText('✓', W * fSpecDis.x, H * fSpecDis.y);

        const fSpecWidow = getField('specialWidow', DEFAULT_POS.special.checkWidow.x, DEFAULT_POS.special.checkWidow.y, 20);
        if (data.isWidow) ctx.fillText('✓', W * fSpecWidow.x, H * fSpecWidow.y);

        const fSpecSingle = getField('specialSingle', DEFAULT_POS.special.checkSingleParent.x, DEFAULT_POS.special.checkSingleParent.y, 20);
        if (data.isSingleParent) ctx.fillText('✓', W * fSpecSingle.x, H * fSpecSingle.y);

        const fSpecStudent = getField('specialStudent', DEFAULT_POS.special.checkWorkingStudent.x, DEFAULT_POS.special.checkWorkingStudent.y, 20);
        if (data.isWorkingStudent) ctx.fillText('✓', W * fSpecStudent.x, H * fSpecStudent.y);

        const fSpecDetails = getField('specialDetails', DEFAULT_POS.special.details.x, DEFAULT_POS.special.details.y, 16);
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${fSpecDetails.size}px "Noto Sans JP", sans-serif`;
        if (data.disabilityDetails) {
          ctx.fillText(data.disabilityDetails, W * fSpecDetails.x, H * fSpecDetails.y);
        } else if (data.isWorkingStudent) {
          ctx.fillText(`学校: ${data.workingStudentSchool || '〇〇大学'}`, W * fSpecDetails.x, H * fSpecDetails.y);
        }

        // 住民税（16歳未満 1人目）
        if (under16Dependents[0]) {
          const uDep = under16Dependents[0];
          const ubDate = parseJapaneseEraDate(uDep.birthDate);

          const fU16Kana = getField('u16_0Kana', DEFAULT_POS.u16Cols.kanaX, DEFAULT_POS.u16[0].kanaY, 13);
          ctx.font = `${fU16Kana.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(uDep.nameKana || '', W * fU16Kana.x, H * fU16Kana.y);

          const fU16Name = getField('u16_0Name', DEFAULT_POS.u16Cols.nameX, DEFAULT_POS.u16[0].rowY, 19);
          ctx.font = `bold ${fU16Name.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(uDep.name, W * fU16Name.x, H * fU16Name.y);

          const fU16Num = getField('u16_0MyNumber', DEFAULT_POS.u16Cols.myNumStartX, DEFAULT_POS.u16[0].rowY, 16, DEFAULT_POS.u16Cols.myNumPitch);
          const uNumStr = uDep.myNumber ? uDep.myNumber.replace(/[^0-9]/g, '') : '************';
          ctx.font = `bold ${fU16Num.size}px "Courier New", monospace`;
          const uPitch = W * (fU16Num.pitch || DEFAULT_POS.u16Cols.myNumPitch);
          for (let i = 0; i < 12; i++) {
            ctx.fillText(uNumStr[i] || '*', W * fU16Num.x + i * uPitch, H * fU16Num.y);
          }

          const fU16Rel = getField('u16_0Rel', DEFAULT_POS.u16Cols.relationX, DEFAULT_POS.u16[0].rowY, 17);
          ctx.font = `bold ${fU16Rel.size}px "Noto Sans JP", sans-serif`;
          ctx.fillText(uDep.relation, W * fU16Rel.x, H * fU16Rel.y);

          const fU16BirthY = getField('u16_0BirthY', DEFAULT_POS.u16Cols.birthYX, DEFAULT_POS.u16[0].rowY, 17);
          ctx.fillText(ubDate.year, W * fU16BirthY.x, H * fU16BirthY.y);

          const fU16BirthM = getField('u16_0BirthM', DEFAULT_POS.u16Cols.birthMX, DEFAULT_POS.u16[0].rowY, 17);
          ctx.fillText(ubDate.month, W * fU16BirthM.x, H * fU16BirthM.y);

          const fU16BirthD = getField('u16_0BirthD', DEFAULT_POS.u16Cols.birthDX, DEFAULT_POS.u16[0].rowY, 17);
          ctx.fillText(ubDate.day, W * fU16BirthD.x, H * fU16BirthD.y);

          const fU16Addr = getField('u16_0Address', DEFAULT_POS.u16Cols.addressX, DEFAULT_POS.u16[0].rowY, 15);
          ctx.fillText(uDep.address || data.employeeAddress, W * fU16Addr.x, H * fU16Addr.y);

          const fU16Income = getField('u16_0Income', DEFAULT_POS.u16Cols.incomeX, DEFAULT_POS.u16[0].rowY, 17);
          ctx.textAlign = 'right';
          ctx.fillText('0 円', W * fU16Income.x, H * fU16Income.y);
          ctx.textAlign = 'left';
        }

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
