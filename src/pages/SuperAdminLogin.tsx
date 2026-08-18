import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Lock, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SuperAdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      if (authData.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (userError) throw userError;

        // 特権IDの固定と不正侵入の排除
        if (email === 'koma@kap-cocotte.com') {
          // 我が君のアドレスなら無条件で昇格
          if (userData.role !== 'superadmin') {
            const { error: updateError } = await supabase
              .from('users')
              .update({ role: 'superadmin' })
              .eq('id', authData.user.id);
            if (updateError) throw updateError;
          }
        } else {
          // それ以外のアドレスの場合、すでにsuperadminでなければ弾く
          if (userData.role !== 'superadmin') {
            await supabase.auth.signOut();
            throw new Error('特権管理者としての権限がありません');
          }
        }

        navigate('/super-admin');
      }
    } catch (err: any) {
      setError(err.message || '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-400 mb-4">
          <Database size={56} />
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight">
          システム管理・運用本部
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Super Admin Access Only
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-800 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-700">
          <form className="space-y-6" onSubmit={handleAuth}>
            {error && (
              <div className="bg-red-900/50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="email">
                管理用メールアドレス
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm bg-gray-900 border-gray-600 text-white rounded-md py-2 border transition-colors"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="password">
                管理用パスワード
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm bg-gray-900 border-gray-600 text-white rounded-md py-2 border transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                {loading ? '認証中...' : 'システム管理に入室'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
