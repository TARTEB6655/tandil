import React from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { VendorStackParamList } from '../types';
import { COLORS } from '../constants';
import { useTranslation } from 'react-i18next';
import { useAuthStackInitialRoute } from '../hooks/useAuthStackInitialRoute';
import {
  DashboardTabIcon,
  useDashboardTabOptions,
} from '../components/common/DashboardTabBar';

import VendorLoginScreen from '../screens/vendor/VendorLoginScreen';
import VendorSignupScreen from '../screens/vendor/VendorSignupScreen';
import VendorDashboardScreen from '../screens/vendor/VendorDashboardScreen';
import VendorProductsScreen from '../screens/vendor/VendorProductsScreen';
import VendorOrdersScreen from '../screens/vendor/VendorOrdersScreen';
import VendorProfileScreen from '../screens/vendor/VendorProfileScreen';
import VendorProductDetailScreen from '../screens/vendor/VendorProductDetailScreen';
import VendorAddProductScreen from '../screens/vendor/VendorAddProductScreen';
import VendorEditProductScreen from '../screens/vendor/VendorEditProductScreen';
import VendorOrderDetailScreen from '../screens/vendor/VendorOrderDetailScreen';
import VendorOrderContactScreen from '../screens/vendor/VendorOrderContactScreen';
import VendorAnalyticsScreen from '../screens/vendor/VendorAnalyticsScreen';
import VendorInventoryScreen from '../screens/vendor/VendorInventoryScreen';
import VendorPricingScreen from '../screens/vendor/VendorPricingScreen';
import VendorEditProfileScreen from '../screens/vendor/VendorEditProfileScreen';
import VendorBusinessInfoScreen from '../screens/vendor/VendorBusinessInfoScreen';
import VendorLocationAddressScreen from '../screens/vendor/VendorLocationAddressScreen';
import VendorLiveChatScreen from '../screens/vendor/VendorLiveChatScreen';
import VendorContactUsScreen from '../screens/vendor/VendorContactUsScreen';
import VendorLegalDocumentScreen from '../screens/vendor/VendorLegalDocumentScreen';
import VendorNotificationsScreen from '../screens/vendor/VendorNotificationsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<VendorStackParamList>();

const TabNavigator = () => {
  const { t } = useTranslation();
  const tabOptions = useDashboardTabOptions();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabOptions,
        tabBarIcon: ({ focused }) => {
          switch (route.name) {
            case 'Dashboard':
              return (
                <DashboardTabIcon focused={focused} name="home" outlineName="home-outline" />
              );
            case 'Products':
              return (
                <DashboardTabIcon focused={focused} name="cube" outlineName="cube-outline" />
              );
            case 'Orders':
              return (
                <DashboardTabIcon focused={focused} name="list" outlineName="list-outline" />
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
      <Tab.Screen
        name="Dashboard"
        component={VendorDashboardScreen}
        options={{ tabBarLabel: t('vendorTabs.dashboard') }}
      />
      <Tab.Screen
        name="Products"
        component={VendorProductsScreen}
        options={{ tabBarLabel: t('vendorTabs.products') }}
      />
      <Tab.Screen
        name="Orders"
        component={VendorOrdersScreen}
        options={{ tabBarLabel: t('vendorTabs.orders') }}
      />
      <Tab.Screen
        name="Profile"
        component={VendorProfileScreen}
        options={{ tabBarLabel: t('vendorTabs.profile') }}
      />
    </Tab.Navigator>
  );
};

const VendorAppNavigator = () => {
  const initialRoute = useAuthStackInitialRoute('vendor');

  if (initialRoute === null) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
      <Stack.Screen name="Login" component={VendorLoginScreen} />
      <Stack.Screen name="VendorSignup" component={VendorSignupScreen} />
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="ProductDetail" component={VendorProductDetailScreen} />
      <Stack.Screen name="AddProduct" component={VendorAddProductScreen} />
      <Stack.Screen name="EditProduct" component={VendorEditProductScreen} />
      <Stack.Screen name="OrderDetail" component={VendorOrderDetailScreen} />
      <Stack.Screen name="OrderContact" component={VendorOrderContactScreen} />
      <Stack.Screen name="Analytics" component={VendorAnalyticsScreen} />
      <Stack.Screen name="Inventory" component={VendorInventoryScreen} />
      <Stack.Screen name="Pricing" component={VendorPricingScreen} />
      <Stack.Screen name="EditProfile" component={VendorEditProfileScreen} />
      <Stack.Screen name="BusinessInfo" component={VendorBusinessInfoScreen} />
      <Stack.Screen name="LocationAddress" component={VendorLocationAddressScreen} />
      <Stack.Screen name="LiveChat" component={VendorLiveChatScreen} />
      <Stack.Screen name="ContactUs" component={VendorContactUsScreen} />
      <Stack.Screen name="LegalDocument" component={VendorLegalDocumentScreen} />
      <Stack.Screen name="Notifications" component={VendorNotificationsScreen} />
    </Stack.Navigator>
  );
};

export default VendorAppNavigator;
