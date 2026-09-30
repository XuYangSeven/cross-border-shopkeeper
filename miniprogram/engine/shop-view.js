// 店铺子页面共用的视图模型
// 职责：把「当前决策 + 操作目录 + 经营推演」整理成可直接 setData 的结构。
// 约束：纯函数，不依赖 wx，不读写存储，不修改入参。

const shopEngine = require('./shop');

// ===== 指标展示 =====
const KPI_DEFS = [
  { key: 'visitors', label: '周访客', unit: '', better: 'high' },
  { key: 'conversion', label: '转化率', unit: '%', better: 'high' },
  { key: 'sales', label: '周销售额', unit: '$', better: 'high' },
  { key: 'acos', label: 'ACOS', unit: '%', better: 'low' },
  { key: 'stockDays', label: '库存水位', unit: '天', better: 'high' },
  { key: 'rating', label: '店铺评分', unit: '', better: 'high' },
];

function formatValue(def, value) {
  if (value === undefined || value === null) return '—';
  if (def.unit === '$') return `$${value}`;
  return `${value}${def.unit}`;
}

function buildKpiTiles(kpis, snapshot) {
  const source = kpis || {};
  return KPI_DEFS.map(def => {
    const value = source[def.key];
    const prev = snapshot ? snapshot[def.key] : undefined;
    let deltaText = '';
    let tone = 'flat';
    if (typeof value === 'number' && typeof prev === 'number' && Math.abs(value - prev) > 0.049) {
      const diff = Math.round((value - prev) * 10) / 10;
      const rising = diff > 0;
      const good = def.better === 'high' ? rising : !rising;
      tone = good ? 'up' : 'down';
      deltaText = `${rising ? '▲' : '▼'}${Math.abs(diff)}`;
    }
    return { key: def.key, label: def.label, value: formatValue(def, value), deltaText, tone };
  });
}

function formatPoints(points) {
  return Number(points) === 0 ? '不消耗行动点' : `${points} 行动点`;
}

function formatCost(costCNY) {
  return Number(costCNY) > 0 ? `¥${costCNY}` : '免费';
}

// 预估一项操作对关键指标的即时影响，让因果可见
function previewAction(shop, actionId) {
  const before = shopEngine.deriveKpis(shop);
  const result = shopEngine.applyAction(shop, actionId);
  if (!result.ok) return '';
  const after = result.kpis;
  const parts = [];
  if (result.shipmentNote) parts.push(result.shipmentNote);
  if (after.visitors !== before.visitors) parts.push(`周访客 ${before.visitors} → ${after.visitors}`);
  if (after.orders !== before.orders) parts.push(`周订单 ${before.orders} → ${after.orders}`);
  if (after.acos !== before.acos) parts.push(`ACOS ${before.acos}% → ${after.acos}%`);
  if (!result.shipmentNote && after.stockDays !== before.stockDays) parts.push(`库存覆盖 ${before.stockDays} → ${after.stockDays} 天`);
  if (after.margin !== before.margin) parts.push(`毛利率 ${before.margin}% → ${after.margin}%`);
  if (!parts.length) parts.push('本项不直接改变推演指标');
  return parts.join('；');
}

function buildActionRows(shop, module) {
  return shopEngine.describeActions(shop, module).map(action => ({
    id: action.id,
    label: action.label,
    desc: action.desc,
    pointsText: formatPoints(action.points),
    costText: formatCost(action.costCNY),
    limitText: `本周剩 ${action.remainingTimes} / ${action.limit} 次`,
    gateText: action.gateText,
    available: action.available,
    reason: action.reason,
    preview: action.available ? previewAction(shop, action.id) : action.reason,
  }));
}

// 决策评分行：带权重百分比与进度宽度
function buildDecisionRows(decision) {
  const rows = (decision && decision.rows) || [];
  return rows.map(row => ({
    ...row,
    weightText: `${Math.round(row.weight * 100)}%`,
    barWidth: Math.max(3, Math.min(100, row.score)),
    tone: row.score >= 75 ? 'good' : (row.score >= 60 ? 'mid' : 'low'),
  }));
}

module.exports = { KPI_DEFS, formatValue, buildKpiTiles, buildActionRows, previewAction, buildDecisionRows, formatCost, formatPoints };
