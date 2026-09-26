import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Save, Loader2,
  ZoomIn, ZoomOut, RotateCcw,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight,
  X
} from 'lucide-react';

import { 
  loadMonthlyRevisionDocCoordinates, 
  resetMonthlyRevisionDocCoordinates,
  fetchMonthlyRevisionDocCoordinatesFromDb,
  saveMonthlyRevisionDocCoordinatesToDb,
  type MonthlyRevisionDocFieldConfig 
} from '../lib/monthlyRevisionDocCoordinates';
import { 
  OfficialMonthlyRevisionDoc, 
  type MonthlyRevisionEmployeeDocData 
} from './OfficialMonthlyRevisionDoc';

interface MonthlyRevisionDocMasterInspectorProps {
  tenantId?: string;
  onClose?: () => void;
}

export const MonthlyRevisionDocMasterInspector: React.FC<MonthlyRevisionDocMasterInspectorProps> = ({ 
  tenantId,
  onClose
}) => {
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(tenantId || '');

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

  // 📝 サンプル事業所情報
  const sampleDocData = {
    submissionDate: new Date().toISOString().split('T')[0],
    officeCityCode: '25',
    officeSymbolKana: 'カア',
    companyZip: '520-0043',
    companyAddress: '滋賀県大津市中央1-2-3 サンプルビル4F',
    companyName: '株式会社サンプル商事',
    companyOwnerName: '代表取締役 山田 太郎',
    companyPhone: '077-512-3456',
    sharoushiName: ''
  };

  // サンプル被保険者行データ
  const sampleEmployees: MonthlyRevisionEmployeeDocData[] = [
    {
      id: 'rev-emp-1',
      insuranceNumber: '101',
      name: '駒井 修一郎',
      birthDate: '1988-04-15',
      revisionYearMonth: '2026-09',
      currentHealthStandard: 300000,
      currentPensionStandard: 300000,
      previousRevisionYM: '2025-09',
      wageChangeType: '1.昇給',
      wageChangeYM: '2026-06',
      retroactiveAmount: 0,
      month1: { ym: '2026-06', monthNum: 6, days: 21, cash: 360000, inKind: 0, total: 360000 },
      month2: { ym: '2026-07', monthNum: 7, days: 22, cash: 360000, inKind: 0, total: 360000 },
      month3: { ym: '2026-08', monthNum: 8, days: 20, cash: 360000, inKind: 0, total: 360000 },
      totalWage: 1080000,
      averageWage: 360000,
      modifiedAverageWage: 360000,
      isOver70: false,
      isShortTimeWorker: false,
      remarks: '基本給昇給のため'
    },
    {
      id: 'rev-emp-2',
      insuranceNumber: '102',
      name: '大津 花子',
      birthDate: '1995-11-20',
      revisionYearMonth: '2026-09',
      currentHealthStandard: 240000,
      currentPensionStandard: 240000,
      previousRevisionYM: '2025-09',
      wageChangeType: '1.昇給',
      wageChangeYM: '2026-06',
      retroactiveAmount: 0,
      month1: { ym: '2026-06', monthNum: 6, days: 20, cash: 280000, inKind: 0, total: 280000 },
      month2: { ym: '2026-07', monthNum: 7, days: 21, cash: 290000, inKind: 0, total: 290000 },
      month3: { ym: '2026-08', monthNum: 8, days: 21, cash: 285000, inKind: 0, total: 285000 },
      totalWage: 855000,
      averageWage: 285000,
      modifiedAverageWage: 285000,
      isOver70: false,
      isShortTimeWorker: false,
      remarks: '役職手当新設'
    },
    {
      id: 'rev-emp-3',
      insuranceNumber: '103',
      name: '草津 健一',
      birthDate: '1954-02-10',
      revisionYearMonth: '2026-09',
      currentHealthStandard: 410000,
      currentPensionStandard: 410000,
      previousRevisionYM: '2025-09',
      wageChangeType: '2.降給',
      wageChangeYM: '2026-06',
      retroactiveAmount: 0,
      month1: { ym: '2026-06', monthNum: 6, days: 18, cash: 320000, inKind: 0, total: 320000 },
      month2: { ym: '2026-07', monthNum: 7, days: 19, cash: 310000, inKind: 0, total: 310000 },
      month3: { ym: '2026-08', monthNum: 8, days: 18, cash: 315000, inKind: 0, total: 315000 },
      totalWage: 945000,
      averageWage: 315000,
      modifiedAverageWage: 315000,
      myNumber: '123456789012',
      isOver70: true,
      isShortTimeWorker: false,
      remarks: '再雇用嘱託移行'
    }
  ];

  // 選択中のフィールドID
  const [selectedFieldId, setSelectedFieldId] = useState<string>('submissionDate');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // 座標State
  const [fields, setFields] = useState<MonthlyRevisionDocFieldConfig[]>(() => {
    return loadMonthlyRevisionDocCoordinates(resolvedTenantId);
  });

  useEffect(() => {
    fetchMonthlyRevisionDocCoordinatesFromDb(resolvedTenantId).then(dbCoords => {
      if (dbCoords && dbCoords.length > 0) {
        setFields(dbCoords);
      }
    });
  }, [resolvedTenantId]);

  const selectedField = fields.find(f => f.id === selectedFieldId);

  // 座標微調整
  const adjustField = (id: string, dx: number, dy: number) => {
    setFields(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          x: Math.max(0, Math.min(100, Number((f.x + dx).toFixed(2)))),
          y: Math.max(0, Math.min(100, Number((f.y + dy).toFixed(2))))
        };
      }
      return f;
    }));
  };

  const updateFieldProp = (id: string, prop: keyof MonthlyRevisionDocFieldConfig, val: any) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, [prop]: val } : f));
  };

  // DB保存
  const handleSaveToDb = async () => {
    setIsSaving(true);
    try {
      const ok = await saveMonthlyRevisionDocCoordinatesToDb(fields, resolvedTenantId);
      if (ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        alert('DBへの保存に失敗しました。');
      }
    } catch (e: any) {
      alert('エラー: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 初期リセット
  const handleReset = () => {
    if (!confirm('月額変更届の印字座標を初期デフォルト値に戻しますか？')) return;
    const def = resetMonthlyRevisionDocCoordinates(resolvedTenantId);
    setFields(def);
  };

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col">
      {/* 🧭 トップバー */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-black shadow-lg">
            📐
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight">
                被保険者報酬月額変更届（様式コード 2221）印字座標マスタ設定
              </h1>
              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/50 font-black px-2 py-0.5 rounded-full">
                FORM-2221-INSPECTOR
              </span>
            </div>
            <p className="text-xs text-slate-400">
              日本年金機構の公式原本用紙の上に印字する全項目の座標をミリ単位（0.1%刻み）で精密調整し、全社共通マスタとしてDB永続化します。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* プレビューズーム */}
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              onClick={() => setPreviewZoom(z => Math.max(50, z - 10))}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              title="縮小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-bold text-slate-300">{previewZoom}%</span>
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
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>初期位置へリセット</span>
          </button>

          {/* DB全社一括保存 */}
          <button
            onClick={handleSaveToDb}
            disabled={isSaving}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? '✅ DB保存完了！' : '💾 全社マスタとしてDB保存'}</span>
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

      {/* 🧭 メインコンテンツ (スプリットビュー) */}
      <div className="flex-1 flex overflow-hidden">
        {/* 🎛️ 左サイドバー: 座標コントローラー */}
        <div className="w-96 bg-slate-850 border-r border-slate-700 flex flex-col p-4 overflow-y-auto space-y-4 shrink-0">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              🎯 調整する印字項目を選択:
            </label>
            <select
              value={selectedFieldId}
              onChange={e => setSelectedFieldId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-hidden focus:border-indigo-500"
            >
              <optgroup label="📋 基本情報（提出日・事業所情報）">
                {fields.filter(f => !f.id.startsWith('emp') && !f.id.startsWith('m')).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </optgroup>
              <optgroup label="👤 従業員 行共通項目（1〜5行目）">
                {fields.filter(f => f.id.startsWith('emp')).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </optgroup>
              <optgroup label="📊 3ヶ月支給実績（通貨・現物・合計）">
                {fields.filter(f => f.id.startsWith('m')).map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {selectedField && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-4">
              <div className="border-b border-slate-700 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-indigo-300">{selectedField.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">{selectedField.id}</span>
                </div>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                  {selectedField.section}
                </span>
              </div>

              {/* 十字キー（0.1% / 0.5% 単位） */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 text-center">
                  十字キー微調整 (X: {selectedField.x}%, Y: {selectedField.y}%)
                </label>
                <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
                  <div />
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => adjustField(selectedField.id, 0, -0.5)}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center justify-center cursor-pointer"
                      title="上へ大きく (0.5%)"
                    >
                      <ChevronsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustField(selectedField.id, 0, -0.1)}
                      className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white flex items-center justify-center cursor-pointer"
                      title="上へ (0.1%)"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                  </div>
                  <div />

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustField(selectedField.id, -0.5, 0)}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center justify-center cursor-pointer"
                      title="左へ大きく (0.5%)"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustField(selectedField.id, -0.1, 0)}
                      className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white flex items-center justify-center cursor-pointer"
                      title="左へ (0.1%)"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="w-3 h-3 bg-indigo-400 rounded-full animate-pulse" />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustField(selectedField.id, 0.1, 0)}
                      className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white flex items-center justify-center cursor-pointer"
                      title="右へ (0.1%)"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustField(selectedField.id, 0.5, 0)}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center justify-center cursor-pointer"
                      title="右へ大きく (0.5%)"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div />
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => adjustField(selectedField.id, 0, 0.1)}
                      className="p-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white flex items-center justify-center cursor-pointer"
                      title="下へ (0.1%)"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustField(selectedField.id, 0, 0.5)}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center justify-center cursor-pointer"
                      title="下へ大きく (0.5%)"
                    >
                      <ChevronsDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div />
                </div>
              </div>

              {/* 数値直接入力 */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">X座標 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedField.x}
                    onChange={e => updateFieldProp(selectedField.id, 'x', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Y座標 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedField.y}
                    onChange={e => updateFieldProp(selectedField.id, 'y', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* 文字サイズ・ピッチ等 */}
              <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-700 pt-3">
                <div>
                  <label className="block text-slate-400 mb-1">フォントサイズ (px)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedField.fontSize || 10}
                    onChange={e => updateFieldProp(selectedField.id, 'fontSize', parseFloat(e.target.value) || 10)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                {selectedField.pitch !== undefined && (
                  <div>
                    <label className="block text-slate-400 mb-1">文字ピッチ (px)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedField.pitch}
                      onChange={e => updateFieldProp(selectedField.id, 'pitch', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                )}
                {selectedField.width !== undefined && (
                  <div>
                    <label className="block text-slate-400 mb-1">印字幅 (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedField.width}
                      onChange={e => updateFieldProp(selectedField.id, 'width', parseFloat(e.target.value) || 10)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            💡 <strong>ワンポイント:</strong> A4用紙原本をプリンターにセットし「文字のみ」でテスト印刷を行い、ズレがある場合はこの十字キーで0.1%単位で微調整して「全社保存」してください。
          </div>
        </div>

        {/* 📄 右メインエリア: リアルタイムA4プレビュー */}
        <div className="flex-1 overflow-auto bg-slate-950 p-6 flex justify-center items-start">
          <div 
            style={{ 
              transform: `scale(${previewZoom / 100})`, 
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
          >
            <OfficialMonthlyRevisionDoc
              data={{
                ...sampleDocData,
                employees: sampleEmployees
              }}
              customCoords={fields}
              canEditCoordinates={true}
              tenantId={resolvedTenantId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
