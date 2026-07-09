import type { User } from '../types';

/** Demo vendor user for UI preview when backend vendor login is unavailable. */
export function buildDemoVendorUser(email?: string): User {
  return {
    id: 'demo-vendor',
    name: 'Fresh Harvest Trading LLC',
    email: email?.trim() || 'vendor@demo.tandil.com',
    phone: '+971 50 123 4567',
    loyaltyPoints: 0,
    address: {
      id: 'demo-address',
      street: 'Al Quoz Industrial Area',
      city: 'Dubai',
      state: 'Dubai',
      zipCode: '',
      country: 'UAE',
    },
    preferences: {
      language: 'en',
      theme: 'light',
      notifications: true,
    },
  };
}
