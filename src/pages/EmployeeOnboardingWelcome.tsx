import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { compressImageFile } from '../lib/imageCompressor';
import { 
  type CommuteRouteSegment,
  calculateTotalCommuteAmounts,
  estimateSingleSegment,
  generateMultiRouteWithAi,
  calculateCommutingDistanceKm, 
  getTaxFreeCarAllowance 
} from '../lib/commutingCalculator';
import { 
  parseResidentCertificateImage, 
  parseBankPassbookImage 
} from '../lib/geminiOcr';
import {
  resolveStationSuggestions,
  type StationSuggestion
} from '../lib/geminiStationResolver';
import { 
  UserCheck, CreditCard, Train, ShieldCheck, 
  Upload, Trash2, CheckCircle2, ChevronRight, ChevronLeft, 
  Loader2, Home, Lock, Plus, FileText, Sparkles, MapPin, Check,
  Bot, Edit3, Users
} from 'lucide-react';

interface DependentItem {
  name: string;
  nameKana?: string;
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
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [isAiRouting, setIsAiRouting] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  // 0. 労働条件通知書 兼 雇用契約書 電子合意State
  const [contractAgreement, setContractAgreement] = useState({
    isAgreed: false,
    agreedAt: '',
    employeeSignatureName: '',
    employmentType: '正社員（無期雇用）',
    salaryType: 'monthly' as 'monthly' | 'hourly',
    baseSalary: 250000,
    hourlyWage: 1200,
    positionName: '',
    positionAllowance: 0,
    qualificationAllowance: 0,
    fixedOvertimeAllowance: 0,
    department: '営業部',
    workLocation: '本社 および 会社が指定する就業場所',
    workHours: '09:00 〜 18:00（休憩60分・実働8時間）',
    overtimePolicy: 'あり（時間外割増 25%、深夜割増 25%、休日割増 35%）',
    holidayPolicy: '土曜日、日曜日、国民の祝日、年末年始休暇、夏季休暇、年次有給休暇',
    socialInsurance: '健康保険・厚生年金保険・雇用保険・労災保険に加入',
    joinDate: '2026-04-01'
  });

  // 📍 地区推測 ＆ 正式駅名・路線バス停サジェスト State（全国マルチ地域対応）
  const [originRegionHint, setOriginRegionHint] = useState<string>('京都府・大阪府・東京都ほか');
  const [originSuggestions, setOriginSuggestions] = useState<StationSuggestion[]>([
    { region: '京都府京都市山科区', regionLabel: '京都山科', formalStationName: '大塚（バス停）', lineName: '京阪バス', type: 'bus', description: '山科区大塚' },
    { region: '大阪府高槻市', regionLabel: '大阪高槻', formalStationName: '大塚（バス停）', lineName: '高槻市営バス', type: 'bus', description: '高槻市大塚町' },
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '大塚駅', lineName: 'JR山手線', type: 'jr', description: '豊島区大塚' },
    { region: '東京都豊島区', regionLabel: '東京豊島', formalStationName: '北大塚一丁目', lineName: '都営バス', type: 'bus', description: '都営バス停' }
  ]);
  const [destRegionHint, setDestRegionHint] = useState<string>('大阪府大阪市淀川区');
  const [destSuggestions, setDestSuggestions] = useState<StationSuggestion[]>([
    { region: '大阪府大阪市淀川区', regionLabel: '大阪淀川', formalStationName: '新大阪駅', lineName: '新幹線 / JR線 / 御堂筋線', type: 'jr', description: 'ターミナル' },
    { region: '大阪府大阪市淀川区', regionLabel: '大阪淀川', formalStationName: '新大阪駅東口', lineName: '大阪シティバス', type: 'bus', description: '路線バス停' }
  ]);

  // 429 API連打防止用 デバウンスタイマーRef
  const originTimerRef = useRef<any>(null);
  const destTimerRef = useRef<any>(null);

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

  // 2. 通勤交通費 支給申請書（複数乗り継ぎ対応）
  const [commutingData, setCommutingData] = useState({
    transportMode: 'train_bus' as 'train_bus' | 'car_bike' | 'walk_bicycle',
    originStation: '',
    viaStation: '',
    destinationStation: '',
    segments: [] as CommuteRouteSegment[],
    carDistanceKm: 0,
    passPhoto: '',
    passFileName: '',
    passSizeInfo: '',
    routeDetailNote: ''
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
    spouseNameKana: '',
    spouseBirthDate: '1996-05-15',
    spouseIncomeEstimate: 0,
    spouseIsLivingTogether: true,
    dependents: [] as DependentItem[],
    isDisability: false,
    isSingleParent: false,
    isWidow: false,
    isWorkingStudent: false
  });

  // 新規扶養親族追加用一時State
  const [newDep, setNewDep] = useState<DependentItem>({
    name: '',
    nameKana: '',
    relation: '子',
    birthDate: '2015-05-01',
    isLivingTogether: true,
    incomeEstimate: 0,
    isUnder16: true, // 2015年生まれは令和8年時点で11歳（16歳未満）
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

    // 📱 管理者が発行したURLクエリパラメータ（個人別 労働条件・給与・役職設定）の自動読取
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const nameParam = searchParams.get('name');
      const salaryTypeParam = searchParams.get('salary_type');
      const baseSalaryParam = searchParams.get('base_salary');
      const hourlyWageParam = searchParams.get('hourly_wage');
      const posNameParam = searchParams.get('position_name');
      const posAllowanceParam = searchParams.get('position_allowance');
      const qualAllowanceParam = searchParams.get('qualification_allowance');
      const fixedOtParam = searchParams.get('fixed_overtime_allowance');
      const deptParam = searchParams.get('department');
      const empTypeParam = searchParams.get('employment_type');
      const joinDateParam = searchParams.get('join_date');
      const locParam = searchParams.get('work_location');
      const hoursParam = searchParams.get('work_hours');

      if (nameParam || baseSalaryParam || hourlyWageParam || deptParam || posNameParam) {
        if (nameParam) {
          setBasicData(prev => ({ ...prev, name: nameParam }));
        }

        setContractAgreement(prev => ({
          ...prev,
          employeeSignatureName: nameParam || prev.employeeSignatureName,
          salaryType: (salaryTypeParam as any) || prev.salaryType,
          baseSalary: baseSalaryParam ? parseInt(baseSalaryParam, 10) : prev.baseSalary,
          hourlyWage: hourlyWageParam ? parseInt(hourlyWageParam, 10) : prev.hourlyWage,
          positionName: posNameParam || prev.positionName,
          positionAllowance: posAllowanceParam ? parseInt(posAllowanceParam, 10) : prev.positionAllowance,
          qualificationAllowance: qualAllowanceParam ? parseInt(qualAllowanceParam, 10) : prev.qualificationAllowance,
          fixedOvertimeAllowance: fixedOtParam ? parseInt(fixedOtParam, 10) : prev.fixedOvertimeAllowance,
          department: deptParam || prev.department,
          employmentType: empTypeParam || prev.employmentType,
          joinDate: joinDateParam || prev.joinDate,
          workLocation: locParam || prev.workLocation,
          workHours: hoursParam || prev.workHours
        }));
      }
    } catch (err) {
      console.warn('URL params parse error:', err);
    }
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

  // 🤖 Gemini 3.5 Flash で複数乗り継ぎを一発自動生成
  const handleAutoGenerateMultiRoute = async () => {
    if (!commutingData.originStation.trim() || !commutingData.destinationStation.trim()) {
      alert('乗車駅/バス停 と 降車駅を入力してください。');
      return;
    }

    setIsAiRouting(true);
    try {
      const generatedSegments = await generateMultiRouteWithAi(
        commutingData.originStation,
        commutingData.destinationStation,
        commutingData.viaStation
      );

      setCommutingData(prev => ({
        ...prev,
        segments: generatedSegments
      }));

      const total = calculateTotalCommuteAmounts(generatedSegments);
      alert(`✨ AIが最適乗り継ぎ ${generatedSegments.length} 区間を自動生成しました！\n合計1ヶ月定期代: ¥${total.totalOneMonthPass.toLocaleString()}\n（${total.isTaxFree ? '全額非課税' : `非課税枠超過: ¥${total.taxableExcessAmount.toLocaleString()}`}）`);
    } catch (err: any) {
      alert('AI乗り継ぎ生成に失敗しました: ' + err.message);
    } finally {
      setIsAiRouting(false);
    }
  };

  // 乗り継ぎ区間の追加
  const handleAddSegment = () => {
    const lastSeg = commutingData.segments[commutingData.segments.length - 1];
    const fromStation = lastSeg ? lastSeg.toStation : (commutingData.originStation || '乗換駅');
    const newSeg = estimateSingleSegment(fromStation, commutingData.destinationStation || '会社最寄駅', 'subway');
    
    setCommutingData(prev => ({
      ...prev,
      segments: [...prev.segments, newSeg]
    }));
  };

  // 乗り継ぎ区間の削除
  const handleDeleteSegment = (id: string) => {
    if (commutingData.segments.length <= 1) {
      alert('少なくとも1つの区間が必要です。');
      return;
    }
    setCommutingData(prev => ({
      ...prev,
      segments: prev.segments.filter(s => s.id !== id)
    }));
  };

  // 区間データの更新
  const handleUpdateSegment = (id: string, field: keyof CommuteRouteSegment, value: any) => {
    setCommutingData(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if (s.id === id) {
          return { ...s, [field]: value };
        }
        return s;
      })
    }));
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
      routeDetailNote: result.detail
    }));
    alert(`🗺️ 住所から通勤距離を自動計算しました！\n${result.detail}\n国税庁基準マイカー手当: ¥${allowance.toLocaleString()} /月`);
  };

  // 写真のスマホ撮影・圧縮アップロード ＆ AI自動読み取り（Gemini 3.5 Flash OCR）
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

        // 🤖 住民票のGemini 3.5 Flash AI自動読み取りを実行
        setIsOcrProcessing(true);
        try {
          const parsed = await parseResidentCertificateImage(compressed.base64);
          setBasicData(prev => ({
            ...prev,
            name: parsed.name || prev.name,
            nameKana: parsed.nameKana || prev.nameKana,
            birthDate: parsed.birthDate || prev.birthDate,
            address: parsed.address || prev.address,
            householderName: parsed.householderName || prev.householderName,
            householderRelation: parsed.householderRelation || prev.householderRelation
          }));
          setOcrSuccessMsg('🤖 Gemini 3.5 Flash が住民票から氏名・住所・生年月日・世帯主を自動入力しました！');
          setTimeout(() => setOcrSuccessMsg(null), 4000);
        } finally {
          setIsOcrProcessing(false);
        }
      } else if (field === 'passbook') {
        setBankData(prev => ({
          ...prev,
          passbookPhoto: compressed.base64,
          passbookFileName: compressed.fileName,
          passbookSizeInfo: sizeStr
        }));

        // 🤖 通帳のGemini 3.5 Flash AI自動読み取りを実行
        setIsOcrProcessing(true);
        try {
          const parsed = await parseBankPassbookImage(compressed.base64);
          setBankData(prev => ({
            ...prev,
            bankName: parsed.bankName || prev.bankName,
            branchName: parsed.branchName || prev.branchName,
            accountType: parsed.accountType || prev.accountType,
            accountNumber: parsed.accountNumber || prev.accountNumber,
            accountHolder: parsed.accountHolder || prev.accountHolder
          }));
          setOcrSuccessMsg('🤖 Gemini 3.5 Flash が通帳写真から銀行名・支店名・口座番号・名義人を自動入力しました！');
          setTimeout(() => setOcrSuccessMsg(null), 4000);
        } finally {
          setIsOcrProcessing(false);
        }
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

  // 扶養親族の法定年齢区分（令和8年分 = 2026年基準）の自動計算関数
  const calculateDependentCategory = (bDateStr: string) => {
    if (!bDateStr) return { isUnder16: false, isSpecific: false, isElderly: false };
    const d = new Date(bDateStr);
    if (isNaN(d.getTime())) return { isUnder16: false, isSpecific: false, isElderly: false };
    
    // 令和8年分（2026年12月31日時点）
    // 16歳未満: 平成23年(2011年)1月2日以後生まれ（2015年生まれ等）
    const isUnder16 = d >= new Date('2011-01-02');
    // 特定扶養(19歳以上23歳未満): 平成15年(2003年)1月2日〜平成19年(2007年)1月1日生まれ
    const isSpecific = d >= new Date('2003-01-02') && d <= new Date('2007-01-01');
    // 老人扶養(70歳以上): 昭和32年(1957年)1月1日以前生まれ
    const isElderly = d <= new Date('1957-01-01');

    return { isUnder16, isSpecific, isElderly };
  };

  // 扶養親族の追加
  const handleAddDependent = () => {
    if (!newDep.name.trim()) {
      alert('扶養親族の氏名を入力してください。');
      return;
    }
    const cats = calculateDependentCategory(newDep.birthDate);
    const depToAdd: DependentItem = {
      ...newDep,
      isUnder16: cats.isUnder16,
      isSpecific: cats.isSpecific,
      isElderly: cats.isElderly
    };

    setTaxData(prev => ({
      ...prev,
      dependents: [...prev.dependents, depToAdd]
    }));

    setNewDep({
      name: '',
      nameKana: '',
      relation: '子',
      birthDate: '2015-05-01',
      isLivingTogether: true,
      incomeEstimate: 0,
      isUnder16: true,
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
      setCurrentStep(2);
      return;
    }

    // 💡 もし扶養親族入力欄に入力中のデータがある場合、自動的に合流
    let currentDependents = [...taxData.dependents];
    if (newDep.name.trim()) {
      const cats = calculateDependentCategory(newDep.birthDate);
      currentDependents.push({
        ...newDep,
        isUnder16: cats.isUnder16,
        isSpecific: cats.isSpecific,
        isElderly: cats.isElderly
      });
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || `anon_${Date.now()}`;
      const effectiveTenantId = tenantId || (await supabase.rpc('get_user_tenant_id')).data;

      // 0. 労働条件通知書 兼 雇用契約書（労働者 電子合意締結）の送信
      await supabase.from('employee_document_submissions').insert({
        tenant_id: effectiveTenantId,
        user_id: userId,
        document_type: 'labor_contract',
        title: '労働条件通知書 兼 雇用契約書（労働者 電子合意締結済）',
        data: {
          name: basicData.name,
          is_agreed: contractAgreement.isAgreed,
          agreed_at: contractAgreement.agreedAt || new Date().toISOString(),
          signature_name: contractAgreement.employeeSignatureName || basicData.name,
          employment_type: contractAgreement.employmentType,
          salary_type: contractAgreement.salaryType,
          base_salary: contractAgreement.baseSalary,
          hourly_wage: contractAgreement.hourlyWage,
          position_name: contractAgreement.positionName,
          position_allowance: contractAgreement.positionAllowance,
          qualification_allowance: contractAgreement.qualificationAllowance,
          fixed_overtime_allowance: contractAgreement.fixedOvertimeAllowance,
          department: contractAgreement.department,
          work_location: contractAgreement.workLocation,
          work_hours: contractAgreement.workHours,
          join_date: contractAgreement.joinDate
        },
        status: 'pending'
      });

      // 1. 住民票の添付（ある場合）
      if (basicData.residentCertificatePhoto) {
        await supabase.from('employee_document_submissions').insert({
          tenant_id: effectiveTenantId,
          user_id: userId,
          document_type: 'resident_certificate',
          title: '住民票の写し（原本確認）',
          data: {
            name: basicData.name,
            name_kana: basicData.nameKana,
            address: basicData.address,
            householder_name: basicData.householderName,
            householder_relation: basicData.householderRelation
          },
          attachment_data: basicData.residentCertificatePhoto,
          attachment_filename: basicData.residentCertificateFileName,
          status: 'pending'
        });
      }

      // 2. 通勤交通費 支給申請書の送信（複数乗り継ぎ区間・合計定期代）
      const totalCommute = calculateTotalCommuteAmounts(commutingData.segments);
      const isCar = commutingData.transportMode === 'car_bike';
      const isWalk = commutingData.transportMode === 'walk_bicycle';
      const finalMonthlyAllowance = isWalk ? 0 : isCar ? getTaxFreeCarAllowance(commutingData.carDistanceKm) : totalCommute.totalOneMonthPass;

      await supabase.from('employee_document_submissions').insert({
        tenant_id: effectiveTenantId,
        user_id: userId,
        document_type: 'commuting_pass',
        title: '通勤交通費 支給申請書（複数乗り継ぎ対応）',
        data: {
          name: basicData.name,
          transport_mode: commutingData.transportMode,
          origin_station: commutingData.originStation || (commutingData.segments[0]?.fromStation || ''),
          via_station: commutingData.viaStation || '',
          destination_station: commutingData.destinationStation || (commutingData.segments[commutingData.segments.length - 1]?.toStation || ''),
          segments: commutingData.segments,
          one_month_pass_amount: finalMonthlyAllowance,
          six_month_pass_amount: isWalk || isCar ? 0 : totalCommute.totalSixMonthPass,
          car_distance_km: commutingData.carDistanceKm,
          route_detail_note: commutingData.routeDetailNote,
          is_tax_free: isCar || isWalk ? true : totalCommute.isTaxFree
        },
        attachment_data: isWalk ? null : (commutingData.passPhoto || null),
        attachment_filename: commutingData.passFileName || '',
        status: 'pending'
      });

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
          spouse_name_kana: taxData.spouseNameKana,
          spouse_birth_date: taxData.spouseBirthDate,
          spouse_income_estimate: taxData.spouseIncomeEstimate,
          spouse_is_living_together: taxData.spouseIsLivingTogether !== false,
          dependents: currentDependents.map(d => {
            const cats = calculateDependentCategory(d.birthDate);
            return { ...d, isUnder16: cats.isUnder16, isSpecific: cats.isSpecific, isElderly: cats.isElderly };
          }),
          dependents_count: currentDependents.filter(d => !calculateDependentCategory(d.birthDate).isUnder16).length + (taxData.hasSpouse ? 1 : 0),
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

  const commuteTotals = calculateTotalCommuteAmounts(commutingData.segments);

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
              ご入力いただいた本人情報・通勤届・口座情報・扶養控除申告書は、安全に送信されました。<br />
              管理者の審査完了後、確定情報がすべて反映された<strong className="text-indigo-300">正式な『雇用契約書 兼 労働条件通知書（締結済正本PDF）』</strong>が自動発行・交付されます。
            </p>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-left text-xs space-y-2 text-slate-300">
            <div className="font-bold text-white mb-1">📋 提出・申請された書類一覧:</div>
            <div>✅ 1. 労働条件の確認・電子承諾</div>
            <div>✅ 2. 本人基本情報 ＆ 住民票写真</div>
            <div>✅ 3. 通勤交通費 支給申請書（{commutingData.segments.length > 0 ? `${commutingData.segments.length}区間` : 'マイカー・徒歩等'}）</div>
            <div>✅ 4. 給与振込口座 登録届出書 兼 通帳確認</div>
            <div>✅ 5. 令和8年分 扶養控除等（異動）申告書</div>
            <div>✅ 6. マイナンバー ＆ 年金・雇用保険届出</div>
          </div>

          <button
            onClick={() => navigate('/portal')}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black py-3 px-4 rounded-2xl shadow-lg transition cursor-pointer text-xs"
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
          Step {currentStep} / 7
        </div>
      </header>

      {/* ステップインジケーター */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 overflow-x-auto">
        <div className="flex items-center justify-between max-w-lg mx-auto text-[10px] font-bold text-slate-400 min-w-[420px]">
          <span className={currentStep === 1 ? 'text-indigo-400 font-black' : ''}>1.条件確認</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 2 ? 'text-indigo-400 font-black' : ''}>2.基本・住民票</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 3 ? 'text-indigo-400 font-black' : ''}>3.通勤届</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 4 ? 'text-indigo-400 font-black' : ''}>4.口座届</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 5 ? 'text-indigo-400 font-black' : ''}>5.扶養申告</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 6 ? 'text-indigo-400 font-black' : ''}>6.個人番号</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={currentStep === 7 ? 'text-emerald-400 font-black' : ''}>7.最終確認</span>
        </div>
      </div>

      {/* OCR / AI 処理中ローディング表示 */}
      {isOcrProcessing && (
        <div className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          🤖 AIが写真から文字を自動解析中...
        </div>
      )}

      {isAiRouting && (
        <div className="bg-cyan-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin" />
          🤖 AIが最適乗り継ぎルートを自動生成中...
        </div>
      )}

      {/* OCR成功トースト */}
      {ocrSuccessMsg && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2 animate-in fade-in">
          <Bot className="w-4 h-4" />
          {ocrSuccessMsg}
        </div>
      )}

      {/* フォーム本体 */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 space-y-4">
        
        {/* Step 1: 📄 労働条件通知書 兼 雇用契約書の確認 ＆ 電子合意・署名 */}
        {currentStep === 1 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Step 1 / 6
                </span>
                <span className="text-[11px] text-slate-400">労働基準法第15条準拠</span>
              </div>
              <h3 className="font-black text-white text-base mt-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                労働条件通知書 兼 雇用契約書の確認・電子合意
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                会社から提示された労働条件および給与・待遇をご確認の上、最下部にて電子署名・合意を行ってください。
              </p>
            </div>

            {/* 労働条件プレビューカード */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-[11px]">
                <span className="text-slate-400">事業者（甲）:</span>
                <span className="font-bold text-white">
                  {tenantInfo?.name || '株式会社KAP'} 代表取締役 {(tenantInfo?.representative_name || '駒井 秀一朗').replace(/^代表取締役\s*/, '')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 text-slate-300">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">雇用形態 / 配属・役職:</span>
                  <span className="font-bold text-indigo-300">
                    {contractAgreement.employmentType}
                    <span className="text-white ml-1">
                      （{contractAgreement.department}{contractAgreement.positionName ? ` / ${contractAgreement.positionName}` : ''}）
                    </span>
                  </span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">
                    {contractAgreement.salaryType === 'hourly' ? '賃金（時給制）:' : '基本給（月給制）:'}
                  </span>
                  <span className="font-black text-emerald-400 font-mono text-sm">
                    {contractAgreement.salaryType === 'hourly' 
                      ? `¥${contractAgreement.hourlyWage.toLocaleString()} / 時間` 
                      : `¥${contractAgreement.baseSalary.toLocaleString()} / 月`}
                    {contractAgreement.salaryType !== 'hourly' && (
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        （時給換算 約¥{contractAgreement.hourlyWage.toLocaleString()}）
                      </span>
                    )}
                  </span>
                </div>

                {contractAgreement.positionAllowance > 0 && (
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-500/30 flex justify-between items-center text-indigo-300">
                    <span className="text-slate-400">👑 役職手当:</span>
                    <span className="font-black font-mono">¥{contractAgreement.positionAllowance.toLocaleString()} / 月</span>
                  </div>
                )}

                {contractAgreement.qualificationAllowance > 0 && (
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-blue-500/30 flex justify-between items-center text-blue-300">
                    <span className="text-slate-400">🎓 資格・職能手当:</span>
                    <span className="font-black font-mono">¥{contractAgreement.qualificationAllowance.toLocaleString()} / 月</span>
                  </div>
                )}

                {contractAgreement.fixedOvertimeAllowance > 0 && (
                  <div className="bg-slate-900/80 p-2.5 rounded-xl border border-amber-500/30 flex justify-between items-center text-amber-300">
                    <span className="text-slate-400">⏱️ 固定残業手当（みなし）:</span>
                    <span className="font-black font-mono">¥{contractAgreement.fixedOvertimeAllowance.toLocaleString()} / 月</span>
                  </div>
                )}

                {contractAgreement.salaryType !== 'hourly' && (contractAgreement.positionAllowance > 0 || contractAgreement.qualificationAllowance > 0 || contractAgreement.fixedOvertimeAllowance > 0) && (
                  <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/40 flex justify-between items-center text-emerald-400">
                    <span className="font-black text-xs text-white">💰 総支給見込額（額面合計）:</span>
                    <span className="font-black font-mono text-base">
                      ¥{(contractAgreement.baseSalary + contractAgreement.positionAllowance + contractAgreement.qualificationAllowance + contractAgreement.fixedOvertimeAllowance).toLocaleString()} / 月
                    </span>
                  </div>
                )}

                {/* 🚆 通勤交通費の明示 */}
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-cyan-500/30 flex justify-between items-center">
                  <span className="text-slate-400">🚆 通勤交通費:</span>
                  <span className="font-bold text-cyan-300 text-right text-[11px]">
                    実費全額支給（月額上限 150,000 円まで非課税 / Step 3にて確定）
                  </span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">割増賃金率:</span>
                  <span className="font-bold text-slate-200">時間外 25% / 深夜 25% / 休日 35%</span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">就業場所:</span>
                  <span className="font-bold text-slate-200 text-right">{contractAgreement.workLocation}</span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">所定労働時間:</span>
                  <span className="font-bold text-slate-200">{contractAgreement.workHours}</span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">休日・休暇:</span>
                  <span className="font-bold text-slate-200 text-right">{contractAgreement.holidayPolicy}</span>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">社会保険等の適用:</span>
                  <span className="font-bold text-emerald-400">{contractAgreement.socialInsurance}</span>
                </div>
              </div>
            </div>

            {/* ✍️ 労働者 電子署名・合意エリア */}
            <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 p-4 rounded-2xl border border-indigo-500/30 space-y-3">
              <h4 className="font-black text-white text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                労働者（乙）電子署名 ＆ 締結合意
              </h4>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-300 block font-bold">
                  ご署名（あなたのお名前を入力してください）<span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例: テスト 太郎"
                  value={contractAgreement.employeeSignatureName || basicData.name}
                  onChange={e => {
                    const val = e.target.value;
                    setContractAgreement(prev => ({ ...prev, employeeSignatureName: val }));
                    setBasicData(prev => ({ ...prev, name: val }));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <label className="flex items-start gap-2.5 p-2.5 bg-slate-950/60 rounded-xl border border-indigo-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contractAgreement.isAgreed}
                  onChange={e => {
                    const checked = e.target.checked;
                    setContractAgreement(prev => ({
                      ...prev,
                      isAgreed: checked,
                      agreedAt: checked ? new Date().toISOString() : ''
                    }));
                  }}
                  className="w-4 h-4 rounded text-indigo-600 mt-0.5"
                />
                <span className="text-[11px] text-slate-200 leading-snug">
                  本書面の交付を受け、提示された労働条件および雇用契約内容について説明を受け合意のうえ、本雇用契約を締結いたします。
                </span>
              </label>

              {contractAgreement.isAgreed && (
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-[11px] font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>電子署名が有効化されました（合意日時: {new Date().toLocaleString('ja-JP')}）</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (!basicData.name.trim() && !contractAgreement.employeeSignatureName.trim()) {
                  alert('ご署名（氏名）を入力してください。');
                  return;
                }
                if (!contractAgreement.isAgreed) {
                  alert('雇用契約内容の確認チェックボックスにチェックを入れてください。');
                  return;
                }
                setCurrentStep(2);
              }}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black py-3 px-4 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <span>合意して次へ（住民票・基本情報の登録）</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: 基本情報 ＆ 住民票の添付（AI自動入力） */}
        {currentStep === 2 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Home className="w-4 h-4 text-indigo-400" />
                2. あなたの基本情報 ＆ 住民票添付
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">住民票の写真を添付すると、AIが氏名や住所を自動入力します。</p>
            </div>

            {/* 🏠 住民票の写し 添付枠 */}
            <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 p-4 rounded-2xl border-2 border-dashed border-indigo-500/40 text-center space-y-2">
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => handlePhotoUpload(e, 'resident')}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
                    <Sparkles className="w-5 h-5 text-indigo-300" />
                  </div>
                  <span className="text-xs font-black text-white flex items-center gap-1">
                    📷 住民票の写しを撮影 ➔ AIで自動入力
                  </span>
                  <span className="text-[10px] text-indigo-300">
                    ※ 写真を撮るだけで氏名・住所・生年月日・世帯主が自動でセットされます
                  </span>
                </div>
              </label>

              {basicData.residentCertificatePhoto && (
                <div className="p-2 bg-slate-900 rounded-xl border border-indigo-500/40 flex items-center justify-between text-left">
                  <span className="text-[11px] font-bold text-indigo-400">📷 住民票の写真を添付・解析済</span>
                  <button
                    onClick={() => setBasicData({ ...basicData, residentCertificatePhoto: '', residentCertificateFileName: '' })}
                    className="p-1 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
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

        {/* Step 3: 複数乗り継ぎ（バス・私鉄・JR・地下鉄）対応 通勤交通費 支給申請書 */}
        {currentStep === 3 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Train className="w-4 h-4 text-cyan-400" />
                3. 通勤交通費 支給申請書（複数乗り継ぎ対応）
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">バス・私鉄・JR・地下鉄の複数乗り継ぎ区間を自由に登録・集計できます。</p>
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
                    電車・路線バス
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

              {/* 1. 電車・路線バス（複数乗り継ぎ） */}
              {commutingData.transportMode === 'train_bus' && (
                <>
                  {/* AI乗り継ぎ一括生成入力 */}
                  <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900 p-3.5 rounded-2xl border border-cyan-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-cyan-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI で最適乗り継ぎを一発自動生成
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">乗車地（自宅最寄）</label>
                        <input
                          type="text"
                          placeholder="例: 〇〇バス停 / 北大塚"
                          value={commutingData.originStation}
                          onChange={e => {
                            const val = e.target.value;
                            setCommutingData(prev => {
                              const newSegs = [...prev.segments];
                              if (newSegs.length > 0) {
                                newSegs[0] = { ...newSegs[0], fromStation: val };
                              }
                              return {
                                ...prev,
                                originStation: val,
                                segments: newSegs
                              };
                            });

                            // デバウンス（400ms）でAPI連打・429を完全防止
                            if (originTimerRef.current) clearTimeout(originTimerRef.current);
                            if (val.trim().length >= 1) {
                              originTimerRef.current = setTimeout(async () => {
                                const res = await resolveStationSuggestions(val, basicData.address);
                                if (res.regionHint) setOriginRegionHint(res.regionHint);
                                if (res.suggestions.length > 0) setOriginSuggestions(res.suggestions);
                              }, 400);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold"
                        />

                        {/* 📍 乗車地の地区推測 ＆ 正式駅名・路線バス停サジェストチップ */}
                        {originSuggestions.length > 0 && (
                          <div className="mt-1.5 space-y-1.5 bg-slate-900/95 p-2 rounded-xl border border-cyan-500/30 text-[10px]">
                            <div className="text-cyan-400 font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1">📍 推定地区: <strong className="text-white">{originRegionHint || '滋賀県・京都府・東京都ほか'}</strong></span>
                              <span className="text-[9px] text-slate-400">タップで適用</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {originSuggestions.map((s, idx) => {
                                const isBus = s.type === 'bus';
                                const icon = isBus ? '🚌' : s.type === 'subway' ? '🚇' : s.type === 'private_rail' ? '🚋' : '🚆';
                                const colorClass = isBus 
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                                  : s.type === 'subway'
                                  ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/40'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40';

                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={async () => {
                                      const newOrigin = s.formalStationName;
                                      const dest = commutingData.destinationStation || '新大阪駅';
                                      
                                      // 実運賃・複数乗り継ぎルートを即時自動生成
                                      const generatedSegs = await generateMultiRouteWithAi(newOrigin, dest);

                                      setCommutingData(prev => ({
                                        ...prev,
                                        originStation: newOrigin,
                                        segments: generatedSegs.length > 0 ? generatedSegs : prev.segments
                                      }));
                                    }}
                                    className={`${colorClass} border px-2 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[10px]`}
                                    title={`${s.region} ${s.formalStationName} (${s.lineName})`}
                                  >
                                    <span className="bg-black/30 px-1 py-0.2 rounded text-[8px] font-black">{s.regionLabel || '地区'}</span>
                                    <span>{icon}</span>
                                    <span>{s.formalStationName}</span>
                                    <span className="text-[8px] opacity-70">({s.lineName.slice(0, 10)})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">降車地（会社最寄）</label>
                        <input
                          type="text"
                          placeholder="例: 新大阪 / 草津駅 / 大手町駅"
                          value={commutingData.destinationStation}
                          onChange={e => {
                            const val = e.target.value;
                            setCommutingData(prev => {
                              const newSegs = [...prev.segments];
                              if (newSegs.length > 0) {
                                newSegs[newSegs.length - 1] = { ...newSegs[newSegs.length - 1], toStation: val };
                              }
                              return {
                                ...prev,
                                destinationStation: val,
                                segments: newSegs
                              };
                            });

                            // デバウンス（400ms）でAPI連打・429を完全防止
                            if (destTimerRef.current) clearTimeout(destTimerRef.current);
                            if (val.trim().length >= 1) {
                              destTimerRef.current = setTimeout(async () => {
                                const compAddr = tenantInfo?.address || '滋賀県・東京都千代田区';
                                const res = await resolveStationSuggestions(val, compAddr);
                                if (res.regionHint) setDestRegionHint(res.regionHint);
                                if (res.suggestions.length > 0) setDestSuggestions(res.suggestions);
                              }, 400);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold"
                        />

                        {/* 📍 降車地の地区推測 ＆ 正式駅名・路線バス停サジェストチップ */}
                        {destSuggestions.length > 0 && (
                          <div className="mt-1.5 space-y-1.5 bg-slate-900/95 p-2 rounded-xl border border-cyan-500/30 text-[10px]">
                            <div className="text-cyan-400 font-bold flex items-center justify-between">
                              <span className="flex items-center gap-1">📍 推定地区: <strong className="text-white">{destRegionHint || '大阪府大阪市淀川区'}</strong></span>
                              <span className="text-[9px] text-slate-400">タップで適用</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {destSuggestions.map((s, idx) => {
                                const isBus = s.type === 'bus';
                                const icon = isBus ? '🚌' : s.type === 'subway' ? '🚇' : s.type === 'private_rail' ? '🚋' : '🚆';
                                const colorClass = isBus 
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                                  : s.type === 'subway'
                                  ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/40'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40';

                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={async () => {
                                      const origin = commutingData.originStation || '花山稲荷（バス停）';
                                      const newDest = s.formalStationName;
                                      setIsAiRouting(true);
                                      try {
                                        // 実運賃・複数乗り継ぎルートを即時自動生成
                                        const generatedSegs = await generateMultiRouteWithAi(origin, newDest);

                                        setCommutingData(prev => ({
                                          ...prev,
                                          destinationStation: newDest,
                                          segments: generatedSegs.length > 0 ? generatedSegs : prev.segments
                                        }));
                                      } catch (e) {
                                        console.error('Auto route failed:', e);
                                      } finally {
                                        setIsAiRouting(false);
                                      }
                                    }}
                                    className={`${colorClass} border px-2 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer text-[10px]`}
                                    title={`${s.region} ${s.formalStationName} (${s.lineName})`}
                                  >
                                    <span className="bg-black/30 px-1 py-0.2 rounded text-[8px] font-black">{s.regionLabel || '地区'}</span>
                                    <span>{icon}</span>
                                    <span>{s.formalStationName}</span>
                                    <span className="text-[8px] opacity-70">({s.lineName.slice(0, 10)})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoGenerateMultiRoute}
                      disabled={isAiRouting}
                      className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-black rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer text-xs disabled:opacity-50"
                    >
                      {isAiRouting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-cyan-200" />}
                      🤖 最適乗り継ぎ区間・定期代を一括自動算出
                    </button>
                  </div>

                  {/* 乗り継ぎ区間リスト */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">🚆 登録された乗り継ぎ区間 ({commutingData.segments.length}区間)</span>
                      <button
                        type="button"
                        onClick={handleAddSegment}
                        className="bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-bold px-3 py-1 rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> ＋ 乗り継ぎ区間を追加
                      </button>
                    </div>

                    {commutingData.segments.length === 0 ? (
                      <div className="bg-slate-800/40 p-5 rounded-2xl border border-dashed border-slate-700 text-center space-y-2">
                        <Train className="w-8 h-8 text-slate-500 mx-auto" />
                        <p className="text-slate-300 font-bold text-xs">まだ通勤区間が登録されていません</p>
                        <p className="text-[10px] text-slate-400">
                          上の「乗車地・降車地」を入力して「🤖 最適乗り継ぎを一括自動算出」を押すか、<br />
                          右上の「＋ 乗り継ぎ区間を追加」から手動で登録してください。
                        </p>
                      </div>
                    ) : (
                      commutingData.segments.map((seg, idx) => {
                      return (
                        <div key={seg.id} className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[10px] font-black">
                                第{idx + 1}区間
                              </span>
                              <select
                                value={seg.transportType}
                                onChange={e => handleUpdateSegment(seg.id, 'transportType', e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-bold rounded-lg px-2 py-0.5"
                              >
                                <option value="bus">🚌 路線バス</option>
                                <option value="jr">🚆 JR線</option>
                                <option value="subway">🚇 地下鉄</option>
                                <option value="private_rail">🚋 私鉄</option>
                                <option value="other">その他</option>
                              </select>
                            </div>
                            {commutingData.segments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSegment(seg.id)}
                                className="text-slate-400 hover:text-rose-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">乗車駅 / バス停</label>
                              <input
                                type="text"
                                value={seg.fromStation}
                                onChange={e => handleUpdateSegment(seg.id, 'fromStation', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">降車駅 / バス停</label>
                              <input
                                type="text"
                                value={seg.toStation}
                                onChange={e => handleUpdateSegment(seg.id, 'toStation', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">利用路線名</label>
                            <input
                              type="text"
                              value={seg.lineName}
                              onChange={e => handleUpdateSegment(seg.id, 'lineName', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">1ヶ月定期代（円）</label>
                              <input
                                type="number"
                                placeholder="例: 6990"
                                value={seg.oneMonthPassAmount === 0 ? '' : seg.oneMonthPassAmount}
                                onChange={e => handleUpdateSegment(seg.id, 'oneMonthPassAmount', e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 font-black text-cyan-400 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">片道運賃（円）</label>
                              <input
                                type="number"
                                placeholder="例: 240"
                                value={seg.oneWayFare === 0 ? '' : seg.oneWayFare}
                                onChange={e => handleUpdateSegment(seg.id, 'oneWayFare', e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0))}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>

                  {/* 💰 乗り継ぎ合計金額ボックス */}
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl border-2 border-indigo-500/40 space-y-1 text-center">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      全{commutingData.segments.length}区間 合計支給額（1ヶ月定期代）
                    </span>
                    <div className="text-2xl font-black text-cyan-400 tracking-tight">
                      ¥{commuteTotals.totalOneMonthPass.toLocaleString()}
                      <span className="text-xs text-slate-300 font-normal ml-1">/月</span>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-400 pt-1">
                      {commuteTotals.isTaxFree ? '✅ 国税庁通勤非課税枠（15万円以内）: 全額所得税非課税' : `⚠️ 15万円超過分（¥${commuteTotals.taxableExcessAmount.toLocaleString()}）は課税対象`}
                    </div>
                  </div>

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
                </>
              )}

              {/* 2. マイカー・バイク通勤 */}
              {commutingData.transportMode === 'car_bike' && (
                <div className="space-y-3 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700">
                  <button
                    type="button"
                    onClick={handleAutoCalculateCarDistance}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                  >
                    <MapPin className="w-4 h-4 text-emerald-200" />
                    🗺️ 自宅〜会社住所から片道距離・手当を自動計算
                  </button>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700 text-[10px] space-y-1">
                    <div className="text-slate-400">【計算対象の住所区間】</div>
                    <div className="text-slate-300">🏡 出発地: <span className="font-bold text-white">{basicData.address || '（Step 1 の現住所）'}</span></div>
                    <div className="text-slate-300">🏢 到着地: <span className="font-bold text-white">{tenantInfo?.address || '東京都千代田区大手町 1-2-3'}（会社所在地）</span></div>
                  </div>

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
                      <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-black text-cyan-400 text-sm">
                        ¥{getTaxFreeCarAllowance(commutingData.carDistanceKm).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 text-center">
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => handlePhotoUpload(e, 'pass')}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-1.5 py-1">
                        <Upload className="w-4 h-4 text-cyan-400" />
                        <span className="text-[11px] font-bold text-white">任意: 運転免許証・任意保険証書の写真を添付</span>
                      </div>
                    </label>
                    {commutingData.passPhoto && (
                      <span className="text-[10px] text-cyan-400 font-bold block mt-1">📷 車両関連写真を添付済</span>
                    )}
                  </div>
                </div>
              )}

              {/* 3. 徒歩・自転車通勤 */}
              {commutingData.transportMode === 'walk_bicycle' && (
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-center space-y-2">
                  <Check className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="font-bold text-white text-xs">徒歩・自転車での通勤が選択されました</div>
                  <p className="text-[10px] text-slate-400">通勤手当支給額: 0円 / 定期券写真等の添付は不要です。</p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Step 4: 給与振込口座 ＋ 通帳写真撮影（AI自動入力） */}
        {currentStep === 4 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                4. 給与振込口座の登録 ＆ 通帳原本撮影
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">通帳の写真を撮影すると、AIが口座情報を自動入力します。</p>
            </div>

            {/* 通帳写真撮影アップロード */}
            <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 p-4 rounded-2xl border-2 border-dashed border-emerald-500/40 text-center space-y-2">
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => handlePhotoUpload(e, 'passbook')}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
                    <Sparkles className="w-5 h-5 text-emerald-300" />
                  </div>
                  <span className="text-xs font-black text-white flex items-center gap-1">
                    📷 通帳またはカードを撮影 ➔ AIで自動入力
                  </span>
                  <span className="text-[10px] text-emerald-300">
                    ※ 銀行名・支店名・口座番号・名義人が自動でセットされます
                  </span>
                </div>
              </label>

              {bankData.passbookPhoto && (
                <div className="p-2 bg-slate-900 rounded-xl border border-emerald-500/40 flex items-center justify-between text-left">
                  <span className="text-[11px] font-bold text-emerald-400">📷 通帳写真を添付・解析済</span>
                  <button
                    onClick={() => setBankData({ ...bankData, passbookPhoto: '', passbookFileName: '' })}
                    className="p-1 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
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
            </div>
          </div>
        )}

        {/* Step 5: 令和8年分 国税庁公式 扶養控除等（異動）申告書 */}
        {currentStep === 5 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                5. 令和8年分 給与所得者の扶養控除等（異動）申告書
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
                  <div className="space-y-2 pt-2 border-t border-slate-700">
                    <div className="grid grid-cols-2 gap-2">
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
                        <label className="text-[10px] text-slate-400 block mb-0.5">フリガナ</label>
                        <input
                          type="text"
                          placeholder="例: サトウ ハナコ"
                          value={taxData.spouseNameKana}
                          onChange={e => setTaxData({ ...taxData, spouseNameKana: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">配偶者の生年月日</label>
                        <input
                          type="date"
                          value={taxData.spouseBirthDate}
                          onChange={e => setTaxData({ ...taxData, spouseBirthDate: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">本年所得の見積額 (円)</label>
                        <input
                          type="number"
                          placeholder="例: 480000"
                          value={taxData.spouseIncomeEstimate === 0 ? '' : taxData.spouseIncomeEstimate}
                          onChange={e => setTaxData({ ...taxData, spouseIncomeEstimate: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-white"
                        />
                      </div>
                    </div>

                    {/* 💡 配偶者の税法上の控除区分 リアルタイム判定バッジ */}
                    {taxData.spouseIncomeEstimate > 0 && (
                      <div className="pt-1 text-[10px] leading-relaxed">
                        {taxData.spouseIncomeEstimate <= 950000 ? (
                          <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-2 rounded-xl">
                            ✅ <b>源泉控除対象配偶者（所得95万円以下 / 給与年収150万円以下）</b><br />
                            毎月の給与計算で源泉所得税が減額され、扶養控除等申告書のA欄に記載されます。
                          </div>
                        ) : taxData.spouseIncomeEstimate <= 1330000 ? (
                          <div className="bg-blue-950/60 border border-blue-500/40 text-blue-300 p-2 rounded-xl">
                            📋 <b>配偶者特別控除の対象（所得95万円超〜133万円以下 / 給与年収201.6万円未満）</b><br />
                            毎月の扶養控除申告書A欄には記載されず、年末調整時の<b>『給与所得者の配偶者控除等申告書』</b>にて控除が適用されます。
                          </div>
                        ) : (
                          <div className="bg-rose-950/60 border border-rose-500/40 text-rose-300 p-2 rounded-xl">
                            ⚠️ <b>控除対象外（所得133万円超 / 給与年収201.6万円超）</b><br />
                            配偶者の所得が基準を超えるため、税法上の配偶者控除・配偶者特別控除の対象外となります（申告書A欄は空欄となります）。
                          </div>
                        )}
                      </div>
                    )}
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
                      <div className="font-bold text-white text-xs">{dep.name} {dep.nameKana ? `(${dep.nameKana})` : ''}（{dep.relation}）</div>
                      <div className="text-[10px] text-slate-400">
                        生年: {dep.birthDate} / {dep.isLivingTogether ? '同居' : '別居'}
                        {dep.isUnder16 ? '【16歳未満】' : dep.isSpecific ? '【特定扶養】' : dep.isElderly ? '【老人扶養】' : ''}
                        {dep.incomeEstimate ? ` / 所得: ¥${dep.incomeEstimate.toLocaleString()}` : ''}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteDependent(idx)} className="p-1 text-slate-400 hover:text-rose-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* 扶養親族追加エリア */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-700 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block">＋ 扶養親族を追加</span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="氏名（例: 佐藤 陸）"
                      value={newDep.name}
                      onChange={e => setNewDep({ ...newDep, name: e.target.value })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                    />
                    <input
                      type="text"
                      placeholder="フリガナ（例: サトウ リク）"
                      value={newDep.nameKana}
                      onChange={e => setNewDep({ ...newDep, nameKana: e.target.value })}
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
                    <div>
                      <label className="text-[9px] text-slate-400 block mb-0.5">生年月日</label>
                      <input
                        type="date"
                        value={newDep.birthDate}
                        onChange={e => {
                          const bDate = e.target.value;
                          const cats = calculateDependentCategory(bDate);
                          setNewDep({ ...newDep, birthDate: bDate, isUnder16: cats.isUnder16, isSpecific: cats.isSpecific, isElderly: cats.isElderly });
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 block mb-0.5">所得見積額 (円)</label>
                      <input
                        type="number"
                        placeholder="例: 0"
                        value={newDep.incomeEstimate === 0 ? '' : newDep.incomeEstimate}
                        onChange={e => setNewDep({ ...newDep, incomeEstimate: e.target.value === '' ? 0 : (parseInt(e.target.value, 10) || 0) })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs"
                      />
                    </div>
                  </div>
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddDependent}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 扶養親族リストに追加
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

        {/* Step 6: マイナンバー・社会保険・雇用保険・前職源泉 */}
        {currentStep === 6 && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                6. マイナンバー ＆ 年金・雇用保険・前職源泉
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

        {/* ========================================================================= */}
        {/* STEP 7: 🚀 提出前 最終確認＆修正シート */}
        {/* ========================================================================= */}
        {currentStep === 7 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-gradient-to-r from-emerald-900/60 via-teal-900/40 to-slate-900 p-4 rounded-3xl border border-emerald-500/30 text-white space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  7. 提出前の最終確認シート
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  最終確認
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                入力した内容に間違いがないか最終確認してください。<br />
                修正したい項目がある場合は、各ブロックの「<strong className="text-emerald-300">✏️ 修正する</strong>」ボタンから該当画面に戻っていつでも直せます。
              </p>
            </div>

            {/* 1. 労働条件 ＆ 本人基本情報 */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                  1. 本人基本情報・住民票
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> 修正する
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-400">氏名:</span> <span className="font-bold text-white">{basicData.name || '未入力'}</span></div>
                <div><span className="text-slate-400">フリガナ:</span> <span className="text-slate-200">{basicData.nameKana || '未入力'}</span></div>
                <div><span className="text-slate-400">生年月日:</span> <span className="font-bold text-white">{basicData.birthDate || '未入力'}</span></div>
                <div><span className="text-slate-400">電話番号:</span> <span className="text-white">{basicData.phoneNumber || '未入力'}</span></div>
                <div className="col-span-2"><span className="text-slate-400">現住所:</span> <span className="font-bold text-white">{basicData.address || '未入力'}</span></div>
                <div><span className="text-slate-400">世帯主:</span> <span className="text-slate-200">{basicData.householderName || basicData.name} ({basicData.householderRelation})</span></div>
                <div><span className="text-slate-400">緊急連絡先:</span> <span className="text-slate-200">{basicData.emergencyContactName} ({basicData.emergencyContactRelation}) {basicData.emergencyContactPhone}</span></div>
                <div className="col-span-2 pt-1 text-[10px] text-emerald-400">
                  {basicData.residentCertificatePhoto ? '📷 住民票の写しを添付済' : '⚠️ 住民票写真は後日提出可能'}
                </div>
              </div>
            </div>

            {/* 2. 通勤交通費申請 */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Train className="w-4 h-4 text-cyan-400" />
                  2. 通勤交通費 支給申請
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> 修正する
                </button>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div>
                  <span className="text-slate-400">通勤区分:</span>{' '}
                  <span className="font-bold text-white">
                    {commutingData.transportMode === 'train_bus' ? '公共交通機関（電車・バス乗り継ぎ）' : commutingData.transportMode === 'car_bike' ? `マイカー・バイク通勤 (${commutingData.carDistanceKm}km)` : '徒歩・自転車'}
                  </span>
                </div>
                {commutingData.transportMode === 'train_bus' && commutingData.segments.length > 0 && (
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 font-bold">乗り継ぎ区間明細 ({commutingData.segments.length}区間):</div>
                    {commutingData.segments.map((s, idx) => (
                      <div key={s.id} className="text-[10px] flex items-center justify-between text-slate-300">
                        <span>第{idx + 1}区間: {s.fromStation} 〜 {s.toStation} ({s.lineName})</span>
                        <span className="font-mono text-cyan-300 font-bold">1ヶ月 ¥{s.oneMonthPassAmount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="pt-1 border-t border-slate-800 flex items-center justify-between font-bold text-white text-xs">
                      <span>1ヶ月定期支給合計額:</span>
                      <span className="text-cyan-400 font-black text-sm">¥{commuteTotals.totalOneMonthPass.toLocaleString()} /月</span>
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-emerald-400 pt-0.5">
                  {commutingData.passPhoto ? '📷 定期券・運賃スクショ写真を添付済' : '※ 運賃写真は任意'}
                </div>
              </div>
            </div>

            {/* 3. 給与振込口座届 */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  3. 給与振込口座
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="bg-slate-800 hover:bg-slate-700 text-blue-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> 修正する
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-400">金融機関:</span> <span className="font-bold text-white">{bankData.bankName || '未登録'}</span></div>
                <div><span className="text-slate-400">支店名:</span> <span className="font-bold text-white">{bankData.branchName || '未登録'}</span></div>
                <div><span className="text-slate-400">種別 / 口座番号:</span> <span className="font-bold text-white">{bankData.accountType === 'ordinary' ? '普通' : '当座'} {bankData.accountNumber || '未登録'}</span></div>
                <div><span className="text-slate-400">口座名義人:</span> <span className="font-bold text-white">{bankData.accountHolder || basicData.name}</span></div>
                <div className="col-span-2 text-[10px] text-emerald-400 pt-0.5">
                  {bankData.passbookPhoto ? '📷 通帳・キャッシュカード写真を添付済' : '※ 通帳写真は任意'}
                </div>
              </div>
            </div>

            {/* 4. 扶養控除等申告書 */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  4. 令和8年分 扶養控除等申告書
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> 修正する
                </button>
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div>
                  <span className="text-slate-400">配偶者控除:</span>{' '}
                  <span className="font-bold text-white">
                    {taxData.hasSpouse ? `あり (${taxData.spouseName} 殿 / 所得見積: ¥${(taxData.spouseIncomeEstimate || 0).toLocaleString()})` : 'なし'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">扶養親族 ({taxData.dependents.length}名):</span>{' '}
                  <span className="font-bold text-white">
                    {taxData.dependents.length === 0 ? 'なし' : taxData.dependents.map(d => `${d.name} (${d.relation})`).join('、 ')}
                  </span>
                </div>
                {(taxData.isDisability || taxData.isSingleParent || taxData.isWidow || taxData.isWorkingStudent) && (
                  <div className="text-[10px] text-amber-400">
                    特別控除該当: {taxData.isDisability ? '【障害者】' : ''} {taxData.isSingleParent ? '【ひとり親】' : ''} {taxData.isWidow ? '【寡婦】' : ''} {taxData.isWorkingStudent ? '【勤労学生】' : ''}
                  </div>
                )}
              </div>
            </div>

            {/* 5. マイナンバー ＆ 社保届 */}
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-400" />
                  5. マイナンバー・社会保険届
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="bg-slate-800 hover:bg-slate-700 text-purple-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" /> 修正する
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-400">マイナンバー:</span> <span className="font-bold text-white">{officialDocsData.myNumber ? `************${officialDocsData.myNumber.slice(-4)}` : '書類添付で確認'}</span></div>
                <div><span className="text-slate-400">年金番号:</span> <span className="text-white">{officialDocsData.pensionNumber || '未入力'}</span></div>
                <div><span className="text-slate-400">雇用保険番号:</span> <span className="text-white">{officialDocsData.employmentInsuranceNumber || '未入力'}</span></div>
                <div className="text-[10px] text-emerald-400">
                  {officialDocsData.myNumberCardPhoto ? '📷 番号確認写真を添付済' : '※ 写真添付あり'}
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

          {currentStep < 7 ? (
            <button
              onClick={() => {
                if (currentStep === 1 && !contractAgreement.isAgreed) {
                  alert('雇用契約内容の確認チェックボックスにチェックを入れてください。');
                  return;
                }
                if (currentStep === 2 && !basicData.name.trim()) {
                  alert('お名前を入力してください。');
                  return;
                }
                setCurrentStep((currentStep + 1) as any);
              }}
              className="flex-1 max-w-[220px] ml-auto py-3 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-1 cursor-pointer"
            >
              {currentStep === 6 ? '最終確認シートへ' : '次へ進む'}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmitAll}
              disabled={isSubmitting}
              className="flex-1 max-w-[280px] ml-auto py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              すべての公的書類を会社へ送信する
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
