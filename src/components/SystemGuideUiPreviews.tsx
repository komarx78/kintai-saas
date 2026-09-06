import React, { useState, useEffect } from 'react';

interface GuideUiPreviewProps {
  previewType?: string;
  htmlPreview?: string;
}

/**
 * 📱 実際のシステム（本物）の画面コンポーネントを忠実に再現したUIプレビュー
 */
export const SystemGuideUiPreview: React.FC<GuideUiPreviewProps> = ({
  previewType,
  htmlPreview
}) => {
  // カスタムHTMLが登録されている場合は、そのHTMLコードをそのままレンダリング
  if (htmlPreview && htmlPreview.trim()) {
    return (
      <div className="mt-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-x-auto">
        <div dangerouslySetInnerHTML={{ __html: htmlPreview }} />
      </div>
    );
  }

  // previewType に応じて本物の画面UIをレンダリング
  switch (previewType) {
    case 'kintai_clock':
      return <RealKintaiClockPreview />;
    case 'leave_request':
      return <RealLeaveBalancePreview />;
    case 'kintai_fix':
      return <RealKintaiFixPreview />;
    case 'shift_submit':
      return <RealShiftSubmitPreview />;
    case 'payslip_view':
      return <RealPayslipPreview />;
    case 'onboarding_passbook':
      return <RealOnboardingPreview />;
    case 'password_reset':
      return <RealLoginPreview />;
    default:
      return <RealKintaiClockPreview />;
  }
};

/**
 * ⏰ 1. 本物の打刻ウィジェット（画像2と完全一致・UserDashboardより抽出）
 */
function RealKintaiClockPreview() {
  const [time, setTime] = useState('10:59:31');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-3 max-w-sm mx-auto">
      {/* Clock Widget (本物のUserDashboardと同一の構造) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center">
        <h2 className="text-gray-500 font-medium mb-2">現在時刻</h2>
        <div className="text-5xl font-bold text-gray-800 tracking-wider mb-6 tabular-nums">
          {time}
        </div>
        
        <div className="flex w-full space-x-4">
          <button 
            type="button"
            className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition cursor-default shadow-xs"
          >
            出勤
          </button>
          <button 
            type="button"
            disabled
            className="flex-1 bg-orange-500 text-white py-3 rounded-lg font-bold text-lg opacity-50 transition cursor-not-allowed"
          >
            退勤
          </button>
        </div>
        
        <div className="mt-4 flex flex-col space-y-3 items-center text-sm text-gray-600">
          <div className="flex items-center">
            <span className="mr-2">現在のステータス:</span>
            <span className="px-3 py-1 rounded-full font-bold bg-gray-100 text-gray-600">
              未出勤
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 🌴 2. 本物の有給休暇・代休 残数ウィジェット（UserDashboardより抽出）
 */
function RealLeaveBalancePreview() {
  return (
    <div className="mt-3 max-w-md mx-auto">
      {/* Leave Balance (本物のUserDashboardと同一の構造) */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-800 mb-4 border-b pb-2">有給休暇・代休 残数</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-blue-50 p-3 rounded-md">
            <span className="font-medium text-blue-900">有給休暇（今年度付与分）</span>
            <span className="text-2xl font-bold text-blue-700">10<span className="text-sm font-normal ml-1">日</span></span>
          </div>
          <div className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
            <span className="font-medium text-gray-700">有給休暇（前年度繰越分）</span>
            <span className="text-xl font-bold text-gray-700">4.5<span className="text-sm font-normal ml-1">日</span></span>
          </div>
          <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md border border-gray-200">
            <span className="font-bold text-gray-800">有給休暇（合計残数）</span>
            <span className="text-2xl font-bold text-gray-900">
              14.5
              <span className="text-sm font-normal ml-1">日</span>
            </span>
          </div>
          <div className="flex justify-between items-center bg-green-50 p-3 rounded-md">
            <span className="font-medium text-green-900">利用可能な代休</span>
            <span className="text-xl font-bold text-green-700">0<span className="text-sm font-normal ml-1">日</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ✏️ 3. 本物の打刻修正・各種申請UI（UserDashboardより抽出）
 */
function RealKintaiFixPreview() {
  return (
    <div className="mt-3 max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm">
      <h2 className="text-lg font-medium text-gray-800 mb-4 border-b pb-2">各種申請（打刻修正・休暇申請）</h2>
      
      <div className="space-y-3">
        <div>
          <label className="block text-gray-700 text-xs font-bold mb-1">申請種別</label>
          <select className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5" defaultValue="打刻修正">
            <option value="打刻修正">打刻修正</option>
            <option value="有給休暇（全休）">有給休暇（全休）</option>
            <option value="午前半休">午前半休</option>
            <option value="午後半休">午後半休</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-gray-700 text-xs font-bold mb-1">対象日</label>
            <input type="text" readOnly value="2026-09-05" className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5" />
          </div>
          <div>
            <label className="block text-gray-700 text-xs font-bold mb-1">修正打刻時刻</label>
            <input type="text" readOnly value="18:00" className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-gray-700 text-xs font-bold mb-1">申請理由</label>
          <input type="text" readOnly value="退勤時の打刻忘れのため" className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg p-2.5" />
        </div>

        <button type="button" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-xs hover:bg-blue-700 transition cursor-default">
          申請を送信する
        </button>
      </div>
    </div>
  );
}

/**
 * 📅 4. 本物のシフト希望提出UI（ShiftEmployeeRequestより抽出）
 */
function RealShiftSubmitPreview() {
  return (
    <div className="mt-3 max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h2 className="text-lg font-medium text-gray-800">シフト希望の提出</h2>
        <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">2026年10月度</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-200">
          <span className="font-bold text-gray-800">10月1日 (木)</span>
          <span className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold">09:00 〜 18:00</span>
        </div>
        <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-200">
          <span className="font-bold text-gray-800">10月2日 (金)</span>
          <span className="px-2.5 py-1 bg-red-100 text-red-700 font-bold rounded">公休希望（休み）</span>
        </div>
        <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-lg border border-gray-200">
          <span className="font-bold text-gray-800">10月3日 (土)</span>
          <span className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold">09:00 〜 18:00</span>
        </div>

        <button type="button" className="w-full mt-3 bg-blue-600 text-white font-bold py-2.5 rounded-lg text-xs hover:bg-blue-700 transition cursor-default">
          今月のシフト希望を提出
        </button>
      </div>
    </div>
  );
}

/**
 * 💰 5. 本物の給与明細UI（UserPayslipViewより抽出）
 */
function RealPayslipPreview() {
  return (
    <div className="mt-3 max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-xs">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <div>
          <span className="text-[10px] text-gray-400">2026年8月支給分</span>
          <h2 className="text-base font-bold text-gray-800">給与明細書</h2>
        </div>
        <button type="button" className="px-3 py-1.5 bg-gray-800 text-white rounded-lg font-bold text-xs cursor-default">
          PDF印刷
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
          <span className="text-gray-500 block text-[11px]">総支給額</span>
          <span className="text-lg font-bold text-gray-900 font-mono">¥280,000</span>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
          <span className="text-gray-500 block text-[11px]">控除合計額</span>
          <span className="text-lg font-bold text-gray-700 font-mono">¥48,500</span>
        </div>
      </div>

      <div className="bg-blue-50 p-3.5 rounded-lg border border-blue-200 flex justify-between items-center">
        <span className="font-bold text-blue-900">差引支給額（手取り額）</span>
        <span className="text-xl font-bold text-blue-700 font-mono">¥231,500</span>
      </div>
    </div>
  );
}

/**
 * 📄 6. 本物の通帳提出・労務書類UI（EmployeeOnboardingSubmissionより抽出）
 */
function RealOnboardingPreview() {
  return (
    <div className="mt-3 max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-xs">
      <h2 className="text-base font-bold text-gray-800 mb-3 border-b pb-2">給与振込先口座（通帳写真の提出）</h2>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-5 text-center space-y-2 bg-gray-50 mb-3">
        <div className="text-gray-600 font-medium">通帳の見開き面を撮影した写真</div>
        <p className="text-[11px] text-gray-400">金融機関名・支店名・口座番号・名義人（カナ）が確認できる画像</p>
        <button type="button" className="px-3 py-1.5 bg-white border border-gray-300 rounded-md font-bold text-gray-700 shadow-xs cursor-default">
          ファイルを選択またはカメラ起動
        </button>
      </div>

      <button type="button" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-xs hover:bg-blue-700 transition cursor-default">
        書類を提出する
      </button>
    </div>
  );
}

/**
 * ⚙️ 7. 本物のログイン画面UI（Loginより抽出）
 */
function RealLoginPreview() {
  return (
    <div className="mt-3 max-w-sm mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-xs space-y-3">
      <h2 className="text-base font-bold text-gray-800 text-center mb-2">ログイン</h2>
      
      <div>
        <label className="block text-gray-600 text-[11px] font-bold mb-1">メールアドレス</label>
        <input type="email" readOnly value="employee@example.com" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 text-gray-800" />
      </div>

      <div>
        <label className="block text-gray-600 text-[11px] font-bold mb-1">パスワード</label>
        <input type="password" readOnly value="••••••••" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 text-gray-800" />
      </div>

      <div className="text-right">
        <span className="text-blue-600 font-bold text-[11px] underline cursor-default">パスワードをお忘れの方はこちら</span>
      </div>

      <button type="button" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg text-xs hover:bg-blue-700 transition cursor-default">
        ログイン
      </button>
    </div>
  );
}
