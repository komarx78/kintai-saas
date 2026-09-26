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
  max_days_per_week?: number; // 週間最大出勤日数（デフォルト5日、上限6日＝法定休日1日死守）
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
    const hourlyWage = Number(wageSetting?.base_wage) || 0;

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

interface ShortageBlock {
  startHour: number;
  endHour: number;
  duration: number;
  totalShortage: number;
}

/**
 * スタッフの希望時間内で、不足しているスロット（neededSlots > 0）の連続区間を抽出
 */
function findShortageBlocks(
  reqStartHour: number,
  reqEndHour: number,
  neededSlots: number[]
): ShortageBlock[] {
  const blocks: ShortageBlock[] = [];
  let currentStart: number | null = null;
  let currentShortage = 0;

  for (let h = reqStartHour; h <= reqEndHour && h < 24; h++) {
    if (neededSlots[h] > 0) {
      if (currentStart === null) {
        currentStart = h;
        currentShortage = 0;
      }
      currentShortage += neededSlots[h];
    } else {
      if (currentStart !== null) {
        blocks.push({
          startHour: currentStart,
          endHour: h,
          duration: h - currentStart,
          totalShortage: currentShortage
        });
        currentStart = null;
        currentShortage = 0;
      }
    }
  }

  if (currentStart !== null) {
    const endH = Math.min(reqEndHour + 1, 24);
    blocks.push({
      startHour: currentStart,
      endHour: endH,
      duration: endH - currentStart,
      totalShortage: currentShortage
    });
  }

  // 長い連続ブロックを最優先、同じ長さなら不足人数が多いブロックを優先
  blocks.sort((a, b) => {
    if (b.duration !== a.duration) return b.duration - a.duration;
    return b.totalShortage - a.totalShortage;
  });

  return blocks;
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

  // 期間全体の割り当て済み日数（日付ユニーク）と合計労働時間（分）を集計（労基法・法定休日ガード用）
  const userAssignedDatesMap = new Map<string, Set<string>>();
  const userTotalMinutesMap = new Map<string, number>();

  [...existingShifts, ...allPeriodGeneratedShifts, ...generatedShifts].forEach(s => {
    if (!s.user_id || !s.target_date) return;
    if (!userAssignedDatesMap.has(s.user_id)) {
      userAssignedDatesMap.set(s.user_id, new Set());
    }
    userAssignedDatesMap.get(s.user_id)!.add(s.target_date);

    if (s.start_time && s.end_time) {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      userTotalMinutesMap.set(s.user_id, (userTotalMinutesMap.get(s.user_id) || 0) + diff);
    }
  });

  // 当日すでに何らかのシフトに割り当て済みか確認する関数
  const isAssignedToday = (userId: string) => {
    return (
      generatedShifts.some(s => s.user_id === userId && s.target_date === targetDateStr) ||
      allPeriodGeneratedShifts.some(s => s.user_id === userId && s.target_date === targetDateStr) ||
      existingShifts.some(s => s.user_id === userId && s.target_date === targetDateStr)
    );
  };

  // ロールごとに必要スロットを展開してマッチング
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
    [...existingShifts, ...allPeriodGeneratedShifts, ...generatedShifts].forEach(shift => {
      if (shift.target_date !== targetDateStr || shift.role !== role || !shift.start_time || !shift.end_time) return;
      const [sh] = shift.start_time.split(':').map(Number);
      const [eh, em] = shift.end_time.split(':').map(Number);
      const endHour = em > 0 ? eh : eh - 1;
      for (let h = sh; h <= endHour && h < 24; h++) {
        if (neededSlots[h] > 0) neededSlots[h]--;
      }
    });

    // このロールを担当可能な候補者を抽出（★週上限日数・週上限時間のガードを適用★）
    const candidateRequests = dayRequests.filter(req => {
      if (isAssignedToday(req.user_id)) return false;

      const emp = empMap.get(req.user_id);

      // 【🛡️ 安全装置1：週間上限日数リミッター（法定休日ガード）】
      // 労働基準法第35条（週1日以上の休日義務）を絶対死守！週7日出勤は絶対に作らない
      const currentDays = userAssignedDatesMap.get(req.user_id)?.size || 0;
      const maxDays = emp?.max_days_per_week ?? 5; // デフォルト最大5日（週休2日）
      const hardLimitDays = Math.min(maxDays, 6); // 最大でも6日（週1日は必ず休日）
      if (currentDays >= hardLimitDays) {
        return false; // 上限到達のため除外（休日確保）
      }

      // 【🛡️ 安全装置2：週間労働時間リミッター（週40時間ガード）】
      const currentMinutes = userTotalMinutesMap.get(req.user_id) || 0;
      const maxHours = emp?.max_hours_per_week ?? 40;
      if (currentMinutes >= maxHours * 60) {
        return false; // 上限時間到達のため除外
      }

      // 役割適合性チェック
      if (req.preferred_role && req.preferred_role === role) return true;
      if (emp?.default_role && emp.default_role === role) return true;
      if (emp?.roles) {
        if (Array.isArray(emp.roles) && emp.roles.includes(role)) return true;
        if (typeof emp.roles === 'string' && emp.roles.includes(role)) return true;
      }
      if (!emp?.default_role) return true;

      return false;
    });

    // モードに応じたソート（早い時間優先 ＋ 出勤日数が少ない未配置優先、均等配分）
    const firstNeededHour = neededSlots.findIndex(s => s > 0);

    candidateRequests.sort((a, b) => {
      const empA = empMap.get(a.user_id);
      const empB = empMap.get(b.user_id);

      const [aSh] = (a.available_start_time || '24:00').split(':').map(Number);
      const [bSh] = (b.available_start_time || '24:00').split(':').map(Number);

      // 1. 開店枠（店舗の最初の不足スロット）をカバーできるスタッフを最優先
      if (firstNeededHour !== -1) {
        const aCanCoverFirst = aSh <= firstNeededHour;
        const bCanCoverFirst = bSh <= firstNeededHour;
        if (aCanCoverFirst && !bCanCoverFirst) return -1;
        if (!aCanCoverFirst && bCanCoverFirst) return 1;
      }

      // 2. 開始時刻が早い順を優先（朝枠を確実に巻き込んで孤立を防止）
      if (aSh !== bSh) return aSh - bSh;

      // 3. 出勤日数が少ないスタッフ（未配置0日・1日）を最優先にして過密を防止！
      const daysA = userAssignedDatesMap.get(a.user_id)?.size || 0;
      const daysB = userAssignedDatesMap.get(b.user_id)?.size || 0;
      if (daysA !== daysB) return daysA - daysB;

      // 4. モード別基準
      if (mode === 'veteran') {
        const dateA = empA?.hire_date ? new Date(empA.hire_date).getTime() : 0;
        const dateB = empB?.hire_date ? new Date(empB.hire_date).getTime() : 0;
        return dateA - dateB;
      } else if (mode === 'priority') {
        const scoreA = empA?.priority_score ?? 3;
        const scoreB = empB?.priority_score ?? 3;
        return scoreB - scoreA;
      } else {
        const minutesA = userTotalMinutesMap.get(a.user_id) || 0;
        const minutesB = userTotalMinutesMap.get(b.user_id) || 0;
        if (minutesA !== minutesB) return minutesA - minutesB;
        return (empB?.priority_score ?? 3) - (empA?.priority_score ?? 3);
      }
    });

    // =========================================================================
    // 【第1巡：メインマッチング（朝枠優先＆まとまった時間マッチング）】
    // 最低勤務時間以上のまとまった連続不足ブロックに、希望時間を削ってアサイン
    // =========================================================================
    for (const req of candidateRequests) {
      if (!req.available_start_time || !req.available_end_time) continue;
      if (isAssignedToday(req.user_id)) continue;

      const currentDays = userAssignedDatesMap.get(req.user_id)?.size || 0;
      const maxDays = Math.min(empMap.get(req.user_id)?.max_days_per_week ?? 5, 6);
      if (currentDays >= maxDays) continue;

      const [availSh, availSm] = req.available_start_time.split(':').map(Number);
      const [availEh, availEm] = req.available_end_time.split(':').map(Number);
      const reqStartHour = availSh;
      const reqEndHour = availEm > 0 ? availEh : availEh - 1;

      // 希望時間内の連続不足ブロックを探索
      const blocks = findShortageBlocks(reqStartHour, reqEndHour, neededSlots);
      if (blocks.length === 0) continue;

      const requiredMinHours = empMap.get(req.user_id)?.min_shift_hours ?? 3;
      // 最低勤務時間を満たすブロックを探す
      const validBlock = blocks.find(b => b.duration >= requiredMinHours);
      if (!validBlock) continue;

      // 店舗の不足枠に合わせて希望時間を削る（トリミング）
      const startH = validBlock.startHour;
      const endH = validBlock.endHour;

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
      if (!userAssignedDatesMap.has(req.user_id)) {
        userAssignedDatesMap.set(req.user_id, new Set());
      }
      userAssignedDatesMap.get(req.user_id)!.add(targetDateStr);
      const shiftMinutes = (endH - startH) * 60;
      userTotalMinutesMap.set(req.user_id, (userTotalMinutesMap.get(req.user_id) || 0) + shiftMinutes);

      // 割り当てたスロットを消費
      for (let h = startH; h < endH && h < 24; h++) {
        if (neededSlots[h] > 0) neededSlots[h]--;
      }
    }

    // =========================================================================
    // 【第2巡：隙間バスター（店長思考・端数枠穴埋めトリミング）】
    // 最低勤務時間を緩和するが、★絶対に2時間未満（1時間など）は作成しない！★
    // =========================================================================
    const hasRemainingShortage = neededSlots.some(count => count > 0);
    if (hasRemainingShortage) {
      for (const req of candidateRequests) {
        if (!req.available_start_time || !req.available_end_time) continue;
        if (isAssignedToday(req.user_id)) continue;

        const currentDays = userAssignedDatesMap.get(req.user_id)?.size || 0;
        const maxDays = Math.min(empMap.get(req.user_id)?.max_days_per_week ?? 5, 6);
        if (currentDays >= maxDays) continue;

        const [availSh, availSm] = req.available_start_time.split(':').map(Number);
        const [availEh, availEm] = req.available_end_time.split(':').map(Number);
        const reqStartHour = availSh;
        const reqEndHour = availEm > 0 ? availEh : availEh - 1;

        // 不足ブロックを再探索
        const blocks = findShortageBlocks(reqStartHour, reqEndHour, neededSlots);
        if (blocks.length === 0) continue;

        // ★重要：最低2時間以上のみ許可！1時間だけの極小シフトは絶対に作らない
        const validBlock = blocks.find(b => b.duration >= 2);
        if (!validBlock) continue;

        const startH = validBlock.startHour;
        const endH = validBlock.endHour;

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
        if (!userAssignedDatesMap.has(req.user_id)) {
          userAssignedDatesMap.set(req.user_id, new Set());
        }
        userAssignedDatesMap.get(req.user_id)!.add(targetDateStr);
        const shiftMinutes = (endH - startH) * 60;
        userTotalMinutesMap.set(req.user_id, (userTotalMinutesMap.get(req.user_id) || 0) + shiftMinutes);

        // 枠を消費
        for (let h = startH; h < endH && h < 24; h++) {
          if (neededSlots[h] > 0) neededSlots[h]--;
        }

        // すべての不足枠が埋まったら第2巡終了
        if (!neededSlots.some(count => count > 0)) {
          break;
        }
      }
    }

    // =========================================================================
    // 【第3巡：シフト延長スマートマージ（1時間の孤立枠の吸収・合体）】
    // 1時間だけの不足が残っている場合、別人を1時間呼ぶのではなく、
    // 既に配置された隣接シフト（10:00〜等）を前後に延長して1時間枠を吸収！
    // =========================================================================
    const reqMap = new Map(dayRequests.map(r => [r.user_id, r]));

    for (let h = 0; h < 24; h++) {
      while (neededSlots[h] > 0) {
        // 前倒し延長：h+1 から始まる本日このロールの生成シフトを探す
        const adjacentShift = generatedShifts.find(s => {
          if (s.role !== role || s.target_date !== targetDateStr || !s.start_time) return false;
          const startH = parseInt(s.start_time.split(':')[0], 10);
          return startH === h + 1;
        });

        if (!adjacentShift) break;

        const empReq = reqMap.get(adjacentShift.user_id!);
        if (!empReq || !empReq.available_start_time) break;

        const [reqSh] = empReq.available_start_time.split(':').map(Number);
        if (reqSh > h) {
          // このスタッフは h 時から勤務できない
          break;
        }

        // 前倒し延長実行！開始時刻を h に更新
        const newStartStr = `${h.toString().padStart(2, '0')}:00`;
        adjacentShift.start_time = newStartStr;
        neededSlots[h]--;
      }
    }
  }

  return generatedShifts;
}

export interface RebalanceSwapLog {
  shiftId: string;
  targetDate: string;
  timeRange: string;
  role: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
}

export interface RebalanceResult {
  updatedShifts: { id: string; user_id: string }[];
  swapLogs: RebalanceSwapLog[];
  unassignedRemaining: number;
}

/**
 * 稼働平準化（シフト・リバランサー）
 * 多すぎる（過密な）スタッフのドラフトシフトから、未配置（または少なすぎる）スタッフへ安全にシフトをバトンタッチ
 */
export function rebalanceDraftShifts(
  allPeriodShifts: AdvancedShift[],
  rawRequests: ShiftRequest[],
  users: { id: string; name: string }[],
  employeeSettings: ShiftEmployeeSetting[] = []
): RebalanceResult {
  const updatedShifts: { id: string; user_id: string }[] = [];
  const swapLogs: RebalanceSwapLog[] = [];
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const empMap = new Map(employeeSettings.map(e => [e.user_id, e]));

  // ドラフトシフトのコピー（変更追跡用）
  const shiftsCopy = allPeriodShifts.map(s => ({ ...s }));

  // 各スタッフの現在の稼働日数を集計するヘルパー関数
  const getAssignedDaysMap = () => {
    const map = new Map<string, number>();
    users.forEach(u => map.set(u.id, 0));
    
    // 日付ユニークで集計
    const userDatesMap = new Map<string, Set<string>>();
    shiftsCopy.forEach(s => {
      if (!userDatesMap.has(s.user_id)) userDatesMap.set(s.user_id, new Set());
      userDatesMap.get(s.user_id)!.add(s.target_date);
    });
    userDatesMap.forEach((dates, uid) => {
      map.set(uid, dates.size);
    });
    return map;
  };

  let daysMap = getAssignedDaysMap();

  // 1. 未配置スタッフ（希望を出しているのに0日）を抽出
  const unassignedReceivers = users.filter(u => {
    const hasValidReq = rawRequests.some(r => r.user_id === u.id && r.available_start_time && r.available_end_time);
    return hasValidReq && (daysMap.get(u.id) || 0) === 0;
  });

  // 未配置スタッフへの救済譲渡ループ
  for (const receiver of unassignedReceivers) {
    const receiverReqs = rawRequests.filter(r => 
      r.user_id === receiver.id && r.available_start_time && r.available_end_time
    );

    for (const req of receiverReqs) {
      if ((daysMap.get(receiver.id) || 0) >= 2) break; // 2日確保できたら一旦OK

      // その日（req.target_date）にすでにレシーバーがシフトに入っていないか確認
      const receiverAlreadyAssignedToday = shiftsCopy.some(s => s.user_id === receiver.id && s.target_date === req.target_date);
      if (receiverAlreadyAssignedToday) continue;

      // その日のドラフトシフトの中で、最も稼働日数が多いドナー（4日以上）を探す
      const dayDraftShifts = shiftsCopy.filter(s => 
        s.target_date === req.target_date && 
        s.status === 'draft' && 
        s.user_id !== receiver.id
      );

      // ドナーの日数が多い順にソート
      dayDraftShifts.sort((a, b) => (daysMap.get(b.user_id) || 0) - (daysMap.get(a.user_id) || 0));

      for (const targetShift of dayDraftShifts) {
        if (!targetShift.id) continue;
        const donorId = targetShift.user_id;
        const donorDays = daysMap.get(donorId) || 0;
        const receiverDays = daysMap.get(receiver.id) || 0;

        // ドナーがレシーバーより2日以上多く持っている場合のみ譲渡可能（逆転防止）
        if (donorDays <= receiverDays + 1) continue;

        // 役割適合性チェック
        const emp = empMap.get(receiver.id);
        let roleAllowed = true;
        if (emp) {
          if (emp.default_role && emp.default_role !== targetShift.role) {
            if (emp.roles) {
              const rolesList = Array.isArray(emp.roles) ? emp.roles : [emp.roles];
              if (!rolesList.includes(targetShift.role)) roleAllowed = false;
            } else {
              roleAllowed = false;
            }
          }
        }
        if (req.preferred_role && req.preferred_role !== targetShift.role) roleAllowed = false;
        if (!roleAllowed) continue;

        // 時間適合性チェック（希望時間内にシフトが収まっているか）
        const [reqSh, reqSm = 0] = req.available_start_time!.split(':').map(Number);
        const [reqEh, reqEm = 0] = req.available_end_time!.split(':').map(Number);
        const [shiftSh, shiftSm = 0] = targetShift.start_time.split(':').map(Number);
        const [shiftEh, shiftEm = 0] = targetShift.end_time.split(':').map(Number);

        const reqStartMin = reqSh * 60 + reqSm;
        const reqEndMin = reqEh * 60 + reqEm;
        const shiftStartMin = shiftSh * 60 + shiftSm;
        const shiftEndMin = shiftEh * 60 + shiftEm;

        if (shiftStartMin >= reqStartMin && shiftEndMin <= reqEndMin) {
          // バトンタッチ実行！
          const donorName = userMap.get(donorId) || '不明';
          targetShift.user_id = receiver.id;

          updatedShifts.push({ id: targetShift.id, user_id: receiver.id });
          swapLogs.push({
            shiftId: targetShift.id,
            targetDate: targetShift.target_date,
            timeRange: `${targetShift.start_time.substring(0, 5)}〜${targetShift.end_time.substring(0, 5)}`,
            role: targetShift.role,
            fromUserId: donorId,
            fromUserName: donorName,
            toUserId: receiver.id,
            toUserName: receiver.name
          });

          daysMap = getAssignedDaysMap();
          break; // この希望日のマッチング完了
        }
      }
    }
  }

  // 2. さらに偏りが大きい場合（5日以上の過密スタッフから、1〜2日の少なめスタッフへ平準化）
  const allReceivers = users.filter(u => {
    const hasValidReq = rawRequests.some(r => r.user_id === u.id && r.available_start_time && r.available_end_time);
    return hasValidReq && (daysMap.get(u.id) || 0) <= 2;
  });

  for (const receiver of allReceivers) {
    if ((daysMap.get(receiver.id) || 0) >= 3) continue;

    const receiverReqs = rawRequests.filter(r => 
      r.user_id === receiver.id && r.available_start_time && r.available_end_time
    );

    for (const req of receiverReqs) {
      if ((daysMap.get(receiver.id) || 0) >= 3) break;

      const receiverAlreadyAssignedToday = shiftsCopy.some(s => s.user_id === receiver.id && s.target_date === req.target_date);
      if (receiverAlreadyAssignedToday) continue;

      const dayDraftShifts = shiftsCopy.filter(s => 
        s.target_date === req.target_date && 
        s.status === 'draft' && 
        s.user_id !== receiver.id &&
        (daysMap.get(s.user_id) || 0) >= 5 // 5日以上の過密スタッフのみ対象
      );

      dayDraftShifts.sort((a, b) => (daysMap.get(b.user_id) || 0) - (daysMap.get(a.user_id) || 0));

      for (const targetShift of dayDraftShifts) {
        if (!targetShift.id) continue;
        const donorId = targetShift.user_id;
        const donorDays = daysMap.get(donorId) || 0;
        const receiverDays = daysMap.get(receiver.id) || 0;

        if (donorDays <= receiverDays + 2) continue;

        // 時間適合性チェック
        const [reqSh, reqSm = 0] = req.available_start_time!.split(':').map(Number);
        const [reqEh, reqEm = 0] = req.available_end_time!.split(':').map(Number);
        const [shiftSh, shiftSm = 0] = targetShift.start_time.split(':').map(Number);
        const [shiftEh, shiftEm = 0] = targetShift.end_time.split(':').map(Number);

        const reqStartMin = reqSh * 60 + reqSm;
        const reqEndMin = reqEh * 60 + reqEm;
        const shiftStartMin = shiftSh * 60 + shiftSm;
        const shiftEndMin = shiftEh * 60 + shiftEm;

        if (shiftStartMin >= reqStartMin && shiftEndMin <= reqEndMin) {
          const donorName = userMap.get(donorId) || '不明';
          targetShift.user_id = receiver.id;

          updatedShifts.push({ id: targetShift.id, user_id: receiver.id });
          swapLogs.push({
            shiftId: targetShift.id,
            targetDate: targetShift.target_date,
            timeRange: `${targetShift.start_time.substring(0, 5)}〜${targetShift.end_time.substring(0, 5)}`,
            role: targetShift.role,
            fromUserId: donorId,
            fromUserName: donorName,
            toUserId: receiver.id,
            toUserName: receiver.name
          });

          daysMap = getAssignedDaysMap();
          break;
        }
      }
    }
  }

  // 残存未配置数
  const unassignedRemaining = users.filter(u => {
    const hasValidReq = rawRequests.some(r => r.user_id === u.id && r.available_start_time && r.available_end_time);
    return hasValidReq && (daysMap.get(u.id) || 0) === 0;
  }).length;

  return {
    updatedShifts,
    swapLogs,
    unassignedRemaining
  };
}



