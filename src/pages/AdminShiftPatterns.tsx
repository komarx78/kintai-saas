import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppSwitcher from '../components/AppSwitcher';

type ShiftPattern = {
  id: string;
  tenant_id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  color: string;
};

export default function AdminShiftPatterns() {
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<Partial<ShiftPattern>>({});

  useEffect(() => {
    fetchProfileAndPatterns();
  }, []);

  const fetchProfileAndPatterns = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: tenantData } = await supabase.rpc('get_user_tenant_id');
      const tId = tenantData;
      setTenantId(tId);

      if (tId) {
        const { data, error } = await supabase
          .from('shift_patterns')
          .select('*')
          .eq('tenant_id', tId)
          .order('created_at', { ascending: true });
        
        if (!error && data) {
          setPatterns(data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (pattern?: ShiftPattern) => {
    if (pattern) {
      setEditingPattern(pattern);
    } else {
      setEditingPattern({
        name: '',
        start_time: '09:00',
        end_time: '18:00',
        break_minutes: 60,
        color: '#3B82F6'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      if (editingPattern.id) {
        // Update
        const { error } = await supabase
          .from('shift_patterns')
          .update({
            name: editingPattern.name,
            start_time: editingPattern.start_time,
            end_time: editingPattern.end_time,
            break_minutes: editingPattern.break_minutes,
            color: editingPattern.color,
          })
          .eq('id', editingPattern.id);
        
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('shift_patterns')
          .insert({
            tenant_id: tenantId,
            name: editingPattern.name,
            start_time: editingPattern.start_time,
            end_time: editingPattern.end_time,
            break_minutes: editingPattern.break_minutes,
            color: editingPattern.color,
          });
          
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchProfileAndPatterns();
    } catch (error: any) {
      alert('保存に失敗しました: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('本当に削除しますか？')) return;
    try {
      const { error } = await supabase.from('shift_patterns').delete().eq('id', id);
      if (error) throw error;
      fetchProfileAndPatterns();
    } catch (error: any) {
      alert('削除に失敗しました: ' + error.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/shift/admin')}
              className="p-2 rounded hover:bg-gray-200 text-gray-600 transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">シフトパターン設定</h1>
          </div>
          <AppSwitcher currentApp="shift" role="admin" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-medium text-gray-700">登録済みパターン一覧</h2>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4 mr-1" />
              新規作成
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                  <th className="p-4 font-medium">パターン名</th>
                  <th className="p-4 font-medium">時間</th>
                  <th className="p-4 font-medium">休憩</th>
                  <th className="p-4 font-medium">カラー</th>
                  <th className="p-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {patterns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      シフトパターンが登録されていません。
                    </td>
                  </tr>
                ) : (
                  patterns.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-800">{p.name}</td>
                      <td className="p-4 text-gray-600">{p.start_time.slice(0, 5)} - {p.end_time.slice(0, 5)}</td>
                      <td className="p-4 text-gray-600">{p.break_minutes}分</td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-6 h-6 rounded-full border border-gray-300 shadow-sm" 
                            style={{ backgroundColor: p.color }} 
                          />
                          <span className="text-sm text-gray-500">{p.color}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleOpenModal(p)}
                          className="text-blue-600 hover:text-blue-900 p-1 mr-2"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">
                  {editingPattern.id ? 'パターンを編集' : 'パターンを新規作成'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>
              <form onSubmit={handleSave} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">パターン名</label>
                  <input
                    type="text"
                    required
                    value={editingPattern.name || ''}
                    onChange={(e) => setEditingPattern({...editingPattern, name: e.target.value})}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="例: 早番"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                    <input
                      type="time"
                      required
                      value={editingPattern.start_time || ''}
                      onChange={(e) => setEditingPattern({...editingPattern, start_time: e.target.value})}
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
                    <input
                      type="time"
                      required
                      value={editingPattern.end_time || ''}
                      onChange={(e) => setEditingPattern({...editingPattern, end_time: e.target.value})}
                      className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">休憩時間 (分)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editingPattern.break_minutes || 0}
                    onChange={(e) => setEditingPattern({...editingPattern, break_minutes: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">表示カラー</label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      required
                      value={editingPattern.color || '#000000'}
                      onChange={(e) => setEditingPattern({...editingPattern, color: e.target.value})}
                      className="w-10 h-10 border-0 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-500">
                      カレンダー等で表示される色を選択
                    </span>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    保存する
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
