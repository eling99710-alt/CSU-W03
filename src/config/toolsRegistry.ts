import React from 'react';
import { LineChart, Beaker, Layers } from 'lucide-react';

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
    id: 'solution-dilution',
    name: '標準品稀釋與溶液配製換算器',
    category: 'prep',
    description: '高濃度母液序列稀釋、儲備液多梯度配製、溶劑密度與純度（Assay%）補償換算。',
    icon: Beaker,
    status: 'coming-soon',
    weekNumber: 2,
    tags: ['序列稀釋', '標準品配製', 'C1V1=C2V2', 'ppm/ppb換算'],
  },
  {
    id: 'batch-summary',
    name: '多批次檢驗數據彙整與品管查核',
    category: 'qa-qc',
    description: '批次空白 (Blank)、重複樣品 (Duplicate RPD)、查核樣品 (LCS 回收率) 自動判讀與統計報告產出。',
    icon: Layers,
    status: 'planned',
    weekNumber: 3,
    tags: ['QA/QC', '批次彙整', '回收率', 'RPD', '水質檢驗標準法'],
  },
];
