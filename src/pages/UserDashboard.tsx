import { useState, useEffect } from 'react';
import { Clock, Calendar, LogOut, FileText, CheckCircle, UserCheck, XCircle, ChevronLeft, ChevronRight, Settings, Bot, ArrowLeft, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RulesAiAssistant } from '../components/RulesAiAssistant';
import { UserPayslipView } from '../components/UserPayslipView';
import AppSwitcher from '../components/AppSwitcher';
import { HelpGuideModal } from '../components/HelpGuideModal';

const UserDashboard = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState('未出勤'); // 未出勤, 勤務中, 退勤済
  const [activeTab, setActiveTab] = useState('home');
  const [viewMonth, setViewMonth] = useState(new Date()); // 現在の月に変更
  const [user, setUser] = useState<any>(null);
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [monthlyRecords, setMonthlyRecords] = useState<any[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [companyHolidays, setCompanyHolidays] = useState<Set<string>>(new Set());
  const [roundingUnit, setRoundingUnit] = useState<number>(15);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchUserAndStatus = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
        setUser(profile);

        // 今日の打刻データを取得
        const today = new Date().toLocaleDateString('en-CA');
        const { data: record } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('date', today)
          .maybeSingle();
          
        if (record) {
          setCurrentRecord(record);
          if (record.check_out_time) setStatus('退勤済');
          else if (record.check_in_time) setStatus('勤務中');
        }

        // 🏢 会社カレンダー休日設定 ＆ 打刻丸め単位のDB自動同期（全端末完全共有）
        if (profile?.tenant_id) {
          // 初期ローカルキャッシュ復元
          const storedHols = localStorage.getItem(`mock_company_holidays_${profile.tenant_id}`) || localStorage.getItem('mock_company_holidays');
          if (storedHols) {
            try { setCompanyHolidays(new Set(JSON.parse(storedHols))); } catch (_) {}
          }
          const storedRound = localStorage.getItem(`mock_rounding_unit_${profile.tenant_id}`) || localStorage.getItem('mock_rounding_unit');
          if (storedRound) setRoundingUnit(parseInt(storedRound));

          try {
            const { data: tData } = await supabase
              .from('tenants')
              .select('work_calendar_settings, payroll_common_settings')
              .eq('id', profile.tenant_id)
              .maybeSingle();

            if (tData?.payroll_common_settings?.rounding_unit) {
              const rUnit = parseInt(tData.payroll_common_settings.rounding_unit);
              setRoundingUnit(rUnit);
              localStorage.setItem(`mock_rounding_unit_${profile.tenant_id}`, rUnit.toString());
              localStorage.setItem('mock_rounding_unit', rUnit.toString());
            }

            if (tData?.work_calendar_settings) {
              const cal = tData.work_calendar_settings;
              const holSet = new Set<string>();
              const curYear = new Date().getFullYear();
              
              // 固定休日（日曜 0、土曜 6など）
              const fixedHols = Array.isArray(cal.fixed_holidays) ? cal.fixed_holidays : [0, 6];
              for (let m = 0; m < 12; m++) {
                const daysInMonth = new Date(curYear, m + 1, 0).getDate();
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateObj = new Date(curYear, m, d);
                  if (fixedHols.includes(dateObj.getDay())) {
                    holSet.add(`${curYear}-${m + 1}-${d}`);
                  }
                }
              }

              // 年末年始・夏季
              if (cal.winter_vacation_start && cal.winter_vacation_end) {
                let cur = new Date(cal.winter_vacation_start);
                const end = new Date(cal.winter_vacation_end);
                while (cur <= end) {
                  holSet.add(`${cur.getFullYear()}-${cur.getMonth() + 1}-${cur.getDate()}`);
                  cur.setDate(cur.getDate() + 1);
                }
              }
              if (cal.summer_vacation_start && cal.summer_vacation_end) {
                let cur = new Date(cal.summer_vacation_start);
                const end = new Date(cal.summer_vacation_end);
                while (cur <= end) {
                  holSet.add(`${cur.getFullYear()}-${cur.getMonth() + 1}-${cur.getDate()}`);
                  cur.setDate(cur.getDate() + 1);
                }
              }
              // 独自休日
              if (Array.isArray(cal.custom_holidays)) {
                cal.custom_holidays.forEach((h: any) => {
                  if (h?.date) {
                    const [y, m, d] = h.date.split('-').map(Number);
                    holSet.add(`${y}-${m}-${d}`);
                  }
                });
              }
              // 個別上書き
              if (cal.individual_overrides && typeof cal.individual_overrides === 'object') {
                Object.entries(cal.individual_overrides).forEach(([k, isHol]) => {
                  const [y, m, d] = k.split('-').map(Number);
                  const key = `${y}-${m}-${d}`;
                  if (isHol) holSet.add(key);
                  else holSet.delete(key);
                });
              }

              setCompanyHolidays(holSet);
              localStorage.setItem(`mock_company_holidays_${profile.tenant_id}`, JSON.stringify(Array.from(holSet)));
              localStorage.setItem('mock_company_holidays', JSON.stringify(Array.from(holSet)));
            }
          } catch (calErr) {
            console.warn('DB calendar sync notice:', calErr);
          }
        }
      }
    };
    fetchUserAndStatus();
  }, []);

  const [userTakenLeaveDays, setUserTakenLeaveDays] = useState(0);

  useEffect(() => {
    if (user) {
      const fetchMonthly = async () => {
        const y = viewMonth.getFullYear();
        const m = viewMonth.getMonth() + 1;
        const lastDay = new Date(y, m, 0).getDate();
        const start = `${y}-${m.toString().padStart(2, '0')}-01`;
        const end = `${y}-${m.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
        
        const { data } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false });
          
        if (data) setMonthlyRecords(data);
      };
      
      const fetchLeaveUsage = async () => {
        const currentYear = new Date().getFullYear();
        const startOfYear = `${currentYear}-01-01`;
        const { data } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', '承認')
          .eq('type', '有給休暇')
          .gte('start_date', startOfYear);
        
        if (data) {
          let days = 0;
          data.forEach(req => {
            const start = new Date(req.start_date);
            const end = new Date(req.end_date);
            days += (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;
          });
          setUserTakenLeaveDays(days);
        }
      };

      fetchMonthly();
      fetchLeaveUsage();
    }
  }, [user, viewMonth]);

  const [compressedFile, setCompressedFile] = useState<{name: string, originalSize: string, compressedSize: string} | null>(null);

  // Leave Request Form States
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState('有給休暇（全休）');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [punchTime, setPunchTime] = useState('');
  const [punchType, setPunchType] = useState('出勤');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  const [myRecentRequests, setMyRecentRequests] = useState<any[]>([]);

  // シフト希望・確定シフト State
  const [shiftMonth, setShiftMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [todayShift, setTodayShift] = useState<any>(null);
  const [shiftRequestsMap, setShiftRequestsMap] = useState<Record<string, { type: 'working' | 'off'; startTime: string; endTime: string }>>({});
  const [isSubmittingShift, setIsSubmittingShift] = useState(false);

  const fetchMyShifts = async () => {
    if (!user) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const [y, m] = shiftMonth.split('-');
      const yNum = parseInt(y, 10);
      const mNum = parseInt(m, 10);
      const lastDay = new Date(yNum, mNum, 0).getDate();
      const startOfMonthStr = `${y}-${m}-01`;
      const endOfMonthStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

      // 1. 確定シフトテーブル（shifts）の取得
      const { data: shiftList } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .gte('work_date', startOfMonthStr)
        .lte('work_date', endOfMonthStr);

      let finalShifts = shiftList || [];

      // 2. 承認済みのシフト希望申請（leave_requests）からも確定シフトを自動復元！
      const { data: approvedReq } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'シフト希望')
        .eq('status', '承認')
        .gte('start_date', startOfMonthStr)
        .lte('start_date', endOfMonthStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (approvedReq && approvedReq.reason) {
        const match = approvedReq.reason.match(/【シフトデータ:\s*(\[.+\])】/s);
        if (match) {
          try {
            const arr = JSON.parse(match[1]);
            const approvedShifts = arr.map((item: any) => ({
              id: `appr-${item.date}`,
              tenant_id: user.tenant_id,
              user_id: user.id,
              work_date: item.date,
              start_time: item.isHoliday ? null : (item.startTime ? `${item.startTime}:00` : '09:00:00'),
              end_time: item.isHoliday ? null : (item.endTime ? `${item.endTime}:00` : '18:00:00'),
              is_holiday: item.isHoliday ?? false
            }));

            // shiftsテーブルが空の場合は承認データから即時確定反映
            if (finalShifts.length === 0) {
              finalShifts = approvedShifts;
            }
          } catch (e) {}
        }
      }

      setMyShifts(finalShifts);
      const tS = finalShifts.find(s => s.work_date === todayStr);
      if (tS) setTodayShift(tS);

      // 3. 提出中（申請中）のシフト希望があれば自動復元！
      const { data: reqData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'シフト希望')
        .eq('status', '申請中')
        .gte('start_date', startOfMonthStr)
        .lte('start_date', endOfMonthStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reqData && reqData.reason) {
        const match = reqData.reason.match(/【シフトデータ:\s*(\[.+\])】/s);
        if (match) {
          try {
            const arr = JSON.parse(match[1]);
            const restoredMap: Record<string, { type: 'working' | 'off'; startTime: string; endTime: string }> = {};
            arr.forEach((item: any) => {
              restoredMap[item.date] = {
                type: item.isHoliday ? 'off' : 'working',
                startTime: item.startTime || '09:00',
                endTime: item.endTime || '18:00'
              };
            });
            setShiftRequestsMap(restoredMap);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Fetch my shifts error:', e);
    }
  };

  const handleSubmitShiftRequests = async () => {
    if (!user) return;
    const entries = Object.entries(shiftRequestsMap);
    if (entries.length === 0) {
      alert('希望する日付のシフト（出勤・公休）を設定してください。');
      return;
    }
    setIsSubmittingShift(true);
    try {
      const [y, m] = shiftMonth.split('-');
      const yNum = parseInt(y, 10);
      const mNum = parseInt(m, 10);
      const lastDay = new Date(yNum, mNum, 0).getDate();
      const startOfMonthStr = `${y}-${m}-01`;
      const endOfMonthStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

      const shiftDataArray = entries.map(([date, val]) => ({
        date,
        isHoliday: val.type === 'off',
        startTime: val.type === 'working' ? val.startTime : null,
        endTime: val.type === 'working' ? val.endTime : null
      }));

      const workingCount = shiftDataArray.filter(s => !s.isHoliday).length;
      const offCount = shiftDataArray.filter(s => s.isHoliday).length;

      const summaryText = entries.map(([date, val]) => 
        `${date}: ${val.type === 'working' ? `${val.startTime}〜${val.endTime}` : '公休'}`
      ).join('\n');

      const fullReason = `【${shiftMonth}月度 シフト希望提出（出勤: ${workingCount}日 / 休み: ${offCount}日）】\n${summaryText}\n\n【シフトデータ: ${JSON.stringify(shiftDataArray)}】`;

      // 既存の当月未承認シフト申請があれば古いものを更新（重複防止）
      await supabase
        .from('leave_requests')
        .update({ status: '取下' })
        .eq('user_id', user.id)
        .eq('type', 'シフト希望')
        .eq('status', '申請中')
        .gte('start_date', startOfMonthStr)
        .lte('start_date', endOfMonthStr);

      // 最新のシフト希望を新規申請
      const { error } = await supabase.from('leave_requests').insert({
        tenant_id: user.tenant_id,
        user_id: user.id,
        approver_id: user.approver_id || null,
        start_date: startOfMonthStr,
        end_date: endOfMonthStr,
        type: 'シフト希望',
        reason: fullReason,
        status: '申請中'
      });

      if (error) throw error;

      alert('✅ シフト希望を提出しました！\n上長（承認者）の承認待ち一覧へ届きました。承認されると確定シフトとしてカレンダーに即時反映されます。');
      fetchMyRequests();
      fetchMyShifts();
      setActiveTab('shifts');
    } catch (err: any) {
      console.error('Submit shift error:', err);
      alert('シフト希望の送信に失敗しました: ' + err.message);
    } finally {
      setIsSubmittingShift(false);
    }
  };

  // 申請の取下げ・取消
  const handleCancelRequest = async (requestId: string, reqType: string) => {
    if (!confirm(`この「${reqType}」申請を取り下げて取消しますか？`)) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', requestId)
        .eq('user_id', user.id);

      if (error) throw error;

      alert('申請を取り下げました。');
      setMyRecentRequests(prev => prev.filter(r => r.id !== requestId));
      fetchMyRequests();
      fetchMyShifts();
    } catch (err: any) {
      console.error('Cancel Request Error:', err);
      alert('申請の取り下げに失敗しました: ' + (err.message || err));
    }
  };

  const fetchMyRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(6);
    if (data) setMyRecentRequests(data);
  };

  useEffect(() => {
    if (user) {
      fetchMyShifts();
      const fetchApprovals = async () => {
        // 管理者の場合は全社の未承認申請、一般上長の場合は自分宛ての未承認申請を取得
        let query = supabase
          .from('leave_requests')
          .select('*')
          .eq('status', '申請中')
          .order('created_at', { ascending: false });

        if (user.role === 'admin' && user.tenant_id) {
          query = query.eq('tenant_id', user.tenant_id);
        } else {
          query = query.eq('approver_id', user.id);
        }

        const { data: requests, error } = await query;
        
        if (error) {
          console.error('fetchApprovals error:', error);
          return;
        }

        if (requests && requests.length > 0) {
          const userIds = [...new Set(requests.map(r => r.user_id))];
          const { data: usersData } = await supabase.from('users').select('id, name, department').in('id', userIds);
          
          const combined = requests.map(req => ({
            ...req,
            user: usersData?.find(u => u.id === req.user_id) || null
          }));
          setPendingApprovals(combined);
        } else {
          setPendingApprovals([]);
        }
      };
      fetchApprovals();

      if (activeTab === 'shifts' || activeTab === 'home') {
        fetchMyShifts();
      }

      if (activeTab === 'requests') {
        const fetchLeaveTypes = async () => {
          const { data } = await supabase
            .from('leave_types')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .order('created_at', { ascending: true });
          
          if (data && data.length > 0) {
            setLeaveTypes(data);
            if (leaveType === '有給休暇（全休）' && !data.find(d => d.name === leaveType)) {
              setLeaveType(data[0].name);
            }
          }
        };
        fetchLeaveTypes();
        fetchMyRequests();
      }
    }
  }, [user, activeTab, shiftMonth]);

  const handleApprovalAction = async (requestId: string, status: '承認' | '却下') => {
    try {
      const targetReq = pendingApprovals.find(r => r.id === requestId);

      const { error } = await supabase
        .from('leave_requests')
        .update({ status })
        .eq('id', requestId);
        
      if (error) {
        console.error('Error updating request status:', error);
        alert('ステータスの更新に失敗しました: ' + error.message);
        return;
      }

      // 打刻修正の承認ならattendance_recordsを更新
      if (status === '承認' && targetReq && targetReq.type === '打刻修正' && targetReq.reason) {
        const punchTypeMatch = targetReq.reason.match(/【修正区分:\s*([^】]+)】/);
        const punchTimeMatch = targetReq.reason.match(/【修正時刻:\s*([^】]+)】/);
        const pType = punchTypeMatch ? punchTypeMatch[1].trim() : '';
        const pTime = punchTimeMatch ? punchTimeMatch[1].trim() : '';

        if (pType && pTime && user?.tenant_id) {
          const targetDate = targetReq.start_date;
          const { data: existRec } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('tenant_id', user.tenant_id)
            .eq('user_id', targetReq.user_id)
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
              tenant_id: user.tenant_id,
              user_id: targetReq.user_id,
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

      // シフト希望の承認なら shifts テーブルへ確定シフトを自動一括投入！
      if (status === '承認' && targetReq && targetReq.type === 'シフト希望' && targetReq.reason) {
        try {
          const shiftDataMatch = targetReq.reason.match(/【シフトデータ:\s*(\[.+\])】/s);
          if (shiftDataMatch) {
            const shiftList = JSON.parse(shiftDataMatch[1]);
            for (const item of shiftList) {
              const isHoli = Boolean(item.isHoliday);
              await supabase.from('shifts').upsert({
                tenant_id: targetReq.tenant_id || user?.tenant_id,
                user_id: targetReq.user_id,
                work_date: item.date,
                start_time: isHoli ? '00:00:00' : (item.startTime ? `${item.startTime}:00` : '09:00:00'),
                end_time: isHoli ? '00:00:00' : (item.endTime ? `${item.endTime}:00` : '18:00:00'),
                break_minutes: isHoli ? 0 : 60,
                color: isHoli ? '#94a3b8' : '#3b82f6'
              }, { onConflict: 'user_id,work_date' });
            }
          }
        } catch (e) {
          console.warn('Shift sync on approve error:', e);
        }
      }
      
      // Update local state
      setPendingApprovals(prev => prev.filter(r => r.id !== requestId));
      alert(`${status}しました。${status === '承認' && targetReq?.type === 'シフト希望' ? '\n確定したシフトが部下の月間カレンダーに即時反映されました！' : ''}`);
    } catch (err: any) {
      alert('エラーが発生しました: ' + err.message);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.tenant_id) return;
    
    setIsSubmittingLeave(true);
    try {
      // 🔒 勤怠締めロックチェック（締め済みの過去月への打刻修正・休暇申請を防止）
      if (startDate) {
        const targetYearMonth = startDate.substring(0, 7);
        let isClosed = false;
        try {
          const raw = localStorage.getItem(`attendance_closing_${user.tenant_id}_${targetYearMonth}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.isClosed) isClosed = true;
          }
        } catch {}

        if (!isClosed) {
          const { data: closingData } = await supabase
            .from('attendance_monthly_closings')
            .select('status')
            .eq('tenant_id', user.tenant_id)
            .eq('year_month', targetYearMonth)
            .maybeSingle();
          if (closingData && closingData.status === 'closed') {
            isClosed = true;
          }
        }

        if (isClosed) {
          alert(`⚠️ 対象月（${targetYearMonth}度）は全社勤怠締めが確定・ロックされているため、新規申請や打刻修正は提出できません。\n修正が必要な場合は、会社管理者までご連絡ください。`);
          setIsSubmittingLeave(false);
          return;
        }
      }

      const { error } = await supabase.from('leave_requests').insert({
        tenant_id: user.tenant_id,
        user_id: user.id,
        approver_id: user.approver_id,
        start_date: startDate,
        end_date: leaveType === '打刻修正' ? startDate : endDate,
        type: leaveType,
        reason: leaveType === '打刻修正' ? `【修正区分: ${punchType}】【修正時刻: ${punchTime}】\n${leaveReason}` : leaveReason,
        status: '申請中'
      });

      if (error) throw error;
      
      alert('申請を送信しました。（※管理者に通知メールが送信されます）');
      
      // Reset form
      setLeaveType('有給休暇（全休）');
      setStartDate('');
      setEndDate('');
      setLeaveReason('');
      setActiveTab('home');
      setCompressedFile(null);
    } catch (err: any) {
      console.error('Leave Request Error:', err);
      alert('申請の送信に失敗しました。\nエラー詳細: ' + (err.message || JSON.stringify(err)));
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCompressedFile({
        name: file.name,
        originalSize: (file.size / 1024).toFixed(1) + ' KB',
        compressedSize: (file.size / 1024).toFixed(1) + ' KB (非画像のため圧縮なし)'
      });
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            setCompressedFile({
              name: file.name,
              originalSize: (file.size / 1024).toFixed(1) + ' KB',
              compressedSize: (blob.size / 1024).toFixed(1) + ' KB (圧縮完了)'
            });
          }
        }, 'image/jpeg', 0.7);
      };
    };
  };

  const handlePunchIn = async () => {
    if (!user) return;
    const today = new Date().toLocaleDateString('en-CA');
    const now = new Date().toLocaleTimeString('en-GB'); // HH:mm:ss
    const { data, error } = await supabase.from('attendance_records').insert({
      user_id: user.id,
      tenant_id: user.tenant_id,
      date: today,
      check_in_time: now,
      status: '勤務中'
    }).select().single();
    
    if (error) {
      alert('エラーが発生しました: ' + error.message);
      return;
    }
    setCurrentRecord(data);
    setStatus('勤務中');
    alert('出勤を記録しました');
  };

  const handlePunchOut = async () => {
    if (!user || !currentRecord) return;
    const now = new Date().toLocaleTimeString('en-GB');
    const { data, error } = await supabase.from('attendance_records').update({
      check_out_time: now,
      status: '退勤済'
    }).eq('id', currentRecord.id).select().single();
    
    if (error) {
      alert('エラーが発生しました: ' + error.message);
      return;
    }
    setCurrentRecord(data);
    setStatus('退勤済');
    alert('退勤を記録しました');
  };

  // ブラウザタブのタイトルを動的に更新
  useEffect(() => {
    const titles: Record<string, string> = {
      home: 'ホーム（打刻） | スマート勤怠',
      attendance: '月次勤怠・有給照会 | スマート勤怠',
      payslips: 'Web給与明細・源泉徴収票・労務書類 | スマート勤怠',
      requests: '各種申請 | スマート勤怠',
      approvals: '部下からの申請承認 | スマート勤怠',
      rules_ai: '🤖 社内規定AI相談 | スマート勤怠'
    };
    document.title = titles[activeTab] || 'スマート勤怠・有給管理';
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-slate-800 text-white flex flex-col print:hidden">
        <div className="p-4 text-xl font-bold border-b border-slate-700">
          {user ? `${user.name} さん` : '読み込み中...'}
        </div>
        <nav className="flex-1 p-4 flex md:flex-col space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'home' ? 'bg-slate-600' : 'hover:bg-slate-700'}`}
          >
            <Clock className="mr-3 h-5 w-5" />
            ホーム（打刻）
          </button>
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'attendance' ? 'bg-slate-600' : 'hover:bg-slate-700'}`}
          >
            <Calendar className="mr-3 h-5 w-5 text-blue-400" />
            月次勤怠・有給照会
          </button>
          <button 
            onClick={() => {
              setActiveTab('shifts');
              fetchMyShifts();
            }}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'shifts' ? 'bg-indigo-600 font-bold text-white shadow-sm' : 'hover:bg-slate-700 text-indigo-200'}`}
          >
            <Calendar className="mr-3 h-5 w-5 text-indigo-400" />
            シフト希望・確定シフト
          </button>

          <button 
            onClick={() => setActiveTab('payslips')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'payslips' ? 'bg-emerald-700 font-bold text-white shadow-sm' : 'hover:bg-slate-700 text-emerald-300'}`}
          >
            <FileText className="mr-3 h-5 w-5 text-emerald-400" />
            📄 Web給与明細・源泉徴収票・書類
          </button>

          <button 
            onClick={() => setActiveTab('requests')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'requests' ? 'bg-slate-600' : 'hover:bg-slate-700'}`}
          >
            <FileText className="mr-3 h-5 w-5" />
            各種申請
          </button>
          <button 
            onClick={() => setActiveTab('approvals')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'approvals' ? 'bg-slate-600' : 'hover:bg-slate-700'}`}
          >
            <UserCheck className="mr-3 h-5 w-5" />
            部下からの申請承認
            <span className="ml-auto bg-red-500 text-xs py-1 px-2 rounded-full">{pendingApprovals.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab('rules_ai')}
            className={`flex items-center w-full p-2 rounded transition-colors whitespace-nowrap ${activeTab === 'rules_ai' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 font-bold text-white shadow-sm' : 'hover:bg-slate-700 text-blue-200'}`}
          >
            <Bot className="mr-3 h-5 w-5 text-cyan-300 animate-pulse" />
            社内規定AI相談
          </button>
          
          {user?.role === 'admin' && (
            <button 
              onClick={() => navigate('/kintai/admin')}
              className="flex items-center w-full p-2 mt-4 rounded transition-colors whitespace-nowrap text-blue-300 hover:bg-slate-700"
            >
              <Settings className="mr-3 h-5 w-5" />
              管理ダッシュボードへ
            </button>
          )}
        </nav>
        <div className="p-4 border-t border-slate-700 hidden md:block">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/');
            }}
            className="flex items-center w-full p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            ログアウト
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto relative flex flex-col">
        {/* Top App Bar (全システム統一) */}
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs print:hidden">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/portal')}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
              title="ポータルに戻る"
            >
              <ArrowLeft className="w-4 h-4" />
              ポータル
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div className="text-xs font-bold text-slate-500">
              勤怠・有給管理
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition font-bold text-xs shadow-xs cursor-pointer"
              title="打刻・有給申請・給与明細の使い方を見る"
            >
              <span className="text-sm">❓</span>
              <span>使い方ガイド</span>
            </button>
            <AppSwitcher currentApp="kintai" role={user?.role === 'admin' ? 'admin' : 'user'} />
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/');
              }}
              className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
              title="ログアウト"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1">
          <div className="max-w-4xl mx-auto space-y-6">
          
          {activeTab === 'home' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Clock Widget */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center">
                <h2 className="text-gray-500 font-medium mb-2">現在時刻</h2>
                <div className="text-5xl font-bold text-gray-800 tracking-wider mb-6 tabular-nums">
                  {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                
                <div className="flex w-full space-x-4">
                  <button 
                    onClick={handlePunchIn}
                    disabled={status !== '未出勤'}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    出勤
                  </button>
                  <button 
                    onClick={handlePunchOut}
                    disabled={status !== '勤務中'}
                    className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-bold text-lg hover:bg-orange-600 disabled:opacity-50 transition"
                  >
                    退勤
                  </button>
                </div>
                
                <div className="mt-4 flex flex-col space-y-3 items-center text-sm text-gray-600">
                  <div className="flex items-center">
                    <span className="mr-2">現在のステータス:</span>
                    <span className={`px-3 py-1 rounded-full font-bold ${
                      status === '未出勤' ? 'bg-gray-100 text-gray-600' :
                      status === '勤務中' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {status}
                    </span>
                  </div>
                  {(currentRecord?.check_in_time || currentRecord?.check_out_time) && (
                    <div className="flex space-x-6 bg-gray-50 px-4 py-2 rounded-md border border-gray-100">
                      {currentRecord?.check_in_time && (
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-400">出勤時間</span>
                          <span className="font-bold text-gray-800 text-lg">{currentRecord.check_in_time.substring(0, 5)}</span>
                        </div>
                      )}
                      {currentRecord?.check_out_time && (
                        <div className="flex flex-col items-center border-l pl-6 border-gray-200">
                          <span className="text-xs text-gray-400">退勤時間</span>
                          <span className="font-bold text-gray-800 text-lg">{currentRecord.check_out_time.substring(0, 5)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Leave Balance */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-medium text-gray-800 mb-4 border-b pb-2">有給休暇・代休 残数</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-blue-50 p-3 rounded-md">
                    <span className="font-medium text-blue-900">有給休暇（今年度付与分）</span>
                    <span className="text-2xl font-bold text-blue-700">{user?.paid_leave_balance || 0}<span className="text-sm font-normal ml-1">日</span></span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                    <span className="font-medium text-gray-700">有給休暇（前年度繰越分）</span>
                    <span className="text-xl font-bold text-gray-700">{user?.paid_leave_carryover || 0}<span className="text-sm font-normal ml-1">日</span></span>
                  </div>
                  <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md border border-gray-200">
                    <span className="font-bold text-gray-800">有給休暇（合計残数）</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {(user?.paid_leave_balance || 0) + (user?.paid_leave_carryover || 0)}
                      <span className="text-sm font-normal ml-1">日</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-green-50 p-3 rounded-md">
                    <span className="font-medium text-green-900">利用可能な代休</span>
                    <span className="text-xl font-bold text-green-700">0<span className="text-sm font-normal ml-1">日</span></span>
                  </div>

                  {/* 本日の確定シフト予定 */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        🗓️
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-indigo-900">本日のシフト予定</div>
                        <div className="text-xs font-black text-indigo-950 mt-0.5">
                          {todayShift ? (
                            todayShift.is_holiday ? (
                              <span className="text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md font-bold">公休日（休み）</span>
                            ) : (
                              <span className="text-indigo-700 font-mono text-sm font-bold">
                                {todayShift.start_time?.substring(0, 5) || '09:00'} 〜 {todayShift.end_time?.substring(0, 5) || '18:00'} (出勤)
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500 font-normal">通常カレンダー勤務</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActiveTab('shifts');
                        fetchMyShifts();
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      シフト希望・確認 &rarr;
                    </button>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start">
                    <CheckCircle className="text-yellow-600 w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">
                      有給取得義務（年間5日）に対して、今年度現在 <strong>{userTakenLeaveDays}日</strong> 取得済みです。
                      {userTakenLeaveDays < 5 && (
                        <span>期限までに残り <strong>{5 - userTakenLeaveDays}日</strong> の取得が必要です。</span>
                      )}
                      {userTakenLeaveDays >= 5 && (
                        <span className="text-green-700 font-bold ml-1">義務日数をクリアしています。</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Monthly Attendance Quick Summary Card */}
              <div className="md:col-span-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-md p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-700">
                <div>
                  <div className="flex items-center space-x-2 text-indigo-300 text-sm font-semibold mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>今月（{viewMonth.getFullYear()}年{viewMonth.getMonth() + 1}月度）の勤怠実績</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white tracking-wide">
                    月次勤怠サマリー
                  </h3>
                  <div className="flex flex-wrap gap-4 mt-4">
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/10">
                      <span className="text-xs text-indigo-200 block">出勤日数</span>
                      <span className="text-xl font-bold text-white">
                        {monthlyRecords.filter(r => r.check_in_time).length}
                        <span className="text-xs font-normal ml-1">日</span>
                      </span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/10">
                      <span className="text-xs text-indigo-200 block">総実働時間</span>
                      <span className="text-xl font-bold text-emerald-300">
                        {(() => {
                          let mins = 0;
                          monthlyRecords.forEach(r => {
                            if (r.check_in_time && r.check_out_time) {
                              const [inH, inM] = r.check_in_time.split(':').map(Number);
                              const [outH, outM] = r.check_out_time.split(':').map(Number);
                              const total = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));
                              let breakM = total >= 480 ? 60 : (total >= 360 ? 45 : 0);
                              mins += Math.max(0, total - breakM);
                            }
                          });
                          return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                        })()}
                      </span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-lg border border-white/10">
                      <span className="text-xs text-indigo-200 block">総残業時間</span>
                      <span className="text-xl font-bold text-amber-300">
                        {(() => {
                          let otMins = 0;
                          monthlyRecords.forEach(r => {
                            if (r.check_in_time && r.check_out_time) {
                              const [inH, inM] = r.check_in_time.split(':').map(Number);
                              const [outH, outM] = r.check_out_time.split(':').map(Number);
                              const total = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));
                              let breakM = total >= 480 ? 60 : (total >= 360 ? 45 : 0);
                              const work = Math.max(0, total - breakM);
                              otMins += Math.max(0, work - 480);
                            }
                          });
                          return `${Math.floor(otMins / 60)}h ${otMins % 60}m`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      setActiveTab('shifts');
                      fetchMyShifts();
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3 rounded-xl shadow-lg hover:shadow-indigo-500/50 transition-all flex items-center justify-center space-x-2 text-sm whitespace-nowrap cursor-pointer"
                  >
                    <Calendar className="w-5 h-5" />
                    <span>🗓️ シフト希望を提出する（カレンダー） ➔</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('attendance')}
                    className="bg-white/15 hover:bg-white/25 text-white font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center space-x-2 text-xs whitespace-nowrap cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-blue-300" />
                    <span>月次勤怠明細を見る</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('requests')}
                    className="bg-white/15 hover:bg-white/25 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center justify-center space-x-2 text-xs whitespace-nowrap cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>打刻修正・有給申請を行う</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('payslips')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg transition-all flex items-center justify-center space-x-2 text-xs whitespace-nowrap cursor-pointer shadow-md"
                  >
                    <FileText className="w-4 h-4 text-emerald-200" />
                    <span>給与明細・源泉徴収票・契約書類を確認</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('rules_ai')}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-4 py-2 rounded-lg transition-all flex items-center justify-center space-x-2 text-xs whitespace-nowrap cursor-pointer shadow-md"
                  >
                    <Bot className="w-4 h-4 text-cyan-300" />
                    <span>社内規定・有給ルールをAIに聞く</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 print:p-0 print:border-none print:shadow-none">
              {/* Print-only Header */}
              <div className="hidden print:block mb-4 text-center">
                <h1 className="text-2xl font-bold">{user?.name}様 勤怠実績（{viewMonth.getFullYear()}年{viewMonth.getMonth() + 1}月）</h1>
              </div>
                {/* --- 事前計算ロジック --- */}
                {(() => {
                  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
                  let totalDays = 0;
                  let totalActualMins = 0;
                  let totalOvertimeMins = 0;

                  const rows = Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                    const dayOfWeekStr = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
                    const searchDateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const mockDateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${day}`;
                    
                    const record = monthlyRecords.find(r => r.date === searchDateStr);
                    
                    // 確定シフトとの連動（シフト公休を優先判定）
                    const confirmedShift = myShifts.find(s => s.work_date === searchDateStr);
                    const isShiftOff = confirmedShift ? confirmedShift.is_holiday : undefined;
                    const isCompanyHoliday = isShiftOff !== undefined ? isShiftOff : companyHolidays.has(mockDateStr);
                    const isTodayOrPast = date <= new Date();
                    
                    let trClass = "";
                    let rawInTime = record?.check_in_time ? record.check_in_time.substring(0, 5) : "";
                    let rawOutTime = record?.check_out_time ? record.check_out_time.substring(0, 5) : "";
                    let note = record?.note || "";
                    let isWorkingDay = false;
                    let isPaidLeave = false;

                    if (isCompanyHoliday && !record) {
                      trClass = "bg-gray-50";
                      rawInTime = "-";
                      rawOutTime = "-";
                      note = confirmedShift?.is_holiday ? "シフト公休" : "公休";
                    } else if (record) {
                      isWorkingDay = true;
                      if (confirmedShift && !confirmedShift.is_holiday && !note) {
                        note = `シフト(${confirmedShift.start_time?.substring(0, 5)}〜${confirmedShift.end_time?.substring(0, 5)})`;
                      }
                    } else if (isTodayOrPast && !isCompanyHoliday) {
                      rawInTime = "-";
                      rawOutTime = "-";
                      note = "打刻漏れ";
                      trClass = "bg-red-50 text-red-600";
                    }

                    let actualMins = 0;
                    let overtimeMins = 0;
                    let roundedIn = rawInTime;
                    let roundedOut = rawOutTime;

                    if (isWorkingDay && rawInTime && rawOutTime) {
                      const parseMins = (t: string) => {
                        const [h, m] = t.split(':').map(Number);
                        return h * 60 + m;
                      };
                      let inM = parseMins(rawInTime);
                      let outM = parseMins(rawOutTime);

                      if (roundingUnit > 1) {
                        const inRem = inM % roundingUnit;
                        if (inRem > 0) inM += (roundingUnit - inRem);
                        const outRem = outM % roundingUnit;
                        if (outRem > 0) outM -= outRem;
                      }

                      roundedIn = `${Math.floor(inM / 60).toString().padStart(2, '0')}:${(inM % 60).toString().padStart(2, '0')}`;
                      roundedOut = `${Math.floor(outM / 60).toString().padStart(2, '0')}:${(outM % 60).toString().padStart(2, '0')}`;

                      const totalMins = Math.max(0, outM - inM);
                      let breakMins = 0;
                      if (totalMins >= 8 * 60) breakMins = 60;
                      else if (totalMins >= 6 * 60) breakMins = 45;

                      actualMins = Math.max(0, totalMins - breakMins);
                      overtimeMins = Math.max(0, actualMins - 8 * 60);

                      totalDays += 1;
                      totalActualMins += actualMins;
                      totalOvertimeMins += overtimeMins;
                    }

                    const formatHM = (mins: number) => {
                      if (mins === 0) return '-';
                      const h = Math.floor(mins / 60);
                      const m = mins % 60;
                      return `${h}h${m > 0 ? ` ${m}m` : ''}`;
                    };

                    return {
                      day, date, dayOfWeekStr, trClass, isPaidLeave,
                      rawInTime, rawOutTime, roundedIn, roundedOut, note,
                      actualStr: formatHM(actualMins), overtimeStr: formatHM(overtimeMins),
                      overtimeMins
                    };
                  });

                  const handleExportCSV = () => {
                    const headers = ['日付', '曜日', '出勤時間', '退勤時間', '実働時間', '残業時間', '備考'];
                    const csvRows = rows.map(r => [
                      `${r.date.getFullYear()}/${r.date.getMonth() + 1}/${r.day}`,
                      r.dayOfWeekStr,
                      r.roundedIn !== '-' ? r.roundedIn : '',
                      r.roundedOut !== '-' ? r.roundedOut : '',
                      r.actualStr !== '-' ? r.actualStr : '',
                      r.overtimeStr !== '-' ? r.overtimeStr : '',
                      r.note
                    ]);
                    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
                    const csvContent = [headers.join(','), ...csvRows.map(e => e.map(field => `"${field}"`).join(','))].join('\n');
                    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `勤怠実績_${viewMonth.getFullYear()}年${viewMonth.getMonth() + 1}月.csv`;
                    link.click();
                  };

                  return (
                    <>
                      <div className="flex flex-col md:flex-row justify-between items-center mb-4 border-b pb-4 gap-4 print:hidden">
                        <div className="flex items-center space-x-4">
                          <h2 className="text-lg font-medium text-gray-800">月間勤怠照会</h2>
                          <div className="flex items-center bg-gray-100 rounded-md">
                            <button 
                              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
                              className="p-2 hover:bg-gray-200 rounded-l-md transition"
                            >
                              <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <span className="px-4 font-bold text-gray-700 min-w-[120px] text-center">
                              {viewMonth.getFullYear()}年{viewMonth.getMonth() + 1}月
                            </span>
                            <button 
                              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
                              className="p-2 hover:bg-gray-200 rounded-r-md transition"
                            >
                              <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2 mt-4 md:mt-0 print:hidden">
                          <div className="flex space-x-2">
                            <button onClick={() => window.print()} className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-4 py-1.5 rounded shadow-sm flex items-center transition">
                              <FileText className="w-4 h-4 mr-1" />
                              PDF出力 (印刷)
                            </button>
                            <button onClick={handleExportCSV} className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded shadow-sm flex items-center transition">
                              <FileText className="w-4 h-4 mr-1" />
                              CSV出力
                            </button>
                          </div>
                          <div className="flex space-x-2 text-sm">
                            <span className="bg-gray-100 px-3 py-1 rounded border border-gray-200">
                            出勤: <span className="font-bold">{totalDays}</span> 日
                          </span>
                          <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded border border-blue-200">
                            実働: <span className="font-bold">{Math.floor(totalActualMins/60)}</span> 時間 <span className="font-bold">{totalActualMins%60}</span> 分
                          </span>
                          <span className="bg-red-50 text-red-800 px-3 py-1 rounded border border-red-200">
                            残業: <span className="font-bold">{Math.floor(totalOvertimeMins/60)}</span> 時間 <span className="font-bold">{totalOvertimeMins%60}</span> 分
                            </span>
                          </div>
                        </div>
                      </div>
                    
                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="min-w-full divide-y divide-gray-200 print:text-[11px]">
                        <thead>
                          <tr>
                            <th className="px-3 py-3 print:py-1.5 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                            <th className="px-3 py-3 print:py-1.5 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">出勤 (打刻)</th>
                            <th className="px-3 py-3 print:py-1.5 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">退勤 (打刻)</th>
                            <th className="px-3 py-3 print:py-1.5 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">実働時間</th>
                            <th className="px-3 py-3 print:py-1.5 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">残業時間</th>
                            <th className="px-3 py-3 print:py-1.5 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
                            <th className="px-3 py-3 print:py-1.5 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase print:hidden">アクション</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {rows.map((r) => (
                            <tr key={r.day} className={r.trClass}>
                              <td className={`px-3 py-2 print:py-1.5 whitespace-nowrap text-sm print:text-[11px] ${r.isPaidLeave ? '' : 'text-gray-900'} ${r.date.getDay() === 0 ? 'text-red-500' : r.date.getDay() === 6 ? 'text-blue-500' : ''}`}>
                                {(viewMonth.getMonth() + 1).toString().padStart(2, '0')}/{r.day.toString().padStart(2, '0')} ({r.dayOfWeekStr})
                              </td>
                              <td className="px-3 py-2 print:py-1.5 whitespace-nowrap text-sm print:text-[11px] text-gray-900">
                                {r.roundedIn}
                                {r.rawInTime && r.rawInTime !== r.roundedIn && r.rawInTime !== '-' && (
                                  <span className="ml-2 text-xs print:text-[9px] text-gray-400">({r.rawInTime})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 print:py-1.5 whitespace-nowrap text-sm print:text-[11px] text-gray-900">
                                {r.roundedOut}
                                {r.rawOutTime && r.rawOutTime !== r.roundedOut && r.rawOutTime !== '-' && (
                                  <span className="ml-2 text-xs print:text-[9px] text-gray-400">({r.rawOutTime})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 print:py-1.5 whitespace-nowrap text-sm print:text-[11px] text-right font-medium text-gray-700">
                                {r.actualStr}
                              </td>
                              <td className={`px-3 py-2 print:py-1.5 whitespace-nowrap text-sm print:text-[11px] text-right font-medium ${r.overtimeMins > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                {r.overtimeStr}
                              </td>
                              <td className="px-3 py-2 print:py-1.5 whitespace-nowrap text-sm print:text-[11px] text-gray-500">{r.note}</td>
                              <td className="px-3 py-2 print:py-1.5 whitespace-nowrap text-sm text-right print:hidden">
                                <button 
                                  onClick={() => {
                                    const y = r.date.getFullYear();
                                    const m = String(r.date.getMonth() + 1).padStart(2, '0');
                                    const d = String(r.date.getDate()).padStart(2, '0');
                                    const ds = `${y}-${m}-${d}`;
                                    setStartDate(ds);
                                    setEndDate(ds);
                                    setActiveTab('requests');
                                  }}
                                  className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition text-xs border border-blue-200"
                                >
                                  申請する
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {activeTab === 'shifts' && (
            <div className="space-y-6 animate-in fade-in">
              {/* シフト希望提出＆確定シフト表示 ヘッダーカード */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
                
                {/* 最上部タイトル ＆ 月切替 ＆ 提出ボタン */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                        月間シフト管理
                      </span>
                      <span className="text-xs text-gray-500 font-medium">希望提出 ➔ 上長承認 ➔ 確定カレンダー連動</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                      <Calendar className="w-6 h-6 text-indigo-600" />
                      月間シフトカレンダー（希望提出・確定確認）
                    </h2>
                  </div>

                  {/* 月切り替え ＆ 提出ボタン */}
                  <div className="flex flex-wrap items-center gap-3 self-end lg:self-auto">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          const [y, m] = shiftMonth.split('-').map(Number);
                          const prev = new Date(y, m - 2, 1);
                          const prevStr = `${prev.getFullYear()}-${(prev.getMonth() + 1).toString().padStart(2, '0')}`;
                          setShiftMonth(prevStr);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-white rounded-lg transition cursor-pointer"
                      >
                        &larr; 前月
                      </button>
                      <input
                        type="month"
                        value={shiftMonth}
                        onChange={(e) => {
                          setShiftMonth(e.target.value);
                        }}
                        className="border-none bg-transparent px-2 py-1 text-xs font-black text-slate-800 text-center focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const [y, m] = shiftMonth.split('-').map(Number);
                          const next = new Date(y, m, 1);
                          const nextStr = `${next.getFullYear()}-${(next.getMonth() + 1).toString().padStart(2, '0')}`;
                          setShiftMonth(nextStr);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-gray-700 hover:bg-white rounded-lg transition cursor-pointer"
                      >
                        翌月 &rarr;
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmitShiftRequests}
                      disabled={isSubmittingShift}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isSubmittingShift ? 'シフト提出中...' : 'この希望で上長へ提出する'}
                    </button>
                  </div>
                </div>

                {/* シフトステータスバナー（確定済み・申請中インジケーター） */}
                {(() => {
                  const confirmedCount = myShifts.length;
                  const confirmedWorkCount = myShifts.filter(s => !s.is_holiday).length;
                  const confirmedHoliCount = myShifts.filter(s => s.is_holiday).length;
                  const pendingReq = myRecentRequests.find(r => r.type === 'シフト希望' && r.status === '申請中' && r.start_date?.startsWith(shiftMonth));

                  if (confirmedCount > 0) {
                    return (
                      <div className="my-3 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border-2 border-emerald-400 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                            ✓
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                確定済み
                              </span>
                              <h4 className="text-sm font-black text-slate-900">
                                {shiftMonth}月度のシフトが確定しています
                              </h4>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              出勤: <strong className="text-indigo-700 font-bold">{confirmedWorkCount}日</strong> / 公休: <strong className="text-slate-700 font-bold">{confirmedHoliCount}日</strong> （※カレンダー内の「確定」バッジが確定シフトです）
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (pendingReq) {
                    return (
                      <div className="my-3 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                          ⏳
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                              申請中（承認待ち）
                            </span>
                            <h4 className="text-sm font-black text-amber-950">
                              {shiftMonth}月度のシフト希望を提出中です
                            </h4>
                          </div>
                          <p className="text-xs text-amber-800 mt-0.5">
                            上長（承認者）の承認をお待ちください。承認されると自動的に確定シフトへ切り替わります。
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* クイック一括設定バー（管理者の会社カレンダー設定に完全連動） */}
                <div className="my-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      一括設定:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = shiftMonth.split('-').map(Number);
                        const daysCount = new Date(y, m, 0).getDate();
                        const nextMap: Record<string, { type: 'working' | 'off'; startTime: string; endTime: string }> = {};
                        for (let d = 1; d <= daysCount; d++) {
                          const dateStr = `${shiftMonth}-${d.toString().padStart(2, '0')}`;
                          const mockDateStr = `${y}-${m}-${d}`;
                          const isHoliday = companyHolidays.has(mockDateStr);
                          if (!isHoliday) {
                            nextMap[dateStr] = { type: 'working', startTime: '09:00', endTime: '18:00' };
                          }
                        }
                        setShiftRequestsMap(prev => ({ ...prev, ...nextMap }));
                      }}
                      className="bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 px-3 py-1 rounded-lg font-bold transition cursor-pointer shadow-2xs"
                    >
                      🏢 会社営業日を一括出勤希望（09:00〜18:00）
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = shiftMonth.split('-').map(Number);
                        const daysCount = new Date(y, m, 0).getDate();
                        const nextMap: Record<string, { type: 'working' | 'off'; startTime: string; endTime: string }> = {};
                        for (let d = 1; d <= daysCount; d++) {
                          const dateStr = `${shiftMonth}-${d.toString().padStart(2, '0')}`;
                          const mockDateStr = `${y}-${m}-${d}`;
                          const isHoliday = companyHolidays.has(mockDateStr);
                          if (isHoliday) {
                            nextMap[dateStr] = { type: 'off', startTime: '', endTime: '' };
                          }
                        }
                        setShiftRequestsMap(prev => ({ ...prev, ...nextMap }));
                      }}
                      className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-lg font-bold transition cursor-pointer shadow-2xs"
                    >
                      🏖️ 会社所定休日を一括休み希望
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                      確定シフト
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                      出勤希望
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                      休み希望
                    </span>
                    <button
                      type="button"
                      onClick={() => setShiftRequestsMap({})}
                      className="text-gray-400 hover:text-rose-600 underline ml-2 cursor-pointer"
                    >
                      入力クリア
                    </button>
                  </div>
                </div>

                {/* 7列 本格月間カレンダーグリッド */}
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-xs bg-gray-100">
                  {/* 曜日ヘッダー（日〜土） */}
                  <div className="grid grid-cols-7 bg-slate-800 text-white text-center text-xs font-bold py-2.5 tracking-wider">
                    <div className="text-rose-300">日 (Sun)</div>
                    <div>月 (Mon)</div>
                    <div>火 (Tue)</div>
                    <div>水 (Wed)</div>
                    <div>木 (Thu)</div>
                    <div>金 (Fri)</div>
                    <div className="text-cyan-300">土 (Sat)</div>
                  </div>

                  {/* カレンダー日付セル */}
                  <div className="grid grid-cols-7 gap-px bg-gray-200">
                    {(() => {
                      const [y, m] = shiftMonth.split('-').map(Number);
                      const daysCount = new Date(y, m, 0).getDate();
                      const firstDayOfWeek = new Date(y, m - 1, 1).getDay(); // 0: 日 〜 6: 土
                      const cells = [];

                      // 1. 月初のオフセット空セル
                      for (let i = 0; i < firstDayOfWeek; i++) {
                        cells.push(
                          <div key={`empty-${i}`} className="bg-gray-50/70 min-h-[110px] p-2 select-none" />
                        );
                      }

                      // 2. 当月の各日セル
                      for (let d = 1; d <= daysCount; d++) {
                        const dayStr = d.toString().padStart(2, '0');
                        const dateStr = `${shiftMonth}-${dayStr}`;
                        const dayOfWeek = new Date(y, m - 1, d).getDay();
                        const isSunday = dayOfWeek === 0;
                        const isSaturday = dayOfWeek === 6;
                        const mockDateStr = `${y}-${m}-${d}`;
                        const isCompanyHoliday = companyHolidays.has(mockDateStr);

                        // 確定シフト
                        const confirmed = myShifts.find(s => s.work_date === dateStr);
                        // 編集中の希望
                        const req = shiftRequestsMap[dateStr];

                        cells.push(
                          <div
                            key={dateStr}
                            className={`min-h-[110px] sm:min-h-[120px] p-2 sm:p-2.5 transition flex flex-col justify-between ${
                              confirmed
                                ? (confirmed.is_holiday ? 'bg-slate-100' : 'bg-indigo-50/80')
                                : (req
                                    ? (req.type === 'working' ? 'bg-blue-50/90 ring-1 ring-blue-300' : 'bg-rose-50/90 ring-1 ring-rose-300')
                                    : (isCompanyHoliday ? 'bg-slate-50/80 hover:bg-slate-100' : 'bg-white hover:bg-slate-50/80'))
                            }`}
                          >
                            {/* 上部: 日付番号 ＆ ステータスバッジ */}
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-1">
                                <span className={`text-xs sm:text-sm font-black ${isSunday ? 'text-rose-600' : isSaturday ? 'text-blue-600' : 'text-slate-800'}`}>
                                  {d}
                                </span>
                                {isCompanyHoliday && (
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-200/80 px-1 py-0.2 rounded">
                                    会社休
                                  </span>
                                )}
                              </div>

                              {confirmed ? (
                                <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                  confirmed.is_holiday ? 'bg-slate-300 text-slate-700' : 'bg-indigo-600 text-white shadow-2xs'
                                }`}>
                                  {confirmed.is_holiday ? '公休' : '確定'}
                                </span>
                              ) : req ? (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                  req.type === 'working' ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'
                                }`}>
                                  {req.type === 'working' ? '出勤希望' : '休み希望'}
                                </span>
                              ) : (
                                <span className="text-[9px] text-gray-300">未設定</span>
                              )}
                            </div>

                            {/* 中央: 確定シフト内容 または 希望入力フォーム */}
                            <div className="my-1">
                              {confirmed ? (
                                <div className="text-center py-1">
                                  {confirmed.is_holiday ? (
                                    <span className="text-xs font-bold text-slate-500 block">🏖️ 公休日</span>
                                  ) : (
                                    <div className="text-xs font-mono font-black text-indigo-950 bg-white/90 py-1 px-1 rounded border border-indigo-200 shadow-2xs">
                                      {confirmed.start_time?.substring(0, 5) || '09:00'} 〜 {confirmed.end_time?.substring(0, 5) || '18:00'}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {/* 出勤・休み 切替ボタン */}
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setShiftRequestsMap(prev => ({
                                        ...prev,
                                        [dateStr]: { type: 'working', startTime: prev[dateStr]?.startTime || '09:00', endTime: prev[dateStr]?.endTime || '18:00' }
                                      }))}
                                      className={`py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                        req?.type === 'working' ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                      }`}
                                    >
                                      出勤
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShiftRequestsMap(prev => ({
                                        ...prev,
                                        [dateStr]: { type: 'off', startTime: '', endTime: '' }
                                      }))}
                                      className={`py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                        req?.type === 'off' ? 'bg-rose-600 text-white shadow-xs' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                      }`}
                                    >
                                      休み
                                    </button>
                                  </div>

                                  {/* 出勤時間入力 */}
                                  {req?.type === 'working' && (
                                    <div className="flex items-center gap-0.5 text-[9px] font-mono mt-0.5">
                                      <input
                                        type="time"
                                        value={req.startTime}
                                        onChange={(e) => setShiftRequestsMap(prev => ({
                                          ...prev,
                                          [dateStr]: { ...req, startTime: e.target.value }
                                        }))}
                                        className="w-1/2 p-0.5 border border-gray-300 rounded text-center bg-white"
                                      />
                                      <span>-</span>
                                      <input
                                        type="time"
                                        value={req.endTime}
                                        onChange={(e) => setShiftRequestsMap(prev => ({
                                          ...prev,
                                          [dateStr]: { ...req, endTime: e.target.value }
                                        }))}
                                        className="w-1/2 p-0.5 border border-gray-300 rounded text-center bg-white"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* 下部クリアボタン */}
                            {!confirmed && req && (
                              <button
                                type="button"
                                onClick={() => setShiftRequestsMap(prev => {
                                  const copy = { ...prev };
                                  delete copy[dateStr];
                                  return copy;
                                })}
                                className="text-[9px] text-gray-400 hover:text-rose-500 text-right cursor-pointer"
                              >
                                取消
                              </button>
                            )}
                          </div>
                        );
                      }

                      return cells;
                    })()}
                  </div>
                </div>

                {/* 最下部 一括提出 ＆ 取下げボタン */}
                <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    ※提出後も上長が承認するまでは再提出・取下げが可能です。
                  </p>
                  <div className="flex items-center gap-2">
                    {Object.keys(shiftRequestsMap).length > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`${shiftMonth}月度のシフト希望提出を取り下げて入力内容をクリアしますか？`)) return;
                          try {
                            const [y, m] = shiftMonth.split('-');
                            const yNum = parseInt(y, 10);
                            const mNum = parseInt(m, 10);
                            const lastDay = new Date(yNum, mNum, 0).getDate();
                            const startOfMonthStr = `${y}-${m}-01`;
                            const endOfMonthStr = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
                            await supabase
                              .from('leave_requests')
                              .delete()
                              .eq('user_id', user!.id)
                              .eq('type', 'シフト希望')
                              .gte('start_date', startOfMonthStr)
                              .lte('start_date', endOfMonthStr);
                            setShiftRequestsMap({});
                            alert('シフト希望を取り下げました。');
                            fetchMyRequests();
                            fetchMyShifts();
                          } catch (e: any) {
                            alert('取下げエラー: ' + e.message);
                          }
                        }}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4 text-rose-600" />
                        希望を取り下げてクリア
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSubmitShiftRequests}
                      disabled={isSubmittingShift}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-sm font-black shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {isSubmittingShift ? '提出中...' : 'シフト希望を提出する'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Form (2 cols) */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center space-x-2 border-b pb-4 mb-6">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-800">各種申請フォーム</h2>
                </div>

                <form className="space-y-6" onSubmit={handleApply}>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">申請種類</label>
                    <select 
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg border bg-white"
                    >
                      {leaveTypes.map(lt => (
                        <option key={lt.id} value={lt.name}>{lt.name}</option>
                      ))}
                      {leaveTypes.length === 0 && (
                        <>
                          <option>有給休暇（全休）</option>
                          <option>有給休暇（午前半休）</option>
                          <option>有給休暇（午後半休）</option>
                          <option>代休（全休）</option>
                          <option>代休（午前半休）</option>
                          <option>代休（午後半休）</option>
                          <option>特別休暇（慶弔など）</option>
                        </>
                      )}
                      <option>打刻修正</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">{leaveType === '打刻修正' ? '対象日' : '開始日'}</label>
                      <input 
                        type="date" 
                        required 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    {leaveType === '打刻修正' ? (
                      <div className="flex space-x-2">
                        <div className="w-1/3">
                          <label className="block text-sm font-bold text-gray-700 mb-1">区分</label>
                          <select 
                            value={punchType}
                            onChange={(e) => setPunchType(e.target.value)}
                            className="block w-full px-2 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                          >
                            <option>出勤</option>
                            <option>退勤</option>
                          </select>
                        </div>
                        <div className="w-2/3">
                          <label className="block text-sm font-bold text-gray-700 mb-1">正しい打刻時間</label>
                          <input 
                            type="time" 
                            required 
                            value={punchTime}
                            onChange={(e) => setPunchTime(e.target.value)}
                            className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">終了日</label>
                        <input 
                          type="date" 
                          required 
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">事由・備考</label>
                    <textarea 
                      rows={3} 
                      required 
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      placeholder="理由を入力してください（私用、通院、体調不良など）"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">添付ファイル（遅延証明書・診断書など）</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition cursor-pointer">
                      <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="flex text-sm text-gray-600 justify-center">
                          <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                            <span>ファイルを選択</span>
                            <input id="file-upload" name="file-upload" type="file" accept="image/*,.pdf" className="sr-only" onChange={handleFileUpload} />
                          </label>
                          <p className="pl-1">またはドラッグ＆ドロップ</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, PDF 最大 10MB（画像は自動で圧縮されます）</p>
                      </div>
                    </div>
                    {compressedFile && (
                      <div className="mt-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200 shadow-sm">
                        <p className="font-medium text-green-800 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          ファイルの添付・圧縮が完了しました
                        </p>
                        <p className="mt-1 ml-5 text-gray-600 text-xs">ファイル名: {compressedFile.name}</p>
                        <p className="mt-0.5 ml-5 text-xs">サイズ: {compressedFile.originalSize} ➔ <span className="font-bold text-green-800">{compressedFile.compressedSize}</span></p>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmittingLeave} 
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
                  >
                    {isSubmittingLeave ? '送信中...' : '申請を送信'}
                  </button>
                </form>
              </div>

              {/* Right Side Column (Info & Recent History) */}
              <div className="space-y-6">
                {/* Leave Balance Quick Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">現在の有給・代休残数</h3>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center bg-blue-50/70 p-2.5 rounded-lg border border-blue-100">
                      <span className="text-xs font-medium text-blue-900">有給休暇（今年度）</span>
                      <span className="text-lg font-bold text-blue-700">{user?.paid_leave_balance || 0}<span className="text-xs font-normal ml-0.5">日</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <span className="text-xs font-medium text-gray-700">有給休暇（繰越分）</span>
                      <span className="text-base font-bold text-gray-700">{user?.paid_leave_carryover || 0}<span className="text-xs font-normal ml-0.5">日</span></span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                      <span className="text-xs font-bold text-slate-800">有給合計残数</span>
                      <span className="text-xl font-bold text-slate-900">
                        {(user?.paid_leave_balance || 0) + (user?.paid_leave_carryover || 0)}
                        <span className="text-xs font-normal ml-0.5">日</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent My Requests Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="text-sm font-bold text-gray-800 border-b pb-2 mb-3">直近の申請履歴・状況</h3>
                  {myRecentRequests.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">過去の申請履歴はありません</p>
                  ) : (
                    <div className="space-y-3">
                      {myRecentRequests.map((req) => {
                        let badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
                        if (req.status === '承認') badgeClass = "bg-green-100 text-green-800 border-green-200";
                        else if (req.status === '却下') badgeClass = "bg-red-100 text-red-800 border-red-200";

                        return (
                          <div key={req.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-gray-800">{req.type}</span>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeClass}`}>
                                  {req.status}
                                </span>
                                {req.status === '申請中' && (
                                  <button
                                    onClick={() => handleCancelRequest(req.id, req.type)}
                                    className="text-[10px] text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md font-bold transition cursor-pointer"
                                    title="申請を取り下げて取消す"
                                  >
                                    ↩️ 取下げ
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-500 text-[11px]">
                              {req.start_date} {req.start_date !== req.end_date ? `～ ${req.end_date}` : ''}
                            </p>
                            {req.reason && (
                              <p className="text-gray-400 text-[11px] mt-1 line-clamp-1 truncate">理由: {req.reason}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'approvals' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium">部下からの承認待ちの申請</h2>
              </div>
              <div className="p-4">
                {pendingApprovals.length === 0 ? (
                  <p className="text-gray-500 text-sm">現在、承認待ちの申請はありません。</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {pendingApprovals.map((req) => {
                      const isShiftReq = req.type === 'シフト希望';
                      const shiftSummaryMatch = isShiftReq ? req.reason?.match(/【([^】]+シフト希望提出[^】]*)】/) : null;
                      const summaryTitle = shiftSummaryMatch ? shiftSummaryMatch[1] : req.type;
                      
                      return (
                        <li key={req.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-2xs hover:border-gray-200 transition mb-3">
                          <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${isShiftReq ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-blue-100 text-blue-800'}`}>
                                {isShiftReq ? '🗓️ シフト希望' : req.type}
                              </span>
                              <p className="text-sm font-bold text-gray-900">
                                {req.user?.name || '不明'} 様（{req.user?.department || '部署未設定'}）
                              </p>
                            </div>

                            <p className="text-xs font-bold text-slate-700">
                              {summaryTitle}（期間: {req.start_date} ～ {req.end_date}）
                            </p>

                            {isShiftReq ? (
                              <details className="text-xs text-gray-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mt-1 cursor-pointer">
                                <summary className="font-bold text-indigo-700 hover:text-indigo-900 select-none">
                                  ▼ 提出されたシフト希望の詳細を見る
                                </summary>
                                <div className="mt-2 text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto bg-white p-2 rounded border border-gray-200">
                                  {req.reason?.split('【シフトデータ')[0] || req.reason}
                                </div>
                              </details>
                            ) : (
                              <p className="text-xs text-gray-500 whitespace-pre-wrap">理由: {req.reason || '記載なし'}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                              onClick={() => handleApprovalAction(req.id, '承認')}
                              className="flex items-center text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-sm transition cursor-pointer"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {isShiftReq ? '承認してシフト確定' : '承認'}
                            </button>
                            <button
                              onClick={() => handleApprovalAction(req.id, '却下')}
                              className="flex items-center text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 px-3 py-2 rounded-xl transition cursor-pointer"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              却下
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rules_ai' && (
            <RulesAiAssistant tenantId={user?.tenant_id} userName={user?.name} />
          )}

          {activeTab === 'payslips' && user && (
            <UserPayslipView userId={user.id} userName={user.name} tenantId={user.tenant_id} />
          )}

        </div>
      </div>
    </div>
    
    {/* ❓ 使い方ガイドモーダル */}
    <HelpGuideModal 
      screenKey="attendance_user" 
      isOpen={isHelpOpen} 
      onClose={() => setIsHelpOpen(false)} 
    />
  </div>
  );
};

export default UserDashboard;
