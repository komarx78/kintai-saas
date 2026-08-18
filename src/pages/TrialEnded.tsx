import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TrialEnded() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <Lock className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            トライアル期間が終了しました
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            1ヶ月の無料トライアル期間が終了しました。引き続きシステムをご利用いただくには、有料プランへの移行手続きが必要です。
          </p>
          <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 mb-6 text-left">
            システムの管理者（オーナー）へお問い合わせいただき、支払い設定を完了させてください。
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ログイン画面へ戻る
          </button>
        </div>
      </div>
    </div>
  );
}
