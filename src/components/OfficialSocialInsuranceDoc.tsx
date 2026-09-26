import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import { OfficialHealthPensionAcquisitionDoc } from './OfficialHealthPensionAcquisitionDoc';
import { OfficialHealthPensionLossDoc } from './OfficialHealthPensionLossDoc';

export interface SocialInsuranceEmployee {
  id: string;
  name: string;
  name_kana?: string;
  last_name?: string;
  first_name?: string;
  last_name_kana?: string;
  first_name_kana?: string;
  birth_date?: string;
  gender?: string;
  my_number?: string;
  basic_pension_number?: string;
  insurance_number?: string; // 被保険者整理番号
  join_date: string;
  retirement_date?: string;
  base_salary: number;
  monthly_remuneration?: number; // 報酬月額（通貨）
  goods_remuneration?: number; // 報酬月額（現物）
  dependents_count?: number;
  employment_type?: string;
  address?: string;
  address_kana?: string;
  zip_code?: string;
}

export interface OfficialSocialInsuranceDocProps {
  type: 'acquisition' | 'loss'; // acquisition: 資格取得届, loss: 資格喪失届
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
    zip_code?: string;
  };
  officeSymbol?: string; // 事業所整理記号 (例: 01-イロハ)
  officeNumber?: string; // 事業所番号 (例: 12345)
  employees: SocialInsuranceEmployee[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  onBack: () => void;
  tenantId?: string;
}

export const OfficialSocialInsuranceDoc: React.FC<OfficialSocialInsuranceDocProps> = ({
  type: initialType,
  companyInfo,
  officeSymbol = '01-イロハ',
  officeNumber = '12345',
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack,
  tenantId
}) => {
  const [docType, setDocType] = useState<'acquisition' | 'loss'>(initialType);
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
        console.warn('Failed to resolve tenant in OfficialSocialInsuranceDoc:', e);
      }
    };
    resolveTenant();
  }, [tenantId]);
  const currentEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  if (!currentEmployee) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 font-bold text-sm">対象の従業員データが見つかりません。</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 画面上部ナビゲーションバー（印刷時は非表示） */}
      <div className="print:hidden bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition cursor-pointer"
            title="戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                日本年金機構 / 協会けんぽ公式届出
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {docType === 'acquisition' ? '様式コード2200（原本直接入力＆印字）' : '資格喪失届（公的様式）'}
              </span>
            </div>
            <h2 className="text-base font-black text-slate-800 mt-0.5">
              健康保険・厚生年金保険 {docType === 'acquisition' ? '被保険者資格取得届' : '被保険者資格喪失届'}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 書式種別切替タブ */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setDocType('acquisition')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'acquisition' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              資格取得届（公式原本）
            </button>
            <button
              onClick={() => setDocType('loss')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'loss' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              資格喪失届（退職等）
            </button>
          </div>

        </div>
      </div>

      {/* 資格取得届（日本年金機構 原本直接入力＆印字） または 資格喪失届 */}
      {docType === 'acquisition' ? (
        <OfficialHealthPensionAcquisitionDoc
          companyInfo={companyInfo}
          officeSymbol={officeSymbol}
          officeNumber={officeNumber}
          employees={employees as any}
          selectedEmployeeId={currentEmployee.id}
          onSelectEmployee={onSelectEmployee}
          onBack={onBack}
          hideHeader={false}
          tenantId={resolvedTenantId}
        />
      ) : (
        <OfficialHealthPensionLossDoc
          companyInfo={companyInfo}
          officeSymbol={officeSymbol}
          officeNumber={officeNumber}
          employees={employees as any}
          selectedEmployeeId={currentEmployee.id}
          onSelectEmployee={onSelectEmployee}
          onBack={onBack}
          hideHeader={false}
          tenantId={resolvedTenantId}
        />
      )}
    </div>
  );
};
