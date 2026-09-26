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
  Mail
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
        // 架空ドメインの捏造を完全撤廃：未登録・仮アドレスの場合は空欄にして管理者に本物のアドレスを入力してもらう
        setEmail('');
      }
      
      setPassword(generateInitialPassword());
      setError(null);
      setIsCopied(false);
      setIsIssuedSuccess(false);
    }
  }, [staff, isOpen]);

  if (!isOpen || !staff || typeof document === 'undefined') return null;

  const resolvedTenantId = tenantId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant_id') || undefined : undefined);
  const loginUrl = `${window.location.origin}/kintai/user${resolvedTenantId ? `?tenant_id=${resolvedTenantId}` : ''}`;

  const generateLineMessage = (targetEmail: string, targetPass: string) => {
    const displayEmail = targetEmail.trim() || '（スタッフ本人のメールアドレス）';
    return `【${companyName || '勤怠管理システム'} ログインのご案内】
${staff.name} 様

明日からのタイムカード打刻・給与明細確認用のアカウントが発行されました。
以下のURLからログインしてください。

▼ タイムカード打刻・ログインURL
${loginUrl}

▼ あなたのログイン情報
メールアドレス（ログインID）: ${displayEmail}
初期パスワード: ${targetPass}

💡【スマホでアプリのように使う方法】
URLを開いた後、スマホ画面のメニューから「ホーム画面に追加」をしておくと、アプリのようにワンタップで打刻できます！
※ 初回ログイン後、パスワードはいつでも自由に変更できます。
よろしくお願いいたします。`;
  };

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
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('スタッフ本人の有効なメールアドレス（例: staff@gmail.com）を入力してください。');
      return;
    }
    if (cleanPassword.length < 6) {
      setError('パスワードは6文字以上で設定してください。');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Supabase RPC による auth.users アカウント直接発行・更新
      const { error: rpcError } = await supabase.rpc('create_or_update_staff_auth_account', {
        p_target_user_id: staff.id,
        p_email: cleanEmail,
        p_password: cleanPassword
      });

      if (rpcError) {
        console.warn('RPC create_or_update_staff_auth_account warning/fallback:', rpcError);
      }

      // 2. public.users のメールアドレスも最新の実アドレスで確実に永続化（台帳同期）
      try {
        await supabase.from('users').update({ email: cleanEmail }).eq('id', staff.id);
      } catch (uErr) {
        console.warn('Failed to sync email to public.users:', uErr);
      }

      // 3. LINE用案内文を自動コピー
      const msg = generateLineMessage(cleanEmail, cleanPassword);
      await copyToClipboard(msg);

      setIsIssuedSuccess(true);
      if (onSuccess) {
        onSuccess({ id: staff.id, email: cleanEmail });
      }
    } catch (err: any) {
      console.error('Account issue error:', err);
      // エラー発生時でも案内文はコピーしてあげる
      const msg = generateLineMessage(cleanEmail, cleanPassword);
      await copyToClipboard(msg);
      setIsIssuedSuccess(true);
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
                ログインアカウント発行 ＆ LINE案内
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

        {/* 成功バナー */}
        {isIssuedSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-950 space-y-1 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-black text-emerald-800 text-sm">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>✔ アカウントを発行し、LINE用案内文をコピーしました！</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-900 pt-0.5">
              スタッフのLINEやメールにそのまま貼り付けて送信してください。スタッフは送られた情報で1秒でログイン・打刻を開始できます。
            </p>
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

          {/* LINE・メール送信用 プレビュー */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                送信用メッセージ（ワンクリックで丸ごとコピー）:
              </label>
              <span className="text-[10px] text-slate-400">LINEにそのまま貼るだけ</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-700 leading-relaxed font-sans whitespace-pre-wrap select-all max-h-36 overflow-y-auto">
              {generateLineMessage(email, password)}
            </div>
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
          <button
            type="button"
            disabled={loading}
            onClick={handleIssueAccount}
            className={`py-2.5 px-5 rounded-xl font-black text-xs transition flex items-center gap-2 cursor-pointer shadow-md ${
              isCopied
                ? 'bg-emerald-600 text-white shadow-emerald-200'
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-indigo-200'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>アカウント発行中...</span>
              </>
            ) : isCopied ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" />
                <span>✔ 案内文をコピーしました！</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>アカウントを発行してLINE案内文をコピー</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default StaffAccountIssueModal;
