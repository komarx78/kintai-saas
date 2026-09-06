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
          title: 'ホーム画面（打刻）の左上に大きく配置されています',
          desc: '毎日の出勤時・退勤時は、ログイン後のホーム画面左上にある打刻時計ウィジェットを使います。',
          render: () => (
            <div className="max-w-2xl mx-auto bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                ホーム画面のレイアウト全体イメージ
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 左上: 打刻時計（ハイライト） */}
                <div className="p-4 bg-blue-50/60 rounded-xl border-2 border-blue-500 shadow-md relative">
                  <div className="absolute -top-3 left-4 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-xs">
                    👈 ここで打刻します
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-slate-500 font-bold">現在時刻</span>
                    <div className="text-3xl font-black text-slate-900 font-mono tracking-wider my-1">
                      08:58:45
                    </div>
                    <div className="flex gap-2 mt-3">
                      <div className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-xs text-center shadow-xs">
                        出勤
                      </div>
                      <div className="flex-1 bg-slate-200 text-slate-400 py-2 rounded-lg font-bold text-xs text-center opacity-60">
                        退勤
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右側: 有給残数・本日の予定（参考表示） */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs opacity-75">
                  <div className="font-bold text-slate-700 mb-2 border-b pb-1">有給休暇 残数</div>
                  <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 mb-2">
                    <span className="text-slate-600">有休合計残数</span>
                    <span className="text-sm font-bold text-blue-700">14.5日</span>
                  </div>
                  <div className="font-bold text-slate-700 mb-1 border-b pb-1">本日のシフト予定</div>
                  <div className="text-[11px] text-slate-600">09:00 〜 18:00（ホール）</div>
                </div>
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
            <div className="max-w-sm mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-4">
              <span className="text-xs text-slate-400 font-bold">現在時刻</span>
              <div className="text-4xl font-black text-slate-900 font-mono tracking-wider tabular-nums">
                09:00:12
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-sm shadow-md border-2 border-amber-400 cursor-pointer animate-pulse"
                >
                  出勤 👆
                </button>
                <button
                  type="button"
                  disabled
                  className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-bold text-sm cursor-not-allowed border border-slate-200"
                >
                  退勤
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-xs">
                <span className="text-slate-500 font-bold">ステータス:</span>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                  ● 勤務中
                </span>
              </div>
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
            <div className="max-w-sm mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-4">
              <span className="text-xs text-slate-400 font-bold">現在時刻</span>
              <div className="text-4xl font-black text-slate-900 font-mono tracking-wider tabular-nums">
                18:00:05
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled
                  className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-bold text-sm cursor-not-allowed border border-slate-200"
                >
                  出勤
                </button>
                <button
                  type="button"
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-black text-sm shadow-md border-2 border-amber-400 cursor-pointer animate-pulse"
                >
                  退勤 👆
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 p-3 bg-slate-50 rounded-xl text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">本日の出勤:</span>
                  <span className="font-bold text-slate-800 font-mono">09:00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">本日の退勤:</span>
                  <span className="font-bold text-slate-800 font-mono">18:00</span>
                </div>
                <div className="flex justify-between text-blue-700 font-bold pt-1 border-t border-slate-200">
                  <span>実働集計（休憩1h除外）:</span>
                  <span>8時間00分</span>
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
          title: 'ホームで残日数を確認し、左メニュー「各種申請」を開く',
          desc: '有休残数カードで残日数を確認し、左メニューの【各種申請】または勤怠画面の【申請する】をクリックします。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="text-xs font-bold text-slate-500 flex items-center justify-between border-b pb-2">
                <span>有給休暇・代休 残数カード（ホーム画面）</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">常時表示</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <span className="font-bold text-blue-900">有給休暇（今年度付与分）</span>
                  <span className="text-xl font-black text-blue-700 font-mono">10.0 日</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-600">有給休暇（前年度繰越分）</span>
                  <span className="text-sm font-bold text-slate-700 font-mono">4.5 日</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded-xl shadow-xs">
                  <span className="font-bold">有給休暇 合計残数</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">14.5 日</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-bold flex items-center justify-between">
                <span>申請は左メニュー【各種申請】をクリック ➔</span>
                <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded text-[10px] font-black">
                  👆 メニューへ
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
            <div className="max-w-lg mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-md space-y-3 text-xs">
              <h4 className="font-black text-sm text-slate-900 border-b pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                有給休暇 申請フォーム
              </h4>

              <div>
                <label className="block font-bold text-slate-700 mb-1">申請種類</label>
                <select className="w-full bg-white border border-blue-400 ring-2 ring-blue-100 rounded-lg p-2.5 font-bold text-slate-800" defaultValue="有給休暇（全休）">
                  <option>有給休暇（全休） - 1.0日消化</option>
                  <option>有給休暇（午前半休） - 0.5日消化</option>
                  <option>有給休暇（午後半休） - 0.5日消化</option>
                  <option>特別休暇（慶弔等）</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">開始日</label>
                  <input type="date" defaultValue="2026-09-15" className="w-full bg-white border border-slate-300 rounded-lg p-2" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">終了日</label>
                  <input type="date" defaultValue="2026-09-15" className="w-full bg-white border border-slate-300 rounded-lg p-2" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">申請事由</label>
                <input type="text" defaultValue="私用のため（役所手続き）" className="w-full bg-white border border-slate-300 rounded-lg p-2" />
              </div>

              <button
                type="button"
                className="w-full mt-2 bg-blue-600 text-white font-black py-2.5 rounded-xl shadow-md border-2 border-amber-400 flex items-center justify-center gap-1.5 cursor-default"
              >
                有休申請を送信する 👆
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
            <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>🎉 有休申請が承認され、残日数が自動更新されました！</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-slate-500">残日数の推移:</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">申請前残数:</span>
                  <span className="font-mono line-through text-slate-400">14.5 日</span>
                </div>
                <div className="flex items-center justify-between text-base font-black text-blue-700 pt-1 border-t border-slate-200">
                  <span>承認後 合計残数:</span>
                  <span className="font-mono text-xl">13.5 日（-1.0日）</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500">
                ※半休（午前半休・午後半休）の場合は 0.5日 がマイナスされます。
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
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 max-w-4xl mx-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 text-xs">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  月間勤怠照会（2026年9月度）
                </h4>
                <span className="text-[11px] text-slate-500">※行の右端に「申請する」ボタンが並んでいます</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse min-w-[650px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2 w-24">日付</th>
                      <th className="p-2 w-20">出勤</th>
                      <th className="p-2 w-20">退勤</th>
                      <th className="p-2 text-center w-16">休憩</th>
                      <th className="p-2 text-right w-16">実働</th>
                      <th className="p-2 text-right w-16">残業</th>
                      <th className="p-2">備考</th>
                      <th className="p-2 text-right w-28 font-black text-blue-700">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-medium">09/01 (火)</td>
                      <td className="p-2 font-mono">09:00</td>
                      <td className="p-2 font-mono">18:00</td>
                      <td className="p-2 text-center font-mono">60m</td>
                      <td className="p-2 text-right font-mono font-bold">8h</td>
                      <td className="p-2 text-right font-mono text-slate-400">-</td>
                      <td className="p-2 text-slate-500">通常勤務</td>
                      <td className="p-2 text-right">
                        <span className="text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px]">申請する</span>
                      </td>
                    </tr>
                    {/* ここをアニメーションハイライト */}
                    <tr className="bg-blue-50/70 border-2 border-blue-400 rounded-lg">
                      <td className="p-2 font-black text-blue-900">09/04 (金)</td>
                      <td className="p-2 font-mono font-bold text-slate-800">09:00</td>
                      <td className="p-2 font-mono font-bold text-rose-600">打刻漏れ</td>
                      <td className="p-2 text-center font-mono text-slate-500">-</td>
                      <td className="p-2 text-right font-mono text-slate-400">-</td>
                      <td className="p-2 text-right font-mono text-slate-400">-</td>
                      <td className="p-2 text-rose-600 font-bold">退勤打刻の押し忘れ</td>
                      <td className="p-2 text-right relative">
                        <button
                          type="button"
                          className="bg-blue-600 text-white font-black px-3 py-1 rounded-lg text-xs shadow-md border-2 border-amber-400 flex items-center gap-1 ml-auto cursor-default animate-pulse"
                        >
                          申請する 👆
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">09/05 (土)</td>
                      <td className="p-2 text-center text-slate-400">-</td>
                      <td className="p-2 text-center text-slate-400">-</td>
                      <td className="p-2 text-center text-slate-400">-</td>
                      <td className="p-2 text-right text-slate-400">-</td>
                      <td className="p-2 text-right text-slate-400">-</td>
                      <td className="p-2 text-slate-500 font-bold">公休</td>
                      <td className="p-2 text-right">
                        <span className="text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[10px]">申請する</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2 text-xs text-amber-900 font-bold">
                <span className="text-base">💡</span>
                <span>ボタンを押すと、その日付（09/04）が自動入力された状態で各種申請フォームが開きます！</span>
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 max-w-xl mx-auto space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">各種申請フォーム</h4>
                    <p className="text-[11px] text-slate-500">打刻修正および休憩時間登録</p>
                  </div>
                </div>
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold">
                  入力中
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">申請種類</label>
                  <input type="text" readOnly value="打刻修正" className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 font-bold text-blue-700" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">対象日</label>
                  <input type="text" readOnly value="2026-09-04" className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">修正区分</label>
                  <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold" defaultValue="退勤">
                    <option>出勤</option>
                    <option>退勤</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">正しい打刻時間</label>
                  <input type="text" readOnly value="20:00" className="w-full bg-white border border-blue-500 rounded-lg px-3 py-2 font-mono font-black text-blue-700 ring-2 ring-blue-200" />
                </div>

                {/* 休憩時間入力のハイライト */}
                <div className="sm:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-xl border-2 border-blue-400">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                      <span>⏰ 休憩時間（分）</span>
                      <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">新機能</span>
                    </label>
                    <span className="text-[10px] text-blue-700 font-bold">※当日実働から差し引く休憩</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value="60" 
                      className="w-20 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-black text-center text-sm text-slate-900" 
                    />
                    <span className="text-xs font-bold text-slate-700">分</span>
                    <div className="flex items-center gap-1 ml-auto">
                      {['0分', '45分', '60分', '90分'].map((m) => (
                        <span
                          key={m}
                          className={`px-2.5 py-1 text-xs font-black rounded-lg border ${
                            m === '60分'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">事由・備考</label>
                  <input type="text" readOnly value="業務終了時の打刻押し忘れのため" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2" />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md border-2 border-amber-400 flex items-center gap-1.5 cursor-default"
                >
                  <CheckCircle className="w-4 h-4" /> 申請を送信する 👆
                </button>
              </div>
            </div>
          )
        },
        {
          number: 4,
          label: '④ 完了・反映結果',
          badge: '承認と完了',
          title: '申請中バッジの表示と、承認後の自動反映',
          desc: '送信後は行に「申請中」と表示され、上長・管理者が承認すると直ちに正しい打刻・休憩時間・実働時間に更新されます！',
          render: () => (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 max-w-3xl mx-auto space-y-4">
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

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[11px] min-w-[600px]">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                    <tr>
                      <th className="p-2.5">日付</th>
                      <th className="p-2.5">出勤</th>
                      <th className="p-2.5">退勤</th>
                      <th className="p-2.5 text-center">休憩</th>
                      <th className="p-2.5 text-right">実働</th>
                      <th className="p-2.5 text-right">残業</th>
                      <th className="p-2.5">状態・備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-emerald-50/40">
                      <td className="p-2.5 font-bold text-slate-900">09/04 (金)</td>
                      <td className="p-2.5 font-mono font-bold">09:00</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700">20:00 (承認済)</td>
                      <td className="p-2.5 text-center font-bold text-blue-700">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black">60m</span>
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-slate-900">10h 00m</td>
                      <td className="p-2.5 text-right font-mono font-black text-rose-600">2h 00m</td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                          ✓ 修正承認完了
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">📊 計算の内訳:</div>
                <div className="text-[11px]">
                  ・総拘束時間: 9:00 〜 20:00（11時間00分）<br />
                  ・指定休憩時間: <strong className="text-blue-700 font-bold">60分（1時間）控除</strong><br />
                  ・実労働時間: 11時間 − 1時間 ＝ <strong className="text-slate-900 font-bold">10時間00分</strong>（法定8時間を超える2時間は自動で残業時間に計上）
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
          title: '来月度のカレンダーで希望時間帯・公休を指定する',
          desc: '各日付をタップして、出勤したい希望時間帯（例: 09:00〜18:00）または「公休希望（休み）」を選択します。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-md space-y-3 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-black text-slate-800 text-sm">2026年10月度 シフト希望入力</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded">提出受付中</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800">10月1日 (木)</span>
                  <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-lg text-xs">
                    09:00 〜 18:00
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="font-bold text-slate-800">10月2日 (金)</span>
                  <span className="bg-rose-100 text-rose-700 font-black px-3 py-1 rounded-lg text-xs">
                    公休希望（休み）
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800">10月3日 (土)</span>
                  <span className="bg-blue-600 text-white font-bold px-3 py-1 rounded-lg text-xs">
                    10:00 〜 19:00
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="w-full mt-2 bg-indigo-600 text-white font-black py-2.5 rounded-xl shadow-md border-2 border-amber-400 flex items-center justify-center gap-1 cursor-default"
              >
                月間シフト希望を一括提出する 👆
              </button>
            </div>
          )
        },
        {
          number: 3,
          label: '③ 確定シフトの反映',
          badge: '確定公開',
          title: '店長・管理者が確定公開するとマイカレンダーに反映',
          desc: '提出した希望をもとに管理者がシフトを調整・一括確定すると、マイページへ本番シフトとして色鮮やかに表示されます。',
          render: () => (
            <div className="max-w-md mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900 font-bold">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>📅 10月度のシフトが確定・公開されました！</span>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="text-[11px] font-bold text-slate-500">確定したマイシフト一覧:</div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">10/01 (木)</span>
                  <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[11px]">
                    確定: 09:00 〜 18:00（ホール）
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">10/02 (金)</span>
                  <span className="bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded text-[11px]">
                    公休（休み）
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
