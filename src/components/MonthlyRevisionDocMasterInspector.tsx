import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Save, CheckCircle,
  Building2, Calendar, Users, Loader2,
  ZoomIn, ZoomOut, RotateCcw,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight,
  Sliders, X,
  AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';

import { 
  loadMonthlyRevisionDocCoordinates, 
  resetMonthlyRevisionDocCoordinates,
  fetchMonthlyRevisionDocCoordinatesFromDb,
  saveMonthlyRevisionDocCoordinatesToDb,
  MONTHLY_REVISION_COORDS_UPDATE_EVENT,
  type MonthlyRevisionDocFieldConfig 
} from '../lib/monthlyRevisionDocCoordinates';

interface MonthlyRevisionDocMasterInspectorProps {
  tenantId?: string;
  onClose?: () => void;
}

export const MonthlyRevisionDocMasterInspector: React.FC<MonthlyRevisionDocMasterInspectorProps> = ({ 
  tenantId,
  onClose
}) => {
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(tenantId || '');

  // 選択中セクション
  const [selectedSection, setSelectedSection] = useState<'submission' | 'office' | 'row_template'>('row_template');
  // 選択中フィールドID
  const [selectedFieldId, setSelectedFieldId] = useState<string>('empName');
  // ドラッグ中フィールドID
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'db_saved' | 'local_only'>('idle');

  // プレビューコンテナのRef
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number } | null>(null);

  // 座標State
  const [fields, setFields] = useState<MonthlyRevisionDocFieldConfig[]>(() => {
    return loadMonthlyRevisionDocCoordinates(resolvedTenantId);
  });

  // テナント解決
  useEffect(() => {
    if (tenantId) {
      setResolvedTenantId(tenantId);
      return;
    }
    const resolveTenant = async () => {
      try {
        const { data: rpcTenant } = await supabase.rpc('get_user_tenant_id');
        if (rpcTenant) {
          setResolvedTenantId(rpcTenant);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle();
          if (profile?.tenant_id) {
            setResolvedTenantId(profile.tenant_id);
          }
        }
      } catch (e) {
        console.warn('Failed to resolve tenant in MonthlyRevisionDocMasterInspector:', e);
      }
    };
    resolveTenant();
  }, [tenantId]);

  // DBから座標取得
  useEffect(() => {
    fetchMonthlyRevisionDocCoordinatesFromDb(resolvedTenantId).then(dbCoords => {
      if (dbCoords && dbCoords.length > 0) {
        setFields(dbCoords);
      }
    });
  }, [resolvedTenantId]);

  // 項目値の更新（リアルタイムブロードキャスト）
  const updateField = useCallback((id: string, key: keyof MonthlyRevisionDocFieldConfig, value: any) => {
    setFields(prev => {
      let finalVal = value;
      if (typeof value === 'number') {
        const precision = key === 'pitch' ? 100 : (key === 'x' || key === 'y') ? 100 : 1;
        finalVal = Math.round(value * precision) / precision;
      }
      const updated = prev.map(f => f.id === id ? { ...f, [key]: finalVal } : f);
      window.dispatchEvent(new CustomEvent(MONTHLY_REVISION_COORDS_UPDATE_EVENT, { detail: updated }));
      return updated;
    });
  }, []);

  // 項目値のアトミック複数更新
  const updateFieldMulti = useCallback((id: string, updates: Partial<MonthlyRevisionDocFieldConfig>) => {
    setFields(prev => {
      const sanitized: Partial<MonthlyRevisionDocFieldConfig> = { ...updates };
      if (typeof sanitized.pitch === 'number') sanitized.pitch = Math.round(sanitized.pitch * 100) / 100;
      if (typeof sanitized.width === 'number') sanitized.width = Math.round(sanitized.width * 100) / 100;
      if (typeof sanitized.x === 'number') sanitized.x = Math.round(sanitized.x * 100) / 100;
      if (typeof sanitized.y === 'number') sanitized.y = Math.round(sanitized.y * 100) / 100;
      const updated = prev.map(f => f.id === id ? { ...f, ...sanitized } : f);
      window.dispatchEvent(new CustomEvent(MONTHLY_REVISION_COORDS_UPDATE_EVENT, { detail: updated }));
      return updated;
    });
  }, []);

  const selectedField = fields.find(f => f.id === selectedFieldId);
  const sectionFields = fields.filter(f => f.section === selectedSection);

  const rowBaseTop = fields.find(f => f.id === 'rowBaseTop')?.y ?? 31.6;
  const rowPitchY = fields.find(f => f.id === 'rowPitchY')?.y ?? 11.93;

  // 🖱️ ドラッグ開始
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
      clientX: e.clientX,
      clientY: e.clientY,
      startX: target.x,
      startY: target.y
    };
  };

  // 🖱️ マウス移動・ドラッグ中
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingFieldId || !dragStartRef.current || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPixels = e.clientX - dragStartRef.current.clientX;
      const deltaYPixels = e.clientY - dragStartRef.current.clientY;

      const deltaXPct = (deltaXPixels / rect.width) * 100;
      const deltaYPct = (deltaYPixels / rect.height) * 100;

      const newX = Math.max(0, Math.min(100, Math.round((dragStartRef.current.startX + deltaXPct) * 100) / 100));
      const newY = Math.max(0, Math.min(100, Math.round((dragStartRef.current.startY + deltaYPct) * 100) / 100));

      updateFieldMulti(draggingFieldId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      if (draggingFieldId) {
        setDraggingFieldId(null);
        dragStartRef.current = null;
      }
    };

    if (draggingFieldId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingFieldId, updateFieldMulti]);

  // ⌨️ キーボード矢印キーでの微調整
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedFieldId) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      const step = e.shiftKey ? 0.5 : 0.05;
      const cur = fields.find(f => f.id === selectedFieldId);
      if (!cur) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateField(selectedFieldId, 'y', cur.y - step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateField(selectedFieldId, 'y', cur.y + step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        updateField(selectedFieldId, 'x', cur.x - step);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        updateField(selectedFieldId, 'x', cur.x + step);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, fields, updateField]);

  // DB保存
  const handleSaveToDb = async () => {
    setIsSaving(true);
    try {
      const res = await saveMonthlyRevisionDocCoordinatesToDb(fields, resolvedTenantId);
      if (res.inDb) {
        setSaveStatus('db_saved');
      } else {
        setSaveStatus('local_only');
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (e: any) {
      console.warn('Save notice:', e);
      setSaveStatus('local_only');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // 初期化リセット
  const handleReset = () => {
    if (!confirm('被保険者報酬月額変更届（コード2221）の印字座標を初期デフォルト値に戻しますか？')) return;
    const def = resetMonthlyRevisionDocCoordinates(resolvedTenantId);
    setFields(def);
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col font-sans select-none">
      {/* 🧭 トップバー */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center font-black shadow-lg text-lg">
            📐
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white">
                日本年金機構 被保険者報酬月額変更届（コード2221用紙）印字座標マスタ設定
              </h1>
              <span className="text-[10px] bg-purple-500/30 text-purple-300 border border-purple-500/50 font-black px-2 py-0.5 rounded-full font-mono">
                FORM-2221-INSPECTOR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              原本用紙のプレビュー上で項目を直接クリック＆ドラッグ、または左パネルの十字キーで0.05%刻みで微調整し、全社マスタとしてDB保存します。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* プレビューズーム */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              title="縮小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPreviewZoom(100)}
              className="px-2 font-mono font-bold text-slate-300 hover:text-white"
              title="等倍にリセット"
            >
              {previewZoom}%
            </button>
            <button
              onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              title="拡大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* 初期化リセット */}
          <button
            onClick={handleReset}
            className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>初期リセット</span>
          </button>

          {/* DB全社一括保存 */}
          <button
            onClick={handleSaveToDb}
            disabled={isSaving}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedSuccess ? (
              <CheckCircle className="w-4 h-4 text-emerald-300" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? '保存中...'
                : savedSuccess
                  ? saveStatus === 'db_saved'
                    ? '✅ 全社マスタDB保存完了！'
                    : '✅ 設定保存完了（即時反映）'
                  : '💾 全社マスタとしてDB保存'}
            </span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition cursor-pointer"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 🧭 メインレイアウト（2カラム） */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* 🎛️ 左カラム：コントロールパネル */}
        <div className="col-span-12 lg:col-span-5 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto p-4 space-y-4">
          {/* セクション選択タブ */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedSection('row_template')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                selectedSection === 'row_template'
                  ? 'bg-purple-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>被保険者 行項目</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('submission')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                selectedSection === 'submission'
                  ? 'bg-purple-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>提出年月日</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedSection('office')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                selectedSection === 'office'
                  ? 'bg-purple-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>事業所情報</span>
            </button>
          </div>

          {/* 項目一覧（選択カード） */}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {sectionFields.map(f => {
              const isSelected = selectedFieldId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`w-full text-left p-2 rounded-xl transition flex items-center justify-between text-xs cursor-pointer border ${
                    isSelected
                      ? 'bg-purple-950/70 border-purple-500 text-white shadow-inner font-bold'
                      : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-purple-400' : 'bg-slate-600'}`} />
                    <span className="truncate">{f.name}</span>
                  </div>
                  <span className="font-mono text-[10px] text-purple-300 shrink-0">
                    X:{f.x.toFixed(1)}% Y:{f.y.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* 🎯 選択中項目の微調整パネル */}
          {selectedField && (
            <div className="bg-slate-950/90 border-2 border-purple-500/50 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    {selectedField.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{selectedField.description}</p>
                </div>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                  {selectedField.id}
                </span>
              </div>

              {/* 十字キー微調整 ＆ 数値入力 */}
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* 十字キー */}
                <div className="col-span-7 flex flex-col items-center gap-1 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 mb-1">
                    十字キー微調整 (X: {selectedField.x.toFixed(2)}%, Y: {selectedField.y.toFixed(2)}%)
                  </div>

                  {/* 上ボタン */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y - 0.5)}
                      className="px-2 py-1 bg-slate-800 hover:bg-purple-700 active:scale-95 rounded text-[10px] font-bold text-slate-300 cursor-pointer flex items-center gap-0.5"
                      title="上へ大きく (-0.5%)"
                    >
                      <ChevronsUp className="w-3.5 h-3.5" /> -0.5%
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y - 0.05)}
                      className="px-3.5 py-1 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="上へ微調整 (-0.05%)"
                    >
                      <ArrowUp className="w-4 h-4" /> 上
                    </button>
                  </div>

                  {/* 左右ボタン */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'x', selectedField.x - 0.5)}
                      className="p-1.5 bg-slate-800 hover:bg-purple-700 active:scale-95 rounded text-slate-300 cursor-pointer"
                      title="左へ大きく (-0.5%)"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'x', selectedField.x - 0.05)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="左へ微調整 (-0.05%)"
                    >
                      <ArrowLeft className="w-4 h-4" /> 左
                    </button>

                    <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-400 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    </div>

                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'x', selectedField.x + 0.05)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="右へ微調整 (+0.05%)"
                    >
                      右 <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'x', selectedField.x + 0.5)}
                      className="p-1.5 bg-slate-800 hover:bg-purple-700 active:scale-95 rounded text-slate-300 cursor-pointer"
                      title="右へ大きく (+0.5%)"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 下ボタン */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y + 0.05)}
                      className="px-3.5 py-1 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-black rounded-lg shadow-md cursor-pointer flex items-center gap-1 text-xs"
                      title="下へ微調整 (+0.05%)"
                    >
                      <ArrowDown className="w-4 h-4" /> 下
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField(selectedField.id, 'y', selectedField.y + 0.5)}
                      className="px-2 py-1 bg-slate-800 hover:bg-purple-700 active:scale-95 rounded text-[10px] font-bold text-slate-300 cursor-pointer flex items-center gap-0.5"
                      title="下へ大きく (+0.5%)"
                    >
                      <ChevronsDown className="w-3.5 h-3.5" /> +0.5%
                    </button>
                  </div>
                </div>

                {/* 数値直接入力 */}
                <div className="col-span-5 space-y-2">
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <label className="block text-[10px] text-slate-400 mb-0.5 font-bold">横位置 X (%):</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedField.x}
                      onChange={e => updateField(selectedField.id, 'x', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-xs font-mono font-bold text-purple-300"
                    />
                  </div>

                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <label className="block text-[10px] text-slate-400 mb-0.5 font-bold">縦位置 Y (%):</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedField.y}
                      onChange={e => updateField(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-xs font-mono font-bold text-amber-300"
                    />
                  </div>

                  {/* フォントサイズ */}
                  {selectedField.fontSize > 0 && (
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5 font-bold">
                        <span>文字サイズ:</span>
                        <span className="font-mono text-emerald-400 font-bold">{selectedField.fontSize} pt</span>
                      </div>
                      <input
                        type="range"
                        min="6"
                        max="24"
                        value={selectedField.fontSize}
                        onChange={e => updateField(selectedField.id, 'fontSize', parseInt(e.target.value))}
                        className="w-full accent-purple-500 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* 印字枠幅 */}
                  {selectedField.width !== undefined && (
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <label className="block text-[10px] text-slate-400 mb-0.5 font-bold">印字幅 (%):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={selectedField.width}
                        onChange={e => updateField(selectedField.id, 'width', parseFloat(e.target.value) || 10)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-xs font-mono font-bold text-cyan-300"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 文字揃え（配置方向：左詰め・センタリング・右詰め） */}
              <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>文字配置（揃え方向）:</span>
                  <span className="font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50 text-[11px]">
                    {selectedField.align === 'center' ? '中央揃え (センタリング)' : selectedField.align === 'right' ? '右詰め' : '左詰め'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => updateField(selectedField.id, 'align', 'left')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      (!selectedField.align || selectedField.align === 'left')
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                    <span>左詰め</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField(selectedField.id, 'align', 'center')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedField.align === 'center'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                    <span>センタリング</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField(selectedField.id, 'align', 'right')}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedField.align === 'right'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                    <span>右詰め</span>
                  </button>
                </div>
              </div>

              {/* 📏 マス目ピッチ（1マスの幅・文字間隔）調整 */}
              <div className="bg-slate-900 p-3.5 rounded-2xl border border-cyan-800/60 shadow-md space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>マス目ピッチ（1マスの幅）:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedField.pitch !== undefined && (
                      <button
                        type="button"
                        onClick={() => updateField(selectedField.id, 'pitch', undefined)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 rounded text-[10px] font-bold border border-slate-700 transition cursor-pointer"
                        title="マス目ピッチ（等幅割り付け）を解除し、自然な文字並びに戻す"
                      >
                        ピッチ解除
                      </button>
                    )}
                    <span className="font-mono bg-cyan-950 px-2 py-0.5 rounded border border-cyan-700 text-cyan-200 text-xs font-bold">
                      {selectedField.pitch ? `${selectedField.pitch.toFixed(2)}%` : '通常印字（ピッチなし）'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.50"
                    max="5.00"
                    step="0.01"
                    value={selectedField.pitch || 2.00}
                    onChange={e => updateField(selectedField.id, 'pitch', parseFloat(e.target.value) || 2.0)}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-950 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.pitch || 2.0;
                      updateField(selectedField.id, 'pitch', Math.max(0.5, Math.round((cur - 0.05) * 100) / 100));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                    title="-0.05% 狭くする"
                  >
                    -0.05
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.pitch || 2.0;
                      updateField(selectedField.id, 'pitch', Math.max(0.5, Math.round((cur - 0.01) * 100) / 100));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                    title="-0.01% 狭くする"
                  >
                    -0.01
                  </button>

                  {/* 数値直接入力 */}
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="6.0"
                    value={selectedField.pitch || ''}
                    placeholder="ピッチなし"
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      updateField(selectedField.id, 'pitch', isNaN(val) ? undefined : val);
                    }}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg p-1 text-center font-mono font-bold text-xs text-cyan-300"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.pitch || 2.0;
                      updateField(selectedField.id, 'pitch', Math.min(6.0, Math.round((cur + 0.01) * 100) / 100));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                    title="+0.01% 広くする"
                  >
                    +0.01
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = selectedField.pitch || 2.0;
                      updateField(selectedField.id, 'pitch', Math.min(6.0, Math.round((cur + 0.05) * 100) / 100));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                    title="+0.05% 広くする"
                  >
                    +0.05
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                💡 <strong>ワンポイント:</strong> PCの矢印キー（↑ ↓ ← →）で選択項目を直接移動できます（Shift+矢印で大きく移動）。
              </div>
            </div>
          )}
        </div>

        {/* 📄 右カラム：原本PDF完全一致リアルタイムプレビュー ＆ ドラッグ可能キャンバス */}
        <div className="col-span-12 lg:col-span-7 bg-slate-950 p-4 flex flex-col items-center justify-start overflow-auto">
          <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
              <span className="font-bold text-white">日本年金機構 原本用紙（コード2221）リアルタイム調整</span>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                紫枠 = 選択中項目（直接クリックまたはドラッグ可能）
              </span>
            </div>
            <div className="text-slate-400 text-[11px]">
              ズーム: <strong className="text-white">{previewZoom}%</strong>
            </div>
          </div>

          <div
            style={{
              transform: `scale(${previewZoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
          >
            {/* A4キャンバス */}
            <div
              ref={containerRef}
              className="relative bg-white shadow-2xl overflow-hidden text-slate-950"
              style={{
                width: '210mm',
                height: '297mm',
                aspectRatio: '2480 / 3508',
                containerType: 'inline-size',
                position: 'relative',
                boxSizing: 'border-box'
              }}
            >
              {/* 📄 日本年金機構原本用紙（下敷き原本：添付PDFそのもの） */}
              <img
                src="/nenkin_monthly_revision_template_page1.png"
                alt="日本年金機構公式届出用紙（コード2221）"
                className="w-full h-full object-contain pointer-events-none select-none absolute inset-0 z-0"
                draggable={false}
              />

              {/* 🎯 原本用紙の上で直接ドラッグ・クリック選択可能なフィールド群 */}

              {/* 1. 提出日・事業所情報系 */}
              {fields.filter(f => f.section !== 'row_template').map(f => {
                const isSelected = selectedFieldId === f.id;
                const isDraggingThis = draggingFieldId === f.id;

                // 整理記号マス目の特殊表示
                if (f.id === 'symbolDigits') {
                  const digitPitch = f.pitch || 2.30;
                  const containerWidth = f.width || (digitPitch * 4);
                  const alignVal = f.align || 'left';
                  const justifyContent = alignVal === 'right' ? 'flex-end' : alignVal === 'center' ? 'center' : 'flex-start';
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
                        width: `${containerWidth}%`,
                        height: '2.5%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent,
                        cursor: isDraggingThis ? 'grabbing' : 'grab',
                        pointerEvents: 'auto',
                        userSelect: 'none'
                      }}
                      className={`transition-all ${
                        isSelected
                          ? 'ring-2 ring-purple-500 bg-purple-500/20 z-30'
                          : 'hover:ring-1 hover:ring-purple-400 bg-white/40 z-10'
                      }`}
                    >
                      {['2', '5', '0', '1'].map((c, i) => (
                        <div
                          key={i}
                          className="h-full flex items-center justify-center font-mono font-black text-slate-950 shrink-0"
                          style={{
                            width: `${(digitPitch / containerWidth) * 100}%`,
                            fontSize: `${(f.fontSize || 13) * 0.115}cqi`
                          }}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  );
                }

                if (f.id === 'symbolKana') {
                  const kanaPitch = f.pitch || 2.30;
                  const containerWidth = f.width || (kanaPitch * 4);
                  const alignVal = f.align || 'left';
                  const justifyContent = alignVal === 'right' ? 'flex-end' : alignVal === 'center' ? 'center' : 'flex-start';
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
                        width: `${containerWidth}%`,
                        height: '2.5%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent,
                        cursor: isDraggingThis ? 'grabbing' : 'grab',
                        pointerEvents: 'auto',
                        userSelect: 'none'
                      }}
                      className={`transition-all ${
                        isSelected
                          ? 'ring-2 ring-purple-500 bg-purple-500/20 z-30'
                          : 'hover:ring-1 hover:ring-purple-400 bg-white/40 z-10'
                      }`}
                    >
                      {['カ', 'ア', '', ''].map((c, i) => (
                        <div
                          key={i}
                          className="h-full flex items-center justify-center font-bold text-slate-950 shrink-0"
                          style={{
                            width: `${(kanaPitch / containerWidth) * 100}%`,
                            fontSize: `${(f.fontSize || 12.5) * 0.115}cqi`
                          }}
                        >
                          {c}
                        </div>
                      ))}
                    </div>
                  );
                }

                const pitchVal = f.pitch || 0;
                const alignVal = f.align || 'left';
                const justifyContent = alignVal === 'right' ? 'flex-end' : alignVal === 'center' ? 'center' : 'flex-start';
                const displayStr = ['companyZip', 'companyZipFirst', 'companyZipLast'].includes(f.id)
                  ? (f.example || '').replace(/[^0-9]/g, '')
                  : (f.example || '');

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
                      width: f.width ? `${f.width}%` : (pitchVal > 0 ? 'max-content' : 'auto'),
                      fontSize: `${f.fontSize * 0.115}cqi`,
                      fontWeight: 'bold',
                      cursor: isDraggingThis ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'auto',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent,
                      textAlign: alignVal
                    }}
                    className={`px-1 py-0.5 rounded transition-all ${
                      isSelected
                        ? 'ring-2 ring-purple-500 bg-purple-500/20 text-purple-900 shadow-xl z-30 font-black'
                        : 'hover:ring-1 hover:ring-purple-400 hover:bg-purple-100/50 z-10 bg-white/60 text-slate-900'
                    }`}
                    title={`${f.name} (クリックして選択・ドラッグまたは十字キーで移動)`}
                  >
                    {pitchVal > 0 ? (
                      <div className="flex items-center pointer-events-none" style={{ justifyContent }}>
                        {displayStr.split('').map((char, cIdx) => (
                          <span
                            key={cIdx}
                            style={{
                              display: 'inline-block',
                              width: `${pitchVal}cqi`,
                              fontSize: `${f.fontSize * 0.115}cqi`,
                              fontWeight: 900,
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              lineHeight: 1,
                              flexShrink: 0
                            }}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ width: f.width ? '100%' : 'auto', textAlign: alignVal }}>{displayStr}</span>
                    )}
                  </div>
                );
              })}

              {/* 2. 被保険者行テンプレート（行1 & 行2 プレビュー） */}
              {[0, 1].map(rowIdx => {
                const currRowTop = rowBaseTop + rowIdx * rowPitchY;
                const rowFields = fields.filter(f => f.section === 'row_template' && f.id !== 'rowBaseTop' && f.id !== 'rowPitchY');

                return (
                  <React.Fragment key={`row-prev-${rowIdx}`}>
                    {rowFields.map(rf => {
                      const isSelected = selectedFieldId === rf.id;
                      const isDraggingThis = draggingFieldId === rf.id && rowIdx === 0;
                      const rfPitch = rf.pitch || 0;
                      const rfAlign = rf.align || (
                        (rf.id === 'empCurrentHealthStandard' || rf.id === 'empCurrentPensionStandard' || rf.id === 'empRetroactiveAmount')
                          ? 'right'
                          : (rf.id === 'empInsuranceNumber' || rf.id === 'empBirth' || rf.id === 'empRevisionYearMonth' || rf.id === 'empPreviousRevisionYM' || rf.id === 'empWageChangeType')
                            ? 'center'
                            : 'left'
                      );
                      const justifyContent = rfAlign === 'right' ? 'flex-end' : rfAlign === 'center' ? 'center' : 'flex-start';

                      let textVal = rf.example || '';
                      if (rf.id === 'empInsuranceNumber') {
                        textVal = rowIdx === 0 ? '1' : '2';
                      } else if (rf.id === 'empName') {
                        textVal = rowIdx === 0 ? '山田 太郎' : '佐藤 花子';
                      }

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
                            width: rf.width ? `${rf.width}%` : (rfPitch > 0 ? 'max-content' : 'auto'),
                            fontSize: `${rf.fontSize * 0.115}cqi`,
                            fontWeight: 'bold',
                            cursor: rowIdx === 0 ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'auto',
                            lineHeight: 1,
                            opacity: rowIdx === 1 ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent,
                            textAlign: rfAlign
                          }}
                          className={`px-1 py-0.5 rounded transition-all ${
                            isSelected
                              ? 'ring-2 ring-purple-500 bg-purple-500/20 text-purple-900 shadow-xl z-30 font-black'
                              : 'hover:ring-1 hover:ring-purple-400 hover:bg-purple-100/50 z-10 bg-white/60 text-slate-900'
                          }`}
                          title={`${rf.name} (クリックして選択・ドラッグまたは十字キーで移動)`}
                        >
                          {rfPitch > 0 ? (
                            <div className="flex items-center pointer-events-none" style={{ justifyContent }}>
                              {String(textVal).split('').map((char, cIdx) => (
                                <span
                                  key={cIdx}
                                  style={{
                                    display: 'inline-block',
                                    width: `${rfPitch}cqi`,
                                    fontSize: `${rf.fontSize * 0.115}cqi`,
                                    fontWeight: 900,
                                    textAlign: 'center',
                                    fontFamily: 'monospace',
                                    lineHeight: 1,
                                    flexShrink: 0
                                  }}
                                >
                                  {char}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ width: rf.width ? '100%' : 'auto', textAlign: rfAlign }}>{textVal}</span>
                          )}
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
  );
};
