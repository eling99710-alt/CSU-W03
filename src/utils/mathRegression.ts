/**
 * 實驗室檢量線迴歸計算模組
 * 支援普通線性 (OLS) 與加權線性 (1/x, 1/x^2) 以及強制過原點 (y = ax)
 */

export type WeightMode = 'none' | '1/x' | '1/x^2';

export interface DataPoint {
  id: string;
  name?: string;
  x: number; // 濃度 (Nominal Concentration)
  y: number; // 訊號值或面積比 (Response or Response Ratio)
  enabled?: boolean;
}

export interface RegressionResult {
  slope: number;             // 斜率 a
  intercept: number;         // 截距 b
  rSquared: number;          // 判定係數 R²
  correlationCoefficient: number; // 相關係數 r
  equationText: string;      // 方程式字串表示
  weightMode: WeightMode;
  forceZero: boolean;
  points: {
    x: number;
    y: number;
    yCalc: number;
    xCalc: number;
    residual: number;
    percentRE: number;       // 相對誤差 %RE = (xCalc - x) / x * 100
    isPass: boolean;         // 是否通過 QC 容許標準
  }[];
  isValid: boolean;
  errorMessage?: string;
}

export function calculateRegression(
  rawPoints: DataPoint[],
  weightMode: WeightMode = 'none',
  forceZero: boolean = false,
  reThreshold: number = 15,
  loqReThreshold: number = 20
): RegressionResult {
  // 過濾有效點
  const validPoints = rawPoints.filter(p => p.enabled !== false && !isNaN(p.x) && !isNaN(p.y) && p.x > 0);

  if (validPoints.length < 3) {
    return {
      slope: 0,
      intercept: 0,
      rSquared: 0,
      correlationCoefficient: 0,
      equationText: '點數不足（至少需 3 點）',
      weightMode,
      forceZero,
      points: [],
      isValid: false,
      errorMessage: '檢量線至少需 3 個有效濃度標準點才能進行迴歸計算。',
    };
  }

  // 排序由小至大
  const sortedPoints = [...validPoints].sort((a, b) => a.x - b.x);
  const minX = sortedPoints[0].x;

  // 計算權重 w_i
  const weights: number[] = sortedPoints.map(p => {
    if (weightMode === '1/x') {
      return p.x > 0 ? 1 / p.x : 1;
    } else if (weightMode === '1/x^2') {
      return p.x > 0 ? 1 / (p.x * p.x) : 1;
    }
    return 1;
  });

  let slope = 0;
  let intercept = 0;

  if (forceZero) {
    // 強制過原點 y = ax => a = sum(w * x * y) / sum(w * x^2)
    let sumWXY = 0;
    let sumWXX = 0;
    for (let i = 0; i < sortedPoints.length; i++) {
      const w = weights[i];
      const { x, y } = sortedPoints[i];
      sumWXY += w * x * y;
      sumWXX += w * x * x;
    }
    slope = sumWXX !== 0 ? sumWXY / sumWXX : 0;
    intercept = 0;
  } else {
    // 一般加權迴歸 y = ax + b
    let sumW = 0;
    let sumWX = 0;
    let sumWY = 0;
    for (let i = 0; i < sortedPoints.length; i++) {
      const w = weights[i];
      const { x, y } = sortedPoints[i];
      sumW += w;
      sumWX += w * x;
      sumWY += w * y;
    }

    const xBarW = sumWX / sumW;
    const yBarW = sumWY / sumW;

    let num = 0;
    let den = 0;
    for (let i = 0; i < sortedPoints.length; i++) {
      const w = weights[i];
      const { x, y } = sortedPoints[i];
      num += w * (x - xBarW) * (y - yBarW);
      den += w * (x - xBarW) * (x - xBarW);
    }

    slope = den !== 0 ? num / den : 0;
    intercept = yBarW - slope * xBarW;
  }

  // 計算 R² 與反算各點
  let ssTot = 0;
  let ssRes = 0;
  const yMean = sortedPoints.reduce((acc, p) => acc + p.y, 0) / sortedPoints.length;

  const pointsEvaluated = sortedPoints.map((p) => {
    const yCalc = slope * p.x + intercept;
    const residual = p.y - yCalc;
    const xCalc = slope !== 0 ? (p.y - intercept) / slope : 0;
    const percentRE = p.x !== 0 ? ((xCalc - p.x) / p.x) * 100 : 0;

    // LOQ 點允許更寬容的標準 (如 20%)，其餘點 (如 15%)
    const threshold = Math.abs(p.x - minX) < 1e-9 ? loqReThreshold : reThreshold;
    const isPass = Math.abs(percentRE) <= threshold;

    ssTot += Math.pow(p.y - yMean, 2);
    ssRes += Math.pow(p.y - yCalc, 2);

    return {
      x: p.x,
      y: p.y,
      yCalc,
      xCalc,
      residual,
      percentRE,
      isPass,
    };
  });

  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  const correlationCoefficient = Math.sqrt(rSquared);

  // 方程式字串格式化
  const sign = intercept >= 0 ? '+' : '-';
  const absIntercept = Math.abs(intercept).toPrecision(4);
  const slopeStr = slope.toPrecision(5);
  const equationText = forceZero
    ? `y = ${slopeStr}x`
    : `y = ${slopeStr}x ${sign} ${absIntercept}`;

  return {
    slope,
    intercept,
    rSquared,
    correlationCoefficient,
    equationText,
    weightMode,
    forceZero,
    points: pointsEvaluated,
    isValid: true,
  };
}

/**
 * 依據迴歸方程反算未知樣品濃度
 */
export function calculateUnknownConcentration(
  y: number,
  slope: number,
  intercept: number
): number {
  if (slope === 0) return 0;
  return (y - intercept) / slope;
}
