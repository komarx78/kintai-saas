import { type FC } from 'react';
import { X, Printer, Building2, UserCheck, Users, ShieldCheck } from 'lucide-react';
import { type PositionMaster, type OrgDepartmentNode, type OrgMemberInfo } from '../lib/orgChart';

interface OrgChartPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyInfo: {
    name: string;
    representative_name: string;
    address: string;
    phone_number: string;
  };
  positions: PositionMaster[];
  departments: OrgDepartmentNode[];
  executives: OrgMemberInfo[]; // 役員・経営陣
  allMembers: OrgMemberInfo[];
}

export const OrgChartPrintModal: FC<OrgChartPrintModalProps> = ({
  isOpen,
  onClose,
  companyInfo,
  departments,
  executives,
  allMembers
}) => {
  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-4 print:m-0 print:p-6 print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* 操作ヘッダー（印刷時は非表示） */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-base">会社組織図 プレビュー ＆ A4印刷</h3>
              <p className="text-xs text-slate-400">ブラウザの印刷画面で「PDFに保存」を選択するとPDF化できます</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              A4印刷 / PDF保存
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 🖨️ 印刷用組織図本体 */}
        <div className="space-y-6 text-slate-800 font-sans print:space-y-4">
          {/* 組織図公式ヘッダー */}
          <div className="border-b-2 border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Organization Chart</div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {companyInfo.name || '株式会社KAP'}　組織図
              </h1>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <div className="font-bold text-slate-700">基準日: {todayStr} 現在</div>
              <div className="text-[11px] text-slate-500">{companyInfo.representative_name}</div>
              <div className="text-[10px] text-slate-400">{companyInfo.address}</div>
            </div>
          </div>

          {/* 1. 経営層・役員ブロック */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 print:bg-slate-50 print:border-slate-300">
            <div className="text-xs font-black text-indigo-900 flex items-center gap-1.5 mb-2.5 pb-1 border-b border-indigo-100">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              経営陣・役員
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {executives.length > 0 ? (
                executives.map(exec => (
                  <div key={exec.id} className="bg-white p-2.5 rounded-xl border border-indigo-200/70 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-700 block">{exec.position_name || '役員'}</span>
                      <span className="text-xs font-black text-slate-900">{exec.name}</span>
                    </div>
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold">役員</span>
                  </div>
                ))
              ) : (
                <div className="bg-white p-2.5 rounded-xl border border-indigo-200/70 shadow-xs">
                  <span className="text-[10px] font-bold text-indigo-700 block">代表取締役</span>
                  <span className="text-xs font-black text-slate-900">{companyInfo.representative_name.replace('代表取締役', '').trim() || '代表取締役'}</span>
                </div>
              )}
            </div>
          </div>

          {/* ツリー結合線（ビジュアル） */}
          <div className="flex justify-center -my-2 print:my-0">
            <div className="w-0.5 h-6 bg-slate-300"></div>
          </div>

          {/* 2. 各部門・部署ブロック（グリッド展開） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept, idx) => {
              const deptMembers = dept.members || [];
              return (
                <div
                  key={dept.id}
                  className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3 shadow-xs print:border-slate-300 print:break-inside-avoid"
                >
                  {/* 部署ヘッダー */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h4 className="text-xs font-black text-slate-900">{dept.name}</h4>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      {deptMembers.length}名
                    </span>
                  </div>

                  {/* 部門長・責任者 */}
                  <div className="bg-amber-50/60 border border-amber-200 p-2.5 rounded-xl">
                    <div className="text-[9px] font-bold text-amber-800 flex items-center gap-1 mb-0.5">
                      <UserCheck className="w-3 h-3 text-amber-600" />
                      部門長・所属長
                    </div>
                    <div className="font-black text-xs text-slate-900">
                      {dept.manager_user_name || '（未指定）'}
                    </div>
                  </div>

                  {/* 所属メンバー一覧 */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400">所属メンバー:</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto print:max-h-none text-xs">
                      {deptMembers.length > 0 ? (
                        deptMembers.map(m => (
                          <div key={m.id} className="flex items-center justify-between py-1 px-2 bg-slate-50 rounded-lg text-[11px]">
                            <span className="font-bold text-slate-800">{m.name}</span>
                            <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {m.position_name || '一般'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-slate-400 py-1 text-center bg-slate-50 rounded">所属メンバーなし</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 組織図フッター */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 gap-2">
            <div>※ 本組織図はシステム上で自動生成された公式組織構成表です。全従業員数: {allMembers.length}名</div>
            <div>{companyInfo.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
