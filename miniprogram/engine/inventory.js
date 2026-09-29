const freight = require('../config/freight');

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function calculateReorderPoint({ dailySales, leadTimeDays, safetyDays }) {
  const daily = Math.max(0, number(dailySales));
  return Math.ceil(daily * Math.max(0, number(leadTimeDays)) + Math.max(0, number(safetyDays)));
}

function calculateShipment({ units, weightKg, freightKey }) {
  const method = freight[freightKey] || freight.air;
  const count = Math.max(0, number(units));
  const weight = Math.max(0, number(weightKg));
  const costCNY = Math.round(count * weight * method.pricePerKgCNY * 100) / 100;
  return {
    freightKey: method.key,
    freightName: method.name,
    units: count,
    weightKg: weight,
    leadTimeDays: method.days,
    costCNY,
  };
}

function simulateInventory({ days, initialStock, dailySales, shipmentUnits, leadTimeDays, reorderPoint }) {
  const totalDays = Math.max(0, Math.floor(number(days)));
  const daily = Math.max(0, number(dailySales));
  const lead = Math.max(0, Math.floor(number(leadTimeDays)));
  const quantity = Math.max(0, number(shipmentUnits));
  const point = Math.max(0, number(reorderPoint));
  let stock = Math.max(0, number(initialStock));
  const arrivals = {};
  const events = [];
  let stockoutDays = 0;
  let inTransit = 0;
  let soldUnits = 0;
  let holdingCost = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const arriving = arrivals[day] || 0;
    if (arriving) {
      stock += arriving;
      inTransit -= arriving;
      events.push({ day, type: 'arrival', units: arriving, stock });
    }
    const sold = Math.min(stock, daily);
    stock -= sold;
    soldUnits += sold;
    if (sold < daily) stockoutDays += 1;
    holdingCost += stock * 0.02;
    if (stock <= point && quantity > 0 && inTransit === 0) {
      const arrivalDay = day + lead;
      inTransit += quantity;
      if (arrivalDay <= totalDays) arrivals[arrivalDay] = (arrivals[arrivalDay] || 0) + quantity;
      events.push({ day, type: 'reorder', units: quantity, arrivalDay, stock });
    }
  }

  const totalCost = Math.round((holdingCost + stockoutDays * 10) * 100) / 100;
  return {
    days: totalDays,
    endingStock: stock,
    stockoutDays,
    inTransit,
    soldUnits,
    reorderEvents: events.filter(event => event.type === 'reorder'),
    events,
    holdingCost: Math.round(holdingCost * 100) / 100,
    stockoutCost: stockoutDays * 10,
    logisticsCost: 0,
    totalCost,
  };
}

module.exports = { calculateReorderPoint, calculateShipment, simulateInventory };
