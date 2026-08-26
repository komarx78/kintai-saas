import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, Printer, FileText, 
  Clock, Loader2 
} from 'lucide-react';

interface UserPayslipViewProps {
  userId: string;
  userName: string;
  tenantId?: string | null;
}

export const UserPayslipView: React.FC<UserPayslipViewProps> = ({ userId, userName, tenantId }) => {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantName, setTenantName] = useState<string>('株式会社');

  useEffect(() => {
    const fetchPayslips = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        if (tenantId) {
          const { data: tData } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
          if (tData?.name) setTenantName(tData.name);
        }

        const { data } = await supabase
          .from('payslips')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'published')
          .order('year_month', { ascending: false });

        if (data && data.length > 0) {
          setPayslips(data);
          setSelectedPayslip(data[0]); // 最新の明細を選択
        } else {
          setPayslips([]);
          setSelectedPayslip(null);
        }
      } catch (e) {
        console.error('Fetch user payslip error:', e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayslips();
  }, [userId, tenantId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 上部ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Web給与明細</h1>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              過去の給与明細書の閲覧・PDFダウンロード・印刷
            </p>
          </div>
        </div>

        {/* 支給月セレクター */}
        {payslips.length > 0 && selectedPayslip && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">支給月度:</label>
            <select
              value={selectedPayslip.id}
              onChange={(e) => {
                const found = payslips.find(p => p.id === e.target.value);
                if (found) setSelectedPayslip(found);
              }}
              className="text-xs font-black p-2 px-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white text-slate-800"
            >
              {payslips.map(p => (
                <option key={p.id} value={p.id}>
                  {p.year_month} 支給分（支給日: {p.payment_date}）
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              印刷 / PDF保存
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center gap-3 border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-bold text-slate-400">給与明細を読み込み中...</span>
        </div>
      ) : !selectedPayslip ? (
        <div className="bg-white rounded-2xl p-16 text-center space-y-3 border border-slate-200 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-black text-slate-700 text-sm">
            公開されている給与明細がありません
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            管理者が給与明細を発行・公開すると、ここに月ごとの明細書が表示されます。
          </p>
        </div>
      ) : (
        /* 給与明細書（公式レイアウト） */
        <div id="user-payslip-print-area" className="bg-white rounded-2xl border border-slate-300 shadow-lg p-6 sm:p-10 max-w-3xl mx-auto space-y-6 font-sans">
          
          {/* 明細書ヘッダー */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
            <div>
              <h2 className="text-2xl font-black tracking-wider text-slate-900">
                給 与 明 細 書
              </h2>
              <p className="text-xs font-bold text-slate-500 mt-1">
                {selectedPayslip.year_month} 支給分（支給日: {selectedPayslip.payment_date}）
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-800">{tenantName}</div>
              <div className="text-base font-black text-slate-900 mt-1">
                {userName} 様
              </div>
            </div>
          </div>

          {/* 手取りハイライトカード */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-2 border-emerald-400 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div>
              <span className="text-xs font-bold text-emerald-800 block">差引支給額（手取り額）</span>
              <span className="text-xs text-slate-500">※ご指定の口座へお振込みいたします</span>
            </div>
            <span className="text-3xl font-black text-emerald-700">
              ¥{selectedPayslip.net_salary?.toLocaleString()}
            </span>
          </div>

          {/* 3ブロック表（勤怠・支給・控除） */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* 勤怠 */}
            <div className="border border-slate-300 rounded-xl p-4 space-y-2 bg-slate-50/50">
              <h4 className="font-black text-slate-800 border-b border-slate-300 pb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" /> ① 勤怠実績
              </h4>
              <div className="flex justify-between py-0.5"><span>就労日数:</span><strong>{selectedPayslip.work_days} 日</strong></div>
              <div className="flex justify-between py-0.5"><span>実働時間:</span><strong>{selectedPayslip.actual_hours} 時間</strong></div>
              <div className="flex justify-between py-0.5 text-amber-700"><span>残業時間:</span><strong>{selectedPayslip.overtime_hours} 時間</strong></div>
              <div className="flex justify-between py-0.5 text-emerald-700"><span>有給取得:</span><strong>{selectedPayslip.paid_leave_days} 日</strong></div>
              {selectedPayslip.absence_days > 0 && (
                <div className="flex justify-between py-0.5 text-rose-700"><span>欠勤日数:</span><strong>{selectedPayslip.absence_days} 日</strong></div>
              )}
            </div>

            {/* 支給 */}
            <div className="border border-slate-300 rounded-xl p-4 space-y-2 bg-blue-50/30">
              <h4 className="font-black text-blue-900 border-b border-blue-200 pb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-blue-600" /> ② 支給の部
              </h4>
              <div className="flex justify-between py-0.5"><span>基本給:</span><strong>¥{selectedPayslip.base_salary?.toLocaleString()}</strong></div>
              <div className="flex justify-between py-0.5"><span>残業手当:</span><strong>¥{selectedPayslip.overtime_allowance?.toLocaleString()}</strong></div>
              <div className="flex justify-between py-0.5"><span>通勤手当:</span><strong>¥{selectedPayslip.commuting_allowance?.toLocaleString()}</strong></div>
              {selectedPayslip.position_allowance > 0 && (
                <div className="flex justify-between py-0.5"><span>役職手当:</span><strong>¥{selectedPayslip.position_allowance?.toLocaleString()}</strong></div>
              )}
              {selectedPayslip.housing_allowance > 0 && (
                <div className="flex justify-between py-0.5"><span>住宅手当:</span><strong>¥{selectedPayslip.housing_allowance?.toLocaleString()}</strong></div>
              )}
              <div className="flex justify-between border-t border-blue-300 pt-1.5 font-black text-blue-900 text-sm">
                <span>総支給額:</span><span>¥{selectedPayslip.total_earnings?.toLocaleString()}</span>
              </div>
            </div>

            {/* 控除 */}
            <div className="border border-slate-300 rounded-xl p-4 space-y-2 bg-rose-50/30">
              <h4 className="font-black text-rose-900 border-b border-rose-200 pb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-rose-600" /> ③ 控除の部
              </h4>
              <div className="flex justify-between py-0.5"><span>健康保険:</span><strong>¥{selectedPayslip.health_insurance?.toLocaleString()}</strong></div>
              <div className="flex justify-between py-0.5"><span>厚生年金:</span><strong>¥{selectedPayslip.pension_insurance?.toLocaleString()}</strong></div>
              <div className="flex justify-between py-0.5"><span>雇用保険:</span><strong>¥{selectedPayslip.employment_insurance?.toLocaleString()}</strong></div>
              <div className="flex justify-between py-0.5"><span>所得税:</span><strong>¥{selectedPayslip.income_tax?.toLocaleString()}</strong></div>
              <div className="flex justify-between py-0.5"><span>住民税:</span><strong>¥{selectedPayslip.resident_tax?.toLocaleString()}</strong></div>
              <div className="flex justify-between border-t border-rose-300 pt-1.5 font-black text-rose-900 text-sm">
                <span>控除合計:</span><span>-¥{selectedPayslip.total_deductions?.toLocaleString()}</span>
              </div>
            </div>

          </div>

          {/* 備考 */}
          {selectedPayslip.note && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <span className="font-bold block text-slate-500 mb-0.5">会社からの連絡事項・備考:</span>
              {selectedPayslip.note}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
