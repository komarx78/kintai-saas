import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, UserPlus, ArrowLeft, CheckCircle2, KeyRound, RefreshCw, Send, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup' | 'forgot' | 'resend_confirm';

const Login = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isEmployeeSignup, setIsEmployeeSignup] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // 📧 新規登録・確認メール再送用ステート
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);
  const [isEmailNotConfirmed, setIsEmailNotConfirmed] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const navigate = useNavigate();

  // メールアドレス保存の復元
  useEffect(() => {
    const savedEmail = localStorage.getItem('mf_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // パスワードリセット用リカバリーURL検知（過去リンクやcodeパラメータも確実に新設画面へ自動転送）
    if (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery') || window.location.search.includes('code=')) {
      navigate('/reset-password' + window.location.search + window.location.hash, { replace: true });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ⏳ 再送ボタンのクールダウンタイマー（60秒）
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // ログイン・新規登録処理
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setIsEmailNotConfirmed(false);

    try {
      if (mode === 'signup') {
        const redirectUrl = `${window.location.origin}/portal`;
        const signUpOptions: any = {
          data: {
            name: name.trim() || email.split('@')[0],
          },
          emailRedirectTo: redirectUrl,
        };
        if (isEmployeeSignup && inviteCode.trim() !== '') {
          signUpOptions.data.invite_code = inviteCode.trim();
        }

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: signUpOptions,
        });
        if (signUpError) throw signUpError;

        // 🌟 もしセッションが即座に発行された場合（メール確認不要設定、または自動認証）
        if (signUpData.session) {
          navigate('/portal');
          return;
        }

        // 📧 メール確認が必要な場合：alertで追い出すのを廃止し、専用の確認＆再送画面を表示！
        setSignupSuccessEmail(email.trim());
        setSignupSuccess(true);
        setResendCooldown(60);
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
      const raw = err.message || '';
      if (raw.includes('Email not confirmed') || raw.includes('email_not_confirmed')) {
        setIsEmailNotConfirmed(true);
        setUnconfirmedEmail(email.trim());
        setError('メールアドレスの確認（本登録）が完了していません。届いた確認メールのリンクをクリックするか、下記のボタンから確認メールを再送してください。');
      } else if (raw.includes('User already registered')) {
        setError('このメールアドレスは既に登録されています。パスワードを入力してログインしてください。確認メールが届いていない場合は下の「確認メールの再送」をお試しください。');
      } else if (raw.includes('Invalid login credentials')) {
        setError('メールアドレスまたはパスワードが正しくありません。');
      } else {
        setError(err.message || '認証に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  // 📬 確認メール（本登録リンク）の再送処理
  const handleResendConfirmation = async (targetEmailAddress?: string) => {
    const target = (targetEmailAddress || email || signupSuccessEmail || unconfirmedEmail).trim();
    if (!target) {
      setError('メールアドレスを入力してください');
      return;
    }
    setLoading(true);
    setError(null);
    setResendSuccessMessage(null);

    try {
      const redirectUrl = `${window.location.origin}/portal`;
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: target,
        options: {
          emailRedirectTo: redirectUrl,
        }
      });
      if (resendErr) throw resendErr;

      setResendSuccessMessage(`「${target}」宛てに確認メールを再送いたしました。受信箱および迷惑メールフォルダをご確認ください。`);
      setResendCooldown(60);
    } catch (err: any) {
      console.error('Resend confirmation error:', err);
      const raw = err.message || '';
      if (raw.includes('rate limit') || raw.includes('security purposes')) {
        setError('セキュリティ保護のため、短時間の連続送信が制限されています。1分ほど時間をおいてから再度お試しください。');
      } else {
        setError(err.message || '確認メールの再送に失敗いたしました。アドレスをご確認ください。');
      }
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
      const redirectUrl = `${window.location.origin}/reset-password`;
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

      if (rawMsg.includes('Error sending recovery email')) {
        userMsg = 'メール送信処理に失敗いたしました。恐れ入りますが、しばらく時間をおいて再度お試しいただくか、システム管理者までお問い合わせください。';
      } else if (rawMsg.includes('rate limit') || rawMsg.includes('security purposes')) {
        userMsg = 'セキュリティ保護のため、短時間の連続送信が制限されております。しばらく時間をおいてから再度お試しください。';
      } else if (rawMsg.includes('User not found')) {
        userMsg = 'ご入力いただいたメールアドレスのアカウントが見つかりませんでした。アドレスをお確かめください。';
      } else {
        userMsg = 'パスワード再設定メールの送信に失敗いたしました。恐れ入りますが、しばらく時間をおいて再度お試しください。';
      }

      setError(userMsg);
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
          {mode === 'resend_confirm' && <RefreshCw size={48} className="text-amber-600" />}
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {mode === 'signup' && (signupSuccess ? '本登録の確認メール送信' : '新規アカウント作成')}
          {mode === 'login' && 'システムにログイン'}
          {mode === 'forgot' && 'パスワードの再設定'}
          {mode === 'resend_confirm' && '確認メールの再送'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {mode === 'signup' && (signupSuccess ? 'メール内のリンクをクリックして本登録を完了してください' : '新しくアカウントを登録します')}
          {mode === 'login' && '勤怠・有給管理システム'}
          {mode === 'forgot' && 'ご登録済みのメールアドレスに再設定用リンクをお送りします'}
          {mode === 'resend_confirm' && 'アカウント登録時のメールアドレスに確認メールを再送します'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          {/* 🚨 エラーメッセージ表示枠 */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-relaxed">{error}</p>
              </div>

              {/* 💡 メール未確認エラー時の救済：即座にワンタップで再送できるボタン */}
              {isEmailNotConfirmed && (
                <div className="pt-2 border-t border-red-200">
                  <button
                    type="button"
                    disabled={loading || resendCooldown > 0}
                    onClick={() => handleResendConfirmation(unconfirmedEmail)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {resendCooldown > 0 ? `再送可能まで あと ${resendCooldown} 秒` : `このアドレス（${unconfirmedEmail}）に確認メールを今すぐ再送`}
                  </button>
                  <p className="text-[11px] text-red-600 mt-1.5 text-center">
                    ※ 迷惑メールフォルダや「プロモーション」タブも併せてご確認ください。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 🌟 再送完了メッセージ表示枠 */}
          {resendSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 mb-6 text-emerald-900 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>確認メールを再送信しました</span>
              </div>
              <p className="leading-relaxed text-emerald-950">{resendSuccessMessage}</p>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              🎉 1. 新規登録完了＆確認メール送信済（再送ボタン完備）画面
             ───────────────────────────────────────────────────────────── */}
          {mode === 'signup' && signupSuccess && (
            <div className="space-y-6">
              <div className="text-center py-2 space-y-3">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 animate-bounce">
                  <Mail className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  確認メールをお送りしました
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-950 space-y-1.5 text-left">
                  <p className="font-bold">送信先メールアドレス:</p>
                  <p className="font-mono text-blue-900 bg-white p-2 rounded border border-blue-200 break-all select-all font-bold">
                    {signupSuccessEmail}
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                    上記アドレス宛に本登録リンクを記載した確認メールを送信いたしました。<br />
                    メール内の<strong>リンクをクリックして登録を完了</strong>してください。
                  </p>
                </div>
              </div>

              {/* メールが届かない場合の再送枠 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  <span>メールが届かない場合</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  迷惑メールフォルダに振り分けられている場合がございます。数分待っても届かない場合は、下記のボタンから再送信してください。
                </p>
                <button
                  type="button"
                  disabled={loading || resendCooldown > 0}
                  onClick={() => handleResendConfirmation(signupSuccessEmail)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `再送可能まで あと ${resendCooldown} 秒` : '確認メールを再送する'}
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setSignupSuccess(false);
                    setError(null);
                    setResendSuccessMessage(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-300 rounded-lg shadow-xs text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  ログイン画面へ進む
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              🔑 2. パスワード忘れ（メール送信）画面
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
                        setResendSuccessMessage(null);
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
              📬 3. 確認メール再送専用画面（ログイン画面下部などから直接遷移）
             ───────────────────────────────────────────────────────────── */}
          {mode === 'resend_confirm' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-900">
                  本登録用確認メールの再送
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  アカウント登録時に届くはずの確認メールが届かない場合は、登録したメールアドレスを入力して再送信してください。
                </p>
              </div>

              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleResendConfirmation();
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="resend-email">
                    登録メールアドレス
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="resend-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="focus:ring-amber-500 focus:border-amber-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading || resendCooldown > 0}
                    className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    {loading ? '送信中...' : (resendCooldown > 0 ? `再送可能まで あと ${resendCooldown} 秒` : '確認メールを再送信する')}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setResendSuccessMessage(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    ログイン画面へ戻る
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              👤 4. 通常ログイン ＆ 新規アカウント作成 フォーム
             ───────────────────────────────────────────────────────────── */}
          {(mode === 'login' || (mode === 'signup' && !signupSuccess)) && (
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
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
                          setResendSuccessMessage(null);
                        }}
                        className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer"
                      >
                        パスワードを忘れた場合
                      </button>
                    </div>
                  </div>

                  {/* 📬 確認メール再送への導線 */}
                  <div className="text-right text-xs pt-0.5 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('resend_confirm');
                        setError(null);
                        setResendSuccessMessage(null);
                      }}
                      className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer flex items-center justify-end gap-1 ml-auto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>確認メールが届かない方はこちら（再送）</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors cursor-pointer ${
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
                    setResendSuccessMessage(null);
                    setSignupSuccess(false);
                    setIsEmailNotConfirmed(false);
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

