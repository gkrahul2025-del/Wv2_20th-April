const axios = require('axios');

async function createDraftOrder({ buyerName, product, note }) {
  const { SHOPIFY_STORE, SHOPIFY_ACCESS_TOKEN } = process.env;

  if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Shopify credentials not configured in .env');
  }

  const lineItem = product.shopifyVariantId
    ? { variant_id: product.shopifyVariantId, quantity: 1 }
    : { title: product.title, price: product.price, quantity: 1 };

  const payload = {
    draft_order: {
      line_items: [lineItem],
      note: note || 'Instagram Live Sale',
      tags: 'instagram-live,manychat',
    },
  };

  const { data } = await axios.post(
    `https://${SHOPIFY_STORE}/admin/api/2024-01/draft_orders.json`,
    payload,
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    }
  );

  return data.draft_order;
}

module.exports = { createDraftOrder };
