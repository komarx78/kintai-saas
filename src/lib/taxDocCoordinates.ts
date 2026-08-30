// PDF原本マス目の正確な比率テーブル（完全較正版）
export const TAX_DOC_2026_COORDINATES = {
  // ① ヘッダー枠（給与支払者・申告者本人）
  header: {
    taxOffice: { x: 0.095, y: 0.125 },       // 所轄税務署（千代田）
    municipality: { x: 0.088, y: 0.180 },    // 市区町村長（千代田区）
    
    companyName: { x: 0.235, y: 0.128 },     // 給与の支払者の名称
    corporateNumber: { x: 0.235, y: 0.158 }, // 法人番号
    companyAddress: { x: 0.235, y: 0.188 },  // 所在地

    empKana: { x: 0.440, y: 0.112 },         // （フリガナ）
    empName: { x: 0.440, y: 0.138 },         // あなたの氏名
    empMyNumberStart: { x: 0.432, y: 0.165, pitch: 0.0168 }, // あなたの個人番号（12桁マス目）
    empPostal: { x: 0.485, y: 0.188 },       // 郵便番号
    empAddress: { x: 0.432, y: 0.200 },      // 住所本体

    empBirthEra: { x: 0.655, y: 0.115 },     // 元号（令・平・昭）
    empBirthY: { x: 0.680, y: 0.115 },       // 年
    empBirthM: { x: 0.728, y: 0.115 },       // 月
    empBirthD: { x: 0.758, y: 0.115 },       // 日
    householderName: { x: 0.675, y: 0.142 }, // 世帯主の氏名
    householderRel: { x: 0.675, y: 0.168 },  // あなたとの続柄
    hasSpouseYes: { x: 0.742, y: 0.198 },    // 配偶者 有（○印）
    hasSpouseNo: { x: 0.772, y: 0.198 }      // 配偶者 無（○印）
  },

  // ② Ａ. 源泉控除対象配偶者（1行のみ）
  spouse: {
    kana: { x: 0.165, y: 0.280 },
    name: { x: 0.165, y: 0.298 },
    myNumberStart: { x: 0.265, y: 0.292, pitch: 0.0098 },
    relation: { x: 0.345, y: 0.292 },
    birthY: { x: 0.405, y: 0.292 },
    birthM: { x: 0.432, y: 0.292 },
    birthD: { x: 0.458, y: 0.292 },
    income: { x: 0.535, y: 0.292 }, // 右寄せ
    livingFact: { x: 0.585, y: 0.292 },
    address: { x: 0.640, y: 0.292 }
  },

  // ③ Ｂ. 控除対象扶養親族（16歳以上） 4行
  dependents: [
    { kanaY: 0.320, rowY: 0.338, elderlyCheckY: 0.330, specificCheckY: 0.348 },
    { kanaY: 0.360, rowY: 0.378, elderlyCheckY: 0.370, specificCheckY: 0.388 },
    { kanaY: 0.400, rowY: 0.418, elderlyCheckY: 0.410, specificCheckY: 0.428 },
    { kanaY: 0.440, rowY: 0.458, elderlyCheckY: 0.450, specificCheckY: 0.468 }
  ],
  depCols: {
    kanaX: 0.165,
    nameX: 0.165,
    myNumStartX: 0.265,
    myNumPitch: 0.0098,
    relationX: 0.345,
    birthYX: 0.405,
    birthMX: 0.432,
    birthDX: 0.458,
    checkX: 0.470,
    incomeX: 0.535,
    livingFactX: 0.585,
    addressX: 0.640
  },

  // ④ Ｃ. 障害者、寡婦、ひとり親又は勤労学生
  special: {
    checkDisabled: { x: 0.122, y: 0.492 },
    checkWidow: { x: 0.315, y: 0.492 },
    checkSingleParent: { x: 0.350, y: 0.492 },
    checkWorkingStudent: { x: 0.392, y: 0.492 },
    details: { x: 0.465, y: 0.495 }
  },

  // ⑤ 住民税に関する事項（16歳未満の年少扶養親族 2行）
  u16: [
    { kanaY: 0.640, rowY: 0.658 },
    { kanaY: 0.678, rowY: 0.696 }
  ],
  u16Cols: {
    kanaX: 0.165,
    nameX: 0.165,
    myNumStartX: 0.275,
    myNumPitch: 0.0098,
    relationX: 0.385,
    birthYX: 0.425,
    birthMX: 0.448,
    birthDX: 0.472,
    addressX: 0.530,
    incomeX: 0.745
  }
};
