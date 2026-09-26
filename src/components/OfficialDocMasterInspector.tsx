import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { TaxDocMasterInspector } from './TaxDocMasterInspector';
import { BonusDocMasterInspector } from './BonusDocMasterInspector';
import { EmploymentAcquisitionDocMasterInspector } from './EmploymentAcquisitionDocMasterInspector';
import { EmploymentLossDocMasterInspector } from './EmploymentLossDocMasterInspector';
import { SpouseDocMasterInspector } from './SpouseDocMasterInspector';
import { HealthPensionAcquisitionDocMasterInspector } from './HealthPensionAcquisitionDocMasterInspector';
import { HealthPensionLossDocMasterInspector } from './HealthPensionLossDocMasterInspector';

export type PublicDocType = 'employment_acquisition' | 'employment_loss' | 'bonus_report' | 'health_pension_acquisition' | 'health_pension_loss' | 'tax_withholding' | 'spouse_deduction';

export interface OfficialDocMasterInspectorProps {
  tenantId?: string;
}

export const OfficialDocMasterInspector: React.FC<OfficialDocMasterInspectorProps> = ({ tenantId }) => {
  const [activeDoc, setActiveDoc] = useState<PublicDocType>('spouse_deduction'); // 配偶者控除等をデフォルト表示

  return (
    <div className="space-y-4 font-sans">
      {/* 🧭 公的帳票 選択切り替えタブバー */}
      <div className="bg-slate-900 p-2 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveDoc('spouse_deduction')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeDoc === 'spouse_deduction'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg ring-2 ring-purple-400/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">🏛️</span>
            <span>令和8年分 基礎・配偶者・特定親族・所得調整控除申告書（A4横）</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 font-bold">
              NEW
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('employment_loss')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeDoc === 'employment_loss'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg ring-2 ring-amber-400/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">🏛️</span>
            <span>雇用保険被保険者資格喪失届（様式第4号）</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('employment_acquisition')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeDoc === 'employment_acquisition'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg ring-2 ring-emerald-400/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">🏛️</span>
            <span>雇用保険被保険者資格取得届（様式第2号）</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('health_pension_acquisition')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeDoc === 'health_pension_acquisition'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg ring-2 ring-blue-400/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">🌸</span>
            <span>日本年金機構 健康保険・厚生年金保険 被保険者資格取得届（コード2200様式）</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('health_pension_loss')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeDoc === 'health_pension_loss'
                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg ring-2 ring-rose-400/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">🌸</span>
            <span>日本年金機構 健康保険・厚生年金保険 被保険者資格喪失届（コード2201様式）</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('bonus_report')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeDoc === 'bonus_report'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg ring-2 ring-pink-400/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">🌸</span>
            <span>日本年金機構 被保険者賞与支払届（コード2265様式）</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDoc('tax_withholding')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              activeDoc === 'tax_withholding'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg ring-2 ring-blue-400/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-base">🏛️</span>
            <span>国税庁 令和8年分 給与所得者の扶養控除等申告書</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 px-3">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-[11px] font-bold">原本PDF完全一致・ピクセル座標インスペクター</span>
        </div>
      </div>

      {/* 選択された帳票のインスペクター本体 */}
      {activeDoc === 'spouse_deduction' ? (
        <SpouseDocMasterInspector tenantId={tenantId} />
      ) : activeDoc === 'employment_loss' ? (
        <EmploymentLossDocMasterInspector tenantId={tenantId} />
      ) : activeDoc === 'employment_acquisition' ? (
        <EmploymentAcquisitionDocMasterInspector tenantId={tenantId} />
      ) : activeDoc === 'health_pension_acquisition' ? (
        <HealthPensionAcquisitionDocMasterInspector tenantId={tenantId} />
      ) : activeDoc === 'health_pension_loss' ? (
        <HealthPensionLossDocMasterInspector tenantId={tenantId} />
      ) : activeDoc === 'bonus_report' ? (
        <BonusDocMasterInspector tenantId={tenantId} />
      ) : (
        <TaxDocMasterInspector tenantId={tenantId} />
      )}
    </div>
  );
};

