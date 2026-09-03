import { supabase } from './supabase';

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

/**
 * 同期取得（LocalStorageキャッシュの即時読み出し）
 */
export function getRevisionContracts(tenantId: string): RevisionContractDoc[] {
  if (!tenantId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(tenantId)) || localStorage.getItem('revision_contracts');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('getRevisionContracts error:', e);
  }
  return [];
}

/**
 * データベース（Supabase tenants）から全端末で同期取得
 */
export async function fetchRevisionContracts(tenantId: string): Promise<RevisionContractDoc[]> {
  if (!tenantId) return [];
  // 1. キャッシュから即時取得
  let result = getRevisionContracts(tenantId);

  // 2. データベースから最新データを取得・同期
  try {
    const { data: tData } = await supabase
      .from('tenants')
      .select('revision_contracts_data')
      .eq('id', tenantId)
      .maybeSingle();

    if (tData?.revision_contracts_data && Array.isArray(tData.revision_contracts_data)) {
      result = tData.revision_contracts_data;
      localStorage.setItem(getStorageKey(tenantId), JSON.stringify(result));
      localStorage.setItem('revision_contracts', JSON.stringify(result));
    }
  } catch (err) {
    console.warn('DB fetch revision contracts warning:', err);
  }

  return result;
}

/**
 * データベース（Supabase tenants）およびキャッシュへ保存（全端末へ即時共有）
 */
export async function saveRevisionContracts(tenantId: string, docs: RevisionContractDoc[]): Promise<void> {
  if (!tenantId) return;
  // 1. ローカルキャッシュへ即時保存
  try {
    localStorage.setItem(getStorageKey(tenantId), JSON.stringify(docs));
    localStorage.setItem('revision_contracts', JSON.stringify(docs));
  } catch (e) {
    console.error('saveRevisionContracts local error:', e);
  }

  // 2. データベースへ永続化（全端末即時共有）
  try {
    await supabase
      .from('tenants')
      .update({ revision_contracts_data: docs })
      .eq('id', tenantId);
  } catch (err) {
    console.warn('DB save revision contracts notice:', err);
  }
}

export async function addOrUpdateRevisionContract(tenantId: string, doc: RevisionContractDoc): Promise<void> {
  const list = await fetchRevisionContracts(tenantId);
  const index = list.findIndex(d => d.id === doc.id || (d.user_id === doc.user_id && d.applied_year_month === doc.applied_year_month));
  if (index >= 0) {
    list[index] = { ...list[index], ...doc };
  } else {
    list.unshift(doc);
  }
  await saveRevisionContracts(tenantId, list);
}

export async function signRevisionContract(tenantId: string, docId: string, signatureName: string): Promise<RevisionContractDoc | null> {
  const list = await fetchRevisionContracts(tenantId);
  const target = list.find(d => d.id === docId);
  if (target) {
    target.status = 'signed';
    target.signed_at = new Date().toISOString();
    target.signature_name = signatureName;
    await saveRevisionContracts(tenantId, list);
    return target;
  }
  return null;
}

export async function deleteRevisionContract(tenantId: string, docIdOrRevisionId: string): Promise<void> {
  const list = await fetchRevisionContracts(tenantId);
  const next = list.filter(d => d.id !== docIdOrRevisionId && d.revision_id !== docIdOrRevisionId);
  await saveRevisionContracts(tenantId, next);
}
