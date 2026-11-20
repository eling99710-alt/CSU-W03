import React from 'react';
import { ShieldCheck, BookOpen, Clock } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-100 border-t border-slate-200 mt-12 py-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              嚴格遵守 <strong>SPEC.md</strong> 規範：所有計算於瀏覽器端即時完成，零外部資料傳輸。
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>每週迭代新增小工具</span>
            </span>
            <span className="flex items-center space-x-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>水質檢驗品管 QA/QC 規範認證</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
