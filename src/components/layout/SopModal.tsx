import React from 'react';
import { X, BookOpen, AlertCircle } from 'lucide-react';

interface SopModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sopContent: {
    purpose: string;
    methodReference?: string;
    formulas: { name: string; formula: string; description: string }[];
    qcCriteria: { rule: string; threshold: string; action: string }[];
    steps: string[];
    tips?: string[];
  };
}

export const SopModal: React.FC<SopModalProps> = ({
  isOpen,
  onClose,
  title,
  sopContent,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">{title} — SOP 與計算原理</h3>
              <p className="text-xs text-slate-500">水質檢驗標準方法操作指引與品管判讀規範</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Purpose */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-1.5 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              <span>適用目的與法規依據</span>
            </h4>
            <p className="text-slate-600 bg-teal-50/50 p-3 rounded-lg border border-teal-100/60 text-xs leading-relaxed">
              {sopContent.purpose}
              {sopContent.methodReference && (
                <span className="block mt-1 font-medium text-teal-850">
                  參考規範：{sopContent.methodReference}
                </span>
              )}
            </p>
          </div>

          {/* Formulas */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>核心計算公式</span>
            </h4>
            <div className="space-y-2">
              {sopContent.formulas.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                  <div className="font-medium text-xs text-slate-800">{item.name}</div>
                  <div className="font-mono text-xs bg-white px-2.5 py-1.5 rounded border border-slate-200 my-1 text-teal-900 font-semibold">
                    {item.formula}
                  </div>
                  <div className="text-xs text-slate-500">{item.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* QC Criteria */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>品管容許標準（QA/QC Criteria）</span>
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">查核項目</th>
                    <th className="px-3 py-2 text-left font-medium">合格門檻</th>
                    <th className="px-3 py-2 text-left font-medium">未達標準處理處置</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sopContent.qcCriteria.map((qc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-medium text-slate-800">{qc.rule}</td>
                      <td className="px-3 py-2 text-emerald-700 font-semibold">{qc.threshold}</td>
                      <td className="px-3 py-2 text-amber-700">{qc.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Steps */}
          <div>
            <h4 className="font-semibold text-slate-900 mb-2 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>操作步驟（SOP Checklist）</span>
            </h4>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 pl-1">
              {sopContent.steps.map((step, idx) => (
                <li key={idx} className="leading-relaxed">
                  <span className="text-slate-800">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          {sopContent.tips && sopContent.tips.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>分析員特別提醒</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800 pl-1">
                {sopContent.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
          >
            我瞭解了，開始操作
          </button>
        </div>
      </div>
    </div>
  );
};
