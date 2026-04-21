const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  family: 4, // force IPv4 — Railway IPv6 blocked
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const HOODIE_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAtx17E2Gx35aYyNfCV0UxkvIUnEv49486gMSGi3vPqR_jvrsHE8jmyMMJKtKAskE4nWp1T7ds452LwM5yO_8m0ggx3A5WCVv-7Qws2QPHXsSTGyvAmBtl8_S24wTnUouwJRNgXzL_YioU3emdzBf4FczUxZ3MaWlGt9VE1Qb_Ov5yhFuhuTkOdHfjTstqV8wsMIrcOTVrSIR2yRv4Oi8VqFw7kESqaIhzig8O9dWppjStP_-jn12kYyvXN_6KyIJ4RooO-7Hj0otmS';

// ── Light-theme email wrapper ──────────────────────────────────────────────────
// Header strip stays black with brand lime; body is white / light grey
function baseLayout(content) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:32px 0;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e0e0e0;">

      <!-- Brand header — black strip kept intentionally -->
      <tr>
        <td style="background:#000000;padding:20px 28px;border-bottom:3px solid #c5fe00;">
          <span style="color:#c5fe00;font-size:18px;font-weight:900;letter-spacing:2px;font-family:Arial,sans-serif;">SHRINKRAY × WABUY</span>
        </td>
      </tr>

      ${content}

      <!-- Footer -->
      <tr>
        <td style="background:#f7f7f7;padding:16px 28px;text-align:center;border-top:1px solid #e8e8e8;">
          <p style="margin:0;font-size:11px;color:#aaaaaa;">Secure Payments · Verified Seller · Encrypted</p>
          <p style="margin:4px 0 0;font-size:10px;color:#cccccc;">© Shrinkray Studios</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Order Confirmation — sent when order form is submitted ────────────────────
async function sendOrderConfirmation({ name, email, orderId, qty, totalPrice, phone, address, city, state, pincode }) {
  if (!email) return;

  const shipLine1 = address || '';
  const shipLine2 = [city, state].filter(Boolean).join(', ') + (pincode ? ' – ' + pincode : '');

  const content = `
      <tr>
        <td style="padding:0;">
          <img src="${HOODIE_IMG}" alt="Heavyweight Hoodie"
               width="520" style="width:100%;max-height:220px;object-fit:cover;display:block;"/>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 28px 0;">
          <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#1a1a1a;letter-spacing:-0.5px;">ORDER RECEIVED! 🎉</p>
          <p style="margin:0 0 20px;font-size:14px;color:#666666;line-height:1.6;">Hi ${name}, we've received your order and your payment link is being prepared.</p>
        </td>
      </tr>

      <tr>
        <td style="padding:0 28px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f9f9f9;border-radius:12px;overflow:hidden;border:1px solid #ebebeb;">

            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #ebebeb;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <p style="margin:0;font-size:9px;color:#999999;letter-spacing:1px;text-transform:uppercase;">Order ID</p>
                      <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#1a1a1a;">#${orderId}</p>
                    </td>
                    <td align="right">
                      <span style="background:#1a1a1a;color:#c5fe00;font-size:10px;font-weight:900;padding:5px 12px;border-radius:99px;letter-spacing:1px;">CONFIRMED</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #ebebeb;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:52px;vertical-align:top;">
                      <img src="${HOODIE_IMG}" alt="Hoodie"
                           style="width:48px;height:56px;object-fit:cover;border-radius:8px;display:block;"/>
                    </td>
                    <td style="padding-left:12px;vertical-align:middle;">
                      <p style="margin:0;font-size:14px;font-weight:700;color:#1a1a1a;">Heavyweight Hoodie</p>
                      <p style="margin:3px 0 0;font-size:12px;color:#999999;">Qty: <span style="color:#555555;font-weight:600;">${qty}</span></p>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <p style="margin:0;font-size:18px;font-weight:900;color:#1a1a1a;">₹${Number(totalPrice).toLocaleString('en-IN')}</p>
                      <p style="margin:2px 0 0;font-size:10px;color:#aaaaaa;text-align:right;">incl. taxes</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${shipLine1 || shipLine2 ? `
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #ebebeb;">
                <p style="margin:0 0 6px;font-size:9px;color:#999999;letter-spacing:1px;text-transform:uppercase;">Shipping To</p>
                ${shipLine1 ? `<p style="margin:0 0 2px;font-size:13px;color:#1a1a1a;font-weight:500;">${shipLine1}</p>` : ''}
                <p style="margin:0;font-size:13px;color:#666666;">${shipLine2}</p>
                ${phone ? `<p style="margin:4px 0 0;font-size:12px;color:#999999;">📞 ${phone}</p>` : ''}
              </td>
            </tr>` : ''}

            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:9px;color:#999999;letter-spacing:1px;text-transform:uppercase;">Next Step</p>
                <p style="margin:0;font-size:13px;color:#1a1a1a;font-weight:500;">Complete your payment to confirm this order</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 28px 28px;">
          <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;">
            Questions? Reply to this email — we're happy to help.
          </p>
        </td>
      </tr>`;

  await transporter.sendMail({
    from: `"Shrinkray Studios" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Order Received — #${orderId} 🎉`,
    html: baseLayout(content),
  });
  console.log(`[Mailer] Order confirmation → ${email} | #${orderId}`);
}

// ── Payment Receipt — sent when Razorpay payment is confirmed ─────────────────
async function sendPaymentReceipt({ name, email, orderId, paymentId, totalPrice, qty, phone, address, city, state, pincode }) {
  if (!email) return;

  const shipLine1 = address || '';
  const shipLine2 = [city, state].filter(Boolean).join(', ') + (pincode ? ' – ' + pincode : '');

  const content = `
      <!-- Paid banner -->
      <tr>
        <td style="background:#c5fe00;padding:12px 28px;text-align:center;">
          <span style="font-size:14px;font-weight:900;color:#000000;letter-spacing:1px;">✓ &nbsp;PAYMENT CONFIRMED — YOU'RE ALL SET!</span>
        </td>
      </tr>

      <tr>
        <td style="padding:24px 28px 0;">
          <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#1a1a1a;letter-spacing:-0.5px;">ORDER LOCKED IN! 🎉</p>
          <p style="margin:0 0 20px;font-size:14px;color:#666666;line-height:1.6;">
            Hi ${name}, your payment is confirmed and your order is placed. We'll ship it out soon — keep this email as your receipt.
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:0 28px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f9f9f9;border-radius:12px;overflow:hidden;border:1px solid #ebebeb;">

            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #ebebeb;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <p style="margin:0;font-size:9px;color:#999999;letter-spacing:1px;text-transform:uppercase;">Order ID</p>
                      <p style="margin:4px 0 0;font-size:14px;font-weight:700;color:#1a1a1a;">#${orderId}</p>
                    </td>
                    <td align="right">
                      <span style="background:#c5fe00;color:#000000;font-size:10px;font-weight:900;padding:5px 12px;border-radius:99px;letter-spacing:1px;">PAID ✓</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #ebebeb;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:52px;vertical-align:top;">
                      <img src="${HOODIE_IMG}" alt="Hoodie"
                           style="width:48px;height:56px;object-fit:cover;border-radius:8px;display:block;"/>
                    </td>
                    <td style="padding-left:12px;vertical-align:middle;">
                      <p style="margin:0;font-size:14px;font-weight:700;color:#1a1a1a;">Heavyweight Hoodie</p>
                      ${qty ? `<p style="margin:3px 0 0;font-size:12px;color:#999999;">Qty: <span style="color:#555555;font-weight:600;">${qty}</span></p>` : ''}
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <p style="margin:0;font-size:18px;font-weight:900;color:#1a1a1a;">₹${Number(totalPrice).toLocaleString('en-IN')}</p>
                      <p style="margin:2px 0 0;font-size:10px;color:#aaaaaa;text-align:right;">Amount Paid</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${paymentId ? `
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #ebebeb;">
                <p style="margin:0 0 4px;font-size:9px;color:#999999;letter-spacing:1px;text-transform:uppercase;">Payment Reference</p>
                <p style="margin:0;font-size:13px;color:#555555;font-weight:500;">${paymentId}</p>
              </td>
            </tr>` : ''}

            ${shipLine1 || shipLine2 ? `
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #ebebeb;">
                <p style="margin:0 0 6px;font-size:9px;color:#999999;letter-spacing:1px;text-transform:uppercase;">Shipping To</p>
                ${shipLine1 ? `<p style="margin:0 0 2px;font-size:13px;color:#1a1a1a;font-weight:500;">${shipLine1}</p>` : ''}
                <p style="margin:0;font-size:13px;color:#666666;">${shipLine2}</p>
                ${phone ? `<p style="margin:4px 0 0;font-size:12px;color:#999999;">📞 ${phone}</p>` : ''}
              </td>
            </tr>` : ''}

            <tr>
              <td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:9px;color:#999999;letter-spacing:1px;text-transform:uppercase;">Delivery</p>
                <p style="margin:0;font-size:13px;color:#1a1a1a;font-weight:500;">Shipping starts soon ⚡</p>
              </td>
            </tr>

          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:0 28px 28px;">
          <p style="margin:0;font-size:13px;color:#888888;line-height:1.6;">
            Thank you for your purchase! Questions? Reply to this email — we're happy to help.
          </p>
        </td>
      </tr>`;

  await transporter.sendMail({
    from: `"Shrinkray Studios" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Payment Confirmed — #${orderId} ✓`,
    html: baseLayout(content),
  });
  console.log(`[Mailer] Payment receipt → ${email} | #${orderId}`);
}

// ── Stage notification helper (light theme) ───────────────────────────────────
function stageEmail({ emoji, headline, body, orderId, badgeText, badgeStyle }) {
  // badgeStyle: 'lime' = c5fe00 bg + black text | 'dark' = black bg + lime text
  const badge = badgeText
    ? (badgeStyle === 'lime'
        ? `<span style="background:#c5fe00;color:#000000;font-size:11px;font-weight:900;padding:6px 14px;border-radius:99px;letter-spacing:0.5px;display:inline-block;">${badgeText}</span>`
        : `<span style="background:#1a1a1a;color:#c5fe00;font-size:11px;font-weight:900;padding:6px 14px;border-radius:99px;letter-spacing:0.5px;display:inline-block;">${badgeText}</span>`)
    : '';

  return baseLayout(`
    <tr>
      <td style="padding:32px 28px 8px;text-align:center;">
        <p style="font-size:44px;margin:0 0 12px;">${emoji}</p>
        ${badge ? `<p style="margin:0 0 14px;">${badge}</p>` : ''}
        <p style="margin:0 0 10px;font-size:21px;font-weight:900;color:#1a1a1a;letter-spacing:-0.5px;">${headline}</p>
        <p style="margin:0 0 6px;font-size:11px;color:#aaaaaa;letter-spacing:1px;text-transform:uppercase;">Order #${orderId}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 24px;">
        <div style="background:#f9f9f9;border-radius:12px;padding:18px 20px;border:1px solid #ebebeb;">
          <p style="margin:0;font-size:14px;color:#555555;line-height:1.75;">${body}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 28px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#aaaaaa;">Questions? Reply to this email — we're always here.</p>
      </td>
    </tr>`);
}

async function sendOrderPacked({ name, email, orderId }) {
  if (!email) return;
  await transporter.sendMail({
    from: `"Shrinkray Studios" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Your order is being packed — #${orderId} 📦`,
    html: stageEmail({
      emoji: '📦', badgeText: 'ORDER PACKED', badgeStyle: 'dark',
      headline: 'Your order is packed!',
      body: `Hi ${name}, great news — your order is all packed and being prepared for dispatch. We'll send you the tracking details as soon as it ships out!`,
      orderId,
    }),
  });
  console.log(`[Mailer] Packed → ${email}`);
}

async function sendOrderShipped({ name, email, orderId, qty, totalPrice, trackingUrl }) {
  if (!email) return;
  await transporter.sendMail({
    from: `"Shrinkray Studios" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Your order has shipped — #${orderId} 🚀`,
    html: stageEmail({
      emoji: '🚀', badgeText: 'SHIPPED', badgeStyle: 'lime',
      headline: 'Your order is on its way!',
      body: `Hi ${name}, your order is en route!<br/><br/>
             <strong style="color:#1a1a1a;">${qty}× Heavyweight Hoodie &nbsp;·&nbsp; ₹${Number(totalPrice).toLocaleString('en-IN')}</strong><br/><br/>
             <a href="${trackingUrl}" style="color:#000000;font-weight:700;text-decoration:underline;">Track your order →</a><br/><br/>
             Expected delivery in <strong>5–7 working days</strong>.`,
      orderId,
    }),
  });
  console.log(`[Mailer] Shipped → ${email}`);
}

async function sendOrderDelivered({ name, email, orderId }) {
  if (!email) return;
  await transporter.sendMail({
    from: `"Shrinkray Studios" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Delivered! Hope you love it — #${orderId} 🎉`,
    html: stageEmail({
      emoji: '🎉', badgeText: 'DELIVERED', badgeStyle: 'lime',
      headline: 'Your order has arrived!',
      body: `Hi ${name}, your Shrinkray order has been delivered. We hope you absolutely love it!<br/><br/>
             Share a photo with us — tag us or send it here. We'd love to see it on you!`,
      orderId,
    }),
  });
  console.log(`[Mailer] Delivered → ${email}`);
}

async function sendOrderFeedback({ name, email, orderId }) {
  if (!email) return;
  await transporter.sendMail({
    from: `"Shrinkray Studios" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `How was your Shrinkray order? 😊`,
    html: stageEmail({
      emoji: '😊', badgeText: null, badgeStyle: null,
      headline: 'How did we do?',
      body: `Hi ${name}, we hope you're loving your Shrinkray piece!<br/><br/>
             A quick review would mean the world to us and helps other buyers discover us too. Thank you so much for your support — it keeps us going! 🙏`,
      orderId,
    }),
  });
  console.log(`[Mailer] Feedback → ${email}`);
}

async function sendBroadcast({ name, email, subject, message }) {
  if (!email) return;
  const personalised = message.replace(/{name}/g, name.split(' ')[0]);
  await transporter.sendMail({
    from: `"Shrinkray Studios" <${process.env.GMAIL_USER}>`,
    to: email,
    subject,
    html: baseLayout(`
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.85;white-space:pre-wrap;">${personalised.replace(/\n/g, '<br/>')}</p>
          <p style="margin:0;font-size:13px;color:#999999;font-style:italic;">— Shrinkray Team</p>
        </td>
      </tr>
      <tr><td style="height:20px;"></td></tr>`),
  });
}

module.exports = { sendOrderConfirmation, sendPaymentReceipt, sendOrderPacked, sendOrderShipped, sendOrderDelivered, sendOrderFeedback, sendBroadcast };
