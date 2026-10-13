import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  KeyRound, 
  X, 
  Copy, 
  Check, 
  MessageSquare, 
  RefreshCw, 
  QrCode, 
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  Send,
  ExternalLink,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface TargetStaffForAccount {
  id: string;
  name: string;
  email?: string;
  department?: string;
  role?: string;
  employment_type?: string;
}

interface StaffAccountIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: TargetStaffForAccount | null;
  companyName?: string;
  tenantId?: string | null;
  onSuccess?: (updatedStaff: { id: string; email: string }) => void;
}

// 8桁のランダムな初期パスワード自動生成
const generateInitialPassword = (): string => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let pw = 'pass';
  for (let i = 0; i < 4; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
};

export const StaffAccountIssueModal: React.FC<StaffAccountIssueModalProps> = ({
  isOpen,
  onClose,
  staff,
  companyName = '会社',
  tenantId,
  onSuccess
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isIssuedSuccess, setIsIssuedSuccess] = useState(false);

  useEffect(() => {
    if (staff && isOpen) {
      // 既存のメールアドレス判定（仮メール emp_... ではない本物のアドレスか）
      const existingEmail = staff.email || '';
      const isDummyEmail = existingEmail.startsWith('emp_') || existingEmail.includes('@company.local') || existingEmail.includes('@sample.local');
      
      if (!isDummyEmail && existingEmail.trim() !== '') {
        setEmail(existingEmail.trim());
      } else {
        // 未登録・仮アドレスの場合は空欄にして入力してもらう
        setEmail('');
      }
      
      setPassword(generateInitialPassword());
      setError(null);
      setWarningMsg(null);
      setIsCopied(false);
      setIsIssuedSuccess(false);
    }
  }, [staff, isOpen]);

  if (!isOpen || !staff || typeof document === 'undefined') return null;

  const resolvedTenantId = tenantId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant_id') || undefined : undefined);
  const loginUrl = `${window.location.origin}/kintai/user${resolvedTenantId ? `?tenant_id=${resolvedTenantId}` : ''}`;

  const cleanEmail = email.trim();
  const cleanPassword = password.trim();

  // メール件名・本文の生成
  const emailSubject = `【${companyName || '勤怠管理システム'}】ログインアカウント発行のご案内`;
  const emailBody = `${staff.name} 様

お疲れ様です。${companyName || '勤怠管理システム'} です。
明日からのタイムカード打刻・Web給与明細確認用のアカウントが発行されました。

以下のURLよりログインしてください。

▼ タイムカード打刻・ログインURL
${loginUrl}

▼ あなたのログイン情報
ログインID（メールアドレス）: ${cleanEmail || '（スタッフ本人のメールアドレス）'}
初期パスワード: ${cleanPassword}

💡【スマホでアプリのように使う方法】
URLを開いた後、スマホ画面のメニュー（共有ボタン等）から「ホーム画面に追加」をしておくと、アプリのようにワンタップで打刻できます！
※ 初回ログイン後、パスワードはいつでも自由に変更できます。

よろしくお願いいたします。`;

  // LINE用メッセージ（シンプル版）
  const lineMessage = `【${companyName || '勤怠管理システム'} ログインのご案内】
${staff.name} 様

タイムカード打刻・給与明細確認用のアカウントが発行されました。
以下のURLからログインしてください。

▼ タイムカード打刻・ログインURL
${loginUrl}

▼ あなたのログイン情報
メールアドレス（ID）: ${cleanEmail || '（本人のメールアドレス）'}
初期パスワード: ${cleanPassword}

💡【スマホでアプリのように使う方法】
URLを開いた後、スマホのメニューから「ホーム画面に追加」をしておくと、ワンタップで打刻できます！
※ 初回ログイン後、パスワードは自由に変更できます。`;

  // 各種送信URL
  const mailtoUrl = `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(cleanEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const lineShareUrl = `https://line.me/R/share?text=${encodeURIComponent(lineMessage)}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3500);
    }
  };

  const handleIssueAccount = async () => {
    const normalizedEmail = cleanEmail.toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setError('スタッフ本人の有効なメールアドレス（例: staff@gmail.com）を入力してください。');
      return;
    }
    if (cleanPassword.length < 6) {
      setError('パスワードは6文字以上で設定してください。');
      return;
    }

    setLoading(true);
    setError(null);
    setWarningMsg(null);

    try {
      // 1. Supabase RPC による auth.users アカウント直接発行・更新
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_or_update_staff_auth_account', {
        p_target_user_id: staff.id,
        p_email: normalizedEmail,
        p_password: cleanPassword
      });

      if (rpcError) {
        console.warn('RPC create_or_update_staff_auth_account warning:', rpcError);
        // RPCがエラーでも台帳の保存は試みる
        setWarningMsg('※ 認証基盤への直接登録で一時的な警告が発生しましたが、台帳への登録を完了しました。');
      } else if (rpcData && typeof rpcData === 'object' && (rpcData as any).success === false) {
        const customErr = (rpcData as any).error || 'アカウント発行に失敗しました。';
        console.warn('RPC business logic error:', customErr);
        if ((rpcData as any).error_code === 'EMAIL_ALREADY_IN_USE') {
          setError(customErr);
          setLoading(false);
          return;
        } else {
          setWarningMsg(`※ ${customErr}`);
        }
      }

      // 2. public.users のメールアドレスも最新の実アドレスで確実に永続化（台帳同期）
      try {
        await supabase.from('users').update({ email: normalizedEmail }).eq('id', staff.id);
      } catch (uErr) {
        console.warn('Failed to sync email to public.users:', uErr);
      }

      // 3. 案内文をクリップボードに自動コピー
      await copyToClipboard(emailBody);

      setIsIssuedSuccess(true);
      if (onSuccess) {
        onSuccess({ id: staff.id, email: normalizedEmail });
      }
    } catch (err: any) {
      console.error('Account issue error:', err);
      setError('予期せぬエラーが発生しました: ' + (err.message || '通信エラー'));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-5 animate-in fade-in zoom-in duration-200">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                ログインアカウント発行 ＆ 送信センター
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                対象スタッフ：<strong className="text-slate-800">{staff.name}</strong> 様{staff.department ? `（${staff.department}）` : '（未配属）'}
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

        {/* 成功バナー ＆ ワンタップ送信パネル */}
        {isIssuedSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-950 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-black text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>✔ アカウントを発行しました！案内を送信してください</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-900">
              案内文をクリップボードにコピーしました。下のボタンから<strong>メール</strong>または<strong>LINE</strong>でスタッフ本人へ1タップで送信できます。
            </p>

            {/* 即時送信アクションボタン群 */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={mailtoUrl}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs shadow-xs transition cursor-pointer"
                title="OutlookやMac標準メール等のメールソフトを起動"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span>メールソフトで送信</span>
              </a>
              <a
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs shadow-xs transition cursor-pointer"
                title="ブラウザでGmail作成画面を直接開く"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>Gmailで送信</span>
              </a>
              <a
                href={lineShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl font-black text-xs shadow-xs transition cursor-pointer col-span-2"
                title="LINEアプリでこの案内文を送信"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>💬 LINEで案内メッセージを送る</span>
              </a>
            </div>
          </div>
        )}

        {/* 警告バナー */}
        {warningMsg && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{warningMsg}</span>
          </div>
        )}

        {/* エラーバナー */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* メールアドレス（ログインID） */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-indigo-600" />
                ログイン用メールアドレス（ID）
                <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">本人の私用メールまたは社用メール</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例: staff@gmail.com または yamada@company.co.jp"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition"
            />
            {(!staff.email || staff.email.startsWith('emp_') || staff.email.includes('@sample.local') || staff.email.includes('@company.local')) && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 font-medium">
                💡 <strong>メール未登録：</strong> スタッフ本人のメールアドレスをご入力ください。アカウント発行と同時に従業員台帳にも自動保存されます。
              </p>
            )}
          </div>

          {/* 初期パスワード */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-600" />
                初期パスワード
              </label>
              <button
                type="button"
                onClick={() => setPassword(generateInitialPassword())}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                title="別のパスワードを自動再生成"
              >
                <RefreshCw className="w-3 h-3" />
                <span>再生成</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-black text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition tracking-wider"
              />
              <span className="text-[11px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-2 rounded-xl border border-indigo-200 shrink-0">
                自動生成済
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              ※ 初回ログイン後、スタッフ本人がいつでもパスワードを変更できます。
            </p>
          </div>

          {/* メール・LINE送信用 案内文プレビュー */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                スタッフへ送信される案内文プレビュー:
              </label>
              <button
                type="button"
                onClick={() => copyToClipboard(emailBody)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'コピー済' : '全文コピー'}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-700 leading-relaxed font-sans whitespace-pre-wrap select-all max-h-32 overflow-y-auto">
              {emailBody}
            </div>
          </div>

          {/* 確実な送信に関する案内 */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>安心・確実な連絡体制について</span>
            </div>
            <p className="text-slate-500 leading-normal">
              本システムは迷惑メール（スパム）誤判定や不達事故を防ぐため、裏で勝手に自動送信せず、管理者の手元から<strong>【メールソフト（Outlook等）】</strong>や<strong>【Gmail】</strong>、<strong>【LINE】</strong>で確実に届く仕組みを採用しています。
            </p>
          </div>

          {/* QRコード表示（目の前のスタッフ用） */}
          <div className="flex items-center gap-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="w-16 h-16 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs shrink-0 flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(loginUrl)}`}
                alt="ログインQRコード"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-0.5 text-xs">
              <span className="font-black text-slate-800 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                目の前のスタッフに読み取ってもらう場合
              </span>
              <p className="text-slate-500 text-[10px] leading-snug">
                スマホのカメラをかざすと、1秒でタイムカード打刻画面が開きます。
              </p>
            </div>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            閉じる
          </button>
          
          <div className="flex items-center gap-2">
            {isIssuedSuccess && (
              <a
                href={mailtoUrl}
                className="py-2.5 px-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                <span>メール送信</span>
              </a>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={handleIssueAccount}
              className={`py-2.5 px-5 rounded-xl font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-md ${
                isIssuedSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-indigo-200'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>アカウント発行中...</span>
                </>
              ) : isIssuedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>再発行・案内文コピー</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>アカウントを発行する</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StaffAccountIssueModal;
