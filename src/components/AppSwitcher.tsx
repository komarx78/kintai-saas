import { useState, useRef, useEffect } from 'react';
import { Grid, Clock, CalendarDays, LayoutDashboard, DollarSign, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AppSwitcherProps = {
  currentApp: 'kintai' | 'shift' | 'payroll' | 'onboarding' | 'portal';
  role: 'admin' | 'user';
};

export default function AppSwitcher({ currentApp, role }: AppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const apps = [
    {
      id: 'portal',
      name: 'KAP Base',
      icon: <LayoutDashboard className="w-4 h-4 text-white drop-shadow-sm" />,
      path: '/portal',
      description: 'すべてのシステムの入口',
      iconBg: 'bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 shadow-sm ring-1 ring-white/30'
    },
    {
      id: 'kintai',
      name: '勤怠・有給管理',
      icon: <Clock className="w-4 h-4 text-white drop-shadow-sm" />,
      path: (role === 'admin' || role === ('superadmin' as any)) ? '/kintai/admin' : '/kintai/user',
      description: '打刻と有給の管理',
      iconBg: 'bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400 shadow-sm ring-1 ring-white/30'
    },
    {
      id: 'shift',
      name: 'シフト管理',
      icon: <CalendarDays className="w-4 h-4 text-white drop-shadow-sm" />,
      path: (role === 'admin' || role === ('superadmin' as any)) ? '/shift/admin' : '/shift/user',
      description: 'シフトの作成と確認',
      iconBg: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-sm ring-1 ring-white/30'
    },
    {
      id: 'payroll',
      name: '給与計算・明細',
      icon: <DollarSign className="w-4 h-4 text-white drop-shadow-sm" />,
      path: (role === 'admin' || role === ('superadmin' as any)) ? '/payroll/admin' : '/payroll/user',
      description: '給与の自動試算と明細',
      iconBg: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-sm ring-1 ring-white/30'
    },
    {
      id: 'onboarding',
      name: '入退社・労務',
      icon: <UserCheck className="w-4 h-4 text-white drop-shadow-sm" />,
      path: '/onboarding/admin',
      description: '契約書作成と全マスタ同期',
      iconBg: 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 shadow-sm ring-1 ring-white/30'
    }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition flex items-center justify-center bg-gray-50 border border-gray-200"
        title="アプリを切り替える"
      >
        <Grid className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up">
          <div className="p-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">アプリ切り替え</h3>
          </div>
          <div className="p-2 space-y-1">
            {apps.map((app) => {
              const isActive = app.id === currentApp;
              return (
                <button
                  key={app.id}
                  onClick={() => {
                    setIsOpen(false);
                    navigate(app.path);
                  }}
                  className={`w-full flex items-start text-left p-3 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-50 cursor-default' : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className={`mt-0.5 p-2 rounded-xl flex items-center justify-center overflow-hidden relative ${app.iconBg} ${isActive ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}>
                    <div className="absolute inset-0 bg-white/20 mix-blend-overlay"></div>
                    <div className="relative z-10">{app.icon}</div>
                  </div>
                  <div className="ml-3">
                    <div className={`font-bold text-sm ${isActive ? 'text-blue-700' : 'text-gray-800'}`}>
                      {app.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{app.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

