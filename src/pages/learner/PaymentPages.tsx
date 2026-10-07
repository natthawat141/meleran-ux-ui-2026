import { useLocation } from 'react-router-dom';
import { StripeCheckoutPage, StripePaymentResultPage } from './StripePaymentPages';
import { RedeemCheckoutPage, RedeemCheckoutResultPage } from './RedeemCourseCodePage';

export function CheckoutPage() {
  const location = useLocation();
  return new URLSearchParams(location.search).get('channel') === 'redeem' ? <RedeemCheckoutPage /> : <StripeCheckoutPage />;
}

export function CheckoutResultPage() {
  const location = useLocation();
  return new URLSearchParams(location.search).get('channel') === 'redeem' ? <RedeemCheckoutResultPage /> : <StripePaymentResultPage />;
}