// 国税庁公式PDF（2026bun_01.pdf）原本マス目の完全較正座標テーブル
export const TAX_DOC_2026_COORDINATES = {
  // ① ヘッダー枠（給与支払者・申告者本人）
  header: {
    taxOffice: { x: 0.088, y: 0.105 },       // 所轄税務署（千代田）
    municipality: { x: 0.080, y: 0.155 },    // 市区町村長（千代田区）
    
    companyName: { x: 0.235, y: 0.098 },     // 給与の支払者の名称
    corporateNumber: { x: 0.235, y: 0.126 }, // 法人番号
    companyAddress: { x: 0.235, y: 0.155 },  // 所在地

    empKana: { x: 0.440, y: 0.088 },         // （フリガナ）
    empName: { x: 0.440, y: 0.108 },         // あなたの氏名
    empMyNumberStart: { x: 0.432, y: 0.138, pitch: 0.0168 }, // あなたの個人番号（12桁マス目）
    empPostal: { x: 0.485, y: 0.155 },       // 郵便番号
    empAddress: { x: 0.432, y: 0.168 },      // 住所本体

    empBirthEra: { x: 0.655, y: 0.088 },     // 元号（令・平・昭）
    empBirthY: { x: 0.680, y: 0.088 },       // 年
    empBirthM: { x: 0.728, y: 0.088 },       // 月
    empBirthD: { x: 0.758, y: 0.088 },       // 日
    householderName: { x: 0.675, y: 0.112 }, // 世帯主の氏名
    householderRel: { x: 0.675, y: 0.138 },  // あなたとの続柄
    hasSpouseYes: { x: 0.742, y: 0.165 },    // 配偶者 有（○印）
    hasSpouseNo: { x: 0.772, y: 0.165 }      // 配偶者 無（○印）
  },

  // ② Ａ. 源泉控除対象配偶者（1行のみ）
  spouse: {
    kana: { x: 0.165, y: 0.232 },
    name: { x: 0.165, y: 0.248 },
    myNumberStart: { x: 0.265, y: 0.248, pitch: 0.0098 },
    relation: { x: 0.345, y: 0.248 },
    birthY: { x: 0.405, y: 0.248 },
    birthM: { x: 0.432, y: 0.248 },
    birthD: { x: 0.458, y: 0.248 },
    income: { x: 0.535, y: 0.248 }, // 右寄せ
    livingFact: { x: 0.585, y: 0.248 },
    address: { x: 0.640, y: 0.248 }
  },

  // ③ Ｂ. 控除対象扶養親族（16歳以上） 4行
  dependents: [
    { kanaY: 0.272, rowY: 0.285, elderlyCheckY: 0.278, specificCheckY: 0.292 },
    { kanaY: 0.307, rowY: 0.320, elderlyCheckY: 0.313, specificCheckY: 0.327 },
    { kanaY: 0.342, rowY: 0.355, elderlyCheckY: 0.348, specificCheckY: 0.362 },
    { kanaY: 0.377, rowY: 0.390, elderlyCheckY: 0.383, specificCheckY: 0.397 }
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
    checkDisabled: { x: 0.122, y: 0.425 },
    checkWidow: { x: 0.315, y: 0.425 },
    checkSingleParent: { x: 0.350, y: 0.425 },
    checkWorkingStudent: { x: 0.392, y: 0.425 },
    details: { x: 0.465, y: 0.428 }
  },

  // ⑤ 住民税に関する事項（16歳未満の年少扶養親族 2行）
  u16: [
    { kanaY: 0.570, rowY: 0.585 },
    { kanaY: 0.605, rowY: 0.620 }
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
