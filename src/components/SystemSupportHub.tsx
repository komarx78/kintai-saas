import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, Inbox, Send, ChevronDown, ChevronUp, 
  CheckCircle2, Search, Bell, Building2, User, BookOpen,
  Bot, Sparkles
} from 'lucide-react';
import { 
  type SystemFaqItem, 
  type SystemReleaseNote,
  SYSTEM_FAQ_CATEGORIES, 
  SYSTEM_SUGGESTION_CATEGORIES, 
  fetchSystemFaqs, 
  submitSystemSuggestion, 
  fetchSystemReleaseNotes,
  resolveGuidePreviewType
} from '../lib/systemSupportManager';
import { askSystemOperationAI } from '../lib/gemini';
import { SystemGuideUiPreview } from './SystemGuideUiPreviews';

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

  // 🤖 AI 操作サポートデスク State
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 📬 改善要望送信フォーム State
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionContent, setSuggestionContent] = useState('');
  const [suggestionCategory, setSuggestionCategory] = useState<any>('feature');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // 📢 リリースノート State
  const [releases, setReleases] = useState<SystemReleaseNote[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [fList, rList] = await Promise.all([
      fetchSystemFaqs(),
      fetchSystemReleaseNotes()
    ]);
    setFaqs(fList);
    setReleases(rList);
  };

  // 🤖 AIへの操作質問送信
  const handleAskAI = async (queryText?: string) => {
    const query = queryText || aiQuery;
    if (!query.trim() || isAiLoading) return;

    setIsAiLoading(true);
    setAiAnswer(null);

    // 全30項目の詳細マニュアル・FAQをAI知識ベースとして構築
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
      await submitSystemSuggestion({
        tenant_id: tenantId,
        tenant_name: tenantName,
        user_id: userId,
        user_name: userName,
        category: suggestionCategory,
        title: suggestionTitle.trim(),
        content: suggestionContent.trim()
      });

      setSuggestionTitle('');
      setSuggestionContent('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 7000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // フィルタリング処理
  const filteredFaqs = faqs.filter(f => {
    const matchCat = faqCategory === 'all' || f.category === faqCategory;
    const matchQuery = !faqSearch || 
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) || 
      f.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.keyword.toLowerCase().includes(faqSearch.toLowerCase());
    return matchCat && matchQuery;
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
          <BookOpen className="w-4 h-4 text-indigo-600" />
          💡 システム公式操作ガイド ＆ AI相談
          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
            全{faqs.length}項目網羅
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
          📬 システム改善要望・Q&A送信
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
        {/* 💡 タブ①：システム公式操作ガイド ＆ AI操作サポートデスク */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'faq' && (
          <div className="space-y-8">
            {/* 🤖 AI 操作相談デスク（Gemini表記なしの自社AIサポート） */}
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
                        AI自動即答
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
                    placeholder="操作方法を質問（例: 打刻を忘れた時の修正方法は？有給はどう申請する？）"
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
                  '半休や時間休はどうやって取る？',
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

            {/* 📚 初心者向け・公式操作ガイド一覧 */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-indigo-600" />
                    初心者向け・システム公式操作ガイド一覧
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    日々の打刻、有給申請、シフト提出、給与明細など、初心者がつまずきやすい操作手順を詳細に解説しています。
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={faqSearch}
                    onChange={e => setFaqSearch(e.target.value)}
                    placeholder="キーワードで検索（打刻、シフト、有給、パスワード...）"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                          <div className="px-5 pb-5 pt-1 animate-fade-in space-y-3">
                            <div className="pl-9 pr-4 py-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-normal">
                              <span className="font-bold text-indigo-700 block mb-1.5">【操作手順・解決方法】</span>
                              {faq.answer}
                            </div>

                            {/* 📱 実際の操作画面（埋め込みプレビュー） */}
                            <div className="pl-9">
                              <SystemGuideUiPreview
                                previewType={resolveGuidePreviewType(faq)}
                                htmlPreview={faq.html_preview}
                                title={faq.question}
                              />
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
        {/* 📬 タブ②：システム改善要望の送信（開発元直通受付フォーム） */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'suggestions' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-violet-50/80 via-indigo-50/40 to-white p-6 sm:p-8 rounded-3xl border border-violet-100 shadow-sm space-y-5">
              <div>
                <h4 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-violet-600" />
                  システムへの改善要望 ＆ Q&A操作相談窓口
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  本システムをより使いやすくするための機能リクエスト、操作画面の改善案、操作に関するQ&A・ご質問、不具合のご報告を承っております。
                  送信いただいた内容は、<strong>システム管理者にメールで即時通知</strong>され、開発統括本部（SuperAdmin）にて迅速に確認・対応いたします。
                </p>
              </div>

              {/* 投稿者情報プレビュー */}
              <div className="flex items-center gap-4 text-xs bg-white p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  所属企業: <strong className="text-slate-800">{tenantName}</strong>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5 text-slate-600">
                  <User className="w-4 h-4 text-violet-600" />
                  送信者: <strong className="text-slate-800">{userName}</strong>
                </div>
              </div>

              {submitSuccess && (
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center gap-2.5 animate-fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-black text-emerald-900">ご意見・ご質問を送信いたしました！</div>
                    <div className="text-[11px] text-emerald-700 mt-0.5">
                      管理者にメール通知が送信され、開発統括本部（SuperAdmin）へ直接届きました。迅速に確認・対応させていただきます。
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitSuggestion} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">要望カテゴリ</label>
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">要望タイトル</label>
                  <input
                    type="text"
                    required
                    value={suggestionTitle}
                    onChange={e => setSuggestionTitle(e.target.value)}
                    placeholder="例: シフト希望の提出締切をメールや画面で通知してほしい"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">改善してほしい内容・詳細理由</label>
                  <textarea
                    required
                    rows={5}
                    value={suggestionContent}
                    onChange={e => setSuggestionContent(e.target.value)}
                    placeholder="現状どのような点で不便を感じているか、どの画面にどのような機能があると便利になるかを具体的にお聞かせください。"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !suggestionTitle.trim() || !suggestionContent.trim()}
                    className="px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? '開発チームへ送信中...' : '改善要望を開発元へ送信する'}
                  </button>
                </div>
              </form>
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
                  <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
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
