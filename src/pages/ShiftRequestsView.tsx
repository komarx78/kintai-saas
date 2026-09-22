import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, ClipboardList, ChevronLeft, ChevronRight, 
  Clock, User, Users, Calendar, Search, 
  CheckCircle2, XCircle, Sparkles, LayoutGrid, List,
  Building2, MapPin, Store
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import AppSwitcher from '../components/AppSwitcher';
import { fetchStoresUnified, getStoresFromStorage } from '../lib/storeMaster';
import { seedShiftDemoData } from '../lib/seedShiftDemoData';

interface ShiftRequest {
  id: string;
  user_id: string;
  target_date: string;
  available_start_time: string | null;
  available_end_time: string | null;
  preferred_role: string | null;
  status?: string;
  user?: {
    id: string;
    name: string;
    email?: string;
    department?: string;
    store_name?: string;
  };
}

export const ShiftRequestsView: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ShiftRequest[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email?: string; department?: string; store_name?: string }[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'staff' | 'list'>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'working' | 'off'>('all');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  useEffect(() => {
    fetchRequests();
  }, [weekStart, weekEnd]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) {
        setLoading(false);
        return;
      }

      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      // 1. シフト希望データ取得
      const { data: reqData, error: reqErr } = await supabase
        .from('advanced_shift_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('target_date', startDate)
        .lte('target_date', endDate)
        .order('target_date', { ascending: true });

      if (reqErr) throw reqErr;

      // 2. スタッフ一覧取得（store_name を含めて取得）
      let userList: any[] = [];
      try {
        const { data: uData } = await supabase
          .from('users')
          .select('id, name, email, department, store_name')
          .eq('tenant_id', tenantId);
        userList = uData || [];
      } catch {
        const { data: uData } = await supabase
          .from('users')
          .select('id, name, email, department')
          .eq('tenant_id', tenantId);
        userList = uData || [];
      }

      // LocalStorage user_positions からの store_name フォールバックマージ
      try {
        const localPosMap = JSON.parse(localStorage.getItem(`user_positions_${tenantId}`) || '{}');
        userList = userList.map(u => ({
          ...u,
          store_name: u.store_name || localPosMap[u.id]?.store_name || ''
        }));
      } catch {}

      // 🏢 本部スタッフ（総務・人事・管理部・営業部など、シフト勤務を行わないスタッフ）を完全除外
      const HQ_DEPARTMENTS = ['総務部', '総務・管理部', '管理部', '人事部', '経理部', '財務部', '営業部', '企画部', '開発部', 'IT部', '本部', '役員'];
      let filteredShiftUsers = userList.filter((u: any) => {
        if (u.store_name && u.store_name.trim() !== '') return true;
        if (HQ_DEPARTMENTS.includes(u.department || '')) return false;
        if (u.department === '店舗運営部') return true;
        return false;
      });

      // 🛡️ 救済フォールバック：初期状態などでまだ全員が店舗未設定・店舗運営部以外の場合、役員以外を全スタッフ候補として採用
      if (filteredShiftUsers.length === 0 && userList.length > 0) {
        filteredShiftUsers = userList.filter((u: any) => u.department !== '役員');
      }

      setUsers(filteredShiftUsers);

      // 🏪 店舗マスタ（store_masters）から純粋な店舗リストを取得（総務・人事等の本部部門は除外）
      let storeNames: string[] = [];
      try {
        const loadedStores = await fetchStoresUnified(tenantId);
        storeNames = loadedStores.map(s => s.name).filter(Boolean);
      } catch {
        storeNames = getStoresFromStorage(tenantId).map(s => s.name).filter(Boolean);
      }
      if (storeNames.length === 0) {
        storeNames = ['新宿店', '渋谷店', '池袋店'];
      }
      setDepartmentsList(storeNames);

      const userMap: Record<string, { id: string; name: string; email?: string; department?: string; store_name?: string }> = {};
      filteredShiftUsers.forEach((u: any) => {
        userMap[u.id] = { id: u.id, name: u.name || '（名称未設定）', email: u.email, department: u.department, store_name: u.store_name };
      });

      const formatted: ShiftRequest[] = (reqData || [])
        .filter((r: any) => !!userMap[r.user_id])
        .map((r: any) => ({
          id: r.id,
          user_id: r.user_id,
          target_date: r.target_date,
          available_start_time: r.available_start_time || null,
          available_end_time: r.available_end_time || null,
          preferred_role: r.preferred_role || null,
          status: r.status,
          user: userMap[r.user_id]!
        }));

      setRequests(formatted);
    } catch (error) {
      console.error('希望データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🕒 安全な時間帯フォーマット（null/undefined クラッシュ完全防御）
  const formatTimeSlot = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start && !end) return null;
    const s = start ? String(start).slice(0, 5) : '';
    const e = end ? String(end).slice(0, 5) : '';
    if (!s && !e) return null;
    return `${s || '00:00'} 〜 ${e || '24:00'}`;
  };

  // 集計統計
  const stats = useMemo(() => {
    const total = requests.length;
    let working = 0;
    let off = 0;
    const staffSet = new Set<string>();

    requests.forEach(r => {
      staffSet.add(r.user_id);
      if (r.available_start_time || r.available_end_time) {
        working++;
      } else {
        off++;
      }
    });

    return { total, working, off, staffCount: staffSet.size };
  }, [requests]);

  // フィルタリング
  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      // 店舗フィルター（所属店舗 store_name 優先、未設定時は department）
      if (selectedDepartment !== 'all') {
        const uStore = r.user?.store_name || r.user?.department;
        if (uStore !== selectedDepartment) return false;
      }

      // 検索フィルター
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (r.user?.name || '').toLowerCase().includes(q);
        const roleMatch = (r.preferred_role || '').toLowerCase().includes(q);
        if (!nameMatch && !roleMatch) return false;
      }

      // 種類フィルター
      const isWorking = !!(r.available_start_time || r.available_end_time);
      if (typeFilter === 'working' && !isWorking) return false;
      if (typeFilter === 'off' && isWorking) return false;

      return true;
    });
  }, [requests, selectedDepartment, searchQuery, typeFilter]);

  // 🧪 ダミー希望データの一括投入（店舗配属・必要時間枠・希望シフトを一元生成）
  const handleGenerateDummy = async () => {
    if (!window.confirm('【検証用ダミーデータ一括生成】\n全スタッフを3店舗（新宿・渋谷・池袋）に自動配属し、各店舗の必要枠マスタと今週〜来週のダミー希望シフトを一括投入しますか？\n（既存の希望データは上書きされます）')) return;
    setGenerating(true);
    try {
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      if (!tenantId) {
        alert('テナントIDが取得できませんでした。');
        return;
      }

      const res = await seedShiftDemoData(tenantId);
      if (!res.success) {
        alert('ダミーデータの生成に失敗しました: ' + res.message);
        return;
      }

      alert(`🎉 ${res.message}`);
      await fetchRequests();
    } catch (err: any) {
      console.error('ダミー生成エラー:', err);
      alert('ダミー生成に失敗しました: ' + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* 画面最上部：固定ヘッダーバー */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/shift/admin')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            title="シフト管理画面へ戻る"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">シフト管理</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                提出されたシフト希望一覧
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  全{stats.total}件
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-bold">スタッフの出勤・休み希望を確認</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={handleGenerateDummy}
            disabled={generating}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition font-bold text-xs shadow-2xs cursor-pointer"
            title="全スタッフ分のテスト希望データを投入します"
          >
            {generating ? (
              <div className="animate-spin w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
            )}
            <span className="hidden sm:inline">ダミー希望一括投入</span>
          </button>

          <AppSwitcher currentApp="shift" role="admin" />
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        
        {/* ナビゲーション ＆ サマリーカード */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* 週送りナビゲーション */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                onClick={() => setCurrentDate(addDays(currentDate, -7))}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition cursor-pointer"
                title="前週へ"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-2.5 py-1 hover:bg-white rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                今週
              </button>
              <button
                onClick={() => setCurrentDate(addDays(currentDate, 7))}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition cursor-pointer"
                title="翌週へ"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <span className="font-black text-slate-800 text-sm sm:text-base">
                {format(weekStart, 'yyyy年M月d日', { locale: ja })} ({format(weekStart, 'E', { locale: ja })}) 〜 {format(weekEnd, 'M月d日', { locale: ja })} ({format(weekEnd, 'E', { locale: ja })})
              </span>
            </div>
          </div>

          {/* 集計バッジ群 */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-slate-700">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>提出済: <strong className="text-slate-900 font-mono text-sm">{stats.staffCount}</strong> 名</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>出勤希望: <strong className="font-mono text-sm">{stats.working}</strong> 件</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-rose-800">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>休み希望: <strong className="font-mono text-sm">{stats.off}</strong> 件</span>
            </div>
          </div>
        </div>

        {/* 🏪 店舗セレクターバー */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <div className="flex items-center text-slate-700 font-bold text-xs mr-1">
              <Building2 className="w-4 h-4 text-indigo-600 mr-1.5" />
              <span>店舗絞り込み:</span>
            </div>

            <button
              onClick={() => setSelectedDepartment('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                selectedDepartment === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>全社・全店舗</span>
            </button>

            {departmentsList.map(deptName => {
              const isSelected = selectedDepartment === deptName;
              return (
                <button
                  key={deptName}
                  onClick={() => setSelectedDepartment(deptName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{deptName}</span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            表示中: <strong className="text-slate-800 font-bold">{filteredRequests.length}</strong> 件の希望
          </div>
        </div>

        {/* 表示切替タブ ＆ 検索バー */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          {/* タブ切り替え */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'day' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>曜日・日付別</span>
            </button>
            <button
              onClick={() => setViewMode('staff')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'staff' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>スタッフ別（週間表）</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>全件リスト一覧</span>
            </button>
          </div>

          {/* 検索 ＆ 絞り込みフィルター */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="スタッフ名・職種で検索..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  typeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全種
              </button>
              <button
                onClick={() => setTypeFilter('working')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  typeFilter === 'working' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                出勤
              </button>
              <button
                onClick={() => setTypeFilter('off')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  typeFilter === 'off' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                休み
              </button>
            </div>
          </div>
        </div>

        {/* ── メイン表示部 ── */}
        {loading ? (
          <div className="bg-white rounded-3xl p-16 flex flex-col items-center justify-center space-y-4 border border-slate-200 shadow-xs">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full" />
            <p className="text-sm font-bold text-slate-500">提出データを読み込み中...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs space-y-4">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">この週のシフト希望はまだ提出されていません</h3>
              <p className="text-xs text-slate-400 mt-1">
                右上の「ダミー希望一括投入」ボタンを押すことで、検証用の希望データを一括生成して動作確認できます。
              </p>
            </div>
            <button
              onClick={handleGenerateDummy}
              disabled={generating}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 fill-white" />
              <span>ダミー希望を一括投入してテストする</span>
            </button>
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════
                1. 曜日・日付別ビュー（管理者が最も使いやすいデフォルト）
               ══════════════════════════════════════════════════════════════ */}
            {viewMode === 'day' && (
              <div className="space-y-4">
                {/* 曜日セレクターボタン群 */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2 bg-white p-2 sm:p-3 rounded-2xl border border-slate-200 shadow-xs">
                  {weekDays.map((day, idx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayReqs = requests.filter(r => r.target_date === dateStr);
                    const workingCount = dayReqs.filter(r => r.available_start_time || r.available_end_time).length;
                    const isSelected = selectedDayIndex === idx;
                    const isSat = day.getDay() === 6;
                    const isSun = day.getDay() === 0;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDayIndex(idx)}
                        className={`p-2 sm:p-3 rounded-xl flex flex-col items-center transition cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-102'
                            : 'bg-slate-50 hover:bg-indigo-50/50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span className={`text-[10px] font-bold ${
                          isSelected
                            ? 'text-indigo-200'
                            : isSat ? 'text-blue-600' : isSun ? 'text-red-500' : 'text-slate-400'
                        }`}>
                          {format(day, 'E', { locale: ja })}
                        </span>
                        <span className="text-base sm:text-lg font-black my-0.5">
                          {format(day, 'M/d')}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          出勤{workingCount}名
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 選択された曜日の希望詳細カード */}
                {(() => {
                  const targetDay = weekDays[selectedDayIndex] || weekDays[0];
                  const targetDateStr = format(targetDay, 'yyyy-MM-dd');
                  const dayReqs = filteredRequests.filter(r => r.target_date === targetDateStr);
                  const workingList = dayReqs.filter(r => r.available_start_time || r.available_end_time);
                  const offList = dayReqs.filter(r => !r.available_start_time && !r.available_end_time);

                  return (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-xs">
                            {format(targetDay, 'd')}
                          </div>
                          <div>
                            <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                              {format(targetDay, 'yyyy年M月d日')}（{format(targetDay, 'E', { locale: ja })}曜日）の希望状況
                            </h3>
                            <p className="text-xs text-slate-500">
                              出勤希望: <strong className="text-emerald-700">{workingList.length}名</strong> / 休み希望: <strong className="text-rose-700">{offList.length}名</strong>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 出勤希望スタッフ一覧 */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-emerald-800 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>出勤希望スタッフ（{workingList.length}名）</span>
                          </h4>

                          {workingList.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl">
                              この日の出勤希望はありません
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {workingList.map(req => {
                                const timeSlot = formatTimeSlot(req.available_start_time, req.available_end_time);
                                return (
                                  <div
                                    key={req.id}
                                    className="p-3 bg-slate-50 hover:bg-emerald-50/40 rounded-2xl border border-slate-200 flex items-center justify-between transition"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0">
                                        {req.user?.name ? req.user.name.slice(0, 1) : <User className="w-4 h-4" />}
                                      </div>
                                      <div>
                                        <div className="font-black text-slate-800 text-sm">{req.user?.name}</div>
                                        {req.preferred_role && (
                                          <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.2 rounded font-bold">
                                            {req.preferred_role}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      <span className="inline-flex items-center gap-1 text-xs font-mono font-black text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs">
                                        <Clock className="w-3 h-3 text-emerald-600" />
                                        {timeSlot}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 休み希望スタッフ一覧 */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-rose-800 flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>休み希望スタッフ（{offList.length}名）</span>
                          </h4>

                          {offList.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl">
                              この日の休み希望はありません
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {offList.map(req => (
                                <div
                                  key={req.id}
                                  className="p-3 bg-slate-50 hover:bg-rose-50/40 rounded-2xl border border-slate-200 flex items-center justify-between transition"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0">
                                      {req.user?.name ? req.user.name.slice(0, 1) : <User className="w-4 h-4" />}
                                    </div>
                                    <div>
                                      <div className="font-black text-slate-800 text-sm">{req.user?.name}</div>
                                      <div className="text-[10px] text-slate-400 font-bold">{req.user?.email}</div>
                                    </div>
                                  </div>

                                  <div>
                                    <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-white px-2.5 py-1 rounded-lg border border-rose-300 shadow-2xs">
                                      ❌ 休み希望
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                2. スタッフ別（週間マトリクス）ビュー
               ══════════════════════════════════════════════════════════════ */}
            {viewMode === 'staff' && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-black text-slate-800 text-sm">
                    スタッフ別 週間希望マトリクス（全{users.length}名）
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    各スタッフの1週間の希望（出勤・休み）を一覧で比較できます
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-black">
                        <th className="p-3 w-40 sticky left-0 bg-slate-100 shadow-xs">スタッフ名</th>
                        {weekDays.map(day => (
                          <th key={day.toISOString()} className="p-2.5 text-center font-bold">
                            <div>{format(day, 'E', { locale: ja })}</div>
                            <div className="text-slate-900 font-black">{format(day, 'M/d')}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {users
                        .filter(u => {
                          if (selectedDepartment !== 'all') {
                            const uStore = u.store_name || u.department;
                            if (uStore !== selectedDepartment) return false;
                          }
                          return !searchQuery.trim() || u.name?.toLowerCase().includes(searchQuery.toLowerCase());
                        })
                        .map(staff => {
                          const staffReqs = requests.filter(r => r.user_id === staff.id);

                          return (
                            <tr key={staff.id} className="hover:bg-slate-50 transition">
                              <td className="p-3 font-black text-slate-800 sticky left-0 bg-white border-r border-slate-100 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                                    {staff.name ? staff.name.slice(0, 1) : 'U'}
                                  </div>
                                  <span className="truncate">{staff.name || '（名称未設定）'}</span>
                                </div>
                              </td>

                              {weekDays.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const req = staffReqs.find(r => r.target_date === dateStr);

                                if (!req) {
                                  return (
                                    <td key={dateStr} className="p-2 text-center text-slate-300">
                                      -
                                    </td>
                                  );
                                }

                                const isWorking = !!(req.available_start_time || req.available_end_time);
                                const timeSlot = formatTimeSlot(req.available_start_time, req.available_end_time);

                                return (
                                  <td key={dateStr} className="p-1.5 text-center">
                                    {isWorking ? (
                                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-1 rounded-lg text-[10px] font-mono leading-tight">
                                        <div>{timeSlot}</div>
                                        {req.preferred_role && (
                                          <div className="text-[9px] text-purple-700 font-sans">{req.preferred_role}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="inline-block bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[10px]">
                                        休み
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                3. 全件リスト一覧ビュー（検索・ソート・詳細確認）
               ══════════════════════════════════════════════════════════════ */}
            {viewMode === 'list' && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-800 text-sm">
                    希望一覧リスト（該当 {filteredRequests.length} 件）
                  </h3>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredRequests.map(req => {
                    const isWorking = !!(req.available_start_time || req.available_end_time);
                    const timeSlot = formatTimeSlot(req.available_start_time, req.available_end_time);

                    return (
                      <div
                        key={req.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            isWorking ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {isWorking ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                          </div>

                          <div>
                            <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                              <span>{req.user?.name || '不明なスタッフ'}</span>
                              {req.preferred_role && (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.2 rounded font-bold">
                                  {req.preferred_role}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-bold flex items-center gap-2 mt-0.5">
                              <span>{req.user?.email}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <div className="font-black text-xs text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                            {req.target_date}
                          </div>

                          {isWorking ? (
                            <span className="inline-flex items-center gap-1 text-xs font-mono font-black text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                              <Clock className="w-3 h-3 text-emerald-600" />
                              {timeSlot}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                              ❌ 休み希望
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ShiftRequestsView;
