/**
 * 労働条件通知書・雇用契約書 条文テンプレート ＆ 就業規則解析・AI条文清書エンジン
 */

export interface LaborContractTemplate {
  // 1. 契約期間・更新
  indefinite_text: string;
  fixed_term_renew_text: string;
  trial_period_template: string;

  // 2. 就業場所・従事する業務
  work_location_default: string;
  work_location_scope: string; // 就業場所の変更の範囲
  job_description_default: string;
  job_description_scope: string; // 業務の変更の範囲

  // 3. 労働時間・休憩・時間外労働
  work_time_special_notes: string;
  overtime_work_notes: string;

  // 4. 休日・休暇
  holidays_special_notes: string;
  paid_leave_rules_article: string; // 就業規則の有休条項（例: 第28条）

  // 5. 賃金・諸手当
  commuting_allowance_notes: string;
  fixed_overtime_clause: string;
  raise_bonus_notes: string;

  // 6. 退職・解雇・定年（就業規則連動）
  resignation_procedure_text: string; // 自己都合退職の手続き（例: 30日前の届出）
  resignation_rules_article: string; // 就業規則の退職条項（例: 第45条）
  retirement_age_text: string; // 定年制（例: 60歳、65歳までの再雇用制度あり）
  retirement_rules_article: string; // 就業規則の定年条項（例: 第46条）
  dismissal_procedure_text: string; // 解雇の事由及び手続き
  dismissal_rules_article: string; // 就業規則の解雇条項（例: 第48条）

  // 社印画像URL (Base64 または Web URL)
  company_seal_url?: string;
  updated_at?: string;
}

export const DEFAULT_LABOR_CONTRACT_TEMPLATE: LaborContractTemplate = {
  indefinite_text: '期間の定めなし（無期雇用契約）',
  fixed_term_renew_text: '契約更新の有無: 自動更新する / 契約満了時の業務量、従事している業務の進捗状況、勤務成績・態度、会社の経営状況等により判断する。',
  trial_period_template: '試用期間: 入社日より {months} ヶ月間（労働条件・賃金の変更なし）',

  work_location_default: '本社（滋賀県大津市坂本3丁目21-16）または会社が指定する就業場所',
  work_location_scope: '就業場所の変更の範囲: 会社の本社および会社が指定するすべての就業場所（テレワーク実施場所を含む）',
  job_description_default: '業務全般 および 会社の指示する業務',
  job_description_scope: '従事すべき業務の変更の範囲: 会社の定めるすべての業務',

  work_time_special_notes: '始業・終業時刻は業務の都合により繰り上げまたは繰り下げることがある。',
  overtime_work_notes: 'あり（業務の都合により所定時間外労働・休日労働・深夜労働を命じる場合がある。時間外割増賃金等は法定通り支給する）',

  holidays_special_notes: '国民の祝日、年末年始休暇、夏季休暇、会社が指定する特別休日を含む。',
  paid_leave_rules_article: '就業規則第28条（年次有給休暇）に定める通り、雇入れの日から6ヶ月継続勤務し全労働日の8割以上出勤した場合に法定日数を付与する。',

  commuting_allowance_notes: '実費支給（非課税限度額内、月額上限150,000円まで）',
  fixed_overtime_clause: '固定残業手当は所定の時間外労働に充当し、これを超える時間外・深夜・休日労働を行った場合はその超過分を別途全額支給する。',
  raise_bonus_notes: '昇給: 会社の業績及び本人の勤務成績により年1回査定 / 賞与: 会社の業績に応じて支給 / 退職金: 就業規則の定めに従う',

  resignation_procedure_text: '自己都合退職の手続き: 退職を希望する日の30日前までに会社所定の退職届を提出すること。引継ぎ等を完了させること。',
  resignation_rules_article: '就業規則第45条（退職手続）',
  retirement_age_text: '定年制: あり（満60歳到達の月末をもって定年退職とする。ただし本人が希望し健康状態に問題がない場合は、満65歳まで継続雇用・再雇用する制度あり）。',
  retirement_rules_article: '就業規則第46条（定年及び継続雇用）',
  dismissal_procedure_text: '解雇の事由及び手続き: 30日前の予告または平均賃金の30日分以上の解雇予告手当の支払をもって行う。天災事変その他やむを得ない事由により事業の継続が不可能となった場合または労働者の責に帰すべき事由による場合はこの限りではない。',
  dismissal_rules_article: '就業規則第48条（解雇事由）'
};

/**
 * 就業規則テキストから、条文番号（第○条）と条項内容をインテリジェントに自動抽出
 */
export function extractRulesArticlesFromText(rulesText: string): {
  resignationArticle: string;
  retirementArticle: string;
  dismissalArticle: string;
  paidLeaveArticle: string;
  workHoursArticle: string;
} {
  if (!rulesText) {
    return {
      resignationArticle: '就業規則第45条（退職手続）',
      retirementArticle: '就業規則第46条（定年）',
      dismissalArticle: '就業規則第48条（解雇）',
      paidLeaveArticle: '就業規則第28条（年次有給休暇）',
      workHoursArticle: '就業規則第15条（労働時間）'
    };
  }

  // 1. 退職条文の抽出 (例: 第45条（退職） / 第〇条 退職)
  const resignMatch = rulesText.match(/第([0-9０-９一二三四五六七八九十百]+)条[（(]?(?:自己都合)?退職[)）]?/);
  const resignationArticle = resignMatch ? `就業規則第${resignMatch[1]}条（退職）` : '就業規則第45条（退職）';

  // 2. 定年条文の抽出 (例: 第46条（定年）)
  const retireMatch = rulesText.match(/第([0-9０-９一二三四五六七八九十百]+)条[（(]?(?:定年|継続雇用|再雇用)[)）]?/);
  const retirementArticle = retireMatch ? `就業規則第${retireMatch[1]}条（定年及び継続雇用）` : '就業規則第46条（定年）';

  // 3. 解雇条文の抽出 (例: 第48条（解雇）)
  const dismissMatch = rulesText.match(/第([0-9０-９一二三四五六七八九十百]+)条[（(]?解雇[)）]?/);
  const dismissalArticle = dismissMatch ? `就業規則第${dismissMatch[1]}条（解雇事由）` : '就業規則第48条（解雇）';

  // 4. 有休条文の抽出 (例: 第28条（年次有給休暇）)
  const leaveMatch = rulesText.match(/第([0-9０-９一二三四五六七八九十百]+)条[（(]?(?:年次有給休暇|有給休暇)[)）]?/);
  const paidLeaveArticle = leaveMatch ? `就業規則第${leaveMatch[1]}条（年次有給休暇）` : '就業規則第28条（年次有給休暇）';

  // 5. 労働時間条文の抽出 (例: 第15条（労働時間）)
  const hourMatch = rulesText.match(/第([0-9０-９一二三四五六七八九十百]+)条[（(]?(?:労働時間|所定労働時間)[)）]?/);
  const workHoursArticle = hourMatch ? `就業規則第${hourMatch[1]}条（労働時間）` : '就業規則第15条（労働時間）';

  return {
    resignationArticle,
    retirementArticle,
    dismissalArticle,
    paidLeaveArticle,
    workHoursArticle
  };
}

/**
 * ユーザーの箇条書きメモから、労働基準法準拠の公式条文をAIスマート清書
 */
export function generateOfficialClausesFromNotes(
  notes: string,
  rulesArticles?: { resignationArticle: string; retirementArticle: string; dismissalArticle: string; paidLeaveArticle: string }
): Partial<LaborContractTemplate> {
  const cleanNotes = notes || '';
  const arts = rulesArticles || {
    resignationArticle: '就業規則第45条（退職手続）',
    retirementArticle: '就業規則第46条（定年）',
    dismissalArticle: '就業規則第48条（解雇）',
    paidLeaveArticle: '就業規則第28条（年次有給休暇）'
  };

  const result: Partial<LaborContractTemplate> = {};

  // 就業場所・テレワークに関するキーワード
  if (cleanNotes.includes('テレワーク') || cleanNotes.includes('在宅') || cleanNotes.includes('リモート')) {
    result.work_location_default = '本社および労働者の自宅（会社が認めたテレワーク場所）';
    result.work_location_scope = '就業場所の変更の範囲: 会社の本社、営業所、および会社が指示または承認する就業場所（在宅・テレワークを含む）';
  }

  // 試用期間のキーワード
  const trialMatch = cleanNotes.match(/([1-6１-６])\s*(?:ヶ月|か月|カ月|月)/);
  if (trialMatch) {
    result.trial_period_template = `試用期間: 入社日より ${trialMatch[1]} ヶ月間（労働条件・基本賃金の変更なし）`;
  }

  // 残業・時間外労働のキーワード
  if (cleanNotes.includes('残業なし') || cleanNotes.includes('残業ゼロ')) {
    result.overtime_work_notes = '原則として所定労働時間を超える時間外労働は行わせない。';
  } else if (cleanNotes.includes('みなし') || cleanNotes.includes('固定残業')) {
    result.overtime_work_notes = 'あり（36協定の範囲内において所定外労働・休日労働を命じることがある）。固定残業手当を超過した時間外労働については別途全額割増賃金を支給する。';
  }

  // 休日・休暇のキーワード
  if (cleanNotes.includes('シフト') || cleanNotes.includes('交代制')) {
    result.holidays_special_notes = 'シフト表（毎月25日までに翌月分を通知）に定める週2日の公休、および年末年始・夏季特別休暇とする。';
  } else if (cleanNotes.includes('土日祝') || cleanNotes.includes('完全週休2日')) {
    result.holidays_special_notes = '完全週休2日制（土曜日・日曜日）、国民の祝日、年末年始休暇（12/29〜1/3）、夏季休暇とする。';
  }

  // 退職届の提出期限 (例: 14日前, 1ヶ月前, 30日前, 2ヶ月前)
  const resignDayMatch = cleanNotes.match(/([0-9０-９]+)\s*(?:日|ヶ月|か月|カ月)前/);
  if (resignDayMatch) {
    const term = resignDayMatch[0];
    result.resignation_procedure_text = `自己都合退職の手続き: 退職を希望する日の ${term} までに会社所定の退職届を提出し、後任者への業務引継ぎを完了すること。`;
  } else {
    result.resignation_procedure_text = `自己都合退職の手続き: 退職を希望する日の30日前までに会社所定の退職届を提出すること。(${arts.resignationArticle})`;
  }

  // 定年年齢のキーワード (例: 60歳, 65歳)
  if (cleanNotes.includes('65歳') && cleanNotes.includes('定年')) {
    result.retirement_age_text = `定年制: あり（満65歳到達の事業年度末をもって定年とする。希望者には70歳までの継続雇用制度あり）。(${arts.retirementArticle})`;
  } else {
    result.retirement_age_text = `定年制: あり（満60歳到達の月末をもって定年退職とする。本人の希望に応じ満65歳までの再雇用制度あり）。(${arts.retirementArticle})`;
  }

  // 解雇規定
  result.dismissal_procedure_text = `解雇の事由及び手続き: ${arts.dismissalArticle}に定める懲戒解雇・普通解雇事由に該当する場合に限り、30日前の予告または予告手当の支払をもって行う。`;
  result.resignation_rules_article = arts.resignationArticle;
  result.retirement_rules_article = arts.retirementArticle;
  result.dismissal_rules_article = arts.dismissalArticle;
  result.paid_leave_rules_article = arts.paidLeaveArticle;

  return result;
}

export function getLaborContractTemplateFromStorage(tId: string): LaborContractTemplate {
  try {
    const raw = localStorage.getItem(`labor_contract_template_${tId}`) || localStorage.getItem('labor_contract_template');
    if (raw) {
      return { ...DEFAULT_LABOR_CONTRACT_TEMPLATE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to parse labor_contract_template from LocalStorage:', e);
  }
  return DEFAULT_LABOR_CONTRACT_TEMPLATE;
}

export function saveLaborContractTemplateToStorage(tId: string, tpl: LaborContractTemplate) {
  try {
    const payload = JSON.stringify({ ...tpl, updated_at: new Date().toISOString() });
    localStorage.setItem(`labor_contract_template_${tId}`, payload);
    localStorage.setItem('labor_contract_template', payload);
  } catch (e) {
    console.warn('Failed to save labor_contract_template to LocalStorage:', e);
  }
}
