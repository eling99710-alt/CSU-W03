import React from 'react';
import { FlaskConical, ShieldCheck, ChevronRight, Home } from 'lucide-react';
import { ToolMetadata } from '../../config/toolsRegistry';

interface NavbarProps {
  currentTool: ToolMetadata | null;
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTool, onNavigateHome }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onNavigateHome}
            className="flex items-center space-x-2.5 text-slate-800 hover:text-teal-700 transition group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight flex items-center space-x-1.5">
                <span>我的實驗室工具箱</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-teal-100 text-teal-850 font-medium">
                  Lab v1.0
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                水質檢驗與環境分析專用
              </div>
            </div>
          </button>

          {/* Breadcrumb if inside tool */}
          {currentTool && (
            <div className="hidden sm:flex items-center text-sm text-slate-400 space-x-2 ml-4 pl-4 border-l border-slate-200">
              <button
                onClick={onNavigateHome}
                className="hover:text-slate-700 flex items-center space-x-1"
              >
                <Home className="w-3.5 h-3.5" />
                <span>工具目錄</span>
              </button>
              <ChevronRight className="w-4 h-4 text-slate-300" />
              <span className="font-semibold text-slate-800">{currentTool.name}</span>
            </div>
          )}
        </div>

        {/* Right Status Badge */}
        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline">100% 本機端純運算・數據不上傳伺服器</span>
            <span className="md:hidden">本機純運算</span>
          </div>
        </div>
      </div>
    </header>
  );
};
