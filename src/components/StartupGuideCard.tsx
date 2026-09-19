import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, 
  Network, 
  Calendar, 
  Users, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  HelpCircle,
  FileSpreadsheet,
  ExternalLink,
  X,
  Clock,
  Smartphone,
  Copy,
  Check,
  QrCode,
  MessageSquare
} from 'lucide-react';

interface StartupGuideCardProps {
  tenantId?: string | null;
  basicInfo: {
    name: string;
    representative_name: string;
    address: string;
    phone_number?: string;
    company_seal_url?: string;
  };
  departments: Array<{ id: string; name: string }>;
  payrollSettings: {
    closing_day?: number | string;
    payment_day?: number | string;
  };
  calendarSettings: {
    fixed_holidays?: number[];
    annual_holidays_count?: number;
    holiday_text_summary?: string;
  };
  companyUsers: Array<{ id: string; name: string; role?: string; department?: string }>;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  onOpenCsvImport: () => void;
  onOpenManualAdd?: () => void;
  onNavigateToOnboarding: () => void;
}

export const StartupGuideCard: React.FC<StartupGuideCardProps> = ({
  tenantId,
  basicInfo,
  departments,
  payrollSettings,
  calendarSettings,
  companyUsers,
  activeTab,
  onSelectTab,
  onOpenCsvImport,
  onOpenManualAdd,
  onNavigateToOnboarding
}) => {
  // 初期状態は開いた状態（LocalStorageで開閉状態を記憶）
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('startup_guide_is_open');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteTab, setInviteTab] = useState<'kintai' | 'onboarding'>('kintai');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 3000);
  };

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      localStorage.setItem('startup_guide_is_open', JSON.stringify(next));
    } catch (_) {}
  };

  // 1. 各ステップの完了状況を実データからリアルタイム厳格判定（憲法1条・憲法2条）
  // STEP 1: 会社名と代表者名の入力
  const isStep1Done = Boolean(basicInfo.name?.trim() && basicInfo.representative_name?.trim());

  // STEP 2: 会社の休日規程・就業時間・締め日が実際に保存・確認されたか（【最初】に確定させる最重要労働条件の土台）
  // （※初期値や会社基本情報保存による誤判定を完全排除。社長様がカレンダー・給与タブで明示的に保存した実績のみで判定）
  const isStep2Saved = Boolean(
    tenantId && localStorage.getItem(`step3_calendar_payroll_explicitly_saved_${tenantId}`) === 'true'
  );
  const isStep2Done = isStep2Saved;

  // STEP 3: 組織・部署（店舗）が1件以上登録されているか
  const isStep3Done = departments.length > 0;

  // STEP 4: 管理者（admin/superadmin/代表）以外の「一般社員・パートさん」が実際に1名以上登録されているか
  // （※初期アカウントやテスト用管理者の存在による誤判定を完全遮断）
  const generalEmployees = companyUsers.filter(u => {
    const r = (u.role || '').toLowerCase();
    const name = (u.name || '').trim();
    const isOwnerOrAdmin = r === 'admin' || r === 'superadmin' || name.includes('代表') || (basicInfo.representative_name && name === basicInfo.representative_name.trim());
    return !isOwnerOrAdmin;
  });

  // テスト用データ（「福留 太郎」「テスト」「サンプル」等）は本番登録とみなさない
  const realEmployees = generalEmployees.filter(u => {
    const name = (u.name || '').trim();
    const isTestData = name.includes('福留') || name.includes('テスト') || name.includes('サンプル') || name.toLowerCase().includes('test');
    return !isTestData;
  });

  // 本番の一般社員・パートさんが1名以上登録されていればSTEP 4完了
  const isStep4Done = realEmployees.length > 0;

  // STEP 5: スタッフへ案内済み、またはタイムカード打刻が開始されているか
  // （※準備完了なだけで勝手に「設定済み」には絶対にしない！）
  const isStep5Ready = isStep1Done && isStep2Done && isStep3Done && isStep4Done;
  const isStep5Done = Boolean(
    tenantId && (
      localStorage.getItem(`staff_invitation_sent_${tenantId}`) === 'true' ||
      localStorage.getItem(`kintai_started_${tenantId}`) === 'true'
    )
  );

  const completedCount = [isStep1Done, isStep2Done, isStep3Done, isStep4Done, isStep5Done].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 5) * 100);

  // STEP 4 の現状サマリー文言（テスト社員の存在も明示して社長様が混乱しないよう配慮）
  let step4Summary = '未登録（0名）';
  if (realEmployees.length > 0) {
    const names = realEmployees.slice(0, 2).map(u => u.name).join('、');
    step4Summary = `登録完了: ${realEmployees.length}名（${names}${realEmployees.length > 2 ? ' 他' : ''}）`;
  } else if (generalEmployees.length > 0) {
    const names = generalEmployees.slice(0, 2).map(u => u.name).join('、');
    step4Summary = `テスト用社員のみ: ${generalEmployees.length}名（${names}）※本番社員の登録が必要です`;
  }

  const steps = [
    {
      stepNumber: 1,
      title: '会社名・社長のお名前・社判の登録',
      desc: '給与明細や雇用契約書の「発行元」に印刷される会社の基本情報を入力します。社判はワンクリックで自動作成もできます。',
      targetTab: 'basic',
      icon: Building2,
      isDone: isStep1Done,
      actionText: isStep1Done ? '会社情報を確認・変更' : '会社情報を入力する',
      doneSummary: basicInfo.name ? `登録済み: ${basicInfo.name}` : '未登録'
    },
    {
      stepNumber: 2,
      title: '会社の休日規程・就業時間・給与締め日の設定',
      desc: '「土日祝休み」等の会社カレンダー、所定勤務時間（標準9:00〜18:00等）、給与の締め日（月末締・翌月25日払等）を設定します。',
      targetTab: 'calendar',
      icon: Calendar,
      isDone: isStep2Done,
      actionText: isStep2Done ? '休日・時間・締め日を確認' : '休日・時間・締め日を設定する',
      doneSummary: isStep2Done 
        ? (payrollSettings.closing_day 
            ? `設定済み: ${payrollSettings.closing_day}日締 / 年間休日${calendarSettings.annual_holidays_count || 125}日` 
            : '設定済み') 
        : '未設定（確認・保存してください）'
    },
    {
      stepNumber: 3,
      title: '組織・部署（店舗）や役職の登録',
      desc: '自社にある「営業部」「工事部」「店舗」「主任」などを登録します。（STEP 2で設定した就業時間帯が各部署へ自動連動します）',
      targetTab: 'departments',
      icon: Network,
      isDone: isStep3Done,
      actionText: isStep3Done ? '部署・役職を確認・変更' : '部署・役職を追加する',
      doneSummary: isStep3Done ? `登録数: ${departments.length} 部署` : '未登録（0部署）'
    },
    {
      stepNumber: 4,
      title: '社員さん・パートさんの登録（入退社労務台帳）',
      desc: 'スタッフの基本台帳登録・契約書作成は「入退社・労務書類管理システム」で行います。エクセル(CSV)一括取り込み、または手動追加が可能です。',
      notice: '※ボタンを押すと「入退社・労務書類管理システム」へ安全に移動します（登録完了後、この画面に戻れます）',
      targetTab: 'onboarding_admin',
      icon: Users,
      isDone: isStep4Done,
      actionText: isStep4Done ? '労務台帳を確認・追加' : '労務台帳で登録する',
      doneSummary: step4Summary
    },
    {
      stepNumber: 5,
      title: 'スタッフへ案内してタイムカード開始！',
      desc: 'スタッフに「招待URL」を送るか、管理者画面からタイムカード打刻をスタートします。スマホから自分の給与明細も見られます。',
      targetTab: 'onboarding_nav',
      icon: Send,
      isDone: isStep5Done,
      isReady: isStep5Ready,
      actionText: isStep5Done ? '案内文・招待URLを確認' : (isStep5Ready ? '招待URL・案内文を送る（準備完了）' : '社員台帳・案内へ進む'),
      doneSummary: isStep5Done 
        ? '🎉 運用開始中！' 
        : (isStep5Ready ? '✨ 準備完了！スタッフへ案内できます' : 'STEP 1〜4 の完了をお待ちください')
    }
  ];

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-indigo-50/40 rounded-3xl border-2 border-emerald-300/80 shadow-md p-5 sm:p-7 transition-all">
      {/* 上部ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                🔰 初めての社長・管理者様向け
              </span>
              <span className="text-xs font-bold text-slate-500">
                パソコンが苦手でも大丈夫！
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              🚀 かんたん初期設定スタートガイド（最短10分・5ステップ）
            </h2>
          </div>
        </div>

        {/* ヘッダー右側のアクションボタン */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="手元に置いて見られるチェックシートを印刷"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">手元用</span>A4印刷シート
          </button>
          <button
            onClick={toggleOpen}
            className="px-3.5 py-2 rounded-xl bg-emerald-100/70 hover:bg-emerald-200 text-emerald-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            {isOpen ? (
              <>
                <ChevronUp className="w-4 h-4" />
                折りたたむ
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                ガイドを開く
              </>
            )}
          </button>
        </div>
      </div>

      {/* 進捗ゲージバー（常に表示） */}
      <div className="mt-4 pt-4 border-t border-emerald-200/60">
        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
          <div className="flex items-center gap-1.5 text-slate-800">
            <span>現在の初期設定 完了度:</span>
            <span className="text-emerald-700 font-mono text-base font-black">
              {progressPercent}%
            </span>
            <span className="text-slate-400 font-normal">
              ({completedCount} / 5 ステップ完了)
            </span>
          </div>
          {progressPercent === 100 ? (
            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md text-[11px] font-black flex items-center gap-1">
              🎉 すべての初期設定が完了しています！
            </span>
          ) : (
            <span className="text-slate-500 text-[11px]">
              あと <strong className="text-emerald-700 font-bold">{5 - completedCount}</strong> つ設定すれば今日から使えます！
            </span>
          )}
        </div>
        <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-emerald-200 shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 開閉コンテンツ（5つの大きなステップカード） */}
      {isOpen && (
        <div className="mt-6 space-y-3.5 animate-in fade-in duration-300">
          <div className="bg-white/80 backdrop-blur-xs p-3.5 rounded-2xl border border-emerald-200/60 text-xs text-slate-600 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              この5つのステップを上から順番に進めるだけで、<strong>勤怠打刻・シフト管理・給与計算・入退社手続き</strong>のすべてが自動連動します。右側のボタンを押すと、その設定場所に直接案内されます。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {steps.map((step) => {
              const StepIcon = step.icon;
              const isCurrentTab = activeTab === step.targetTab;

              return (
                <div
                  key={step.stepNumber}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    step.isDone 
                      ? 'bg-white/90 border-emerald-200/80 shadow-2xs' 
                      : 'bg-white border-indigo-200 shadow-sm ring-2 ring-indigo-500/10'
                  }`}
                >
                  {/* 左側: ステップ情報 */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      {step.isDone ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          {step.stepNumber}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-slate-400">
                          STEP {step.stepNumber}
                        </span>
                        <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                          <StepIcon className="w-4 h-4 text-slate-500" />
                          {step.title}
                        </h3>
                        {step.isDone ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md">
                            ✔ 設定済み
                          </span>
                        ) : step.stepNumber === 5 && !step.isReady ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            🔒 STEP 1〜4 完了後に開始
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-md animate-pulse">
                            👉 ここを設定
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {step.desc}
                      </p>
                      {step.notice && (
                        <div className="bg-sky-50 border border-sky-200 rounded-xl px-2.5 py-1 text-[11px] font-bold text-sky-800 flex items-center gap-1.5 w-fit">
                          <ExternalLink className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>{step.notice}</span>
                        </div>
                      )}
                      <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 pt-0.5">
                        <span className="text-slate-600 font-mono">現状:</span>
                        <span>{step.doneSummary}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右側: アクションボタン */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center w-full md:w-auto">
                    {step.stepNumber === 4 ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={onOpenCsvImport}
                          className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          title="入退社・労務書類管理システムへ移動してCSVを一括取り込みします"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>CSVで一括登録</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                        </button>
                        <button
                          onClick={onOpenManualAdd || onNavigateToOnboarding}
                          className="flex-1 sm:flex-none bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                          title="入退社・労務書類管理システムへ移動して手動で社員を追加します"
                        >
                          <span>手動追加</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    ) : step.stepNumber === 5 ? (
                      <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        <button
                          onClick={() => setIsInviteModalOpen(true)}
                          className={`flex-1 sm:flex-none text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                            step.isDone
                              ? 'bg-white hover:bg-slate-50 border border-slate-300 text-slate-700'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                          }`}
                        >
                          <Send className="w-4 h-4" />
                          <span>{step.actionText}</span>
                        </button>
                        {!step.isDone && (step as any).isReady && (
                          <button
                            type="button"
                            onClick={() => {
                              if (tenantId) {
                                localStorage.setItem(`staff_invitation_sent_${tenantId}`, 'true');
                                window.location.reload();
                              }
                            }}
                            className="flex-1 sm:flex-none bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-2.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                            title="スタッフへの案内が完了したらクリックして完了済みにします"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>案内完了にする</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectTab(step.targetTab)}
                        className={`w-full md:w-auto text-xs font-black px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                          isCurrentTab
                            ? 'bg-slate-800 text-white ring-2 ring-slate-800'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        <span>{step.actionText}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🖨️ A4手元印刷用 初期設定チェックシート モーダル（React Portalでbody直下描画） */}
      {showPrintModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm;
              }
              body * {
                visibility: hidden !important;
              }
              #startup-guide-print-sheet, #startup-guide-print-sheet * {
                visibility: visible !important;
              }
              #startup-guide-print-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                border: none !important;
                box-shadow: none !important;
              }
            }
          `}</style>
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 print:max-w-none print:border-none print:shadow-none print:p-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <div>
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  手元用 A4初期設定チェックシート
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  紙に印刷して、設定した箇所にボールペンでチェックを入れながら進められます。
                </p>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 印刷プレビュー領域 */}
            <div id="startup-guide-print-sheet" className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 text-xs print:bg-white print:border-none print:p-2">
              <div className="text-center pb-3 border-b border-slate-200 print:border-slate-400">
                <h4 className="text-base sm:text-lg font-black text-slate-900">
                  みんなの らくまる労務　導入スタートアップ チェックシート
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  会社名：<span className="font-bold text-slate-800 underline">{basicInfo.name || '＿＿＿＿＿＿＿＿＿＿＿＿'}</span>　／　設定担当者：＿＿＿＿＿＿＿＿
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                  <span className="w-6 h-6 border-2 border-slate-500 rounded-md shrink-0 flex items-center justify-center font-bold text-sm">
                    {isStep1Done ? '✔' : ''}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">STEP 1: 会社基本情報・社判の登録</strong>
                      {isStep1Done && <span className="text-emerald-700 font-bold text-[10px]">【設定済】</span>}
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">会社名、本社所在地、代表者氏名、電話番号を入力。角印画像を登録（または自動作成）。</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                  <span className="w-6 h-6 border-2 border-slate-500 rounded-md shrink-0 flex items-center justify-center font-bold text-sm">
                    {isStep2Done ? '✔' : ''}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">STEP 2: 会社休日規程・就業時間・給与締め日の設定</strong>
                      {isStep2Done && <span className="text-emerald-700 font-bold text-[10px]">【設定済】</span>}
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">会社の休日カレンダー（土日祝・年間休日）、所定勤務時間（9:00〜18:00等）、給与締め日を設定。</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                  <span className="w-6 h-6 border-2 border-slate-500 rounded-md shrink-0 flex items-center justify-center font-bold text-sm">
                    {isStep3Done ? '✔' : ''}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">STEP 3: 組織・部署（店舗）・役職マスタの確認</strong>
                      {isStep3Done && <span className="text-emerald-700 font-bold text-[10px]">【設定済: {departments.length}部署】</span>}
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">自社にある部署（営業部、店舗部など）と役職（主任、店長など）を登録・調整。</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                  <span className="w-6 h-6 border-2 border-slate-500 rounded-md shrink-0 flex items-center justify-center font-bold text-sm">
                    {isStep4Done ? '✔' : ''}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">STEP 4: 社員・パートの名簿登録（入退社労務台帳）</strong>
                      {isStep4Done && <span className="text-emerald-700 font-bold text-[10px]">【設定済: {companyUsers.length}名】</span>}
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">「入退社・労務書類管理システム」でCSV一括取り込み、または手動でスタッフ情報を登録。</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200 print:border-slate-300">
                  <span className="w-6 h-6 border-2 border-slate-500 rounded-md shrink-0 flex items-center justify-center font-bold text-sm">
                    {isStep5Done ? '✔' : ''}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">STEP 5: 招待リンクの発行・運用開始！</strong>
                      {isStep5Done && <span className="text-emerald-700 font-bold text-[10px]">【準備完了】</span>}
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">招待URLをスタッフに共有し、各自のスマホから打刻や給与明細の閲覧をスタート。</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] print:bg-white print:border-slate-300">
                💡 <strong>ワンポイントアドバイス:</strong><br />
                最初は完璧に入力しなくても、後からいつでも変更・修正できます。まずは会社名と社員さんを数名登録して、タイムカード打刻を試してみましょう！
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 print:hidden">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                印刷する（またはPDF保存）
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🚀 スタッフ案内 ＆ 招待URL一発送信モーダル */}
      {isInviteModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-8 space-y-5 animate-in fade-in zoom-in duration-200">
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    スタッフへ案内する（招待URL ＆ LINE送信）
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    スタッフにURLを送信して、タイムカード打刻や入社手続きを開始します。
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 用途別タブ切替 */}
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setInviteTab('kintai')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  inviteTab === 'kintai'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>① 明日から打刻（タイムカード案内）</span>
              </button>
              <button
                type="button"
                onClick={() => setInviteTab('onboarding')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  inviteTab === 'onboarding'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>② 新入社員の書類提出（入社手続きURL）</span>
              </button>
            </div>

            {/* タブ①: タイムカード打刻案内 */}
            {inviteTab === 'kintai' && (
              <div className="space-y-4">
                <div className="bg-indigo-50/80 p-4 rounded-2xl border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" />
                      スタッフ用 タイムカード打刻URL
                    </span>
                    <span className="text-[10px] bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded font-bold">
                      スマホ・PC両対応
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/kintai/user`}
                      className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-mono text-indigo-950 select-all font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(`${window.location.origin}/kintai/user`, 'kintai-url')}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                    >
                      {copiedType === 'kintai-url' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedType === 'kintai-url' ? 'コピー済' : 'URLコピー'}</span>
                    </button>
                  </div>
                </div>

                {/* LINE・メール貼り付け用定型文 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      LINEやメールにそのまま貼り付けられる案内文:
                    </label>
                    <span className="text-[10px] text-slate-400">ワンクリックで全選択コピー</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap select-all">
{`【勤怠打刻システムのご案内】
${basicInfo.name || '会社'} のスタッフの皆様へ

明日からのタイムカード打刻は、以下のURLから行えます。
スマホのブラウザで開いてログインしてください。

▼ タイムカード打刻・マイページURL
${window.location.origin}/kintai/user

💡【スマホでアプリのように使う方法】
URLを開いた後、スマホ画面のメニューから「ホーム画面に追加」をしておくと、アプリのようにワンタップで打刻できます！
自分の給与明細や有給休暇の残日数もここから確認できます。
よろしくお願いいたします。`}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(`【勤怠打刻システムのご案内】\n${basicInfo.name || '会社'} のスタッフの皆様へ\n\n明日からのタイムカード打刻は、以下のURLから行えます。\nスマホのブラウザで開いてログインしてください。\n\n▼ タイムカード打刻・マイページURL\n${window.location.origin}/kintai/user\n\n💡【スマホでアプリのように使う方法】\nURLを開いた後、スマホ画面のメニューから「ホーム画面に追加」をしておくと、アプリのようにワンタップで打刻できます！\n自分の給与明細や有給休暇の残日数もここから確認できます。\nよろしくお願いいたします。`, 'kintai-msg')}
                    className={`w-full py-2.5 px-4 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      copiedType === 'kintai-msg'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                    }`}
                  >
                    {copiedType === 'kintai-msg' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-200" />
                        <span>✔ LINE用案内メッセージを丸ごとコピーしました！</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>📋 LINE用案内メッセージを丸ごとコピーする</span>
                      </>
                    )}
                  </button>
                </div>

                {/* QRコード表示（目の前のスタッフ用） */}
                <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs shrink-0 flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`${window.location.origin}/kintai/user`)}`}
                      alt="タイムカード打刻QRコード"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="space-y-1 text-xs">
                    <span className="font-black text-slate-800 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                      目の前のスタッフに読み取ってもらう場合
                    </span>
                    <p className="text-slate-500 text-[11px] leading-snug">
                      スタッフのスマホのカメラでこのQRコードを読み取ってもらうと、1秒で打刻画面を開けます。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* タブ②: 新入社員の書類提出案内 */}
            {inviteTab === 'onboarding' && (
              <div className="space-y-4">
                <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-600" />
                      新入社員用 スマホ入社書類提出URL
                    </span>
                    <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded font-bold">
                      通帳・マイナンバー撮影対応
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/onboarding/welcome${tenantId ? `?tenant_id=${tenantId}` : ''}`}
                      className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-mono text-emerald-950 select-all font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(`${window.location.origin}/onboarding/welcome${tenantId ? `?tenant_id=${tenantId}` : ''}`, 'onb-url')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                    >
                      {copiedType === 'onb-url' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedType === 'onb-url' ? 'コピー済' : 'URLコピー'}</span>
                    </button>
                  </div>
                </div>

                {/* LINE貼り付け用定型文 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      LINEやメールにそのまま貼り付けられる入社案内文:
                    </label>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap select-all">
{`【入社手続きのご案内】
${basicInfo.name || '会社'} へようこそ！

入社に伴う書類提出・基本情報登録は、以下の専用URLからスマホで行えます。
（給与振込口座の通帳写真やマイナンバーをスマホカメラで撮影してそのまま送信できます）

▼ 新入社員 入社手続き専用URL
${window.location.origin}/onboarding/welcome${tenantId ? `?tenant_id=${tenantId}` : ''}

ご不明な点がございましたら担当までお気軽にお尋ねください。
よろしくお願いいたします。`}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(`【入社手続きのご案内】\n${basicInfo.name || '会社'} へようこそ！\n\n入社に伴う書類提出・基本情報登録は、以下の専用URLからスマホで行えます。\n（給与振込口座の通帳写真やマイナンバーをスマホカメラで撮影してそのまま送信できます）\n\n▼ 新入社員 入社手続き専用URL\n${window.location.origin}/onboarding/welcome${tenantId ? `?tenant_id=${tenantId}` : ''}\n\nご不明な点がございましたら担当までお気軽にお尋ねください。\nよろしくお願いいたします。`, 'onb-msg')}
                    className={`w-full py-2.5 px-4 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                      copiedType === 'onb-msg'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                    }`}
                  >
                    {copiedType === 'onb-msg' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-200" />
                        <span>✔ 入社案内メッセージを丸ごとコピーしました！</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>📋 入社案内メッセージを丸ごとコピーする</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      onNavigateToOnboarding();
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>※ 個別社員ごとの給与設定付き専用URLを発行したい場合はこちら（労務管理画面へ）</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* モーダルフッター */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                LINE等でスタッフへ案内を送信したら、右側の「案内完了」を押してください
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  閉じる
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (tenantId) {
                      localStorage.setItem(`staff_invitation_sent_${tenantId}`, 'true');
                    }
                    setIsInviteModalOpen(false);
                    window.location.reload();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>スタッフ案内完了（初期設定100%達成）</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
export default StartupGuideCard;
