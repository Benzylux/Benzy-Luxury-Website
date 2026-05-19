# React Cart Example

This folder shows how to consume the new cart and coupon backend from a React app without changing the rest of the current storefront build.

Included:

- `api/cartApi.js`: fetch helpers for the cart and coupon routes
- `cart/cartStorage.js`: guest cart localStorage helpers and local coupon preview logic
- `cart/cartReducer.js`: reducer state for loading, success, and error flows
- `cart/CartContext.jsx`: guest/auth cart provider with merge-on-login
- `components/CartPage.jsx`: example cart page UI
- `components/CheckoutValidationExample.jsx`: example checkout validation step before Paystack

Example cart response shape:

```json
{
  "success": true,
  "cart": {
    "id": "67f3...",
    "mode": "authenticated",
    "userId": "1710960271207",
    "email": "customer@example.com",
    "items": [
      {
        "id": "67f4...",
        "lineKey": "15::15-default::xl::black",
        "productId": "15",
        "name": "BENZYLUX(BLX) TRACK",
        "price": 60000,
        "image": "OFF BACK/WhatsApp Image 2025-11-11 at 08.42.31_83a04cd4.png",
        "quantity": 2,
        "size": "XL",
        "color": "Black",
        "variantId": "15-default",
        "categoryId": "men"
      }
    ],
    "summary": {
      "subtotal": 120000,
      "discount": 12000,
      "shippingFee": 3000,
      "total": 111000,
      "appliedCoupon": {
        "code": "WELCOME10",
        "discountType": "percent",
        "discountValue": 10,
        "minimumOrderAmount": 15000,
        "maximumDiscountAmount": 8000,
        "freeShipping": false
      },
      "couponMessage": "Coupon WELCOME10 applied successfully."
    },
    "requiresLoginAtCheckout": false,
    "updatedAt": "2026-03-22T10:30:00.000Z"
  }
}
```
