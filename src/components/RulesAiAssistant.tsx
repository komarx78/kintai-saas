import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { askEmploymentRulesAI, type ChatMessage } from '../lib/gemini';
import { DEFAULT_EMPLOYMENT_RULES } from '../lib/defaultRules';
import { 
  Bot, Send, Sparkles, BookOpen, RefreshCw, User, HelpCircle, 
  ChevronDown, ChevronUp, ShieldCheck 
} from 'lucide-react';

interface RulesAiAssistantProps {
  tenantId?: string | null;
  userName?: string;
}

export const RulesAiAssistant: React.FC<RulesAiAssistantProps> = ({ tenantId, userName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `こんにちは、${userName || '従業員'}さん！🤖\n社内規定・就業規則AIアシスタントです。\n\n有給休暇のルール、慶弔休暇（忌引き・結婚）、勤務時間、副業、育休など、社内の規則について何でも気軽にお尋ねください。`
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [companyRules, setCompanyRules] = useState<string>(DEFAULT_EMPLOYMENT_RULES);
  const [tenantApiKey, setTenantApiKey] = useState<string>('');
  const [showFullRules, setShowFullRules] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 就業規則 & テナントAPIキーの取得（DBまたはLocalStorage）
  useEffect(() => {
    const fetchRules = async () => {
      // 1. ローカルストレージフォールバック即時設定
      const saved = localStorage.getItem(`company_employment_rules_${tenantId}`) || localStorage.getItem('company_employment_rules');
      if (saved) setCompanyRules(saved);
      const savedKey = localStorage.getItem(`gemini_api_key_${tenantId}`) || localStorage.getItem('gemini_api_key_custom');
      if (savedKey) setTenantApiKey(savedKey);

      if (!tenantId) return;

      try {
        const { data, error } = await supabase
          .from('company_rules')
          .select('content, gemini_api_key')
          .eq('tenant_id', tenantId)
          .eq('title', '就業規則')
          .maybeSingle();

        if (data && !error && data.content) {
          setCompanyRules(data.content);
          if (data.gemini_api_key) setTenantApiKey(data.gemini_api_key);
        }
      } catch (e) {
        // テーブル未作成時もデフォルト値で自動稼働
      }
    };
    fetchRules();
  }, [tenantId]);

  // メッセージ追加時の自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: textToSend }
    ];
    setMessages(newMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      const aiResponse = await askEmploymentRulesAI(textToSend, companyRules, newMessages, tenantApiKey);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: aiResponse }
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    { label: '🏖️ 有給は何日前までに申請？', query: '有給休暇は何日前までに申請が必要ですか？' },
    { label: '💍 慶弔休暇（結婚・忌引き）の日数', query: '慶弔休暇（結婚や忌引き）は何日もらえますか？' },
    { label: '💼 副業・兼業のルール', query: '副業や兼業は認められていますか？条件はありますか？' },
    { label: '👶 育児休業・産後パパ育休', query: '育児休業や産後パパ育休の規定を教えてください。' },
    { label: '⏰ 残業や時間外労働のルール', query: '時間外労働（残業）の割増賃金やルールはどうなっていますか？' },
    { label: '🚪 退職手続きの期限', query: '退職する場合は何日前に届け出が必要ですか？' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[750px] max-h-[85vh]">
      
      {/* 上部ヘッダー */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 p-4 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white ring-1 ring-white/30 shadow-inner">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight">社内規定・就業規則 AIアシスタント</h2>
              <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Gemini 3.5 Flash AI
              </span>
            </div>
            <p className="text-[11px] text-blue-100/80 font-medium">
              自社の就業規則・服務規律に基づいて24時間いつでも即答します
            </p>
          </div>
        </div>

        {/* 就業規則プレビューボタン */}
        <button
          type="button"
          onClick={() => setShowFullRules(!showFullRules)}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 transition cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          {showFullRules ? '規則を閉じる' : '就業規則全文'}
          {showFullRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 就業規則 全文アコーディオン（展開時） */}
      {showFullRules && (
        <div className="bg-slate-50 border-b border-slate-200 p-4 max-h-60 overflow-y-auto shrink-0 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              現在登録されている就業規則
            </span>
            <span className="text-[10px] text-slate-400 font-medium">※管理画面の会社設定から変更可能</span>
          </div>
          <pre className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
            {companyRules}
          </pre>
        </div>
      )}

      {/* チャットメッセージ表示エリア */}
      <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Bot className="w-5 h-5" />
              </div>
            )}

            <div 
              className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-2xs ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none font-medium' 
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none leading-relaxed'
              }`}
            >
              <div className="text-xs md:text-sm whitespace-pre-wrap font-sans">
                {msg.content}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <User className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start animate-in fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div className="bg-white text-slate-600 border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-2xs flex items-center gap-2 text-xs font-bold">
              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              就業規則を参照して回答を作成中...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* よくある質問クイックボタン */}
      <div className="p-3 bg-white border-t border-slate-100 shrink-0">
        <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
          よくある質問をワンタップで聞く：
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q.query)}
              disabled={isLoading}
              className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* 入力フォーム */}
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="就業規則や社内ルールについて質問を入力...（例: 慶弔休暇は何日？）"
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-2.5 px-4 rounded-xl font-black text-sm shadow-md shadow-blue-600/20 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">送信</span>
        </button>
      </form>

    </div>
  );
};
