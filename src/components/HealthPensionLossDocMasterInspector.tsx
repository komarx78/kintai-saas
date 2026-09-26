// ══════════════════════════════════════════════════════════════════════════
// 🏛️ 健康保険・厚生年金保険 被保険者資格喪失届（日本年金機構 様式コード2201）
//    公式原本PDF印字座標マスタ設定・精密インスペクター
// ══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Save, RotateCcw, CheckCircle2, 
  ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Sliders, Eye, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  DEFAULT_HEALTH_PENSION_LOSS_FIELDS,
  loadHealthPensionLossCoordinates,
  saveHealthPensionLossCoordinates,
  saveHealthPensionLossCoordinatesToDb,
  fetchHealthPensionLossCoordinatesFromDb,
  broadcastHealthPensionLossCoordinates,
  type HealthPensionLossFieldConfig
} from '../lib/healthPensionLossDocCoordinates';
import { OfficialHealthPensionLossDoc, type HealthPensionLossEmployee } from './OfficialHealthPensionLossDoc';

export const HealthPensionLossDocMasterInspector: React.FC<{ tenantId?: string }> = ({ tenantId }) => {
  // テナントIDの自動解決（Props優先、URLクエリパラメータフォールバック）
  const resolvedTenantId = tenantId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant_id') || undefined : undefined);

  const [activeTab, setActiveTab] = useState<'inspector' | 'input_preview'>('inspector');

  // 🏢 テナント動的会社情報State（他社テナントへの配慮・憲法3/4）
  const [companyInfo, setCompanyInfo] = useState({
    postal_code: '5200001',
    address: '',
    company_name: '',
    representative_name: ''
  });
  const [officeSymbol, setOfficeSymbol] = useState('26カカ1234');
  const [officeNumber, setOfficeNumber] = useState('12345');

  // インスペクター用State
  const [fields, setFields] = useState<HealthPensionLossFieldConfig[]>(() => loadHealthPensionLossCoordinates(resolvedTenantId));
  const [selectedSection, setSelectedSection] = useState<'header' | 'office' | 'insured_person_1'>('insured_person_1');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('myNumberOrPension_1');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // マウント時にDBから全社共有座標およびテナント会社情報を取得
  useEffect(() => {
    let isCancelled = false;
    fetchHealthPensionLossCoordinatesFromDb(resolvedTenantId).then(dbCoords => {
      if (!isCancelled && dbCoords && dbCoords.length > 0) {
        setFields(dbCoords);
      }
    });

    const fetchCompanyData = async () => {
      try {
        let targetTenantId = resolvedTenantId;
        if (!targetTenantId) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: userData } = await supabase.from('users').select('tenant_id').eq('id', user.id).maybeSingle();
            targetTenantId = userData?.tenant_id;
          }
        }
        if (targetTenantId) {
          const { data: tData } = await supabase.from('tenants').select('*').eq('id', targetTenantId).maybeSingle();
          if (tData && !isCancelled) {
            setCompanyInfo({
              postal_code: tData.postal_code || '5200001',
              address: tData.address || '',
              company_name: tData.name || '',
              representative_name: tData.representative_name || ''
            });
            if (tData.shakai_hoken_settings?.office_symbol) {
              setOfficeSymbol(tData.shakai_hoken_settings.office_symbol);
            }
            if (tData.shakai_hoken_settings?.office_number) {
              setOfficeNumber(tData.shakai_hoken_settings.office_number);
            }
          }
        }
      } catch (err) {
        console.warn('HealthPensionLoss company fetch error:', err);
      }
    };
    fetchCompanyData();

    return () => { isCancelled = true; };
  }, [resolvedTenantId]);

  // 原本背景画像
  const [bgPdfImg, setBgPdfImg] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);

  // ドラッグ移動用State
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

        const cMapUrl = window.location.origin ? (window.location.origin + '/cmaps/') : '/cmaps/';
        const standardFontDataUrl = window.location.origin ? (window.location.origin + '/standard_fonts/') : '/standard_fonts/';

        const loadingTask = pdfjsLib.getDocument({
          url: '/health_pension_loss_template.pdf',
          cMapUrl: cMapUrl,
          cMapPacked: true,
          standardFontDataUrl: standardFontDataUrl,
          enableXfa: true
        });
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
  const updateField = useCallback((id: string, key: keyof HealthPensionLossFieldConfig, value: any) => {
    setFields(prev => {
      let finalVal = value;
      if (typeof value === 'number') {
        const precision = key === 'pitch' ? 100 : (key === 'x' || key === 'y') ? 100 : 1;
        finalVal = Math.round(value * precision) / precision;
      }
      const updated = prev.map(f => f.id === id ? { ...f, [key]: finalVal } : f);
      saveHealthPensionLossCoordinates(updated, resolvedTenantId);
      broadcastHealthPensionLossCoordinates(updated, resolvedTenantId);
      return updated;
    });
  }, [resolvedTenantId]);

  // 微調整ハンドラー（矢印ボタン用）
  const nudge = useCallback((axis: 'x' | 'y', delta: number) => {
    if (!selectedFieldId) return;
    setFields(prev => {
      const updated = prev.map(f => {
        if (f.id === selectedFieldId) {
          const current = f[axis];
          const next = Math.round((current + delta) * 100) / 100;
          return { ...f, [axis]: next };
        }
        return f;
      });
      saveHealthPensionLossCoordinates(updated, resolvedTenantId);
      broadcastHealthPensionLossCoordinates(updated, resolvedTenantId);
      return updated;
    });
  }, [selectedFieldId, resolvedTenantId]);

  // キーボード矢印キーでの微調整
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedFieldId) return;
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;

      const step = e.shiftKey ? 0.5 : 0.05;
      if (e.key === 'ArrowUp') { e.preventDefault(); nudge('y', -step); }
      if (e.key === 'ArrowDown') { e.preventDefault(); nudge('y', step); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge('x', -step); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge('x', step); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId, nudge]);

  // マウスドラッグ開始
  const handleMouseDownOnField = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    const target = fields.find(f => f.id === fieldId);
    if (target) setSelectedSection(target.section);

    setDraggingFieldId(fieldId);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: target ? target.x : 0,
      startY: target ? target.y : 0
    };
  };

  // ドラッグ中・ドラッグ終了
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingFieldId || !dragStartRef.current || !previewContainerRef.current) return;

      const rect = previewContainerRef.current.getBoundingClientRect();
      const currentScale = previewZoom / 100;
      const unscaledWidth = rect.width / currentScale;
      const unscaledHeight = rect.height / currentScale;

      const deltaX = (e.clientX - dragStartRef.current.mouseX) / currentScale;
      const deltaY = (e.clientY - dragStartRef.current.mouseY) / currentScale;

      const deltaXPercent = (deltaX / unscaledWidth) * 100;
      const deltaYPercent = (deltaY / unscaledHeight) * 100;

      const nextX = Math.round((dragStartRef.current.startX + deltaXPercent) * 100) / 100;
      const nextY = Math.round((dragStartRef.current.startY + deltaYPercent) * 100) / 100;

      setFields(prev => {
        const updated = prev.map(f => f.id === draggingFieldId ? { ...f, x: nextX, y: nextY } : f);
        saveHealthPensionLossCoordinates(updated, resolvedTenantId);
        broadcastHealthPensionLossCoordinates(updated, resolvedTenantId);
        return updated;
      });
    };

    const handleMouseUp = () => {
      setDraggingFieldId(null);
      dragStartRef.current = null;
    };

    if (draggingFieldId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingFieldId, previewZoom, resolvedTenantId]);

  // DB保存
  const handleSaveToDb = async () => {
    setIsSaving(true);
    setSavedSuccess(false);
    const success = await saveHealthPensionLossCoordinatesToDb(fields, resolvedTenantId);
    setIsSaving(false);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  // 初期値にリセット
  const handleResetToDefault = () => {
    if (window.confirm('健康保険・厚生年金保険 被保険者資格喪失届の座標設定をすべて公式初期値にリセットしますか？')) {
      setFields(DEFAULT_HEALTH_PENSION_LOSS_FIELDS);
      saveHealthPensionLossCoordinates(DEFAULT_HEALTH_PENSION_LOSS_FIELDS, resolvedTenantId);
      broadcastHealthPensionLossCoordinates(DEFAULT_HEALTH_PENSION_LOSS_FIELDS, resolvedTenantId);
      saveHealthPensionLossCoordinatesToDb(DEFAULT_HEALTH_PENSION_LOSS_FIELDS, resolvedTenantId);
    }
  };

  // プレビュー用ダミー従業員
  const sampleEmployees: HealthPensionLossEmployee[] = [
    {
      id: 'sample-1',
      name: '駒井 秀一朗',
      name_kana: 'コマイ シュウイチロウ',
      birth_date: '1979-03-18',
      gender: 'male',
      my_number: '123456789012',
      pension_number: '1234567890',
      join_date: '2023-01-02',
      retirement_date: '2026-03-31',
      zip_code: '520-0001',
      address: '滋賀県大津市坂本3丁目21-16'
    }
  ];

  return (
    <div className="space-y-4 font-sans">
      {/* 🧭 コントロールバー */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              日本年金機構 様式コード2201
            </span>
            <span className="text-xs text-slate-400 font-bold">A4縦・実寸ピクセルインスペクター</span>
          </div>
          <h2 className="text-lg font-black text-slate-800 mt-1">
            健康保険・厚生年金保険 被保険者資格喪失届 印字座標マスタ設定
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* タブ切り替え */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'inspector' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              座標微調整（ドラッグ移動）
            </button>
            <button
              onClick={() => setActiveTab('input_preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'input_preview' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              完成形プレビュー
            </button>
          </div>

          {activeTab === 'inspector' && (
            <>
              {/* 初期値リセット */}
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                title="すべての座標を公式初期値に戻す"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                リセット
              </button>

              {/* DB一括保存 */}
              <button
                onClick={handleSaveToDb}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer ${
                  savedSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    クラウド保存完了！
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isSaving ? '保存中...' : 'クラウド全社保存'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'input_preview' ? (
        <OfficialHealthPensionLossDoc
          tenantId={resolvedTenantId}
          customCoords={fields}
          companyInfo={companyInfo}
          officeSymbol={officeSymbol}
          officeNumber={officeNumber}
          employees={sampleEmployees}
          selectedEmployeeId="sample-1"
        />
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-4">
          
          {/* 左側：リアルタイム原本プレビューコンテナ */}
          <div className="flex-1 w-full overflow-x-auto flex flex-col items-center bg-slate-200/80 p-3 sm:p-5 rounded-2xl border border-slate-300">
            {/* ズームバー */}
            <div className="flex items-center gap-2 mb-3 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs text-xs font-bold">
              <span className="text-slate-500">プレビュー倍率:</span>
              <button
                type="button"
                onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
              </button>
              <span className="w-12 text-center font-mono font-black">{previewZoom}%</span>
              <button
                type="button"
                onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom(100)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[11px]"
              >
                100%
              </button>
            </div>

            {/* A4縦 実寸枠 */}
            <div 
              style={{ 
                width: `${210 * (previewZoom / 100)}mm`, 
                height: `${297 * (previewZoom / 100)}mm` 
              }} 
              className="relative transition-[width,height] duration-150 ease-out"
            >
              <div
                ref={previewContainerRef}
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top left',
                  width: '210mm',
                  height: '297mm'
                }}
                className="bg-white relative shadow-2xl border border-slate-400 overflow-hidden select-none"
              >
                {/* 原本背景画像 */}
                {bgPdfImg ? (
                  <img
                    src={bgPdfImg}
                    alt="資格喪失届原本"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-85"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                    {isLoadingPdf ? '原本PDF読み込み中...' : '原本背景なし'}
                  </div>
                )}

                {/* 座標要素描画 */}
                {fields.filter(f => !f.disabled).map(field => {
                  const isSelected = selectedFieldId === field.id;
                  const isDragging = draggingFieldId === field.id;

                  // ⭕ 丸囲み項目プレビュー
                  if (field.isCircle) {
                    const sampleActiveMap: Record<string, string> = {
                      birthEra_1: '5',       // 昭和
                      lossReason_1: '4',     // 退職等
                      remarks_1: ''
                    };

                    const isDefaultActive = field.circleValueKey && field.circleActiveValue
                      ? sampleActiveMap[field.circleValueKey] === field.circleActiveValue
                      : false;

                    const circleW = field.circleWidth || 26;
                    const circleH = field.circleHeight || 16;
                    const isGuideCircle = !isSelected && !isDefaultActive;

                    return (
                      <div
                        key={field.id}
                        onMouseDown={(e) => handleMouseDownOnField(e, field.id)}
                        style={{
                          position: 'absolute',
                          left: `${field.x}%`,
                          top: `${field.y}%`,
                          width: `${circleW}px`,
                          height: `${circleH}px`,
                          transform: 'translate(-50%, -50%)',
                          borderRadius: '9999px',
                          border: isSelected
                            ? '2.5px solid #e11d48'
                            : isGuideCircle
                              ? '1.2px dashed #94a3b8'
                              : '2px solid #0f172a',
                          backgroundColor: isSelected
                            ? 'rgba(244, 63, 94, 0.25)'
                            : isGuideCircle
                              ? 'rgba(241, 245, 249, 0.4)'
                              : 'transparent',
                          cursor: 'move',
                          zIndex: isSelected ? 50 : 20
                        }}
                        title={`${field.name} (ドラッグで移動)`}
                      />
                    );
                  }

                  // プレビュー表示値
                  let displayVal = field.example || field.name;
                  if (field.id === 'officeZipCode_first') {
                    displayVal = String(displayVal || '520').replace(/[^0-9]/g, '').slice(0, 3) || '520';
                  } else if (field.id === 'officeZipCode_last') {
                    displayVal = String(displayVal || '0000').replace(/[^0-9]/g, '').slice(0, 4) || '0000';
                  }

                  // 通常テキスト項目描画
                  return (
                    <div
                      key={field.id}
                      onMouseDown={(e) => handleMouseDownOnField(e, field.id)}
                      style={{
                        position: 'absolute',
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        fontSize: `${field.fontSize || 10}px`,
                        fontWeight: 'bold',
                        color: isSelected ? '#be123c' : '#0f172a',
                        backgroundColor: isSelected ? 'rgba(254, 205, 211, 0.7)' : 'transparent',
                        outline: isSelected ? '1.5px solid #e11d48' : isDragging ? '1px dashed #94a3b8' : 'none',
                        cursor: 'move',
                        padding: '1px 2px',
                        width: field.pitch && field.pitch > 0 ? 'max-content' : (field.width ? `${field.width * 2.1}mm` : 'auto'),
                        whiteSpace: 'nowrap',
                        zIndex: isSelected ? 40 : 10,
                        lineHeight: 1.1
                      }}
                      title={`${field.name} (${field.x}%, ${field.y}%) (ドラッグで移動)`}
                    >
                      {field.pitch && field.pitch > 0 && displayVal ? (
                        <div className="flex items-center pointer-events-none">
                          {displayVal.split('').map((char, charIdx) => (
                            <span
                              key={charIdx}
                              style={{
                                display: 'inline-block',
                                width: `${(field.pitch || 2.5) * 2.1}mm`,
                                textAlign: 'center',
                                fontSize: `${field.fontSize || 10}px`,
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
                        <span>{displayVal}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右側：座標調整コントロールパネル */}
          <div className="w-full lg:w-96 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 shrink-0 text-xs">
            <div>
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-rose-600" />
                項目選択 ＆ 座標微調整
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                画面上の要素を直接ドラッグ、または下で数値指定
              </p>
            </div>

            {/* セクション切替タブ */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold text-center">
              <button
                type="button"
                onClick={() => setSelectedSection('insured_person_1')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  selectedSection === 'insured_person_1' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                被保険者情報
              </button>
              <button
                type="button"
                onClick={() => setSelectedSection('office')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  selectedSection === 'office' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                事業所情報
              </button>
              <button
                type="button"
                onClick={() => setSelectedSection('header')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  selectedSection === 'header' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                提出日他
              </button>
            </div>

            {/* 項目選択ドロップダウン */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-500">調整対象項目</label>
                <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                  全{sectionFields.length}項目
                </span>
              </div>
              <select
                value={selectedFieldId}
                onChange={(e) => {
                  setSelectedFieldId(e.target.value);
                  const target = fields.find(f => f.id === e.target.value);
                  if (target) setSelectedSection(target.section);
                }}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                {sectionFields.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* 選択項目の座標コントローラー */}
            {selectedField && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-black text-slate-800 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {selectedField.isCircle && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-rose-100 text-rose-800 border border-rose-300">
                        〇囲み
                      </span>
                    )}
                    <span>{selectedField.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">ID: {selectedField.id}</span>
                </div>

                {/* 矢印キー微調整パッド */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block text-center">
                    矢印微調整（キーボード矢印キーでも可 / Shiftで大移動）
                  </label>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => nudge('y', -0.1)}
                      className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs text-slate-700 cursor-pointer"
                      title="上へ"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => nudge('x', -0.1)}
                        className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs text-slate-700 cursor-pointer"
                        title="左へ"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">MOVE</span>
                      <button
                        type="button"
                        onClick={() => nudge('x', 0.1)}
                        className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs text-slate-700 cursor-pointer"
                        title="右へ"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => nudge('y', 0.1)}
                      className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg shadow-2xs text-slate-700 cursor-pointer"
                      title="下へ"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 座標数値入力 */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">X座標（%）</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedField.x}
                      onChange={(e) => updateField(selectedField.id, 'x', parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Y座標（%）</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedField.y}
                      onChange={(e) => updateField(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 🎯 〇サイズ微調整（丸囲み項目専用：横幅・縦幅スライダー ＆ 微調整ボタン） */}
                {selectedField.isCircle ? (() => {
                  const defaultField = DEFAULT_HEALTH_PENSION_LOSS_FIELDS.find(f => f.id === selectedField.id);
                  const defW = defaultField?.circleWidth || 24;
                  const defH = defaultField?.circleHeight || 16;
                  const curW = selectedField.circleWidth || defW;
                  const curH = selectedField.circleHeight || defH;

                  return (
                    <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-300 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-1 border-b border-amber-200/80 pb-2">
                        <label className="text-[11px] font-black text-amber-950 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300"></span>
                          〇の大きさ調整（実寸px）:
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              updateField(selectedField.id, 'circleWidth', defW);
                              updateField(selectedField.id, 'circleHeight', defH);
                            }}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer transition flex items-center gap-0.5"
                            title={`原本標準サイズ（${defW}×${defH}px）に一発で戻します`}
                          >
                            <span>🌟 原本標準({defW}×{defH}px)</span>
                          </button>
                          <span className="font-mono text-xs font-black text-amber-900 bg-white px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs">
                            {curW} × {curH} px
                          </span>
                        </div>
                      </div>

                      {/* ① 横幅（circleWidth）調整 */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-amber-900">
                          <span>横幅 (circleWidth): <strong className="font-mono text-rose-700">{curW}px</strong></span>
                          <span className="text-slate-400 font-normal">文字幅に合わせて調整</span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="48"
                          step="1"
                          value={curW}
                          onChange={(e) => updateField(selectedField.id, 'circleWidth', parseInt(e.target.value) || 24)}
                          className="w-full accent-amber-600 cursor-pointer h-2 bg-amber-200 rounded-lg"
                        />
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleWidth', Math.max(10, curW - 2))}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="2px 縮小"
                          >
                            -2px
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleWidth', Math.max(10, curW - 1))}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="1px 縮小"
                          >
                            -1px
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleWidth', curW + 1)}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="1px 拡大"
                          >
                            +1px
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleWidth', curW + 2)}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="2px 拡大"
                          >
                            +2px
                          </button>
                        </div>
                      </div>

                      {/* ② 縦幅（circleHeight）調整 */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-amber-900">
                          <span>縦幅 (circleHeight): <strong className="font-mono text-rose-700">{curH}px</strong></span>
                          <span className="text-slate-400 font-normal">行高に合わせて調整</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="36"
                          step="1"
                          value={curH}
                          onChange={(e) => updateField(selectedField.id, 'circleHeight', parseInt(e.target.value) || 16)}
                          className="w-full accent-amber-600 cursor-pointer h-2 bg-amber-200 rounded-lg"
                        />
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleHeight', Math.max(8, curH - 2))}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="2px 縮小"
                          >
                            -2px
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleHeight', Math.max(8, curH - 1))}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="1px 縮小"
                          >
                            -1px
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleHeight', curH + 1)}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="1px 拡大"
                          >
                            +1px
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleHeight', curH + 2)}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="2px 拡大"
                          >
                            +2px
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <>
                    {/* 文字サイズ (px) */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">文字サイズ (px)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={selectedField.fontSize || 10}
                        onChange={(e) => updateField(selectedField.id, 'fontSize', parseFloat(e.target.value) || 10)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>

                    {/* 🎯 マス目ピッチ調整（雇用保険・取得届準拠：スライダー ＆ 微調整ボタン） */}
                    {selectedField.pitch !== undefined ? (() => {
                      const defaultPitch = DEFAULT_HEALTH_PENSION_LOSS_FIELDS.find(f => f.id === selectedField.id)?.pitch;
                      return (
                        <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <label className="text-[11px] font-black text-rose-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              マス目ピッチ（文字間隔）:
                            </label>
                            <div className="flex items-center gap-1.5">
                              {defaultPitch !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => updateField(selectedField.id, 'pitch', defaultPitch)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer transition flex items-center gap-0.5"
                                  title={`原本規定値（${defaultPitch.toFixed(2)}%）に一発で戻します`}
                                >
                                  <span>🌟 原本標準({defaultPitch.toFixed(2)}%)</span>
                                </button>
                              )}
                              <span className="font-mono text-xs font-black text-rose-700 bg-white px-2 py-0.5 rounded-md border border-rose-300">
                                {selectedField.pitch.toFixed(2)} % ({(selectedField.pitch * 2.1).toFixed(2)}mm)
                              </span>
                            </div>
                          </div>

                          {/* スライダーバー */}
                          <input
                            type="range"
                            min="1.00"
                            max="5.00"
                            step="0.01"
                            value={selectedField.pitch}
                            onChange={(e) => updateField(selectedField.id, 'pitch', parseFloat(e.target.value) || 2.5)}
                            className="w-full accent-rose-600 cursor-pointer h-2 bg-rose-200 rounded-lg"
                          />

                          {/* ワンクリック微調整ボタン */}
                          <div className="flex items-center justify-between gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.max(0.5, Math.round((selectedField.pitch! - 0.05) * 100) / 100))}
                              className="px-2 py-1 bg-white hover:bg-rose-100 active:scale-95 text-rose-800 border border-rose-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                              title="0.05% 狭くする"
                            >
                              -0.05
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.max(0.5, Math.round((selectedField.pitch! - 0.01) * 100) / 100))}
                              className="px-2 py-1 bg-white hover:bg-rose-100 active:scale-95 text-rose-800 border border-rose-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                              title="0.01% 狭くする"
                            >
                              -0.01
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.round((selectedField.pitch! + 0.01) * 100) / 100)}
                              className="px-2 py-1 bg-white hover:bg-rose-100 active:scale-95 text-rose-800 border border-rose-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                              title="0.01% 広げる"
                            >
                              +0.01
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.round((selectedField.pitch! + 0.05) * 100) / 100)}
                              className="px-2 py-1 bg-white hover:bg-rose-100 active:scale-95 text-rose-800 border border-rose-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                              title="0.05% 広げる"
                            >
                              +0.05
                            </button>
                          </div>
                        </div>
                      );
                    })() : (
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">マス目ピッチ設定（新規追加）</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.05"
                            placeholder="単一枠（ピッチなし）"
                            onChange={(e) => updateField(selectedField.id, 'pitch', e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="flex-1 p-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-center text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'pitch', 2.5)}
                            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 text-[10px] font-bold cursor-pointer"
                          >
                            ピッチ有効化
                          </button>
                        </div>
                      </div>
                    )}

                    {/* サンプル表示値 */}
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-0.5">プレビューサンプル文字</label>
                      <input
                        type="text"
                        value={selectedField.example || ''}
                        onChange={(e) => updateField(selectedField.id, 'example', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
