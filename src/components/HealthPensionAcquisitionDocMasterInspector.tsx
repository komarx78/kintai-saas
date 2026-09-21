import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Save, RotateCcw, CheckCircle2, 
  ZoomIn, ZoomOut, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Sliders, Eye, Sparkles
} from 'lucide-react';
import { 
  DEFAULT_HEALTH_PENSION_ACQ_FIELDS,
  loadHealthPensionAcqCoordinates,
  saveHealthPensionAcqCoordinates,
  saveHealthPensionAcqCoordinatesToDb,
  broadcastHealthPensionAcqCoordinates,
  type HealthPensionAcqFieldConfig
} from '../lib/healthPensionAcquisitionDocCoordinates';
import { OfficialHealthPensionAcquisitionDoc, type HealthPensionAcquisitionEmployee } from './OfficialHealthPensionAcquisitionDoc';

export const HealthPensionAcquisitionDocMasterInspector: React.FC = () => {
  // モード: 'inspector' (座標微調整) | 'input_preview' (実際の直接入力プレビュー)
  const [activeTab, setActiveTab] = useState<'inspector' | 'input_preview'>('inspector');

  // インスペクター用State
  const [fields, setFields] = useState<HealthPensionAcqFieldConfig[]>(() => loadHealthPensionAcqCoordinates());
  const [selectedSection, setSelectedSection] = useState<'header' | 'office' | 'insured_person_1'>('insured_person_1');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('myNumberOrPension_1');
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

        const cMapUrl = window.location.origin ? (window.location.origin + '/cmaps/') : '/cmaps/';
        const standardFontDataUrl = window.location.origin ? (window.location.origin + '/standard_fonts/') : '/standard_fonts/';

        const loadingTask = pdfjsLib.getDocument({
          url: '/health_pension_acquisition_template.pdf',
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
  const updateField = useCallback((id: string, key: keyof HealthPensionAcqFieldConfig, value: any) => {
    setFields(prev => {
      let finalVal = value;
      if (typeof value === 'number') {
        const precision = key === 'pitch' ? 100 : (key === 'x' || key === 'y') ? 100 : 1;
        finalVal = Math.round(value * precision) / precision;
      }
      const updated = prev.map(f => f.id === id ? { ...f, [key]: finalVal } : f);
      saveHealthPensionAcqCoordinates(updated);
      broadcastHealthPensionAcqCoordinates(updated);
      return updated;
    });
  }, []);

  // 矢印キー微調整
  const nudgeField = useCallback((id: string, deltaX: number, deltaY: number) => {
    const f = fields.find(item => item.id === id);
    if (!f) return;
    const precision = 100;
    const nextX = Math.max(0, Math.min(100, Math.round((f.x + deltaX) * precision) / precision));
    const nextY = Math.max(0, Math.min(100, Math.round((f.y + deltaY) * precision) / precision));
    setFields(prev => {
      const updated = prev.map(item => item.id === id ? { ...item, x: nextX, y: nextY } : item);
      saveHealthPensionAcqCoordinates(updated);
      broadcastHealthPensionAcqCoordinates(updated);
      return updated;
    });
  }, [fields]);

  // DB保存
  const handleSaveToDb = async () => {
    setIsSaving(true);
    try {
      const ok = await saveHealthPensionAcqCoordinatesToDb(fields);
      if (ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        // ローカルには既に100%安全に保存されているため、安心メッセージを提示
        alert('【ローカル保存完了】\nお使いのブラウザ（ローカル）に最新座標が正常に保存されました！\nこのPCでの帳票印刷・作成はそのまま最新設定でご利用いただけます。\n\n※他端末・全社でのクラウド同期を有効化する場合は、Supabaseにて「カラム追加SQL（add_health_pension_acq_doc_column.sql）」の実行を行ってください。');
      }
    } catch (e: any) {
      alert('保存エラー: ' + (e.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  // 初期値リセット
  const handleResetToDefault = () => {
    if (confirm('座標設定を公式原本規定の初期設定にリセットしますか？')) {
      setFields(DEFAULT_HEALTH_PENSION_ACQ_FIELDS);
      saveHealthPensionAcqCoordinates(DEFAULT_HEALTH_PENSION_ACQ_FIELDS);
      broadcastHealthPensionAcqCoordinates(DEFAULT_HEALTH_PENSION_ACQ_FIELDS);
      saveHealthPensionAcqCoordinatesToDb(DEFAULT_HEALTH_PENSION_ACQ_FIELDS);
      alert('初期値にリセットしました。');
    }
  };

  // 🖱️ ドラッグ開始
  const handleStartDrag = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const f = fields.find(item => item.id === id);
    if (!f) return;
    setSelectedFieldId(id);
    setSelectedSection(f.section as any);
    setDraggingFieldId(id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: f.x,
      startY: f.y
    };
  };

  // ドラッグ中・ドラッグ終了リスナー
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingFieldId || !dragStartRef.current || !previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

      const precision = 100;
      const newX = Math.max(0, Math.min(100, Math.round((dragStartRef.current.startX + deltaX) * precision) / precision));
      const newY = Math.max(0, Math.min(100, Math.round((dragStartRef.current.startY + deltaY) * precision) / precision));

      setFields(prev => {
        const updated = prev.map(f => f.id === draggingFieldId ? { ...f, x: newX, y: newY } : f);
        saveHealthPensionAcqCoordinates(updated);
        broadcastHealthPensionAcqCoordinates(updated);
        return updated;
      });
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
  }, [draggingFieldId]);

  // モック従業員データ（直接入力プレビュー用）
  const mockEmployees: HealthPensionAcquisitionEmployee[] = [
    {
      id: 'emp-1',
      name: '駒井 修一郎',
      last_name: '駒井',
      first_name: '修一郎',
      name_kana: 'コマイ シュウイチロウ',
      last_name_kana: 'コマイ',
      first_name_kana: 'シュウイチロウ',
      birth_date: '1988-04-15',
      gender: '1',
      my_number: '123456789012',
      basic_pension_number: '1234567890',
      insurance_number: '001',
      join_date: '2026-04-01',
      base_salary: 280000,
      monthly_remuneration: 280000,
      goods_remuneration: 0,
      dependents_count: 0,
      employment_type: 'full_time',
      address: '滋賀県大津市浜大津1-2-3',
      zip_code: '520-0047'
    },
    {
      id: 'emp-2',
      name: '山田 花子',
      last_name: '山田',
      first_name: '花子',
      name_kana: 'ヤマダ ハナコ',
      last_name_kana: 'ヤマダ',
      first_name_kana: 'ハナコ',
      birth_date: '1995-08-20',
      gender: '2',
      my_number: '987654321098',
      basic_pension_number: '9876543210',
      insurance_number: '002',
      join_date: '2026-04-01',
      base_salary: 220000,
      monthly_remuneration: 220000,
      goods_remuneration: 0,
      dependents_count: 1,
      employment_type: 'full_time',
      address: '滋賀県草津市西渋川1-1-1',
      zip_code: '525-0026'
    }
  ];

  const mockCompany = {
    name: '株式会社cocotte',
    address: '滋賀県大津市浜大津1-2-3',
    representative_name: '代表取締役 駒井 修一郎',
    phone_number: '077-574-6907',
    corporate_number: '1234567890123',
    zip_code: '520-0047'
  };

  return (
    <div className="space-y-4 font-sans">
      {/* 🧭 サブヘッダー・モード切り替えバー */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                日本年金機構 / 協会けんぽ（様式コード 2200）
              </span>
              <span className="text-xs text-slate-400 font-bold">A4縦・公的届出書</span>
            </div>
            <h2 className="text-base font-black text-slate-800 mt-0.5">
              健康保険・厚生年金保険 被保険者資格取得届 印字座標マスタ設定
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* タブ切り替え */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold shadow-inner">
            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'inspector'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>原本マス目 精密座標インスペクター</span>
            </button>
            <button
              onClick={() => setActiveTab('input_preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeTab === 'input_preview'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>全社実動 直接入力 ＆ A4印刷画面</span>
            </button>
          </div>

          {activeTab === 'inspector' && (
            <>
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                title="初期座標設定にリセット"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>初期値</span>
              </button>
              <button
                onClick={handleSaveToDb}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? '保存中...' : savedSuccess ? '全社保存完了！' : '全社マスタ保存'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* モード①：印字座標インスペクター（微調整モード）                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inspector' && (
        <div className="flex flex-col lg:flex-row items-start gap-4">
          
          {/* 左側：リアルタイム原本キャンバスプレビュー */}
          <div className="flex-1 w-full bg-slate-200/80 p-4 sm:p-6 rounded-2xl border border-slate-300 overflow-x-auto flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-bold flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  原本枠上の文字・〇をドラッグして位置微調整できます
                </span>
                <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                  <span className="inline-block w-2 h-2 rounded-full border border-dashed border-indigo-600 bg-indigo-200"></span>
                  破線〇＝未選択の選択肢（クリックして位置・大きさ調整）
                </span>
              </div>
              <div className="flex items-center bg-white rounded-xl p-1 border border-slate-300 shadow-2xs">
                <button
                  onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold px-2 text-slate-700">{previewZoom}%</span>
                <button
                  onClick={() => setPreviewZoom(z => Math.min(150, z + 10))}
                  className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* A4縦 実寸枠 (210mm × 297mm) */}
            <div 
              ref={previewContainerRef}
              style={{
                transform: `scale(${previewZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
                containerType: 'inline-size'
              }}
              className="w-[210mm] h-[297mm] bg-white shadow-2xl relative border border-slate-400 select-none overflow-hidden box-border"
            >
              {bgPdfImg ? (
                <img 
                  src={bgPdfImg} 
                  alt="原本背景" 
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-90"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                  {isLoadingPdf ? '原本PDFを読み込み中...' : '原本背景なし'}
                </div>
              )}

              {/* 座標要素描画 */}
              {fields.filter(f => !f.disabled).map(field => {
                const isSelected = selectedFieldId === field.id;
                const isDragging = draggingFieldId === field.id;

                // ⭕ 丸囲み項目プレビュー（年号・取得区分・男女・被扶養者・備考等の〇）
                if (field.isCircle) {
                  // サンプルプレビューで有効な丸囲み選択肢の判定
                  // 1. 生年月日元号: 昭和 (birthEra_1 === '5') -> birthEra_showa_1
                  // 2. 性別（種別）: 男 (gender_1 === '1') -> gender_male_1
                  // 3. 取得区分: 健保・厚年 (acqCategory_1 === '1') -> acqCat_kenpo_1
                  // 4. 取得元号: 令和 (acqEra_1 === '9') -> acqEra_reiwa_1
                  // 5. 被扶養者: 無 (dependents_1 === '0') -> dependents_none_1
                  const sampleActiveMap: Record<string, string> = {
                    birthEra_1: '5',       // 昭和
                    gender_1: '1',         // 男
                    acqCategory_1: '1',    // 健保・厚年
                    acqEra_1: '9',         // 令和
                    dependents_1: '0',     // 無
                    remarks_1: ''
                  };

                  const isDefaultActive = field.circleValueKey && field.circleActiveValue
                    ? sampleActiveMap[field.circleValueKey] === field.circleActiveValue
                    : false;

                  const circleW = field.circleWidth || 24;
                  const circleH = field.circleHeight || 16;

                  // 選択中の場合は黄色ハイライト、サンプルの有効値は黒実線〇、その他の選択肢は淡い破線ガイド〇として常時可視化
                  const isGuideCircle = !isSelected && !isDefaultActive;

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
                        transform: 'translate(-50%, -50%)',
                        width: `${circleW}px`,
                        height: `${circleH}px`,
                        cursor: 'move',
                        zIndex: isSelected ? 50 : isDefaultActive ? 30 : 20
                      }}
                      className={`flex items-center justify-center select-none rounded-full transition-all ${
                        isSelected
                          ? 'ring-2 ring-amber-500 bg-amber-300/60 scale-110 shadow-md font-black'
                          : isDefaultActive
                            ? 'hover:ring-2 hover:ring-indigo-400 bg-transparent cursor-pointer'
                            : 'hover:ring-2 hover:ring-indigo-500 bg-indigo-50/30 hover:bg-indigo-100/60 cursor-pointer'
                      }`}
                      title={
                        isSelected
                          ? `${field.name} (${field.x}%, ${field.y}%) [${circleW}×${circleH}px] - 選択中（ドラッグまたは右パネルで調整）`
                          : isDefaultActive
                            ? `${field.name} (${field.x}%, ${field.y}%) [${circleW}×${circleH}px] - サンプル有効値（クリックして調整）`
                            : `${field.name} (${field.x}%, ${field.y}%) [${circleW}×${circleH}px] - クリックしてこの選択肢の位置・大きさを調整`
                      }
                    >
                      <svg viewBox="0 0 32 24" className="w-full h-full overflow-visible">
                        <ellipse
                          cx="16"
                          cy="12"
                          rx="14"
                          ry="9.5"
                          fill="none"
                          stroke={
                            isSelected 
                              ? '#0f172a' 
                              : isDefaultActive 
                                ? '#0f172a' 
                                : 'rgba(99, 102, 241, 0.75)'
                          }
                          strokeWidth={isSelected ? '2.6' : isDefaultActive ? '2.2' : '1.8'}
                          strokeDasharray={isGuideCircle ? '3,2' : undefined}
                        />
                      </svg>
                    </div>
                  );
                }

                // 郵便番号項目はハイフンを物理除去して7桁数字のみで描画
                let displayVal = field.example;
                if (field.id === 'officeZipCode' || field.id === 'zipCode_1') {
                  displayVal = String(displayVal || '').replace(/[^0-9]/g, '');
                }

                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => handleStartDrag(field.id, e)}
                    style={{
                      position: 'absolute',
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      fontSize: `${field.fontSize}pt`,
                      width: field.pitch && field.pitch > 0 ? 'max-content' : (field.width ? `${field.width * 2.1}mm` : 'auto'),
                      cursor: 'move',
                      zIndex: isSelected ? 40 : (isDragging ? 50 : 10),
                      touchAction: 'none'
                    }}
                    className={`leading-none font-mono font-black select-none transition-colors ${
                      isSelected 
                        ? 'bg-amber-300/80 ring-2 ring-amber-500 text-slate-950 rounded-xs px-0.5' 
                        : 'bg-indigo-500/20 hover:bg-indigo-500/40 text-slate-900 rounded-xs'
                    } ${isDragging ? 'opacity-75 ring-2 ring-indigo-600 scale-105' : ''}`}
                    title={`${field.name} (${field.x}%, ${field.y}%)`}
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
                              fontSize: `${field.fontSize}pt`,
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

          {/* 右側：座標微調整コントローラーパネル */}
          <div className="w-full lg:w-96 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4 shrink-0">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-600" />
                印字項目座標微調整
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                方向キーまたは数値入力で 0.1% 単位で精密調整できます。
              </p>
            </div>

            {/* セクション選択 */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedSection('insured_person_1')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  selectedSection === 'insured_person_1' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                被保険者1
              </button>
              <button
                type="button"
                onClick={() => setSelectedSection('office')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  selectedSection === 'office' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                事業所情報
              </button>
              <button
                type="button"
                onClick={() => setSelectedSection('header')}
                className={`py-1.5 rounded-lg transition cursor-pointer ${
                  selectedSection === 'header' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                提出日他
              </button>
            </div>

            {/* 項目選択ドロップダウン */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-500">調整対象項目</label>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                  全{sectionFields.length}項目
                </span>
              </div>
              <select
                value={selectedFieldId}
                onChange={(e) => {
                  setSelectedFieldId(e.target.value);
                  const target = fields.find(f => f.id === e.target.value);
                  if (target) setSelectedSection(target.section as any);
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-amber-100 text-amber-800 border border-amber-300">
                        〇囲み
                      </span>
                    )}
                    <span>{selectedField.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono font-normal">ID: {selectedField.id}</span>
                </div>

                {selectedField.isCircle && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900 leading-tight">
                    💡 <strong>〇の個別調整:</strong> この選択肢に該当した時だけ印字される〇です。原本の文字中央にぴったり重なるよう微調整できます（左の黄色〇をドラッグ、または下で調整）。
                  </div>
                )}

                {/* 矢印キー微調整ボタン */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">ステップ微調整 (±0.1%)</label>
                  <div className="flex justify-center items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => nudgeField(selectedField.id, -0.1, 0)}
                      className="p-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 text-slate-700 cursor-pointer shadow-2xs"
                      title="左へ 0.1%"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => nudgeField(selectedField.id, 0, -0.1)}
                        className="p-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 text-slate-700 cursor-pointer shadow-2xs"
                        title="上へ 0.1%"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => nudgeField(selectedField.id, 0, 0.1)}
                        className="p-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 text-slate-700 cursor-pointer shadow-2xs"
                        title="下へ 0.1%"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => nudgeField(selectedField.id, 0.1, 0)}
                      className="p-2 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 text-slate-700 cursor-pointer shadow-2xs"
                      title="右へ 0.1%"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* X, Y, フォントサイズ（〇項目の場合はフォントサイズ不要） */}
                <div className={`grid ${selectedField.isCircle ? 'grid-cols-2' : 'grid-cols-3'} gap-2 pt-1`}>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block">X座標 (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedField.x}
                      onChange={(e) => updateField(selectedField.id, 'x', parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block">Y座標 (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedField.y}
                      onChange={(e) => updateField(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-center"
                    />
                  </div>
                  {!selectedField.isCircle && (
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block">文字サイズ (pt)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={selectedField.fontSize}
                        onChange={(e) => updateField(selectedField.id, 'fontSize', parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-center"
                      />
                    </div>
                  )}
                </div>

                {/* 🎯 〇サイズ微調整（丸囲み項目専用：横幅・縦幅スライダー ＆ 微調整ボタン） */}
                {selectedField.isCircle ? (() => {
                  const defaultField = DEFAULT_HEALTH_PENSION_ACQ_FIELDS.find(f => f.id === selectedField.id);
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
                          <span>横幅 (circleWidth): <strong className="font-mono text-indigo-700">{curW}px</strong></span>
                          <span className="text-slate-400 font-normal">文字幅に合わせて調整</span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="80"
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
                          <span>縦幅 (circleHeight): <strong className="font-mono text-indigo-700">{curH}px</strong></span>
                          <span className="text-slate-400 font-normal">行高に合わせて調整</span>
                        </div>
                        <input
                          type="range"
                          min="8"
                          max="50"
                          step="1"
                          value={curH}
                          onChange={(e) => updateField(selectedField.id, 'circleHeight', parseInt(e.target.value) || 16)}
                          className="w-full accent-amber-600 cursor-pointer h-2 bg-amber-200 rounded-lg"
                        />
                        <div className="flex items-center justify-between gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleHeight', Math.max(6, curH - 2))}
                            className="px-2 py-1 bg-white hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                            title="2px 縮小"
                          >
                            -2px
                          </button>
                          <button
                            type="button"
                            onClick={() => updateField(selectedField.id, 'circleHeight', Math.max(6, curH - 1))}
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
                    {/* 🎯 マス目ピッチ調整（雇用保険準拠：スライダー ＆ 微調整ボタン） */}
                    {selectedField.pitch !== undefined ? (() => {
                      const defaultPitch = DEFAULT_HEALTH_PENSION_ACQ_FIELDS.find(f => f.id === selectedField.id)?.pitch;
                      return (
                        <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <label className="text-[11px] font-black text-indigo-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
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
                              <span className="font-mono text-xs font-black text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-300">
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
                            className="w-full accent-indigo-600 cursor-pointer h-2 bg-indigo-200 rounded-lg"
                          />

                          {/* ワンクリック微調整ボタン */}
                          <div className="flex items-center justify-between gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.max(0.5, Math.round((selectedField.pitch! - 0.05) * 100) / 100))}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 active:scale-95 text-indigo-800 border border-indigo-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                              title="0.05% 狭くする"
                            >
                              -0.05
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.max(0.5, Math.round((selectedField.pitch! - 0.01) * 100) / 100))}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 active:scale-95 text-indigo-800 border border-indigo-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                              title="0.01% 狭くする"
                            >
                              -0.01
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.round((selectedField.pitch! + 0.01) * 100) / 100)}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 active:scale-95 text-indigo-800 border border-indigo-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
                              title="0.01% 広げる"
                            >
                              +0.01
                            </button>
                            <button
                              type="button"
                              onClick={() => updateField(selectedField.id, 'pitch', Math.round((selectedField.pitch! + 0.05) * 100) / 100)}
                              className="px-2 py-1 bg-white hover:bg-indigo-100 active:scale-95 text-indigo-800 border border-indigo-300 rounded-lg text-[10px] font-black shadow-2xs cursor-pointer"
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
                            className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200 text-[10px] font-bold cursor-pointer"
                          >
                            ピッチ有効化
                          </button>
                        </div>
                      </div>
                    )}

                    {/* サンプル表示値 */}
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block">プレビューサンプル文字</label>
                      <input
                        type="text"
                        value={selectedField.example}
                        onChange={(e) => updateField(selectedField.id, 'example', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* モード②：実入力・A4印刷プレビューモード                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'input_preview' && (
        <OfficialHealthPensionAcquisitionDoc
          companyInfo={mockCompany}
          employees={mockEmployees}
          customCoords={fields}
          hideHeader={false}
        />
      )}
    </div>
  );
};
