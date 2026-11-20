/**
 * 多批次結果彙整與品管查核 - 核心運算、欄位別名對齊與法規比對模組
 */

export interface PesticideLimit {
  analyte: string;         // 標準英文名 (如 Carbofuran)
  chineseName: string;     // 中文名稱 (如 加保扶)
  limitMgKg: number;       // 示範容許量 (mg/kg)
  loqMgKg: number;         // 定量極限 LOQ (mg/kg)
}

export const DEFAULT_PESTICIDE_LIMITS: PesticideLimit[] = [
  { analyte: 'Carbofuran', chineseName: '加保扶', limitMgKg: 0.02, loqMgKg: 0.01 },
  { analyte: 'Imidacloprid', chineseName: '益達胺', limitMgKg: 0.5, loqMgKg: 0.01 },
  { analyte: 'Acetamiprid', chineseName: '亞滅培', limitMgKg: 0.2, loqMgKg: 0.01 },
  { analyte: 'Chlorpyrifos', chineseName: '陶斯松', limitMgKg: 0.05, loqMgKg: 0.01 },
  { analyte: 'Fipronil', chineseName: '芬普尼', limitMgKg: 0.005, loqMgKg: 0.01 },
];

export type ComplianceStatus =
  | 'EXCEEDED'       // 🔴 超標 (FAIL)
  | 'PASS_DETECTED'  // 🟡 檢出未超標 (PASS)
  | 'PASS_LOQ'       // 🟢 未檢出 (<LOQ) (PASS)
  | 'NO_LIMIT';      // ⚪ 未列標準

export interface RawBatchItem {
  id: string;
  batchId: string;       // 批次來源 (如 2026-09-20)
  sampleId: string;      // 樣品編號 (如 V101)
  matrix: string;        // 蔬菜基質 (如 小白菜, 番茄, 高麗菜)
  analyte: string;       // 原始農藥名稱 (如 CARBOFURAN, Carbofuran)
  area: number;          // 待測物面積
  isArea: number;        // 內標面積
  calcConcRaw: string | number; // 原始濃度字串 (如 "<LOQ" 或 0.1663)
}

export interface ProcessedBatchItem extends RawBatchItem {
  normalizedAnalyte: string; // 正規化標準名稱 (Carbofuran)
  chineseAnalyte: string;    // 中文名稱 (加保扶)
  numericConc: number | null;// 數值濃度 (若為 <LOQ 則為 null)
  isLoq: boolean;            // 是否為 <LOQ
  limitMgKg: number | null;  // 法規容許量
  loqMgKg: number | null;    // 儀器 LOQ
  isExceeded: boolean;       // 是否超標
  exceedanceRatio: number | null; // 超標倍數 (Conc / Limit)
  status: ComplianceStatus;
  statusLabel: string;
}

/**
 * 農藥名稱正規化（忽略大小寫對齊至標準首字大寫）
 */
export function normalizeAnalyteName(
  rawName: string,
  limits: PesticideLimit[] = DEFAULT_PESTICIDE_LIMITS
): { normalized: string; chinese: string; limitInfo?: PesticideLimit } {
  const clean = String(rawName || '').trim().toLowerCase();
  const matched = limits.find(l => l.analyte.toLowerCase() === clean);

  if (matched) {
    return {
      normalized: matched.analyte,
      chinese: matched.chineseName,
      limitInfo: matched,
    };
  }

  // 首字大寫 fallback
  const fallback = clean.charAt(0).toUpperCase() + clean.slice(1);
  return {
    normalized: fallback,
    chinese: fallback,
  };
}

/**
 * 單筆批次檢測項目之法規比對與判定
 */
export function evaluateBatchItem(
  raw: RawBatchItem,
  limits: PesticideLimit[] = DEFAULT_PESTICIDE_LIMITS
): ProcessedBatchItem {
  const { normalized, chinese, limitInfo } = normalizeAnalyteName(raw.analyte, limits);
  const rawStr = String(raw.calcConcRaw ?? '').trim();
  const isLoq = rawStr.toUpperCase().includes('LOQ') || rawStr.toUpperCase() === 'ND' || rawStr.startsWith('<');

  let numericConc: number | null = null;
  if (!isLoq && rawStr !== '') {
    const val = Number(rawStr);
    if (!isNaN(val)) {
      numericConc = val;
    }
  }

  // 判定邏輯
  if (!limitInfo) {
    return {
      ...raw,
      normalizedAnalyte: normalized,
      chineseAnalyte: chinese,
      numericConc,
      isLoq,
      limitMgKg: null,
      loqMgKg: null,
      isExceeded: false,
      exceedanceRatio: null,
      status: 'NO_LIMIT',
      statusLabel: '未列法規標準',
    };
  }

  if (isLoq || numericConc === null) {
    return {
      ...raw,
      normalizedAnalyte: normalized,
      chineseAnalyte: chinese,
      numericConc: null,
      isLoq: true,
      limitMgKg: limitInfo.limitMgKg,
      loqMgKg: limitInfo.loqMgKg,
      isExceeded: false,
      exceedanceRatio: null,
      status: 'PASS_LOQ',
      statusLabel: '< LOQ (未檢出)',
    };
  }

  // 數值檢出比對
  const limit = limitInfo.limitMgKg;
  if (numericConc > limit) {
    const ratio = Number((numericConc / limit).toFixed(2));
    return {
      ...raw,
      normalizedAnalyte: normalized,
      chineseAnalyte: chinese,
      numericConc,
      isLoq: false,
      limitMgKg: limit,
      loqMgKg: limitInfo.loqMgKg,
      isExceeded: true,
      exceedanceRatio: ratio,
      status: 'EXCEEDED',
      statusLabel: `🔴 超標 ${ratio} 倍`,
    };
  }

  // 檢出但未超標
  const ratio = Number((numericConc / limit).toFixed(2));
  return {
    ...raw,
    normalizedAnalyte: normalized,
    chineseAnalyte: chinese,
    numericConc,
    isLoq: false,
    limitMgKg: limit,
    loqMgKg: limitInfo.loqMgKg,
    isExceeded: false,
    exceedanceRatio: ratio,
    status: 'PASS_DETECTED',
    statusLabel: '🟢 合格 (檢出未超標)',
  };
}

/**
 * 矩陣寬表資料結構 (Pivot Table)
 */
export interface MatrixPivotRow {
  sampleKey: string;      // 樣品唯一 key (batchId_sampleId)
  batchId: string;
  sampleId: string;
  matrix: string;
  pesticideResults: {
    [analyteName: string]: {
      concDisplay: string;
      numericConc: number | null;
      isExceeded: boolean;
      status: ComplianceStatus;
      ratio: number | null;
    };
  };
  detectedCount: number;  // 檢出農藥種數 (含未超標)
  exceededCount: number;  // 超標農藥種數
}

/**
 * 將多批次明細轉換為蔬菜樣品農藥殘留矩陣寬表 (Pivot)
 */
export function generateMatrixPivot(
  items: ProcessedBatchItem[]
): MatrixPivotRow[] {
  const map = new Map<string, MatrixPivotRow>();

  items.forEach(item => {
    const key = `${item.batchId}_${item.sampleId}`;
    if (!map.has(key)) {
      map.set(key, {
        sampleKey: key,
        batchId: item.batchId,
        sampleId: item.sampleId,
        matrix: item.matrix,
        pesticideResults: {},
        detectedCount: 0,
        exceededCount: 0,
      });
    }

    const row = map.get(key)!;
    const concDisplay = item.isLoq
      ? '<LOQ'
      : item.numericConc !== null
      ? item.numericConc.toFixed(4)
      : '-';

    row.pesticideResults[item.normalizedAnalyte] = {
      concDisplay,
      numericConc: item.numericConc,
      isExceeded: item.isExceeded,
      status: item.status,
      ratio: item.exceedanceRatio,
    };

    if (!item.isLoq && item.numericConc !== null) {
      row.detectedCount += 1;
    }
    if (item.isExceeded) {
      row.exceededCount += 1;
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    // 超標樣品優先排前
    if (a.exceededCount !== b.exceededCount) {
      return b.exceededCount - a.exceededCount;
    }
    return a.sampleId.localeCompare(b.sampleId);
  });
}
