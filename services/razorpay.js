const axios = require('axios');

async function createPaymentLink({ buyerName, product, shopifyOrderId }) {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, BASE_URL } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured in .env');
  }

  const amountPaise = Math.round(parseFloat(product.price) * 100);
  // After payment, Razorpay redirects to this URL and appends
  // ?razorpay_payment_id=XXX&razorpay_payment_link_id=YYY&razorpay_payment_link_status=paid
  const callbackUrl = (BASE_URL || 'http://localhost:3001') + '/order-confirmation.html';

  const payload = {
    amount: amountPaise,
    currency: 'INR',
    description: product.title,
    customer: { name: buyerName },
    notify: { sms: false, email: false },
    reminder_enable: false,
    callback_url: callbackUrl,
    callback_method: 'get',
    notes: {
      shopify_draft_order_id: String(shopifyOrderId || ''),
      source: 'instagram-live',
    },
    expire_by: Math.floor(Date.now() / 1000) + 30 * 60, // expires in 30 min
  };

  const { data } = await axios.post(
    'https://api.razorpay.com/v1/payment_links',
    payload,
    {
      auth: { username: RAZORPAY_KEY_ID, password: RAZORPAY_KEY_SECRET },
      headers: { 'Content-Type': 'application/json' },
    }
  );

  return data;
}

module.exports = { createPaymentLink };
