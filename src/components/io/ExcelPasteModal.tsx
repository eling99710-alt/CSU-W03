import React, { useState } from 'react';
import { X, ClipboardPaste, Check, AlertCircle } from 'lucide-react';

interface ColumnMapping {
  key: string;
  label: string;
  required?: boolean;
}

interface ExcelPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  columns: ColumnMapping[];
  onImport: (rows: Record<string, number | string>[]) => void;
}

export const ExcelPasteModal: React.FC<ExcelPasteModalProps> = ({
  isOpen,
  onClose,
  title = '從 Excel 複製貼上數據',
  columns,
  onImport,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setPasteText(text);

    if (!text.trim()) {
      setParsedRows([]);
      setErrorMsg(null);
      return;
    }

    // 解析每行以 Tab 分隔的文字
    const lines = text
      .trim()
      .split(/\r?\n/)
      .map(line => line.split('\t').map(c => c.trim()))
      .filter(row => row.some(cell => cell.length > 0));

    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    setParsedRows(lines);
    setErrorMsg(null);
  };

  const handleConfirm = () => {
    if (parsedRows.length === 0) {
      setErrorMsg('請先貼上資料！');
      return;
    }

    try {
      // 判斷第一列是否為標題列
      let startIdx = 0;
      const firstRow = parsedRows[0];
      const isHeader = firstRow.some(cell => isNaN(Number(cell)) && cell.length > 0);
      if (isHeader) {
        startIdx = 1;
      }

      const rowsToConvert = parsedRows.slice(startIdx);
      const result: Record<string, number | string>[] = [];

      for (const row of rowsToConvert) {
        const item: Record<string, number | string> = {};
        columns.forEach((col, idx) => {
          const val = row[idx] ?? '';
          const num = Number(val);
          item[col.key] = !isNaN(num) && val !== '' ? num : val;
        });
        result.push(item);
      }

      onImport(result);
      onClose();
      setPasteText('');
      setParsedRows([]);
    } catch (err) {
      setErrorMsg('解析失敗，請確認欄位順序與格式！');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <ClipboardPaste className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="text-slate-600 space-y-1">
            <p>
              請在 Excel 中選取並複製資料欄位（含或不含標題列皆可），直接在下方貼上（Ctrl+V）：
            </p>
            <div className="flex items-center space-x-1 text-slate-500 font-mono text-[11px] bg-slate-100 p-2 rounded">
              <span>欄位對齊順序：</span>
              {columns.map((c, i) => (
                <span key={c.key} className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                  {i + 1}. {c.label}
                </span>
              ))}
            </div>
          </div>

          <textarea
            value={pasteText}
            onChange={handleTextChange}
            placeholder="點此按 Ctrl + V 貼上 Excel 資料..."
            rows={5}
            className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-y"
          />

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-1.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div>
              <div className="font-semibold text-slate-700 mb-1.5 flex justify-between">
                <span>解析預覽（偵測到 {parsedRows.length} 列）：</span>
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-slate-500 font-medium">#</th>
                      {columns.map(c => (
                        <th key={c.key} className="px-2 py-1.5 text-left text-slate-700 font-semibold">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.slice(0, 10).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        <td className="px-2 py-1 text-slate-400">{rIdx + 1}</td>
                        {columns.map((_, cIdx) => (
                          <td key={cIdx} className="px-2 py-1 font-mono text-slate-800">
                            {row[cIdx] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="text-[10px] text-slate-400 mt-1 text-right">
                  （僅預覽前 10 筆，其餘將全數匯入）
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => {
              setPasteText('');
              setParsedRows([]);
            }}
            className="px-3 py-1.5 text-slate-500 hover:text-slate-800 transition"
          >
            清空文字
          </button>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={parsedRows.length === 0}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition shadow-sm disabled:opacity-50 flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>匯入數據 ({parsedRows.length} 筆)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
