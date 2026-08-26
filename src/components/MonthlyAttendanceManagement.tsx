import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Download, ChevronLeft, ChevronRight, Users, Loader2, 
  FileText, ArrowLeft, Edit3, X, CheckCircle, AlertCircle
} from 'lucide-react';

interface MonthlyAttendanceManagementProps {
  tenantId: string | null;
}

export const MonthlyAttendanceManagement: React.FC<MonthlyAttendanceManagementProps> = ({ tenantId }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [users, setUsers] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // viewMode: 'summary' (全社サマリー) | 'individual' (個人別タイムカード)
  const [viewMode, setViewMode] = useState<'summary' | 'individual'>('summary');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // 管理者打刻修正モーダル
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    date: string;
    recordId: string | null;
    checkIn: string;
    checkOut: string;
    status: string;
    note: string;
  }>({
    isOpen: false,
    userId: '',
    userName: '',
    date: '',
    recordId: null,
    checkIn: '',
    checkOut: '',
    status: '退勤済',
    note: ''
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 1. 従業員一覧取得
      const { data: uData } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      const currentUsers = uData || [];
      setUsers(currentUsers);

      if (currentUsers.length > 0) {
        if (!selectedUserId && currentUsers.length > 0) {
          setSelectedUserId(currentUsers[0].id);
        }

        // 2. 当月の打刻レコード取得
        const { data: attData } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('date', startDate)
          .lte('date', endDate);

        setAttendanceRecords(attData || []);

        // 3. 当月の承認済み休暇申請取得
        const { data: reqData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', '承認')
          .gte('start_date', startDate)
          .lte('start_date', endDate);

        setLeaveRequests(reqData || []);
      } else {
        setAttendanceRecords([]);
        setLeaveRequests([]);
      }
    } catch (err) {
      console.error('Monthly attendance fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId, currentMonth]);

  // 前月・次月移動
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const handleCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  // 1人あたりの集計計算ヘルパー
  const calculateUserMonthlySummary = (user: any) => {
    const userRecords = attendanceRecords.filter(r => r.user_id === user.id);
    const userLeaves = leaveRequests.filter(r => r.user_id === user.id);

    let totalDays = 0;
    let totalActualMins = 0;
    let totalOvertimeMins = 0;
    let missedPunchCount = 0;

    userRecords.forEach(r => {
      if (r.check_in_time) {
        totalDays += 1;
        if (r.check_out_time) {
          const [inH, inM] = r.check_in_time.split(':').map(Number);
          const [outH, outM] = r.check_out_time.split(':').map(Number);
          const inTotal = inH * 60 + inM;
          const outTotal = outH * 60 + outM;

          if (outTotal > inTotal) {
            let actual = outTotal - inTotal;
            if (actual >= 360) actual -= 60; // 6時間以上で1時間休憩
            else if (actual >= 240) actual -= 30; // 4時間以上で30分休憩
            actual = Math.max(0, actual);

            totalActualMins += actual;
            if (actual > 480) { // 8時間超過で残業
              totalOvertimeMins += (actual - 480);
            }
          }
        } else {
          missedPunchCount += 1;
        }
      }
    });

    const paidLeaveDays = userLeaves.reduce((acc, req) => {
      if (req.type?.includes('半休')) return acc + 0.5;
      if (req.type?.includes('有給')) return acc + 1.0;
      return acc;
    }, 0);

    return {
      totalDays,
      totalHours: (totalActualMins / 60).toFixed(1),
      overtimeHours: (totalOvertimeMins / 60).toFixed(1),
      paidLeaveDays,
      missedPunchCount
    };
  };

  // 選択中従業員の当月カレンダー行データ生成
  const selectedUserRows = useMemo(() => {
    if (!selectedUserId) return [];
    const user = users.find(u => u.id === selectedUserId);
    if (!user) return [];

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    const userRecords = attendanceRecords.filter(r => r.user_id === selectedUserId);
    const userLeaves = leaveRequests.filter(r => r.user_id === selectedUserId);

    const rows = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const record = userRecords.find(r => r.date === dateStr);
      const leave = userLeaves.find(l => l.start_date <= dateStr && l.end_date >= dateStr);

      let actualStr = '-';
      let overtimeStr = '-';
      let actualMins = 0;
      let overtimeMins = 0;

      if (record?.check_in_time && record?.check_out_time) {
        const [inH, inM] = record.check_in_time.split(':').map(Number);
        const [outH, outM] = record.check_out_time.split(':').map(Number);
        const inTotal = inH * 60 + inM;
        const outTotal = outH * 60 + outM;

        if (outTotal > inTotal) {
          actualMins = outTotal - inTotal;
          if (actualMins >= 360) actualMins -= 60;
          else if (actualMins >= 240) actualMins -= 30;
          actualMins = Math.max(0, actualMins);

          actualStr = `${Math.floor(actualMins / 60)}h ${(actualMins % 60).toString().padStart(2, '0')}m`;

          if (actualMins > 480) {
            overtimeMins = actualMins - 480;
            overtimeStr = `${Math.floor(overtimeMins / 60)}h ${(overtimeMins % 60).toString().padStart(2, '0')}m`;
          }
        }
      }

      rows.push({
        day,
        dateStr,
        dayOfWeekStr: dayNames[dayOfWeek],
        isWeekend,
        dayOfWeek,
        record,
        leave,
        checkIn: record?.check_in_time || '-',
        checkOut: record?.check_out_time || '-',
        actualStr,
        overtimeStr,
        overtimeMins,
        status: record?.status || (leave ? leave.type : '-'),
        note: record?.note || leave?.reason || ''
      });
    }

    return rows;
  }, [selectedUserId, users, attendanceRecords, leaveRequests, currentMonth]);

  // 打刻編集モーダルを開く
  const handleOpenEditModal = (row: any) => {
    const user = users.find(u => u.id === selectedUserId);
    setEditModal({
      isOpen: true,
      userId: selectedUserId || '',
      userName: user?.name || '',
      date: row.dateStr,
      recordId: row.record?.id || null,
      checkIn: row.record?.check_in_time || '',
      checkOut: row.record?.check_out_time || '',
      status: row.record?.status || '退勤済',
      note: row.record?.note || ''
    });
  };

  // 打刻編集の保存処理
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !editModal.userId || !editModal.date) return;

    try {
      if (editModal.recordId) {
        // 更新
        const { error } = await supabase
          .from('attendance_records')
          .update({
            check_in_time: editModal.checkIn || null,
            check_out_time: editModal.checkOut || null,
            status: editModal.status,
            note: editModal.note || null
          })
          .eq('id', editModal.recordId);
        if (error) throw error;
      } else {
        // 新規登録
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            tenant_id: tenantId,
            user_id: editModal.userId,
            date: editModal.date,
            check_in_time: editModal.checkIn || null,
            check_out_time: editModal.checkOut || null,
            status: editModal.status,
            note: editModal.note || null
          });
        if (error) throw error;
      }

      showToast(`💾 ${editModal.date} の打刻データを保存しました！`);
      setEditModal(prev => ({ ...prev, isOpen: false }));
      await fetchData();
    } catch (err: any) {
      console.error('Save attendance record error:', err);
      alert('保存に失敗しました: ' + err.message);
    }
  };

  // 月間勤怠CSVダウンロード
  const handleExportCsv = () => {
    const year = currentMonth.getFullYear();
    const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0');

    if (viewMode === 'summary') {
      const filename = `全社月間勤怠集計_${year}年${month}月.csv`;
      const headers = ['従業員名', '部署', '雇用形態', '出勤日数', '総実働時間(h)', '総残業時間(h)', '有給取得日数', '打刻漏れ'];
      const rows = users.map(u => {
        const s = calculateUserMonthlySummary(u);
        return [
          u.name,
          u.department || '-',
          u.employment_type === 'part-time' ? 'パート' : '正社員',
          s.totalDays,
          s.totalHours,
          s.overtimeHours,
          s.paidLeaveDays,
          s.missedPunchCount
        ];
      });

      const csvContent = [headers, ...rows].map(row => 
        row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
      ).join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`📄 ${filename} をダウンロードしました！`);
    } else {
      const user = users.find(u => u.id === selectedUserId);
      const filename = `出勤簿_${user?.name || '従業員'}_${year}年${month}月.csv`;
      const headers = ['日付', '曜日', '出勤時刻', '退勤時刻', '実働時間', '残業時間', 'ステータス', '備考'];
      const rows = selectedUserRows.map(r => [
        r.dateStr,
        r.dayOfWeekStr,
        r.checkIn,
        r.checkOut,
        r.actualStr,
        r.overtimeStr,
        r.status,
        r.note
      ]);

      const csvContent = [headers, ...rows].map(row => 
        row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
      ).join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`📄 ${filename} をダウンロードしました！`);
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);
  const selectedUserSummary = selectedUser ? calculateUserMonthlySummary(selectedUser) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 上部ヘッダー & ナビゲーション */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">月間勤怠・出勤簿管理</h1>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                全社および各従業員の月別打刻実績・残業集計・タイムカード詳細
              </p>
            </div>
          </div>
        </div>

        {/* 月切り替え & アクション */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 月度セレクター */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button 
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white text-slate-600 rounded-lg transition shadow-2xs cursor-pointer"
              title="前月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-black text-slate-800 tracking-tight">
              {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月度
            </span>
            <button 
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white text-slate-600 rounded-lg transition shadow-2xs cursor-pointer"
              title="次月"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              onClick={handleCurrentMonth}
              className="ml-1 text-[11px] font-bold bg-white text-blue-600 border border-slate-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition cursor-pointer"
            >
              今月
            </button>
          </div>

          {/* 表示モード切り替え */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button 
              onClick={() => setViewMode('summary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              全社集計
            </button>
            <button 
              onClick={() => setViewMode('individual')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                viewMode === 'individual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              個人別出勤簿
            </button>
          </div>

          {/* CSV出力ボタン */}
          <button 
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 px-3.5 py-2 rounded-xl font-bold text-xs hover:bg-blue-50/50 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-600" /> CSV出力
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center gap-3 border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-bold text-slate-400">勤怠データを集計中...</span>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* VIEW 1: 全社月次サマリー一覧                                               */}
          {/* ========================================================================= */}
          {viewMode === 'summary' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  従業員別 月間勤怠集計（{currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月）
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  全 {users.length} 名の勤務状況
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-black text-slate-600 uppercase tracking-wider">
                      <th className="p-4">従業員名</th>
                      <th className="p-4">部署</th>
                      <th className="p-4">雇用形態</th>
                      <th className="p-4 text-right">出勤日数</th>
                      <th className="p-4 text-right">総実働時間</th>
                      <th className="p-4 text-right">総残業時間</th>
                      <th className="p-4 text-right">有給取得</th>
                      <th className="p-4 text-center">打刻エラー</th>
                      <th className="p-4 text-center w-36">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-slate-400 font-bold">
                          登録されている従業員がいません
                        </td>
                      </tr>
                    ) : users.map(user => {
                      const summary = calculateUserMonthlySummary(user);
                      const overtimeNum = parseFloat(summary.overtimeHours);

                      return (
                        <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center">
                                {user.name.substring(0, 1)}
                              </div>
                              <span className="font-bold text-slate-900 text-sm">{user.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-600">{user.department || '-'}</td>
                          <td className="p-4 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              user.employment_type === 'part-time' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {user.employment_type === 'part-time' ? 'パート' : '正社員'}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-slate-800 text-sm">{summary.totalDays} 日</td>
                          <td className="p-4 text-right font-black text-slate-800 text-sm">{summary.totalHours} 時間</td>
                          <td className="p-4 text-right font-black text-sm">
                            {overtimeNum > 0 ? (
                              <span className={overtimeNum >= 45 ? 'text-red-600 font-black' : 'text-amber-600 font-black'}>
                                {summary.overtimeHours} 時間
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">0.0 時間</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-700 text-sm">{summary.paidLeaveDays} 日</td>
                          <td className="p-4 text-center">
                            {summary.missedPunchCount > 0 ? (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-xs font-black animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {summary.missedPunchCount}件
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => {
                                setSelectedUserId(user.id);
                                setViewMode('individual');
                              }}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              出勤簿を見る ➔
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: 個人別タイムカード・出勤簿                                         */}
          {/* ========================================================================= */}
          {viewMode === 'individual' && (
            <div className="space-y-6">
              
              {/* スタッフ切り替えバー & 個人サマリーカード */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setViewMode('summary')}
                    className="p-2 hover:bg-slate-100 text-slate-600 rounded-xl transition border border-slate-200 cursor-pointer"
                    title="全社一覧に戻る"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400">表示中の従業員</label>
                    <select 
                      value={selectedUserId || ''} 
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="mt-0.5 text-base font-black text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.department || '部署なし'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 個人月次集計カード */}
                {selectedUserSummary && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-blue-50/70 border border-blue-100 px-3.5 py-2 rounded-xl text-center">
                      <div className="text-[11px] font-bold text-blue-600">出勤日数</div>
                      <div className="text-lg font-black text-blue-900">{selectedUserSummary.totalDays}<span className="text-xs font-normal ml-0.5">日</span></div>
                    </div>
                    <div className="bg-indigo-50/70 border border-indigo-100 px-3.5 py-2 rounded-xl text-center">
                      <div className="text-[11px] font-bold text-indigo-600">総実働時間</div>
                      <div className="text-lg font-black text-indigo-900">{selectedUserSummary.totalHours}<span className="text-xs font-normal ml-0.5">h</span></div>
                    </div>
                    <div className="bg-rose-50/70 border border-rose-100 px-3.5 py-2 rounded-xl text-center">
                      <div className="text-[11px] font-bold text-rose-600">総残業時間</div>
                      <div className="text-lg font-black text-rose-900">{selectedUserSummary.overtimeHours}<span className="text-xs font-normal ml-0.5">h</span></div>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-100 px-3.5 py-2 rounded-xl text-center">
                      <div className="text-[11px] font-bold text-amber-600">有給取得</div>
                      <div className="text-lg font-black text-amber-900">{selectedUserSummary.paidLeaveDays}<span className="text-xs font-normal ml-0.5">日</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 1日〜末日 タイムカードテーブル */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    {selectedUser?.name} さんの月間出勤簿明細（{currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月）
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    ※各行の「編集」ボタンから管理者が打刻時間を直接修正できます
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[850px]">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-black text-slate-600 uppercase">
                        <th className="p-3.5 w-28">日付</th>
                        <th className="p-3.5 w-28">出勤打刻</th>
                        <th className="p-3.5 w-28">退勤打刻</th>
                        <th className="p-3.5 text-right w-28">実働時間</th>
                        <th className="p-3.5 text-right w-28">残業時間</th>
                        <th className="p-3.5">事由・備考</th>
                        <th className="p-3.5 text-center w-28">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {selectedUserRows.map(row => {
                        let dateColorClass = "text-slate-900";
                        let rowBgClass = "hover:bg-blue-50/20";
                        if (row.dayOfWeek === 0) {
                          dateColorClass = "text-red-500 font-bold";
                          rowBgClass = "bg-red-50/20 hover:bg-red-50/40";
                        } else if (row.dayOfWeek === 6) {
                          dateColorClass = "text-blue-500 font-bold";
                          rowBgClass = "bg-blue-50/20 hover:bg-blue-50/40";
                        }

                        return (
                          <tr key={row.day} className={`transition-colors ${rowBgClass}`}>
                            <td className={`p-3.5 whitespace-nowrap text-xs ${dateColorClass}`}>
                              {(currentMonth.getMonth() + 1).toString().padStart(2, '0')}/{row.day.toString().padStart(2, '0')} ({row.dayOfWeekStr})
                            </td>
                            <td className="p-3.5 font-bold text-slate-800 text-xs">
                              {row.checkIn !== '-' ? (
                                <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">{row.checkIn}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-3.5 font-bold text-slate-800 text-xs">
                              {row.checkOut !== '-' ? (
                                <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200">{row.checkOut}</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-3.5 text-right font-medium text-slate-700 text-xs">{row.actualStr}</td>
                            <td className={`p-3.5 text-right font-bold text-xs ${row.overtimeMins > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                              {row.overtimeStr}
                            </td>
                            <td className="p-3.5 text-xs text-slate-500">
                              {row.leave && (
                                <span className="mr-2 inline-block bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">
                                  {row.leave.type}
                                </span>
                              )}
                              {row.note || '-'}
                            </td>
                            <td className="p-3.5 text-center">
                              <button 
                                onClick={() => handleOpenEditModal(row)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3 text-slate-500" /> 編集
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* 管理者用 打刻編集モーダル */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">{editModal.userName} の打刻修正</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">対象日: {editModal.date}</p>
              </div>
              <button 
                onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">出勤時刻</label>
                  <input 
                    type="time" 
                    value={editModal.checkIn} 
                    onChange={e => setEditModal({ ...editModal, checkIn: e.target.value })} 
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">退勤時刻</label>
                  <input 
                    type="time" 
                    value={editModal.checkOut} 
                    onChange={e => setEditModal({ ...editModal, checkOut: e.target.value })} 
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">ステータス</label>
                <select 
                  value={editModal.status} 
                  onChange={e => setEditModal({ ...editModal, status: e.target.value })} 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm bg-white"
                >
                  <option value="退勤済">退勤済（通常勤務）</option>
                  <option value="勤務中">勤務中</option>
                  <option value="有給">有給休暇</option>
                  <option value="代休">代休</option>
                  <option value="欠勤">欠勤</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">事由・備考</label>
                <input 
                  type="text" 
                  value={editModal.note} 
                  onChange={e => setEditModal({ ...editModal, note: e.target.value })} 
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-xs" 
                  placeholder="管理者による修正理由など" 
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))} 
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2 text-sm font-bold animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

    </div>
  );
};
