// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  loyaltyPoints: number;
  address: Address;
  preferences: UserPreferences;
}

export interface Address {
  id: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

export interface UserPreferences {
  language: 'en' | 'ar' | 'ur';
  theme: 'light' | 'dark';
  notifications: boolean;
}

// Service Types
export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  services: Service[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in minutes
  image: string;
  category: string;
  features: string[];
  requiresPhotos?: boolean; // Tree maintenance services require before/after photos
}

// Order Types
export interface Order {
  id: string;
  userId: string;
  serviceId: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: Date;
  scheduledDate: Date;
  address: Address;
  technicianId?: string;
  deliveryId?: string;
  tracking: OrderTracking[];
  paymentMethod: PaymentMethod;
  specialInstructions?: string;
}

export type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'delivered'
  | 'cancelled';

export interface OrderTracking {
  id: string;
  status: OrderStatus;
  timestamp: Date;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  photos?: {
    before?: string[];
    after?: string[];
  };
}

export type PaymentMethod = 'cash' | 'card' | 'wallet';

// Product Types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: string;
  brand: string;
  rating: number;
  reviews: number;
  image?: string;
  badge?: string;
  inStock: boolean;
  features: string[];
}

export interface CartItem {
  productId: string;
  quantity: number;
  product: Product;
}

// Technician Types
export interface Technician {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalOrders: number;
  specialties: string[];
  isAvailable: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  employeeId?: string;
}

// Notification Types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'promotion' | 'system';
  isRead: boolean;
  createdAt: Date;
  data?: any;
}

// App State Types
export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  language: 'en' | 'ar' | 'ur';
  theme: 'light' | 'dark';
  notifications: Notification[];
  cart: CartItem[];
  orders: Order[];
  currentOrder: Order | null;
}

// Membership Types (Agricultural subscriptions)
export type MembershipTier = '1D' | '1M' | '3M' | '6M' | '12M' | 'VIP-1D' | 'VIP-1M' | 'VIP-3M' | 'VIP-6M' | 'VIP-12M';

export interface MembershipPackage {
  id: MembershipTier;
  title: string; // e.g., '1 Month'
  subtitle: string;
  // Legacy fields kept for compatibility with older UI (unused now)
  priceMonthly?: number; // AED price for the period
  priceYearly?: number; // reused by UI; may mirror priceMonthly
  // Tandil current fields used by UI
  priceAED: number;
  durationMonths: number;
  features: string[];
  highlight?: boolean;
}

// Vendor/Partner Types
export type PartnerTier = 'Basic' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface PartnerTierInfo {
  tier: PartnerTier;
  requirement: string;
  adminFee: number;
  duration: string;
  benefits: string[];
  color: string;
}

export interface Vendor {
  id: string;
  name: string;
  logo: string;
  description: string;
  category: string;
  tier: PartnerTier;
  productsProvided: number;
  adminFee: number;
  visibilityStartDate: Date;
  visibilityEndDate: Date;
  isActive: boolean;
  contactInfo: {
    email: string;
    phone: string;
    address: string;
  };
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    website?: string;
  };
}

export interface VendorProduct {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  // Optional rich media for advanced viewing
  threeSixtyImages?: string[]; // if provided, use these for 360 viewer instead of images
  modelUrl?: string; // glb/gltf/usdz for 3D viewer
  isAvailable: boolean;
  createdAt: Date;
}

// Navigation Types
export type RootStackParamList = {
  Splash: undefined;
  RoleSelection: undefined;
  Auth: { role?: string } | undefined;
  UserApp: undefined;
  TechnicianApp: undefined;
  SupervisorApp: undefined;
  AreaManagerApp: undefined;
  HRManagerApp: undefined;
  AdminApp: undefined;
  DeliveryApp: undefined;
  VendorApp: undefined;
  VendorLogin: undefined;
};

export type UserStackParamList = {
  Main: undefined;
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
  Notifications: undefined;
  VendorPanel: undefined;
  VendorLogin: undefined;
  ServiceCategory: undefined;
  ServiceDetail: { serviceId: string };
  ServiceProducts: { serviceId: number; serviceName?: string };
  BookingForm: { serviceId: string };
  OrderSummary: { serviceId: string };
  CategoryProducts: { 
    category: {
      id: string;
      name: string;
      image: string;
    };
  };
  OrderTracking: { orderId: string };
  OrderHistory: undefined;
  LoyaltyPoints: undefined;
  Offers: undefined;
  ExclusiveOfferProducts: { offer: { id: number; title?: string; description?: string; product_ids?: number[]; [key: string]: unknown } };
  ProductCategory: undefined;
  ProductDetail: { product: any };
  FeaturedProducts: undefined;
  Cart: undefined;
  Checkout: undefined;
  RateReview: { orderId: string };
  HelpCenter: undefined;
  SubmitTicket: undefined;
  MyTickets: undefined;
  SupportTicketChat: { ticket: { id: number; ticket_number: string; subject: string; status: string; created_at: string; updated_at: string } };
  Memberships: undefined;
};

export type TechnicianStackParamList = {
  Login: undefined;
  Main: undefined;
  Dashboard: undefined;
  JobDetail: { orderId: string };
  TodayTasks: undefined;
  AcceptedJobs: undefined;
  RejectedJobs: undefined;
  OrderHistory: undefined;
  PayoutSummary: undefined;
  AddBankAccount: undefined;
  Profile: undefined;
  TechnicianProfileEdit: undefined;
  Specializations: undefined;
  Availability: undefined;
  SetBreakTime: { initialBreaks?: Array<{ date: string; start_time: string; end_time: string; reason?: string }> };
  SetVacation: { initialVacations?: Array<{ start_date: string; end_date: string; reason?: string }> };
  ServiceAreas: { initialServiceAreas?: string[] };
  ServiceAreasSettings: undefined;
  SupervisorReport?: { visitId?: string } | undefined;
  Memberships: undefined;
  MembershipCheckout: { tier: MembershipTier };
  HelpCenter: undefined;
  SubmitTicket: undefined;
  MyTickets: undefined;
  SupportTicketChat: { ticket: { id: number; ticket_number: string; subject: string; status: string; created_at: string; updated_at: string } };
  Notifications: undefined;
};

export type DeliveryStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  OrderDetail: { orderId: string };
  MapView: { orderId: string };
  OrderStatus: { orderId: string };
  Profile: undefined;
  Settings: undefined;
  Memberships: undefined;
  MembershipCheckout: { tier: MembershipTier };
};

export type VendorStackParamList = {
  Main: undefined;
  Dashboard: undefined;
  Products: undefined;
  Orders: undefined;
  Partnership: undefined;
  Profile: undefined;
  ProductDetail: { productId: string };
  AddProduct: undefined;
  EditProduct: { productId: string };
  OrderDetail: { orderId: string };
  Analytics: undefined;
  Settings: undefined;
}; 