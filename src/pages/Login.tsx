import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, UserPlus, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset_password';

const Login = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isEmployeeSignup, setIsEmployeeSignup] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const navigate = useNavigate();

  // メールアドレス保存の復元
  useEffect(() => {
    const savedEmail = localStorage.getItem('mf_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // パスワードリセット用リカバリーURL検知
    if (window.location.hash.includes('type=recovery')) {
      setMode('reset_password');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset_password');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ログイン・新規登録処理
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const signUpOptions: any = {
          data: {
            name: name.trim() || email.split('@')[0],
          }
        };
        if (isEmployeeSignup && inviteCode.trim() !== '') {
          signUpOptions.data.invite_code = inviteCode.trim();
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: signUpOptions,
        });
        if (signUpError) throw signUpError;
        alert('【重要】登録したアドレスに確認メールを送信しました。\nメール内のリンクをクリックして本登録を完了させてください。\n（※確認が完了するまではログインできません）');
        setMode('login');
      } else if (mode === 'login') {
        // ログイン状態の保存
        if (rememberMe) {
          localStorage.setItem('mf_remember_email', email.trim());
        } else {
          localStorage.removeItem('mf_remember_email');
        }

        // ログイン
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;

        // ログイン成功後、ユーザーのRoleを取得して遷移
        if (authData.user) {
          const { error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', authData.user.id)
            .single();

          if (userError) throw userError;

          // 管理者も一般ユーザーも、まずは総合ポータルへ遷移する
          navigate('/portal');
        }
      }
    } catch (err: any) {
      setError(err.message || '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 📧 パスワード再設定（リセット用メール送信）処理
  const handleResetPasswordEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    setResetSuccess(false);

    try {
      const redirectUrl = window.location.origin;
      console.log('Attempting password reset with redirectTo:', redirectUrl);

      // 1. まず redirectTo を指定して試行
      let res = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl
      });

      // 2. もし redirectTo が原因でエラーになった場合はオプションなしで再試行
      if (res.error) {
        console.warn('First attempt with redirectTo failed, retrying without redirectTo:', res.error);
        res = await supabase.auth.resetPasswordForEmail(email.trim());
      }

      if (res.error) {
        throw res.error;
      }

      setResetSuccess(true);
    } catch (err: any) {
      console.error('Password reset error detail:', err);
      const rawMsg = err.message || '';
      let userMsg = 'パスワード再設定メールの送信に失敗しました。';

      if (rawMsg.includes('Error sending recovery email') || rawMsg.includes('rate limit') || rawMsg.includes('security purposes')) {
        userMsg = '現在メール送信サーバーが混み合っているか、一時的にご利用いただけません。恐れ入りますが少し時間を置いてから再度お試しいただくか、社内管理者までお問い合わせください。';
      } else if (rawMsg.includes('User not found')) {
        userMsg = 'ご入力いただいたメールアドレスのアカウントが見つかりませんでした。アドレスをお確かめください。';
      } else {
        userMsg = 'メールの送信に失敗しました。恐れ入りますが少し時間を置いて再度お試しください。';
      }

      setError(userMsg);
    } finally {
      setLoading(false);
    }
  };

  // 🔑 新しいパスワードの更新処理（リカバリーリンクからアクセス時）
  const handleUpdateNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    if (newPassword.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (updateError) throw updateError;
      alert('パスワードの再設定が完了しました。ポータル画面へログインします。');
      navigate('/portal');
    } catch (err: any) {
      setError(err.message || 'パスワードの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          {mode === 'signup' && <UserPlus size={48} className="text-green-600" />}
          {mode === 'login' && <LogIn size={48} />}
          {mode === 'forgot' && <KeyRound size={48} className="text-indigo-600" />}
          {mode === 'reset_password' && <Lock size={48} className="text-indigo-600" />}
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {mode === 'signup' && '新規アカウント作成'}
          {mode === 'login' && 'システムにログイン'}
          {mode === 'forgot' && 'パスワードの再設定'}
          {mode === 'reset_password' && '新しいパスワードの設定'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {mode === 'signup' && '新しくアカウントを登録します'}
          {mode === 'login' && '勤怠・有給管理システム'}
          {mode === 'forgot' && 'ご登録済みのメールアドレスに再設定用リンクをお送りします'}
          {mode === 'reset_password' && '新しいパスワードを入力してください'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              🔑 パスワード忘れ（メール送信）画面
             ───────────────────────────────────────────────────────────── */}
          {mode === 'forgot' && (
            <div className="space-y-6">
              {resetSuccess ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-emerald-900 text-sm space-y-2">
                    <div className="flex items-center gap-2 font-bold text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>再設定メールを送信しました</span>
                    </div>
                    <p className="text-xs text-emerald-950 leading-relaxed">
                      <strong>{email}</strong> 宛てにパスワード再設定リンクを送信いたしました。<br />
                      メール内のリンクをクリックし、新しいパスワードを設定してください。
                    </p>
                    <p className="text-[11px] text-gray-500 pt-1">
                      ※ メールが届かない場合は、迷惑メールフォルダをご確認いただくか、メールアドレスが正しいかご確認ください。
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setResetSuccess(false);
                      setError(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 rounded-lg shadow-xs text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    ログイン画面に戻る
                  </button>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleResetPasswordEmail}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700" htmlFor="reset-email">
                      ご登録メールアドレス
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="reset-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                        placeholder="you@example.com"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      アカウント登録時に使用したメールアドレスを入力してください。
                    </p>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition cursor-pointer"
                    >
                      {loading ? '送信中...' : 'パスワード再設定メールを送信'}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      ログイン画面へ戻る
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              🔒 新しいパスワードの設定画面（リカバリーリンクからアクセス時）
             ───────────────────────────────────────────────────────────── */}
          {mode === 'reset_password' && (
            <form className="space-y-6" onSubmit={handleUpdateNewPassword}>
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="new-password">
                  新しいパスワード（6文字以上）
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="新しいパスワード"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="confirm-password">
                  新しいパスワード（確認用）
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="もう一度入力してください"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition cursor-pointer"
                >
                  {loading ? '更新中...' : 'パスワードを更新してログイン'}
                </button>
              </div>
            </form>
          )}

          {/* ─────────────────────────────────────────────────────────────
              👤 通常ログイン ＆ 新規アカウント作成 画面
             ───────────────────────────────────────────────────────────── */}
          {(mode === 'login' || mode === 'signup') && (
            <form className="space-y-6" onSubmit={handleAuth}>
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="name">
                    お名前（フルネーム）
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserPlus className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="name"
                      type="text"
                      required={mode === 'signup'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                      placeholder="山田 太郎"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="email">
                  メールアドレス
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                  パスワード
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <div className="flex items-center mb-3">
                    <input
                      id="is-employee"
                      type="checkbox"
                      checked={isEmployeeSignup}
                      onChange={(e) => setIsEmployeeSignup(e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="is-employee" className="ml-2 block text-sm font-medium text-gray-900 cursor-pointer">
                      招待された企業に「従業員」として登録する
                    </label>
                  </div>
                  
                  {isEmployeeSignup ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700" htmlFor="inviteCode">
                        招待コード（管理者から共有されたコード）
                      </label>
                      <div className="mt-1">
                        <input
                          id="inviteCode"
                          type="text"
                          required={isEmployeeSignup}
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          className="focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border bg-white"
                          placeholder="例: 123e4567-e89b-12d3-a456-426614174000"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      ※ ご自身の企業を新しく登録する（管理者になる）場合は、チェックを入れないでください。
                    </p>
                  )}
                </div>
              )}

              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                      ログイン状態を保存
                    </label>
                  </div>

                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                      }}
                      className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer"
                    >
                      パスワードを忘れた場合
                    </button>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer ${
                    mode === 'signup' 
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                  }`}
                >
                  {loading ? '処理中...' : (mode === 'signup' ? '新規アカウントを作成する' : 'ログイン')}
                </button>
              </div>
              
              <div className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signup' ? 'login' : 'signup');
                    setError(null);
                  }}
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  {mode === 'signup' ? 'すでにアカウントをお持ちの方はこちら（ログイン）' : '初めての方はこちら（新規登録）'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;

