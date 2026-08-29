import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { compressImageFile } from '../lib/imageCompressor';
import { 
  UserCheck, CreditCard, Train, ShieldCheck, 
  Upload, Trash2, CheckCircle2, ChevronRight, ChevronLeft, 
  Loader2, Home, Lock
} from 'lucide-react';

export default function EmployeeOnboardingWelcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // 1. 本人基本情報
  const [basicData, setBasicData] = useState({
    name: '',
    nameKana: '',
    birthDate: '1998-04-01',
    gender: 'unspecified',
    postalCode: '',
    address: '',
    phoneNumber: '',
    emergencyContactName: '',
    emergencyContactRelation: '親',
    emergencyContactPhone: ''
  });

  // 2. 給与振込口座情報
  const [bankData, setBankData] = useState({
    bankName: '',
    branchName: '',
    accountType: 'ordinary',
    accountNumber: '',
    accountHolder: '',
    passbookPhoto: '',
    passbookFileName: '',
    passbookSizeInfo: ''
  });

  // 3. 通勤交通費
  const [commutingData, setCommutingData] = useState({
    originStation: '',
    destinationStation: '',
    transitLine: 'JR線 / 地下鉄',
    oneMonthPassAmount: 12000,
    passPhoto: '',
    passFileName: '',
    passSizeInfo: ''
  });

  // 4. マイナンバー ＆ 扶養情報
  const [myNumberData, setMyNumberData] = useState({
    myNumber: '',
    cardPhoto: '',
    cardFileName: '',
    cardSizeInfo: '',
    dependentsCount: 0,
    hasSpouse: false
  });

  useEffect(() => {
    fetchTenant();
  }, []);

  const fetchTenant = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tId } = await supabase.rpc('get_user_tenant_id');
        if (tId) {
          setTenantId(tId);
          const { data: tData } = await supabase.from('tenants').select('*').eq('id', tId).maybeSingle();
          setTenantInfo(tData);
        }
        if (user.user_metadata?.name) {
          setBasicData(prev => ({ ...prev, name: user.user_metadata.name }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 画像のスマホ撮影・圧縮アップロード処理
  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'passbook' | 'pass' | 'card'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.75 });
      const origKb = Math.round(compressed.originalSize / 1024);
      const compKb = Math.round(compressed.compressedSize / 1024);
      const sizeStr = `${origKb}KB ➔ ${compKb}KB に自動軽量化`;

      if (type === 'passbook') {
        setBankData(prev => ({
          ...prev,
          passbookPhoto: compressed.base64,
          passbookFileName: compressed.fileName,
          passbookSizeInfo: sizeStr
        }));
      } else if (type === 'pass') {
        setCommutingData(prev => ({
          ...prev,
          passPhoto: compressed.base64,
          passFileName: compressed.fileName,
          passSizeInfo: sizeStr
        }));
      } else if (type === 'card') {
        setMyNumberData(prev => ({
          ...prev,
          cardPhoto: compressed.base64,
          cardFileName: compressed.fileName,
          cardSizeInfo: sizeStr
        }));
      }
    } catch (err: any) {
      alert('写真の読み込み・圧縮に失敗しました: ' + err.message);
    }
  };

  // 全入力データの送信（管理者審査へ）
  const handleSubmitAll = async () => {
    if (!basicData.name.trim()) {
      alert('氏名を入力してください。');
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || `anon_${Date.now()}`;
      const effectiveTenantId = tenantId || (await supabase.rpc('get_user_tenant_id')).data;

      // 1. 口座届出の送信
      if (bankData.bankName) {
        await supabase.from('employee_document_submissions').insert({
          tenant_id: effectiveTenantId,
          user_id: userId,
          document_type: 'bank_passbook',
          title: '給与振込口座 登録届出書',
          data: {
            name: basicData.name,
            bank_name: bankData.bankName,
            branch_name: bankData.branchName,
            account_type: bankData.accountType,
            account_number: bankData.accountNumber,
            account_holder: bankData.accountHolder || basicData.name
          },
          attachment_data: bankData.passbookPhoto || null,
          attachment_filename: bankData.passbookFileName || '',
          status: 'pending'
        });
      }

      // 2. 通勤交通費申請の送信
      if (commutingData.originStation) {
        await supabase.from('employee_document_submissions').insert({
          tenant_id: effectiveTenantId,
          user_id: userId,
          document_type: 'commuting_pass',
          title: '通勤交通費 支給申請書',
          data: {
            name: basicData.name,
            origin_station: commutingData.originStation,
            destination_station: commutingData.destinationStation,
            transit_line: commutingData.transitLine,
            one_month_pass_amount: commutingData.oneMonthPassAmount
          },
          attachment_data: commutingData.passPhoto || null,
          attachment_filename: commutingData.passFileName || '',
          status: 'pending'
        });
      }

      // 3. マイナンバー・扶養控除の送信
      if (myNumberData.myNumber || myNumberData.cardPhoto) {
        await supabase.from('employee_document_submissions').insert({
          tenant_id: effectiveTenantId,
          user_id: userId,
          document_type: 'my_number',
          title: 'マイナンバー（個人番号）届出書',
          data: {
            name: basicData.name,
            my_number: myNumberData.myNumber,
            dependents_count: myNumberData.dependentsCount,
            has_spouse: myNumberData.hasSpouse
          },
          attachment_data: myNumberData.cardPhoto || null,
          attachment_filename: myNumberData.cardFileName || '',
          status: 'pending'
        });
      }

      setIsCompleted(true);
    } catch (err: any) {
      console.error('Submit onboarding error:', err);
      alert('送信に失敗しました: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full text-center space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-xl font-black">入社手続きの送信が完了しました！</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              ご入力いただいた書類・写真は、会社人事部へ安全に暗号化送信されました。管理者の確認が完了次第、手続き完了となります。
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-xs space-y-2 text-slate-300">
            <div className="font-bold text-white mb-1">📋 提出された書類:</div>
            <div>✅ 給与振込口座届出書 兼 通帳確認</div>
            <div>✅ 通勤交通費支給申請書</div>
            <div>✅ マイナンバー・扶養控除申告</div>
          </div>

          <button
            onClick={() => navigate('/portal')}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-2xl shadow-lg transition cursor-pointer text-xs"
          >
            ポータル画面へ進む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* モバイルヘッダー */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center text-white">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-black text-white">新入社員 入社手続きフォーム</div>
            <div className="text-[10px] text-indigo-400 font-bold">{tenantInfo?.name || '株式会社KAP'}</div>
          </div>
        </div>
        <div className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 font-bold">
          Step {currentStep} / 4
        </div>
      </header>

      {/* ステップインジケーター */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2">
        <div className="flex items-center justify-between max-w-lg mx-auto text-[10px] font-bold text-slate-400">
          <span className={currentStep === 1 ? 'text-indigo-400 font-black' : ''}>1. 基本情報</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 2 ? 'text-indigo-400 font-black' : ''}>2. 振込口座</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 3 ? 'text-indigo-400 font-black' : ''}>3. 通勤費</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 4 ? 'text-indigo-400 font-black' : ''}>4. 個人番号</span>
        </div>
      </div>

      {/* フォーム本体 */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-4">
        
        {/* Step 1: 基本情報 */}
        {currentStep === 1 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Home className="w-4 h-4 text-indigo-400" />
                1. あなたの基本情報を入力してください
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">雇用契約および社会保険の登録に使用いたします。</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">お名前（フルネーム） <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  placeholder="例: 佐藤 健一"
                  value={basicData.name}
                  onChange={e => setBasicData({ ...basicData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 font-bold text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">フリガナ <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  placeholder="例: サトウ ケンイチ"
                  value={basicData.nameKana}
                  onChange={e => setBasicData({ ...basicData, nameKana: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 font-bold text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">生年月日</label>
                  <input
                    type="date"
                    value={basicData.birthDate}
                    onChange={e => setBasicData({ ...basicData, birthDate: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 font-bold text-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">携帯電話番号 <span className="text-rose-400">*</span></label>
                  <input
                    type="tel"
                    placeholder="090-1234-5678"
                    value={basicData.phoneNumber}
                    onChange={e => setBasicData({ ...basicData, phoneNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 font-bold text-white focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">現住所（住民票記載の住所） <span className="text-rose-400">*</span></label>
                <input
                  type="text"
                  placeholder="例: 東京都新宿区西新宿 2-8-1 〇〇マンション 101号室"
                  value={basicData.address}
                  onChange={e => setBasicData({ ...basicData, address: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 font-bold text-white focus:border-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-indigo-300 block">緊急連絡先（ご家族等）</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="氏名（例: 佐藤 節子）"
                    value={basicData.emergencyContactName}
                    onChange={e => setBasicData({ ...basicData, emergencyContactName: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                  <input
                    type="tel"
                    placeholder="電話番号"
                    value={basicData.emergencyContactPhone}
                    onChange={e => setBasicData({ ...basicData, emergencyContactPhone: e.target.value })}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 給与振込口座 ＋ 通帳写真撮影 */}
        {currentStep === 2 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                2. 給与振込口座の登録 ＆ 通帳撮影
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">給与が振り込まれるご本人名義の口座情報を入力してください。</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">銀行名</label>
                  <input
                    type="text"
                    placeholder="例: 三井住友銀行"
                    value={bankData.bankName}
                    onChange={e => setBankData({ ...bankData, bankName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">支店名</label>
                  <input
                    type="text"
                    placeholder="例: 新宿支店"
                    value={bankData.branchName}
                    onChange={e => setBankData({ ...bankData, branchName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">口座種別</label>
                  <select
                    value={bankData.accountType}
                    onChange={e => setBankData({ ...bankData, accountType: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                  >
                    <option value="ordinary">普通預金</option>
                    <option value="current">当座預金</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">口座番号（7桁）</label>
                  <input
                    type="text"
                    placeholder="1234567"
                    value={bankData.accountNumber}
                    onChange={e => setBankData({ ...bankData, accountNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">口座名義人（カナ）</label>
                <input
                  type="text"
                  placeholder="例: サトウ ケンイチ"
                  value={bankData.accountHolder}
                  onChange={e => setBankData({ ...bankData, accountHolder: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                />
              </div>

              {/* 通帳写真撮影アップロード */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border-2 border-dashed border-slate-700 text-center space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={e => handlePhotoUpload(e, 'passbook')}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">通帳の見開き面 または キャッシュカードを撮影</span>
                    <span className="text-[10px] text-slate-400">※ スマホで写真を撮るだけで自動的に軽量化されます</span>
                  </div>
                </label>

                {bankData.passbookPhoto && (
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between text-left">
                    <div className="flex items-center gap-2.5">
                      <img src={bankData.passbookPhoto} alt="通帳プレビュー" className="w-10 h-10 object-cover rounded-lg border border-slate-600" />
                      <div>
                        <div className="text-[11px] font-bold text-emerald-400">📷 通帳写真を添付しました</div>
                        <div className="text-[9px] text-slate-400">{bankData.passbookSizeInfo}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setBankData({ ...bankData, passbookPhoto: '', passbookFileName: '', passbookSizeInfo: '' })}
                      className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 通勤交通費申請 ＋ 定期券写真撮影 */}
        {currentStep === 3 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Train className="w-4 h-4 text-cyan-400" />
                3. 通勤経路 ＆ 通勤手当の申請
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">自宅から勤務先までの通勤経路と1ヶ月の定期代を入力してください。</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">自宅最寄駅 <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    placeholder="例: 中野駅"
                    value={commutingData.originStation}
                    onChange={e => setCommutingData({ ...commutingData, originStation: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">会社最寄駅 <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    placeholder="例: 大手町駅"
                    value={commutingData.destinationStation}
                    onChange={e => setCommutingData({ ...commutingData, destinationStation: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">1ヶ月の通勤定期代（円） <span className="text-rose-400">*</span></label>
                <input
                  type="number"
                  placeholder="12000"
                  value={commutingData.oneMonthPassAmount}
                  onChange={e => setCommutingData({ ...commutingData, oneMonthPassAmount: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-cyan-400 text-sm"
                />
              </div>

              {/* 定期券または乗換アプリ画面の写真撮影 */}
              <div className="bg-slate-800/80 p-4 rounded-2xl border-2 border-dashed border-slate-700 text-center space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(e, 'pass')}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">定期券 または 乗換検索結果の画面スクショを添付</span>
                  </div>
                </label>

                {commutingData.passPhoto && (
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between text-left">
                    <div className="flex items-center gap-2.5">
                      <img src={commutingData.passPhoto} alt="定期券プレビュー" className="w-10 h-10 object-cover rounded-lg border border-slate-600" />
                      <div>
                        <div className="text-[11px] font-bold text-cyan-400">📷 定期券・経路画面を添付しました</div>
                        <div className="text-[9px] text-slate-400">{commutingData.passSizeInfo}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setCommutingData({ ...commutingData, passPhoto: '', passFileName: '', passSizeInfo: '' })}
                      className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: マイナンバー ＆ 扶養情報 */}
        {currentStep === 4 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                4. マイナンバー ＆ 扶養親族の確認
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">源泉徴収票および雇用保険の手続きに安全に利用されます。</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">マイナンバー（個人番号：12桁）</label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={12}
                    placeholder="123456789012"
                    value={myNumberData.myNumber}
                    onChange={e => setMyNumberData({ ...myNumberData, myNumber: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 font-mono text-white text-sm tracking-widest"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                </div>
              </div>

              {/* マイナンバーカード写真 */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border-2 border-dashed border-slate-700 text-center space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(e, 'card')}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1 py-1">
                    <Upload className="w-5 h-5 text-purple-400" />
                    <span className="text-xs font-bold text-white">マイナンバーカード（通知カード）写真</span>
                  </div>
                </label>

                {myNumberData.cardPhoto && (
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between text-left">
                    <span className="text-[11px] font-bold text-purple-400">📷 個人番号カード写真を添付済</span>
                    <button
                      onClick={() => setMyNumberData({ ...myNumberData, cardPhoto: '', cardFileName: '', cardSizeInfo: '' })}
                      className="p-1 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block">税法上の扶養親族</span>
                <div className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <span className="text-slate-300">扶養親族等の人数</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMyNumberData(prev => ({ ...prev, dependentsCount: Math.max(0, prev.dependentsCount - 1) }))}
                      className="w-7 h-7 rounded-lg bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-black text-white w-6 text-center">{myNumberData.dependentsCount}名</span>
                    <button
                      type="button"
                      onClick={() => setMyNumberData(prev => ({ ...prev, dependentsCount: prev.dependentsCount + 1 }))}
                      className="w-7 h-7 rounded-lg bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* フッターナビゲーション */}
      <footer className="bg-slate-900/90 backdrop-blur-md border-t border-slate-800 p-4 sticky bottom-0 z-30">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep((currentStep - 1) as any)}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              前へ
            </button>
          ) : <div />}

          {currentStep < 4 ? (
            <button
              onClick={() => {
                if (currentStep === 1 && !basicData.name.trim()) {
                  alert('お名前を入力してください。');
                  return;
                }
                setCurrentStep((currentStep + 1) as any);
              }}
              className="flex-1 max-w-[200px] ml-auto py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-1 cursor-pointer"
            >
              次へ進む
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmitAll}
              disabled={isSubmitting}
              className="flex-1 max-w-[240px] ml-auto py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              入社書類をすべて送信する
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
