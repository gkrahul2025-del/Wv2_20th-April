const fs   = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '../data/order_stages.json');

function readAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}

function setStage(orderId, data) {
  const stages = readAll();
  stages[orderId] = { ...(stages[orderId] || {}), ...data };
  fs.writeFileSync(FILE, JSON.stringify(stages, null, 2));
}

module.exports = { readAll, setStage };
