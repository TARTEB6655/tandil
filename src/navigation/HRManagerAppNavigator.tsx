import React from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '../constants';
import { useTranslation } from 'react-i18next';
import { useAuthStackInitialRoute } from '../hooks/useAuthStackInitialRoute';
import {
  DashboardTabIcon,
  useDashboardTabOptions,
} from '../components/common/DashboardTabBar';

// Screens
import HRManagerLoginScreen from '../screens/hrmanager/HRManagerLoginScreen';
import HRManagerDashboardScreen from '../screens/hrmanager/HRManagerDashboardScreen';
import AddEmployeeScreen from '../screens/hrmanager/AddEmployeeScreen';
import EmployeeListScreen from '../screens/hrmanager/EmployeeListScreen';
import EditEmployeeScreen from '../screens/hrmanager/EditEmployeeScreen';
import ManageLeavesScreen from '../screens/hrmanager/ManageLeavesScreen';
import HRAssignVisitsScreen from '../screens/hrmanager/HRAssignVisitsScreen';
import HRReportsScreen from '../screens/hrmanager/HRReportsScreen';
import HRReportPreviewDetailScreen from '../screens/hrmanager/HRReportPreviewDetailScreen';
import HRManagerProfileScreen from '../screens/hrmanager/HRManagerProfileScreen';
import HRManagerProfileEditScreen from '../screens/hrmanager/HRManagerProfileEditScreen';
import HRManagerSubmitTicketScreen from '../screens/hrmanager/HRManagerSubmitTicketScreen';
import HRManagerNotificationsScreen from '../screens/hrmanager/HRManagerNotificationsScreen';
import HelpCenterScreen from '../screens/user/HelpCenterScreen';
import MyTicketsScreen from '../screens/user/MyTicketsScreen';
import SupportTicketChatScreen from '../screens/user/SupportTicketChatScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const { t } = useTranslation();
  const tabOptions = useDashboardTabOptions();

  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="DashboardTab"
        component={HRManagerDashboardScreen}
        options={{
          tabBarLabel: t('admin.hrManagerDashboard.tabDashboard', { defaultValue: 'Dashboard' }),
          tabBarIcon: ({ focused }) => (
            <DashboardTabIcon focused={focused} name="home" outlineName="home-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="EmployeesTab"
        component={EmployeeListScreen}
        options={{
          tabBarLabel: t('admin.hrManagerDashboard.tabEmployees', { defaultValue: 'Employees' }),
          tabBarIcon: ({ focused }) => (
            <DashboardTabIcon focused={focused} name="people" outlineName="people-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="LeavesTab"
        component={ManageLeavesScreen}
        options={{
          tabBarLabel: t('admin.hrManagerDashboard.tabLeaves', { defaultValue: 'Leaves' }),
          tabBarIcon: ({ focused }) => (
            <DashboardTabIcon focused={focused} name="calendar" outlineName="calendar-outline" />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={HRManagerProfileScreen}
        options={{
          tabBarLabel: t('admin.hrManagerDashboard.tabProfile', { defaultValue: 'Profile' }),
          tabBarIcon: ({ focused }) => (
            <DashboardTabIcon focused={focused} name="person" outlineName="person-outline" />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const HRManagerAppNavigator = () => {
  const initialRoute = useAuthStackInitialRoute('hr');

  if (!initialRoute) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={HRManagerLoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="AddEmployee" component={AddEmployeeScreen} />
        <Stack.Screen name="EmployeeList" component={EmployeeListScreen} />
        <Stack.Screen name="EditEmployee" component={EditEmployeeScreen} />
        <Stack.Screen name="ManageLeaves" component={ManageLeavesScreen} />
        <Stack.Screen name="HRAssignVisits" component={HRAssignVisitsScreen} />
        <Stack.Screen name="HRReports" component={HRReportsScreen} />
        <Stack.Screen name="HRReportPreviewDetail" component={HRReportPreviewDetailScreen} />
        <Stack.Screen name="HRManagerProfileEdit" component={HRManagerProfileEditScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="SubmitTicket" component={HRManagerSubmitTicketScreen} />
        <Stack.Screen name="Notifications" component={HRManagerNotificationsScreen} />
        <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        <Stack.Screen name="SupportTicketChat" component={SupportTicketChatScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default HRManagerAppNavigator;

