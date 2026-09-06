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
  kintai_clock: '⏰ ホーム（打刻）画面（出退勤ボタン・現在時刻・ステータス）',
  leave_request: '🌴 有給休暇・代休 残数ウィジェット（保有残数・年間5日義務）',
  shift_submit: '📅 シフト希望・確定シフト画面（月間カレンダー希望入力・確定シフト）',
  payslip_view: '📄 Web給与明細・源泉徴収票画面（支給・控除・差引支給額）',
  onboarding_passbook: '📄 入退社労務画面（通帳写真撮影・電子契約押印）',
  password_reset: '⚙️ ログイン・パスワード再設定画面'
} as const;

// 💡 カテゴリやキーワードに応じて最適な画面UIモックタイプを自動判定するヘルパー
export function resolveGuidePreviewType(item: Partial<SystemFaqItem>): string {
  if (item.preview_type) return item.preview_type;
  
  const q = `${item.question || ''} ${item.keyword || ''} ${item.answer || ''}`;
  if (q.includes('月次勤怠') || q.includes('月間勤怠') || q.includes('照会') || q.includes('修正申請') || q.includes('打刻忘れ') || q.includes('押し忘れ') || q.includes('間違え') || q.includes('CSV') || q.includes('PDF出力') || q.includes('印刷') || q.includes('申請する')) return 'monthly_attendance';
  if (q.includes('打刻') || q.includes('出勤') || q.includes('退勤') || q.includes('ステータス') || q.includes('夜勤') || q.includes('GPS') || q.includes('時計')) return 'kintai_clock';
  if (q.includes('残数') || q.includes('有給残') || q.includes('保有日数') || q.includes('5日義務')) return 'leave_request';
  if (q.includes('有給') || q.includes('有休') || q.includes('休暇') || q.includes('半休') || q.includes('年休') || q.includes('慶弔')) return 'monthly_attendance';
  if (q.includes('シフト') || q.includes('希望提出') || q.includes('勤務パターン')) return 'shift_submit';
  if (q.includes('給与') || q.includes('明細') || q.includes('源泉') || q.includes('賞与') || q.includes('試算')) return 'payslip_view';
  if (q.includes('通帳') || q.includes('入社') || q.includes('契約書') || q.includes('電子署名') || q.includes('押印') || q.includes('名簿')) return 'onboarding_passbook';
  if (q.includes('パスワード') || q.includes('ログイン') || q.includes('再設定')) return 'password_reset';

  switch (item.category) {
    case 'kintai': return 'monthly_attendance';
    case 'leave': return 'monthly_attendance';
    case 'shift': return 'shift_submit';
    case 'payroll': return 'payslip_view';
    case 'onboarding': return 'onboarding_passbook';
    case 'general': return 'password_reset';
    case 'settings': return 'monthly_attendance';
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
    answer: '【打刻の手順】\n1. 左メニューの「ホーム（打刻）」を開きます（ポータルからは「勤怠・有給管理」カードをクリック）。\n2. 画面中央の大きな時計の下にある、青い「出勤」ボタン、または退勤時にオレンジの「退勤」ボタンをタップするだけで即座に打刻が記録されます。\n3. 打刻後、「現在のステータス」が「未出勤」「勤務中」「退勤済」へと自動更新されます。\n4. スマートフォンやタブレットのブラウザからも、PCと同一のアカウントでアクセスしてそのまま打刻できます。\n※ GPS位置情報の記録が有効な場合は、ブラウザの「位置情報の利用を許可」を選択してください。',
    keyword: '打刻 出勤 退勤 ホーム ステータス スマホ スマートフォン GPS ボタン 押し方',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-2',
    category: 'kintai',
    question: '打刻を忘れてしまった時や、間違えて押してしまった場合の修正方法は？',
    answer: '【打刻修正申請の手順】\n1. 左メニューの「月次勤怠・有給照会」をクリックします。\n2. 「月間勤怠照会」一覧テーブルが表示されますので、修正したい該当日の行を探します。\n3. 該当日の行の右端にある青い「申請する」ボタンをクリックします（または左メニューの「各種申請」を開きます）。\n4. 「各種申請フォーム」が開き、申請種類「打刻修正」、対象日、区分（出勤/退勤）、正しい打刻時間、申請理由を入力します。\n5. 最後に「申請を送信する」をクリックします。上長または管理者が承認すると、勤怠実績テーブルが自動更新されます。',
    keyword: '月次勤怠・有給照会 月間勤怠照会 申請する 打刻忘れ 押し忘れ 修正申請 変更 間違い 時間 承認',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-6',
    category: 'kintai',
    question: '「月次勤怠・有給照会」画面で自分の出勤日数や労働時間を確認したり、PDF・CSV出力するには？',
    answer: '【勤怠実績の確認・出力手順】\n1. 左メニューの「月次勤怠・有給照会」をクリックします。\n2. 画面上部の「月間勤怠照会」にある左右の矢印ボタン（< 2026年9月 >）で確認したい年月を切り替えます。\n3. 上部のサマリーバッジに「出勤: 〇日」「実働: 〇時間〇分」「残業: 〇時間〇分」の月次集計が自動表示されます。\n4. 右上の「📄 PDF出力 (印刷)」ボタンを押すと公式レイアウトで印刷・PDF保存でき、「📊 CSV出力」ボタンを押すと勤怠実績のCSVデータを即座にダウンロードできます。',
    keyword: '月次勤怠・有給照会 月間勤怠照会 PDF出力 印刷 CSV出力 出勤日数 実働時間 残業時間',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-3',
    category: 'kintai',
    question: '休憩時間はどのように記録・計算されますか？休憩ボタンがない場合は？',
    answer: '【休憩時間の自動控除ルール】\n本システムでは、労働基準法に基づき実労働時間から所定の休憩時間（実働6時間超で45分、8時間超で60分など）が自動控除・計算されます。\n※ 個別に休憩時間を調整・修正したい場合や特殊な控除が必要な場合は、左メニュー「月次勤怠・有給照会」の該当日の「申請する」ボタン（または左メニュー「各種申請」）から理由欄に休憩時間を明記して申請してください。',
    keyword: '休憩 休憩時間 自動控除 60分 45分 労働基準法 ランチ 修正',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-4',
    category: 'kintai',
    question: '日付をまたぐ夜勤（徹夜勤務・24時以降の退勤）はどう打刻しますか？',
    answer: '【夜勤の打刻ルール】\n本システムは24時を超える勤務（日跨ぎ勤務）に自動対応しています。\n前日に「出勤」を押した後、翌朝にそのまま「退勤」を押すと、自動的に前日の出勤データと紐付いた一連の勤務として実働時間・深夜割増時間が自動計算されます。日をまたいだからといって深夜0時に再打刻する必要はありません。',
    keyword: '夜勤 深夜 日跨ぎ 日付またぐ 徹夜 24時',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-5',
    category: 'kintai',
    question: '位置情報（GPS）が取得できない、打刻ボタンが押せない時の対処法は？',
    answer: '【GPSエラーの解決手順】\n1. スマートフォンの「設定」＞「プライバシーとセキュリティ」＞「位置情報サービス」がONになっているか確認します。\n2. お使いのブラウザ（SafariまたはChrome）の位置情報アクセス権限が「許可」または「このAppの使用中のみ許可」になっているか確認します。\n3. 画面を再読み込み（リロード）し、ブラウザ上部に「位置情報の利用を許可しますか？」と表示されたら「許可」を選択してください。',
    keyword: 'GPS 位置情報 エラー 押せない 許可 設定 スマホ',
    updated_at: '2026-09-06'
  },

  // ─── 🌴 有給休暇・各種申請 ───
  {
    id: 'sfaq-l-1',
    category: 'leave',
    question: '有給休暇の申請手順を教えてください。どこから申請できますか？',
    answer: '【有給申請の手順】\n1. 左メニューの「各種申請」をクリックします（または「月次勤怠・有給照会」の該当日右端にある青い「申請する」ボタンをクリックします）。\n2. 「申請種類」プルダウンから「有給休暇（全休）」「有給休暇（午前半休）」「有給休暇（午後半休）」など希望の種別を選択します。\n3. 対象の「開始日」および「終了日」を選択し、「申請理由」（私用のため等）を入力します。\n4. 「申請を送信する」をクリックします。上長または管理者が承認すると、カレンダーに反映され残日数が自動消化されます。',
    keyword: '有給申請 有休 申請する 各種申請 月次勤怠・有給照会 取得 手順 承認',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-2',
    category: 'leave',
    question: '半日単位（午前半休・午後半休）で有給を取るにはどうしますか？',
    answer: '【半休の申請手順】\n左メニューの「各種申請」を開き、「申請種類」のドロップダウンを選択します。\n・午前の勤務を休む場合 ➔「有給休暇（午前半休）」を選択（0.5日消化）\n・午後の勤務を休む場合 ➔「有給休暇（午後半休）」を選択（0.5日消化）\n対象日と理由を入力して「申請を送信する」をクリックしてください。',
    keyword: '半休 半日有休 午前半休 午後半休 0.5日 各種申請',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-3',
    category: 'leave',
    question: '自分の有給休暇の残り日数（残日数）や有効期限はどこで確認できますか？',
    answer: '【残日数の確認方法】\n左メニューの「ホーム（打刻）」を開くと、打刻時計の隣に「有給休暇・代休 残数」カードが常時表示されています。\n・有給休暇（今年度付与分）\n・有給休暇（前年度繰越分）\n・有給休暇（合計残数）\n・利用可能な代休\nが一目で確認できます。また、法律で義務付けられている「年間5日取得義務」に対する取得済み日数と残り日数もアラート表示されます。',
    keyword: '有給残日数 残り ホーム 有給休暇・代休 残数 有効期限 付与 失効 5日義務',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-4',
    category: 'leave',
    question: '慶弔休暇（忌引き・結婚）や代休などの特別休暇はどう申請しますか？',
    answer: '【特別休暇・代休の申請手順】\n左メニューの「各種申請」を開き、「申請種類」プルダウンから「特別休暇（慶弔など）」または「代休（全休）」「代休（午前半休）」「代休（午後半休）」を選択します。\n日程と理由（忌引き、本人結婚など）を入力して「申請を送信する」をクリックしてください。就業規則で定められた有給特別休暇日数が自動適用されます。',
    keyword: '慶弔 忌引き 結婚 特別休暇 代休 各種申請',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-5',
    category: 'leave',
    question: '一度提出した有給申請や打刻修正を取り消したい、または変更したい時は？',
    answer: '【申請の取消手順】\n左メニューの「各種申請」を開き、画面下部の「最近の申請履歴」一覧を確認します。\n・上長が承認する前 ➔ 該当申請の右側にある「取消」ボタンをクリックすれば即座に取下げ・キャンセルできます。\n・既に承認された後の変更 ➔ 社内の上長または管理者へ連絡し、管理者画面から勤怠データの直接修正を依頼してください。',
    keyword: '有給取消 取消 取り消し 変更 キャンセル 各種申請 申請履歴',
    updated_at: '2026-09-06'
  },

  // ─── 📅 シフト希望・作成 ───
  {
    id: 'sfaq-s-1',
    category: 'shift',
    question: '【従業員】シフト希望はどうやって入力・提出すればいいですか？',
    answer: '【シフト希望の提出手順】\n1. 左メニューの「シフト希望・確定シフト」をクリックします（ホームの「🗓️ シフト希望を提出する」ボタンからも移動可能）。\n2. 7列の本格月間カレンダーが表示されますので、各日付セル内の「出勤」または「休み」ボタンをクリックします。\n3. 「出勤」を選んだ日は、希望勤務時間（例: 09:00 - 18:00）を入力します。\n4. 「🏖️ 会社所定休日を一括休み希望」ボタンを押すと、会社の公休日を一括で休み希望に設定できます。\n5. 全て入力したら、画面最下部の「シフト希望を提出する」ボタンをクリックします。',
    keyword: 'シフト希望・確定シフト シフト希望 提出 カレンダー 出勤 休み 一括休み希望',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-2',
    category: 'shift',
    question: '【従業員】確定したシフトはどこで見られますか？',
    answer: '【確定シフトの確認手順】\n1. 左メニューの「シフト希望・確定シフト」を開くと、上長に承認されたシフトが藍色の「確定」バッジ付きでカレンダーに即時反映されます。\n2. また、左メニューの「ホーム（打刻）」の「本日のシフト予定」欄にも、本日の確定勤務時間（例: 09:00 〜 18:00）や公休日が自動表示されます。',
    keyword: '確定シフト シフト希望・確定シフト ホーム 本日のシフト予定 カレンダー 確認',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-3',
    category: 'shift',
    question: '【管理者】スタッフから集まったシフト希望の確認と承認はどうやりますか？',
    answer: '【シフト希望の確認・承認手順】\n1. 左メニューの「部下からの申請承認」を開きます（または管理者メニュー「シフト管理」を開きます）。\n2. 提出されたシフト希望一覧が表示されますので、内容を確認して「承認」または「却下」をクリックします。\n3. 承認を実行すると、該当従業員の月間カレンダーおよびホーム画面へ「確定シフト」として即時反映されます。',
    keyword: 'シフト希望確認 承認 部下からの申請承認 管理者 確定反映',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-4',
    category: 'shift',
    question: '【管理者】完成した全社シフトを一括確定・公開するにはどうしますか？',
    answer: '【シフト確定・公開の手順】\n管理者用「シフト管理」画面の月間マトリクスで全員のシフト配置を完了したら、画面右上の「シフトを確定・公開する」ボタンをクリックします。公開を実行した瞬間に全従業員のマイシフトへ即時反映されます。',
    keyword: 'シフト確定 公開 通知 全社 反映 管理者',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-5',
    category: 'shift',
    question: '【管理者】新しい勤務パターン（例: 9:00-18:00、短時間等）を追加するには？',
    answer: '【シフトパターン追加手順】\n管理者画面の「シフト基本設定・パターン管理」を開きます。\n「＋ 新規パターン追加」をクリックし、パターン名（例: 「早番」「遅番」）、開始時間・終了時間・休憩時間を設定して保存します。追加したパターンはシフト作成時にワンクリックで割り当て可能になります。',
    keyword: '勤務パターン シフトパターン 追加 設定 早番 遅番',
    updated_at: '2026-09-06'
  },

  // ─── 💰 給与明細・計算 ───
  {
    id: 'sfaq-p-1',
    category: 'payroll',
    question: '【従業員】Web給与明細の閲覧やPDF印刷はどう操作しますか？',
    answer: '【給与明細の閲覧・印刷手順】\n1. 左メニューの「Web給与明細・源泉徴収票」をクリックします（ホームの「給与明細・源泉徴収票・契約書類を確認」ボタンからも移動可能）。\n2. 対象の支給年月（例: 2026年9月支給分）を選択すると、基本給・各種手当・残業代・控除合計・差引支給額（手取り）が表示されます。\n3. 明細画面の右上にある「PDF印刷」ボタンを押すと、公式レイアウトの給与明細書をPDF保存・印刷できます。スマートフォンからも保存可能です。',
    keyword: 'Web給与明細・源泉徴収票 給与明細 Web明細 PDF 印刷 ダウンロード スマホ 閲覧',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-p-2',
    category: 'payroll',
    question: '源泉徴収票や過去の賞与明細はどこから確認できますか？',
    answer: '【過去の明細・源泉徴収票】\n左メニューの「Web給与明細・源泉徴収票」画面の年度切り替えから過去の年・月を選択できます。\nまた、毎年発行される「給与所得の源泉徴収票」は、同画面内の「源泉徴収票一覧」タブからいつでも閲覧・PDF印刷が可能です。',
    keyword: 'Web給与明細・源泉徴収票 源泉徴収票 賞与明細 ボーナス 過去 年末調整',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-p-3',
    category: 'payroll',
    question: '【管理者】勤怠の打刻データから給与を自動計算・試算する手順は？',
    answer: '【給与自動試算の手順】\n1. 管理ダッシュボードの「給与計算・明細」を開きます。\n2. 対象月を選択し、「勤怠実績を取り込んで自動計算」ボタンをクリックします。\n3. 実労働時間、所定外残業、深夜労働、休日労働時間、有給消化日数に、基本給や時給・割増手当が自動掛け合わされて総支給額および社会保険料・源泉所得税が瞬時に試算されます。\n4. 内容を確認後、「給与確定・明細公開」を押すと全従業員へWeb明細が配信されます。',
    keyword: '給与計算 自動計算 勤怠連動 取り込み 試算 確定 管理者',
    updated_at: '2026-09-06'
  },

  // ─── 📄 入退社・労務手続き ───
  {
    id: 'sfaq-o-1',
    category: 'onboarding',
    question: '新入社員が入社手続き（口座写真・マイナンバー等）を提出する手順は？',
    answer: '【入社書類提出の手順】\n1. ポータル画面から「入退社・労務手続き」カードをクリックします。\n2. ガイドに沿って以下の情報をステップ順に入力します。\n   ① 基本情報（氏名・フリガナ・生年月日・現住所・電話番号）\n   ② 給与振込口座（銀行名・支店・口座番号と、通帳またはキャッシュカードの写真撮影アップロード）\n   ③ 通勤経路・定期券情報（定期代の証明写真添付可）\n   ④ 扶養親族情報およびマイナンバー\n3. 最後に「提出を完了する」をクリックすると、管理者に届きます。',
    keyword: '入社手続き 通帳写真 口座登録 マイナンバー 通勤手当 提出 新入社員',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-o-2',
    category: 'onboarding',
    question: '労働条件通知書（雇用契約書）の電子押印・電子同意のやり方は？',
    answer: '【労働条件通知書の電子押印手順】\n1. 管理者から通知書が発行されると、ポータルの上部に「【重要】労働条件通知書が届いています」という黄色い通知バッジが表示されます。\n2. 「確認・押印する」をクリックし、労働条件（勤務時間・基本給・休日・契約期間等）の内容を確認します。\n3. 書面下部の「電子署名・同意する」ボタンをクリックすると、タイムスタンプ付きの電子印鑑が自動押印され、契約締結が完了します。PDF控えはいつでもダウンロードできます。',
    keyword: '労働条件通知書 雇用契約書 電子押印 電子署名 同意 契約締結',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-o-3',
    category: 'onboarding',
    question: '【管理者】労働者名簿や国税庁様式源泉徴収簿の出力方法は？',
    answer: '【公的帳票出力の手順】\n「入退社・労務手続き（管理者）」の「労働者名簿・法定三帳簿」を開きます。\n対象の従業員を選択して「労働者名簿を出力」をクリックすると、入社手続きで登録された全基本台帳データが完全に差し込まれた1人1枚の法定レイアウトPDF（電子印鑑捺印済み）が即座に生成されます。',
    keyword: '労働者名簿 源泉徴収簿 法定帳簿 PDF出力 印刷 管理者',
    updated_at: '2026-09-06'
  },

  // ─── 🏢 会社マスタ・休日設定 ───
  {
    id: 'sfaq-c-1',
    category: 'settings',
    question: '【管理者】会社の所定労働時間、休憩時間、締め日・支払日を設定するには？',
    answer: '【全社基本マスタの設定手順】\n1. ポータルの「会社・全社マスタ設定」カード（管理者専用）をクリックします。\n2. 「会社基本設定」タブで、所定勤務時間（例: 9:00〜18:00、実働8時間・休憩60分）を設定します。\n3. 「給与締日・支払日」タブで、締め日（例: 末日締め）と支給日（例: 翌月25日払い）を設定して「保存」をクリックします。全システムの計算に即時反映されます。',
    keyword: '所定時間 締め日 支払日 休憩時間 会社設定 管理者',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-c-2',
    category: 'settings',
    question: '【管理者】年間休日カレンダー（会社の所定休日）の登録・変更方法は？',
    answer: '【年間休日カレンダーの手順】\n「会社・全社マスタ設定」＞「年間営業カレンダー」を開きます。\n国民の祝日は自動判定されます。自社の夏季休暇、年末年始休暇、会社創立記念日などの独自所定休日をカレンダー上でクリックして休日に設定します。勤怠や給与の休日労働判定に自動連動します。',
    keyword: '年間休日 カレンダー 所定休日 祝日 盆休み 年末年始 管理者',
    updated_at: '2026-09-06'
  },

  // ─── ⚙️ ログイン・基本操作 ───
  {
    id: 'sfaq-g-1',
    category: 'general',
    question: 'パスワードを忘れてしまった、ログインできない場合の再設定方法は？',
    answer: '【パスワード再設定手順】\n1. ログイン画面の「パスワードをお忘れの方はこちら」をクリックします。\n2. ご登録のメールアドレスを入力して「送信」を押します。\n3. 届いたメール内の「パスワード再設定リンク」をクリックし、新しいパスワードを設定してください。\n※ メールが届かない場合は、迷惑メールフォルダをご確認いただくか、自社の管理者へご相談ください。',
    keyword: 'パスワード 忘れた ログインできない 再設定 メール リセット',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-g-2',
    category: 'general',
    question: 'スマートフォンのホーム画面にアイコンを追加してアプリのように使うには？',
    answer: '【ホーム画面追加手順（PWA対応）】\n・iPhone（Safari）の場合: 画面下の共有ボタン（四角から上矢印）をタップし、「ホーム画面に追加」を選択します。\n・Android（Chrome）の場合: 画面右上のメニュー（3点リーダー）をタップし、「ホーム画面に追加」または「アプリをインストール」を選択します。\nホーム画面にアイコンが作成され、次回からワンタップで全画面起動できます。',
    keyword: 'スマホ ホーム画面 アプリアイコン 追加 PWA iPhone Android ショートカット',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-g-3',
    category: 'general',
    question: '【管理者】新しい従業員のアカウント追加や退職処理はどう行いますか？',
    answer: '【従業員アカウント管理の手順】\n管理者画面の「従業員マスタ」を開きます。\n・追加する場合: 「＋ 新規従業員を追加」をクリックし、氏名・メールアドレス・権限（一般従業員または管理者）を入力して招待メールを送信します。\n・退職処理を行う場合: 該当スタッフの編集画面で「退職日」を設定し、ステータスを「退職」に変更すると、安全にログイン権限が停止されます。',
    keyword: '従業員追加 アカウント発行 退職処理 招待 管理者 ユーザー管理',
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

      localStorage.setItem('kap_system_faqs_v3', JSON.stringify(merged));
      return merged;
    }

    // Supabaseが空またはエラーの場合
    const local = localStorage.getItem('kap_system_faqs_v3');
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
      localStorage.setItem('kap_system_faqs_v2', JSON.stringify(updated));
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
  localStorage.setItem('kap_system_faqs_v2', JSON.stringify(updatedList));
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
  localStorage.setItem('kap_system_faqs_v2', JSON.stringify(updated));
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
