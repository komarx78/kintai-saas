import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, Inbox, Sparkles, Send, MessageSquare, 
  ChevronDown, ChevronUp, CheckCircle2, ThumbsUp, 
  Filter, Search, Bot, User, Bell
} from 'lucide-react';
import { 
  type SystemFaqItem, 
  type SystemImprovementSuggestion, 
  type SystemReleaseNote,
  SYSTEM_FAQ_CATEGORIES, 
  SYSTEM_SUGGESTION_CATEGORIES, 
  SYSTEM_SUGGESTION_STATUSES,
  fetchSystemFaqs, 
  fetchSystemSuggestions, 
  submitSystemSuggestion, 
  toggleSystemSuggestionLike,
  fetchSystemReleaseNotes
} from '../lib/systemSupportManager';
import { askSystemOperationAI } from '../lib/gemini';

interface SystemSupportHubProps {
  tenantId: string;
  tenantName?: string;
  role: 'superadmin' | 'admin' | 'user';
  userName: string;
  userId: string;
}

export const SystemSupportHub: React.FC<SystemSupportHubProps> = ({
  tenantId,
  tenantName = '自社テナント',
  userName,
  userId
}) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'suggestions' | 'releases'>('faq');

  // 💡 Q&A State
  const [faqs, setFaqs] = useState<SystemFaqItem[]>([]);
  const [faqCategory, setFaqCategory] = useState<string>('all');
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // 🤖 AI サポートデスク State
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 📬 改善要望 State
  const [suggestions, setSuggestions] = useState<SystemImprovementSuggestion[]>([]);
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionContent, setSuggestionContent] = useState('');
  const [suggestionCategory, setSuggestionCategory] = useState<SystemImprovementSuggestion['category']>('feature');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // 📢 リリースノート State
  const [releases, setReleases] = useState<SystemReleaseNote[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [fList, sList, rList] = await Promise.all([
      fetchSystemFaqs(),
      fetchSystemSuggestions(),
      fetchSystemReleaseNotes()
    ]);
    setFaqs(fList);
    setSuggestions(sList);
    setReleases(rList);
  };

  // 🤖 AIへの操作質問送信
  const handleAskAI = async (queryText?: string) => {
    const query = queryText || aiQuery;
    if (!query.trim() || isAiLoading) return;

    setIsAiLoading(true);
    setAiAnswer(null);

    // FAQ一覧をAIの知識ベースとして整形
    const knowledge = faqs.map(f => `【Q: ${f.question}】\nA: ${f.answer}\n関連キーワード: ${f.keyword}`).join('\n\n');

    try {
      const response = await askSystemOperationAI(query, knowledge, tenantId);
      setAiAnswer(response);
    } catch (err: any) {
      setAiAnswer(`AIの応答中にエラーが発生しました: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 📬 改善要望の送信
  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionTitle.trim() || !suggestionContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await submitSystemSuggestion({
        tenant_id: tenantId,
        tenant_name: tenantName,
        user_id: userId,
        user_name: userName,
        is_anonymous: isAnonymous,
        category: suggestionCategory,
        title: suggestionTitle.trim(),
        content: suggestionContent.trim()
      });

      setSuggestions(prev => [created, ...prev]);
      setSuggestionTitle('');
      setSuggestionContent('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 👍 いいねトグル
  const handleLike = async (id: string) => {
    await toggleSystemSuggestionLike(id, userId);
    const updated = await fetchSystemSuggestions();
    setSuggestions(updated);
  };

  // フィルタリング
  const filteredFaqs = faqs.filter(f => {
    const matchCat = faqCategory === 'all' || f.category === faqCategory;
    const matchQuery = !faqSearch || 
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) || 
      f.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.keyword.toLowerCase().includes(faqSearch.toLowerCase());
    return matchCat && matchQuery;
  });

  const filteredSuggestions = suggestions.filter(s => {
    if (filterCategory === 'all') return true;
    return s.category === filterCategory;
  });

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* 上部タブバー */}
      <div className="flex border-b border-slate-100 bg-slate-50/70 p-2 sm:p-3 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shrink-0 ${
            activeTab === 'faq'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          💡 システム公式操作Q&A ＆ AI相談
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
            Gemini連動
          </span>
        </button>

        <button
          onClick={() => setActiveTab('suggestions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shrink-0 ${
            activeTab === 'suggestions'
              ? 'bg-white text-violet-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Inbox className="w-4 h-4 text-violet-600" />
          📬 システム改善要望ボックス
          <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full font-bold">
            {suggestions.length}件
          </span>
        </button>

        <button
          onClick={() => setActiveTab('releases')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shrink-0 ${
            activeTab === 'releases'
              ? 'bg-white text-cyan-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Bell className="w-4 h-4 text-cyan-600" />
          📢 アップデート・リリース情報
          <span className="text-[10px] bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full font-bold">
            {releases.length}件
          </span>
        </button>
      </div>

      <div className="p-4 sm:p-8">
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* 💡 タブ①：システム操作Q&A ＆ Gemini AI操作サポートデスク */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'faq' && (
          <div className="space-y-8">
            {/* 🤖 Gemini AI 操作相談デスク */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-violet-50/50 to-white p-5 sm:p-6 rounded-3xl border border-indigo-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                      KAPシステム操作 AIサポートデスク
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
                        Gemini AI自動即答
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      打刻方法、シフト希望の出し方、有給申請、給与明細など、システムの操作手順をAIが24時間いつでも即答します。
                    </p>
                  </div>
                </div>
              </div>

              {/* 質問入力フォーム */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={aiQuery}
                    onChange={e => setAiQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                    placeholder="システムの操作方法をAIに質問（例: 打刻を忘れた時の修正方法は？有給はどう申請する？）"
                    className="w-full pl-4 pr-10 py-3 bg-white border border-indigo-200 rounded-2xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-2xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAskAI()}
                  disabled={isAiLoading || !aiQuery.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs sm:text-sm rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isAiLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      AIが回答を作成中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      AIに質問する
                    </>
                  )}
                </button>
              </div>

              {/* クイック質問タグ */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-500">
                <span className="font-bold">よくある質問:</span>
                {[
                  '出勤・退勤の打刻方法は？',
                  '打刻を忘れた場合の修正方法は？',
                  '有給休暇の申請手順は？',
                  'シフト希望の提出方法は？',
                  'Web給与明細はどうやって見る？'
                ].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setAiQuery(q);
                      handleAskAI(q);
                    }}
                    className="bg-white hover:bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl border border-indigo-100 font-bold transition text-[11px] cursor-pointer shadow-2xs"
                  >
                    💡 {q}
                  </button>
                ))}
              </div>

              {/* AIの回答ボックス */}
              {aiAnswer && (
                <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-sm space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-700">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    AIサポートデスクからの回答
                  </div>
                  <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
                    {aiAnswer}
                  </div>
                </div>
              )}
            </div>

            {/* 📚 システム公式マニュアル・FAQ一覧 */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-indigo-600" />
                    システム公式操作Q&A・マニュアル一覧
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    特権管理者（開発本部）が管理している最新の公式操作ガイドです。
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={faqSearch}
                    onChange={e => setFaqSearch(e.target.value)}
                    placeholder="キーワードで検索（打刻、シフト、有給...）"
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* カテゴリ選択バッジ */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setFaqCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    faqCategory === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  すべて ({faqs.length})
                </button>
                {Object.entries(SYSTEM_FAQ_CATEGORIES).map(([catKey, label]) => {
                  const count = faqs.filter(f => f.category === catKey).length;
                  return (
                    <button
                      key={catKey}
                      onClick={() => setFaqCategory(catKey)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        faqCategory === catKey
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* FAQアコーディオン一覧 */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                {filteredFaqs.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">該当する操作Q&Aは見つかりませんでした。</p>
                ) : (
                  filteredFaqs.map(faq => {
                    const isExpanded = expandedFaqId === faq.id;
                    return (
                      <div key={faq.id} className="transition hover:bg-slate-50/50">
                        <button
                          type="button"
                          onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                          className="w-full px-5 py-4 text-left flex items-start justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              Q
                            </span>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {SYSTEM_FAQ_CATEGORIES[faq.category] || faq.category}
                                </span>
                              </div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                {faq.question}
                              </h4>
                            </div>
                          </div>
                          <div className="p-1 rounded-lg text-slate-400 shrink-0">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-5 pt-1 animate-fade-in">
                            <div className="pl-9 pr-2 py-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/80 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                              <span className="font-bold text-indigo-700 mr-2">【操作手順・回答】</span>
                              {faq.answer}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* 📬 タブ②：システム改善要望ボックス（全社回収ボックス） */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'suggestions' && (
          <div className="space-y-8">
            {/* 新規要望投稿フォーム */}
            <div className="bg-gradient-to-br from-violet-50/80 via-indigo-50/40 to-white p-5 sm:p-7 rounded-3xl border border-violet-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-violet-100 pb-3">
                <div>
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-violet-600" />
                    システムへの改善リクエスト・ご意見を投稿する
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    「こんな機能が欲しい」「ここを使いやすくしてほしい」「スマホ画面の配置を改善してほしい」など、KAP開発元へ直接届きます。
                  </p>
                </div>

                {/* 匿名投稿切り替えスイッチ */}
                <button
                  type="button"
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                    isAnonymous
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  {isAnonymous ? '匿名で投稿中' : `実名投稿 (${userName})`}
                </button>
              </div>

              {submitSuccess && (
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ご意見ありがとうございます！開発元（特権管理者）へ送信されました。検討状況は下記のタイムラインでご確認いただけます。
                </div>
              )}

              <form onSubmit={handleSubmitSuggestion} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">カテゴリ</label>
                    <select
                      value={suggestionCategory}
                      onChange={e => setSuggestionCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-violet-500"
                    >
                      {Object.entries(SYSTEM_SUGGESTION_CATEGORIES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">タイトル</label>
                    <input
                      type="text"
                      required
                      value={suggestionTitle}
                      onChange={e => setSuggestionTitle(e.target.value)}
                      placeholder="例: シフト希望カレンダーでドラッグ選択できるようにしてほしい"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">詳細内容・理由</label>
                  <textarea
                    required
                    rows={3}
                    value={suggestionContent}
                    onChange={e => setSuggestionContent(e.target.value)}
                    placeholder="現状どのような点で不便を感じているか、どのように改善されると業務がスムーズになるかを自由にご記入ください。"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    ※ 投稿された内容は、全契約企業に共有され、共感の「いいね！」を集めることができます。
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting || !suggestionTitle.trim() || !suggestionContent.trim()}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? '送信中...' : '改善要望を開発元へ送信する'}
                  </button>
                </div>
              </form>
            </div>

            {/* タイムライン・要望一覧 */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-violet-600" />
                    届いた改善要望・開発ステータス進捗 ({filteredSuggestions.length}件)
                  </h4>
                  <p className="text-xs text-slate-500">
                    開発チームが確認し、検討状況やアップデート反映予定を公開しています。
                  </p>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5" /> 絞り込み:
                  </span>
                  <button
                    onClick={() => setFilterCategory('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                      filterCategory === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    すべて
                  </button>
                  {Object.entries(SYSTEM_SUGGESTION_CATEGORIES).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFilterCategory(key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                        filterCategory === key
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSuggestions.length === 0 ? (
                <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                  まだ改善要望は投稿されていません。ぜひ最初の要望をお寄せください！
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredSuggestions.map(item => {
                    const isLikedByMe = item.liked_by.includes(userId);
                    return (
                      <div key={item.id} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3 hover:border-violet-300 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${SYSTEM_SUGGESTION_STATUSES[item.status]?.color || 'bg-slate-100'}`}>
                              {SYSTEM_SUGGESTION_STATUSES[item.status]?.label || item.status}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {SYSTEM_SUGGESTION_CATEGORIES[item.category] || item.category}
                            </span>
                            <span className="text-xs text-slate-500">
                              投稿者: <strong className="text-slate-800">{item.is_anonymous ? '匿名ユーザー' : item.user_name}</strong>
                              {item.tenant_name && <span className="ml-1 text-[11px] text-slate-400">({item.tenant_name})</span>}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                            <button
                              type="button"
                              onClick={() => handleLike(item.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                isLikedByMe
                                  ? 'bg-pink-50 text-pink-700 border-pink-200 shadow-2xs'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-pink-50 hover:text-pink-600'
                              }`}
                            >
                              <ThumbsUp className={`w-3.5 h-3.5 ${isLikedByMe ? 'fill-pink-500 text-pink-500' : ''}`} />
                              <span>{item.likes_count || 0}</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-sm sm:text-base font-black text-slate-900">{item.title}</h5>
                          <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                            {item.content}
                          </p>
                        </div>

                        {/* 開発本部からの回答 */}
                        {item.admin_reply && (
                          <div className="bg-indigo-50/90 p-3.5 rounded-xl border border-indigo-200/80 space-y-1">
                            <span className="text-[11px] font-black text-indigo-900 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                              開発元（特権本部）からの公式回答
                            </span>
                            <p className="text-xs text-indigo-950 whitespace-pre-line leading-relaxed">
                              {item.admin_reply}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* 📢 タブ③：アップデート・リリース情報 */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'releases' && (
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-cyan-600" />
                システム機能追加・アップデート履歴（全社共通）
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                KAP勤怠・シフト管理システムの機能追加・改善情報の公式リリースノートです。
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {releases.map(rel => (
                <div key={rel.id} className="py-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-black bg-cyan-600 text-white px-2.5 py-0.5 rounded-lg">
                      {rel.version}
                    </span>
                    <span className="text-xs font-bold text-slate-400 font-mono">{rel.released_at}</span>
                  </div>
                  <h5 className="text-sm font-black text-slate-900">{rel.title}</h5>
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {rel.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
