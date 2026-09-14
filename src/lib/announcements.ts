import { supabase } from './supabase';

/**
 * 全社ポータル（KAP Base）お知らせ掲示板管理ライブラリ
 */

export interface AnnouncementItem {
  id: string;
  date: string; // YYYY.MM.DD または YYYY-MM-DD
  title: string;
  content?: string;
  category?: 'info' | 'important' | 'update' | 'holiday';
  tag?: string;
  isAiGenerated?: boolean;
}

export const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    date: '2026.09.01',
    title: '労働条件通知書・雇用契約書の電子同意・電子署名機能がリリースされました。',
    content: '入社手続きおよび労務書面キャビネットにて、電磁的方法による労働条件の確認と電子署名が利用可能になりました。',
    category: 'update',
    tag: '新機能'
  },
  {
    id: 'ann-2',
    date: '2026.08.18',
    title: 'KAP Base (統合ポータルダッシュボード) が新しくリリースされました。',
    content: '勤怠管理・シフト管理・給与計算・入退社労務手続きを一つの画面からシームレスに操作いただけます。',
    category: 'info',
    tag: 'お知らせ'
  },
  {
    id: 'ann-3',
    date: '2026.08.18',
    title: 'シフト管理機能が大幅にアップデートされ、複数日の一括入力に対応しました。',
    content: '従業員側からのシフト希望提出および管理者による月間シフト作成がより高速・直感的に行えるようになりました。',
    category: 'update',
    tag: 'アップデート'
  },
  {
    id: 'ann-4',
    date: '2026.08.01',
    title: 'システムのベータ運用を開始しました。',
    content: '全社マスタ設定および社内規定AIアシスタントの運用を開始いたしました。',
    category: 'info',
    tag: '全社'
  }
];

export const getAnnouncementsFromStorage = (tenantId?: string): AnnouncementItem[] => {
  try {
    const key = tenantId ? `portal_announcements_${tenantId}` : 'portal_announcements';
    const raw = localStorage.getItem(key) || localStorage.getItem('portal_announcements');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('LocalStorage announcements parse error:', e);
  }
  return DEFAULT_ANNOUNCEMENTS;
};

/**
 * データベース（Supabase tenants）から全社員端末へ同期取得
 */
export const fetchAnnouncements = async (tenantId?: string): Promise<AnnouncementItem[]> => {
  let result = getAnnouncementsFromStorage(tenantId);
  if (!tenantId) return result;

  try {
    const { data: tData } = await supabase
      .from('tenants')
      .select('portal_announcements_data')
      .eq('id', tenantId)
      .maybeSingle();

    if (tData?.portal_announcements_data && Array.isArray(tData.portal_announcements_data) && tData.portal_announcements_data.length > 0) {
      result = tData.portal_announcements_data;
      const key = `portal_announcements_${tenantId}`;
      localStorage.setItem(key, JSON.stringify(result));
      localStorage.setItem('portal_announcements', JSON.stringify(result));
    }
  } catch (e) {
    console.warn('DB fetch announcements notice:', e);
  }

  return result;
};

export const saveAnnouncementsToStorage = async (announcements: AnnouncementItem[], tenantId?: string) => {
  try {
    const key = tenantId ? `portal_announcements_${tenantId}` : 'portal_announcements';
    localStorage.setItem(key, JSON.stringify(announcements));
    localStorage.setItem('portal_announcements', JSON.stringify(announcements));
  } catch (e) {
    console.warn('LocalStorage announcements save error:', e);
  }

  // データベースへ永続化（全社共有）
  if (tenantId) {
    try {
      await supabase
        .from('tenants')
        .update({ portal_announcements_data: announcements })
        .eq('id', tenantId);
    } catch (err) {
      console.warn('DB save announcements notice:', err);
    }
  }
};

/**
 * AIによるお知らせ告知文のテンプレート自動生成
 */
export const generateAiAnnouncementDraft = (topic: string, companyName: string = '株式会社KAP'): { title: string; content: string; tag: string } => {
  if (topic.includes('給与') || topic.includes('支給')) {
    return {
      title: '今月度の給与明細をWeb公開（発行）いたしました。',
      content: `従業員の皆様\n\nお疲れ様です。${companyName} 管理部です。\n今月度の給与明細をクラウド給与計算システム上にて確定・公開いたしました。\n「給与計算・明細」アプリより内容をご確認ください。\nご不明な点がある場合は管理部までお問い合わせください。`,
      tag: '給与'
    };
  } else if (topic.includes('シフト') || topic.includes('希望')) {
    return {
      title: '来月度 シフト希望提出のお願い（提出期日のお知らせ）',
      content: `従業員の皆様\n\nお疲れ様です。来月度の勤務シフト作成に伴い、シフト希望の提出をお願いいたします。\n「シフト管理」アプリの「シフト希望提出」カレンダーより、ご希望の日程・時間帯をご入力のうえ期日までにご提出ください。`,
      tag: 'シフト'
    };
  } else if (topic.includes('休暇') || topic.includes('年末年始') || topic.includes('夏季') || topic.includes('お盆')) {
    return {
      title: '全社休業期間および有給休暇計画的付与に関するお知らせ',
      content: `全社社員・パート各位\n\n就業規則および年間会社カレンダーに基づき、下記の期間を全社休業期間といたします。\n休業期間中の緊急連絡先や業務引き継ぎについては各所属長へご確認ください。`,
      tag: '社内規定'
    };
  } else if (topic.includes('就業規則') || topic.includes('規程') || topic.includes('改定')) {
    return {
      title: '就業規則および社内諸規程の改定に関するお知らせ',
      content: `社員各位\n\n労働基準関係法令の改正および業務効率化に伴い、就業規則の一部条文を改定いたしました。\n改定内容の詳細は全社マスタ設定および社内規定AIアシスタントにてご確認いただけます。`,
      tag: '重要'
    };
  }

  return {
    title: `${topic} に関するお知らせ`,
    content: `社員各位\n\n${companyName} より「${topic}」についてお知らせいたします。\n詳細につきましては管理部までお問い合わせください。`,
    tag: 'お知らせ'
  };
};
