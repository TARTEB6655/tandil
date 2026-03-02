import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserStackParamList } from '../types';
import { COLORS } from '../constants';
import { useTranslation } from 'react-i18next';

// Tab Screens
import HomeScreen from '../screens/user/HomeScreen';
import ServicesScreen from '../screens/user/ServicesScreen';
import OrdersScreen from '../screens/user/OrdersScreen';
import StoreScreen from '../screens/user/StoreScreen';
import ProfileScreen from '../screens/user/ProfileScreen';

// Stack Screens
import ServiceCategoryScreen from '../screens/user/ServiceCategoryScreen';
import ServiceDetailScreen from '../screens/user/ServiceDetailScreen';
import ServiceProductsScreen from '../screens/user/ServiceProductsScreen';
import BookingFormScreen from '../screens/user/BookingFormScreen';
import OrderSummaryScreen from '../screens/user/OrderSummaryScreen';
import CategoryProductsScreen from '../screens/user/CategoryProductsScreen';
import OrderTrackingScreen from '../screens/user/OrderTrackingScreen';
import OrderHistoryScreen from '../screens/user/OrderHistoryScreen';
import LoyaltyPointsScreen from '../screens/user/LoyaltyPointsScreen';
import NotificationsScreen from '../screens/user/NotificationsScreen';
import ProductDetailScreen from '../screens/user/ProductDetailScreen';
import FeaturedProductsScreen from '../screens/user/FeaturedProductsScreen';
import CartScreen from '../screens/user/CartScreen';
import CheckoutScreen from '../screens/user/CheckoutScreen';
import RateReviewScreen from '../screens/user/RateReviewScreen';
import SettingsScreen from '../screens/user/SettingsScreen';
import HelpCenterScreen from '../screens/user/HelpCenterScreen';
import SubmitTicketScreen from '../screens/user/SubmitTicketScreen';
import MyTicketsScreen from '../screens/user/MyTicketsScreen';
import SupportTicketChatScreen from '../screens/user/SupportTicketChatScreen';
import OffersScreen from '../screens/user/OffersScreen';
import ExclusiveOfferProductsScreen from '../screens/user/ExclusiveOfferProductsScreen';
import MembershipsScreen from '../screens/common/MembershipsScreen';
import MembershipCheckoutScreen from '../screens/common/MembershipCheckoutScreen';
import PersonalInfoScreen from '../screens/user/PersonalInfoScreen';
import AddressesScreen from '../screens/user/AddressesScreen';
import AddAddressScreen from '../screens/user/AddAddressScreen';
import EditAddressScreen from '../screens/user/EditAddressScreen';
import PaymentMethodsScreen from '../screens/user/PaymentMethodsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<UserStackParamList>();

// Tab Navigator
const TabNavigator = () => {
  const insets = useSafeAreaInsets();

  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Services':
              iconName = focused ? 'construct' : 'construct-outline';
              break;
            case 'Orders':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Store':
              iconName = focused ? 'bag' : 'bag-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          height: 60 + insets.bottom,
        },
        headerShown: false,
        tabBarLabelStyle: { textTransform: 'none' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen name="Services" component={ServicesScreen} options={{ tabBarLabel: t('tabs.services') }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarLabel: t('tabs.orders') }} />
      <Tab.Screen name="Store" component={StoreScreen} options={{ tabBarLabel: t('tabs.store') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('tabs.profile') }} />
    </Tab.Navigator>
  );
};

// Main Stack Navigator
const UserAppNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      
      {/* Service Screens */}
      <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} />
      <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
      <Stack.Screen name="ServiceProducts" component={ServiceProductsScreen} />
      <Stack.Screen name="BookingForm" component={BookingFormScreen} />
      <Stack.Screen name="OrderSummary" component={OrderSummaryScreen} />
      <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
      
      {/* Order Screens */}
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="LoyaltyPoints" component={LoyaltyPointsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Offers" component={OffersScreen} />
      <Stack.Screen name="ExclusiveOfferProducts" component={ExclusiveOfferProductsScreen} />
      
      {/* Store Screens */}
      <Stack.Screen name="ProductCategory" component={ServiceCategoryScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="FeaturedProducts" component={FeaturedProductsScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      
      {/* Profile Screens */}
      <Stack.Screen name="RateReview" component={RateReviewScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <Stack.Screen name="SubmitTicket" component={SubmitTicketScreen} />
      <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
      <Stack.Screen name="SupportTicketChat" component={SupportTicketChatScreen} />
      <Stack.Screen name="Memberships" component={MembershipsScreen} />
      <Stack.Screen name="MembershipCheckout" component={MembershipCheckoutScreen} />
      <Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="AddAddress" component={AddAddressScreen} />
      <Stack.Screen name="EditAddress" component={EditAddressScreen} />
      <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
    </Stack.Navigator>
  );
};

export default UserAppNavigator; 