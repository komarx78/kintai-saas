import React, { useState, useEffect } from 'react';
import { 
  X, ShieldCheck, Sparkles, HelpCircle, Save 
} from 'lucide-react';
import { 
  type LineIntegrationConfig, 
  getTenantLineConfig, 
  saveTenantLineConfigUnified, 
  fetchTenantLineConfigFromDb,
  DEFAULT_LINE_CONFIG 
} from '../lib/lineMessaging';

interface LineConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string | null | undefined;
  onConfigSaved?: (config: LineIntegrationConfig) => void;
}

export const LineConfigModal: React.FC<LineConfigModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onConfigSaved
}) => {
  const [config, setConfig] = useState<LineIntegrationConfig>(DEFAULT_LINE_CONFIG);
  const [saving, setSaving] = useState(false);
  const [showTokenHelp, setShowTokenHelp] = useState(false);

  useEffect(() => {
    if (isOpen && tenantId) {
      const current = getTenantLineConfig(tenantId);
      setConfig(current);
      fetchTenantLineConfigFromDb(tenantId).then(dbCfg => {
        if (dbCfg) setConfig(dbCfg);
      });
    }
  }, [isOpen, tenantId]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTenantLineConfigUnified(tenantId, config);
      if (onConfigSaved) onConfigSaved(config);
      alert('🎉 LINE連携設定を保存いたしました！（全店舗・全店長へ即時同期）');
      onClose();
    } catch (e) {
      console.error(e);
      alert('保存中にエラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xl">
              💬
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                公式LINE通知 連携設定
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  全社共通SSOT
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                入社手続き・給与明細・シフト連絡を安全に届ける公式LINEの配信方式を選択してください
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* 3つのプラン選択 */}
          <div className="grid grid-cols-1 gap-3.5">
            {/* パターン1: らくまる労務 公式LINE代行（推奨） */}
            <div 
              onClick={() => setConfig({ ...config, mode: 'rakumaru_official' })}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer relative ${
                config.mode === 'rakumaru_official'
                  ? 'border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-950/50'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input 
                    type="radio" 
                    name="line_mode" 
                    checked={config.mode === 'rakumaru_official'} 
                    onChange={() => setConfig({ ...config, mode: 'rakumaru_official' })}
                    className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">
                        ⚡ みんなのらくまる労務 公式LINE代行
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1">
                        <Sparkles size={10} /> 最もおすすめ（設定ゼロ）
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      難しいトークン設定やLINE公式アカウントの開設は<strong>一切不要</strong>です。
                      通知専用の安心アカウントから、新入社員やアルバイトへ自動配信されます。
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2 text-[11px] text-emerald-400">
                      <span className="px-2 py-0.5 bg-emerald-950/60 rounded border border-emerald-800/60">✓ 設定作業 0分</span>
                      <span className="px-2 py-0.5 bg-emerald-950/60 rounded border border-emerald-800/60">✓ 店長個人LINE完全不要</span>
                      <span className="px-2 py-0.5 bg-emerald-950/60 rounded border border-emerald-800/60">✓ 月額オプションで即日稼働</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* パターン2: 自社公式LINEを利用 */}
            <div 
              onClick={() => setConfig({ ...config, mode: 'own_official' })}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer relative ${
                config.mode === 'own_official'
                  ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-950/50'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 w-full">
                  <input 
                    type="radio" 
                    name="line_mode" 
                    checked={config.mode === 'own_official'} 
                    onChange={() => setConfig({ ...config, mode: 'own_official' })}
                    className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="w-full">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">
                        🏢 自社公式LINEアカウントを利用する
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                        自社ブランド重視
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      すでに自社のLINE公式アカウントをお持ちで、<strong>自社のアカウント名（〇〇居酒屋 公式など）から直接送りたい</strong>企業様向けです。
                    </p>

                    {/* 自社公式LINE設定項目 */}
                    {config.mode === 'own_official' && (
                      <div className="mt-4 pt-3 border-t border-slate-700/60 space-y-3 bg-slate-950/40 p-3.5 rounded-xl">
                        <div>
                          <label className="block text-xs font-bold text-slate-200 mb-1">
                            ① 公式アカウント表示名（店舗・会社名）
                          </label>
                          <input 
                            type="text" 
                            value={config.ownAccountName || ''} 
                            onChange={e => setConfig({ ...config, ownAccountName: e.target.value })}
                            placeholder="例: 株式会社ココット公式LINE"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-200 mb-1">
                            ② 友だち追加URL（招待URL）
                          </label>
                          <input 
                            type="text" 
                            value={config.ownAddFriendUrl || ''} 
                            onChange={e => setConfig({ ...config, ownAddFriendUrl: e.target.value })}
                            placeholder="https://lin.ee/xxxxxxx"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500"
                          />
                          <p className="text-[10px] text-slate-400 mt-1">
                            ※ LINE Official Account Manager ＞ 友だちを増やす ＞ 友だち追加ガイド のURLを貼り付けてください。
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-slate-200">
                              ③ Messaging API チャネルアクセストークン（長期）
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowTokenHelp(!showTokenHelp)}
                              className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              <HelpCircle size={11} /> 取得方法はこちら
                            </button>
                          </div>
                          <input 
                            type="password" 
                            value={config.ownChannelAccessToken || ''} 
                            onChange={e => setConfig({ ...config, ownChannelAccessToken: e.target.value })}
                            placeholder="LINE Developersで発行したアクセストークンを貼り付け"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>

                        {showTokenHelp && (
                          <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-lg text-xs text-indigo-200 space-y-1">
                            <p className="font-bold">📘 アクセストークンの確認手順:</p>
                            <p>1. LINE Developers (developers.line.biz) にログイン</p>
                            <p>2. ご利用のチャネル ＞「Messaging API設定」タブを開く</p>
                            <p>3. 最下部の「チャネルアクセストークン（長期）」の【発行】を押してコピー</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* パターン3: LINE連携を使用しない */}
            <div 
              onClick={() => setConfig({ ...config, mode: 'none' })}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer relative ${
                config.mode === 'none'
                  ? 'border-slate-400 bg-slate-800/60 shadow-lg'
                  : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <input 
                  type="radio" 
                  name="line_mode" 
                  checked={config.mode === 'none'} 
                  onChange={() => setConfig({ ...config, mode: 'none' })}
                  className="mt-1 w-4 h-4 text-slate-500 focus:ring-slate-400"
                />
                <div>
                  <span className="font-bold text-white text-base">
                    ✉️ LINE連携を使用しない（メール・店頭QR・URL共有のみ）
                  </span>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    公式LINEからの自動通知は使わず、従来のメール送信・店頭QRコード読み取り・入社URLのクリップボードコピーのみで運用します。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* セキュリティ・安心の注意事項 */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">店長・社員の個人LINEは100%使用しません</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                どの設定をお選びいただいても、店長個人のLINEアカウントが介在することは一切ありません。
                プライバシー完全保護と労務コンプライアンスが徹底されます。
              </p>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
          >
            キャンセル
          </button>
          <button 
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save size={14} />
            設定を保存する
          </button>
        </div>
      </div>
    </div>
  );
};
