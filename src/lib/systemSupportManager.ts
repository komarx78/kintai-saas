import { supabase } from './supabase';
import { sendSuggestionNotification } from './systemSupportNotification';

// 💡 システム操作FAQ（Q&A）の型定義
export interface SystemFaqItem {
  id: string;
  category: 'kintai' | 'leave' | 'shift' | 'payroll' | 'onboarding' | 'settings' | 'general';
  question: string;
  answer: string;
  keyword: string;
  preview_type?: string; // 画面UIモックタイプ: 'kintai_clock' | 'kintai_fix' | 'leave_request' | 'shift_submit' | 'payslip_view' | 'onboarding_passbook' | 'password_reset'
  html_preview?: string; // 実際の画面HTMLコード（直接埋め込み用）
  updated_at: string;
}

// 📬 システム改善要望（全契約企業から回収するご意見・機能リクエスト・Q&A相談）
export interface SystemImprovementSuggestion {
  id: string;
  tenant_id: string;
  tenant_name: string;
  user_id: string;
  user_name: string;
  category: 'feature' | 'ui_ux' | 'bug' | 'performance' | 'qa_help' | 'other';
  title: string;
  content: string;
  status: 'pending' | 'reviewing' | 'planned' | 'completed' | 'declined';
  admin_reply?: string;
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
  kintai: '⏰ 勤怠・打刻の操作',
  leave: '🌴 有給休暇・各種申請',
  shift: '📅 シフト希望・作成',
  payroll: '💰 給与明細・計算',
  onboarding: '📄 入退社・労務手続き',
  settings: '🏢 会社マスタ・休日設定',
  general: '⚙️ ログイン・基本操作'
} as const;

export const SYSTEM_SUGGESTION_CATEGORIES = {
  feature: '🚀 新機能リクエスト',
  ui_ux: '🎨 画面・使いやすさ改善',
  bug: '🐛 不具合・動作報告',
  performance: '⚡ 表示速度・快適化',
  qa_help: '❓ 操作の質問・Q&A相談',
  other: '💬 その他ご意見・ご要望'
} as const;

export const SYSTEM_SUGGESTION_STATUSES = {
  pending: { label: '未対応・受付済', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  reviewing: { label: '開発検討中', color: 'bg-amber-50 text-amber-700 border-amber-300' },
  planned: { label: '次回アプデ実装予定', color: 'bg-blue-50 text-blue-700 border-blue-300' },
  completed: { label: '実装・改善完了', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
  declined: { label: '検討見送り', color: 'bg-rose-50 text-rose-700 border-rose-300' }
} as const;

// 📱 操作ガイドに自動埋め込みする実際のシステム画面プレビュー定義
export const SYSTEM_GUIDE_PREVIEW_TYPES = {
  monthly_attendance: '📅 月次勤怠・有給照会画面（月間勤怠照会テーブル・「申請する」ボタン）',
  monthly_attendance_summary_export: '📊 月次勤怠サマリーバッジ ＆ PDF・CSV出力画面',
  kintai_clock: '⏰ ホーム（打刻）画面（出退勤ボタン・現在時刻・ステータス）',
  kintai_break_time: '☕ 休憩時間登録・打刻修正画面（自動控除・分数プリセット）',
  kintai_night_shift: '🌙 夜勤・日跨ぎ勤務打刻画面（翌朝退勤・深夜割増連動）',
  kintai_gps_help: '📍 スマホGPS位置情報エラー・端末設定許可画面',
  leave_request: '🌴 有給休暇・代休 残数ウィジェット（保有残数・年間5日義務）',
  leave_request_cancel: '↩️ 各種申請: 直近の申請履歴・状況一覧 ＆ 「↩️ 取下げ」ボタン画面',
  leave_half_day: '🌴 午前・午後半休（0.5日消化）申請画面',
  leave_balance_check: '🌴 有給残数 ＆ 年間5日取得義務カード',
  special_leave_apply: '💌 特別休暇（慶弔・結婚等）および代休申請画面',
  shift_submit: '📅 シフト希望・確定シフト画面（月間カレンダー希望入力・確定シフト）',
  shift_confirmed_view: '📅 確定シフトの確認（ホーム予定 ＆ カレンダー確定バッジ）',
  shift_admin_manage: '📅 管理者: シフト管理（部下申請承認・必要枠設定・下書き確定Publish）',
  payslip_view: '📄 Web給与明細・源泉徴収票画面（支給・控除・差引支給額）',
  payslip_bonus_tax: '🎁 賞与支払明細書 ＆ 国税庁公式源泉徴収票画面',
  payroll_admin_calc: '💰 管理者: 給与計算・明細（勤怠から一括自動計算・一括確定Web公開）',
  attendance_admin: '🏢 管理者: 月間勤怠・出勤簿管理（打刻・休憩直接修正・締め確定）',
  company_master_settings: '🏢 管理者: 会社・全社労務マスタ設定（就業時間パターン・給与締め日設定）',
  company_calendar_settings: '📅 管理者: 年間営業カレンダー ＆ 休日マップ（営業日・休日・A4印刷）',
  onboarding_passbook: '📄 入社手続き・通帳写真提出と口座登録画面',
  contract_sign: '📝 労働条件通知書 兼 雇用契約書 電子押印・同意画面',
  official_ledger_print: '📚 労務・法定帳票発行センター（労働者名簿・源泉徴収簿・賃金台帳の公式A4印刷）',
  employee_admin_manage: '👥 管理者: 従業員管理（招待コード・追加・退職・復職管理）',
  password_reset: '⚙️ ログイン・パスワード再設定画面',
  pwa_install: '📱 スマートフォン: ホーム画面アプリアイコン追加（PWA）'
} as const;

// 💡 カテゴリやキーワードに応じて最適な画面UIモックタイプを自動判定するヘルパー
export function resolveGuidePreviewType(item: Partial<SystemFaqItem>): string {
  if (item.preview_type) return item.preview_type;
  
  const q = `${item.question || ''} ${item.keyword || ''} ${item.answer || ''}`;
  if (q.includes('取下げ') || q.includes('取消') || q.includes('取り消したい') || q.includes('変更したい時')) return 'leave_request_cancel';
  if (q.includes('確定したシフト') || q.includes('確定シフト') || q.includes('本日のシフト予定')) return 'shift_confirmed_view';
  if (q.includes('出勤日数や労働時間を確認') || q.includes('PDF・CSV出力') || q.includes('CSV出力') || q.includes('PDF出力')) return 'monthly_attendance_summary_export';
  if (q.includes('休憩時間')) return 'kintai_break_time';
  if (q.includes('夜勤') || q.includes('日またぎ') || q.includes('日跨ぎ')) return 'kintai_night_shift';
  if (q.includes('半日') || q.includes('半休') || q.includes('午前半休') || q.includes('午後半休')) return 'leave_half_day';
  if (q.includes('残り日数') || q.includes('残数') || q.includes('有効期限') || q.includes('5日義務')) return 'leave_balance_check';
  if (q.includes('特別休暇') || q.includes('慶弔') || q.includes('忌引き') || q.includes('結婚') || q.includes('代休')) return 'special_leave_apply';
  if (q.includes('ホーム画面にアイコン') || q.includes('PWA') || q.includes('アプリアイコン')) return 'pwa_install';
  if (q.includes('契約書') || q.includes('電子押印') || q.includes('電子署名') || q.includes('同意') || q.includes('労働条件通知書')) return 'contract_sign';
  if (q.includes('名簿') || q.includes('名ぼ') || q.includes('源泉徴収簿') || q.includes('賃金台帳') || q.includes('法定帳票') || q.includes('公式A4印刷')) return 'official_ledger_print';
  if (q.includes('営業カレンダー') || q.includes('営業日・休日マップ') || q.includes('年間休日')) return 'company_calendar_settings';
  if (q.includes('所定時間') || q.includes('締め日') || q.includes('会社マスタ') || q.includes('全社労務マスタ')) return 'company_master_settings';
  if (q.includes('勤怠から一括自動計算') || q.includes('給与計算') || q.includes('一括確定')) return 'payroll_admin_calc';
  if (q.includes('賞与明細') || q.includes('源泉徴収票')) return 'payslip_bonus_tax';
  if (q.includes('必要枠') || q.includes('Publish') || q.includes('シフト確定') || q.includes('シフト管理')) return 'shift_admin_manage';
  if (q.includes('招待コード') || q.includes('退職') || q.includes('復職') || q.includes('従業員管理')) return 'employee_admin_manage';
  if (q.includes('GPS') || q.includes('位置情報')) return 'kintai_gps_help';
  if (q.includes('出勤簿') || q.includes('締め確定') || q.includes('月次締め') || q.includes('全社集計') || q.includes('打刻編集')) return 'attendance_admin';
  if (q.includes('有給') || q.includes('有休') || q.includes('休暇')) return 'leave_request';
  if (q.includes('月次勤怠') || q.includes('月間勤怠') || q.includes('照会') || q.includes('修正申請') || q.includes('打刻忘れ') || q.includes('押し忘れ') || q.includes('間違え') || q.includes('申請する')) return 'monthly_attendance';
  if (q.includes('打刻') || q.includes('出勤') || q.includes('退勤') || q.includes('ステータス') || q.includes('時計')) return 'kintai_clock';
  if (q.includes('シフト') || q.includes('希望提出')) return 'shift_submit';
  if (q.includes('通帳') || q.includes('入社')) return 'onboarding_passbook';
  if (q.includes('パスワード') || q.includes('ログイン') || q.includes('再設定')) return 'password_reset';

  switch (item.category) {
    case 'kintai': return 'monthly_attendance';
    case 'leave': return 'leave_request';
    case 'shift': return 'shift_submit';
    case 'payroll': return 'payslip_view';
    case 'onboarding': return 'onboarding_passbook';
    case 'general': return 'password_reset';
    case 'settings': return 'company_master_settings';
    default: return 'monthly_attendance';
  }
}

// 🌟 初心者がつまずきやすいポイントを完全網羅した公式操作マニュアル・FAQ一覧
export const DEFAULT_SYSTEM_FAQS: SystemFaqItem[] = [
  // ─── ⏰ 勤怠・打刻の操作 ───
  {
    id: 'sfaq-k-1',
    category: 'kintai',
    question: '出勤・退勤の打刻はどう操作すればいいですか？スマホでも可能ですか？',
    answer: '【打刻の手順】\n1. 左メニューの「ホーム（打刻）」を開きます（ポータルからは「勤怠・有給管理」カードをクリック）。\n2. 画面中央の大きな時計の下にある、青い「出勤」ボタン、または退勤時にオレンジの「退勤」ボタンをタップするだけで即座に打刻が記録されます。\n3. 打刻後、「現在のステータス」が「未出勤」「勤務中」「退勤済」へと自動更新されます。\n4. スマートフォンやタブレットのブラウザからも、PCと同一のアカウントでアクセスしてそのまま打刻できます。\n※ 不正打刻（虚偽の遠隔打刻）防止のため、スマートフォンからの打刻時はGPS位置情報の取得が必須となります。PCからの打刻時は位置情報は不要です。',
    keyword: '打刻 出勤 退勤 ホーム ステータス スマホ スマートフォン GPS ボタン 押し方 不正防止',
    preview_type: 'kintai_clock',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-2',
    category: 'kintai',
    question: '打刻を忘れてしまった時や、間違えて押してしまった場合の修正方法は？',
    answer: '【打刻修正申請の手順】\n1. 左メニューの「月次勤怠・有給照会」をクリックします。\n2. 「月間勤怠照会」一覧テーブルが表示されますので、修正したい該当日の行を探します。\n3. 該当日の行の右端にある青い「申請する」ボタンをクリックします（または左メニューの「各種申請」を開きます）。\n4. 「各種申請フォーム」が開き、申請種類「打刻修正」、対象日、区分（出勤/退勤）、正しい打刻時間、休憩時間（分）、事由・備考を入力します。\n5. 最後に「申請を送信」をクリックします。上長または管理者が承認すると、勤怠実績テーブルが自動更新されます。',
    keyword: '月次勤怠・有給照会 月間勤怠照会 申請する 打刻忘れ 押し忘れ 修正申請 変更 間違い 時間 承認',
    preview_type: 'monthly_attendance',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-6',
    category: 'kintai',
    question: '「月次勤怠・有給照会」画面で自分の出勤日数や労働時間を確認したり、PDF・CSV出力するには？',
    answer: '【勤怠実績の確認・出力手順】\n1. 左メニューの「月次勤怠・有給照会」をクリックします。\n2. 画面上部の「月間勤怠照会」にある左右の矢印ボタン（< 2026年9月 >）で確認したい年月を切り替えます。\n3. 上部のサマリーバッジに「出勤: 〇日」「実働: 〇時間〇分」「残業: 〇時間〇分」の月次集計が自動表示されます。\n4. 右上の「📄 PDF出力 (印刷)」ボタンを押すと公式レイアウトで印刷・PDF保存でき、「📊 CSV出力」ボタンを押すと勤怠実績のCSVデータを即座にダウンロードできます。',
    keyword: '月次勤怠・有給照会 月間勤怠照会 PDF出力 印刷 CSV出力 出勤日数 実働時間 残業時間',
    preview_type: 'monthly_attendance_summary_export',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-3',
    category: 'kintai',
    question: '休憩時間はどのように登録・確認・修正できますか？',
    answer: '【休憩時間の登録と修正方法】\n1. 通常時（自動控除）:\n打刻時刻に基づき、法定の所定休憩時間（実労働6時間超で45分、8時間超で60分）が自動控除されて実働・残業時間が計算されます。\n\n2. 個別の休憩時間を登録・修正したい場合:\n左メニュー「月次勤怠・有給照会」の該当日右端にある「申請する」をクリックし、申請種類「打刻修正」を選択します。\n「休憩時間（分）」欄に希望の分数（0分/45分/60分/90分のプリセット選択、または直接入力）を入力し、事由・備考を添えて「申請を送信」をクリックします。\n承認されると、指定した休憩時間が実績に反映され、実働・残業時間が自動再計算されます。\n\n3. 管理者による直接修正:\n管理者の「月間勤怠・出勤簿管理」画面からも、各日の「編集」ボタンから休憩時間を直接入力・保存できます。',
    keyword: '休憩 休憩時間 登録 修正 打刻修正 自動控除 60分 45分 0分 90分 申請 管理者',
    preview_type: 'kintai_break_time',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-4',
    category: 'kintai',
    question: '日付をまたぐ夜勤（徹夜勤務・24時以降の退勤）はどう打刻しますか？',
    answer: '【夜勤の打刻ルール】\n本システムは24時を超える勤務（日跨ぎ勤務）に自動対応しています。\n前日に「出勤」を押した後、翌朝にそのまま「退勤」を押すと、自動的に前日の出勤データと紐付いた一連の勤務として実働時間・深夜割増時間が自動計算されます。日をまたいだからといって深夜0時に再打刻する必要はありません。',
    keyword: '夜勤 深夜 日跨ぎ 日付またぐ 徹夜 24時',
    preview_type: 'kintai_night_shift',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-5',
    category: 'kintai',
    question: '位置情報（GPS）が取得できない、打刻ボタンが押せない時の対処法は？',
    answer: '【GPSエラーの解決手順】\nスマートフォンからの打刻時は、不正防止のため位置情報（GPS）の取得が必須となります。\n画面に「位置情報（GPS）の取得エラー」が表示された場合は、以下の手順で許可してください。\n\n1. iPhone（Safari）の場合:\n「設定」＞「プライバシーとセキュリティ」＞「位置情報サービス」をONにし、SafariのWebサイトで「このAppの使用中のみ許可」を選択します。\n\n2. Android（Chrome）の場合:\n画面右上の3点メニュー ＞「設定」＞「サイトの設定」＞「位置情報」を「許可」に設定します。\n\n3. 画面を再読み込み（リロード）し、ブラウザ上部に「位置情報の利用を許可しますか？」と表示されたら【許可】を選択して再度「出勤」または「退勤」を押してください。',
    keyword: 'GPS 位置情報 エラー 押せない 許可 設定 スマホ 不正防止',
    preview_type: 'kintai_gps_help',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-7',
    category: 'kintai',
    question: '【管理者】全従業員の出勤簿確認、打刻・休憩時間の直接修正、月次締め確定の手順は？',
    answer: '【管理者出勤簿・締め確定の手順】\n1. 左メニューまたは管理メニューの「月間勤怠・出勤簿管理」を開きます。\n2. 全従業員の出勤日数、実労働時間、残業時間、休憩時間の一覧マトリクスが表示されます。\n3. 各従業員・日付の「編集」ボタンをクリックすると、打刻時間や休憩時間の直接修正が可能です。\n4. 月末の確認が完了したら、右上の「〇月度 勤怠締め確定」（例: 「9月度 勤怠締め確定」）ボタンをクリックして全社勤怠データをロックし、改ざんを防止します（解除が必要な場合は「締めロックを解除」で再編集可能です）。',
    keyword: '月間勤怠・出勤簿管理 出勤簿 締め確定 月次締め 全社集計 打刻編集 休憩時間直接修正 管理者 勤怠締め確定 締めロックを解除',
    preview_type: 'attendance_admin',
    updated_at: '2026-09-06'
  },

  // ─── 🌴 有給休暇・各種申請 ───
  {
    id: 'sfaq-l-1',
    category: 'leave',
    question: '有給休暇の申請手順を教えてください。どこから申請できますか？',
    answer: '【有給申請の手順】\n1. 左メニューの「各種申請」をクリックします（または「月次勤怠・有給照会」の該当日右端にある青い「申請する」ボタンをクリックします）。\n2. 「申請種類」プルダウンから「有給休暇（全休）」「有給休暇（午前半休）」「有給休暇（午後半休）」など希望の種別を選択します。\n3. 対象の「開始日」および「終了日」を選択し、「事由・備考」（私用のため等）を入力します。\n4. 「申請を送信」をクリックします。上長または管理者が承認すると、カレンダーに反映され残日数が自動消化されます。',
    keyword: '有給申請 有休 申請する 各種申請 月次勤怠・有給照会 取得 手順 承認',
    preview_type: 'leave_request',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-2',
    category: 'leave',
    question: '半日単位（午前半休・午後半休）で有給を取るにはどうしますか？',
    answer: '【半休の申請手順】\n左メニューの「各種申請」を開き、「申請種類」のドロップダウンを選択します。\n・午前の勤務を休む場合 ➔「有給休暇（午前半休）」を選択（0.5日消化）\n・午後の勤務を休む場合 ➔「有給休暇（午後半休）」を選択（0.5日消化）\n開始日・終了日と「事由・備考」を入力して「申請を送信」をクリックしてください。',
    keyword: '半休 半日有休 午前半休 午後半休 0.5日 各種申請',
    preview_type: 'leave_half_day',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-3',
    category: 'leave',
    question: '自分の有給休暇の残り日数（残日数）や有効期限はどこで確認できますか？',
    answer: '【残日数の確認方法】\n左メニューの「ホーム（打刻）」を開くと、打刻時計の隣に「有給休暇・代休 残数」カードが常時表示されています。\n・有給休暇（今年度付与分）\n・有給休暇（前年度繰越分）\n・有給休暇（合計残数）\n・利用可能な代休\nが一目で確認できます。また、法律で義務付けられている「年間5日取得義務」に対する取得済み日数と残り日数もアラート表示されます。',
    keyword: '有給残日数 残り ホーム 有給休暇・代休 残数 有効期限 付与 失効 5日義務',
    preview_type: 'leave_balance_check',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-4',
    category: 'leave',
    question: '慶弔休暇（忌引き・結婚）や代休などの特別休暇はどう申請しますか？',
    answer: '【特別休暇・代休の申請手順】\n左メニューの「各種申請」を開き、「申請種類」プルダウンから「特別休暇（慶弔など）」または「代休（全休）」「代休（午前半休）」「代休（午後半休）」を選択します。\n開始日・終了日と「事由・備考」（忌引き、本人結婚など）を入力して「申請を送信」をクリックしてください。就業規則で定められた有給特別休暇日数が自動適用されます。',
    keyword: '慶弔 忌引き 結婚 特別休暇 代休 各種申請',
    preview_type: 'special_leave_apply',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-5',
    category: 'leave',
    question: '一度提出した有給申請や打刻修正を取り消したい、または変更したい時は？',
    answer: '【申請の取消手順】\n左メニューの「各種申請」を開き、画面下部の「直近の申請履歴・状況」一覧を確認します。\n・上長が承認する前 ➔ 該当申請の右側にある「↩️ 取下げ」ボタンをクリックすれば即座に取下げ・キャンセルできます。\n・既に承認された後の変更 ➔ 社内の上長または管理者へ連絡し、管理者画面から勤怠データの直接修正を依頼してください。',
    keyword: '有給取消 取消 取り消し 変更 キャンセル 各種申請 申請履歴 取下げ',
    preview_type: 'leave_request_cancel',
    updated_at: '2026-09-06'
  },

  // ─── 📅 シフト希望・作成 ───
  {
    id: 'sfaq-s-1',
    category: 'shift',
    question: '【従業員】シフト希望はどうやって入力・提出すればいいですか？',
    answer: '【シフト希望の提出手順】\n1. 左メニューの「シフト希望・確定シフト」をクリックします（ホームの「🗓️ シフト希望を提出する」ボタンからも移動可能）。\n2. 7列の本格月間カレンダーが表示されますので、各日付セル内の「出勤」または「休み」ボタンをクリックします。\n3. 「出勤」を選んだ日は、希望勤務時間（例: 09:00 - 18:00）を入力します。\n4. 「🏖️ 会社所定休日を一括休み希望」ボタンを押すと、会社の公休日を一括で休み希望に設定できます。\n5. 全て入力したら、画面最下部の「シフト希望を提出する」ボタンをクリックします。',
    keyword: 'シフト希望・確定シフト シフト希望 提出 カレンダー 出勤 休み 一括休み希望',
    preview_type: 'shift_submit',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-2',
    category: 'shift',
    question: '【従業員】確定したシフトはどこで見られますか？',
    answer: '【確定シフトの確認手順】\n1. 左メニューの「シフト希望・確定シフト」を開くと、上長に承認されたシフトが藍色の「確定」バッジ付きでカレンダーに即時反映されます。\n2. また、左メニューの「ホーム（打刻）」の「本日のシフト予定」欄にも、本日の確定勤務時間（例: 09:00 〜 18:00）や公休日が自動表示されます。',
    keyword: '確定シフト シフト希望・確定シフト ホーム 本日のシフト予定 カレンダー 確認',
    preview_type: 'shift_confirmed_view',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-3',
    category: 'shift',
    question: '【管理者】スタッフから集まったシフト希望の確認と承認はどうやりますか？',
    answer: '【シフト希望の確認・承認手順】\n1. 左メニューの「部下からの申請承認」を開きます（または管理者メニュー「シフト管理」を開きます）。\n2. 提出されたシフト希望一覧が表示されますので、内容を確認して「承認してシフト確定」または「却下」をクリックします。\n3. 承認を実行すると、該当従業員の月間カレンダーおよびホーム画面へ「確定シフト」として即時反映されます。',
    keyword: 'シフト希望確認 承認 部下からの申請承認 管理者 確定反映',
    preview_type: 'shift_admin_manage',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-4',
    category: 'shift',
    question: '【管理者】完成した全社シフトを一括確定・公開するにはどうしますか？',
    answer: '【シフト確定・公開の手順】\n1. 管理者用「シフト管理」画面（/shift/admin）の月間マトリクスで全員のシフト配置を完了します。\n2. 画面右上の緑の「下書き確定（Publish）」ボタンをクリックします。公開を実行した瞬間に全従業員のマイカレンダー（「シフト希望・確定シフト」）へ確定シフトとして即時反映されます。\n3. 再調整が必要になった場合は、隣の「確定解除（下書きへ）」ボタンをクリックすればいつでも下書き状態に戻せます。',
    keyword: 'シフト確定 下書き確定 Publish 確定解除 公開 通知 全社 反映 管理者',
    preview_type: 'shift_admin_manage',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-5',
    category: 'shift',
    question: '【管理者】新しい勤務パターンや各時間帯の必要人数枠を設定・追加するには？',
    answer: '【必要シフト枠 ＆ 勤務パターンの設定手順】\n1. シフトの必要人数枠を設定する場合:\n管理者「シフト管理」画面右上の「必要枠設定」ボタン（/shift/admin/patterns）をクリックします。「平日」「土日」「祝日」タブを選択し、役割（ホール/キッチン等）と時間帯・必要人数を設定して「設定を保存」をクリックします。\n\n2. 全社基本の就業時間パターン（標準勤務時間等）を登録する場合:\nポータルの「🏢 会社・全社労務マスタ設定センター」を開き、「3. 年間営業カレンダー ＆ 就業時間」タブの「就業時間パターン一覧」から新規パターン（始業〜終業時刻・休憩時間）を追加し、「設定を一括保存」をクリックします。',
    keyword: '必要枠設定 必要シフト枠設定 勤務パターン シフトパターン 追加 設定 設定を保存 設定を一括保存',
    preview_type: 'shift_admin_manage',
    updated_at: '2026-09-06'
  },

  // ─── 💰 給与明細・計算 ───
  {
    id: 'sfaq-p-1',
    category: 'payroll',
    question: '【従業員】Web給与明細の閲覧やPDF印刷はどう操作しますか？',
    answer: '【給与明細の閲覧・印刷手順】\n1. 左メニューの「📄 Web給与明細・源泉徴収票・書類」をクリックします（ホーム画面下部の「給与明細・源泉徴収票・契約書類を確認」ボタンからも移動可能）。\n2. 上部タブの「💰 給与明細書」を開き、「支給月度」プルダウンから確認したい年月を選択すると、基本給・各種手当・残業代・控除合計・差引支給額（手取り）が表示されます。\n3. 右上の「印刷 / PDF保存」ボタンを押すと、マネーフォワード給与公式フォーマット準拠の給与明細書をPDF保存・印刷できます。スマートフォンからも保存・閲覧可能です。',
    keyword: 'Web給与明細・源泉徴収票 給与明細 Web明細 PDF 印刷 印刷 / PDF保存 ダウンロード スマホ 閲覧',
    preview_type: 'payslip_view',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-p-2',
    category: 'payroll',
    question: '源泉徴収票や過去の賞与明細はどこから確認できますか？',
    answer: '【賞与明細・源泉徴収票の確認手順】\n1. 賞与明細書: 左メニューの「📄 Web給与明細・源泉徴収票・書類」を開き、上部の「🎁 賞与明細書」タブを選択すると、確定支給された賞与明細を確認・「印刷 / PDF保存」できます。\n2. 源泉徴収票: 同画面の上部「🧾 源泉徴収票（国税庁公式）」タブを選択し、対象年度を選択すると、国税庁法定様式の源泉徴収票が自動生成され、ワンクリックで「印刷 / PDF保存」が可能です。',
    keyword: 'Web給与明細・源泉徴収票 源泉徴収票 賞与明細 ボーナス 過去 国税庁公式 印刷',
    preview_type: 'payslip_bonus_tax',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-p-3',
    category: 'payroll',
    question: '【管理者】勤怠の打刻データから給与を自動計算・試算する手順は？',
    answer: '【給与自動試算の手順】\n1. 管理ダッシュボードの「給与計算・明細」を開き、「月別給与計算・明細発行」タブを選択します。\n2. 対象月度を確認し、ツールバーの「⚡ 勤怠から一括自動計算」ボタンをクリックします。\n3. 実労働時間、法定外残業、深夜労働、休日労働時間、有給消化日数に、基本給や時給・各種手当が自動掛け合わされて総支給額および社会保険料・源泉所得税が瞬時に自動試算されます。\n※ 従業員マスタの設定（手当や扶養親族等）を修正した場合は「🔄 最新マスタから一括再計算」で即座に同期できます。\n4. 内容確認後、緑の「一括確定 (Web公開)」ボタンを押すと全従業員のマイページへWeb給与明細が一括配信されます（「一括下書きに戻す (公開取下げ)」も可能）。',
    keyword: '給与計算 自動計算 勤怠から一括自動計算 最新マスタから一括再計算 一括確定 Web公開 勤怠連動 試算 管理者',
    preview_type: 'payroll_admin_calc',
    updated_at: '2026-09-06'
  },

  // ─── 📄 入退社・労務手続き ───
  {
    id: 'sfaq-o-1',
    category: 'onboarding',
    question: '新入社員が入社手続き（口座写真・マイナンバー等）を提出する手順は？',
    answer: '【入社書類提出の手順】\n1. ポータル画面から「入退社・労務手続き」カードをクリックします（マイページへ移動）。\n2. 上部の申請タブから各項目を選択し、写真・必要事項を入力して送信します。\n   ①「口座情報」: 銀行名・支店・口座番号と、通帳見開きまたはキャッシュカード写真を撮影・添付して「口座情報を提出する」をクリック。\n   ②「通勤交通費」: 出発駅・到着駅・定期券または検索結果スクショを添付して「通勤費を申請する」をクリック。\n   ③「本人確認・マイナンバー」: 生年月日・現住所・電話番号・マイナンバー・身分証写真を添付して「身分証を提出する」をクリック。\n   ④「扶養控除等申告」: 扶養親族の有無・人数を入力して送信（前職源泉票がある場合は「源泉徴収票を提出する」）。\n3. 提出されたデータは会社管理者の「入退社・労務手続き管理」へリアルタイム送信され、大元マスタ（SSOT）へ即時反映されます。',
    keyword: '入社手続き 通帳写真 口座登録 マイナンバー 通勤手当 提出 新入社員 SSOT 口座情報を提出する 身分証を提出する 通勤費を申請する',
    preview_type: 'onboarding_passbook',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-o-2',
    category: 'onboarding',
    question: '労働条件通知書（雇用契約書）の電子押印・電子同意のやり方は？',
    answer: '【労働条件通知書の電子押印手順】\n1. 管理者から給与改定や入社時に通知書が発行されると、左メニューの「📄 Web給与明細・源泉徴収票・書類」内の「労働条件通知書 兼 雇用契約書」タブに「🕒 電子押印待ち」として届きます。\n2. 「書面を確認・印刷する」をクリックし、労働条件（就業場所・勤務時間・新基本給・休日・契約期間等）の内容および会社印を確認します。\n3. 書面下部の「内容に同意し、電子印鑑を押印する」ボタンをクリックすると、タイムスタンプ付きの電子印鑑が自動押印され、「本人合意押印済み」となって契約締結が完了します。PDF控えは「印刷・PDF」からいつでもダウンロードできます。',
    keyword: '労働条件通知書 雇用契約書 電子押印 電子署名 同意 契約締結 給与改定 書面を確認・印刷する 内容に同意し、電子印鑑を押印する 本人合意押印済み',
    preview_type: 'contract_sign',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-o-3',
    category: 'onboarding',
    question: '【管理者】労働者名簿や国税庁様式源泉徴収簿の出力方法は？',
    answer: '【公的帳票出力の手順】\n1. 管理メニューの「給与計算・明細」を開き、「労務・法定帳票発行センター（賞与・名簿・台帳）」タブをクリックします（または入退社労務管理からアクセス）。\n2. 「■ 帳簿作成・保管義務のある書類」の「労働者名簿」（労基法第107条）や「賃金台帳」、または「■ 年末調整関係書類」の「源泉徴収簿」（国税庁様式）カードをクリックします。\n3. 入社手続きで登録された全基本台帳データ（氏名、生年月日、現住所、雇入年月日、マイナンバー等）が完全に差し込まれた法定レイアウト帳票（電子印鑑捺印済み）がプレビュー表示されます。\n4. 各帳票画面の印刷ボタン（労働者名簿は「公式A4印刷」、源泉徴収簿は「A4横で印刷・PDF保存」、賃金台帳は「一括印刷」または「印刷」）を押すと、即座に公式PDFが生成・保存されます。',
    keyword: '労働者名簿 賃金台帳 源泉徴収簿 法定帳簿 労務・法定帳票発行センター PDF出力 印刷 管理者 公式A4印刷 A4横で印刷・PDF保存 一括印刷',
    preview_type: 'official_ledger_print',
    updated_at: '2026-09-06'
  },

  // ─── 🏢 会社マスタ・休日設定 ───
  {
    id: 'sfaq-c-1',
    category: 'settings',
    question: '【管理者】会社の所定労働時間、休憩時間、締め日・支払日を設定するには？',
    answer: '【全社基本マスタの設定手順】\n1. ポータルの「🏢 会社・全社労務マスタ設定センター」カード（管理者専用）をクリックします。\n2. 就業時間・休憩時間: 「3. 年間営業カレンダー ＆ 就業時間」タブを開き、「就業時間パターン一覧（部署紐付け ＆ 個別調整対応）」で始業・終業時間（例: 09:00〜18:00）や休憩時間を設定・追加します。\n3. 締め日・支払日: 「4. 給与締め日 ＆ 割増賃金・社会保険設定」タブ（または「5. 労働条件通知書 ＆ 雇用契約書」の賃金締切日・支払日欄）で、締め日（毎月末日/20日/25日/15日等）と支給日を設定します。\n4. 右上の「設定を一括保存」（または画面下の「設定を一括保存する」）をクリックします。勤怠・シフト・給与・雇用契約書の全システムへ即座に一元反映されます。',
    keyword: '会社・全社労務マスタ設定センター 所定時間 締め日 支払日 休憩時間 年間営業カレンダー ＆ 就業時間 給与締め日 ＆ 割増賃金・社会保険設定 設定を一括保存 管理者',
    preview_type: 'company_master_settings',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-c-2',
    category: 'settings',
    question: '【管理者】年間休日カレンダー（会社の所定休日）の登録・変更方法は？',
    answer: '【年間休日カレンダーの手順】\n1. ポータルの「🏢 会社・全社労務マスタ設定センター」を開き、「3. 年間営業カレンダー ＆ 就業時間」タブをクリックします。\n2. 「12ヶ月 営業日・休日マップ」が表示されます。国民の祝日（年間16日）や土日公休は自動判定されます。自社の夏季休暇（お盆休み）、年末年始休暇のチェックボックスや、創立記念日等の独自休日を追加設定できます。\n3. カレンダー上の各日付を直接クリックすることで、個別に「休日（赤）」と「稼働営業日（白）」をワンタップで切り替えることも可能です。\n4. 最後に右上の「設定を一括保存」をクリックします（「営業カレンダー A4印刷 / PDF出力」ボタンから年間カレンダーの公式印刷も可能です）。',
    keyword: '年間休日 営業日・休日マップ カレンダー 所定休日 祝日 盆休み 年末年始 年間営業カレンダー ＆ 就業時間 設定を一括保存 営業カレンダー A4印刷 / PDF出力 管理者',
    preview_type: 'company_calendar_settings',
    updated_at: '2026-09-06'
  },

  // ─── ⚙️ ログイン・基本操作 ───
  {
    id: 'sfaq-g-1',
    category: 'general',
    question: 'パスワードを忘れてしまった、ログインできない場合の再設定方法は？',
    answer: '【パスワード再設定手順】\n1. ログイン画面のパスワード入力欄の下にある「パスワードを忘れた場合」をクリックします。\n2. ご登録のメールアドレスを入力して「送信」を押します。\n3. 届いたメール内の「パスワード再設定リンク」をクリックし、新しいパスワードを設定してください。\n※ メールが届かない場合は、迷惑メールフォルダをご確認いただくか、自社の管理者へご相談ください。',
    keyword: 'パスワード パスワードを忘れた場合 ログインできない 再設定 メール リセット',
    preview_type: 'password_reset',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-g-2',
    category: 'general',
    question: 'スマートフォンのホーム画面にアイコンを追加してアプリのように使うには？',
    answer: '【ホーム画面追加手順（PWA対応）】\n・iPhone（Safari）の場合: 画面下の共有ボタン（四角から上矢印）をタップし、「ホーム画面に追加」を選択します。\n・Android（Chrome）の場合: 画面右上のメニュー（3点リーダー）をタップし、「ホーム画面に追加」または「アプリをインストール」を選択します。\nホーム画面にアイコンが作成され、次回からワンタップで全画面起動できます。',
    keyword: 'スマホ ホーム画面 アプリアイコン 追加 PWA iPhone Android ショートカット',
    preview_type: 'pwa_install',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-g-3',
    category: 'general',
    question: '【管理者】新しい従業員のアカウント追加や退職処理はどう行いますか？',
    answer: '【従業員アカウント管理の手順】\n1. 左メニューまたは管理画面の「従業員管理」タブを開きます。\n2. 【従業員の追加・招待】:\n   右上の「従業員を招待する」ボタンをクリックするか、画面上部に表示されている「招待コード」を従業員へ共有します。\n   従業員が新規登録画面（ログイン画面の「初めての方はこちら（新規登録）」）で招待コードを入力してアカウント作成すると、自社組織に自動で紐付きます。\n3. 【退職処理】:\n   従業員一覧テーブルの該当者の右端にある「退職」ボタンをクリックします。即座に「退職済」ステータスとなり、システムのログイン権限が安全に停止されます。\n   ※ 誤って退職にした場合や再雇用の場合は「復職」ボタンをクリックすればワンクリックで在籍状態へ復帰できます。所属部署や役職、承認者を変更したい場合は「編集」ボタンをクリックします。',
    keyword: '従業員管理 従業員を招待する 招待コード 退職 復職 編集 アカウント発行 退職処理 招待 管理者 ユーザー管理',
    preview_type: 'employee_admin_manage',
    updated_at: '2026-09-06'
  }
];

// 📢 デフォルトのシステムリリースノート
export const DEFAULT_SYSTEM_RELEASES: SystemReleaseNote[] = [
  {
    id: 'rel-1',
    version: 'Ver 2.3.0',
    title: 'システム操作Q&A・初心者向け全網羅ガイド ＆ 改善要望直通ボックスを配備',
    content: '勤怠打刻、有給申請、シフト希望、Web給与明細、入退社手続きなど、初心者がつまずきやすい操作手順を詳細に解説した「システム公式操作ガイド」を配備いたしました。また、利用者様からのご意見や新機能リクエストを開発本部へ直接お届けいただける「システム改善要望ボックス」を開設いたしました。',
    category: 'new_feature',
    released_at: '2026-09-06'
  },
  {
    id: 'rel-2',
    version: 'Ver 2.2.0',
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

    // Supabaseにデータが存在する場合、公式デフォルト項目の文言を最新のSSOT定義で確実に最新化
    if (!error && data && data.length > 0) {
      const defaultMap = new Map(DEFAULT_SYSTEM_FAQS.map(d => [d.id, d]));
      const merged: SystemFaqItem[] = data.map((item: any) => {
        const def = defaultMap.get(item.id);
        // デフォルト項目であれば、最新の正確な文言・キーワード・カテゴリ・プレビュー種別を適用
        if (def && (!item.html_preview || !item.html_preview.trim())) {
          return { ...item, ...def };
        }
        return item;
      });

      // DEFAULT_SYSTEM_FAQSに新設された項目があればリストへ追加
      DEFAULT_SYSTEM_FAQS.forEach(def => {
        if (!merged.some(m => m.id === def.id)) {
          merged.push(def);
        }
      });

      localStorage.setItem('kap_system_faqs_v13', JSON.stringify(merged));
      return merged;
    }

    // Supabaseが空またはエラーの場合
    const local = localStorage.getItem('kap_system_faqs_v13');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const defaultMap = new Map(DEFAULT_SYSTEM_FAQS.map(d => [d.id, d]));
          const merged = parsed.map(item => {
            const def = defaultMap.get(item.id);
            if (def && (!item.html_preview || !item.html_preview.trim())) return { ...item, ...def };
            return item;
          });
          return merged;
        }
      } catch (e) { /* fallback */ }
    }
    return DEFAULT_SYSTEM_FAQS;
  } catch (err) {
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
      localStorage.setItem('kap_system_faqs_v13', JSON.stringify(updated));
      return data;
    }
  } catch (err) {
    console.warn('Supabase upsert failed, fallback to local:', err);
  }

  const existingIdx = currentList.findIndex(f => f.id === id);
  let updatedList: SystemFaqItem[];
  if (existingIdx >= 0) {
    updatedList = [...currentList];
    updatedList[existingIdx] = fullItem;
  } else {
    updatedList = [fullItem, ...currentList];
  }
  localStorage.setItem('kap_system_faqs_v13', JSON.stringify(updatedList));
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
  localStorage.setItem('kap_system_faqs_v13', JSON.stringify(updated));
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
      const local = localStorage.getItem('kap_system_suggestions_v2');
      if (local) {
        try { return JSON.parse(local); } catch (e) { /* fallback */ }
      }
      return [];
    }
    localStorage.setItem('kap_system_suggestions_v2', JSON.stringify(data));
    return data;
  } catch (err) {
    const local = localStorage.getItem('kap_system_suggestions_v2');
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
  category: 'feature' | 'ui_ux' | 'bug' | 'performance' | 'qa_help' | 'other';
  title: string;
  content: string;
}): Promise<SystemImprovementSuggestion> {
  const newItem: SystemImprovementSuggestion = {
    id: `sug-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...data,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let finalItem = newItem;

  try {
    const { data: inserted, error } = await supabase
      .from('system_improvement_suggestions')
      .insert(newItem)
      .select()
      .single();

    if (!error && inserted) {
      finalItem = inserted;
      const current = await fetchSystemSuggestions();
      localStorage.setItem('kap_system_suggestions_v2', JSON.stringify([inserted, ...current.filter(c => c.id !== inserted.id)]));
    } else {
      const current = await fetchSystemSuggestions();
      const updated = [newItem, ...current];
      localStorage.setItem('kap_system_suggestions_v2', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Failed to insert suggestion to DB, saving locally:', e);
    const current = await fetchSystemSuggestions();
    const updated = [newItem, ...current];
    localStorage.setItem('kap_system_suggestions_v2', JSON.stringify(updated));
  }

  // 📬 メール通知・お知らせ自動発火（非同期バックグラウンド実行・UIを待たせない）
  sendSuggestionNotification(finalItem).catch(err => {
    console.warn('Failed to send suggestion notification email:', err);
  });

  return finalItem;
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
  localStorage.setItem('kap_system_suggestions_v2', JSON.stringify(updated));
  return true;
}

export async function deleteSystemSuggestion(id: string): Promise<boolean> {
  try {
    await supabase.from('system_improvement_suggestions').delete().eq('id', id);
  } catch (e) {
    console.warn(e);
  }
  const current = await fetchSystemSuggestions();
  const updated = current.filter(item => item.id !== id);
  localStorage.setItem('kap_system_suggestions_v2', JSON.stringify(updated));
  return true;
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
      const local = localStorage.getItem('kap_system_releases_v2');
      if (local) {
        try { return JSON.parse(local); } catch (e) { /* fallback */ }
      }
      return DEFAULT_SYSTEM_RELEASES;
    }
    localStorage.setItem('kap_system_releases_v2', JSON.stringify(data));
    return data;
  } catch (e) {
    const local = localStorage.getItem('kap_system_releases_v2');
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
  localStorage.setItem('kap_system_releases_v2', JSON.stringify(updated));
  return fullNote;
}
