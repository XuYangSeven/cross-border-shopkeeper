function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error('成本必须是非负整数分');
  return n;
}

function validateCount(name, value) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name}必须是非负整数`);
  return value;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function optionFor(scenario, optionId) {
  const option = scenario.options.find(item => item.id === optionId);
  if (!option) throw new Error(`未知客服方案：${optionId}`);
  return option;
}

function outcomeCost(outcome) {
  const cost = outcome.cost || {};
  return cents(cost.refundCents || 0) + cents(cost.replacementCents || 0)
    + cents(cost.shippingCents || 0) + cents(cost.compensationCents || 0);
}

function evaluateScenario({ scenario, optionId, responseLimitHours }) {
  if (!scenario || !Array.isArray(scenario.options)) throw new Error('客服案例配置无效');
  const option = optionFor(scenario, optionId);
  const outcome = option.outcome;
  const responseHours = Number(outcome.responseHours);
  const qualityScore = Number(outcome.qualityScore);
  const satisfactionDelta = Number(outcome.satisfactionDelta);
  if (!Number.isFinite(responseHours) || responseHours < 0) throw new Error('响应时长无效');
  if (!Number.isFinite(qualityScore) || qualityScore < 0 || qualityScore > 100) throw new Error('方案质量无效');
  if (!Number.isFinite(satisfactionDelta) || satisfactionDelta < -100 || satisfactionDelta > 100) throw new Error('满意度变化无效');
  const limit = Number(responseLimitHours);
  const initial = Number(scenario.initialSatisfaction);
  const costCents = outcomeCost(outcome);
  return {
    optionId,
    qualityScore,
    compliant: !!outcome.compliant,
    timely: responseHours <= limit,
    responseHours,
    resolved: !!outcome.resolved,
    satisfaction: clamp(initial + satisfactionDelta, 0, 100),
    costCents,
    explanation: option.explanation,
    text: option.text,
  };
}

function calculateServiceMetrics({ ticketCount, timelyCount, resolvedCount, orderCount, refundedOrderCount, ratingCount, satisfiedCount }) {
  const values = { ticketCount, timelyCount, resolvedCount, orderCount, refundedOrderCount, ratingCount, satisfiedCount };
  Object.keys(values).forEach(key => validateCount(key, values[key]));
  if (timelyCount > ticketCount || resolvedCount > ticketCount || refundedOrderCount > orderCount || satisfiedCount > ratingCount) {
    throw new Error('指标分子不能大于分母');
  }
  return {
    timelyResponseRate: ratio(timelyCount, ticketCount),
    resolutionRate: ratio(resolvedCount, ticketCount),
    refundRate: ratio(refundedOrderCount, orderCount),
    satisfactionRate: ratio(satisfiedCount, ratingCount),
  };
}

function summarizeCustomerCases({ cases, selections, responseLimitHours }) {
  if (!Array.isArray(cases) || !selections) throw new Error('客服工单配置无效');
  const results = cases.map(item => {
    if (!Object.prototype.hasOwnProperty.call(selections, item.id)) throw new Error(`工单未选择方案：${item.id}`);
    return { caseId: item.id, title: item.title, ...evaluateScenario({ scenario: item, optionId: selections[item.id], responseLimitHours }) };
  });
  const total = results.length;
  const costCents = results.reduce((sum, item) => sum + item.costCents, 0);
  return {
    results,
    qualityScore: results.reduce((sum, item) => sum + item.qualityScore, 0) / total,
    compliant: results.every(item => item.compliant),
    timelyResponseRate: results.filter(item => item.timely).length / total,
    resolutionRate: results.filter(item => item.resolved).length / total,
    averageSatisfaction: results.reduce((sum, item) => sum + item.satisfaction, 0) / total,
    costCents,
  };
}

function evaluateCustomerBoss({ cases, selections, responseLimitHours, targets }) {
  const summary = summarizeCustomerCases({ cases, selections, responseLimitHours });
  const failureReasons = [];
  if (!summary.compliant) failureReasons.push('存在不合规处理');
  if (summary.timelyResponseRate < targets.minTimelyResponseRate) failureReasons.push('及时响应率未达标');
  if (summary.resolutionRate < targets.minResolutionRate) failureReasons.push('解决率未达标');
  if (summary.averageSatisfaction < targets.minAverageSatisfaction) failureReasons.push('平均模拟满意度未达标');
  if (summary.qualityScore < targets.minQualityScore) failureReasons.push('方案质量均分未达标');
  if (summary.costCents > targets.maxCostCents) failureReasons.push('售后支出超预算');
  return { ...summary, passed: failureReasons.length === 0, failureReasons };
}

module.exports = { evaluateScenario, calculateServiceMetrics, summarizeCustomerCases, evaluateCustomerBoss };
