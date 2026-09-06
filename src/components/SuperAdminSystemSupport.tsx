import { useState, useEffect } from 'react';
import { 
  HelpCircle, Inbox, Sparkles, Plus, Edit3, Trash2, CheckCircle2, 
  MessageSquare, Save, X, Search, Filter, ThumbsUp, Building2, 
  RefreshCw, Bell
} from 'lucide-react';
import { 
  type SystemFaqItem, 
  type SystemImprovementSuggestion, 
  type SystemReleaseNote,
  SYSTEM_FAQ_CATEGORIES, 
  SYSTEM_SUGGESTION_CATEGORIES, 
  SYSTEM_SUGGESTION_STATUSES,
  fetchSystemFaqs, 
  saveSystemFaq, 
  deleteSystemFaq,
  fetchSystemSuggestions, 
  updateSystemSuggestionStatus,
  fetchSystemReleaseNotes,
  saveSystemReleaseNote
} from '../lib/systemSupportManager';

export function SuperAdminSystemSupport() {
  const [subTab, setSubTab] = useState<'suggestions' | 'faqs' | 'releases'>('suggestions');

  // Suggestions State
  const [suggestions, setSuggestions] = useState<SystemImprovementSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'pending' | 'reviewing' | 'planned' | 'completed' | 'declined'>('all');
  const [replyingSuggestion, setReplyingSuggestion] = useState<SystemImprovementSuggestion | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<SystemImprovementSuggestion['status']>('reviewing');

  // FAQs State
  const [faqs, setFaqs] = useState<SystemFaqItem[]>([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('all');
  const [faqSearchQuery, setFaqSearchQuery] = useState('');
  const [editingFaq, setEditingFaq] = useState<Partial<SystemFaqItem> | null>(null);

  // Releases State
  const [releases, setReleases] = useState<SystemReleaseNote[]>([]);
  const [editingRelease, setEditingRelease] = useState<Partial<SystemReleaseNote> | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoadingSuggestions(true);
    setLoadingFaqs(true);
    try {
      const [sList, fList, rList] = await Promise.all([
        fetchSystemSuggestions(),
        fetchSystemFaqs(),
        fetchSystemReleaseNotes()
      ]);
      setSuggestions(sList);
      setFaqs(fList);
      setReleases(rList);
    } finally {
      setLoadingSuggestions(false);
      setLoadingFaqs(false);
    }
  };

  // 📬 改善要望の返信・ステータス更新
  const handleSaveReply = async () => {
    if (!replyingSuggestion) return;
    await updateSystemSuggestionStatus(replyingSuggestion.id, replyStatus, replyText);
    setReplyingSuggestion(null);
    setReplyText('');
    const updated = await fetchSystemSuggestions();
    setSuggestions(updated);
  };

  // 💡 FAQの保存
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq?.question || !editingFaq?.answer) return;
    await saveSystemFaq({
      id: editingFaq.id,
      category: (editingFaq.category as any) || 'general',
      question: editingFaq.question,
      answer: editingFaq.answer,
      keyword: editingFaq.keyword || ''
    });
    setEditingFaq(null);
    const updated = await fetchSystemFaqs();
    setFaqs(updated);
  };

  // 💡 FAQの削除
  const handleDeleteFaq = async (id: string) => {
    if (!window.confirm('このシステム操作Q&Aを削除してもよろしいですか？全テナントのAI参照からも除外されます。')) return;
    await deleteSystemFaq(id);
    const updated = await fetchSystemFaqs();
    setFaqs(updated);
  };

  // 📢 リリースノートの保存
  const handleSaveRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRelease?.title || !editingRelease?.content) return;
    await saveSystemReleaseNote({
      id: editingRelease.id,
      version: editingRelease.version || 'Ver 2.2.0',
      title: editingRelease.title,
      content: editingRelease.content,
      category: (editingRelease.category as any) || 'update',
      released_at: editingRelease.released_at || new Date().toISOString().split('T')[0]
    });
    setEditingRelease(null);
    const updated = await fetchSystemReleaseNotes();
    setReleases(updated);
  };

  // フィルタリング処理
  const filteredSuggestions = suggestions.filter(s => {
    if (suggestionFilter === 'all') return true;
    return s.status === suggestionFilter;
  });

  const filteredFaqs = faqs.filter(f => {
    const matchCat = faqCategoryFilter === 'all' || f.category === faqCategoryFilter;
    const matchQuery = !faqSearchQuery || 
      f.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) || 
      f.answer.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
      f.keyword.toLowerCase().includes(faqSearchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* ヘッダーバナー */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            全契約テナント統制 ＆ サービス品質向上ハブ
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <HelpCircle className="w-7 h-7 text-indigo-400" />
            システム操作Q&A ＆ 改善要望回収ボックス統括
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            全契約企業（テナント）から届く<strong>「システム機能改善リクエスト・不具合報告」</strong>を回収・一元管理し、
            全テナントの画面およびシステムAIサポートデスクが参照する<strong>「公式操作マニュアル・Q&A」</strong>を配信・統制します。
          </p>
        </div>

        <button
          onClick={loadAll}
          className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700 shrink-0 self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          最新データ再取得
        </button>
      </div>

      {/* サブタブ切り替え */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setSubTab('suggestions')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            subTab === 'suggestions'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Inbox className="w-4 h-4" />
          📬 全テナント改善要望ボックス
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            subTab === 'suggestions' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
          }`}>
            {suggestions.length}件
          </span>
          {suggestions.filter(s => s.status === 'pending').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setSubTab('faqs')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            subTab === 'faqs'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          💡 システム公式操作Q&Aマスタ
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            subTab === 'faqs' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
          }`}>
            {faqs.length}件
          </span>
        </button>

        <button
          onClick={() => setSubTab('releases')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            subTab === 'releases'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          📢 全社向けリリースノート配信
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            subTab === 'releases' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
          }`}>
            {releases.length}件
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 📬 タブ①：全テナント改善要望（回収ボックス）統括 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'suggestions' && (
        <div className="space-y-4">
          {/* フィルターバー */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> 状態:
              </span>
              {(['all', 'pending', 'reviewing', 'planned', 'completed', 'declined'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setSuggestionFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    suggestionFilter === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'すべて' : SYSTEM_SUGGESTION_STATUSES[st].label}
                  {st !== 'all' && (
                    <span className="ml-1.5 opacity-70">
                      ({suggestions.filter(s => s.status === st).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              表示中: <strong className="text-slate-800">{filteredSuggestions.length}</strong> 件
            </div>
          </div>

          {/* 要望一覧 */}
          {loadingSuggestions ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              改善要望を読み込み中...
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-700">該当する改善要望はありません</h3>
              <p className="text-xs text-slate-400">
                各テナントの従業員・管理者が「システム改善要望ボックス」から投稿すると、ここにリアルタイムで届きます。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredSuggestions.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 hover:border-indigo-300 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${SYSTEM_SUGGESTION_STATUSES[item.status]?.color || 'bg-slate-100'}`}>
                        {SYSTEM_SUGGESTION_STATUSES[item.status]?.label || item.status}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        {SYSTEM_SUGGESTION_CATEGORIES[item.category] || item.category}
                      </span>
                      <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {item.tenant_name || 'テナント'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>投稿者: <strong className="text-slate-700">{item.is_anonymous ? '匿名ユーザー' : item.user_name}</strong></span>
                      <span>{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                      <span className="flex items-center gap-1 text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded-md">
                        <ThumbsUp className="w-3 h-3" /> {item.likes_count || 0}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      {item.content}
                    </p>
                  </div>

                  {/* 本部からの回答コメント表示 */}
                  {item.admin_reply && (
                    <div className="bg-indigo-50/80 p-3.5 rounded-xl border border-indigo-200/80 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-indigo-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                          特権管理者・開発本部からの回答
                        </span>
                        <span className="text-[10px] text-indigo-500 font-mono">
                          {item.updated_at ? new Date(item.updated_at).toLocaleDateString('ja-JP') : ''}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-950 whitespace-pre-line leading-relaxed">
                        {item.admin_reply}
                      </p>
                    </div>
                  )}

                  {/* アクションボタン */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setReplyingSuggestion(item);
                        setReplyText(item.admin_reply || '');
                        setReplyStatus(item.status);
                      }}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      ステータス更新・公式回答を記入
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 💡 タブ②：システム公式操作Q&Aマスタ管理 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'faqs' && (
        <div className="space-y-4">
          {/* コントロールバー */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={faqSearchQuery}
                  onChange={e => setFaqSearchQuery(e.target.value)}
                  placeholder="質問・回答・キーワードで検索..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <select
                value={faqCategoryFilter}
                onChange={e => setFaqCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
              >
                <option value="all">すべてのカテゴリ</option>
                {Object.entries(SYSTEM_FAQ_CATEGORIES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setEditingFaq({ category: 'kintai', question: '', answer: '', keyword: '' })}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              新規Q&Aを登録する
            </button>
          </div>

          {/* Q&A一覧 */}
          {loadingFaqs ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Q&Aマスタを読み込み中...
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-700">該当するQ&Aがありません</h3>
              <p className="text-xs text-slate-400">「新規Q&Aを登録する」ボタンからマニュアルを追加してください。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredFaqs.map(faq => (
                <div key={faq.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2 hover:border-indigo-300 transition">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {SYSTEM_FAQ_CATEGORIES[faq.category] || faq.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingFaq(faq)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="編集"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFaq(faq.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-black text-slate-900 flex items-start gap-2">
                    <span className="text-indigo-600 font-bold shrink-0">Q.</span>
                    <span>{faq.question}</span>
                  </h4>

                  <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0">A.</span>
                    <span className="whitespace-pre-line">{faq.answer}</span>
                  </div>

                  {faq.keyword && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
                      <span>検索キーワード:</span>
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{faq.keyword}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 📢 タブ③：全社向けリリースノート配信 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'releases' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              ここで登録したシステムアップデート情報は、<strong>全契約企業ポータルの「お知らせ」や「リリースノート」タブへ即時配信</strong>されます。
            </p>
            <button
              onClick={() => setEditingRelease({ version: 'Ver 2.2.0', title: '', content: '', category: 'update', released_at: new Date().toISOString().split('T')[0] })}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              リリース情報を配信する
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {releases.map(rel => (
              <div key={rel.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg">
                      {rel.version}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{rel.released_at}</span>
                  </div>
                  <button
                    onClick={() => setEditingRelease(rel)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                    title="編集"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="text-sm font-black text-slate-900">{rel.title}</h4>
                <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {rel.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── モーダル：改善要望の返信・ステータス更新 ─── */}
      {replyingSuggestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                改善要望への公式返答 ＆ ステータス更新
              </h3>
              <button onClick={() => setReplyingSuggestion(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">【{replyingSuggestion.tenant_name}】{replyingSuggestion.title}</div>
              <p className="text-slate-600 line-clamp-3">{replyingSuggestion.content}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">現在の開発・検討ステータス</label>
                <select
                  value={replyStatus}
                  onChange={e => setReplyStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(SYSTEM_SUGGESTION_STATUSES).map(([key, item]) => (
                    <option key={key} value={key}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  開発元からの回答・進捗コメント（全テナント・投稿者へ公開されます）
                </label>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="例: ご提案ありがとうございます。本件は次期アップデート（Ver.2.3）にて実装を予定しております。"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReplyingSuggestion(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveReply}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-md flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                回答を登録・反映する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── モーダル：Q&Aマスタの登録・編集 ─── */}
      {editingFaq && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleSaveFaq} className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                {editingFaq.id ? 'システム操作Q&Aの編集' : '新規システム操作Q&Aの登録'}
              </h3>
              <button type="button" onClick={() => setEditingFaq(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">対象アプリケーション・カテゴリ</label>
                <select
                  value={editingFaq.category || 'general'}
                  onChange={e => setEditingFaq({ ...editingFaq, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(SYSTEM_FAQ_CATEGORIES).map(([k, lbl]) => (
                    <option key={k} value={k}>{lbl}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">質問タイトル (Question)</label>
                <input
                  type="text"
                  required
                  value={editingFaq.question || ''}
                  onChange={e => setEditingFaq({ ...editingFaq, question: e.target.value })}
                  placeholder="例: 出勤打刻を忘れた場合の修正方法は？"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">操作手順・回答 (Answer)</label>
                <textarea
                  required
                  rows={5}
                  value={editingFaq.answer || ''}
                  onChange={e => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                  placeholder="操作手順や注意点を丁寧に記入してください。システムAIサポートデスクもこの回答を参照します。"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">検索キーワード (スペース区切り)</label>
                <input
                  type="text"
                  value={editingFaq.keyword || ''}
                  onChange={e => setEditingFaq({ ...editingFaq, keyword: e.target.value })}
                  placeholder="例: 打刻 忘れ 修正 申請 承認"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingFaq(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-md flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                Q&Aマスタに保存する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── モーダル：リリースノートの作成・編集 ─── */}
      {editingRelease && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleSaveRelease} className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                システムリリース情報の作成・配信
              </h3>
              <button type="button" onClick={() => setEditingRelease(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">バージョン</label>
                <input
                  type="text"
                  required
                  value={editingRelease.version || ''}
                  onChange={e => setEditingRelease({ ...editingRelease, version: e.target.value })}
                  placeholder="例: Ver 2.3.0"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">リリース日</label>
                <input
                  type="date"
                  required
                  value={editingRelease.released_at || ''}
                  onChange={e => setEditingRelease({ ...editingRelease, released_at: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">タイトル</label>
              <input
                type="text"
                required
                value={editingRelease.title || ''}
                onChange={e => setEditingRelease({ ...editingRelease, title: e.target.value })}
                placeholder="例: シフト自動生成機能の改善とUI高速化"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">アップデート詳細内容</label>
              <textarea
                required
                rows={4}
                value={editingRelease.content || ''}
                onChange={e => setEditingRelease({ ...editingRelease, content: e.target.value })}
                placeholder="アップデート内容、新機能の利用方法、不具合修正内容などを記入してください。"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingRelease(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-md flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                全社へ配信する
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
