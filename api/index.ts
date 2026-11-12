import express from 'express';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    })
  : null;

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '1mb' }));

// Endpoint: Stripe Status
app.get('/api/stripe/status', (req, res) => {
  return res.json({
    hasStripeConfigured: !!stripe,
  });
});

// Endpoint: Stripe Checkout Session creation
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { plan, customerEmail, contractorIco, contractorName } = req.body;
    const isYearly = plan === 'pro_yearly';
    const amount = isYearly ? 1990 : 199;
    const planTitle = isYearly ? 'Řemeslník PRO – Roční licence (2 měsíce zdarma)' : 'Řemeslník PRO – Měsíční licence';

    if (!stripe) {
      return res.json({
        isLive: false,
        reason: 'no_stripe_key',
        message: 'Stripe API klíč (STRIPE_SECRET_KEY) není v aplikaci nakonfigurován. Bude spuštěna interaktivní Stripe platební brána v testovacím režimu.',
      });
    }

    const origin = req.headers.origin || req.headers.referer || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'czk',
            product_data: {
              name: planTitle,
              description: 'Neomezený přístup: smlouvy o dílo dle NOZ, cenové nabídky, zálohové faktury s QR kódem, razítko a export pro účetní.',
            },
            unit_amount: amount * 100, // haléře
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail || undefined,
      metadata: {
        plan: isYearly ? 'pro_yearly' : 'pro_monthly',
        ico: contractorIco || '',
        contractorName: contractorName || '',
      },
      success_url: `${origin}/?stripe_success=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?stripe_cancel=true`,
    });

    return res.json({
      isLive: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('Chyba při vytváření Stripe Checkout session:', err);
    return res.status(500).json({
      error: err.message || 'Nepodařilo se vytvořit Stripe Checkout session.',
      isLive: false,
    });
  }
});

// Chyby při čtení těla požadavku
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Neplatný formát požadavku.' });
  }
  return next(err);
});

export default app;
