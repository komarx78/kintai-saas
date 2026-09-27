export interface OnboardingWorkflowStep {
  id: string;
  step_number: number;
  name: string;
  description: string;
  required_action: 'contract_sign' | 'document_submit' | 'admin_review' | 'gov_procedure' | 'complete' | 'custom';
  approver_type: 'all_admins' | 'specific_user' | 'department_head';
  approver_user_id?: string; // 特定ユーザー指定時のuser_id
  approver_name: string; // 表示用名称（例: "管理者全員", "山田 太郎", "配属部署の所属長"）
  is_enabled: boolean;
  documents?: string[]; // 📄 対象・提出書類タグ
  action_tags?: string[]; // ⚡ 連動・アクションタグ
}

export interface OnboardingStepHistory {
  step_id: string;
  step_number: number;
  step_name: string;
  approved_by_name: string;
  approved_by_id?: string;
  approved_at: string;
  comment?: string;
}

// 🏷️ 各ステップのデフォルト書類・アクションタグ取得フォールバック
export const getStepDefaultDocuments = (step: Partial<OnboardingWorkflowStep>): string[] => {
  if (step.documents && step.documents.length > 0) {
    return step.documents;
  }
  switch (step.id) {
    case 'step_1':
      return ['📄 労働条件通知書（雇用契約書）'];
    case 'step_2':
      return ['🔢 マイナンバー', '💳 給与振込口座通帳', '📝 扶養控除等申告書', '🚲 通勤経路・交通費届'];
    case 'step_3':
      return ['🔍 通帳原本写真目視', '🛡️ マイナンバー厳格照合'];
    case 'step_4':
      return ['🏛️ 健保・厚年資格取得届', '🏛️ 雇用保険資格取得届', '🏢 住民税特別徴収異動届'];
    case 'step_5':
      return ['⏱️ 勤怠打刻アカウント発行', '📅 シフト募集連動', '💰 給与台帳SSOT連携'];
    default:
      return step.documents || [];
  }
};

export const getStepDefaultActionTags = (step: Partial<OnboardingWorkflowStep>): string[] => {
  if (step.action_tags && step.action_tags.length > 0) {
    return step.action_tags;
  }
  switch (step.id) {
    case 'step_1':
      return ['⚡ クラウドサイン電子合意', '🔒 改ざん防止ロック'];
    case 'step_2':
      return ['📱 スマホ写真提出', '📤 暗号化ストレージ保管'];
    case 'step_3':
      return ['↩️ 1クリック差戻し', '✨ 台帳SSOT自動反映'];
    case 'step_4':
      return ['📑 届出書類一括出力', '🌐 e-Gov電子申請連動'];
    case 'step_5':
      return ['🚀 入社受入完了通知', '👥 社員名簿・組織図反映'];
    default:
      return step.action_tags || [];
  }
};

export const DEFAULT_ONBOARDING_STEPS: OnboardingWorkflowStep[] = [
  {
    id: 'step_1',
    step_number: 1,
    name: '内定・雇用契約の合意',
    description: '労働条件通知書（雇用契約書）の発行と内容合意',
    required_action: 'contract_sign',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true,
    documents: ['📄 労働条件通知書（雇用契約書）'],
    action_tags: ['⚡ クラウドサイン電子合意', '🔒 改ざん防止ロック']
  },
  {
    id: 'step_2',
    step_number: 2,
    name: '従業員による書類提出',
    description: '通帳原本・通勤経路・扶養控除等申告書・マイナンバーの提出',
    required_action: 'document_submit',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true,
    documents: ['🔢 マイナンバー', '💳 給与振込口座通帳', '📝 扶養控除等申告書', '🚲 通勤経路・交通費届'],
    action_tags: ['📱 スマホ写真提出', '📤 暗号化ストレージ保管']
  },
  {
    id: 'step_3',
    step_number: 3,
    name: '労務書類審査・原本確認',
    description: '提出書類・通帳写真の審査、差戻しまたは承認・マスタ反映',
    required_action: 'admin_review',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true,
    documents: ['🔍 通帳原本写真目視', '🛡️ マイナンバー厳格照合'],
    action_tags: ['↩️ 1クリック差戻し', '✨ 台帳SSOT自動反映']
  },
  {
    id: 'step_4',
    step_number: 4,
    name: '官公庁届出（年金・社保等）',
    description: '年金事務所資格取得届、ハローワーク雇用保険届、住民税特別徴収切替',
    required_action: 'gov_procedure',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true,
    documents: ['🏛️ 健保・厚年資格取得届', '🏛️ 雇用保険資格取得届', '🏢 住民税特別徴収異動届'],
    action_tags: ['📑 届出書類一括出力', '🌐 e-Gov電子申請連動']
  },
  {
    id: 'step_5',
    step_number: 5,
    name: '受入完了・本稼働開始',
    description: '勤怠打刻・シフト募集・給与計算への正式連動と受入完了',
    required_action: 'complete',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true,
    documents: ['⏱️ 勤怠打刻アカウント発行', '📅 シフト募集連動', '💰 給与台帳SSOT連携'],
    action_tags: ['🚀 入社受入完了通知', '👥 社員名簿・組織図反映']
  }
];

export const getWorkflowStepsFromStorage = (tenantId?: string | null): OnboardingWorkflowStep[] => {
  try {
    const key = tenantId ? `onboarding_workflow_steps_${tenantId}` : null;
    if (key) {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: OnboardingWorkflowStep) => ({
            ...s,
            documents: s.documents && s.documents.length > 0 ? s.documents : getStepDefaultDocuments(s),
            action_tags: s.action_tags && s.action_tags.length > 0 ? s.action_tags : getStepDefaultActionTags(s)
          }));
        }
      }
    }
  } catch (e) {
    console.warn('Load onboarding steps error:', e);
  }
  return DEFAULT_ONBOARDING_STEPS;
};

export const saveWorkflowStepsToStorage = (steps: OnboardingWorkflowStep[], tenantId?: string | null) => {
  try {
    if (tenantId) {
      localStorage.setItem(`onboarding_workflow_steps_${tenantId}`, JSON.stringify(steps));
    }
    localStorage.removeItem('onboarding_workflow_steps');
  } catch (e) {
    console.warn('Save onboarding steps error:', e);
  }
};
