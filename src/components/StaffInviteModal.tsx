import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Send, 
  X, 
  Clock, 
  Users, 
  Smartphone, 
  Copy, 
  Check, 
  MessageSquare, 
  QrCode, 
  ExternalLink, 
  CheckCircle2 
} from 'lucide-react';

interface StaffInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName?: string;
  tenantId?: string | null;
  defaultTab?: 'kintai' | 'onboarding';
  showCompleteButton?: boolean;
  onCompleteStep?: () => void;
  onNavigateToCustomInvite?: () => void;
}

export const StaffInviteModal: React.FC<StaffInviteModalProps> = ({
  isOpen,
  onClose,
  companyName = '会社',
  tenantId,
  defaultTab = 'kintai',
  showCompleteButton = false,
  onCompleteStep,
  onNavigateToCustomInvite
}) => {
  const [inviteTab, setInviteTab] = useState<'kintai' | 'onboarding'>(defaultTab);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 3000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 3000);
    }
  };

  const resolvedTenantId = tenantId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant_id') || undefined : undefined);
  const kintaiUrl = `${window.location.origin}/kintai/user${resolvedTenantId ? `?tenant_id=${resolvedTenantId}` : ''}`;
  const onboardingUrl = `${window.location.origin}/onboarding/welcome${resolvedTenantId ? `?tenant_id=${resolvedTenantId}` : ''}`;

  const kintaiMsg = `【勤怠打刻システムのご案内】
${companyName} のスタッフの皆様へ

明日からのタイムカード打刻は、以下のURLから行えます。
スマホのブラウザで開いてログインしてください。

▼ タイムカード打刻・マイページURL
${kintaiUrl}

💡【スマホでアプリのように使う方法】
URLを開いた後、スマホ画面のメニューから「ホーム画面に追加」をしておくと、アプリのようにワンタップで打刻できます！
自分の給与明細や有給休暇の残日数もここから確認できます。
よろしくお願いいたします。`;

  const onboardingMsg = `【入社手続きのご案内】
${companyName} へようこそ！

入社に伴う書類提出・基本情報登録は、以下の専用URLからスマホで行えます。
（給与振込口座の通帳写真やマイナンバーをスマホカメラで撮影してそのまま送信できます）

▼ 新入社員 入社手続き専用URL
${onboardingUrl}

ご不明な点がございましたら担当までお気軽にお尋ねください。
よろしくお願いいたします。`;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-5 animate-in fade-in zoom-in duration-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                スタッフへ案内する（招待URL ＆ LINE送信）
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                スタッフにURLを送信して、タイムカード打刻や入社手続きを開始します。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 用途別タブ切替 */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => setInviteTab('kintai')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              inviteTab === 'kintai'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>① 明日から打刻（タイムカード案内）</span>
          </button>
          <button
            type="button"
            onClick={() => setInviteTab('onboarding')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
              inviteTab === 'onboarding'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>② 新入社員の書類提出（入社手続きURL）</span>
          </button>
        </div>

        {/* タブ①: タイムカード打刻案内 */}
        {inviteTab === 'kintai' && (
          <div className="space-y-4">
            <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  スタッフ用 タイムカード打刻URL
                </span>
                <span className="text-[10px] bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded font-bold">
                  スマホ・PC両対応
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={kintaiUrl}
                  className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono text-indigo-950 select-all font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(kintaiUrl, 'kintai-url')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  {copiedType === 'kintai-url' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedType === 'kintai-url' ? 'コピー済' : 'URLコピー'}</span>
                </button>
              </div>
            </div>

            {/* LINE・メール貼り付け用定型文 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  LINEやメールにそのまま貼り付けられる案内文:
                </label>
                <span className="text-[10px] text-slate-400">ワンクリックで全選択コピー</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap select-all">
                {kintaiMsg}
              </div>

              <button
                type="button"
                onClick={() => handleCopy(kintaiMsg, 'kintai-msg')}
                className={`w-full py-2.5 px-4 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                  copiedType === 'kintai-msg'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                }`}
              >
                {copiedType === 'kintai-msg' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>✔ LINE用案内メッセージを丸ごとコピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>📋 LINE用案内メッセージを丸ごとコピーする</span>
                  </>
                )}
              </button>
            </div>

            {/* QRコード表示（目の前のスタッフ用） */}
            <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs shrink-0 flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(kintaiUrl)}`}
                  alt="タイムカード打刻QRコード"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-black text-slate-800 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                  目の前のスタッフに読み取ってもらう場合
                </span>
                <p className="text-slate-500 text-[11px] leading-snug">
                  スタッフのスマホのカメラでこのQRコードを読み取ってもらうと、1秒で打刻画面を開けます。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* タブ②: 新入社員の書類提出案内 */}
        {inviteTab === 'onboarding' && (
          <div className="space-y-4">
            <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  新入社員用 スマホ入社書類提出URL
                </span>
                <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded font-bold">
                  通帳・マイナンバー撮影対応
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={onboardingUrl}
                  className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono text-emerald-950 select-all font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(onboardingUrl, 'onb-url')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  {copiedType === 'onb-url' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedType === 'onb-url' ? 'コピー済' : 'URLコピー'}</span>
                </button>
              </div>
            </div>

            {/* LINE貼り付け用定型文 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  LINEやメールにそのまま貼り付けられる入社案内文:
                </label>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap select-all">
                {onboardingMsg}
              </div>

              <button
                type="button"
                onClick={() => handleCopy(onboardingMsg, 'onb-msg')}
                className={`w-full py-2.5 px-4 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                  copiedType === 'onb-msg'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                }`}
              >
                {copiedType === 'onb-msg' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>✔ 入社案内メッセージを丸ごとコピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>📋 入社案内メッセージを丸ごとコピーする</span>
                  </>
                )}
              </button>
            </div>

            {/* QRコード表示（目の前の新入社員用） */}
            <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs shrink-0 flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(onboardingUrl)}`}
                  alt="入社手続きQRコード"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="space-y-1 text-xs">
                <span className="font-black text-slate-800 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  目の前の新入社員に読み取ってもらう場合
                </span>
                <p className="text-slate-500 text-[11px] leading-snug">
                  スマホのカメラでQRコードを読み取ってもらうと、すぐに口座やマイナンバーの登録画面を開けます。
                </p>
              </div>
            </div>

            {onNavigateToCustomInvite && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToCustomInvite();
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>※ 個別社員ごとの給与設定付き専用URLを発行したい場合はこちら</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* モーダルフッター */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            {showCompleteButton 
              ? 'LINE等でスタッフへ案内を送信したら、右側の「案内完了」を押してください'
              : 'スタッフに案内文を送信して登録・打刻を開始してください'}
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              閉じる
            </button>
            {showCompleteButton && onCompleteStep && (
              <button
                type="button"
                onClick={onCompleteStep}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>スタッフ案内完了（初期設定100%達成）</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StaffInviteModal;
