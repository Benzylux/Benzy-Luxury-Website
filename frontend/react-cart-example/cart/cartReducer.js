export const initialCartState = {
  cart: {
    mode: 'guest',
    items: [],
    summary: {
      subtotal: 0,
      discount: 0,
      shippingFee: 0,
      total: 0,
      appliedCoupon: null,
      couponMessage: ''
    },
    requiresLoginAtCheckout: true,
    updatedAt: null
  },
  loading: false,
  error: '',
  success: ''
};

export function cartReducer(state, action) {
  switch (action.type) {
    case 'loading':
      return {
        ...state,
        loading: true,
        error: '',
        success: ''
      };
    case 'replace':
      return {
        ...state,
        loading: false,
        error: '',
        success: action.message || '',
        cart: action.cart || state.cart
      };
    case 'error':
      return {
        ...state,
        loading: false,
        error: action.error || 'Something went wrong.',
        success: ''
      };
    case 'message':
      return {
        ...state,
        loading: false,
        error: '',
        success: action.message || ''
      };
    default:
      return state;
  }
}
