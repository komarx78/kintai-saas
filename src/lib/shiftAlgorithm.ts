export interface AdvancedShift {
  id?: string;
  user_id: string;
  target_date: string;
  start_time: string;
  end_time: string;
  role: string;
  status: string;
}

export interface UserWageSetting {
  user_id: string;
  base_wage: number;
  night_premium?: number;
}

export interface ShiftRequirement {
  id?: string;
  target_date: string | null;
  day_of_week: number | null;
  role: string;
  start_time: string;
  end_time: string;
  required_count: number;
}

export interface ShiftRequest {
  id?: string;
  user_id: string;
  target_date: string;
  available_start_time: string | null;
  available_end_time: string | null;
  preferred_role?: string | null;
}

export interface ShiftEmployeeSetting {
  user_id: string;
  hire_date?: string;
  max_hours_per_week?: number;
  min_shift_hours?: number; // 1回の最低勤務時間（例: 3時間）
  priority_score?: number;
  default_role?: string;
  roles?: string[] | any;
  base_wage?: number;
}

export function calculateLaborCost(advanced_shifts: AdvancedShift[], user_wage_settings: UserWageSetting[]): number {
  let totalCost = 0;
  const wageMap = new Map(user_wage_settings.map(w => [w.user_id, w]));

  for (const shift of advanced_shifts) {
    if (shift.status !== 'confirmed') continue;
    
    const wageSetting = wageMap.get(shift.user_id);
    const hourlyWage = wageSetting ? wageSetting.base_wage : 1100;

    const startParts = shift.start_time.split(':').map(Number);
    const endParts = shift.end_time.split(':').map(Number);
    let startMinutes = startParts[0] * 60 + startParts[1];
    let endMinutes = endParts[0] * 60 + endParts[1];
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;

    let regularMinutes = 0;
    let lateNightMinutes = 0;

    for (let m = startMinutes; m < endMinutes; m++) {
      const hour = Math.floor(m / 60) % 24;
      if (hour >= 22 || hour < 5) {
        lateNightMinutes++;
      } else {
        regularMinutes++;
      }
    }

    const regularHours = regularMinutes / 60;
    const lateNightHours = lateNightMinutes / 60;

    const regularCost = regularHours * hourlyWage;
    const lateNightMultiplier = 1 + ((wageSetting?.night_premium || 25) / 100);
    const lateNightCost = lateNightHours * hourlyWage * lateNightMultiplier;
    
    totalCost += regularCost + lateNightCost;
  }
  return Math.round(totalCost);
}

export function generateAutoShift(
  requirements: ShiftRequirement[],
  requests: ShiftRequest[],
  existingShifts: AdvancedShift[],
  employeeSettings: ShiftEmployeeSetting[],
  targetDateStr: string,
  targetDayOfWeek: number,
  mode: string = 'equal',
  allPeriodGeneratedShifts: Partial<AdvancedShift>[] = []
): Partial<AdvancedShift>[] {
  const generatedShifts: Partial<AdvancedShift>[] = [];
  
  // 1. 当日の対象必要枠を取得 (特定日指定 または 曜日指定)
  const dayReqs = requirements.filter(r => 
    (r.target_date === targetDateStr) || 
    (!r.target_date && r.day_of_week === targetDayOfWeek)
  );

  if (dayReqs.length === 0) return [];

  // 2. 当日の有効なシフト希望（勤務希望）を取得
  const dayRequests = requests.filter(r => 
    r.target_date === targetDateStr && 
    r.available_start_time && 
    r.available_end_time
  );

  if (dayRequests.length === 0) return [];

  const empMap = new Map(employeeSettings.map(e => [e.user_id, e]));

  // 期間全体の割り当て済み回数・時間を集計（均等分配用）
  const shiftCountMap = new Map<string, number>();
  [...existingShifts, ...allPeriodGeneratedShifts].forEach(s => {
    if (s.user_id) {
      shiftCountMap.set(s.user_id, (shiftCountMap.get(s.user_id) || 0) + 1);
    }
  });

  // ロールごとに必要スロットを展開してマッチング
  // 優先順位: レジや清掃など特定枠から順に処理
  const uniqueRoles = [...new Set(dayReqs.map(r => r.role))];

  for (const role of uniqueRoles) {
    const roleReqs = dayReqs.filter(r => r.role === role);

    // 0:00〜24:00 の各時間帯ごとの必要枠数（0〜23時）をスロットとして作成
    const neededSlots = new Array(24).fill(0);
    roleReqs.forEach(req => {
      if (!req.start_time || !req.end_time) return;
      const [sh] = req.start_time.split(':').map(Number);
      const [eh, em] = req.end_time.split(':').map(Number);
      const endHour = em > 0 ? eh : eh - 1;
      const count = req.required_count || 1;
      for (let h = sh; h <= endHour && h < 24; h++) {
        neededSlots[h] += count;
      }
    });

    // 既に本日このロールに確定/ドラフト配置されているシフト分をスロットから引く
    existingShifts.forEach(shift => {
      if (shift.target_date !== targetDateStr || shift.role !== role) return;
      const [sh] = shift.start_time.split(':').map(Number);
      const [eh, em] = shift.end_time.split(':').map(Number);
      const endHour = em > 0 ? eh : eh - 1;
      for (let h = sh; h <= endHour && h < 24; h++) {
        if (neededSlots[h] > 0) neededSlots[h]--;
      }
    });

    // このロールを担当可能な候補者を抽出
    const candidateRequests = dayRequests.filter(req => {
      const emp = empMap.get(req.user_id);
      if (!emp) return true; // 設定がない場合は全ロール可能とみなす

      // preferred_role がある場合はそれを優先チェック
      if (req.preferred_role && req.preferred_role === role) return true;

      // default_role のチェック
      if (emp.default_role && emp.default_role === role) return true;

      // roles 配列のチェック
      if (emp.roles) {
        if (Array.isArray(emp.roles) && emp.roles.includes(role)) return true;
        if (typeof emp.roles === 'string' && emp.roles.includes(role)) return true;
      }

      // default_role が設定されていない場合はどのロールも可能
      if (!emp.default_role) return true;

      return false;
    });

    // モードに応じたソート
    candidateRequests.sort((a, b) => {
      const empA = empMap.get(a.user_id);
      const empB = empMap.get(b.user_id);
      
      if (mode === 'veteran') {
        const dateA = empA?.hire_date ? new Date(empA.hire_date).getTime() : 0;
        const dateB = empB?.hire_date ? new Date(empB.hire_date).getTime() : 0;
        return dateA - dateB;
      } else if (mode === 'priority') {
        const scoreA = empA?.priority_score ?? 3;
        const scoreB = empB?.priority_score ?? 3;
        return scoreB - scoreA;
      } else {
        // equal: 既にアサインされたシフト回数が少ない人を最優先
        const countA = shiftCountMap.get(a.user_id) || 0;
        const countB = shiftCountMap.get(b.user_id) || 0;
        if (countA !== countB) return countA - countB;
        return (empB?.priority_score ?? 3) - (empA?.priority_score ?? 3);
      }
    });

    // 候補者を必要枠に順番にマッチング
    for (const req of candidateRequests) {
      if (!req.available_start_time || !req.available_end_time) continue;

      // 本日すでに何らかのシフトに割り当て済みか確認（1日1回・重複防止）
      const isAssignedToday = 
        generatedShifts.some(s => s.user_id === req.user_id && s.target_date === targetDateStr) ||
        allPeriodGeneratedShifts.some(s => s.user_id === req.user_id && s.target_date === targetDateStr) ||
        existingShifts.some(s => s.user_id === req.user_id && s.target_date === targetDateStr);
      
      if (isAssignedToday) continue;

      const [availSh, availSm] = req.available_start_time.split(':').map(Number);
      const [availEh, availEm] = req.available_end_time.split(':').map(Number);

      const reqStartHour = availSh;
      const reqEndHour = availEm > 0 ? availEh : availEh - 1;

      // このスタッフの希望時間内で、必要枠（スロット > 0）が存在するか確認
      let bestStartHour: number | null = null;
      let bestEndHour: number | null = null;

      for (let h = reqStartHour; h <= reqEndHour && h < 24; h++) {
        if (neededSlots[h] > 0) {
          if (bestStartHour === null) bestStartHour = h;
          bestEndHour = h;
        } else if (bestStartHour !== null) {
          // 連続スロットが途切れたら終了
          break;
        }
      }

      // 枠不足の時間帯があり、配置可能な場合
      if (bestStartHour !== null && bestEndHour !== null) {
        const startH = Math.max(availSh, bestStartHour);
        const endH = Math.min(availEh, bestEndHour + 1);
        const shiftDuration = endH - startH;

        // スタッフの最低勤務時間（指定なし時は3時間）を下回る極小シフト（1時間だけ等）は割り当てない
        const requiredMinHours = empMap.get(req.user_id)?.min_shift_hours ?? 3;
        if (shiftDuration < requiredMinHours) {
          continue;
        }

        if (endH > startH) {
          const finalStartStr = `${startH.toString().padStart(2, '0')}:${(startH === availSh ? availSm : 0).toString().padStart(2, '0')}`;
          const finalEndStr = `${endH.toString().padStart(2, '0')}:${(endH === availEh ? availEm : 0).toString().padStart(2, '0')}`;

          const newShift: Partial<AdvancedShift> = {
            user_id: req.user_id,
            target_date: targetDateStr,
            start_time: finalStartStr,
            end_time: finalEndStr,
            role: role,
            status: 'draft'
          };

          generatedShifts.push(newShift);
          shiftCountMap.set(req.user_id, (shiftCountMap.get(req.user_id) || 0) + 1);

          // 割り当てたスロットを消費（過剰配置を完全防止）
          for (let h = startH; h < endH && h < 24; h++) {
            if (neededSlots[h] > 0) {
              neededSlots[h]--;
            }
          }
        }
      }
    }
  }

  return generatedShifts;
}



