import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants';
import { TechnicianStackParamList } from '../types';

// Screens
import TechnicianLoginScreen from '../screens/technician/TechnicianLoginScreen';
import TechnicianDashboardScreen from '../screens/technician/TechnicianDashboardScreen';
import JobDetailScreen from '../screens/technician/JobDetailScreen';
import TechnicianOrderHistoryScreen from '../screens/technician/TechnicianOrderHistoryScreen';
import PayoutSummaryScreen from '../screens/technician/PayoutSummaryScreen';
import TechnicianAddBankAccountScreen from '../screens/technician/TechnicianAddBankAccountScreen';
import TechnicianProfileScreen from '../screens/technician/TechnicianProfileScreen';
import TechnicianProfileEditScreen from '../screens/technician/TechnicianProfileEditScreen';
import TechnicianSpecializationsScreen from '../screens/technician/TechnicianSpecializationsScreen';
import TechnicianTodayTasksScreen from '../screens/technician/TechnicianTodayTasksScreen';
import TechnicianAcceptedJobsScreen from '../screens/technician/TechnicianAcceptedJobsScreen';
import TechnicianRejectedJobsScreen from '../screens/technician/TechnicianRejectedJobsScreen';
import AvailabilityScreen from '../screens/technician/AvailabilityScreen';
import TechnicianBreakTimeScreen from '../screens/technician/TechnicianBreakTimeScreen';
import TechnicianVacationScreen from '../screens/technician/TechnicianVacationScreen';
import TechnicianServiceAreasScreen from '../screens/technician/TechnicianServiceAreasScreen';
import TechnicianServiceAreasSettingsScreen from '../screens/technician/TechnicianServiceAreasSettingsScreen';
import SupervisorReportScreen from '../screens/technician/SupervisorReportScreen';
import MembershipsScreen from '../screens/common/MembershipsScreen';
import MembershipCheckoutScreen from '../screens/common/MembershipCheckoutScreen';
import HelpCenterScreen from '../screens/user/HelpCenterScreen';
import TechnicianSubmitTicketScreen from '../screens/technician/TechnicianSubmitTicketScreen';
import MyTicketsScreen from '../screens/user/MyTicketsScreen';
import SupportTicketChatScreen from '../screens/user/SupportTicketChatScreen';
import TechnicianNotificationsScreen from '../screens/technician/TechnicianNotificationsScreen';

/** Technician uses own notifications screen (GET /technician/notifications); alias for Stack.Screen */
const NotificationsScreen = TechnicianNotificationsScreen;

const Stack = createStackNavigator<TechnicianStackParamList>();
const Tab = createBottomTabNavigator();

/** Stack for Profile tab so Settings items (Service Areas, Specializations, etc.) can navigate correctly */
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Profile" component={TechnicianProfileScreen} />
    <Stack.Screen name="ServiceAreasSettings" component={TechnicianServiceAreasSettingsScreen} />
    <Stack.Screen name="TechnicianProfileEdit" component={TechnicianProfileEditScreen} />
    <Stack.Screen name="Specializations" component={TechnicianSpecializationsScreen} />
    <Stack.Screen name="Memberships" component={MembershipsScreen} />
    <Stack.Screen name="MembershipCheckout" component={MembershipCheckoutScreen} />
  </Stack.Navigator>
);

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
        component={TechnicianDashboardScreen}
        options={{
          tabBarLabel: t('technician.tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TasksTab"
        component={TechnicianOrderHistoryScreen}
        options={{
          tabBarLabel: t('technician.tabs.tasks'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScheduleTab"
        component={AvailabilityScreen}
        options={{
          tabBarLabel: t('technician.tabs.schedule'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: t('technician.tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const TechnicianAppNavigator = () => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={TechnicianLoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="JobDetail" component={JobDetailScreen} />
        <Stack.Screen name="TodayTasks" component={TechnicianTodayTasksScreen} />
        <Stack.Screen name="AcceptedJobs" component={TechnicianAcceptedJobsScreen} />
        <Stack.Screen name="RejectedJobs" component={TechnicianRejectedJobsScreen} />
        <Stack.Screen name="SetBreakTime" component={TechnicianBreakTimeScreen} />
        <Stack.Screen name="SetVacation" component={TechnicianVacationScreen} />
        <Stack.Screen name="ServiceAreas" component={TechnicianServiceAreasScreen} />
        <Stack.Screen name="SupervisorReport" component={SupervisorReportScreen} />
        <Stack.Screen name="PayoutSummary" component={PayoutSummaryScreen} />
        <Stack.Screen name="AddBankAccount" component={TechnicianAddBankAccountScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="SubmitTicket" component={TechnicianSubmitTicketScreen} />
        <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        <Stack.Screen name="SupportTicketChat" component={SupportTicketChatScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default TechnicianAppNavigator; 