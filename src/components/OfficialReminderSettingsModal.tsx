import React, { useState, useEffect } from 'react';
import { 
  Bell, Mail, Save, Plus, Trash2, CheckCircle2, AlertCircle, 
  Send, Sparkles, X, Calendar, Clock, HelpCircle
} from 'lucide-react';
import { 
  getOfficialReminderSettings, 
  saveOfficialReminderSettings, 
  sendOfficialReminderNotification, 
  OFFICIAL_ANNUAL_EVENTS, 
  type OfficialReminderSettings, 
  DEFAULT_OFFICIAL_REMINDER_SETTINGS 
} from '../lib/officialReminderManager';
import { GAS_MAIL_SCRIPT_TEMPLATE } from '../lib/systemSupportNotification';

export interface OfficialReminderSettingsModalProps {
  tenantId: string;
  tenantName?: string;
  isOpen?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean; // 会社設定画面への埋め込み表示モード
}

export const OfficialReminderSettingsModal: React.FC<OfficialReminderSettingsModalProps> = ({
  tenantId,
  tenantName = '自社',
  isOpen = true,
  onClose,
  isEmbedded = false
}) => {
  const [settings, setSettings] = useState<OfficialReminderSettings>(DEFAULT_OFFICIAL_REMINDER_SETTINGS);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGasGuide, setShowGasGuide] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadSettings();
    }
  }, [tenantId]);

  const loadSettings = async () => {
    const s = await getOfficialReminderSettings(tenantId);
    setSettings(s);
  };

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setStatusMsg({ type: 'error', text: '有効なメールアドレスを入力してください。' });
      return;
    }
    if (settings.recipient_emails.includes(trimmed)) {
      setStatusMsg({ type: 'error', text: 'このメールアドレスは既に登録されています。' });
      return;
    }
    setSettings({
      ...settings,
      recipient_emails: [...settings.recipient_emails, trimmed]
    });
    setNewEmail('');
    setStatusMsg(null);
  };

  const handleRemoveEmail = (idx: number) => {
    const updated = settings.recipient_emails.filter((_, i) => i !== idx);
    setSettings({ ...settings, recipient_emails: updated });
  };

  const handleToggleEvent = (eventId: string) => {
    setSettings({
      ...settings,
      event_toggles: {
        ...settings.event_toggles,
        [eventId]: !settings.event_toggles[eventId]
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await saveOfficialReminderSettings(tenantId, settings);
      if (res.success) {
        setStatusMsg({ type: 'success', text: '公的届出・社会保険改定の通知先マスタを正常に保存しました！' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || '保存に失敗しました。' });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'エラーが発生しました。' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (settings.recipient_emails.length === 0) {
      setStatusMsg({ type: 'error', text: 'テスト送信を行うには、最低1件のメールアドレスを登録してください。' });
      return;
    }
    setTesting(true);
    setStatusMsg(null);
    try {
      // 最初のイベントでテスト送信
      const testEvent = OFFICIAL_ANNUAL_EVENTS[0];
      const res = await sendOfficialReminderNotification({
        tenantId,
        tenantName,
        event: testEvent,
        isTest: true
      });
      if (res.success) {
        setStatusMsg({ type: 'success', text: `テストメールを送信しました: ${res.message}` });
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || 'テスト送信に失敗しました。' });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen && !isEmbedded) return null;

  const content = (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              公的届出 ＆ 社会保険料改定 メール通知マスタ
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">
                最高権限者専用
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              社会保険料率の改定時期や公的帳票の法定期限・提出時期を事前検知し、指定された人事労務担当者へメールでリマインド通知します。
            </p>
          </div>
        </div>
        {!isEmbedded && onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ステータスメッセージ */}
      {statusMsg && (
        <div className={`p-4 rounded-xl flex items-center gap-2.5 text-xs font-bold ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 1. 通知機能 全体ON/OFF */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
        <div>
          <div className="text-sm font-black text-slate-800">
            公的労務リマインダー自動通知の有効化
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            無効にすると、すべての定期メール通知が停止します。
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
      </div>

      {/* 2. 宛先メールアドレス マスタ管理 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-slate-800">通知先メールアドレス一覧（複数指定可）</span>
          </div>
          <span className="text-[11px] text-slate-400 font-bold">
            登録数: {settings.recipient_emails.length}件
          </span>
        </div>

        {/* 担当者名入力 */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            メール宛名（ご担当者様名）
          </label>
          <input
            type="text"
            value={settings.recipient_name}
            onChange={(e) => setSettings({ ...settings, recipient_name: e.target.value })}
            placeholder="例: 人事労務部 駒井 様"
            className="w-full text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* アドレス追加バー */}
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); } }}
            placeholder="追加するメールアドレス（例: hr@company.com）"
            className="flex-1 text-xs font-bold border border-slate-300 rounded-xl px-3 py-2 outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-2xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            追加
          </button>
        </div>

        {/* 登録済みメール一覧 */}
        <div className="space-y-2">
          {settings.recipient_emails.map((email, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-[10px] flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="font-mono font-bold text-slate-800">{email}</span>
                {idx === 0 && (
                  <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-black">
                    主担当
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveEmail(idx)}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                title="削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {settings.recipient_emails.length === 0 && (
            <p className="text-xs text-amber-600 font-bold p-3 bg-amber-50 rounded-xl border border-amber-200">
              ※ 通知先メールアドレスが登録されていません。上の入力欄から人事労務担当者のアドレスを追加してください。
            </p>
          )}
        </div>
      </div>

      {/* 3. 事前通知タイミング設定 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-black text-slate-800">事前通知タイミング（複数選択可）</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notify_1month_before}
              onChange={(e) => setSettings({ ...settings, notify_1month_before: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="font-black text-slate-800 block">1ヶ月前通知</span>
              <span className="text-[10px] text-slate-400">前月中旬に事前案内</span>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notify_2weeks_before}
              onChange={(e) => setSettings({ ...settings, notify_2weeks_before: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="font-black text-slate-800 block">2週間前通知</span>
              <span className="text-[10px] text-slate-400">直前準備・リマインド</span>
            </div>
          </label>

          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notify_on_month}
              onChange={(e) => setSettings({ ...settings, notify_on_month: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="font-black text-slate-800 block">当月開始時通知</span>
              <span className="text-[10px] text-slate-400">届出受付開始日・当日</span>
            </div>
          </label>
        </div>
      </div>

      {/* 4. 対象公的イベント個別ON/OFF */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-slate-800">通知対象の公的イベント・法定期限</span>
          </div>
          <span className="text-[11px] text-slate-400 font-bold">全8大公的スケジュール</span>
        </div>

        <div className="space-y-2.5">
          {OFFICIAL_ANNUAL_EVENTS.map(event => (
            <div
              key={event.id}
              onClick={() => handleToggleEvent(event.id)}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-3 ${
                settings.event_toggles[event.id] !== false
                  ? 'bg-white border-indigo-200 hover:bg-indigo-50/40'
                  : 'bg-slate-50/60 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.event_toggles[event.id] !== false}
                  onChange={() => {}} // 親divのonClickで処理
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 pointer-events-none"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.2 rounded font-black border ${
                      event.category === 'social_rate' 
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : event.category === 'official_report'
                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                        : event.category === 'year_end'
                        ? 'bg-violet-50 text-violet-700 border-violet-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {event.categoryLabel}
                    </span>
                    <span className="text-xs font-black text-slate-800">{event.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    <strong className="text-rose-600">法定期限:</strong> {event.deadlineDescription} / <strong className="text-slate-700">通知時期:</strong> {event.advanceNoticeTiming}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {event.summary}
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md shrink-0 border border-indigo-100">
                {event.month > 0 ? `${event.month}月` : '随時'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. メール送信方式設定（GAS Webhook連携） */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-slate-800">送信方式（自社Gmail・GAS Webhook連携）</span>
          </div>
          <button
            type="button"
            onClick={() => setShowGasGuide(!showGasGuide)}
            className="text-[11px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            GAS設定ガイド（所要時間2分）
          </button>
        </div>

        <div>
          <input
            type="url"
            value={settings.gas_webhook_url || ''}
            onChange={(e) => setSettings({ ...settings, gas_webhook_url: e.target.value })}
            placeholder="https://script.google.com/macros/s/AKfy.../exec（未設定時は共通システム通知として送信）"
            className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2 bg-white outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            ※ 自社のGmailから送信したい場合は、発行したGASウェブアプリURLを貼り付けてください。
          </p>
        </div>

        {showGasGuide && (
          <div className="p-3 bg-white rounded-xl border border-slate-300 text-[11px] text-slate-700 space-y-2">
            <p className="font-bold text-slate-800">【GASメール送信スクリプトの設定手順】</p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-600">
              <li>Google Drive または <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline">script.google.com</a> を開いて新規スクリプトを作成</li>
              <li>下記のスクリプトをそのまま貼り付けて保存</li>
              <li>「デプロイ」➔「新しいデプロイ」➔「ウェブアプリ」を選択（実行者: 自分、アクセスできるユーザー: 全員）</li>
              <li>発行された「ウェブアプリのURL」を上の入力欄に貼り付けて保存</li>
            </ol>
            <details className="mt-2 text-[10px]">
              <summary className="font-bold text-indigo-600 cursor-pointer">GASコードを表示（コピー用）</summary>
              <pre className="p-2 bg-slate-900 text-slate-200 rounded-md overflow-x-auto mt-1 font-mono">
                {GAS_MAIL_SCRIPT_TEMPLATE}
              </pre>
            </details>
          </div>
        )}
      </div>

      {/* フッターアクションバー */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleSendTest}
          disabled={testing || settings.recipient_emails.length === 0}
          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          <Send className="w-4 h-4 text-indigo-600" />
          {testing ? 'テスト送信中...' : 'テスト通知を今すぐ送信'}
        </button>

        <div className="flex items-center gap-2">
          {!isEmbedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
            >
              閉じる
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-black transition cursor-pointer shadow-md disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : 'マスタ設定を保存する'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto border border-slate-100">
        {content}
      </div>
    </div>
  );
};
