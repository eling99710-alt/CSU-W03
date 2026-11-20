import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  HelpCircle,
  Upload,
  Sparkles,
  AlertOctagon,
  CheckCircle2,
  Table,
  FileSpreadsheet,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

import {
  PesticideLimit,
  DEFAULT_PESTICIDE_LIMITS,
  RawBatchItem,
  ProcessedBatchItem,
  evaluateBatchItem,
  generateMatrixPivot,
  MatrixPivotRow,
} from './batchMergerMath';
import { DEMO_BATCH_DATA } from './demoBatchData';
import { formatNum } from '../../utils/formatters';
import { saveDraft, loadDraft, clearDraft } from '../../utils/storage';
import { SopModal } from '../../components/layout/SopModal';
import { ExportToolbar } from '../../components/io/ExportToolbar';

export const BatchMergerTool: React.FC = () => {
  // State
  const [limits, setLimits] = useState<PesticideLimit[]>(() => {
    return loadDraft('batch_merger_limits', DEFAULT_PESTICIDE_LIMITS);
  });
  const [batchItems, setBatchItems] = useState<RawBatchItem[]>(() => {
    return loadDraft('batch_merger_items', DEMO_BATCH_DATA);
  });

  // UI View States
  const [viewMode, setViewMode] = useState<'pivot' | 'long'>('pivot');
  const [matrixFilter, setMatrixFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'exceeded' | 'detected'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSopOpen, setIsSopOpen] = useState(false);

  // Auto-save drafts
  useEffect(() => {
    saveDraft('batch_merger_items', batchItems);
  }, [batchItems]);

  useEffect(() => {
    saveDraft('batch_merger_limits', limits);
  }, [limits]);

  // Evaluate all batch items
  const processedItems: ProcessedBatchItem[] = useMemo(() => {
    return batchItems.map(item => evaluateBatchItem(item, limits));
  }, [batchItems, limits]);

  // Exceedance list (violations)
  const exceedanceList: ProcessedBatchItem[] = useMemo(() => {
    return processedItems.filter(item => item.isExceeded);
  }, [processedItems]);

  // Pivot Matrix
  const pivotRows: MatrixPivotRow[] = useMemo(() => {
    return generateMatrixPivot(processedItems);
  }, [processedItems]);

  // KPI Statistics
  const stats = useMemo(() => {
    const totalItems = processedItems.length;
    const uniqueBatches = Array.from(new Set(processedItems.map(i => i.batchId))).length;
    const uniqueSamples = Array.from(new Set(processedItems.map(i => `${i.batchId}_${i.sampleId}`))).length;
    const exceededItems = exceedanceList.length;
    const exceededSamples = Array.from(new Set(exceedanceList.map(i => `${i.batchId}_${i.sampleId}`))).length;
    const multiExceededSamples = pivotRows.filter(p => p.exceededCount > 1).length;

    return {
      totalItems,
      uniqueBatches,
      uniqueSamples,
      exceededItems,
      exceededSamples,
      multiExceededSamples,
      exceedanceRate: totalItems > 0 ? ((exceededItems / totalItems) * 100).toFixed(1) : '0',
    };
  }, [processedItems, exceedanceList, pivotRows]);

  // Filtered Long Table items
  const filteredLongItems = useMemo(() => {
    return processedItems.filter(item => {
      const matchMatrix = matrixFilter === 'all' || item.matrix === matrixFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'exceeded' && item.isExceeded) ||
        (statusFilter === 'detected' && item.status !== 'PASS_LOQ');
      const matchQuery =
        searchQuery === '' ||
        item.sampleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.analyte.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.chineseAnalyte.includes(searchQuery) ||
        item.batchId.includes(searchQuery);

      return matchMatrix && matchStatus && matchQuery;
    });
  }, [processedItems, matrixFilter, statusFilter, searchQuery]);

  // Filtered Pivot Table items
  const filteredPivotRows = useMemo(() => {
    return pivotRows.filter(row => {
      const matchMatrix = matrixFilter === 'all' || row.matrix === matrixFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'exceeded' && row.exceededCount > 0) ||
        (statusFilter === 'detected' && row.detectedCount > 0);
      const matchQuery =
        searchQuery === '' ||
        row.sampleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.matrix.includes(searchQuery) ||
        row.batchId.includes(searchQuery);

      return matchMatrix && matchStatus && matchQuery;
    });
  }, [pivotRows, matrixFilter, statusFilter, searchQuery]);

  // Handlers
  const handleLoadDemo = () => {
    setLimits(DEFAULT_PESTICIDE_LIMITS);
    setBatchItems(DEMO_BATCH_DATA);
  };

  const handleReset = () => {
    clearDraft('batch_merger_items');
    clearDraft('batch_merger_limits');
    setLimits(DEFAULT_PESTICIDE_LIMITS);
    setBatchItems(DEMO_BATCH_DATA);
  };

  // Multi-file upload for batches
  const handleBatchFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allNewItems: RawBatchItem[] = [];
    let filesProcessed = 0;

    Array.from(files).forEach((file, fIdx) => {
      // 嘗試從檔名擷取批次來源日期
      let batchId = file.name.replace(/\.[^/.]+$/, '');
      const matchDate = file.name.match(/\d{8}/);
      if (matchDate) {
        const d = matchDate[0];
        batchId = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          if (rows.length >= 2) {
            const headers = (rows[0] || []).map((h: any) => String(h || '').trim().toLowerCase());

            // 智慧別名映射
            const sampleIdCol = headers.findIndex((h: string) => h.includes('sample') || h.includes('編號') || h.includes('樣品'));
            const matrixCol = headers.findIndex((h: string) => h.includes('matrix') || h.includes('基質') || h.includes('品項') || h.includes('蔬菜'));
            const analyteCol = headers.findIndex((h: string) => h.includes('analyte') || h.includes('化合物') || h.includes('農藥') || h.includes('分析物'));
            const areaCol = headers.findIndex((h: string) => (h.includes('area') && !h.includes('is') && !h.includes('istd')) || h.includes('面積') || h.includes('peak'));
            const isAreaCol = headers.findIndex((h: string) => h.includes('is area') || h.includes('istd') || h.includes('內標'));
            const concCol = headers.findIndex((h: string) => h.includes('conc') || h.includes('濃度'));

            for (let r = 1; r < rows.length; r++) {
              const row = rows[r];
              if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === '')) continue;

              const sampleId = sampleIdCol !== -1 ? String(row[sampleIdCol] ?? '').trim() : String(row[0] ?? '').trim();
              const matrix = matrixCol !== -1 ? String(row[matrixCol] ?? '').trim() : String(row[1] ?? '').trim();
              const analyte = analyteCol !== -1 ? String(row[analyteCol] ?? '').trim() : String(row[2] ?? '').trim();
              const area = areaCol !== -1 ? Number(row[areaCol]) || 0 : Number(row[3]) || 0;
              const isArea = isAreaCol !== -1 ? Number(row[isAreaCol]) || 0 : Number(row[4]) || 0;
              const calcConcRaw = concCol !== -1 ? String(row[concCol] ?? '').trim() : String(row[5] ?? '').trim();

              allNewItems.push({
                id: `upload-${batchId}-${fIdx}-${r}`,
                batchId,
                sampleId,
                matrix,
                analyte,
                area,
                isArea,
                calcConcRaw,
              });
            }
          }
        } catch (err) {
          console.error(`解析檔案 ${file.name} 失敗`, err);
        } finally {
          filesProcessed += 1;
          if (filesProcessed === files.length) {
            if (allNewItems.length > 0) {
              setBatchItems(allNewItems);
              alert(`成功匯入 ${files.length} 個檔案，共整合 ${allNewItems.length} 筆檢測項目！`);
            } else {
              alert('未能識別有效數據，請確認檔案格式！');
            }
          }
        }
      };
      reader.readAsBinaryString(file);
    });

    e.target.value = '';
  };

  // Custom limits upload
  const handleLimitsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const newLimits: PesticideLimit[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;
          const analyte = String(row[0] ?? '').trim();
          const limitMgKg = Number(row[1]);
          const loqMgKg = Number(row[2] ?? 0.01);

          if (analyte && !isNaN(limitMgKg)) {
            newLimits.push({
              analyte,
              chineseName: analyte,
              limitMgKg,
              loqMgKg: !isNaN(loqMgKg) ? loqMgKg : 0.01,
            });
          }
        }

        if (newLimits.length > 0) {
          setLimits(newLimits);
          alert(`成功更新 ${newLimits.length} 項農藥容許量標準！`);
        } else {
          alert('未能識別有效農藥標準表，請確認格式（第1欄農藥名、第2欄容許量、第3欄LOQ）。');
        }
      } catch (err) {
        alert('標準表檔案讀取失敗！');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Export to Excel with 3 sheets
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: 超標違規清單
    const exceedData = exceedanceList.map((item, idx) => ({
      '序號': idx + 1,
      '批次來源': item.batchId,
      '樣品編號': item.sampleId,
      '蔬菜品項': item.matrix,
      '超標農藥 (英文)': item.normalizedAnalyte,
      '超標農藥 (中文)': item.chineseAnalyte,
      '檢出濃度 (mg/kg)': item.numericConc,
      '法規容許量 (mg/kg)': item.limitMgKg,
      '超標倍數': `${item.exceedanceRatio} 倍`,
      '判定狀態': '🔴 超標違規',
    }));
    const ws1 = XLSX.utils.json_to_sheet(exceedData);
    XLSX.utils.book_append_sheet(wb, ws1, '超過容許量清單');

    // Sheet 2: 樣品檢出矩陣寬表 (Pivot)
    const pivotData = pivotRows.map(row => {
      const obj: Record<string, any> = {
        '批次來源': row.batchId,
        '樣品編號': row.sampleId,
        '蔬菜品項': row.matrix,
      };
      limits.forEach(l => {
        const res = row.pesticideResults[l.analyte];
        obj[`${l.chineseName} (${l.analyte})`] = res ? res.concDisplay : '-';
      });
      obj['檢出種數'] = row.detectedCount;
      obj['超標種數'] = row.exceededCount;
      obj['總評'] = row.exceededCount > 0 ? `🔴 超標 (${row.exceededCount}種)` : '🟢 全數合格';
      return obj;
    });
    const ws2 = XLSX.utils.json_to_sheet(pivotData);
    XLSX.utils.book_append_sheet(wb, ws2, '樣品檢出矩陣寬表');

    // Sheet 3: 多批次彙整明細總表
    const longData = processedItems.map((item, idx) => ({
      '序號': idx + 1,
      '批次來源': item.batchId,
      '樣品編號': item.sampleId,
      '蔬菜品項': item.matrix,
      '農藥名稱': item.normalizedAnalyte,
      '中文名稱': item.chineseAnalyte,
      '待測物面積': item.area,
      '內標面積': item.isArea,
      '定量濃度 (mg/kg)': item.isLoq ? '<LOQ' : item.numericConc,
      '法規容許量 (mg/kg)': item.limitMgKg,
      'LOQ (mg/kg)': item.loqMgKg,
      '超標倍數': item.exceedanceRatio ? `${item.exceedanceRatio}x` : '-',
      '品管判定': item.statusLabel,
    }));
    const ws3 = XLSX.utils.json_to_sheet(longData);
    XLSX.utils.book_append_sheet(wb, ws3, '多批次彙整明細總表');

    XLSX.writeFile(wb, `農藥殘留多批次彙整成果報告_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Generate ELN markdown summary
  const generateElnSummary = (): string => {
    const lines = [
      `【蔬菜農藥殘留多批次彙整與品管查核報告】`,
      `產出日期：${new Date().toLocaleDateString('zh-TW')}`,
      `彙整批次：共 ${stats.uniqueBatches} 週批次，涵蓋 ${stats.uniqueSamples} 顆蔬菜樣品，總計 ${stats.totalItems} 項農藥檢測`,
      `品管查核統計：超標違規共 ${stats.exceededItems} 項（分布於 ${stats.exceededSamples} 顆蔬菜，其中 ${stats.multiExceededSamples} 顆為多重超標）`,
      ``,
      `--- 🔴 超過法規容許量清單 (Exceedance List) ---`,
      `| 批次 | 樣品編號 | 蔬菜品項 | 超標農藥 | 檢出濃度 (mg/kg) | 容許量 (mg/kg) | 超標倍數 |`,
      `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
    ];

    exceedanceList.forEach(item => {
      lines.push(
        `| ${item.batchId} | ${item.sampleId} | ${item.matrix} | ${item.chineseAnalyte} (${item.normalizedAnalyte}) | **${item.numericConc}** | ${item.limitMgKg} | **${item.exceedanceRatio}x** |`
      );
    });

    lines.push(``);
    lines.push(`處置建議：以上超標樣品請立即通知採樣同仁與供貨農戶暫停出貨，並進行留樣複驗與來源溯源。`);

    return lines.join('\n');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-purple-100 text-purple-800 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <span>多批次檢驗數據彙整與品管查核</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                  農藥殘留與品管
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                跨週次異質欄位自動對齊・農藥大小寫智慧正規化・法規容許量自動比對・超過容許量即時警示
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSopOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition"
          >
            <HelpCircle className="w-4 h-4 text-purple-600" />
            <span>SOP / 判定原理與法規依據</span>
          </button>
        </div>
      </div>

      {/* 2. Action Toolbar: Upload & Demo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-file upload */}
          <label className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
            <Upload className="w-4 h-4 text-purple-600" />
            <span>多批次檔案上傳（可選多檔）</span>
            <input
              type="file"
              multiple
              accept=".csv,.xlsx,.xls"
              onChange={handleBatchFilesUpload}
              className="hidden"
            />
          </label>

          {/* Upload Limits */}
          <label className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
            <FileCheck className="w-4 h-4 text-blue-600" />
            <span>更換容許量標準表</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleLimitsUpload}
              className="hidden"
            />
          </label>

          {/* Load Demo */}
          <button
            onClick={handleLoadDemo}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>載入三週示範批次 (90筆)</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          內建 5 種農藥標準・已相容第 2 週換人匯出欄位
        </div>
      </div>

      {/* 3. KPI Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="text-slate-400 text-[11px] font-medium">總檢測項目</div>
          <div className="text-xl font-black text-slate-800 mt-1">{stats.totalItems} 項</div>
          <div className="text-[10px] text-slate-400 mt-0.5">跨 {stats.uniqueBatches} 週批次・{stats.uniqueSamples} 樣品</div>
        </div>

        <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl shadow-sm">
          <div className="text-rose-800 text-[11px] font-bold flex items-center justify-between">
            <span>🔴 違規超標項數</span>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-900 mt-1">{stats.exceededItems} 筆</div>
          <div className="text-[10px] text-rose-700 mt-0.5">超標率 {stats.exceedanceRate}%</div>
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl shadow-sm">
          <div className="text-amber-800 text-[11px] font-medium flex items-center justify-between">
            <span>超標蔬菜樣品數</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-900 mt-1">{stats.exceededSamples} 顆</div>
          <div className="text-[10px] text-amber-700 mt-0.5">佔全體驗品 {((stats.exceededSamples / (stats.uniqueSamples || 1)) * 100).toFixed(0)}%</div>
        </div>

        <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-2xl shadow-sm">
          <div className="text-purple-800 text-[11px] font-medium">多重超標蔬菜</div>
          <div className="text-xl font-black text-purple-900 mt-1">{stats.multiExceededSamples} 顆</div>
          <div className="text-[10px] text-purple-700 mt-0.5">如 V305 番茄 3 重超標</div>
        </div>

        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl shadow-sm">
          <div className="text-emerald-800 text-[11px] font-medium flex items-center justify-between">
            <span>合格項目數</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-900 mt-1">{stats.totalItems - stats.exceededItems} 項</div>
          <div className="text-[10px] text-emerald-700 mt-0.5">含 &lt;LOQ 與檢出未超標</div>
        </div>
      </div>

      {/* 4. 【超過容許量清單】(Exceedance List) - Prominent View */}
      <div className="bg-white border-2 border-rose-300 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-rose-100">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>超過容許量清單（Exceedance Violations）</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black">
                  共 {exceedanceList.length} 筆超標
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                依據農藥殘留容許量標準判定，檢出濃度高於限量之品項請立即啟動複驗與留樣通報
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-rose-100 rounded-xl">
          <table className="min-w-full divide-y divide-rose-100 text-xs text-left">
            <thead className="bg-rose-50/70 text-rose-900 font-bold">
              <tr>
                <th className="px-3 py-2">批次日期</th>
                <th className="px-3 py-2">樣品編號</th>
                <th className="px-3 py-2">蔬菜品項</th>
                <th className="px-3 py-2">超標農藥 (中文 / 英文)</th>
                <th className="px-3 py-2">檢出濃度 (mg/kg)</th>
                <th className="px-3 py-2">法規容許量 (mg/kg)</th>
                <th className="px-3 py-2">超標倍數</th>
                <th className="px-3 py-2">品管狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100/60 bg-white">
              {exceedanceList.map((item, idx) => (
                <tr key={idx} className="hover:bg-rose-50/40 transition-colors">
                  <td className="px-3 py-2 font-mono text-slate-600 font-semibold">{item.batchId}</td>
                  <td className="px-3 py-2 font-mono font-black text-rose-950">{item.sampleId}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      {item.matrix}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-bold text-rose-900">{item.chineseAnalyte}</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-1.5">({item.normalizedAnalyte})</span>
                  </td>
                  <td className="px-3 py-2 font-mono font-black text-sm text-rose-700">
                    {formatNum(item.numericConc, 4)}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600 font-medium">
                    {item.limitMgKg}
                  </td>
                  <td className="px-3 py-2 font-mono font-black text-rose-600">
                    {item.exceedanceRatio}x
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold border border-rose-300">
                      🔴 超標違規
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 【彙整總表】Dual-View Master Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Section Header with View Switcher & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <span>多批次彙整總表</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                {viewMode === 'pivot' ? `蔬菜樣品矩陣 (${pivotRows.length} 顆蔬菜)` : `檢測明細總表 (${processedItems.length} 項)`}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              切換「矩陣寬表」可一眼檢視蔬菜多重農藥殘留；切換「明細長表」可查看層析面積與原始參數
            </p>
          </div>

          {/* View Mode Toggle Button */}
          <div className="flex items-center space-x-2">
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setViewMode('pivot')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg font-bold transition ${
                  viewMode === 'pivot'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>樣品矩陣寬表 (Pivot)</span>
              </button>
              <button
                onClick={() => setViewMode('long')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg font-bold transition ${
                  viewMode === 'long'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>明細長表 (90項)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Matrix Filter */}
            <select
              value={matrixFilter}
              onChange={(e) => setMatrixFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">全部蔬菜品項</option>
              <option value="小白菜">小白菜</option>
              <option value="番茄">番茄</option>
              <option value="高麗菜">高麗菜</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">全部判定狀態</option>
              <option value="exceeded">僅看超標違規</option>
              <option value="detected">僅看有檢出 (&gt;LOQ)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋批次、樣品編號或農藥..."
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* --- VIEW A: Pivot Matrix Table --- */}
        {viewMode === 'pivot' && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-bold">
                <tr>
                  <th className="px-3 py-2.5">批次日期</th>
                  <th className="px-3 py-2.5">樣品編號</th>
                  <th className="px-3 py-2.5">蔬菜品項</th>
                  {limits.map(l => (
                    <th key={l.analyte} className="px-3 py-2.5">
                      <div>{l.chineseName}</div>
                      <div className="text-[10px] text-slate-400 font-normal font-mono">限量 {l.limitMgKg}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5">檢出統計 / 總體判定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPivotRows.map((row) => {
                  const hasExceeded = row.exceededCount > 0;

                  return (
                    <tr
                      key={row.sampleKey}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        hasExceeded ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">{row.batchId}</td>
                      <td className="px-3 py-2 font-mono font-bold text-slate-900">{row.sampleId}</td>
                      <td className="px-3 py-2 font-medium">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                          {row.matrix}
                        </span>
                      </td>

                      {/* Pesticide Columns */}
                      {limits.map(l => {
                        const cell = row.pesticideResults[l.analyte];
                        if (!cell) return <td key={l.analyte} className="px-3 py-2 text-slate-300">-</td>;

                        const isExceeded = cell.isExceeded;
                        const isDetected = cell.status === 'PASS_DETECTED';

                        return (
                          <td
                            key={l.analyte}
                            className={`px-3 py-2 font-mono text-xs ${
                              isExceeded
                                ? 'bg-rose-100/80 text-rose-900 font-black border-x border-rose-200'
                                : isDetected
                                ? 'bg-amber-50 text-amber-900 font-bold'
                                : 'text-slate-400'
                            }`}
                          >
                            <div>{cell.concDisplay}</div>
                            {isExceeded && cell.ratio && (
                              <div className="text-[10px] text-rose-700 font-bold">({cell.ratio}x 🔴)</div>
                            )}
                          </td>
                        );
                      })}

                      {/* Summary */}
                      <td className="px-3 py-2">
                        {hasExceeded ? (
                          <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300">
                            🔴 超標 ({row.exceededCount} 種超標)
                          </span>
                        ) : row.detectedCount > 0 ? (
                          <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                            🟡 檢出 {row.detectedCount} 種 (全合規)
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                            🟢 未檢出 (&lt;LOQ)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* --- VIEW B: Detailed Long Table --- */}
        {viewMode === 'long' && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2.5">批次來源</th>
                  <th className="px-3 py-2.5">樣品編號</th>
                  <th className="px-3 py-2.5">蔬菜基質</th>
                  <th className="px-3 py-2.5">農藥名稱</th>
                  <th className="px-3 py-2.5">待測物面積</th>
                  <th className="px-3 py-2.5">內標面積</th>
                  <th className="px-3 py-2.5">定量濃度 (mg/kg)</th>
                  <th className="px-3 py-2.5">法規容許量</th>
                  <th className="px-3 py-2.5">超標倍數</th>
                  <th className="px-3 py-2.5">品管判定</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLongItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      item.isExceeded ? 'bg-rose-50/40' : item.status === 'PASS_DETECTED' ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">{item.batchId}</td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{item.sampleId}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{item.matrix}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-900">{item.chineseAnalyte}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-1">({item.normalizedAnalyte})</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{formatNum(item.area, 0)}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{formatNum(item.isArea, 0)}</td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">
                      {item.isLoq ? '<LOQ' : item.numericConc !== null ? formatNum(item.numericConc, 4) : '-'}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{item.limitMgKg ?? '-'}</td>
                    <td className="px-3 py-2 font-mono font-black text-rose-700">
                      {item.exceedanceRatio ? `${item.exceedanceRatio}x` : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {item.isExceeded ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black border border-rose-300">
                          🔴 超標 {item.exceedanceRatio}x
                        </span>
                      ) : item.status === 'PASS_DETECTED' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-medium border border-amber-200">
                          🟡 檢出未超標
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          🟢 &lt;LOQ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Bottom Action Toolbar */}
      <ExportToolbar
        onCopyText={generateElnSummary}
        onExportExcel={handleExportExcel}
        onReset={handleReset}
      />

      {/* SOP Modal */}
      <SopModal
        isOpen={isSopOpen}
        onClose={() => setIsSopOpen(false)}
        title="多批次結果彙整與品管查核器"
        sopContent={{
          purpose:
            '本工具專為實驗室多批次、跨週期或多分析員產出之農藥殘留檢驗數據而設計。能智慧消除欄位別名差異與英文字母大小寫不一致，自動串接法規容許量進行 QA/QC 查核。',
          methodReference: '衛福部食藥署農藥殘留容許量標準、環境部檢驗標準法多重農藥殘留檢驗方法',
          formulas: [
            {
              name: '農藥超標倍數 (Exceedance Ratio)',
              formula: 'Ratio = 檢出濃度 (mg/kg) / 法規容許量 (mg/kg)',
              description: '當 Ratio > 1.0 時判定為超標，Ratio 愈大代表違規程度愈嚴重。',
            },
            {
              name: '「<LOQ」合規判讀準則',
              formula: 'Conc < LOQ ⟹ 報告「未檢出 (ND)」 ⟹ 判定「🟢 合格」',
              description: '即使如芬普尼法規限量 (0.005) 低於儀器 LOQ (0.01)，在低於定量極限時無法可靠定量，實務上判定為未檢出合規。',
            },
            {
              name: '多重農藥殘留雞尾酒效應 (Cocktail Effect)',
              formula: 'Total Detected Count = ∑ (Conc_i ≥ LOQ)',
              description: '透過矩陣寬表即時統計單一蔬菜樣品同時驗出幾種農藥，掌握複合性殘留風險。',
            },
          ],
          qcCriteria: [
            { rule: '加保扶 (Carbofuran)', threshold: '≤ 0.02 mg/kg', action: '超過時通知樣品複驗與暫緩放行' },
            { rule: '益達胺 (Imidacloprid)', threshold: '≤ 0.5 mg/kg', action: '超過時啟動溯源通報' },
            { rule: '亞滅培 (Acetamiprid)', threshold: '≤ 0.2 mg/kg', action: '超過時啟動溯源通報' },
            { rule: '陶斯松 (Chlorpyrifos)', threshold: '≤ 0.05 mg/kg', action: '超過時啟動溯源通報' },
            { rule: '芬普尼 (Fipronil)', threshold: '≤ 0.005 mg/kg', action: '檢出值 ≥ LOQ (0.01) 即屬超標' },
          ],
          steps: [
            '1. 點擊「多批次檔案上傳」，可一次選取多週或多個分析員匯出之 CSV / Excel。',
            '2. 系統自動識別欄位別名並對齊農藥名稱。',
            '3. 檢視最上方之【超過容許量清單】，掌握所有違規項目與超標倍數。',
            '4. 切換「樣品矩陣寬表 (Pivot)」檢視各蔬菜之農藥分佈與多重超標狀況。',
            '5. 點擊「一鍵複製報告」產出主管通報文字，或「匯出 Excel」下載三頁式完整報表。',
          ],
          tips: [
            '第 2 週換人匯出使用全大寫「CARBOFURAN」或中文欄位「化合物」，系統已內建自動匹配相容。',
            '若需更換檢測項目或調整容許量，可點擊「更換容許量標準表」上傳自訂標準檔。',
          ],
        }}
      />
    </div>
  );
};
