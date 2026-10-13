import React, { useState, useEffect, useRef } from 'react';
import { 
  X, CheckCircle2, Copy, Check, MessageSquare, 
  ExternalLink, RefreshCw, AlertCircle, Unlink, Sparkles, ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  generateOrFetchLinePin, 
  unlinkStaffLineInDb, 
  RAKUMARU_OFFICIAL_LINE_CONSTANTS,
  getTenantLineConfig
} from '../lib/lineMessaging';

interface LineLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  tenantId?: string | null;
  onLinkedSuccess?: () => void;
}

/**
 * 📱 スタッフ専用 LINE公式アカウント ワンタイムPIN連携モーダル
 * （現場スタッフが1秒で直感理解・LINEトークに4桁の数字を送るだけで自動連携）
 */
export const LineLinkModal: React.FC<LineLinkModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  tenantId,
  onLinkedSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isLinked, setIsLinked] = useState<boolean>(false);
  const [lineDisplayName, setLineDisplayName] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [unlinking, setUnlinking] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  const config = getTenantLineConfig(tenantId);
  const qrCodeUrl = (config.mode === 'own_official' && config.ownQrCodeUrl) 
    ? config.ownQrCodeUrl 
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.qrCodeUrl;
  const addFriendUrl = (config.mode === 'own_official' && config.ownAddFriendUrl) 
    ? config.ownAddFriendUrl 
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.addFriendUrl;
  const accountName = config.mode === 'own_official' && config.ownAccountName
    ? config.ownAccountName
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.accountName;

  // 1. 初期データロード
  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const checkLinkAndFetchPin = async () => {
      try {
        // 実DBから現在の連携状態を確認
        const { data: user, error: selErr } = await supabase
          .from('users')
          .select('is_line_linked, line_user_id, line_display_name, line_link_pin, line_link_pin_expires_at')
          .eq('id', userId)
          .maybeSingle();

        if (selErr) {
          console.warn('LineLinkModal fetch user err:', selErr);
        }

        const linked = !!(user?.line_user_id || user?.is_line_linked);
        if (!isMounted) return;

        setIsLinked(linked);
        setLineDisplayName(user?.line_display_name || null);

        if (!linked) {
          // 未連携の場合、PINコードを発行または取得
          const pinRes = await generateOrFetchLinePin(userId);
          if (isMounted) {
            if (pinRes.success && pinRes.pin) {
              setPin(pinRes.pin);
              setExpiresAt(pinRes.expiresAt || '');
            } else {
              setErrorMsg(pinRes.error || 'PINコードの生成に失敗しました');
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err?.message || '通信エラーが発生しました');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkLinkAndFetchPin();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  // 2. リアルタイム連携検知（自動ポーリング：スタッフがLINEへPIN送信した瞬間に自動検知）
  useEffect(() => {
    if (!isOpen || !userId || isLinked) {
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
          setLineDisplayName(user.line_display_name || 'LINE連携アカウント');
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (onLinkedSuccess) {
            onLinkedSuccess();
          }
        }
      } catch (_) {}
    }, 2500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, userId, isLinked, onLinkedSuccess]);

  if (!isOpen) return null;

  // PINコピー処理
  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 連携解除処理
  const handleUnlink = async () => {
    if (!window.confirm(`「${userName}」様のLINE連携を解除しますか？\n解除後はLINEへの自動シフト・給与明細通知が停止します。`)) {
      return;
    }
    setUnlinking(true);
    try {
      await unlinkStaffLineInDb(userId);
      setIsLinked(false);
      setLineDisplayName(null);
      // 新しいPINを即座に再発行
      const pinRes = await generateOrFetchLinePin(userId);
      if (pinRes.success && pinRes.pin) {
        setPin(pinRes.pin);
        setExpiresAt(pinRes.expiresAt || '');
      }
      if (onLinkedSuccess) {
        onLinkedSuccess();
      }
    } catch (e: any) {
      alert(`連携解除に失敗しました: ${e?.message}`);
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-4 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                公式LINE 自動連携
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                対象スタッフ: <span className="text-white font-bold">{userName}</span> 様
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ボディ */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600">LINE連携情報を確認中...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600" />
              <div className="text-sm">
                <p className="font-bold">連携情報の取得に失敗しました</p>
                <p className="text-xs mt-1 text-rose-700">{errorMsg}</p>
                <button
                  onClick={() => {
                    setLoading(true);
                    setErrorMsg(null);
                    generateOrFetchLinePin(userId).then(res => {
                      if (res.success && res.pin) {
                        setPin(res.pin);
                        setExpiresAt(res.expiresAt || '');
                      }
                      setLoading(false);
                    });
                  }}
                  className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
                >
                  再試行する
                </button>
              </div>
            </div>
          ) : isLinked ? (
            /* 連携完了済みUI */
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-400 rounded-2xl text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900">
                    LINE連携が完了しています 🎉
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Web給与明細やシフト確定の通知が、このスタッフのLINEへ本番リアルタイム配信されます。
                  </p>
                </div>

                <div className="p-3 bg-white rounded-xl border border-emerald-200 text-xs text-slate-700 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">連携LINEアカウント名:</span>
                  <span className="font-bold text-emerald-800 text-sm">
                    {lineDisplayName || '連携完了済アカウント'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
                <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  実DB（usersテーブル）の社員IDとLINEアカウントが1対1で強固に紐付いています。
                </p>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="px-4 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  {unlinking ? '連携解除中...' : '連携を解除する'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors shadow-sm"
                >
                  閉じる
                </button>
              </div>
            </div>
          ) : (
            /* 未連携：PINコード発行＆連携案内UI */
            <div className="space-y-6">
              {/* ステップ案内カード */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-900 tracking-wide uppercase flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  3ステップで完了！簡単LINE連携
                </h4>
                <ol className="mt-2 space-y-1.5 text-xs text-emerald-800 list-decimal list-inside font-medium leading-relaxed">
                  <li>下のQRコードを読み取り、公式LINEを「友だち追加」</li>
                  <li>トーク画面で、下の <span className="font-bold text-emerald-950 underline underline-offset-2">4桁の認証PIN</span> をそのまま送信</li>
                  <li>約1秒で自動照合され、即座に連携が完了します</li>
                </ol>
              </div>

              {/* 4桁PINコード表示領域 */}
              <div className="bg-white p-5 rounded-2xl border-2 border-emerald-300 shadow-sm text-center space-y-3">
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  あなた専用の4桁認証コード
                </span>
                
                <div className="flex items-center justify-center gap-3">
                  <div className="text-4xl font-extrabold tracking-widest text-emerald-700 font-mono bg-emerald-50/80 px-8 py-3 rounded-2xl border border-emerald-300 shadow-inner select-all">
                    {pin || '----'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="p-3.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-700 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 font-bold text-xs"
                    title="PINコードをコピー"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>コピー</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 font-medium">
                  {expiresAt 
                    ? `※ 有効期限: ${new Date(expiresAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} まで有効` 
                    : '※ 有効期限: 発行後48時間（期限内であればいつでも連携可能）'}
                </p>
              </div>

              {/* 公式LINE友だち追加セクション */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-5">
                <div className="w-32 h-32 flex-shrink-0 bg-slate-50 border-2 border-slate-200 rounded-xl p-1.5 flex items-center justify-center shadow-sm">
                  <img
                    src={qrCodeUrl}
                    alt="公式LINE 友だち追加QRコード"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <div className="space-y-2.5 text-center sm:text-left flex-1">
                  <div>
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                      送信先アカウント
                    </span>
                    <h5 className="text-sm font-bold text-slate-900 mt-0.5">
                      {accountName}
                    </h5>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    スマホのカメラで左のQRコードを読み取るか、下のボタンからLINEを開いてください。
                  </p>
                  <a
                    href={addFriendUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    LINEで友だち追加 / トークを開く
                  </a>
                </div>
              </div>

              {/* リアルタイム検知待機インジケーター */}
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 flex items-center justify-center space-x-2 text-xs text-emerald-700 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>トークにPIN送信後、自動的にこの画面が完了へ切り替わります</span>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-3.5 bg-slate-100/80 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
