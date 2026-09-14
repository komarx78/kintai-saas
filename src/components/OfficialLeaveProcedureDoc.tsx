import React, { useState } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';

export interface LeaveProcedureEmployee {
  id: string;
  name: string;
  name_kana?: string;
  department?: string;
  birth_date?: string;
  join_date: string;
  base_salary: number;
}

export interface OfficialLeaveProcedureDocProps {
  companyInfo: {
    name: string;
    address: string;
    representative_name: string;
    phone_number: string;
    corporate_number?: string;
    company_seal_url?: string;
  };
  employees: LeaveProcedureEmployee[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  onBack: () => void;
}

export const OfficialLeaveProcedureDoc: React.FC<OfficialLeaveProcedureDocProps> = ({
  companyInfo,
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onBack
}) => {
  // 書式種別: request: 休職願, approval: 休職承認通知書, reinstatement: 復職願・承認書, injury_allowance: 傷病手当金申請(事業主証明)
  const [docType, setDocType] = useState<'approval' | 'request' | 'reinstatement' | 'injury_allowance'>('approval');

  // 休職詳細設定
  const leaveReason = '私傷病による休職（医師の診断に基づく加療）';
  const leaveStartDate = new Date().toISOString().split('T')[0];
  const leaveEndDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  })();
  const salaryTreatment = '無給（就業規則第〇条の定めに従う）';
  const insurancePaymentMethod = '毎月末日までに会社指定口座へ自己負担分を振込納付';

  const currentEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

  const handlePrint = () => {
    window.print();
  };

  if (!currentEmployee) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500 font-bold text-sm">対象の従業員データが見つかりません。</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 操作ヘッダー */}
      <div className="print:hidden bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition cursor-pointer"
            title="戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-black bg-rose-50 text-rose-700 border border-rose-200">
                社内規程・労務管理公式書式
              </span>
              <span className="text-xs text-slate-400 font-bold">A4公的証明書</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 mt-1">
              休職・復職手続き ＆ 傷病手当金申請書類
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 書式種別タブ */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setDocType('approval')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'approval' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              休職承認通知書
            </button>
            <button
              onClick={() => setDocType('request')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'request' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              休職届（願）
            </button>
            <button
              onClick={() => setDocType('reinstatement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'reinstatement' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              復職承認書
            </button>
            <button
              onClick={() => setDocType('injury_allowance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                docType === 'injury_allowance' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              傷病手当金(事業主証明)
            </button>
          </div>

          {/* 従業員選択 */}
          <select
            value={currentEmployee.id}
            onChange={(e) => onSelectEmployee(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-hidden focus:ring-2 focus:ring-rose-500"
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.department || '一般'})
              </option>
            ))}
          </select>

          {/* 印刷ボタン */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            公式A4印刷 / PDF保存
          </button>
        </div>
      </div>

      {/* 印刷・公式A4原本コンテナ */}
      <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl flex justify-center overflow-x-auto print:p-0 print:m-0 print:bg-white print:overflow-visible">
        <div className="w-[210mm] min-h-[297mm] bg-white p-[20mm] shadow-lg border border-slate-300 text-slate-900 font-sans print:shadow-none print:border-none print:p-0 print:w-full print:m-0 box-border text-[11px] leading-relaxed">

          {/* 1. 休職承認通知書（会社 ➔ 従業員） */}
          {docType === 'approval' && (
            <div>
              <div className="text-right text-[10px] text-slate-600 mb-4">
                通知年月日: {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-sm font-bold text-slate-700">{currentEmployee.department || '所属部署'}</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{currentEmployee.name} 殿</div>
                </div>
                <div className="text-right relative">
                  <div className="font-black text-sm">{companyInfo.name}</div>
                  <div className="text-xs">{companyInfo.address}</div>
                  <div className="font-bold text-xs mt-1">{companyInfo.representative_name} 印</div>
                  {companyInfo.company_seal_url && (
                    <img
                      src={companyInfo.company_seal_url}
                      alt="社印"
                      className="absolute right-0 top-2 w-14 h-14 object-contain pointer-events-none opacity-85"
                    />
                  )}
                </div>
              </div>

              <div className="text-center my-6">
                <h1 className="text-2xl font-black tracking-widest border-b-2 border-slate-900 pb-2 inline-block">
                  休 職 承 認 通 知 書
                </h1>
              </div>

              <p className="mb-6 indent-4">
                貴殿より提出のありました休職届および医師の診断書に基づき、就業規則第〇条の規定に従い、下記のとおり休職を承認・発令いたします。休職期間中は療養に専念し、早期の回復に努めてください。
              </p>

              {/* 条件明記テーブル */}
              <div className="border-2 border-slate-900 rounded-xs mb-6 overflow-hidden">
                <div className="bg-slate-900 text-white p-2 text-xs font-black text-center">
                  記
                </div>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold w-36 border-r border-slate-300">1. 休職期間</td>
                      <td className="p-3 font-black text-indigo-900">
                        {leaveStartDate} 〜 {leaveEndDate} まで
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">2. 休職事由</td>
                      <td className="p-3 font-bold text-slate-800">
                        {leaveReason}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">3. 休職期間中の給与</td>
                      <td className="p-3 font-bold">
                        {salaryTreatment}
                        <span className="text-[10px] text-slate-500 font-normal block mt-0.5">
                          ※ 健康保険の傷病手当金受給対象となります（事業主証明欄は別途発行いたします）。
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">4. 社会保険料の負担</td>
                      <td className="p-3">
                        <div className="font-bold text-rose-900">{insurancePaymentMethod}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          ※ 休職期間中も健康保険料・厚生年金保険料（本人負担分）および住民税の納税義務は継続いたします。
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">5. 復職の手続き</td>
                      <td className="p-3 text-[10px] text-slate-700 leading-relaxed">
                        休職期間満了日の2週間前までに、主治医による『復職可能診断書』を添えて「復職願」を会社へ提出してください。産業医面談および会社の承認を経て復職を決定いたします。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-right text-xs font-bold text-slate-500">以上</div>
            </div>
          )}

          {/* 2. 休職届（従業員 ➔ 会社） */}
          {docType === 'request' && (
            <div>
              <div className="text-right text-[10px] text-slate-600 mb-4">
                提出日: {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="font-black text-base">{companyInfo.name}</div>
                  <div className="font-bold text-sm">代表取締役 {companyInfo.representative_name} 殿</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600">{currentEmployee.department || '所属'}</div>
                  <div className="text-base font-black mt-1">氏名: {currentEmployee.name} 印</div>
                  <div className="text-[10px] text-slate-500 mt-1">生年月日: {currentEmployee.birth_date || '未登録'}</div>
                </div>
              </div>

              <div className="text-center my-6">
                <h1 className="text-2xl font-black tracking-widest border-b-2 border-slate-900 pb-2 inline-block">
                  休 職 届
                </h1>
              </div>

              <p className="mb-6 indent-4">
                就業規則第〇条に基づき、下記の通り休職いたしたく、医師の診断書を添えてお届け出いたします。休職期間中は療養に専念いたします。
              </p>

              <div className="border-2 border-slate-900 rounded-xs mb-6 overflow-hidden">
                <div className="bg-slate-900 text-white p-2 text-xs font-black text-center">記</div>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold w-36 border-r border-slate-300">希望休職期間</td>
                      <td className="p-3 font-black text-slate-900">{leaveStartDate} 〜 {leaveEndDate}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">休職事由</td>
                      <td className="p-3 font-bold">{leaveReason}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">医師の診断書</td>
                      <td className="p-3 font-bold text-emerald-800">添付あり（医療機関発行の診断書原本）</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">休職中の緊急連絡先</td>
                      <td className="p-3 text-slate-700">本人携帯 / 現住所（システム登録情報に同じ）</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-right text-xs font-bold text-slate-500">以上</div>
            </div>
          )}

          {/* 3. 復職承認書 */}
          {docType === 'reinstatement' && (
            <div>
              <div className="text-right text-[10px] text-slate-600 mb-4">
                通知年月日: {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日
              </div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-sm font-bold text-slate-700">{currentEmployee.department || '所属部署'}</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{currentEmployee.name} 殿</div>
                </div>
                <div className="text-right relative">
                  <div className="font-black text-sm">{companyInfo.name}</div>
                  <div className="font-bold text-xs mt-1">{companyInfo.representative_name} 印</div>
                </div>
              </div>

              <div className="text-center my-6">
                <h1 className="text-2xl font-black tracking-widest border-b-2 border-slate-900 pb-2 inline-block">
                  復 職 承 認 書
                </h1>
              </div>

              <p className="mb-6 indent-4">
                貴殿より提出のありました復職願および主治医診断書を審査した結果、下記の通り職場への復帰を承認いたします。
              </p>

              <div className="border-2 border-slate-900 rounded-xs mb-6 overflow-hidden">
                <div className="bg-slate-900 text-white p-2 text-xs font-black text-center">記</div>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold w-36 border-r border-slate-300">復職年月日</td>
                      <td className="p-3 font-black text-emerald-900">{leaveEndDate}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">復職先部署・役職</td>
                      <td className="p-3 font-bold">{currentEmployee.department || '原職'}</td>
                    </tr>
                    <tr>
                      <td className="bg-slate-50 p-3 font-bold border-r border-slate-300">勤務上の配慮事項</td>
                      <td className="p-3 text-slate-700">
                        主治医指示に基づき、復職後1ヶ月間は時間外労働を免除し短時間勤務または定時退社を推奨する。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="text-right text-xs font-bold text-slate-500">以上</div>
            </div>
          )}

          {/* 4. 傷病手当金支給申請書（事業主証明欄） */}
          {docType === 'injury_allowance' && (
            <div>
              <div className="border-b-2 border-slate-900 pb-2 mb-4">
                <span className="text-[10px] font-bold border border-slate-700 px-2 py-0.5">
                  全国健康保険協会（協会けんぽ）公式様式
                </span>
                <h1 className="text-xl font-black mt-2">
                  健康保険 傷病手当金支給申請書（事業主証明欄）
                </h1>
              </div>

              <div className="border border-slate-800 p-3 mb-4 rounded-xs">
                <div className="text-xs font-black mb-2">事業主による労務不能・給与不支給の証明</div>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-2 font-bold w-36 border-r border-slate-300">申請被保険者</td>
                      <td className="p-2 font-black text-slate-900">{currentEmployee.name}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">療養休業期間</td>
                      <td className="p-2 font-bold">{leaveStartDate} 〜 {leaveEndDate}</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="bg-slate-50 p-2 font-bold border-r border-slate-300">休業期間中の給与支払</td>
                      <td className="p-2 font-bold text-rose-900">
                        全額不支給（無給）であることを証明いたします。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-300 pt-4 flex justify-between items-end">
                <div>
                  上記のとおり相違ないことを証明いたします。<br />
                  事業主所在地: {companyInfo.address}<br />
                  事業所名称: {companyInfo.name}<br />
                  事業主氏名: {companyInfo.representative_name} 印
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  SSOT労務管理システム 自動証明済
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
