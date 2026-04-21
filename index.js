require('dotenv').config();
const express = require('express');
const path = require('path');
const webhookRouter = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// ManyChat webhook + order log
app.use('/webhook', webhookRouter);

app.listen(PORT, () => {
  console.log(`Shrinkray Studios server started on port ${PORT}`);
  console.log(`  POST http://localhost:${PORT}/webhook/manychat  ← ManyChat sends here`);
  console.log(`  GET  http://localhost:${PORT}/webhook/orders    ← view all order attempts`);
});
