const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../data/events.json');

function readAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return []; }
}

function save(event) {
  const events = readAll();
  events.push(event);
  fs.writeFileSync(FILE, JSON.stringify(events, null, 2));
}

const FUNNEL_KEYS = ['page_load','code_unlocked','checkout_started','order_placed','payment_completed'];
const EXTRA_KEYS  = ['code_invalid','code_reused','payment_started','payment_cancelled'];

// Filter events by period: 'today' | '7d' | 'all'
function filterByPeriod(events, period) {
  if (period === 'today') {
    const start = new Date(); start.setHours(0,0,0,0);
    return events.filter(e => new Date(e.ts) >= start);
  }
  if (period === '7d') {
    const start = new Date(Date.now() - 7 * 86400000);
    return events.filter(e => new Date(e.ts) >= start);
  }
  return events;
}

function funnel(period = 'all') {
  const events = filterByPeriod(readAll(), period);

  const totals = {};
  const unique = {};
  [...FUNNEL_KEYS, ...EXTRA_KEYS].forEach(k => { totals[k] = 0; unique[k] = new Set(); });

  for (const e of events) {
    if (totals[e.event] !== undefined) {
      totals[e.event]++;
      if (e.sid) unique[e.event].add(e.sid);
    }
  }

  const uniqueCounts = {};
  for (const k of Object.keys(unique)) uniqueCounts[k] = unique[k].size;

  return { totals, unique: uniqueCounts };
}

// Returns daily breakdown (last 7 days) + 30-min slots (today)
function timeSeries() {
  const all = readAll();

  // ── Daily (last 7 days, oldest first) ──────────────────────────────────
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(); dayStart.setHours(0,0,0,0); dayStart.setDate(dayStart.getDate() - i);
    const dayEnd   = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const dayEvts  = all.filter(e => { const t = new Date(e.ts); return t >= dayStart && t < dayEnd; });
    const counts   = {};
    [...FUNNEL_KEYS, ...EXTRA_KEYS].forEach(k => { counts[k] = dayEvts.filter(e => e.event === k).length; });
    daily.push({
      label: i === 0 ? 'Today' : dayStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      ...counts,
    });
  }

  // ── 30-min slots for today (48 slots) ──────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEvts  = all.filter(e => new Date(e.ts) >= todayStart);

  const slots30 = Array.from({ length: 48 }, (_, slot) => {
    const h = Math.floor(slot / 2);
    const m = (slot % 2) * 30;
    const start = new Date(todayStart); start.setHours(h, m, 0, 0);
    const end   = new Date(start);      end.setMinutes(end.getMinutes() + 30);
    const count = todayEvts.filter(e => { const t = new Date(e.ts); return t >= start && t < end; }).length;
    const hd    = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm  = h < 12 ? 'am' : 'pm';
    return { label: `${hd}:${m === 0 ? '00' : '30'}${ampm}`, count };
  });

  const peakIdx = slots30.reduce((mi, v, i, a) => v.count > a[mi].count ? i : mi, 0);
  const peak30  = slots30[peakIdx].count > 0 ? slots30[peakIdx].label : '—';

  return { daily, slots30, peak30, todayTotal: todayEvts.length };
}

module.exports = { save, readAll, funnel, timeSeries };
