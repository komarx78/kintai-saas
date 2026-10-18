import { useEffect, useState } from 'react';
import {
  Lock,
  CreditCard,
  Check,
  CheckCircle2,
  ExternalLink,
  Building2,
  ArrowLeft,
  Sparkles,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SAAS_PLANS, type SaasPlanType } from '../lib/subscriptionBilling';
import {
  type LineIntegrationConfig,
  type LineIntegrationMode,
  getTenantLineConfig,
  fetchTenantLineConfigFromDb,
  saveTenantLineConfigUnified,
  RAKUMARU_OFFICIAL_LINE_CONSTANTS
} from '../lib/lineMessaging';

export default function TrialEnded() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [role, setRole] = useState<'superadmin' | 'admin' | 'user'>('admin');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('ご契約企業');
  const [userCount, setUserCount] = useState<number>(1);
  const [selectedPlan, setSelectedPlan] = useState<Exclude<SaasPlanType, 'trial'>>('full_advance');
  const [lineConfig, setLineConfig] = useState<LineIntegrationConfig>(() => getTenantLineConfig(''));
  const [savedSquareUrl, setSavedSquareUrl] = useState<string>('');

  useEffect(() => {
    loadContext();
  }, []);

  const loadContext = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: uData } = await supabase
        .from('users')
        .select('role, tenant_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (uData) {
        setRole((uData.role as any) || 'user');
        const tid = uData.tenant_id;
        setTenantId(tid);

        if (tid) {
          const [tRes, usersRes, dbLine] = await Promise.all([
            supabase.from('tenants').select('name, plan_type, payroll_common_settings').eq('id', tid).maybeSingle(),
            supabase.from('users').select('id, employment_status').eq('tenant_id', tid),
            fetchTenantLineConfigFromDb(tid)
          ]);

          if (tRes.data) {
            if (tRes.data.name) setCompanyName(tRes.data.name);
            const savedPlan =
              tRes.data.payroll_common_settings?.selected_saas_plan ||
              localStorage.getItem(`selected_saas_plan_${tid}`) ||
              tRes.data.plan_type;
            if (savedPlan && ['shift_only', 'kintai_only', 'full_advance'].includes(savedPlan)) {
              setSelectedPlan(savedPlan as Exclude<SaasPlanType, 'trial'>);
            }
            const sqUrl =
              tRes.data.payroll_common_settings?.square_checkout_url ||
              localStorage.getItem(`square_checkout_url_${tid}`) ||
              '';
            setSavedSquareUrl(sqUrl);
          }

          if (usersRes.data) {
            const activeUsers = usersRes.data.filter(
              (u: any) => u.employment_status !== 'retired' && u.employment_status !== '退職'
            );
            setUserCount(Math.max(1, activeUsers.length));
          }

          if (dbLine) {
            setLineConfig(dbLine);
          }
        }
      }
    } catch (e) {
      console.error('TrialEnded load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLineMode = async (mode: LineIntegrationMode) => {
    const nextCfg: LineIntegrationConfig = {
      ...lineConfig,
      mode,
      updatedAt: new Date().toISOString()
    };
    setLineConfig(nextCfg);
    if (tenantId) {
      await saveTenantLineConfigUnified(tenantId, nextCfg);
    }
  };

  // ⚡ プラン確定 ＆ Square決済画面へ直行（ロック即時解除）
  const handleProceedToPaymentAndUnlock = async () => {
    const tid = tenantId || localStorage.getItem('current_tenant_id');
    const planMeta = SAAS_PLANS[selectedPlan];
    const lineFee = lineConfig.mode === 'rakumaru_official' ? 3000 : 0;

    try {
      setIsProcessing(true);

      if (tid) {
        // 1. 選択した有料プランを保存してトライアル終了ロックを即時解除
        localStorage.setItem(`selected_saas_plan_${tid}`, selectedPlan);
        try {
          const { data: curT } = await supabase
            .from('tenants')
            .select('payroll_common_settings')
            .eq('id', tid)
            .maybeSingle();
          await supabase
            .from('tenants')
            .update({
              payroll_common_settings: {
                ...(curT?.payroll_common_settings || {}),
                selected_saas_plan: selectedPlan
              }
            })
            .eq('id', tid);
        } catch (_) {}

        const { error: pErr } = await supabase
          .from('tenants')
          .update({ plan_type: selectedPlan })
          .eq('id', tid);
        if (pErr) {
          await supabase.from('tenants').update({ plan_type: 'paid' }).eq('id', tid);
        }

        // 2. Squareオンライン決済リンクを自動生成して別タブで開く
        const res = await fetch('/api/square-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tid,
            tenantName: companyName,
            planName: planMeta.name,
            unitPrice: planMeta.unitPriceMonthly,
            userCount,
            lineOptionFee: lineFee,
            lineOptionName: '公式LINE代行配信オプション（月額）',
            redirectUrl: `${window.location.origin}/settings/company?tenant_id=${tid}&tab=billing`
          })
        });

        const data = await res.json();
        if (res.ok && data.success && data.url) {
          localStorage.setItem(`square_checkout_url_${tid}`, data.url);
          window.open(data.url, '_blank', 'noopener,noreferrer');
        } else if (savedSquareUrl) {
          window.open(savedSquareUrl, '_blank', 'noopener,noreferrer');
        }

        // 3. 会社設定の「12. プラン・決済設定」画面へ遷移
        navigate(`/settings/company?tenant_id=${tid}&tab=billing`, { replace: true });
      } else {
        navigate('/settings/company?tab=billing');
      }
    } catch (e: any) {
      alert('移行処理中にエラーが発生しました: ' + (e.message || e));
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs font-bold text-slate-600">契約情報を確認しています...</p>
      </div>
    );
  }

  // 👤 一般従業員（スタッフ・アルバイト）画面：やさしい案内のみ表示
  if (role === 'user') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xl rounded-3xl border border-slate-200 text-center space-y-5">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-amber-100 text-amber-700">
              <Lock className="h-7 w-7" />
            </div>
            <div>
              <span className="text-[11px] font-black px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {companyName}
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-3">
                現在、会社のプラン更新手続き中です
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                1ヶ月の無料トライアル期間が終了いたしました。<br />
                あなたの打刻データやシフト・有給データはすべて安全に保管されていますのでご安心ください。
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-950 text-left space-y-1.5 leading-relaxed">
              <div className="font-black text-amber-900">💡 スタッフの皆様へのお願い</div>
              <p>
                会社の管理者（社長・店長・総務ご担当者）様がプラン選択・お支払い設定を完了されると、すぐに通常どおり打刻・シフト提出ができるようになります。
              </p>
              <p className="font-bold text-amber-800 pt-1">
                お手数ですが、管理者様へ「らくまる労務の本契約移行をお願いします」とお伝えください。
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-xs text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              ログイン画面へ戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 👑 管理者（オーナー・店長）画面：その場でプラン選択＆Square決済・会社設定へ直行可能！
  const activePlanMeta = SAAS_PLANS[selectedPlan];
  const lineMonthlyFee = lineConfig.mode === 'rakumaru_official' ? 3000 : 0;
  const planMonthlyFee = userCount * activePlanMeta.unitPriceMonthly;
  const totalMonthlyFee = planMonthlyFee + lineMonthlyFee;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 py-10 px-4 sm:px-6 lg:px-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ヘッダー案内バナー */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shrink-0">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {companyName} 様（在籍 {userCount} 名）
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    トライアル中の全データは100%保持されています
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                  無料トライアル期間が終了しました — この画面から30秒で本契約へ移行できます
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                  これまで登録された従業員情報・シフト・打刻・給与設定はすべてそのまま引き継がれます。ご希望のプランを選んでお手続きを進めてください。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/settings/company?tenant_id=${tenantId || ''}&tab=billing`)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 self-start md:self-center cursor-pointer border border-slate-300"
            >
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>会社設定の「プラン・決済設定」画面を開く</span>
            </button>
          </div>

          {/* STEP 1: 公式LINE配信オプションの選択 */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black">1</span>
                <span>公式LINE通知オプションを選択（カードをクリック）</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-bold">後からいつでも変更可能</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div
                onClick={() => handleSelectLineMode('rakumaru_official')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  lineConfig.mode === 'rakumaru_official'
                    ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200'
                    : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">🟢 公式代行配信（おすすめ）</span>
                  {lineConfig.mode === 'rakumaru_official' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-600 text-white">選択中</span>
                  )}
                </div>
                <div className="text-sm font-black text-emerald-700 mt-1">月額 ¥3,000 / 社（税込）</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  面倒な設定ゼロで「{RAKUMARU_OFFICIAL_LINE_CONSTANTS.accountName}」からシフト・明細を自動通知。
                </p>
              </div>

              <div
                onClick={() => handleSelectLineMode('own_official')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  lineConfig.mode === 'own_official'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-200'
                    : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">🔵 自社公式LINEを利用</span>
                  {lineConfig.mode === 'own_official' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-600 text-white">選択中</span>
                  )}
                </div>
                <div className="text-sm font-black text-blue-700 mt-1">システム月額 ¥0</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  自社のLINE公式アカウントのAPIトークンを設定して配信します。
                </p>
              </div>

              <div
                onClick={() => handleSelectLineMode('none')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  lineConfig.mode === 'none'
                    ? 'bg-amber-50/70 border-amber-500 ring-2 ring-amber-200'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">⚪ LINE通知を利用しない</span>
                  {lineConfig.mode === 'none' && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-700 text-white">選択中</span>
                  )}
                </div>
                <div className="text-sm font-black text-slate-600 mt-1">追加料金 ¥0</div>
                <p className="text-[11px] text-slate-500 mt-1">
                  LINE連携は使わず、スタッフのWebマイページのみで確認します。
                </p>
              </div>
            </div>
          </div>

          {/* STEP 2: 3大基本プランの選択 */}
          <div className="mt-7">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-black">2</span>
                <span>ご希望の基本プランを選択（在籍 {userCount} 名で自動計算）</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-bold">初期費用0円・年間縛りなし</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['shift_only', 'kintai_only', 'full_advance'] as const).map(planKey => {
                const plan = SAAS_PLANS[planKey];
                const isSelected = selectedPlan === planKey;
                const isFull = planKey === 'full_advance';
                const monthlySub = userCount * plan.unitPriceMonthly;

                return (
                  <div
                    key={planKey}
                    onClick={() => setSelectedPlan(planKey)}
                    className={`rounded-2xl p-5 border-2 cursor-pointer transition-all flex flex-col justify-between relative ${
                      isSelected
                        ? isFull
                          ? 'bg-gradient-to-b from-amber-50/80 via-white to-indigo-50/50 border-amber-500 ring-2 ring-amber-300 shadow-md'
                          : 'bg-indigo-50/40 border-indigo-600 ring-2 ring-indigo-200 shadow-md'
                        : 'bg-white border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {isFull && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-[10px] font-black px-3 py-0.5 rounded-bl-xl">
                        一番人気 ★ セットでお得
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {plan.badge}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-600 text-white">
                            ✓ 選択中
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-slate-900 mt-2">{plan.name}</h4>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        {isFull && <span className="text-xs text-slate-400 line-through font-bold">¥600</span>}
                        <span className="text-2xl font-black text-indigo-700">¥{plan.unitPriceMonthly.toLocaleString()}</span>
                        <span className="text-xs text-slate-500 font-bold">/名・月（税込）</span>
                      </div>
                      <div className="text-xs font-bold text-slate-700 mt-1">
                        貴社（{userCount}名）: ¥{monthlySub.toLocaleString()} / 月
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        {plan.features.slice(0, 4).map((f, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                            {isFull ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                            )}
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div
                        className={`w-full py-2 rounded-xl text-xs font-black text-center transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? '✅ このプランを選択中' : 'このプランを選ぶ'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 3: 料金内訳とワンクリックSquare決済＆ロック解除ボタン */}
          <div className="mt-7 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 text-xs flex items-center justify-center font-black">3</span>
                <span className="text-sm font-black text-amber-300">お支払い内訳の確認と手続き開始</span>
              </div>
              <div className="text-xs text-slate-300 leading-relaxed pl-8">
                ・基本プラン（{activePlanMeta.name}）：¥{activePlanMeta.unitPriceMonthly.toLocaleString()} × {userCount}名 ＝ <strong>¥{planMonthlyFee.toLocaleString()}/月</strong><br />
                ・公式LINE配信オプション（{lineConfig.mode === 'rakumaru_official' ? '公式代行配信' : lineConfig.mode === 'own_official' ? '自社公式LINE' : '利用しない'}）：<strong>¥{lineMonthlyFee.toLocaleString()}/月</strong>
              </div>
              <div className="pl-8 pt-1 flex items-baseline gap-2">
                <span className="text-xs text-slate-400 font-bold">月額合計（税込）：</span>
                <span className="text-2xl font-black text-amber-300">¥{totalMonthlyFee.toLocaleString()}</span>
                <span className="text-xs text-slate-400">/ 月</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleProceedToPaymentAndUnlock}
                className="px-6 py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 font-black text-sm rounded-2xl shadow-lg transition transform hover:scale-[1.02] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>決済画面を準備中...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 text-slate-950" />
                    <span>⚡ このプランでSquare決済へ進む（即時利用再開）</span>
                    <ExternalLink className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* フッター補助リンク */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ログイン画面へ戻る</span>
            </button>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(`/settings/company?tenant_id=${tenantId || ''}&tab=billing`)}
                className="font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                会社設定の「12. プラン・決済設定」画面で詳細を見る ➔
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
