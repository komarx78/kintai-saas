import React, { useState, useEffect } from 'react';
import { 
  MapPin, Calendar, CheckCircle2, 
  Download, Smartphone, Monitor, PenTool, Lock, Camera
} from 'lucide-react';

interface GuideUiPreviewProps {
  previewType?: string;
  htmlPreview?: string;
  title?: string;
}

/**
 * 📱 実際のシステム画面を忠実に再現した「公式操作ガイド専用インタラクティブUIプレビュー」
 */
export const SystemGuideUiPreview: React.FC<GuideUiPreviewProps> = ({
  previewType,
  htmlPreview
}) => {
  // カスタムHTMLが登録されている場合は、そのHTMLコードを安全なプレビュー枠でレンダリング
  if (htmlPreview && htmlPreview.trim()) {
    return (
      <div className="mt-4 bg-slate-900/5 rounded-2xl p-4 border border-slate-200">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs text-slate-500 font-bold">
          <span className="flex items-center gap-1.5 text-indigo-600">
            <Monitor className="w-3.5 h-3.5" /> 実際の操作画面（埋め込みプレビュー）
          </span>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">HTMLプレビュー</span>
        </div>
        <div 
          className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: htmlPreview }} 
        />
      </div>
    );
  }

  // previewType に応じてシステム内部の各画面モックをレンダリング
  switch (previewType) {
    case 'kintai_clock':
      return <KintaiClockPreview />;
    case 'kintai_fix':
      return <KintaiFixPreview />;
    case 'leave_request':
      return <LeaveRequestPreview />;
    case 'shift_submit':
      return <ShiftSubmitPreview />;
    case 'payslip_view':
      return <PayslipViewPreview />;
    case 'onboarding_passbook':
      return <OnboardingPassbookPreview />;
    case 'password_reset':
      return <PasswordResetPreview />;
    default:
      // デフォルトまたは未指定時はカテゴリに応じた汎用画面モック
      return <KintaiClockPreview />;
  }
};

/**
 * ⏰ 1. 勤怠打刻（スマホ・PC画面）UIプレビュー
 */
function KintaiClockPreview() {
  const [time, setTime] = useState('10:35:12');

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setTime(d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="mt-4 bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 text-blue-600">
          <Smartphone className="w-3.5 h-3.5" /> 実際の操作画面: 【勤怠打刻画面】
        </span>
        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
          打刻ウィジェット
        </span>
      </div>

      <div className="max-w-sm mx-auto bg-white rounded-2xl p-5 shadow-sm border border-slate-200 text-center space-y-4 relative">
        <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
          <span>2026年9月6日 (日)</span>
          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
            <MapPin className="w-3 h-3" /> GPS位置取得済
          </span>
        </div>

        <div>
          <div className="text-[11px] text-slate-400 font-bold mb-0.5">現在時刻</div>
          <div className="text-4xl font-black text-slate-800 tracking-wider font-mono tabular-nums">
            {time}
          </div>
        </div>

        {/* 打刻ボタン */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="relative group">
            <button 
              type="button"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-black text-sm shadow-md transition flex flex-col items-center justify-center cursor-default ring-2 ring-blue-400/50"
            >
              出勤
              <span className="text-[9px] font-normal opacity-80 mt-0.5">出社時にタップ</span>
            </button>
            <div className="absolute -top-3 -right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs animate-bounce">
              ここを押す
            </div>
          </div>

          <button 
            type="button"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-black text-sm shadow-md transition flex flex-col items-center justify-center cursor-default"
          >
            退勤
            <span className="text-[9px] font-normal opacity-80 mt-0.5">業務終了時にタップ</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            type="button"
            className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 py-2.5 rounded-xl font-bold text-xs border border-slate-200 transition cursor-default"
          >
            ☕ 休憩開始
          </button>
          <button 
            type="button"
            className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 py-2.5 rounded-xl font-bold text-xs border border-slate-200 transition cursor-default"
          >
            ☕ 休憩終了
          </button>
        </div>

        <div className="pt-2 flex items-center justify-center gap-2 text-xs text-slate-600">
          <span>現在の状態:</span>
          <span className="px-2.5 py-0.5 rounded-full font-black text-[11px] bg-slate-100 text-slate-600 border border-slate-200">
            未出勤
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * ✏️ 2. 打刻修正申請 UIプレビュー
 */
function KintaiFixPreview() {
  return (
    <div className="mt-4 bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 text-indigo-600">
          <Monitor className="w-3.5 h-3.5" /> 実際の操作画面: 【日別勤怠 ＆ 打刻修正申請フォーム】
        </span>
        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
          修正申請モーダル
        </span>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        {/* 勤怠一覧の行プレビュー */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800">2026/09/05 (金)</span>
            <div className="text-slate-500 text-[11px]">
              打刻実績: <span className="font-mono text-rose-600 font-bold">打刻なし（未退勤）</span>
            </div>
          </div>
          <div className="relative">
            <button 
              type="button"
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs cursor-default ring-2 ring-indigo-400"
            >
              <PenTool className="w-3 h-3" />
              修正申請
            </button>
            <div className="absolute -top-2.5 -right-2 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full animate-bounce">
              タップ
            </div>
          </div>
        </div>

        {/* 修正申請フォームのモックアップ */}
        <div className="bg-white rounded-2xl p-4 border border-indigo-200 shadow-md space-y-3 text-xs">
          <div className="font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-indigo-600" />
            打刻修正申請の入力手順
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 font-bold mb-1">正しい出勤時刻</label>
              <input 
                type="text" 
                readOnly 
                value="09:00" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-800 text-center"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 font-bold mb-1">正しい退勤時刻</label>
              <input 
                type="text" 
                readOnly 
                value="18:00" 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-800 text-center"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 font-bold mb-1">修正理由</label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700">
              退勤時に打刻ボタンを押し忘れたため、定時18:00退勤で申請いたします。
            </div>
          </div>

          <button 
            type="button"
            className="w-full bg-indigo-600 text-white py-2 rounded-xl font-black text-xs shadow-xs cursor-default flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            この内容で管理者に申請を送信
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 🌴 3. 有給休暇申請 UIプレビュー
 */
function LeaveRequestPreview() {
  return (
    <div className="mt-4 bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 text-emerald-600">
          <Monitor className="w-3.5 h-3.5" /> 実際の操作画面: 【有給休暇・各種申請フォーム】
        </span>
        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
          有休申請カード
        </span>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        {/* 有休残数カード */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-emerald-900">有給休暇 合計残日数</span>
            <p className="text-[10px] text-emerald-700">有効期限: 2027年3月31日まで</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-700">14.5</span>
            <span className="text-xs font-bold text-emerald-900 ml-1">日</span>
          </div>
        </div>

        {/* 申請フォーム */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
          <div>
            <label className="block text-[11px] text-slate-500 font-bold mb-1">取得区分</label>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <span className="p-2 rounded-lg bg-emerald-600 text-white font-bold text-[11px]">全休</span>
              <span className="p-2 rounded-lg bg-slate-100 text-slate-600 font-medium text-[11px]">午前休</span>
              <span className="p-2 rounded-lg bg-slate-100 text-slate-600 font-medium text-[11px]">午後休</span>
              <span className="p-2 rounded-lg bg-slate-100 text-slate-600 font-medium text-[11px]">時間休</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 font-bold mb-1">取得希望日</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-800 flex items-center justify-between">
              <span>2026年09月15日 (火)</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 font-bold mb-1">申請理由</label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700">
              私用のため（通院および役所手続き）
            </div>
          </div>

          <button 
            type="button"
            className="w-full bg-emerald-600 text-white py-2.5 rounded-xl font-black text-xs shadow-xs cursor-default flex items-center justify-center gap-1.5"
          >
            有給休暇を申請する
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 📅 4. シフト希望提出 UIプレビュー
 */
function ShiftSubmitPreview() {
  return (
    <div className="mt-4 bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 text-purple-600">
          <Monitor className="w-3.5 h-3.5" /> 実際の操作画面: 【シフト希望提出カレンダー】
        </span>
        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">
          シフト希望
        </span>
      </div>

      <div className="max-w-md mx-auto bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="font-black text-slate-800">2026年10月度 シフト希望提出</span>
          <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-bold">締切: 9/20まで</span>
        </div>

        {/* カレンダー行モック */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800">10/01 (木)</span>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">早番 (09:00〜15:00)</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="font-bold text-slate-800">10/02 (金)</span>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">✕ 休み希望</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/50 border border-indigo-200">
            <span className="font-bold text-slate-800">10/03 (土)</span>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-bold text-[10px]">遅番 (15:00〜21:00)</span>
            </div>
          </div>
        </div>

        <button 
          type="button"
          className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-black text-xs shadow-xs cursor-default flex items-center justify-center gap-1.5"
        >
          今月のシフト希望を確定して提出
        </button>
      </div>
    </div>
  );
}

/**
 * 💰 5. 給与明細・PDF印刷 UIプレビュー
 */
function PayslipViewPreview() {
  return (
    <div className="mt-4 bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 text-indigo-600">
          <Monitor className="w-3.5 h-3.5" /> 実際の操作画面: 【Web給与明細 ＆ PDF印刷】
        </span>
        <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
          給与明細書
        </span>
      </div>

      <div className="max-w-md mx-auto bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <span className="text-[10px] text-slate-400">2026年8月度</span>
            <h5 className="font-black text-slate-900 text-sm">給与明細書</h5>
          </div>
          <div className="relative">
            <button 
              type="button"
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-default ring-2 ring-indigo-400"
            >
              <Download className="w-3 h-3" />
              PDF印刷
            </button>
            <div className="absolute -top-2.5 -right-2 bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full animate-bounce">
              ここから印刷
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-500">総支給額</span>
            <div className="text-sm font-black text-slate-900 font-mono">¥312,500</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-500">控除合計額</span>
            <div className="text-sm font-black text-slate-700 font-mono">¥52,380</div>
          </div>
        </div>

        <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 flex items-center justify-between">
          <span className="font-bold text-indigo-900">差引支給額（手取り振込額）</span>
          <span className="text-base font-black text-indigo-600 font-mono">¥260,120</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 📄 6. 入社手続き・通帳写真提出 UIプレビュー
 */
function OnboardingPassbookPreview() {
  return (
    <div className="mt-4 bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 text-teal-600">
          <Monitor className="w-3.5 h-3.5" /> 実際の操作画面: 【入社労務手続き 通帳写真・契約押印】
        </span>
        <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">
          通帳提出 ＆ 電子署名
        </span>
      </div>

      <div className="max-w-md mx-auto bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
        <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center space-y-2 bg-slate-50">
          <Camera className="w-6 h-6 text-slate-400 mx-auto" />
          <div className="font-bold text-slate-700 text-xs">通帳の見開き面を撮影してアップロード</div>
          <p className="text-[10px] text-slate-400">口座番号・店番号・口座名義（カナ）が鮮明に写るように撮影します</p>
          <button 
            type="button"
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold text-[11px] shadow-xs cursor-default"
          >
            写真を選択またはカメラ起動
          </button>
        </div>

        <div className="p-3 bg-teal-50/70 rounded-xl border border-teal-100 flex items-center justify-between">
          <span className="font-bold text-teal-950">労働条件通知書（雇用契約書）の電子合意</span>
          <button 
            type="button"
            className="px-3 py-1 bg-teal-600 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-default"
          >
            電子押印・合意する
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ⚙️ 7. パスワード再設定 UIプレビュー
 */
function PasswordResetPreview() {
  return (
    <div className="mt-4 bg-gradient-to-b from-slate-100 to-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
        <span className="flex items-center gap-1.5 text-slate-700">
          <Monitor className="w-3.5 h-3.5" /> 実際の操作画面: 【ログイン ＆ パスワード再設定画面】
        </span>
        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
          ログイン画面
        </span>
      </div>

      <div className="max-w-sm mx-auto bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
        <div>
          <label className="block text-[11px] text-slate-500 font-bold mb-1">メールアドレス</label>
          <input 
            type="email" 
            readOnly 
            value="employee@example.com" 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700"
          />
        </div>

        <div className="flex items-center justify-end">
          <span className="text-indigo-600 font-bold text-[11px] underline cursor-default flex items-center gap-1">
            <Lock className="w-3 h-3" /> パスワードをお忘れの方はこちら
          </span>
        </div>

        <button 
          type="button"
          className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-black text-xs shadow-xs cursor-default"
        >
          パスワード再設定メールを送信
        </button>
      </div>
    </div>
  );
}
