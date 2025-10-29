import { api } from './base';

export const createOrder = (payload) => api.post('/orders', payload);
export const getOrder = (id) => api.get(`/orders/${id}`);
export const listOrders = (userId) => api.get(`/users/${userId}/orders`);
export const cancelOrder = (id) => api.post(`/orders/${id}/cancel`, {});
export const addTip = (orderId, amount) => api.post(`/orders/${orderId}/tip`, { amount });

// Payment intents / status (if backend provides)
export const createPaymentIntent = (orderId) => api.post(`/orders/${orderId}/pay`, {});
export const getPaymentStatus = (orderId) => api.get(`/orders/${orderId}/payment-status`);
