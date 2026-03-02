import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';

// Screens
import AdminLoginScreen from '../screens/admin/AdminLoginScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import UsersManagementScreen from '../screens/admin/UsersManagementScreen';
import AddUserScreen from '../screens/admin/AddUserScreen';
import EditUserScreen from '../screens/admin/EditUserScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';
import AdminSubscriptionsScreen from '../screens/admin/AdminSubscriptionsScreen';
import EditSubscriptionScreen from '../screens/admin/EditSubscriptionScreen';
import AdminTipsScreen from '../screens/admin/AdminTipsScreen';
import AdminProductsScreen from '../screens/admin/AdminProductsScreen';
import AdminAddProductScreen from '../screens/admin/AdminAddProductScreen';
import AdminEditProductScreen from '../screens/admin/AdminEditProductScreen';
import AdminPendingReportsScreen from '../screens/admin/AdminPendingReportsScreen';
import AdminRecentActivitiesScreen from '../screens/admin/AdminRecentActivitiesScreen';
import AdminCategoriesScreen from '../screens/admin/AdminCategoriesScreen';
import AdminAddCategoryScreen from '../screens/admin/AdminAddCategoryScreen';
import AdminEditCategoryScreen from '../screens/admin/AdminEditCategoryScreen';
import AdminServicesScreen from '../screens/admin/AdminServicesScreen';
import AdminAddServiceScreen from '../screens/admin/AdminAddServiceScreen';
import AdminEditServiceScreen from '../screens/admin/AdminEditServiceScreen';
import AdminBannersScreen from '../screens/admin/AdminBannersScreen';
import AdminProductSettingsScreen from '../screens/admin/AdminProductSettingsScreen';
import AdminProfileEditScreen from '../screens/admin/AdminProfileEditScreen';
import AdminSupportTicketsScreen from '../screens/admin/AdminSupportTicketsScreen';
import AdminSupportTicketChatScreen from '../screens/admin/AdminSupportTicketChatScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminExclusiveOffersScreen from '../screens/admin/AdminExclusiveOffersScreen';
import AdminAddExclusiveOfferScreen from '../screens/admin/AdminAddExclusiveOfferScreen';
import AdminEditExclusiveOfferScreen from '../screens/admin/AdminEditExclusiveOfferScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={AdminDashboardScreen}
        options={{
          tabBarLabel: t('admin.tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="UsersTab"
        component={UsersManagementScreen}
        options={{
          tabBarLabel: t('admin.tabs.users'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={AdminPendingReportsScreen}
        options={{
          tabBarLabel: t('admin.tabs.reports'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={AdminSettingsScreen}
        options={{
          tabBarLabel: t('admin.tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AdminAppNavigator = () => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={AdminLoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="AddUser" component={AddUserScreen} />
        <Stack.Screen name="EditUser" component={EditUserScreen} />
        <Stack.Screen name="AdminSubscriptions" component={AdminSubscriptionsScreen} />
        <Stack.Screen name="EditSubscription" component={EditSubscriptionScreen} />
        <Stack.Screen name="AdminTips" component={AdminTipsScreen} />
        <Stack.Screen name="AdminProducts" component={AdminProductsScreen} />
        <Stack.Screen name="AdminAddProduct" component={AdminAddProductScreen} />
        <Stack.Screen name="AdminEditProduct" component={AdminEditProductScreen} />
        <Stack.Screen name="PendingReports" component={AdminPendingReportsScreen} />
        <Stack.Screen name="RecentActivities" component={AdminRecentActivitiesScreen} />
        <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} />
        <Stack.Screen name="AdminAddCategory" component={AdminAddCategoryScreen} />
        <Stack.Screen name="AdminEditCategory" component={AdminEditCategoryScreen} />
        <Stack.Screen name="AdminServices" component={AdminServicesScreen} />
        <Stack.Screen name="AdminAddService" component={AdminAddServiceScreen} />
        <Stack.Screen name="AdminEditService" component={AdminEditServiceScreen} />
        <Stack.Screen name="AdminBanners" component={AdminBannersScreen} />
        <Stack.Screen name="AdminProductSettings" component={AdminProductSettingsScreen} />
        <Stack.Screen name="AdminProfileEdit" component={AdminProfileEditScreen} />
        <Stack.Screen name="AdminSupportTickets" component={AdminSupportTicketsScreen} />
        <Stack.Screen name="SupportTicketChat" component={AdminSupportTicketChatScreen} />
        <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
        <Stack.Screen name="AdminExclusiveOffers" component={AdminExclusiveOffersScreen} />
        <Stack.Screen name="AdminAddExclusiveOffer" component={AdminAddExclusiveOfferScreen} />
        <Stack.Screen name="AdminEditExclusiveOffer" component={AdminEditExclusiveOfferScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default AdminAppNavigator;

