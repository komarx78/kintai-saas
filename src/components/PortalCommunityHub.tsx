import React, { useState, useEffect } from 'react';
import { 
  Bell, HelpCircle, Inbox, Sparkles, Send, MessageSquare, 
  ChevronDown, ChevronUp, CheckCircle2, ThumbsUp, 
  Filter, Search, Bot, Edit3, X, User
} from 'lucide-react';
import { type AnnouncementItem } from '../lib/announcements';
import { 
  type CompanySuggestion, 
  CATEGORY_LABELS, 
  STATUS_LABELS, 
  fetchCompanySuggestions, 
  saveCompanySuggestion, 
  updateSuggestionStatus, 
  toggleSuggestionLike 
} from '../lib/suggestions';
import { askEmploymentRulesAI } from '../lib/gemini';
import { useNavigate } from 'react-router-dom';

interface PortalCommunityHubProps {
  tenantId: string;
  role: 'superadmin' | 'admin' | 'user';
  userName: string;
  userId: string;
  announcements: AnnouncementItem[];
  companyRulesText?: string;
}

// 🏢 実務で頻出する社内FAQマスター（カテゴリ別）
interface FaqItem {
  id: string;
  category: 'leave' | 'kintai' | 'shift' | 'payroll' | 'procedure';
  question: string;
  answer: string;
  keyword: string;
}

const FAQ_LIST: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'leave',
    question: '有給休暇はいつ、何日付与されますか？',
    answer: '原則として、入社日から6ヶ月間継続勤務し、全所定労働日の8割以上出勤した場合に「10日」が付与されます。パート・アルバイトの方も、週の所定労働日数や年間勤務日数に応じて法令（労基法第39条）に基づき比例付与されます。付与された有給の有効期限は2年間です。',
    keyword: '有給 付与 タイミング 日数 パート 期限'
  },
  {
    id: 'faq-2',
    category: 'leave',
    question: '有給休暇は何日前までに申請すればいいですか？当日でも取れますか？',
    answer: '就業規則および社内規定に基づき、原則として「前営業日まで」にポータルまたは勤怠管理画面の「各種申請」からご提出をお願いいたします。ただし、急な体調不良や突発的な慶弔・事故等の場合は、当日朝に電話やチャット等で所属長へ連絡した上で、事後申請を行うことが認められています。',
    keyword: '有給 申請 期限 当日 体調不良 事後'
  },
  {
    id: 'faq-3',
    category: 'leave',
    question: '半日単位（午前半休・午後半休）や時間単位で有給は取れますか？',
    answer: 'はい、半日単位年休（午前休・午後休）は取得可能です。時間単位年休については、労使協定が締結されている部署において、年5日（最大40時間）を限度として1時間単位で取得することができます。申請画面で「半休」「時間休」を選択して申請してください。',
    keyword: '半休 時間休 時間単位 有休'
  },
  {
    id: 'faq-4',
    category: 'kintai',
    question: '出勤または退勤の打刻を忘れてしまった場合はどうすればいいですか？',
    answer: '打刻漏れに気づいた際は、「勤怠・有給管理」画面の「各種申請」➔「打刻修正・事後申請」より、正しい出勤・退勤時刻を入力して申請してください。承認者（上司・管理者）が確認・承認すると、出勤簿の打刻データが自動的に修正反映されます。',
    keyword: '打刻 忘れ 修正 出勤簿 申請'
  },
  {
    id: 'faq-5',
    category: 'kintai',
    question: '直行・直帰の時はどのように打刻すればいいですか？',
    answer: '外出先や現場からスマートフォンでポータルにアクセスし、現地到着時刻に出勤打刻、業務終了時刻に退勤打刻を行うことができます。スマホからアクセスできない環境の場合は、後から「打刻修正申請」にて直行・直帰の旨を備考に記載して申請してください。',
    keyword: '直行 直帰 外出 打刻'
  },
  {
    id: 'faq-6',
    category: 'shift',
    question: 'シフト希望の提出期限はいつですか？',
    answer: 'シフト希望の提出締め切りは、各社設定および店舗ルールにより定められています（標準設定では「前月20日まで」または「シフト開始日の7日前まで」）。締め切りが近づくと画面に通知が表示されますので、「シフト管理」画面よりお早めに出勤希望・公休希望を提出してください。',
    keyword: 'シフト 期限 提出 締め切り'
  },
  {
    id: 'faq-7',
    category: 'payroll',
    question: '給与の締め日と支給日（振込日）はいつですか？',
    answer: '会社の標準設定では「月末締め・翌月25日支払い」または「20日締め・翌月10日支払い」となっています。支給日が土日・祝日の場合は、直前の平日（金融機関営業日）に前倒しで振り込まれます。ご自身の正確な締日・支払日は労働条件通知書またはWeb給与明細のヘッダーにてご確認いただけます。',
    keyword: '給与 締め日 支払日 振込 土日'
  },
  {
    id: 'faq-8',
    category: 'payroll',
    question: '給与明細や源泉徴収票はどこから確認・印刷できますか？',
    answer: '勤怠管理画面内の「📄 Web給与明細・源泉徴収票・書類」タブより、過去の給与明細・賞与明細・源泉徴収票をいつでもPCやスマートフォンからPDF閲覧・印刷いただけます。紙の紛失の心配がなく、24時間ご確認いただけます。',
    keyword: '給与明細 源泉徴収票 印刷 PDF'
  },
  {
    id: 'faq-9',
    category: 'procedure',
    question: '引っ越し（住所変更）や結婚（氏名変更）があった時はどうすればいいですか？',
    answer: '住所や氏名、振込口座に変更があった場合は、通勤手当の再計算や社会保険・住民税の手続きが必要となります。速やかに管理部へご連絡いただくか、入退社・労務手続きメニューより変更届（住民票等の写真添付）をご提出ください。',
    keyword: '住所変更 引っ越し 結婚 口座 手続き'
  },
  {
    id: 'faq-10',
    category: 'leave',
    question: '忌引休暇（慶弔休暇）の日数や給与の扱いはどうなっていますか？',
    answer: '配偶者・父母・子の場合は5日間、祖父母・兄弟姉妹の場合は3日間等の有給の特別休暇が付与されます（就業規則の慶弔規程に準拠）。申請時に会葬礼状等の証明書のご提出をお願いする場合がございます。',
    keyword: '慶弔 忌引 冠婚葬祭 特別休暇'
  }
];

export const PortalCommunityHub: React.FC<PortalCommunityHubProps> = ({
  tenantId,
  role,
  userName,
  userId,
  announcements,
  companyRulesText = ''
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'announcements' | 'faq_ai' | 'suggestions'>('faq_ai');

  // ==========================================
  // 💡 Q&A ＆ AI相談デスク State
  // ==========================================
  const [faqCategory, setFaqCategory] = useState<string>('all');
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');

  // AIチャット質問
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ==========================================
  // 📬 改善目安箱 State
  // ==========================================
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [isPostingModalOpen, setIsPostingModalOpen] = useState(false);
  const [newSuggestion, setNewSuggestion] = useState({
    category: 'efficiency' as CompanySuggestion['category'],
    title: '',
    content: '',
    is_anonymous: true
  });
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  // 管理者返信・ステータス更新モーダル
  const [adminModalData, setAdminModalData] = useState<{
    isOpen: boolean;
    suggestion: CompanySuggestion | null;
    status: CompanySuggestion['status'];
    adminComment: string;
  }>({
    isOpen: false,
    suggestion: null,
    status: 'in_progress',
    adminComment: ''
  });

  // 目安箱ロード
  useEffect(() => {
    if (tenantId) {
      loadSuggestions();
    }
  }, [tenantId]);

  const loadSuggestions = async () => {
    const list = await fetchCompanySuggestions(tenantId);
    setSuggestions(list);
  };

  // AI質問送信
  const handleAskAi = async (questionText?: string) => {
    const q = questionText || aiQuery;
    if (!q.trim()) return;

    setIsAiLoading(true);
    setAiError(null);
    setAiAnswer(null);

    try {
      const answer = await askEmploymentRulesAI(
        q,
        companyRulesText,
        [],
        undefined,
        tenantId
      );
      setAiAnswer(answer);
    } catch (err: any) {
      console.error(err);
      setAiError('AIの回答生成中にエラーが発生しました。時間をおいて再試行してください。');
    } finally {
      setIsAiLoading(false);
    }
  };

  // 目安箱新規投稿
  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestion.title.trim() || !newSuggestion.content.trim()) {
      alert('件名と内容を入力してください。');
      return;
    }

    setIsSubmittingSuggestion(true);
    try {
      const authorName = newSuggestion.is_anonymous ? '匿名スタッフ' : (userName || '従業員');
      await saveCompanySuggestion(tenantId, {
        tenant_id: tenantId,
        user_id: newSuggestion.is_anonymous ? undefined : userId,
        user_name: authorName,
        is_anonymous: newSuggestion.is_anonymous,
        category: newSuggestion.category,
        title: newSuggestion.title.trim(),
        content: newSuggestion.content.trim(),
        status: 'pending'
      });

      alert('📬 改善提案・ご意見を投書箱に送信しました！\nより良い職場づくりのため、貴重なご意見をありがとうございます。');
      setNewSuggestion({
        category: 'efficiency',
        title: '',
        content: '',
        is_anonymous: true
      });
      setIsPostingModalOpen(false);
      await loadSuggestions();
    } catch (err: any) {
      console.error(err);
      alert('投稿に失敗しました。');
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  // いいねトグル
  const handleLike = async (suggestionId: string) => {
    await toggleSuggestionLike(tenantId, suggestionId, userId);
    await loadSuggestions();
  };

  // 管理者返信保存
  const handleSaveAdminResponse = async () => {
    if (!adminModalData.suggestion) return;
    try {
      await updateSuggestionStatus(
        tenantId,
        adminModalData.suggestion.id,
        adminModalData.status,
        adminModalData.adminComment.trim(),
        userName || '管理者'
      );
      alert('ステータスと管理者回答を更新しました！');
      setAdminModalData({ isOpen: false, suggestion: null, status: 'in_progress', adminComment: '' });
      await loadSuggestions();
    } catch (err) {
      console.error(err);
      alert('更新に失敗しました。');
    }
  };

  // FAQフィルタ
  const filteredFaqs = FAQ_LIST.filter(item => {
    if (faqCategory !== 'all' && item.category !== faqCategory) return false;
    if (faqSearchQuery.trim()) {
      const q = faqSearchQuery.toLowerCase();
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.keyword.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 目安箱フィルタ
  const filteredSuggestions = suggestions.filter(item => {
    if (suggestionFilter === 'all') return true;
    if (suggestionFilter === 'pending') return item.status === 'pending' || item.status === 'in_review';
    if (suggestionFilter === 'in_progress') return item.status === 'in_progress';
    if (suggestionFilter === 'completed') return item.status === 'completed';
    return true;
  });

  return (
    <div className="mt-12 bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
      {/* 🧭 ハブナビゲーションタブ */}
      <div className="bg-slate-50/80 border-b border-gray-200 px-6 pt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('faq_ai')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'faq_ai'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 border-transparent hover:bg-white/50'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'faq_ai' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}>
              <HelpCircle className="w-4 h-4" />
            </div>
            <span>💡 社内Q&A ＆ AI相談デスク</span>
            <span className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
              AI即答
            </span>
          </button>

          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'suggestions'
                ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 border-transparent hover:bg-white/50'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'suggestions' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'}`}>
              <Inbox className="w-4 h-4" />
            </div>
            <span>📬 改善目安箱（回収ボックス）</span>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-emerald-200">
              {suggestions.length}件
            </span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-5 py-3 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'announcements'
                ? 'bg-white text-slate-800 border-slate-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-800 border-transparent hover:bg-white/50'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'announcements' ? 'bg-slate-200 text-slate-800' : 'bg-gray-100'}`}>
              <Bell className="w-4 h-4" />
            </div>
            <span>📢 社内お知らせ</span>
            <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
              {announcements.length}
            </span>
          </button>
        </div>

        {/* 右側アクションボタン */}
        <div className="pb-3">
          {activeTab === 'suggestions' && (
            <button
              onClick={() => setIsPostingModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              改善意見を投稿する
            </button>
          )}

          {activeTab === 'announcements' && (role === 'admin' || role === 'superadmin') && (
            <button
              onClick={() => navigate('/settings/company')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              お知らせを管理・編集
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 💡 タブ 1: 社内Q&A ＆ AI相談デスク                                        */}
      {/* ========================================================================= */}
      {activeTab === 'faq_ai' && (
        <div className="p-6 sm:p-8 space-y-8">
          {/* AI相談デスク（質問入力 ＆ 自動回答） */}
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 rounded-3xl p-6 border-2 border-indigo-100 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none -z-0"></div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                      🤖 就業規則・勤怠AI自動回答アシスタント
                      <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-yellow-300" />
                        Gemini AI連動
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      有給のルール、申請期限、慶弔休暇、手当の条件など、自社の規定に基づきAIが24時間いつでも即答します。
                    </p>
                  </div>
                </div>
              </div>

              {/* 質問入力ボックス */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAskAi();
                      }
                    }}
                    placeholder="AIに質問を入力してください（例: 有給は何日前までに申請すればいい？ 忌引休暇は何日取れる？）"
                    className="flex-1 bg-white border border-indigo-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                  />
                  <button
                    onClick={() => handleAskAi()}
                    disabled={isAiLoading || !aiQuery.trim()}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    {isAiLoading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>AI回答中...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>AIに質問する</span>
                      </>
                    )}
                  </button>
                </div>

                {/* おすすめ質問サジェスト */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">よく聞かれる質問:</span>
                  {[
                    '有給の申請は何日前まで？',
                    '打刻を忘れた時の修正方法は？',
                    'インフルエンザの時の特別休暇はある？',
                    '残業代の割増率は何パーセント？'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setAiQuery(preset);
                        handleAskAi(preset);
                      }}
                      className="text-[11px] bg-white/80 hover:bg-white text-indigo-700 hover:text-indigo-900 border border-indigo-200/80 px-2.5 py-1 rounded-xl transition cursor-pointer font-bold shadow-2xs"
                    >
                      💡 {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI回答結果カード */}
              {aiAnswer && (
                <div className="mt-4 bg-white rounded-2xl p-5 border-2 border-indigo-300 shadow-md space-y-3 animate-fade-in-up">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 text-indigo-700 font-black text-xs">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      AIアシスタントの回答
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(aiAnswer);
                        alert('回答をクリップボードにコピーしました！');
                      }}
                      className="text-[10px] text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 px-2.5 py-1 rounded-lg transition font-bold"
                    >
                      コピー
                    </button>
                  </div>
                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                    {aiAnswer}
                  </div>
                </div>
              )}

              {aiError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold">
                  {aiError}
                </div>
              )}
            </div>
          </div>

          {/* 社内FAQ（よくある質問一覧） */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span>📖</span>
                  社内よくある質問（FAQ）
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  日常の業務で疑問に感じやすいルールや手続きをまとめました
                </p>
              </div>

              {/* 検索ボックス */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={faqSearchQuery}
                  onChange={(e) => setFaqSearchQuery(e.target.value)}
                  placeholder="キーワードで検索（有給、打刻...）"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* カテゴリフィルター */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { id: 'all', label: 'すべて' },
                { id: 'leave', label: '🌴 有給・休暇' },
                { id: 'kintai', label: '⏰ 勤怠・打刻' },
                { id: 'shift', label: '📅 シフト' },
                { id: 'payroll', label: '💰 給与・手当' },
                { id: 'procedure', label: '🏢 各種手続き' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFaqCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                    faqCategory === cat.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* FAQアコーディオンリスト */}
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-2xs">
              {filteredFaqs.map(faq => {
                const isOpen = expandedFaqId === faq.id;
                return (
                  <div key={faq.id} className="transition">
                    <button
                      onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                      className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 pr-4">
                        <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                          Q
                        </span>
                        <span className="font-black text-xs sm:text-sm text-slate-800">
                          {faq.question}
                        </span>
                      </div>
                      <div className="text-slate-400 shrink-0">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed bg-slate-50/50 border-t border-slate-100">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                            A
                          </span>
                          <div className="flex-1 space-y-2">
                            <p className="whitespace-pre-line text-slate-700 font-medium">
                              {faq.answer}
                            </p>
                            <div className="pt-2 flex justify-end">
                              <button
                                onClick={() => {
                                  setAiQuery(faq.question);
                                  handleAskAi(faq.question);
                                  window.scrollTo({ top: 300, behavior: 'smooth' });
                                }}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-200"
                              >
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                さらにAIに詳しく聞く
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📬 タブ 2: 改善目安箱（回収ボックス）                                    */}
      {/* ========================================================================= */}
      {activeTab === 'suggestions' && (
        <div className="p-6 sm:p-8 space-y-6">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 text-white rounded-3xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>📬</span>
                社内改善目安箱（みんなの回収ボックス）
              </h4>
              <p className="text-xs text-blue-100 leading-relaxed">
                「ここをこうしてほしい」「現場でここが不便」「こんな制度・備品があると嬉しい」など、<br />
                率直なご意見・アイデアをお気軽にお寄せください。匿名での投稿も大歓迎です！
              </p>
            </div>
            <button
              onClick={() => setIsPostingModalOpen(true)}
              className="px-5 py-3 bg-white text-blue-700 hover:bg-blue-50 rounded-2xl font-black text-xs transition shadow-md cursor-pointer shrink-0 flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-blue-600" />
              改善意見を投稿する
            </button>
          </div>

          {/* フィルターバー */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
              {[
                { id: 'all', label: 'すべて' },
                { id: 'pending', label: '検討・受付中' },
                { id: 'in_progress', label: '対応推進中' },
                { id: 'completed', label: '改善完了！' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setSuggestionFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    suggestionFilter === f.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-400 font-bold">
              全 {filteredSuggestions.length} 件の投稿
            </div>
          </div>

          {/* タイムラインリスト */}
          <div className="space-y-4">
            {filteredSuggestions.map(sug => {
              const cat = CATEGORY_LABELS[sug.category];
              const st = STATUS_LABELS[sug.status];
              const isLiked = sug.liked_by?.includes(userId);

              return (
                <div 
                  key={sug.id} 
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-200 transition space-y-4"
                >
                  {/* ヘッダー */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.color}`}>
                        {cat.label}
                      </span>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 ${st.bg} ${st.text}`}>
                        <span>{st.icon}</span>
                        <span>{st.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {sug.user_name}
                      </span>
                      <span>•</span>
                      <span>{sug.created_at}</span>
                    </div>
                  </div>

                  {/* タイトル ＆ 本文 */}
                  <div>
                    <h5 className="font-black text-slate-900 text-sm mb-1.5">
                      {sug.title}
                    </h5>
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                      {sug.content}
                    </p>
                  </div>

                  {/* 管理者からの回答・カイゼン進捗カード */}
                  {sug.admin_comment && (
                    <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-black text-emerald-900">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>会社・管理部からの回答と対応状況</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-200">
                          {sug.admin_name || '管理部'}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 leading-relaxed whitespace-pre-line font-medium">
                        {sug.admin_comment}
                      </p>
                    </div>
                  )}

                  {/* フッターアクション（いいね ＆ 管理者更新） */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => handleLike(sug.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                        isLiked 
                          ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                          : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? 'fill-blue-600' : ''}`} />
                      <span>共感・いいね！ ({sug.likes_count})</span>
                    </button>

                    {(role === 'admin' || role === 'superadmin') && (
                      <button
                        onClick={() => setAdminModalData({
                          isOpen: true,
                          suggestion: sug,
                          status: sug.status,
                          adminComment: sug.admin_comment || ''
                        })}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        対応ステータス・返信を編集
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredSuggestions.length === 0 && (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                該当するご意見・改善提案はまだありません。
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📢 タブ 3: 社内お知らせ・アップデート                                     */}
      {/* ========================================================================= */}
      {activeTab === 'announcements' && (
        <div className="p-6 sm:p-8">
          <div className="divide-y divide-gray-100">
            {announcements.map((item) => (
              <div key={item.id} className="py-4 hover:bg-slate-50/60 transition rounded-xl px-2 sm:px-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      {item.date}
                    </span>
                    {item.tag && (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {item.tag}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800">
                      {item.title}
                    </h4>
                    {item.content && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-line font-medium">
                        {item.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {announcements.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                現在、新しいお知らせはありません。
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📝 新規改善意見 投稿モーダル                                              */}
      {/* ========================================================================= */}
      {isPostingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-fade-in-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>📬</span>
                改善提案・ご意見の投稿
              </h3>
              <button
                onClick={() => setIsPostingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSuggestion} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">カテゴリ</label>
                <select
                  value={newSuggestion.category}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, category: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="efficiency">業務効率化・カイゼン</option>
                  <option value="environment">職場環境・設備・備品</option>
                  <option value="system">システム・アプリ要望</option>
                  <option value="welfare">福利厚生・社内制度</option>
                  <option value="other">その他アイデア・相談</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">件名（要約）</label>
                <input
                  type="text"
                  required
                  value={newSuggestion.title}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, title: e.target.value })}
                  placeholder="例: 休憩室に小型の電子レンジをもう1台置いてほしい"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">詳細内容・理由</label>
                <textarea
                  required
                  rows={4}
                  value={newSuggestion.content}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, content: e.target.value })}
                  placeholder="具体的な状況や、こうなると助かる理由などを率直にご記入ください。"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 leading-relaxed font-medium"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSuggestion.is_anonymous}
                    onChange={(e) => setNewSuggestion({ ...newSuggestion, is_anonymous: e.target.checked })}
                    className="rounded text-blue-600 h-4 w-4"
                  />
                  <span>匿名で投稿する（お名前は非公開になります）</span>
                </label>
                <p className="text-[10px] text-slate-400 mt-1 pl-6">
                  ※チェックを外すと「{userName || 'お名前'}」として投稿されます。
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPostingModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSuggestion}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmittingSuggestion ? '送信中...' : '投書箱に送る'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🛠️ 管理者返信・ステータス更新モーダル                                     */}
      {/* ========================================================================= */}
      {adminModalData.isOpen && adminModalData.suggestion && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-fade-in-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>🛠️</span>
                改善提案の対応ステータス ＆ 回答
              </h3>
              <button
                onClick={() => setAdminModalData({ ...adminModalData, isOpen: false })}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">{adminModalData.suggestion.title}</div>
              <div className="text-slate-500 line-clamp-2">{adminModalData.suggestion.content}</div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">対応ステータス</label>
                <select
                  value={adminModalData.status}
                  onChange={(e) => setAdminModalData({ ...adminModalData, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                >
                  <option value="pending">📥 新規受付</option>
                  <option value="in_review">🧐 社内検討中</option>
                  <option value="in_progress">🛠️ 対応推進中</option>
                  <option value="completed">🎉 改善完了！</option>
                  <option value="declined">📋 見送り・回答済</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">管理者からの回答・進捗コメント</label>
                <textarea
                  rows={4}
                  value={adminModalData.adminComment}
                  onChange={(e) => setAdminModalData({ ...adminModalData, adminComment: e.target.value })}
                  placeholder="例: ご提案ありがとうございます！総務部にて確認し、来週より導入することに決定いたしました。"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 leading-relaxed font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  ※ここで入力した回答はタイムライン上で全従業員に温かく共有されます。
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdminModalData({ ...adminModalData, isOpen: false })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdminResponse}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  回答を保存・反映する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
