const express = require('express');
const router = express.Router();
const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const gsheetAgent = new https.Agent({ rejectUnauthorized: false }); // Google cert chain on local dev
const PRODUCTS = require('../products');
const { createDraftOrder } = require('../services/shopify');
const { createPaymentLink } = require('../services/razorpay');
const { save } = require('../services/orders');
const { save: saveEvent, readAll: readEvents, funnel, timeSeries } = require('../services/events');
const { sendOrderConfirmation, sendPaymentReceipt, sendOrderPacked, sendOrderShipped, sendOrderDelivered, sendOrderFeedback, sendBroadcast } = require('../services/mailer');
const { readAll: readStages, setStage } = require('../services/stages');
const { save: saveComm, readAll: readComms } = require('../services/comms');

// ── Push a row / update to Google Sheet ──────────────────────────────────────
// Use GET to avoid Google's redirect stripping the POST body (411 error)
async function pushToSheet(payload) {
  const url = process.env.GSHEET_WEBHOOK_URL;
  if (!url) return;
  try {
    const params = new URLSearchParams({ data: JSON.stringify(payload) });
    const res = await axios.get(`${url}?${params.toString()}`, { httpsAgent: gsheetAgent });
    console.log('[GSheet] push ok:', res.data);
  } catch (err) {
    console.warn('[GSheet] push failed:', err.message);
  }
}

// POST /webhook/manychat
// Called by ManyChat when a buyer DMs a keyword during Instagram Live
router.post('/manychat', async (req, res) => {
  const timestamp = new Date().toISOString();
  const body = req.body;

  // --- Parse ManyChat payload ---
  // ManyChat sends subscriber info + last_input_text (the DM keyword)
  const buyerName = body.name || body.first_name || 'Unknown Buyer';
  const keyword = (body.last_input_text || '').trim().toUpperCase();

  console.log(`[${timestamp}] Incoming: buyer="${buyerName}" keyword="${keyword}"`);

  // --- Match keyword to product ---
  const product = PRODUCTS[keyword];

  const orderEntry = {
    timestamp,
    buyerName,
    keyword,
    status: 'pending',
    shopifyDraftOrderId: null,
    paymentLink: null,
    error: null,
  };

  if (!product) {
    orderEntry.status = 'unknown_keyword';
    orderEntry.error = `No product mapped for keyword "${keyword}"`;
    save(orderEntry);
    console.warn(`[${timestamp}] Unknown keyword: "${keyword}"`);
    return res.status(200).json({
      success: false,
      message: `Sorry, "${keyword}" didn't match any product. Try BUY 1, BUY 2, etc.`,
    });
  }

  try {
    // --- Create Shopify draft order ---
    const draftOrder = await createDraftOrder({
      buyerName,
      product,
      note: `Instagram Live — ${keyword} by ${buyerName}`,
    });
    orderEntry.shopifyDraftOrderId = draftOrder.id;
    console.log(`[${timestamp}] Shopify draft order created: #${draftOrder.id}`);

    // --- Create Razorpay payment link ---
    const paymentLink = await createPaymentLink({
      buyerName,
      product,
      shopifyOrderId: draftOrder.id,
    });
    orderEntry.paymentLink = paymentLink.short_url;
    orderEntry.status = 'payment_link_created';
    console.log(`[${timestamp}] Razorpay link: ${paymentLink.short_url}`);

    save(orderEntry);

    // ManyChat can read `payment_url` from the response to set a variable
    return res.status(200).json({
      success: true,
      buyer: buyerName,
      product: product.title,
      amount: `₹${product.price}`,
      payment_url: paymentLink.short_url,
      message: `Hi ${buyerName}! Here's your payment link for ${product.title}: ${paymentLink.short_url} (valid 30 min)`,
    });
  } catch (err) {
    orderEntry.status = 'error';
    orderEntry.error = err.message;
    save(orderEntry);
    console.error(`[${timestamp}] Error:`, err.message);

    return res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
      error: err.message,
    });
  }
});

// POST /webhook/order — frontend checkout order submission
router.post('/order', async (req, res) => {
  const timestamp = new Date().toISOString();
  const { name, phone, email, city, state, address, pincode, qty, price, totalPrice, sid } = req.body;

  const orderId = 'SRX' + Date.now();
  const orderEntry = {
    timestamp,
    source: 'frontend',
    buyerName: name || 'Unknown',
    phone, email, city, state, address, pincode,
    qty, price, totalPrice,
    status: 'received',
    orderId,
    payment_url: null,
  };

  // Try to create a Razorpay payment link
  let payment_url = null;
  try {
    const rzp = await createPaymentLink({
      buyerName: name,
      product: { title: 'Heavyweight Hoodie', price: totalPrice },
      shopifyOrderId: orderId,
    });
    payment_url = rzp.short_url;
    orderEntry.payment_url = payment_url;
    orderEntry.status = 'payment_link_created';
  } catch (err) {
    // Razorpay not configured or failed — proceed without link
    console.warn(`[${timestamp}] Razorpay skipped: ${err.message}`);
  }

  save(orderEntry);
  saveEvent({ event: 'order_placed', ts: timestamp, orderId, totalPrice, sid: sid || null });
  console.log(`[${timestamp}] Frontend order: ${name} | ₹${totalPrice} | ${city}`);

  // Email sent after payment confirmed — not here

  // Push to Google Sheet (fire-and-forget)
  pushToSheet({
    type: 'order_placed',
    timestamp, orderId,
    name, phone, email,
    city, state, address, pincode,
    qty, price, totalPrice,
  });

  return res.status(200).json({ success: true, orderId, payment_url });
});

// POST /webhook/payment-confirmed — called by confirmation page after Razorpay redirect
router.post('/payment-confirmed', async (req, res) => {
  const { orderId, paymentId, sid } = req.body;
  if (!orderId) return res.status(400).json({ success: false });

  const ts = new Date().toISOString();
  console.log(`[${ts}] Payment confirmed: ${orderId} | ${paymentId}`);

  saveEvent({ event: 'payment_completed', ts, orderId, paymentId, sid: sid || null });

  // Send payment receipt email (fire-and-forget)
  try {
    const { readAll: readOrders } = require('../services/orders');
    const order = readOrders().find(o => o.orderId === orderId);
    if (order?.email) {
      sendPaymentReceipt({
        name: order.buyerName,
        email: order.email,
        orderId,
        paymentId,
        totalPrice: order.totalPrice,
        qty: order.qty,
        phone: order.phone,
        address: order.address,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
      }).catch(err => console.warn('[Mailer] receipt failed:', err.message));
    }
  } catch {}

  // Update Google Sheet row to PAID
  await pushToSheet({ type: 'payment_confirmed', orderId, paymentId });

  return res.status(200).json({ success: true });
});

// GET /webhook/orders — quick view of all order attempts
router.get('/orders', (req, res) => {
  const { readAll } = require('../services/orders');
  res.json(readAll());
});

// POST /webhook/track — frontend event tracking
router.post('/track', (req, res) => {
  const { event, ...data } = req.body;
  if (!event) return res.status(400).json({ success: false });
  saveEvent({ event, ts: new Date().toISOString(), ...data });
  res.json({ success: true });
});

// GET /webhook/analytics — funnel + insights (key-protected)
router.get('/analytics', (req, res) => {
  const key = process.env.ANALYTICS_KEY;
  if (key && req.query.key !== key) return res.status(401).json({ error: 'Unauthorized' });

  const period = ['today','7d','all'].includes(req.query.period) ? req.query.period : 'all';
  const { totals, unique } = funnel(period);

  const STEPS = [
    { key: 'page_load',         label: 'Page Lands' },
    { key: 'code_unlocked',     label: 'Code Unlocked' },
    { key: 'checkout_started',  label: 'Checkout Started' },
    { key: 'order_placed',      label: 'Order Placed' },
    { key: 'payment_completed', label: 'Payment Completed' },
  ];

  const topUnique = unique[STEPS[0].key] || 0;
  const funnelSteps = STEPS.map((s, i) => {
    const u    = unique[s.key]  || 0;
    const t    = totals[s.key]  || 0;
    const prev = i > 0 ? (unique[STEPS[i - 1].key] || 0) : u;
    return {
      ...s,
      unique:    u,
      total:     t,
      pctOfTop:  topUnique > 0 ? Math.round((u / topUnique) * 100) : 0,
      stepConv:  i === 0 ? 100 : (prev > 0 ? Math.round((u / prev) * 100) : 0),
      dropPct:   i === 0 ? null : (prev > 0 ? Math.round((1 - u / prev) * 100) : null),
    };
  });

  // Extras
  const extras = {
    code_invalid:      { total: totals.code_invalid || 0,     unique: unique.code_invalid || 0 },
    code_reused:       { total: totals.code_reused || 0,      unique: unique.code_reused || 0 },
    payment_started:   { total: totals.payment_started || 0,  unique: unique.payment_started || 0 },
    payment_cancelled: { total: totals.payment_cancelled || 0, unique: unique.payment_cancelled || 0 },
  };

  // Avg order value + total revenue from orders.json
  let avgOrderValue = 0;
  let totalRevenue  = 0;
  try {
    const { readAll: readOrders } = require('../services/orders');
    const orders = readOrders().filter(o => o.source === 'frontend' && o.totalPrice > 0);
    if (orders.length) {
      totalRevenue  = orders.reduce((s, o) => s + o.totalPrice, 0);
      avgOrderValue = Math.round(totalRevenue / orders.length);
    }
  } catch {}

  // Actionable insights — server-computed
  const insights = [];
  const [land, code, checkout, order, paid] = funnelSteps;

  if (land.unique > 0) {
    if (code.dropPct > 60)
      insights.push({ sev: 'high', step: 'Landing → Code', issue: `${code.dropPct}% leave without entering a code`, fix: 'Move the code input higher — ensure it\'s visible without scrolling. Add a pulsing indicator.' });
    else if (code.dropPct > 30)
      insights.push({ sev: 'med', step: 'Landing → Code', issue: `${code.dropPct}% don\'t enter a code`, fix: 'Add urgency text near the input, e.g. "Code expires in 2 min!"' });

    if (checkout.dropPct > 40)
      insights.push({ sev: 'high', step: 'Code → Checkout', issue: `${checkout.dropPct}% unlock but don\'t proceed`, fix: 'Check if the Slide to Grab button is visible after code unlock. Reduce scroll needed.' });
    else if (checkout.dropPct > 20)
      insights.push({ sev: 'med', step: 'Code → Checkout', issue: `${checkout.dropPct}% unlock but don\'t proceed`, fix: 'Auto-scroll to the CTA after code unlock.' });

    if (order.dropPct > 30)
      insights.push({ sev: 'high', step: 'Checkout → Order', issue: `${order.dropPct}% start checkout but don\'t complete`, fix: 'Shorten the form — name, phone, city is enough for step 1. Delay address to step 2.' });
    else if (order.dropPct > 15)
      insights.push({ sev: 'med', step: 'Checkout → Order', issue: `${order.dropPct}% abandon during checkout`, fix: 'Add autofill hints and reduce required fields.' });

    if (paid.dropPct > 30)
      insights.push({ sev: 'high', step: 'Order → Payment', issue: `${paid.dropPct}% reach Razorpay but don\'t pay`, fix: 'Enable UPI as default. Check if Razorpay redirect is working. Send a WhatsApp follow-up.' });
    else if (paid.dropPct > 15)
      insights.push({ sev: 'med', step: 'Order → Payment', issue: `${paid.dropPct}% abandon at payment`, fix: 'Show trust badges (Razorpay / PCI-DSS) prominently on payment overlay.' });

    if (extras.code_invalid.total > land.unique * 0.15)
      insights.push({ sev: 'med', step: 'Code Entry', issue: `${extras.code_invalid.total} invalid code attempts`, fix: 'Add a format hint directly under the input: "4 letters + 4 numbers, e.g. LIVE1234".' });

    if (extras.payment_cancelled.total > 0)
      insights.push({ sev: 'med', step: 'Payment', issue: `${extras.payment_cancelled.total} cancelled at Razorpay`, fix: 'Set up Razorpay payment link expiry to 15 min and send an abandoned-cart WhatsApp.' });
  }

  if (!insights.length)
    insights.push({ sev: 'ok', step: 'All steps', issue: 'No significant drop-offs detected yet', fix: 'Collect more data — run a live session to populate the funnel.' });

  const ts = timeSeries();

  res.json({ funnel: funnelSteps, extras, avgOrderValue, totalRevenue, insights, timeSeries: ts, period });
});

// GET /webhook/live-status — returns current live state
router.get('/live-status', (req, res) => {
  try {
    const live = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/live.json'), 'utf8'));
    res.json(live);
  } catch {
    res.json({ active: false, lastLive: null, nextHint: '' });
  }
});

// GET /webhook/live-toggle — key-protected on/off toggle
router.get('/live-toggle', (req, res) => {
  const key = process.env.ANALYTICS_KEY;
  if (key && req.query.key !== key) return res.status(401).json({ error: 'Unauthorized' });

  const action = req.query.action; // 'on' or 'off'
  if (!['on', 'off'].includes(action)) return res.status(400).json({ error: 'Use ?action=on or ?action=off' });

  const filePath = path.join(__dirname, '../data/live.json');
  let live = {};
  try { live = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}

  live.active = action === 'on';
  if (action === 'off' && live.lastLive === null) {
    live.lastLive = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (action === 'off') {
    live.lastLive = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  fs.writeFileSync(filePath, JSON.stringify(live, null, 2));
  // Return flat shape so admin.html can read d.active / d.lastLive directly
  res.json({ success: true, active: live.active, lastLive: live.lastLive || null });
});

// ── GET /webhook/paid-orders — paid orders enriched with stage ────────────────
router.get('/paid-orders', (req, res) => {
  const key = process.env.ANALYTICS_KEY;
  if (key && req.query.key !== key) return res.status(401).json({ error: 'Unauthorized' });

  const { readAll: readOrders }  = require('../services/orders');
  const { readAll: readEvents }  = require('../services/events');
  const stages = readStages();

  const paidIds = new Set(
    readEvents().filter(e => e.event === 'payment_completed').map(e => e.orderId)
  );

  const paid = readOrders()
    .filter(o => o.source === 'frontend' && paidIds.has(o.orderId))
    .map(o => ({
      ...o,
      stage:          stages[o.orderId]?.stage      || 'confirmed',
      trackingUrl:    stages[o.orderId]?.trackingUrl || null,
      stageUpdatedAt: stages[o.orderId]?.updatedAt   || null,
    }));

  res.json(paid);
});

// ── GET /webhook/nonpaid-orders — frontend orders without payment_completed ───
router.get('/nonpaid-orders', (req, res) => {
  const key = process.env.ANALYTICS_KEY;
  if (key && req.query.key !== key) return res.status(401).json({ error: 'Unauthorized' });

  const { readAll: readOrders } = require('../services/orders');
  const { readAll: readEvents } = require('../services/events');

  const paidIds = new Set(
    readEvents().filter(e => e.event === 'payment_completed').map(e => e.orderId)
  );

  const nonPaid = readOrders()
    .filter(o => o.source === 'frontend' && !paidIds.has(o.orderId) && (o.phone || o.email));

  res.json(nonPaid);
});

// ── POST /webhook/order-stage — advance stage + auto-send email ───────────────
router.post('/order-stage', async (req, res) => {
  const key = process.env.ANALYTICS_KEY;
  if (key && req.headers['x-admin-key'] !== key) return res.status(401).json({ error: 'Unauthorized' });

  const { orderId, stage, trackingUrl } = req.body;
  if (!orderId || !stage) return res.status(400).json({ error: 'orderId and stage required' });

  setStage(orderId, { stage, trackingUrl: trackingUrl || null, updatedAt: new Date().toISOString() });

  const { readAll: readOrders } = require('../services/orders');
  const order = readOrders().find(o => o.orderId === orderId);
  let emailSent = false;

  if (order?.email) {
    try {
      if (stage === 'packed')    await sendOrderPacked(order);
      if (stage === 'shipped')   await sendOrderShipped({ ...order, trackingUrl });
      if (stage === 'delivered') await sendOrderDelivered(order);
      if (stage === 'feedback')  await sendOrderFeedback(order);
      emailSent = true;
    } catch (e) {
      console.warn('[Mailer] stage email failed:', e.message);
    }

    saveComm({
      ts: new Date().toISOString(), orderId, stage,
      buyerName: order.buyerName, phone: order.phone, email: order.email,
      channel: 'email', status: emailSent ? 'sent' : 'failed',
    });
  }

  res.json({ success: true, emailSent });
});

// ── GET /webhook/comm-log ─────────────────────────────────────────────────────
router.get('/comm-log', (req, res) => {
  const key = process.env.ANALYTICS_KEY;
  if (key && req.query.key !== key) return res.status(401).json({ error: 'Unauthorized' });
  res.json(readComms());
});

// ── POST /webhook/comm-log — log a WA send from the frontend ─────────────────
router.post('/comm-log', (req, res) => {
  const { orderId, stage, buyerName, phone, email, channel } = req.body;
  if (!orderId || !channel) return res.status(400).json({ error: 'missing fields' });
  saveComm({ ts: new Date().toISOString(), orderId, stage: stage || '', buyerName, phone, email, channel, status: 'generated' });
  res.json({ success: true });
});

// ── POST /webhook/broadcast-email — send email campaign ──────────────────────
router.post('/broadcast-email', async (req, res) => {
  const key = process.env.ANALYTICS_KEY;
  if (key && req.headers['x-admin-key'] !== key) return res.status(401).json({ error: 'Unauthorized' });

  const { audience, subject, message } = req.body;
  if (!subject || !message) return res.status(400).json({ error: 'subject and message required' });

  const { readAll: readOrders } = require('../services/orders');
  const { readAll: readEvents } = require('../services/events');
  const orders  = readOrders().filter(o => o.source === 'frontend' && o.email);
  const paidIds = new Set(readEvents().filter(e => e.event === 'payment_completed').map(e => e.orderId));

  const targets = audience === 'paid'    ? orders.filter(o =>  paidIds.has(o.orderId))
                : audience === 'nonpaid' ? orders.filter(o => !paidIds.has(o.orderId))
                : orders;

  let sent = 0, failed = 0;
  for (const o of targets) {
    try {
      await sendBroadcast({ name: o.buyerName, email: o.email, subject, message });
      saveComm({ ts: new Date().toISOString(), orderId: o.orderId || '', stage: 'broadcast',
        buyerName: o.buyerName, phone: o.phone, email: o.email, channel: 'email', status: 'sent' });
      sent++;
    } catch (e) {
      failed++;
    }
  }

  res.json({ success: true, sent, failed });
});

module.exports = router;
