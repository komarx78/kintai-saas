export interface OnboardingWorkflowStep {
  id: string;
  step_number: number;
  name: string;
  description: string;
  required_action: 'contract_sign' | 'document_submit' | 'admin_review' | 'gov_procedure' | 'complete' | 'custom';
  approver_type: 'all_admins' | 'specific_user' | 'department_head';
  approver_name?: string;
  is_enabled: boolean;
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

export const DEFAULT_ONBOARDING_STEPS: OnboardingWorkflowStep[] = [
  {
    id: 'step_1',
    step_number: 1,
    name: '内定・雇用契約の合意',
    description: '労働条件通知書（雇用契約書）の発行と内容合意',
    required_action: 'contract_sign',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true
  },
  {
    id: 'step_2',
    step_number: 2,
    name: '従業員による書類提出',
    description: '通帳原本・通勤経路・扶養控除等申告書・マイナンバーの提出',
    required_action: 'document_submit',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true
  },
  {
    id: 'step_3',
    step_number: 3,
    name: '労務書類審査・原本確認',
    description: '提出書類・通帳写真の審査、差戻しまたは承認・マスタ反映',
    required_action: 'admin_review',
    approver_type: 'all_admins',
    approver_name: '労務責任者',
    is_enabled: true
  },
  {
    id: 'step_4',
    step_number: 4,
    name: '官公庁届出（年金・社保等）',
    description: '年金事務所資格取得届、ハローワーク雇用保険届、住民税特別徴収切替',
    required_action: 'gov_procedure',
    approver_type: 'all_admins',
    approver_name: '労務担当者',
    is_enabled: true
  },
  {
    id: 'step_5',
    step_number: 5,
    name: '受入完了・本稼働開始',
    description: '勤怠打刻・シフト募集・給与計算への正式連動と受入完了',
    required_action: 'complete',
    approver_type: 'all_admins',
    approver_name: '管理者全員',
    is_enabled: true
  }
];

export const getWorkflowStepsFromStorage = (): OnboardingWorkflowStep[] => {
  try {
    const saved = localStorage.getItem('onboarding_workflow_steps');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Load onboarding steps error:', e);
  }
  return DEFAULT_ONBOARDING_STEPS;
};

export const saveWorkflowStepsToStorage = (steps: OnboardingWorkflowStep[]) => {
  try {
    localStorage.setItem('onboarding_workflow_steps', JSON.stringify(steps));
  } catch (e) {
    console.warn('Save onboarding steps error:', e);
  }
};
