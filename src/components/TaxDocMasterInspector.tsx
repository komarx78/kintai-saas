import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Copy, Check, 
  Building2, User, Users, Heart, Shield, Baby, FileText, CheckCircle2, Loader2
} from 'lucide-react';

interface FieldConfig {
  id: string;
  name: string;
  section: string;
  x: number; // 0〜100 (%)
  y: number; // 0〜100 (%)
  fontSize: number; // px (10〜32)
  pitch?: number; // % (マイナンバー用)
  example: string;
  description: string;
}

export const TaxDocMasterInspector: React.FC = () => {
  // セクション定義
  const [selectedSection, setSelectedSection] = useState<'header' | 'employee' | 'spouse' | 'dependent' | 'special' | 'resident'>('header');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('companyName');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // 項目別マスタ座標State
  const [fields, setFields] = useState<FieldConfig[]>(() => {
    return [
      // ① 給与支払者
      { id: 'taxOffice', name: '所轄税務署長', section: 'header', x: 8.8, y: 9.8, fontSize: 18, example: '千代田', description: '左上「税務署長等」枠内' },
      { id: 'municipality', name: '市区町村長', section: 'header', x: 7.8, y: 13.8, fontSize: 18, example: '千代田区', description: '「市区町村長」枠内' },
      { id: 'companyName', name: '給与支払者の名称（会社名）', section: 'header', x: 23.5, y: 8.8, fontSize: 22, example: '株式会社KAP', description: '給与支払者 1段目' },
      { id: 'corporateNumber', name: '法人番号（13桁）', section: 'header', x: 23.5, y: 11.4, fontSize: 20, example: '1010001999999', description: '給与支払者 2段目' },
      { id: 'companyAddress', name: '所在地（住所）', section: 'header', x: 23.5, y: 14.2, fontSize: 16, example: '滋賀県大津市坂本3丁目21-16', description: '給与支払者 3段目' },

      // ② 申告者本人
      { id: 'empKana', name: 'あなたのフリガナ', section: 'employee', x: 44.0, y: 7.5, fontSize: 14, example: 'テスト', description: '「（フリガナ）」行' },
      { id: 'empName', name: 'あなたの氏名', section: 'employee', x: 44.0, y: 9.5, fontSize: 28, example: '駒井 秀一朗', description: '「あなたの氏名」枠内' },
      { id: 'empMyNumber', name: 'あなたの個人番号（12桁マス目）', section: 'employee', x: 42.8, y: 12.3, fontSize: 20, pitch: 1.82, example: '123456789012', description: '12マスの四角枠' },
      { id: 'empPostal', name: 'あなたの郵便番号', section: 'employee', x: 50.5, y: 14.0, fontSize: 16, example: '160-0023', description: '住所欄の〒右側' },
      { id: 'empAddress', name: 'あなたの住所', section: 'employee', x: 42.5, y: 15.2, fontSize: 17, example: '京都市山科区大塚西浦町3-57', description: 'あなたの住所又は居所' },
      { id: 'empBirthY', name: '生年月日（年）', section: 'employee', x: 68.2, y: 7.5, fontSize: 18, example: '7', description: '生年月日の「年」枠' },
      { id: 'empBirthM', name: '生年月日（月）', section: 'employee', x: 72.5, y: 7.5, fontSize: 18, example: '4', description: '生年月日の「月」枠' },
      { id: 'empBirthD', name: '生年月日（日）', section: 'employee', x: 75.5, y: 7.5, fontSize: 18, example: '1', description: '生年月日の「日」枠' },
      { id: 'householderName', name: '世帯主の氏名', section: 'employee', x: 67.5, y: 9.8, fontSize: 18, example: 'テスト テスト', description: '世帯主欄' },
      { id: 'householderRel', name: 'あなたとの続柄', section: 'employee', x: 67.5, y: 12.2, fontSize: 18, example: '本人', description: '続柄欄' },
      { id: 'hasSpouseYes', name: '配偶者 有（○印）', section: 'employee', x: 74.2, y: 14.8, fontSize: 18, example: '○', description: '「有」の文字を囲む円' },

      // ③ Ａ. 配偶者
      { id: 'spouseKana', name: '配偶者フリガナ', section: 'spouse', x: 16.5, y: 20.8, fontSize: 13, example: 'テスト ハナコ', description: 'Ａ欄フリガナ' },
      { id: 'spouseName', name: '配偶者氏名', section: 'spouse', x: 16.5, y: 22.2, fontSize: 20, example: 'テスト 花子', description: 'Ａ欄氏名' },
      { id: 'spouseMyNumber', name: '配偶者マイナンバー', section: 'spouse', x: 26.5, y: 22.2, fontSize: 16, pitch: 0.98, example: '************', description: 'Ａ欄12桁マス目' },
      { id: 'spouseRel', name: '配偶者続柄', section: 'spouse', x: 34.5, y: 22.2, fontSize: 18, example: '妻', description: 'Ａ欄続柄' },
      { id: 'spouseBirthY', name: '配偶者生年', section: 'spouse', x: 40.5, y: 22.2, fontSize: 18, example: '8', description: 'Ａ欄生年' },
      { id: 'spouseBirthM', name: '配偶者生月', section: 'spouse', x: 43.2, y: 22.2, fontSize: 18, example: '5', description: 'Ａ欄生月' },
      { id: 'spouseBirthD', name: '配偶者生日', section: 'spouse', x: 45.8, y: 22.2, fontSize: 18, example: '15', description: 'Ａ欄生日' },
      { id: 'spouseIncome', name: '配偶者所得見積額', section: 'spouse', x: 53.5, y: 22.2, fontSize: 17, example: '0 円', description: 'Ａ欄所得見積額' },
      { id: 'spouseLiving', name: '生計を一にする事実', section: 'spouse', x: 58.5, y: 22.2, fontSize: 15, example: '同居', description: 'Ａ欄生計一事実' },
      { id: 'spouseAddress', name: '配偶者住所', section: 'spouse', x: 64.0, y: 22.2, fontSize: 15, example: '京都市山科区大塚西浦町3-57', description: 'Ａ欄住所' },

      // ④ Ｂ. 扶養親族（1人目）
      { id: 'dep0Kana', name: '扶養親族1 フリガナ', section: 'dependent', x: 16.5, y: 24.2, fontSize: 13, example: 'テスト タロウ', description: 'Ｂ欄1行目フリガナ' },
      { id: 'dep0Name', name: '扶養親族1 氏名', section: 'dependent', x: 16.5, y: 25.6, fontSize: 19, example: 'テスト タロウ', description: 'Ｂ欄1行目氏名' },
      { id: 'dep0MyNumber', name: '扶養親族1 マイナンバー', section: 'dependent', x: 26.5, y: 25.6, fontSize: 16, pitch: 0.98, example: '************', description: 'Ｂ欄1行目12桁マス目' },
      { id: 'dep0Rel', name: '扶養親族1 続柄', section: 'dependent', x: 34.5, y: 25.6, fontSize: 17, example: '長男', description: 'Ｂ欄1行目続柄' },
      { id: 'dep0BirthY', name: '扶養親族1 生年', section: 'dependent', x: 40.5, y: 25.6, fontSize: 17, example: '27', description: 'Ｂ欄1行目生年' },
      { id: 'dep0BirthM', name: '扶養親族1 生月', section: 'dependent', x: 43.2, y: 25.6, fontSize: 17, example: '5', description: 'Ｂ欄1行目生月' },
      { id: 'dep0BirthD', name: '扶養親族1 生日', section: 'dependent', x: 45.8, y: 25.6, fontSize: 17, example: '1', description: 'Ｂ欄1行目生日' },
      { id: 'dep0Income', name: '扶養親族1 所得見積額', section: 'dependent', x: 53.5, y: 25.6, fontSize: 17, example: '0 円', description: 'Ｂ欄1行目所得' },
      { id: 'dep0Living', name: '扶養親族1 同居別居', section: 'dependent', x: 58.5, y: 25.6, fontSize: 15, example: '同居', description: 'Ｂ欄1行目生計一' },
      { id: 'dep0Address', name: '扶養親族1 住所', section: 'dependent', x: 64.0, y: 25.6, fontSize: 15, example: '京都市山科区大塚西浦町3-57', description: 'Ｂ欄1行目住所' },

      // ⑤ Ｃ. 障害者等
      { id: 'specialDisabled', name: '障害者チェック（✓）', section: 'special', x: 12.2, y: 38.8, fontSize: 20, example: '✓', description: 'Ｃ欄障害者ボックス' },
      { id: 'specialWidow', name: '寡婦チェック（✓）', section: 'special', x: 31.5, y: 38.8, fontSize: 20, example: '✓', description: 'Ｃ欄寡婦ボックス' },
      { id: 'specialSingle', name: 'ひとり親チェック（✓）', section: 'special', x: 35.0, y: 38.8, fontSize: 20, example: '✓', description: 'Ｃ欄ひとり親ボックス' },
      { id: 'specialStudent', name: '勤労学生チェック（✓）', section: 'special', x: 39.2, y: 38.8, fontSize: 20, example: '✓', description: 'Ｃ欄勤労学生ボックス' },
      { id: 'specialDetails', name: '障害者・学生の内容', section: 'special', x: 46.5, y: 39.2, fontSize: 16, example: '障害者手帳第1種', description: 'Ｃ欄内容記載枠' },

      // ⑥ 住民税（16歳未満）
      { id: 'u16_0Kana', name: '16歳未満1 フリガナ', section: 'resident', x: 16.5, y: 52.5, fontSize: 13, example: 'テスト ジロウ', description: '住民税欄1行目カナ' },
      { id: 'u16_0Name', name: '16歳未満1 氏名', section: 'resident', x: 16.5, y: 53.8, fontSize: 19, example: 'テスト 次郎', description: '住民税欄1行目氏名' },
      { id: 'u16_0MyNumber', name: '16歳未満1 マイナンバー', section: 'resident', x: 27.5, y: 53.8, fontSize: 16, pitch: 0.98, example: '************', description: '住民税欄12桁マス目' },
      { id: 'u16_0Rel', name: '16歳未満1 続柄', section: 'resident', x: 38.5, y: 53.8, fontSize: 17, example: '二男', description: '住民税欄続柄' },
      { id: 'u16_0BirthY', name: '16歳未満1 生年', section: 'resident', x: 42.5, y: 53.8, fontSize: 17, example: '30', description: '住民税欄生年' },
      { id: 'u16_0BirthM', name: '16歳未満1 生月', section: 'resident', x: 44.8, y: 53.8, fontSize: 17, example: '8', description: '住民税欄生月' },
      { id: 'u16_0BirthD', name: '16歳未満1 生日', section: 'resident', x: 47.2, y: 53.8, fontSize: 17, example: '20', description: '住民税欄生日' },
      { id: 'u16_0Address', name: '16歳未満1 住所', section: 'resident', x: 53.0, y: 53.8, fontSize: 15, example: '京都市山科区大塚西浦町3-57', description: '住民税欄住所' },
      { id: 'u16_0Income', name: '16歳未満1 所得見積額', section: 'resident', x: 74.5, y: 53.8, fontSize: 17, example: '0 円', description: '住民税欄所得' }
    ];
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 項目値の更新
  const updateField = (id: string, key: keyof FieldConfig, value: number) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  const selectedField = fields.find(f => f.id === selectedFieldId);
  const sectionFields = fields.filter(f => f.section === selectedSection);

  // リアルタイム Canvas レンダリング（プレビュー）
  useEffect(() => {
    let isCancelled = false;

    const render = async () => {
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

        // 原本描画
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (isCancelled) return;

        const W = canvas.width;
        const H = canvas.height;
        ctx.fillStyle = '#0f172a';
        ctx.textBaseline = 'middle';

        // 各フィールドの描画
        fields.forEach(f => {
          const posX = (f.x / 100) * W;
          const posY = (f.y / 100) * H;
          const fPx = Math.round((f.fontSize / 1000) * W * 1.6);

          ctx.font = `bold ${fPx}px "Noto Sans JP", sans-serif`;

          // 選択中項目のハイライト枠
          if (f.id === selectedFieldId) {
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 3;
            ctx.strokeRect(posX - 4, posY - fPx / 2 - 2, 120, fPx + 4);
          }

          if (f.pitch) {
            // マイナンバーマス目
            const pitch = (f.pitch / 100) * W;
            for (let i = 0; i < f.example.length; i++) {
              ctx.fillText(f.example[i], posX + i * pitch, posY);
            }
          } else if (f.example === '○') {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(posX, posY, 12, 0, Math.PI * 2);
            ctx.stroke();
          } else if (f.example === '✓') {
            ctx.fillStyle = '#2563eb';
            ctx.fillText('✓', posX, posY);
            ctx.fillStyle = '#0f172a';
          } else {
            ctx.fillText(f.example, posX, posY);
          }
        });

        const url = canvas.toDataURL('image/png');
        setPreviewImage(url);
        setIsRendering(false);
      } catch (e) {
        console.error(e);
        setIsRendering(false);
      }
    };

    render();
    return () => { isCancelled = true; };
  }, [fields, selectedFieldId]);

  // 全社マスター保存
  const handleSaveMaster = () => {
    setIsSaving(true);
    localStorage.setItem('taxDocMasterFields', JSON.stringify(fields));
    setTimeout(() => {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }, 600);
  };

  const sections = [
    { id: 'header', name: '① 給与支払者・会社枠', icon: Building2, count: fields.filter(f => f.section === 'header').length },
    { id: 'employee', name: '② 申告者本人・基本枠', icon: User, count: fields.filter(f => f.section === 'employee').length },
    { id: 'spouse', name: '③ Ａ. 源泉控除対象配偶者', icon: Heart, count: fields.filter(f => f.section === 'spouse').length },
    { id: 'dependent', name: '④ Ｂ. 控除対象扶養親族', icon: Users, count: fields.filter(f => f.section === 'dependent').length },
    { id: 'special', name: '⑤ Ｃ. 障害者・寡婦・学生', icon: Shield, count: fields.filter(f => f.section === 'special').length },
    { id: 'resident', name: '⑥ 住民税（16歳未満親族）', icon: Baby, count: fields.filter(f => f.section === 'resident').length }
  ];

  return (
    <div className="space-y-4">
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
                  販売者・全社一括マスタ
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                国税庁原本PDF（2026bun_01.pdf）の各マス目に対する文字の着地位置（X/Y %）とフォントサイズを項目ごとにひとつずつ精密定義します。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            {copiedCode ? 'コピー完了！' : 'TypeScriptコードをコピー'}
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

      {/* 2カラム構成：左（セクション＆項目インスペクター） ＋ 右（リアルタイム原本プレビュー） */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* ⬅️ 左カラム：セクション選択 ＆ 項目リスト ＆ 精密数値設定 */}
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
                  className={`p-2.5 rounded-xl text-left transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
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
          <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200 space-y-2">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>設定する項目を選択（全{sectionFields.length}項目）</span>
              <span className="text-[11px] text-slate-400">クリックして右側の詳細数値を設定</span>
            </h3>

            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {sectionFields.map(f => {
                const isSelected = selectedFieldId === f.id;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFieldId(f.id)}
                    className={`p-2.5 rounded-xl transition cursor-pointer border flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-500 shadow-xs'
                        : 'bg-slate-50/50 hover:bg-slate-100/80 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-600 ring-2 ring-indigo-300' : 'bg-slate-300'}`}></span>
                        <span className="text-xs font-bold text-slate-900">{f.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 ml-4">
                        例: <span className="font-mono text-slate-700 bg-white px-1 rounded border border-slate-200">{f.example}</span>
                        <span className="ml-2 text-slate-400">({f.description})</span>
                      </p>
                    </div>

                    <div className="text-right font-mono text-[11px]">
                      <span className="text-indigo-600 font-bold">X:{f.x.toFixed(1)}%</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-amber-600 font-bold">Y:{f.y.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ③ 選択中項目の精密設定インスペクター */}
          {selectedField && (
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 space-y-3 animate-in fade-in duration-150">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">SELECTED ITEM</span>
                  <h4 className="text-sm font-bold text-white">{selectedField.name}</h4>
                </div>
                <span className="text-xs font-mono bg-slate-800 text-amber-300 px-2.5 py-1 rounded-lg border border-slate-700">
                  {selectedField.id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* X位置 (%) */}
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">横位置 (X軸 %):</span>
                    <span className="font-mono font-bold text-indigo-300">{selectedField.x.toFixed(1)} %</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateField(selectedField.id, 'x', Math.max(0, selectedField.x - 0.1))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                    >◀ -0.1</button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={selectedField.x}
                      onChange={e => updateField(selectedField.id, 'x', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <button
                      onClick={() => updateField(selectedField.id, 'x', Math.min(100, selectedField.x + 0.1))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                    >+0.1 ▶</button>
                  </div>
                </div>

                {/* Y位置 (%) */}
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">縦位置 (Y軸 %):</span>
                    <span className="font-mono font-bold text-amber-300">{selectedField.y.toFixed(1)} %</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateField(selectedField.id, 'y', Math.max(0, selectedField.y - 0.1))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                    >▲ -0.1</button>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={selectedField.y}
                      onChange={e => updateField(selectedField.id, 'y', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <button
                      onClick={() => updateField(selectedField.id, 'y', Math.min(100, selectedField.y + 0.1))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                    >+0.1 ▼</button>
                  </div>
                </div>

                {/* 文字サイズ (px) */}
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">文字の大きさ (px):</span>
                    <span className="font-mono font-bold text-emerald-300">{selectedField.fontSize} px</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateField(selectedField.id, 'fontSize', Math.max(8, selectedField.fontSize - 1))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                    >-</button>
                    <input
                      type="range"
                      min="8"
                      max="32"
                      step="1"
                      value={selectedField.fontSize}
                      onChange={e => updateField(selectedField.id, 'fontSize', parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <button
                      onClick={() => updateField(selectedField.id, 'fontSize', Math.min(32, selectedField.fontSize + 1))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                    >+</button>
                  </div>
                </div>

                {/* 12桁マイナンバーマス目ピッチ (該当項目のみ) */}
                {selectedField.pitch !== undefined && (
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">マス目間隔 (ピッチ %):</span>
                      <span className="font-mono font-bold text-cyan-300">{selectedField.pitch.toFixed(2)} %</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateField(selectedField.id, 'pitch', Math.max(0.5, (selectedField.pitch || 1.82) - 0.02))}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                      >-</button>
                      <input
                        type="range"
                        min="0.5"
                        max="3.0"
                        step="0.02"
                        value={selectedField.pitch || 1.82}
                        onChange={e => updateField(selectedField.id, 'pitch', parseFloat(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                      <button
                        onClick={() => updateField(selectedField.id, 'pitch', Math.min(3.0, (selectedField.pitch || 1.82) + 0.02))}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs font-bold cursor-pointer"
                      >+</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ➡️ 右カラム：国税庁PDF原本へのリアルタイム印字プレビュー */}
        <div className="col-span-12 lg:col-span-7 bg-white p-3 rounded-2xl shadow-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-xs font-bold text-slate-800">原本リアルタイム印字プレビュー（2026bun_01.pdf）</h3>
              <span className="text-[11px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                赤枠 = 現在選択中の項目
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">ズーム:</span>
              <button
                onClick={() => setPreviewZoom(z => Math.max(70, z - 10))}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold"
              >-</button>
              <span className="font-mono font-bold text-slate-700">{previewZoom}%</span>
              <button
                onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold"
              >+</button>
            </div>
          </div>

          <div className="w-full bg-slate-100 rounded-xl overflow-auto p-2 border border-slate-200 max-h-[680px]">
            {isRendering && (
              <div className="flex flex-col items-center justify-center py-20 space-y-2">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <p className="text-xs font-bold text-slate-500">原本PDFプレビューを生成中...</p>
              </div>
            )}

            {/* 隠しCanvas */}
            <canvas ref={canvasRef} className="hidden" />

            {previewImage && (
              <div style={{ width: `${previewZoom}%`, margin: '0 auto', transition: 'width 0.15s ease' }}>
                <img
                  src={previewImage}
                  alt="原本印字プレビュー"
                  className="w-full h-auto rounded shadow-sm border border-slate-300"
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
