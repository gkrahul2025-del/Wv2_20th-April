const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/orders.json');

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function save(entry) {
  const orders = readAll();
  orders.push(entry);
  fs.writeFileSync(FILE, JSON.stringify(orders, null, 2));
}

module.exports = { save, readAll };
