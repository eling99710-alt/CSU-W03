import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart as LineChartIcon,
  HelpCircle,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ClipboardPaste,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

import {
  calculateRegression,
  calculateUnknownConcentration,
  WeightMode,
  DataPoint,
} from '../../utils/mathRegression';
import { formatNum, formatPercent } from '../../utils/formatters';
import { saveDraft, loadDraft, clearDraft } from '../../utils/storage';
import { SopModal } from '../../components/layout/SopModal';
import { ExcelPasteModal } from '../../components/io/ExcelPasteModal';
import { ExportToolbar } from '../../components/io/ExportToolbar';

interface StandardRow {
  id: string;
  name: string;
  conc: number;
  analyteArea: number;
  istdArea: number;
  enabled: boolean;
}

interface UnknownRow {
  id: string;
  sampleId: string;
  analyteArea: number;
  istdArea: number;
}

const DEFAULT_STANDARDS: StandardRow[] = [
  { id: '1', name: 'STD-1 (LOQ)', conc: 0.1, analyteArea: 1050, istdArea: 50000, enabled: true },
  { id: '2', name: 'STD-2', conc: 0.5, analyteArea: 5120, istdArea: 50200, enabled: true },
  { id: '3', name: 'STD-3', conc: 1.0, analyteArea: 10400, istdArea: 49800, enabled: true },
  { id: '4', name: 'STD-4', conc: 5.0, analyteArea: 51800, istdArea: 50400, enabled: true },
  { id: '5', name: 'STD-5', conc: 10.0, analyteArea: 103500, istdArea: 49900, enabled: true },
  { id: '6', name: 'STD-6', conc: 20.0, analyteArea: 208000, istdArea: 50100, enabled: true },
];

const DEFAULT_UNKNOWNS: UnknownRow[] = [
  { id: 'u1', sampleId: '原水 (Raw Water)-01', analyteArea: 8400, istdArea: 50100 },
  { id: 'u2', sampleId: '沉澱池 (Sedimentation)-02', analyteArea: 2300, istdArea: 49700 },
  { id: 'u3', sampleId: '放流水 (Effluent)-03', analyteArea: 750, istdArea: 50300 },
];

export const LcMsCalibrationTool: React.FC = () => {
  // Settings State
  const [weightMode, setWeightMode] = useState<WeightMode>('1/x');
  const [useIstd, setUseIstd] = useState(true);
  const [forceZero, setForceZero] = useState(false);
  const [r2Threshold, setR2Threshold] = useState(0.995);
  const [reThreshold, setReThreshold] = useState(15);
  const [loqReThreshold, setLoqReThreshold] = useState(20);
  const [decimals, setDecimals] = useState(3);
  const [unit, setUnit] = useState('μg/L');

  // Data State
  const [standards, setStandards] = useState<StandardRow[]>(() => {
    return loadDraft('lc_ms_standards', DEFAULT_STANDARDS);
  });
  const [unknowns, setUnknowns] = useState<UnknownRow[]>(() => {
    return loadDraft('lc_ms_unknowns', DEFAULT_UNKNOWNS);
  });

  // UI Modals
  const [isSopOpen, setIsSopOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteTarget, setPasteTarget] = useState<'standards' | 'unknowns'>('standards');

  const chartRef = useRef<HTMLDivElement>(null);

  // Auto-save drafts
  useEffect(() => {
    saveDraft('lc_ms_standards', standards);
  }, [standards]);

  useEffect(() => {
    saveDraft('lc_ms_unknowns', unknowns);
  }, [unknowns]);

  // Transform standards into math regression data points
  const regressionPoints: DataPoint[] = useMemo(() => {
    return standards.map(s => {
      let y = s.analyteArea;
      if (useIstd && s.istdArea > 0) {
        y = s.analyteArea / s.istdArea;
      }
      return {
        id: s.id,
        name: s.name,
        x: s.conc,
        y,
        enabled: s.enabled,
      };
    });
  }, [standards, useIstd]);

  // Calculate Regression
  const regressionResult = useMemo(() => {
    return calculateRegression(
      regressionPoints,
      weightMode,
      forceZero,
      reThreshold,
      loqReThreshold
    );
  }, [regressionPoints, weightMode, forceZero, reThreshold, loqReThreshold]);

  // Evaluate unknowns
  const evaluatedUnknowns = useMemo(() => {
    if (!regressionResult.isValid || regressionResult.slope === 0) return [];

    const minStd = Math.min(...standards.filter(s => s.enabled).map(s => s.conc));
    const maxStd = Math.max(...standards.filter(s => s.enabled).map(s => s.conc));

    return unknowns.map(u => {
      let y = u.analyteArea;
      if (useIstd && u.istdArea > 0) {
        y = u.analyteArea / u.istdArea;
      }
      const conc = calculateUnknownConcentration(y, regressionResult.slope, regressionResult.intercept);

      let flag: 'NORMAL' | 'BELOW_LOQ' | 'ABOVE_ULOQ' = 'NORMAL';
      if (conc < minStd) flag = 'BELOW_LOQ';
      else if (conc > maxStd) flag = 'ABOVE_ULOQ';

      return {
        ...u,
        responseRatio: y,
        calculatedConc: conc,
        flag,
      };
    });
  }, [unknowns, regressionResult, useIstd, standards]);

  // Overall QC Status
  const isQcPass = useMemo(() => {
    if (!regressionResult.isValid) return false;
    const r2Pass = regressionResult.rSquared >= r2Threshold;
    const pointsPass = regressionResult.points.every(p => p.isPass);
    return r2Pass && pointsPass;
  }, [regressionResult, r2Threshold]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    if (!regressionResult.isValid) return [];

    const sortedStds = [...standards].filter(s => s.enabled).sort((a, b) => a.conc - b.conc);
    if (sortedStds.length === 0) return [];

    const maxConc = Math.max(...sortedStds.map(s => s.conc));

    // Generate fitted line points
    const lineStep = maxConc / 10;
    const data: Array<{
      conc: number;
      actualRatio?: number;
      fittedRatio?: number;
      name?: string;
    }> = [];

    for (let c = 0; c <= maxConc * 1.05; c += lineStep) {
      data.push({
        conc: Number(c.toFixed(4)),
        fittedRatio: regressionResult.slope * c + regressionResult.intercept,
      });
    }

    // Merge standard scatter points
    standards.forEach(s => {
      if (!s.enabled) return;
      const y = useIstd && s.istdArea > 0 ? s.analyteArea / s.istdArea : s.analyteArea;
      data.push({
        conc: s.conc,
        actualRatio: y,
        name: s.name,
      });
    });

    return data.sort((a, b) => a.conc - b.conc);
  }, [standards, regressionResult, useIstd]);

  // Handlers
  const handleAddStandard = () => {
    const nextIdx = standards.length + 1;
    const lastConc = standards.length > 0 ? standards[standards.length - 1].conc * 2 : 1.0;
    setStandards([
      ...standards,
      {
        id: Date.now().toString(),
        name: `STD-${nextIdx}`,
        conc: lastConc,
        analyteArea: 0,
        istdArea: 50000,
        enabled: true,
      },
    ]);
  };

  const handleUpdateStandard = (index: number, field: keyof StandardRow, val: any) => {
    const updated = [...standards];
    updated[index] = { ...updated[index], [field]: val };
    setStandards(updated);
  };

  const handleDeleteStandard = (index: number) => {
    if (standards.length <= 3) {
      alert('檢量線至少需保留 3 個標準點！');
      return;
    }
    setStandards(standards.filter((_, i) => i !== index));
  };

  const handleAddUnknown = () => {
    const nextIdx = unknowns.length + 1;
    setUnknowns([
      ...unknowns,
      {
        id: Date.now().toString(),
        sampleId: `Sample-${nextIdx}`,
        analyteArea: 0,
        istdArea: 50000,
      },
    ]);
  };

  const handleUpdateUnknown = (index: number, field: keyof UnknownRow, val: any) => {
    const updated = [...unknowns];
    updated[index] = { ...updated[index], [field]: val };
    setUnknowns(updated);
  };

  const handleDeleteUnknown = (index: number) => {
    setUnknowns(unknowns.filter((_, i) => i !== index));
  };

  const handleReset = () => {
    clearDraft('lc_ms_standards');
    clearDraft('lc_ms_unknowns');
    setStandards(DEFAULT_STANDARDS);
    setUnknowns(DEFAULT_UNKNOWNS);
    setWeightMode('1/x');
    setForceZero(false);
  };

  // Excel / CSV File Upload Parser
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

        // 判斷是否為標題列
        let startIdx = 0;
        if (isNaN(Number(rows[0][1]))) {
          startIdx = 1;
        }

        const newStds: StandardRow[] = [];
        for (let i = startIdx; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || row[0] === undefined) continue;
          const name = String(row[0] ?? `STD-${i}`);
          const conc = Number(row[1]);
          const analyteArea = Number(row[2]);
          const istdArea = Number(row[3] ?? 50000);

          if (!isNaN(conc) && !isNaN(analyteArea)) {
            newStds.push({
              id: Date.now().toString() + i,
              name,
              conc,
              analyteArea,
              istdArea: istdArea || 50000,
              enabled: true,
            });
          }
        }

        if (newStds.length >= 3) {
          setStandards(newStds);
          alert(`成功匯入 ${newStds.length} 個標準品點位！`);
        } else {
          alert('未能解析出足夠的有效標準品資料（需至少 3 筆）。請確保第 1 欄為名稱、第 2 欄為濃度、第 3 欄為面積。');
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

    // Sheet 1: Calibration Standards
    const stdData = standards.map(s => {
      const p = regressionResult.points.find(pt => Math.abs(pt.x - s.conc) < 1e-9);
      const ratio = useIstd && s.istdArea > 0 ? s.analyteArea / s.istdArea : s.analyteArea;
      return {
        '標準品點位': s.name,
        [`配製濃度 (${unit})`]: s.conc,
        '待測物面積': s.analyteArea,
        ...(useIstd ? { '內標(ISTD)面積': s.istdArea, '面積比 (Ratio)': ratio } : {}),
        [`反算濃度 (${unit})`]: p ? p.xCalc : '-',
        '相對誤差 (%RE)': p ? `${p.percentRE.toFixed(2)}%` : '-',
        '品管判定': p?.isPass ? '合格' : '偏差超標',
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(stdData);
    XLSX.utils.book_append_sheet(wb, ws1, '檢量線標準點');

    // Sheet 2: Regression Summary
    const summaryData = [
      { '項目': '迴歸方程式', '數值': regressionResult.equationText },
      { '項目': '判定係數 (R²)', '數值': regressionResult.rSquared.toFixed(5) },
      { '項目': '斜率 (Slope, a)', '數值': regressionResult.slope.toExponential(4) },
      { '項目': '截距 (Intercept, b)', '數值': regressionResult.intercept.toFixed(5) },
      { '項目': '加權模式', '數值': weightMode === 'none' ? '無加權 (OLS)' : weightMode },
      { '項目': '整體品管結果', '數值': isQcPass ? '合格 (PASS)' : '警告 (WARNING)' },
    ];
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws2, '迴歸統計');

    // Sheet 3: Unknown Samples
    const unkData = evaluatedUnknowns.map(u => ({
      '樣品編號': u.sampleId,
      '待測物面積': u.analyteArea,
      ...(useIstd ? { '內標(ISTD)面積': u.istdArea, '面積比 (Ratio)': u.responseRatio } : {}),
      [`定量濃度 (${unit})`]: Number(u.calculatedConc.toFixed(decimals)),
      '標記狀態': u.flag === 'BELOW_LOQ' ? '< LOQ (低於定量極限)' : u.flag === 'ABOVE_ULOQ' ? '> ULOQ (高於最高標點)' : '正常',
    }));
    const ws3 = XLSX.utils.json_to_sheet(unkData);
    XLSX.utils.book_append_sheet(wb, ws3, '未知樣品定量');

    XLSX.writeFile(wb, `LC-MS_檢量線計算成果_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export Chart PNG
  const handleExportPng = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `LC-MS_檢量線圖表_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = imgData;
      link.click();
    } catch (err) {
      alert('圖片匯出失敗，請重試。');
    }
  };

  // Generate ELN text summary
  const generateElnSummary = (): string => {
    const lines = [
      `【水質檢驗 LC-MS 檢量線計算成果報告】`,
      `分析日期：${new Date().toLocaleDateString('zh-TW')}`,
      `迴歸模型：${weightMode === 'none' ? '普通線性 (OLS)' : `加權迴歸 (${weightMode})`}`,
      `內標校正：${useIstd ? '已啟用 (面積比正規化)' : '無'}`,
      `方程式：${regressionResult.equationText}`,
      `判定係數 (R²)：${regressionResult.rSquared.toFixed(5)}（門檻：≥ ${r2Threshold}）`,
      `品管判定結果：${isQcPass ? '合格 (PASS)' : '警告 (WARNING - 未達品管標準)'}`,
      ``,
      `--- 標準點反算結果 ---`,
    ];

    regressionResult.points.forEach((p, idx) => {
      lines.push(
        `STD-${idx + 1} (${p.x} ${unit}): 反算=${formatNum(p.xCalc, decimals)} ${unit}, %RE=${formatPercent(p.percentRE)} [${p.isPass ? 'PASS' : 'FAIL'}]`
      );
    });

    if (evaluatedUnknowns.length > 0) {
      lines.push(``);
      lines.push(`--- 未知樣品定量結果 ---`);
      evaluatedUnknowns.forEach(u => {
        lines.push(
          `${u.sampleId}: 定量濃度 = ${formatNum(u.calculatedConc, decimals)} ${unit} (${u.flag === 'NORMAL' ? '正常' : u.flag})`
        );
      });
    }

    return lines.join('\n');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              <LineChartIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <span>LC-MS 檢量線計算機</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                  水質分析規範
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                高感度水質微量分析專用・支援內標面積比正規化、1/x、1/x² 加權迴歸與 %RE 品管查核
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSopOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition"
          >
            <HelpCircle className="w-4 h-4 text-teal-600" />
            <span>SOP / 計算原理說明</span>
          </button>
        </div>
      </div>

      {/* 2. Workspace: Two-column Layout (Desktop: Left/Right, Mobile: Top/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Inputs & Settings) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Settings Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-teal-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  迴歸模型與品管參數設定
                </h3>
              </div>
              <div className="text-[11px] text-slate-400">
                可隨時切換加權模式進行比對
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {/* Regression Weight */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">迴歸加權模式</label>
                <select
                  value={weightMode}
                  onChange={(e) => setWeightMode(e.target.value as WeightMode)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value="none">無加權 (OLS)</option>
                  <option value="1/x">1/x 加權（推薦微量分析）</option>
                  <option value="1/x^2">1/x² 加權（極寬動態範圍）</option>
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">濃度單位</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  placeholder="μg/L, mg/L, ng/L"
                />
              </div>

              {/* Decimal Places */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">小數點位數</label>
                <select
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                >
                  <option value={2}>2 位小數</option>
                  <option value={3}>3 位小數</option>
                  <option value={4}>4 位小數</option>
                </select>
              </div>

              {/* R2 threshold */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">R² 合格門檻</label>
                <input
                  type="number"
                  step="0.001"
                  value={r2Threshold}
                  onChange={(e) => setR2Threshold(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* %RE threshold */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">%RE 偏差容許 (標準點)</label>
                <div className="flex items-center space-x-1">
                  <span className="text-slate-400">±</span>
                  <input
                    type="number"
                    value={reThreshold}
                    onChange={(e) => setReThreshold(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>

              {/* %RE LOQ threshold */}
              <div>
                <label className="block text-slate-600 font-medium mb-1">%RE 偏差容許 (LOQ最低點)</label>
                <div className="flex items-center space-x-1">
                  <span className="text-slate-400">±</span>
                  <input
                    type="number"
                    value={loqReThreshold}
                    onChange={(e) => setLoqReThreshold(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-700">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useIstd}
                  onChange={(e) => setUseIstd(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="font-semibold text-slate-800">啟用內標（ISTD）面積比換算</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceZero}
                  onChange={(e) => setForceZero(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span>強制過原點 (y = ax)</span>
              </label>
            </div>
          </div>

          {/* Standards Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>標準品濃度點位（Standards）</span>
                  <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-medium">
                    {standards.length} 點
                  </span>
                </h3>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => {
                    setPasteTarget('standards');
                    setIsPasteModalOpen(true);
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-teal-600" />
                  <span>貼上 Excel</span>
                </button>

                <label className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>匯入檔案</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleAddStandard}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition shadow-sm font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>加點</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2 w-10">啟用</th>
                    <th className="px-3 py-2">點位名稱</th>
                    <th className="px-3 py-2">濃度 ({unit})</th>
                    <th className="px-3 py-2">待測物面積</th>
                    {useIstd && <th className="px-3 py-2">內標(ISTD)面積</th>}
                    {useIstd && <th className="px-3 py-2">面積比 (Ratio)</th>}
                    <th className="px-3 py-2">反算濃度</th>
                    <th className="px-3 py-2">%RE 誤差</th>
                    <th className="px-3 py-2">狀態</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {standards.map((s, idx) => {
                    const evalPoint = regressionResult.points.find(p => Math.abs(p.x - s.conc) < 1e-9);
                    const ratio = useIstd && s.istdArea > 0 ? s.analyteArea / s.istdArea : s.analyteArea;

                    return (
                      <tr key={s.id} className={!s.enabled ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50/60'}>
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={s.enabled}
                            onChange={(e) => handleUpdateStandard(idx, 'enabled', e.target.checked)}
                            className="rounded border-slate-300 text-teal-600"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={s.name}
                            onChange={(e) => handleUpdateStandard(idx, 'name', e.target.value)}
                            className="w-24 px-1.5 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="any"
                            value={s.conc}
                            onChange={(e) => handleUpdateStandard(idx, 'conc', Number(e.target.value))}
                            className="w-20 px-1.5 py-1 font-mono font-semibold border border-slate-200 rounded text-xs focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={s.analyteArea}
                            onChange={(e) => handleUpdateStandard(idx, 'analyteArea', Number(e.target.value))}
                            className="w-24 px-1.5 py-1 font-mono border border-slate-200 rounded text-xs focus:ring-1 focus:ring-teal-500"
                          />
                        </td>
                        {useIstd && (
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={s.istdArea}
                              onChange={(e) => handleUpdateStandard(idx, 'istdArea', Number(e.target.value))}
                              className="w-24 px-1.5 py-1 font-mono border border-slate-200 rounded text-xs focus:ring-1 focus:ring-teal-500"
                            />
                          </td>
                        )}
                        {useIstd && (
                          <td className="px-3 py-1.5 font-mono text-slate-700">
                            {formatNum(ratio, 4)}
                          </td>
                        )}
                        <td className="px-3 py-1.5 font-mono font-medium text-slate-900">
                          {evalPoint ? formatNum(evalPoint.xCalc, decimals) : '-'}
                        </td>
                        <td className="px-3 py-1.5 font-mono">
                          {evalPoint ? (
                            <span
                              className={`font-semibold ${
                                evalPoint.isPass ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {formatPercent(evalPoint.percentRE)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {evalPoint ? (
                            evalPoint.isPass ? (
                              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                合格
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                                偏差過大
                              </span>
                            )
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-1 py-1.5 text-right">
                          <button
                            onClick={() => handleDeleteStandard(idx)}
                            className="p-1 text-slate-300 hover:text-rose-500 transition"
                            title="刪除此點"
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

          {/* Unknown Samples Table Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>未知水樣定量分析（Unknown Samples）</span>
                  <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                    {unknowns.length} 個樣品
                  </span>
                </h3>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => {
                    setPasteTarget('unknowns');
                    setIsPasteModalOpen(true);
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600" />
                  <span>貼上 Excel</span>
                </button>
                <button
                  onClick={handleAddUnknown}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>加樣品</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2">樣品編號</th>
                    <th className="px-3 py-2">待測物面積</th>
                    {useIstd && <th className="px-3 py-2">內標(ISTD)面積</th>}
                    {useIstd && <th className="px-3 py-2">面積比</th>}
                    <th className="px-3 py-2">定量濃度 ({unit})</th>
                    <th className="px-3 py-2">極限判定</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {evaluatedUnknowns.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={u.sampleId}
                          onChange={(e) => handleUpdateUnknown(idx, 'sampleId', e.target.value)}
                          className="w-36 px-1.5 py-1 border border-slate-200 rounded text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={u.analyteArea}
                          onChange={(e) => handleUpdateUnknown(idx, 'analyteArea', Number(e.target.value))}
                          className="w-28 px-1.5 py-1 font-mono border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      {useIstd && (
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            value={u.istdArea}
                            onChange={(e) => handleUpdateUnknown(idx, 'istdArea', Number(e.target.value))}
                            className="w-28 px-1.5 py-1 font-mono border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      {useIstd && (
                        <td className="px-3 py-1.5 font-mono text-slate-600">
                          {formatNum(u.responseRatio, 4)}
                        </td>
                      )}
                      <td className="px-3 py-1.5 font-mono font-bold text-indigo-900 text-sm">
                        {formatNum(u.calculatedConc, decimals)}
                      </td>
                      <td className="px-3 py-1.5">
                        {u.flag === 'BELOW_LOQ' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                            &lt; LOQ (低於定量限)
                          </span>
                        ) : u.flag === 'ABOVE_ULOQ' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                            &gt; 最高標點 (需稀釋重測)
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            區間內
                          </span>
                        )}
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <button
                          onClick={() => handleDeleteUnknown(idx)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Results, Curve, QC Banner) */}
        <div className="lg:col-span-5 space-y-5">
          {/* QC Overall Banner */}
          <div
            className={`rounded-2xl p-4 border shadow-sm flex items-start space-x-3 ${
              isQcPass
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/90 border-rose-200 text-rose-900'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isQcPass ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              )}
            </div>
            <div className="text-xs space-y-1">
              <div className="font-bold text-sm flex items-center space-x-2">
                <span>{isQcPass ? '檢量線品管查核合格（PASS）' : '檢量線品管查核警示（WARNING）'}</span>
              </div>
              <p className="leading-relaxed opacity-90">
                {isQcPass ? (
                  `判定係數 R² = ${regressionResult.rSquared.toFixed(5)}（≥ ${r2Threshold}），且所有有效標準點之反算濃度偏差 (%RE) 均落在容許範圍內。`
                ) : (
                  <span>
                    {regressionResult.rSquared < r2Threshold && `判定係數 R² = ${regressionResult.rSquared.toFixed(5)} 未達門檻（${r2Threshold}）。 `}
                    {regressionResult.points.some(p => !p.isPass) && '部分標標點反算偏差超出容許上限，請檢查儀器訊號或停用異常離群點。'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Equation & Metrics Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>迴歸計算指標統計</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px] block">判定係數 R²</span>
                <span className={`text-lg font-black font-mono ${regressionResult.rSquared >= r2Threshold ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {regressionResult.rSquared.toFixed(5)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 text-[11px] block">相關係數 r</span>
                <span className="text-lg font-black font-mono text-slate-800">
                  {regressionResult.correlationCoefficient.toFixed(5)}
                </span>
              </div>

              <div className="col-span-2 p-3 bg-teal-50/50 rounded-xl border border-teal-100">
                <span className="text-teal-800 text-[11px] font-medium block">線性迴歸方程式</span>
                <span className="text-sm font-bold font-mono text-teal-950 block mt-0.5">
                  {regressionResult.equationText}
                </span>
                <div className="text-[10px] text-teal-700 mt-1 flex justify-between">
                  <span>斜率 a = {regressionResult.slope.toPrecision(5)}</span>
                  <span>截距 b = {regressionResult.intercept.toPrecision(4)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Calibration Curve Chart */}
          <div ref={chartRef} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <LineChartIcon className="w-4 h-4 text-teal-600" />
                <span>檢量線曲線圖表</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                {useIstd ? 'Y 軸：面積比 | X 軸：濃度' : 'Y 軸：面積 | X 軸：濃度'}
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="conc"
                    type="number"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    label={{ value: `濃度 (${unit})`, position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#64748b' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    label={{ value: useIstd ? '面積比 (Ratio)' : '訊號面積', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                    formatter={(value: any, name: string) => {
                      if (name === 'fittedRatio') return [formatNum(Number(value), 4), '趨勢擬合線'];
                      if (name === 'actualRatio') return [formatNum(Number(value), 4), '標準品實測值'];
                      return [value, name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    formatter={(value) => (value === 'fittedRatio' ? '迴歸趨勢線' : '標準品實測點')}
                  />
                  {/* Fitted Trendline */}
                  <Line
                    type="linear"
                    dataKey="fittedRatio"
                    stroke="#0d9488"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                  />
                  {/* Standard Point Scatter */}
                  <Scatter
                    dataKey="actualRatio"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              藍點代表標準品實測數值，綠線為加權擬合趨勢線。
            </p>
          </div>
        </div>
      </div>

      {/* 3. Bottom Action Toolbar */}
      <ExportToolbar
        onCopyText={generateElnSummary}
        onExportExcel={handleExportExcel}
        onExportPng={handleExportPng}
        onReset={handleReset}
      />

      {/* SOP / Theory Modal */}
      <SopModal
        isOpen={isSopOpen}
        onClose={() => setIsSopOpen(false)}
        title="LC-MS 檢量線計算機"
        sopContent={{
          purpose:
            '本工具適用於水質中微量有機污染物（如農藥殘留、新興污染物、PFAS 等）利用液相層析串聯質譜儀（LC-MS/MS）進行之定量分析，符合環保署/環境檢驗所（NIEA）與國際 EPA 檢量線品管規範。',
          methodReference: '環境部檢驗標準法檢量線製作與查核標準指引、EPA Method 8000D',
          formulas: [
            {
              name: '內標法（ISTD）面積比正規化',
              formula: 'Response Ratio (y) = Area(Analyte) / Area(ISTD)',
              description: '利用固定加入之同位素或結構相似之內標物面積比，校正基底效應（Matrix Effect）與進樣體積誤差。',
            },
            {
              name: '加權線性迴歸 (1/x, 1/x²)',
              formula: 'w_i = 1 / (x_i)^p , (p = 1 或 2)',
              description: '因微量水質分析低濃度端絕對方差較小，透過 1/x 加權能大幅避免高濃度點主導截距，確保最低定量極限（LOQ）之準確度。',
            },
            {
              name: '相對誤差 / 準確度偏差 (%RE)',
              formula: '%RE = [(x_calc - x_nominal) / x_nominal] × 100%',
              description: '將各標標點實測訊號代回迴歸方程式所得之反算濃度，與預期配製濃度進行比對。',
            },
          ],
          qcCriteria: [
            { rule: '判定係數 (R²)', threshold: '≥ 0.995 (或 r ≥ 0.997)', action: '檢查離群點或重新配製' },
            { rule: '最低點 (LOQ) %RE', threshold: '偏差在 ± 20% 以內', action: '調高 LOQ 或檢查儀器訊號 S/N' },
            { rule: '其餘校正點 %RE', threshold: '偏差在 ± 15% 以內', action: '停用非關鍵點或重新注入' },
          ],
          steps: [
            '1. 確認使用的內標物與待測物層析波峰已完成平滑與積分。',
            '2. 選擇適當的加權模式（微量水樣常規分析強烈建議使用 1/x）。',
            '3. 在標準品表格填入各點配製濃度與對應之積分面積（或點擊「貼上 Excel」直接整欄貼入）。',
            '4. 檢視右側 R² 與各點之 %RE 品管判定標籤。',
            '5. 在未知樣品表輸入待測水樣面積，即時獲得定量濃度與極限判定。',
            '6. 點擊「一鍵複製報告」或「匯出 Excel」以儲存紀錄。',
          ],
          tips: [
            '水質極低濃度（如 ng/L 級別）通常儀器背景雜訊較大，若低濃度點 %RE 偏差過高，切勿強制過原點，請檢查背景空白。',
            '若未知水樣濃度超出最高標點（> ULOQ），依標準方法應稀釋後重新進樣，不可直接外插。',
          ],
        }}
      />

      {/* Excel Paste Modal */}
      <ExcelPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        title={pasteTarget === 'standards' ? '貼上標準品數據' : '貼上未知水樣數據'}
        columns={
          pasteTarget === 'standards'
            ? [
                { key: 'name', label: '點位名稱' },
                { key: 'conc', label: `濃度 (${unit})` },
                { key: 'analyteArea', label: '待測物面積' },
                ...(useIstd ? [{ key: 'istdArea', label: '內標面積' }] : []),
              ]
            : [
                { key: 'sampleId', label: '樣品編號' },
                { key: 'analyteArea', label: '待測物面積' },
                ...(useIstd ? [{ key: 'istdArea', label: '內標面積' }] : []),
              ]
        }
        onImport={(rows) => {
          if (pasteTarget === 'standards') {
            const newStds: StandardRow[] = rows.map((r, idx) => ({
              id: Date.now().toString() + idx,
              name: String(r.name || `STD-${idx + 1}`),
              conc: Number(r.conc) || 0,
              analyteArea: Number(r.analyteArea) || 0,
              istdArea: Number(r.istdArea) || 50000,
              enabled: true,
            }));
            setStandards(newStds);
          } else {
            const newUnks: UnknownRow[] = rows.map((r, idx) => ({
              id: Date.now().toString() + idx,
              sampleId: String(r.sampleId || `Sample-${idx + 1}`),
              analyteArea: Number(r.analyteArea) || 0,
              istdArea: Number(r.istdArea) || 50000,
            }));
            setUnknowns(newUnks);
          }
        }}
      />
    </div>
  );
};
