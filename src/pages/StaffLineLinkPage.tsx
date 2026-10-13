import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CheckCircle2, Copy, Check, MessageSquare, 
  ExternalLink, RefreshCw, AlertCircle, Sparkles, ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  generateOrFetchLinePin, 
  RAKUMARU_OFFICIAL_LINE_CONSTANTS,
  getTenantLineConfig
} from '../lib/lineMessaging';

/**
 * 📱 既存・新人スタッフ専用 10秒LINEワンタップ連携ページ (StaffLineLinkPage)
 * （URL: /line-link?tid=xxx&uid=yyy）
 * 
 * 現場スタッフがスマホでタップした瞬間、1秒で直感理解・ワンタップでLINEが開き送信完了できる至高画面
 */
export default function StaffLineLinkPage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tid') || searchParams.get('tenant_id') || '';
  const userId = searchParams.get('uid') || searchParams.get('user_id') || '';

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isLinked, setIsLinked] = useState<boolean>(false);
  const [lineDisplayName, setLineDisplayName] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  const config = getTenantLineConfig(tenantId);
  const basicId = (config.mode === 'own_official' && config.ownAccountName)
    ? (config.rakumaruBasicId || RAKUMARU_OFFICIAL_LINE_CONSTANTS.basicId)
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.basicId;
  const qrCodeUrl = (config.mode === 'own_official' && config.ownQrCodeUrl) 
    ? config.ownQrCodeUrl 
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.qrCodeUrl;
  const accountName = config.mode === 'own_official' && config.ownAccountName
    ? config.ownAccountName
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.accountName;

  // 1. 初期ロード
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setErrorMsg('スタッフ認証パラメータが不足しています。店長から共有されたURLを再度ご確認ください。');
      return;
    }

    let isMounted = true;
    setLoading(true);

    const initData = async () => {
      try {
        // スタッフ情報取得
        const { data: user, error: uErr } = await supabase
          .from('users')
          .select('name, is_line_linked, line_user_id, line_display_name, tenant_id')
          .eq('id', userId)
          .maybeSingle();

        if (uErr || !user) {
          if (isMounted) setErrorMsg('スタッフ情報が見つかりませんでした。');
          return;
        }

        if (isMounted) {
          setUserName(user.name || 'スタッフ');
          setIsLinked(!!(user.line_user_id || user.is_line_linked));
          setLineDisplayName(user.line_display_name || null);
        }

        // テナント名取得
        const effectiveTid = tenantId || user.tenant_id;
        if (effectiveTid) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', effectiveTid)
            .maybeSingle();
          if (isMounted && tenant) {
            setCompanyName(tenant.name || '');
          }
        }

        // 未連携の場合、PINコードを取得・発行
        if (!user.line_user_id && !user.is_line_linked) {
          const pinRes = await generateOrFetchLinePin(userId);
          if (isMounted && pinRes.success && pinRes.pin) {
            setPin(pinRes.pin);
            setExpiresAt(pinRes.expiresAt || '');
          }
        }
      } catch (err: any) {
        if (isMounted) setErrorMsg(err?.message || '通信エラーが発生しました');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initData();

    return () => {
      isMounted = false;
    };
  }, [tenantId, userId]);

  // 2. リアルタイム完了検知（ポーリング：LINE送信後1〜2秒で自動切り替え）
  useEffect(() => {
    if (!userId || isLinked) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('is_line_linked, line_user_id, line_display_name')
          .eq('id', userId)
          .maybeSingle();

        if (user && (user.line_user_id || user.is_line_linked)) {
          setIsLinked(true);
          setLineDisplayName(user.line_display_name || '連携完了済アカウント');
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      } catch (_) {}
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [userId, isLinked]);

  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🚀 LINEディープリンク（メッセージ欄に4桁PINが自動入力された状態でLINEを開くURL）
  const cleanBasicId = basicId.replace(/^@/, '');
  const lineDeeplinkUrl = `https://line.me/R/oaMessage/@${cleanBasicId}/?${encodeURIComponent(pin)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in duration-200">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-6 text-white text-center shadow-md">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            公式LINE 連携手続き
          </h1>
          <p className="text-xs text-emerald-100 mt-1 font-medium">
            {companyName ? `【${companyName}】` : ''}
            {userName ? `${userName} 様` : 'スタッフ様専用'}
          </p>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-6 bg-slate-50/50">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-600">連携情報を確認中...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 text-rose-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <div className="text-xs space-y-1">
                <p className="font-bold">エラーが発生しました</p>
                <p className="text-rose-700">{errorMsg}</p>
              </div>
            </div>
          ) : isLinked ? (
            /* 連携完了済みUI */
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-200">
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-3xl space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    LINE連携が完了しています 🎉
                  </h2>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    今後、【Web給与明細】の発行通知や【確定シフト】の連絡が、あなたのLINEへ自動で届きます。
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs flex items-center justify-between">
                  <span className="text-slate-500 font-medium">連携LINEアカウント:</span>
                  <span className="font-bold text-emerald-800">
                    {lineDisplayName || '連携完了済アカウント'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-left space-y-1.5">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  安心のセキュリティ設計
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  ※ 店長や社員の個人LINEは使用せず、会社の公式通知アカウントから直接あなたのアカウントへ安全に配信されます。
                </p>
              </div>
            </div>
          ) : (
            /* 未連携：ワンタップLINE起動 ＆ フェイルセーフUI */
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  たった1タップで完了！
                </span>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  下の緑のボタンを押して、LINEが開いたらそのまま【送信】を押すだけで完了します。
                </p>
              </div>

              {/* 🚀 メインアクション：ワンタップLINE起動ボタン */}
              <a
                href={lineDeeplinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 bg-[#06C755] hover:bg-[#05b34c] text-white font-black text-base rounded-2xl shadow-lg shadow-emerald-500/25 transition transform active:scale-98 flex items-center justify-center gap-3 no-underline text-center"
              >
                <ExternalLink className="w-5 h-5" />
                <span>👉 公式LINEを開いて連携する</span>
              </a>

              {/* 🛡️ 二重防壁・フェイルセーフ案内カード */}
              <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    あなたの専用認証コード
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {expiresAt ? `${new Date(expiresAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} まで有効` : '48時間有効'}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <div className="text-3xl font-extrabold tracking-widest text-emerald-700 font-mono bg-emerald-50 px-6 py-2.5 rounded-xl border border-emerald-300 shadow-inner select-all">
                    {pin || '----'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="p-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-sm active:scale-95 flex items-center gap-1 text-xs font-bold"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">コピー済</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>コピー</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  <p className="font-bold">⚠️ 万が一、LINEを開いた時に文字が入っていない場合：</p>
                  <p className="mt-0.5">
                    LINEのトーク画面で、上記の4桁コード【<strong className="text-amber-950 font-mono font-bold text-xs">{pin}</strong>】をそのまま打って送信してください。
                  </p>
                </div>
              </div>

              {/* QRコード（PC等で開いている時用） */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 flex items-center justify-center">
                  <img
                    src={qrCodeUrl}
                    alt="公式LINE QRコード"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-800">PCでご覧の方はこちら</p>
                  <p className="text-[11px] leading-relaxed">
                    スマホのカメラで左のQRコードを読み取って【{accountName}】を開いてください。
                  </p>
                </div>
              </div>

              {/* リアルタイム監視待機バッジ */}
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-center justify-center space-x-2 text-xs text-emerald-700 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>トーク送信後、1〜2秒で自動的に完了へ切り替わります</span>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-3.5 bg-slate-100/80 border-t border-slate-200 text-center text-[11px] text-slate-400">
          みんなのらくまる労務 © 公式LINE通知連携システム
        </div>
      </div>
    </div>
  );
}
