import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, X, Send, Sparkles, HelpCircle, ChevronRight, 
  ExternalLink, ShieldCheck
} from 'lucide-react';
import { DEFAULT_SYSTEM_FAQS } from '../lib/systemSupportManager';
import { askSystemOperationAI, getResolvedGeminiApiKey } from '../lib/gemini';

interface FloatingSupportAssistantProps {
  tenantId?: string | null;
  userName?: string;
  role?: string;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
  suggestedAction?: {
    label: string;
    path: string;
  };
}

// 労務制度・公的帳票・有給基準のオフライン完全知識辞書（Geminiキーなしでも100%即答）
const LABOR_KNOWLEDGE_BASE = [
  {
    keywords: ['有給', '有休', '付与', '日数', 'いつ', 'タイミング', '比例付与', '基準'],
    question: '有給休暇の付与基準と日数は？',
    answer: `【有給休暇の法定付与基準（労働基準法第39条）】\n\n1. 一般従業員（週30時間以上または週5日勤務）:\n・入社半年後：10日\n・1年6ヶ月後：11日\n・2年6ヶ月後：12日\n・3年6ヶ月後：14日\n・4年6ヶ月後：16日\n・5年6ヶ月後：18日\n・6年6ヶ月以降：20日（最高限度）\n\n2. パート・アルバイト（週所定労働日数が4日以下かつ週30時間未満）:\n所定労働日数に応じた「比例付与」が法律で定められています。\n\n本システムでは、従業員の入社年月日から有給付与日・付与日数を100%全自動計算し、該当日を迎えると自動で保有残数へ加算されます。`,
    action: { label: '🌴 有給残数・申請画面へ', path: '/kintai/user' }
  },
  {
    keywords: ['打刻', '忘れ', '修正', '押し忘れ', '時間変更', '間違え'],
    question: '打刻を忘れた・間違えた場合の修正方法は？',
    answer: `【打刻修正の手順】\n\n1. 「月次勤怠・有給照会」画面を開きます。\n2. 月間カレンダーから、修正したい該当日を探します。\n3. 行の右端にある青い「申請する」ボタンをクリックします。\n4. 申請種類「打刻修正」を選び、正しい出勤・退勤時刻、休憩時間を入力して「申請を送信」します。\n5. 管理者が承認すると、勤怠実績が自動的に正しく修正されます。`,
    action: { label: '⏰ 月次勤怠・照会画面へ', path: '/kintai/user' }
  },
  {
    keywords: ['離職票', '取得届', '喪失届', 'ハローワーク', '公的書類', '書類', '帳票', '原本', '雇用保険'],
    question: '離職票や雇用保険の届出書類はどうやって出力しますか？',
    answer: `【官公庁届出書類（A4原本）の出力手順】\n\n1. 管理者メニュー「📁 入退社労務管理」を開きます。\n2. 該当する従業員の「書類キャビネット」または「法定帳票発行センター」をクリックします。\n3. 「雇用保険被保険者資格取得届」「資格喪失届」「離職証明書（離職票）」など希望の書類を選択します。\n4. システムに蓄積された勤怠・給与・入社情報が原本へ自動転記されていますので、右上の「印刷 (PDF)」を押すだけでA4原本に完全ジャスト座標で印字・出力されます。`,
    action: { label: '📁 入退社労務書類管理へ', path: '/onboarding/admin' }
  },
  {
    keywords: ['産休', '育休', '産前産後', '育児休業', '出産', '母子手帳'],
    question: '産前産後休業・育児休業の手続き方法は？',
    answer: `【産休・育休の申請＆手続き手順】\n\n1. 管理者側: 労務キャビネットまたは入退社管理の「👶 産休・育休」タブから「📱 社員に専用URLを送付」をクリックし、LINEやメールで案内を送ります。\n2. 社員側: スマホで送られてきたURLを開き、出産予定日を入力（産前・産後・育休期間が法定自動計算されます）。母子手帳の写真を撮って送信します。\n3. 管理者側: 届いた申請をワンクリック承認すると、公式申請書4枚へ自動反映されます。`,
    action: { label: '👶 産休・育休申請ステーションへ', path: '/maternity/apply' }
  },
  {
    keywords: ['給与', '明細', '計算', '介護保険', '手取り', 'Web明細'],
    question: '給与計算や給与明細の発行方法は？',
    answer: `【給与計算とWeb明細の発行手順】\n\n1. 管理者画面の「💰 給与計算管理」を開きます。\n2. 「勤怠から一括自動計算」ボタンを押すと、当月の労働時間・残業・控除が瞬時に計算されます（大元の生年月日から40歳以上の介護保険対象も自動判定）。\n3. 金額を確認後、「給与確定・Web公開」をクリックすると、全従業員のスマホ・PCマイページへWeb給与明細が即時配信されます。`,
    action: { label: '💰 給与計算ダッシュボードへ', path: '/payroll/admin' }
  },
  {
    keywords: ['シフト', '希望', '提出', '募集', '必要人数'],
    question: 'シフトの希望提出と作成手順は？',
    answer: `【シフト機能の使い方】\n\n1. スタッフ側: 「シフト申請」画面から、スマホのカレンダーで希望の日時や休みをタップして送信します。\n2. 管理者側: 「シフト管理」画面を開くと、全スタッフの希望と「時間帯別の必要人数」が自動突合され、人手不足が色別アラートで表示されます。\n3. 調整後「確定Publish」を押すだけで全スタッフに共有されます。`,
    action: { label: '📅 シフト管理画面へ', path: '/shift/admin' }
  }
];

export const FloatingSupportAssistant: React.FC<FloatingSupportAssistantProps> = ({
  tenantId,
  userName,
  role
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初期化：APIキーの確認とウェルカムメッセージ
  useEffect(() => {
    const init = async () => {
      const key = await getResolvedGeminiApiKey(tenantId || undefined);
      setApiKeyAvailable(!!key);

      const roleLabel = role === 'admin' || role === 'superadmin' ? '管理者' : '従業員';
      const initialMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `こんにちは、${userName || roleLabel}様！🤖\n【KAP 労務・操作AIアシスタント】です。\n\nシステムの操作手順、有給の付与基準、帳票の出し方、各種申請など、お困りごとは何でもお尋ねください。24時間365日即座にご案内いたします。`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([initialMessage]);
    };
    init();
  }, [tenantId, userName]);

  // メッセージスクロール
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // 質問処理（ハイブリッド：Gemini AI ＋ オフライン辞書フォールバック）
  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      // 1. まずローカルナレッジベースから最適一致を探索（超高速＆確実）
      const lower = textToSend.toLowerCase();
      const matchedKnowledge = LABOR_KNOWLEDGE_BASE.find(kb => 
        kb.keywords.some(kw => lower.includes(kw.toLowerCase()))
      );

      // 2. FAQ一覧からも関連するQ&Aを探索
      const matchedFaq = DEFAULT_SYSTEM_FAQS.find(f => 
        f.question.toLowerCase().includes(lower) || 
        f.keyword.toLowerCase().includes(lower)
      );

      let replyContent = '';
      let suggestedAction: { label: string; path: string } | undefined = undefined;

      // Gemini APIが利用可能な場合
      if (apiKeyAvailable) {
        // FAQナレッジをプロンプトに統合
        const knowledgeText = DEFAULT_SYSTEM_FAQS.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
        const aiAnswer = await askSystemOperationAI(textToSend, knowledgeText, tenantId || undefined);
        replyContent = aiAnswer;
        if (matchedKnowledge?.action) {
          suggestedAction = matchedKnowledge.action;
        }
      } else {
        // オフライン・フォールバック回答（Geminiキー未設定でも100%即答）
        if (matchedKnowledge) {
          replyContent = `${matchedKnowledge.answer}\n\n💡 ご案内画面への移動は下記のボタンから直接行えます。`;
          suggestedAction = matchedKnowledge.action;
        } else if (matchedFaq) {
          replyContent = `【回答】\n${matchedFaq.answer}`;
          suggestedAction = { label: '該当画面を確認する', path: '/kintai/user' };
        } else {
          replyContent = `ご質問ありがとうございます！\n\n該当の操作については、以下のクイックガイドまたは各業務メニューよりご確認いただけます。\n\n・打刻修正：左メニュー「月次勤怠・有給照会」➔「申請する」\n・有給申請：左メニュー「各種申請」\n・離職票等の公的原本：管理者メニュー「入退社労務管理」\n・給与明細：メニュー「給与明細」\n\n※具体的な法律上の判断や例外対応につきましては、自社の管理者様または顧問社労士・税理士の先生へご確認ください。`;
        }
      }

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedAction
      };

      setMessages([...updatedMessages, assistantMsg]);
    } catch (err: any) {
      setMessages([
        ...updatedMessages,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '申し訳ありません。一時的なエラーが発生いたしました。画面上のクイック質問ボタンをお試しいただくか、FAQ一覧をご確認ください。',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickChips = [
    { label: '⏰ 打刻忘れ・修正', query: '打刻を忘れてしまった場合の修正方法は？' },
    { label: '🌴 有給の付与日数・基準', query: '有給休暇の付与基準と日数を教えてください。' },
    { label: '📄 離職票・公的書類の出力', query: '離職票や雇用保険の届出書類はどうやって出力しますか？' },
    { label: '👶 産休・育休の申請方法', query: '産前産後休業・育児休業の手続き方法を教えてください。' },
    { label: '💰 給与計算・Web明細', query: '給与計算や給与明細の発行・確認方法は？' },
    { label: '📅 シフト希望の提出', query: 'シフトの希望提出と作成手順を教えてください。' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans print:hidden">
      {/* ─── 最小化時：フローティング起動ボタン ─── */}
      {!isOpen && (
        <div className="relative group">
          <button
            onClick={() => setIsOpen(true)}
            aria-label="AIサポートデスクを開く"
            className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/20"
          >
            <div className="relative">
              <Bot className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
            </div>
            <div className="text-left pr-1">
              <div className="text-xs font-bold leading-none tracking-wide text-blue-100 flex items-center gap-1">
                <span>24h即答</span>
                <span className="bg-emerald-500 text-white text-[9px] px-1 py-0.5 rounded font-mono">AI</span>
              </div>
              <div className="text-sm font-extrabold tracking-wide mt-0.5">操作・労務AI相談</div>
            </div>
          </button>
          {/* 初回ホバー時のツールチップ */}
          <div className="absolute bottom-full right-0 mb-3 w-64 p-3 bg-slate-900/95 text-white text-xs rounded-xl shadow-xl border border-slate-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="font-bold text-blue-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 迷ったらAIに質問！
            </div>
            操作方法や有給ルール、離職票の出し方など、なんでも一瞬で回答します。
          </div>
        </div>
      )}

      {/* ─── 展開時：AIサポートチャットウィンドウ ─── */}
      {isOpen && (
        <div className="w-[390px] sm:w-[420px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* ヘッダー */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Bot className="w-5 h-5 text-blue-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold tracking-tight">KAP 労務・操作AIコンシェルジュ</h3>
                  <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-medium border border-emerald-400/30">稼働中</span>
                </div>
                <p className="text-[11px] text-blue-200">操作手順・有給基準・公的原本の出し方を即答</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* チャットメッセージエリア */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 text-slate-800 text-xs sm:text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none leading-relaxed'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  
                  {/* アクション誘導ボタン（該当画面へ1クリックジャンプ） */}
                  {msg.suggestedAction && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <button
                        onClick={() => {
                          navigate(msg.suggestedAction!.path);
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 transition-colors text-xs"
                      >
                        <span className="flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" />
                          {msg.suggestedAction.label}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className={`text-[10px] mt-1.5 text-right ${
                    msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                  }`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <Sparkles className="w-3.5 h-3.5 animate-bounce text-blue-600" />
                    <span>AIがマニュアル・法令知識を検索中...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* クイック質問チップ（タップですぐ回答） */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 overflow-x-auto">
            <div className="text-[10px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-blue-500" /> よくある質問（タップで即答）:
            </div>
            <div className="flex gap-1.5 no-scrollbar pb-1">
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip.query)}
                  disabled={isLoading}
                  className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-[11px] rounded-full border border-slate-200 transition-colors disabled:opacity-50"
                >
                  {chip.label}
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
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="質問を入力（例: 有給の申請方法は？）"
              className="flex-1 px-3.5 py-2.5 bg-slate-100 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl flex items-center justify-center shadow-md transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* 免責・安心バナー */}
          <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200/80 text-[10px] text-slate-500 text-center flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>24時間AI自律回答。個別労務判断は顧問社労士・税理士へご相談ください。</span>
          </div>
        </div>
      )}
    </div>
  );
};
