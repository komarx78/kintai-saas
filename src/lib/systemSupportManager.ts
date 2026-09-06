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
  kintai_clock: '⏰ 勤怠打刻画面（出退勤・休憩ボタン・現在時刻）',
  kintai_fix: '✏️ 打刻修正申請画面（日別勤怠・申請モーダル）',
  leave_request: '🌴 有給休暇・各種申請画面（残日数カード・申請フォーム）',
  shift_submit: '📅 シフト希望提出画面（カレンダー希望入力・確定）',
  payslip_view: '💰 Web給与明細画面（支給・控除・PDF印刷ボタン）',
  onboarding_passbook: '📄 入退社労務画面（通帳写真撮影・電子契約押印）',
  password_reset: '⚙️ ログイン・パスワード再設定画面'
} as const;

// 💡 カテゴリやキーワードに応じて最適な画面UIモックタイプを自動判定するヘルパー
export function resolveGuidePreviewType(item: Partial<SystemFaqItem>): string {
  if (item.preview_type) return item.preview_type;
  
  const q = `${item.question || ''} ${item.keyword || ''} ${item.answer || ''}`;
  if (q.includes('修正申請') || q.includes('打刻忘れ') || q.includes('押し忘れ') || q.includes('間違え')) return 'kintai_fix';
  if (q.includes('打刻') || q.includes('出勤') || q.includes('退勤') || q.includes('休憩') || q.includes('夜勤') || q.includes('GPS')) return 'kintai_clock';
  if (q.includes('有給') || q.includes('有休') || q.includes('休暇') || q.includes('半休') || q.includes('年休')) return 'leave_request';
  if (q.includes('シフト') || q.includes('希望提出') || q.includes('勤務パターン')) return 'shift_submit';
  if (q.includes('給与') || q.includes('明細') || q.includes('源泉') || q.includes('賞与') || q.includes('試算')) return 'payslip_view';
  if (q.includes('通帳') || q.includes('入社') || q.includes('契約書') || q.includes('電子署名') || q.includes('押印') || q.includes('名簿')) return 'onboarding_passbook';
  if (q.includes('パスワード') || q.includes('ログイン') || q.includes('再設定')) return 'password_reset';

  switch (item.category) {
    case 'kintai': return 'kintai_clock';
    case 'leave': return 'leave_request';
    case 'shift': return 'shift_submit';
    case 'payroll': return 'payslip_view';
    case 'onboarding': return 'onboarding_passbook';
    case 'general': return 'password_reset';
    case 'settings': return 'kintai_clock';
    default: return 'kintai_clock';
  }
}

// 🌟 初心者がつまずきやすいポイントを完全網羅した公式操作マニュアル・FAQ一覧
export const DEFAULT_SYSTEM_FAQS: SystemFaqItem[] = [
  // ─── ⏰ 勤怠・打刻の操作 ───
  {
    id: 'sfaq-k-1',
    category: 'kintai',
    question: '出勤・退勤の打刻はどう操作すればいいですか？スマホでも可能ですか？',
    answer: '【打刻の手順】\n1. ポータル画面から「勤怠・有給管理」カードをクリックします。\n2. 画面上部にある「出勤」「退勤」「休憩開始」「休憩終了」の大きなボタンをタップするだけで即座に打刻が完了します。\n3. スマートフォンやタブレットのブラウザからも、PCと同じログイン情報でアクセスしてそのまま打刻できます。\n※ GPS位置情報の記録が有効な場合は、ブラウザの「位置情報の利用を許可」を選択してください。',
    keyword: '打刻 出勤 退勤 休憩 スマホ スマートフォン GPS ボタン 押し方',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-2',
    category: 'kintai',
    question: '打刻を忘れてしまった時や、間違えて押してしまった場合の修正方法は？',
    answer: '【打刻修正申請の手順】\n1. 「勤怠・有給管理」画面の日別勤怠一覧から、修正したい日を探します。\n2. 該当日の行にある「修正申請」ボタン（鉛筆アイコン）をクリックします。\n3. 正しい「出勤時刻」「退勤時刻」を入力し、理由（例: 「打刻忘れ」「誤打刻」など）を記入して「申請する」をクリックします。\n4. 自社の管理者が承認すると、正しい勤怠実績へ自動更新されます。',
    keyword: '打刻忘れ 押し忘れ 修正申請 変更 間違い 時間 承認',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-k-3',
    category: 'kintai',
    question: '休憩の入り方と戻り方はどうしますか？休憩を押し忘れた場合は？',
    answer: '【休憩の打刻手順】\n休憩に入る際に「休憩開始」を押し、仕事に戻る際に「休憩終了」を押します。\nもし休憩ボタンを押し忘れてしまった場合は、退勤後に上記の「打刻修正申請」から該当日の実労働時間または休憩時間を正しく入力して申請を行ってください。',
    keyword: '休憩 休憩開始 休憩終了 押し忘れ ランチ 修正',
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
    question: '有給休暇の申請手順を教えてください。',
    answer: '【有給申請の手順】\n1. 「勤怠・有給管理」画面を開き、上部タブの「各種申請」をクリックします。\n2. 「有給休暇申請」を選択します。\n3. カレンダーから取得したい日付を選択し、区分（全休・午前半休・午後半休・時間単位年休）を選びます。\n4. 申請理由（私用のため等）を入力し、「申請を送信」をクリックします。\n5. 管理者が承認すると、カレンダーに有休マークが反映され、残日数が自動で消化されます。',
    keyword: '有給申請 有休 申請方法 手順 各種申請 取得 承認',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-2',
    category: 'leave',
    question: '半日単位（午前半休・午後半休）や時間単位で有給を取るにはどうしますか？',
    answer: '【半休・時間休の申請手順】\n有給申請画面で「取得区分」のドロップダウンを開きます。\n・午前の勤務を休む場合 ➔「午前半休」を選択\n・午後の勤務を休む場合 ➔「午後半休」を選択\n・1〜数時間だけ休む場合 ➔「時間単位年休」を選択し、取得時間数（例: 2時間）を指定します。\n※ 時間単位年休は、労使協定の締結に基づき年5日（最大40時間）まで取得可能です。',
    keyword: '半休 半日有休 午前半休 午後半休 時間休 時間単位年休',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-3',
    category: 'leave',
    question: '自分の有給休暇の残り日数（残日数）や有効期限はどこで確認できますか？',
    answer: '【残日数の確認方法】\n「勤怠・有給管理」画面のダッシュボード上部に「有給休暇ステータスカード」が常時表示されています。\n・現在の保有日数（残日数）\n・当年度の消化日数\n・次回付与予定日と失効期限\nが一目で確認できるようになっています。',
    keyword: '有給残日数 残り 有効期限 付与 失効 日数確認',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-4',
    category: 'leave',
    question: '慶弔休暇（忌引き・結婚）や産休・育休などの特別休暇はどう申請しますか？',
    answer: '【特別休暇の申請手順】\n「勤怠・有給管理」＞「各種申請」＞「特別休暇・慶弔申請」を選択します。\n慶弔の種類（忌引き、本人結婚、配偶者出産など）を選択して日程を申請してください。就業規則で定められた有給特別休暇日数が自動適用されます。',
    keyword: '慶弔 忌引き 結婚 特別休暇 産休 育休 申請',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-l-5',
    category: 'leave',
    question: '一度提出した有給申請を取り消したい、または日付を変更したい時は？',
    answer: '【申請の取消・変更手順】\n「各種申請」タブの「申請履歴・ステータス一覧」を開きます。\n・承認前の申請 ➔「取り消し」ボタンをクリックすれば即座にキャンセルできます。\n・既に承認済みの申請 ➔ 自社の管理者へ連絡し、管理者の画面から該当日を有休から通常勤務へ差し戻すか、取消処理を行ってもらってください。',
    keyword: '有給取消 取り消し 変更 キャンセル 申請履歴',
    updated_at: '2026-09-06'
  },

  // ─── 📅 シフト希望・作成 ───
  {
    id: 'sfaq-s-1',
    category: 'shift',
    question: '【従業員】シフト希望はどうやって入力・提出すればいいですか？',
    answer: '【シフト希望の提出手順】\n1. ポータル画面から「シフト管理」カードをクリックします。\n2. カレンダー上に翌月または当月の日付が表示されます。\n3. 出勤希望日をタップし、勤務希望パターン（例: 早番・遅番など）または希望時間を指定します（休みたい日は「希望休」を選択）。\n4. すべて入力したら、画面下部の「シフト希望を提出する」ボタンをクリックします。\n※ 提出期限を過ぎると入力が締め切られますのでご注意ください。',
    keyword: 'シフト希望 提出 入力 シフト申請 従業員 カレンダー 希望休',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-2',
    category: 'shift',
    question: '【従業員】確定したシフトはどこで見られますか？',
    answer: '【マイシフトの確認手順】\n管理者がシフトを「確定・公開」すると、「シフト管理」画面のカレンダーに自分の確定シフトが確定バッジ付きで表示されます。\nまた、当日の勤務時間や出勤パターンは「勤怠管理」のトップ画面にも自動表示されます。',
    keyword: '確定シフト マイシフト 確認 公開 スケジュール',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-3',
    category: 'shift',
    question: '【管理者】スタッフから集まったシフト希望の確認と承認はどうやりますか？',
    answer: '【シフト希望の確認手順】\n1. 管理者メニューの「シフト管理（管理者用）」を開きます。\n2. 「シフト希望一覧」タブをクリックすると、全スタッフから提出された希望日・希望休が一覧マトリクスで表示されます。\n3. スタッフごとの提出状況や重複を確認しながら、シフト作成画面へワンクリックで反映させることができます。',
    keyword: 'シフト希望確認 承認 管理者 集約 希望一覧',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-4',
    category: 'shift',
    question: '【管理者】完成したシフトを従業員に公開・通知するにはどうしますか？',
    answer: '【シフト確定・公開の手順】\n「シフト月間作成」画面で全員のシフト配置を完了したら、画面右上の青い「シフトを確定・公開する」ボタンをクリックします。\n公開を実行した瞬間に全従業員のマイシフトへ即時反映されます。',
    keyword: 'シフト確定 公開 通知 全社 反映 管理者',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-s-5',
    category: 'shift',
    question: '【管理者】新しい勤務パターン（例: 9:00-18:00、短時間等）を追加するには？',
    answer: '【シフトパターン追加手順】\n「シフト管理」＞「シフト基本設定・パターン管理」を開きます。\n「＋ 新規パターン追加」をクリックし、パターン名（例: 「早番」「中番」）、開始時間・終了時間・休憩時間を設定して保存します。追加したパターンはシフト作成時にワンクリックで割り当て可能になります。',
    keyword: '勤務パターン シフトパターン 追加 設定 早番 遅番',
    updated_at: '2026-09-06'
  },

  // ─── 💰 給与明細・計算 ───
  {
    id: 'sfaq-p-1',
    category: 'payroll',
    question: '【従業員】Web給与明細の閲覧やPDF印刷はどう操作しますか？',
    answer: '【給与明細の閲覧・印刷手順】\n1. ポータルから「給与計算・明細」カードをクリックします。\n2. 対象の支給年月（例: 2026年9月支給分）を選択すると、支給項目・控除項目・差引支給額が表示されます。\n3. 明細画面の右上にある「PDFダウンロード」または「印刷」ボタンを押すと、公式レイアウトの給与明細書をPDF保存・印刷できます。スマホからも保存可能です。',
    keyword: '給与明細 Web明細 PDF 印刷 ダウンロード スマホ 閲覧',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-p-2',
    category: 'payroll',
    question: '源泉徴収票や過去の賞与明細はどこから確認できますか？',
    answer: '【過去の明細・源泉徴収票】\n給与明細画面の年度切り替えドロップダウンから過去の年・月を選択できます。\nまた、毎年1月に発行される「給与所得の源泉徴収票」は、明細画面上部の「源泉徴収票一覧」タブからいつでも閲覧・PDF印刷が可能です。',
    keyword: '源泉徴収票 賞与明細 ボーナス 過去 年末調整',
    updated_at: '2026-09-06'
  },
  {
    id: 'sfaq-p-3',
    category: 'payroll',
    question: '【管理者】勤怠の打刻データから給与を自動計算・試算する手順は？',
    answer: '【給与自動試算の手順】\n1. 管理者メニュー「給与計算・明細（管理者）」を開きます。\n2. 対象月を選択し、「勤怠実績を取り込んで自動計算」ボタンをクリックします。\n3. 実労働時間、所定外残業、深夜労働、休日労働時間、有給消化日数に、基本給や時給・割増手当が自動掛け合わされて総支給額および社会保険料・源泉所得税が瞬時に試算されます。\n4. 内容を確認後、「給与確定・明細公開」を押すと全従業員へWeb明細が配信されます。',
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

    if (error || !data || data.length === 0) {
      const local = localStorage.getItem('kap_system_faqs_v2');
      if (local) {
        try { return JSON.parse(local); } catch (e) { /* fallback */ }
      }
      return DEFAULT_SYSTEM_FAQS;
    }
    localStorage.setItem('kap_system_faqs_v2', JSON.stringify(data));
    return data;
  } catch (err) {
    const local = localStorage.getItem('kap_system_faqs_v2');
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
