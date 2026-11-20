/**
 * 稀釋與單位換算器 - 核心數學運算、單位正規化與防呆檢核模組
 */

export type MatrixType = '水樣' | '土壤' | '食品' | '其他';

export type ValidationStatus =
  | 'PASS'                 // 正常換算合格
  | 'WET_BASIS_WARNING'    // 土壤預設濕基警告（含水率=0%）
  | 'MISSING_VALUE'        // 缺失值（如 F-304 缺上機濃度）
  | 'UNKNOWN_UNIT'         // 單位無法辨識
  | 'INCOMPLETE_PREP'      // 固體前處理資料不全（缺 V 或 W）
  | 'INVALID_MOISTURE';    // 含水率異常（>= 100%）

export interface RawSampleInput {
  id: string;
  sampleId: string;
  matrix: MatrixType;
  element: string;
  rawConc: number | null | string; // 允許字串空值
  unit: string;
  dilutionFactor: number;
  digestionVolume?: number | null; // 定容體積 (mL)
  sampleWeight?: number | null;    // 樣品重 (g)
  moisturePercent?: number;        // 土壤含水率 (%)
}

export interface ProcessedSampleResult extends RawSampleInput {
  normalizedConc: number | null;   // 正規化至 ug/L 的濃度
  reportConc: number | null;       // 最終報告濃度
  reportUnit: string;              // 報告單位 (ug/L 或 mg/kg)
  status: ValidationStatus;
  statusMessage: string;
}

/**
 * 單位正規化係數表（折算至 ug/L）
 */
export function getUnitFactor(unitStr: string): number | null {
  if (!unitStr) return null;
  // 去除前後空白並轉為全小寫
  const clean = unitStr.trim().toLowerCase();

  // 微克級：ug/L、µg/L (Unicode U+00B5)、ug/l、µg/l
  if (clean === 'ug/l' || clean === 'µg/l' || clean === 'μg/l') {
    return 1.0;
  }

  // 毫克級：mg/L -> 1000 ug/L
  if (clean === 'mg/l') {
    return 1000.0;
  }

  // 比率與體積微克級：ppb, ng/mL -> 1 ug/L
  if (clean === 'ppb' || clean === 'ng/ml') {
    return 1.0;
  }

  // 毫克級比率：ppm -> 1000 ug/L
  if (clean === 'ppm') {
    return 1000.0;
  }

  return null;
}

/**
 * 核心換算單一筆樣品
 */
export function processSample(raw: RawSampleInput): ProcessedSampleResult {
  // 1. 清理樣品編號（去除前後空格）
  const cleanSampleId = String(raw.sampleId ?? '').trim();
  const df = raw.dilutionFactor && raw.dilutionFactor > 0 ? raw.dilutionFactor : 1;
  const moisture = typeof raw.moisturePercent === 'number' ? raw.moisturePercent : 0;

  // 決定預期報告單位
  const reportUnit = raw.matrix === '水樣' ? 'µg/L' : 'mg/kg';

  // 2. 檢核數值缺失
  if (
    raw.rawConc === null ||
    raw.rawConc === undefined ||
    raw.rawConc === '' ||
    isNaN(Number(raw.rawConc))
  ) {
    return {
      ...raw,
      sampleId: cleanSampleId,
      dilutionFactor: df,
      moisturePercent: moisture,
      normalizedConc: null,
      reportConc: null,
      reportUnit,
      status: 'MISSING_VALUE',
      statusMessage: '數據缺失：原始資料缺少上機濃度',
    };
  }

  const numericConc = Number(raw.rawConc);

  // 3. 單位正規化檢核
  const factor = getUnitFactor(raw.unit);
  if (factor === null) {
    return {
      ...raw,
      sampleId: cleanSampleId,
      dilutionFactor: df,
      moisturePercent: moisture,
      normalizedConc: null,
      reportConc: null,
      reportUnit,
      status: 'UNKNOWN_UNIT',
      statusMessage: `單位未知：無法辨識「${raw.unit}」之換算關係`,
    };
  }

  // 上機標準化濃度 (ug/L)
  const normalizedConc = numericConc * factor;

  // 4. 分流計算：水樣
  if (raw.matrix === '水樣') {
    const reportConc = normalizedConc * df;
    return {
      ...raw,
      sampleId: cleanSampleId,
      dilutionFactor: df,
      moisturePercent: moisture,
      normalizedConc,
      reportConc,
      reportUnit,
      status: 'PASS',
      statusMessage: '換算成功',
    };
  }

  // 5. 分流計算：固體（土壤與食品）
  const V = raw.digestionVolume;
  const W = raw.sampleWeight;

  // 檢核固體前處理資料是否齊全
  if (V === undefined || V === null || W === undefined || W === null || V <= 0 || W <= 0) {
    return {
      ...raw,
      sampleId: cleanSampleId,
      dilutionFactor: df,
      moisturePercent: moisture,
      normalizedConc,
      reportConc: null,
      reportUnit,
      status: 'INCOMPLETE_PREP',
      statusMessage: '前處理不全：缺少定容體積 (V) 或樣品重 (W)',
    };
  }

  // 6. 食品（濕基/鮮重基準）
  if (raw.matrix === '食品') {
    // 公式：C_norm (ug/L) * DF * V (mL) / (W (g) * 1000) = mg/kg
    const reportConc = (normalizedConc * df * V) / (W * 1000);
    return {
      ...raw,
      sampleId: cleanSampleId,
      dilutionFactor: df,
      moisturePercent: moisture,
      normalizedConc,
      reportConc,
      reportUnit,
      status: 'PASS',
      statusMessage: '換算成功（食品濕重基準）',
    };
  }

  // 7. 土壤（乾基校正基準）
  if (raw.matrix === '土壤') {
    // 檢核含水率是否合理
    if (moisture >= 100 || moisture < 0) {
      return {
        ...raw,
        sampleId: cleanSampleId,
        dilutionFactor: df,
        moisturePercent: moisture,
        normalizedConc,
        reportConc: null,
        reportUnit,
        status: 'INVALID_MOISTURE',
        statusMessage: `含水率異常：數值 (${moisture}%) 需在 0% ~ 99.9% 之間`,
      };
    }

    const dryFactor = 1 - moisture / 100;
    const reportConc = (normalizedConc * df * V) / (W * 1000 * dryFactor);

    if (moisture === 0) {
      return {
        ...raw,
        sampleId: cleanSampleId,
        dilutionFactor: df,
        moisturePercent: moisture,
        normalizedConc,
        reportConc,
        reportUnit,
        status: 'WET_BASIS_WARNING',
        statusMessage: '以濕基計算（未輸入含水率，設為 0%）',
      };
    }

    return {
      ...raw,
      sampleId: cleanSampleId,
      dilutionFactor: df,
      moisturePercent: moisture,
      normalizedConc,
      reportConc,
      reportUnit,
      status: 'PASS',
      statusMessage: `乾基校正成功（扣除含水率 ${moisture}%）`,
    };
  }

  // 其他未知基質預設走直接換算
  const fallbackConc = normalizedConc * df;
  return {
    ...raw,
    sampleId: cleanSampleId,
    dilutionFactor: df,
    moisturePercent: moisture,
    normalizedConc,
    reportConc: fallbackConc,
    reportUnit,
    status: 'PASS',
    statusMessage: '換算成功',
  };
}

/**
 * 批次處理整張樣品表
 */
export function processAllSamples(rows: RawSampleInput[]): ProcessedSampleResult[] {
  return rows.map(processSample);
}
