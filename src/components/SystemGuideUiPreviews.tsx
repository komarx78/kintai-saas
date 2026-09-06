import React, { useState } from 'react';
import { 
  Clock, Calendar, FileText,
  ChevronLeft, ChevronRight, CheckCircle, CheckCircle2,
  Lock, Camera,
  Sparkles, Download, MousePointerClick
} from 'lucide-react';

interface GuideUiPreviewProps {
  previewType?: string;
  htmlPreview?: string;
}

/**
 * 📱 実際のシステム（本物）の画面コンポーネントを忠実に再現したUIプレビュー
 * 初心者が「場所（入口）➔ 操作箇所 ➔ 入力作業画面 ➔ 完了・反映」を絶対理解できるマルチステップ構造
 */
export const SystemGuideUiPreview: React.FC<GuideUiPreviewProps> = ({
  previewType,
  htmlPreview
}) => {
  // カスタムHTMLが登録されている場合は、そのHTMLコードをそのままレンダリング
  if (htmlPreview && htmlPreview.trim()) {
    return (
      <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 overflow-x-auto">
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
    case 'attendance_admin':
      return <RealAttendanceAdminPreview />;
    case 'onboarding_passbook':
      return <RealOnboardingPreview />;
    case 'password_reset':
      return <RealLoginPreview />;
    default:
      return <RealMonthlyAttendancePreview />;
  }
};

// ─────────────────────────────────────────────────────────────
// 🌟 共通パーツ: ステップ進行コンテナ（場所 ➔ 作業画面 ➔ 完了）
// ─────────────────────────────────────────────────────────────
interface StepItem {
  number: number;
  label: string;
  badge: string;
  title: string;
  desc: string;
  render: () => React.ReactNode;
}

function MultiStepGuideContainer({
  title,
  steps
}: {
  title: string;
  steps: StepItem[];
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const activeStep = steps.find(s => s.number === currentStep) || steps[0];

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      {/* 上部ヘッダーバー */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面インタラクティブガイド
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            {title}
          </span>
        </div>
        <span className="text-[11px] text-blue-300 font-bold shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          手順をクリックして体験できます
        </span>
      </div>

      {/* ステップ進行タブバー */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {steps.map((s) => {
            const isActive = s.number === currentStep;
            return (
              <button
                key={s.number}
                type="button"
                onClick={() => setCurrentStep(s.number)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                  isActive ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {s.number}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ステップ解説バナー */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-slate-50 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded">
              {activeStep.badge}
            </span>
            <h4 className="text-xs sm:text-sm font-black text-slate-900">
              STEP {activeStep.number}: {activeStep.title}
            </h4>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {activeStep.desc}
          </p>
        </div>

        {/* 前へ・次へボタン */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> 前へ
          </button>
          <button
            type="button"
            disabled={currentStep === steps.length}
            onClick={() => setCurrentStep(prev => Math.min(steps.length, prev + 1))}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
          >
            次へ <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* メイン画面レンダリングエリア */}
      <div className="p-3 sm:p-5 bg-slate-100/70 overflow-x-auto min-h-[380px]">
        {activeStep.render()}
      </div>
    </div>
  );
}

/**
 * ⏰ ホーム画面の打刻時計ウィジェット（UserDashboard.tsx 本物と100%同一のJSX・スタイル）
 * ユーザー様の実画面画像（media_1788662049911.png）と完全一致
 */
function AuthenticClockWidget({
  time = '11:33:56',
  status = '退勤済',
  checkInTime = '11:33',
  checkOutTime = '11:33',
  highlightPunchIn = false,
  highlightPunchOut = false,
}: {
  time?: string;
  status?: '未出勤' | '勤務中' | '退勤済';
  checkInTime?: string;
  checkOutTime?: string;
  highlightPunchIn?: boolean;
  highlightPunchOut?: boolean;
}) {
  const isPunchInDisabled = status !== '未出勤';
  const isPunchOutDisabled = status !== '勤務中';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
      <h2 className="text-gray-500 font-medium mb-2">現在時刻</h2>
      <div className="text-5xl font-bold text-gray-800 tracking-wider mb-6 tabular-nums">
        {time}
      </div>

      <div className="flex w-full space-x-4">
        <div className="flex-1 relative">
          {highlightPunchIn && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-md whitespace-nowrap animate-bounce z-10">
              👆 ここをクリック
            </div>
          )}
          <button
            type="button"
            disabled={isPunchInDisabled}
            className={`w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg transition ${
              isPunchInDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 cursor-pointer'
            } ${highlightPunchIn ? 'ring-4 ring-blue-300 animate-pulse' : ''}`}
          >
            出勤
          </button>
        </div>

        <div className="flex-1 relative">
          {highlightPunchOut && (
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-md whitespace-nowrap animate-bounce z-10">
              👆 ここをクリック
            </div>
          )}
          <button
            type="button"
            disabled={isPunchOutDisabled}
            className={`w-full bg-orange-500 text-white py-3 rounded-lg font-bold text-lg transition ${
              isPunchOutDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600 cursor-pointer'
            } ${highlightPunchOut ? 'ring-4 ring-orange-300 animate-pulse' : ''}`}
          >
            退勤
          </button>
        </div>
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

        {(checkInTime || checkOutTime) && (
          <div className="flex space-x-6 bg-gray-50 px-4 py-2 rounded-md border border-gray-100">
            {checkInTime && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-400">出勤時間</span>
                <span className="font-bold text-gray-800 text-lg">{checkInTime}</span>
              </div>
            )}
            {checkOutTime && (
              <div className="flex flex-col items-center border-l pl-6 border-gray-200">
                <span className="text-xs text-gray-400">退勤時間</span>
                <span className="font-bold text-gray-800 text-lg">{checkOutTime}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 🌴 ホーム画面の有休残数ウィジェット（UserDashboard.tsx 本物と100%同一のJSX・スタイル）
 */
function AuthenticLeaveBalanceWidget({
  highlight = false,
}: {
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 relative ${highlight ? 'ring-2 ring-blue-500' : ''}`}>
      {highlight && (
        <div className="absolute -top-3 left-4 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-xs z-10">
          👈 有給残数はここで確認
        </div>
      )}
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
            14.5<span className="text-sm font-normal ml-1">日</span>
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
                <span className="text-indigo-700 font-mono text-sm font-bold">
                  09:00 〜 18:00 (出勤)
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
          >
            シフト希望・確認 &rarr;
          </button>
        </div>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start">
          <CheckCircle className="text-yellow-600 w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            有給取得義務（年間5日）に対して、今年度現在 <strong>3日</strong> 取得済みです。
            残り <strong>2日</strong> の取得が必要です。
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * ⏰ 1. 【出勤・退勤打刻とステータス確認フロー】（3ステップ）
 */
function RealKintaiClockPreview() {
  return (
    <MultiStepGuideContainer
      title="日々の出勤・退勤打刻とステータス変化の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（ホーム画面）',
          badge: '画面の場所',
          title: 'ホーム画面（打刻）の左側に大きく配置されています',
          desc: '毎日の出勤時・退勤時は、ログイン後のホーム画面左側にある打刻時計ウィジェットを使います。',
          render: () => (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                ホーム画面（打刻）のレイアウト全体
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 左側: 打刻時計（ハイライト） */}
                <div className="relative ring-2 ring-blue-500 rounded-lg">
                  <div className="absolute -top-3 left-4 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-xs z-10">
                    👈 ここで打刻します
                  </div>
                  <AuthenticClockWidget
                    time="08:58:45"
                    status="未出勤"
                    checkInTime=""
                    checkOutTime=""
                  />
                </div>

                {/* 右側: 有給残数カード */}
                <AuthenticLeaveBalanceWidget />
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 出勤打刻の作業',
          badge: '出勤操作',
          title: '出社時に青い「出勤」ボタンをタップする',
          desc: '出社時に【出勤】ボタンを押すと、ステータスが「勤務中」に変わり、本日の打刻履歴が出勤済として記録されます。',
          render: () => (
            <div className="max-w-md mx-auto space-y-3">
              <div className="text-center text-xs text-slate-500 font-bold">
                ※未出勤時は「出勤」ボタンが押せる状態になっています
              </div>
              <AuthenticClockWidget
                time="09:00:12"
                status="未出勤"
                checkInTime=""
                checkOutTime=""
                highlightPunchIn={true}
              />
            </div>
          )
        },
        {
          number: 3,
          label: '③ 退勤打刻と集計',
          badge: '退勤操作',
          title: '業務終了時にオレンジ色の「退勤」ボタンを押す',
          desc: '退社時に【退勤】ボタンを押すと「退勤済」に切り替わり、自動的に当日の実働時間と所定休憩が計算されます。',
          render: () => (
            <div className="max-w-md mx-auto space-y-3">
              <div className="text-center text-xs text-slate-500 font-bold">
                ※退勤を押すとステータスが「退勤済」となり、出勤・退勤時間が記録されます
              </div>
              <AuthenticClockWidget
                time="11:33:56"
                status="退勤済"
                checkInTime="11:33"
                checkOutTime="11:33"
              />
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 🌴 2. 【有給休暇・半休申請フロー】（3ステップ）
 */
function RealLeaveBalancePreview() {
  return (
    <MultiStepGuideContainer
      title="有給休暇・半休の申請から残数自動控除の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所と残数確認',
          badge: '画面の場所',
          title: 'ホーム画面で残日数を確認し、左メニュー「各種申請」を開く',
          desc: '有休残数カードで残日数を確認し、左メニューの【各種申請】または勤怠照会の【申請する】をクリックします。',
          render: () => (
            <div className="max-w-md mx-auto space-y-3">
              <AuthenticLeaveBalanceWidget highlight={true} />
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-bold flex items-center justify-between">
                <span>申請は左メニュー【各種申請】をクリック ➔</span>
                <span className="bg-blue-600 text-white px-2.5 py-1 rounded text-[11px] font-black shadow-xs">
                  👆 各種申請へ
                </span>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 申請フォーム入力',
          badge: '入力作業',
          title: '全休・午前半休・午後半休を選択して送信',
          desc: '申請種類から「有給休暇（全休）」または「午前半休」「午後半休」を選択し、取得日と事由を入力します。',
          render: () => (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-lg mx-auto space-y-5 text-xs">
              <div className="flex items-center space-x-2 border-b pb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-800">各種申請フォーム</h3>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">申請種類</label>
                <select className="block w-full px-3 py-2.5 border border-blue-500 ring-2 ring-blue-100 rounded-lg bg-white font-bold text-gray-800 text-sm" defaultValue="有給休暇（全休）">
                  <option>有給休暇（全休）</option>
                  <option>有給休暇（午前半休）</option>
                  <option>有給休暇（午後半休）</option>
                  <option>代休（全休）</option>
                  <option>代休（午前半休）</option>
                  <option>代休（午後半休）</option>
                  <option>特別休暇（慶弔など）</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">開始日</label>
                  <input type="date" defaultValue="2026-09-15" className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm font-mono text-xs" />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">終了日</label>
                  <input type="date" defaultValue="2026-09-15" className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm font-mono text-xs" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">事由・備考</label>
                <textarea rows={2} defaultValue="私用のため（役所手続き）" className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-xs" />
              </div>

              <button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm shadow-md transition cursor-pointer"
              >
                申請を送信する 👆
              </button>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 承認と残数消化',
          badge: '反映結果',
          title: '承認完了と同時に残日数が自動的にマイナスされる',
          desc: '上長または管理者が承認すると、カレンダーに有休が反映され、合計残数から正確に日数（1日または0.5日）が減算されます。',
          render: () => (
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>🎉 有休申請が承認され、残日数・取得義務メーターが自動更新されました！</span>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                <h2 className="text-lg font-medium text-gray-800 border-b pb-2">有給休暇・代休 残数</h2>
                <div className="flex justify-between items-center bg-blue-50 p-3 rounded-md">
                  <span className="font-medium text-blue-900">有給休暇（今年度付与分）</span>
                  <span className="text-2xl font-bold text-blue-700">9<span className="text-sm font-normal ml-1">日（-1.0日）</span></span>
                </div>
                <div className="flex justify-between items-center bg-gray-100 p-3 rounded-md border border-gray-200">
                  <span className="font-bold text-gray-800">有給休暇（合計残数）</span>
                  <span className="text-2xl font-bold text-gray-900">
                    13.5<span className="text-sm font-normal ml-1">日</span>
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-start text-xs text-emerald-800">
                  <CheckCircle className="text-emerald-600 w-5 h-5 mr-2 mt-0.5 shrink-0" />
                  <p>
                    有給取得義務（年間5日）に対して、今年度現在 <strong>4日</strong> 取得済みとなりました！
                  </p>
                </div>
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 📅 3. 【打刻修正・休憩時間登録フロー】（4ステップ）
 */
function RealMonthlyAttendancePreview() {
  return (
    <MultiStepGuideContainer
      title="打刻修正と休憩時間の登録・申請・承認の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（メニュー）',
          badge: '画面の場所',
          title: '左メニューから「月次勤怠・有給照会」を開く',
          desc: '画面左側のサイドバーメニューにある【月次勤怠・有給照会】をクリックして勤怠照会画面を開きます。',
          render: () => (
            <div className="flex flex-col md:flex-row gap-4 max-w-3xl mx-auto bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              {/* 左サイドバーの強調プレビュー */}
              <div className="w-full md:w-56 bg-slate-900 text-slate-200 p-3 rounded-xl flex flex-col justify-between shrink-0 relative">
                <div>
                  <div className="pb-3 mb-3 border-b border-slate-700 font-bold text-white text-xs">
                    駒井 秀一朗 さん
                  </div>
                  <nav className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>ホーム（打刻）</span>
                    </div>
                    {/* ここをアニメーションハイライト */}
                    <div className="relative">
                      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-blue-600 text-white font-black shadow-md border-2 border-amber-400">
                        <Calendar className="w-4 h-4 text-white" />
                        <span>月次勤怠・有給照会</span>
                      </div>
                      <div className="absolute -right-2 -top-2 flex items-center gap-1 bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black shadow-md animate-bounce">
                        <MousePointerClick className="w-3 h-3" />
                        👆 ここをクリック
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>シフト希望・確定シフト</span>
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Web給与明細・源泉徴収票</span>
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded text-slate-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>各種申請</span>
                    </div>
                  </nav>
                </div>
              </div>

              {/* 開かれる画面の概要案内 */}
              <div className="flex-1 flex flex-col justify-center p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 text-blue-900 font-black text-sm mb-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  入口の確認ポイント
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  パソコンでもスマートフォンでも、左側のメインメニューに【月次勤怠・有給照会】が常に配置されています。<br />
                  打刻を忘れてしまった日や、休憩時間を登録・修正したいときは、まずここをクリックして月間出勤簿を開きます。
                </p>
                <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between text-xs">
                  <span className="text-blue-700 font-bold">次へ進むとテーブル画面が開きます ➔</span>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 操作箇所（申請ボタン）',
          badge: '行の選択',
          title: '修正したい日付の右端にある「申請する」ボタンを押す',
          desc: '「月間勤怠照会」テーブルが表示されます。修正したい該当日の右端にある青い【申請する】をクリックします。',
          render: () => (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 border-b pb-4 gap-4">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-medium text-gray-800">月間勤怠照会</h2>
                  <div className="flex items-center bg-gray-100 rounded-md">
                    <button type="button" className="p-2 hover:bg-gray-200 rounded-l-md transition">
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <span className="px-4 font-bold text-gray-700 min-w-[120px] text-center">
                      2026年9月
                    </span>
                    <button type="button" className="p-2 hover:bg-gray-200 rounded-r-md transition">
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <div className="flex space-x-2">
                    <button type="button" className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-4 py-1.5 rounded shadow-sm flex items-center transition">
                      <FileText className="w-4 h-4 mr-1" />
                      PDF出力 (印刷)
                    </button>
                    <button type="button" className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded shadow-sm flex items-center transition">
                      <FileText className="w-4 h-4 mr-1" />
                      CSV出力
                    </button>
                  </div>
                  <div className="flex space-x-2 text-sm">
                    <span className="bg-gray-100 px-3 py-1 rounded border border-gray-200">
                      出勤: <span className="font-bold">2</span> 日
                    </span>
                    <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded border border-blue-200">
                      実働: <span className="font-bold">16</span> 時間 <span className="font-bold">0</span> 分
                    </span>
                    <span className="bg-red-50 text-red-800 px-3 py-1 rounded border border-red-200">
                      残業: <span className="font-bold">0</span> 時間 <span className="font-bold">0</span> 分
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">出勤 (打刻)</th>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">退勤 (打刻)</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">休憩</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">実働時間</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">残業時間</th>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">09/01 (火)</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">09:00</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">18:00</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-mono text-gray-500">60m</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-700">8h</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-500">-</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">通常勤務</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                        <button type="button" className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition text-xs border border-blue-200 font-bold">
                          申請する
                        </button>
                      </td>
                    </tr>
                    <tr className="bg-red-50 text-red-600">
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-bold">09/02 (水)</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">09:00</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-red-600 font-bold">打刻漏れ</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-mono text-gray-500">-</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-700">-</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-500">-</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-red-600 font-bold">打刻漏れ</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right relative">
                        <div className="absolute -top-3 right-0 bg-blue-700 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-md whitespace-nowrap animate-bounce z-10">
                          👆 ここをクリック
                        </div>
                        <button type="button" className="text-blue-600 hover:text-blue-900 bg-blue-100 px-2.5 py-1.5 rounded transition text-xs border-2 border-blue-500 font-bold animate-pulse cursor-pointer">
                          申請する 👆
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 入力作業画面',
          badge: '入力・指定',
          title: '正しい時刻と「休憩時間（分）」を入力して送信',
          desc: '各種申請フォームが開きます。区分、正しい時刻、そして休憩時間（分）を選択して【申請を送信する】を押します。',
          render: () => (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-xl mx-auto space-y-5">
              <div className="flex items-center space-x-2 border-b pb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-800">各種申請フォーム</h2>
              </div>

              <div className="space-y-5 text-xs">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">申請種類</label>
                  <select 
                    defaultValue="打刻修正"
                    className="block w-full pl-3 pr-10 py-2.5 text-base border-blue-500 ring-2 ring-blue-200 sm:text-sm rounded-lg border bg-white font-bold"
                  >
                    <option>有給休暇（全休）</option>
                    <option>有給休暇（午前半休）</option>
                    <option>有給休暇（午後半休）</option>
                    <option>特別休暇（慶弔など）</option>
                    <option>打刻修正</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">対象日</label>
                    <input 
                      type="date" 
                      defaultValue="2026-09-02"
                      className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm sm:text-sm bg-slate-50 font-mono" 
                    />
                  </div>
                  <div className="flex space-x-2">
                    <div className="w-1/3">
                      <label className="block text-sm font-bold text-gray-700 mb-1">区分</label>
                      <select 
                        defaultValue="退勤"
                        className="block w-full px-2 py-2.5 border border-gray-300 rounded-lg shadow-sm sm:text-sm bg-white font-bold"
                      >
                        <option>出勤</option>
                        <option>退勤</option>
                      </select>
                    </div>
                    <div className="w-2/3">
                      <label className="block text-sm font-bold text-gray-700 mb-1">正しい打刻時間</label>
                      <input 
                        type="time" 
                        defaultValue="18:00"
                        className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg shadow-sm sm:text-sm font-mono font-bold text-blue-700 ring-2 ring-blue-200" 
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-bold text-gray-700">休憩時間（分）</label>
                    <span className="text-xs text-blue-600 font-bold">※当日実働から差し引く休憩時間</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      defaultValue={60}
                      className="block w-28 px-3 py-2 border border-gray-300 rounded-lg shadow-sm sm:text-sm bg-white font-bold text-center" 
                      placeholder="60"
                    />
                    <span className="text-sm text-gray-600 font-medium">分</span>
                    <div className="flex items-center space-x-1 ml-2">
                      {['0', '45', '60', '90'].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          className={`px-2 py-1 text-xs font-semibold rounded border transition ${mins === '60' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                        >
                          {mins}分
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">事由・備考</label>
                  <textarea 
                    rows={2} 
                    defaultValue="退勤時の打刻を押し忘れてしまったため修正申請いたします。"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm sm:text-sm" 
                  />
                </div>

                <button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm shadow-md transition cursor-pointer"
                >
                  申請を送信する 👆
                </button>
              </div>
            </div>
          )
        },
        {
          number: 4,
          label: '④ 完了・反映結果',
          badge: '承認と完了',
          title: '承認完了と同時に勤怠一覧・集計が自動反映される',
          desc: '上長・管理者が承認すると直ちに正しい打刻・休憩時間・実働時間に更新され、月次サマリーも再集計されます！',
          render: () => (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-4xl mx-auto space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-emerald-950">
                    🎉 承認完了後のテーブル反映イメージ
                  </h4>
                  <p className="text-xs text-emerald-800">
                    管理者が「承認」をクリックした瞬間に、休憩時間と実働時間が自動再計算されて反映されます。
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">出勤 (打刻)</th>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">退勤 (打刻)</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">休憩</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">実働時間</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">残業時間</th>
                      <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">備考</th>
                      <th className="px-3 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase">状態</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr className="bg-emerald-50/50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-bold">09/02 (水)</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">09:00</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-emerald-700">18:00</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-mono font-bold text-blue-700">60m</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold text-gray-800">8h 00m</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-500">-</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600">打刻修正承認済</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                        <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold">
                          ✓ 修正完了
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
      ]}
    />
  );
}



/**
 * 📅 4. 【シフト希望の月間提出フロー】（3ステップ）
 */
function RealShiftSubmitPreview() {
  return (
    <MultiStepGuideContainer
      title="月間シフト希望の入力から確定シフト反映の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（メニュー）',
          badge: '画面の場所',
          title: '左メニューから「シフト希望・確定シフト」を開く',
          desc: '画面左側メニューにある【シフト希望・確定シフト】をクリックして月間シフト希望カレンダーを開きます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="p-4 bg-indigo-50/60 rounded-xl border-2 border-indigo-400 shadow-sm relative">
                <span className="text-xs text-indigo-700 font-bold block mb-1">左サイドバーメニュー</span>
                <div className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 px-4 rounded-xl font-black text-sm shadow-md">
                  <Calendar className="w-4 h-4" />
                  <span>シフト希望・確定シフト 👆</span>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                スマートフォンからも、左上ハンバーガーメニューからワンタップで開けます。
              </p>
            </div>
          )
        },
        {
          number: 2,
          label: '② 作業画面（カレンダー入力）',
          badge: '入力作業',
          title: '7列月間カレンダーで希望時間帯・公休を指定する',
          desc: 'カレンダーの各日付で「出勤」または「休み」を選択し、希望勤務時間を入力します。会社休日の一括休み希望も可能です。',
          render: () => (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 max-w-2xl mx-auto space-y-4 text-xs">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <span className="font-black text-gray-900 text-sm">2026年10月度 シフト希望カレンダー</span>
                </div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  希望受付中
                </span>
              </div>

              {/* 一括設定バー（本物同一） */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-slate-700">一括設定:</span>
                <div className="flex gap-2">
                  <span className="bg-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold">
                    🏢 会社営業日を一括出勤希望
                  </span>
                  <span className="bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-bold">
                    🏖️ 会社所定休日を一括休み希望
                  </span>
                </div>
              </div>

              {/* カレンダー見本（数日分） */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-white border-2 border-blue-400 rounded-xl shadow-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>10/01 (木)</span>
                    <span className="text-blue-600">出勤希望</span>
                  </div>
                  <div className="bg-blue-50 text-blue-800 p-1.5 rounded font-mono font-bold text-center">
                    09:00 - 18:00
                  </div>
                </div>
                <div className="p-2.5 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>10/02 (金)</span>
                    <span className="text-rose-600">休み希望</span>
                  </div>
                  <div className="bg-rose-100 text-rose-700 p-1.5 rounded font-bold text-center">
                    公休日（休み）
                  </div>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>10/03 (土)</span>
                    <span className="text-slate-500">公休</span>
                  </div>
                  <div className="bg-slate-100 text-slate-600 p-1.5 rounded font-bold text-center">
                    所定休日
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5" />
                  シフト希望を提出する 👆
                </button>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 確定シフトの反映',
          badge: '確定公開',
          title: '承認完了後に藍色の「確定」バッジでカレンダーへ即時反映',
          desc: '管理者が承認・公開すると、マイカレンダーに「確定」バッジが付き、ホーム画面の「本日のシフト予定」にも確定時間が表示されます。',
          render: () => (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 max-w-2xl mx-auto space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>🎉 10月度のシフトが承認され、確定カレンダーに即時反映されました！</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950">10月1日 (木)</span>
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      確定済み
                    </span>
                  </div>
                  <div className="font-mono text-sm font-bold text-indigo-900">
                    09:00 〜 18:00（出勤）
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">10月2日 (金)</span>
                    <span className="bg-slate-300 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                      確定
                    </span>
                  </div>
                  <div className="font-bold text-slate-700">
                    公休日（休み）
                  </div>
                </div>
              </div>

              {/* ホーム画面の確定シフト表示連動案内 */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🗓️</span>
                  <span className="text-[11px] font-bold text-indigo-900">
                    ホーム画面の「本日のシフト予定」にも自動連動して毎朝表示されます
                  </span>
                </div>
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 💰 5. 【Web給与明細・源泉徴収票フロー】（3ステップ）
 */
function RealPayslipPreview() {
  return (
    <MultiStepGuideContainer
      title="Web給与明細の閲覧とPDF印刷・保存の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（メニュー）',
          badge: '画面の場所',
          title: '左メニューから「Web給与明細・源泉徴収票」を開く',
          desc: '画面左側メニューにある【Web給与明細・源泉徴収票】をクリックして給与明細画面を開きます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="p-4 bg-emerald-50/60 rounded-xl border-2 border-emerald-400 shadow-sm relative">
                <span className="text-xs text-emerald-700 font-bold block mb-1">左サイドバーメニュー</span>
                <div className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 px-4 rounded-xl font-black text-sm shadow-md">
                  <FileText className="w-4 h-4" />
                  <span>Web給与明細・源泉徴収票 👆</span>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                スマートフォンでも同様に、毎月の給料日に最新の明細が自動配信されます。
              </p>
            </div>
          )
        },
        {
          number: 2,
          label: '② 明細作業画面（内訳確認）',
          badge: '内訳確認',
          title: '総支給額・控除額・手取り金額を確認する',
          desc: '対象年月（2026年9月支給分等）を選択すると、基本給・各種手当・残業代・社会保険料などの内訳が詳細に表示されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-md space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <span className="text-[10px] text-slate-400">2026年9月支給分</span>
                  <h4 className="font-black text-base text-slate-900">給与明細書</h4>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded">公開済</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">総支給額</span>
                  <span className="text-base font-black text-slate-900 font-mono">¥285,000</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">控除合計額</span>
                  <span className="text-base font-black text-slate-700 font-mono">¥49,200</span>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 flex justify-between items-center">
                <span className="font-bold text-blue-900">差引支給額（手取り額）</span>
                <span className="text-xl font-black text-blue-700 font-mono">¥235,800</span>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ PDF印刷・保存',
          badge: '印刷・保存',
          title: '右上の「PDF印刷」ボタンで公式レイアウト保存',
          desc: '明細画面の右上にある【PDF印刷】ボタンを押すと、公式レイアウトの給与明細書を印刷またはPDF保存できます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs text-center">
              <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md flex items-center justify-between">
                <span className="font-bold">給与明細書（公式レイアウト）</span>
                <button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-3.5 py-1.5 rounded-lg text-xs shadow-md border-2 border-amber-400 flex items-center gap-1.5 cursor-default"
                >
                  <Download className="w-3.5 h-3.5" /> PDF印刷 👆
                </button>
              </div>

              <p className="text-xs text-slate-600 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
                💡 銀行への提出書類や確定申告用として、スマートフォンやパソコンからいつでもダウンロード・印刷が可能です。
              </p>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 🏢 6. 【管理者向け：出勤簿管理・打刻修正・月次締めフロー】（3ステップ）
 */
function RealAttendanceAdminPreview() {
  return (
    <MultiStepGuideContainer
      title="管理者用: 全社出勤簿の確認・休憩修正・月次締めの流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（管理出勤簿）',
          badge: '管理画面',
          title: '管理者メニュー「月間勤怠・出勤簿管理」を開く',
          desc: '管理者権限でログインし、【月間勤怠・出勤簿管理】から全社集計または個人別出勤簿を選択します。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md">
                <span className="text-xs text-slate-400 font-bold block mb-1">管理者サイドバー</span>
                <div className="flex items-center justify-center gap-2 bg-blue-600 py-2.5 px-4 rounded-xl font-black text-sm border-2 border-amber-400">
                  <Calendar className="w-4 h-4" />
                  <span>月間勤怠・出勤簿管理 👆</span>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                全従業員の月間出勤日数・実働時間・残業時間・申請状況が一覧で把握できます。
              </p>
            </div>
          )
        },
        {
          number: 2,
          label: '② 作業画面（打刻編集）',
          badge: '直接編集',
          title: '各行の「編集」ボタンから休憩時間や時刻を修正',
          desc: '修正したい日の【編集】ボタンを押すと打刻修正モーダルが開き、休憩時間（分）や時刻を管理者が直接保存できます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-black text-sm text-slate-900">駒井 秀一朗 の打刻修正（09/04）</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">管理者権限</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">出勤時刻</label>
                  <input type="text" readOnly value="09:00" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">退勤時刻</label>
                  <input type="text" readOnly value="20:00" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold" />
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="font-black text-slate-800">休憩時間（分）</label>
                  <span className="text-[10px] text-blue-600 font-bold">※実働から差し引く休憩</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value="60" className="w-16 bg-white border border-slate-300 rounded p-1.5 text-center font-bold" />
                  <span className="font-bold text-slate-600">分</span>
                  <div className="flex gap-1 ml-auto">
                    {['0分', '45分', '60分', '90分'].map(m => (
                      <span key={m} className={`px-2 py-0.5 rounded text-[10px] font-bold border ${m === '60分' ? 'bg-blue-600 text-white' : 'bg-white'}`}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full bg-blue-600 text-white font-black py-2.5 rounded-xl shadow-md border-2 border-amber-400 flex items-center justify-center gap-1 cursor-default"
              >
                保存する 👆
              </button>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 月次締め確定ロック',
          badge: '締め確定',
          title: '未承認申請ゼロを確認し「勤怠締め確定」を実行',
          desc: '未承認の申請がないことを確認し、画面上部の【勤怠締め確定】を実行すると、実績がロックされて給与計算へ安全に引き渡されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-700" />
                  <div>
                    <div className="font-black text-emerald-950">2026年9月度 勤怠締め確定ロック</div>
                    <div className="text-[10px] text-emerald-800">給与連携ロック完了（打刻編集ロック済）</div>
                  </div>
                </div>
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs">
                  確定済
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                🔒 確定後は従業員の打刻修正や申請がロックされ、給与計算画面で「勤怠実績を取り込んで自動計算」を押すだけで全員の給与が瞬時に試算されます。
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 📄 7. 【入退社労務・通帳提出フロー】（3ステップ）
 */
function RealOnboardingPreview() {
  return (
    <MultiStepGuideContainer
      title="入社手続き・通帳写真提出と口座登録の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（初期案内）',
          badge: '案内メール',
          title: '入社手続きメールまたはマイページの案内を開く',
          desc: '入社時に届く案内メールのリンク、またはマイページの初期手続きバナーをクリックして開始します。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 text-left">
                <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded">入社手続き案内</span>
                <h4 className="text-xs font-black text-slate-900 mt-2 mb-1">【重要】給与振込先口座および入社書類のご提出</h4>
                <p className="text-[11px] text-slate-600">下記リンクより、通帳写真の撮影と基本情報の入力を行ってください。</p>
                <div className="mt-3 bg-blue-600 text-white font-bold py-2 rounded-lg text-xs text-center border-2 border-amber-400">
                  入社手続きを開始する 👆
                </div>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 作業画面（通帳撮影）',
          badge: '書類提出',
          title: '通帳の見開き面を撮影・アップロードする',
          desc: '金融機関名・支店名・口座番号・名義人（カナ）がはっきりと確認できる写真を撮影して提出します。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-3 text-xs">
              <h4 className="font-black text-sm text-slate-900 border-b pb-2">給与振込先口座の登録</h4>
              
              <div className="border-2 border-dashed border-blue-300 rounded-xl p-5 text-center bg-blue-50/40 space-y-2">
                <Camera className="w-8 h-8 text-blue-600 mx-auto" />
                <div className="font-bold text-slate-800">通帳の見開き面を撮影</div>
                <p className="text-[10px] text-slate-500">支店名・口座番号・カタカナ名義が読めるように撮影してください</p>
                <button type="button" className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold text-xs shadow-xs cursor-default">
                  カメラを起動または写真選択
                </button>
              </div>

              <button
                type="button"
                className="w-full bg-blue-600 text-white font-black py-2.5 rounded-xl shadow-md border-2 border-amber-400 flex items-center justify-center gap-1 cursor-default"
              >
                書類を提出する 👆
              </button>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 完了・口座登録',
          badge: '登録完了',
          title: '人事管理者が確認・承認して振込口座に正式登録',
          desc: '提出した画像をもとに人事担当者が確認・承認を行い、給与振込先として正式にマスター連携されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>🎉 通帳書類の審査・口座登録が完了しました！</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600 text-[11px]">
                次回のお給料日より、ご登録いただいた口座へ給与が自動振込されます。
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * ⚙️ 8. 【ログイン・パスワード再設定フロー】（3ステップ）
 */
function RealLoginPreview() {
  return (
    <MultiStepGuideContainer
      title="ログインおよびパスワード再設定の流れ"
      steps={[
        {
          number: 1,
          label: '① ログイン画面',
          badge: '入口',
          title: 'ログイン画面下部の「パスワードをお忘れの方」を押す',
          desc: 'パスワードを忘れてログインできない場合は、ログインボタン下のリンクをクリックします。',
          render: () => (
            <div className="max-w-xs mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-3 text-xs">
              <h4 className="font-black text-center text-slate-800 text-sm mb-2">スマート勤怠 ログイン</h4>
              <div>
                <label className="block text-slate-600 text-[10px] font-bold mb-1">メールアドレス</label>
                <input type="email" readOnly value="employee@example.com" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2" />
              </div>
              <div>
                <label className="block text-slate-600 text-[10px] font-bold mb-1">パスワード</label>
                <input type="password" readOnly value="••••••••" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2" />
              </div>
              <div className="text-right">
                <span className="text-blue-600 font-black text-[11px] underline cursor-default bg-amber-50 px-1 py-0.5 rounded border border-amber-300">
                  パスワードをお忘れの方はこちら 👆
                </span>
              </div>
              <button type="button" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg cursor-default">
                ログイン
              </button>
            </div>
          )
        },
        {
          number: 2,
          label: '② 再設定メール送信',
          badge: 'リセット申請',
          title: '登録メールアドレス宛に再設定用リンクを送信',
          desc: '登録済みのメールアドレスを入力して送信すると、数秒でパスワード再設定用のURLが届きます。',
          render: () => (
            <div className="max-w-xs mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-3 text-xs">
              <h4 className="font-black text-slate-800 text-sm">パスワード再設定</h4>
              <p className="text-[11px] text-slate-500">ご登録のメールアドレスを入力してください。</p>
              <div>
                <input type="email" readOnly value="employee@example.com" className="w-full bg-white border border-blue-400 rounded-lg p-2" />
              </div>
              <button type="button" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg border-2 border-amber-400 cursor-default">
                再設定リンクを送信 👆
              </button>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 新パスワード設定',
          badge: '再設定完了',
          title: '届いたメールのリンクから新しいパスワードを設定',
          desc: 'メール内のリンクを開き、新しいパスワードを入力して保存すればすぐに新しいパスワードでログインできます。',
          render: () => (
            <div className="max-w-xs mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs text-center">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-bold">
                ✓ 新しいパスワードを設定完了！
              </div>
              <p className="text-[11px] text-slate-500">
                新しいパスワードを使って安全にログインしてください。
              </p>
            </div>
          )
        }
      ]}
    />
  );
}
