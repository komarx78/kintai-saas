import React, { useMemo, useState, useEffect } from 'react';
import { 
  loadBonusDocCoordinates, 
  fetchBonusDocCoordinatesFromDb, 
  BONUS_COORDS_UPDATE_EVENT, 
  type BonusDocFieldConfig 
} from '../lib/bonusDocCoordinates';
import { BonusDocMasterInspector } from './BonusDocMasterInspector';

export interface BonusReportEmployee {
  id: string;
  insuranceNumber?: string; // ① 被保険者整理番号
  name: string; // ② 被保険者氏名
  nameKana?: string;
  birthDate?: string; // ③ 生年月日 ('1988-05-03' 等)
  individualPaymentDate?: string; // ④ 個別支払日（共通と異なる場合のみ）
  currencyAmount: number; // ⑤ ㋐(通貨)
  goodsAmount?: number; // ⑤ ㋑(現物)
  myNumber?: string; // ⑦ 個人番号［基礎年金番号］（70歳以上被用者時）
  isOver70?: boolean; // ⑧ 備考 1. 70歳以上被用者
  isDualWork?: boolean; // ⑧ 備考 2. 二以上勤務
  isMonthlyMerged?: boolean; // ⑧ 備考 3. 同一月内の賞与合算
  firstPaymentDay?: number | string; // 初回支払日
}

export interface BonusPaymentReportDocProps {
  data: {
    submissionDate?: string; // 提出年月日 ('2026-07-10' 等)
    // 提出者（事業所）情報
    officeSymbol?: string; // 事業所整理記号 (例: '01-イロハ')
    officeCityCode?: string; // 2桁
    officeSymbolKana?: string; // カタカナ
    companyAddress?: string; // 事業所所在地
    companyName?: string; // 事業所名称
    companyOwnerName?: string; // 事業主氏名
    companyPhone?: string; // 電話番号
    checkedMyNumberAccuracy?: boolean; // 届書記入の個人番号に誤りがないことを確認しました

    // 社会保険労務士記載欄
    sharoushiName?: string;

    // 共通賞与支払日
    commonPaymentDate: string; // '2026-06-30' 等

    // 対象被保険者リスト（何名でも可、自動で10名ずつページ分割）
    employees: BonusReportEmployee[];
  };
  canEditCoordinates?: boolean; // 会社管理者・マスタ設定画面からのみ編集許可（軍律第23条 権限分離）
}

/**
 * 生年月日を年金機構公式元号コード（元号数字-YYMMDD）に変換
 * 元号: 1.明治 3.大正 5.昭和 7.平成 9.令和
 * 例: 1988-05-03 (昭和63年5月3日) -> '5-630503'
 * 例: 1993-10-20 (平成5年10月20日) -> '7-051020'
 * 例: 2020-01-15 (令和2年1月15日) -> '9-020115'
 */
export const formatNenkinBirthDate = (birthDateStr?: string): string => {
  if (!birthDateStr) return '';
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return birthDateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return birthDateStr;

  const pad = (n: number) => String(n).padStart(2, '0');
  const mmdd = `${pad(m)}${pad(d)}`;

  if (y >= 2019) {
    const eraY = y - 2018;
    return `9-${pad(eraY)}${mmdd}`;
  } else if (y >= 1989) {
    const eraY = y - 1988;
    return `7-${pad(eraY)}${mmdd}`;
  } else if (y >= 1926) {
    const eraY = y - 1925;
    return `5-${pad(eraY)}${mmdd}`;
  } else if (y >= 1912) {
    const eraY = y - 1911;
    return `3-${pad(eraY)}${mmdd}`;
  } else {
    const eraY = y - 1867;
    return `1-${pad(eraY)}${mmdd}`;
  }
};

/**
 * 支払日時点で満70歳以上かどうかを判定
 */
export const checkIfOver70 = (birthDateStr?: string, paymentDateStr?: string): boolean => {
  if (!birthDateStr || !paymentDateStr) return false;
  const birth = new Date(birthDateStr);
  const pay = new Date(paymentDateStr);
  if (isNaN(birth.getTime()) || isNaN(pay.getTime())) return false;

  let age = pay.getFullYear() - birth.getFullYear();
  const mDiff = pay.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && pay.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 70;
};

/**
 * 日付から元号・年・月・日を分解（提出日・支払日用）
 */
const parseDateElements = (dateStr?: string) => {
  if (!dateStr) return { eraName: '令和', eraNum: '9', y: '', m: '', d: '' };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { eraName: '令和', eraNum: '9', y: '', m: '', d: '' };
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (y >= 2019) {
    return { eraName: '令和', eraNum: '9', y: String(y - 2018), m: String(m), d: String(d) };
  } else if (y >= 1989) {
    return { eraName: '平成', eraNum: '7', y: String(y - 1988), m: String(m), d: String(d) };
  } else {
    return { eraName: '昭和', eraNum: '5', y: String(y - 1925), m: String(m), d: String(d) };
  }
};

/**
 * 🏆 日本年金機構 公式PDF原本完全一致オーバーレイレンダラー
 * いただいた公式原本PDF（コード2265用紙）を下敷きにし、その枠内にピクセルパーフェクトで印字
 */
const ExactPdfPageRenderer: React.FC<{
  pageEmployees: (BonusReportEmployee | null)[];
  pageIndex: number;
  totalPages: number;
  data: BonusPaymentReportDocProps['data'];
  submissionDateParsed: { eraName: string; eraNum: string; y: string; m: string; d: string };
  commonDateParsed: { eraName: string; eraNum: string; y: string; m: string; d: string };
  symbolDigits: string;
  symbolKana: string;
  coordsMap: Map<string, BonusDocFieldConfig>;
}> = ({
  pageEmployees,
  pageIndex,
  totalPages,
  data,
  submissionDateParsed,
  commonDateParsed,
  symbolDigits,
  symbolKana,
  coordsMap
}) => {
  // 🎯 親から渡された最新のマスタ座標マップ（インスペクターの変更がミリ秒単位で即時反映）
  const getF = (id: string, defX: number, defY: number, defSize: number, defWidth?: number) => {
    const item = coordsMap.get(id);
    return {
      x: item?.x !== undefined ? item.x : defX,
      y: item?.y !== undefined ? item.y : defY,
      fontSize: item?.fontSize !== undefined ? item.fontSize : defSize,
      pitch: item?.pitch,
      width: item?.width !== undefined ? item.width : defWidth
    };
  };

  const fSubY = getF('subDateY', 5.2, 4.5, 11, 2.4);
  const fSubM = getF('subDateM', 10.0, 4.5, 11, 3.0);
  const fSubD = getF('subDateD', 15.6, 4.5, 11, 4.0);

  const fDigits = getF('symbolDigits', 10.00, 6.16, 14, 5.16);
  const fKana = getF('symbolKana', 17.42, 6.16, 13, 9.68);

  const fAddress = getF('companyAddress', 11.0, 12.0, 9, 38.0);
  const fName = getF('companyName', 11.0, 18.0, 11, 38.0);
  const fOwner = getF('companyOwnerName', 11.0, 21.8, 11, 38.0);
  const fPhone = getF('companyPhone', 19.0, 24.6, 10, 24.0);
  const fSharoushi = getF('sharoushiName', 54.5, 22.5, 11, 38.0);

  const fCommonY = getF('commonDateY', 37.5, 31.3, 12, 5.5);
  const fCommonM = getF('commonDateM', 46.0, 31.3, 12, 5.5);
  const fCommonD = getF('commonDateD', 54.5, 31.3, 12, 5.5);

  const rowBaseTop = coordsMap.get('rowBaseTop')?.y ?? 34.26;
  const rowPitchY = coordsMap.get('rowPitchY')?.y ?? 5.770;

  const fEmpNumber = getF('empInsuranceNumber', 4.8, 0.92, 12, 18.0);
  const fEmpKana = getF('empKana', 23.8, 0.30, 8.5, 31.0);
  const fEmpName = getF('empName', 23.8, 1.30, 12.5, 31.0);
  const fEmpBirth = getF('empBirth', 55.6, 0.90, 12.5, 14.5);
  const fEmpMyNumber = getF('empMyNumber', 70.4, 0.90, 10, 22.8);
  const fEmpPayDate = getF('empIndivPayDate', 4.8, 3.60, 10, 18.0);
  const fEmpCurrency = getF('empCurrencyAmount', 23.8, 3.60, 11.5, 14.6);
  const fEmpGoods = getF('empGoodsAmount', 39.8, 3.60, 11.5, 14.6);
  const fEmpTotal = getF('empTotalThousands', 55.8, 3.60, 11.5, 9.8);

  return (
    <div
      className={`official-bonus-page-container relative bg-white mx-auto shadow-lg print:shadow-none mb-8 select-none ${
        pageIndex < totalPages - 1 ? 'bonus-page-break' : ''
      }`}
      style={{
        width: '100%',
        maxWidth: '850px',
        aspectRatio: '2480 / 3508',
        containerType: 'inline-size',
        position: 'relative'
      }}
    >
      {/* 📄 日本年金機構原本用紙（下敷き原本：画面・印刷共通で100%確実に表示） */}
      <img
        src="/nenkin_bonus_template_page1.png"
        alt="日本年金機構公式届出用紙（コード2265）"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0 print:w-full print:h-full"
        draggable={false}
      />
      {/* 提出年月日（原本「令和」「年」「月」「日提出」の各空欄に中央配置） */}
      <div
        className="absolute font-mono font-bold text-slate-900 text-center flex items-center justify-center z-10"
        style={{ top: `${fSubY.y}%`, left: `${fSubY.x}%`, width: `${fSubY.width}%`, fontSize: `clamp(9px, ${(fSubY.fontSize || 11) * 0.11}cqi, 15px)` }}
      >
        {submissionDateParsed.y}
      </div>
      <div
        className="absolute font-mono font-bold text-slate-900 text-center flex items-center justify-center z-10"
        style={{ top: `${fSubM.y}%`, left: `${fSubM.x}%`, width: `${fSubM.width}%`, fontSize: `clamp(9px, ${(fSubM.fontSize || 11) * 0.11}cqi, 15px)` }}
      >
        {submissionDateParsed.m}
      </div>
      <div
        className="absolute font-mono font-bold text-slate-900 text-center flex items-center justify-center z-10"
        style={{ top: `${fSubD.y}%`, left: `${fSubD.x}%`, width: `${fSubD.width}%`, fontSize: `clamp(9px, ${(fSubD.fontSize || 11) * 0.11}cqi, 15px)` }}
      >
        {submissionDateParsed.d}
      </div>

      {/* 事業所整理記号 (左側2マス: 数字) */}
      {symbolDigits && (
        <div
          className="absolute flex items-center font-mono font-bold text-slate-950 z-10"
          style={{ top: `${fDigits.y}%`, height: '2.93%', left: `${fDigits.x}%` }}
        >
          {symbolDigits.split('').slice(0, 2).map((char, idx) => (
            <span
              key={idx}
              className="inline-flex items-center justify-center font-black text-center"
              style={{ width: `${fDigits.pitch || 2.58}cqi`, height: '100%', fontSize: `clamp(11px, ${(fDigits.fontSize || 14) * 0.12}cqi, 18px)` }}
            >
              {char}
            </span>
          ))}
        </div>
      )}
      {/* 事業所整理記号 (右側4マス: カタカナ、ハイフン枠の右隣から開始) */}
      {symbolKana && (
        <div
          className="absolute flex items-center font-sans font-bold text-slate-950 z-10"
          style={{ top: `${fKana.y}%`, height: '2.93%', left: `${fKana.x}%` }}
        >
          {symbolKana.split('').slice(0, 4).map((char, idx) => {
            const w = fKana.pitch ? `${fKana.pitch}cqi` : '2.42cqi';
            return (
              <span
                key={idx}
                className="inline-flex items-center justify-center font-black text-center"
                style={{ width: w, height: '100%', fontSize: `clamp(10px, ${(fKana.fontSize || 13) * 0.12}cqi, 17px)` }}
              >
                {char}
              </span>
            );
          })}
        </div>
      )}

      {/* 事業所所在地 */}
      <div
        className="absolute text-slate-900 font-sans font-medium leading-tight overflow-hidden"
        style={{
          top: `${fAddress.y}%`,
          left: `${fAddress.x}%`,
          width: `${fAddress.width || 38.0}%`,
          height: '4.8%',
          fontSize: `clamp(8px, ${(fAddress.fontSize || 9) * 0.12}cqi, 12px)`
        }}
      >
        {data.companyAddress}
      </div>

      {/* 事業所名称 */}
      <div
        className="absolute text-slate-950 font-sans font-bold leading-tight overflow-hidden whitespace-nowrap text-ellipsis"
        style={{
          top: `${fName.y}%`,
          left: `${fName.x}%`,
          width: `${fName.width || 38.0}%`,
          fontSize: `clamp(9px, ${(fName.fontSize || 11) * 0.115}cqi, 14px)`
        }}
      >
        {data.companyName}
      </div>

      {/* 事業主氏名 */}
      <div
        className="absolute text-slate-950 font-sans font-bold leading-tight overflow-hidden whitespace-nowrap text-ellipsis"
        style={{
          top: `${fOwner.y}%`,
          left: `${fOwner.x}%`,
          width: `${fOwner.width || 38.0}%`,
          fontSize: `clamp(9px, ${(fOwner.fontSize || 11) * 0.115}cqi, 14px)`
        }}
      >
        {data.companyOwnerName}
      </div>

      {/* 電話番号 */}
      <div
        className="absolute text-slate-900 font-mono font-medium tracking-wider"
        style={{
          top: `${fPhone.y}%`,
          left: `${fPhone.x}%`,
          width: `${fPhone.width || 24.0}%`,
          fontSize: `clamp(8px, ${(fPhone.fontSize || 10) * 0.115}cqi, 13px)`
        }}
      >
        {data.companyPhone}
      </div>

      {/* 社会保険労務士記載欄 */}
      {data.sharoushiName && (
        <div
          className="absolute text-slate-900 font-sans font-bold"
          style={{
            top: `${fSharoushi.y}%`,
            left: `${fSharoushi.x}%`,
            width: `${fSharoushi.width || 38.0}%`,
            fontSize: `clamp(9px, ${(fSharoushi.fontSize || 11) * 0.11}cqi, 14px)`
          }}
        >
          {data.sharoushiName}
        </div>
      )}

      {/* 共通賞与支払年月日 */}
      <div
        className="absolute font-mono font-bold text-slate-950 text-center"
        style={{ top: `${fCommonY.y}%`, left: `${fCommonY.x}%`, width: `${fCommonY.width || 5.5}%`, fontSize: `clamp(10px, ${(fCommonY.fontSize || 12) * 0.115}cqi, 16px)` }}
      >
        {commonDateParsed.y}
      </div>
      <div
        className="absolute font-mono font-bold text-slate-950 text-center"
        style={{ top: `${fCommonM.y}%`, left: `${fCommonM.x}%`, width: `${fCommonM.width || 5.5}%`, fontSize: `clamp(10px, ${(fCommonM.fontSize || 12) * 0.115}cqi, 16px)` }}
      >
        {commonDateParsed.m}
      </div>
      <div
        className="absolute font-mono font-bold text-slate-950 text-center"
        style={{ top: `${fCommonD.y}%`, left: `${fCommonD.x}%`, width: `${fCommonD.width || 5.5}%`, fontSize: `clamp(10px, ${(fCommonD.fontSize || 12) * 0.115}cqi, 16px)` }}
      >
        {commonDateParsed.d}
      </div>

      {/* 被保険者行 1〜10 */}
      {pageEmployees.map((emp, i) => {
        if (!emp) return null;

        const rowTop = rowBaseTop + i * rowPitchY; // 行上端 (%)
        const isOver70 = emp.isOver70 ?? checkIfOver70(emp.birthDate, data.commonPaymentDate);

        // 生年月日フォーマット: '7-051020' 等
        const rawBirth = formatNenkinBirthDate(emp.birthDate);

        // 千円未満切捨て額の千円以上の数値
        const totalGross = (emp.currencyAmount || 0) + (emp.goodsAmount || 0);
        const thousandsOnly = Math.floor(totalGross / 1000);

        return (
          <React.Fragment key={emp.id || `row-${i}`}>
            {/* 上段 ① 被保険者整理番号 */}
            <div
              className="absolute font-mono font-bold text-slate-950"
              style={{
                top: `${rowTop + fEmpNumber.y}%`,
                left: `${fEmpNumber.x}%`,
                width: `${fEmpNumber.width || 18.0}%`,
                fontSize: `clamp(9.5px, ${(fEmpNumber.fontSize || 12) * 0.11}cqi, 14px)`
              }}
            >
              {emp.insuranceNumber || String(pageIndex * 10 + i + 1).padStart(4, '0')}
            </div>

            {/* 上段 ② フリガナ（氏名の上） */}
            <div
              className="absolute font-sans font-bold text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis"
              style={{
                top: `${rowTop + fEmpKana.y}%`,
                left: `${fEmpKana.x}%`,
                width: `${fEmpKana.width || 31.0}%`,
                fontSize: `clamp(7px, ${(fEmpKana.fontSize || 8.5) * 0.10}cqi, 10px)`,
                lineHeight: '1.0',
                letterSpacing: '0.02em'
              }}
            >
              {emp.nameKana || ''}
            </div>

            {/* 上段 ② 漢字氏名 */}
            <div
              className="absolute font-sans font-black text-slate-950 whitespace-nowrap overflow-hidden text-ellipsis"
              style={{
                top: `${rowTop + fEmpName.y}%`,
                left: `${fEmpName.x}%`,
                width: `${fEmpName.width || 31.0}%`,
                fontSize: `clamp(10px, ${(fEmpName.fontSize || 12.5) * 0.115}cqi, 15px)`,
                lineHeight: '1.1',
                letterSpacing: '0.04em'
              }}
            >
              {emp.name}
            </div>

            {/* 上段 ③ 生年月日（年金機構公式書式：元号コード - YYMMDD） */}
            {rawBirth && (
              <div
                className="absolute flex items-center justify-center font-mono font-black text-slate-950 tracking-wider"
                style={{
                  top: `${rowTop + fEmpBirth.y}%`,
                  left: `${fEmpBirth.x}%`,
                  width: `${fEmpBirth.width || 14.5}%`,
                  height: '1.9%',
                  fontSize: `clamp(10px, ${(fEmpBirth.fontSize || 12.5) * 0.115}cqi, 15px)`
                }}
              >
                <span>{rawBirth.replace('-', ' - ')}</span>
              </div>
            )}

            {/* 上段 ⑦ 個人番号［基礎年金番号］（70歳以上時のみ） */}
            {isOver70 && emp?.myNumber && (
              <div
                className="absolute flex items-center font-mono font-bold text-slate-950"
                style={{
                  top: `${rowTop + fEmpMyNumber.y}%`,
                  left: `${fEmpMyNumber.x}%`,
                  gap: '0.62cqi',
                  fontSize: `clamp(9px, ${(fEmpMyNumber.fontSize || 10) * 0.11}cqi, 13px)`
                }}
              >
                {emp.myNumber.replace(/[^0-9]/g, '').slice(0, 12).split('').map((digit, dIdx) => (
                  <span key={dIdx} className="w-[1.3cqi] text-center">{digit}</span>
                ))}
              </div>
            )}

            {/* 下段 ④ 個別賞与支払日 */}
            {emp.individualPaymentDate && (
              <div
                className="absolute font-mono font-bold text-slate-950"
                style={{
                  top: `${rowTop + fEmpPayDate.y}%`,
                  left: `${fEmpPayDate.x}%`,
                  fontSize: `clamp(8.5px, ${(fEmpPayDate.fontSize || 10) * 0.11}cqi, 13px)`
                }}
              >
                {emp.individualPaymentDate}
              </div>
            )}

            {/* 下段 ⑤ ㋐通貨による賞与額 */}
            <div
              className="absolute font-mono font-bold text-slate-950 text-right"
              style={{
                top: `${rowTop + fEmpCurrency.y}%`,
                left: `${fEmpCurrency.x}%`,
                width: `${fEmpCurrency.width || 14.6}%`,
                paddingRight: '0.3cqi',
                fontSize: `clamp(9.5px, ${(fEmpCurrency.fontSize || 11.5) * 0.11}cqi, 14px)`
              }}
            >
              {emp.currencyAmount ? emp.currencyAmount.toLocaleString() : ''}
            </div>

            {/* 下段 ⑤ ㋑現物による賞与額 */}
            {emp.goodsAmount ? (
              <div
                className="absolute font-mono font-bold text-slate-950 text-right"
                style={{
                  top: `${rowTop + fEmpGoods.y}%`,
                  left: `${fEmpGoods.x}%`,
                  width: `${fEmpGoods.width || 14.6}%`,
                  paddingRight: '0.3cqi',
                  fontSize: `clamp(9.5px, ${(fEmpGoods.fontSize || 11.5) * 0.11}cqi, 14px)`
                }}
              >
                {emp.goodsAmount.toLocaleString()}
              </div>
            ) : null}

            {/* 下段 ⑥ (合計㋐+㋑) 千円未満は切捨て */}
            <div
              className="absolute font-mono font-black text-slate-950 text-right"
              style={{
                top: `${rowTop + fEmpTotal.y}%`,
                left: `${fEmpTotal.x}%`,
                width: `${fEmpTotal.width || 9.8}%`,
                paddingRight: '0.3cqi',
                fontSize: `clamp(9.5px, ${(fEmpTotal.fontSize || 11.5) * 0.11}cqi, 14px)`
              }}
            >
              {thousandsOnly ? thousandsOnly.toLocaleString() : ''}
            </div>

            {/* 下段 ⑧ 備考欄（丸印） */}
            {isOver70 && (
              <div
                className="absolute flex items-center justify-center font-black pointer-events-none"
                style={{
                  top: `${rowTop + 3.2}%`,
                  left: '73.2%',
                  width: '1.8cqi',
                  height: '1.8cqi',
                  border: '2px solid #dc2626',
                  borderRadius: '9999px'
                }}
              />
            )}
            {emp.isDualWork && (
              <div
                className="absolute flex items-center justify-center font-black pointer-events-none"
                style={{
                  top: `${rowTop + 3.2}%`,
                  left: '79.2%',
                  width: '1.8cqi',
                  height: '1.8cqi',
                  border: '2px solid #dc2626',
                  borderRadius: '9999px'
                }}
              />
            )}
            {emp.isMonthlyMerged && (
              <>
                <div
                  className="absolute flex items-center justify-center font-black pointer-events-none"
                  style={{
                    top: `${rowTop + 3.2}%`,
                    left: '84.6%',
                    width: '1.8cqi',
                    height: '1.8cqi',
                    border: '2px solid #dc2626',
                    borderRadius: '9999px'
                  }}
                />
                {emp.firstPaymentDay && (
                  <div
                    className="absolute font-mono font-bold text-slate-950"
                    style={{
                      top: `${rowTop + 3.5}%`,
                      left: '89.6%',
                      fontSize: 'clamp(8px, 1.05cqi, 11px)'
                    }}
                  >
                    {emp.firstPaymentDay}
                  </div>
                )}
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const OfficialBonusPaymentReportDoc: React.FC<BonusPaymentReportDocProps> = ({ 
  data, 
  canEditCoordinates = false 
}) => {
  const commonDateParsed = parseDateElements(data.commonPaymentDate);
  const submissionDateParsed = parseDateElements(data.submissionDate || new Date().toISOString().split('T')[0]);

  // 1ページあたり10名区切りでチャンク分割
  const pageSize = 10;
  const pages: (BonusReportEmployee | null)[][] = [];
  const empList = data.employees || [];

  if (empList.length === 0) {
    // 0名の場合は空行10行の1ページ
    pages.push(Array(10).fill(null));
  } else {
    for (let i = 0; i < empList.length; i += pageSize) {
      const chunk = empList.slice(i, i + pageSize);
      // 10行に満たない場合は null で埋める
      while (chunk.length < 10) {
        chunk.push(null as any);
      }
      pages.push(chunk);
    }
  }

  // 事業所整理記号の分解 (例: "01-イロハ", "25-カア 12345", "01イロハ", "25-カア")
  const rawSymbol = (data.officeSymbol || '').trim();
  // 数字部分（左端の数字列：最大2文字）
  const numMatch = rawSymbol.match(/^(\d{1,2})/);
  const symbolDigits = numMatch ? numMatch[1] : (data.officeCityCode || '').slice(0, 2);
  // カナ部分（カタカナ・漢字・ひらがなのみを厳密抽出。数字や空白、記号の混入を100%防止）
  const kanaMatch = rawSymbol.replace(/^[\d\-ー\s]+/, '').match(/[ァ-ヴー\u4E00-\u9FFFぁ-ん]+/);
  const symbolKana = (kanaMatch ? kanaMatch[0] : (data.officeSymbolKana || '')).slice(0, 4);

  // 表示モード切替（デフォルト: 原本PDF完全一致オーバーレイ印字）
  const [renderMode, setRenderMode] = useState<'exact_pdf' | 'web_table'>('exact_pdf');
  const [showInspectorModal, setShowInspectorModal] = useState(false);

  // 🎯 マスタ印字座標State（インスペクターやDBとのリアルタイム同期）
  const [fieldsList, setFieldsList] = useState<BonusDocFieldConfig[]>(() => loadBonusDocCoordinates());

  // 初回DB（Supabase system_settings）からの読み込み
  useEffect(() => {
    fetchBonusDocCoordinatesFromDb().then(latest => {
      if (latest && latest.length > 0) {
        setFieldsList(latest);
      }
    });
  }, []);

  // リアルタイム更新イベント（同一タブ内）および storage イベント（別タブ）を監視
  useEffect(() => {
    const handleCoordsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<BonusDocFieldConfig[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setFieldsList(customEvent.detail);
      } else {
        setFieldsList(loadBonusDocCoordinates());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bonusDocMasterFields') {
        setFieldsList(loadBonusDocCoordinates());
      }
    };

    window.addEventListener(BONUS_COORDS_UPDATE_EVENT, handleCoordsUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(BONUS_COORDS_UPDATE_EVENT, handleCoordsUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const coordsMap = useMemo(() => {
    return new Map<string, BonusDocFieldConfig>(fieldsList.map(c => [c.id, c]));
  }, [fieldsList]);

  return (
    <div className="official-bonus-doc-root font-sans text-black select-text">
      {/* 表示モード切替 ＆ マスタ微調整バー（印刷時は非表示） */}
      <div className="print:hidden mb-4 bg-white border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-slate-800">📄 帳票形式:</span>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setRenderMode('exact_pdf')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                renderMode === 'exact_pdf'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🖼️ 日本年金機構 原本PDF完全一致（原本下敷き印字）</span>
              <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.2 rounded font-mono">推奨</span>
            </button>
            <button
              onClick={() => setRenderMode('web_table')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                renderMode === 'web_table'
                  ? 'bg-indigo-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📋 Web標準テーブル形式</span>
            </button>
          </div>

          {/* 🛠️ マスタ設定・インスペクター微調整ボタン（軍律第23条：管理者専用画面でのみ表示） */}
          {canEditCoordinates && renderMode === 'exact_pdf' && (
            <button
              type="button"
              onClick={() => setShowInspectorModal(true)}
              className="ml-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 hover:from-pink-100 hover:to-rose-100 text-pink-700 border border-pink-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="文字の印字位置を画面上でミリ単位・ピクセル単位で微調整できます"
            >
              <span className="text-sm">🛠️</span>
              <span>印字座標を微調整（マスタ設定）</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          {renderMode === 'exact_pdf'
            ? '※ 日本年金機構の配布PDF原本（コード2265）の上にピクセルパーフェクトで印字します。そのまま提出可能です。'
            : '※ 通常のWebテーブル形式で内容を確認・印刷します。'}
        </div>
      </div>

      {/* 🛠️ 印字座標マスタ微調整モーダル */}
      {showInspectorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-7xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-pink-600 rounded-xl text-white text-sm">🌸</span>
                <div>
                  <h3 className="text-sm font-black text-white">被保険者賞与支払届 印字座標マスタ設定インスペクター</h3>
                  <p className="text-[10px] text-slate-400">位置を調整して保存すると、この帳票の印字位置に即座に反映されます</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInspectorModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                ✕ 閉じる（即時反映済み）
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50">
              <BonusDocMasterInspector />
            </div>
          </div>
        </div>
      )}

      {/* 印刷・A4最適化CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .bonus-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .official-bonus-page-container {
            width: 210mm !important;
            height: 297mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            container-type: inline-size !important;
            position: relative !important;
          }
          .official-bonus-page-container img {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {pages.map((pageEmployees, pageIndex) => {
        if (renderMode === 'exact_pdf') {
          return (
            <ExactPdfPageRenderer
              key={`page-exact-${pageIndex}`}
              pageEmployees={pageEmployees}
              pageIndex={pageIndex}
              totalPages={pages.length}
              data={data}
              submissionDateParsed={submissionDateParsed}
              commonDateParsed={commonDateParsed}
              symbolDigits={symbolDigits}
              symbolKana={symbolKana}
              coordsMap={coordsMap}
            />
          );
        }

        return (
          <div
            key={`page-web-${pageIndex}`}
            className={`official-bonus-page bg-white p-4 sm:p-5 max-w-[800px] mx-auto text-[9px] leading-tight text-slate-900 ${
              pageIndex < pages.length - 1 ? 'bonus-page-break' : ''
            }`}
          >
          {/* ========================================================================= */}
          {/* ① 最上部ヘッダー（様式コード 2265 / タイトル / バーコード / 受付印）       */}
          {/* ========================================================================= */}
          <div className="flex items-start justify-between gap-2 border-b-2 border-slate-900 pb-1.5">
            {/* 左: 様式コード 2265 ＆ タイトル */}
            <div className="flex items-start gap-3">
              {/* 様式コード */}
              <div>
                <div className="text-[7.5px] font-bold text-slate-600 text-center mb-0.5">様式コード</div>
                <div className="flex border border-slate-900">
                  {['2', '2', '6', '5'].map((digit, i) => (
                    <div
                      key={i}
                      className="w-4 h-5 border-r border-slate-900 last:border-r-0 flex items-center justify-center font-mono font-bold text-xs bg-slate-50"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>

              {/* タイトル */}
              <div className="pt-0.5">
                <div className="text-[8px] font-bold tracking-wider text-slate-700">
                  健　康　保　険<br />
                  厚生年金保険
                </div>
                <div className="text-[7px] text-slate-500 font-medium -mt-0.5">
                  (兼)厚生年金保険
                </div>
              </div>

              <div className="pt-1">
                <h1 className="text-sm sm:text-base font-black tracking-widest text-slate-900 whitespace-nowrap">
                  被保険者賞与支払届
                </h1>
                <div className="text-[9px] font-bold tracking-wider text-slate-800 -mt-0.5">
                  70歳以上被用者賞与支払届
                </div>
              </div>
            </div>

            {/* 右: バーコード ＆ 受付印 */}
            <div className="flex items-start gap-3">
              {/* バーコード再現 */}
              <div className="text-center pt-1">
                <div className="flex items-end justify-center h-8 gap-[1px]">
                  {[2,1,3,1,2,3,1,1,2,1,3,2,1,2,1,3,1,2,1,1,3,2,1,2,3,1,1,2,3,1,2,1].map((w, idx) => (
                    <div
                      key={idx}
                      className="bg-black"
                      style={{
                        width: `${w * 1.1}px`,
                        height: idx % 7 === 0 ? '30px' : '26px'
                      }}
                    />
                  ))}
                </div>
                <span className="text-[6.5px] font-mono tracking-widest text-slate-600 block mt-0.5">
                  *2265-010-001*
                </span>
              </div>

              {/* 受付印 */}
              <div className="w-16 h-16 border border-slate-800 rounded-xs flex flex-col items-center justify-start text-[7px] font-bold text-slate-600 p-0.5">
                <span>受付印</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ② 提出年月日 ＆ 提出者記入欄 ＆ 社会保険労務士記載欄                      */}
          {/* ========================================================================= */}
          <div className="mt-1 flex items-center justify-between text-[8px] font-bold">
            <div>
              <span>令和 </span>
              <span className="inline-block w-6 text-center border-b border-slate-700 font-mono text-[9px]">
                {submissionDateParsed.y || '　'}
              </span>
              <span> 年 </span>
              <span className="inline-block w-5 text-center border-b border-slate-700 font-mono text-[9px]">
                {submissionDateParsed.m || '　'}
              </span>
              <span> 月 </span>
              <span className="inline-block w-5 text-center border-b border-slate-700 font-mono text-[9px]">
                {submissionDateParsed.d || '　'}
              </span>
              <span> 日提出</span>
            </div>
            <div className="text-slate-500 text-[7.5px]">
              ※ 1枚につき10名まで記入できます（ページ: {pageIndex + 1} / {pages.length}）
            </div>
          </div>

          <div className="mt-1 grid grid-cols-12 border border-slate-900 text-[8px]">
            {/* 左側：提出者記入欄（縦見出し＋事業所情報） */}
            <div className="col-span-8 flex border-r border-slate-900">
              {/* 提出者記入欄 縦見出し */}
              <div className="w-5 bg-fuchsia-100 text-fuchsia-950 font-black flex flex-col items-center justify-center p-1 border-r border-slate-900 tracking-widest text-[8px]">
                <span>提</span>
                <span>出</span>
                <span>者</span>
                <span>記</span>
                <span>入</span>
                <span>欄</span>
              </div>

              <div className="flex-1 p-1 space-y-1">
                {/* 事業所整理記号 ＆ 個人番号誤りなしチェック */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-700">事業所<br />整理記号</span>
                    <div className="flex items-center gap-1 font-mono text-[9px]">
                      <span className="border border-slate-700 px-1 py-0.5 min-w-[24px] text-center font-bold bg-slate-50">
                        {symbolDigits || '01'}
                      </span>
                      <span>-</span>
                      <span className="border border-slate-700 px-2 py-0.5 min-w-[40px] text-center font-bold bg-slate-50">
                        {symbolKana || 'イロハ'}
                      </span>
                    </div>
                  </div>

                  <label className="flex items-center gap-1 text-[7px] text-slate-700 cursor-default">
                    <input
                      type="checkbox"
                      checked={data.checkedMyNumberAccuracy !== false}
                      readOnly
                      className="w-3 h-3 text-slate-900"
                    />
                    <span>届書記入の個人番号に誤りがないことを確認しました。</span>
                  </label>
                </div>

                {/* 事業所所在地・名称・事業主氏名・電話番号 */}
                <div className="grid grid-cols-12 gap-x-2 gap-y-0.5 text-[7.5px]">
                  <div className="col-span-2 text-slate-500 font-bold">事業所所在地</div>
                  <div className="col-span-10 font-medium text-slate-900 truncate">
                    {data.companyAddress || '東京都千代田区霞が関1-1-1'}
                  </div>

                  <div className="col-span-2 text-slate-500 font-bold">事業所名称</div>
                  <div className="col-span-10 font-bold text-slate-900 truncate">
                    {data.companyName || '株式会社 サンプル'}
                  </div>

                  <div className="col-span-2 text-slate-500 font-bold">事業主氏名</div>
                  <div className="col-span-5 font-bold text-slate-900 truncate">
                    {data.companyOwnerName || '代表取締役 山田 太郎'}
                  </div>

                  <div className="col-span-2 text-slate-500 font-bold text-right">電話番号</div>
                  <div className="col-span-3 font-mono font-bold text-slate-900">
                    {data.companyPhone || '03-1234-5678'}
                  </div>
                </div>
              </div>
            </div>

            {/* 右側：社会保険労務士記載欄 */}
            <div className="col-span-4 p-1.5 flex flex-col justify-between">
              <div className="text-slate-500 font-bold border-b border-slate-200 pb-0.5">
                社会保険労務士記載欄
              </div>
              <div className="text-[7.5px] text-slate-700 min-h-[36px] flex items-center justify-center italic">
                {data.sharoushiName || '氏名等'}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ③ 共通行：賞与支払年月日（共通）                                          */}
          {/* ========================================================================= */}
          <div className="mt-1 border-2 border-fuchsia-900 bg-fuchsia-50/70 flex items-center justify-between p-1 text-[8.5px]">
            <div className="flex items-center gap-2">
              <span className="bg-fuchsia-800 text-white font-black px-1.5 py-0.5 rounded-xs text-[8px]">
                共通
              </span>
              <span className="font-black text-fuchsia-950">
                ④ 賞与支払年月日（共通）
              </span>
              <div className="font-bold text-slate-900 ml-2 font-mono flex items-center gap-1">
                <span>9. 令和</span>
                <span className="inline-block min-w-[20px] text-center border-b border-slate-900 font-bold">
                  {commonDateParsed.y || '8'}
                </span>
                <span>年</span>
                <span className="inline-block min-w-[18px] text-center border-b border-slate-900 font-bold">
                  {commonDateParsed.m || '6'}
                </span>
                <span>月</span>
                <span className="inline-block min-w-[18px] text-center border-b border-slate-900 font-bold">
                  {commonDateParsed.d || '30'}
                </span>
                <span>日</span>
              </div>
            </div>

            <div className="text-[7.5px] font-bold text-fuchsia-900">
              ← 1枚ずつ必ず記入してください。
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ④ 被保険者明細テーブル（ヘッダー ＆ 1〜10行）                             */}
          {/* ========================================================================= */}
          <div className="mt-1 border border-slate-900">
            {/* テーブルヘッダー（項目名） */}
            <div className="bg-fuchsia-100/90 text-fuchsia-950 font-bold grid grid-cols-12 text-[7.5px] border-b border-slate-900 text-center py-0.5">
              <div className="col-span-1 border-r border-slate-400">項目名</div>
              <div className="col-span-2 border-r border-slate-400">① 被保険者整理番号</div>
              <div className="col-span-3 border-r border-slate-400">② 被保険者氏名</div>
              <div className="col-span-2 border-r border-slate-400">③ 生年月日</div>
              <div className="col-span-4">
                ⑦ 個人番号［基礎年金番号］
                <span className="text-[6.5px] font-normal block">※70歳以上被用者の場合のみ</span>
              </div>
            </div>
            <div className="bg-fuchsia-50 text-fuchsia-900 font-bold grid grid-cols-12 text-[7px] border-b border-slate-900 text-center py-0.5">
              <div className="col-span-1 border-r border-slate-400"></div>
              <div className="col-span-3 border-r border-slate-400">④ 賞与支払年月日</div>
              <div className="col-span-4 border-r border-slate-400">⑤ 賞与支払額</div>
              <div className="col-span-2 border-r border-slate-400">⑥ 賞与額 (千円未満切捨)</div>
              <div className="col-span-2">⑧ 備考</div>
            </div>

            {/* 明細行（1〜10行） */}
            {pageEmployees.map((emp, rowIdx) => {
              const rowNum = rowIdx + 1;
              const hasData = !!emp;

              // 生年月日元号コード変換
              const birthCode = hasData ? formatNenkinBirthDate(emp.birthDate) : '';

              // 70歳以上判定
              const isOver70 = hasData 
                ? (emp.isOver70 !== undefined ? emp.isOver70 : checkIfOver70(emp.birthDate, data.commonPaymentDate))
                : false;

              // 金額計算
              const currAmt = hasData ? (emp.currencyAmount || 0) : 0;
              const goodsAmt = hasData ? (emp.goodsAmount || 0) : 0;
              const totalAmt = currAmt + goodsAmt;
              // ⑥ 千円未満切捨て
              const standardBonusAmt = hasData ? Math.floor(totalAmt / 1000) * 1000 : 0;
              const standardBonusThousands = hasData ? Math.floor(totalAmt / 1000) : 0;

              // 個別支払日
              const indDateParsed = hasData && emp.individualPaymentDate ? parseDateElements(emp.individualPaymentDate) : null;

              return (
                <div
                  key={`row-${rowNum}`}
                  className="border-b border-slate-900 last:border-b-0 grid grid-cols-12 min-h-[46px]"
                >
                  {/* 行番号（左端 1〜10、紫背景） */}
                  <div className="col-span-1 bg-fuchsia-800 text-white font-black text-sm flex items-center justify-center border-r border-slate-900">
                    {rowNum}
                  </div>

                  {/* メイン明細エリア（2段構成） */}
                  <div className="col-span-11 flex flex-col justify-between">
                    {/* 上段: ①整理番号 / ②氏名 / ③生年月日 / ⑦個人番号 */}
                    <div className="grid grid-cols-11 border-b border-slate-300 py-1 px-1 items-center text-[8px]">
                      {/* ① 整理番号 */}
                      <div className="col-span-2 border-r border-slate-200 pr-1">
                        <span className="text-[6.5px] text-slate-400 block -mb-0.5">①</span>
                        <span className="font-mono font-bold text-slate-800">
                          {hasData ? (emp.insuranceNumber || `00${rowNum}`) : ''}
                        </span>
                      </div>

                      {/* ② 氏名 */}
                      <div className="col-span-3 border-r border-slate-200 px-1">
                        <span className="text-[6.5px] text-slate-400 block -mb-0.5">②</span>
                        {hasData && emp.nameKana && (
                          <div className="text-[6.5px] text-slate-500 truncate leading-none">
                            {emp.nameKana}
                          </div>
                        )}
                        <div className="font-black text-[9px] text-slate-900 truncate">
                          {hasData ? emp.name : ''}
                        </div>
                      </div>

                      {/* ③ 生年月日 (例: 5-630503) */}
                      <div className="col-span-3 border-r border-slate-200 px-1">
                        <span className="text-[6.5px] text-slate-400 block -mb-0.5">③</span>
                        <div className="font-mono font-black text-slate-900 text-[8.5px]">
                          {birthCode}
                        </div>
                      </div>

                      {/* ⑦ 個人番号［基礎年金番号］(70歳以上時) */}
                      <div className="col-span-3 pl-1">
                        <span className="text-[6.5px] text-slate-400 block -mb-0.5">⑦</span>
                        <div className="font-mono text-[8px] text-slate-800">
                          {hasData && isOver70 && emp.myNumber ? emp.myNumber : ''}
                        </div>
                      </div>
                    </div>

                    {/* 下段: ④賞与支払日 / ⑤支払額(通貨・現物) / ⑥賞与額(千円未満切捨) / ⑧備考 */}
                    <div className="grid grid-cols-11 py-1 px-1 items-center text-[7.5px] bg-slate-50/40">
                      {/* ④ 賞与支払年月日 */}
                      <div className="col-span-3 border-r border-slate-200 pr-1">
                        <span className="text-[6.5px] text-slate-400 block -mb-0.5">④</span>
                        {indDateParsed ? (
                          <div className="font-mono text-[7.5px] font-bold text-slate-900">
                            9.令 {indDateParsed.y}年{indDateParsed.m}月{indDateParsed.d}日
                          </div>
                        ) : (
                          <div className="text-[6.5px] text-slate-400 leading-tight">
                            ※共通と同じ
                          </div>
                        )}
                      </div>

                      {/* ⑤ 賞与支払額：㋐(通貨) ㋑(現物) */}
                      <div className="col-span-4 border-r border-slate-200 px-1 flex items-center justify-between gap-1 font-mono">
                        <div>
                          <span className="text-[6.5px] text-slate-400 block -mb-0.5">⑤㋐(通貨)</span>
                          <span className="font-bold text-slate-900 text-[8px]">
                            {hasData && currAmt > 0 ? currAmt.toLocaleString() : (hasData ? '0' : '')}
                          </span>
                          {hasData && <span className="text-[6.5px] text-slate-400 ml-0.5">円</span>}
                        </div>
                        <div className="text-right">
                          <span className="text-[6.5px] text-slate-400 block -mb-0.5">㋑(現物)</span>
                          <span className="text-slate-700 text-[8px]">
                            {hasData && goodsAmt > 0 ? goodsAmt.toLocaleString() : (hasData ? '0' : '')}
                          </span>
                          {hasData && <span className="text-[6.5px] text-slate-400 ml-0.5">円</span>}
                        </div>
                      </div>

                      {/* ⑥ 賞与額 (合計㋐＋㋑ 千円未満切捨て) */}
                      <div className="col-span-2 border-r border-slate-200 px-1 text-right font-mono">
                        <span className="text-[6.5px] text-slate-400 block text-left -mb-0.5">⑥</span>
                        {hasData && standardBonusAmt > 0 ? (
                          <div className="font-black text-slate-950 text-[8.5px]">
                            <span>{standardBonusThousands.toLocaleString()}</span>
                            <span className="text-[7px] font-bold text-slate-600">,000 円</span>
                          </div>
                        ) : (
                          <div className="text-[7px] text-slate-300">,000 円</div>
                        )}
                      </div>

                      {/* ⑧ 備考（1.70歳以上 2.二以上 3.合算） */}
                      <div className="col-span-2 pl-1 text-[6.5px] leading-none space-y-0.5">
                        <div className="flex items-center gap-0.5">
                          <span className={`inline-block w-3 h-3 text-center rounded-full leading-3 font-bold ${
                            isOver70 ? 'border border-fuchsia-800 text-fuchsia-800 font-black bg-fuchsia-50' : 'text-slate-400'
                          }`}>
                            1
                          </span>
                          <span className={isOver70 ? 'font-bold text-fuchsia-950' : 'text-slate-400'}>
                            70歳以上被用者
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <span className={`inline-block w-3 h-3 text-center rounded-full leading-3 font-bold ${
                            hasData && emp.isDualWork ? 'border border-fuchsia-800 text-fuchsia-800 font-black bg-fuchsia-50' : 'text-slate-400'
                          }`}>
                            2
                          </span>
                          <span className={hasData && emp.isDualWork ? 'font-bold text-fuchsia-950' : 'text-slate-400'}>
                            二以上勤務
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <span className={`inline-block w-3 h-3 text-center rounded-full leading-3 font-bold ${
                            hasData && emp.isMonthlyMerged ? 'border border-fuchsia-800 text-fuchsia-800 font-black bg-fuchsia-50' : 'text-slate-400'
                          }`}>
                            3
                          </span>
                          <span className={hasData && emp.isMonthlyMerged ? 'font-bold text-fuchsia-950' : 'text-slate-400'}>
                            同月合算{hasData && emp.firstPaymentDay ? `(${emp.firstPaymentDay}日)` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* ⑤ フッター                                                               */}
          {/* ========================================================================= */}
          <div className="mt-2 flex items-center justify-between text-[7px] text-slate-500 border-t border-slate-200 pt-1">
            <div>
              <span>S3年</span>
              <span className="ml-3">日本年金機構 / 全国健康保険協会 届出様式準拠</span>
            </div>
            <div className="font-mono font-bold">
              {pageIndex + 1} / {pages.length} ページ
            </div>
          </div>
        </div>
      );
    })}
    </div>
  );
};
