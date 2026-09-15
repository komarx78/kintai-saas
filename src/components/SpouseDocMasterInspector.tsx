import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Save, RotateCcw, CheckCircle2, 
  ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Sliders, Eye, Sparkles, Building2, UserCheck, Heart, GraduationCap, Scale
} from 'lucide-react';
import { 
  DEFAULT_SPOUSE_DOC_FIELDS,
  loadSpouseDocCoordinates,
  saveSpouseDocCoordinates,
  saveSpouseDocCoordinatesToDb,
  fetchSpouseDocCoordinatesFromDb,
  broadcastSpouseDocCoordinates,
  type SpouseDocFieldConfig,
  type SpouseDocSection
} from '../lib/spouseDocCoordinates';
import OfficialSpouseDeductionDoc, { type SpouseDeductionDocData } from './OfficialSpouseDeductionDoc';

export const SpouseDocMasterInspector: React.FC = () => {
  // モード: 'inspector' (座標微調整) | 'input_preview' (実際の直接入力プレビュー)
  const [activeTab, setActiveTab] = useState<'inspector' | 'input_preview'>('inspector');

  // インスペクター用State
  const [fields, setFields] = useState<SpouseDocFieldConfig[]>(() => loadSpouseDocCoordinates());
  const [selectedSection, setSelectedSection] = useState<SpouseDocSection>('header');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('companyName');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // マウント時にDBから全社共有座標を取得
  useEffect(() => {
    let isCancelled = false;
    fetchSpouseDocCoordinatesFromDb().then(dbCoords => {
      if (!isCancelled && dbCoords && dbCoords.length > 0) {
        setFields(dbCoords);
      }
    });
    return () => { isCancelled = true; };
  }, []);

  // 原本背景画像
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);

  // 🖱️ ドラッグ移動用State
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // 🖐️ 手のひらスクロール移動State
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number }>({
    startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0
  });
  const [isPanning, setIsPanning] = useState(false);

  // PDF.jsによる原本描画（A4横 297mm × 210mm）
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

        const loadingTask = pdfjsLib.getDocument('/spouse_deduction_template.pdf');
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
        console.warn('PDF load warning:', err);
        setIsLoadingPdf(false);
      }
    };
    renderPdf();
    return () => { isCancelled = true; };
  }, []);

  // 選択中項目
  const selectedField = fields.find(f => f.id === selectedFieldId);
  const sectionFields = fields.filter(f => f.section === selectedSection);

  // 項目値更新
  const updateField = useCallback((id: string, key: keyof SpouseDocFieldConfig, value: any) => {
    setFields(prev => {
      let finalVal = value;
      if (typeof value === 'number') {
        const precision = key === 'pitch' ? 100 : (key === 'x' || key === 'y') ? 100 : 1;
        finalVal = Math.round(value * precision) / precision;
      }
      const updated = prev.map(f => f.id === id ? { ...f, [key]: finalVal } : f);
      broadcastSpouseDocCoordinates(updated);
      return updated;
    });
  }, []);

  // 🖱️ ドラッグ開始 (MouseDown on Field)
  const handleStartDrag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(id);
    setDraggingFieldId(id);

    const target = fields.find(f => f.id === id);
    if (!target) return;

    if (target.section !== selectedSection) {
      setSelectedSection(target.section);
    }

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: target.x,
      startY: target.y
    };
  };

  // 🖐️ 手のひらスクロール開始 (MouseDown on Background)
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

  // グローバルマウス移動 & マウスアップ処理
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. フィールドドラッグ
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

      // 2. 手のひらスクロール
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

  // ⌨️ 全画面グローバル矢印キーリスナー（0.1%刻み、Shiftキーで1.0%刻み微調整）
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

  // 全社クラウド保存
  const handleSave = async () => {
    setIsSaving(true);
    saveSpouseDocCoordinates(fields);
    broadcastSpouseDocCoordinates(fields);
    await saveSpouseDocCoordinatesToDb(fields);
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // 初期値リセット
  const handleReset = () => {
    if (confirm('座標設定を国税庁原本の黄金比率初期値にリセットしますか？')) {
      setFields(DEFAULT_SPOUSE_DOC_FIELDS);
      saveSpouseDocCoordinates(DEFAULT_SPOUSE_DOC_FIELDS);
      broadcastSpouseDocCoordinates(DEFAULT_SPOUSE_DOC_FIELDS);
    }
  };

  // 微調整矢印ボタンハンドラ
  const nudge = (dx: number, dy: number) => {
    if (!selectedField) return;
    updateField(selectedField.id, 'x', selectedField.x + dx);
    updateField(selectedField.id, 'y', selectedField.y + dy);
  };

  // デモデータ（直接入力プレビュー用）
  const demoPreviewData: SpouseDeductionDocData = {
    year: 2026,
    companyName: '株式会社オアシスホールディングス',
    companyAddress: '東京都千代田区霞が関1-1-1',
    corporateNumber: '1234567890123',
    taxOfficeName: '千代田',
    employeeName: '山田 太郎',
    employeeNameKana: 'ヤマダ タロウ',
    employeeAddress: '東京都世田谷区桜丘2-10-5',
    employeeMyNumber: '123456789012',
    employeeIncomeEstimate: 3560000,
    hasSpouse: true,
    spouseName: '山田 花子',
    spouseNameKana: 'ヤマダ ハナコ',
    spouseBirthDate: '1982-08-15',
    spouseIncomeEstimate: 450000,
    spouseAddress: '同居',
    spouseMyNumber: '987654321098',
    appliedDate: '2026-11-15'
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 🧭 モード切替バー（座標インスペクター ⇄ 実際の直接入力・A4横印刷プレビュー） */}
      <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md ring-2 ring-amber-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            原本マス目 精密座標インスペクター（A4横）
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('input_preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'input_preview'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md ring-2 ring-indigo-400/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            全社実動 直接入力 ＆ A4横印刷画面
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-amber-400 font-bold bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800/80 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-400" />
            国税庁 令和8年分 基・配・特・所 公式原本完全準拠
          </span>
        </div>
      </div>

      {/* 1. 直接入力・A4横印刷プレビューモード */}
      {activeTab === 'input_preview' && (
        <OfficialSpouseDeductionDoc
          data={demoPreviewData}
          customCoords={fields}
        />
      )}

      {/* 2. 原本マス目座標インスペクターモード */}
      {activeTab === 'inspector' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* 🎛️ 左パネル：セクション選択 & 座標微調整コントローラー (4/12) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* ツールアクションバー */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  統制座標コントローラー
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                    title="縮小"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono font-bold text-amber-400 px-1.5">{previewZoom}%</span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(200, z + 10))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                    title="拡大"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 保存 & リセット ボタン */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black text-white shadow-md transition cursor-pointer ${
                    savedSuccess 
                      ? 'bg-emerald-600 ring-2 ring-emerald-400' 
                      : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                  }`}
                >
                  {savedSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      全社DB保存完了！
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {isSaving ? '保存中...' : '全社クラウド保存'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  初期値リセット
                </button>
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                💡 <b>操作方法</b>: 用紙上の文字を<b>直接マウスドラッグ</b>、または矢印キー（↑↓←→）で0.1%刻みで微調整できます（Shiftキー併用で1.0%移動）。
              </div>
            </div>

            {/* セクション選択タブ */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-xl space-y-1">
              <div className="text-[10px] font-bold text-slate-400 px-2 py-1">セクション選択</div>
              <div className="grid grid-cols-1 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSection('header');
                    const first = fields.find(f => f.section === 'header');
                    if (first) setSelectedFieldId(first.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    selectedSection === 'header'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    ① 会社・本人ヘッダー
                  </span>
                  <span className="text-[10px] opacity-70 font-mono">7項目</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSection('basic_deduction');
                    const first = fields.find(f => f.section === 'basic_deduction');
                    if (first) setSelectedFieldId(first.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    selectedSection === 'basic_deduction'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5" />
                    ② 基礎控除申告書
                  </span>
                  <span className="text-[10px] opacity-70 font-mono">9項目</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSection('spouse_deduction');
                    const first = fields.find(f => f.section === 'spouse_deduction');
                    if (first) setSelectedFieldId(first.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    selectedSection === 'spouse_deduction'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5" />
                    ③ 配偶者控除等申告書
                  </span>
                  <span className="text-[10px] opacity-70 font-mono">23項目</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSection('specific_relative');
                    const first = fields.find(f => f.section === 'specific_relative');
                    if (first) setSelectedFieldId(first.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    selectedSection === 'specific_relative'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="w-3.5 h-3.5" />
                    ④ 特定親族特別控除申告書
                  </span>
                  <span className="text-[10px] opacity-70 font-mono">11項目</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedSection('adjustment');
                    const first = fields.find(f => f.section === 'adjustment');
                    if (first) setSelectedFieldId(first.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    selectedSection === 'adjustment'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Scale className="w-3.5 h-3.5" />
                    ⑤ 所得金額調整控除申告書
                  </span>
                  <span className="text-[10px] opacity-70 font-mono">12項目</span>
                </button>
              </div>
            </div>

            {/* 項目一覧ドロップダウン・選択リスト */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                調整対象フィールド（{sectionFields.length}項目）
              </label>
              <select
                value={selectedFieldId}
                onChange={(e) => setSelectedFieldId(e.target.value)}
                className="w-full bg-slate-800 text-white text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              >
                {sectionFields.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.disabled ? '［非表示］' : ''}
                  </option>
                ))}
              </select>

              {/* 選択項目の詳細パラメーター調整パネル */}
              {selectedField && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-3 mt-2">
                  <div className="border-b border-slate-800 pb-2">
                    <div className="text-xs font-black text-amber-300">{selectedField.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{selectedField.description}</div>
                  </div>

                  {/* X / Y 座標入力 ＆ 矢印微調整ボタン */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">X座標（横%）</span>
                        <span className="text-xs font-mono font-black text-amber-400">{selectedField.x.toFixed(2)}%</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedField.x}
                        onChange={(e) => updateField(selectedField.id, 'x', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">Y座標（縦%）</span>
                        <span className="text-xs font-mono font-black text-amber-400">{selectedField.y.toFixed(2)}%</span>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedField.y}
                        onChange={(e) => updateField(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* 矢印キー微調整パッド */}
                  <div className="flex flex-col items-center justify-center p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => nudge(0, -0.1)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="上へ0.1%"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-4 my-1">
                      <button
                        type="button"
                        onClick={() => nudge(-0.1, 0)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="左へ0.1%"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[9px] font-bold text-slate-500 font-mono">0.1%刻み</span>
                      <button
                        type="button"
                        onClick={() => nudge(0.1, 0)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        title="右へ0.1%"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => nudge(0, 0.1)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="下へ0.1%"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* フォントサイズ ＆ マス目ピッチ */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">文字サイズ（pt）</span>
                        <span className="text-xs font-mono font-black text-amber-400">{selectedField.fontSize}pt</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="22"
                        step="0.5"
                        value={selectedField.fontSize}
                        onChange={(e) => updateField(selectedField.id, 'fontSize', parseFloat(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400">マス目間隔（pitch）</span>
                        <span className="text-xs font-mono font-black text-amber-400">
                          {selectedField.pitch ? `${selectedField.pitch}%` : 'なし'}
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedField.pitch || ''}
                        placeholder="例: 1.45"
                        onChange={(e) => updateField(selectedField.id, 'pitch', e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* チェック・印字無効トグル */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!selectedField.disabled}
                        onChange={(e) => updateField(selectedField.id, 'disabled', e.target.checked)}
                        className="rounded accent-amber-500"
                      />
                      <span className="text-xs text-slate-300 font-bold">印字を非表示にする</span>
                    </label>

                    {selectedField.isCircle && (
                      <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700 px-2 py-0.5 rounded font-bold">
                        ○印モード
                      </span>
                    )}
                    {selectedField.isCheck && (
                      <span className="text-[10px] bg-emerald-900/60 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded font-bold">
                        ✓チェックモード
                      </span>
                    )}
                  </div>

                  {/* テスト文字列変更 */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">プレビュー用サンプル表示値</span>
                    <input
                      type="text"
                      value={selectedField.example}
                      onChange={(e) => updateField(selectedField.id, 'example', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* 🖼️ 右パネル：A4横原本キャンバス ＆ ドラッグ可能プレビュー (8/12) */}
          <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl overflow-hidden flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>原本A4横（297mm × 210mm）ピクセル完全一致ビュー</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {isLoadingPdf ? '原本PDFレンダリング中...' : '原本描画完了'}
              </div>
            </div>

            {/* スクロールコンテナ */}
            <div
              ref={scrollContainerRef}
              onMouseDown={handlePanMouseDown}
              className={`w-full max-h-[780px] overflow-auto p-4 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-center items-start ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {/* 用紙（A4横 297mm × 210mm） */}
              <div
                ref={previewContainerRef}
                style={{
                  width: `${297 * (previewZoom / 100)}mm`,
                  minHeight: `${210 * (previewZoom / 100)}mm`,
                  aspectRatio: '297 / 210',
                  position: 'relative',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                  backgroundImage: bgPdfImg ? `url(${bgPdfImg})` : undefined,
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                  transformOrigin: 'top center',
                  overflow: 'hidden'
                }}
              >
                {/* 原本描画中ローダー */}
                {isLoadingPdf && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mb-2" />
                    <span className="text-xs font-bold text-slate-700">PDF原本を高精度レンダリング中...</span>
                  </div>
                )}

                {/* 各フィールドの絶対配置オーバーレイ */}
                {fields.map(field => {
                  if (field.disabled) return null;
                  const isSelected = field.id === selectedFieldId;
                  const isDraggingThis = field.id === draggingFieldId;

                  return (
                    <div
                      key={field.id}
                      onMouseDown={(e) => handleStartDrag(field.id, e)}
                      style={{
                        position: 'absolute',
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        cursor: isDraggingThis ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        zIndex: isDraggingThis ? 50 : isSelected ? 30 : 10,
                        touchAction: 'none'
                      }}
                      className={`transition-all duration-75 p-0.5 rounded-xs ${
                        isDraggingThis
                          ? 'ring-2 ring-amber-500 bg-amber-500/25 shadow-xl scale-105 font-black'
                          : isSelected 
                            ? 'ring-2 ring-amber-500 bg-amber-500/20 shadow-md font-black' 
                            : 'hover:ring-1 hover:ring-blue-400 hover:bg-blue-100/40 bg-white/30'
                      }`}
                      title={`${field.name} (${field.x}%, ${field.y}%)`}
                    >
                      {/* 選択中バッジ */}
                      {isSelected && (
                        <div className="absolute -top-4 left-0 bg-amber-700 text-white text-[9px] px-1 py-0.2 rounded font-mono pointer-events-none whitespace-nowrap shadow-xs z-50">
                          {field.name} ({field.x}%, {field.y}%)
                        </div>
                      )}

                      {/* ○印の場合 */}
                      {field.isCircle ? (
                        <div
                          className="pointer-events-none flex items-center justify-center border-2 border-red-600 rounded-full"
                          style={{
                            width: `${(field.fontSize || 10) * 1.5}pt`,
                            height: `${(field.fontSize || 10) * 1.5}pt`,
                            color: '#dc2626'
                          }}
                        >
                          <span style={{ fontSize: `${field.fontSize}pt`, fontWeight: 900, lineHeight: 1 }}>○</span>
                        </div>
                      ) : field.isCheck ? (
                        /* ✓チェックの場合 */
                        <div
                          className="pointer-events-none font-black text-red-600"
                          style={{
                            fontSize: `${field.fontSize || 11}pt`,
                            lineHeight: 1
                          }}
                        >
                          ✓
                        </div>
                      ) : field.pitch && field.pitch > 0 ? (
                        /* マス目間隔（pitch）指定の場合 */
                        <div className="flex items-center pointer-events-none">
                          {field.example.split('').map((ch, i) => (
                            <span
                              key={i}
                              style={{
                                display: 'inline-block',
                                width: `${(field.pitch || 1.45) * 2.97}mm`,
                                fontSize: `${field.fontSize}pt`,
                                fontWeight: 900,
                                color: isDraggingThis ? '#b45309' : isSelected ? '#b45309' : '#0f172a',
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
                        /* 通常文字列 */
                        <span
                          className="pointer-events-none"
                          style={{
                            fontSize: `${field.fontSize}pt`,
                            fontWeight: 900,
                            color: isDraggingThis ? '#b45309' : isSelected ? '#b45309' : '#0f172a',
                            fontFamily: 'sans-serif',
                            lineHeight: 1,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {field.example}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
