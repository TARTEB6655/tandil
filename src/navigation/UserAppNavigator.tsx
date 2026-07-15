import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { UserStackParamList } from '../types';
import { useTranslation } from 'react-i18next';
import {
  DashboardTabIcon,
  useDashboardTabOptions,
} from '../components/common/DashboardTabBar';

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
import WalletScreen from '../screens/user/WalletScreen';
import AppInfoContentScreen from '../screens/user/AppInfoContentScreen';
import VendorCompareScreen from '../screens/user/VendorCompareScreen';
import ShopVendorStoreScreen from '../screens/user/ShopVendorStoreScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<UserStackParamList>();

// Tab Navigator
const TabNavigator = () => {
  const { t } = useTranslation();
  const tabOptions = useDashboardTabOptions();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabOptions,
        tabBarIcon: ({ focused }) => {
          switch (route.name) {
            case 'Home':
              return (
                <DashboardTabIcon focused={focused} name="home" outlineName="home-outline" />
              );
            case 'Services':
              return (
                <DashboardTabIcon
                  focused={focused}
                  name="construct"
                  outlineName="construct-outline"
                />
              );
            case 'Orders':
              return (
                <DashboardTabIcon focused={focused} name="list" outlineName="list-outline" />
              );
            case 'Store':
              return (
                <DashboardTabIcon focused={focused} name="bag" outlineName="bag-outline" />
              );
            case 'Profile':
              return (
                <DashboardTabIcon focused={focused} name="person" outlineName="person-outline" />
              );
            default:
              return (
                <DashboardTabIcon focused={focused} name="ellipse" outlineName="ellipse-outline" />
              );
          }
        },
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
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="AppInfoContent" component={AppInfoContentScreen} />
      <Stack.Screen name="VendorCompare" component={VendorCompareScreen} />
      <Stack.Screen name="ShopVendorStore" component={ShopVendorStoreScreen} />
    </Stack.Navigator>
  );
};

export default UserAppNavigator; 