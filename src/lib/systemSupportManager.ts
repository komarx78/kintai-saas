import { supabase } from './supabase';

// 💡 システム操作FAQ（Q&A）の型定義
export interface SystemFaqItem {
  id: string;
  category: 'kintai' | 'shift' | 'payroll' | 'onboarding' | 'general';
  question: string;
  answer: string;
  keyword: string;
  updated_at: string;
}

// 📬 システム改善要望（全テナントから回収するご意見・機能リクエスト）の型定義
export interface SystemImprovementSuggestion {
  id: string;
  tenant_id: string;
  tenant_name: string;
  user_id: string;
  user_name: string;
  is_anonymous: boolean;
  category: 'feature' | 'ui_ux' | 'bug' | 'performance' | 'other';
  title: string;
  content: string;
  status: 'pending' | 'reviewing' | 'planned' | 'completed' | 'declined';
  admin_reply?: string;
  likes_count: number;
  liked_by: string[];
  created_at: string;
  updated_at: string;
}

// 📢 全テナント向けシステムリリースノート（開発本部からのお知らせ）
export interface SystemReleaseNote {
  id: string;
  version: string;
  title: string;
  content: string;
  category: 'update' | 'new_feature' | 'maintenance' | 'important';
  released_at: string;
}

// カテゴリラベル定義
export const SYSTEM_FAQ_CATEGORIES = {
  kintai: '⏰ 勤怠・有給管理',
  shift: '📅 シフト管理',
  payroll: '💰 給与計算・Web明細',
  onboarding: '📄 入退社・労務手続き',
  general: '⚙️ 基本操作・アカウント'
} as const;

export const SYSTEM_SUGGESTION_CATEGORIES = {
  feature: '🚀 新機能リクエスト',
  ui_ux: '🎨 画面・使いやすさ改善',
  bug: '🐛 不具合・動作報告',
  performance: '⚡ 表示速度・快適化',
  other: '💬 その他ご意見'
} as const;

export const SYSTEM_SUGGESTION_STATUSES = {
  pending: { label: '受付済', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  reviewing: { label: '開発検討中', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  planned: { label: 'アップデート実装予定', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  completed: { label: '実装・改善完了', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  declined: { label: '検討見送り', color: 'bg-rose-50 text-rose-700 border-rose-300' }
} as const;

// 🌟 デフォルトのシステム操作マニュアル・FAQ一覧（即時利用可能）
export const DEFAULT_SYSTEM_FAQS: SystemFaqItem[] = [
  {
    id: 'sfaq-1',
    category: 'kintai',
    question: '出勤・退勤の打刻はどこから行いますか？スマホでも打刻できますか？',
    answer: 'ポータルの「勤怠・有給管理」を選択後、ダッシュボード上部に表示される「出勤」「退勤」「休憩開始」「休憩終了」ボタンをワンクリックするだけで打刻できます。スマートフォンやタブレットのブラウザからもログインしてそのまま打刻が可能です（GPS位置情報の記録にも対応しています）。',
    keyword: '打刻 出勤 退勤 休憩 スマホ スマートフォン GPS',
    updated_at: '2026-09-01'
  },
  {
    id: 'sfaq-2',
    category: 'kintai',
    question: '打刻を忘れてしまった場合や、間違えた時間の修正はどうすればよいですか？',
    answer: '「勤怠・有給管理」画面の日別勤怠一覧より、修正したい該当日を選択して「打刻修正申請」を行ってください。修正理由を入力して提出すると、自社の管理者に通知され、管理者の承認が完了すると正しい時刻へ自動反映されます。',
    keyword: '打刻忘れ 修正 打刻修正 申請 承認 変更',
    updated_at: '2026-09-01'
  },
  {
    id: 'sfaq-3',
    category: 'kintai',
    question: '有給休暇の申請方法と、残日数の確認方法を教えてください。',
    answer: '「勤怠・有給管理」画面の「各種申請」タブより「有給休暇申請」を選択し、取得希望日と取得区分（全休・午前半休・午後半休・時間単位年休）を選んで提出します。現在の有給残日数および有効期限は、勤怠ダッシュボードの有給ステータスカードで常時リアルタイムに確認できます。',
    keyword: '有給 申請 残日数 半休 時間単位 有効期限',
    updated_at: '2026-09-01'
  },
  {
    id: 'sfaq-4',
    category: 'shift',
    question: 'シフト希望の提出方法と提出期限の確認はどうすればいいですか？',
    answer: 'ポータルの「シフト管理」を開くと、当月・翌月のカレンダーが表示されます。出勤希望の日程をタップして勤務パターン（早番・遅番など）または希望時間を指定し、「シフト希望を提出」を押してください。提出期限は画面上部にバッジで表示されます。',
    keyword: 'シフト 提出 希望 申請 期限 変更 カレンダー',
    updated_at: '2026-09-01'
  },
  {
    id: 'sfaq-5',
    category: 'shift',
    question: '【管理者向け】確定したシフトを従業員に公開・通知するにはどうしますか？',
    answer: '管理者画面の「シフト作成・調整」にて全員のシフト配置を完了させた後、画面右上の「シフトを確定・公開する」ボタンをクリックしてください。確定されたシフトは全従業員の画面へ即時反映され、従業員各自のマイシフト一覧に表示されます。',
    keyword: 'シフト確定 公開 通知 管理者 シフト作成 反映',
    updated_at: '2026-09-01'
  },
  {
    id: 'sfaq-6',
    category: 'payroll',
    question: 'Web給与明細の閲覧やPDF印刷はどこから行えますか？',
    answer: '管理者が給与確定を行うと、ポータルの「給与計算・明細」または「Web明細」から過去の給与明細・賞与明細・源泉徴収票をいつでもスマホやPCで閲覧・PDFダウンロードが可能です。',
    keyword: '給与明細 Web明細 PDF 印刷 賞与 源泉徴収票',
    updated_at: '2026-09-01'
  },
  {
    id: 'sfaq-7',
    category: 'onboarding',
    question: '入社時の書類提出（通帳写真・通勤経路・扶養親族・マイナンバー等）のやり方は？',
    answer: '「入退社・労務手続き」を開き、ステップに沿って氏名・現住所・給与振込口座（通帳写真アップロード）・通勤交通費・マイナンバーを登録します。スマホで通帳や身分証を撮影してそのまま添付できます。',
    keyword: '入社手続き 口座 通帳写真 マイナンバー 通勤手当 扶養',
    updated_at: '2026-09-01'
  },
  {
    id: 'sfaq-8',
    category: 'general',
    question: 'パスワードを忘れてしまった場合の再設定手順を教えてください。',
    answer: 'ログイン画面の「パスワードをお忘れの方はこちら」をクリックし、ご登録のメールアドレスを入力してください。パスワード再設定用の認証リンクが届きますので、メール内のリンクから新しいパスワードを設定してください。',
    keyword: 'パスワード 忘れた 再設定 ログイン メール',
    updated_at: '2026-09-01'
  }
];

// 📢 デフォルトのシステムリリースノート
export const DEFAULT_SYSTEM_RELEASES: SystemReleaseNote[] = [
  {
    id: 'rel-1',
    version: 'Ver 2.2.0',
    title: 'システム操作Q&A・Gemini AI操作アシスタント ＆ 改善要望ボックスを新設',
    content: 'システムの使い方がひと目でわかる「システム操作Q&A」と、24時間何でも質問できる「Gemini AI操作サポート」を配備いたしました。また、利用者様からの機能リクエストやご意見を直接開発元へお届けいただける「システム改善要望ボックス」を開設いたしました。',
    category: 'new_feature',
    released_at: '2026-09-06'
  },
  {
    id: 'rel-2',
    version: 'Ver 2.1.0',
    title: '労働者名簿・国税庁公的帳票・印字インスペクター完全自動連動',
    content: '入退社労務管理システムと完全連動し、1人1ページの労働者名簿および国税庁様式源泉徴収簿のPDF出力・電子印鑑捺印に対応いたしました。',
    category: 'update',
    released_at: '2026-09-05'
  }
];

// ─────────────────────────────────────────────────────────────
// 💡 システム操作Q&A（FAQ）の取得・保存API
// ─────────────────────────────────────────────────────────────

export async function fetchSystemFaqs(): Promise<SystemFaqItem[]> {
  try {
    const { data, error } = await supabase
      .from('system_faqs')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error || !data || data.length === 0) {
      const local = localStorage.getItem('kap_system_faqs');
      if (local) {
        try { return JSON.parse(local); } catch (e) { /* fallback */ }
      }
      return DEFAULT_SYSTEM_FAQS;
    }
    localStorage.setItem('kap_system_faqs', JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn('Using default system FAQs fallback:', err);
    const local = localStorage.getItem('kap_system_faqs');
    if (local) {
      try { return JSON.parse(local); } catch (e) { /* fallback */ }
    }
    return DEFAULT_SYSTEM_FAQS;
  }
}

export async function saveSystemFaq(item: Omit<SystemFaqItem, 'id' | 'updated_at'> & { id?: string }): Promise<SystemFaqItem> {
  const currentList = await fetchSystemFaqs();
  const id = item.id || `sfaq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString().split('T')[0];
  const fullItem: SystemFaqItem = { ...item, id, updated_at: now };

  try {
    const { data, error } = await supabase
      .from('system_faqs')
      .upsert(fullItem)
      .select()
      .single();

    if (!error && data) {
      const updated = [data, ...currentList.filter(f => f.id !== id)];
      localStorage.setItem('kap_system_faqs', JSON.stringify(updated));
      return data;
    }
  } catch (err) {
    console.warn('Failed to upsert system faq to supabase:', err);
  }

  // Local fallback
  const existingIdx = currentList.findIndex(f => f.id === id);
  let updatedList: SystemFaqItem[];
  if (existingIdx >= 0) {
    updatedList = [...currentList];
    updatedList[existingIdx] = fullItem;
  } else {
    updatedList = [fullItem, ...currentList];
  }
  localStorage.setItem('kap_system_faqs', JSON.stringify(updatedList));
  return fullItem;
}

export async function deleteSystemFaq(id: string): Promise<boolean> {
  try {
    await supabase.from('system_faqs').delete().eq('id', id);
  } catch (e) {
    console.warn(e);
  }
  const currentList = await fetchSystemFaqs();
  const updated = currentList.filter(f => f.id !== id);
  localStorage.setItem('kap_system_faqs', JSON.stringify(updated));
  return true;
}

// ─────────────────────────────────────────────────────────────
// 📬 システム改善要望（回収ボックス）の取得・投稿・更新API
// ─────────────────────────────────────────────────────────────

export async function fetchSystemSuggestions(): Promise<SystemImprovementSuggestion[]> {
  try {
    const { data, error } = await supabase
      .from('system_improvement_suggestions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      const local = localStorage.getItem('kap_system_suggestions');
      if (local) {
        try { return JSON.parse(local); } catch (e) { /* fallback */ }
      }
      return [];
    }
    localStorage.setItem('kap_system_suggestions', JSON.stringify(data));
    return data;
  } catch (err) {
    const local = localStorage.getItem('kap_system_suggestions');
    if (local) {
      try { return JSON.parse(local); } catch (e) { /* fallback */ }
    }
    return [];
  }
}

export async function submitSystemSuggestion(data: {
  tenant_id: string;
  tenant_name: string;
  user_id: string;
  user_name: string;
  is_anonymous: boolean;
  category: 'feature' | 'ui_ux' | 'bug' | 'performance' | 'other';
  title: string;
  content: string;
}): Promise<SystemImprovementSuggestion> {
  const newItem: SystemImprovementSuggestion = {
    id: `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...data,
    status: 'pending',
    likes_count: 0,
    liked_by: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data: inserted, error } = await supabase
      .from('system_improvement_suggestions')
      .insert(newItem)
      .select()
      .single();

    if (!error && inserted) {
      const current = await fetchSystemSuggestions();
      localStorage.setItem('kap_system_suggestions', JSON.stringify([inserted, ...current.filter(c => c.id !== inserted.id)]));
      return inserted;
    }
  } catch (e) {
    console.warn('Failed to insert system suggestion to DB, saving locally:', e);
  }

  const current = await fetchSystemSuggestions();
  const updated = [newItem, ...current];
  localStorage.setItem('kap_system_suggestions', JSON.stringify(updated));
  return newItem;
}

export async function updateSystemSuggestionStatus(
  id: string, 
  status: SystemImprovementSuggestion['status'], 
  admin_reply?: string
): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    await supabase
      .from('system_improvement_suggestions')
      .update({ status, admin_reply, updated_at: now })
      .eq('id', id);
  } catch (e) {
    console.warn(e);
  }

  const current = await fetchSystemSuggestions();
  const updated = current.map(item => {
    if (item.id === id) {
      return { ...item, status, admin_reply: admin_reply !== undefined ? admin_reply : item.admin_reply, updated_at: now };
    }
    return item;
  });
  localStorage.setItem('kap_system_suggestions', JSON.stringify(updated));
  return true;
}

export async function toggleSystemSuggestionLike(id: string, userId: string): Promise<number> {
  const current = await fetchSystemSuggestions();
  const target = current.find(item => item.id === id);
  if (!target) return 0;

  const alreadyLiked = target.liked_by.includes(userId);
  const newLikedBy = alreadyLiked 
    ? target.liked_by.filter(uid => uid !== userId)
    : [...target.liked_by, userId];
  const newCount = newLikedBy.length;

  try {
    await supabase
      .from('system_improvement_suggestions')
      .update({ likes_count: newCount, liked_by: newLikedBy })
      .eq('id', id);
  } catch (e) {
    console.warn(e);
  }

  const updated = current.map(item => {
    if (item.id === id) {
      return { ...item, likes_count: newCount, liked_by: newLikedBy };
    }
    return item;
  });
  localStorage.setItem('kap_system_suggestions', JSON.stringify(updated));
  return newCount;
}

// ─────────────────────────────────────────────────────────────
// 📢 システムリリースノートの取得・保存API
// ─────────────────────────────────────────────────────────────

export async function fetchSystemReleaseNotes(): Promise<SystemReleaseNote[]> {
  try {
    const { data, error } = await supabase
      .from('system_release_notes')
      .select('*')
      .order('released_at', { ascending: false });

    if (error || !data || data.length === 0) {
      const local = localStorage.getItem('kap_system_releases');
      if (local) {
        try { return JSON.parse(local); } catch (e) { /* fallback */ }
      }
      return DEFAULT_SYSTEM_RELEASES;
    }
    localStorage.setItem('kap_system_releases', JSON.stringify(data));
    return data;
  } catch (e) {
    const local = localStorage.getItem('kap_system_releases');
    if (local) {
      try { return JSON.parse(local); } catch (e) { /* fallback */ }
    }
    return DEFAULT_SYSTEM_RELEASES;
  }
}

export async function saveSystemReleaseNote(note: Omit<SystemReleaseNote, 'id'> & { id?: string }): Promise<SystemReleaseNote> {
  const id = note.id || `rel-${Date.now()}`;
  const fullNote: SystemReleaseNote = { ...note, id };

  try {
    await supabase
      .from('system_release_notes')
      .upsert(fullNote);
  } catch (e) {
    console.warn(e);
  }

  const current = await fetchSystemReleaseNotes();
  const updated = [fullNote, ...current.filter(r => r.id !== id)];
  localStorage.setItem('kap_system_releases', JSON.stringify(updated));
  return fullNote;
}
