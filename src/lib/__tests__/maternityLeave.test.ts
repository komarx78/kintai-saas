import { calculateMaternityDates, addMonthsCivil, getMaternitySocialInsuranceExemptMonths } from '../maternityLeave';

function runTests() {
  console.log('=== 👶 産休・育休・社会保険料免除エンジン 単体テスト開始 ===');

  // テスト1: 民法第143条第2項（8月31日生まれの1歳6ヶ月到達日オーバーフロー防止）
  // 8月31日生まれの18ヶ月後 → 2月には31日がないため、民法143条2項但書により2月末日（2026-02-28）となる
  const reachedDate18m = addMonthsCivil('2024-08-31', 18);
  if (reachedDate18m !== '2026-02-28') {
    throw new Error(`テスト1失敗: 8月31日の18ヶ月後は2026-02-28であるべきだが、${reachedDate18m} となった`);
  }
  console.log('✅ テスト1 パス: 民法第143条第2項に基づく月末オーバーフロー防止（8月31日生まれの18ヶ月後が2月末日）が完全正確');

  // テスト2: うるう年2月29日生まれの満1歳到達日
  // 2024-02-29生まれの12ヶ月後 → 平年2025年2月末日（2025-02-28）
  const reachedDate12m = addMonthsCivil('2024-02-29', 12);
  if (reachedDate12m !== '2025-02-28') {
    throw new Error(`テスト2失敗: 2024-02-29の12ヶ月後は2025-02-28であるべきだが、${reachedDate12m} となった`);
  }
  console.log('✅ テスト2 パス: 閏年2月29日生まれの平年満1歳到達応当日（2月28日）が完全正確');

  // テスト3: 単胎妊娠の産休・育休期間計算（予定日2026-10-01）
  // 産前42日（当日含めて42日、-41日前）: 2026-10-01 - 41日 = 2026-08-21
  // 産後56日（翌日から56日）: 2026-10-01 + 56日 = 2026-11-26
  // 育休開始: 2026-11-27
  // 満1歳誕生日前日: 2027-10-01の1日前 = 2027-09-30
  // 復職予定日: 2027-10-01
  const resSingle = calculateMaternityDates({
    expectedBirthDate: '2026-10-01',
    pregnancyType: 'single'
  });
  if (resSingle.maternityLeaveStartDate !== '2026-08-21') {
    throw new Error(`テスト3失敗: 産前開始日は2026-08-21であるべきだが、${resSingle.maternityLeaveStartDate}`);
  }
  if (resSingle.maternityLeaveEndDate !== '2026-11-26') {
    throw new Error(`テスト3失敗: 産後終了日は2026-11-26であるべきだが、${resSingle.maternityLeaveEndDate}`);
  }
  if (resSingle.childcareLeaveStartDate !== '2026-11-27') {
    throw new Error(`テスト3失敗: 育休開始日は2026-11-27であるべきだが、${resSingle.childcareLeaveStartDate}`);
  }
  if (resSingle.childcareLeaveEndDate !== '2027-09-30') {
    throw new Error(`テスト3失敗: 育休終了日は2027-09-30であるべきだが、${resSingle.childcareLeaveEndDate}`);
  }
  if (resSingle.returnToWorkDate !== '2027-10-01') {
    throw new Error(`テスト3失敗: 復職予定日は2027-10-01であるべきだが、${resSingle.returnToWorkDate}`);
  }
  console.log('✅ テスト3 パス: 単胎妊娠の産前42日・産後56日・育休1歳の全期間計算が完全正確');

  // テスト4: 多胎妊娠（双子等）の産前98日計算（予定日2026-10-01）
  // 産前98日（当日含めて98日、-97日前）: 2026-10-01 - 97日 = 2026-06-26
  const resMulti = calculateMaternityDates({
    expectedBirthDate: '2026-10-01',
    pregnancyType: 'multiple'
  });
  if (resMulti.maternityLeaveStartDate !== '2026-06-26') {
    throw new Error(`テスト4失敗: 多胎産前開始日は2026-06-26であるべきだが、${resMulti.maternityLeaveStartDate}`);
  }
  console.log('✅ テスト4 パス: 多胎妊娠の産前14週（98日）期間計算が完全正確');

  // テスト5: 社会保険料免除月判定（健康保険法第159条・厚生年金保険法第81条の2）
  // 産休開始: 2026-05-15, 育休終了: 2027-05-31
  // 終了日の翌日（2027-06-01）の属する月の前月 = 2027-05
  // 免除期間: 2026-05 〜 2027-05（計13ヶ月）
  const exemptRes = getMaternitySocialInsuranceExemptMonths('2026-05-15', '2027-05-31');
  if (exemptRes.startYearMonth !== '2026-05' || exemptRes.endYearMonth !== '2027-05') {
    throw new Error(`テスト5失敗: 免除期間は2026-05〜2027-05であるべきだが、${exemptRes.startYearMonth}〜${exemptRes.endYearMonth}`);
  }
  if (exemptRes.exemptMonths.length !== 13) {
    throw new Error(`テスト5失敗: 免除月数は13ヶ月であるべきだが、${exemptRes.exemptMonths.length}`);
  }
  console.log('✅ テスト5 パス: 社会保険料免除期間（健康保険法第159条・厚生年金保険法第81条の2）判定が完全正確');

  console.log('🎉 全5件の産休・育休・社会保険免除テストに100%合格いたしました！');
}

runTests();
