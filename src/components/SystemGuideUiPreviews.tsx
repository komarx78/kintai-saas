import React, { useState, useEffect } from 'react';
import { 
  Clock, Calendar, FileText, UserCheck, Bot, ArrowLeft, 
  ChevronLeft, ChevronRight, HelpCircle, CheckCircle 
} from 'lucide-react';

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
    case 'monthly_attendance':
    case 'kintai_fix':
      return <RealMonthlyAttendancePreview />;
    case 'kintai_clock':
      return <RealKintaiClockPreview />;
    case 'leave_request':
      return <RealLeaveBalancePreview />;
    case 'shift_submit':
      return <RealShiftSubmitPreview />;
    case 'payslip_view':
      return <RealPayslipPreview />;
    case 'onboarding_passbook':
      return <RealOnboardingPreview />;
    case 'password_reset':
      return <RealLoginPreview />;
    default:
      return <RealMonthlyAttendancePreview />;
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
 * 📅 3. 本物の「月次勤怠・有給照会」画面（画像 media_1788660218189.png と100%完全一致再現）
 */
function RealMonthlyAttendancePreview() {
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('09/04 (金)');

  return (
    <div className="mt-3 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden text-slate-800">
      {/* 画面案内ヘッダーバー */}
      <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-xs font-bold">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-blue-400" />
          実際のシステム画面: 【月次勤怠・有給照会】（月間勤怠照会テーブル ＆ 申請するボタン）
        </span>
        <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded text-white font-medium">
          実画面プレビュー
        </span>
      </div>

      <div className="flex flex-col md:flex-row min-h-[440px] bg-slate-100 text-xs">
        {/* 左サイドバー（画像と完全一致） */}
        <div className="w-full md:w-48 bg-slate-900 text-slate-200 p-3 flex flex-col justify-between shrink-0">
          <div>
            <div className="pb-3 mb-3 border-b border-slate-700 font-bold text-white text-sm">
              駒井 秀一朗 さん
            </div>
            <nav className="space-y-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-400 hover:text-white cursor-default">
                <Clock className="w-3.5 h-3.5" />
                <span>ホーム（打刻）</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-800 text-white font-bold border border-blue-400/70 shadow-xs cursor-default">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>月次勤怠・有給照会</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-indigo-300 cursor-default">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>シフト希望・確定シフト</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-emerald-300 cursor-default">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Web給与明細・源泉徴収票</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-400 cursor-default">
                <FileText className="w-3.5 h-3.5" />
                <span>各種申請</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded text-slate-400 cursor-default">
                <span className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>部下からの申請承認</span>
                </span>
                <span className="bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">1</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-cyan-300 cursor-default">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                <span>社内規定AI相談</span>
              </div>
            </nav>
          </div>
          <div className="pt-3 border-t border-slate-800 text-slate-500 text-[10px]">
            スマート勤怠 Ver 2.3
          </div>
        </div>

        {/* 右メインコンテンツ（画像と完全一致） */}
        <div className="flex-1 p-3 sm:p-4 overflow-x-auto">
          {/* 上部ヘッダー（ポータル導線 ＆ 使い方ガイド） */}
          <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 mb-3 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1 hover:text-blue-600 cursor-default">
                <ArrowLeft className="w-3 h-3" />
                ポータル
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">勤怠・有給照会</span>
            </div>
            <button type="button" className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded text-[11px] font-bold text-slate-700 cursor-default">
              <HelpCircle className="w-3 h-3 text-blue-600" />
              使い方ガイド
            </button>
          </div>

          {/* メイン勤怠カード */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            {/* タイトル行 ＆ 出力ボタン */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-slate-900">月間勤怠照会</h3>
                <div className="flex items-center bg-slate-100 rounded-md border border-slate-200 text-xs font-bold">
                  <button type="button" className="p-1 hover:bg-slate-200 rounded-l transition cursor-default">
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <span className="px-2.5 py-0.5 text-slate-800">2026年9月</span>
                  <button type="button" className="p-1 hover:bg-slate-200 rounded-r transition cursor-default">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="flex items-center gap-1 bg-slate-700 text-white px-2.5 py-1 rounded text-xs font-bold shadow-2xs cursor-default">
                  <FileText className="w-3 h-3" />
                  PDF出力 (印刷)
                </button>
                <button type="button" className="flex items-center gap-1 bg-emerald-600 text-white px-2.5 py-1 rounded text-xs font-bold shadow-2xs cursor-default">
                  <FileText className="w-3 h-3" />
                  CSV出力
                </button>
              </div>
            </div>

            {/* サマリーバッジ */}
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              <span className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded font-bold text-slate-700">
                出勤: <strong className="text-slate-900 text-sm">21</strong> 日
              </span>
              <span className="bg-blue-50 border border-blue-200 px-2.5 py-1 rounded font-bold text-blue-800">
                実働: <strong className="text-blue-900 text-sm">193</strong> 時間 <strong className="text-blue-900 text-sm">0</strong> 分
              </span>
              <span className="bg-rose-50 border border-rose-200 px-2.5 py-1 rounded font-bold text-rose-800">
                残業: <strong className="text-rose-900 text-sm">25</strong> 時間 <strong className="text-rose-900 text-sm">0</strong> 分
              </span>
            </div>

            {/* 勤怠テーブル（画像と100%完全一致） */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                <thead className="bg-slate-50 text-slate-600 font-bold">
                  <tr>
                    <th className="px-2.5 py-2 text-left">日付</th>
                    <th className="px-2.5 py-2 text-left">出勤 (打刻)</th>
                    <th className="px-2.5 py-2 text-left">退勤 (打刻)</th>
                    <th className="px-2.5 py-2 text-right">実働時間</th>
                    <th className="px-2.5 py-2 text-right">残業時間</th>
                    <th className="px-2.5 py-2 text-left">備考</th>
                    <th className="px-2.5 py-2 text-right font-black text-blue-700">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="px-2.5 py-1.5 font-medium text-slate-800 whitespace-nowrap">09/01 (火)</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700 whitespace-nowrap">09:00</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700 whitespace-nowrap">18:00</td>
                    <td className="px-2.5 py-1.5 text-right font-mono font-bold text-slate-700">8h</td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-slate-400">-</td>
                    <td className="px-2.5 py-1.5 text-slate-500 whitespace-nowrap">テスト自動生成打刻</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => { setSelectedDate('09/01 (火)'); setShowFormModal(true); }}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded text-[10px] font-bold transition shadow-2xs"
                      >
                        申請する
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2.5 py-1.5 font-medium text-slate-800 whitespace-nowrap">09/02 (水)</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700 whitespace-nowrap">09:00</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700 whitespace-nowrap">18:00</td>
                    <td className="px-2.5 py-1.5 text-right font-mono font-bold text-slate-700">8h</td>
                    <td className="px-2.5 py-1.5 text-right font-mono text-slate-400">-</td>
                    <td className="px-2.5 py-1.5 text-slate-500 whitespace-nowrap">テスト自動生成打刻</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => { setSelectedDate('09/02 (水)'); setShowFormModal(true); }}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded text-[10px] font-bold transition shadow-2xs"
                      >
                        申請する
                      </button>
                    </td>
                  </tr>
                  <tr className="bg-blue-50/40">
                    <td className="px-2.5 py-1.5 font-medium text-slate-800 whitespace-nowrap">09/04 (金)</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700 whitespace-nowrap">09:00</td>
                    <td className="px-2.5 py-1.5 font-mono text-slate-700 whitespace-nowrap">20:00</td>
                    <td className="px-2.5 py-1.5 text-right font-mono font-bold text-slate-700">10h</td>
                    <td className="px-2.5 py-1.5 text-right font-mono font-bold text-rose-600">2h</td>
                    <td className="px-2.5 py-1.5 text-slate-500 whitespace-nowrap">テスト自動生成打刻</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => { setSelectedDate('09/04 (金)'); setShowFormModal(true); }}
                        className="text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 px-2 py-0.5 rounded text-[10px] font-black transition shadow-xs animate-pulse"
                        title="ここをクリックして申請フォームを開く"
                      >
                        申請する 👆
                      </button>
                    </td>
                  </tr>
                  <tr className="bg-slate-50 text-slate-400">
                    <td className="px-2.5 py-1.5 font-medium text-blue-600 whitespace-nowrap">09/05 (土)</td>
                    <td className="px-2.5 py-1.5 text-center font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-center font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-slate-500 whitespace-nowrap font-bold">公休</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => { setSelectedDate('09/05 (土)'); setShowFormModal(true); }}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded text-[10px] font-bold transition shadow-2xs"
                      >
                        申請する
                      </button>
                    </td>
                  </tr>
                  <tr className="bg-slate-50 text-slate-400">
                    <td className="px-2.5 py-1.5 font-medium text-rose-600 whitespace-nowrap">09/06 (日)</td>
                    <td className="px-2.5 py-1.5 text-center font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-center font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">-</td>
                    <td className="px-2.5 py-1.5 text-slate-500 whitespace-nowrap font-bold">公休</td>
                    <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                      <button 
                        type="button" 
                        onClick={() => { setSelectedDate('09/06 (日)'); setShowFormModal(true); }}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2 py-0.5 rounded text-[10px] font-bold transition shadow-2xs"
                      >
                        申請する
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 解説バナー ＆ 申請フォーム連動表示 */}
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-xs">
              <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-blue-950">
                  💡 修正や有休取得をしたい日の右端にある【申請する】ボタンをクリックします
                </p>
                <p className="text-blue-800 text-[11px] mt-0.5">
                  クリックすると、その日付が自動セットされた状態で【各種申請フォーム】が開き、打刻時刻の修正や有給休暇の取得を提出できます。
                </p>
              </div>
            </div>

            {/* トグル表示の申請フォームプレビュー */}
            {showFormModal && (
              <div className="mt-3 p-4 bg-amber-50/70 border border-amber-300 rounded-xl animate-fadeIn">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-amber-200">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                    <FileText className="w-4 h-4 text-amber-600" />
                    【申請する】をクリックした後に開く画面: 各種申請フォーム
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setShowFormModal(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    閉じる
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">申請種類</label>
                    <input type="text" readOnly value="打刻修正" className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-blue-700" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">対象日</label>
                    <input type="text" readOnly value={selectedDate} className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">区分</label>
                    <input type="text" readOnly value="退勤" className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">正しい打刻時間</label>
                    <input type="text" readOnly value="20:00" className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">申請理由</label>
                    <input type="text" readOnly value="業務終了時の打刻押し忘れのため" className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5" />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="button" className="bg-blue-600 text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow-xs cursor-default">
                    申請を送信する
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
