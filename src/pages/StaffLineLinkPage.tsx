import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CheckCircle2, Copy, Check, MessageSquare, 
  ExternalLink, RefreshCw, AlertCircle, Sparkles, ShieldCheck, Users, ChevronRight, ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  generateOrFetchLinePin, 
  RAKUMARU_OFFICIAL_LINE_CONSTANTS,
  getTenantLineConfig,
  fetchTenantLineConfigFromDb,
  type LineIntegrationConfig
} from '../lib/lineMessaging';

interface TenantStaffOption {
  id: string;
  name: string;
  department?: string | null;
  is_line_linked?: boolean | null;
  line_user_id?: string | null;
}

/**
 * 📱 既存・新人スタッフ専用 10秒LINEワンタップ連携ページ (StaffLineLinkPage)
 * （URL: /line-link?tid=xxx&uid=yyy または /line-link?tid=xxx）
 * 
 * 現場スタッフがスマホでタップした瞬間、1秒で直感理解・ワンタップでLINEが開き送信完了できる至高画面
 */
export default function StaffLineLinkPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = searchParams.get('tid') || searchParams.get('tenant_id') || '';
  const initialUserId = searchParams.get('uid') || searchParams.get('user_id') || '';

  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId);
  const [staffList, setStaffList] = useState<TenantStaffOption[]>([]);
  const [dropdownStaffId, setDropdownStaffId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isLinked, setIsLinked] = useState<boolean>(false);
  const [lineDisplayName, setLineDisplayName] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<LineIntegrationConfig>(() => getTenantLineConfig(tenantId));
  const pollTimerRef = useRef<any>(null);

  const basicId = (config.mode === 'own_official' && config.ownAccountName)
    ? (config.rakumaruBasicId || RAKUMARU_OFFICIAL_LINE_CONSTANTS.basicId)
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.basicId;
  const qrCodeUrl = (config.mode === 'own_official' && config.ownQrCodeUrl) 
    ? config.ownQrCodeUrl 
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.qrCodeUrl;
  const accountName = config.mode === 'own_official' && config.ownAccountName
    ? config.ownAccountName
    : RAKUMARU_OFFICIAL_LINE_CONSTANTS.accountName;

  // 1. 初期ロード ＆ スタッフ選択時のPIN発行処理
  useEffect(() => {
    if (!tenantId && !selectedUserId) {
      setLoading(false);
      setErrorMsg('スタッフ認証パラメータが不足しています。店長から共有されたURLまたは店頭のQRコードを再度ご確認ください。');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const init = async () => {
      try {
        // (A) まず tenantId がある場合はテナントのLINE設定と会社名・在籍スタッフ一覧を取得
        if (tenantId) {
          const dbCfg = await fetchTenantLineConfigFromDb(tenantId);
          if (isMounted && dbCfg) {
            setConfig(dbCfg);
          }

          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', tenantId)
            .maybeSingle();
          if (isMounted && tenant?.name) {
            setCompanyName(tenant.name);
          }

          // uid が未指定の場合はテナントの在籍スタッフ一覧を取得して選択画面を表示
          if (!selectedUserId) {
            const { data: staffs, error: staffErr } = await supabase
              .from('users')
              .select('id, name, department')
              .eq('tenant_id', tenantId)
              .order('name', { ascending: true });

            if (staffErr) {
              if (isMounted) setErrorMsg('スタッフ一覧の取得に失敗しました。電波の良い場所で再度お試しください。');
              return;
            }

            if (isMounted) {
              setStaffList(staffs || []);
            }
            return;
          }
        }

        // (B) selectedUserId が決定している場合：個別スタッフ情報の取得 ＆ PIN発行
        const { data: user, error: uErr } = await supabase
          .from('users')
          .select('name, is_line_linked, line_user_id, line_display_name, tenant_id')
          .eq('id', selectedUserId)
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

        // テナント名・LINE設定の補完取得（URLにtidが無くuidのみだった場合にも対応）
        const effectiveTid = tenantId || user.tenant_id;
        if (effectiveTid) {
          const dbCfg = await fetchTenantLineConfigFromDb(effectiveTid);
          if (isMounted && dbCfg) {
            setConfig(dbCfg);
          }
          if (!companyName) {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('name')
              .eq('id', effectiveTid)
              .maybeSingle();
            if (isMounted && tenant?.name) {
              setCompanyName(tenant.name);
            }
          }
        }

        // 未連携の場合、PINコードを取得・発行
        if (!user.line_user_id && !user.is_line_linked) {
          const pinRes = await generateOrFetchLinePin(selectedUserId);
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

    init();

    return () => {
      isMounted = false;
    };
  }, [tenantId, selectedUserId]);

  // 2. リアルタイム完了検知（ポーリング：LINE送信後1〜2秒で自動切り替え）
  useEffect(() => {
    if (!selectedUserId || isLinked) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    pollTimerRef.current = setInterval(async () => {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('is_line_linked, line_user_id, line_display_name')
          .eq('id', selectedUserId)
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
  }, [selectedUserId, isLinked]);

  const handleSelectStaff = (uid: string) => {
    if (!uid) return;
    setPin('');
    setExpiresAt('');
    setIsLinked(false);
    setSelectedUserId(uid);
    // URLクエリにも uid を反映（リロード耐性）
    const nextParams = new URLSearchParams(searchParams);
    if (tenantId) nextParams.set('tid', tenantId);
    nextParams.set('uid', uid);
    setSearchParams(nextParams, { replace: true });
  };

  const handleResetStaffSelection = () => {
    setSelectedUserId('');
    setUserName('');
    setPin('');
    setExpiresAt('');
    setIsLinked(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('uid');
    nextParams.delete('user_id');
    setSearchParams(nextParams, { replace: true });
  };

  const handleCopyPin = () => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🚀 LINEディープリンク（メッセージ欄に連携PINが自動入力された状態でLINEを開くURL）
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
          ) : !selectedUserId ? (
            /* 👥 URLに uid が無い場合：スタッフ選択UI */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-sm">
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>ご自身の名前を選択してください</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  一覧からあなたのお名前を選択すると、専用のLINE連携コードが即座に発行されます。
                </p>
              </div>

              {staffList.length === 0 ? (
                <div className="p-6 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                  在籍スタッフ情報が見つかりませんでした。店舗管理者へお問い合わせください。
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ドロップダウンで選択 */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      リストから名前を選択
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={dropdownStaffId}
                        onChange={(e) => setDropdownStaffId(e.target.value)}
                        className="flex-1 bg-white border-2 border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none"
                      >
                        <option value="">-- ご自身の名前を選択してください --</option>
                        {staffList.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}{st.department ? `（${st.department}）` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!dropdownStaffId}
                        onClick={() => handleSelectStaff(dropdownStaffId)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-sm transition cursor-pointer shrink-0"
                      >
                        決定
                      </button>
                    </div>
                  </div>

                  {/* ワンタップ選択リスト */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500">
                      または下の一覧から直接タップ：
                    </p>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                      {staffList.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectStaff(st.id)}
                          className="w-full px-4 py-3 text-left hover:bg-emerald-50/70 transition flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center shrink-0">
                              {st.name.charAt(0)}
                            </div>
                            <div className="truncate">
                              <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 truncate">
                                {st.name}
                              </div>
                              {st.department && (
                                <div className="text-[11px] text-slate-400 truncate">
                                  {st.department}
                                </div>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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

              {!initialUserId && tenantId && (
                <button
                  type="button"
                  onClick={handleResetStaffSelection}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>スタッフ選択に戻る</span>
                </button>
              )}
            </div>
          ) : (
            /* 未連携：ワンタップLINE起動 ＆ フェイルセーフUI */
            <div className="space-y-5">
              {!initialUserId && tenantId && (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={handleResetStaffSelection}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>別の名前を選び直す</span>
                  </button>
                </div>
              )}

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
                    LINEのトーク画面で、上記のコード【<strong className="text-amber-950 font-mono font-bold text-xs">{pin}</strong>】をそのまま打って送信してください。（※ 大文字・小文字どちらで送っても自動認識されます）
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
