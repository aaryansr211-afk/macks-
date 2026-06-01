const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const APP_ID = process.env.CASHFREE_APP_ID;
  const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

  if (!APP_ID || !SECRET_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Payment gateway not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { amount, customerName, customerPhone, customerEmail, orderId } = body;

  if (!amount || !customerName || !customerPhone || !orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const orderPayload = JSON.stringify({
    order_id: orderId,
    order_amount: parseFloat(amount),
    order_currency: 'INR',
    customer_details: {
      customer_id: 'cust_' + Date.now(),
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail || 'noreply@macksmakhana.com',
    },
    order_meta: {
      return_url: 'https://www.macksmakhana.com/?order_id={order_id}&order_token={order_token}',
      notify_url: 'https://www.macksmakhana.com/',
    },
  });

  const options = {
    hostname: 'api.cashfree.com',
    path: '/pg/orders',
    method: 'POST',
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': APP_ID,
      'x-client-secret': SECRET_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(orderPayload),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
              body: JSON.stringify({ payment_session_id: parsed.payment_session_id, order_id: parsed.order_id }),
            });
          } else {
            resolve({
              statusCode: res.statusCode,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ error: parsed.message || 'Payment gateway error' }),
            });
          }
        } catch {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Invalid response from gateway' }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(orderPayload);
    req.end();
  });
};
