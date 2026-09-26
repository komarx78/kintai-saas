import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  CheckCircle2, ArrowRight, ShieldCheck, Sparkles,
  Calendar, Clock, DollarSign, TrendingDown,
  UserPlus, ChevronDown, ChevronUp, FileCheck
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  // 料金シミュレーター State
  const [employeeCount, setEmployeeCount] = useState<number>(10);

  // よくある質問 Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  // 計算ロジック
  const ourPriceMonthly = employeeCount * 300;
  const competitorPriceMonthly = employeeCount * 1500; // 他社平均（労務600+勤怠400+給与500）
  const monthlySavings = competitorPriceMonthly - ourPriceMonthly;
  const yearlySavings = monthlySavings * 12;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* ─── 1. 安心のトップ案内バー ─── */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-600 to-blue-700 text-white py-2 px-4 text-center text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-2">
        <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">注目</span>
        <span>中小企業・店舗のための人事労務クラウド！初期費用0円・最低利用料なし・1人月額300円</span>
      </div>

      {/* ─── 2. クリーン＆ホワイト ヘッダー ─── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-blue-500/20">
              らく
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">みんなの らくまる労務</span>
                <span className="bg-sky-100 text-sky-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-sky-200">
                  中小零細企業 応援モデル
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">操作が「楽」に、労務が「丸ごと」解決する人事労務クラウド</p>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-7 text-sm font-bold text-slate-600">
            <a href="#problems" className="hover:text-blue-600 transition-colors">お悩み解決</a>
            <a href="#features" className="hover:text-blue-600 transition-colors">充実の機能</a>
            <a href="#comparison" className="hover:text-blue-600 transition-colors">他社との違い</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">料金シミュレーター</a>
            <a href="#story" className="hover:text-blue-600 transition-colors">名前の由来</a>
            <a href="#reasons" className="hover:text-blue-600 transition-colors">安さの秘密</a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">よくある質問</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              ログイン
            </button>
            <button
              onClick={() => navigate('/?mode=signup')}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg shadow-orange-500/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>14日間 無料体験</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── 3. 圧倒的安心感のファーストビュー（FV） ─── */}
      <section className="relative bg-gradient-to-b from-sky-50/70 via-white to-slate-50 pt-10 pb-16 sm:pt-16 sm:pb-24 overflow-hidden border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* 左カラム：キャッチコピーと行動喚起 */}
            <div className="lg:col-span-7 text-center lg:text-left">
              {/* 安心バッジ */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 text-sky-800 text-xs sm:text-sm font-bold border border-sky-200 mb-5 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>現場も、総務も、経営者も。関わる「みんな」が幸せになる人事労務</span>
              </div>

              {/* メインタイトル */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight sm:leading-snug tracking-tight mb-5">
                みんなの操作が<span className="text-blue-600 underline decoration-amber-400 decoration-4 underline-offset-4">「楽（らく）」</span>になる。<br />
                出退勤・給与から役所原本まで<br />
                <span className="text-blue-600 underline decoration-amber-400 decoration-4 underline-offset-4">「丸（まる）ごと」</span>解決。
              </h1>

              {/* サブコピー */}
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed mb-8 max-w-2xl mx-auto lg:mx-0">
                現場スタッフはスマホで1秒、とことん「楽」ちんに。<br className="hidden sm:inline" />
                社長や総務の手書き転記や役所書類は、これ1つで「丸ごと」繋がります。<br />
                大手のような高額な固定費で縛るのではなく、<strong className="text-slate-900 font-bold bg-amber-100 px-1.5 py-0.5 rounded text-blue-700">みんなに使ってほしいから【1人月額300円・最低利用料ゼロ】</strong>の応援価格でお届けします。
              </p>

              {/* CTAボタン群 */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-8">
                <button
                  onClick={() => navigate('/?mode=signup')}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white"
                >
                  <span>14日間 無料で試してみる</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <a
                  href="#pricing"
                  className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-slate-100 text-slate-700 font-bold text-base rounded-2xl border-2 border-slate-300 shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <span>料金シミュレーションを見る</span>
                  <TrendingDown className="w-4 h-4 text-blue-600" />
                </a>
              </div>

              {/* 安心の4大保証 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto lg:mx-0 text-left">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">初期費用 0円</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">最低縛り なし</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">クレカ不要</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">24h AI相談付</span>
                </div>
              </div>
            </div>

            {/* 右カラム：安心感のあるプロダクト画面ビジュアル */}
            <div className="lg:col-span-5 relative">
              <div className="bg-white rounded-3xl p-5 shadow-2xl border border-slate-200/80 relative z-10">
                {/* 画面プレビューヘッダー */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-400" />
                    <span className="w-3 h-3 rounded-full bg-amber-400" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold text-slate-700 ml-1">みんなの らくまる労務 ダッシュボード</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    稼働中
                  </span>
                </div>

                {/* モック画面のメイン要素 */}
                <div className="space-y-3 text-xs">
                  {/* 今月のサマリーカード */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100 text-center">
                      <div className="text-[10px] text-sky-700">今月の出勤日数</div>
                      <div className="text-base font-black text-sky-900">21 日</div>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-center">
                      <div className="text-[10px] text-emerald-700">有給取得率</div>
                      <div className="text-base font-black text-emerald-900">100%</div>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-center">
                      <div className="text-[10px] text-amber-700">今月の利用料</div>
                      <div className="text-base font-black text-amber-900">¥ 3,000</div>
                    </div>
                  </div>

                  {/* 従業員リストとステータス */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between font-bold text-slate-700 text-[11px]">
                      <span>社員名</span>
                      <span>本日の打刻</span>
                      <span>届出書類原本</span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                      <span className="font-bold">山田 太郎</span>
                      <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded font-bold">08:55 出勤</span>
                      <span className="text-emerald-600 font-bold text-[10px]">A4原本印刷可</span>
                    </div>
                    <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200">
                      <span className="font-bold">佐藤 花子</span>
                      <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold">有給取得中</span>
                      <span className="text-blue-600 font-bold text-[10px]">残数14日</span>
                    </div>
                  </div>

                  {/* 神機能バッジ */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-xl shadow-md flex items-center gap-3">
                    <FileCheck className="w-8 h-8 text-amber-300 shrink-0" />
                    <div>
                      <div className="font-bold text-[11px]">ハローワーク・税務署 提出用A4原本</div>
                      <div className="text-[10px] text-blue-100">離職票・資格取得届・扶養控除申告書を1秒で公式印刷</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 背景の装飾 */}
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl -z-10" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-sky-400/20 rounded-full blur-2xl -z-10" />
            </div>

          </div>
        </div>
      </section>

      {/* ─── 4. お悩み共感（こんなお困りごとはありませんか？） ─── */}
      <section id="problems" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-rose-600 font-extrabold text-xs tracking-wider uppercase bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
              お悩みはありませんか？
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
              中小企業・店舗の社長や総務が<br />
              毎月頭を抱えている「3大ストレス」
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 悩み1 */}
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200/80 hover:border-blue-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-xl mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                紙のタイムカードや打刻忘れ・深夜残業の手計算でミスばかり…
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                月末になるとタイムカードを集めて電卓で集計。押し忘れや二重押しを本人に電話確認し、22時以降の深夜割増（25%）や法定休憩の計算ミスで再計算の繰り返し。
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-bold text-blue-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>スマホ打刻＆給与へ全自動集計！</span>
              </div>
            </div>

            {/* 悩み2 */}
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200/80 hover:border-blue-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-xl mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                「有給あと何日ですか？」の質問攻め ＆ 法定「有給管理簿」の義務漏れ…
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                毎月社員やパートから残日数を口頭で聞かれ、そのたびエクセルを探すだけで時間が消える…さらに全社に義務付けられた「年次有給休暇管理簿の3年保存」を知らず、労基署調査で青ざめる企業が急増中。
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>スマホ自己確認（質問ゼロ）＆管理簿自動作成！</span>
              </div>
            </div>

            {/* 悩み3 */}
            <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200/80 hover:border-blue-400 transition-all shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-xl mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                40歳介護保険料の引き忘れや、退職時の離職票手書き転記…
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                40歳になった従業員の介護保険料天引きを忘れて大トラブルになったり、ハローワークの指定用紙に電卓で基礎日数を手書き計算するなど、専門知識のない総務・社長に重すぎる負担が集中。
              </p>
              <div className="mt-4 pt-3 border-t border-slate-200 text-xs font-bold text-amber-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>40歳自動判定 ＆ 役所原本へジャスト印字！</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. 安心の機能一覧（スッキリ清潔なマルチページ導線） ─── */}
      <section id="features" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-blue-600 font-extrabold text-xs tracking-wider uppercase bg-blue-50 px-3.5 py-1 rounded-full border border-blue-200 shadow-xs">
              充実の機能ラインナップ
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3 tracking-tight">
              中小企業に必要な労務業務を、これ1つで完全網羅
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              大手SaaSなら3社分の契約が必要な機能が、すべてワンストップで繋がります。<br className="hidden sm:inline" />
              気になるカードをクリックすると、<strong className="text-blue-700 font-bold">実際の操作画面プレビューや詳細解説</strong>をご覧いただけます。
            </p>
          </div>

          {/* 6大機能カード（見やすい3列グリッド） */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                id: 'official',
                label: 'ハローワーク・税務署 提出用A4原本印刷',
                category: '行政手続き・公的帳票',
                badge: '★ 圧倒的独自価値（神機能）',
                badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
                icon: FileCheck,
                iconColor: 'bg-amber-100 text-amber-700',
                desc: '離職票や資格取得届、扶養控除申告書をハローワーク・税務署の公式様式に直接ジャスト座標印字。手書き転記作業を完全にゼロにします。',
                points: [
                  '離職票（算定基礎日数を全自動計算）',
                  '雇用保険被保険者資格取得・喪失届',
                  '年末調整 扶養控除等申告書'
                ]
              },
              {
                id: 'kintai',
                label: 'スマホ・PC打刻＆自動集計',
                category: '勤怠管理・タイムレコーダー',
                badge: '現場目線・ミスゼロ',
                badgeColor: 'bg-sky-100 text-sky-900 border-sky-300',
                icon: Clock,
                iconColor: 'bg-sky-100 text-sky-700',
                desc: '現場スタッフは手元のスマホから1タップ打刻。GPS位置情報による不正防止や夜勤対応、月末の残業集計まで全自動化します。',
                points: [
                  'スマホ・PCから迷わないワンタップ打刻',
                  'GPS不正防止＆夜勤・日跨ぎ勤務対応',
                  '月末のタイムカード集計・転記がゼロに'
                ]
              },
              {
                id: 'leave',
                label: '有給の法定自動付与 ＆ 残日数管理',
                category: '有給・休暇管理',
                badge: '労働基準法完全準拠',
                badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                icon: Calendar,
                iconColor: 'bg-emerald-100 text-emerald-700',
                desc: '入社日からの法定日数を自動付与。スタッフはスマホで残日数を自己確認できるため質問ゼロに！義務付けられた「年次有給休暇管理簿」も全自動保存。',
                points: [
                  'スマホで残日数いつでも確認（総務への質問ゼロ！）',
                  '法定「年次有給休暇管理簿」の自動作成＆3年保存',
                  '年5日取得義務アラートで罰則（最大30万円）を防止'
                ]
              },
              {
                id: 'shift',
                label: 'スマホ シフト希望収集＆作成',
                category: 'シフト管理・人員配置',
                badge: '人手不足警告つき',
                badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
                icon: Calendar,
                iconColor: 'bg-purple-100 text-purple-700',
                desc: 'LINEや紙のシフト集めを撤廃。スマホから集まった希望をカレンダーに自動集約し、必要人数に対する過不足を瞬時に可視化します。',
                points: [
                  'スタッフのスマホから希望シフトを自動回収',
                  'カレンダー上で必要人数との過不足を検知',
                  '確定シフトをワンクリックで一斉通知'
                ]
              },
              {
                id: 'payroll',
                label: '給与一括自動計算＆Web給与明細',
                category: '給与計算・明細発行',
                badge: '勤怠直結・ミスゼロ',
                badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
                icon: DollarSign,
                iconColor: 'bg-blue-100 text-blue-700',
                desc: '勤怠データ直結で給与一括計算。生年月日から「40歳介護保険料」を自動判定して天引き漏れを防止し、全国の最新保険料率も自動更新します。',
                points: [
                  '勤怠データ直結で残業・控除を一括自動計算',
                  '生年月日から「40歳介護保険」を自動判定・徴収',
                  '全国最新の社会保険料率がクラウド自動更新'
                ]
              },
              {
                id: 'onboarding',
                label: 'スマホ入社手続き＆電子契約',
                category: '入社労務・電子署名',
                badge: '完全ペーパーレス',
                badgeColor: 'bg-pink-100 text-pink-900 border-pink-300',
                icon: UserPlus,
                iconColor: 'bg-pink-100 text-pink-700',
                desc: '新入社員はスマホで通帳写真や身分証を撮るだけ。雇用契約書・労働条件通知書もスマホ上で電子署名が完結し、大元台帳に自動登録されます。',
                points: [
                  '通帳写真のスマホ送信で口座番号の誤読ミスゼロ',
                  'スマホ電子署名で労働条件通知書を即時交付（労基法15条）',
                  '登録データが勤怠・給与・公的帳票へ自動流動'
                ]
              }
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.id}
                  className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-200/90 hover:border-blue-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative shadow-xs"
                >
                  <div>
                    {/* 上部バッジ ＆ アイコン */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border shadow-2xs ${feature.badgeColor}`}>
                        {feature.badge}
                      </span>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${feature.iconColor} group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    {/* カテゴリ */}
                    <div className="text-xs font-bold text-slate-400 mb-1">
                      {feature.category}
                    </div>

                    {/* タイトル */}
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug mb-3 group-hover:text-blue-600 transition-colors">
                      {feature.label}
                    </h3>

                    {/* 説明文 */}
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                      {feature.desc}
                    </p>

                    {/* ポイント一覧 */}
                    <div className="space-y-2 mb-6 pt-4 border-t border-slate-100 text-xs text-slate-700 font-bold">
                      {feature.points.map((pt, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-tight">{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 遷移ボタン */}
                  <Link
                    to={`/lp/features/${feature.id}`}
                    className="w-full py-3.5 px-4 bg-slate-50 group-hover:bg-blue-600 text-slate-700 group-hover:text-white font-extrabold text-xs sm:text-sm rounded-2xl border border-slate-200 group-hover:border-blue-600 transition-all flex items-center justify-center gap-2 shadow-xs group-hover:shadow-md cursor-pointer"
                  >
                    <span>実際の画面と詳細を見る</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              );
            })}
          </div>

          {/* セクション下部の安心バナー */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 text-amber-300 font-black text-xs mb-1">
                <Sparkles className="w-4 h-4" />
                <span>全機能が使い放題・追加オプション課金なし</span>
              </div>
              <h4 className="text-xl sm:text-2xl font-black">
                これら6つの機能がすべて、1人月額300円に含まれます
              </h4>
              <p className="text-xs sm:text-sm text-blue-200 mt-1">
                大手のように「この機能を使うには追加月額1万円」といった隠れコストは一切ありません。
              </p>
            </div>
            <button
              onClick={() => navigate('/?mode=signup')}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all shrink-0 flex items-center gap-2 cursor-pointer border border-white/20"
            >
              <span>14日間 無料で試してみる</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── 6. 他社徹底比較表（清潔な白基調） ─── */}
      <section id="comparison" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-sky-600 font-extrabold text-xs tracking-wider uppercase bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
              他社との違い
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
              大手SaaSツギハギ契約 vs みんなの らくまる労務
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              別々に3社契約するのと比べ、コストも手間も圧倒的に削減されます。
            </p>
          </div>

          <div className="overflow-x-auto shadow-sm rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="p-4 sm:p-5 font-bold text-slate-700">比較項目</th>
                  <th className="p-4 sm:p-5 font-bold text-slate-500">
                    大手SaaSをバラバラに契約<br />
                    <span className="text-[10px] font-normal">（労務ソフト ＋ 勤怠ソフト ＋ 給与ソフト）</span>
                  </th>
                  <th className="p-4 sm:p-5 font-black text-blue-700 bg-sky-50 border-l-2 border-r-2 border-sky-300">
                    🌈 みんなの らくまる労務<br />
                    <span className="text-[11px] font-normal text-slate-600">（本システム・これ1本で完結）</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800">1人あたりの月額利用料</td>
                  <td className="p-4 sm:p-5 text-rose-600 font-bold">1,300円 〜 2,000円 / 人</td>
                  <td className="p-4 sm:p-5 bg-sky-50/60 border-l-2 border-r-2 border-sky-300 text-blue-700 font-black text-base">
                    300 円 / 人（他社の約1/5！）
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800">最低利用料金（下限縛り）</td>
                  <td className="p-4 sm:p-5 text-slate-500">月額 2万円〜3万円の最低料金あり</td>
                  <td className="p-4 sm:p-5 bg-sky-50/60 border-l-2 border-r-2 border-sky-300 font-bold text-slate-900">
                    完全なし（3名なら月900円）
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800">
                    官公庁A4原本への直接座標印字<br />
                    <span className="text-[10px] font-normal text-slate-500">（離職票・雇用保険届出・扶養控除申告書）</span>
                  </td>
                  <td className="p-4 sm:p-5 text-slate-500">× 不可（CSV出力止まりで結局手書き）</td>
                  <td className="p-4 sm:p-5 bg-sky-50/60 border-l-2 border-r-2 border-sky-300 text-emerald-700 font-bold">
                    ◎ 完全対応（A4原本にそのまま印字）
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800">データの手動転記（二重入力）</td>
                  <td className="p-4 sm:p-5 text-rose-600 font-bold">毎月発生（CSV出力・取り込みの手間）</td>
                  <td className="p-4 sm:p-5 bg-sky-50/60 border-l-2 border-r-2 border-sky-300 text-emerald-700 font-bold">
                    ◎ ゼロ（入社から給与・帳票まで自動流動）
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800">初期費用・契約期間縛り</td>
                  <td className="p-4 sm:p-5 text-slate-500">初期設定費 数万円〜 / 年間契約縛りあり</td>
                  <td className="p-4 sm:p-5 bg-sky-50/60 border-l-2 border-r-2 border-sky-300 font-bold text-slate-900">
                    初期費用0円 / いつでも解約可能
                  </td>
                </tr>
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800">操作やルールのサポート</td>
                  <td className="p-4 sm:p-5 text-slate-500">メール返信待ちに数日かかる</td>
                  <td className="p-4 sm:p-5 bg-sky-50/60 border-l-2 border-r-2 border-sky-300 text-blue-700 font-bold">
                    ◎ 画面右下のAI門番が24時間即答
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── 7. 直感的な料金シミュレーター ─── */}
      <section id="pricing" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-emerald-600 font-extrabold text-xs tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              安心の明朗会計
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
              うちの会社なら月いくら？<br />
              料金 ＆ コスト削減シミュレーター
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              スライダーを左右に動かして、自社の人数に合わせてみてください。
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl">
            {/* スライダー */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-slate-700">従業員数（役員・正社員・パート合計）</span>
                <span className="text-3xl font-black text-blue-600">{employeeCount} <span className="text-sm font-normal text-slate-500">名</span></span>
              </div>
              <input
                type="range"
                min={3}
                max={60}
                step={1}
                value={employeeCount}
                onChange={(e) => setEmployeeCount(Number(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-2">
                <span>3名（極小店舗）</span>
                <span>15名</span>
                <span>30名</span>
                <span>60名</span>
              </div>
            </div>

            {/* 比較カード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center">
                <div className="text-xs text-slate-500 font-bold mb-1">大手SaaSを3社契約した場合</div>
                <div className="text-2xl font-black text-slate-700">
                  ¥ {competitorPriceMonthly.toLocaleString()} <span className="text-xs font-normal">/ 月</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">（1人あたり1,500円換算）</div>
              </div>

              <div className="bg-sky-50 p-5 rounded-2xl border-2 border-blue-500 text-center shadow-md">
                <div className="text-xs text-blue-700 font-bold mb-1">みんなの らくまる労務</div>
                <div className="text-3xl font-black text-blue-700">
                  ¥ {ourPriceMonthly.toLocaleString()} <span className="text-xs font-normal">/ 月</span>
                </div>
                <div className="text-[11px] text-emerald-600 font-bold mt-1">（1人300円・最低基本料なし！）</div>
              </div>
            </div>

            {/* 削減額ハイライト */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-center shadow-lg">
              <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider mb-1">
                年間コスト削減見込み
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight">
                年間 ¥ {yearlySavings.toLocaleString()} のコスト削減！
              </div>
              <p className="text-xs text-emerald-100 mt-2">
                ※さらに、毎月発生していた手書き転記やデータ移し替えの「人件費（数十時間）」も丸ごと浮きます。
              </p>
            </div>
          </div>
        </div>
      </section>

      
      {/* ─── 7.5 私たちが『みんなの らくまる労務』と名付けた理由（ブランドストーリー） ─── */}
      <section id="story" className="py-20 bg-gradient-to-b from-sky-50/50 via-white to-amber-50/30 border-b border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold border border-blue-200 mb-4">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>開発理念とブランドの約束</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-4">
              私たちが<br className="sm:hidden" />
              <span className="text-blue-600 underline decoration-amber-400 decoration-4 underline-offset-4">『みんなの らくまる労務』</span><br className="sm:hidden" />
              と名付けた理由
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              現場スタッフも、総務・奥様も、経営者も。<br className="hidden sm:inline" />
              働くすべての人にストレスのない毎日を届けたいという願いから誕生しました。
            </p>
          </div>

          {/* 3つの名前の由来カード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-14">
            {/* 1. 楽（らく） */}
            <div className="bg-white rounded-3xl p-8 border-2 border-sky-100 shadow-xl shadow-sky-500/5 hover:-translate-y-1 transition-all relative group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-sky-500/30 mb-6">
                楽
              </div>
              <div className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">
                操作がとことん『楽（らく）』になる
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">
                現場スタッフにも、<br />総務にも、一切の我慢なし。
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                「難しくて使えない」システムは絶対に作りたくありませんでした。現場スタッフはLINE感覚・1秒でスマホ打刻。有給の残日数も自分のスマホでいつでも確認できるため、総務への質問攻めもゼロに。覚えるための分厚いマニュアルは1ページも要りません。
              </p>
            </div>

            {/* 2. 丸（まる） */}
            <div className="bg-white rounded-3xl p-8 border-2 border-indigo-100 shadow-xl shadow-indigo-500/5 hover:-translate-y-1 transition-all relative group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6">
                丸
              </div>
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                勤怠から役所原本まで『丸（まる）ごと』
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">
                バラバラのソフトを、<br />これ1つで完全統合。
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                勤怠打刻、有給管理簿、シフト作成、給与計算、さらにハローワークや労基署・年金事務所への提出原本まで、労務のすべてが「丸ごと」ひとつに繋がります。CSVの書き出しや月末の電卓叩き、手書きの二重転記は今月で完全に終わります。
              </p>
            </div>

            {/* 3. みんな */}
            <div className="bg-white rounded-3xl p-8 border-2 border-amber-200 shadow-xl shadow-amber-500/5 hover:-translate-y-1 transition-all relative group bg-gradient-to-b from-white to-amber-50/20">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 mb-6">
                皆
              </div>
              <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
                関わる『みんな』が幸せになる
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-3">
                縛らない。<br />だから「1人月額300円」。
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                「高額な月額基本料金や年間契約で、中小企業を縛りたくない」。関わるみんなに気軽に使ってほしいから、最低月額0円・使った人数分だけの【1人月額300円】にこだわりました。従業員3人なら月900円。中小零細企業を本気で応援する正直な価格です。
              </p>
            </div>
          </div>

          {/* 創業メッセージバナー */}
          <div className="mt-12 bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm text-center max-w-4xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 font-black text-xl">
              🤝
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              「もっと早く出会いたかった」と言っていただけるサービスであり続けるために。
            </h4>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
              創業社長や総務の奥様が、月末になるたびにタイムカードの集計と法律の落とし穴（有給管理簿の保管義務や40歳介護保険の引き忘れ）に怯える日々をなくしたい。<br />
              『みんなの らくまる労務』は、今日も現場の最前線でがんばる日本の会社と、そこに集う「みんな」の味方です。
            </p>
          </div>
        </div>
      </section>

      {/* ─── 8. なぜ1人300円で提供できるのか？（安心の理由） ─── */}
      <section id="reasons" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-amber-600 font-extrabold text-xs tracking-wider uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            安さの秘密
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
            「安すぎて逆に怪しい」と思われた方へ。<br />
            私たちが1人300円で提供できる3つの理由
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 text-left">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold mb-4">
                1
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">テレビCM・Web広告費がゼロ</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                大手企業が毎月数千万円かけている広告宣伝を一切行っていません。知人のご紹介や社労士様・税理士様からの口コミだけで広がっているため、広告費を引いた適正価格でお届けできます。
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold mb-4">
                2
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">サポートをAI門番で無人化</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                操作手順や有給付与の法律ルールは、画面右下の「AIアシスタント」が24時間365日即座に回答。コールセンターの莫大な人件費を削ることで、低価格を維持しています。
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold mb-4">
                3
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">中小零細を救う開発理念</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                「本当に困っている小規模な企業や店舗を応援したい」。創業者の熱い思いから、大手特有の高額な「最低基本料金縛り」を完全に撤廃し、1人から気軽に使える仕組みにしました。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. よくある質問（Accordion形式） ─── */}
      <section id="faq" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-blue-600 font-extrabold text-xs tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              安心のQ&A
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
              よくあるご質問
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: '本当に1人あたり月額300円だけで使えますか？追加費用はありませんか？',
                a: 'はい、一切ございません。初期費用も0円で、従業員3名であれば月額900円、10名であれば月額3,000円です。大手のような「月額最低2万円から」といった縛りも一切ありません。'
              },
              {
                q: 'パソコンや機械の操作が苦手でも使いこなせますか？',
                a: 'ご安心ください。現場のスタッフ様はスマートフォンから「出勤」「退勤」ボタンを押すだけで完了します。また、操作で迷った際は画面右下の「AIアシスタント」に質問すれば、どこを押せばよいか一瞬で丁寧に教えてくれます。'
              },
              {
                q: 'ハローワークや税務署の書類は、本当にそのまま提出できますか？',
                a: 'はい。官公庁が公式に定めているA4様式（離職票・雇用保険被保険者資格取得届・喪失届・扶養控除申告書等）の座標に合わせてジャスト印字されますので、印刷してそのまま提出可能です。'
              },
              {
                q: '無料トライアル期間が終わったら勝手に課金されたりしませんか？',
                a: '自動的に課金されることは絶対にありません。クレジットカードの事前登録も不要です。14日間じっくりとお試しいただき、本当に気に入って継続したい場合のみご契約手続きを行っていただきます。'
              },
              {
                q: '社員やパートから「有給あと何日残ってますか？」と毎月聞かれるのですが、各自で確認できますか？',
                a: 'はい、完全に解決します！スタッフ様の手元のスマートフォンから、現在の有給残日数や直近の有効期限、過去の取得履歴を24時間いつでもリアルタイムに自己確認できます。総務や社長様への問い合わせがゼロになり、本業に集中していただけます。また、法律で企業規模を問わず義務付けられている「年次有給休暇管理簿（法定帳票）」も全自動で作成・3年間クラウド保存されますので、労基署の立ち入り調査対策も万全です。'
              },
              {
                q: '「40歳になった従業員の介護保険料天引き」など、手の回らない細かい労務ルールも自動化されますか？',
                a: 'はい。従業員の生年月日から満40歳到達（介護保険該当）をシステムが完全自動で判定し、該当月から介護保険料の天引きを開始します。また、毎年改定される都道府県別の健康保険・厚生年金・雇用保険の最新料率もクラウド側で自動更新されますので、専門知識がなくても法律違反や天引き漏れをゼロにできます。'
              },
              {
                q: '今使っているExcelの従業員データは移行できますか？',
                a: 'はい、従業員データはExcelやCSVから一括登録が可能です。導入時の初期設定もシンプルに完了できます。'
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left font-bold text-slate-800 text-sm sm:text-base flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-blue-600 font-black">Q.</span>
                    <span>{item.q}</span>
                  </span>
                  {openFaqIndex === idx ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaqIndex === idx && (
                  <div className="p-4 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-start gap-2.5 pt-3">
                      <span className="text-amber-600 font-black">A.</span>
                      <div>{item.a}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 10. 最終クロージング（温かみのあるオレンジCTA） ─── */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-sky-50 to-white text-center border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-4 shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>まずは14日間、完全無料で使いやすさをお確かめください</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-snug mb-4">
            今日から、面倒な労務・勤怠の残業を<br className="hidden sm:inline" />
            ゼロにしませんか？
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
            クレジットカード登録不要。お申し込み後すぐに使い始められます。<br />
            公的帳票の美しいA4原本出力を、ぜひご自身の目でご確認ください。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/?mode=signup')}
              className="w-full sm:w-auto px-10 py-4.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xl rounded-2xl shadow-xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white"
            >
              <span>14日間 無料体験を始める</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-slate-500 mt-6 font-bold">
            <span>✓ クレジットカード不要</span>
            <span>✓ 初期費用 0円</span>
            <span>✓ いつでも解約可能</span>
          </div>
        </div>
      </section>

      {/* ─── 11. フッター ─── */}
      <footer className="py-10 bg-slate-900 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                K
              </div>
              <span className="font-bold text-white text-sm">みんなの らくまる労務</span>
              <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700">
                中小零細企業 応援モデル
              </span>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-6 text-slate-300 font-bold">
              <a href="#problems" className="hover:text-white transition-colors">お悩み解決</a>
              <a href="#features" className="hover:text-white transition-colors">機能一覧</a>
              <a href="#comparison" className="hover:text-white transition-colors">他社比較</a>
              <a href="#pricing" className="hover:text-white transition-colors">料金シミュレーション</a>
              <a href="#reasons" className="hover:text-white transition-colors">安さの理由</a>
              <a href="#faq" className="hover:text-white transition-colors">よくある質問</a>
              <button onClick={() => navigate('/')} className="hover:text-white transition-colors cursor-pointer">ログイン</button>
            </div>
          </div>

          
          {/* 運営会社概要カード */}
          <div className="bg-slate-800/70 rounded-2xl p-6 sm:p-7 border border-slate-700/80 text-slate-300">
            <div className="flex items-center gap-2 mb-4 pb-2.5 border-b border-slate-700/80">
              <span className="text-base">🏢</span>
              <span className="font-bold text-white text-sm tracking-wide">開発・運営会社概要</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3.5 gap-x-8 text-xs leading-relaxed">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-slate-400 font-bold min-w-[90px]">サービス名</span>
                <span className="text-white font-semibold">みんなの らくまる労務</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-slate-400 font-bold min-w-[90px]">開発・運営</span>
                <span className="text-white font-semibold">株式会社cocotte</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-slate-400 font-bold min-w-[90px]">代表者</span>
                <span className="text-slate-200">代表取締役 駒井 秀一朗</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="text-slate-400 font-bold min-w-[90px]">所在地</span>
                <span className="text-slate-200">〒520-0113 滋賀県大津市坂本3丁目21-16</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 md:col-span-2">
                <span className="text-slate-400 font-bold min-w-[90px]">事業内容</span>
                <span className="text-slate-200">クラウド人事労務システムの開発・提供 / 中小企業経営コンサルティング / 業務自動化（DX）ソリューション</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 md:col-span-2">
                <span className="text-slate-400 font-bold min-w-[90px]">お問い合わせ</span>
                <span className="text-sky-400 font-semibold">
                  サポート窓口（ <a href="mailto:info@kap-cocotte.com" className="underline hover:text-sky-300">info@kap-cocotte.com</a> / 専用フォーム ）
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px]">
            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center sm:justify-start">
              <span className="font-bold text-slate-400">機能別詳細：</span>
              <Link to="/lp/features/official" className="hover:text-slate-300">官公庁A4原本印刷</Link>
              <Link to="/lp/features/kintai" className="hover:text-slate-300">勤怠打刻・集計</Link>
              <Link to="/lp/features/leave" className="hover:text-slate-300">有給法定付与</Link>
              <Link to="/lp/features/shift" className="hover:text-slate-300">シフト希望収集</Link>
              <Link to="/lp/features/payroll" className="hover:text-slate-300">給与一括計算</Link>
              <Link to="/lp/features/onboarding" className="hover:text-slate-300">入社手続き・電子契約</Link>
            </div>
            <div>
              &copy; 2026 みんなの らくまる労務. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
