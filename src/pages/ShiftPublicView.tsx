/**
 * =========================================================================================
 * 🚨【最高軍律遵守コード】アルバイト・現場スタッフ専用 確定シフト公開閲覧画面
 * 
 * 遵守軍律：
 * ・【最高絶対憲法 第9条：URL最優先SSOT】（URLの tenant_id / store で自社・自店へ100%強制バインド）
 * ・【最高絶対憲法 第3条：マルチテナント完全分離】（他社のデータ・下書きデータの露出を物理遮断）
 * ・【最高絶対憲法 第12条：脱開発者目線＆現場適合】（パスワードレス・LINEから1秒で開けるUI）
 * ・【作戦規約 第4条：現場スマホ完全適合】（iPhone/Android 375px〜420pxでの快適閲覧）
 * ・【安全規律：管理者機密完全遮断】（時給・人件費・予算・確定解除・編集ボタンは物理排除）
 * =========================================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Store, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  CheckCircle2, 
  Info
} from 'lucide-react';
import { 
  format, 
  addDays, 
  startOfWeek, 
  addWeeks, 
  subWeeks,
  isToday
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

interface PublicShiftItem {
  id: string;
  user_id: string;
  target_date: string;
  start_time: string;
  end_time: string;
  role: string;
  store_name?: string;
  status: string;
}

interface PublicUserItem {
  id: string;
  name: string;
  store_name?: string;
  department?: string;
}

export default function ShiftPublicView() {
  const [searchParams] = useSearchParams();

  // 🔗 URLクエリからSaaS識別子を取得（憲法9条：URL最優先SSOT）
  const tenantId = searchParams.get('tid') || '';
  const initialStore = searchParams.get('store') || '';
  const initialPeriod = searchParams.get('period') || '';

  const [companyName, setCompanyName] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<string>(initialStore);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (initialPeriod) {
      const parsed = new Date(initialPeriod);
      if (!isNaN(parsed.getTime())) {
        return startOfWeek(parsed, { weekStartsOn: 1 });
      }
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });

  const [shifts, setShifts] = useState<PublicShiftItem[]>([]);
  const [users, setUsers] = useState<PublicUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 🔍 絞り込み用State
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');

  // 🏢 テナント情報の取得（会社名）
  useEffect(() => {
    if (!tenantId) {
      setErrorMessage('無効なアクセスです。店舗のLINEより配信された正規のURLからアクセスしてください。');
      setLoading(false);
      return;
    }

    const fetchTenant = async () => {
      try {
        const { data } = await supabase
          .from('tenants')
          .select('name, company_name')
          .eq('id', tenantId)
          .maybeSingle();

        if (data) {
          setCompanyName(data.company_name || data.name || 'みんなのらくまる労務');
        }
      } catch (err) {
        console.error('Failed to load tenant info:', err);
      }
    };

    fetchTenant();
  }, [tenantId]);

  // 📅 確定シフトデータの取得（憲法3条：テナント分離 ＆ confirmedのみ厳格抽出）
  useEffect(() => {
    if (!tenantId) return;

    const fetchConfirmedShifts = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
        const weekEndStr = format(addDays(currentWeekStart, 13), 'yyyy-MM-dd'); // 2週間分取得して滑らかに表示

        // 1. ユーザーマスタ取得（氏名マッピング用）
        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('id, name, store_name, department')
          .eq('tenant_id', tenantId);

        if (usersErr) throw usersErr;
        setUsers(usersData || []);

        // 2. 確定シフト取得（下書き・未確定は除外！）
        let query = supabase
          .from('advanced_shifts')
          .select('id, user_id, target_date, start_time, end_time, role, store_name, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'confirmed') // 🛡️ 確定シフトのみ！
          .gte('target_date', weekStartStr)
          .lte('target_date', weekEndStr);

        const { data: shiftsData, error: shiftsErr } = await query;
        if (shiftsErr) throw shiftsErr;

        setShifts(shiftsData || []);
      } catch (err: any) {
        console.error('Error fetching public shifts:', err);
        setErrorMessage('シフト情報の取得に失敗しました。電波の良い場所で再度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchConfirmedShifts();
  }, [tenantId, currentWeekStart]);

  // 👥 ユーザーIDから氏名を取得するマップ
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      map[u.id] = u.name;
    });
    return map;
  }, [users]);

  // 🏪 利用可能な店舗一覧
  const availableStores = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach(s => {
      if (s.store_name) set.add(s.store_name);
    });
    users.forEach(u => {
      if (u.store_name) set.add(u.store_name);
    });
    return Array.from(set);
  }, [shifts, users]);

  // フィルター後のシフト
  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      // 店舗フィルター
      if (selectedStore && selectedStore !== 'all') {
        if (s.store_name && s.store_name !== selectedStore) return false;
      }
      // スタッフフィルター
      if (selectedStaffFilter !== 'all') {
        if (s.user_id !== selectedStaffFilter) return false;
      }
      return true;
    });
  }, [shifts, selectedStore, selectedStaffFilter]);

  // 表示中の7日間の日付配列
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // 日付ごとのシフトグループ化
  const shiftsByDate = useMemo(() => {
    const map: Record<string, PublicShiftItem[]> = {};
    weekDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      map[dateStr] = [];
    });

    filteredShifts.forEach(s => {
      if (map[s.target_date]) {
        map[s.target_date].push(s);
      }
    });

    // 開始時間順にソート
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    });

    return map;
  }, [filteredShifts, weekDays]);

  // 週送りナビゲーション
  const handlePrevWeek = () => setCurrentWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentWeekStart(prev => addWeeks(prev, 1));
  const handleCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-200 p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">シフトを読み込めませんでした</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            {errorMessage}
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left text-xs text-amber-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>店舗の店長または管理者に連絡し、LINEの最新確定シフト通知リンクを再送してもらってください。</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-gray-800 pb-16 font-sans">
      {/* 📱 モバイルフレンドリー固定ヘッダー */}
      <header className="sticky top-0 z-30 bg-indigo-700 text-white shadow-md border-b border-indigo-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-indigo-200 tracking-wide">
                {companyName || 'みんなのらくまる労務'}
              </div>
              <h1 className="text-base font-bold flex items-center gap-1.5 leading-tight">
                <span>確定シフト表</span>
                {selectedStore && selectedStore !== 'all' && (
                  <span className="bg-indigo-900/60 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-400/30">
                    {selectedStore}
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3 text-emerald-300" />
              確定版
            </span>
          </div>
        </div>

        {/* ⚠️ 店舗ルール（代打・変更の鉄則）ミニバナー */}
        <div className="bg-amber-500 text-amber-950 px-4 py-1.5 text-[11px] font-medium flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-900" />
            <span className="truncate">【変更ルール】確定後の交代は3日前までに代打確保＆店長承認が必要です</span>
          </div>
          <a 
            href="#rules" 
            className="underline shrink-0 text-[10px] font-bold hover:text-white ml-2"
          >
            詳細
          </a>
        </div>
      </header>

      {/* 🧭 メインコンテンツ枠 */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        
        {/* 🔍 スマホ用クイック絞り込みバー */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* 店舗セレクト（複数店舗ある場合） */}
            {availableStores.length > 1 && (
              <div className="flex-1 min-w-[130px]">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Store className="w-3 h-3" /> 店舗切替
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => setSelectedStore(e.target.value)}
                  className="w-full text-xs font-semibold bg-slate-50 border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="all">全店舗を表示</option>
                  {availableStores.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            )}

            {/* スタッフ絞り込み（自分の名前を探す！） */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1">
                <Search className="w-3 h-3 text-indigo-600" /> 自分の名前で絞り込む
              </label>
              <select
                value={selectedStaffFilter}
                onChange={(e) => setSelectedStaffFilter(e.target.value)}
                className="w-full text-xs font-bold text-indigo-900 bg-indigo-50/70 border border-indigo-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">全員を表示（全体シフト）</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} {u.store_name ? `(${u.store_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedStaffFilter !== 'all' && (
            <div className="bg-indigo-50 rounded-lg p-2 flex items-center justify-between text-xs text-indigo-900 font-medium">
              <span>👤 <strong>{userNameMap[selectedStaffFilter] || 'スタッフ'}</strong> さんの予定のみを表示中</span>
              <button 
                onClick={() => setSelectedStaffFilter('all')}
                className="text-[11px] text-indigo-600 font-bold hover:underline"
              >
                解除して全員表示
              </button>
            </div>
          )}
        </div>

        {/* 📅 週送りコントローラー */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 flex items-center justify-between">
          <button
            onClick={handlePrevWeek}
            className="flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">前の週</span>
          </button>

          <div className="text-center">
            <div className="text-xs sm:text-sm font-extrabold text-gray-900">
              {format(currentWeekStart, 'yyyy年M月d日(E)', { locale: ja })} 〜 {format(addDays(currentWeekStart, 6), 'M月d日(E)', { locale: ja })}
            </div>
            <button
              onClick={handleCurrentWeek}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline mt-0.5 inline-block"
            >
              今週に戻る
            </button>
          </div>

          <button
            onClick={handleNextWeek}
            className="flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <span className="hidden sm:inline">次の週</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 📱 日別カードタイムライン表示（スマホ完全特化） */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-3"></div>
            <p className="text-sm font-medium text-gray-600">シフトデータを読み込んでいます...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayShifts = shiftsByDate[dateStr] || [];
              const today = isToday(day);
              const dayOfWeek = day.getDay();
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;

              return (
                <div 
                  key={dateStr}
                  className={`bg-white rounded-xl shadow-sm border transition-all ${
                    today 
                      ? 'border-indigo-400 ring-2 ring-indigo-300/50 shadow-md' 
                      : 'border-slate-200'
                  }`}
                >
                  {/* 日付ヘッダー */}
                  <div className={`px-3.5 py-2.5 border-b flex items-center justify-between rounded-t-xl ${
                    today 
                      ? 'bg-indigo-50 border-indigo-200' 
                      : isSunday 
                        ? 'bg-rose-50/50 border-rose-100' 
                        : isSaturday 
                          ? 'bg-blue-50/50 border-blue-100' 
                          : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-extrabold ${
                        isSunday ? 'text-rose-600' : isSaturday ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {format(day, 'M/d (E)', { locale: ja })}
                      </span>
                      {today && (
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          本日
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-semibold text-gray-500">
                      出勤: <strong className="text-gray-800">{dayShifts.length}名</strong>
                    </div>
                  </div>

                  {/* 出勤スタッフ一覧 */}
                  <div className="p-3">
                    {dayShifts.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-400 font-medium">
                        出勤予定はありません
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {dayShifts.map(s => {
                          const staffName = userNameMap[s.user_id] || 'スタッフ';
                          const start = s.start_time ? s.start_time.substring(0, 5) : '--:--';
                          const end = s.end_time ? s.end_time.substring(0, 5) : '--:--';
                          const isHighlighted = selectedStaffFilter === s.user_id;

                          return (
                            <div 
                              key={s.id}
                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-colors ${
                                isHighlighted
                                  ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400'
                                  : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isHighlighted 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-slate-200 text-gray-700'
                                }`}>
                                  {staffName.charAt(0)}
                                </div>
                                <div className="truncate">
                                  <div className="font-bold text-gray-900 truncate flex items-center gap-1.5">
                                    <span>{staffName}</span>
                                    {s.role && (
                                      <span className="bg-white text-gray-600 text-[10px] font-medium px-1.5 py-0.2 rounded border border-gray-200">
                                        {s.role}
                                      </span>
                                    )}
                                  </div>
                                  {s.store_name && selectedStore === 'all' && (
                                    <div className="text-[10px] text-gray-500 truncate">
                                      {s.store_name}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="font-extrabold text-indigo-700 flex items-center gap-1 text-xs">
                                  <Clock className="w-3 h-3 text-indigo-500" />
                                  <span>{start} 〜 {end}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ⚠️ 店舗公式モラルハザード防止規約（詳細フッターカード） */}
        <section id="rules" className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 mt-6 space-y-3">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3>店舗ルール：シフト確定後の変更・お休みについて</h3>
          </div>
          <div className="text-xs text-gray-700 space-y-2 leading-relaxed bg-rose-50/50 p-3.5 rounded-xl border border-rose-100">
            <p className="font-semibold text-rose-900">
              シフトは店舗の営業と仲間を守る大切な約束です。以下のルールを必ず厳守してください。
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-1">
              <li>
                <strong>確定後の自己都合による変更・キャンセルは原則不可</strong>です。
              </li>
              <li>
                やむを得ず勤務日を変更・交代したい場合は、<strong>必ず【3日前までに代打スタッフを見つけ、店長の事前承認】</strong>を得てください。
              </li>
              <li>
                当日の急病や突発的な事故などの緊急事態は、LINEではなく<strong>必ず【店長へ直接お電話】</strong>でご連絡ください。
              </li>
            </ul>
          </div>
        </section>

        {/* 📱 画面下部の案内 */}
        <div className="text-center text-[11px] text-gray-400 py-4">
          みんなのらくまる労務 © {new Date().getFullYear()} {companyName || 'SaaS Shift Management'}
        </div>
      </main>
    </div>
  );
}
