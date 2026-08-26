import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, Printer, FileText, Loader2 
} from 'lucide-react';
import { OfficialPayslipDoc } from './OfficialPayslipDoc';

interface UserPayslipViewProps {
  userId: string;
  userName: string;
  tenantId?: string | null;
}

export const UserPayslipView: React.FC<UserPayslipViewProps> = ({ userId, userName, tenantId }) => {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantName, setTenantName] = useState<string>('株式会社cocotte');

  useEffect(() => {
    const fetchPayslips = async () => {
      setIsLoading(true);
      try {
        if (tenantId) {
          const { data: tData } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
          if (tData?.name) setTenantName(tData.name);
        }

        let combined: any[] = [];

        // 1. Supabaseから取得
        if (userId) {
          try {
            const { data } = await supabase
              .from('payslips')
              .select('*')
              .eq('user_id', userId)
              .eq('status', 'published')
              .order('year_month', { ascending: false });

            if (data && data.length > 0) {
              combined = [...data];
            }
          } catch (dbErr) {
            console.warn('Supabase fetch note:', dbErr);
          }
        }

        // 2. LocalStorageから取得＆マージ
        const localKey = tenantId ? `mf_payslips_${tenantId}` : 'mf_payslips_default';
        const storedLocal = localStorage.getItem(localKey);
        if (storedLocal) {
          try {
            const parsedLocal: any[] = JSON.parse(storedLocal);
            // 自分のIDまたは名前でフィルタ
            const myLocal = parsedLocal.filter(p => 
              (userId && p.user_id === userId) ||
              (userName && p.employee_name && p.employee_name.replace(/\s+/g, '') === userName.replace(/\s+/g, '')) ||
              (userName && p.user?.name && p.user.name.replace(/\s+/g, '') === userName.replace(/\s+/g, ''))
            );

            myLocal.forEach(lp => {
              if (!combined.some(cp => cp.year_month === lp.year_month)) {
                combined.push(lp);
              }
            });
          } catch (e) {
            console.error('LocalStorage parse error:', e);
          }
        }

        combined.sort((a, b) => (b.year_month || '').localeCompare(a.year_month || ''));

        if (combined.length > 0) {
          setPayslips(combined);
          setSelectedPayslip(combined[0]); // 最新の明細を選択
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
  }, [userId, userName, tenantId]);

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
              マネーフォワード給与公式フォーマット準拠・PDFダウンロード・印刷
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
        /* マネーフォワード給与公式フォーマット 給与明細書 */
        <div id="user-payslip-print-area" className="bg-white rounded-2xl border border-slate-300 shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
          <OfficialPayslipDoc
            payslip={selectedPayslip}
            userName={userName}
            tenantName={tenantName}
          />
        </div>
      )}

    </div>
  );
};
