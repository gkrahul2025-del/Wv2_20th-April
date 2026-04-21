const fs   = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '../data/comms.json');

function readAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function save(entry) {
  const list = readAll();
  list.push(entry);
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

module.exports = { save, readAll };
