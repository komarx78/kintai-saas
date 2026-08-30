import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Printer, Download, Eye, CheckCircle2, Loader2, Sparkles, 
  RotateCcw, Copy, Check, Type, Grid, MousePointer
} from 'lucide-react';

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
 * 各テキスト項目のレイアウト設定インターフェース
 */
interface FieldItem {
  id: string;
  label: string;
  category: string;
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // px (基準1000px幅換算)
  fontWeight?: string;
  isMono?: boolean;
  isMyNumber?: boolean;
  pitch?: number; // マイナンバーマス目ピッチ (%)
  isCircle?: boolean;
  isCheck?: boolean;
  align?: 'left' | 'center' | 'right';
  val: string;
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

// デフォルト初期座標テーブル
const INITIAL_LAYOUT: Record<string, { x: number; y: number; fontSize: number; pitch?: number }> = {
  taxOffice: { x: 8.8, y: 9.8, fontSize: 13 },
  municipality: { x: 7.8, y: 13.8, fontSize: 13 },
  companyName: { x: 23.5, y: 8.8, fontSize: 15 },
  corporateNumber: { x: 23.5, y: 11.4, fontSize: 14 },
  companyAddress: { x: 23.5, y: 14.2, fontSize: 11 },
  empKana: { x: 44.0, y: 7.5, fontSize: 10 },
  empName: { x: 44.0, y: 9.5, fontSize: 18 },
  empMyNumber: { x: 42.8, y: 12.3, fontSize: 14, pitch: 1.82 },
  empPostal: { x: 50.5, y: 14.0, fontSize: 11 },
  empAddress: { x: 42.5, y: 15.2, fontSize: 12 },
  empBirthY: { x: 68.2, y: 7.5, fontSize: 12 },
  empBirthM: { x: 72.5, y: 7.5, fontSize: 12 },
  empBirthD: { x: 75.5, y: 7.5, fontSize: 12 },
  householderName: { x: 67.5, y: 9.8, fontSize: 12 },
  householderRel: { x: 67.5, y: 12.2, fontSize: 12 },
  hasSpouseCircle: { x: 74.2, y: 14.8, fontSize: 14 },

  spouseKana: { x: 16.5, y: 20.8, fontSize: 10 },
  spouseName: { x: 16.5, y: 22.2, fontSize: 14 },
  spouseMyNumber: { x: 26.5, y: 22.2, fontSize: 12, pitch: 0.98 },
  spouseRel: { x: 34.5, y: 22.2, fontSize: 12 },
  spouseBirthY: { x: 40.5, y: 22.2, fontSize: 12 },
  spouseBirthM: { x: 43.2, y: 22.2, fontSize: 12 },
  spouseBirthD: { x: 45.8, y: 22.2, fontSize: 12 },
  spouseIncome: { x: 53.5, y: 22.2, fontSize: 12 },
  spouseLiving: { x: 58.5, y: 22.2, fontSize: 11 },
  spouseAddress: { x: 64.0, y: 22.2, fontSize: 11 },

  dep0Kana: { x: 16.5, y: 24.2, fontSize: 10 },
  dep0Name: { x: 16.5, y: 25.6, fontSize: 14 },
  dep0MyNumber: { x: 26.5, y: 25.6, fontSize: 12, pitch: 0.98 },
  dep0Rel: { x: 34.5, y: 25.6, fontSize: 12 },
  dep0BirthY: { x: 40.5, y: 25.6, fontSize: 12 },
  dep0BirthM: { x: 43.2, y: 25.6, fontSize: 12 },
  dep0BirthD: { x: 45.8, y: 25.6, fontSize: 12 },
  dep0Income: { x: 53.5, y: 25.6, fontSize: 12 },
  dep0Living: { x: 58.5, y: 25.6, fontSize: 11 },
  dep0Address: { x: 64.0, y: 25.6, fontSize: 11 },

  specialDisabled: { x: 12.2, y: 38.8, fontSize: 14 },
  specialWidow: { x: 31.5, y: 38.8, fontSize: 14 },
  specialSingle: { x: 35.0, y: 38.8, fontSize: 14 },
  specialStudent: { x: 39.2, y: 38.8, fontSize: 14 },
  specialDetails: { x: 46.5, y: 39.2, fontSize: 12 },

  u16_0Kana: { x: 16.5, y: 52.5, fontSize: 10 },
  u16_0Name: { x: 16.5, y: 53.8, fontSize: 14 },
  u16_0MyNumber: { x: 27.5, y: 53.8, fontSize: 12, pitch: 0.98 },
  u16_0Rel: { x: 38.5, y: 53.8, fontSize: 12 },
  u16_0BirthY: { x: 42.5, y: 53.8, fontSize: 12 },
  u16_0BirthM: { x: 44.8, y: 53.8, fontSize: 12 },
  u16_0BirthD: { x: 47.2, y: 53.8, fontSize: 12 },
  u16_0Address: { x: 53.0, y: 53.8, fontSize: 11 },
  u16_0Income: { x: 74.5, y: 53.8, fontSize: 12 }
};

export const OfficialTaxExemptionDoc: React.FC<TaxExemptionDocProps> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'visual_editor' | 'canvas_doc' | 'pdf_view' | 'guide_view'>('visual_editor');
  const [isRendering, setIsRendering] = useState(true);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  
  // 🛠️ 販売者用ドラッグ＆ドロップ WYSIWYG デザイナー State
  const [layoutMap, setLayoutMap] = useState<Record<string, { x: number; y: number; fontSize: number; pitch?: number }>>(() => {
    try {
      const saved = localStorage.getItem('taxDocCustomLayout');
      if (saved) return { ...INITIAL_LAYOUT, ...JSON.parse(saved) };
    } catch (_) {}
    return INITIAL_LAYOUT;
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>('empName');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; fieldX: number; fieldY: number } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const under16Dependents = (data.dependents || []).filter(d => d.isUnder16);
  const regularDependents = (data.dependents || []).filter(d => !d.isUnder16);
  const empBirth = parseJapaneseEraDate(data.birthDate);
  const spouseBirth = parseJapaneseEraDate(data.spouseBirthDate);

  // フィールドリストの構築
  const fields: FieldItem[] = [
    // 🏢 会社
    { id: 'taxOffice', label: '所轄税務署長', category: 'ヘッダー', val: data.taxOfficeName || '千代田', ...layoutMap.taxOffice },
    { id: 'municipality', label: '市区町村長', category: 'ヘッダー', val: data.municipalityName || '千代田区', ...layoutMap.municipality },
    { id: 'companyName', label: '給与支払者の名称', category: '会社情報', val: data.companyName, fontWeight: 'bold', ...layoutMap.companyName },
    { id: 'corporateNumber', label: '法人番号', category: '会社情報', val: data.corporateNumber || '1010001999999', isMono: true, ...layoutMap.corporateNumber },
    { id: 'companyAddress', label: '所在地', category: '会社情報', val: data.companyAddress || '本社所在地', ...layoutMap.companyAddress },

    // 👤 本人
    { id: 'empKana', label: 'あなたのフリガナ', category: '本人情報', val: data.employeeNameKana || 'テスト', ...layoutMap.empKana },
    { id: 'empName', label: 'あなたの氏名', category: '本人情報', val: data.employeeName, fontWeight: '900', ...layoutMap.empName },
    { id: 'empMyNumber', label: 'あなたの個人番号(12桁)', category: '本人情報', val: data.myNumber ? data.myNumber.replace(/[^0-9]/g, '') : '123456789012', isMyNumber: true, isMono: true, ...layoutMap.empMyNumber },
    { id: 'empPostal', label: '郵便番号', category: '本人情報', val: data.postalCode || '160-0023', ...layoutMap.empPostal },
    { id: 'empAddress', label: 'あなたの住所', category: '本人情報', val: data.employeeAddress, ...layoutMap.empAddress },
    { id: 'empBirthY', label: '生年月日(年)', category: '本人情報', val: empBirth.year, ...layoutMap.empBirthY },
    { id: 'empBirthM', label: '生年月日(月)', category: '本人情報', val: empBirth.month, ...layoutMap.empBirthM },
    { id: 'empBirthD', label: '生年月日(日)', category: '本人情報', val: empBirth.day, ...layoutMap.empBirthD },
    { id: 'householderName', label: '世帯主の氏名', category: '本人情報', val: data.householderName || data.employeeName, ...layoutMap.householderName },
    { id: 'householderRel', label: 'あなたとの続柄', category: '本人情報', val: data.householderRelation || '本人', ...layoutMap.householderRel },
    { id: 'hasSpouseCircle', label: '配偶者の有無(○印)', category: '本人情報', val: '○', isCircle: true, ...(data.hasSpouse ? layoutMap.hasSpouseCircle : { x: 76.8, y: 14.8, fontSize: 14 }) },

    // 👫 配偶者
    { id: 'spouseKana', label: '配偶者フリガナ', category: '配偶者', val: data.spouseNameKana || '', ...layoutMap.spouseKana },
    { id: 'spouseName', label: '配偶者氏名', category: '配偶者', val: data.spouseName || (data.hasSpouse ? '配偶者' : ''), fontWeight: 'bold', ...layoutMap.spouseName },
    { id: 'spouseMyNumber', label: '配偶者マイナンバー', category: '配偶者', val: data.spouseMyNumber ? data.spouseMyNumber.replace(/[^0-9]/g, '') : '************', isMyNumber: true, isMono: true, ...layoutMap.spouseMyNumber },
    { id: 'spouseRel', label: '配偶者続柄', category: '配偶者', val: data.hasSpouse ? '妻' : '', ...layoutMap.spouseRel },
    { id: 'spouseBirthY', label: '配偶者生年', category: '配偶者', val: data.hasSpouse ? spouseBirth.year : '', ...layoutMap.spouseBirthY },
    { id: 'spouseBirthM', label: '配偶者生月', category: '配偶者', val: data.hasSpouse ? spouseBirth.month : '', ...layoutMap.spouseBirthM },
    { id: 'spouseBirthD', label: '配偶者生日', category: '配偶者', val: data.hasSpouse ? spouseBirth.day : '', ...layoutMap.spouseBirthD },
    { id: 'spouseIncome', label: '配偶者所得見積', category: '配偶者', val: data.hasSpouse ? `${(data.spouseIncomeEstimate || 0).toLocaleString()} 円` : '', align: 'right', ...layoutMap.spouseIncome },
    { id: 'spouseLiving', label: '配偶者同居別居', category: '配偶者', val: data.hasSpouse ? (data.spouseIsLivingTogether !== false ? '同居' : '別居') : '', ...layoutMap.spouseLiving },
    { id: 'spouseAddress', label: '配偶者住所', category: '配偶者', val: data.hasSpouse ? (data.spouseAddress || data.employeeAddress) : '', ...layoutMap.spouseAddress },

    // 👨‍👩‍👧 扶養親族 1人目
    { id: 'dep0Kana', label: '扶養1 フリガナ', category: '扶養親族', val: regularDependents[0]?.nameKana || '', ...layoutMap.dep0Kana },
    { id: 'dep0Name', label: '扶養1 氏名', category: '扶養親族', val: regularDependents[0]?.name || '', fontWeight: 'bold', ...layoutMap.dep0Name },
    { id: 'dep0MyNumber', label: '扶養1 マイナンバー', category: '扶養親族', val: regularDependents[0]?.myNumber || '************', isMyNumber: true, isMono: true, ...layoutMap.dep0MyNumber },
    { id: 'dep0Rel', label: '扶養1 続柄', category: '扶養親族', val: regularDependents[0]?.relation || '', ...layoutMap.dep0Rel },
    { id: 'dep0BirthY', label: '扶養1 生年', category: '扶養親族', val: regularDependents[0] ? parseJapaneseEraDate(regularDependents[0].birthDate).year : '', ...layoutMap.dep0BirthY },
    { id: 'dep0BirthM', label: '扶養1 生月', category: '扶養親族', val: regularDependents[0] ? parseJapaneseEraDate(regularDependents[0].birthDate).month : '', ...layoutMap.dep0BirthM },
    { id: 'dep0BirthD', label: '扶養1 生日', category: '扶養親族', val: regularDependents[0] ? parseJapaneseEraDate(regularDependents[0].birthDate).day : '', ...layoutMap.dep0BirthD },
    { id: 'dep0Income', label: '扶養1 所得見積', category: '扶養親族', val: regularDependents[0] ? `${(regularDependents[0].incomeEstimate || 0).toLocaleString()} 円` : '', align: 'right', ...layoutMap.dep0Income },
    { id: 'dep0Living', label: '扶養1 同居別居', category: '扶養親族', val: regularDependents[0] ? (regularDependents[0].isLivingTogether !== false ? '同居' : '別居') : '', ...layoutMap.dep0Living },
    { id: 'dep0Address', label: '扶養1 住所', category: '扶養親族', val: regularDependents[0] ? (regularDependents[0].address || data.employeeAddress) : '', ...layoutMap.dep0Address },

    // ♿ 障害者等
    { id: 'specialDisabled', label: '障害者チェック', category: '障害者等', val: data.isDisability ? '✓' : '', isCheck: true, ...layoutMap.specialDisabled },
    { id: 'specialWidow', label: '寡婦チェック', category: '障害者等', val: data.isWidow ? '✓' : '', isCheck: true, ...layoutMap.specialWidow },
    { id: 'specialSingle', label: 'ひとり親チェック', category: '障害者等', val: data.isSingleParent ? '✓' : '', isCheck: true, ...layoutMap.specialSingle },
    { id: 'specialStudent', label: '勤労学生チェック', category: '障害者等', val: data.isWorkingStudent ? '✓' : '', isCheck: true, ...layoutMap.specialStudent },
    { id: 'specialDetails', label: '障害者・学生内容', category: '障害者等', val: data.disabilityDetails || (data.isWorkingStudent ? `学校: ${data.workingStudentSchool || '〇〇大学'}` : ''), ...layoutMap.specialDetails },

    // 👶 住民税 16歳未満 1人目
    { id: 'u16_0Kana', label: '16未満1 フリガナ', category: '住民税', val: under16Dependents[0]?.nameKana || '', ...layoutMap.u16_0Kana },
    { id: 'u16_0Name', label: '16未満1 氏名', category: '住民税', val: under16Dependents[0]?.name || '', fontWeight: 'bold', ...layoutMap.u16_0Name },
    { id: 'u16_0MyNumber', label: '16未満1 マイナンバー', category: '住民税', val: under16Dependents[0]?.myNumber || '************', isMyNumber: true, isMono: true, ...layoutMap.u16_0MyNumber },
    { id: 'u16_0Rel', label: '16未満1 続柄', category: '住民税', val: under16Dependents[0]?.relation || '', ...layoutMap.u16_0Rel },
    { id: 'u16_0BirthY', label: '16未満1 生年', category: '住民税', val: under16Dependents[0] ? parseJapaneseEraDate(under16Dependents[0].birthDate).year : '', ...layoutMap.u16_0BirthY },
    { id: 'u16_0BirthM', label: '16未満1 生月', category: '住民税', val: under16Dependents[0] ? parseJapaneseEraDate(under16Dependents[0].birthDate).month : '', ...layoutMap.u16_0BirthM },
    { id: 'u16_0BirthD', label: '16未満1 生日', category: '住民税', val: under16Dependents[0] ? parseJapaneseEraDate(under16Dependents[0].birthDate).day : '', ...layoutMap.u16_0BirthD },
    { id: 'u16_0Address', label: '16未満1 住所', category: '住民税', val: under16Dependents[0] ? (under16Dependents[0].address || data.employeeAddress) : '', ...layoutMap.u16_0Address },
    { id: 'u16_0Income', label: '16未満1 所得', category: '住民税', val: under16Dependents[0] ? '0 円' : '', align: 'right', ...layoutMap.u16_0Income }
  ];

  // 位置の更新
  const updateFieldPosition = useCallback((id: string, newX: number, newY: number) => {
    setLayoutMap(prev => {
      const updated = {
        ...prev,
        [id]: {
          ...prev[id],
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10
        }
      };
      localStorage.setItem('taxDocCustomLayout', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // フォントサイズの更新
  const updateFieldFontSize = (id: string, newSize: number) => {
    setLayoutMap(prev => {
      const updated = {
        ...prev,
        [id]: {
          ...prev[id],
          fontSize: Math.max(8, Math.min(32, newSize))
        }
      };
      localStorage.setItem('taxDocCustomLayout', JSON.stringify(updated));
      return updated;
    });
  };

  // マウスドラッグハンドラー
  const handleMouseDown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(id);
    setIsDragging(true);

    const currentPos = layoutMap[id] || INITIAL_LAYOUT[id];
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      fieldX: currentPos.x,
      fieldY: currentPos.y
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !selectedFieldId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100, dragStart.fieldX + deltaX));
    const newY = Math.max(0, Math.min(100, dragStart.fieldY + deltaY));

    updateFieldPosition(selectedFieldId, newX, newY);
  }, [isDragging, dragStart, selectedFieldId, updateFieldPosition]);

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // キーボード微調整（ナッジ）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedFieldId) return;
    const step = e.shiftKey ? 1.0 : 0.1;
    const current = layoutMap[selectedFieldId] || INITIAL_LAYOUT[selectedFieldId];

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateFieldPosition(selectedFieldId, current.x, current.y - step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateFieldPosition(selectedFieldId, current.x, current.y + step);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      updateFieldPosition(selectedFieldId, current.x - step, current.y);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      updateFieldPosition(selectedFieldId, current.x + step, current.y);
    }
  };

  // 座標設定のリセット
  const handleResetLayout = () => {
    if (confirm('すべての項目の位置・フォントサイズを初期状態にリセットしますか？')) {
      setLayoutMap(INITIAL_LAYOUT);
      localStorage.removeItem('taxDocCustomLayout');
    }
  };

  // 座標コードのコピー
  const handleCopyCode = () => {
    const code = `export const TAX_DOC_2026_COORDINATES = ${JSON.stringify(layoutMap, null, 2)};`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Canvas描画（印刷・ダウンロード用）
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

        const loadingTask = pdfjsLib.getDocument('/2026bun_01.pdf');
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const scale = 2.5;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 背景PDF原本を描画
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (isCancelled) return;

        const W = canvas.width;
        const H = canvas.height;
        ctx.fillStyle = '#0f172a';
        ctx.textBaseline = 'middle';

        // 各フィールドの描画
        fields.forEach(f => {
          if (!f.val) return;
          const posX = (f.x / 100) * W;
          const posY = (f.y / 100) * H;
          const fPx = Math.round((f.fontSize / 1000) * W * 1.6);

          ctx.font = `${f.fontWeight || 'normal'} ${fPx}px ${f.isMono ? '"Courier New", monospace' : '"Noto Sans JP", sans-serif'}`;

          if (f.isMyNumber) {
            const pitch = ((f.pitch || 1.82) / 100) * W;
            for (let i = 0; i < f.val.length; i++) {
              ctx.fillText(f.val[i], posX + i * pitch, posY);
            }
          } else if (f.isCircle) {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(posX, posY, 14, 0, Math.PI * 2);
            ctx.stroke();
          } else if (f.isCheck) {
            ctx.fillStyle = '#2563eb';
            ctx.fillText(f.val, posX, posY);
            ctx.fillStyle = '#0f172a';
          } else {
            ctx.textAlign = f.align || 'left';
            ctx.fillText(f.val, posX, posY);
            ctx.textAlign = 'left';
          }
        });

        const url = canvas.toDataURL('image/png');
        setCanvasUrl(url);
        setIsRendering(false);
      } catch (err) {
        console.error(err);
        setIsRendering(false);
      }
    };

    renderCanvas();
    return () => { isCancelled = true; };
  }, [layoutMap, data]);

  const selectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <div className="w-full bg-slate-100 py-3 print:bg-white print:py-0 select-text font-sans" onKeyDown={handleKeyDown} tabIndex={0}>
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
            onClick={() => setActiveTab('visual_editor')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'visual_editor' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MousePointer className="w-3.5 h-3.5 text-amber-300" />
            ① マウスで直接動かせるデザイナー（販売者用）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('canvas_doc')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'canvas_doc' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            ② 印字完成ビュー（提出用プレビュー）
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pdf_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pdf_view' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            ③ 原本PDF
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            title="調整した座標コードをクリップボードにコピー"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-indigo-600" />}
            {copiedCode ? 'コピー完了！' : '座標コードをコピー'}
          </button>

          <button
            type="button"
            onClick={handleResetLayout}
            className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            title="初期位置に戻す"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

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
      {/* 🖱️ ① 販売者用 ドラッグ＆ドロップ WYSIWYG デザイナー */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'visual_editor' && (
        <div className="max-w-[1150px] mx-auto space-y-2 no-print">
          
          {/* 操作インスペクターパネル */}
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-amber-300">選択中:</span>
              <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                {selectedField ? `${selectedField.label} (${selectedField.category})` : '項目をクリックして選択'}
              </span>
            </div>

            {selectedField && (
              <div className="flex items-center gap-4">
                {/* 座標表示 */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">位置:</span>
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-300">
                    X: {selectedField.x.toFixed(1)}% / Y: {selectedField.y.toFixed(1)}%
                  </span>
                </div>

                {/* 文字サイズ変更 */}
                <div className="flex items-center gap-2">
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">文字サイズ:</span>
                  <input
                    type="range"
                    min="8"
                    max="28"
                    step="1"
                    value={selectedField.fontSize}
                    onChange={e => updateFieldFontSize(selectedField.id, parseInt(e.target.value, 10))}
                    className="w-24 accent-indigo-500 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-indigo-300 w-8">{selectedField.fontSize}px</span>
                </div>

                {/* マイナンバーマス目ピッチ変更 */}
                {selectedField.isMyNumber && (
                  <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
                    <Grid className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">マス目間隔:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3.0"
                      step="0.05"
                      value={selectedField.pitch || 1.82}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setLayoutMap(prev => ({
                          ...prev,
                          [selectedField.id]: { ...prev[selectedField.id], pitch: val }
                        }));
                      }}
                      className="w-20 accent-indigo-500 cursor-pointer"
                    />
                    <span className="font-mono font-bold text-amber-300 w-10">{(selectedField.pitch || 1.82).toFixed(2)}%</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-400">
              💡 マウスでドラッグ移動 ＆ キーボード（↑ ↓ ← →）で 0.1% 微調整可能
            </div>
          </div>

          {/* ドラッグキャンバス（国税庁PDF原本を背景に敷き、文字をドラッグ可能に） */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative w-full aspect-[297/210] bg-white rounded-2xl shadow-2xl border-2 border-indigo-400/50 overflow-hidden select-none cursor-crosshair"
            style={{
              backgroundImage: 'url(/2026bun_01.pdf)', // フォールバック
              backgroundSize: '100% 100%'
            }}
          >
            {/* 原本キャンバス（下敷き） */}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

            {/* ドラッグ可能なテキストボックス群 */}
            {fields.map(f => {
              const isSelected = selectedFieldId === f.id;
              if (!f.val) return null;

              return (
                <div
                  key={f.id}
                  onMouseDown={e => handleMouseDown(f.id, e)}
                  onClick={() => setSelectedFieldId(f.id)}
                  style={{
                    position: 'absolute',
                    left: `${f.x}%`,
                    top: `${f.y}%`,
                    transform: 'translate(0, -50%)',
                    fontSize: `${(f.fontSize / 1000) * 100}vw`,
                    maxWidth: '30%',
                    fontWeight: f.fontWeight || 'normal',
                    fontFamily: f.isMono ? '"Courier New", monospace' : '"Noto Sans JP", sans-serif',
                    color: isSelected ? '#1d4ed8' : '#0f172a',
                    cursor: 'grab'
                  }}
                  className={`px-1 py-0.5 rounded transition-shadow leading-none ${
                    isSelected
                      ? 'ring-2 ring-indigo-600 bg-indigo-500/20 shadow-lg font-black z-30'
                      : 'hover:ring-1 hover:ring-indigo-400 hover:bg-indigo-100/30 z-10'
                  }`}
                  title={`${f.label} (ドラッグして移動)`}
                >
                  {f.isMyNumber ? (
                    <span className="tracking-widest flex items-center">
                      {f.val.split('').map((c, i) => (
                        <span key={i} style={{ display: 'inline-block', width: `${(f.pitch || 1.82) * 10}px`, textAlign: 'center' }}>
                          {c}
                        </span>
                      ))}
                    </span>
                  ) : f.isCircle ? (
                    <span className="w-5 h-5 rounded-full border-2 border-blue-600 inline-block"></span>
                  ) : (
                    f.val
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ② 印字完成ビュー（提出用プレビュー ＆ A4印刷） */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'canvas_doc' && (
        <div className="max-w-[1150px] mx-auto bg-white p-3 rounded-2xl shadow-2xl border border-slate-300 print:p-0 print:border-none print:shadow-none">
          {isRendering && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-600">国税庁公式原本（2026bun_01）に高精細印字中...</p>
            </div>
          )}

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

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ③ 国税庁公式 入力用原本PDF インラインプレビュー */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
      {/* 📄 ④ 裏面手引き */}
      {/* ══════════════════════════════════════════════════════════════════════════════════ */}
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
