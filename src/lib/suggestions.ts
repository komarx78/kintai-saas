// 📬 社内改善目安箱（回収ボックス）データモデル ＆ 永続化ヘルパー
import { supabase } from './supabase';

export interface CompanySuggestion {
  id: string;
  tenant_id: string;
  user_id?: string;
  user_name: string; // 実名または「匿名スタッフ」
  is_anonymous: boolean;
  category: 'efficiency' | 'environment' | 'system' | 'welfare' | 'other';
  title: string;
  content: string;
  status: 'pending' | 'in_review' | 'in_progress' | 'completed' | 'declined';
  admin_comment?: string;
  admin_name?: string;
  resolved_at?: string;
  likes_count: number;
  liked_by?: string[];
  created_at: string;
}

export const CATEGORY_LABELS: Record<CompanySuggestion['category'], { label: string; color: string }> = {
  efficiency: { label: '業務効率化・カイゼン', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  environment: { label: '職場環境・設備・備品', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  system: { label: 'システム・アプリ要望', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  welfare: { label: '福利厚生・社内制度', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  other: { label: 'その他アイデア・相談', color: 'bg-amber-50 text-amber-700 border-amber-200' }
};

export const STATUS_LABELS: Record<CompanySuggestion['status'], { label: string; bg: string; text: string; icon: string }> = {
  pending: { label: '新規受付', bg: 'bg-slate-100', text: 'text-slate-700', icon: '📥' },
  in_review: { label: '社内検討中', bg: 'bg-amber-100', text: 'text-amber-800', icon: '🧐' },
  in_progress: { label: '対応推進中', bg: 'bg-blue-100', text: 'text-blue-800', icon: '🛠️' },
  completed: { label: '改善完了！', bg: 'bg-emerald-100', text: 'text-emerald-800', icon: '🎉' },
  declined: { label: '見送り・回答済', bg: 'bg-gray-100', text: 'text-gray-600', icon: '📋' }
};

// 🌟 初期サンプルデータ（現場の温かいカイゼン事例）
export const DEFAULT_SUGGESTIONS: CompanySuggestion[] = [
  {
    id: 'sug-sample-1',
    tenant_id: 'default',
    user_name: '匿名スタッフ',
    is_anonymous: true,
    category: 'environment',
    title: '休憩室の電子レンジの増設または買替えのお願い',
    content: 'お昼休みの時間帯にお弁当を温める列ができてしまい、休憩時間が短くなってしまうことがあります。もう1台小型の電子レンジを設置していただけると大変助かります！',
    status: 'completed',
    admin_comment: 'ご提案ありがとうございます！総務部にて確認し、休憩室に新しくもう1台電子レンジを増設設置いたしました。ぜひご活用ください！',
    admin_name: '管理部',
    resolved_at: '2026-03-01',
    likes_count: 8,
    created_at: '2026-02-20 12:30'
  },
  {
    id: 'sug-sample-2',
    tenant_id: 'default',
    user_name: '現場スタッフ',
    is_anonymous: false,
    category: 'system',
    title: 'スマホからの打刻時に前回の打刻時間がパッと見えると嬉しいです',
    content: '朝出勤した後に「あれ、ちゃんと出勤ボタン押せたかな？」と不安になることがあります。出退勤の最新打刻時刻がホーム画面ですぐ確認できると安心です。',
    status: 'completed',
    admin_comment: '貴重なご意見ありがとうございます！スマート勤怠画面のホームカードに「最新打刻ステータス＆打刻時刻」がリアルタイム表示されるようアップデートを実施いたしました。',
    admin_name: 'システム開発部',
    resolved_at: '2026-03-03',
    likes_count: 12,
    created_at: '2026-02-25 09:15'
  },
  {
    id: 'sug-sample-3',
    tenant_id: 'default',
    user_name: '匿名スタッフ',
    is_anonymous: true,
    category: 'efficiency',
    title: '月曜朝礼のオンライン共有または短縮化のご提案',
    content: '月曜朝のミーティングで連絡事項の伝達に時間がかかっています。ポータルの「社内お知らせ」を活用して事前にテキスト共有し、朝礼は5分程度の重要確認に短縮するのはいかがでしょうか？',
    status: 'in_progress',
    admin_comment: '素晴らしいカイゼン提案をありがとうございます。現在、各部署のリーダー会で運用変更のテストを実施しております。来週より試験導入の予定です！',
    admin_name: '経営企画部',
    likes_count: 15,
    created_at: '2026-03-04 18:00'
  }
];

export async function fetchCompanySuggestions(tenantId: string): Promise<CompanySuggestion[]> {
  try {
    // 1. Supabase からの取得を試行
    const { data, error } = await supabase
      .from('company_suggestions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data as CompanySuggestion[];
    }
  } catch (err) {
    console.warn('Supabase suggestions fetch error, fallback to localStorage:', err);
  }

  // 2. LocalStorage フォールバック
  try {
    const raw = localStorage.getItem(`company_suggestions_${tenantId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  // 3. 初期サンプルデータを保存して返す
  const initial = DEFAULT_SUGGESTIONS.map(s => ({ ...s, tenant_id: tenantId }));
  try {
    localStorage.setItem(`company_suggestions_${tenantId}`, JSON.stringify(initial));
  } catch (_) {}
  return initial;
}

export async function saveCompanySuggestion(
  tenantId: string, 
  suggestion: Omit<CompanySuggestion, 'id' | 'created_at' | 'likes_count'>
): Promise<CompanySuggestion> {
  const newId = `sug-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const nowStr = new Date().toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
  
  const record: CompanySuggestion = {
    ...suggestion,
    id: newId,
    tenant_id: tenantId,
    likes_count: 0,
    created_at: nowStr
  };

  // 1. Supabase への保存
  try {
    await supabase.from('company_suggestions').insert(record);
  } catch (err) {
    console.warn('Supabase suggestion insert notice:', err);
  }

  // 2. LocalStorage キャッシュ更新
  try {
    const existing = await fetchCompanySuggestions(tenantId);
    const updated = [record, ...existing.filter(e => e.id !== newId)];
    localStorage.setItem(`company_suggestions_${tenantId}`, JSON.stringify(updated));
  } catch (e) {}

  return record;
}

export async function updateSuggestionStatus(
  tenantId: string,
  suggestionId: string,
  status: CompanySuggestion['status'],
  adminComment: string,
  adminName: string
): Promise<void> {
  const resolvedAt = (status === 'completed' || status === 'declined') ? new Date().toISOString().split('T')[0] : undefined;

  // 1. Supabase 更新
  try {
    await supabase
      .from('company_suggestions')
      .update({
        status,
        admin_comment: adminComment,
        admin_name: adminName,
        resolved_at: resolvedAt
      })
      .eq('id', suggestionId);
  } catch (err) {
    console.warn('Supabase suggestion update notice:', err);
  }

  // 2. LocalStorage 更新
  try {
    const existing = await fetchCompanySuggestions(tenantId);
    const updated = existing.map(s => {
      if (s.id === suggestionId) {
        return {
          ...s,
          status,
          admin_comment: adminComment,
          admin_name: adminName,
          resolved_at: resolvedAt
        };
      }
      return s;
    });
    localStorage.setItem(`company_suggestions_${tenantId}`, JSON.stringify(updated));
  } catch (e) {}
}

export async function toggleSuggestionLike(
  tenantId: string,
  suggestionId: string,
  userId: string
): Promise<number> {
  let newLikes = 0;
  try {
    const existing = await fetchCompanySuggestions(tenantId);
    const updated = existing.map(s => {
      if (s.id === suggestionId) {
        const liked = Array.isArray(s.liked_by) ? s.liked_by : [];
        const isLiked = liked.includes(userId);
        const nextLiked = isLiked ? liked.filter(id => id !== userId) : [...liked, userId];
        newLikes = nextLiked.length;
        return {
          ...s,
          likes_count: nextLiked.length,
          liked_by: nextLiked
        };
      }
      return s;
    });
    localStorage.setItem(`company_suggestions_${tenantId}`, JSON.stringify(updated));
    
    // Supabase 更新試行
    try {
      await supabase
        .from('company_suggestions')
        .update({ likes_count: newLikes })
        .eq('id', suggestionId);
    } catch (_) {}
  } catch (e) {}

  return newLikes;
}
