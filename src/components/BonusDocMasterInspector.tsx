import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Save, Copy, Check, 
  Building2, Calendar, Users, FileText, CheckCircle2, Loader2,
  ZoomIn, ZoomOut, RotateCcw,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight,
  Sliders, Eye, Sparkles, Printer, Plus, Trash2, HelpCircle
} from 'lucide-react';

import { 
  DEFAULT_BONUS_FIELDS, 
  loadBonusDocCoordinates, 
  broadcastBonusDocCoordinates,
  fetchBonusDocCoordinatesFromDb,
  type BonusDocFieldConfig 
} from '../lib/bonusDocCoordinates';
import { 
  OfficialBonusPaymentReportDoc, 
  type BonusReportEmployee 
} from './OfficialBonusPaymentReportDoc';

export const BonusDocMasterInspector: React.FC = () => {
  // 🧭 モード切替: 'inspector' (精密座標インスペクター) | 'input_preview' (全社実動 直接入力 ＆ A4印刷画面)
  const [activeMode, setActiveMode] = useState<'inspector' | 'input_preview'>('inspector');

  // 📝 直接入力用State
  const [submissionDate, setSubmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [commonPaymentDate, setCommonPaymentDate] = useState(`${new Date().getFullYear()}-06-30`);
  const [officeCityCode, setOfficeCityCode] = useState('25');
  const [officeSymbolKana, setOfficeSymbolKana] = useState('カア');
  const [companyAddress, setCompanyAddress] = useState('滋賀県大津市浜大津1-2-3');
  const [companyName, setCompanyName] = useState('株式会社cocotte');
  const [companyOwnerName, setCompanyOwnerName] = useState('代表取締役 駒井 修一郎');
  const [companyPhone, setCompanyPhone] = useState('077-574-6907');
  const [sharoushiName, setSharoushiName] = useState('');
  const officeSymbol = `${officeCityCode}-${officeSymbolKana}`;

  // 従業員行データState
  const [employees, setEmployees] = useState<BonusReportEmployee[]>([
    {
      id: 'bonus-emp-1',
      insuranceNumber: '1',
      name: '駒井 修一郎',
      nameKana: 'コマイ シュウイチロウ',
      birthDate: '1988-04-15',
      currencyAmount: 650000,
      goodsAmount: 0,
      isOver70: false
    },
    {
      id: 'bonus-emp-2',
      insuranceNumber: '2',
      name: '山田 太郎',
      nameKana: 'ヤマダ タロウ',
      birthDate: '1979-03-18',
      currencyAmount: 480000,
      goodsAmount: 0,
      isOver70: false
    },
    {
      id: 'bonus-emp-3',
      insuranceNumber: '3',
      name: '佐藤 美咲',
      nameKana: 'サトウ ミサキ',
      birthDate: '1995-11-25',
      currencyAmount: 350000,
      goodsAmount: 0,
      isOver70: false
    }
  ]);

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

        // 🏢 テナント情報から動的会社情報をロード（他社テナントへの配慮・憲法3/4）
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase.from('users').select('tenant_id').eq('id', user.id).maybeSingle();
          if (userData?.tenant_id) {
            const { data: tData } = await supabase.from('tenants').select('*').eq('id', userData.tenant_id).maybeSingle();
            if (tData) {
              if (tData.name) setCompanyName(tData.name);
              if (tData.address) setCompanyAddress(tData.address);
              if (tData.representative_name) setCompanyOwnerName(tData.representative_name);
              if (tData.phone_number) setCompanyPhone(tData.phone_number);

              const sym = tData.shakai_hoken_settings?.office_symbol || '';
              if (sym && sym.includes('-')) {
                const parts = sym.split('-');
                if (parts[0]) setOfficeCityCode(parts[0]);
                if (parts[1]) setOfficeSymbolKana(parts[1]);
              }
            }
          }
        }
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

  // 項目値のアトミック複数更新（pitchとwidth等を一撃同時更新し、競合・再レンダリングズレを根絶）
  const updateFieldMulti = useCallback((id: string, updates: Partial<BonusDocFieldConfig>) => {
    setFields(prev => {
      const sanitized: Partial<BonusDocFieldConfig> = { ...updates };
      if (typeof sanitized.pitch === 'number') sanitized.pitch = Math.round(sanitized.pitch * 100) / 100;
      if (typeof sanitized.width === 'number') sanitized.width = Math.round(sanitized.width * 100) / 100;
      if (typeof sanitized.x === 'number') sanitized.x = Math.round(sanitized.x * 100) / 100;
      if (typeof sanitized.y === 'number') sanitized.y = Math.round(sanitized.y * 100) / 100;
      const updated = prev.map(f => f.id === id ? { ...f, ...sanitized } : f);
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

  // 全社マスター保存（憲法第18条：実永続化証明・サイレントフェイル完全禁止）
  const [saveStatus, setSaveStatus] = useState<'idle' | 'db_saved' | 'local_only'>('idle');

  const handleSaveMaster = async () => {
    setIsSaving(true);
    // ユーザー調整座標の不可侵保護（憲法第17条）
    broadcastBonusDocCoordinates(fields);

    try {
      const { data: current, error: fetchErr } = await supabase
        .from('system_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      let dbSuccess = false;
      if (!fetchErr && current && current.id) {
        const { error: updErr } = await supabase
          .from('system_settings')
          .update({ 
            bonus_doc_coordinates: fields, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', current.id);
        if (!updErr) dbSuccess = true;
      } else {
        const { error: insErr } = await supabase
          .from('system_settings')
          .insert([{ 
            bonus_doc_coordinates: fields, 
            updated_at: new Date().toISOString() 
          }]);
        if (!insErr) dbSuccess = true;
      }

      if (dbSuccess) {
        setSaveStatus('db_saved');
        setSavedSuccess(true);
      } else {
        setSaveStatus('local_only');
        setSavedSuccess(true);
      }
      setTimeout(() => {
        setSavedSuccess(false);
        setSaveStatus('idle');
      }, 3500);
    } catch (err) {
      console.warn('DB永続化エラー (ローカルに退避済):', err);
      setSaveStatus('local_only');
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setSaveStatus('idle');
      }, 3500);
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
      {/* 🧭 モード切替バー（原本マス目 精密座標インスペクター ⇄ 全社実動 直接入力 ＆ A4印刷画面） */}
      <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('inspector')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeMode === 'inspector'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            原本マス目 精密座標インスペクター
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('input_preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeMode === 'input_preview'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            全社実動 直接入力 ＆ A4印刷画面
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-pink-400 font-bold bg-pink-950/60 px-2.5 py-1 rounded-lg border border-pink-800/80 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-pink-400" />
            日本年金機構 被保険者賞与支払届（コード2265用紙）公式較正済
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. 原本マス目 精密座標インスペクター モード                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'inspector' && (
        <div className="space-y-4">
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
                className={`px-5 py-2 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  savedSuccess && saveStatus === 'local_only'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : savedSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {savedSuccess 
                  ? (saveStatus === 'db_saved' ? '✅ 全社DBへ完全永続化完了！' : '⚠️ 端末ローカルに保存（DB未接続）') 
                  : '賞与支払届マスタとして保存・適用'}
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

              {/* 📏 ピッチ（マス目・文字間隔）調整（雇用保険方式：0.01%精密スライダー ＆ 微調整ボタン） */}
              {(() => {
                const currentPitch = selectedField.pitch !== undefined ? selectedField.pitch : (
                  (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') ? 2.43 :
                  selectedField.section === 'common_payment' ? 2.70 :
                  selectedField.section === 'submission' ? 2.40 :
                  selectedField.id === 'empMyNumber' ? 1.88 :
                  selectedField.id === 'empInsuranceNumber' ? 2.50 : 2.40
                );
                const getStandardPitch = () => {
                  if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') return 2.43;
                  if (selectedField.section === 'common_payment') return 2.70;
                  if (selectedField.section === 'submission') return 2.40;
                  if (selectedField.id === 'empMyNumber') return 1.88;
                  if (selectedField.id === 'empInsuranceNumber') return 2.50;
                  return 2.40;
                };

                return (
                  <div className="bg-slate-800/90 p-3.5 rounded-xl border border-cyan-700/60 shadow-md space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-cyan-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        マス目ピッチ（1マスの幅）:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const std = getStandardPitch();
                            if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') {
                              updateFieldMulti(selectedField.id, { pitch: std, width: Math.round(std * 4 * 100) / 100 });
                            } else {
                              updateField(selectedField.id, 'pitch', std);
                            }
                          }}
                          className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-emerald-100 rounded text-[10px] font-black border border-emerald-500 shadow-xs cursor-pointer transition flex items-center gap-1"
                          title="原本用紙（コード2265）のマス目枠線に一発吸着"
                        >
                          <span>🌟</span>
                          <span>原本標準({getStandardPitch()}%)</span>
                        </button>
                        <span className="font-mono text-xs font-black text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-700">
                          {currentPitch.toFixed(2)}% ({(currentPitch * 2.1).toFixed(2)}mm)
                        </span>
                      </div>
                    </div>

                    {/* スライダー調整（0.01%刻み：1.00%〜5.00%） */}
                    <input
                      type="range"
                      min="1.00"
                      max="5.00"
                      step="0.01"
                      value={currentPitch}
                      onChange={e => {
                        const newPitch = parseFloat(e.target.value) || 2.43;
                        if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') {
                          updateFieldMulti(selectedField.id, { pitch: newPitch, width: Math.round(newPitch * 4 * 100) / 100 });
                        } else {
                          updateField(selectedField.id, 'pitch', newPitch);
                        }
                      }}
                      className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-900 rounded-lg"
                    />

                    {/* ワンクリック微調整ボタン群（雇用保険方式：-0.05, -0.01, 直接入力, +0.01, +0.05） */}
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(0.5, Math.round((currentPitch - 0.05) * 100) / 100);
                          if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') {
                            updateFieldMulti(selectedField.id, { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                          } else {
                            updateField(selectedField.id, 'pitch', next);
                          }
                        }}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                        title="0.05% 狭くする"
                      >
                        -0.05
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.max(0.5, Math.round((currentPitch - 0.01) * 100) / 100);
                          if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') {
                            updateFieldMulti(selectedField.id, { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                          } else {
                            updateField(selectedField.id, 'pitch', next);
                          }
                        }}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                        title="0.01% 狭くする"
                      >
                        -0.01
                      </button>

                      {/* 数値直接入力 */}
                      <input
                        type="number"
                        step="0.01"
                        min="0.5"
                        max="10.0"
                        value={currentPitch}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 2.43;
                          if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') {
                            updateFieldMulti(selectedField.id, { pitch: val, width: Math.round(val * 4 * 100) / 100 });
                          } else {
                            updateField(selectedField.id, 'pitch', val);
                          }
                        }}
                        className="w-16 bg-slate-900 border border-cyan-700/60 rounded-lg px-1 py-1 text-center text-xs font-mono font-bold text-cyan-300 focus:outline-hidden focus:ring-1 focus:ring-cyan-400"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(6.0, Math.round((currentPitch + 0.01) * 100) / 100);
                          if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') {
                            updateFieldMulti(selectedField.id, { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                          } else {
                            updateField(selectedField.id, 'pitch', next);
                          }
                        }}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                        title="0.01% 広くする"
                      >
                        +0.01
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(6.0, Math.round((currentPitch + 0.05) * 100) / 100);
                          if (selectedField.id === 'symbolDigits' || selectedField.id === 'symbolKana') {
                            updateFieldMulti(selectedField.id, { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                          } else {
                            updateField(selectedField.id, 'pitch', next);
                          }
                        }}
                        className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:scale-95 text-slate-200 border border-slate-600 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                        title="0.05% 広くする"
                      >
                        +0.05
                      </button>
                    </div>
                  </div>
                );
              })()}

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

                  // 整理記号マス目の特殊表示（原本左側4マス構造）
                  if (f.id === 'symbolDigits') {
                    const digitPitch = f.pitch || 2.43;
                    const containerWidth = f.width || (digitPitch * 4);
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
                          width: `${containerWidth}%`,
                          display: 'flex',
                          alignItems: 'center',
                          cursor: isDraggingThis ? 'grabbing' : 'grab',
                          pointerEvents: 'auto',
                          userSelect: 'none'
                        }}
                        className={`transition-all ${isSelected ? 'ring-2 ring-pink-500 bg-pink-500/20 z-30' : 'hover:ring-1 hover:ring-pink-400 bg-white/40 z-10'}`}
                      >
                        {/* 原本4マスのマス目セル（各セルの幅は digitPitch% / containerWidth% ＝ ちょうど 1/4） */}
                        {['2', '5', '', ''].map((c, i) => (
                          <div
                            key={i}
                            className={`h-full flex items-center justify-center font-mono font-black text-slate-950 shrink-0 ${
                              i < 3 ? 'border-r border-dashed border-pink-400/40' : ''
                            }`}
                            style={{
                              width: `${(digitPitch / containerWidth) * 100}%`,
                              fontSize: `${(f.fontSize || 14) * 0.115}cqi`
                            }}
                          >
                            {c ? (
                              <span>{c}</span>
                            ) : (
                              <span className="text-[9px] text-pink-300/60 select-none">・</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (f.id === 'symbolKana') {
                    const kanaPitch = f.pitch || 2.43;
                    const containerWidth = f.width || (kanaPitch * 4);
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
                          width: `${containerWidth}%`,
                          display: 'flex',
                          alignItems: 'center',
                          cursor: isDraggingThis ? 'grabbing' : 'grab',
                          pointerEvents: 'auto',
                          userSelect: 'none'
                        }}
                        className={`transition-all ${isSelected ? 'ring-2 ring-pink-500 bg-pink-500/20 z-30' : 'hover:ring-1 hover:ring-pink-400 bg-white/40 z-10'}`}
                      >
                        {/* 原本4マスのマス目セル（各セルの幅は kanaPitch% / containerWidth% ＝ ちょうど 1/4） */}
                        {['カ', 'ア', '', ''].slice(0, 4).map((c, i) => (
                          <div
                            key={i}
                            className={`h-full flex items-center justify-center font-sans font-black text-slate-950 shrink-0 ${
                              i < 3 ? 'border-r border-dashed border-pink-400/40' : ''
                            }`}
                            style={{
                              width: `${(kanaPitch / containerWidth) * 100}%`,
                              fontSize: `${(f.fontSize || 13) * 0.115}cqi`
                            }}
                          >
                            {c ? (
                              <span>{c}</span>
                            ) : (
                              <span className="text-[9px] text-pink-300/60 select-none">・</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  const isDatePart = f.section === 'submission' || f.section === 'common_payment';
                  const pitchVal = f.pitch !== undefined ? f.pitch : (
                    isDatePart ? (f.section === 'common_payment' ? 2.70 : 2.40) : 0
                  );
                  // 2マス日付枠で1文字の場合は右マスに寄せるため先頭に空白
                  const displayStr = isDatePart && String(f.example).length === 1 ? ` ${f.example}` : String(f.example);
                  const textChars = displayStr.split('');

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
                        width: pitchVal > 0 ? 'max-content' : (f.width ? `${f.width}%` : 'auto'),
                        fontSize: `${f.fontSize * 0.115}cqi`,
                        fontWeight: 'bold',
                        cursor: isDraggingThis ? 'grabbing' : 'grab',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'auto',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      className={`px-0.5 py-0.2 rounded transition-all ${
                        isSelected
                          ? 'ring-2 ring-pink-500 bg-pink-500/20 text-pink-700 shadow-2xl z-30 font-black'
                          : 'hover:ring-1 hover:ring-pink-400 hover:bg-pink-100/60 z-10 bg-white/60 text-slate-950'
                      }`}
                      title={`${f.name} (クリックして選択・十字キーまたはドラッグで移動)`}
                    >
                      {pitchVal > 0 ? (
                        <div className="flex items-center pointer-events-none">
                          {textChars.map((char, cIdx) => (
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
                        <span>{f.example}</span>
                      )}
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
                        if (rf.id === 'empInsuranceNumber') {
                          // 公的実務：整理番号は前ゼロ不要、4マス枠の右詰めで配置（例: 1番なら '   1'）
                          const num = rowIdx === 0 ? '1' : '2';
                          textVal = num.padStart(4, ' ');
                        }
                        if (rf.id === 'empIndivPayDate') {
                          // 原本「共通と同じ場合は記入不要」に従い行0は空欄。行1または選択時のみ年・月・日の数字を表示（「令」は原本印刷済のため印字不要）
                          textVal = (isSelected || rowIdx === 1) ? ' 8   12   20' : '';
                        }

                        const rfPitch = rf.pitch !== undefined ? rf.pitch : 0;
                        const isRight = rf.id === 'empCurrencyAmount' || rf.id === 'empGoodsAmount' || rf.id === 'empTotalThousands';
                        const isCenter = rf.id === 'empBirth';
                        const textChars = String(textVal).split('');

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
                              width: rfPitch > 0 ? 'max-content' : (rf.width ? `${rf.width}%` : 'auto'),
                              fontSize: `${rf.fontSize * 0.11}cqi`,
                              fontWeight: rf.id === 'empName' ? 900 : 700,
                              cursor: rowIdx === 0 ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: isRight ? 'flex-end' : isCenter ? 'center' : 'flex-start',
                              pointerEvents: 'auto',
                              lineHeight: 1,
                              opacity: rowIdx === 1 ? 0.6 : 1
                            }}
                            className={`px-0.5 py-0.2 rounded transition-all ${
                              isSelected
                                ? 'ring-2 ring-pink-500 bg-pink-500/20 text-pink-800 shadow-2xl z-30 font-black'
                                : 'hover:ring-1 hover:ring-pink-400 hover:bg-pink-100/60 z-10 bg-white/50 text-slate-900'
                            }`}
                            title={`${rf.name} (クリックして選択・十字キーで移動)`}
                          >
                            {rfPitch > 0 ? (
                              <div className="flex items-center pointer-events-none">
                                {textChars.map((char, cIdx) => (
                                  <span
                                    key={cIdx}
                                    style={{
                                      display: 'inline-block',
                                      width: `${rfPitch}cqi`,
                                      fontSize: `${rf.fontSize * 0.11}cqi`,
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
                              <span>{textVal}</span>
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
    </div>
  )}

  {/* ══════════════════════════════════════════════════════════════════════ */}
  {/* 2. 全社実動 直接入力 ＆ A4印刷画面 モード                             */}
  {/* ══════════════════════════════════════════════════════════════════════ */}
  {activeMode === 'input_preview' && (
    <div className="space-y-4">
      {/* 🧭 操作バー（印刷時は非表示） */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl text-white shadow-md">
            <Eye className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              全社実動 直接入力 ＆ A4実寸印刷プレビュー
              <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-md font-mono">
                様式コード2265原本直結
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              左側で実動データを直接打ち込むと、右側の原本PDF（コード2265用紙）マス目にリアルタイム反映されます。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-amber-500/10 text-amber-300 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>印刷時のコツ: 余白『なし』・倍率『100%（実際のサイズ）』</span>
          </span>

          <button
            type="button"
            onClick={() => {
              setOfficeCityCode('25');
              setOfficeSymbolKana('カア');
              setCompanyName('株式会社cocotte');
              setCompanyAddress('滋賀県大津市浜大津1-2-3');
              setCompanyOwnerName('代表取締役 駒井 修一郎');
              setCompanyPhone('077-574-6907');
              setSharoushiName('');
              setEmployees([
                {
                  id: 'bonus-emp-1',
                  insuranceNumber: '1',
                  name: '駒井 修一郎',
                  nameKana: 'コマイ シュウイチロウ',
                  birthDate: '1988-04-15',
                  currencyAmount: 650000,
                  goodsAmount: 0,
                  isOver70: false
                },
                {
                  id: 'bonus-emp-2',
                  insuranceNumber: '2',
                  name: '山田 太郎',
                  nameKana: 'ヤマダ タロウ',
                  birthDate: '1979-03-18',
                  currencyAmount: 480000,
                  goodsAmount: 0,
                  isOver70: false
                },
                {
                  id: 'bonus-emp-3',
                  insuranceNumber: '3',
                  name: '佐藤 美咲',
                  nameKana: 'サトウ ミサキ',
                  birthDate: '1995-11-25',
                  currencyAmount: 350000,
                  goodsAmount: 0,
                  isOver70: false
                }
              ]);
            }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            サンプルデータ再充填
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-blue-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            🖨️ A4実寸印刷（原本重ね合わせ）
          </button>
        </div>
      </div>

      {/* 左右2分割メインエリア */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* ⬅️ 左カラム：直接入力コントロール（印刷時は非表示） */}
        <div className="col-span-12 lg:col-span-4 space-y-4 print:hidden">
          
          {/* ① 事業所情報 ＆ 整理記号マス目 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-pink-600" />
              <span className="text-xs font-black text-slate-800">事業所情報 ＆ 整理記号マス目入力</span>
            </div>

            {/* 事業所整理記号（マス目ピッチ連動 ＆ その場で微調整可能） */}
            <div className="bg-gradient-to-br from-pink-50/90 to-rose-50/60 p-3 rounded-xl border border-pink-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-pink-900 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-pink-600" />
                  <span>事業所整理記号（原本マス目）</span>
                </span>
                <span className="text-[10px] text-pink-800 font-mono font-bold bg-pink-200/80 px-2 py-0.5 rounded border border-pink-300">
                  ピッチ: {((fields.find(f => f.id === 'symbolDigits')?.pitch) || 2.43).toFixed(2)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">左側数字2マス</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={officeCityCode}
                    onChange={e => setOfficeCityCode(e.target.value)}
                    placeholder="25"
                    className="w-full bg-white border border-pink-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-black text-slate-900 focus:ring-2 focus:ring-pink-500 focus:outline-hidden text-center shadow-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-0.5">右側カナ4マス</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={officeSymbolKana}
                    onChange={e => setOfficeSymbolKana(e.target.value)}
                    placeholder="カア"
                    className="w-full bg-white border border-pink-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-900 focus:ring-2 focus:ring-pink-500 focus:outline-hidden text-center shadow-xs"
                  />
                </div>
              </div>

              {/* 🎯 この場でA4プレビューを見ながらピッチ微調整できるコントロール */}
              <div className="bg-white/80 p-2.5 rounded-lg border border-pink-200/80 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                    <span>📏</span>
                    <span>マス目ピッチ（文字間隔）微調整</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const standardPitch = 2.43;
                      updateFieldMulti('symbolDigits', { pitch: standardPitch, width: Math.round(standardPitch * 4 * 100) / 100 });
                      updateFieldMulti('symbolKana', { pitch: standardPitch, width: Math.round(standardPitch * 4 * 100) / 100 });
                    }}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer transition flex items-center gap-0.5"
                    title="原本マス目の標準幅（2.43%）に一発で合わせます"
                  >
                    <span>🌟</span>
                    <span>原本標準(2.43%)</span>
                  </button>
                </div>

                {/* スライダー */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-slate-400 font-mono">1.0%</span>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.02"
                    value={fields.find(f => f.id === 'symbolDigits')?.pitch || 2.43}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 2.43;
                      updateFieldMulti('symbolDigits', { pitch: val, width: Math.round(val * 4 * 100) / 100 });
                      updateFieldMulti('symbolKana', { pitch: val, width: Math.round(val * 4 * 100) / 100 });
                    }}
                    className="w-full accent-pink-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                  <span className="text-[9px] text-slate-400 font-mono">5.0%</span>
                </div>

                {/* 微調整ボタン群 */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = fields.find(f => f.id === 'symbolDigits')?.pitch || 2.43;
                        const next = Math.max(0.5, Math.round((cur - 0.5) * 100) / 100);
                        updateFieldMulti('symbolDigits', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                        updateFieldMulti('symbolKana', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                      }}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded text-[10px] font-bold border border-slate-300 cursor-pointer"
                      title="ピッチを大きく縮小 (-0.5%)"
                    >
                      -0.5
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = fields.find(f => f.id === 'symbolDigits')?.pitch || 2.43;
                        const next = Math.max(0.5, Math.round((cur - 0.1) * 100) / 100);
                        updateFieldMulti('symbolDigits', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                        updateFieldMulti('symbolKana', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                      }}
                      className="px-2 py-0.5 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                      title="ピッチを標準縮小 (-0.1%)"
                    >
                      -0.1
                    </button>
                  </div>

                  <span className="text-xs font-mono font-black text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                    {((fields.find(f => f.id === 'symbolDigits')?.pitch) || 2.43).toFixed(2)}%
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = fields.find(f => f.id === 'symbolDigits')?.pitch || 2.43;
                        const next = Math.min(10.0, Math.round((cur + 0.1) * 100) / 100);
                        updateFieldMulti('symbolDigits', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                        updateFieldMulti('symbolKana', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                      }}
                      className="px-2 py-0.5 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                      title="ピッチを標準拡大 (+0.1%)"
                    >
                      +0.1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = fields.find(f => f.id === 'symbolDigits')?.pitch || 2.43;
                        const next = Math.min(10.0, Math.round((cur + 0.5) * 100) / 100);
                        updateFieldMulti('symbolDigits', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                        updateFieldMulti('symbolKana', { pitch: next, width: Math.round(next * 4 * 100) / 100 });
                      }}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded text-[10px] font-bold border border-slate-300 cursor-pointer"
                      title="ピッチを大きく拡大 (+0.5%)"
                    >
                      +0.5
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-pink-700 leading-tight">
                💡 右側のA4用紙プレビューを見ながら、ボタンを押すとその場で文字間隔がマス目に吸い付きます。
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-0.5">提出年月日</label>
                <input
                  type="date"
                  value={submissionDate}
                  onChange={e => setSubmissionDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-0.5">共通賞与支払日</label>
                <input
                  type="date"
                  value={commonPaymentDate}
                  onChange={e => setCommonPaymentDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-0.5">事業所所在地</label>
              <input
                type="text"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                placeholder="滋賀県大津市浜大津1-2-3"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-0.5">事業所名称</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="株式会社cocotte"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-0.5">事業主氏名</label>
                <input
                  type="text"
                  value={companyOwnerName}
                  onChange={e => setCompanyOwnerName(e.target.value)}
                  placeholder="代表取締役 駒井 修一郎"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-0.5">電話番号</label>
              <input
                type="text"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                placeholder="077-574-6907"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-0.5">社会保険労務士記載欄（任意）</label>
              <input
                type="text"
                value={sharoushiName}
                onChange={e => setSharoushiName(e.target.value)}
                placeholder="社会保険労務士 氏名"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* ② 被保険者行 入力 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black text-slate-800">被保険者賞与データ（{employees.length}名）</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newId = `emp-${Date.now()}`;
                  const nextNum = String(employees.length + 1);
                  setEmployees(prev => [
                    ...prev,
                    {
                      id: newId,
                      insuranceNumber: nextNum,
                      name: '新規 従業員',
                      nameKana: 'シンキ ジュウギョウイン',
                      birthDate: '1990-01-01',
                      currencyAmount: 300000,
                      goodsAmount: 0,
                      isOver70: false
                    }
                  ]);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                行追加
              </button>
            </div>

            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {employees.map((emp, idx) => (
                <div key={emp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span>{emp.name || '名称未設定'}</span>
                    </span>
                    {employees.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEmployees(prev => prev.filter(e => e.id !== emp.id))}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                        title="この行を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">整理番号</label>
                      <input
                        type="text"
                        value={emp.insuranceNumber || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, insuranceNumber: val } : item));
                        }}
                        placeholder="1"
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">氏名</label>
                      <input
                        type="text"
                        value={emp.name}
                        onChange={e => {
                          const val = e.target.value;
                          setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, name: val } : item));
                        }}
                        placeholder="氏名"
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">生年月日</label>
                      <input
                        type="date"
                        value={emp.birthDate || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, birthDate: val } : item));
                        }}
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">賞与額 (通貨・円)</label>
                      <input
                        type="number"
                        step={1000}
                        value={emp.currencyAmount || ''}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setEmployees(prev => prev.map(item => item.id === emp.id ? { ...item, currencyAmount: val } : item));
                        }}
                        placeholder="500000"
                        className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 text-right"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ➡️ 右カラム：A4実寸印刷プレビュー */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-slate-200/80 p-4 sm:p-6 rounded-3xl border border-slate-300 shadow-inner overflow-x-auto">
            <OfficialBonusPaymentReportDoc
              data={{
                submissionDate,
                officeSymbol,
                officeCityCode,
                officeSymbolKana,
                companyAddress,
                companyName,
                companyOwnerName,
                companyPhone,
                sharoushiName,
                commonPaymentDate,
                employees
              }}
              customCoords={fields}
              canEditCoordinates={false}
            />
          </div>
        </div>

      </div>
    </div>
  )}
</div>
);
};
