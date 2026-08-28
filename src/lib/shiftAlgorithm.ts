export interface AdvancedShift {
  id: string;
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
  night_premium: number;
}

export interface ShiftRequirement {
  id: string;
  target_date: string | null;
  day_of_week: number;
  role: string;
  start_time: string;
  end_time: string;
  required_count: number;
}

export interface ShiftRequest {
  id: string;
  user_id: string;
  target_date: string;
  available_start_time: string;
  available_end_time: string;
}

export interface ShiftEmployeeSetting {
  user_id: string;
  hire_date: string;
  max_hours_per_week: number;
  priority_score: number;
  default_role: string;
}

export function calculateLaborCost(advanced_shifts: AdvancedShift[], user_wage_settings: UserWageSetting[]): number {
  let totalCost = 0;
  const wageMap = new Map(user_wage_settings.map(w => [w.user_id, w]));

  for (const shift of advanced_shifts) {
    if (shift.status !== 'confirmed') continue;
    
    const wageSetting = wageMap.get(shift.user_id);
    if (!wageSetting) continue;

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

    const regularCost = regularHours * wageSetting.base_wage;
    const lateNightMultiplier = 1 + ((wageSetting.night_premium || 25) / 100);
    const lateNightCost = lateNightHours * wageSetting.base_wage * lateNightMultiplier;
    
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
  mode: string 
): Partial<AdvancedShift>[] {
  const generatedShifts: Partial<AdvancedShift>[] = [];
  
  // 1. 当日の対象必要枠を取得 (特定日 or 曜日)
  const dayReqs = requirements.filter(r => 
    (r.target_date === targetDateStr) || 
    (!r.target_date && r.day_of_week === targetDayOfWeek)
  );

  if (dayReqs.length === 0) return [];

  // 2. 当日のシフト希望を取得
  const dayRequests = [...requests.filter(r => r.target_date === targetDateStr)];
  if (dayRequests.length === 0) return [];

  const empMap = new Map(employeeSettings.map(e => [e.user_id, e]));

  // モードに応じたソート（ベテラン優先、スコア優先、またはシャッフル）
  dayRequests.sort((a, b) => {
    const empA = empMap.get(a.user_id);
    const empB = empMap.get(b.user_id);
    
    if (!empA && !empB) return 0;
    if (!empA) return 1;
    if (!empB) return -1;

    if (mode === 'veteran') {
      const dateA = empA.hire_date ? new Date(empA.hire_date).getTime() : Date.now();
      const dateB = empB.hire_date ? new Date(empB.hire_date).getTime() : Date.now();
      return dateA - dateB;
    } else if (mode === 'priority') {
      return (empB.priority_score || 0) - (empA.priority_score || 0);
    } else {
      return 0.5 - Math.random(); 
    }
  });

  // ロールごとにスロット管理
  const roles = [...new Set(dayReqs.map(r => r.role))];

  for (const role of roles) {
    const roleReqs = dayReqs.filter(r => r.role === role);

    // 0:00〜24:00 の各1時間ごとの必要枠配列 (0〜23時)
    const neededSlots = new Array(24).fill(0);
    roleReqs.forEach(req => {
      if (!req.start_time || !req.end_time) return;
      const [sh] = req.start_time.split(':').map(Number);
      const [eh, em] = req.end_time.split(':').map(Number);
      const endHour = em > 0 ? eh : eh - 1;
      for (let h = sh; h <= endHour && h < 24; h++) {
        neededSlots[h] += (req.required_count || 1);
      }
    });

    // 既に確定配置されているシフト分をスロットから差し引く
    existingShifts.forEach(shift => {
      if (shift.target_date !== targetDateStr || shift.role !== role) return;
      const [sh] = shift.start_time.split(':').map(Number);
      const [eh, em] = shift.end_time.split(':').map(Number);
      const endHour = em > 0 ? eh : eh - 1;
      for (let h = sh; h <= endHour && h < 24; h++) {
        if (neededSlots[h] > 0) neededSlots[h]--;
      }
    });

    // 候補者を順番にマッチング
    for (const req of dayRequests) {
      if (!req.available_start_time || !req.available_end_time) continue;

      // 既に本日シフト割り当て済みかチェック
      const isAssignedToday = generatedShifts.some(s => s.user_id === req.user_id && s.target_date === targetDateStr) ||
                             existingShifts.some(s => s.user_id === req.user_id && s.target_date === targetDateStr);
      if (isAssignedToday) continue;

      const empSet = empMap.get(req.user_id);
      if (empSet && empSet.default_role && empSet.default_role !== role) {
        continue; // 担当可能ロールでない場合はスキップ
      }

      const [availSh, availSm] = req.available_start_time.split(':').map(Number);
      const [availEh, availEm] = req.available_end_time.split(':').map(Number);

      const reqStartHour = availSh;
      const reqEndHour = availEm > 0 ? availEh : availEh - 1;

      // このスタッフの希望時間内で「まだ枠が不足している時間帯」を探す
      let bestStartHour: number | null = null;
      let bestEndHour: number | null = null;

      for (let h = reqStartHour; h <= reqEndHour && h < 24; h++) {
        if (neededSlots[h] > 0) {
          if (bestStartHour === null) bestStartHour = h;
          bestEndHour = h;
        }
      }

      // 枠不足の時間帯があり、かつ1時間以上配置可能な場合
      if (bestStartHour !== null && bestEndHour !== null) {
        // スタッフの希望開始・終了時間を活かしたシフト時間を設定
        const startH = Math.max(availSh, bestStartHour);
        const endH = Math.min(availEh, bestEndHour + 1);

        if (endH > startH) {
          const finalStartStr = `${startH.toString().padStart(2, '0')}:${(startH === availSh ? availSm : 0).toString().padStart(2, '0')}`;
          const finalEndStr = `${endH.toString().padStart(2, '0')}:${(endH === availEh ? availEm : 0).toString().padStart(2, '0')}`;

          generatedShifts.push({
            user_id: req.user_id,
            target_date: targetDateStr,
            start_time: finalStartStr,
            end_time: finalEndStr,
            role: role,
            status: 'draft'
          });

          // 割り当てた時間帯のスロットを消費（過剰配置を絶対に防止！）
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


