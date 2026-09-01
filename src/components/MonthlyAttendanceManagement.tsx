import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, Download, ChevronLeft, ChevronRight, Users, Loader2, 
  FileText, ArrowLeft, Edit3, X, CheckCircle, AlertCircle
} from 'lucide-react';

interface MonthlyAttendanceManagementProps {
  tenantId: string | null;
  onRefreshRequests?: () => Promise<void>;
}

export const MonthlyAttendanceManagement: React.FC<MonthlyAttendanceManagementProps> = ({ tenantId, onRefreshRequests }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [users, setUsers] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  
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
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

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

        // 3. 当月の全申請（申請中・承認・却下）を取得
        const { data: reqData } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('tenant_id', tenantId)
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

  // 申請の承認処理（打刻修正はattendance_recordsにも自動反映）
  const handleApproveRequest = async (req: any) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: '承認' })
        .eq('id', req.id);

      if (error) throw error;

      // シフト希望申請の場合、shifts テーブルへ確定シフトを一括自動投入！
      if (req.type === 'シフト希望') {
        const match = req.reason?.match(/【シフトデータ:\s*(\[.+\])】/s);
        if (match) {
          try {
            const shiftArr = JSON.parse(match[1]);
            const upsertRows = shiftArr.map((item: any) => {
              const isHoli = Boolean(item.isHoliday);
              return {
                tenant_id: req.tenant_id || tenantId,
                user_id: req.user_id,
                work_date: item.date,
                start_time: isHoli ? '00:00:00' : (item.startTime || '09:00:00'),
                end_time: isHoli ? '00:00:00' : (item.endTime || '18:00:00'),
                break_minutes: isHoli ? 0 : 60
              };
            });

            // shiftsテーブルへ投入（start_time/end_timeのNOT NULL制約に対応）
            const { error: shiftErr } = await supabase
              .from('shifts')
              .upsert(upsertRows, { onConflict: 'user_id,work_date' });

            if (shiftErr) {
              console.warn('Shifts upsert notice:', shiftErr);
            }
          } catch (pe) {
            console.error('Parse shift data error:', pe);
          }
        }
      }

      // 打刻修正申請の場合、attendance_records に打刻時刻を自動反映
      if (req.type === '打刻修正' && req.start_date) {
        const reasonText = req.reason || '';
        const punchTypeMatch = reasonText.match(/【修正区分:\s*([^】]+)】/);
        const punchTimeMatch = reasonText.match(/【修正時刻:\s*([^】]+)】/);

        const pType = punchTypeMatch ? punchTypeMatch[1].trim() : '';
        const pTime = punchTimeMatch ? punchTimeMatch[1].trim() : '';
        const targetDate = req.start_date;

        if (pType && pTime) {
          const { data: existRec } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('tenant_id', req.tenant_id || tenantId)
            .eq('user_id', req.user_id)
            .eq('date', targetDate)
            .maybeSingle();

          if (existRec) {
            const updatePayload: any = {};
            if (pType === '出勤') updatePayload.check_in_time = pTime;
            if (pType === '退勤') {
              updatePayload.check_out_time = pTime;
              updatePayload.status = '退勤済';
            }
            await supabase
              .from('attendance_records')
              .update(updatePayload)
              .eq('id', existRec.id);
          } else {
            const insertPayload: any = {
              tenant_id: req.tenant_id || tenantId,
              user_id: req.user_id,
              date: targetDate,
              status: pType === '退勤' ? '退勤済' : '勤務中'
            };
            if (pType === '出勤') insertPayload.check_in_time = pTime;
            if (pType === '退勤') insertPayload.check_out_time = pTime;

            await supabase
              .from('attendance_records')
              .insert(insertPayload);
          }
        }
      }

      showToast(`🎉 ${req.type}申請を承認し、反映しました！`);
      await fetchData();
      if (onRefreshRequests) await onRefreshRequests();
    } catch (err: any) {
      console.error('Error approving request:', err);
      alert('承認処理に失敗しました: ' + err.message);
    }
  };

  // 申請の却下処理
  const handleRejectRequest = async (req: any) => {
    if (!confirm('この申請を却下しますか？')) return;
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: '却下' })
        .eq('id', req.id);

      if (error) throw error;

      showToast(`申請を却下しました`);
      await fetchData();
      if (onRefreshRequests) await onRefreshRequests();
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      alert('却下処理に失敗しました: ' + err.message);
    }
  };

  // 全件一括承認
  const handleBulkApprove = async () => {
    const pendingList = leaveRequests.filter(r => r.status === '申請中');
    if (pendingList.length === 0) return;
    if (!confirm(`未承認の申請 ${pendingList.length} 件を一括承認しますか？`)) return;

    setIsBulkApproving(true);
    try {
      for (const req of pendingList) {
        await supabase
          .from('leave_requests')
          .update({ status: '承認' })
          .eq('id', req.id);

        if (req.type === '打刻修正' && req.start_date) {
          const reasonText = req.reason || '';
          const punchTypeMatch = reasonText.match(/【修正区分:\s*([^】]+)】/);
          const punchTimeMatch = reasonText.match(/【修正時刻:\s*([^】]+)】/);
          const pType = punchTypeMatch ? punchTypeMatch[1].trim() : '';
          const pTime = punchTimeMatch ? punchTimeMatch[1].trim() : '';
          const targetDate = req.start_date;

          if (pType && pTime) {
            const { data: existRec } = await supabase
              .from('attendance_records')
              .select('*')
              .eq('tenant_id', req.tenant_id || tenantId)
              .eq('user_id', req.user_id)
              .eq('date', targetDate)
              .maybeSingle();

            if (existRec) {
              const updatePayload: any = {};
              if (pType === '出勤') updatePayload.check_in_time = pTime;
              if (pType === '退勤') {
                updatePayload.check_out_time = pTime;
                updatePayload.status = '退勤済';
              }
              await supabase.from('attendance_records').update(updatePayload).eq('id', existRec.id);
            } else {
              const insertPayload: any = {
                tenant_id: req.tenant_id || tenantId,
                user_id: req.user_id,
                date: targetDate,
                status: pType === '退勤' ? '退勤済' : '勤務中'
              };
              if (pType === '出勤') insertPayload.check_in_time = pTime;
              if (pType === '退勤') insertPayload.check_out_time = pTime;
              await supabase.from('attendance_records').insert(insertPayload);
            }
          }
        }
      }

      showToast(`⚡ ${pendingList.length} 件の申請を一括承認しました！`);
      await fetchData();
      if (onRefreshRequests) await onRefreshRequests();
    } catch (e: any) {
      console.error(e);
      alert('一括承認中にエラーが発生しました: ' + e.message);
    } finally {
      setIsBulkApproving(false);
    }
  };

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

    const approvedLeaves = userLeaves.filter(l => l.status === '承認');
    const pendingRequests = userLeaves.filter(l => l.status === '申請中');

    const paidLeaveDays = approvedLeaves.reduce((acc, req) => {
      if (req.type?.includes('半休')) return acc + 0.5;
      if (req.type?.includes('有給')) return acc + 1.0;
      return acc;
    }, 0);

    return {
      totalDays,
      totalHours: (totalActualMins / 60).toFixed(1),
      overtimeHours: (totalOvertimeMins / 60).toFixed(1),
      paidLeaveDays,
      missedPunchCount,
      pendingRequestsCount: pendingRequests.length
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

    // シフト希望（月間一括申請）のパース
    const monthlyShiftReq = userLeaves.find(l => l.status === '申請中' && l.type === 'シフト希望');
    let shiftDataMap: Record<string, { isHoliday: boolean; startTime: string | null; endTime: string | null }> = {};
    if (monthlyShiftReq && monthlyShiftReq.reason) {
      const match = monthlyShiftReq.reason.match(/【シフトデータ:\s*(\[.+\])】/s);
      if (match) {
        try {
          const arr = JSON.parse(match[1]);
          arr.forEach((item: any) => {
            shiftDataMap[item.date] = {
              isHoliday: item.isHoliday ?? false,
              startTime: item.startTime,
              endTime: item.endTime
            };
          });
        } catch (e) {}
      }
    }

    const rows = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const record = userRecords.find(r => r.date === dateStr);
      
      // 当日の通常申請（シフト希望以外）を取得
      const dayPendingRequests = userLeaves.filter(l => 
        l.status === '申請中' && 
        l.type !== 'シフト希望' && 
        l.start_date <= dateStr && 
        (l.end_date ? l.end_date >= dateStr : l.start_date >= dateStr)
      );

      // 当日のシフト希望データ
      const dayShiftData = shiftDataMap[dateStr] || null;

      const dayApprovedLeave = userLeaves.find(l => 
        l.status === '承認' && 
        l.type !== 'シフト希望' && 
        l.start_date <= dateStr && 
        (l.end_date ? l.end_date >= dateStr : l.start_date >= dateStr)
      );

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
        approvedLeave: dayApprovedLeave,
        pendingRequests: dayPendingRequests,
        dayShiftData,
        monthlyShiftReq,
        checkIn: record?.check_in_time || '-',
        checkOut: record?.check_out_time || '-',
        actualStr,
        overtimeStr,
        overtimeMins,
        status: record?.status || (dayApprovedLeave ? dayApprovedLeave.type : '-'),
        note: record?.note || dayApprovedLeave?.reason || ''
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

  // 全社未承認申請リスト
  const allPendingRequests = useMemo(() => {
    return leaveRequests
      .filter(r => r.status === '申請中')
      .map(r => ({
        ...r,
        user: users.find(u => u.id === r.user_id)
      }));
  }, [leaveRequests, users]);

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

      {/* 🔔 未承認申請クイック確認＆一括承認バナー */}
      {allPendingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 border-2 border-amber-300 rounded-2xl p-5 shadow-sm space-y-3 print:hidden animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <h3 className="text-sm font-black text-amber-950 flex items-center gap-1.5">
                🔔 未承認の申請が <span className="text-base text-amber-700 font-black">{allPendingRequests.length}</span> 件あります
              </h3>
              <span className="text-xs text-amber-700/80 font-bold hidden md:inline">
                （打刻修正・有給休暇など）
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md shadow-amber-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {isBulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              全 {allPendingRequests.length} 件を一括承認する
            </button>
          </div>

          {/* 申請カード一覧 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {allPendingRequests.map(req => {
              const isShift = req.type === 'シフト希望';
              const shiftTitleMatch = isShift ? req.reason?.match(/【([^】]+シフト希望提出[^】]*)】/) : null;
              const displayText = isShift ? (shiftTitleMatch ? shiftTitleMatch[1] : '月間シフト希望提出') : (req.reason || '（理由なし）');

              return (
                <div key={req.id} className="bg-white/95 border border-amber-200/80 rounded-xl p-3 shadow-2xs flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserId(req.user_id);
                          setViewMode('individual');
                        }}
                        className="font-black text-xs text-slate-900 hover:text-blue-600 underline cursor-pointer"
                        title="このスタッフの出勤簿を開く"
                      >
                        {req.user?.name || '従業員'}
                      </button>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${isShift ? 'bg-indigo-100 text-indigo-900 border-indigo-300' : 'bg-amber-100 text-amber-900 border-amber-300'}`}>
                        {req.type}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                      対象期間: {req.start_date} {req.end_date && req.end_date !== req.start_date ? `〜 ${req.end_date}` : ''}
                    </div>
                    <div className={`text-xs mt-1 ${isShift ? 'font-bold text-indigo-950 bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100' : 'text-slate-700 line-clamp-2'}`}>
                      {displayText}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleApproveRequest(req)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg shadow-2xs transition cursor-pointer"
                    >
                      ✓ 承認
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectRequest(req)}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      ✗ 却下
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                      <th className="p-4 text-center">各種申請</th>
                      <th className="p-4 text-center w-36">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-12 text-center text-slate-400 font-bold">
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
                            {summary.pendingRequestsCount > 0 ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs animate-pulse">
                                🟡 申請中 {summary.pendingRequestsCount}件
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
                    {selectedUserSummary.pendingRequestsCount > 0 && (
                      <div className="bg-amber-50 border border-amber-300 px-3.5 py-2 rounded-xl text-center animate-pulse">
                        <div className="text-[11px] font-bold text-amber-700">申請中</div>
                        <div className="text-lg font-black text-amber-900">{selectedUserSummary.pendingRequestsCount}<span className="text-xs font-normal ml-0.5">件</span></div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 選択中従業員の月間シフト希望一括申請カード（申請中がある場合のみ表示） */}
              {(() => {
                const shiftReq = selectedUserRows[0]?.monthlyShiftReq;
                if (!shiftReq) return null;
                const matchSummary = shiftReq.reason?.match(/【([^】]+シフト希望提出[^】]*)】/);
                const summaryTitle = matchSummary ? matchSummary[1] : '月度 シフト希望提出';

                return (
                  <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-md border border-indigo-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-top-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-400 text-slate-950 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                          🗓️ シフト希望 申請中
                        </span>
                        <span className="text-xs text-indigo-200">
                          {selectedUser?.name} さんからの月間シフト提出
                        </span>
                      </div>
                      <h4 className="text-base font-black text-white">
                        {summaryTitle}（{shiftReq.start_date} 〜 {shiftReq.end_date}）
                      </h4>
                      <details className="text-xs text-indigo-200 mt-1 cursor-pointer">
                        <summary className="font-bold text-amber-300 hover:text-amber-200 select-none">
                          ▼ 提出されたシフト希望の内訳を展開
                        </summary>
                        <div className="mt-2 text-[11px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-950/80 p-3 rounded-xl border border-indigo-800 text-indigo-100">
                          {shiftReq.reason?.split('【シフトデータ')[0] || shiftReq.reason}
                        </div>
                      </details>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveRequest(shiftReq)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-1.5 text-xs cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        このシフトを承認・確定する
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectRequest(shiftReq)}
                        className="bg-white/10 hover:bg-rose-500/20 text-rose-300 border border-rose-400/30 font-bold px-3 py-2.5 rounded-xl transition text-xs cursor-pointer"
                      >
                        却下
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 1日〜末日 タイムカードテーブル */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    {selectedUser?.name} さんの月間出勤簿明細（{currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月）
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    ※申請中の項目はその場で「承認」「却下」できます
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[950px]">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-xs font-black text-slate-600 uppercase">
                        <th className="p-3.5 w-28">日付</th>
                        <th className="p-3.5 w-28">出勤打刻</th>
                        <th className="p-3.5 w-28">退勤打刻</th>
                        <th className="p-3.5 text-right w-24">実働時間</th>
                        <th className="p-3.5 text-right w-24">残業時間</th>
                        <th className="p-3.5">事由・申請・備考</th>
                        <th className="p-3.5 text-center w-36">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {selectedUserRows.map(row => {
                        let dateColorClass = "text-slate-900";
                        let rowBgClass = "hover:bg-blue-50/20";
                        const hasPending = (row.pendingRequests && row.pendingRequests.length > 0) || !!row.dayShiftData;

                        if (hasPending) {
                          rowBgClass = "bg-amber-50/60 hover:bg-amber-100/60 border-l-4 border-l-amber-500";
                        } else if (row.dayOfWeek === 0) {
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
                            <td className="p-3.5 text-xs text-slate-600">
                              <div className="space-y-1.5">
                                {/* 承認済み休暇バッジ */}
                                {row.approvedLeave && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-block bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold">
                                      ✓ 承認済: {row.approvedLeave.type}
                                    </span>
                                    <span className="text-slate-500">{row.approvedLeave.reason}</span>
                                  </div>
                                )}

                                {/* 当日のシフト希望（スマート1行表示） */}
                                {row.dayShiftData && (
                                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-indigo-900 shadow-2xs font-bold">
                                    <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.2 rounded">
                                      申請中
                                    </span>
                                    <span>
                                      {row.dayShiftData.isHoliday ? (
                                        '公休希望（休み）'
                                      ) : (
                                        `出勤希望: ${row.dayShiftData.startTime || '09:00'}〜${row.dayShiftData.endTime || '18:00'}`
                                      )}
                                    </span>
                                  </div>
                                )}

                                {/* 申請中の通常申請（打刻修正・有給など） */}
                                {row.pendingRequests?.map((pReq: any) => (
                                  <div key={pReq.id} className="flex flex-wrap items-center gap-2 bg-white/90 border border-amber-300 p-1.5 rounded-lg shadow-2xs">
                                    <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                                      申請中
                                    </span>
                                    <span className="font-bold text-slate-800 text-xs">
                                      【{pReq.type}】
                                    </span>
                                    <span className="text-slate-600 text-xs">
                                      {pReq.reason}
                                    </span>
                                    <div className="ml-auto flex items-center gap-1">
                                      <button 
                                        type="button"
                                        onClick={() => handleApproveRequest(pReq)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[11px] font-bold shadow-2xs transition cursor-pointer"
                                      >
                                        ✓ 承認
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => handleRejectRequest(pReq)}
                                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer"
                                      >
                                        ✗ 却下
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {/* 通常備考 */}
                                {row.note && !row.approvedLeave && !hasPending && (
                                  <span className="text-slate-500">{row.note}</span>
                                )}
                                {!row.note && !row.approvedLeave && !hasPending && (
                                  <span className="text-slate-300">-</span>
                                )}
                              </div>
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
