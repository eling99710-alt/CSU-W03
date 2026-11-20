import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  HelpCircle,
  Upload,
  ClipboardPaste,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';

import {
  RawSampleInput,
  ProcessedSampleResult,
  MatrixType,
  processAllSamples,
} from './unitConverterMath';
import { DEMO_SAMPLE_DATA } from './demoData';
import { formatNum } from '../../utils/formatters';
import { saveDraft, loadDraft, clearDraft } from '../../utils/storage';
import { SopModal } from '../../components/layout/SopModal';
import { ExcelPasteModal } from '../../components/io/ExcelPasteModal';
import { ExportToolbar } from '../../components/io/ExportToolbar';

export const UnitsTool: React.FC = () => {
  // State
  const [samples, setSamples] = useState<RawSampleInput[]>(() => {
    return loadDraft('units_converter_samples', DEMO_SAMPLE_DATA);
  });
  const [activeFilter, setActiveFilter] = useState<'all' | '水樣' | '土壤' | '食品' | 'warning'>('all');
  const [decimals, setDecimals] = useState<number>(3);
  const [batchMoisture, setBatchMoisture] = useState<number>(15.0);

  // Modals
  const [isSopOpen, setIsSopOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);

  // Auto-save draft
  useEffect(() => {
    saveDraft('units_converter_samples', samples);
  }, [samples]);

  // Process all samples
  const processedSamples: ProcessedSampleResult[] = useMemo(() => {
    return processAllSamples(samples);
  }, [samples]);

  // KPI Statistics
  const stats = useMemo(() => {
    const total = processedSamples.length;
    const passCount = processedSamples.filter(s => s.status === 'PASS').length;
    const warningCount = processedSamples.filter(s => s.status !== 'PASS').length;
    const waterCount = processedSamples.filter(s => s.matrix === '水樣').length;
    const soilCount = processedSamples.filter(s => s.matrix === '土壤').length;
    const foodCount = processedSamples.filter(s => s.matrix === '食品').length;

    return { total, passCount, warningCount, waterCount, soilCount, foodCount };
  }, [processedSamples]);

  // Filtered rows for table
  const displayedSamples = useMemo(() => {
    if (activeFilter === 'all') return processedSamples;
    if (activeFilter === 'warning') return processedSamples.filter(s => s.status !== 'PASS');
    return processedSamples.filter(s => s.matrix === activeFilter);
  }, [processedSamples, activeFilter]);

  // Handlers
  const handleUpdateSample = (id: string, field: keyof RawSampleInput, value: any) => {
    setSamples(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteSample = (id: string) => {
    setSamples(prev => prev.filter(item => item.id !== id));
  };

  const handleAddSample = () => {
    const newRow: RawSampleInput = {
      id: `custom-${Date.now()}`,
      sampleId: `Sample-${samples.length + 1}`,
      matrix: '水樣',
      element: 'Pb',
      rawConc: 1.0,
      unit: 'ug/L',
      dilutionFactor: 1,
    };
    setSamples(prev => [...prev, newRow]);
  };

  const handleApplyBatchMoisture = () => {
    if (isNaN(batchMoisture) || batchMoisture < 0 || batchMoisture >= 100) {
      alert('請輸入有效的含水率百分比 (0% ~ 99.9%)');
      return;
    }
    setSamples(prev =>
      prev.map(s => (s.matrix === '土壤' ? { ...s, moisturePercent: batchMoisture } : s))
    );
  };

  const handleReset = () => {
    clearDraft('units_converter_samples');
    setSamples(DEMO_SAMPLE_DATA);
  };

  const handleLoadDemo = () => {
    setSamples(DEMO_SAMPLE_DATA);
  };

  // File Upload (CSV / Excel)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          alert('試算表內容列數不足！');
          return;
        }

        // 智慧標題欄位辨識
        const headers = (rows[0] || []).map((h: any) => String(h || '').trim());
        const idCol = headers.findIndex((h: string) => h.includes('編號') || h.toLowerCase().includes('id'));
        const matrixCol = headers.findIndex((h: string) => h.includes('類型') || h.includes('基質') || h.toLowerCase().includes('matrix'));
        const elemCol = headers.findIndex((h: string) => h.includes('元素') || h.toLowerCase().includes('element'));
        const concCol = headers.findIndex((h: string) => h.includes('濃度') || h.toLowerCase().includes('conc'));
        const unitCol = headers.findIndex((h: string) => h.includes('單位') || h.toLowerCase().includes('unit'));
        const dfCol = headers.findIndex((h: string) => h.includes('稀釋') || h.toLowerCase().includes('df'));
        const volCol = headers.findIndex((h: string) => h.includes('體積') || h.includes('定容') || h.toLowerCase().includes('vol'));
        const wtCol = headers.findIndex((h: string) => h.includes('重') || h.toLowerCase().includes('weight') || h.toLowerCase().includes('wt'));
        const moistCol = headers.findIndex((h: string) => h.includes('水') || h.toLowerCase().includes('moist'));

        const parsedRows: RawSampleInput[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === '')) continue;

          const sampleId = idCol !== -1 ? String(row[idCol] ?? '') : String(row[0] ?? '');
          const matrixRaw = matrixCol !== -1 ? String(row[matrixCol] ?? '水樣') : '水樣';
          const matrix: MatrixType = matrixRaw.includes('土') ? '土壤' : matrixRaw.includes('食') ? '食品' : '水樣';
          const element = elemCol !== -1 ? String(row[elemCol] ?? '未知') : String(row[2] ?? '未知');
          const rawConc = concCol !== -1 ? row[concCol] : row[3];
          const unit = unitCol !== -1 ? String(row[unitCol] ?? 'ug/L') : String(row[4] ?? 'ug/L');
          const df = dfCol !== -1 ? Number(row[dfCol]) || 1 : Number(row[5]) || 1;
          const vol = volCol !== -1 && row[volCol] !== undefined && row[volCol] !== '' ? Number(row[volCol]) : undefined;
          const wt = wtCol !== -1 && row[wtCol] !== undefined && row[wtCol] !== '' ? Number(row[wtCol]) : undefined;
          const moisture = moistCol !== -1 && row[moistCol] !== undefined && row[moistCol] !== '' ? Number(row[moistCol]) : 0;

          parsedRows.push({
            id: `import-${Date.now()}-${i}`,
            sampleId,
            matrix,
            element,
            rawConc,
            unit,
            dilutionFactor: df,
            digestionVolume: vol,
            sampleWeight: wt,
            moisturePercent: moisture,
          });
        }

        if (parsedRows.length > 0) {
          setSamples(parsedRows);
          alert(`成功解析匯入 ${parsedRows.length} 筆樣品數據！`);
        } else {
          alert('未能識別有效數據行，請確認檔案欄位名稱！');
        }
      } catch (err) {
        alert('檔案讀取失敗，請確認檔案格式是否正確。');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: 換算報告總表
    const mainData = processedSamples.map((s, idx) => ({
      '序號': idx + 1,
      '樣品編號': s.sampleId,
      '樣品類型': s.matrix,
      '檢測元素': s.element,
      '原始上機濃度': s.rawConc !== '' && s.rawConc !== null ? Number(s.rawConc) : '缺失',
      '原始單位': s.unit,
      '稀釋倍數 (DF)': s.dilutionFactor,
      '定容體積 (mL)': s.digestionVolume ?? '-',
      '樣品重 (g)': s.sampleWeight ?? '-',
      '含水率 (%)': s.matrix === '土壤' ? `${s.moisturePercent ?? 0}%` : '-',
      '標準化濃度 (µg/L)': s.normalizedConc ? Number(s.normalizedConc.toFixed(decimals)) : '-',
      '★ 報告濃度': s.reportConc !== null ? Number(s.reportConc.toFixed(decimals)) : '無法計算',
      '報告單位': s.reportUnit,
      '品管狀態': s.statusMessage,
    }));
    const ws1 = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, ws1, '換算報告總表');

    // Sheet 2: 異常清單
    const warnings = processedSamples
      .filter(s => s.status !== 'PASS')
      .map(s => ({
        '樣品編號': s.sampleId,
        '基質': s.matrix,
        '元素': s.element,
        '異常項目': s.statusMessage,
        '原始上機值': s.rawConc ?? '空值',
        '原始單位': s.unit,
      }));
    if (warnings.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(warnings);
      XLSX.utils.book_append_sheet(wb, ws2, '異常樣品清單');
    }

    XLSX.writeFile(wb, `檢驗數據單位換算報告_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Generate ELN text summary
  const generateElnSummary = (): string => {
    const lines = [
      `【實驗室檢驗數據稀釋與單位換算報告】`,
      `分析日期：${new Date().toLocaleDateString('zh-TW')}`,
      `樣品統計：總計 ${stats.total} 筆，換算成功 ${stats.passCount} 筆，異常需注意 ${stats.warningCount} 筆`,
      ``,
      `| 樣品編號 | 基質 | 元素 | 原始上機 | 稀釋 | 定容/稱重 | 報告濃度 | 狀態 |`,
      `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`,
    ];

    processedSamples.forEach(s => {
      const prepStr = s.matrix === '水樣' ? '-' : `${s.digestionVolume || '-'}mL/${s.sampleWeight || '-'}g`;
      const concStr = s.reportConc !== null ? `${formatNum(s.reportConc, decimals)} ${s.reportUnit}` : '無法計算';
      lines.push(
        `| ${s.sampleId} | ${s.matrix} | ${s.element} | ${s.rawConc || '無'} ${s.unit} | ${s.dilutionFactor}x | ${prepStr} | **${concStr}** | ${s.status === 'PASS' ? '合格' : s.statusMessage} |`
      );
    });

    return lines.join('\n');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <span>稀釋與單位換算器</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                  多基質前處理規範
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                水樣（µg/L）、土壤（乾基 mg/kg）與食品（mg/kg）批量單位正規化、自動清洗空格與髒資料防呆
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSopOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>SOP / 計算原理與法規規範</span>
          </button>
        </div>
      </div>

      {/* 2. Top Action Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* File Upload */}
          <label className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>上傳 CSV / Excel</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Paste Excel */}
          <button
            onClick={() => setIsPasteOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <ClipboardPaste className="w-4 h-4 text-teal-600" />
            <span>貼上 Excel 表格</span>
          </button>

          {/* Load Demo */}
          <button
            onClick={handleLoadDemo}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>載入示範資料 (16筆)</span>
          </button>

          {/* Add Manual Row */}
          <button
            onClick={handleAddSample}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>手動加一筆</span>
          </button>
        </div>

        {/* Decimal places selector */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 font-medium">報告小數點：</span>
          <select
            value={decimals}
            onChange={(e) => setDecimals(Number(e.target.value))}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={2}>2 位小數</option>
            <option value={3}>3 位小數</option>
            <option value={4}>4 位小數</option>
          </select>
        </div>
      </div>

      {/* 3. KPI Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="text-slate-400 text-[11px] font-medium flex items-center justify-between">
            <span>總樣品數</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-800 mt-1">{stats.total} 筆</div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            水 {stats.waterCount}・土 {stats.soilCount}・食 {stats.foodCount}
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl shadow-sm">
          <div className="text-emerald-700 text-[11px] font-medium flex items-center justify-between">
            <span>換算成功</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-800 mt-1">{stats.passCount} 筆</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">單位與前處理完整</div>
        </div>

        <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-2xl shadow-sm">
          <div className="text-amber-800 text-[11px] font-medium flex items-center justify-between">
            <span>異常 / 需注意</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-900 mt-1">{stats.warningCount} 筆</div>
          <div className="text-[10px] text-amber-700 mt-0.5">缺值或未校正乾基</div>
        </div>

        <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="text-blue-700 text-[11px] font-medium">基準單位正規化</div>
          <div className="text-xs font-bold text-blue-900 mt-1">100% 本機自動折算</div>
          <div className="text-[10px] text-blue-600">ppm / ppb / mg / µg 智慧映射</div>
        </div>
      </div>

      {/* 4. Filter Tabs & Soil Batch Moisture Setting */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                activeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部樣品 ({stats.total})
            </button>
            <button
              onClick={() => setActiveFilter('水樣')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                activeFilter === '水樣'
                  ? 'bg-blue-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              水樣 ({stats.waterCount})
            </button>
            <button
              onClick={() => setActiveFilter('土壤')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                activeFilter === '土壤'
                  ? 'bg-amber-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              土壤 ({stats.soilCount})
            </button>
            <button
              onClick={() => setActiveFilter('食品')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                activeFilter === '食品'
                  ? 'bg-emerald-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              食品 ({stats.foodCount})
            </button>
            <button
              onClick={() => setActiveFilter('warning')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                activeFilter === 'warning'
                  ? 'bg-rose-600 text-white shadow-sm font-bold'
                  : 'text-rose-600 hover:text-rose-800'
              }`}
            >
              僅看異常 ({stats.warningCount})
            </button>
          </div>

          {/* Batch Soil Moisture tool */}
          <div className="flex items-center space-x-1.5 text-xs bg-amber-50/70 border border-amber-200/80 px-3 py-1.5 rounded-xl">
            <span className="text-amber-800 font-medium">批次設定土壤含水率：</span>
            <input
              type="number"
              step="0.1"
              value={batchMoisture}
              onChange={(e) => setBatchMoisture(Number(e.target.value))}
              className="w-16 px-1.5 py-0.5 bg-white border border-amber-300 rounded text-center text-amber-900 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-amber-700 font-semibold">%</span>
            <button
              onClick={handleApplyBatchMoisture}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition shadow-sm ml-1"
            >
              套用至全部土壤
            </button>
          </div>
        </div>

        {/* 5. Interactive Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-2.5 py-2.5 w-8">#</th>
                <th className="px-3 py-2.5">樣品編號</th>
                <th className="px-2.5 py-2.5">基質</th>
                <th className="px-2.5 py-2.5">元素</th>
                <th className="px-2.5 py-2.5">原始上機濃度</th>
                <th className="px-2.5 py-2.5">上機單位</th>
                <th className="px-2.5 py-2.5">稀釋(DF)</th>
                <th className="px-2.5 py-2.5">定容(mL)</th>
                <th className="px-2.5 py-2.5">樣品重(g)</th>
                <th className="px-2.5 py-2.5">含水率(%)</th>
                <th className="px-3 py-2.5 bg-teal-50/60 text-teal-900 font-bold">★ 報告濃度</th>
                <th className="px-2.5 py-2.5 bg-teal-50/60 text-teal-900 font-bold">報告單位</th>
                <th className="px-3 py-2.5">品管檢核狀態</th>
                <th className="px-2 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {displayedSamples.map((s, idx) => {
                const isWater = s.matrix === '水樣';
                const isSoil = s.matrix === '土壤';
                const isPass = s.status === 'PASS';
                const isMissing = s.status === 'MISSING_VALUE';

                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isMissing ? 'bg-rose-50/40' : s.status === 'WET_BASIS_WARNING' ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    <td className="px-2.5 py-2 text-slate-400 text-[11px]">{idx + 1}</td>

                    {/* Sample ID */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={s.sampleId}
                        onChange={(e) => handleUpdateSample(s.id, 'sampleId', e.target.value)}
                        className="w-24 px-1.5 py-1 font-mono font-medium border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Matrix */}
                    <td className="px-2.5 py-2">
                      <select
                        value={s.matrix}
                        onChange={(e) => handleUpdateSample(s.id, 'matrix', e.target.value as MatrixType)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                          s.matrix === '水樣'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : s.matrix === '土壤'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <option value="水樣">水樣</option>
                        <option value="土壤">土壤</option>
                        <option value="食品">食品</option>
                      </select>
                    </td>

                    {/* Element */}
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={s.element}
                        onChange={(e) => handleUpdateSample(s.id, 'element', e.target.value)}
                        className="w-12 px-1 py-0.5 text-center font-bold font-mono border border-slate-200 rounded text-xs"
                      />
                    </td>

                    {/* Raw Conc */}
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={s.rawConc ?? ''}
                        placeholder="缺值"
                        onChange={(e) => handleUpdateSample(s.id, 'rawConc', e.target.value)}
                        className={`w-20 px-1.5 py-1 font-mono text-xs border rounded ${
                          isMissing
                            ? 'border-rose-300 bg-rose-50 text-rose-700 font-bold placeholder-rose-400'
                            : 'border-slate-200'
                        }`}
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-2.5 py-2">
                      <input
                        type="text"
                        value={s.unit}
                        onChange={(e) => handleUpdateSample(s.id, 'unit', e.target.value)}
                        className="w-16 px-1.5 py-1 font-mono text-[11px] border border-slate-200 rounded"
                      />
                    </td>

                    {/* Dilution Factor */}
                    <td className="px-2.5 py-2">
                      <input
                        type="number"
                        min="1"
                        value={s.dilutionFactor}
                        onChange={(e) => handleUpdateSample(s.id, 'dilutionFactor', Number(e.target.value))}
                        className="w-14 px-1 py-1 font-mono text-xs border border-slate-200 rounded text-center"
                      />
                    </td>

                    {/* Digestion Volume (mL) */}
                    <td className="px-2.5 py-2">
                      {isWater ? (
                        <span className="text-slate-300 font-mono pl-3">-</span>
                      ) : (
                        <input
                          type="number"
                          value={s.digestionVolume ?? ''}
                          placeholder="mL"
                          onChange={(e) => handleUpdateSample(s.id, 'digestionVolume', e.target.value ? Number(e.target.value) : null)}
                          className="w-14 px-1 py-1 font-mono text-xs border border-slate-200 rounded text-center"
                        />
                      )}
                    </td>

                    {/* Sample Weight (g) */}
                    <td className="px-2.5 py-2">
                      {isWater ? (
                        <span className="text-slate-300 font-mono pl-3">-</span>
                      ) : (
                        <input
                          type="number"
                          step="0.0001"
                          value={s.sampleWeight ?? ''}
                          placeholder="g"
                          onChange={(e) => handleUpdateSample(s.id, 'sampleWeight', e.target.value ? Number(e.target.value) : null)}
                          className="w-18 px-1 py-1 font-mono text-xs border border-slate-200 rounded text-center"
                        />
                      )}
                    </td>

                    {/* Soil Moisture % */}
                    <td className="px-2.5 py-2">
                      {isSoil ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="0.1"
                            value={s.moisturePercent ?? 0}
                            onChange={(e) => handleUpdateSample(s.id, 'moisturePercent', Number(e.target.value))}
                            className="w-14 px-1 py-1 font-mono text-xs border border-amber-300 bg-amber-50/50 rounded text-center font-bold text-amber-900"
                          />
                          <span className="text-slate-400 text-[10px]">%</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-mono pl-3">-</span>
                      )}
                    </td>

                    {/* ★ Report Conc */}
                    <td className="px-3 py-2 bg-teal-50/30">
                      {s.reportConc !== null ? (
                        <span className="font-mono font-black text-sm text-teal-950">
                          {formatNum(s.reportConc, decimals)}
                        </span>
                      ) : (
                        <span className="font-bold text-xs text-rose-600">無法計算</span>
                      )}
                    </td>

                    {/* Report Unit */}
                    <td className="px-2.5 py-2 bg-teal-50/30 font-mono font-semibold text-teal-800 text-[11px]">
                      {s.reportUnit}
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-2">
                      {isPass ? (
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          ● {s.statusMessage}
                        </span>
                      ) : s.status === 'WET_BASIS_WARNING' ? (
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold" title="未輸入土壤含水率，目前依秤取濕重計算">
                          ▲ {s.statusMessage}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold" title={s.statusMessage}>
                          ✕ {s.statusMessage}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-1 py-2 text-right">
                      <button
                        onClick={() => handleDeleteSample(s.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition"
                        title="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        title="稀釋與單位換算器"
        sopContent={{
          purpose:
            '本工具適用於環境樣品（飲用水、地下水、放流水）、土壤與食品檢驗上機數據之批量換算。相容 ICP-MS、AAS、ICP-OES 匯出之多種濃度單位，並自動清洗字尾空格與髒資料。',
          methodReference:
            '環境部檢驗標準法 NIEA W413 (水中金屬)、NIEA S311 (土壤重金屬王水消化法)、衛福部食品中重金屬檢驗標準方法',
          formulas: [
            {
              name: '單位標準化（折算為 µg/L 基準）',
              formula: 'mg/L × 1000 = µg/L | ppm × 1000 = µg/L | ppb = µg/L | ng/mL = µg/L',
              description: '假定檢驗溶液基質為稀薄無機酸水溶液，密度 ρ ≈ 1.0 g/mL。',
            },
            {
              name: '水樣報告濃度 (µg/L)',
              formula: 'Report Conc (µg/L) = C_norm (µg/L) × Dilution Factor (DF)',
              description: '水樣直接進樣或稀釋，不涉及固體消化秤重，忽略定容體積與樣品重。',
            },
            {
              name: '土壤報告濃度 (mg/kg，乾基校正)',
              formula: 'Report Conc (mg/kg) = [ C_norm (µg/L) × DF × V (mL) ] / [ W (g) × 1000 × (1 - Moisture%/100) ]',
              description: '依環境檢驗標準法，土壤重金屬必須以乾基（Dry-weight basis）回報，以扣除水分差異。',
            },
            {
              name: '食品報告濃度 (mg/kg，濕重/鮮重基準)',
              formula: 'Report Conc (mg/kg) = [ C_norm (µg/L) × DF × V (mL) ] / [ W (g) × 1000 ]',
              description: '符合衛福部食品安全衛生法規重金屬限量規範（如嬰幼兒食品、水產品鮮重含量）。',
            },
          ],
          qcCriteria: [
            { rule: '樣品編號規格', threshold: '不含首尾空格', action: '系統自動 .trim() 清洗' },
            { rule: '上機數值完整性', threshold: '必須有數值', action: '若為空值標記「🔴 數值缺失」，不中斷其餘換算' },
            { rule: '土壤水分合理性', threshold: '0% ≤ 含水率 < 100%', action: '若 ≥ 100% 標記「含水率異常」防除以零' },
            { rule: '固體前處理完整性', threshold: 'V > 0 mL 且 W > 0 g', action: '若缺項標記「前處理不全」' },
          ],
          steps: [
            '1. 點擊「上傳 CSV / Excel」或直接貼上儀器產出之原始試算表。',
            '2. 檢視統計卡與資料表，確認水樣、土壤與食品之基質分類。',
            '3. 若為土壤樣品，可於上方輸入含水率並點擊「套用至全部土壤」進行乾基校正。',
            '4. 檢視粗體之【★ 報告濃度】，確認狀態標籤皆為合格。',
            '5. 點擊「一鍵複製報告」貼入電子實驗紀錄本，或「匯出 Excel (.xlsx)」存查。',
          ],
          tips: [
            '若檔案中微克符號為 Unicode 特殊字元「µg/L」，系統已內建自動相容轉換。',
            '若樣品濃度過高需二次稀釋，直接在表格「稀釋(DF)」欄修改數值，系統會即時重新換算。',
          ],
        }}
      />

      {/* Excel Paste Modal */}
      <ExcelPasteModal
        isOpen={isPasteOpen}
        onClose={() => setIsPasteOpen(false)}
        title="貼上樣品檢驗數據"
        columns={[
          { key: 'sampleId', label: '樣品編號' },
          { key: 'matrix', label: '樣品類型 (水樣/土壤/食品)' },
          { key: 'element', label: '元素' },
          { key: 'rawConc', label: '上機濃度' },
          { key: 'unit', label: '單位' },
          { key: 'dilutionFactor', label: '稀釋倍數' },
          { key: 'digestionVolume', label: '定容體積 (mL)' },
          { key: 'sampleWeight', label: '樣品重 (g)' },
        ]}
        onImport={(rows) => {
          const newRows: RawSampleInput[] = rows.map((r, i) => {
            const matrixStr = String(r.matrix || '水樣');
            const matrix: MatrixType = matrixStr.includes('土') ? '土壤' : matrixStr.includes('食') ? '食品' : '水樣';

            return {
              id: `paste-${Date.now()}-${i}`,
              sampleId: String(r.sampleId || `Sample-${i + 1}`).trim(),
              matrix,
              element: String(r.element || 'Pb'),
              rawConc: r.rawConc !== undefined ? r.rawConc : '',
              unit: String(r.unit || 'ug/L'),
              dilutionFactor: Number(r.dilutionFactor) || 1,
              digestionVolume: r.digestionVolume !== undefined && r.digestionVolume !== '' ? Number(r.digestionVolume) : undefined,
              sampleWeight: r.sampleWeight !== undefined && r.sampleWeight !== '' ? Number(r.sampleWeight) : undefined,
              moisturePercent: 0,
            };
          });

          setSamples(newRows);
        }}
      />
    </div>
  );
};
