import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Login = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isEmployeeSignup, setIsEmployeeSignup] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignup) {
        const signUpOptions: any = {
          data: {
            name: name.trim() || email.split('@')[0],
          }
        };
        if (isEmployeeSignup && inviteCode.trim() !== '') {
          signUpOptions.data.invite_code = inviteCode.trim();
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: signUpOptions,
        });
        if (signUpError) throw signUpError;
        alert('【重要】登録したアドレスに確認メールを送信しました。\nメール内のリンクをクリックして本登録を完了させてください。\n（※確認が完了するまではログインできません）');
        setIsSignup(false);
      } else {
        // ログイン
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          {isSignup ? <UserPlus size={48} className="text-green-600" /> : <LogIn size={48} />}
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isSignup ? '新規アカウント作成' : 'システムにログイン'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {isSignup ? '新しくアカウントを登録します' : '勤怠・有給管理システム'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleAuth}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {isSignup && (
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
                    required={isSignup}
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

            {isSignup && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <div className="flex items-center mb-3">
                  <input
                    id="is-employee"
                    type="checkbox"
                    checked={isEmployeeSignup}
                    onChange={(e) => setIsEmployeeSignup(e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is-employee" className="ml-2 block text-sm font-medium text-gray-900">
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
                        className="focus:ring-green-500 focus:border-green-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
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

            {!isSignup && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    ログイン状態を保存
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                    パスワードを忘れた場合
                  </a>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors ${
                  isSignup 
                    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {loading ? '処理中...' : (isSignup ? '新規アカウントを作成する' : 'ログイン')}
              </button>
            </div>
            
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {isSignup ? 'すでにアカウントをお持ちの方はこちら（ログイン）' : '初めての方はこちら（新規登録）'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

