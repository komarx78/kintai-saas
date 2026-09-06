import React, { useState } from 'react';
import { 
  Clock, Calendar, FileText,
  ChevronLeft, ChevronRight, CheckCircle, CheckCircle2,
  Lock, Unlock, CheckCheck,
  Sparkles, MousePointerClick,
  DollarSign, Printer, Upload, CreditCard, Train, Shield, Users, Mail, LogIn, Send,
  Smartphone, MapPin, AlertTriangle, XCircle,
  Gift, RotateCcw, Plus, Check, Building2
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
    // ⏰ 勤怠・打刻
    case 'kintai_clock':
      return <RealKintaiClockPreview />;
    case 'monthly_attendance':
    case 'kintai_fix':
      return <RealMonthlyAttendancePreview />;
    case 'monthly_attendance_summary_export':
      return <RealAttendanceSummaryAndExportPreview />;
    case 'kintai_break_time':
      return <RealBreakTimeSettingPreview />;
    case 'kintai_night_shift':
      return <RealNightShiftPreview />;
    case 'kintai_gps_help':
      return <RealGpsHelpPreview />;
    case 'attendance_admin':
      return <RealAttendanceAdminPreview />;

    // 🌴 有給・各種申請
    case 'leave_request':
      return <RealLeaveBalancePreview />;
    case 'leave_request_cancel':
      return <RealRequestCancelPreview />;
    case 'leave_half_day':
      return <RealHalfDayLeavePreview />;
    case 'leave_balance_check':
      return <RealLeaveBalanceCheckPreview />;
    case 'special_leave_apply':
      return <RealSpecialLeaveApplyPreview />;

    // 📅 シフト
    case 'shift_submit':
      return <RealShiftSubmitPreview />;
    case 'shift_confirmed_view':
      return <RealConfirmedShiftViewPreview />;
    case 'shift_admin_manage':
      return <RealShiftAdminPreview />;

    // 💰 給与明細・計算
    case 'payslip_view':
      return <RealPayslipPreview />;
    case 'payslip_bonus_tax':
      return <RealBonusAndTaxSlipPreview />;
    case 'payroll_admin_calc':
      return <RealPayrollAdminPreview />;

    // 📄 入退社・労務
    case 'onboarding_passbook':
      return <RealOnboardingPreview />;
    case 'contract_sign':
      return <RealContractSignPreview />;
    case 'official_ledger_print':
      return <RealOfficialLedgerPreview />;

    // 🏢 会社設定・カレンダー
    case 'company_master_settings':
      return <RealCompanyMasterPreview />;
    case 'company_calendar_settings':
      return <RealCompanyCalendarPreview />;

    // ⚙️ ログイン・基本操作
    case 'password_reset':
      return <RealLoginPreview />;
    case 'pwa_install':
      return <RealPwaInstallPreview />;
    case 'employee_admin_manage':
      return <RealEmployeeAdminPreview />;

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center max-w-sm mx-auto w-full relative">
      {/* 端末打刻モードバッジ（本物と100%同一） */}
      <div className="mb-3 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full flex items-center gap-1.5 text-xs text-indigo-900 font-bold shadow-2xs">
        <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
        <span>📱 スマホ打刻モード（📍 GPS位置情報・不正防止連動）</span>
      </div>

      <h2 className="text-gray-500 font-medium mb-1">現在時刻</h2>
      <div className="text-5xl font-bold text-gray-800 tracking-wider mb-5 tabular-nums">
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
              isPunchInDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 cursor-pointer shadow-sm'
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
              isPunchOutDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-600 cursor-pointer shadow-sm'
            } ${highlightPunchOut ? 'ring-4 ring-orange-300 animate-pulse' : ''}`}
          >
            退勤
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col space-y-3 items-center text-sm text-gray-600 w-full">
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
          <div className="flex space-x-6 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 w-full justify-center">
            {checkInTime && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 font-medium">出勤時間</span>
                <span className="font-black text-gray-900 text-lg">{checkInTime}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  <span>📍 GPS位置確認</span>
                </span>
              </div>
            )}
            {checkOutTime && (
              <div className="flex flex-col items-center border-l pl-6 border-gray-300">
                <span className="text-xs text-gray-500 font-medium">退勤時間</span>
                <span className="font-black text-gray-900 text-lg">{checkOutTime}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200 shadow-2xs">
                  <MapPin className="w-3 h-3 text-orange-600" />
                  <span>📍 GPS位置確認</span>
                </span>
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
      title="出勤・退勤打刻とスマホGPS不正防止連動の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（ホーム画面）',
          badge: '画面の場所',
          title: 'ホーム画面（打刻）の左側に大きく配置されています',
          desc: '毎日の出勤時・退勤時は、ログイン後のホーム画面左側にある打刻時計ウィジェットを使います。スマホアクセス時は自動で「📱 スマホ打刻モード」となり、GPSによる不正防止が連動します。',
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
          desc: '出社時に【出勤】ボタンを押すと、スマホのGPS位置情報（緯度・経度）を自動測定・記録し、ステータスが「勤務中」に変わります（不正打刻を防止）。',
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
          desc: '退社時に【退勤】ボタンを押すと「退勤済」に切り替わり、位置情報とともに当日の実働時間が自動計算されます。「📍 GPS位置確認」からGoogleマップで確認も可能です。',
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
 * 📍 1-2. 【スマホGPS位置情報エラー対処 ＆ 設定許可手順】（3ステップ）
 * UserDashboard.tsx の gpsErrorModal 実画面と100%同一のJSX・Tailwindクラス
 */
function RealGpsHelpPreview() {
  return (
    <MultiStepGuideContainer
      title="スマホGPS位置情報エラーの原因と設定許可（iPhone/Android）の手順"
      steps={[
        {
          number: 1,
          label: '① 打刻操作（エラー検知）',
          badge: '出退勤操作',
          title: 'スマホから「出勤」または「退勤」を押した際に位置情報を自動確認',
          desc: 'スマートフォンからの打刻は、虚偽の遠隔打刻（不正打刻）を防止するためGPS位置情報の取得が必須です。端末やブラウザの位置情報がOFFになっていると検知されます。',
          render: () => (
            <div className="max-w-md mx-auto space-y-3">
              <div className="text-center text-xs text-slate-500 font-bold">
                ※スマホアクセス時は「📱 スマホ打刻モード」が自動適用されます
              </div>
              <AuthenticClockWidget
                time="08:59:10"
                status="未出勤"
                checkInTime=""
                checkOutTime=""
                highlightPunchIn={true}
              />
            </div>
          )
        },
        {
          number: 2,
          label: '② GPSエラー画面と設定手順',
          badge: '実際のエラー画面',
          title: '画面上に表示される「📍 位置情報（GPS）の取得エラー」モーダル',
          desc: '位置情報が取得できない場合に自動表示される本物の警告モーダルです。お使いの端末（iPhone Safari / Android Chrome）に合わせて許可設定を行ってください。',
          render: () => (
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-3xl w-full shadow-xl overflow-hidden border border-slate-200">
                <div className="p-4 bg-gradient-to-r from-rose-600 to-red-600 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-black text-sm sm:text-base">位置情報（GPS）の取得エラー</h3>
                  </div>
                  <button type="button" className="text-white/80 hover:text-white cursor-pointer">
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs text-slate-700">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 font-medium whitespace-pre-wrap leading-relaxed">
                    スマートフォンからの打刻は、不正防止のため位置情報（GPS）の取得が必須となります。
ブラウザまたは端末の位置情報サービスがOFFになっているか、許可が拒否されています。
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>スマートフォンでの許可設定手順</span>
                    </div>
                    <ul className="space-y-1.5 list-disc list-inside text-slate-600 font-medium text-[11px] leading-relaxed">
                      <li><strong>iPhone (Safari):</strong> 「設定」＞「プライバシーとセキュリティ」＞「位置情報サービス」をONにし、SafariのWebサイトで「このAppの使用中のみ許可」を選択。</li>
                      <li><strong>Android (Chrome):</strong> 画面右上の3点メニュー ＞「設定」＞「サイトの設定」＞「位置情報」を「許可」に設定。</li>
                      <li>画面を再読み込みし、上部に表示される「位置情報の利用を許可しますか？」で<strong>「許可」</strong>を選択してください。</li>
                    </ul>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    ※ 本システムは不正打刻（虚偽の遠隔打刻）防止のため、スマートフォンからの打刻時に正確な位置情報の取得を必須としております。
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs shadow-md"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 許可完了と正常打刻',
          badge: '打刻完了',
          title: '位置情報を「許可」して打刻完了（📍 GPS位置確認リンクが表示）',
          desc: '位置情報を許可して再度「出勤」または「退勤」を押すと打刻が即座に完了します。記録された位置情報は「📍 GPS位置確認」からGoogleマップで確認できます。',
          render: () => (
            <div className="max-w-md mx-auto space-y-3">
              <div className="text-center text-xs text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 py-1.5 px-3 rounded-xl">
                ✓ 位置情報が正常に記録され、打刻が完了しました
              </div>
              <AuthenticClockWidget
                time="09:00:00"
                status="勤務中"
                checkInTime="09:00"
                checkOutTime=""
              />
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 🌴 2. 【有給休暇・半休・特別休暇（慶弔等）・代休申請フロー】（3ステップ）
 */
function RealLeaveBalancePreview() {
  return (
    <MultiStepGuideContainer
      title="有給休暇・半休・特別休暇（慶弔等）・代休の申請から反映の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所と残数確認',
          badge: '画面の場所',
          title: 'ホーム画面で有休・代休残数を確認し、左メニュー「各種申請」を開く',
          desc: 'ホーム画面の【有給休暇・代休 残数】カードで残日数を確認し、左メニューの【各種申請】（または勤怠照会の【申請する】）をクリックします。',
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
          title: '有給・半休・代休・特別休暇（慶弔）を選択して送信',
          desc: '申請種類プルダウンから有給休暇（全休/半休）、代休、または特別休暇（慶弔など）を選択し、対象日程と申請理由を入力します。',
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
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>有休（全休・半休）のほか、慶弔休暇（忌引き・結婚等）や代休も同一フォームから申請可能です</span>
                </div>
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
                <textarea rows={2} defaultValue="私用のため（役所手続き）／ 慶弔（本人結婚・忌引き等）" className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-xs" />
              </div>

              <button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg text-sm shadow-md transition cursor-pointer"
              >
                申請を送信 👆
              </button>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 承認と残数・カレンダー反映',
          badge: '反映結果',
          title: '承認完了と同時に残日数が自動計算されカレンダーに反映',
          desc: '上長または管理者が承認すると、カレンダーに休暇が即時反映され、有休残数や代休残数が自動的に更新されます。',
          render: () => (
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>🎉 申請が承認され、有休・代休残数やカレンダー実績が自動更新されました！</span>
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
                      <span>📄 Web給与明細・源泉徴収票・書類</span>
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
          desc: '各種申請フォームが開きます。区分、正しい時刻、そして休憩時間（分）を選択して【申請を送信】を押します。',
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
                  申請を送信 👆
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
 * UserPayslipView.tsx および OfficialPayslipDoc.tsx 本物と100%同一のJSX・スタイル
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
          title: '左メニューから「📄 Web給与明細・源泉徴収票・書類」を開く',
          desc: '画面左側メニューにある【📄 Web給与明細・源泉徴収票・書類】をクリックして給与明細画面を開きます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center space-y-3">
              <div className="p-4 bg-emerald-50/60 rounded-xl border-2 border-emerald-400 shadow-sm relative">
                <span className="text-xs text-emerald-700 font-bold block mb-1">左サイドバーメニュー</span>
                <div className="flex items-center justify-center gap-2 bg-emerald-600 text-white py-2.5 px-4 rounded-xl font-black text-sm shadow-md">
                  <FileText className="w-4 h-4" />
                  <span>📄 Web給与明細・源泉徴収票・書類 👆</span>
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
          title: '総支給額・控除額・手取り金額と各内訳を確認する',
          desc: '対象年月（2026年9月支給分等）を選択すると、基本給・各種手当・社会保険料などの内訳が公式レイアウトで詳細に表示されます。',
          render: () => (
            <div className="bg-white p-5 sm:p-7 max-w-2xl mx-auto text-slate-800 font-sans leading-normal shadow-sm rounded-2xl border border-slate-200 space-y-4">
              {/* 最上部ヘッダー：企業情報 ＆ 給与明細書タイトル */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      令和08年09月度
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">公式給与支払明細書</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    2026年09月分 給与明細書
                  </h3>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-right">
                  <div>
                    <div className="text-xs font-black text-slate-800">株式会社KAP</div>
                    <div className="text-[9px] text-slate-500">支給日: 2026年09月30日</div>
                  </div>
                  <div className="w-9 h-9 rounded-lg border-2 border-red-500/40 bg-red-50/50 flex flex-col items-center justify-center text-red-600 font-serif font-black text-[8px] leading-tight select-none">
                    <span>社印</span>
                    <span className="text-[6px]">之印</span>
                  </div>
                </div>
              </div>

              {/* 従業員情報 ＆ 3連ハイライトサマリーカード */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-500">社員番号: #2</div>
                  <div className="text-base font-black text-slate-900 tracking-wide mt-0.5">
                    駒井 秀一朗 <span className="text-xs font-normal text-slate-600">様</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    振込手続完了（当月支払）
                  </div>
                </div>

                <div className="sm:col-span-8 grid grid-cols-3 gap-2">
                  <div className="bg-blue-50/70 border border-blue-200/80 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-blue-900 block">総支給額</span>
                    <span className="text-sm sm:text-base font-black text-blue-950 font-mono block mt-0.5">
                      ¥285,000
                    </span>
                  </div>

                  <div className="bg-rose-50/70 border border-rose-200/80 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-rose-900 block">総控除額</span>
                    <span className="text-sm sm:text-base font-black text-rose-950 font-mono block mt-0.5">
                      ¥49,200
                    </span>
                  </div>

                  <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white border border-slate-900 p-2.5 rounded-xl text-center shadow-xs">
                    <span className="text-[10px] font-bold text-blue-200 block">差引支給額 (手取)</span>
                    <span className="text-base sm:text-lg font-black text-emerald-400 font-mono block mt-0.5 tracking-tight">
                      ¥235,800
                    </span>
                  </div>
                </div>
              </div>

              {/* 支給・控除の2大明細テーブル */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 支給明細 */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="bg-blue-900 text-white font-bold py-2 px-3 flex items-center justify-between text-[11px] tracking-wider">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-cyan-300" />
                        支給の部（Earnings）
                      </span>
                      <span className="text-[9px] font-normal text-blue-200">3項目</span>
                    </div>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-blue-50/30">
                          <td className="py-2 px-3 font-medium text-slate-700">基本給</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">¥250,000</td>
                        </tr>
                        <tr className="hover:bg-blue-50/30">
                          <td className="py-2 px-3 font-medium text-slate-700">役職手当</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">¥20,000</td>
                        </tr>
                        <tr className="hover:bg-blue-50/30">
                          <td className="py-2 px-3 font-medium text-slate-700">残業割増手当</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">¥15,000</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-blue-50 border-t border-blue-200 p-2.5 flex items-center justify-between font-black text-blue-950 text-xs">
                    <span>支給合計額</span>
                    <span className="font-mono">¥285,000</span>
                  </div>
                </div>

                {/* 控除明細 */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="bg-slate-800 text-white font-bold py-2 px-3 flex items-center justify-between text-[11px] tracking-wider">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-rose-300" />
                        控除の部（Deductions）
                      </span>
                      <span className="text-[9px] font-normal text-slate-300">5項目</span>
                    </div>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-rose-50/30">
                          <td className="py-1.5 px-3 font-medium text-slate-700">健康保険料</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 font-mono">¥14,200</td>
                        </tr>
                        <tr className="hover:bg-rose-50/30">
                          <td className="py-1.5 px-3 font-medium text-slate-700">厚生年金保険料</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 font-mono">¥22,800</td>
                        </tr>
                        <tr className="hover:bg-rose-50/30">
                          <td className="py-1.5 px-3 font-medium text-slate-700">雇用保険料</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 font-mono">¥1,710</td>
                        </tr>
                        <tr className="hover:bg-rose-50/30">
                          <td className="py-1.5 px-3 font-medium text-slate-700">所得税</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 font-mono">¥5,490</td>
                        </tr>
                        <tr className="hover:bg-rose-50/30">
                          <td className="py-1.5 px-3 font-medium text-slate-700">住民税</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900 font-mono">¥5,000</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-rose-50 border-t border-rose-200 p-2.5 flex items-center justify-between font-black text-rose-950 text-xs">
                    <span>控除合計額</span>
                    <span className="font-mono">¥49,200</span>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ PDF印刷・保存',
          badge: '印刷・保存',
          title: '画面右上の「印刷 / PDF保存」ボタンでA4公式保存',
          desc: '明細画面の右上にある【印刷 / PDF保存】ボタンを押すと、公式レイアウトの給与明細書を印刷またはPDF保存できます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs text-center">
              {/* UserPayslipView.tsx 本物のアクションバー再現 */}
              <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-left">
                  <label className="text-[11px] font-bold text-slate-600">支給月度:</label>
                  <span className="text-[11px] font-black py-1 px-2 border border-slate-300 rounded-lg bg-white text-slate-800 shadow-2xs">
                    2026-09 支給分（支給日: 2026-09-30）
                  </span>
                </div>

                <button
                  type="button"
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition border-2 border-amber-400 cursor-default"
                >
                  <Printer className="w-4 h-4 text-cyan-400" />
                  印刷 / PDF保存 👆
                </button>
              </div>

              <p className="text-xs text-slate-600 text-left bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
                💡 銀行への住宅ローン・マイカーローン提出書類や確定申告用として、スマートフォンやパソコンからいつでも公式レイアウトでダウンロード・印刷が可能です。
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
 * MonthlyAttendanceManagement.tsx 本物と100%同一のJSX・スタイル
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl mx-auto space-y-3 p-4">
              {/* 月次締めステータスバナー（本物） */}
              <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-slate-800">2026年 9月度 勤怠締めステータス</h4>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                        集計中（未確定・修正可能）
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">未承認申請を確認後、締め確定を実行して給与計算へ引き渡します。</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-xs px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  9月度 勤怠締め確定
                </div>
              </div>

              {/* 従業員別 月間勤怠集計テーブル（本物） */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    従業員別 月間勤怠集計（2026年9月）
                  </h4>
                  <span className="text-[10px] text-slate-500">全 3 名の勤務状況</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-black text-slate-600">
                      <th className="p-2.5">従業員名</th>
                      <th className="p-2.5">部署</th>
                      <th className="p-2.5 text-right">出勤日数</th>
                      <th className="p-2.5 text-right">総実働時間</th>
                      <th className="p-2.5 text-right">総残業時間</th>
                      <th className="p-2.5 text-right">有給取得</th>
                      <th className="p-2.5 text-center">アクション</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-blue-50/30">
                      <td className="p-2.5 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center">駒</div>
                        駒井 秀一朗
                      </td>
                      <td className="p-2.5 text-slate-600">開発部</td>
                      <td className="p-2.5 text-right font-bold">2 日</td>
                      <td className="p-2.5 text-right font-bold text-blue-700 font-mono">16.0h</td>
                      <td className="p-2.5 text-right text-slate-500 font-mono">-</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">1.0日</td>
                      <td className="p-2.5 text-center">
                        <button type="button" className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-bold transition cursor-pointer">
                          出勤簿 ➔
                        </button>
                      </td>
                    </tr>
                    <tr className="hover:bg-blue-50/30">
                      <td className="p-2.5 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-700 font-black text-[10px] flex items-center justify-center">山</div>
                        山田 太郎
                      </td>
                      <td className="p-2.5 text-slate-600">営業部</td>
                      <td className="p-2.5 text-right font-bold">3 日</td>
                      <td className="p-2.5 text-right font-bold text-blue-700 font-mono">24.0h</td>
                      <td className="p-2.5 text-right text-slate-500 font-mono">-</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">0.0日</td>
                      <td className="p-2.5 text-center">
                        <button type="button" className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-bold transition cursor-pointer">
                          出勤簿 ➔
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
          number: 2,
          label: '② 作業画面（打刻編集）',
          badge: '直接編集',
          title: '打刻修正モーダルで休憩時間や時刻を管理者が直接保存',
          desc: '修正したい日の【編集】ボタンを押すと打刻修正モーダルが開き、休憩時間（分）や時刻を管理者が直接保存できます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden space-y-4">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm">駒井 秀一朗 の打刻修正（09/02）</h4>
                  <p className="text-[10px] text-blue-100">管理者の権限で打刻時刻や休憩時間を直接修正します</p>
                </div>
                <span className="text-[10px] bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">
                  管理者権限
                </span>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">出勤時刻</label>
                    <input 
                      type="time" 
                      defaultValue="09:00"
                      className="w-full p-2 border border-slate-300 rounded-xl font-bold text-sm bg-slate-50 font-mono" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">退勤時刻</label>
                    <input 
                      type="time" 
                      defaultValue="18:00"
                      className="w-full p-2 border border-slate-300 rounded-xl font-bold text-sm bg-slate-50 font-mono text-blue-700" 
                    />
                  </div>
                </div>

                {/* 休憩時間設定（本物同一） */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-black text-slate-700">休憩時間（分）</label>
                    <span className="text-[11px] text-blue-600 font-bold">※実働から差し引く休憩</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      defaultValue={60}
                      className="w-20 p-2 border border-slate-300 rounded-lg font-bold text-sm bg-white text-center" 
                      placeholder="60"
                    />
                    <span className="text-xs font-bold text-slate-600">分</span>
                    <div className="flex items-center gap-1 ml-auto">
                      {['0', '45', '60', '90'].map(mins => (
                        <button
                          key={mins}
                          type="button"
                          className={`px-2 py-1 text-xs font-bold rounded-md border transition cursor-pointer ${
                            mins === '60'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' 
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {mins}分
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">ステータス</label>
                  <select 
                    defaultValue="退勤済"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs"
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
                    defaultValue="退勤打刻押し忘れのため管理者修正（休憩60分）"
                    className="w-full p-2 border border-slate-200 rounded-xl font-medium text-xs bg-slate-50" 
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button 
                    type="button" 
                    className="px-3.5 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl"
                  >
                    キャンセル
                  </button>
                  <button 
                    type="button" 
                    className="px-5 py-2 bg-blue-600 text-white font-black text-xs rounded-xl shadow-md border-2 border-amber-400 flex items-center gap-1 cursor-default"
                  >
                    保存する 👆
                  </button>
                </div>
              </div>
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
              <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div>
                    <div className="font-black text-emerald-950 text-sm">2026年 9月度 勤怠締め確定ロック</div>
                    <div className="text-[10px] text-emerald-800">
                      確定日時: 2026/09/30 18:30 （確定者: 全社管理者）
                    </div>
                  </div>
                </div>
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 shrink-0">
                  <CheckCheck className="w-3.5 h-3.5" /> 確定済
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs leading-relaxed space-y-2">
                <div className="font-bold text-slate-800">🔒 ロック後の安全性と給与自動連携:</div>
                <p className="text-[11px]">
                  締め確定後は、全従業員の打刻修正や新規申請が自動でロックされ、実績の改ざんが防止されます。<br />
                  給与計算画面で「⚡ 勤怠から一括自動計算」をクリックするだけで、確定した勤務時間が瞬時に反映されます。
                </p>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-white text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1 cursor-default shadow-2xs"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  締めロックを解除（管理者権限）
                </button>
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
 * EmployeeOnboardingSubmission.tsx 本物と100%同一のJSX・スタイル
 */
function RealOnboardingPreview() {
  return (
    <MultiStepGuideContainer
      title="入社手続き・通帳写真提出と口座登録の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（提出フォーム）',
          badge: '画面の場所',
          title: 'ポータルから「入退社・労務手続き」を開く',
          desc: 'ポータルの「入退社・労務手続き」または案内メールから書類提出フォームを開きます。',
          render: () => (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* EmployeeOnboardingSubmission.tsx 本物ヘッダーバナー */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-4 sm:p-5 text-white shadow-md shadow-blue-100">
                <h3 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-cyan-300" />
                  入社・労務手続き 書類提出フォーム
                </h3>
                <p className="text-xs text-blue-100 mt-1 leading-relaxed">
                  スマホから通帳の写真や通勤経路を入力して送信するだけで完了します。写真は自動で軽量化されて送信されます。
                </p>
              </div>

              {/* 本物タブバー */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
                <div className="relative">
                  <div className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-blue-600 text-white shadow-sm border-2 border-amber-400">
                    <CreditCard className="w-4 h-4" />
                    給与振込口座・通帳写真
                  </div>
                  <div className="absolute -top-2.5 -right-2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-xs animate-bounce">
                    👆 ここを選択
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-white text-slate-600 border border-slate-200">
                  <Train className="w-4 h-4" />
                  通勤交通費申請
                </div>

                <div className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-white text-slate-600 border border-slate-200">
                  <Shield className="w-4 h-4" />
                  本人確認・マイナ
                </div>

                <div className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-white text-slate-600 border border-slate-200">
                  <Users className="w-4 h-4" />
                  扶養控除等申告
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center">
                ※提出したい手続きのタブを選択して、スマホから手軽に入力できます。
              </p>
            </div>
          )
        },
        {
          number: 2,
          label: '② 作業画面（口座＆通帳撮影）',
          badge: '入力・撮影',
          title: '銀行口座の入力と通帳の見開き写真をアップロード',
          desc: '給与の振込先口座情報を入力し、通帳またはキャッシュカードの写真を撮影・選択して送信します。',
          render: () => (
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4 max-w-xl mx-auto text-xs">
              <div>
                <h4 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  給与振込口座の登録 ＆ 通帳コピー写真提出
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  給与のお振込み先となる銀行口座をご入力いただき、通帳の表紙・見開き（またはキャッシュカード）の写真をご添付ください。
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    銀行名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="三菱UFJ銀行"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    支店名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="新宿支店"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">口座種別</label>
                  <select
                    disabled
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  >
                    <option>普通預金</option>
                    <option>当座預金</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    口座番号 (7桁) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="1234567"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold tracking-wider font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    口座名義人（カタカナ） <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="コマイ シュウイチロウ"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold"
                  />
                </div>
              </div>

              {/* 通帳写真アップロード枠（本物） */}
              <div className="bg-slate-50 p-3.5 rounded-xl border-2 border-dashed border-slate-300 text-center space-y-2">
                <div className="flex flex-col items-center justify-center gap-1 py-1">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">通帳の見開きまたはキャッシュカードの写真を選択</span>
                  <span className="text-[10px] text-slate-400">※ 写真は自動で最適なサイズに軽量化（圧縮）されます</span>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700">
                      📄
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">passbook_copy.jpg</div>
                      <div className="text-[10px] text-emerald-600 font-bold">自動軽量化完了: 2.4MB ➔ 320KB</div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    添付済
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md border-2 border-amber-400 flex items-center gap-1.5 cursor-default"
                >
                  <Send className="w-4 h-4" />
                  口座情報を提出する 👆
                </button>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 完了・大元台帳への自動反映',
          badge: '登録完了',
          title: '提出完了と同時に労務大元台帳（SSOT）へ自動登録',
          desc: '提出された口座情報は人事管理者が確認し、即座に給与振込先マスターへと一元連動されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5 text-emerald-950 font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>✨ 「給与振込口座 申請」の提出が完了しました！</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-600 text-xs leading-relaxed space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <span>🏢 全システム（SSOT）自動流動完了:</span>
                </div>
                <p className="text-[11px]">
                  提出された銀行口座情報は【入退社労務管理システム】を起点に、毎月の【給与計算システム】へ二重入力なしで自動流動します。<br />
                  次回の給与支給日に、登録した口座へ自動振込が行われます。
                </p>
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
 * Login.tsx 本物と100%同一のJSX・スタイル
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
          title: 'ログイン画面下部の「パスワードを忘れた場合」を押す',
          desc: 'パスワードを忘れてログインできない場合は、ログインフォーム内のリンクをクリックします。',
          render: () => (
            <div className="max-w-sm mx-auto bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4 text-xs">
              <div className="text-center space-y-1">
                <div className="flex justify-center text-blue-600">
                  <LogIn size={40} />
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  システムにログイン
                </h3>
                <p className="text-xs text-gray-600 font-medium">
                  勤怠・有給管理システム
                </p>
              </div>

              {/* Login.tsx 本物フォーム枠 */}
              <div className="bg-white py-5 px-5 shadow-sm rounded-xl border border-gray-200 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    メールアドレス
                  </label>
                  <div className="relative rounded-md shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      readOnly
                      value="you@example.com"
                      className="block w-full pl-9 text-xs border-gray-300 rounded-md py-2 border font-mono bg-slate-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    パスワード
                  </label>
                  <div className="relative rounded-md shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      readOnly
                      value="••••••••"
                      className="block w-full pl-9 text-xs border-gray-300 rounded-md py-2 border bg-slate-50"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      defaultChecked
                      disabled
                      className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="ml-1.5 text-gray-700 text-[11px]">
                      ログイン状態を保存
                    </span>
                  </div>

                  <div className="relative">
                    <span className="font-bold text-blue-600 underline cursor-default bg-amber-100 text-slate-950 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs">
                      パスワードを忘れた場合 👆
                    </span>
                    <div className="absolute -top-3 right-0 bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs whitespace-nowrap animate-bounce">
                      👆 ここをクリック
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-default"
                  >
                    ログイン
                  </button>
                </div>

                <div className="text-center text-[11px] pt-1 border-t border-gray-100 text-blue-600 font-medium">
                  初めての方はこちら（新規登録）
                </div>
              </div>
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
            <div className="max-w-sm mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4 text-xs">
              <div className="text-center space-y-1 border-b pb-3">
                <h4 className="font-black text-slate-900 text-base">パスワード再設定</h4>
                <p className="text-[11px] text-slate-500">
                  ご登録のメールアドレスへ再設定用リンクをお送りします。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  登録メールアドレス
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input 
                    type="email" 
                    readOnly 
                    value="you@example.com" 
                    className="w-full pl-9 pr-3 py-2 bg-white border-2 border-blue-400 rounded-lg text-xs font-mono font-bold" 
                  />
                </div>
              </div>

              <button 
                type="button" 
                className="w-full bg-blue-600 text-white font-black py-2.5 rounded-xl shadow-md border-2 border-amber-400 flex items-center justify-center gap-1.5 cursor-default text-xs"
              >
                <Send className="w-3.5 h-3.5" />
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
            <div className="max-w-sm mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs text-center">
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>✓ 新しいパスワードを設定完了しました！</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                新しいパスワードを使って安全にログインしてください。ログイン後は以前と同じデータでご利用いただけます。
              </p>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 📝 9. 【労働条件通知書（雇用契約書）の電子押印・合意フロー】（3ステップ）
 * UserPayslipView.tsx および OfficialLaborContractDoc.tsx 本物と100%同一のJSX・スタイル
 */
function RealContractSignPreview() {
  return (
    <MultiStepGuideContainer
      title="労働条件通知書（雇用契約書）の確認と電子押印（同意）の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（通知書一覧）',
          badge: '画面の場所',
          title: '「📄 Web給与明細・源泉徴収票・書類」の契約書タブを開く',
          desc: '給与改定や入社時に発行された労働条件通知書は、左メニュー「📄 Web給与明細・源泉徴収票・書類」内の【労働条件通知書 兼 雇用契約書】タブから確認できます。',
          render: () => (
            <div className="max-w-2xl mx-auto space-y-4">
              {/* 書類切り替えタブバー（本物） */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 text-xs">
                <span className="px-3.5 py-2 rounded-xl font-bold bg-white text-slate-600 border border-slate-200">
                  💰 給与明細書
                </span>
                <span className="px-3.5 py-2 rounded-xl font-bold bg-white text-slate-600 border border-slate-200">
                  🎁 賞与明細書
                </span>
                <span className="px-3.5 py-2 rounded-xl font-bold bg-white text-slate-600 border border-slate-200">
                  🧾 源泉徴収票
                </span>
                <div className="relative">
                  <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-sm border-2 border-amber-400 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    労働条件通知書 兼 雇用契約書
                  </span>
                  <div className="absolute -top-2.5 -right-2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-xs animate-bounce">
                    👆 ここを選択
                  </div>
                </div>
              </div>

              {/* 通知書カード（本物） */}
              <div className="bg-white p-5 rounded-2xl border-2 border-indigo-400 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">2026-09分 改定</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                    🕒 電子押印待ち
                  </span>
                </div>
                <h3 className="font-black text-base text-slate-900">
                  労働条件通知書 兼 雇用契約変更合意書
                </h3>
                <div className="text-xs text-slate-600">
                  新基本給: <span className="font-bold text-emerald-700 font-mono text-sm">¥280,000</span> / 改定日: 2026-09-01
                </div>

                <div className="pt-2">
                  <div className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md border-2 border-amber-400">
                    <FileText className="w-4 h-4 text-cyan-300" />
                    書面を確認・印刷する 👆
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 書面原本確認',
          badge: '原本確認',
          title: '労働条件（新基本給・勤務時間・休日・社印）を確認する',
          desc: '社印が捺印された公式労働条件通知書が表示されます。始業〜終業時間（09:00〜18:00）、休日（土曜・日曜・祝日）、新基本給等を確認します。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl border border-slate-300 shadow-lg text-slate-800 space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    労働条件通知書 兼 雇用契約変更合意書
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    労働基準法第15条第1項に基づく労働条件の明示および合意書面
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-right">
                  <div>
                    <div className="text-xs font-black text-slate-800">株式会社KAP</div>
                    <div className="text-[9px] text-slate-500">代表取締役 駒井 秀一朗</div>
                  </div>
                  <div className="w-9 h-9 rounded-lg border-2 border-red-500/40 bg-red-50/50 flex flex-col items-center justify-center text-red-600 font-serif font-black text-[8px] leading-tight select-none">
                    <span>社印</span>
                    <span className="text-[6px]">之印</span>
                  </div>
                </div>
              </div>

              {/* 労働条件明示テーブル */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold text-slate-700 w-1/3">契約期間</td>
                      <td className="p-2.5 text-slate-900">期間の定めなし（無期雇用契約）</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold text-slate-700">始業・終業時刻</td>
                      <td className="p-2.5 text-slate-900 font-mono font-bold text-indigo-900">09:00 〜 18:00（休憩60分・実労働8時間）</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold text-slate-700">休日</td>
                      <td className="p-2.5 text-slate-900">毎週土曜日、日曜日、国民の祝日、年末年始休暇</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold text-slate-700">賃金（改定後基本給）</td>
                      <td className="p-2.5 text-slate-900 font-bold font-mono text-sm text-emerald-700">月給 ¥280,000 円</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2.5 font-bold text-slate-700">賃金締切日・支払日</td>
                      <td className="p-2.5 text-slate-900">毎月末日締切・翌月25日振込支払</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-slate-500 italic text-center">
                ※書面内容に問題がなければ、下部の押印ボタンで電子同意を完了します。
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 電子合意押印',
          badge: '締結完了',
          title: '「内容に同意し、電子印鑑を押印する」ボタンで締結',
          desc: '書面下部の【内容に同意し、電子印鑑を押印する】を押すと、タイムスタンプ付きの電子印鑑が捺印されて契約締結が完了します。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
              {/* 押印アクション枠（本物） */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="text-[11px] text-slate-600 font-medium leading-relaxed">
                  上記の労働条件および雇用契約条項を十分に確認し、すべて同意の上で電子印鑑を押印します。
                </div>

                <div className="relative">
                  <div className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-black text-xs shadow-lg flex items-center justify-center gap-2 border-2 border-amber-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    内容に同意し、電子印鑑を押印する 👆
                  </div>
                  <div className="absolute -top-3 right-4 bg-blue-700 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-md whitespace-nowrap animate-bounce z-10">
                    👆 ここをクリック
                  </div>
                </div>
              </div>

              {/* 押印完了後表示（本物） */}
              <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>2026/09/06 14:00 本人合意押印済み</span>
                  </div>
                  <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                    法的有効
                  </span>
                </div>
                <p className="text-[10px] text-emerald-800 leading-relaxed">
                  タイムスタンプが付与され、労働基準法準拠の電子的契約合意が安全に締結・アーカイブされました。
                </p>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">PDF控えの出力:</span>
                <span className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold border border-slate-200 flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  印刷・PDF
                </span>
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 📚 10. 【労務・法定帳票発行センター（労働者名簿・源泉徴収簿・賃金台帳）フロー】（3ステップ）
 * OfficialReportsCenter.tsx, EmployeeRosterViewer.tsx, WithholdingTaxLedgerViewer.tsx 本物と100%同一のJSX・スタイル
 */
function RealOfficialLedgerPreview() {
  return (
    <MultiStepGuideContainer
      title="労務・法定帳票（労働者名簿・源泉徴収簿・賃金台帳）の発行とA4印刷の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（帳票センター）',
          badge: '帳票選択',
          title: '「労務・法定帳票発行センター」から出力帳票カードを選択',
          desc: '管理メニュー「給与計算・明細」内の【労務・法定帳票発行センター】を開き、労働者名簿、源泉徴収簿、賃金台帳などのカードをクリックします。',
          render: () => (
            <div className="max-w-2xl mx-auto space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  📑 労務・法定帳票発行センター
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  法定様式完全準拠
                </span>
              </div>

              {/* 帳票カード一覧（実画面と100%同一） */}
              <div className="space-y-2">
                <div className="font-black text-slate-700 text-[11px] flex items-center gap-1">
                  <span className="text-blue-600">■</span> 帳簿作成・保管義務のある書類（法定三帳簿）
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-white p-3 rounded-xl border-2 border-blue-500 shadow-md flex items-center justify-between relative bg-blue-50/20">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-xs">労働者名簿</div>
                        <div className="text-[9px] text-slate-400">労基法第107条・1人1ページ様式</div>
                      </div>
                    </div>
                    <div className="absolute -top-2.5 right-2 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-xs animate-bounce">
                      👆 ここをクリック
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-xs">賃金台帳</div>
                        <div className="text-[9px] text-slate-400">労基法第108条・年間支給控除</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="font-black text-slate-700 text-[11px] pt-2 flex items-center gap-1">
                  <span className="text-emerald-600">■</span> 年末調整関係書類
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-slate-800 text-xs">源泉徴収簿</div>
                        <div className="text-[9px] text-slate-400">国税庁公式原本様式</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 法定原本プレビュー',
          badge: '原本確認',
          title: '入社手続き（大元SSOT）から自動差し込みされた帳票原本',
          desc: '入退社労務管理に登録された氏名、生年月日、現住所、マイナンバー、雇入年月日が自動差し込みされた法定様式原本が表示されます。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-300 shadow-lg text-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-black text-slate-900 text-sm">労働者名簿（労基法第107条）原本プレビュー</span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono">社員番号: #2 駒井 秀一朗</span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden text-[11px]">
                <table className="w-full border-collapse">
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="bg-slate-50 p-2 font-bold w-1/4">氏名（フリガナ）</td>
                      <td className="p-2 font-bold text-slate-900">駒井 秀一朗（コマイ シュウイチロウ）</td>
                      <td className="bg-slate-50 p-2 font-bold w-1/5">生年月日</td>
                      <td className="p-2 font-mono">1990年05月15日生</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2 font-bold">現住所</td>
                      <td className="p-2" colSpan={3}>滋賀県大津市坂本3丁目21-16</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-2 font-bold">雇入年月日</td>
                      <td className="p-2 font-mono font-bold text-blue-900">2024年04月01日</td>
                      <td className="bg-slate-50 p-2 font-bold">従事する業務</td>
                      <td className="p-2">システム開発・労務管理</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                入社手続きで提出された基本情報（SSOT）が自動で100%完全に反映されています。
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 公式A4印刷・PDF出力',
          badge: '公式保存',
          title: '実画面専用ボタンから公式A4・横A4で出力保存',
          desc: '労働者名簿は【公式A4印刷】、源泉徴収簿は【A4横で印刷・PDF保存】、賃金台帳は【一括印刷】または【印刷】を押すと、即座に社印付きPDFが出力されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="text-center font-black text-slate-800 text-sm mb-2">
                各帳票画面のアクションボタン（実画面本物）
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs">労働者名簿の印刷:</span>
                  <div className="flex items-center gap-1 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl font-black text-xs shadow-sm border-2 border-amber-400 cursor-default">
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    公式A4印刷 👆
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs">源泉徴収簿の印刷:</span>
                  <div className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold text-xs">
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    A4横で印刷・PDF保存
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs">賃金台帳の印刷:</span>
                  <div className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold text-xs">
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    一括印刷 / 印刷
                  </div>
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
 * 💰 11. 【管理者用：給与一括自動計算・一括確定Web公開フロー】（3ステップ）
 * PayrollAdminDashboard.tsx および PayslipManagement.tsx 本物と100%同一のJSX・スタイル
 */
function RealPayrollAdminPreview() {
  return (
    <MultiStepGuideContainer
      title="管理者用: 勤怠連動の給与一括自動計算とWeb明細公開の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（給与計算・明細）',
          badge: '管理画面',
          title: '管理者メニュー「給与計算・明細」を開く',
          desc: '管理ダッシュボードから「給与計算・明細」を開き、「月別給与計算・明細発行」タブを選択します。当月の勤怠締め確定済みデータが連携されています。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-slate-800 text-base">給与計算・明細発行センター</h3>
                </div>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2.5 py-1 rounded-xl">
                  2026年 9月度（支給日: 09/30）
                </span>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-indigo-900 font-bold flex items-center justify-between">
                <span>月別給与計算・明細発行タブを選択中 ➔</span>
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-black shadow-xs">
                  月別給与計算・明細発行
                </span>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 勤怠から一括自動計算',
          badge: '自動計算実行',
          title: 'ツールバーの「⚡ 勤怠から一括自動計算」をクリック',
          desc: 'ツールバーの【⚡ 勤怠から一括自動計算】を押すと、全員の勤怠実績から総支給・社会保険料・所得税が自動試算されます。マスタ修正時は【🔄 最新マスタから一括再計算】で即同期できます。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
              {/* ツールバー（実画面と100%同一） */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-2">
                <div className="relative">
                  <div className="bg-indigo-600 text-white font-black text-xs px-3.5 py-2 rounded-xl shadow-md border-2 border-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    ⚡ 勤怠から一括自動計算 👆
                  </div>
                  <div className="absolute -top-3 right-2 bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs animate-bounce">
                    👆 ここをクリック
                  </div>
                </div>

                <div className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                  🔄 最新マスタから一括再計算
                </div>

                <div className="bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl opacity-60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  一括確定 (Web公開)
                </div>
              </div>

              {/* 試算結果テーブル（抜粋） */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-600 text-[11px]">
                    <tr>
                      <th className="p-2">従業員名</th>
                      <th className="p-2 text-right">実働 / 残業</th>
                      <th className="p-2 text-right">総支給額</th>
                      <th className="p-2 text-right">控除合計</th>
                      <th className="p-2 text-right">差引支給額 (手取)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-bold text-slate-900">駒井 秀一朗</td>
                      <td className="p-2 text-right font-mono">160h / 10h</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-800">¥285,000</td>
                      <td className="p-2 text-right font-mono text-rose-700">¥49,200</td>
                      <td className="p-2 text-right font-mono font-black text-emerald-600">¥235,800</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 一括確定 (Web公開)',
          badge: '公開完了',
          title: '「一括確定 (Web公開)」でマイページへ即時配信',
          desc: '試算内容の確認が完了したら、【一括確定 (Web公開)】ボタンをクリックします。全従業員のマイページへ給与明細が即時配信され、閲覧・PDF保存が可能になります。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center">
                <div className="relative">
                  <div className="bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-lg border-2 border-amber-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    一括確定 (Web公開) 👆
                  </div>
                  <div className="absolute -top-3 right-3 bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs animate-bounce">
                    👆 ここをクリック
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-950 font-black text-xs">
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  <span>全従業員へのWeb給与明細の配信が完了しました！</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  従業員の「📄 Web給与明細・源泉徴収票・書類」画面に最新の給与明細書が即時表示され、印刷・PDF保存が可能になります。
                </p>
              </div>

              <div className="text-center">
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  ※修正が必要な場合は「一括下書きに戻す (公開取下げ)」でいつでも取下げ可能です
                </span>
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 🏢 12. 【全社基本マスタ・就業時間パターン・給与締め日設定フロー】（3ステップ）
 * CompanySettingsDashboard.tsx 本物と100%同一のJSX・スタイル
 */
function RealCompanyMasterPreview() {
  return (
    <MultiStepGuideContainer
      title="管理者用: 全社就業時間パターン・給与締め日設定の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（マスタ設定センター）',
          badge: 'マスタ本丸',
          title: 'ポータルの「🏢 会社・全社労務マスタ設定センター」を開く',
          desc: '全社マスタの設定は、最高管理者専用の「🏢 会社・全社労務マスタ設定センター」カードからアクセスします。',
          render: () => (
            <div className="max-w-2xl mx-auto space-y-3 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-slate-800 text-base">🏢 会社・全社労務マスタ設定センター</h3>
                </div>
                <div className="flex items-center gap-1 bg-indigo-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-sm border-2 border-amber-400">
                  設定を一括保存 👆
                </div>
              </div>

              {/* マスタタブバー（本物） */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 text-xs">
                <span className="px-3.5 py-2 rounded-xl font-bold bg-white text-slate-600 border border-slate-200">
                  1. 🏢 会社基本情報 ＆ 印鑑
                </span>
                <span className="px-3.5 py-2 rounded-xl font-bold bg-indigo-600 text-white shadow-sm border-2 border-amber-400 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  3. 年間営業カレンダー ＆ 就業時間 👆
                </span>
                <span className="px-3.5 py-2 rounded-xl font-bold bg-white text-slate-600 border border-slate-200">
                  4. 給与締め日 ＆ 割増賃金
                </span>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 就業時間・締め日設定',
          badge: 'パターン設定',
          title: '就業時間パターン一覧 ＆ 給与締め日・支払日を設定',
          desc: '「3. 年間営業カレンダー ＆ 就業時間」で始業・終業時間（09:00〜18:00）や休憩時間を登録し、「4. 給与締め日 ＆ 割増賃金・社会保険設定」で締め日（毎月末日）と支払日（翌月25日）を設定します。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
              {/* 就業時間パターン一覧（本物） */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 text-xs">就業時間パターン一覧（標準勤務時間）</span>
                  <span className="text-[10px] text-blue-600 font-bold">全社デフォルト適用</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">標準勤務（本社オフィス）</span>
                    <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                      始業 09:00 〜 終業 18:00（休憩 60分 / 実働 8.0時間）
                    </div>
                  </div>
                  <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px]">
                    適用中
                  </span>
                </div>
              </div>

              {/* 締め日・支払日設定（本物） */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="font-black text-slate-800 text-xs">給与締め日 ＆ 支給日設定</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">賃金締切日</label>
                    <div className="p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900">
                      毎月末日
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">賃金支払日</label>
                    <div className="p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900">
                      翌月25日（当月支払対応可）
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 設定を一括保存',
          badge: '全社一元反映',
          title: '右上の「設定を一括保存」で全システムへ即座に一元流動',
          desc: '【設定を一括保存】をクリックすると、勤怠打刻、シフト希望、給与計算、雇用契約書の全システムへ即座に一元反映されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
                <div className="relative">
                  <div className="bg-indigo-600 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-lg border-2 border-amber-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-cyan-300" />
                    設定を一括保存 👆
                  </div>
                  <div className="absolute -top-3 right-3 bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs animate-bounce">
                    👆 ここをクリック
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-950 font-black text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>全社労務基本マスタの更新が完了しました！</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  勤怠の所定労働時間・深夜割増、給与計算の締め日、シフトの標準勤務時間が自動同期されました。
                </p>
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 📅 13. 【年間営業カレンダー ＆ 営業日・休日マップ設定フロー】（3ステップ）
 * CompanySettingsDashboard.tsx 本物と100%同一のJSX・スタイル
 */
function RealCompanyCalendarPreview() {
  return (
    <MultiStepGuideContainer
      title="管理者用: 年間休日カレンダー（営業日・休日マップ）登録の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（カレンダータブ）',
          badge: '画面の場所',
          title: '「3. 年間営業カレンダー ＆ 就業時間」を開く',
          desc: '会社マスタ設定センターの「3. 年間営業カレンダー ＆ 就業時間」タブを開くと、「12ヶ月 営業日・休日マップ」が表示されます。',
          render: () => (
            <div className="max-w-2xl mx-auto space-y-3 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-slate-800 text-base">年間営業カレンダー ＆ 休日マップ</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                    営業カレンダー A4印刷 / PDF出力
                  </span>
                  <span className="bg-indigo-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs">
                    設定を一括保存
                  </span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-indigo-900 font-bold flex items-center justify-between">
                <span>12ヶ月 営業日・休日マップを全画面表示中 ➔</span>
                <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-black">
                  カレンダー表示
                </span>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② カレンダー編集・クリック切替',
          badge: '個別切替',
          title: '祝日判定・夏季・年末年始や各日付クリックで切替',
          desc: '国民の祝日（年間16日）や土日公休は自動判定されます。カレンダー上の各日付を直接クリックすることで、「休日（赤）」と「稼働日（白）」をワンタップで切り替え可能です。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-black text-slate-800 text-xs">2026年 9月 営業日・休日マップ（見本）</span>
                <span className="text-[10px] text-slate-500">※日付セルをクリックして切替可能</span>
              </div>

              {/* カレンダー見本 */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                  <div key={d} className={`font-bold py-1 ${i === 0 ? 'text-rose-600' : i === 6 ? 'text-blue-600' : 'text-slate-600'}`}>
                    {d}
                  </div>
                ))}
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-bold">公休</div>
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold">1 稼働</div>
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold">2 稼働</div>
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold">3 稼働</div>
                <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold">4 稼働</div>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 font-bold">5 公休</div>
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-bold">6 公休</div>
              </div>

              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-bold">
                💡 創立記念日や社内研修日など、独自の特別休日もワンクリックで赤色（休日）へ切り替えられます。
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 一括保存 ＆ A4公式印刷',
          badge: '保存と印刷',
          title: '「設定を一括保存」および「営業カレンダー A4印刷」',
          desc: '右上の【設定を一括保存】で確定し、【営業カレンダー A4印刷 / PDF出力】から全社配布・掲示用の年間営業カレンダーを公式出力できます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs text-center">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2">
                <span className="font-bold text-slate-700 text-xs">アクションボタン:</span>
                <div className="flex items-center justify-center gap-2">
                  <div className="bg-indigo-600 text-white font-black text-xs px-4 py-2 rounded-xl shadow-md border-2 border-amber-400">
                    設定を一括保存 👆
                  </div>
                  <div className="bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    営業カレンダー A4印刷 / PDF出力
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                保存後、勤怠カレンダーおよび全従業員のシフト希望提出カレンダーへ公休日が即座に自動反映されます。
              </p>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 📅 14. 【管理者用：シフト希望確認・必要枠設定・全社確定Publishフロー】（3ステップ）
 * ShiftAdminDashboard.tsx および ShiftRequirementSettings.tsx 本物と100%同一のJSX・スタイル
 */
function RealShiftAdminPreview() {
  return (
    <MultiStepGuideContainer
      title="管理者用: シフト希望確認・必要枠設定・全社一括確定の流れ"
      steps={[
        {
          number: 1,
          label: '① シフト希望の確認・承認',
          badge: '希望確認',
          title: '「部下からの申請承認」でスタッフのシフト希望を確認・確定',
          desc: 'スタッフから集まった希望シフトを確認し、【承認してシフト確定】をクリックすると該当日のカレンダーに即座に反映されます。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="font-black text-slate-800 text-sm">部下からのシフト希望申請一覧</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded">未承認 1 件</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">駒井 秀一朗 (開発部)</span>
                  <div className="text-slate-500 text-[11px] mt-0.5">2026/10/01 (木) 希望勤務: 09:00 〜 18:00</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="bg-emerald-600 text-white font-black text-xs px-3 py-1.5 rounded-lg shadow-sm border-2 border-amber-400">
                    承認してシフト確定 👆
                  </div>
                  <span className="bg-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-bold">
                    却下
                  </span>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 必要枠設定',
          badge: '必要枠設定',
          title: '「必要枠設定」で平日・土日・祝日の必要人数を登録',
          desc: '管理者シフト画面の【必要枠設定】ボタン（/shift/admin/patterns）から、「平日」「土日」「祝日」の時間帯・役割ごとの必要人数枠を設定して【設定を保存】をクリックします。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="font-black text-slate-800 text-sm">必要シフト枠設定（曜日・時間帯別）</span>
                <div className="bg-indigo-600 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xs border-2 border-amber-400">
                  設定を保存 👆
                </div>
              </div>
              <div className="flex gap-2">
                <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg font-bold text-[11px]">平日</span>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-bold text-[11px]">土日</span>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg font-bold text-[11px]">祝日</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">朝番（09:00 〜 14:00）</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">ホール担当</div>
                </div>
                <div className="flex items-center gap-1 font-bold text-slate-800">
                  必要人数: <span className="text-indigo-600 font-mono text-sm">2</span> 名
                </div>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 全社一括確定 (Publish)',
          badge: '全社公開',
          title: '「下書き確定（Publish）」で全員のマイページへ公開',
          desc: '全配置が完了したら、右上の緑の【下書き確定（Publish）】ボタンをクリックすると、全スタッフのマイカレンダーへ確定シフトとして一斉公開されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center">
                <div className="relative">
                  <div className="bg-emerald-500 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-lg border-2 border-amber-400 flex items-center gap-1.5">
                    <Send className="w-4 h-4" />
                    下書き確定（Publish） 👆
                  </div>
                  <div className="absolute -top-3 right-3 bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs animate-bounce">
                    👆 ここをクリック
                  </div>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 font-bold text-center">
                全スタッフの「シフト希望・確定シフト」画面およびホーム画面の「本日のシフト予定」へ即座に反映されます。
              </div>
              <div className="text-center text-[10px] text-slate-500">
                ※再調整が必要な場合は「確定解除（下書きへ）」で下書きに戻せます
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 👥 15. 【管理者用：従業員アカウント追加（招待）と退職・復職処理フロー】（3ステップ）
 * AdminDashboard.tsx 本物と100%同一のJSX・スタイル
 */
function RealEmployeeAdminPreview() {
  return (
    <MultiStepGuideContainer
      title="管理者用: 従業員アカウントの招待追加と退職・復職処理の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（従業員管理）',
          badge: '従業員一覧',
          title: '管理ダッシュボード「従業員管理」タブを開く',
          desc: '管理者権限で管理画面を開き、【従業員管理】タブをクリックすると従業員一覧と招待コードが表示されます。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="font-black text-slate-800 text-sm">従業員一覧（全 3 名）</h3>
                <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  従業員を招待する
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                社内全スタッフの雇用形態、所属部署、入社日、承認者、システム権限を一括管理できます。
              </p>
            </div>
          )
        },
        {
          number: 2,
          label: '② 従業員の招待・登録',
          badge: '招待コード',
          title: '「従業員を招待する」または招待コードで共有',
          desc: '【従業員を招待する】からメール招待するか、画面上部の「招待コード」を従業員へ共有します。新規登録画面でコードを入力すると自社組織に自動で紐付きます。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              {/* 招待バナー（実画面と100%同一） */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="text-xs font-bold text-blue-950">従業員の招待方法</h4>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    以下の「招待コード」を従業員に共有してください。<br />
                    従業員が新規登録画面でこのコードを入力すると、自動で組織に紐づきます。
                  </p>
                </div>
                <div className="bg-white px-3.5 py-2 rounded-lg border border-blue-300 flex items-center shadow-xs">
                  <span className="text-[10px] text-slate-500 mr-2">招待コード:</span>
                  <code className="text-xs font-mono font-black text-blue-900 select-all">
                    KAP-TENANT-2026
                  </code>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="relative">
                  <div className="bg-blue-600 text-white font-black text-xs px-4 py-2 rounded-xl shadow-md border-2 border-amber-400 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    従業員を招待する 👆
                  </div>
                  <div className="absolute -top-3 right-3 bg-blue-700 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs animate-bounce">
                    👆 ここをクリック
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 退職処理・復職管理',
          badge: '退職・復職',
          title: '「退職」ボタンで即時停止、「復職」でワンタップ再開',
          desc: '退職時は一覧右端の【退職】ボタンを押すと「退職済」となり即座にログイン権限が停止されます（誤操作時は【復職】で元に戻せます）。所属や役職変更は【編集】から行います。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-[11px] text-slate-500">
                  <tr>
                    <th className="p-2">氏名</th>
                    <th className="p-2">雇用形態</th>
                    <th className="p-2">部署</th>
                    <th className="p-2">権限</th>
                    <th className="p-2 text-right">アクション</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-2 font-bold text-slate-900">山田 太郎</td>
                    <td className="p-2 text-slate-600">正社員</td>
                    <td className="p-2 text-slate-600">営業部</td>
                    <td className="p-2">
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border">
                        退職済
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <span className="text-blue-600 font-bold mr-2">編集</span>
                      <span className="text-emerald-600 font-black cursor-pointer bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        復職
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold text-slate-900">佐藤 花子</td>
                    <td className="p-2 text-slate-600">パート</td>
                    <td className="p-2 text-slate-600">総務部</td>
                    <td className="p-2">
                      <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        一般
                      </span>
                    </td>
                    <td className="p-2 text-right relative">
                      <span className="text-blue-600 font-bold mr-2">編集</span>
                      <span className="text-rose-600 font-black cursor-pointer bg-rose-50 px-2 py-1 rounded border-2 border-amber-400">
                        退職 👆
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        }
      ]}
    />
  );
}

/**
 * 🧾 16. 【賞与支払明細書 ＆ 国税庁公式原本 源泉徴収票フロー】（3ステップ）
 * UserPayslipView.tsx 本物と100%同一のJSX・スタイル
 */
function RealBonusAndTaxSlipPreview() {
  return (
    <MultiStepGuideContainer
      title="従業員用: 賞与明細書および国税庁公式源泉徴収票の閲覧・印刷の流れ"
      steps={[
        {
          number: 1,
          label: '① 場所（書類切り替えタブ）',
          badge: '書類選択',
          title: '「📄 Web給与明細・源泉徴収票・書類」のタブを切り替える',
          desc: '画面左側の「📄 Web給与明細・源泉徴収票・書類」を開くと、上部に各書類の切り替えタブが配置されています。',
          render: () => (
            <div className="max-w-2xl mx-auto space-y-3 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
                <span className="px-3.5 py-2 rounded-xl font-bold bg-white text-slate-600 border border-slate-200">
                  💰 給与明細書
                </span>
                <div className="relative">
                  <span className="px-3.5 py-2 rounded-xl font-bold bg-amber-500 text-white shadow-sm border-2 border-amber-300 flex items-center gap-1">
                    <Gift className="w-4 h-4" />
                    🎁 賞与明細書 👆
                  </span>
                  <div className="absolute -top-2.5 right-1 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-xs animate-bounce">
                    👆 ここを選択
                  </div>
                </div>
                <span className="px-3.5 py-2 rounded-xl font-bold bg-white text-slate-600 border border-slate-200">
                  🧾 源泉徴収票（国税庁公式）
                </span>
              </div>
            </div>
          )
        },
        {
          number: 2,
          label: '② 賞与明細書の確認',
          badge: '賞与明細',
          title: '「🎁 賞与明細書」タブで支給額・控除額・手取りを確認',
          desc: '確定公開された賞与明細を確認し、【印刷 / PDF保存】ボタンでダウンロードできます。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-500" />
                  <span className="font-black text-slate-900 text-sm">2026年 夏季賞与支払明細書</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                    確定公開済
                  </span>
                </div>
                <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1">
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  印刷 / PDF保存 👆
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-blue-800 block">賞与支給総額</span>
                  <span className="font-mono font-bold text-blue-950 text-sm">¥375,000</span>
                </div>
                <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-[10px] text-rose-800 block">控除合計額</span>
                  <span className="font-mono font-bold text-rose-950 text-sm">¥68,500</span>
                </div>
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                  <span className="text-[10px] text-amber-200 block">差引手取額</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">¥306,500</span>
                </div>
              </div>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 国税庁公式 源泉徴収票',
          badge: '源泉徴収票',
          title: '「🧾 源泉徴収票」タブで原本様式をワンクリック出力',
          desc: '国税庁公式原本様式（NTAOHSZ062010060）の源泉徴収票が自動生成され、【A4印刷 / PDF保存】から住宅ローン審査や確定申告用として即座に出力できます。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span className="font-black text-slate-900 text-sm">給与所得の源泉徴収票（国税庁公式原本様式）</span>
                </div>
                <div className="bg-slate-900 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm border-2 border-amber-400">
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  A4印刷 / PDF保存 👆
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                支払金額、給与所得控除後の金額、所得控除の額の合計額、源泉徴収税額、社会保険料等の金額が法定レイアウトで正確に印字されます。
              </div>
            </div>
          )
        }
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// 🌟 ユーザー様ご指摘の不整合を完全是正するピンポイント専用実画面プレビュー群
// ─────────────────────────────────────────────────────────────

/**
 * 📊 月次勤怠・有給照会: 月間勤怠サマリーバッジ ＆ PDF・CSV出力画面（UserDashboard.tsx と100%完全一致）
 * 質問「『月次勤怠・有給照会』画面で自分の出勤日数や労働時間を確認したり、PDF・CSV出力するには？」に対応
 */
export function RealAttendanceSummaryAndExportPreview() {
  const [viewMonthStr, setViewMonthStr] = useState('2026年9月');

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      {/* 上部ヘッダーバー */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            月次勤怠・有給照会（月間サマリーバッジ ＆ PDF・CSV出力）
          </span>
        </div>
        <span className="text-[11px] text-blue-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          {/* 月間勤怠照会ヘッダー ＆ 出力ボタン ＆ サマリー（UserDashboard.tsx 実物コード完全移植） */}
          <div className="flex flex-col md:flex-row justify-between items-center pb-4 border-b border-gray-200 gap-4">
            {/* 年月切り替え */}
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                月間勤怠照会
              </h2>
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 shadow-2xs">
                <button 
                  type="button"
                  onClick={() => setViewMonthStr('2026年8月')}
                  className="p-1.5 hover:bg-gray-200 rounded-l-md transition text-gray-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 font-bold text-gray-800 min-w-[100px] text-center text-xs">
                  {viewMonthStr}
                </span>
                <button 
                  type="button"
                  onClick={() => setViewMonthStr('2026年10月')}
                  className="p-1.5 hover:bg-gray-200 rounded-r-md transition text-gray-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 右側: PDF出力・CSV出力ボタン ＆ サマリーバッジ */}
            <div className="flex flex-col items-end space-y-2 w-full md:w-auto">
              {/* 出力ボタン群（ハイライト付き） */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button 
                    type="button"
                    className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 font-bold transition border border-gray-700 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-gray-200" />
                    📄 PDF出力 (印刷)
                  </button>
                  <div className="absolute -top-3.5 right-1 bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-xs animate-bounce whitespace-nowrap">
                    A4印刷 / PDF
                  </div>
                </div>

                <div className="relative">
                  <button 
                    type="button"
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3.5 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 font-bold transition border border-green-700 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-green-100" />
                    📊 CSV出力
                  </button>
                  <div className="absolute -top-3.5 right-1 bg-emerald-300 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-xs animate-bounce whitespace-nowrap">
                    Excel用DL
                  </div>
                </div>
              </div>

              {/* サマリーバッジ群（出勤 / 実働 / 残業） */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md border border-gray-200 font-medium">
                  出勤: <strong className="font-black text-gray-900 text-sm">20</strong> 日
                </span>
                <span className="bg-blue-50 text-blue-900 px-2.5 py-1 rounded-md border border-blue-200 font-medium">
                  実働: <strong className="font-black text-blue-700 text-sm">160</strong> 時間 <strong className="font-black text-blue-700 text-sm">0</strong> 分
                </span>
                <span className="bg-red-50 text-red-900 px-2.5 py-1 rounded-md border border-red-200 font-medium">
                  残業: <strong className="font-black text-red-600 text-sm">12</strong> 時間 <strong className="font-black text-red-600 text-sm">30</strong> 分
                </span>
              </div>
            </div>
          </div>

          {/* 勤怠テーブル（実物と完全同一レイアウト） */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold">
                <tr>
                  <th className="px-3 py-2 text-left">日付</th>
                  <th className="px-3 py-2 text-left">出勤 (打刻)</th>
                  <th className="px-3 py-2 text-left">退勤 (打刻)</th>
                  <th className="px-3 py-2 text-right">休憩</th>
                  <th className="px-3 py-2 text-right">実働時間</th>
                  <th className="px-3 py-2 text-right">残業時間</th>
                  <th className="px-3 py-2 text-left">備考</th>
                  <th className="px-3 py-2 text-right">アクション</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 font-medium text-gray-700">
                <tr className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-900 font-bold">09/01 (火)</td>
                  <td className="px-3 py-2 whitespace-nowrap">08:55</td>
                  <td className="px-3 py-2 whitespace-nowrap">18:05</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-gray-500">60分</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-bold text-slate-800">8h 10m</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-bold text-red-600">0h 10m</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-400">通常勤務</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <span className="text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-bold">申請する</span>
                  </td>
                </tr>
                <tr className="bg-blue-50/30 hover:bg-blue-50/50">
                  <td className="px-3 py-2 whitespace-nowrap text-blue-600 font-bold">09/02 (水)</td>
                  <td className="px-3 py-2 whitespace-nowrap">09:00</td>
                  <td className="px-3 py-2 whitespace-nowrap">19:30</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-gray-500">60分</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-bold text-slate-800">9h 30m</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-bold text-red-600">1h 30m</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-400">シフト(09:00〜18:00)</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <span className="text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-bold">申請する</span>
                  </td>
                </tr>
                <tr className="bg-gray-50 text-gray-400">
                  <td className="px-3 py-2 whitespace-nowrap text-blue-500 font-bold">09/05 (土)</td>
                  <td className="px-3 py-2 whitespace-nowrap">-</td>
                  <td className="px-3 py-2 whitespace-nowrap">-</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-mono">-</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">-</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">-</td>
                  <td className="px-3 py-2 whitespace-nowrap font-bold text-slate-500">公休</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <span className="text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded text-[11px]">申請する</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ↩️ 各種申請: 直近の申請履歴・状況一覧 ＆ 「↩️ 取下げ」ボタン画面（UserDashboard.tsx と100%完全一致）
 * 質問「一度提出した有給申請や打刻修正を取り消したい、または変更したい時は？」に対応
 */
export function RealRequestCancelPreview() {
  const [canceled, setCanceled] = useState(false);

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      {/* 上部ヘッダーバー */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            各種申請: 直近の申請履歴・状況一覧 ＆ 「↩️ 取下げ」取消手順
          </span>
        </div>
        <span className="text-[11px] text-rose-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-xl mx-auto space-y-4">
          {/* 取下げ手順のポイント解説バナー */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <span className="text-base leading-none">💡</span>
            <div className="space-y-1 leading-relaxed">
              <p className="font-bold text-amber-950">
                【申請取消のルール】
              </p>
              <p>
                ・<strong>上長が承認する前（ステータスが「申請中」）</strong>：下記の赤文字『<strong>↩️ 取下げ</strong>』ボタンをクリックするだけで、即座にキャンセル・削除できます。
              </p>
              <p className="text-slate-600">
                ・<strong>既に承認された後（ステータスが「承認」）</strong>：データが確定しているため、社内の上長または管理者へ直接連絡して修正を依頼してください。
              </p>
            </div>
          </div>

          {/* 直近の申請履歴・状況カード（UserDashboard.tsx L2233〜2275 完全同一構造） */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                直近の申請履歴・状況
              </h3>
              <span className="text-[11px] text-gray-400">各種申請画面の右側カラムに常時表示</span>
            </div>

            {/* 申請中カード（取下げボタンハイライト） */}
            {!canceled ? (
              <div className="p-3.5 rounded-xl border-2 border-rose-300 bg-rose-50/30 hover:bg-rose-50/50 transition text-xs relative">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-bold text-gray-900 text-sm">有給休暇（全休）</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-yellow-100 text-yellow-800 border-yellow-300">
                      申請中
                    </span>
                    {/* ここをクリックの吹き出し */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('この「有給休暇（全休）」申請を取り下げて取消しますか？')) {
                            setCanceled(true);
                          }
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border-2 border-rose-400 px-3 py-1 rounded-lg font-black transition cursor-pointer shadow-xs animate-pulse flex items-center gap-1"
                        title="申請を取り下げて取消す"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        ↩️ 取下げ
                      </button>
                      <div className="absolute -top-3 right-0 bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-md whitespace-nowrap animate-bounce">
                        👆 ここを押して取消
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-[11px] font-medium">
                  対象期間: 2026-09-15 ～ 2026-09-15 (1日間)
                </p>
                <p className="text-gray-500 text-[11px] mt-1">
                  事由: 私用のため（有給休暇取得）
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-xs text-gray-500 space-y-2">
                <div className="text-emerald-600 font-bold flex items-center justify-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  申請を取り下げました（履歴から消去完了）
                </div>
                <button
                  type="button"
                  onClick={() => setCanceled(false)}
                  className="text-[11px] text-blue-600 underline font-bold cursor-pointer"
                >
                  もう一度プレビューを試す
                </button>
              </div>
            )}

            {/* 承認済みカード（取消不可の例） */}
            <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-gray-800">打刻修正</span>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border bg-green-100 text-green-800 border-green-200">
                    承認
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    （確定済みのため管理者へ修正依頼）
                  </span>
                </div>
              </div>
              <p className="text-gray-500 text-[11px]">
                2026-09-02 (出勤 09:00 / 休憩 60分)
              </p>
              <p className="text-gray-400 text-[11px] mt-0.5">
                理由: 交通機関遅延による打刻忘れ修正
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 📅 シフト: 確定シフトの確認画面（UserDashboard.tsx 実物完全同一構造）
 * 質問「【従業員】確定したシフトはどこで見られますか？」に対応
 */
export function RealConfirmedShiftViewPreview() {
  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      {/* 上部ヘッダーバー */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            確定シフトの確認（ホーム画面の予定カード ＆ カレンダーの「確定」バッジ）
          </span>
        </div>
        <span className="text-[11px] text-indigo-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70 space-y-4">
        {/* 確認場所 1: ホーム（打刻）画面の「本日の確定シフト予定」カード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-2">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-bold text-gray-500">【確認場所 1】左メニュー「ホーム（打刻）」画面</span>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200">
              毎朝自動表示
            </span>
          </div>

          {/* UserDashboard.tsx L1206〜1237 と100%同一のJSX */}
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-3.5 flex items-center justify-between">
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
            <div className="text-[11px] font-bold text-indigo-600 underline">
              シフト希望・確認 &rarr;
            </div>
          </div>
        </div>

        {/* 確認場所 2: 「シフト希望・確定シフト」画面の月間カレンダー */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-bold text-gray-500">【確認場所 2】左メニュー「シフト希望・確定シフト」画面</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
              月間カレンダー
            </span>
          </div>

          {/* シフトステータスバナー（確定済み） */}
          <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/15 border-2 border-emerald-400 rounded-xl p-3 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
              ✓
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  確定済み
                </span>
                <span className="text-xs font-black text-slate-900">
                  2026-09月度のシフトが確定しています
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                出勤: <strong className="text-indigo-700 font-bold">18日</strong> / 公休: <strong className="text-slate-700 font-bold">12日</strong> （※カレンダー内の「確定」バッジが確定シフトです）
              </p>
            </div>
          </div>

          {/* 7列カレンダーセル（一部抜粋） */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xs text-xs">
            <div className="grid grid-cols-5 bg-slate-800 text-white text-center font-bold py-2">
              <div>9/1 (火)</div>
              <div>9/2 (水)</div>
              <div>9/3 (木)</div>
              <div>9/4 (金)</div>
              <div className="text-cyan-300">9/5 (土)</div>
            </div>
            <div className="grid grid-cols-5 gap-px bg-gray-200 p-px">
              <div className="bg-white p-2.5 min-h-[85px] flex flex-col justify-between">
                <span className="font-bold text-slate-700">1</span>
                <div className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[11px] font-black text-center shadow-xs">
                  確定 09:00〜18:00
                </div>
                <span className="text-[9px] text-gray-400 text-center">出勤確定</span>
              </div>
              <div className="bg-white p-2.5 min-h-[85px] flex flex-col justify-between">
                <span className="font-bold text-slate-700">2</span>
                <div className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[11px] font-black text-center shadow-xs">
                  確定 09:00〜18:00
                </div>
                <span className="text-[9px] text-gray-400 text-center">出勤確定</span>
              </div>
              <div className="bg-white p-2.5 min-h-[85px] flex flex-col justify-between">
                <span className="font-bold text-slate-700">3</span>
                <div className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[11px] font-black text-center shadow-xs">
                  確定 10:00〜19:00
                </div>
                <span className="text-[9px] text-gray-400 text-center">出勤確定</span>
              </div>
              <div className="bg-white p-2.5 min-h-[85px] flex flex-col justify-between">
                <span className="font-bold text-slate-700">4</span>
                <div className="bg-indigo-600 text-white px-2 py-1 rounded-md text-[11px] font-black text-center shadow-xs">
                  確定 09:00〜18:00
                </div>
                <span className="text-[9px] text-gray-400 text-center">出勤確定</span>
              </div>
              <div className="bg-slate-50 p-2.5 min-h-[85px] flex flex-col justify-between">
                <span className="font-bold text-blue-600">5</span>
                <div className="bg-slate-200 text-slate-700 px-2 py-1 rounded-md text-[11px] font-bold text-center">
                  公休 (休み)
                </div>
                <span className="text-[9px] text-gray-400 text-center">シフト公休</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ☕ 休憩時間: 登録・確認・修正画面（UserDashboard.tsx 打刻修正内プリセット完全一致）
 * 質問「休憩時間はどのように登録・確認・修正できますか？」に対応
 */
export function RealBreakTimeSettingPreview() {
  const [selectedBreak, setSelectedBreak] = useState('60');

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            休憩時間の登録・確認・打刻修正（自動控除 ＆ 分数プリセット）
          </span>
        </div>
        <span className="text-[11px] text-cyan-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 space-y-1">
            <p className="font-bold">💡 休憩時間の計算ルール:</p>
            <p>1. 通常は法定時間に基づき自動控除されます（実働6時間超で45分、8時間超で60分）。</p>
            <p>2. 実績と異なる場合は、「月次勤怠・有給照会」の該当日右端「申請する」または「各種申請」から分数を直接指定して申請・修正できます。</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              打刻修正申請フォーム（休憩時間設定箇所）
            </h3>

            {/* UserDashboard.tsx L2124〜2154 休憩時間完全再現 */}
            <div className="bg-blue-50/70 p-4 rounded-xl border-2 border-blue-300 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-800">休憩時間（分）</label>
                <span className="text-[11px] text-blue-600 font-medium">※当日実働から差し引く休憩時間</span>
              </div>
              <div className="flex items-center space-x-3">
                <input 
                  type="number" 
                  value={selectedBreak}
                  onChange={(e) => setSelectedBreak(e.target.value)}
                  className="block w-24 px-3 py-1.5 border border-gray-300 rounded-lg shadow-sm font-bold text-center text-sm bg-white" 
                />
                <span className="text-xs text-gray-600 font-bold">分</span>
                <div className="flex items-center space-x-1.5 ml-2">
                  {['0', '45', '60', '90'].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setSelectedBreak(mins)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        selectedBreak === mins 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {mins}分
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-[11px] text-gray-500">
              ※ ボタンをワンタップするだけで [0分 / 45分 / 60分 / 90分] の休憩時間を即座にセットできます。直接手入力で75分など自由な分数の指定も可能です。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 🌙 夜勤打刻: 日付またぎ勤務・深夜割増（UserDashboard.tsx 本物打刻画面完全一致）
 * 質問「日付をまたぐ夜勤（徹夜勤務・24時以降の退勤）はどう打刻しますか？」に対応
 */
export function RealNightShiftPreview() {
  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            夜勤・日跨ぎ勤務の打刻（前日出勤 ➔ 翌朝退勤の自動連動）
          </span>
        </div>
        <span className="text-[11px] text-purple-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-950 space-y-1">
            <p className="font-bold">🌙 夜勤（日跨ぎ）の安心ルール:</p>
            <p>前日に「出勤」を押した後、翌朝そのまま「退勤」を押すだけで自動判定されます。日付が変わる深夜0時に再打刻する必要はありません。</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center relative">
            <div className="mb-3 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full flex items-center gap-1.5 text-xs text-purple-900 font-bold">
              <span>🌙 夜勤・日跨ぎ勤務中</span>
            </div>

            <h2 className="text-gray-500 font-medium mb-1 text-xs">翌朝の現在時刻</h2>
            <div className="text-4xl font-bold text-gray-800 tracking-wider mb-4 tabular-nums">
              07:15:30
            </div>

            <div className="flex w-full space-x-3 mb-4">
              <button 
                disabled 
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold text-base opacity-40 cursor-not-allowed"
              >
                出勤
              </button>
              <div className="flex-1 relative">
                <button 
                  type="button"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-bold text-base transition shadow-md ring-4 ring-orange-200 animate-pulse cursor-pointer"
                >
                  退勤
                </button>
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-md whitespace-nowrap animate-bounce">
                  翌朝そのまま退勤！
                </div>
              </div>
            </div>

            <div className="w-full bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 flex justify-around text-xs text-center">
              <div>
                <span className="text-[10px] text-gray-500 block">前日出勤打刻</span>
                <span className="font-bold text-gray-800 text-sm">22:00</span>
              </div>
              <div className="border-l border-gray-300 pl-4">
                <span className="text-[10px] text-gray-500 block">現在のステータス</span>
                <span className="font-bold text-blue-600 text-sm">勤務中</span>
              </div>
              <div className="border-l border-gray-300 pl-4">
                <span className="text-[10px] text-gray-500 block">深夜割増</span>
                <span className="font-bold text-purple-600 text-sm">自動計算</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 🌴 半休申請: 午前・午後有休（0.5日消化）画面（UserDashboard.tsx 申請種類完全一致）
 * 質問「半日単位（午前半休・午後半休）で有給を取るにはどうしますか？」に対応
 */
export function RealHalfDayLeavePreview() {
  const [halfType, setHalfType] = useState('有給休暇（午前半休）');

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            各種申請: 半休（午前半休・午後半休）の申請手順
          </span>
        </div>
        <span className="text-[11px] text-emerald-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-1">
            <p className="font-bold">🌴 半休の取得ルール:</p>
            <p>「有給休暇（午前半休）」または「有給休暇（午後半休）」を選択すると、有給残数が【0.5日】ずつ正確に消化されます。</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              各種申請フォーム（半休選択箇所）
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">申請種類</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHalfType('有給休暇（午前半休）')}
                    className={`p-3 rounded-xl border-2 text-left font-bold transition cursor-pointer ${
                      halfType === '有給休暇（午前半休）'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>有給休暇（午前半休）</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">0.5日消化</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 font-normal">午前の勤務を休み、午後から出勤</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHalfType('有給休暇（午後半休）')}
                    className={`p-3 rounded-xl border-2 text-left font-bold transition cursor-pointer ${
                      halfType === '有給休暇（午後半休）'
                        ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>有給休暇（午後半休）</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">0.5日消化</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 font-normal">午前中出勤し、午後の勤務を休む</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">対象日</label>
                  <input type="text" readOnly value="2026/09/20" className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">事由・備考</label>
                  <input type="text" readOnly value="通院のため（午前半休）" className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-medium" />
                </div>
              </div>

              <button
                type="button"
                className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg shadow-sm text-xs"
              >
                申請を送信
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 💌 特別休暇（慶弔・結婚・代休）の申請画面（UserDashboard.tsx 申請種類完全一致）
 * 質問「慶弔休暇（忌引き・結婚）や代休などの特別休暇はどう申請しますか？」に対応
 */
export function RealSpecialLeaveApplyPreview() {
  const [selectedType, setSelectedType] = useState('特別休暇（慶弔など）');

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-pink-600 to-indigo-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            各種申請: 特別休暇（慶弔・結婚等）および代休の申請手順
          </span>
        </div>
        <span className="text-[11px] text-pink-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-xl mx-auto space-y-4 text-xs">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              各種申請フォーム（特別休暇・代休）
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">申請種類</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedType('特別休暇（慶弔など）')}
                    className={`flex-1 p-2.5 rounded-lg border font-bold text-xs transition cursor-pointer ${
                      selectedType === '特別休暇（慶弔など）'
                        ? 'border-pink-500 bg-pink-50 text-pink-900 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    特別休暇（慶弔など）
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType('代休（全休）')}
                    className={`flex-1 p-2.5 rounded-lg border font-bold text-xs transition cursor-pointer ${
                      selectedType === '代休（全休）'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    代休（全休）
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">開始日</label>
                  <input type="text" readOnly value="2026/10/01" className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">終了日</label>
                  <input type="text" readOnly value="2026/10/03" className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-medium" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">事由・備考</label>
                <input 
                  type="text" 
                  readOnly 
                  value={selectedType.includes('特別') ? '本人結婚式および新婚旅行のため（就業規則特別有給3日付与）' : '休日出勤（9/5）の代休取得'} 
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-medium" 
                />
              </div>

              <button
                type="button"
                className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg shadow-sm text-xs"
              >
                申請を送信
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 📱 ホーム画面追加（PWA化）手順画面
 * 質問「スマートフォンのホーム画面にアイコンを追加してアプリのように使うには？」に対応
 */
export function RealPwaInstallPreview() {
  const [device, setDevice] = useState<'iphone' | 'android'>('iphone');

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            スマートフォン: ホーム画面にアプリアイコンを追加（PWA起動）
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setDevice('iphone')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              device === 'iphone' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            iPhone (Safari)
          </button>
          <button
            type="button"
            onClick={() => setDevice('android')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
              device === 'android' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            Android (Chrome)
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 text-xs">
          {device === 'iphone' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b pb-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>iPhone（Safariブラウザ）での追加手順</span>
              </div>
              <ol className="space-y-2.5 text-slate-700 list-decimal list-inside leading-relaxed">
                <li>Safariでシステムを開き、画面下の<strong>共有ボタン（四角から上矢印）</strong>をタップします。</li>
                <li>メニューを下にスクロールし、<strong>「ホーム画面に追加」</strong>をタップします。</li>
                <li>右上の<strong>「追加」</strong>をタップすると、ホーム画面に勤怠アプリアイコンが作成されます。</li>
              </ol>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-center font-bold">
                次回からアイコンをタップするだけで全画面アプリとして起動します！
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b pb-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span>Android（Chromeブラウザ）での追加手順</span>
              </div>
              <ol className="space-y-2.5 text-slate-700 list-decimal list-inside leading-relaxed">
                <li>Chromeでシステムを開き、画面右上の<strong>メニュー（3点リーダー）</strong>をタップします。</li>
                <li>メニュー内の<strong>「ホーム画面に追加」</strong>（または「アプリをインストール」）をタップします。</li>
                <li>確認画面で<strong>「追加」</strong>をタップします。</li>
              </ol>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-center font-bold">
                次回からアイコンをタップするだけで全画面アプリとして起動します！
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 🌴 有給残数・年間5日取得義務カード（UserDashboard.tsx 本物と100%同一）
 * 質問「自分の有給休暇の残り日数（残日数）や有効期限はどこで確認できますか？」に対応
 */
export function RealLeaveBalanceCheckPreview() {
  return (
    <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-[11px] px-2 py-0.5 rounded shadow-xs">
            実画面プレビュー
          </span>
          <span className="font-bold text-slate-200 text-xs truncate">
            有給休暇・代休 残数 ＆ 年間5日取得義務アラートカード
          </span>
        </div>
        <span className="text-[11px] text-blue-300 font-bold shrink-0 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          実画面と100%完全連動
        </span>
      </div>

      <div className="p-4 sm:p-6 bg-slate-50/70">
        <div className="max-w-md mx-auto space-y-4">
          {/* UserDashboard.tsx L1180〜1250 と100%同一のJSX */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
            <h2 className="text-sm font-bold text-gray-800 border-b pb-2 flex items-center justify-between">
              <span>有給休暇・代休 残数</span>
              <span className="text-[10px] text-gray-400 font-normal">ホーム画面に常時表示</span>
            </h2>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                <span className="font-medium text-blue-900">有給休暇（今年度付与分）</span>
                <span className="text-xl font-bold text-blue-700">10<span className="text-xs font-normal ml-1">日</span></span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <span className="font-medium text-gray-700">有給休暇（前年度繰越分）</span>
                <span className="text-base font-bold text-gray-700">5<span className="text-xs font-normal ml-1">日</span></span>
              </div>
              <div className="flex justify-between items-center bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                <span className="font-bold text-gray-800">有給休暇（合計残数）</span>
                <span className="text-xl font-black text-gray-900">
                  15<span className="text-xs font-normal ml-1">日</span>
                </span>
              </div>
              <div className="flex justify-between items-center bg-green-50 p-2.5 rounded-lg border border-green-100">
                <span className="font-medium text-green-900">利用可能な代休</span>
                <span className="text-base font-bold text-green-700">0<span className="text-xs font-normal ml-1">日</span></span>
              </div>

              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start">
                <CheckCircle className="text-yellow-600 w-4 h-4 mr-2 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-800 leading-relaxed">
                  有給取得義務（年間5日）に対して、今年度現在 <strong>2日</strong> 取得済みです。
                  <span>期限までに残り <strong>3日</strong> の取得が必要です。</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

