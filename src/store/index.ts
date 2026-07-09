import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, User, Order, CartItem, Notification, MembershipPackage, MembershipTier } from '../types';
import { mockUser, mockOrders, mockProducts } from '../data/mockData';
import { authService } from '../services/authService';
import { normalizeAuthRole } from '../utils/sessionRestore';

interface AppStore extends AppState {
  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLanguage: (language: 'en' | 'ar' | 'ur') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  // Membership
  membershipPackages: MembershipPackage[];
  selectedMembership: MembershipTier | null;
  setSelectedMembership: (tier: MembershipTier | null) => void;
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  setCurrentOrder: (order: Order | null) => void;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (notificationId: string) => void;
  clearNotifications: () => void;
  logout: (options?: { skipApi?: boolean }) => Promise<void>;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      isAuthenticated: false,
      language: 'en',
      theme: 'light',
      notifications: [],
      cart: [],
      orders: mockOrders,
      currentOrder: null,
      membershipPackages: [
        {
          id: '1D',
          title: '1 Day',
          subtitle: 'Single visit service',
          priceAED: 150,
          durationMonths: 0,
          features: [
            'Single garden visit',
            'Basic tree care',
            'Health inspection',
            'Before/After photos',
          ],
          highlight: false,
        },
        {
          id: '1M',
          title: '1 Month',
          subtitle: 'Monthly maintenance',
          priceAED: 500,
          durationMonths: 1,
          features: [
            'Monthly garden visits',
            'Tree & palm watering',
            'Basic maintenance',
            'Before/After photos',
          ],
          highlight: false,
        },
        {
          id: '3M',
          title: '3 Months',
          subtitle: 'Quarterly care package',
          priceAED: 1450,
          durationMonths: 3,
          features: [
            'Regular garden visits',
            'Tree pruning & care',
            'Fertilization service',
            'Before/After photos',
            'Pest control',
          ],
          highlight: true,
        },
        {
          id: '6M',
          title: '6 Months',
          subtitle: 'Half-year care',
          priceAED: 2800,
          durationMonths: 6,
          features: [
            'Bi-weekly visits',
            'Complete tree care',
            'Seasonal maintenance',
            'Before/After photos',
            'Priority support',
          ],
          highlight: false,
        },
        {
          id: '12M',
          title: '12 Months',
          subtitle: 'Annual care plan',
          priceAED: 5500,
          durationMonths: 12,
          features: [
            'Weekly garden visits',
            'Full tree maintenance',
            'Year-round care',
            'Before/After photos',
            'Expert consultation',
          ],
          highlight: false,
        },
        {
          id: 'VIP-1D',
          title: 'VIP 1 Day',
          subtitle: 'Premium single visit',
          priceAED: 300,
          durationMonths: 0,
          features: [
            'Premium single visit',
            'VIP tree care',
            'Detailed inspection',
            'Professional photos',
            'Priority service',
          ],
          highlight: false,
        },
        {
          id: 'VIP-1M',
          title: 'VIP 1 Month',
          subtitle: 'VIP monthly plan',
          priceAED: 1000,
          durationMonths: 1,
          features: [
            'VIP monthly visits',
            'Premium tree care',
            'Advanced maintenance',
            'Professional photos',
            'Priority scheduling',
          ],
          highlight: false,
        },
        {
          id: 'VIP-3M',
          title: 'VIP 3 Months',
          subtitle: 'VIP quarterly plan',
          priceAED: 2900,
          durationMonths: 3,
          features: [
            'VIP regular visits',
            'Premium tree care',
            'Organic treatments',
            'Professional photos',
            'Priority support',
          ],
          highlight: false,
        },
        {
          id: 'VIP-6M',
          title: 'VIP 6 Months',
          subtitle: 'VIP half-year plan',
          priceAED: 5600,
          durationMonths: 6,
          features: [
            'VIP bi-weekly visits',
            'Premium full care',
            'Expert consultation',
            'Professional photos',
            '24/7 support',
          ],
          highlight: false,
        },
        {
          id: 'VIP-12M',
          title: 'VIP 12 Months',
          subtitle: 'VIP annual plan',
          priceAED: 11000,
          durationMonths: 12,
          features: [
            'VIP weekly visits',
            'Premium full service',
            'Year-round expertise',
            'Professional photos',
            '24/7 priority support',
            'Exclusive treatments',
          ],
          highlight: false,
        },
      ],
      selectedMembership: null,

      // Actions
      setUser: (user) => set({ user }),
      
      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      
      setLanguage: (language) => set({ language }),
      
      setTheme: (theme) => set({ theme }),

      setSelectedMembership: (tier) => set({ selectedMembership: tier }),
      
      addToCart: (product, quantity = 1) => {
        const { cart } = get();
        const existingItem = cart.find(item => item.productId === product.id);
        
        if (existingItem) {
          set({
            cart: cart.map(item =>
              item.productId === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            ),
          });
        } else {
          set({
            cart: [...cart, { productId: product.id, quantity, product }],
          });
        }
      },
      
      removeFromCart: (productId) => {
        const { cart } = get();
        set({
          cart: cart.filter(item => item.productId !== productId),
        });
      },
      
      updateCartQuantity: (productId, quantity) => {
        const { cart } = get();
        if (quantity <= 0) {
          get().removeFromCart(productId);
        } else {
          set({
            cart: cart.map(item =>
              item.productId === productId
                ? { ...item, quantity }
                : item
            ),
          });
        }
      },
      
      clearCart: () => set({ cart: [] }),
      
      addOrder: (order) => {
        const { orders } = get();
        set({ orders: [order, ...orders] });
      },
      
      updateOrder: (orderId, updates) => {
        const { orders } = get();
        set({
          orders: orders.map(order =>
            order.id === orderId
              ? { ...order, ...updates }
              : order
          ),
        });
      },
      
      setCurrentOrder: (order) => set({ currentOrder: order }),
      
      addNotification: (notification) => {
        const { notifications } = get();
        set({ notifications: [notification, ...notifications] });
      },
      
      markNotificationAsRead: (notificationId) => {
        const { notifications } = get();
        set({
          notifications: notifications.map(notification =>
            notification.id === notificationId
              ? { ...notification, isRead: true }
              : notification
          ),
        });
      },
      
      clearNotifications: () => set({ notifications: [] }),
      
      logout: async (options?: { skipApi?: boolean }) => {
        if (options?.skipApi) {
          await authService.clearLocalSession();
        } else {
          try {
            const role = await authService.getStoredRole();
            if (normalizeAuthRole(role) === 'vendor') {
              await authService.vendorLogout();
            } else {
              await authService.logout();
            }
          } catch (error) {
            console.error('Logout API error:', error);
            await authService.clearLocalSession();
          }
        }

        set({
          user: null,
          isAuthenticated: false,
          cart: [],
          currentOrder: null,
          notifications: [],
        });
      },
    }),
    {
      // Bump storage key to invalidate old demo images persisted by AsyncStorage
      name: 'tandil-storage-v3',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Auth lives in auth_token + session restore — do not persist isAuthenticated/user
        language: state.language,
        theme: state.theme,
        cart: state.cart,
        orders: state.orders,
        notifications: state.notifications,
      }),
    }
  )
);

// Selectors for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useLanguage = () => useAppStore((state) => state.language);
export const useTheme = () => useAppStore((state) => state.theme);
export const useCart = () => useAppStore((state) => state.cart);
export const useOrders = () => useAppStore((state) => state.orders);
export const useCurrentOrder = () => useAppStore((state) => state.currentOrder);
export const useNotifications = () => useAppStore((state) => state.notifications);

// Computed selectors
export const useCartTotal = () => {
  const cart = useCart() || [];
  return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
};

export const useCartItemCount = () => {
  const cart = useCart() || [];
  return cart.reduce((count, item) => count + item.quantity, 0);
};

export const useUnreadNotifications = () => {
  const notifications = useNotifications();
  return notifications.filter(notification => !notification.isRead);
}; 

// Membership selectors
export const useMembershipPackages = () => useAppStore((state) => state.membershipPackages);
export const useSelectedMembership = () => useAppStore((state) => state.selectedMembership);