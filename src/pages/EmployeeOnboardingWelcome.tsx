import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { compressImageFile } from '../lib/imageCompressor';
import { 
  estimateTrainRoute, 
  calculateCommutingDistanceKm, 
  getTaxFreeCarAllowance 
} from '../lib/commutingCalculator';
import { 
  UserCheck, CreditCard, Train, ShieldCheck, 
  Upload, Trash2, CheckCircle2, ChevronRight, ChevronLeft, 
  Loader2, Home, Lock, Plus, FileText, Sparkles, MapPin, Check
} from 'lucide-react';

interface DependentItem {
  name: string;
  relation: string;
  birthDate: string;
  isLivingTogether: boolean;
  incomeEstimate: number;
  isUnder16: boolean;
  isSpecific?: boolean;
  isElderly?: boolean;
}

export default function EmployeeOnboardingWelcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // 1. 本人基本情報 ＆ 住民票写真
  const [basicData, setBasicData] = useState({
    name: '',
    nameKana: '',
    birthDate: '1998-04-01',
    gender: 'unspecified',
    postalCode: '',
    address: '',
    phoneNumber: '',
    householderName: '',
    householderRelation: '本人',
    emergencyContactName: '',
    emergencyContactRelation: '親',
    emergencyContactPhone: '',
    residentCertificatePhoto: '',
    residentCertificateFileName: '',
    residentCertificateSizeInfo: ''
  });

  // 2. 通勤交通費 支給申請書
  const [commutingData, setCommutingData] = useState({
    transportMode: 'train_bus' as 'train_bus' | 'car_bike' | 'walk_bicycle',
    originStation: '',
    viaStation: '',
    destinationStation: '',
    transitLines: '東京メトロ東西線',
    oneWayFare: 210,
    oneMonthPassAmount: 7550,
    sixMonthPassAmount: 40770,
    carDistanceKm: 8.5,
    passPhoto: '',
    passFileName: '',
    passSizeInfo: '',
    isAutoCalculated: false
  });

  // 3. 給与振込口座情報
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

  // 4. 令和8年分 扶養控除等（異動）申告書
  const [taxData, setTaxData] = useState({
    hasSpouse: false,
    spouseName: '',
    spouseIncomeEstimate: 0,
    dependents: [] as DependentItem[],
    isDisability: false,
    isSingleParent: false,
    isWidow: false,
    isWorkingStudent: false
  });

  // 新規扶養親族追加用一時State
  const [newDep, setNewDep] = useState<DependentItem>({
    name: '',
    relation: '子',
    birthDate: '2015-05-01',
    isLivingTogether: true,
    incomeEstimate: 0,
    isUnder16: false,
    isSpecific: false,
    isElderly: false
  });

  // 5. マイナンバー・年金・雇用保険・前職源泉
  const [officialDocsData, setOfficialDocsData] = useState({
    myNumber: '',
    myNumberCardPhoto: '',
    myNumberCardFileName: '',
    pensionNumber: '',
    pensionPhoto: '',
    pensionFileName: '',
    employmentInsuranceNumber: '',
    employmentInsurancePhoto: '',
    withholdingSlipPhoto: '',
    withholdingSlipFileName: ''
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

  // 🤖 電車・バスの定期代・路線を自動計算
  const handleAutoCalculateTrainRoute = () => {
    if (!commutingData.originStation.trim() || !commutingData.destinationStation.trim()) {
      alert('出発駅と到着駅を入力してください。');
      return;
    }
    const result = estimateTrainRoute(commutingData.originStation, commutingData.destinationStation);
    setCommutingData(prev => ({
      ...prev,
      transitLines: result.transitLines,
      oneWayFare: result.oneWayFare,
      oneMonthPassAmount: result.oneMonthPassAmount,
      sixMonthPassAmount: result.sixMonthPassAmount,
      isAutoCalculated: true
    }));
    alert(`✨ 経路・定期代を自動算出しました！\n利用路線: ${result.transitLines}\n片道運賃: ¥${result.oneWayFare.toLocaleString()}\n1ヶ月定期代: ¥${result.oneMonthPassAmount.toLocaleString()}`);
  };

  // 🗺️ 自宅住所〜会社所在地から片道通勤距離（km）＆非課税手当を自動計算
  const handleAutoCalculateCarDistance = () => {
    if (!basicData.address.trim()) {
      alert('Step 1 で現住所を入力してください。');
      setCurrentStep(1);
      return;
    }
    const compAddr = tenantInfo?.address || '東京都千代田区大手町 1-2-3';
    const result = calculateCommutingDistanceKm(basicData.address, compAddr);
    const allowance = getTaxFreeCarAllowance(result.distanceKm);

    setCommutingData(prev => ({
      ...prev,
      carDistanceKm: result.distanceKm,
      oneMonthPassAmount: allowance,
      isAutoCalculated: true
    }));
    alert(`🗺️ 住所から通勤距離を自動計算しました！\n片道通勤距離: ${result.distanceKm} km\n国税庁基準マイカー手当: ¥${allowance.toLocaleString()} /月`);
  };

  // 写真のスマホ撮影・圧縮アップロード汎用ハンドラ
  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, { maxWidth: 1280, maxHeight: 1280, quality: 0.75 });
      const origKb = Math.round(compressed.originalSize / 1024);
      const compKb = Math.round(compressed.compressedSize / 1024);
      const sizeStr = `${origKb}KB ➔ ${compKb}KB に軽量化`;

      if (field === 'resident') {
        setBasicData(prev => ({
          ...prev,
          residentCertificatePhoto: compressed.base64,
          residentCertificateFileName: compressed.fileName,
          residentCertificateSizeInfo: sizeStr
        }));
      } else if (field === 'passbook') {
        setBankData(prev => ({
          ...prev,
          passbookPhoto: compressed.base64,
          passbookFileName: compressed.fileName,
          passbookSizeInfo: sizeStr
        }));
      } else if (field === 'pass') {
        setCommutingData(prev => ({
          ...prev,
          passPhoto: compressed.base64,
          passFileName: compressed.fileName,
          passSizeInfo: sizeStr
        }));
      } else if (field === 'mynumber') {
        setOfficialDocsData(prev => ({
          ...prev,
          myNumberCardPhoto: compressed.base64,
          myNumberCardFileName: compressed.fileName
        }));
      } else if (field === 'pension') {
        setOfficialDocsData(prev => ({
          ...prev,
          pensionPhoto: compressed.base64,
          pensionFileName: compressed.fileName
        }));
      } else if (field === 'withholding') {
        setOfficialDocsData(prev => ({
          ...prev,
          withholdingSlipPhoto: compressed.base64,
          withholdingSlipFileName: compressed.fileName
        }));
      }
    } catch (err: any) {
      alert('写真の読み込みに失敗しました: ' + err.message);
    }
  };

  // 扶養親族の追加
  const handleAddDependent = () => {
    if (!newDep.name.trim()) {
      alert('扶養親族の氏名を入力してください。');
      return;
    }
    setTaxData(prev => ({
      ...prev,
      dependents: [...prev.dependents, newDep]
    }));
    setNewDep({
      name: '',
      relation: '子',
      birthDate: '2015-05-01',
      isLivingTogether: true,
      incomeEstimate: 0,
      isUnder16: false,
      isSpecific: false,
      isElderly: false
    });
  };

  // 扶養親族の削除
  const handleDeleteDependent = (idx: number) => {
    setTaxData(prev => ({
      ...prev,
      dependents: prev.dependents.filter((_, i) => i !== idx)
    }));
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

      // 1. 住民票の添付（ある場合）
      if (basicData.residentCertificatePhoto) {
        await supabase.from('employee_document_submissions').insert({
          tenant_id: effectiveTenantId,
          user_id: userId,
          document_type: 'resident_certificate',
          title: '住民票の写し（原本確認）',
          data: {
            name: basicData.name,
            address: basicData.address,
            householder_name: basicData.householderName,
            householder_relation: basicData.householderRelation
          },
          attachment_data: basicData.residentCertificatePhoto,
          attachment_filename: basicData.residentCertificateFileName,
          status: 'pending'
        });
      }

      // 2. 通勤交通費 支給申請書の送信
      if (commutingData.originStation || commutingData.transportMode === 'car_bike') {
        await supabase.from('employee_document_submissions').insert({
          tenant_id: effectiveTenantId,
          user_id: userId,
          document_type: 'commuting_pass',
          title: '通勤交通費 支給申請書',
          data: {
            name: basicData.name,
            transport_mode: commutingData.transportMode,
            origin_station: commutingData.originStation,
            via_station: commutingData.viaStation,
            destination_station: commutingData.destinationStation,
            transit_lines: commutingData.transitLines,
            one_way_fare: commutingData.oneWayFare,
            one_month_pass_amount: commutingData.oneMonthPassAmount,
            six_month_pass_amount: commutingData.sixMonthPassAmount,
            car_distance_km: commutingData.carDistanceKm
          },
          attachment_data: commutingData.passPhoto || null,
          attachment_filename: commutingData.passFileName || '',
          status: 'pending'
        });
      }

      // 3. 給与振込口座届出書の送信
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

      // 4. 令和8年分 扶養控除等申告書の送信
      await supabase.from('employee_document_submissions').insert({
        tenant_id: effectiveTenantId,
        user_id: userId,
        document_type: 'dependents_form',
        title: '令和8年分 給与所得者の扶養控除等（異動）申告書',
        data: {
          year: 2026,
          name: basicData.name,
          name_kana: basicData.nameKana,
          address: basicData.address,
          householder_name: basicData.householderName || basicData.name,
          householder_relation: basicData.householderRelation,
          has_spouse: taxData.hasSpouse,
          spouse_name: taxData.spouseName,
          spouse_income_estimate: taxData.spouseIncomeEstimate,
          dependents: taxData.dependents,
          dependents_count: taxData.dependents.filter(d => !d.isUnder16).length + (taxData.hasSpouse ? 1 : 0),
          is_disability: taxData.isDisability,
          is_single_parent: taxData.isSingleParent,
          is_widow: taxData.isWidow,
          is_working_student: taxData.isWorkingStudent
        },
        status: 'pending'
      });

      // 5. マイナンバー ＆ 年金・雇用保険届出の送信
      if (officialDocsData.myNumber || officialDocsData.pensionNumber) {
        await supabase.from('employee_document_submissions').insert({
          tenant_id: effectiveTenantId,
          user_id: userId,
          document_type: 'my_number',
          title: '個人番号（マイナンバー）・社会保険等届出書',
          data: {
            name: basicData.name,
            my_number: officialDocsData.myNumber,
            pension_number: officialDocsData.pensionNumber,
            employment_insurance_number: officialDocsData.employmentInsuranceNumber
          },
          attachment_data: officialDocsData.myNumberCardPhoto || officialDocsData.pensionPhoto || null,
          attachment_filename: officialDocsData.myNumberCardFileName || '',
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full text-center space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-xl font-black">公的入社書類の提出が完了しました！</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              ご入力いただいた法定書類および住民票・通帳・定期券写真は、人事部へ安全に暗号化送信されました。管理者の確認が完了次第、給与・社会保険の手続きが完了となります。
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-xs space-y-2 text-slate-300">
            <div className="font-bold text-white mb-1">📋 提出された公式書類:</div>
            <div>✅ 1. 本人基本情報 ＆ 住民票原本</div>
            <div>✅ 2. 通勤交通費 支給申請書（AI自動計算経路）</div>
            <div>✅ 3. 給与振込口座 登録届出書 兼 通帳確認</div>
            <div>✅ 4. 令和8年分 扶養控除等（異動）申告書</div>
            <div>✅ 5. マイナンバー ＆ 年金・雇用保険届出</div>
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
            <div className="text-xs font-black text-white">新入社員 公式入社手続きWebフォーム</div>
            <div className="text-[10px] text-indigo-400 font-bold">{tenantInfo?.name || '株式会社KAP'}</div>
          </div>
        </div>
        <div className="text-[10px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700 font-bold">
          Step {currentStep} / 5
        </div>
      </header>

      {/* ステップインジケーター */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 overflow-x-auto">
        <div className="flex items-center justify-between max-w-lg mx-auto text-[10px] font-bold text-slate-400 min-w-[320px]">
          <span className={currentStep === 1 ? 'text-indigo-400 font-black' : ''}>1.基本・住民票</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 2 ? 'text-indigo-400 font-black' : ''}>2.通勤・AI計算</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 3 ? 'text-indigo-400 font-black' : ''}>3.口座・通帳</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 4 ? 'text-indigo-400 font-black' : ''}>4.扶養控除申告</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 5 ? 'text-indigo-400 font-black' : ''}>5.個人番号</span>
        </div>
      </div>

      {/* フォーム本体 */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-4">
        
        {/* Step 1: 基本情報 ＆ 住民票の添付 */}
        {currentStep === 1 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Home className="w-4 h-4 text-indigo-400" />
                1. あなたの基本情報 ＆ 住民票添付
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">雇用契約書および社会保険の公的登録に使用いたします。</p>
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

              {/* 🏠 住民票の写し 添付枠 */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border-2 border-dashed border-slate-700 text-center space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handlePhotoUpload(e, 'resident')}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white">住民票の写し（原本）をスマホ撮影・添付</span>
                    <span className="text-[9px] text-slate-400">※ 写真を撮るだけで自動的に軽量化されます</span>
                  </div>
                </label>

                {basicData.residentCertificatePhoto && (
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between text-left">
                    <span className="text-[11px] font-bold text-indigo-400">📷 住民票の写真を添付済</span>
                    <button
                      onClick={() => setBasicData({ ...basicData, residentCertificatePhoto: '', residentCertificateFileName: '' })}
                      className="p-1 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">世帯主氏名</label>
                  <input
                    type="text"
                    placeholder="例: 佐藤 健一"
                    value={basicData.householderName}
                    onChange={e => setBasicData({ ...basicData, householderName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">世帯主との続柄</label>
                  <select
                    value={basicData.householderRelation}
                    onChange={e => setBasicData({ ...basicData, householderRelation: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  >
                    <option value="本人">本人</option>
                    <option value="夫">夫</option>
                    <option value="妻">妻</option>
                    <option value="父">父</option>
                    <option value="母">母</option>
                    <option value="子">子</option>
                  </select>
                </div>
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

        {/* Step 2: 正式な通勤交通費 支給申請書 ＆ AI自動計算 */}
        {currentStep === 2 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Train className="w-4 h-4 text-cyan-400" />
                2. 通勤交通費 支給申請書（AI自動計算対応）
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">乗車駅や住所から、定期代や通勤距離を自動算出できます。</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">通勤区分・手段</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCommutingData(prev => ({ ...prev, transportMode: 'train_bus' }))}
                    className={`py-2 px-2 rounded-xl font-bold text-[11px] border transition cursor-pointer ${
                      commutingData.transportMode === 'train_bus' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    電車・バス
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommutingData(prev => ({ ...prev, transportMode: 'car_bike' }))}
                    className={`py-2 px-2 rounded-xl font-bold text-[11px] border transition cursor-pointer ${
                      commutingData.transportMode === 'car_bike' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    マイカー・バイク
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommutingData(prev => ({ ...prev, transportMode: 'walk_bicycle' }))}
                    className={`py-2 px-2 rounded-xl font-bold text-[11px] border transition cursor-pointer ${
                      commutingData.transportMode === 'walk_bicycle' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    徒歩・自転車
                  </button>
                </div>
              </div>

              {commutingData.transportMode === 'train_bus' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">乗車駅（自宅最寄） <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        placeholder="例: 中野駅"
                        value={commutingData.originStation}
                        onChange={e => setCommutingData({ ...commutingData, originStation: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">降車駅（会社最寄） <span className="text-rose-400">*</span></label>
                      <input
                        type="text"
                        placeholder="例: 大手町駅"
                        value={commutingData.destinationStation}
                        onChange={e => setCommutingData({ ...commutingData, destinationStation: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                      />
                    </div>
                  </div>

                  {/* 🤖 定期代自動計算ボタン */}
                  <button
                    type="button"
                    onClick={handleAutoCalculateTrainRoute}
                    className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-black rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    🤖 最適路線・1ヶ月定期代を自動算出
                  </button>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">利用路線・乗換経路</label>
                    <input
                      type="text"
                      placeholder="例: 東京メトロ東西線"
                      value={commutingData.transitLines}
                      onChange={e => setCommutingData({ ...commutingData, transitLines: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">1ヶ月通勤定期代（円） <span className="text-rose-400">*</span></label>
                      <input
                        type="number"
                        placeholder="7550"
                        value={commutingData.oneMonthPassAmount}
                        onChange={e => setCommutingData({ ...commutingData, oneMonthPassAmount: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-black text-cyan-400 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">片道運賃（円）</label>
                      <input
                        type="number"
                        placeholder="210"
                        value={commutingData.oneWayFare}
                        onChange={e => setCommutingData({ ...commutingData, oneWayFare: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              {commutingData.transportMode === 'car_bike' && (
                <div className="space-y-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700">
                  {/* 🗺️ 住所から通勤距離自動計算ボタン */}
                  <button
                    type="button"
                    onClick={handleAutoCalculateCarDistance}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <MapPin className="w-4 h-4 text-emerald-200" />
                    🗺️ 自宅〜会社住所から片道距離・手当を自動計算
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">片道通勤距離（km）</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="8.5"
                        value={commutingData.carDistanceKm}
                        onChange={e => setCommutingData({ ...commutingData, carDistanceKm: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">国税庁基準マイカー手当（月額）</label>
                      <input
                        type="number"
                        value={commutingData.oneMonthPassAmount}
                        onChange={e => setCommutingData({ ...commutingData, oneMonthPassAmount: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-black text-cyan-400 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 定期券または運賃証明の写真添付 */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border-2 border-dashed border-slate-700 text-center space-y-2">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(e, 'pass')}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white">定期券 または 乗換アプリ検索結果の写真を添付</span>
                  </div>
                </label>

                {commutingData.passPhoto && (
                  <div className="p-2 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between text-left">
                    <span className="text-[11px] font-bold text-cyan-400">📷 定期券・運賃写真を添付済</span>
                    <button
                      onClick={() => setCommutingData({ ...commutingData, passPhoto: '', passFileName: '' })}
                      className="p-1 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 給与振込口座 ＋ 通帳写真撮影 */}
        {currentStep === 3 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                3. 給与振込口座の登録 ＆ 通帳原本撮影
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">給与が振り込まれるご本人名義の口座情報を入力してください。</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">金融機関名（銀行名）</label>
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
                  <label className="text-[10px] text-slate-400 block mb-0.5">預金種目</label>
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
                    onChange={e => handlePhotoUpload(e, 'passbook')}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white">通帳の見開き面 または キャッシュカードを撮影</span>
                    <span className="text-[9px] text-slate-400">※ スマホで写真を撮るだけで自動的に軽量化されます</span>
                  </div>
                </label>

                {bankData.passbookPhoto && (
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-between text-left">
                    <span className="text-[11px] font-bold text-emerald-400">📷 通帳写真を添付済</span>
                    <button
                      onClick={() => setBankData({ ...bankData, passbookPhoto: '', passbookFileName: '' })}
                      className="p-1 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 令和8年分 国税庁公式 扶養控除等（異動）申告書 */}
        {currentStep === 4 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                4. 令和8年分 給与所得者の扶養控除等（異動）申告書
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">所得税の源泉徴収税額（甲欄）および年末調整に必須の公的申告です。</p>
            </div>

            <div className="space-y-4 text-xs">
              {/* 配偶者控除の有無 */}
              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">源泉控除対象配偶者（夫・妻）</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxData.hasSpouse}
                      onChange={e => setTaxData({ ...taxData, hasSpouse: e.target.checked })}
                      className="rounded text-indigo-500"
                    />
                    <span className="font-bold text-xs text-amber-400">{taxData.hasSpouse ? 'あり' : 'なし'}</span>
                  </label>
                </div>

                {taxData.hasSpouse && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">配偶者の氏名</label>
                      <input
                        type="text"
                        placeholder="例: 佐藤 花子"
                        value={taxData.spouseName}
                        onChange={e => setTaxData({ ...taxData, spouseName: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">本年所得の見積額 (円)</label>
                      <input
                        type="number"
                        placeholder="480000"
                        value={taxData.spouseIncomeEstimate}
                        onChange={e => setTaxData({ ...taxData, spouseIncomeEstimate: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 扶養親族一覧 ＆ 追加フォーム */}
              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">控除対象 扶養親族（お子様・ご両親等）</span>
                  <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-amber-300 font-bold">
                    登録数: {taxData.dependents.length}名
                  </span>
                </div>

                {taxData.dependents.map((dep, idx) => (
                  <div key={idx} className="bg-slate-900 p-2.5 rounded-xl border border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">{dep.name}（{dep.relation}）</div>
                      <div className="text-[10px] text-slate-400">生年: {dep.birthDate} / {dep.isLivingTogether ? '同居' : '別居'}</div>
                    </div>
                    <button onClick={() => handleDeleteDependent(idx)} className="p-1 text-slate-400 hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* 扶養親族追加エリア */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block">＋ 扶養親族を追加</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="氏名（例: 佐藤 陸）"
                      value={newDep.name}
                      onChange={e => setNewDep({ ...newDep, name: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    <select
                      value={newDep.relation}
                      onChange={e => setNewDep({ ...newDep, relation: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold"
                    >
                      <option value="子">子</option>
                      <option value="父">父</option>
                      <option value="母">母</option>
                      <option value="祖父">祖父</option>
                      <option value="祖母">祖母</option>
                      <option value="兄弟姉妹">兄弟姉妹</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newDep.birthDate}
                      onChange={e => {
                        const bDate = e.target.value;
                        const age = new Date().getFullYear() - new Date(bDate).getFullYear();
                        setNewDep({ ...newDep, birthDate: bDate, isUnder16: age < 16, isSpecific: age >= 19 && age < 23, isElderly: age >= 70 });
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddDependent}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 扶養に追加
                    </button>
                  </div>
                </div>
              </div>

              {/* 障害者・ひとり親控除 */}
              <div className="bg-slate-800/70 p-3.5 rounded-2xl border border-slate-700 space-y-2">
                <span className="font-bold text-white block">特別控除の該当（該当する場合のみチェック）</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxData.isDisability}
                      onChange={e => setTaxData({ ...taxData, isDisability: e.target.checked })}
                      className="rounded text-indigo-500"
                    />
                    <span className="text-[11px] text-slate-300">障害者控除</span>
                  </label>
                  <label className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taxData.isSingleParent}
                      onChange={e => setTaxData({ ...taxData, isSingleParent: e.target.checked })}
                      className="rounded text-indigo-500"
                    />
                    <span className="text-[11px] text-slate-300">ひとり親控除</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: マイナンバー・社会保険・雇用保険・前職源泉 */}
        {currentStep === 5 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                5. マイナンバー ＆ 年金・雇用保険・前職源泉
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">公的手続き（社会保険加入・雇用保険・源泉徴収）に必要な番号・書類です。</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">マイナンバー（個人番号：12桁）</label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={12}
                    placeholder="123456789012"
                    value={officialDocsData.myNumber}
                    onChange={e => setOfficialDocsData({ ...officialDocsData, myNumber: e.target.value.replace(/\D/g, '') })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 font-mono text-white text-sm tracking-widest"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                </div>
              </div>

              {/* マイナンバーカード写真 */}
              <div className="bg-slate-800/80 p-3 rounded-2xl border-2 border-dashed border-slate-700 text-center">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(e, 'mynumber')}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center gap-2 py-1">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span className="text-[11px] font-bold text-white">マイナンバーカード（通知カード）写真を添付</span>
                  </div>
                </label>
                {officialDocsData.myNumberCardPhoto && (
                  <span className="text-[10px] text-purple-400 font-bold block mt-1">📷 カード写真を添付済</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">基礎年金番号（10桁）</label>
                  <input
                    type="text"
                    placeholder="1234-567890"
                    value={officialDocsData.pensionNumber}
                    onChange={e => setOfficialDocsData({ ...officialDocsData, pensionNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">雇用保険被保険者番号</label>
                  <input
                    type="text"
                    placeholder="1234-567890-1"
                    value={officialDocsData.employmentInsuranceNumber}
                    onChange={e => setOfficialDocsData({ ...officialDocsData, employmentInsuranceNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-mono text-white"
                  />
                </div>
              </div>

              {/* 前職の源泉徴収票 */}
              <div className="bg-slate-800/80 p-3 rounded-2xl border-2 border-dashed border-slate-700 text-center">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(e, 'withholding')}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center gap-2 py-1">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-bold text-white">前職の源泉徴収票（当年転職者のみ）</span>
                  </div>
                </label>
                {officialDocsData.withholdingSlipPhoto && (
                  <span className="text-[10px] text-amber-400 font-bold block mt-1">📷 源泉徴収票を添付済</span>
                )}
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

          {currentStep < 5 ? (
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
              className="flex-1 max-w-[260px] ml-auto py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              公的入社書類をすべて送信する
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
