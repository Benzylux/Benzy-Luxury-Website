# Benzy Backend Server

## Run locally
1. `cd backend`
2. `npm install`
3. Review and update `backend/.env` with your real environment values
4. Make sure MongoDB is running
5. `npm start`

The server runs on `http://localhost:3001` by default and serves static files from `frontend/`.

## Environment variables
- `PORT`
- `MONGO_URL` or `MONGODB_URI`
- `MONGODB_DB_NAME`
- `JWT_SECRET`
- `ADMIN_EMAILS`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_CALLBACK_BASE_URL`
- `BREVO_API_KEY`
- `BREVO_LIST_NEWSLETTER`
- `BREVO_LIST_CUSTOMERS`
- `BREVO_LIST_VIP`
- `BREVO_LIST_ABANDONED_CART`
- `BREVO_LIST_GIVEAWAY`
- `BREVO_LIST_INFLUENCERS`
- `BREVO_LIST_WHOLESALE`
- `BREVO_LIST_SUPPORT`
- `BREVO_LIST_PREORDER`
- `BREVO_LIST_EVENTS`
- `BREVO_LIST_WALLET_TOP_UP`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `BREVO_WEBHOOK_SECRET`
- `WATI_API_ENDPOINT`
- `WATI_TOKEN`
- `WATI_CHANNEL_NUMBER`
- `WATI_TEMPLATE_NAME`

`PAYSTACK_CALLBACK_BASE_URL` is optional when your frontend is served from the same public origin as the backend. Set it when your checkout page is hosted on a different domain or subdomain.

Brevo setup:
1. Open `backend/.env`.
2. Paste your Brevo API v3 key into `BREVO_API_KEY`.
3. Set every `BREVO_LIST_*` variable to the matching Brevo list ID you want to use.
4. Paste a verified Brevo sender email into `BREVO_SENDER_EMAIL`.
5. Paste the sender display name into `BREVO_SENDER_NAME`.
6. Set `BREVO_WEBHOOK_SECRET` to a long random secret if you want Brevo delivery webhooks enabled.

The newsletter route creates or updates the Brevo contact, adds the contact to the newsletter list, and sends the welcome email.
The paid checkout flow adds or updates the contact in the customers list with order-based attributes.
The giveaway route adds the contact to the giveaway list.
The VIP route adds the contact to the VIP list.
Successful wallet top-ups can add the contact to the wallet-top-up list and send a top-up receipt email.

WATI setup for contact-form WhatsApp delivery:
1. Open `backend/.env`.
2. Paste your WATI API base URL into `WATI_API_ENDPOINT`.
3. Paste your WATI bearer token into `WATI_TOKEN`.
4. Paste your connected WhatsApp channel number into `WATI_CHANNEL_NUMBER`.
5. Paste an approved WhatsApp template name into `WATI_TEMPLATE_NAME`.

How the WATI contact flow works:
- The contact form still saves every message into the admin inbox.
- Brevo still handles email notifications and the email auto-reply.
- WATI sends the WhatsApp acknowledgment when its configuration is present.
- If WATI is not configured yet, the frontend falls back to opening the manual WhatsApp chat link.

Template note:
- The current integration sends a WATI template with an empty `parameters` array.
- The easiest setup is to use a pre-approved static template with no dynamic placeholders.

Brevo webhook setup:
1. Create a long random value for `BREVO_WEBHOOK_SECRET`.
2. In Brevo, create a webhook that points to `POST /api/webhooks/brevo` on your public backend URL.
3. Configure Brevo webhook auth to send `Authorization: Bearer <BREVO_WEBHOOK_SECRET>`.
4. Enable the transactional events you care about, such as `delivered`, `opened`, `click`, `soft_bounce`, and `hard_bounce`.

What the webhook does:
- Rejects requests with the wrong webhook secret.
- Stores the raw event in the `brevo_webhook_events` collection.
- Matches order confirmation emails by `messageId` and updates the order metadata with delivery lifecycle status.
- Matches wallet top-up receipt emails by `messageId` and updates the wallet transaction metadata with delivery lifecycle status.

If you want contact attributes populated in Brevo, create these Brevo contact attributes first:
- `SOURCE`
- `SIGNUP_LOCATION`
- `CUSTOMER_STATUS`
- `VIP_STATUS`
- `CAMPAIGN_NAME`
- `ORDER_COUNT`
- `LAST_ORDER_DATE`
- `TAGS`

List strategy note:
- Distinct operational audiences like `newsletter`, `customers`, `wholesale`, and `support` can work well as separate lists.
- Stateful marketing states like `vip`, `abandoned_cart`, `preorder`, `events`, and campaign tracking are usually easier to manage as attributes plus Brevo segments and automations.
- The code still supports all requested lists cleanly, so you can start with lists now and consolidate to segments later without changing the integration surface.

## Live checkout routes
- `POST /api/checkout/paystack/initialize`
- `POST /api/payments/paystack/verify`
- `GET /api/track-order/:orderId`
- `POST /api/newsletter/subscribe`
- `POST /api/giveaway/enter`
- `POST /api/vip/upgrade`
- `POST /api/webhooks/brevo`

## Cart and coupon routes
- `GET /api/cart`
- `POST /api/cart/sync`
- `POST /api/cart/merge`
- `POST /api/cart/add`
- `PATCH /api/cart/item/:id`
- `DELETE /api/cart/item/:id`
- `DELETE /api/cart/clear`
- `POST /api/cart/apply-coupon`
- `DELETE /api/cart/remove-coupon`
- `POST /api/cart/checkout/validate`
- `GET /api/coupons/:code/validate`

## Newsletter API sample
Request:

```json
POST /api/newsletter/subscribe
{
  "email": "customer@example.com",
  "source": "footer"
}
```

Created response:

```json
{
  "success": true,
  "message": "Thanks for subscribing! Your 10% off code is: BLX10-ABC123",
  "discountCode": "BLX10-ABC123",
  "welcomeEmailSent": true,
  "subscriber": {
    "email": "customer@example.com",
    "discountCode": "BLX10-ABC123",
    "discountUsed": false,
    "subscribedAt": "2026-03-23T12:00:00.000Z",
    "source": "footer"
  }
}
```

Already subscribed response:

```json
{
  "success": true,
  "alreadySubscribed": true,
  "message": "You are already subscribed. Your 10% off code is: BLX10-ABC123",
  "discountCode": "BLX10-ABC123",
  "subscriber": {
    "email": "customer@example.com",
    "discountCode": "BLX10-ABC123",
    "discountUsed": false,
    "subscribedAt": "2026-03-23T12:00:00.000Z",
    "source": "footer"
  }
}
```

Validation or provider failure response:

```json
{
  "success": false,
  "message": "Unable to sync your email with Brevo right now. Please try again."
}
```

## Giveaway API sample
Request:

```json
POST /api/giveaway/enter
{
  "email": "customer@example.com",
  "name": "Jamie Doe",
  "source": "instagram"
}
```

Response:

```json
{
  "success": true,
  "message": "Thanks! You are entered into the giveaway.",
  "email": "customer@example.com"
}
```

## VIP API sample
Request:

```json
POST /api/vip/upgrade
{
  "email": "customer@example.com",
  "source": "loyalty-program",
  "signupLocation": "profile-upgrade",
  "campaignName": "vip-launch"
}
```

Response:

```json
{
  "success": true,
  "message": "VIP contact updated successfully.",
  "email": "customer@example.com"
}
```

Current payment behavior:
- Checkout uses Paystack only.
- `Card Payment` and `Paystack` in the UI both initialize the same Paystack checkout flow.
- `Bank Transfer`, `Wallet`, and `Flutterwave` checkout paths are disabled.

Order confirmation email trigger points:
- `POST /api/payments/paystack/verify` after successful Paystack verification.
- `POST /api/checkout/wallet` after a paid wallet checkout order is created.
- `PATCH /api/admin/orders/:orderId/confirm-payment` after a host confirms a bank-transfer payment.

Wallet top-up receipt trigger point:
- `POST /api/profile/wallet/topup/paystack/verify` after a successful wallet top-up verification.

Customer list sync:
- The same paid-order triggers also add the customer to the Brevo customers list with basic order attributes.

VIP list sync:
- `POST /api/vip/upgrade` adds or updates the contact in the Brevo VIP list with `CUSTOMER_STATUS=vip` and `VIP_STATUS=active`.

If you add another payment gateway later, call `sendOrderConfirmation(email, orderData)` from `server/src/services/brevoService.js` right after the server marks the order as `paymentStatus: "paid"`.

## Go-live checklist
1. Set a strong `JWT_SECRET`.
2. Point `MONGO_URL` to your production MongoDB instance.
3. Set a real `PAYSTACK_SECRET_KEY` on the server.
4. Set `PAYSTACK_CALLBACK_BASE_URL` if frontend and backend are not on the same public origin.
5. Set all required Brevo values and verify the Brevo sender email.
6. Verify the checkout success and failure pages are reachable in production.
7. Run at least one Paystack test transaction before switching to live keys.
8. Test at least one newsletter signup and one paid order email in Brevo before launch.
9. Use HTTPS for both frontend and backend in production.

## Existing platform notes
- MongoDB stores users, orders, subscribers, and settings.
- Mongoose now powers the modular cart, coupon, and product catalog layer in `server/src/cart/`.
- On the first successful MongoDB startup, existing JSON files in `server/` seed the database if matching collections are empty.
- Passwords are hashed with `bcryptjs`.
- Set `MONGO_URL` in production. `MONGODB_URI` is also supported for older local configs.
- Default local MongoDB connection is `mongodb://127.0.0.1:27017` with database `benzy_luxury`.
- The local server loads `backend/.env` automatically at startup, and shell or hosting-provider environment variables still take priority when they are already set.
