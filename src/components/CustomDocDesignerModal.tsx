import React, { useState, useRef, useEffect } from 'react';
import { 
  type CustomDocTemplate, 
  type CustomDocField, 
  AVAILABLE_DATA_SOURCES,
  saveCustomDocTemplateToStorage 
} from '../lib/customDocManager';
import { detectFieldsWithAi } from '../lib/customDocAiDetector';
import { 
  Upload, Save, Plus, Trash2, 
  ZoomIn, ZoomOut, Loader2, Sparkles, Wand2,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight
} from 'lucide-react';

interface CustomDocDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (template: CustomDocTemplate) => void;
  initialTemplate?: CustomDocTemplate | null;
  tenantId?: string;
  geminiApiKey?: string;
}

export default function CustomDocDesignerModal({
  isOpen,
  onClose,
  onSaved,
  initialTemplate,
  tenantId,
  geminiApiKey
}: CustomDocDesignerModalProps) {
  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [category, setCategory] = useState<CustomDocTemplate['category']>(initialTemplate?.category || 'tax');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [pdfDataUrl, setPdfDataUrl] = useState<string>(initialTemplate?.pdfDataUrl || '');
  const [fields, setFields] = useState<CustomDocField[]>(initialTemplate?.fields || []);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // ドラッグ中 State
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (initialTemplate) {
      setTitle(initialTemplate.title);
      setCategory(initialTemplate.category);
      setDescription(initialTemplate.description || '');
      setPdfDataUrl(initialTemplate.pdfDataUrl);
      setFields(initialTemplate.fields);
    } else {
      setTitle('');
      setCategory('tax');
      setDescription('');
      setPdfDataUrl('');
      setFields([]);
    }
  }, [initialTemplate, isOpen]);

  // PDFファイルの読み込み（Base64 DataURL化）
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      alert('PDFファイル（または画像ファイル）を選択してください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string;
      setPdfDataUrl(result);
      const docTitle = title || file.name.replace(/\.[^/.]+$/, '');
      if (!title) setTitle(docTitle);

      // 🤖 新規アップロード時、AIが自動で様式を判別して項目を初期配置！
      if (fields.length === 0) {
        setIsAiDetecting(true);
        try {
          const { fields: detected, matchedPresetName } = await detectFieldsWithAi(
            docTitle,
            file.name,
            undefined,
            geminiApiKey
          );
          setFields(detected);
          setAiMessage(`🤖 AIが【${matchedPresetName}】を認識し、${detected.length}項目を自動配置しました！`);
        } catch (e) {
          console.warn('Auto AI detect error:', e);
        } finally {
          setIsAiDetecting(false);
        }
      }
    };
    reader.onerror = () => {
      alert('ファイルの読み込みに失敗しました。');
    };
    reader.readAsDataURL(file);
  };

  // 🤖 手動で「AIにおまかせ自動再配置」を実行
  const handleRunAiAutoDetect = async () => {
    setIsAiDetecting(true);
    setAiMessage(null);
    try {
      let canvasDataUrl: string | undefined = undefined;
      if (previewCanvasRef.current) {
        canvasDataUrl = previewCanvasRef.current.toDataURL('image/jpeg', 0.85);
      }

      const { fields: detected, matchedPresetName } = await detectFieldsWithAi(
        title,
        title,
        canvasDataUrl,
        geminiApiKey
      );

      setFields(detected);
      setAiMessage(`🎉 AIが【${matchedPresetName}】を解析し、${detected.length}項目を自動配置しました！`);
    } catch (e) {
      alert('AI自動解析中にエラーが発生しました。');
    } finally {
      setIsAiDetecting(false);
    }
  };

  // PDF背景のCanvas描画
  useEffect(() => {
    if (!pdfDataUrl || !previewCanvasRef.current) return;

    const renderPdf = async () => {
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

        const loadingTask = pdfjsLib.getDocument(pdfDataUrl);
        const pdfDoc = await loadingTask.promise;
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.warn('PDF Preview render error:', err);
      }
    };

    renderPdf();
  }, [pdfDataUrl]);

  // 項目パレットからの項目追加
  const handleAddField = (item: { key: string; label: string; defaultType: string; defaultFontSize: number; defaultPitch?: number }) => {
    const newField: CustomDocField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: item.label,
      sourceKey: item.key,
      x: 30 + (fields.length % 5) * 5,
      y: 20 + (fields.length % 8) * 6,
      fontSize: item.defaultFontSize || 11,
      pitch: item.defaultPitch,
      type: item.defaultType as any
    };

    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  // 項目削除
  const handleDeleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  // ドラッグ操作
  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setDraggingFieldId(fieldId);

    const f = fields.find(item => item.id === fieldId);
    if (!f) return;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: f.x,
      startY: f.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingFieldId || !dragStartRef.current || !previewContainerRef.current) return;

    const rect = previewContainerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

    const newX = Math.max(0, Math.min(98, Math.round((dragStartRef.current.startX + deltaX) * 10) / 10));
    const newY = Math.max(0, Math.min(98, Math.round((dragStartRef.current.startY + deltaY) * 10) / 10));

    setFields(prev => prev.map(f => f.id === draggingFieldId ? { ...f, x: newX, y: newY } : f));
  };

  const handleMouseUp = () => {
    setDraggingFieldId(null);
    dragStartRef.current = null;
  };

  // 座標微調整ヘルパー
  const nudge = (dx: number, dy: number) => {
    if (!selectedFieldId) return;
    setFields(prev => prev.map(f => {
      if (f.id !== selectedFieldId) return f;
      return {
        ...f,
        x: Math.max(0, Math.min(99, Math.round((f.x + dx) * 10) / 10)),
        y: Math.max(0, Math.min(99, Math.round((f.y + dy) * 10) / 10))
      };
    }));
  };

  // 保存処理
  const handleSave = () => {
    if (!title.trim()) {
      alert('書類名（帳票タイトル）を入力してください。');
      return;
    }
    if (!pdfDataUrl) {
      alert('白紙PDFファイルをアップロードしてください。');
      return;
    }

    setIsSaving(true);
    const template: CustomDocTemplate = {
      id: initialTemplate?.id || `custom_doc_${Date.now()}`,
      title: title.trim(),
      category,
      description: description.trim(),
      pdfDataUrl,
      fields,
      createdAt: initialTemplate?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveCustomDocTemplateToStorage(template, tenantId);
    setIsSaving(false);
    alert(`🎉 「${template.title}」を全社公的書類として登録しました！\n入退社管理の書類キャビネットから全従業員データで即座に出力・印刷できます。`);
    onSaved(template);
    onClose();
  };

  const selectedField = fields.find(f => f.id === selectedFieldId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div className="bg-white rounded-3xl max-w-7xl w-full h-[94vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                🖨️ 汎用 公的書面・PDF印字カスタムビルダー
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                  ノーコード帳票デザイナー
                </span>
              </h3>
              <p className="text-xs text-slate-500">官公庁PDFをアップロードし、印字項目をドラッグ配置してオリジナル公的書類を作成</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunAiAutoDetect}
              disabled={isAiDetecting || !pdfDataUrl}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="PDFの記入欄やマス目をAIが自動認識して項目を一発配置"
            >
              {isAiDetecting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" /> : <Wand2 className="w-3.5 h-3.5 text-cyan-300" />}
              ✨ AIにおまかせ自動配置
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !pdfDataUrl}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              全社書類として登録・保存
            </button>
          </div>
        </div>

        {/* 🤖 AI自動認識トーストバナー */}
        {aiMessage && (
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-b border-indigo-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-indigo-950 shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>{aiMessage}</span>
            </div>
            <button onClick={() => setAiMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* メインワークスペース */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* 左サイドバー: 帳票設定 ＆ 項目パレット */}
          <div className="lg:col-span-4 border-r border-slate-200 p-5 overflow-y-auto space-y-5 bg-slate-50/50">
            
            {/* 基本情報入力 */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-bold text-xs text-slate-800">1. 帳票基本設定</h4>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">書類名（帳票タイトル） <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="例: 雇用保険資格取得届 / 令和9年分 扶養控除申告書"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">カテゴリ</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="tax">税務・年末調整</option>
                    <option value="social_insurance">社会保険・年金</option>
                    <option value="labor">労務・雇用契約</option>
                    <option value="internal">社内届出・誓約書</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">PDF原本</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-xl border transition flex items-center justify-center gap-1 cursor-pointer ${
                      pdfDataUrl ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {pdfDataUrl ? 'PDF変更' : 'PDFアップロード'}
                  </button>
                </div>
              </div>
            </div>

            {/* 🎯 項目パレット（ワンクリック追加） */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-slate-800">2. 印字項目の追加（パレット）</h4>
                <span className="text-[10px] text-slate-400">クリックで追加</span>
              </div>

              <div className="space-y-3 max-h-[36vh] overflow-y-auto pr-1">
                {AVAILABLE_DATA_SOURCES.map((grp, gIdx) => (
                  <div key={gIdx} className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 block">{grp.group}</span>
                    <div className="flex flex-wrap gap-1">
                      {grp.items.map((item, iIdx) => (
                        <button
                          key={iIdx}
                          type="button"
                          onClick={() => handleAddField(item)}
                          className="text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-300 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-indigo-500" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 選択項目のプロパティ編集 */}
            {selectedField && (
              <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200 shadow-2xs space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-indigo-950 flex items-center gap-1">
                    ✏️ 選択中: {selectedField.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteField(selectedField.id)}
                    className="text-rose-600 hover:bg-rose-100 p-1 rounded-lg text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 削除
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">X座標 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedField.x}
                      onChange={e => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, x: parseFloat(e.target.value) || 0 } : f))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Y座標 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={selectedField.y}
                      onChange={e => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, y: parseFloat(e.target.value) || 0 } : f))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">フォントサイズ (pt)</label>
                    <input
                      type="number"
                      value={selectedField.fontSize}
                      onChange={e => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, fontSize: parseInt(e.target.value, 10) || 10 } : f))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">マス目ピッチ (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="例: 1.82"
                      value={selectedField.pitch || ''}
                      onChange={e => setFields(prev => prev.map(f => f.id === selectedField.id ? { ...f, pitch: parseFloat(e.target.value) || undefined } : f))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                </div>

                {/* 矢印微調整ボタン */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <button type="button" onClick={() => nudge(-0.2, 0)} className="p-1.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"><ArrowLeft className="w-3.5 h-3.5 text-slate-600" /></button>
                  <button type="button" onClick={() => nudge(0, -0.2)} className="p-1.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"><ArrowUp className="w-3.5 h-3.5 text-slate-600" /></button>
                  <button type="button" onClick={() => nudge(0, 0.2)} className="p-1.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"><ArrowDown className="w-3.5 h-3.5 text-slate-600" /></button>
                  <button type="button" onClick={() => nudge(0.2, 0)} className="p-1.5 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 cursor-pointer"><ArrowRight className="w-3.5 h-3.5 text-slate-600" /></button>
                </div>
              </div>
            )}
          </div>

          {/* 右エリア: PDFプレビュー ＆ ドラッグ配置キャンバス */}
          <div 
            className="lg:col-span-8 bg-slate-800 p-4 sm:p-6 overflow-auto flex items-center justify-center relative select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {pdfDataUrl ? (
              <div 
                ref={previewContainerRef}
                style={{ width: `${zoom}%`, maxWidth: '900px' }}
                className="relative bg-white shadow-2xl rounded-sm border border-slate-600 transition-all duration-75"
              >
                <canvas ref={previewCanvasRef} className="w-full h-auto block" />

                {/* ドラッグ可能な印字バッジ一覧 */}
                {fields.map(f => {
                  const isSelected = selectedFieldId === f.id;
                  return (
                    <div
                      key={f.id}
                      onMouseDown={e => handleMouseDown(e, f.id)}
                      style={{
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        fontSize: `${Math.max(10, f.fontSize * 1.1)}px`
                      }}
                      className={`absolute -translate-y-1/2 cursor-grab active:cursor-grabbing px-2 py-0.5 rounded transition shadow-sm flex items-center gap-1 font-bold whitespace-nowrap z-20 ${
                        isSelected 
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 shadow-lg' 
                          : 'bg-white/90 hover:bg-indigo-50 text-slate-900 border border-indigo-400/80'
                      }`}
                    >
                      {f.type === 'circle' && <span className="w-3 h-3 rounded-full border border-blue-600 inline-block" />}
                      {f.type === 'check' && <span className="text-blue-600">✓</span>}
                      <span>{f.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-slate-400 space-y-4 py-20">
                <Upload className="w-16 h-16 mx-auto text-slate-500 stroke-1" />
                <div>
                  <h4 className="font-bold text-white text-base">白紙PDFファイルをアップロードしてください</h4>
                  <p className="text-xs text-slate-400 mt-1">国税庁や日本年金機構、ハローワーク等の白紙申請書PDF（A4）に対応しています</p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-lg transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  PDFファイルを選択する
                </button>
              </div>
            )}

            {/* ズームコントローラー */}
            {pdfDataUrl && (
              <div className="absolute bottom-4 right-4 bg-slate-900/90 text-white px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 text-xs shadow-lg">
                <button type="button" onClick={() => setZoom(prev => Math.max(60, prev - 10))} className="p-1 hover:text-indigo-400 cursor-pointer"><ZoomOut className="w-3.5 h-3.5" /></button>
                <span className="font-mono text-[11px] w-10 text-center">{zoom}%</span>
                <button type="button" onClick={() => setZoom(prev => Math.min(140, prev + 10))} className="p-1 hover:text-indigo-400 cursor-pointer"><ZoomIn className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
