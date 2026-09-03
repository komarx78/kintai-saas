export interface RevisionContractDoc {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name: string;
  revision_id?: string;
  applied_year_month: string; // 例: '2026-09'
  revision_date: string; // 例: '2026-09-01'
  revision_type: string; // 'regular' | 'base_up' | 'promotion' etc.
  base_salary: number;
  previous_base_salary?: number;
  diff_base_salary?: number;
  revision_rate?: number;
  position_allowance: number;
  qualification_allowance: number;
  housing_allowance: number;
  commuting_allowance: number;
  family_allowance: number;
  reason_note?: string;
  status: 'pending_signature' | 'signed';
  signed_at?: string;
  signature_name?: string;
  created_at: string;
}

// ローカルストレージキー
const getStorageKey = (tenantId: string) => `revision_contracts_${tenantId}`;

export function getRevisionContracts(tenantId: string): RevisionContractDoc[] {
  if (!tenantId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(tenantId));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('getRevisionContracts error:', e);
  }
  return [];
}

export function saveRevisionContracts(tenantId: string, docs: RevisionContractDoc[]): void {
  if (!tenantId) return;
  try {
    localStorage.setItem(getStorageKey(tenantId), JSON.stringify(docs));
  } catch (e) {
    console.error('saveRevisionContracts error:', e);
  }
}

export function addOrUpdateRevisionContract(tenantId: string, doc: RevisionContractDoc): void {
  const list = getRevisionContracts(tenantId);
  const index = list.findIndex(d => d.id === doc.id || (d.user_id === doc.user_id && d.applied_year_month === doc.applied_year_month));
  if (index >= 0) {
    list[index] = { ...list[index], ...doc };
  } else {
    list.unshift(doc);
  }
  saveRevisionContracts(tenantId, list);
}

export function signRevisionContract(tenantId: string, docId: string, signatureName: string): RevisionContractDoc | null {
  const list = getRevisionContracts(tenantId);
  const target = list.find(d => d.id === docId);
  if (target) {
    target.status = 'signed';
    target.signed_at = new Date().toISOString();
    target.signature_name = signatureName;
    saveRevisionContracts(tenantId, list);
    return target;
  }
  return null;
}

export function deleteRevisionContract(tenantId: string, docIdOrRevisionId: string): void {
  const list = getRevisionContracts(tenantId);
  const next = list.filter(d => d.id !== docIdOrRevisionId && d.revision_id !== docIdOrRevisionId);
  saveRevisionContracts(tenantId, next);
}
