import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, CheckCircle2, ArrowRight, Eye, EyeOff, KeyRound, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthToken = async () => {
      try {
        // 1. URLのクエリパラメータから PKCE 用の認証コードを取得
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');

        if (code) {
          console.log('Exchanging PKCE code for session...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            setError('認証リンクの有効期限が切れているか、既に使用されています。恐れ入りますが再度パスワード再設定メールを発行してください。');
          }
        } else if (window.location.hash.includes('error=')) {
          // ハッシュにエラーが含まれている場合
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const errorDescription = hashParams.get('error_description') || '無効なリンクです';
          setError(decodeURIComponent(errorDescription));
        } else {
          // 既存のセッションを確認
          const { data: { session } } = await supabase.auth.getSession();
          if (!session && !window.location.hash.includes('access_token')) {
            console.warn('No active recovery session found');
          }
        }
      } catch (err: any) {
        console.error('Failed to parse auth URL:', err);
        setError('リンクの解析中にエラーが発生しました。');
      } finally {
        setInitializing(false);
      }
    };

    handleAuthToken();

    // PASSWORD_RECOVERY イベントのリッスン
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event triggered');
        setError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('パスワードは6文字以上で設定してください');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('入力されたパスワードが一致しません');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      setIsSuccess(true);
    } catch (err: any) {
      console.error('Password update error:', err);
      const raw = err.message || '';
      if (raw.includes('same_password')) {
        setError('新しいパスワードは過去に使用したパスワードと異なるものを設定してください');
      } else if (raw.includes('Auth session missing') || raw.includes('JWT')) {
        setError('セッションの有効期限が切れています。お手数ですが再度ログイン画面からパスワード再設定を申請してください。');
      } else {
        setError(err.message || 'パスワードの更新に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/40 to-indigo-50/50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/20 flex items-center justify-center text-white">
            <KeyRound className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
          新しいパスワードの設定
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 font-medium">
          勤怠・有給管理システム 安全なパスワードをご登録ください
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-md py-8 px-6 shadow-2xl shadow-slate-200/60 rounded-2xl border border-slate-100 sm:px-10">
          {error && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-4 mb-6 rounded-r-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-800 font-medium leading-relaxed">
                {error}
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-800">
                  パスワードを再設定しました
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  新しいパスワードの更新が正常に完了いたしました。<br />
                  そのままシステムをご利用いただけます。
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate('/portal')}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/25 text-sm font-bold hover:opacity-95 transition cursor-pointer"
                >
                  ポータル画面へ進む
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  ログイン画面へ戻る
                </button>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleUpdatePassword}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5" htmlFor="new-password">
                  新しいパスワード <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6文字以上の英数字記号"
                    className="w-full pl-11 pr-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5" htmlFor="confirm-password">
                  新しいパスワード（確認用） <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="もう一度入力してください"
                    className="w-full pl-11 pr-11 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || initializing}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition cursor-pointer"
                >
                  {loading ? '更新中...' : 'パスワードを変更してログイン'}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  to="/"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition inline-block"
                >
                  ← ログイン画面へ戻る
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
