import type { VendorSignupRequest, VendorSignupStatusFilter } from '../types/vendorSignup';

/** UI-only mock data — wire to API later. */
export const MOCK_VENDOR_SIGNUP_REQUESTS: VendorSignupRequest[] = [
  {
    id: 1001,
    company_name: 'Green Farms LLC',
    authorized_person_name: 'Ali Vendor',
    email: 'vendor@greenfarms.ae',
    phone: '+971 50 123 4567',
    vendor_type: 'fruits',
    emirate: 'Dubai',
    city: 'Dubai',
    address: 'Industrial Area 1, Warehouse 5',
    trade_license_number: 'TL-12345',
    vat_number: 'TRN123456789',
    bank_name: 'Emirates NBD',
    iban: 'AE070331234567890123456',
    account_holder_name: 'Green Farms LLC',
    delivery_radius_km: 25,
    minimum_order_amount: 50,
    opens_at: '08:00',
    closes_at: '22:00',
    google_maps_location: '25.2048,55.2708',
    status: 'pending',
    created_at: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 1002,
    company_name: 'Fresh Harvest Trading',
    authorized_person_name: 'Khalid Al Nuaimi',
    email: 'khalid@freshharvest.ae',
    phone: '+971 50 111 2233',
    vendor_type: 'vegetables',
    emirate: 'Abu Dhabi',
    city: 'Al Ain',
    address: 'Industrial Area, Al Ain',
    trade_license_number: 'TL-2024-88421',
    bank_name: 'ADCB',
    iban: 'AE460030000123456789012',
    account_holder_name: 'Fresh Harvest Trading',
    delivery_radius_km: 30,
    minimum_order_amount: 75,
    opens_at: '07:00',
    closes_at: '21:00',
    google_maps_location: '24.2075,55.7447',
    status: 'pending',
    created_at: '2026-05-31T09:00:00.000Z',
  },
  {
    id: 1003,
    company_name: 'Gulf Seafood Co.',
    authorized_person_name: 'Sara Mohammed',
    email: 'sara@gulfseafood.ae',
    phone: '+971 55 987 6543',
    vendor_type: 'seafood',
    emirate: 'Sharjah',
    city: 'Sharjah',
    address: 'Port Khalid, Block B',
    trade_license_number: 'TL-99887',
    bank_name: 'Mashreq Bank',
    iban: 'AE330331234567890123456',
    account_holder_name: 'Gulf Seafood Co.',
    delivery_radius_km: 20,
    minimum_order_amount: 100,
    opens_at: '06:00',
    closes_at: '20:00',
    google_maps_location: '25.3463,55.4209',
    status: 'pending',
    created_at: '2026-05-30T14:00:00.000Z',
  },
  {
    id: 1004,
    company_name: 'Desert Honey Apiaries',
    authorized_person_name: 'Omar Hassan',
    email: 'omar@deserthoney.ae',
    phone: '+971 52 444 5566',
    vendor_type: 'honey',
    emirate: 'Fujairah',
    city: 'Fujairah',
    address: 'Al Hail Industrial',
    trade_license_number: 'TL-55443',
    bank_name: 'FAB',
    iban: 'AE120030000987654321098',
    account_holder_name: 'Desert Honey Apiaries',
    delivery_radius_km: 15,
    minimum_order_amount: 40,
    opens_at: '09:00',
    closes_at: '18:00',
    google_maps_location: '25.1288,56.3265',
    status: 'approved',
    created_at: '2026-05-20T08:00:00.000Z',
  },
  {
    id: 1005,
    company_name: 'Quick Meats LLC',
    authorized_person_name: 'Faisal Rahman',
    email: 'faisal@quickmeats.ae',
    phone: '+971 56 333 2211',
    vendor_type: 'meat',
    emirate: 'Ajman',
    city: 'Ajman',
    address: 'Ajman Free Zone',
    trade_license_number: 'TL-33221',
    bank_name: 'RAK Bank',
    iban: 'AE640330000111222333444',
    account_holder_name: 'Quick Meats LLC',
    delivery_radius_km: 18,
    minimum_order_amount: 60,
    opens_at: '08:00',
    closes_at: '23:00',
    google_maps_location: '25.4052,55.5136',
    status: 'rejected',
    created_at: '2026-05-10T11:00:00.000Z',
  },
];

export const DASHBOARD_MOCK_VENDOR_REQUESTS = MOCK_VENDOR_SIGNUP_REQUESTS.filter(
  (r) => r.status === 'pending'
).slice(0, 3);

export function filterMockVendorRequests(
  status: VendorSignupStatusFilter,
  requests = MOCK_VENDOR_SIGNUP_REQUESTS
): VendorSignupRequest[] {
  const list =
    status === 'all' ? requests : requests.filter((r) => r.status === status);
  return [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function countMockVendorRequests(requests = MOCK_VENDOR_SIGNUP_REQUESTS) {
  return {
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    total: requests.length,
  };
}

export function findMockVendorRequest(
  id: number | string,
  requests = MOCK_VENDOR_SIGNUP_REQUESTS
): VendorSignupRequest | undefined {
  return requests.find((r) => String(r.id) === String(id));
}
