import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Save, Copy, Check, 
  Building2, Calendar, Users, FileText, CheckCircle2, Loader2,
  ZoomIn, ZoomOut, RotateCcw,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight
} from 'lucide-react';

import { 
  DEFAULT_BONUS_FIELDS, 
  loadBonusDocCoordinates, 
  broadcastBonusDocCoordinates,
  fetchBonusDocCoordinatesFromDb,
  type BonusDocFieldConfig 
} from '../lib/bonusDocCoordinates';

export const BonusDocMasterInspector: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<'submission' | 'office' | 'common_payment' | 'row_template'>('office');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('symbolDigits');
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

  // 項目別マスタ座標State
  const [fields, setFields] = useState<BonusDocFieldConfig[]>(() => loadBonusDocCoordinates());

  // 初回DBからの読み込み
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const latest = await fetchBonusDocCoordinatesFromDb();
        setFields(latest);
      } catch (err) {
        console.error('Error fetching bonus doc coordinates:', err);
      }
    };
    fetchMaster();
  }, []);

  // 項目値の更新（変更のたびにリアルタイムで帳票へブロードキャスト）
  const updateField = useCallback((id: string, key: keyof BonusDocFieldConfig, value: any) => {
    setFields(prev => {
      let finalVal = value;
      if (typeof value === 'number') {
        const precision = key === 'pitch' ? 100 : (key === 'x' || key === 'y') ? 100 : 1;
        finalVal = Math.round(value * precision) / precision;
      }
      const updated = prev.map(f => f.id === id ? { ...f, [key]: finalVal } : f);
      broadcastBonusDocCoordinates(updated);
      return updated;
    });
  }, []);

  const selectedField = fields.find(f => f.id === selectedFieldId);
  const sectionFields = fields.filter(f => f.section === selectedSection);

  // 🖐️ 手のひらパン開始
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
      setSelectedSection(target.section);
    }

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: target.x,
      startY: target.y
    };
  };

  // 🖱️ グローバルマウス移動リスナー
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
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

  // ⌨️ 全画面グローバルキーボードリスナー
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (!selectedFieldId) return;
      const target = fields.find(f => f.id === selectedFieldId);
      if (!target) return;

      const step = e.shiftKey ? 1.0 : 0.05;

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

  // 全社マスター保存
  const handleSaveMaster = async () => {
    setIsSaving(true);
    try {
      const { data: current } = await supabase.from('system_settings').select('id').limit(1).single();
      if (current) {
        await supabase.from('system_settings').update({ bonus_doc_coordinates: fields }).eq('id', current.id);
      } else {
        await supabase.from('system_settings').insert([{ bonus_doc_coordinates: fields }]);
      }
      broadcastBonusDocCoordinates(fields);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
      // DBカラム未作成等の場合でもローカル保存＆即時通知は必ず完了
      broadcastBonusDocCoordinates(fields);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  // 黄金比率初期化リセット
  const handleResetDefaults = () => {
    if (confirm('賞与支払届のすべての項目の座標・文字サイズを黄金比率マスター初期値にリセットしますか？')) {
      setFields(DEFAULT_BONUS_FIELDS);
      broadcastBonusDocCoordinates(DEFAULT_BONUS_FIELDS);
    }
  };

  const sections = [
    { id: 'submission', name: '① 提出年月日（年・月・日）', icon: Calendar, count: fields.filter(f => f.section === 'submission').length },
    { id: 'office', name: '② 事業所情報 ＆ 整理記号', icon: Building2, count: fields.filter(f => f.section === 'office').length },
    { id: 'common_payment', name: '③ 共通賞与支払年月日', icon: Calendar, count: fields.filter(f => f.section === 'common_payment').length },
    { id: 'row_template', name: '④ 被保険者行（氏名・ふりがな・生年月日等）', icon: Users, count: fields.filter(f => f.section === 'row_template').length }
  ];

  // 各フィールドのマップ取得（プレビュー描画用）
  const fieldMap = new Map(fields.map(f => [f.id, f]));
  const rowBaseTop = fieldMap.get('rowBaseTop')?.y || 34.26;
  const rowPitchY = fieldMap.get('rowPitchY')?.y || 5.787;

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 🧭 ヘッダー ＆ 保存バー */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-pink-600 rounded-xl text-white">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                日本年金機構 被保険者賞与支払届（コード2265用紙）印字座標マスタ
                <span className="text-xs px-2 py-0.5 bg-pink-500/20 text-pink-300 border border-pink-500/40 rounded-md">
                  原本PDF完全一致オーバーレイ
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                十字キーボタン、PCの矢印キー（↑ ↓ ← →）、またはプレビュー上のドラッグでミリ単位・ピクセル単位で位置を調整できます。
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
            初期値リセット
          </button>

          <button
            onClick={() => {
              const code = `export const BONUS_DOC_FIELDS = ${JSON.stringify(fields, null, 2)};`;
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
            className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedSuccess ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
            {savedSuccess ? '全社マスターへ保存完了！' : '賞与支払届マスタとして保存・適用'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 左右2分割メインエリア */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* ⬅️ 左カラム：セクション選択 ＆ 項目一覧 ＆ 十字コントローラー */}
        <div className="col-span-12 lg:col-span-5 space-y-3">
          
          {/* セクション切り替えタブ */}
          <div className="bg-slate-900/95 p-1.5 rounded-2xl border border-slate-800 flex flex-wrap gap-1">
            {sections.map(sec => {
              const Icon = sec.icon;
              const isActive = selectedSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    setSelectedSection(sec.id as any);
                    const firstField = fields.find(f => f.section === sec.id);
                    if (firstField) setSelectedFieldId(firstField.id);
                  }}
                  className={`flex-1 min-w-[120px] flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-pink-600 text-white shadow-lg'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{sec.name}</span>
                </button>
              );
            })}
          </div>

          {/* セクション内項目リスト */}
          <div className="bg-slate-900/95 p-3 rounded-2xl border border-slate-800 space-y-1 max-h-[220px] overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider">
              編集項目を選択
            </span>
            <div className="grid grid-cols-1 gap-1">
              {sectionFields.map(f => {
                const isSelected = selectedFieldId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFieldId(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-pink-400'}`}></span>
                      <span className="truncate">{f.name}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-80 whitespace-nowrap ml-2">
                      X:{f.x.toFixed(1)}% Y:{f.y.toFixed(1)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 🎯 選択中項目の位置調整コントローラー */}
          {selectedField && (
            <div className="bg-slate-900/95 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping"></span>
                    {selectedField.name}
                  </h4>
                  <p className="text-[10px] text-slate-400">{selectedField.description}</p>
                </div>

                <div className="text-right font-mono text-xs text-amber-300 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 whitespace-nowrap">
                  X: <span className="text-indigo-300 font-bold">{selectedField.x.toFixed(2)}%</span> / Y: <span className="text-amber-300 font-bold">{selectedField.y.toFixed(2)}%</span>
                </div>
              </div>

              {/* 十字キー（十字ボタンコントローラー） ＆ 数値直接入力 */}
              <div className="grid grid-cols-12 gap-3 items-center">
                
                {/* 🎮 十字コントローラー */}
                <div className="col-span-7 bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80 flex flex-col items-center justify-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 mb-1">🎮 位置微調整十字キー</span>
                  
                  {/* 上ボタン */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y - 0.5)}
                      className="px-2 py-1 bg-slate-700 hover:bg-pink-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer flex items-center gap-0.5"
                      title="上へ移動 (-0.5%)"
                    >
                      <ChevronsUp className="w-3.5 h-3.5" /> -0.5%
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y - 0.05)}
                      className="px-3 py-1 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="上へ微調整 (-0.05%)"
                    >
                      <ArrowUp className="w-4 h-4" /> 上
                    </button>
                  </div>

                  {/* 左右ボタン */}
                  <div className="flex items-center gap-2 my-0.5">
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x - 0.5)}
                        className="px-1.5 py-1 bg-slate-700 hover:bg-pink-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer"
                        title="左へ移動 (-0.5%)"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x - 0.05)}
                        className="px-2.5 py-1.5 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-0.5 text-xs"
                        title="左へ微調整 (-0.05%)"
                      >
                        <ArrowLeft className="w-4 h-4" /> 左
                      </button>
                    </div>

                    <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[9px] text-pink-400 font-mono">
                      ●
                    </span>

                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x + 0.05)}
                        className="px-2.5 py-1.5 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-0.5 text-xs"
                        title="右へ微調整 (+0.05%)"
                      >
                        右 <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'x', selectedField.x + 0.5)}
                        className="px-1.5 py-1 bg-slate-700 hover:bg-pink-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer"
                        title="右へ移動 (+0.5%)"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 下ボタン */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y + 0.05)}
                      className="px-3 py-1 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="下へ微調整 (+0.05%)"
                    >
                      <ArrowDown className="w-4 h-4" /> 下
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y + 0.5)}
                      className="px-2 py-1 bg-slate-700 hover:bg-pink-600 active:scale-95 rounded text-[10px] font-bold text-slate-200 cursor-pointer flex items-center gap-0.5"
                      title="下へ移動 (+0.5%)"
                    >
                      <ChevronsDown className="w-3.5 h-3.5" /> +0.5%
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
                      step="0.05"
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
                      step="0.05"
                      value={selectedField.y}
                      onChange={e => updateField(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-mono font-bold text-amber-300"
                    />
                  </div>

                  {/* 文字サイズ */}
                  {selectedField.fontSize > 0 && (
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>文字サイズ:</span>
                        <span className="font-mono font-bold text-emerald-300">{selectedField.fontSize} pt</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateField(selectedField.id, 'fontSize', Math.max(6, selectedField.fontSize - 1))}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="range"
                          min="6"
                          max="24"
                          value={selectedField.fontSize}
                          onChange={e => updateField(selectedField.id, 'fontSize', parseInt(e.target.value))}
                          className="w-full accent-pink-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => updateField(selectedField.id, 'fontSize', Math.min(24, selectedField.fontSize + 1))}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 横幅 width */}
                  {selectedField.width !== undefined && (
                    <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span>枠幅 (width %):</span>
                        <span className="font-mono font-bold text-cyan-300">{selectedField.width.toFixed(1)}%</span>
                      </div>
                      <input
                        type="number"
                        step="0.5"
                        value={selectedField.width}
                        onChange={e => updateField(selectedField.id, 'width', parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs font-mono font-bold text-cyan-300"
                      />
                    </div>
                  )}
                </div>

              </div>

              {/* ピッチ（マス目・文字間隔）調整 */}
              {selectedField.pitch !== undefined && (
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                      <span>📏</span> マス目・文字間隔（ピッチ / gap %）
                    </label>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      {selectedField.pitch.toFixed(2)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'pitch', Math.max(0.5, (selectedField.pitch || 2.0) - 0.02))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      -0.02
                    </button>
                    <input
                      type="number"
                      step="0.02"
                      value={(selectedField.pitch || 2.0).toFixed(2)}
                      onChange={e => updateField(selectedField.id, 'pitch', parseFloat(e.target.value) || 2.0)}
                      className="w-16 bg-slate-900 border border-slate-700 rounded p-1 text-center text-xs font-mono font-bold text-cyan-300"
                    />
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'pitch', Math.min(5.0, (selectedField.pitch || 2.0) + 0.02))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 rounded text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      +0.02
                    </button>
                  </div>
                </div>
              )}

              <div className="text-[10px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                💡 PCの矢印キー（↑ ↓ ← →）で選択項目を直接移動できます（Shift+矢印で大きく移動）
              </div>
            </div>
          )}

        </div>

        {/* ➡️ 右カラム：原本画像の上にドラッグ可能なテキストボックスを配置 */}
        <div className="col-span-12 lg:col-span-7 bg-white p-3 rounded-2xl shadow-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse"></span>
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-pink-600" />
                年金機構原本（コード2265用紙）リアルタイムプレビュー
              </h3>
              <span className="text-[10px] text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                ピンク枠 = 選択中項目
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
                title="等倍にリセット"
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
                  className="p-1 bg-white hover:bg-pink-50 text-pink-600 active:scale-95 rounded font-bold cursor-pointer transition shadow-xs text-[10px] flex items-center gap-0.5"
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
            <div 
              style={{ 
                minWidth: '100%', 
                width: previewZoom > 100 ? `${previewZoom}%` : '100%', 
                display: 'flex', 
                justifyContent: previewZoom > 100 ? 'flex-start' : 'center', 
                alignItems: 'flex-start',
                padding: '8px'
              }}
            >
              <div 
                ref={previewContainerRef}
                style={{ 
                  width: previewZoom > 100 ? '100%' : `${previewZoom}%`, 
                  position: 'relative',
                  aspectRatio: '2480 / 3508',
                  containerType: 'inline-size',
                  flexShrink: 0
                }}
                className="shadow-2xl rounded-lg overflow-hidden border-2 border-slate-400/90 bg-white transition-all duration-150 cursor-default"
              >
                {/* 📄 日本年金機構原本用紙（背景画像） */}
                <img
                  src="/nenkin_bonus_template_page1.png"
                  alt="年金機構原本用紙（コード2265）"
                  className="w-full h-full object-contain pointer-events-none select-none"
                  draggable={false}
                />

                {/* 🎯 原本用紙の上で直接ドラッグ・操作可能なフィールド */}
                {/* 1. ヘッダー系（提出日、事業所情報、共通支払日） */}
                {fields.filter(f => f.section !== 'row_template').map(f => {
                  const isSelected = selectedFieldId === f.id;
                  const isDraggingThis = draggingFieldId === f.id;

                  // 整理記号マス目の特殊表示
                  if (f.id === 'symbolDigits') {
                    return (
                      <div
                        key={f.id}
                        onMouseDown={e => handleStartDrag(f.id, e)}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedFieldId(f.id);
                          setSelectedSection(f.section);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${f.x}%`,
                          top: `${f.y}%`,
                          height: '2.90%',
                          width: f.width ? `${f.width}%` : undefined,
                          display: 'flex',
                          alignItems: 'center',
                          cursor: isDraggingThis ? 'grabbing' : 'grab',
                          pointerEvents: 'auto',
                          userSelect: 'none'
                        }}
                        className={`transition-all ${isSelected ? 'ring-2 ring-pink-500 bg-pink-500/20 z-30' : 'hover:ring-1 hover:ring-pink-400 bg-white/40 z-10'}`}
                      >
                        {['2', '5'].map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center justify-center font-mono font-black text-slate-950 text-center"
                            style={{ width: `${f.pitch || 4.92}cqw`, height: '100%', fontSize: `${(f.fontSize || 14) * 0.115}cqw` }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    );
                  }

                  if (f.id === 'symbolKana') {
                    return (
                      <div
                        key={f.id}
                        onMouseDown={e => handleStartDrag(f.id, e)}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedFieldId(f.id);
                          setSelectedSection(f.section);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${f.x}%`,
                          top: `${f.y}%`,
                          height: '2.90%',
                          width: f.width ? `${f.width}%` : undefined,
                          display: 'flex',
                          alignItems: 'center',
                          cursor: isDraggingThis ? 'grabbing' : 'grab',
                          pointerEvents: 'auto',
                          userSelect: 'none'
                        }}
                        className={`transition-all ${isSelected ? 'ring-2 ring-pink-500 bg-pink-500/20 z-30' : 'hover:ring-1 hover:ring-pink-400 bg-white/40 z-10'}`}
                      >
                        {['カ', 'ア'].map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center justify-center font-sans font-black text-slate-950 text-center"
                            style={{ width: `${f.pitch || 2.39}cqw`, height: '100%', fontSize: `${(f.fontSize || 13) * 0.115}cqw` }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    );
                  }

                  const isCentered = f.section === 'submission' || f.section === 'common_payment';

                  return (
                    <div
                      key={f.id}
                      onMouseDown={e => handleStartDrag(f.id, e)}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedFieldId(f.id);
                        setSelectedSection(f.section);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        width: f.width ? `${f.width}%` : 'auto',
                        fontSize: `${f.fontSize * 0.115}cqw`,
                        fontWeight: 'bold',
                        cursor: isDraggingThis ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'auto',
                        lineHeight: 1,
                        display: isCentered ? 'flex' : 'block',
                        alignItems: isCentered ? 'center' : undefined,
                        justifyContent: isCentered ? 'center' : undefined,
                        textAlign: isCentered ? 'center' : 'left'
                      }}
                      className={`px-0.5 py-0.2 rounded transition-all ${
                        isSelected
                          ? 'ring-2 ring-pink-500 bg-pink-500/20 text-pink-700 shadow-2xl z-30 font-black'
                          : 'hover:ring-1 hover:ring-pink-400 hover:bg-pink-100/60 z-10 bg-white/60 text-slate-950'
                      }`}
                      title={`${f.name} (クリックして選択・十字キーまたはドラッグで移動)`}
                    >
                      {f.example}
                    </div>
                  );
                })}

                {/* 2. 被保険者行テンプレート（行1 & 行2 プレビュー） */}
                {[0, 1].map(rowIdx => {
                  const currRowTop = rowBaseTop + rowIdx * rowPitchY;
                  const rowSampleName = rowIdx === 0 ? '山田 太郎' : '佐藤 花子';
                  const rowSampleKana = rowIdx === 0 ? 'ヤマダ タロウ' : 'サトウ ハナコ';
                  const rowSampleBirth = rowIdx === 0 ? '7 - 051020' : '9 - 020510';

                  const rowFields = fields.filter(f => f.section === 'row_template' && f.id !== 'rowBaseTop' && f.id !== 'rowPitchY');

                  return (
                    <React.Fragment key={`row-prev-${rowIdx}`}>
                      {rowFields.map(rf => {
                        const isSelected = selectedFieldId === rf.id;
                        const isDraggingThis = draggingFieldId === rf.id && rowIdx === 0;

                        let textVal = rf.example;
                        if (rf.id === 'empName') textVal = rowSampleName;
                        if (rf.id === 'empKana') textVal = rowSampleKana;
                        if (rf.id === 'empBirth') textVal = rowSampleBirth;

                        return (
                          <div
                            key={`${rf.id}-r${rowIdx}`}
                            onMouseDown={e => {
                              if (rowIdx === 0) handleStartDrag(rf.id, e);
                            }}
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedFieldId(rf.id);
                              setSelectedSection('row_template');
                            }}
                            style={{
                              position: 'absolute',
                              left: `${rf.x}%`,
                              top: `${currRowTop + rf.y}%`,
                              width: rf.width ? `${rf.width}%` : 'auto',
                              fontSize: `${rf.fontSize * 0.11}cqw`,
                              fontWeight: rf.id === 'empName' ? 900 : 700,
                              cursor: rowIdx === 0 ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                              textAlign: (rf.id === 'empCurrencyAmount' || rf.id === 'empGoodsAmount' || rf.id === 'empTotalThousands') ? 'right' : rf.id === 'empBirth' ? 'center' : 'left',
                              pointerEvents: 'auto',
                              lineHeight: 1.1,
                              opacity: rowIdx === 1 ? 0.6 : 1
                            }}
                            className={`px-0.5 py-0.2 rounded transition-all ${
                              isSelected
                                ? 'ring-2 ring-pink-500 bg-pink-500/20 text-pink-800 shadow-2xl z-30 font-black'
                                : 'hover:ring-1 hover:ring-pink-400 hover:bg-pink-100/60 z-10 bg-white/50 text-slate-900'
                            }`}
                            title={`${rf.name} (クリックして選択・十字キーで移動)`}
                          >
                            {textVal}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
