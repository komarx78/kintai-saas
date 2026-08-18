import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, ChevronLeft, ChevronRight, ArrowLeft, Clock, Save, X, CheckSquare, Trash2, List, LayoutGrid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppSwitcher from '../components/AppSwitcher';

type ShiftPattern = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
};

type Employee = {
  id: string;
  name: string;
  department: string | null;
};

type Shift = {
  id: string;
  user_id: string;
  work_date: string;
  pattern_id: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  color: string | null;
};

export default function AdminShifts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date()); // 月間用
  const [dailyDate, setDailyDate] = useState(new Date());     // 日別用
  
  const [activeTab, setActiveTab] = useState<'monthly' | 'daily'>('monthly');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  // 複数選択用の state (セルID: userId_dateStr)
  const [selectedCells, setSelectedCells] = useState<string[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'pattern' | 'custom'>('pattern');
  const [editShift, setEditShift] = useState<Partial<Shift>>({});
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    fetchData();
  }, [currentDate, dailyDate, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: tenantData } = await supabase.rpc('get_user_tenant_id');
      const tId = tenantData;
      setTenantId(tId);

      if (tId) {
        // Fetch employees
        const { data: empData } = await supabase
          .from('users')
          .select('id, name, department')
          .eq('tenant_id', tId)
          .order('name');
        
        if (empData) setEmployees(empData);

        // Fetch patterns
        const { data: patData } = await supabase
          .from('shift_patterns')
          .select('*')
          .eq('tenant_id', tId);
        
        if (patData) setPatterns(patData);

        // Fetch shifts for the current view
        let startDate, endDate;
        if (activeTab === 'monthly') {
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
          endDate = `${year}-${String(month + 1).padStart(2, '0')}-${daysInMonth}`;
        } else {
          // 日別ビューの場合は、その前後を含めて余裕を持って取得する
          const dYear = dailyDate.getFullYear();
          const dMonth = dailyDate.getMonth();
          const dDaysInMonth = new Date(dYear, dMonth + 1, 0).getDate();
          startDate = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-01`;
          endDate = `${dYear}-${String(dMonth + 1).padStart(2, '0')}-${dDaysInMonth}`;
        }
        
        const { data: shiftData } = await supabase
          .from('shifts')
          .select('*')
          .eq('tenant_id', tId)
          .gte('work_date', startDate)
          .lte('work_date', endDate);
          
        if (shiftData) setShifts(shiftData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getShiftForCell = (userId: string, dateStr: string) => {
    return shifts.find(s => s.user_id === userId && s.work_date === dateStr);
  };

  const toggleCellSelection = (userId: string, dateStr: string) => {
    const cellId = `${userId}_${dateStr}`;
    if (selectedCells.includes(cellId)) {
      setSelectedCells(selectedCells.filter(id => id !== cellId));
    } else {
      setSelectedCells([...selectedCells, cellId]);
    }
  };

  const handleOpenBulkModal = () => {
    if (selectedCells.length === 0) return;
    
    if (selectedCells.length === 1) {
      const [userId, dateStr] = selectedCells[0].split('_');
      const existing = getShiftForCell(userId, dateStr);
      if (existing) {
        setEditShift(existing);
        setInputMode(existing.pattern_id ? 'pattern' : 'custom');
      } else {
        setEditShift({ pattern_id: patterns.length > 0 ? patterns[0].id : null, color: '#9CA3AF' });
        setInputMode('pattern');
      }
    } else {
      setEditShift({ pattern_id: patterns.length > 0 ? patterns[0].id : null, color: '#9CA3AF' });
      setInputMode('pattern');
    }
    
    setIsModalOpen(true);
  };

  const handleSaveShift = async () => {
    if (!tenantId || selectedCells.length === 0) return;

    try {
      let baseData: any = { tenant_id: tenantId };

      if (inputMode === 'pattern') {
        const pattern = patterns.find(p => p.id === editShift.pattern_id);
        if (!pattern) {
          alert('パターンを選択してください');
          return;
        }
        baseData.pattern_id = pattern.id;
        baseData.start_time = pattern.start_time;
        baseData.end_time = pattern.end_time;
        baseData.break_minutes = pattern.break_minutes;
        baseData.color = null; // パターンの色を使う
      } else {
        if (!editShift.start_time || !editShift.end_time) {
          alert('開始時間と終了時間を入力してください');
          return;
        }
        baseData.pattern_id = null;
        baseData.start_time = editShift.start_time;
        baseData.end_time = editShift.end_time;
        baseData.break_minutes = editShift.break_minutes || 0;
        baseData.color = editShift.color || '#9CA3AF'; // 手入力のカラー
      }

      // 複数日を一括でUpsertする
      const upsertData = selectedCells.map(cellId => {
        const [userId, dateStr] = cellId.split('_');
        const existing = getShiftForCell(userId, dateStr);
        return {
          ...(existing ? { id: existing.id } : {}), // 既存があればidを含める(UPDATE)
          ...baseData,
          user_id: userId,
          work_date: dateStr,
        };
      });

      const { error } = await supabase.from('shifts').upsert(upsertData);
      if (error) throw error;

      setIsModalOpen(false);
      setSelectedCells([]);
      fetchData(); // reload
    } catch (err: any) {
      console.error(err);
      alert('シフトの保存に失敗しました: ' + (err.message || ''));
    }
  };

  const handleDeleteShift = async () => {
    if (selectedCells.length === 0) return;
    if (!confirm(`選択された ${selectedCells.length} 件のシフトを削除しますか？`)) return;
    
    try {
      // 既存のシフトIDを抽出して削除
      const idsToDelete = selectedCells.map(cellId => {
        const [userId, dateStr] = cellId.split('_');
        const existing = getShiftForCell(userId, dateStr);
        return existing ? existing.id : null;
      }).filter(Boolean) as string[];

      if (idsToDelete.length > 0) {
        const { error } = await supabase.from('shifts').delete().in('id', idsToDelete);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setSelectedCells([]);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  // 月間マトリックスビュー
  const renderMonthlyView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
        <div className="flex items-center space-x-4 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <button onClick={handlePrevMonth} className="p-1.5 rounded hover:bg-gray-100 transition">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <label className="font-bold text-gray-800 flex items-center justify-center text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
            <Calendar className="w-4 h-4 mr-2 text-blue-600" />
            <input
              type="month"
              value={`${year}-${String(month + 1).padStart(2, '0')}`}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m] = e.target.value.split('-');
                  setCurrentDate(new Date(parseInt(y), parseInt(m) - 1, 1));
                }
              }}
              className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer font-bold text-gray-800"
            />
          </label>
          <button onClick={handleNextMonth} className="p-1.5 rounded hover:bg-gray-100 transition">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="text-sm text-gray-500">
          マスをクリックして複数選択し、一括でシフトを入力できます。
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1 relative">
        <table className="w-full border-collapse min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-gray-50 p-3 min-w-[120px] border-b border-r border-gray-200 text-left font-medium text-gray-600 shadow-[1px_1px_0_0_#e5e7eb]">
                従業員
              </th>
              {days.map(day => {
                const date = new Date(year, month, day);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <th 
                    key={day} 
                    className={`sticky top-0 z-10 min-w-[70px] p-2 text-center border-b border-r border-gray-200 font-medium text-sm
                      ${isWeekend ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}
                    `}
                  >
                    <div className="flex flex-col items-center">
                      <span>{day}</span>
                      <span className="text-[10px] font-normal opacity-70">
                        {['日', '月', '火', '水', '木', '金', '土'][date.getDay()]}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={daysInMonth + 1} className="p-8 text-center text-gray-500">
                  従業員が見つかりません。
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-blue-50/10 transition-colors">
                  <td className="sticky left-0 z-10 bg-white p-2 border-b border-r border-gray-200 shadow-[1px_0_0_0_#e5e7eb]">
                    <div className="font-medium text-gray-800 text-xs truncate max-w-[120px]">{emp.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{emp.department || '-'}</div>
                  </td>
                  {days.map(day => {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const shift = getShiftForCell(emp.id, dateStr);
                    let pattern = shift?.pattern_id ? patterns.find(p => p.id === shift.pattern_id) : null;
                    const cellId = `${emp.id}_${dateStr}`;
                    const isSelected = selectedCells.includes(cellId);
                    
                    // 表示色の決定 (パターンの色 or 手入力の色)
                    const bgColor = pattern ? pattern.color : (shift?.color || '#9CA3AF');
                    
                    return (
                      <td 
                        key={day} 
                        onClick={() => toggleCellSelection(emp.id, dateStr)}
                        className={`border-b border-r border-gray-100 p-0.5 cursor-pointer transition-all relative
                          ${isSelected ? 'bg-blue-100 outline outline-2 outline-blue-500 outline-offset-[-2px]' : 'hover:bg-blue-50'}
                        `}
                      >
                        <div className="w-full h-full min-h-[44px] rounded flex flex-col items-center justify-center select-none">
                          {shift ? (
                            <div 
                              className={`w-full h-full rounded flex flex-col items-center justify-center leading-none shadow-sm p-0.5 text-white`}
                              style={{ backgroundColor: bgColor }}
                              title={pattern ? `${pattern.name} (${shift.start_time?.slice(0, 5)} - ${shift.end_time?.slice(0, 5)})` : `直接入力 (${shift.start_time?.slice(0, 5)} - ${shift.end_time?.slice(0, 5)})`}
                            >
                              <span className="text-[8px] opacity-90 truncate w-full text-center mb-0.5 font-medium">
                                {pattern ? pattern.name : '直接入力'}
                              </span>
                              <span className="text-[10px] font-bold">{shift.start_time?.slice(0, 5)}</span>
                              <span className="text-[10px] font-bold">{shift.end_time?.slice(0, 5)}</span>
                            </div>
                          ) : (
                            <div className={`text-gray-300 ${isSelected ? 'opacity-0' : 'group-hover:text-gray-400'}`}>
                              <PlusIcon />
                            </div>
                          )}
                          
                          {/* 選択中のチェックマーク */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 text-blue-600 bg-white rounded-full p-0.5 shadow-sm">
                              <CheckSquare className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 日別タイムライン（ガントチャート）ビュー
  const renderDailyView = () => {
    const hours = Array.from({ length: 25 }, (_, i) => i);
    const dateStr = `${dailyDate.getFullYear()}-${String(dailyDate.getMonth() + 1).padStart(2, '0')}-${String(dailyDate.getDate()).padStart(2, '0')}`;
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex items-center space-x-4 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
            <button onClick={() => setDailyDate(new Date(dailyDate.getTime() - 86400000))} className="p-1.5 rounded hover:bg-gray-100 transition">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <label className="font-bold text-gray-800 flex items-center justify-center text-sm cursor-pointer hover:bg-gray-100 px-2 py-1 rounded transition">
              <Clock className="w-4 h-4 mr-2 text-indigo-600" />
              <input
                type="date"
                value={`${dailyDate.getFullYear()}-${String(dailyDate.getMonth() + 1).padStart(2, '0')}-${String(dailyDate.getDate()).padStart(2, '0')}`}
                onChange={(e) => {
                  if (e.target.value) {
                    setDailyDate(new Date(e.target.value));
                  }
                }}
                className="bg-transparent border-none p-0 focus:ring-0 cursor-pointer font-bold text-gray-800"
              />
            </label>
            <button onClick={() => setDailyDate(new Date(dailyDate.getTime() + 86400000))} className="p-1.5 rounded hover:bg-gray-100 transition">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="text-sm text-gray-500">
            行をクリックしてシフトを選択・編集できます。
          </div>
        </div>
        
        <div className="overflow-auto flex-1 bg-white">
          <div className="min-w-[800px]">
            {/* Header / Hours */}
            <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
              <div className="w-40 shrink-0 p-3 font-medium text-gray-700 border-r border-gray-200 sticky left-0 bg-gray-50 z-10 shadow-[1px_0_0_0_#e5e7eb]">従業員</div>
              <div className="flex-1 relative h-10">
                {hours.map(h => (
                  <div key={h} className="absolute top-0 bottom-0 border-l border-gray-300 text-[10px] text-gray-500 pl-1 font-medium" style={{ left: `${(h / 24) * 100}%` }}>
                    {h}:00
                  </div>
                ))}
              </div>
            </div>
            
            {/* Employees */}
            {employees.length === 0 ? (
              <div className="p-8 text-center text-gray-500">従業員が見つかりません。</div>
            ) : (
              employees.map(emp => {
                const shift = getShiftForCell(emp.id, dateStr);
                let left = 0;
                let width = 0;
                let color = '#E5E7EB';
                let title = '';
                let patternName = '';
                
                if (shift && shift.start_time && shift.end_time) {
                  const startH = parseInt(shift.start_time.split(':')[0]) + parseInt(shift.start_time.split(':')[1]) / 60;
                  let endH = parseInt(shift.end_time.split(':')[0]) + parseInt(shift.end_time.split(':')[1]) / 60;
                  if (endH <= startH) endH += 24; // 翌日またぎ
                  
                  left = (startH / 24) * 100;
                  width = ((endH - startH) / 24) * 100;
                  
                  const pattern = shift.pattern_id ? patterns.find(p => p.id === shift.pattern_id) : null;
                  color = pattern ? pattern.color : (shift.color || '#9CA3AF');
                  title = `${shift.start_time.slice(0, 5)} - ${shift.end_time.slice(0, 5)}`;
                  patternName = pattern ? pattern.name : '直接入力';
                }
                
                const isSelected = selectedCells.includes(`${emp.id}_${dateStr}`);
                
                return (
                  <div 
                    key={emp.id} 
                    className={`flex border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleCellSelection(emp.id, dateStr)}
                  >
                    <div className="w-40 shrink-0 p-2 border-r border-gray-200 flex flex-col justify-center sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#e5e7eb] group-hover:bg-gray-50">
                      <span className="font-medium text-xs text-gray-800 truncate">{emp.name}</span>
                      <span className="text-[10px] text-gray-500 truncate">{emp.department}</span>
                    </div>
                    <div className="flex-1 relative h-12 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA0MCAwIEwgMCAwIDAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2YxZjVmOSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')]">
                      {/* Hour grids */}
                      {hours.map(h => (
                        <div key={h} className="absolute top-0 bottom-0 border-l border-gray-200" style={{ left: `${(h / 24) * 100}%` }}></div>
                      ))}
                      
                      {/* Shift Bar */}
                      {shift && width > 0 && (
                        <div 
                          className="absolute top-2 bottom-2 rounded-md shadow-md flex flex-col items-center justify-center px-1 overflow-hidden text-white transition-transform hover:scale-[1.02] border border-black/10"
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
                          title={`${patternName} (${title})`}
                        >
                          {width > 8 && <span className="text-[10px] font-bold leading-tight truncate w-full text-center">{patternName}</span>}
                          {width > 12 && <span className="text-[9px] opacity-90 leading-tight truncate w-full text-center">{title}</span>}
                        </div>
                      )}
                      
                      {/* 選択中チェック */}
                      {isSelected && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 bg-white rounded-full p-0.5 shadow-sm">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen pb-20">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-30 relative">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">管理者用シフト作成</h1>
        </div>
        
        {/* Tab Switcher & App Switcher */}
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('monthly')}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              月間マトリックス
            </button>
            <button
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'daily' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('daily')}
            >
              <List className="w-4 h-4 mr-2" />
              日別タイムライン
            </button>
          </div>
          <div className="pl-2 border-l border-gray-200">
            <AppSwitcher currentApp="shift" role="admin" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col relative">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          activeTab === 'monthly' ? renderMonthlyView() : renderDailyView()
        )}
      </div>

      {/* Floating Action Bar for Selection */}
      {selectedCells.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-2xl border border-gray-200 px-6 py-3 flex items-center space-x-6 z-40 animate-fade-in-up">
          <div className="flex items-center text-blue-600 font-bold">
            <CheckSquare className="w-5 h-5 mr-2" />
            {selectedCells.length} 件選択中
          </div>
          <div className="h-6 w-px bg-gray-300"></div>
          <button
            onClick={() => setSelectedCells([])}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            選択解除
          </button>
          <button
            onClick={handleDeleteShift}
            className="text-sm font-medium text-red-600 hover:text-red-800 flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            削除
          </button>
          <button
            onClick={handleOpenBulkModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full text-sm font-bold shadow-md transition-transform hover:scale-105 flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            シフトを一括入力
          </button>
        </div>
      )}

      {/* Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  シフト一括入力 ({selectedCells.length}件)
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Tabs */}
              <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                <button
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'pattern' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setInputMode('pattern')}
                >
                  パターンから選ぶ
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'custom' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setInputMode('custom')}
                >
                  直接入力する
                </button>
              </div>

              {inputMode === 'pattern' ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">シフトパターン</label>
                  {patterns.length === 0 ? (
                    <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
                      シフトパターンが登録されていません。設定画面から追加してください。
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
                      {patterns.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => setEditShift({...editShift, pattern_id: p.id})}
                          className={`
                            cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center transition-all
                            ${editShift.pattern_id === p.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}
                          `}
                        >
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mb-2 shadow-sm"
                            style={{ backgroundColor: p.color }}
                          >
                            {p.name.substring(0, 2)}
                          </div>
                          <div className="font-medium text-gray-800 text-sm text-center">{p.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {p.start_time.slice(0, 5)} - {p.end_time.slice(0, 5)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="time"
                          value={editShift.start_time || ''}
                          onChange={(e) => setEditShift({...editShift, start_time: e.target.value})}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="time"
                          value={editShift.end_time || ''}
                          onChange={(e) => setEditShift({...editShift, end_time: e.target.value})}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">休憩時間 (分)</label>
                    <input
                      type="number"
                      min="0"
                      value={editShift.break_minutes || 0}
                      onChange={(e) => setEditShift({...editShift, break_minutes: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">表示カラー (直接入力用)</label>
                    <div className="flex items-center space-x-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                      <input
                        type="color"
                        value={editShift.color || '#9CA3AF'}
                        onChange={(e) => setEditShift({...editShift, color: e.target.value})}
                        className="w-10 h-10 border-0 rounded cursor-pointer"
                      />
                      <span className="text-sm text-gray-600 flex-1">
                        カレンダーやタイムラインで目立つ色を指定できます
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveShift}
                disabled={inputMode === 'pattern' && !editShift.pattern_id}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                一括保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon helper
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 transition-opacity mx-auto">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
