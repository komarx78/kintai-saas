import { type FC } from 'react';
import { X, Printer, Building2, UserCheck, Users, Crown } from 'lucide-react';
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
      {/* 印刷用CSS定義 */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm 10mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }
        }
      `}</style>
      <div className="bg-white rounded-3xl max-w-7xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-4 print:m-0 print:p-6 print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* 操作ヘッダー（印刷時は非表示） */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-800 text-base">会社組織図（ツリー型） プレビュー ＆ A4印刷</h3>
              <p className="text-xs text-slate-400">経営層から各部門・所属員までをツリー構造で高精細に出力します（PDF保存対応）</p>
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

        {/* 🖨️ 印刷用 ツリー型 組織図本体 */}
        <div className="space-y-6 text-slate-800 font-sans print:space-y-4">
          {/* 組織図公式ヘッダー */}
          <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Organization Tree Chart</div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {companyInfo.name || '株式会社KAP'}　組織図
              </h1>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <div className="font-bold text-slate-800">基準日: {todayStr} 現在</div>
              <div className="text-[11px] text-slate-600 font-bold">{companyInfo.representative_name}</div>
              <div className="text-[10px] text-slate-500">{companyInfo.address}</div>
            </div>
          </div>

          {/* 🌳 ツリー構造コンテナ（水平スクロール対応・左端見切れ完全防止） */}
          <div className="py-2 overflow-x-auto w-full">
            <div className="w-max min-w-full flex flex-col items-center mx-auto px-4 pb-4 pt-2">
              {/* 1. 最上段（Level 1: 経営陣・トップノード） */}
              <div className="flex justify-center">
                <div className="bg-slate-900 text-white p-4 rounded-2xl border-2 border-slate-800 shadow-md min-w-[280px] max-w-md text-center space-y-2 print:border-slate-800 print:shadow-none">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1">
                    <Crown className="w-3.5 h-3.5" />
                    Management / 経営陣・役員
                  </div>
                  <div className="space-y-1">
                    {executives.length > 0 ? (
                      executives.map(exec => (
                        <div key={exec.id} className="flex items-center justify-between bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                          <span className="text-[10px] text-amber-300 font-bold">{exec.position_name || '役員'}</span>
                          <span className="font-black text-white text-sm">{exec.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-between bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                        <span className="text-[10px] text-amber-300 font-bold">代表取締役</span>
                        <span className="font-black text-white text-sm">{companyInfo.representative_name.replace('代表取締役', '').trim() || '代表取締役'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 🌳 幹線コネクター（垂直メインステム） */}
              <div className="flex justify-center">
                <div className="w-0.5 h-6 bg-slate-800 print:bg-slate-900"></div>
              </div>

              {/* 🌳 水平分配ライン ＆ 部門ブランチ（何部門あっても等幅・水平バー連結で展開） */}
              {departments.length > 0 && (
                <div className="flex items-start justify-center">
                  {departments.map((dept, idx) => {
                    const deptMembers = dept.members || [];
                    const regularMembers = deptMembers.filter(m => m.id !== dept.manager_user_id);
                    const isFirst = idx === 0;
                    const isLast = idx === departments.length - 1;
                    const isOnly = departments.length === 1;

                    return (
                      <div key={dept.id} className="w-[250px] sm:w-[270px] shrink-0 px-2 flex flex-col items-center">
                        {/* 🌳 水平バーと垂直枝線（コネクター：px-2と連動して途切れなく完全連結） */}
                        {!isOnly && (
                          <div className="w-full h-5 relative flex justify-center">
                            {/* 左半分の水平バー */}
                            <div className={`h-0.5 bg-slate-800 absolute top-0 left-0 right-1/2 ${isFirst ? 'hidden' : 'block'}`}></div>
                            {/* 右半分の水平バー */}
                            <div className={`h-0.5 bg-slate-800 absolute top-0 left-1/2 right-0 ${isLast ? 'hidden' : 'block'}`}></div>
                            {/* 下向きのドロップ線 */}
                            <div className="w-0.5 h-5 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2"></div>
                          </div>
                        )}
                        {isOnly && (
                          <div className="w-0.5 h-5 bg-slate-800 mb-1"></div>
                        )}

                        {/* 🏢 部門カード（Tree Node） */}
                        <div className="w-full bg-white rounded-2xl border-2 border-slate-800 p-3.5 space-y-3 shadow-xs print:border-slate-800 print:break-inside-avoid">
                          {/* 部署タイトル */}
                          <div className="bg-slate-100 p-2 rounded-xl flex items-center justify-between border border-slate-300">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <h4 className="text-xs font-black text-slate-900 truncate" title={dept.name}>{dept.name}</h4>
                            </div>
                            <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                              {deptMembers.length}名
                            </span>
                          </div>

                          {/* 部門長・所属長ノード（上位ノード） */}
                          <div className="bg-amber-50/80 border-2 border-amber-300 p-2.5 rounded-xl space-y-0.5 text-center shadow-2xs">
                            <div className="text-[9px] font-black text-amber-800 uppercase tracking-wider flex items-center justify-center gap-1">
                              <UserCheck className="w-3 h-3 text-amber-600" />
                              部門責任者（所属長）
                            </div>
                            <div className="font-black text-xs text-slate-900 truncate" title={dept.manager_user_name || '（未指定）'}>
                              {dept.manager_user_name || '（未指定）'}
                            </div>
                          </div>

                          {/* 所属メンバー ツリー配下ブランチ */}
                          <div className="pt-2 border-t border-slate-200 space-y-1.5">
                            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              配下所属メンバー:
                            </div>

                            <div className="space-y-1.5 pl-2 border-l-2 border-slate-300 text-xs">
                              {regularMembers.length > 0 ? (
                                regularMembers.map(m => (
                                  <div
                                    key={m.id}
                                    className="relative flex items-center justify-between py-1 px-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] before:absolute before:-left-2 before:top-1/2 before:w-2 before:h-0.5 before:bg-slate-300"
                                  >
                                    <span className="font-bold text-slate-800 truncate mr-1" title={m.name}>{m.name}</span>
                                    <span className="text-[9px] font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                                      {m.position_name || '一般'}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] text-slate-400 py-1 italic">
                                  {dept.manager_user_name ? '（所属長のみ）' : '所属メンバーなし'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 組織図公式フッター */}
          <div className="pt-4 border-t-2 border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-500 font-bold gap-2">
            <div>※ 本組織図はシステム上で自動生成された公式組織構成図（ツリー型）です。全社総人員: {allMembers.length}名</div>
            <div>{companyInfo.name}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

