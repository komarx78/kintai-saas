import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ClipboardList, ChevronLeft, ChevronRight, Clock, User, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';


interface ShiftRequest {
  id: string;
  user_id: string;
  target_date: string;
  available_start_time: string;
  available_end_time: string;
  preferred_role: string | null;
  user?: { name: string };
}

const ShiftRequestsView: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  useEffect(() => {
    fetchRequests();
  }, [currentDate]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) return;

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const { data: reqData } = await supabase
        .from('advanced_shift_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('target_date', startDate)
        .lte('target_date', endDate)
        .order('target_date');

      const { data: usersData } = await supabase.from('users').select('id, name').eq('tenant_id', tenantId);
      
      const userMap: Record<string, string> = {};
      (usersData || []).forEach((u: any) => { userMap[u.id] = u.name; });

      setRequests((reqData || []).map((r: any) => ({ ...r, user: { name: userMap[r.user_id] || '不明' } })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDummy = async () => {
    if (!window.confirm('今週分のダミー希望データを大量に生成しますか？\n(オートシフト生成のテスト用です)')) return;
    setGenerating(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      const { data: usersData } = await supabase.from('users').select('id, name').eq('tenant_id', tenantId).eq('has_shift_access', true);
      
      if (!usersData || usersData.length === 0) {
        alert('シフト権限のある一般ユーザーが存在しません！');
        return;
      }

      

            const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      await supabase.from('advanced_shift_requests').delete().eq('tenant_id', tenantId).gte('target_date', startDate).lte('target_date', endDate);
      const dummies = [];
      
      for (let i = 0; i < 7; i++) {
        const targetDate = format(addDays(weekStart, i), 'yyyy-MM-dd');
        
        // ユーザーのうちランダムに何人かピックアップ
        const availableUsers = [...usersData].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 2); // 2〜4人
        
        for (const user of availableUsers) {
          const isMorning = Math.random() > 0.5;
          const start = isMorning ? '09:00:00' : '17:00:00';
          const end = isMorning ? '15:00:00' : '23:00:00';
          

          dummies.push({
            tenant_id: tenantId,
            user_id: user.id,
            target_date: targetDate,
            available_start_time: start,
            available_end_time: end,
            
            status: 'submitted'
          });
        }
      }

            const { error: insertError } = await supabase.from('advanced_shift_requests').insert(dummies);
      if (insertError) {
        console.error("Insert Error:", insertError);
        alert('挿入エラー: ' + insertError.message);
        throw insertError;
      }
      alert(`${dummies.length}件のダミー希望データを生成しました！`);
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert('エラーが発生しました');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/shift/admin')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center">
              <ClipboardList className="w-6 h-6 mr-3 text-indigo-600" />
              提出されたシフト希望一覧
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-2 hover:bg-white rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-bold px-4 text-center">
                {format(weekStart, 'M/d')} - {format(weekEnd, 'M/d')}
              </span>
              <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 hover:bg-white rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <button 
              onClick={handleGenerateDummy}
              disabled={generating}
              className="bg-amber-500 text-white px-4 py-2 rounded-xl flex items-center hover:bg-amber-600 transition shadow-sm font-bold text-sm"
            >
              {generating ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"></div> : <Zap className="w-4 h-4 mr-2" />}
              ダミー希望生成
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold">
              この週のシフト希望はまだ提出されていません。<br/>右上の「ダミー希望生成」ボタンでテストデータを作成できます。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map(req => (
                <div key={req.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center space-x-4">
                    <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-lg">{req.user?.name}</div>
                      <div className="text-sm text-slate-500 flex items-center mt-1">
                        <Clock className="w-4 h-4 mr-1" />
                        {req.target_date} ({req.available_start_time.substring(0,5)} 〜 {req.available_end_time.substring(0,5)})
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftRequestsView;







