// 国税庁公式PDF（2026bun_01.pdf）原本マス目の完全較正座標テーブル（黄金比精密版）
export const TAX_DOC_2026_COORDINATES = {
  // ① ヘッダー枠（給与支払者・申告者本人）
  header: {
    taxOffice: { x: 0.088, y: 0.098 },       // 所轄税務署（千代田）
    municipality: { x: 0.078, y: 0.138 },    // 市区町村長（千代田区）
    
    companyName: { x: 0.235, y: 0.088 },     // 給与の支払者の名称（1段目）
    corporateNumber: { x: 0.235, y: 0.114 }, // 法人番号（2段目）
    companyAddress: { x: 0.235, y: 0.142 },  // 所在地（3段目）

    empKana: { x: 0.440, y: 0.075 },         // （フリガナ）
    empName: { x: 0.440, y: 0.095 },         // あなたの氏名
    empMyNumberStart: { x: 0.428, y: 0.123, pitch: 0.0182 }, // あなたの個人番号（12桁マス目）
    empPostal: { x: 0.505, y: 0.140 },       // 郵便番号
    empAddress: { x: 0.425, y: 0.152 },      // 住所本体

    empBirthEra: { x: 0.652, y: 0.075 },     // 元号（令・平・昭）
    empBirthY: { x: 0.682, y: 0.075 },       // 年
    empBirthM: { x: 0.725, y: 0.075 },       // 月
    empBirthD: { x: 0.755, y: 0.075 },       // 日
    householderName: { x: 0.675, y: 0.098 }, // 世帯主の氏名
    householderRel: { x: 0.675, y: 0.122 },  // あなたとの続柄
    hasSpouseYes: { x: 0.742, y: 0.148 },    // 配偶者 有（○印）
    hasSpouseNo: { x: 0.768, y: 0.148 }      // 配偶者 無（○印）
  },

  // ② Ａ. 源泉控除対象配偶者（1行のみ）
  spouse: {
    kana: { x: 0.165, y: 0.208 },
    name: { x: 0.165, y: 0.222 },
    myNumberStart: { x: 0.265, y: 0.222, pitch: 0.0098 },
    relation: { x: 0.345, y: 0.222 },
    birthY: { x: 0.405, y: 0.222 },
    birthM: { x: 0.432, y: 0.222 },
    birthD: { x: 0.458, y: 0.222 },
    income: { x: 0.535, y: 0.222 }, // 右寄せ
    livingFact: { x: 0.585, y: 0.222 },
    address: { x: 0.640, y: 0.222 }
  },

  // ③ Ｂ. 控除対象扶養親族（16歳以上） 4行
  dependents: [
    { kanaY: 0.242, rowY: 0.256, elderlyCheckY: 0.250, specificCheckY: 0.264 },
    { kanaY: 0.278, rowY: 0.292, elderlyCheckY: 0.286, specificCheckY: 0.300 },
    { kanaY: 0.314, rowY: 0.328, elderlyCheckY: 0.322, specificCheckY: 0.336 },
    { kanaY: 0.350, rowY: 0.364, elderlyCheckY: 0.358, specificCheckY: 0.372 }
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
    checkDisabled: { x: 0.122, y: 0.388 },
    checkWidow: { x: 0.315, y: 0.388 },
    checkSingleParent: { x: 0.350, y: 0.388 },
    checkWorkingStudent: { x: 0.392, y: 0.388 },
    details: { x: 0.465, y: 0.392 }
  },

  // ⑤ 住民税に関する事項（16歳未満の年少扶養親族 2行）
  u16: [
    { kanaY: 0.525, rowY: 0.538 },
    { kanaY: 0.560, rowY: 0.573 }
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
