import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Save, RotateCcw, CheckCircle2, 
  ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Sliders, Eye, Sparkles
} from 'lucide-react';
import { 
  DEFAULT_EMPLOYMENT_ACQ_FIELDS,
  loadEmploymentAcqCoordinates,
  saveEmploymentAcqCoordinates,
  saveEmploymentAcqCoordinatesToDb,
  broadcastEmploymentAcqCoordinates,
  type EmploymentAcqFieldConfig
} from '../lib/employmentAcquisitionDocCoordinates';
import { OfficialEmploymentAcquisitionDoc } from './OfficialEmploymentAcquisitionDoc';

export const EmploymentAcquisitionDocMasterInspector: React.FC = () => {
  // モード: 'inspector' (座標微調整) | 'input_preview' (実際の直接入力プレビュー)
  const [activeTab, setActiveTab] = useState<'inspector' | 'input_preview'>('inspector');

  // インスペクター用State
  const [fields, setFields] = useState<EmploymentAcqFieldConfig[]>(() => loadEmploymentAcqCoordinates());
  const [selectedSection, setSelectedSection] = useState<'header' | 'employee_basic' | 'employment_condition' | 'contract' | 'office'>('header');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('myNumber');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // 原本背景画像
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);

  // 🖱️ ドラッグ移動用State
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // PDF.jsによる原本描画
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

        const loadingTask = pdfjsLib.getDocument('/employment_acquisition_template.pdf');
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
  const updateField = useCallback((id: string, key: keyof EmploymentAcqFieldConfig, value: any) => {
    setFields(prev => {
      let finalVal = value;
      if (typeof value === 'number') {
        const precision = key === 'pitch' ? 100 : (key === 'x' || key === 'y') ? 100 : 1;
        finalVal = Math.round(value * precision) / precision;
      }
      const updated = prev.map(f => f.id === id ? { ...f, [key]: finalVal } : f);
      broadcastEmploymentAcqCoordinates(updated);
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
      setSelectedSection(target.section as any);
    }

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: target.x,
      startY: target.y
    };
  };

  // 🖱️ マウスドラッグ移動リスナー（画面全体）
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingFieldId || !dragStartRef.current || !previewContainerRef.current) return;

      const rect = previewContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaX = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, dragStartRef.current.startX + deltaX));
      const newY = Math.max(0, Math.min(100, dragStartRef.current.startY + deltaY));

      updateField(draggingFieldId, 'x', newX);
      updateField(draggingFieldId, 'y', newY);
    };

    const handleGlobalMouseUp = () => {
      if (draggingFieldId) {
        setDraggingFieldId(null);
        dragStartRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingFieldId, updateField]);

  // ⌨️ PC矢印キー移動リスナー（いつでも矢印キーで微調整可能）
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

  // 保存（ローカルおよびDB）
  const handleSave = async () => {
    setIsSaving(true);
    saveEmploymentAcqCoordinates(fields);
    await saveEmploymentAcqCoordinatesToDb(fields);
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // 初期値リセット
  const handleReset = () => {
    if (confirm('座標設定を初期値（黄金比率デフォルト値）にリセットしますか？')) {
      setFields(DEFAULT_EMPLOYMENT_ACQ_FIELDS);
      saveEmploymentAcqCoordinates(DEFAULT_EMPLOYMENT_ACQ_FIELDS);
      broadcastEmploymentAcqCoordinates(DEFAULT_EMPLOYMENT_ACQ_FIELDS);
    }
  };

  // 微調整矢印ボタン
  const nudge = (dx: number, dy: number) => {
    if (!selectedField) return;
    updateField(selectedField.id, 'x', selectedField.x + dx);
    updateField(selectedField.id, 'y', selectedField.y + dy);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 🧭 モード切替バー（座標インスペクター ⇄ 実際の直接入力） */}
      <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            原本マス目 精密座標インスペクター
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('input_preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'input_preview'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            全社実動 直接入力 ＆ A4印刷画面
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/80 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            様式第2号（第6条関係）公式原本較正済
          </span>
        </div>
      </div>

      {/* 1. 直接入力プレビューモード */}
      {activeTab === 'input_preview' && (
        <OfficialEmploymentAcquisitionDoc
          companyInfo={{
            name: '株式会社KAP',
            address: '滋賀県大津市坂本3丁目21-16',
            representative_name: '代表取締役 駒井 秀一朗',
            phone_number: '077-574-6907',
            corporate_number: '',
            company_seal_url: ''
          }}
          officeNumber="2501-123456-7"
          employees={[
            {
              id: 'demo-1',
              name: '駒井 秀一朗',
              name_kana: 'コマイ　シュウイチロウ',
              birth_date: '1990-05-10',
              gender: '男',
              my_number: '123456789012',
              employment_insurance_number: '1234-567890-1',
              join_date: '2026-04-01',
              base_salary: 250000,
              employment_type: 'regular',
              weekly_hours: 40
            }
          ]}
        />
      )}

      {/* 2. 座標インスペクターモード */}
      {activeTab === 'inspector' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* コントロールサイドバー */}
          <div className="lg:col-span-4 space-y-4">
            {/* セクション選択タブ */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">検査セクション</span>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                <button
                  onClick={() => setSelectedSection('header')}
                  className={`p-2 rounded-xl text-center transition cursor-pointer ${
                    selectedSection === 'header' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ① 番号・取得区分
                </button>
                <button
                  onClick={() => setSelectedSection('employee_basic')}
                  className={`p-2 rounded-xl text-center transition cursor-pointer ${
                    selectedSection === 'employee_basic' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  ② 氏名・生年月日・事業所
                </button>
                <button
                  onClick={() => setSelectedSection('employment_condition')}
                  className={`p-2 rounded-xl text-center transition cursor-pointer ${
                    selectedSection === 'employment_condition' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ③ 雇用・賃金・取得日
                </button>
                <button
                  onClick={() => setSelectedSection('contract')}
                  className={`p-2 rounded-xl text-center transition cursor-pointer ${
                    selectedSection === 'contract' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ④ 契約期間
                </button>
                <button
                  onClick={() => setSelectedSection('office')}
                  className={`p-2 rounded-xl text-center transition cursor-pointer ${
                    selectedSection === 'office' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ⑤ 事業主署名欄
                </button>
              </div>
            </div>

            {/* セクション内項目リスト */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5 max-h-[300px] overflow-y-auto">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">配置項目一覧</span>
              {sectionFields.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-between ${
                    selectedFieldId === f.id
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="truncate">{f.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    X:{f.x}% Y:{f.y}%
                  </span>
                </button>
              ))}
            </div>

            {/* 選択項目の座標エディタ */}
            {selectedField && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="font-black text-slate-900">{selectedField.name}</h4>
                  <p className="text-[10px] text-slate-500">{selectedField.description}</p>
                </div>

                {/* X/Y座標数値入力 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">X座標 (%)</label>
                    <input
                      type="number"
                      step={0.1}
                      value={selectedField.x}
                      onChange={(e) => updateField(selectedField.id, 'x', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Y座標 (%)</label>
                    <input
                      type="number"
                      step={0.1}
                      value={selectedField.y}
                      onChange={(e) => updateField(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* フォントサイズ ＆ ピッチ */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">フォントサイズ (pt)</label>
                    <input
                      type="number"
                      step={0.5}
                      value={selectedField.fontSize}
                      onChange={(e) => updateField(selectedField.id, 'fontSize', parseFloat(e.target.value) || 10)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">マス目ピッチ (%)</label>
                    <input
                      type="number"
                      step={0.05}
                      value={selectedField.pitch || ''}
                      onChange={(e) => updateField(selectedField.id, 'pitch', parseFloat(e.target.value) || undefined)}
                      placeholder="未設定"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 font-mono font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* 矢印キー微調整 */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">微調整キー（0.2% 単位）</span>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => nudge(0, -0.2)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => nudge(-0.2, 0)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => nudge(0.2, 0)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => nudge(0, 0.2)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 保存 ＆ リセットボタン */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> リセット
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {savedSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-200" /> : <Save className="w-4 h-4" />}
                    {savedSuccess ? '保存完了！' : '座標を全社保存'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 原本プレビュー ＆ マス目オーバーレイ */}
          <div className="lg:col-span-8 flex flex-col items-center">
            {/* ズームバー ＆ ドラッグ操作ガイド */}
            <div className="mb-2 w-full flex flex-wrap items-center justify-between gap-2 px-2">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 shadow-2xs">
                <span>ズーム:</span>
                <button onClick={() => setPreviewZoom(z => Math.max(50, z - 10))} className="p-1 hover:bg-slate-100 rounded cursor-pointer">
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center font-mono">{previewZoom}%</span>
                <button onClick={() => setPreviewZoom(z => Math.min(150, z + 10))} className="p-1 hover:bg-slate-100 rounded cursor-pointer">
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-2xs">
                <span>🖱️ 項目を直接ドラッグ移動可能</span>
                <span className="text-emerald-400">|</span>
                <span>⌨️ 矢印キーで微調整（Shift併用で1%移動）</span>
              </div>
            </div>

            <div
              ref={previewContainerRef}
              style={{ 
                transform: `scale(${previewZoom / 100})`, 
                transformOrigin: 'top center',
                containerType: 'inline-size'
              }}
              className="w-[210mm] min-h-[297mm] bg-white relative shadow-xl border border-slate-300 overflow-hidden select-none"
            >
              {bgPdfImg ? (
                <img src={bgPdfImg} alt="原本" className="w-full h-full object-contain pointer-events-none" />
              ) : isLoadingPdf ? (
                <div className="w-full h-[297mm] bg-slate-50 flex items-center justify-center text-slate-400">
                  原本PDFをレンダリング中...
                </div>
              ) : (
                <div className="w-full h-[297mm] bg-slate-50 flex items-center justify-center text-slate-400">
                  原本PDFが見つかりません
                </div>
              )}

              {/* 🎯 原本用紙の上で直接ドラッグ可能な全フィールドボックス */}
              {fields.map(field => {
                if (field.disabled) return null;
                const isSelected = field.id === selectedFieldId;
                const isDraggingThis = draggingFieldId === field.id;

                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => handleStartDrag(field.id, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                      if (field.section !== selectedSection) {
                        setSelectedSection(field.section as any);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: field.width ? `${field.width}cqw` : undefined,
                      cursor: isDraggingThis ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      zIndex: isDraggingThis ? 50 : isSelected ? 30 : 10,
                      touchAction: 'none'
                    }}
                    className={`transition-all duration-75 px-0.5 py-0.5 rounded-sm ${
                      isDraggingThis
                        ? 'ring-2 ring-amber-500 bg-amber-500/25 shadow-xl scale-105 font-black'
                        : isSelected 
                          ? 'ring-2 ring-emerald-500 bg-emerald-500/20 shadow-md font-black' 
                          : 'hover:ring-1 hover:ring-blue-400 hover:bg-blue-100/40 bg-white/30'
                    }`}
                    title={`${field.name} (ドラッグまたは矢印キーで移動可能)`}
                  >
                    {isSelected && (
                      <div className="absolute -top-4 left-0 bg-emerald-700 text-white text-[9px] px-1 py-0.2 rounded font-mono pointer-events-none whitespace-nowrap shadow-xs z-50">
                        {field.name} ({field.x}%, {field.y}%)
                      </div>
                    )}
                    {field.pitch && field.pitch > 0 ? (
                      <div className="flex items-center pointer-events-none">
                        {field.example.split('').map((ch, i) => (
                          <span
                            key={i}
                            style={{
                              display: 'inline-block',
                              width: `${field.pitch}cqw`,
                              fontSize: `${field.fontSize}pt`,
                              fontWeight: 900,
                              color: isDraggingThis ? '#b45309' : isSelected ? '#047857' : '#0f172a',
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
                      <span
                        className="pointer-events-none"
                        style={{
                          fontSize: `${field.fontSize}pt`,
                          fontWeight: 900,
                          color: isDraggingThis ? '#b45309' : isSelected ? '#047857' : '#0f172a',
                          fontFamily: 'monospace',
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
      )}
    </div>
  );
};
