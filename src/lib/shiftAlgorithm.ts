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
  existingShifts: AdvancedShift[], // eslint-disable-line
  employeeSettings: ShiftEmployeeSetting[],
  targetDateStr: string,
  targetDayOfWeek: number,
  mode: string 
): Partial<AdvancedShift>[] {
  const generatedShifts: Partial<AdvancedShift>[] = [];
  
  // Create a mutable copy of requirements that we can split
  const dayReqs = requirements
    .filter(r => r.day_of_week === targetDayOfWeek || r.target_date === targetDateStr)
    .map(r => ({ ...r }));

  const dayRequests = requests.filter(r => r.target_date === targetDateStr);
  // console.log(existingShifts.length); // use it ...

  const empMap = new Map(employeeSettings.map(e => [e.user_id, e]));

  dayRequests.sort((a, b) => {
    const empA = empMap.get(a.user_id);
    const empB = empMap.get(b.user_id);
    
    if (!empA && !empB) return 0;
    if (!empA) return 1;
    if (!empB) return -1;

    if (mode === 'veteran') {
      const dateA = empA.hire_date ? new Date(empA.hire_date).getTime() : Date.now();
      const dateB = empB.hire_date ? new Date(empB.hire_date).getTime() : Date.now();
      if (dateA !== dateB) return dateA - dateB;
    } else if (mode === 'priority') {
      if (empA.priority_score !== empB.priority_score) {
        return empB.priority_score - empA.priority_score;
      }
    } else {
      return Math.random() - 0.5; 
    }
    return 0;
  });

  // Process requirements. We use a while loop because we might push split requirements to the end of the array.
  let reqIndex = 0;
  while (reqIndex < dayReqs.length) {
    const req = dayReqs[reqIndex];
    reqIndex++;

    const reqStartStr = req.start_time.substring(0,5);
    const reqEndStr = req.end_time.substring(0,5);
    
    let needed = req.required_count;
    if (needed <= 0) continue;

    for (const userReq of dayRequests) {
      if (needed <= 0) break;
      
      if (!userReq.available_start_time || !userReq.available_end_time) continue;

      const isAlreadyAssigned = generatedShifts.some(s => s.user_id === userReq.user_id) || existingShifts.some(s => s.user_id === userReq.user_id && s.target_date === targetDateStr);
      if (isAlreadyAssigned) continue;

      const empSet = empMap.get(userReq.user_id);
      if (empSet && empSet.default_role && empSet.default_role !== req.role) {
        continue;
      }

      const reqStartMins = parseInt(reqStartStr.split(':')[0]) * 60 + parseInt(reqStartStr.split(':')[1]);
      const reqEndMins = parseInt(reqEndStr.split(':')[0]) * 60 + parseInt(reqEndStr.split(':')[1]);
      
      const availStartStr = userReq.available_start_time.substring(0,5);
      const availEndStr = userReq.available_end_time.substring(0,5);
      const availStartMins = parseInt(availStartStr.split(':')[0]) * 60 + parseInt(availStartStr.split(':')[1]);
      const availEndMins = parseInt(availEndStr.split(':')[0]) * 60 + parseInt(availEndStr.split(':')[1]);

      const overlapStart = Math.max(reqStartMins, availStartMins);
      const overlapEnd = Math.min(reqEndMins, availEndMins);

      // Only assign if they overlap by at least 1 hour (60 mins) to prevent weird 10-minute shifts
      if (overlapStart < overlapEnd && (overlapEnd - overlapStart) >= 60) {
        const finalStartStr = `${Math.floor(overlapStart / 60).toString().padStart(2, '0')}:${(overlapStart % 60).toString().padStart(2, '0')}`;
        const finalEndStr = `${Math.floor(overlapEnd / 60).toString().padStart(2, '0')}:${(overlapEnd % 60).toString().padStart(2, '0')}`;
        
        generatedShifts.push({
          user_id: userReq.user_id,
          target_date: targetDateStr,
          start_time: finalStartStr,
          end_time: finalEndStr,
          role: req.role,
          status: 'confirmed'
        });
        needed--;

        // If the requirement wasn't completely filled, split the remaining times into new requirements!
        if (overlapStart > reqStartMins) {
          dayReqs.push({
            ...req,
            start_time: reqStartStr,
            end_time: finalStartStr,
            required_count: 1 // Only 1 count was fulfilled by this person, so we only split 1 count off
          });
        }
        if (overlapEnd < reqEndMins) {
          dayReqs.push({
            ...req,
            start_time: finalEndStr,
            end_time: reqEndStr,
            required_count: 1
          });
        }
        
        // If there were MORE required counts (e.g. needed 2 people for 9-18), we still need 1 more person for the WHOLE 9-18 period!
        if (req.required_count > 1) {
            dayReqs.push({
                ...req,
                required_count: req.required_count - 1
            });
        }
      }
    }
  }

  return generatedShifts;
}


