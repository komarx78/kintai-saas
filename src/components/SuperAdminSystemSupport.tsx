import { useState, useEffect } from 'react';
import { 
  HelpCircle, Inbox, Plus, Edit3, Trash2, 
  MessageSquare, Save, X, Search, Filter, Building2, 
  RefreshCw, Bell, Mail, Send, CheckCircle2, AlertCircle, 
  Copy, BellRing, ExternalLink, Check
} from 'lucide-react';
import { 
  type SystemFaqItem, 
  type SystemImprovementSuggestion, 
  type SystemReleaseNote,
  SYSTEM_FAQ_CATEGORIES, 
  SYSTEM_SUGGESTION_CATEGORIES, 
  SYSTEM_SUGGESTION_STATUSES,
  SYSTEM_GUIDE_PREVIEW_TYPES,
  fetchSystemFaqs, 
  saveSystemFaq, 
  deleteSystemFaq,
  fetchSystemSuggestions, 
  updateSystemSuggestionStatus,
  deleteSystemSuggestion,
  fetchSystemReleaseNotes,
  saveSystemReleaseNote
} from '../lib/systemSupportManager';
import {
  type SystemNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  fetchNotificationSettings,
  saveNotificationSettings,
  sendTestNotificationEmail,
  triggerDesktopNotification,
  GAS_MAIL_SCRIPT_TEMPLATE
} from '../lib/systemSupportNotification';

export function SuperAdminSystemSupport() {
  const [subTab, setSubTab] = useState<'suggestions' | 'faqs' | 'releases' | 'notifications'>('suggestions');

  // Suggestions State
  const [suggestions, setSuggestions] = useState<SystemImprovementSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'pending' | 'reviewing' | 'planned' | 'completed' | 'declined'>('all');
  const [replyingSuggestion, setReplyingSuggestion] = useState<SystemImprovementSuggestion | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<SystemImprovementSuggestion['status']>('reviewing');

  // Notifications & Email Settings State
  const [notificationSettings, setNotificationSettings] = useState<SystemNotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [recipientEmailsText, setRecipientEmailsText] = useState('');
  const [gasWebhookUrlText, setGasWebhookUrlText] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSavedAlert, setSettingsSavedAlert] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedGasScript, setCopiedGasScript] = useState(false);
  const [showGasScriptModal, setShowGasScriptModal] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

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
      const [sList, fList, rList, nSettings] = await Promise.all([
        fetchSystemSuggestions(),
        fetchSystemFaqs(),
        fetchSystemReleaseNotes(),
        fetchNotificationSettings()
      ]);
      setSuggestions(sList);
      setFaqs(fList);
      setReleases(rList);
      setNotificationSettings(nSettings);
      setRecipientEmailsText(nSettings.recipient_emails.join('\n'));
      setGasWebhookUrlText(nSettings.gas_webhook_url || '');
      if (nSettings.recipient_emails[0]) {
        setTestEmailAddress(nSettings.recipient_emails[0]);
      }
    } finally {
      setLoadingSuggestions(false);
      setLoadingFaqs(false);
    }
  };

  // 📧 通知設定の保存
  const handleSaveNotificationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const emails = recipientEmailsText
        .split(/[\n,]/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.includes('@'));

      const newSettings: SystemNotificationSettings = {
        ...notificationSettings,
        recipient_emails: emails.length > 0 ? emails : ['support@kap-cocotte.com'],
        gas_webhook_url: gasWebhookUrlText.trim()
      };

      await saveNotificationSettings(newSettings);
      setNotificationSettings(newSettings);
      setSettingsSavedAlert(true);
      setTimeout(() => setSettingsSavedAlert(false), 4000);
    } catch (err) {
      console.error(err);
      alert('通知設定の保存に失敗しました');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 🔔 テストメールの送信
  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      alert('テスト送信先のメールアドレスを正しく入力してください');
      return;
    }
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await sendTestNotificationEmail(testEmailAddress.trim(), gasWebhookUrlText.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '送信エラー' });
    } finally {
      setIsSendingTest(false);
    }
  };

  // 💻 デスクトップ通知許可リクエスト
  const handleEnableDesktopNotification = async () => {
    if (!('Notification' in window)) {
      alert('お使いのブラウザはデスクトップ通知に対応していません');
      return;
    }
    const perm = await Notification.requestPermission();
    setDesktopPermission(perm);
    if (perm === 'granted') {
      triggerDesktopNotification(
        '🔔 KAP勤怠 デスクトップ通知設定完了',
        '改善要望やQ&Aが届いた際にブラウザ通知でお知らせします。'
      );
    }
  };

  // 📋 GASスクリプトのコピー
  const handleCopyGasScript = () => {
    navigator.clipboard.writeText(GAS_MAIL_SCRIPT_TEMPLATE);
    setCopiedGasScript(true);
    setTimeout(() => setCopiedGasScript(false), 3000);
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

  // 📬 改善要望の削除
  const handleDeleteSuggestion = async (id: string) => {
    if (!window.confirm('この改善要望を削除しますか？')) return;
    await deleteSystemSuggestion(id);
    const updated = await fetchSystemSuggestions();
    setSuggestions(updated);
  };

  // 💡 FAQの保存
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq?.question || !editingFaq?.answer) return;
    await saveSystemFaq({
      id: editingFaq.id,
      category: (editingFaq.category as any) || 'kintai',
      question: editingFaq.question,
      answer: editingFaq.answer,
      keyword: editingFaq.keyword || '',
      preview_type: editingFaq.preview_type || '',
      html_preview: editingFaq.html_preview || ''
    });
    setEditingFaq(null);
    const updated = await fetchSystemFaqs();
    setFaqs(updated);
  };

  // 💡 FAQの削除
  const handleDeleteFaq = async (id: string) => {
    if (!window.confirm('この操作Q&Aを削除してもよろしいですか？全契約企業の画面からも除外されます。')) return;
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
      version: editingRelease.version || 'Ver 2.3.0',
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

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* 🔔 新着お知らせ・未対応アラートバナー */}
      {pendingCount > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white p-4 sm:p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shrink-0">
              <BellRing className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white text-rose-600 uppercase tracking-wider">
                  新着お知らせ
                </span>
                <span className="text-sm sm:text-base font-black">
                  未対応の改善要望・Q&Aが <strong className="text-amber-200 text-lg sm:text-xl underline decoration-amber-300 decoration-2">{pendingCount}</strong> 件届いています！
                </span>
              </div>
              <p className="text-xs text-white/90 mt-1">
                利用企業から届いた改善要望・操作質問です。内容を確認し、ステータス更新または返信対応を行ってください。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setSubTab('suggestions')}
              className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 font-black text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              今すぐ確認する
            </button>
            {desktopPermission !== 'granted' && (
              <button
                onClick={handleEnableDesktopNotification}
                className="px-3.5 py-2 bg-black/20 hover:bg-black/30 text-white font-bold text-xs rounded-xl border border-white/30 transition flex items-center gap-1.5 cursor-pointer"
                title="ブラウザのデスクトップ通知を有効化"
              >
                <Bell className="w-3.5 h-3.5" />
                デスクトップ通知ON
              </button>
            )}
          </div>
        </div>
      )}

      {/* ヘッダーバナー */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
            特権管理者専管（販売・開発統括）
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <HelpCircle className="w-7 h-7 text-indigo-400" />
            システム公式操作Q&A ＆ 改善要望回収デスク統制
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            各企業から届いた<strong>「システムへの改善要望・機能リクエスト」をこのSuperAdmin画面でのみ一元管理</strong>します。
            また、初心者がつまずきやすい<strong>「公式操作マニュアル・Q&A」</strong>を全契約企業へ配信・一括統制します。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => setSubTab('notifications')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border cursor-pointer ${
              subTab === 'notifications'
                ? 'bg-amber-500 text-white border-amber-400 shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            メール通知設定
          </button>

          <button
            onClick={loadAll}
            className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            最新データ再取得
          </button>
        </div>
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
          📬 全テナント改善要望ボックス（回収一覧）
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            subTab === 'suggestions' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
          }`}>
            {suggestions.length}件
          </span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500 text-white animate-pulse">
              未対応 {pendingCount}
            </span>
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

        <button
          onClick={() => setSubTab('notifications')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            subTab === 'notifications'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <Mail className="w-4 h-4 text-amber-600" />
          📧 メール通知 ＆ お知らせ設定
          {notificationSettings.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="通知有効" />
          )}
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
                各企業の従業員・管理者が「改善要望送信フォーム」から投稿すると、ここにリアルタイムで届きます。
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
                        {item.tenant_name || '企業名不明'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>送信者: <strong className="text-slate-800">{item.user_name}</strong></span>
                      <span>{new Date(item.created_at).toLocaleDateString('ja-JP')}</span>
                      <button
                        onClick={() => handleDeleteSuggestion(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition"
                        title="要望を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-black text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-700 mt-1.5 leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      {item.content}
                    </p>
                  </div>

                  {/* 社内メモ・回答 */}
                  {item.admin_reply && (
                    <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200/80 space-y-0.5">
                      <span className="text-[11px] font-bold text-indigo-900">開発メモ / 返答方針:</span>
                      <p className="text-xs text-indigo-950 whitespace-pre-line">{item.admin_reply}</p>
                    </div>
                  )}

                  {/* アクションボタン */}
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <a
                      href={`mailto:?subject=${encodeURIComponent(`【KAP勤怠】${item.tenant_name}様からの改善要望・Q&Aへのご案内（${item.title}）`)}&body=${encodeURIComponent(`【送信元企業】: ${item.tenant_name}\n【送信者】: ${item.user_name} 様\n【カテゴリ】: ${SYSTEM_SUGGESTION_CATEGORIES[item.category] || item.category}\n【タイトル】: ${item.title}\n\n【ご要望・質問内容】:\n${item.content}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n【KAP勤怠サポート本部より】\nいつもご利用ありがとうございます。\nいただいたご要望・ご質問につきまして、以下の通りご案内申し上げます。\n\n`)}`}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="メーラーを起動して返信下書きを作成"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      メーラーで返信
                    </a>

                    <button
                      onClick={() => {
                        setReplyingSuggestion(item);
                        setReplyText(item.admin_reply || '');
                        setReplyStatus(item.status);
                      }}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      ステータス更新・開発メモ記入
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
                <option value="all">すべてのカテゴリ ({faqs.length})</option>
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
              新規操作Q&Aを追加する
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

                  <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold shrink-0">A.</span>
                    <span className="whitespace-pre-line">{faq.answer}</span>
                  </div>
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
              ここで登録したアップデート情報は、<strong>全契約企業ポータルの「リリース情報」タブへ即時配信</strong>されます。
            </p>
            <button
              onClick={() => setEditingRelease({ version: 'Ver 2.3.0', title: '', content: '', category: 'update', released_at: new Date().toISOString().split('T')[0] })}
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

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* 📧 タブ④：メール通知 ＆ お知らせ自動化設定 */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'notifications' && (
        <div className="space-y-6 max-w-4xl">
          {/* 設定保存成功トースト */}
          {settingsSavedAlert && (
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-2xl text-xs font-bold border border-emerald-200 flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>通知設定を保存いたしました。次回より新しい要望・Q&Aが届いた際に設定先へ自動通知されます。</span>
            </div>
          )}

          {/* メイン設定カード */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                <Mail className="w-5 h-5 text-amber-500" />
                システム改善要望 ＆ Q&A受付 メール通知・お知らせ自動化設定
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                全国の契約企業・現場スタッフから新しい改善要望やQ&A問い合わせが投稿された際、
                管理者のメールアドレス宛てにメール通知を自動配信する設定です。
                Google Apps Script (GAS) Webhook と連携することで、ご自身のGmailから確実に綺麗なHTMLメールが自動送信されます。
              </p>
            </div>

            <form onSubmit={handleSaveNotificationSettings} className="space-y-6">
              {/* 有効・無効スイッチ */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <div className="font-bold text-sm text-slate-800">新着メール通知機能</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    要望やQ&Aが届いた際に、登録メールアドレス宛てに自動でメール通知を送信します。
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.enabled}
                    onChange={e => setNotificationSettings({ ...notificationSettings, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* 通知先メールアドレス */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>📧 通知先メールアドレス（受信アドレス）</span>
                  <span className="text-[11px] font-normal text-slate-400">複数指定可（改行またはカンマ区切り）</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={recipientEmailsText}
                  onChange={e => setRecipientEmailsText(e.target.value)}
                  placeholder="例: komai@kap-cocotte.com&#10;support@kap-cocotte.com"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  新しい要望やQ&Aが投稿された際、上記のアドレスすべてにメール通知が届きます。
                </p>
              </div>

              {/* Google Apps Script (GAS) Webhook URL 設定 */}
              <div className="p-5 bg-gradient-to-br from-amber-50/60 to-orange-50/40 rounded-2xl border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-amber-500 text-white text-[10px] font-black">推奨</span>
                    Google Apps Script (GAS) Webhook URL
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGasScriptModal(true)}
                    className="text-xs text-amber-700 hover:text-amber-900 font-bold underline flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    GAS送信コードを見る・コピー
                  </button>
                </div>

                <input
                  type="url"
                  value={gasWebhookUrlText}
                  onChange={e => setGasWebhookUrlText(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-amber-800/80 leading-relaxed">
                  GASのウェブアプリとしてデプロイしたURL（末尾が <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono font-bold">/exec</code>）を貼り付けると、GAS経由でGmailから高品位なHTMLメールが自動送信されます。
                </p>
              </div>

              {/* 保存ボタン */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingSettings ? '保存中...' : '通知設定を保存する'}
                </button>
              </div>
            </form>
          </div>

          {/* 🔔 テスト送信・動作確認カード */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-600" />
              🔔 メール送信の動作確認（テスト送信）
            </h4>
            <p className="text-xs text-slate-500">
              設定したGAS Webhook URLおよび受信先アドレスへ、実際にテスト通知メールが届くか今すぐ確認できます。
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="email"
                value={testEmailAddress}
                onChange={e => setTestEmailAddress(e.target.value)}
                placeholder="テスト送信先メールアドレス"
                className="w-full sm:flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest || !testEmailAddress}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {isSendingTest ? 'テスト送信中...' : 'テストメールを送信'}
              </button>
            </div>

            {testResult && (
              <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center gap-2.5 animate-fade-in ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── モーダル：改善要望のステータス更新・開発メモ ─── */}
      {replyingSuggestion && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                改善要望ステータス更新 ＆ 開発メモ
              </h3>
              <button onClick={() => setReplyingSuggestion(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">
                【{replyingSuggestion.tenant_name}】{replyingSuggestion.title}
                <span className="ml-2 font-normal text-slate-500">（送信者: {replyingSuggestion.user_name}）</span>
              </div>
              <p className="text-slate-600 line-clamp-3 whitespace-pre-line">{replyingSuggestion.content}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">開発・検討ステータス</label>
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
                  開発元メモ / 対応方針
                </label>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="例: Ver 2.4アップデートにて実装予定。カレンダーUIのドラッグ＆ドロップ対応を進める。"
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
                ステータスを更新する
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
                <label className="block text-xs font-bold text-slate-700 mb-1">対象カテゴリ</label>
                <select
                  value={editingFaq.category || 'kintai'}
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
                <label className="block text-xs font-bold text-slate-700 mb-1">操作手順・解決方法 (Answer)</label>
                <textarea
                  required
                  rows={4}
                  value={editingFaq.answer || ''}
                  onChange={e => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                  placeholder="初心者が迷わないよう、具体的な画面名や操作ステップ（1. 2. 3.）を丁寧に記入してください。"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    📱 画面UIプレビュー種別（自動貼り付け）
                  </label>
                  <select
                    value={editingFaq.preview_type || ''}
                    onChange={e => setEditingFaq({ ...editingFaq, preview_type: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">✨ 自動判定（カテゴリ・キーワードから自動選択）</option>
                    {Object.entries(SYSTEM_GUIDE_PREVIEW_TYPES).map(([pk, plabel]) => (
                      <option key={pk} value={pk}>{plabel}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">未選択の場合は質問内容から最適な画面を自動表示します</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    検索キーワード
                  </label>
                  <input
                    type="text"
                    value={editingFaq.keyword || ''}
                    onChange={e => setEditingFaq({ ...editingFaq, keyword: e.target.value })}
                    placeholder="例: 打刻 出勤 退勤 修正"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>💻 カスタムHTML画面コード（任意・上書き用）</span>
                  <span className="text-[10px] text-slate-400 font-normal">HTMLを直接貼り付けて表示したい場合に入力</span>
                </label>
                <textarea
                  rows={3}
                  value={editingFaq.html_preview || ''}
                  onChange={e => setEditingFaq({ ...editingFaq, html_preview: e.target.value })}
                  placeholder="<div class='...'>実際の画面HTMLコード</div>"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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

      {/* ─── モーダル：GASスクリプトの表示・コピー ─── */}
      {showGasScriptModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500 rounded-xl text-white">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Google Apps Script (GAS) 自動メール送信スクリプト
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gmailから高品位なHTMLメールを自動配信するためのGASコードです
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGasScriptModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1.5 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black">1</span>
                  設定手順（わずか1分で完了）
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-amber-800">
                  <li><a href="https://script.google.com" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900">Google Apps Script (script.google.com)</a> を開き、「新しいプロジェクト」を作成</li>
                  <li>エディタの内容を全消去し、下のコードをそのまま貼り付けて保存（Ctrl + S）</li>
                  <li>画面右上の<strong>「デプロイ」＞「新しいデプロイ」</strong>をクリック</li>
                  <li>歯車アイコンから<strong>「ウェブアプリ」</strong>を選択し、以下の通り設定：
                    <ul className="list-disc pl-4 mt-0.5 font-bold">
                      <li>次のユーザーとして実行: <strong>自分</strong></li>
                      <li>アクセスできるユーザー: <strong>全員 (Anyone)</strong></li>
                    </ul>
                  </li>
                  <li>「デプロイ」を押し、発行された<strong>「ウェブアプリのURL」</strong>をコピーして本画面のURL欄に貼り付けて保存！</li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 font-mono">コード (Code.gs)</span>
                  <button
                    onClick={handleCopyGasScript}
                    className="px-3 py-1 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedGasScript ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        コピーしました！
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        コードを全コピー
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-72 leading-relaxed border border-slate-800">
                  {GAS_MAIL_SCRIPT_TEMPLATE}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                ※ GAS経由のため外部メールサーバー料金不要・完全無料でご利用いただけます。
              </span>
              <button
                onClick={() => setShowGasScriptModal(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
