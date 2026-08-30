import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Save, Copy, Check, 
  Building2, User, Users, Heart, Shield, Baby, FileText, CheckCircle2, Loader2,
  ZoomIn, ZoomOut, RotateCcw,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight
} from 'lucide-react';

export interface FieldConfig {
  id: string;
  name: string;
  section: string;
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // pt 相当（4〜24）
  pitch?: number; // % (マイナンバー用)
  example: string;
  description: string;
}

// 🎯 国税庁原本（2026bun_01.pdf）の枠内にぴったり収まる黄金比率デフォルト値（配偶者続柄削除・円削除・扶養4名住民税4名フル完備）
export const DEFAULT_TAX_FIELDS: FieldConfig[] = [
  // ① 給与支払者
  { id: 'taxOffice', name: '所轄税務署長', section: 'header', x: 8.5, y: 13.0, fontSize: 10, example: '千代田', description: '左上「税務署長等」枠内' },
  { id: 'municipality', name: '市区町村長', section: 'header', x: 8.5, y: 17.2, fontSize: 10, example: '千代田区', description: '「市区町村長」枠内' },
  { id: 'companyName', name: '給与支払者の名称（会社名）', section: 'header', x: 23.5, y: 11.5, fontSize: 11, example: '株式会社KAP', description: '給与支払者 1段目' },
  { id: 'corporateNumber', name: '法人番号（13桁）', section: 'header', x: 23.5, y: 14.8, fontSize: 10, pitch: 1.02, example: '1010001999999', description: '給与支払者 2段目' },
  { id: 'companyAddress', name: '所在地（住所）', section: 'header', x: 23.5, y: 17.5, fontSize: 9, example: '滋賀県大津市坂本3丁目21-16', description: '給与支払者 3段目' },

  // ② 申告者本人
  { id: 'empKana', name: 'あなたのフリガナ', section: 'employee', x: 44.5, y: 10.5, fontSize: 7, example: 'テスト タロウ', description: '「（フリガナ）」行' },
  { id: 'empName', name: 'あなたの氏名', section: 'employee', x: 44.5, y: 12.8, fontSize: 12, example: '駒井 秀一朗', description: '「あなたの氏名」枠内' },
  { id: 'empMyNumber', name: 'あなたの個人番号（12桁マス目）', section: 'employee', x: 42.8, y: 15.0, fontSize: 10, pitch: 1.80, example: '123456789012', description: '12マスの四角枠' },
  { id: 'empPostal', name: 'あなたの郵便番号', section: 'employee', x: 50.8, y: 16.5, fontSize: 8, example: '160-0023', description: '住所欄の〒右側' },
  { id: 'empAddress', name: 'あなたの住所', section: 'employee', x: 42.8, y: 18.0, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'あなたの住所又は居所' },
  { id: 'empBirthY', name: '生年月日（年）', section: 'employee', x: 68.8, y: 10.8, fontSize: 10, example: '7', description: '生年月日の「年」枠' },
  { id: 'empBirthM', name: '生年月日（月）', section: 'employee', x: 73.0, y: 10.8, fontSize: 10, example: '4', description: '生年月日の「月」枠' },
  { id: 'empBirthD', name: '生年月日（日）', section: 'employee', x: 76.0, y: 10.8, fontSize: 10, example: '1', description: '生年月日の「日」枠' },
  { id: 'householderName', name: '世帯主の氏名', section: 'employee', x: 67.5, y: 13.0, fontSize: 10, example: '駒井 秀一朗', description: '世帯主欄' },
  { id: 'householderRel', name: 'あなたとの続柄', section: 'employee', x: 74.0, y: 13.0, fontSize: 10, example: '本人', description: '続柄欄' },
  { id: 'hasSpouseYes', name: '配偶者 有（○印）', section: 'employee', x: 74.6, y: 16.2, fontSize: 10, example: '○', description: '「有」の文字を囲む円' },

  // ③ Ａ. 配偶者（※続柄は原本にスラッシュがあるため削除）
  { id: 'spouseKana', name: '配偶者フリガナ', section: 'spouse', x: 16.5, y: 22.0, fontSize: 7, example: 'テスト ハナコ', description: 'Ａ欄フリガナ' },
  { id: 'spouseName', name: '配偶者氏名', section: 'spouse', x: 16.5, y: 23.8, fontSize: 11, example: 'テスト 花子', description: 'Ａ欄氏名' },
  { id: 'spouseMyNumber', name: '配偶者マイナンバー', section: 'spouse', x: 26.5, y: 23.8, fontSize: 9, pitch: 0.98, example: '************', description: 'Ａ欄12桁マス目' },
  { id: 'spouseBirthY', name: '配偶者生年', section: 'spouse', x: 40.5, y: 23.8, fontSize: 10, example: '8', description: 'Ａ欄生年' },
  { id: 'spouseBirthM', name: '配偶者生月', section: 'spouse', x: 43.2, y: 23.8, fontSize: 10, example: '5', description: 'Ａ欄生月' },
  { id: 'spouseBirthD', name: '配偶者生日', section: 'spouse', x: 45.8, y: 23.8, fontSize: 10, example: '15', description: 'Ａ欄生日' },
  { id: 'spouseIncome', name: '配偶者所得見積額（数字のみ）', section: 'spouse', x: 53.0, y: 23.8, fontSize: 10, example: '0', description: 'Ａ欄所得見積額（円は用紙印刷済）' },
  { id: 'spouseLiving', name: '生計を一にする事実', section: 'spouse', x: 58.5, y: 23.8, fontSize: 9, example: '同居', description: 'Ａ欄生計一事実' },
  { id: 'spouseAddress', name: '配偶者住所', section: 'spouse', x: 64.0, y: 23.8, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ａ欄住所' },

  // ④ Ｂ. 控除対象扶養親族（1人目〜4人目 フル完備）
  // 1人目
  { id: 'dep0Kana', name: '扶養1 フリガナ', section: 'dependent', x: 16.5, y: 26.0, fontSize: 7, example: 'テスト タロウ', description: 'Ｂ欄1人目カナ' },
  { id: 'dep0Name', name: '扶養1 氏名', section: 'dependent', x: 16.5, y: 27.5, fontSize: 11, example: 'テスト 太郎', description: 'Ｂ欄1人目氏名' },
  { id: 'dep0MyNumber', name: '扶養1 マイナンバー', section: 'dependent', x: 26.5, y: 27.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄1人目12桁マス目' },
  { id: 'dep0Rel', name: '扶養1 続柄', section: 'dependent', x: 34.5, y: 27.5, fontSize: 10, example: '長男', description: 'Ｂ欄1人目続柄' },
  { id: 'dep0BirthY', name: '扶養1 生年', section: 'dependent', x: 40.5, y: 27.5, fontSize: 10, example: '27', description: 'Ｂ欄1人目生年' },
  { id: 'dep0BirthM', name: '扶養1 生月', section: 'dependent', x: 43.2, y: 27.5, fontSize: 10, example: '5', description: 'Ｂ欄1人目生月' },
  { id: 'dep0BirthD', name: '扶養1 生日', section: 'dependent', x: 45.8, y: 27.5, fontSize: 10, example: '1', description: 'Ｂ欄1人目生日' },
  { id: 'dep0Income', name: '扶養1 所得見積額', section: 'dependent', x: 53.0, y: 27.5, fontSize: 10, example: '0', description: 'Ｂ欄1人目所得（円は用紙印刷済）' },
  { id: 'dep0Living', name: '扶養1 同居別居', section: 'dependent', x: 58.5, y: 27.5, fontSize: 9, example: '同居', description: 'Ｂ欄1人目生計一' },
  { id: 'dep0Address', name: '扶養1 住所', section: 'dependent', x: 64.0, y: 27.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄1人目住所' },

  // 2人目
  { id: 'dep1Kana', name: '扶養2 フリガナ', section: 'dependent', x: 16.5, y: 31.0, fontSize: 7, example: 'テスト ハナエ', description: 'Ｂ欄2人目カナ' },
  { id: 'dep1Name', name: '扶養2 氏名', section: 'dependent', x: 16.5, y: 32.5, fontSize: 11, example: 'テスト 花江', description: 'Ｂ欄2人目氏名' },
  { id: 'dep1MyNumber', name: '扶養2 マイナンバー', section: 'dependent', x: 26.5, y: 32.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄2人目12桁マス目' },
  { id: 'dep1Rel', name: '扶養2 続柄', section: 'dependent', x: 34.5, y: 32.5, fontSize: 10, example: '長女', description: 'Ｂ欄2人目続柄' },
  { id: 'dep1BirthY', name: '扶養2 生年', section: 'dependent', x: 40.5, y: 32.5, fontSize: 10, example: '29', description: 'Ｂ欄2人目生年' },
  { id: 'dep1BirthM', name: '扶養2 生月', section: 'dependent', x: 43.2, y: 32.5, fontSize: 10, example: '8', description: 'Ｂ欄2人目生月' },
  { id: 'dep1BirthD', name: '扶養2 生日', section: 'dependent', x: 45.8, y: 32.5, fontSize: 10, example: '10', description: 'Ｂ欄2人目生日' },
  { id: 'dep1Income', name: '扶養2 所得見積額', section: 'dependent', x: 53.0, y: 32.5, fontSize: 10, example: '0', description: 'Ｂ欄2人目所得（円は用紙印刷済）' },
  { id: 'dep1Living', name: '扶養2 同居別居', section: 'dependent', x: 58.5, y: 32.5, fontSize: 9, example: '同居', description: 'Ｂ欄2人目生計一' },
  { id: 'dep1Address', name: '扶養2 住所', section: 'dependent', x: 64.0, y: 32.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄2人目住所' },

  // 3人目
  { id: 'dep2Kana', name: '扶養3 フリガナ', section: 'dependent', x: 16.5, y: 36.0, fontSize: 7, example: 'テスト サブロウ', description: 'Ｂ欄3人目カナ' },
  { id: 'dep2Name', name: '扶養3 氏名', section: 'dependent', x: 16.5, y: 37.5, fontSize: 11, example: 'テスト 三郎', description: 'Ｂ欄3人目氏名' },
  { id: 'dep2MyNumber', name: '扶養3 マイナンバー', section: 'dependent', x: 26.5, y: 37.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄3人目12桁マス目' },
  { id: 'dep2Rel', name: '扶養3 続柄', section: 'dependent', x: 34.5, y: 37.5, fontSize: 10, example: '三男', description: 'Ｂ欄3人目続柄' },
  { id: 'dep2BirthY', name: '扶養3 生年', section: 'dependent', x: 40.5, y: 37.5, fontSize: 10, example: '31', description: 'Ｂ欄3人目生年' },
  { id: 'dep2BirthM', name: '扶養3 生月', section: 'dependent', x: 43.2, y: 37.5, fontSize: 10, example: '11', description: 'Ｂ欄3人目生月' },
  { id: 'dep2BirthD', name: '扶養3 生日', section: 'dependent', x: 45.8, y: 37.5, fontSize: 10, example: '3', description: 'Ｂ欄3人目生日' },
  { id: 'dep2Income', name: '扶養3 所得見積額', section: 'dependent', x: 53.0, y: 37.5, fontSize: 10, example: '0', description: 'Ｂ欄3人目所得（円は用紙印刷済）' },
  { id: 'dep2Living', name: '扶養3 同居別居', section: 'dependent', x: 58.5, y: 37.5, fontSize: 9, example: '同居', description: 'Ｂ欄3人目生計一' },
  { id: 'dep2Address', name: '扶養3 住所', section: 'dependent', x: 64.0, y: 37.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄3人目住所' },

  // 4人目
  { id: 'dep3Kana', name: '扶養4 フリガナ', section: 'dependent', x: 16.5, y: 41.0, fontSize: 7, example: 'テスト シロウ', description: 'Ｂ欄4人目カナ' },
  { id: 'dep3Name', name: '扶養4 氏名', section: 'dependent', x: 16.5, y: 42.5, fontSize: 11, example: 'テスト 四郎', description: 'Ｂ欄4人目氏名' },
  { id: 'dep3MyNumber', name: '扶養4 マイナンバー', section: 'dependent', x: 26.5, y: 42.5, fontSize: 9, pitch: 0.98, example: '************', description: 'Ｂ欄4人目12桁マス目' },
  { id: 'dep3Rel', name: '扶養4 続柄', section: 'dependent', x: 34.5, y: 42.5, fontSize: 10, example: '四男', description: 'Ｂ欄4人目続柄' },
  { id: 'dep3BirthY', name: '扶養4 生年', section: 'dependent', x: 40.5, y: 42.5, fontSize: 10, example: '2', description: 'Ｂ欄4人目生年' },
  { id: 'dep3BirthM', name: '扶養4 生月', section: 'dependent', x: 43.2, y: 42.5, fontSize: 10, example: '2', description: 'Ｂ欄4人目生月' },
  { id: 'dep3BirthD', name: '扶養4 生日', section: 'dependent', x: 45.8, y: 42.5, fontSize: 10, example: '20', description: 'Ｂ欄4人目生日' },
  { id: 'dep3Income', name: '扶養4 所得見積額', section: 'dependent', x: 53.0, y: 42.5, fontSize: 10, example: '0', description: 'Ｂ欄4人目所得（円は用紙印刷済）' },
  { id: 'dep3Living', name: '扶養4 同居別居', section: 'dependent', x: 58.5, y: 42.5, fontSize: 9, example: '同居', description: 'Ｂ欄4人目生計一' },
  { id: 'dep3Address', name: '扶養4 住所', section: 'dependent', x: 64.0, y: 42.5, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄4人目住所' },

  // ⑤ Ｃ. 障害者等
  { id: 'specialDisabled', name: '障害者チェック（✓）', section: 'special', x: 12.5, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄障害者ボックス' },
  { id: 'specialWidow', name: '寡婦チェック（✓）', section: 'special', x: 32.2, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄寡婦ボックス' },
  { id: 'specialSingle', name: 'ひとり親チェック（✓）', section: 'special', x: 35.8, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄ひとり親ボックス' },
  { id: 'specialStudent', name: '勤労学生チェック（✓）', section: 'special', x: 40.0, y: 46.5, fontSize: 12, example: '✓', description: 'Ｃ欄勤労学生ボックス' },
  { id: 'specialDetails', name: '障害者・学生の内容', section: 'special', x: 46.5, y: 46.5, fontSize: 9, example: '障害者手帳第1種', description: 'Ｃ欄内容記載枠' },

  // ⑥ 住民税（16歳未満 1人目〜4人目 フル完備）
  // 1人目
  { id: 'u16_0Kana', name: '住民税1 フリガナ', section: 'resident', x: 16.5, y: 55.5, fontSize: 7, example: 'テスト ジロウ', description: '住民税欄1人目カナ' },
  { id: 'u16_0Name', name: '住民税1 氏名', section: 'resident', x: 16.5, y: 57.0, fontSize: 11, example: 'テスト 次郎', description: '住民税欄1人目氏名' },
  { id: 'u16_0MyNumber', name: '住民税1 マイナンバー', section: 'resident', x: 27.5, y: 57.0, fontSize: 9, pitch: 0.98, example: '************', description: '住民税欄1人目12桁マス目' },
  { id: 'u16_0Rel', name: '住民税1 続柄', section: 'resident', x: 38.5, y: 57.0, fontSize: 10, example: '二男', description: '住民税欄1人目続柄' },
  { id: 'u16_0BirthY', name: '住民税1 生年', section: 'resident', x: 42.5, y: 57.0, fontSize: 10, example: '30', description: '住民税欄1人目生年' },
  { id: 'u16_0BirthM', name: '住民税1 生月', section: 'resident', x: 44.8, y: 57.0, fontSize: 10, example: '8', description: '住民税欄1人目生月' },
  { id: 'u16_0BirthD', name: '住民税1 生日', section: 'resident', x: 47.2, y: 57.0, fontSize: 10, example: '20', description: '住民税欄1人目生日' },
  { id: 'u16_0Address', name: '住民税1 住所', section: 'resident', x: 53.0, y: 57.0, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: '住民税欄1人目住所' },
  { id: 'u16_0Income', name: '住民税1 所得見積額', section: 'resident', x: 74.0, y: 57.0, fontSize: 10, example: '0', description: '住民税欄1人目所得（円は用紙印刷済）' },

  // 2人目
  { id: 'u16_1Kana', name: '住民税2 フリガナ', section: 'resident', x: 16.5, y: 59.5, fontSize: 7, example: 'テスト サチコ', description: '住民税欄2人目カナ' },
  { id: 'u16_1Name', name: '住民税2 氏名', section: 'resident', x: 16.5, y: 61.0, fontSize: 11, example: 'テスト 幸子', description: '住民税欄2人目氏名' },
  { id: 'u16_1MyNumber', name: '住民税2 マイナンバー', section: 'resident', x: 27.5, y: 61.0, fontSize: 9, pitch: 0.98, example: '************', description: '住民税欄2人目12桁マス目' },
  { id: 'u16_1Rel', name: '住民税2 続柄', section: 'resident', x: 38.5, y: 61.0, fontSize: 10, example: '二女', description: '住民税欄2人目続柄' },
  { id: 'u16_1BirthY', name: '住民税2 生年', section: 'resident', x: 42.5, y: 61.0, fontSize: 10, example: '3', description: '住民税欄2人目生年' },
  { id: 'u16_1BirthM', name: '住民税2 生月', section: 'resident', x: 44.8, y: 61.0, fontSize: 10, example: '12', description: '住民税欄2人目生月' },
  { id: 'u16_1BirthD', name: '住民税2 生日', section: 'resident', x: 47.2, y: 61.0, fontSize: 10, example: '5', description: '住民税欄2人目生日' },
  { id: 'u16_1Address', name: '住民税2 住所', section: 'resident', x: 53.0, y: 61.0, fontSize: 9, example: '京都市山科区大塚西浦町3-57', description: '住民税欄2人目住所' },
  { id: 'u16_1Income', name: '住民税2 所得見積額', section: 'resident', x: 74.0, y: 61.0, fontSize: 10, example: '0', description: '住民税欄2人目所得（円は用紙印刷済）' }
];

export const TaxDocMasterInspector: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<'header' | 'employee' | 'spouse' | 'dependent' | 'special' | 'resident'>('header');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('companyName');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // ドラッグ中 State
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  // 🖐️ 手のひらパン（書類全体のドラッグスクロール）State
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number }>({
    startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0
  });
  const [isPanning, setIsPanning] = useState(false);

  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 項目別マスタ座標State（古い保存データがあっても新項目を自動マージ！）
  const [fields, setFields] = useState<FieldConfig[]>(DEFAULT_TAX_FIELDS);

  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const { data } = await supabase.from('system_settings').select('tax_doc_coordinates').limit(1).single();
        const saved = data?.tax_doc_coordinates;
        if (saved && Array.isArray(saved)) {
          const parsedMap = new Map<string, any>(saved.map((f: any) => [f.id, f]));
          setFields(DEFAULT_TAX_FIELDS.map(def => {
            const custom = parsedMap.get(def.id);
            if (custom) return { ...def, x: custom.x, y: custom.y, fontSize: custom.fontSize, pitch: custom.pitch !== undefined ? custom.pitch : def.pitch };
            return def;
          }));
        } else {
          const localSaved = localStorage.getItem('taxDocMasterFields');
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            const parsedMap = new Map<string, any>(parsed.map((f: any) => [f.id, f]));
            setFields(DEFAULT_TAX_FIELDS.map(def => {
              const custom = parsedMap.get(def.id);
              if (custom) return { ...def, x: custom.x, y: custom.y, fontSize: custom.fontSize, pitch: custom.pitch !== undefined ? custom.pitch : def.pitch };
              return def;
            }));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMaster();
  }, []);

  const [bgBlankPdfImage, setBgBlankPdfImage] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  // 項目値の更新（pitchは0.01%精度、x/yは0.1%精度、fontSizeは1pt精度）
  const updateField = useCallback((id: string, key: keyof FieldConfig, value: number) => {
    setFields(prev => {
      const precision = key === 'pitch' ? 100 : (key === 'x' || key === 'y') ? 10 : 1;
      const rounded = Math.round(value * precision) / precision;
      const updated = prev.map(f => f.id === id ? { ...f, [key]: rounded } : f);
      localStorage.setItem('taxDocMasterFields', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const selectedField = fields.find(f => f.id === selectedFieldId);
  const sectionFields = fields.filter(f => f.section === selectedSection);

  // 🖐️ 手のひらパン開始 (背景や用紙のMouseDown)
  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || draggingFieldId) return;
    if (!scrollContainerRef.current) return;
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop
    };
  };

  // 🖱️ ドラッグ開始 (MouseDown on Item)
  const handleStartDrag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(id);
    setDraggingFieldId(id);

    const target = fields.find(f => f.id === id);
    if (!target) return;

    if (target.section !== selectedSection) {
      setSelectedSection(target.section as any);
    }

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: target.x,
      startY: target.y
    };
  };

  // 🖱️ グローバル（Window全体）マウス移動リスナー
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. 項目ドラッグ処理
      if (draggingFieldId && dragStartRef.current && previewContainerRef.current) {
        const rect = previewContainerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const deltaX = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
          const deltaY = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

          const newX = Math.max(0, Math.min(100, dragStartRef.current.startX + deltaX));
          const newY = Math.max(0, Math.min(100, dragStartRef.current.startY + deltaY));

          updateField(draggingFieldId, 'x', newX);
          updateField(draggingFieldId, 'y', newY);
        }
        return;
      }

      // 2. 用紙・背景パン（手のひらスクロール移動）処理
      if (isPanningRef.current && scrollContainerRef.current) {
        const dx = e.clientX - panStartRef.current.startX;
        const dy = e.clientY - panStartRef.current.startY;
        scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
        scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      }
    };

    const handleGlobalMouseUp = () => {
      if (draggingFieldId) {
        setDraggingFieldId(null);
        dragStartRef.current = null;
      }
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingFieldId, updateField]);

  // ⌨️ 全画面グローバルキーボードリスナー（PCの矢印キーでいつでも動かせる！）
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (!selectedFieldId) return;
      const target = fields.find(f => f.id === selectedFieldId);
      if (!target) return;

      const step = e.shiftKey ? 1.0 : 0.1;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateField(selectedFieldId, 'y', target.y - step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateField(selectedFieldId, 'y', target.y + step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updateField(selectedFieldId, 'x', target.x - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateField(selectedFieldId, 'x', target.x + step);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedFieldId, fields, updateField]);

  // 背景用の白紙PDF原本（文字なし）をCanvasから生成
  useEffect(() => {
    let isCancelled = false;

    const renderBlankPdf = async () => {
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

        const scale = 2.0;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 文字は一切描画せず、純粋な国税庁原本用紙だけをレンダリング
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (isCancelled) return;

        const url = canvas.toDataURL('image/png');
        setBgBlankPdfImage(url);
        setIsRendering(false);
      } catch (e) {
        console.error(e);
        setIsRendering(false);
      }
    };

    renderBlankPdf();
    return () => { isCancelled = true; };
  }, []);

  // 全社マスター保存
  const handleSaveMaster = async () => {
    setIsSaving(true);
    try {
      const { data: current } = await supabase.from('system_settings').select('id').limit(1).single();
      if (current) {
        await supabase.from('system_settings').update({ tax_doc_coordinates: fields }).eq('id', current.id);
      } else {
        await supabase.from('system_settings').insert([{ tax_doc_coordinates: fields }]);
      }
      localStorage.setItem('taxDocMasterFields', JSON.stringify(fields));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm('すべての項目の座標・文字サイズを黄金比率マスター初期値にリセットしますか？')) {
      setFields(DEFAULT_TAX_FIELDS);
      localStorage.removeItem('taxDocMasterFields');
    }
  };

  const sections = [
    { id: 'header', name: '① 給与支払者・会社枠', icon: Building2, count: fields.filter(f => f.section === 'header').length },
    { id: 'employee', name: '② 申告者本人・基本枠', icon: User, count: fields.filter(f => f.section === 'employee').length },
    { id: 'spouse', name: '③ Ａ. 源泉控除対象配偶者', icon: Heart, count: fields.filter(f => f.section === 'spouse').length },
    { id: 'dependent', name: '④ Ｂ. 控除対象扶養親族(1〜4人目)', icon: Users, count: fields.filter(f => f.section === 'dependent').length },
    { id: 'special', name: '⑤ Ｃ. 障害者・寡婦・学生', icon: Shield, count: fields.filter(f => f.section === 'special').length },
    { id: 'resident', name: '⑥ 住民税 16歳未満親族(1〜2人目)', icon: Baby, count: fields.filter(f => f.section === 'resident').length }
  ];

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 🧭 ヘッダー ＆ 保存バー */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600 rounded-xl text-white">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                国税庁公的帳票（令和8年分 扶養控除等申告書）マスター項目設定
                <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-md">
                  販売者・全社一括マスタ（扶養4名・住民税4名 フル完備）
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                画面上の大きな十字キーボタン、PCの矢印キー（↑ ↓ ← →）、またはマウスドラッグで位置をミリ単位で動かせます。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="黄金比率の初期配置に戻す"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            黄金比率初期リセット
          </button>

          <button
            onClick={() => {
              const code = `export const TAX_DOC_FIELDS = ${JSON.stringify(fields, null, 2)};`;
              navigator.clipboard.writeText(code);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
            {copiedCode ? 'コピー完了！' : 'TypeScriptコード'}
          </button>

          <button
            onClick={handleSaveMaster}
            disabled={isSaving}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedSuccess ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
            {savedSuccess ? '全社マスターへ保存完了！' : '全社マスターとして保存・適用'}
          </button>
        </div>
      </div>

      {/* 2カラム構成：左（項目選択＆十字キーコントローラー） ＋ 右（直接ドラッグ可能な用紙ビュー） */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* ⬅️ 左カラム */}
        <div className="col-span-12 lg:col-span-5 space-y-3">
          
          {/* ① セクション選択タブ */}
          <div className="bg-white p-2 rounded-2xl shadow-xs border border-slate-200 grid grid-cols-2 gap-1.5">
            {sections.map(s => {
              const Icon = s.icon;
              const isSelected = selectedSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSection(s.id as any);
                    const first = fields.find(f => f.section === s.id);
                    if (first) setSelectedFieldId(first.id);
                  }}
                  className={`p-2 rounded-xl text-left transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                    <span className="text-xs truncate">{s.name}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ② 選択中セクションの項目一覧リスト */}
          <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 space-y-1.5">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 flex items-center justify-between">
              <span>設定する項目を選択</span>
              <span className="text-[10px] text-slate-400">右側で直接掴んで移動可能</span>
            </h3>

            <div className="space-y-1 max-h-[170px] overflow-y-auto pr-1">
              {sectionFields.map(f => {
                const isSelected = selectedFieldId === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFieldId(f.id)}
                    className={`p-2 rounded-xl transition cursor-pointer border flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-500 shadow-xs'
                        : 'bg-slate-50/50 hover:bg-slate-100/80 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-slate-300'}`}></span>
                        <span className="text-xs font-bold text-slate-900">{f.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 ml-3.5">
                        例: <span className="font-mono text-slate-700 bg-white px-1 rounded border border-slate-200">{f.example}</span>
                      </p>
                    </div>

                    <div className="text-right font-mono text-[10px]">
                      <span className="text-indigo-600 font-bold">X:{f.x.toFixed(1)}%</span>
                      <span className="text-slate-400 mx-0.5">/</span>
                      <span className="text-amber-600 font-bold">Y:{f.y.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 🎮 ③ 選択中項目の「十字キーコントローラー ＆ 数値直接入力」パネル */}
          {selectedField && (
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 space-y-3">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">SELECTED ITEM</span>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                    {selectedField.name}
                  </h4>
                </div>
                <div className="text-right font-mono text-xs text-amber-300 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">
                  X: <span className="text-indigo-300 font-bold">{selectedField.x.toFixed(1)}%</span> / Y: <span className="text-amber-300 font-bold">{selectedField.y.toFixed(1)}%</span>
                </div>
              </div>

              {/* 十字キー（十字ボタンコントローラー） ＆ 数値直接入力 */}
              <div className="grid grid-cols-12 gap-3 items-center">
                
                {/* 🎮 十字コントローラー */}
                <div className="col-span-7 bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80 flex flex-col items-center justify-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 mb-1">🎮 位置を動かす十字ボタン</span>
                  
                  {/* 上ボタン（1.0% / 0.1%） */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y - 1.0)}
                      className="px-2 py-1 bg-slate-700 hover:bg-indigo-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer flex items-center gap-0.5"
                      title="上へ大きく移動 (1.0%)"
                    >
                      <ChevronsUp className="w-3.5 h-3.5" /> -1%
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y - 0.1)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="上へ微調整 (0.1%)"
                    >
                      <ArrowUp className="w-4 h-4" /> 上
                    </button>
                  </div>

                  {/* 左右ボタン */}
                  <div className="flex items-center gap-2 my-0.5">
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x - 1.0)}
                        className="px-1.5 py-1 bg-slate-700 hover:bg-indigo-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer"
                        title="左へ大きく移動 (1.0%)"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x - 0.1)}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-0.5 text-xs"
                        title="左へ微調整 (0.1%)"
                      >
                        <ArrowLeft className="w-4 h-4" /> 左
                      </button>
                    </div>

                    <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[9px] text-amber-400 font-mono">
                      ●
                    </span>

                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x + 0.1)}
                        className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-0.5 text-xs"
                        title="右へ微調整 (0.1%)"
                      >
                        右 <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x + 1.0)}
                        className="px-1.5 py-1 bg-slate-700 hover:bg-indigo-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer"
                        title="右へ大きく移動 (1.0%)"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 下ボタン（0.1% / 1.0%） */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y + 0.1)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="下へ微調整 (0.1%)"
                    >
                      <ArrowDown className="w-4 h-4" /> 下
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y + 1.0)}
                      className="px-2 py-1 bg-slate-700 hover:bg-indigo-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer flex items-center gap-0.5"
                      title="下へ大きく移動 (1.0%)"
                    >
                      <ChevronsDown className="w-3.5 h-3.5" /> +1%
                    </button>
                  </div>
                </div>

                {/* 🔢 数値直接入力 ＆ 文字サイズ */}
                <div className="col-span-5 space-y-2">
                  {/* 横位置 X */}
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <label className="block text-[10px] text-slate-400 mb-0.5">横位置 (X %):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedField.x}
                      onChange={e => updateField(selectedField.id, 'x', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-mono font-bold text-indigo-300"
                    />
                  </div>

                  {/* 縦位置 Y */}
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <label className="block text-[10px] text-slate-400 mb-0.5">縦位置 (Y %):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedField.y}
                      onChange={e => updateField(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-mono font-bold text-amber-300"
                    />
                  </div>

                  {/* 文字サイズ */}
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span>文字サイズ:</span>
                      <span className="font-mono font-bold text-emerald-300">{selectedField.fontSize} pt</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'fontSize', Math.max(4, selectedField.fontSize - 1))}
                        className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded text-white text-xs font-bold cursor-pointer"
                        title="文字を小さく (-1)"
                      >-</button>
                      <input
                        type="number"
                        min="4"
                        max="24"
                        value={selectedField.fontSize}
                        onChange={e => updateField(selectedField.id, 'fontSize', parseInt(e.target.value, 10) || 4)}
                        className="w-12 bg-slate-900 border border-slate-700 rounded p-1 text-center text-xs font-mono font-bold text-emerald-300"
                      />
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'fontSize', Math.min(24, selectedField.fontSize + 1))}
                        className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded text-white text-xs font-bold cursor-pointer"
                        title="文字を大きく (+1)"
                      >+</button>
                    </div>
                  </div>
                </div>

              </div>

              {/* 数字・マス目間隔（ピッチ % / 0.01%精密微調整対応） */}
              {selectedField.pitch !== undefined ? (
                <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-300 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      数字・マス目文字間隔 (ピッチ %):
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-300">{(selectedField.pitch || 1.00).toFixed(2)} %</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, pitch: undefined } : f));
                        }}
                        className="text-[9px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                        title="文字間隔を通常に戻す"
                      >
                        通常に戻す
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'pitch', Math.max(0.2, (selectedField.pitch || 1.00) - 0.01))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                      title="0.01% 狭くする"
                    >
                      -0.01
                    </button>

                    <input
                      type="number"
                      step="0.01"
                      min="0.20"
                      max="5.00"
                      value={(selectedField.pitch || 1.00).toFixed(2)}
                      onChange={e => updateField(selectedField.id, 'pitch', parseFloat(e.target.value) || 1.00)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-xs font-mono font-bold text-cyan-300"
                    />

                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'pitch', Math.min(5.0, (selectedField.pitch || 1.00) + 0.01))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                      title="0.01% 広くする"
                    >
                      +0.01
                    </button>

                    <input
                      type="range"
                      min="0.30"
                      max="3.50"
                      step="0.01"
                      value={selectedField.pitch || 1.00}
                      onChange={e => updateField(selectedField.id, 'pitch', parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => updateField(selectedField.id, 'pitch', 1.00)}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-dashed border-slate-700 cursor-pointer transition flex items-center gap-1"
                  >
                    <span>＋</span> この項目の数字・文字間隔（ピッチ）を有効にする
                  </button>
                </div>
              )}

              <div className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                💡 PCのキーボードの矢印キー（↑ ↓ ← →）を押しても直接動かせます（Shift+矢印で大きく移動）
              </div>
            </div>
          )}

        </div>

        {/* ➡️ 右カラム：白紙原本の上にドラッグ可能なテキストボックスを直接配置 */}
        <div className="col-span-12 lg:col-span-7 bg-white p-3 rounded-2xl shadow-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                国税庁原本（2026bun_01.pdf）リアルタイムプレビュー
              </h3>
              <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                赤枠 = 選択中項目
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                className="p-1 bg-white hover:bg-slate-200 active:scale-95 rounded text-slate-700 font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                title="縮小 (-10%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(100)}
                className="px-2 py-0.5 bg-white hover:bg-slate-200 active:scale-95 rounded text-slate-700 font-mono font-bold text-xs cursor-pointer transition shadow-xs"
                title="クリックで100%（等倍）にリセット"
              >
                {previewZoom}%
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(z => Math.min(250, z + 10))}
                className="p-1 bg-white hover:bg-slate-200 active:scale-95 rounded text-slate-700 font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                title="拡大 (+10%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {previewZoom !== 100 && (
                <button
                  type="button"
                  onClick={() => setPreviewZoom(100)}
                  className="p-1 bg-white hover:bg-indigo-50 text-indigo-600 active:scale-95 rounded font-bold cursor-pointer transition shadow-xs text-[10px] flex items-center gap-0.5"
                  title="等倍に戻す"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            onMouseDown={handlePanMouseDown}
            className={`w-full bg-slate-200/80 rounded-xl overflow-auto p-4 border border-slate-300 max-h-[750px] min-h-[500px] select-none ${
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{ scrollBehavior: 'auto' }}
            title="マウスドラッグで用紙全体を自由にスクロール移動できます"
          >
            {isRendering && (
              <div className="flex flex-col items-center justify-center py-20 space-y-2">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <p className="text-xs font-bold text-slate-500">国税庁原本用紙を読み込み中...</p>
              </div>
            )}

            {/* 隠しCanvas */}
            <canvas ref={canvasRef} className="hidden" />

            {bgBlankPdfImage && (
              <div className="w-fit min-w-full min-h-full flex items-center justify-center p-2">
                <div 
                  ref={previewContainerRef}
                  style={{ 
                    width: `${previewZoom}%`, 
                    minWidth: `${previewZoom}%`,
                    maxWidth: `${previewZoom}%`,
                    flexShrink: 0,
                    position: 'relative',
                    aspectRatio: '297 / 210',
                    containerType: 'inline-size'
                  }}
                  className="m-auto shadow-2xl rounded-lg overflow-hidden border-2 border-slate-400/90 bg-white transition-all duration-150 cursor-default"
                >
                {/* 📄 白紙の国税庁原本PDF用紙（背景画像） */}
                <img
                  src={bgBlankPdfImage}
                  alt="国税庁原本用紙（白紙）"
                  className="w-full h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />

                {/* 🎯 原本用紙の上で直接ドラッグ可能な全フィールドボックス（cqwによる厳密コンテナ連動） */}
                {fields.map(f => {
                  const isSelected = selectedFieldId === f.id;
                  const isDraggingThis = draggingFieldId === f.id;

                  return (
                    <div
                      key={f.id}
                      onMouseDown={e => handleStartDrag(f.id, e)}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedFieldId(f.id);
                        if (f.section !== selectedSection) setSelectedSection(f.section as any);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        transform: 'translate(0, -50%)',
                        fontSize: `${f.fontSize * 0.115}cqw`,
                        color: isSelected ? '#b91c1c' : '#0f172a',
                        fontWeight: 'bold',
                        cursor: isDraggingThis ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'auto',
                        lineHeight: 1
                      }}
                      className={`px-0.5 py-0.5 rounded transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-rose-500 bg-rose-500/20 shadow-2xl z-30 font-black'
                          : 'hover:ring-1 hover:ring-indigo-500 hover:bg-indigo-100/60 z-10 bg-white/50'
                      }`}
                      title={`${f.name} (クリックして選択・十字キーまたはドラッグで移動)`}
                    >
                      {f.pitch ? (
                        <span className="flex items-center">
                          {f.example.split('').map((c, idx) => (
                            <span 
                              key={idx} 
                              style={{ 
                                display: 'inline-block', 
                                width: `${(f.pitch || 1.80)}cqw`, 
                                textAlign: 'center' 
                              }}
                            >
                              {c}
                            </span>
                          ))}
                        </span>
                      ) : f.example === '○' ? (
                        <span className="w-[1.4cqw] h-[1.4cqw] rounded-full border-2 border-blue-600 inline-block"></span>
                      ) : f.example === '✓' ? (
                        <span className="text-blue-600 font-black">✓</span>
                      ) : (
                        f.example
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
