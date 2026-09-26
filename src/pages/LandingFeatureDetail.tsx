import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2, ArrowRight, Sparkles,
  Calendar, Clock, DollarSign, UserPlus, FileCheck,
  ChevronLeft, ChevronRight, Home, FileText
} from 'lucide-react';
import { SystemGuideUiPreview } from '../components/SystemGuideUiPreviews';

// 6大機能の定義
interface FeatureInfo {
  id: string;
  title: string;
  category: string;
  badge: string;
  icon: any;
  color: 'amber' | 'sky' | 'emerald' | 'purple' | 'blue' | 'pink';
  previewType: string;
  summary: string;
  highlightText: string;
  painPoint: string;
  solution: string;
  benefits: {
    staff: string;
    admin: string;
    management: string;
  };
  supportedDocuments: string[];
}

const FEATURES: FeatureInfo[] = [
  {
    id: 'official',
    title: '官公庁・公的届出 A4原本印刷',
    category: '行政手続き・公的帳票',
    badge: '★ 圧倒的独自価値（神機能）',
    icon: FileCheck,
    color: 'amber',
    previewType: 'official_ledger_print',
    summary: 'ハローワークや税務署、労基署の公式様式に直接1ミリの狂いもなくジャスト印字。他社SaaSには絶対にない唯一無二の機能です。',
    highlightText: '手書き転記ゼロ！離職票・資格取得届・扶養控除申告書をそのまま役所へ提出',
    painPoint: '退職者が発生するたびにハローワークの指定用紙に手書きで賃金支払基礎日数や算定期間を転記…毎月数時間の残業が発生していませんか？',
    solution: '本システムなら、日々の勤怠データと給与計算データから自動で計算され、公式A4用紙にピタリと印字。そのまま窓口へ提出・郵送が可能です。',
    benefits: {
      staff: '退職時や年末調整の手続きがスピーディーになり、離職票や源泉徴収票がすぐに手元に届きます。',
      admin: '複雑な算定基礎日数の手計算や転記作業が一切不要に。年末調整や入退社の繁忙期残業が激減します。',
      management: '社会保険・労働保険の届出遅延によるトラブルを防止。外注費用を抑えつつ法令遵守を徹底できます。'
    },
    supportedDocuments: [
      '雇用保険被保険者離職証明書（離職票-2）',
      '雇用保険被保険者資格取得届 / 喪失届',
      '給与所得者の扶養控除等（異動）申告書',
      '労働者名簿（労働基準法第107条準拠）',
      '賃金台帳（労働基準法第108条準拠）',
      '源泉徴収簿（国税庁公式原本様式）'
    ]
  },
  {
    id: 'kintai',
    title: 'スマホ・PC勤怠打刻＆集計',
    category: '勤怠管理・タイムレコーダー',
    badge: '現場目線・ミスゼロ',
    icon: Clock,
    color: 'sky',
    previewType: 'monthly_attendance',
    summary: '現場スタッフが迷わない1タップ打刻。GPS位置情報による不正打刻防止や、夜勤・日跨ぎ勤務の自動判定も完全サポート。',
    highlightText: 'タイムカード集計作業がゼロに！スマホから簡単打刻＆リアルタイム自動集計',
    painPoint: '月末になると紙のタイムカードを回収し、電卓を叩いてエクセルに打ち直し…打刻漏れや押し間違いの確認だけで何日もかかっていませんか？',
    solution: 'スタッフは手元のスマホから「出勤」「退勤」を押すだけ。休憩時間や時間外労働は自動で計算され、管理画面にリアルタイム集計されます。',
    benefits: {
      staff: 'タイムカードの打刻列に並ぶ必要なし。スマホからいつでも自分の勤務時間や残業時間を確認できます。',
      admin: '締め日の電卓集計や転記作業が消滅。打刻漏れがある日の修正も管理者画面からワンクリックで完結。',
      management: 'リアルタイムで全店舗・全拠点の稼働状況や残業時間を把握でき、労基署対策や36協定違反を未然に防止。'
    },
    supportedDocuments: [
      '月次出勤簿・タイムカード印刷（PDF / CSV）',
      '日別打刻詳細ログ（GPS位置情報記録付き）',
      '残業・深夜労働・休日出勤集計データ',
      '打刻修正履歴・監査ログ'
    ]
  },
  {
    id: 'leave',
    title: '有給休暇の法定自動付与＆管理',
    category: '有給・休暇管理',
    badge: '労働基準法完全準拠',
    icon: Calendar,
    color: 'emerald',
    previewType: 'leave_request',
    summary: '入社日からの勤続年数に応じた法定日数を全自動付与。パート・アルバイトの比例付与や年5日取得義務のアラートも完備。',
    highlightText: '年5日取得義務違反の罰則リスクをゼロに！有給の自動計算＆取得アラート',
    painPoint: '「誰に何日有給を付与すべきか」「パートの出勤日数に応じた付与日数は何日か」の計算が難しく、年5日取得義務の管理まで手が回らない…',
    solution: '入社日と所定労働日数から自動で付与日数を判定・自動付与。未取得のスタッフがいればアラートで自動通知するため、法律違反を防げます。',
    benefits: {
      staff: 'スマホからいつでも有給の残日数や有効期限を確認でき、申請もスマホから数秒で完了します。',
      admin: '有給台帳への手書き記入や失効日数の計算が不要に。法改正に伴う複雑な比例付与表も自動計算。',
      management: '労働基準法第39条（年5日の有給休暇取得義務）を完全にクリア。罰則（30万円以下の罰金）のリスクを物理遮断。'
    },
    supportedDocuments: [
      '年次有給休暇管理簿（労働基準法施行規則第24条の7準拠）',
      '有給休暇取得計画表・取得進捗リスト',
      '特別休暇・慶弔休暇・振替休日台帳'
    ]
  },
  {
    id: 'shift',
    title: 'スマホ シフト希望収集＆作成',
    category: 'シフト管理・人員配置',
    badge: '人手不足警告つき',
    icon: Calendar,
    color: 'purple',
    previewType: 'shift_admin_manage',
    summary: 'LINEや紙のシフト希望集めを撤廃。スマホから集まった希望をカレンダー上で視覚的に調整し、必要人数との過不足を瞬時に検知。',
    highlightText: 'シフト作成の時間を1/5に短縮！希望収集から確定通知までスマホで完結',
    painPoint: 'スタッフの希望シフトを紙やメッセージアプリでバラバラに受け取り、エクセルに転記してパズルのように組み立てるのが毎月苦痛…',
    solution: 'スタッフがスマホで希望日時を提出すると、管理画面のカレンダーに自動集約。必要人数に対する「過不足」が色別で一目でわかります。',
    benefits: {
      staff: 'シフト提出のために職場へ行く必要がなく、確定したシフトもスマホのカレンダーでいつでも確認可能。',
      admin: '転記の手間がゼロになり、ワンクリックで確定シフトを全員に一斉公開。急な交代調整もスムーズ。',
      management: '人手不足の時間帯や無駄な余剰人員を可視化。適正な人件費コントロールと売上機会の最大化を実現。'
    },
    supportedDocuments: [
      '月間・週間シフトカレンダー表（A4印刷 / PDF）',
      '日別・時間帯別人員配置グラフ',
      'スタッフ別希望勤務日数・時間対比表'
    ]
  },
  {
    id: 'payroll',
    title: '給与一括自動計算＆Web明細',
    category: '給与計算・明細発行',
    badge: '勤怠直結・ミスゼロ',
    icon: DollarSign,
    color: 'blue',
    previewType: 'payroll_admin_calc',
    summary: '勤怠データから勤務時間・残業時間を直結取得。社会保険料・雇用保険料・所得税を法律に基づき自動計算し、Web明細を即時発行。',
    highlightText: '紙の明細印刷や手渡し作業を完全廃止！勤怠データから1クリックで給与計算',
    painPoint: '勤怠ソフトのCSVを給与ソフトにインポートして、社会保険料の料率変更を手動で確認して…毎月の給与計算ミスに怯えていませんか？',
    solution: '勤怠と給与が1つのシステムで完結しているため、データ移行の手間もCSVエラーも一切なし。最新の保険料率や税率も自動適用されます。',
    benefits: {
      staff: '給料日にスマホで給与明細を確認。過去の明細もいつでも閲覧・PDFダウンロードできます。',
      admin: '明細の印刷・封入・手渡し作業が完全ゼロに。社会保険料の端数処理や介護保険該当（40歳到達）も自動判定。',
      management: '計算ミスのリスクを根絶し、給与担当者の属人化を解消。大幅な時間短縮とコスト削減を実現。'
    },
    supportedDocuments: [
      'Web給与明細書（スマホ最適化 / A4印刷PDF）',
      '月別・年間賃金台帳（法定三帳簿）',
      '給与振込依頼用全銀データ形式（総合振込対応）',
      '源泉徴収票（退職時・年末調整用）'
    ]
  },
  {
    id: 'onboarding',
    title: 'スマホ入社手続き＆電子契約',
    category: '入社労務・電子署名',
    badge: '完全ペーパーレス',
    icon: UserPlus,
    color: 'pink',
    previewType: 'onboarding_passbook',
    summary: '新入社員はスマホで通帳写真や身分証を撮影して送信するだけ。雇用契約書や労働条件通知書もスマホ上で電子署名が完結。',
    highlightText: '郵送や紙の記入をゼロに！スマホで完結する入社手続き＆大元台帳へ自動登録',
    painPoint: '入社書類を印刷して郵送し、手書きで返送してもらい、手書き文字をエクセルに打ち込む…口座情報の書き間違いで振込エラーになりませんか？',
    solution: '専用のURLを新入社員に送るだけ。通帳の写真送付や基本情報入力、電子署名までスマホ1台で完結。登録された情報は全システムに自動反映されます。',
    benefits: {
      staff: '手書きで何度も住所や氏名を書く苦痛から解放。通帳の写真添付だけでスムーズに入社準備が完了。',
      admin: '手書き文字の解読ミスや口座番号の誤入力がゼロに。回収状況もダッシュボードで一目で把握。',
      management: '労働条件通知書の交付義務（労基法第15条）を完全電子化でクリア。入社手続きのリードタイムを劇的に短縮。'
    },
    supportedDocuments: [
      '労働条件通知書 兼 雇用契約書（電子署名付き原本PDF）',
      '給与振込口座届出書（通帳画像添付）',
      '従業員基本台帳・労務マスターデータ',
      '身元保証書・誓約書・マイナンバー確認書'
    ]
  }
];

export const LandingFeatureDetail: React.FC = () => {
  const { featureId } = useParams<{ featureId: string }>();
  const navigate = useNavigate();

  // 該当する機能の取得（見つからなければ官公庁原本）
  const currentFeature = FEATURES.find(f => f.id === featureId) || FEATURES[0];
  const currentIndex = FEATURES.findIndex(f => f.id === currentFeature.id);

  // 前後の機能
  const prevFeature = currentIndex > 0 ? FEATURES[currentIndex - 1] : FEATURES[FEATURES.length - 1];
  const nextFeature = currentIndex < FEATURES.length - 1 ? FEATURES[currentIndex + 1] : FEATURES[0];

  // ページ切り替え時に最上部へスクロール
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [featureId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* ─── 1. トップ案内バー ─── */}
      <div className="bg-gradient-to-r from-blue-700 via-sky-600 to-blue-700 text-white py-2 px-4 text-center text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-2">
        <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">注目</span>
        <span>初期費用0円・最低利用料なし・1人月額300円で全機能が使い放題！</span>
      </div>

      {/* ─── 2. クリーンヘッダー ─── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/lp" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-2xl text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                K
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                    みんなの らくまる労務
                  </span>
                  <span className="bg-sky-100 text-sky-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-sky-200">
                    中小零細企業 応援モデル
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">機能別詳細解説 ＆ 実際の操作画面</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/lp"
              className="text-xs sm:text-sm font-bold text-slate-700 hover:text-blue-600 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1"
            >
              <Home className="w-4 h-4" />
              <span>トップへ戻る</span>
            </Link>
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

      {/* ─── 3. パンくずリスト ─── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs text-slate-500 flex items-center gap-2">
          <Link to="/lp" className="hover:text-blue-600 flex items-center gap-1">
            <Home className="w-3.5 h-3.5" />
            <span>ホーム</span>
          </Link>
          <span>/</span>
          <span className="text-slate-400">機能紹介</span>
          <span>/</span>
          <span className="font-bold text-slate-900">{currentFeature.title}</span>
        </div>
      </div>

      {/* ─── 4. 6大機能の切り替えナビゲーション（タブバー） ─── */}
      <div className="bg-slate-100 border-b border-slate-200 sticky top-20 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar">
            {FEATURES.map((f) => {
              const isCurrent = f.id === currentFeature.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => navigate(`/lp/features/${f.id}`)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{f.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 5. メインヒーロー：機能概要 ─── */}
      <section className="bg-gradient-to-b from-sky-50/60 via-white to-slate-50 pt-10 pb-12 sm:pt-14 sm:pb-16 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* バッジ */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs sm:text-sm font-bold border border-blue-200 mb-4 shadow-sm">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>{currentFeature.badge}</span>
            </div>

            {/* タイトル */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
              {currentFeature.title}
            </h1>

            {/* キャッチコピー */}
            <p className="text-base sm:text-xl font-bold text-blue-700 mb-6 max-w-3xl mx-auto">
              {currentFeature.highlightText}
            </p>

            {/* サマリー */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8">
              {currentFeature.summary}
            </p>

            {/* 無料体験CTAボタン */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/?mode=signup')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-orange-500/25 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>この機能を14日間 無料で試す</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. お困りごとの解決 ─── */}
      <section className="py-12 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* 従来の課題 */}
            <div className="bg-rose-50/70 p-6 sm:p-8 rounded-3xl border-2 border-rose-200/80 shadow-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold mb-4">
                <span>✕ これまでの課題</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-rose-950 mb-3">
                こんな非効率に悩んでいませんでしたか？
              </h3>
              <p className="text-xs sm:text-sm text-rose-900/80 leading-relaxed">
                {currentFeature.painPoint}
              </p>
            </div>

            {/* 本システムによる解決 */}
            <div className="bg-emerald-50/70 p-6 sm:p-8 rounded-3xl border-2 border-emerald-200/80 shadow-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-4">
                <span>◯ みんなの らくまる労務なら</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-emerald-950 mb-3">
                ボタン1つで全自動！転記もミスもゼロに
              </h3>
              <p className="text-xs sm:text-sm text-emerald-900/80 leading-relaxed">
                {currentFeature.solution}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. 【大注目】実際の画面（実機UIインタラクティブプレビュー） ─── */}
      <section className="py-14 sm:py-20 bg-slate-100/70 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-blue-600 font-extrabold text-xs tracking-wider uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              実際の操作画面
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
              導入後のリアルな画面をご覧ください
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              ステップ番号（①・②・③）をクリックすると、実際の操作フローがリアルに体験できます。
            </p>
          </div>

          {/* 実機UIプレビューの大画面コンテナ */}
          <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-2xl p-4 sm:p-8 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <SystemGuideUiPreview previewType={currentFeature.previewType} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. 現場・総務・経営者 3つの視点での導入メリット ─── */}
      <section className="py-14 sm:py-20 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-emerald-600 font-extrabold text-xs tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              全社に広がる効果
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 tracking-tight">
              誰にとっても使いやすく、劇的にラクになる
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* スタッフの視点 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm mb-4">
                現場
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">現場スタッフ・従業員</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {currentFeature.benefits.staff}
              </p>
            </div>

            {/* 総務の視点 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm mb-4">
                総務
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">総務・労務・人事担当者</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {currentFeature.benefits.admin}
              </p>
            </div>

            {/* 経営者の視点 */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-sm mb-4">
                経営
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">経営者・役員・店舗オーナー</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {currentFeature.benefits.management}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. 対応帳票・機能スペック一覧 ─── */}
      <section className="py-12 sm:py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>この機能で作成・出力・管理できる帳票・データ</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentFeature.supportedDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{doc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── 10. 前後の機能への回遊ナビゲーション ─── */}
      <section className="py-10 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 前の機能 */}
            <Link
              to={`/lp/features/${prevFeature.id}`}
              className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all flex items-center justify-between group bg-slate-50/50 hover:bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">前の機能</div>
                  <div className="font-extrabold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                    {prevFeature.title}
                  </div>
                </div>
              </div>
            </Link>

            {/* 次の機能 */}
            <Link
              to={`/lp/features/${nextFeature.id}`}
              className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all flex items-center justify-between group bg-slate-50/50 hover:bg-white text-right"
            >
              <div className="flex items-center justify-end w-full gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">次の機能</div>
                  <div className="font-extrabold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                    {nextFeature.title}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 11. 最終クロージングCTA ─── */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-sky-50 to-white text-center border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-4 shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>まずは14日間、完全無料で使いやすさをお確かめください</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-snug mb-4">
            「{currentFeature.title}」を<br className="hidden sm:inline" />
            今すぐ無料でお試しいただけます
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
            クレジットカード不要・初期費用0円・最低利用料なし。<br />
            1人あたり月額300円で、すべての機能が自由に使えます。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/?mode=signup')}
              className="w-full sm:w-auto px-10 py-4.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xl rounded-2xl shadow-xl shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white"
            >
              <span>14日間 無料体験を始める</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              to="/lp"
              className="w-full sm:w-auto px-6 py-4 bg-white hover:bg-slate-100 text-slate-700 font-bold text-base rounded-2xl border-2 border-slate-300 shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4 text-blue-600" />
              <span>LPトップへ戻る</span>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs text-slate-500 mt-6 font-bold">
            <span>✓ クレジットカード不要</span>
            <span>✓ 初期費用 0円</span>
            <span>✓ 最低縛り なし</span>
          </div>
        </div>
      </section>

      {/* ─── 12. フッター ─── */}
      <footer className="py-8 bg-slate-900 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 space-y-4">

        {/* 運営会社概要カード */}
        <div className="bg-slate-800/70 rounded-2xl p-6 sm:p-7 border border-slate-700/80 text-slate-300 my-4">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              K
            </div>
            <span className="font-bold text-white">みんなの らくまる労務</span>
          </div>
          <div className="flex flex-wrap gap-4 sm:gap-6 justify-center">
            <Link to="/lp" className="hover:text-white">トップページ</Link>
            <Link to="/lp/features/official" className="hover:text-white">官公庁原本印刷</Link>
            <Link to="/lp/features/kintai" className="hover:text-white">勤怠打刻</Link>
            <Link to="/lp/features/leave" className="hover:text-white">有給管理</Link>
            <Link to="/lp/features/shift" className="hover:text-white">シフト管理</Link>
            <Link to="/lp/features/payroll" className="hover:text-white">給与計算</Link>
            <Link to="/lp/features/onboarding" className="hover:text-white">入社手続き</Link>
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
