import React, { useState } from 'react';
import { X, CheckCircle2, Lightbulb, BookOpen, HelpCircle as QuestionIcon, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export type ScreenHelpKey = 
  | 'shift_calendar'
  | 'shift_requirements'
  | 'shift_dashboard'
  | 'shift_employees'
  | 'shift_user_request'
  | 'onboarding_admin'
  | 'onboarding_user'
  | 'attendance_admin'
  | 'attendance_user'
  | 'payroll_admin'
  | 'payroll_user'
  | 'company_settings';

interface HelpContent {
  title: string;
  subtitle: string;
  badge: string;
  whyNeeded: {
    problem: string;
    purpose: string;
    intent: string;
    benefits: string[];
  };
  steps: {
    step: number;
    title: string;
    desc: string;
    detail: string;
  }[];
  keyPoints?: {
    term: string;
    description: string;
  }[];
  qaList: {
    q: string;
    a: string;
  }[];
}

const HELP_DATA: Record<ScreenHelpKey, HelpContent> = {
  shift_calendar: {
    title: 'シフトカレンダーの使い方と全体運用',
    subtitle: '希望収集からAI自動割り当て、そして本番公開までの完全ガイド',
    badge: 'シフト管理',
    whyNeeded: {
      problem: '手動でのシフト作成は、スタッフの希望の転記や必要人数の計算、契約時間の上限チェックなど膨大な時間と労力がかかり、ミスやダブルブッキングの原因になります。',
      purpose: 'スタッフから集まった希望と店舗の必要人数枠をAIが瞬時に照合し、最適・公平なシフト下書きを自動生成して作成時間を90%削減します。',
      intent: '「下書き（自動割り当て）」と「本番公開（一括確定）」を明確に分けることで、店長が急な事情や相性を目視で微調整してからスタッフに届けられる安全な運用設計にしています。',
      benefits: [
        '作成時間を数時間から数分へ劇的に短縮',
        '「自動割り当て」時点ではスタッフに見えないため、納得いくまで何度でも微調整が可能',
        '不足時間帯（ホール不足など）が色でリアルタイムに可視化され、募集や声掛けが迅速にできる'
      ]
    },
    keyPoints: [
      {
        term: '⚡ 自動割り当て（下書き作成）',
        description: 'AIが希望シフトと必要枠を照合して「未確定のドラフトシフト（青色）」を自動作成します。この時点ではスタッフのスマホには非公開です。'
      },
      {
        term: '🚀 一括確定（本番公開）',
        description: '店長が調整を終えたドラフトシフトを「確定（緑色）」へ昇格させ、スタッフのスマホマイページへ本番公開・配信します。'
      },
      {
        term: '📝 未処理の希望シフト（赤色斜線）',
        description: 'スタッフから届いた希望時間帯です。自動割り当てで配置されると自動的にドラフト（青色）に変化します。'
      }
    ],
    steps: [
      {
        step: 1,
        title: 'スタッフからの希望シフト収集',
        desc: 'スタッフがスマホから提出した希望がカレンダー上に「赤の斜線バー」で集まります。',
        detail: '管理者は集まった希望の全体バランスを確認します。'
      },
      {
        step: 2,
        title: '⚡「自動割り当て」ボタンをクリック',
        desc: 'AIが必要人数枠とスタッフの希望・契約上限・優先度を考慮して下書き（青色）を作成します。',
        detail: 'バーをクリックまたはドラッグして、時間帯や担当者を自由に微調整できます。'
      },
      {
        step: 3,
        title: '🚀「一括確定」ボタンで本番公開',
        desc: '仕上がったシフトを一括確定します。スタッフのスマホに確定通知・シフト表が配信されます。',
        detail: '確定されたデータは勤怠管理・給与計算システムの実績データへスムーズに連動します。'
      }
    ],
    qaList: [
      {
        q: '自動割り当てを押しても一部の希望が残っているのはなぜですか？',
        a: 'その時間帯の「必要人数枠」がすでに埋まっているか、必要枠自体が設定されていないためです。余った希望はそのまま残り、誰が余力を持っているか一目で把握できます。'
      },
      {
        q: '確定後にシフトを変更することはできますか？',
        a: 'はい、カレンダー上の確定バーをクリックして時間変更や削除、または「シフト追加」ボタンからいつでも個別修正が可能です。'
      }
    ]
  },

  shift_requirements: {
    title: '必要シフト枠設定（ガントチャート）の使い方',
    subtitle: '時間帯ごとの適正人数を設定し、ムダな人件費と人手不足を完全防止',
    badge: 'シフト管理マスタ',
    whyNeeded: {
      problem: '「何時に何人必要か」が感覚値だと、ピーク時にスタッフが足りずに現場が混乱したり、暇な時間帯に余計な人件費が発生してしまいます。',
      purpose: '平日・土日・祝日ごとに、役割（ホール・キッチン・レジ等）の「適正人数枠」を定義し、AI自動割り当ての絶対基準を作ります。',
      intent: 'ガントチャートをドラッグして直感的に枠を伸縮できるようにし、エクセル等の面倒な数値入力を一切不要にしました。',
      benefits: [
        'ピーク時と閑散期の人員メリハリがつき、人件費率（F/Lコスト）が適正化される',
        '平日で作った枠を「土日」や「祝日」へワンクリックでコピーして微調整できる',
        'AIがこの枠を埋めるように自動マッチングするため、欠員や過剰配置がゼロになる'
      ]
    },
    keyPoints: [
      {
        term: '👉 タイムラインドラッグ',
        description: '役割の行の空いている場所でマウスを押して横に引っ張るだけで、新しい必要枠が瞬時に作成されます。'
      },
      {
        term: '↔️ 左右リサイズハンドル',
        description: 'バーの左端・右端をドラッグして、開始時間や終了時間を自由に伸縮・微調整できます。'
      },
      {
        term: '🔢 ［＋］［ー］人数コントローラー',
        description: 'バーの上（またはホバー吹き出し）にある ［＋］［ー］ を押して、必要人数（1人、2人…）を即座に変更できます。'
      }
    ],
    steps: [
      {
        step: 1,
        title: 'パターン（平日・土日・祝日）を選択',
        desc: '設定したい曜日パターンのタブをクリックします。',
        detail: '土日や祝日は「他からコピー」ボタンを使うと、平日の設定を一瞬で複製して時短できます。'
      },
      {
        step: 2,
        title: 'ガントチャート上で時間帯と人数を設定',
        desc: 'マウスでドラッグして時間帯を引き伸ばし、必要な人数（2人など）を設定します。',
        detail: '1時間などの小さな枠でも、マウスを乗せると現れる吹き出しから簡単に人数変更が可能です。'
      },
      {
        step: 3,
        title: '右上の「設定を保存」をクリック',
        desc: '設定した内容がデータベースに安全に保存され、シフト自動生成の基準として適用されます。',
        detail: '他のタブ（土日・祝日）が未設定でも、平日の枠が自動保護される安全設計です。'
      }
    ],
    qaList: [
      {
        q: '土日だけ人数を増やしたい場合はどうすればいいですか？',
        a: '「土日」タブを開き、「平日からコピー」を押した後に、ピーク時間帯のバーの人数を［＋］で増やして「設定を保存」してください。'
      },
      {
        q: '不要になった枠を消すには？',
        a: 'バー右側のゴミ箱アイコンをクリックするか、バーにマウスを乗せて現れる吹き出しのゴミ箱ボタンをクリックしてください。'
      }
    ]
  },

  shift_dashboard: {
    title: 'シフト管理ダッシュボードの使い方',
    subtitle: 'シフト作成の進捗、概算人件費、最適化ステータスの一元管理',
    badge: 'シフト管理',
    whyNeeded: {
      problem: 'シフト表を作った後に人件費を計算すると、予算オーバーに気づいた時には手遅れになりがちです。',
      purpose: 'シフト作成の進行状況と、確定・ドラフトシフトに基づく「概算人件費」「総労働時間」をリアルタイムに可視化します。',
      intent: '店長や経営者が、人件費予算を意識しながら経営視点でシフト作成を完了できるように設計されています。',
      benefits: [
        'シフトを組むと同時に当月・当週の概算人件費が自動計算される',
        '未確定シフトがあるかどうかが一目でわかり、公開漏れを防止',
        '40名のリアルデモデータ投入・リセットにより、導入テストや練習がいつでも可能'
      ]
    },
    steps: [
      {
        step: 1,
        title: '概算人件費と労働時間の確認',
        desc: 'トップカードで今週・今月の予定人件費とスタッフの充足状況を確認します。',
        detail: '予算オーバーしている場合はカレンダーで時間調整を行います。'
      },
      {
        step: 2,
        title: 'AIシフト生成またはカレンダーへ移動',
        desc: '「⚡ シフトを自動生成する (AI)」を押すか、「📅 シフトカレンダーで確認」へ進みます。',
        detail: 'AIが最適な下書きを作成し、カレンダー上で確認できます。'
      },
      {
        step: 3,
        title: 'シフトの一括公開・確定',
        desc: '調整が完了したらカレンダーまたはダッシュボードから一括確定を行い、スタッフへ配信します。',
        detail: '確定後は勤怠実績の予実管理へと自動で引き継がれます。'
      }
    ],
    qaList: [
      {
        q: '人件費の計算基準はどうなっていますか？',
        a: '大元労務台帳およびシフト要員設定に登録されたスタッフごとの「基本時給」×「勤務時間」で自動計算されます。'
      }
    ]
  },

  shift_employees: {
    title: 'シフト要員設定（スタッフマスタ）の使い方',
    subtitle: 'スタッフの時給・契約上限・優先度スコア・担当ロールの設定',
    badge: 'シフト管理マスタ',
    whyNeeded: {
      problem: '扶養内パートの労働時間超過（103万/130万の壁）や、ベテランと新人の配置バランスの偏りは店舗運営の重大リスクです。',
      purpose: 'スタッフごとの週上限労働時間、優先度スコア、メイン担当ロール（ホール・キッチン等）を定義します。',
      intent: 'AI自動割り当て時にこれらの条件を厳格に順守させ、法令違反やスタッフの不満を構造的にゼロにします。',
      benefits: [
        '大元労務台帳（SSOT）と完全連動し、基本情報の二重入力を完全排除',
        '扶養範囲内（週20時間・月8万円等）の上限を自動で守ってAIがシフト配置',
        '出勤意欲の高いスタッフやベテランを優先スコアで適切に配置'
      ]
    },
    steps: [
      {
        step: 1,
        title: 'シフトアクセス権の有効化',
        desc: 'シフトを作成・提出するスタッフの「シフト機能」スイッチをONにします。',
        detail: '大元労務台帳に登録されている全従業員が自動で一覧表示されます。'
      },
      {
        step: 2,
        title: '担当役割・基本時給・上限時間の設定',
        desc: 'メインの役割（ホール/キッチン等）と週の最大労働時間、基本時給を設定します。',
        detail: '優先度スコア（1〜5）を設定すると、AIがスコアの高いスタッフを優先して枠に配置します。'
      },
      {
        step: 3,
        title: '「設定を保存」をクリック',
        desc: '設定が保存され、次回の自動シフト生成から即座に反映されます。',
        detail: '従業員ごとの個別設定はいつでも柔軟に変更可能です。'
      }
    ],
    qaList: [
      {
        q: '新しいスタッフが一覧に表示されない場合は？',
        a: '「入退社労務書類管理システム」で従業員登録が完了しているかご確認ください。大元台帳に登録されると自動的にここへ流動してきます。'
      }
    ]
  },

  shift_user_request: {
    title: 'シフト希望提出（従業員用）の使い方',
    subtitle: 'スマホからいつでも簡単・スピーディーに希望シフトを提出',
    badge: '従業員マイページ',
    whyNeeded: {
      problem: '紙やLINEでのシフト希望提出は、提出忘れ、転記ミス、集計の遅れなど店長・スタッフ双方に大きなストレスになります。',
      purpose: 'スタッフがスマホからタップするだけで、出勤可能な日付と時間帯を直感的に提出できるようにします。',
      intent: '締め切り前のリマインドや、提出済み希望のリアルタイム確認を可能にし、スムーズなシフト作成を実現します。',
      benefits: [
        'スマホから数タップでいつでもどこでも提出完了',
        '「午前だけ」「夕方から」「フルタイム」など希望時間を細かく指定可能',
        '店長がシフトを確定すると、マイページ上に自分の勤務予定が自動反映'
      ]
    },
    steps: [
      {
        step: 1,
        title: '対象期間と日付を選択',
        desc: 'カレンダー上でシフトに入りたい日付をタップします。',
        detail: '複数日をまとめて選択して一括設定することも可能です。'
      },
      {
        step: 2,
        title: '勤務可能な時間帯を選択',
        desc: '開始時間と終了時間（例: 09:00〜14:00）を選択します。',
        detail: '休み希望の日程は「休み」として登録できます。'
      },
      {
        step: 3,
        title: '「希望を提出する」をタップ',
        desc: '店長の管理カレンダーへ即座に希望が届きます。',
        detail: '提出後も締め切り前であれば何度でも変更・再提出が可能です。'
      }
    ],
    qaList: [
      {
        q: '提出した希望が通ったかどうかはどこで確認できますか？',
        a: '店長がシフトを一括確定すると、「確定シフト一覧」に自分の勤務予定が表示されます。'
      }
    ]
  },

  onboarding_admin: {
    title: '入退社労務管理（大元台帳 SSOT）の使い方',
    subtitle: '全システムの根幹となる従業員マスターとペーパーレス入社手続き',
    badge: '労務管理本丸',
    whyNeeded: {
      problem: '入社時に紙の書類を集め、勤怠システム、給与システム、シフト管理へと手動で同じ名前や口座情報を何度も打ち込む「二重入力・データ渋滞」が発生していました。',
      purpose: '入社手続き（マイナンバー・口座・扶養等）をペーパーレスで回収し、全システムの唯一の真実（SSOT）として一元管理します。',
      intent: 'ここで登録された従業員データが、勤怠・給与・シフトへと自動で流動するため、全社的な入力作業とミスを100%撲滅します。',
      benefits: [
        '新入社員にURLを送るだけで、スマホから必要書類・情報を完全回収',
        'マイナンバーや身元保証書、通帳写真などの安全なクラウド保管',
        '勤怠・給与・シフトへデータが自動連携され、即日システム利用が可能'
      ]
    },
    steps: [
      {
        step: 1,
        title: '新入社員の招待リンク発行',
        desc: '氏名とメールアドレスを入力して招待メールまたは専用URLを発行します。',
        detail: 'アルバイト・正社員など雇用形態ごとの提出項目が自動でセットされます。'
      },
      {
        step: 2,
        title: '従業員のスマホ入力と書類提出',
        desc: '新入社員がスマホで基本情報、振込先口座、扶養家族、本人確認書類を提出します。',
        detail: '進捗状況（未入力・提出済・承認待）がリアルタイムで一覧に表示されます。'
      },
      {
        step: 3,
        title: '内容の審査と台帳登録（承認）',
        desc: '提出された内容を確認して「承認」を押すと、全社大元台帳に本登録されます。',
        detail: '即座に勤怠打刻やシフト作成、給与計算で利用可能になります。'
      }
    ],
    qaList: [
      {
        q: 'マイナンバーなどの機密情報は安全ですか？',
        a: '高度に暗号化された安全なデータベース領域で隔離保管され、最高権限者のみが閲覧できる厳格なアクセス制御が施されています。'
      }
    ]
  },

  onboarding_user: {
    title: '入社手続き（従業員用）の使い方',
    subtitle: 'スマホで完結するカンタン安心の入社書類・台帳情報提出',
    badge: '入社手続き',
    whyNeeded: {
      problem: '紙の入社書類の記入や、通帳のコピー提出、マイナンバーの郵送などは手間がかかり紛失のリスクもありました。',
      purpose: 'お手持ちのスマートフォンから、ガイドに沿って必要事項を入力・写真をアップロードするだけで手続きを完了させます。',
      intent: '個人情報を安全に会社へ届け、入社初日からスムーズに給与振込や社会保険手続きを受けられるようにします。',
      benefits: [
        '紙の記入や印鑑、郵送が一切不要',
        '通帳や免許証はスマホカメラで撮ってそのままアップロード',
        '入力途中で自動保存されるため、いつでも再開可能'
      ]
    },
    steps: [
      {
        step: 1,
        title: '基本情報・連絡先の入力',
        desc: '氏名、フリガナ、現住所、緊急連絡先などを入力します。',
        detail: '郵便番号から住所が自動入力されます。'
      },
      {
        step: 2,
        title: '給与振込口座・扶養家族の登録',
        desc: '給与を受け取る銀行口座情報と、通帳またはキャッシュカードの写真を添付します。',
        detail: '扶養家族がいる場合は対象者の情報を入力します。'
      },
      {
        step: 3,
        title: '確認書類の添付と提出',
        desc: '本人確認書類等をアップロードし、内容を確認して「送信」をタップします。',
        detail: '会社側で承認されると入社手続きが完了します。'
      }
    ],
    qaList: [
      {
        q: '途中で写真が手元にない場合はどうすればいいですか？',
        a: '入力した内容は自動保存されていますので、写真を撮影した後に再度同じURLを開いて続きから提出できます。'
      }
    ]
  },

  attendance_admin: {
    title: '勤怠管理ダッシュボード（管理者）の使い方',
    subtitle: '日次打刻の確認、残業・36協定アラート、有給管理と月次締め',
    badge: '勤怠管理',
    whyNeeded: {
      problem: 'タイムカードの手集計は月末に莫大な時間がかかり、打刻漏れや残業超過の発見が遅れ、法令違反のリスクが高まります。',
      purpose: '全従業員のリアルタイム打刻状況、残業時間、有給取得状況を一元把握し、月末の勤怠締め処理を自動化します。',
      intent: '法令（36協定・年5日有給取得義務）を自動チェックし、労務リスクのない健全な職場環境を維持します。',
      benefits: [
        '打刻漏れや長時間の残業をリアルタイムアラートで即座に発見',
        '有給休暇の自動付与と残日数・消化率の自動計算',
        '月末はワンクリックで勤怠データを確定し、給与計算システムへ即座に連携'
      ]
    },
    steps: [
      {
        step: 1,
        title: '日次の打刻実績とアラート確認',
        desc: '出勤・退勤の打刻状況や、未打刻・遅刻・早退アラートを確認します。',
        detail: '従業員からの打刻修正申請や有給申請をワンクリックで承認します。'
      },
      {
        step: 2,
        title: '36協定・残業上限のチェック',
        desc: '月間の残業時間が上限に近づいているスタッフをグラフで早期確認します。',
        detail: '必要に応じて現場管理者へシフト調整を指示します。'
      },
      {
        step: 3,
        title: '月次勤怠の確定・締め処理',
        desc: '締め日に全従業員の勤怠データをロック（確定）します。',
        detail: '確定データがそのまま給与計算システムへ自動流動します。'
      }
    ],
    qaList: [
      {
        q: '打刻漏れの修正はどう行いますか？',
        a: '日次一覧で対象の日付をクリックして正しい時間を直接入力するか、従業員からの打刻修正申請を「承認」してください。'
      }
    ]
  },

  attendance_user: {
    title: '勤怠打刻・申請（従業員用）の使い方',
    subtitle: 'スマホでワンタップ打刻＆有給・残業・打刻修正の簡単申請',
    badge: '勤怠管理',
    whyNeeded: {
      problem: 'タイムカードを押しに事務所に立ち寄る手間や、紙の有給申請書の提出はスタッフ・管理者の双方に負担でした。',
      purpose: 'スマホや現場タブレットからワンタップで正確に出退勤・休憩を打刻できるようにします。',
      intent: '自分の勤務実績や有給残日数をいつでも確認できるようにし、安心・透明性のある就業環境を提供します。',
      benefits: [
        '出勤・退勤・休憩入り・戻りがボタン1つで即座に記録',
        '有給休暇の残り日数と有効期限がスマホでいつでも確認可能',
        '押し忘れ時の打刻修正や有給申請もスマホから数秒で完了'
      ]
    },
    steps: [
      {
        step: 1,
        title: '出勤・退勤・休憩の打刻',
        desc: '出勤時に「出勤」、休憩時に「休憩」、退勤時に「退勤」をタップします。',
        detail: '現在時刻と打刻履歴が即座にカレンダーに反映されます。'
      },
      {
        step: 2,
        title: '有給休暇・各種申請',
        desc: '「有給申請」または「打刻修正」ボタンから申請内容を入力して送信します。',
        detail: '店長が承認すると自動的に勤怠カレンダーに反映されます。'
      },
      {
        step: 3,
        title: '当月の勤務時間・有給残数の確認',
        desc: 'マイページ上で今月の総労働時間や残業時間、有給残日数が確認できます。',
        detail: '計画的な有給取得や勤務時間のセルフマネジメントが可能です。'
      }
    ],
    qaList: [
      {
        q: '打刻を忘れてしまった場合はどうすればいいですか？',
        a: '画面内の「打刻修正申請」をタップし、正しい出勤・退勤時間を入力して申請してください。店長の承認後に反映されます。'
      }
    ]
  },

  payroll_admin: {
    title: '給与計算ダッシュボード（管理者）の使い方',
    subtitle: '勤怠実績からワンクリック自動給与計算＆Web給与明細発行',
    badge: '給与計算',
    whyNeeded: {
      problem: '勤怠時間の転記、残業代・深夜手当の計算、社会保険料や所得税の控除額算出など、給与計算はミスが許されない最難関業務でした。',
      purpose: '確定した勤怠データと大元台帳の時給・給与情報を突き合わせ、税金・保険料の自動控除を含めてワンクリックで給与計算を完了させます。',
      intent: '給与計算ソフトの導入コストや手計算のミスを完全に根絶し、毎月の給与明細をペーパーレスで従業員スマホへ即日配信します。',
      benefits: [
        '勤怠データからの自動連動で、集計・計算時間を95%削減',
        '社会保険料率・雇用保険料率・源泉所得税の税額表に準拠した自動控除',
        '紙の給与明細の印刷・封入作業をゼロにするWeb給与明細機能'
      ]
    },
    steps: [
      {
        step: 1,
        title: '対象月の勤怠データ取り込み',
        desc: '勤怠管理システムで締め処理された当月実績をワンクリックで読み込みます。',
        detail: '基本時間、残業時間、深夜労働時間、有給日数が自動で集計されます。'
      },
      {
        step: 2,
        title: '自動計算結果の確認と手当・控除調整',
        desc: '基本給・割増手当・社会保険・税金の自動計算結果を確認します。',
        detail: '特別手当や立替金精算などがある場合は個別に追加入力できます。'
      },
      {
        step: 3,
        title: '給与確定とWeb明細の一括発行',
        desc: '「給与確定・明細発行」をクリックすると、従業員のスマホへWeb明細が即時配信されます。',
        detail: '全社用の給与台帳や振込一覧データ、PDF明細も一括出力可能です。'
      }
    ],
    qaList: [
      {
        q: '社会保険や税金の計算基準はどうなっていますか？',
        a: '大元労務台帳に登録された標準報酬月額や扶養親族数、最新の法改正料率に基づき自動計算されています。'
      }
    ]
  },

  payroll_user: {
    title: 'Web給与明細（従業員用）の使い方',
    subtitle: 'いつでもスマホで過去分まで閲覧・PDF保存できる電子明細',
    badge: '給与明細',
    whyNeeded: {
      problem: '紙の給与明細は紛失しやすく、過去の収入証明や確定申告の際に探すのが大変でした。',
      purpose: 'スマートフォンからいつでも最新・過去の給与明細を確認・PDFダウンロードできるようにします。',
      intent: '支給額、控除額（保険・税金）、勤怠の内訳を透明性高く分かりやすく確認できるようにします。',
      benefits: [
        '給与支払日にスマホへ明細が自動配信され、即座に確認可能',
        '過去の明細がクラウドに安全に保管され、いつでも閲覧・印刷可能',
        '基本給、残業手当、各種控除の内訳がクリアで分かりやすい'
      ]
    },
    steps: [
      {
        step: 1,
        title: '支給月を選択',
        desc: '確認したい年月（例: 2026年9月支給分）を選択します。',
        detail: '最新の明細が最上部に表示されます。'
      },
      {
        step: 2,
        title: '支給・控除・勤怠内訳の確認',
        desc: '総支給額、手取り額、引かれた税金・保険料、労働時間内訳を確認します。',
        detail: '項目ごとの詳細な金額が確認できます。'
      },
      {
        step: 3,
        title: 'PDFダウンロード・印刷',
        desc: '必要に応じて「PDFダウンロード」ボタンから公式フォーマットの明細を保存できます。',
        detail: 'ローン審査や各種手続きの収入証明書としてもご利用いただけます。'
      }
    ],
    qaList: [
      {
        q: '過去の明細は何年分保存されますか？',
        a: '在籍中のすべての過去明細がクラウド上に無期限で保存されます。'
      }
    ]
  },

  company_settings: {
    title: '会社・全社労務マスタ設定の使い方',
    subtitle: '会社基本情報、組織部署、就業規則、印字座標マスタの統制',
    badge: '最高管理者専用',
    whyNeeded: {
      problem: '会社情報や締日、法定帳票の設定が各システムに分散していると、設定の不整合や重大な計算ミス・法令違反につながります。',
      purpose: '全システム（勤怠・給与・シフト・労務）の根幹となる全社マスタを、最高管理者専用画面に厳格に隔離・一元管理します。',
      intent: '一般担当者や現場管理者が誤って全社設定を変更する事故を構造的に防ぎ、安心・堅牢な運用を保証します。',
      benefits: [
        '会社情報や賃金締切日・支払日を変更すると、全システムへ即座に一括反映',
        '部署マスタや役職マスタの表記揺れを完全撲滅',
        '国税庁様式のPDF印字座標インスペクターにより、帳票印字ズレをGUIで自在に微調整'
      ]
    },
    steps: [
      {
        step: 1,
        title: '会社基本情報と賃金締日・支払日',
        desc: '会社名、所在地、代表者、締め日（月末等）と支払日（翌月25日等）を設定します。',
        detail: 'この設定に基づいて給与計算と勤怠管理の集計期間が自動連動します。'
      },
      {
        step: 2,
        title: '組織・部署・就業パターンマスタ',
        desc: '店舗や部署名、標準的な就業時間パターン（9:00〜18:00等）を登録します。',
        detail: 'スタッフ登録時やシフト作成時の選択肢として全社統一されます。'
      },
      {
        step: 3,
        title: '国税庁様式インスペクター（帳票調整）',
        desc: '扶養控除申告書などの公的PDFへの印字位置をGUIで確認・微調整できます。',
        detail: 'ブラウザやプリンタごとのミリ単位の印字ズレを確実に解消できます。'
      }
    ],
    qaList: [
      {
        q: '締日や支払日を変更した場合、過去の給与データはどうなりますか？',
        a: '過去に確定済みの給与データには影響を与えず、次回の給与計算期間から安全に新設定が適用されます。'
      }
    ]
  }
};

interface HelpGuideModalProps {
  screenKey: ScreenHelpKey;
  isOpen: boolean;
  onClose: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ screenKey, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'why' | 'steps' | 'qa'>('why');
  const content = HELP_DATA[screenKey] || HELP_DATA.shift_calendar;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-indigo-100 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <span className="bg-white/20 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full backdrop-blur-md inline-block mb-1">
                  {content.badge}・使い方ガイド
                </span>
                <h2 className="text-xl font-bold tracking-tight">{content.title}</h2>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-indigo-100 mt-2 ml-11">{content.subtitle}</p>

          {/* Navigation Tabs */}
          <div className="flex space-x-2 mt-5 border-b border-indigo-500/40">
            <button
              onClick={() => setActiveTab('why')}
              className={`flex items-center space-x-1.5 pb-2.5 px-3 font-bold text-xs transition-all cursor-pointer border-b-2 ${
                activeTab === 'why' 
                  ? 'border-amber-300 text-amber-300' 
                  : 'border-transparent text-indigo-200 hover:text-white'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>💡 なぜ必要？（目的・意図）</span>
            </button>

            <button
              onClick={() => setActiveTab('steps')}
              className={`flex items-center space-x-1.5 pb-2.5 px-3 font-bold text-xs transition-all cursor-pointer border-b-2 ${
                activeTab === 'steps' 
                  ? 'border-amber-300 text-amber-300' 
                  : 'border-transparent text-indigo-200 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>🔄 操作の流れ（3ステップ）</span>
            </button>

            <button
              onClick={() => setActiveTab('qa')}
              className={`flex items-center space-x-1.5 pb-2.5 px-3 font-bold text-xs transition-all cursor-pointer border-b-2 ${
                activeTab === 'qa' 
                  ? 'border-amber-300 text-amber-300' 
                  : 'border-transparent text-indigo-200 hover:text-white'
              }`}
            >
              <QuestionIcon className="w-4 h-4" />
              <span>❓ よくある質問 (Q&A)</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-700">
          
          {/* TAB 1: なぜ必要？（目的・意図） */}
          {activeTab === 'why' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* 課題と目的カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-rose-50/70 border border-rose-100 p-4 rounded-2xl">
                  <div className="flex items-center space-x-2 text-rose-700 font-bold text-xs mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>これまでの現場の悩み・課題</span>
                  </div>
                  <p className="text-xs text-rose-900 leading-relaxed">{content.whyNeeded.problem}</p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl">
                  <div className="flex items-center space-x-2 text-emerald-700 font-bold text-xs mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>本システムでの解決・目的</span>
                  </div>
                  <p className="text-xs text-emerald-900 leading-relaxed">{content.whyNeeded.purpose}</p>
                </div>
              </div>

              {/* 設計意図 */}
              <div className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100 p-4 rounded-2xl">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>💡 軍師孔明・設計の意図</span>
                </div>
                <p className="text-xs text-indigo-950 leading-relaxed">{content.whyNeeded.intent}</p>
              </div>

              {/* 導入のメリット */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2.5 flex items-center">
                  <Zap className="w-4 h-4 mr-1 text-amber-500" />
                  得られる主なメリット
                </h4>
                <div className="space-y-2">
                  {content.whyNeeded.benefits.map((b, idx) => (
                    <div key={idx} className="flex items-start space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <span className="font-bold text-indigo-600 shrink-0">✔</span>
                      <span className="text-slate-700">{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 主要用語・重要ポイント */}
              {content.keyPoints && content.keyPoints.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center">
                    <Lightbulb className="w-4 h-4 mr-1 text-indigo-600" />
                    初心者が知っておくべき重要ワード
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {content.keyPoints.map((kp, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                        <span className="font-bold text-indigo-700 text-xs block mb-0.5">{kp.term}</span>
                        <span className="text-xs text-slate-600 leading-relaxed">{kp.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 操作の流れ（3ステップ） */}
          {activeTab === 'steps' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <p className="text-xs text-slate-500 mb-4">
                以下の3つのステップに従って操作を進めるだけで、誰でも確実に業務を完了できます。
              </p>

              {content.steps.map((st) => (
                <div key={st.step} className="flex items-start space-x-4 bg-slate-50 hover:bg-indigo-50/40 p-4 rounded-2xl border border-slate-200/80 transition-all">
                  <div className="w-8 h-8 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-md shrink-0">
                    {st.step}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-800 mb-1 flex items-center">
                      {st.title}
                    </h4>
                    <p className="text-xs text-slate-600 font-medium mb-1.5">{st.desc}</p>
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 text-[11px] text-slate-500">
                      <span className="font-bold text-indigo-600">詳細: </span>
                      {st.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: よくある質問 (Q&A) */}
          {activeTab === 'qa' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {content.qaList.map((qa, idx) => (
                <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-start space-x-2 font-bold text-xs text-indigo-900">
                    <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[10px] shrink-0 font-black">Q</span>
                    <span>{qa.q}</span>
                  </div>
                  <div className="flex items-start space-x-2 text-xs text-slate-700 pl-6 border-l-2 border-indigo-200 ml-2">
                    <p className="leading-relaxed">{qa.a}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center">
            <span>🛡️ 軍師孔明・完全サポートガイド</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
          >
            理解しました（閉じる）
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpGuideModal;
