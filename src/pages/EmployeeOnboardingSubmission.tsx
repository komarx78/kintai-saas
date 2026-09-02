import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AppSwitcher from '../components/AppSwitcher';
import { HelpGuideModal } from '../components/HelpGuideModal';
import { compressImageFile } from '../lib/imageCompressor';
import { 
  CreditCard, Train, Shield, Users, FileText, 
  Upload, CheckCircle2, ArrowLeft, 
  LogOut, Loader2, Trash2, Send, Check
} from 'lucide-react';

export default function EmployeeOnboardingSubmission() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'bank' | 'commuting' | 'identity' | 'dependents' | 'withholding'>('bank');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 提出履歴リスト
  const [submissions, setSubmissions] = useState<any[]>([]);

  // 1. 口座申請フォームState
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    branch_name: '',
    account_type: 'ordinary',
    account_number: '',
    account_holder: '',
    attachment_data: '',
    attachment_filename: '',
    fileSizeInfo: ''
  });

  // 2. 通勤費申請フォームState
  const [commutingForm, setCommutingForm] = useState({
    origin_station: '', // 出発駅/自宅
    destination_station: '', // 到着駅/会社
    via_route: '', // 経由路線・駅
    transport_mode: 'train', // 'train', 'bus', 'car', 'bicycle'
    one_month_pass_amount: 15000, // 1ヶ月定期代
    one_way_amount: 500, // 片道運賃
    attachment_data: '',
    attachment_filename: '',
    fileSizeInfo: ''
  });

  // 3. 本人確認・マイナンバーState
  const [idForm, setIdForm] = useState({
    my_number: '',
    birth_date: '',
    address: '',
    phone: '',
    id_type: 'drivers_license', // 'drivers_license', 'my_number_card', 'passport'
    attachment_data: '',
    attachment_filename: '',
    fileSizeInfo: ''
  });

  // 4. 扶養控除等申告State
  const [dependentsForm, setDependentsForm] = useState({
    has_dependents: false,
    dependents_count: 0,
    spouse_deduction: false,
    notes: '',
    attachment_data: '',
    attachment_filename: '',
    fileSizeInfo: ''
  });

  // 5. 前職源泉徴収票State
  const [withholdingForm, setWithholdingForm] = useState({
    previous_company_name: '',
    retirement_year_month: '',
    attachment_data: '',
    attachment_filename: '',
    fileSizeInfo: ''
  });

  useEffect(() => {
    fetchProfileAndSubmissions();
  }, []);

  const fetchProfileAndSubmissions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUserId(user.id);

      const { data: userData } = await supabase
        .from('users')
        .select('name, tenant_id')
        .eq('id', user.id)
        .single();

      if (userData) {
        setUserName(userData.name || '従業員');
        setTenantId(userData.tenant_id);

        // 既存の給与プロファイルがあれば口座初期値にセット
        const { data: payProf } = await supabase
          .from('employee_payroll_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (payProf) {
          setBankForm(prev => ({
            ...prev,
            bank_name: payProf.bank_name || '',
            branch_name: payProf.branch_name || '',
            account_type: payProf.account_type || 'ordinary',
            account_number: payProf.account_number || '',
            account_holder: payProf.account_holder || userData.name
          }));

          if (payProf.commuting_allowance) {
            setCommutingForm(prev => ({
              ...prev,
              one_month_pass_amount: payProf.commuting_allowance
            }));
          }
        }

        // 提出済み書類履歴の取得
        const { data: subData } = await supabase
          .from('employee_document_submissions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        setSubmissions(subData || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 画像・書類の圧縮アップロードハンドラ
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (fn: (prev: any) => any) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // クライアントサイド自動圧縮実行（最大1200px、品質0.75）
      const compressed = await compressImageFile(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.75 });
      const origKb = Math.round(compressed.originalSize / 1024);
      const compKb = Math.round(compressed.compressedSize / 1024);

      setter(prev => ({
        ...prev,
        attachment_data: compressed.base64,
        attachment_filename: compressed.fileName,
        fileSizeInfo: `軽量化完了: ${origKb}KB ➔ ${compKb}KB`
      }));
    } catch (err: any) {
      console.error('File compression error:', err);
      alert('ファイルの読み込みに失敗しました: ' + err.message);
    }
  };

  // 申請の送信
  const handleSubmitDocument = async (docType: string, title: string, formData: any) => {
    if (!tenantId || !userId) return;

    setIsSubmitting(true);
    try {
      const payload = {
        tenant_id: tenantId,
        user_id: userId,
        document_type: docType,
        title,
        data: formData,
        attachment_data: formData.attachment_data || null,
        attachment_filename: formData.attachment_filename || '',
        status: 'pending'
      };

      const { error } = await supabase
        .from('employee_document_submissions')
        .insert(payload);

      if (error) throw error;

      // 労務大元マスタ（users / employee_payroll_profiles）へ即時バックアップ連動
      try {
        if (docType === 'identity_card' && (formData.birth_date || formData.address || formData.phone)) {
          await supabase.from('users').update({
            birth_date: formData.birth_date || null,
            address: formData.address || null,
            phone: formData.phone || null
          }).eq('id', userId);

          if (formData.birth_date) {
            await supabase.from('employee_payroll_profiles').upsert({
              tenant_id: tenantId,
              user_id: userId,
              birth_date: formData.birth_date
            }, { onConflict: 'tenant_id,user_id' });
          }
        } else if (docType === 'bank_passbook') {
          await supabase.from('employee_payroll_profiles').upsert({
            tenant_id: tenantId,
            user_id: userId,
            bank_name: formData.bank_name,
            branch_name: formData.branch_name,
            account_type: formData.account_type,
            account_number: formData.account_number,
            account_holder: formData.account_holder
          }, { onConflict: 'tenant_id,user_id' });
        } else if (docType === 'commuting_pass') {
          await supabase.from('employee_payroll_profiles').upsert({
            tenant_id: tenantId,
            user_id: userId,
            commuting_allowance: formData.one_month_pass_amount || 0
          }, { onConflict: 'tenant_id,user_id' });
        } else if (docType === 'dependents_form') {
          await supabase.from('employee_payroll_profiles').upsert({
            tenant_id: tenantId,
            user_id: userId,
            dependents_count: formData.dependents_count || 0
          }, { onConflict: 'tenant_id,user_id' });
        }
      } catch (syncErr) {
        console.warn('Auto sync profile error:', syncErr);
      }

      alert(`✨ 「${title}」の提出が完了しました！\n労務・給与マスタへ即座に反映されました。`);
      await fetchProfileAndSubmissions();
    } catch (err: any) {
      console.error('Submit error:', err);
      alert('提出に失敗しました: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/portal')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            ポータル
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-800">入社提出書類・各種申請</div>
              <div className="text-[10px] text-slate-400 font-bold">{userName} さん</div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 px-3.5 py-1.5 rounded-xl flex items-center space-x-1.5 transition font-bold text-xs shadow-xs cursor-pointer"
            title="入社手続き書類の提出方法を見る"
          >
            <span className="text-sm">❓</span>
            <span>使い方ガイド</span>
          </button>
          <AppSwitcher currentApp="portal" role="user" />
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}
            className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* ガイドバナー */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-md shadow-blue-100">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-cyan-300" />
            入社・労務手続き 書類提出フォーム
          </h2>
          <p className="text-xs text-blue-100 mt-1 leading-relaxed">
            スマホから通帳の写真や通勤経路を入力して送信するだけで完了します。写真は自動で軽量化されて送信されます。
          </p>
        </div>

        {/* タブ切り替え */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('bank')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'bank' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            給与振込口座・通帳写真
          </button>

          <button
            onClick={() => setActiveTab('commuting')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'commuting' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Train className="w-4 h-4" />
            通勤交通費申請
          </button>

          <button
            onClick={() => setActiveTab('identity')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'identity' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            本人確認・マイナ
          </button>

          <button
            onClick={() => setActiveTab('dependents')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'dependents' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            扶養控除等申告
          </button>

          <button
            onClick={() => setActiveTab('withholding')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'withholding' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            前職の源泉徴収票
          </button>
        </div>

        {/* 1. 給与振込口座 申請フォーム */}
        {activeTab === 'bank' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                給与振込口座の登録 ＆ 通帳コピー写真提出
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">給与のお振込み先となる銀行口座をご入力いただき、通帳の表紙・見開き（またはキャッシュカード）の写真をご添付ください。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">銀行名 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="例: 三菱UFJ銀行 / ゆうちょ銀行"
                  value={bankForm.bank_name}
                  onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">支店名 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="例: 新宿支店"
                  value={bankForm.branch_name}
                  onChange={e => setBankForm({ ...bankForm, branch_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">口座種別</label>
                <select
                  value={bankForm.account_type}
                  onChange={e => setBankForm({ ...bankForm, account_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="ordinary">普通預金</option>
                  <option value="current">当座預金</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">口座番号 (7桁) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="例: 1234567"
                  value={bankForm.account_number}
                  onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold tracking-wider"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">口座名義人（カタカナ） <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="例: ヤマダ タロウ"
                  value={bankForm.account_holder}
                  onChange={e => setBankForm({ ...bankForm, account_holder: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>
            </div>

            {/* 通帳写真アップロード枠 */}
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-2">
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => handleFileUpload(e, setBankForm)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">通帳の見開きまたはキャッシュカードの写真を撮影・選択</span>
                  <span className="text-[10px] text-slate-400">※ 写真は自動で最適なサイズに軽量化（圧縮）されます</span>
                </div>
              </label>

              {bankForm.attachment_data && (
                <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <img src={bankForm.attachment_data} alt="プレビュー" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{bankForm.attachment_filename}</div>
                      <div className="text-[10px] text-emerald-600 font-bold">{bankForm.fileSizeInfo}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setBankForm({ ...bankForm, attachment_data: '', attachment_filename: '', fileSizeInfo: '' })}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleSubmitDocument('bank_passbook', '給与振込口座 申請', bankForm)}
                disabled={isSubmitting || !bankForm.bank_name || !bankForm.account_number}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                口座情報を提出する
              </button>
            </div>
          </div>
        )}

        {/* 2. 通勤交通費 申請フォーム */}
        {activeTab === 'commuting' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Train className="w-5 h-5 text-blue-600" />
                通勤交通費（定期代）の申請
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">自宅から勤務先までの最も合理的・経済的な通勤経路と定期代をご入力ください。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">出発地（自宅最寄駅・バス停） <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="例: 新宿駅"
                  value={commutingForm.origin_station}
                  onChange={e => setCommutingForm({ ...commutingForm, origin_station: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">到着地（勤務先最寄駅） <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="例: 東京駅"
                  value={commutingForm.destination_station}
                  onChange={e => setCommutingForm({ ...commutingForm, destination_station: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">利用路線・経由</label>
                <input
                  type="text"
                  placeholder="例: JR山手線（直通）"
                  value={commutingForm.via_route}
                  onChange={e => setCommutingForm({ ...commutingForm, via_route: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">1ヶ月定期代（円） <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  value={commutingForm.one_month_pass_amount}
                  onChange={e => setCommutingForm({ ...commutingForm, one_month_pass_amount: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-blue-700"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">通勤手段</label>
                <select
                  value={commutingForm.transport_mode}
                  onChange={e => setCommutingForm({ ...commutingForm, transport_mode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="train">電車・鉄道</option>
                  <option value="bus">路線バス</option>
                  <option value="car">自動車・マイカー</option>
                  <option value="bicycle">自転車・徒歩</option>
                </select>
              </div>
            </div>

            {/* 定期券写真アップロード */}
            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-2">
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => handleFileUpload(e, setCommutingForm)}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">定期券の写真、または運賃ルート検索のスクリーンショットを添付</span>
                </div>
              </label>

              {commutingForm.attachment_data && (
                <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-left">
                    <img src={commutingForm.attachment_data} alt="プレビュー" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{commutingForm.attachment_filename}</div>
                      <div className="text-[10px] text-emerald-600 font-bold">{commutingForm.fileSizeInfo}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setCommutingForm({ ...commutingForm, attachment_data: '', attachment_filename: '', fileSizeInfo: '' })}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleSubmitDocument('commuting_pass', '通勤交通費 申請', commutingForm)}
                disabled={isSubmitting || !commutingForm.origin_station || !commutingForm.destination_station}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                通勤費を申請する
              </button>
            </div>
          </div>
        )}

        {/* 3. 本人確認・マイナンバー 申請フォーム */}
        {activeTab === 'identity' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                本人確認書類 ＆ マイナンバー提出
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">社会保険・雇用保険・税務届出のため、マイナンバーおよび身分証写真をご提出ください。</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">🎂 生年月日（西暦） <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    value={idForm.birth_date}
                    onChange={e => setIdForm({ ...idForm, birth_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">連絡先 電話番号</label>
                  <input
                    type="tel"
                    placeholder="例: 090-1234-5678"
                    value={idForm.phone}
                    onChange={e => setIdForm({ ...idForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">住民票記載の現住所</label>
                <input
                  type="text"
                  placeholder="例: 滋賀県大津市坂本..."
                  value={idForm.address}
                  onChange={e => setIdForm({ ...idForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">マイナンバー (12桁)</label>
                <input
                  type="password"
                  placeholder="例: 123456789012"
                  maxLength={12}
                  value={idForm.my_number}
                  onChange={e => setIdForm({ ...idForm, my_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold tracking-widest"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">添付する本人確認書類の種別</label>
                <select
                  value={idForm.id_type}
                  onChange={e => setIdForm({ ...idForm, id_type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                >
                  <option value="drivers_license">運転免許証（表・裏）</option>
                  <option value="my_number_card">マイナンバーカード（表面のみ）</option>
                  <option value="passport">パスポート / 在留カード</option>
                </select>
              </div>

              {/* 身分証写真アップロード */}
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handleFileUpload(e, setIdForm)}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">身分証の写真を撮影・選択</span>
                  </div>
                </label>

                {idForm.attachment_data && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-left">
                      <img src={idForm.attachment_data} alt="プレビュー" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">{idForm.attachment_filename}</div>
                        <div className="text-[10px] text-emerald-600 font-bold">{idForm.fileSizeInfo}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIdForm({ ...idForm, attachment_data: '', attachment_filename: '', fileSizeInfo: '' })}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleSubmitDocument('my_number', '本人確認・マイナンバー 提出', idForm)}
                disabled={isSubmitting || !idForm.attachment_data}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                身分証を提出する
              </button>
            </div>
          </div>
        )}

        {/* 4. 扶養控除等申告 フォーム */}
        {activeTab === 'dependents' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                給与所得者の扶養控除等（異動）申告
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">毎月の給与から差し引かれる所得税の源泉徴収税額を正しく計算するための申告です。</p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={dependentsForm.has_dependents}
                    onChange={e => setDependentsForm({ ...dependentsForm, has_dependents: e.target.checked })}
                    className="rounded text-blue-600 w-4 h-4"
                  />
                  <span>税法上の扶養親族（配偶者・お子様・ご両親等）がいる</span>
                </label>

                {dependentsForm.has_dependents && (
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">扶養親族等の数（本人除く）</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={dependentsForm.dependents_count}
                        onChange={e => setDependentsForm({ ...dependentsForm, dependents_count: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                      <input
                        type="checkbox"
                        checked={dependentsForm.spouse_deduction}
                        onChange={e => setDependentsForm({ ...dependentsForm, spouse_deduction: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>源泉控除対象配偶者あり</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleSubmitDocument('dependents_form', '扶養控除等 申告', dependentsForm)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                扶養情報を提出する
              </button>
            </div>
          </div>
        )}

        {/* 5. 前職源泉徴収票 フォーム */}
        {activeTab === 'withholding' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                前職の源泉徴収票 提出
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">今年中に他社から転職された方は、年末調整のために前職の源泉徴収票をご提出ください。</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">前職の会社名</label>
                <input
                  type="text"
                  placeholder="例: 株式会社〇〇"
                  value={withholdingForm.previous_company_name}
                  onChange={e => setWithholdingForm({ ...withholdingForm, previous_company_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 font-bold"
                />
              </div>

              {/* 源泉票写真・PDFアップロード */}
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-300 text-center space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handleFileUpload(e, setWithholdingForm)}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">源泉徴収票の写真またはPDFを選択</span>
                  </div>
                </label>

                {withholdingForm.attachment_data && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-left">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-xs">PDF/画</div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{withholdingForm.attachment_filename}</div>
                        <div className="text-[10px] text-emerald-600 font-bold">{withholdingForm.fileSizeInfo}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setWithholdingForm({ ...withholdingForm, attachment_data: '', attachment_filename: '', fileSizeInfo: '' })}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleSubmitDocument('withholding_tax', '前職の源泉徴収票 提出', withholdingForm)}
                disabled={isSubmitting || !withholdingForm.attachment_data}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                源泉徴収票を提出する
              </button>
            </div>
          </div>
        )}

        {/* 提出済み履歴一覧 */}
        {submissions.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              あなたの書類提出履歴・承認状態
            </h3>

            <div className="divide-y divide-slate-100 text-xs">
              {submissions.map(sub => (
                <div key={sub.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-800">{sub.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      提出日時: {new Date(sub.created_at).toLocaleString('ja-JP')}
                    </div>
                  </div>

                  <div>
                    {sub.status === 'approved' ? (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" /> 承認済（マスタ反映済）
                      </span>
                    ) : sub.status === 'rejected' ? (
                      <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-rose-200">
                        差戻し（再提出が必要）
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                        管理者確認中
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ❓ 使い方ガイドモーダル */}
      <HelpGuideModal 
        screenKey="onboarding_user" 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
      />
    </div>
  );
}
