// Keyword → product mapping for Instagram Live sales
// Buyers DM "BUY 1", "BUY 2", etc. during a live session
// Edit these to match your actual products and Shopify variant IDs

const PRODUCTS = {
  'BUY 1': {
    title: 'Neon Speeder Mk.II',
    price: '499.00',
    shopifyVariantId: null, // set your Shopify variant ID or leave null for custom line item
    description: 'High-poly hover bike — 3D model pack',
  },
  'BUY 2': {
    title: 'Void Sentinel Armour',
    price: '799.00',
    shopifyVariantId: null,
    description: 'Sci-fi battle armour set — 3D model pack',
  },
  'BUY 3': {
    title: 'Crystal Cavern Scene',
    price: '349.00',
    shopifyVariantId: null,
    description: 'Atmospheric underground scene — 3D model pack',
  },
  'BUY 4': {
    title: 'Mech Companion Bot',
    price: '649.00',
    shopifyVariantId: null,
    description: 'Fully rigged robot companion — 3D model pack',
  },
};

module.exports = PRODUCTS;
