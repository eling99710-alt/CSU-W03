import React, { useState } from 'react';
import { Copy, RefreshCw, Check, FileSpreadsheet, Image as ImageIcon, FileText } from 'lucide-react';

interface ExportToolbarProps {
  onCopyText: () => string;
  onExportExcel: () => void;
  onExportPng?: () => void;
  onExportPdf?: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  onCopyText,
  onExportExcel,
  onExportPng,
  onExportPdf,
  onReset,
  disabled = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleCopy = async () => {
    try {
      const text = onCopyText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
      {/* Reset with safety confirmation */}
      <div className="relative">
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={disabled}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
            <span>清空重設</span>
          </button>
        ) : (
          <div className="flex items-center space-x-1 animate-fadeIn">
            <span className="text-xs text-rose-600 font-medium">確定清空？</span>
            <button
              onClick={() => {
                onReset();
                setShowResetConfirm(false);
              }}
              className="px-2.5 py-1 text-xs bg-rose-600 text-white rounded hover:bg-rose-700 font-medium shadow-sm"
            >
              確定
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* Export Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Copy Report */}
        <button
          onClick={handleCopy}
          disabled={disabled}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
            copied
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
          title="複製格式化文字，便於貼入電子實驗紀錄本 ELN 或報告"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '已複製到剪貼簿！' : '一鍵複製報告'}</span>
        </button>

        {/* Export Excel */}
        <button
          onClick={onExportExcel}
          disabled={disabled}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition"
          title="匯出完整計算 Excel 試算表"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>匯出 Excel (.xlsx)</span>
        </button>

        {/* Export Chart PNG */}
        {onExportPng && (
          <button
            onClick={onExportPng}
            disabled={disabled}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
            title="下載高解析度檢量線圖表圖片"
          >
            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>下載圖表 (PNG)</span>
          </button>
        )}

        {/* Export PDF */}
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            disabled={disabled}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition"
            title="下載簡要檢驗成果 PDF"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>匯出 PDF</span>
          </button>
        )}
      </div>
    </div>
  );
};
