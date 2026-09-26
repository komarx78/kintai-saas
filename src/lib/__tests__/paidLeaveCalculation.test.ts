import { calculateStatutoryLeaveWithMode } from '../paidLeaveCalculation';

function runPaidLeaveTests() {
  console.log('=== 🏖️ 年次有給休暇（労働基準法第39条）計算エンジン 単体テスト開始 ===');

  // テスト1: 3月31日入社者の6ヶ月後初回付与日（民法第143条暦計算）
  // 3月31日入社 → 6ヶ月後は 9月30日（9月末日。10月1日へのオーバーフローを完全防止）
  const resMar31 = calculateStatutoryLeaveWithMode(
    '2024-03-31',
    '正社員',
    5,
    'contract_fixed',
    [],
    new Date('2024-10-15')
  );
  if (resMar31.lastGrantDate !== '2024-09-30') {
    throw new Error(`テスト1失敗: 2024-03-31入社の6ヶ月後付与日は2024-09-30であるべきだが、${resMar31.lastGrantDate}`);
  }
  if (resMar31.statutoryGrant !== 10) {
    throw new Error(`テスト1失敗: 正社員6ヶ月後付与日数は10日であるべきだが、${resMar31.statutoryGrant}`);
  }
  console.log('✅ テスト1 パス: 3月31日入社者の6ヶ月後付与日（9月30日末日・10月1日オーバーフロー完全防止）が完全正確');

  // テスト2: 労働基準法第39条第3項（週4日パートだが週30時間以上勤務の場合の一般労働者付与判定）
  // 週4日勤務、1日8時間＝週32時間勤務のパートタイマー
  // 週30時間以上のため比例付与の除外となり、一般労働者と同じ10日付与（勤続6ヶ月）となる
  const resWeekly32h = calculateStatutoryLeaveWithMode(
    '2024-04-01',
    'パート',
    4,
    'contract_fixed',
    [],
    new Date('2024-10-15'),
    32 // 週32時間
  );
  if (resWeekly32h.statutoryGrant !== 10) {
    throw new Error(`テスト2失敗: 週32時間(週4日)パートの付与日数は10日(一般付与)であるべきだが、${resWeekly32h.statutoryGrant}`);
  }
  console.log('✅ テスト2 パス: 週4日・週32時間パート労働者のフルタイム一般付与（10日）判定が完全正確');

  // テスト3: 週4日・週20時間パートの比例付与（労基法施行規則第24条の3）
  // 6ヶ月後 → 7日付与
  const resPart4d = calculateStatutoryLeaveWithMode(
    '2024-04-01',
    'パート',
    4,
    'contract_fixed',
    [],
    new Date('2024-10-15'),
    20 // 週20時間
  );
  if (resPart4d.statutoryGrant !== 7) {
    throw new Error(`テスト3失敗: 週4日(20時間)パートの付与日数は7日であるべきだが、${resPart4d.statutoryGrant}`);
  }
  console.log('✅ テスト3 パス: 週4日（20時間）パートの比例付与（7日）判定が完全正確');

  // テスト4: 週2日パートの比例付与（6ヶ月後3日、1年6ヶ月後4日）
  const resPart2d = calculateStatutoryLeaveWithMode(
    '2024-04-01',
    'パート',
    2,
    'contract_fixed',
    [],
    new Date('2024-10-15'),
    10
  );
  if (resPart2d.statutoryGrant !== 3) {
    throw new Error(`テスト4失敗: 週2日パート6ヶ月後は3日であるべきだが、${resPart2d.statutoryGrant}`);
  }
  console.log('✅ テスト4 パス: 週2日パートの比例付与（3日）判定が完全正確');

  // テスト5: 年5日取得義務（労基法第39条第7項）判定
  // 10日以上の付与者は isObligated === true、7日以下の比例付与者は false
  if (!resMar31.isObligated) {
    throw new Error('テスト5失敗: 正社員10日付与は年5日取得義務対象であるべき');
  }
  if (resPart4d.isObligated) {
    throw new Error('テスト5失敗: 7日付与のパートは年5日取得義務対象外であるべき');
  }
  console.log('✅ テスト5 パス: 労基法第39条第7項に基づく年5日取得義務対象フラグ（10日以上付与）が完全正確');

  console.log('🎉 全5件の年次有給休暇算定テストに100%合格いたしました！');
}

runPaidLeaveTests();
