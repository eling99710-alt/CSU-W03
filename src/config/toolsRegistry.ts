import React from 'react';
import { LineChart, Calculator, Layers, Beaker } from 'lucide-react';

export type ToolCategory = 'all' | 'instrument' | 'prep' | 'qa-qc';

export interface ToolMetadata {
  id: string;
  name: string;
  category: 'instrument' | 'prep' | 'qa-qc';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'ready' | 'coming-soon' | 'planned';
  weekNumber: number;
  tags: string[];
}

export const CATEGORIES: { id: ToolCategory; label: string; count?: number }[] = [
  { id: 'all', label: '全部工具' },
  { id: 'instrument', label: '質譜與儀器分析' },
  { id: 'prep', label: '樣品前處理與配製' },
  { id: 'qa-qc', label: '品管與數據彙整' },
];

/**
 * 工具箱清冊註冊表
 * ⭐️ 未來每週新增小工具時，只需在此陣列加入一筆工具設定即可自動呈現在首頁與導覽中！
 */
export const TOOLS_REGISTRY: ToolMetadata[] = [
  {
    id: 'units',
    name: '稀釋與單位換算器',
    category: 'prep',
    description: '支援水樣（µg/L）、土壤（乾基 mg/kg）與食品批量數據換算，具備單位自動正規化、水分校正與髒資料防呆機制。',
    icon: Calculator,
    status: 'ready',
    weekNumber: 2,
    tags: ['單位換算', '序列稀釋', '土壤乾基', '水質微量分析', 'ICP-MS'],
  },
  {
    id: 'lc-ms-calibration',
    name: 'LC-MS 檢量線計算機',
    category: 'instrument',
    description: '支援內標法（ISTD）面積比、一般與加權最小平方法（1/x, 1/x²）、R² 品管門檻與 %RE 反算濃度警示。',
    icon: LineChart,
    status: 'ready',
    weekNumber: 1,
    tags: ['LC-MS', '檢量線', 'ISTD', '加權迴歸', '水質微量分析'],
  },
  {
    id: 'batch-summary',
    name: '多批次檢驗數據彙整與品管查核',
    category: 'qa-qc',
    description: '自動相容異質欄位與大小寫，快速對齊三週蔬菜農藥殘留批次，即時比對法規容許量並產出超標違規清單與矩陣總表。',
    icon: Layers,
    status: 'ready',
    weekNumber: 3,
    tags: ['QA/QC', '批次彙整', '農藥殘留', '容許量比對', '矩陣總覽'],
  },
  {
    id: 'solution-dilution',
    name: '標準品稀釋與溶液配製換算器',
    category: 'prep',
    description: '高濃度母液序列稀釋、儲備液多梯度配製、溶劑密度與純度（Assay%）補償換算。',
    icon: Beaker,
    status: 'coming-soon',
    weekNumber: 4,
    tags: ['序列稀釋', '標準品配製', 'C1V1=C2V2', 'ppm/ppb換算'],
  },
];
