import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { useTranslation } from 'react-i18next';

// Screens
import AreaManagerLoginScreen from '../screens/areamanager/AreaManagerLoginScreen';
import AreaManagerDashboardScreen from '../screens/areamanager/AreaManagerDashboardScreen';
import AreaManagerProfileScreen from '../screens/areamanager/AreaManagerProfileScreen';
import AllTeamsScreen from '../screens/areamanager/AllTeamsScreen';
import RegionMapScreen from '../screens/areamanager/RegionMapScreen';
import AnalyticsScreen from '../screens/areamanager/AnalyticsScreen';
import RegionReportsScreen from '../screens/areamanager/ReportsScreen';
import RegionAlertsScreen from '../screens/areamanager/RegionAlertsScreen';
import TeamLeadersScreen from '../screens/areamanager/TeamLeadersScreen';
import TeamLeaderDetailScreen from '../screens/areamanager/TeamLeaderDetailScreen';
import SupervisorTeamMembersScreen from '../screens/areamanager/SupervisorTeamMembersScreen';
import TeamMemberJobsScreen from '../screens/areamanager/TeamMemberJobsScreen';
import AreaManagerProfileEditScreen from '../screens/areamanager/AreaManagerProfileEditScreen';
import HelpCenterScreen from '../screens/user/HelpCenterScreen';
import AreaManagerSubmitTicketScreen from '../screens/areamanager/AreaManagerSubmitTicketScreen';
import AreaManagerNotificationsScreen from '../screens/areamanager/AreaManagerNotificationsScreen';
import MyTicketsScreen from '../screens/user/MyTicketsScreen';
import SupportTicketChatScreen from '../screens/user/SupportTicketChatScreen';

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
        component={AreaManagerDashboardScreen}
        options={{
          tabBarLabel: t('admin.areaManagerDashboard.tabDashboard', { defaultValue: 'Dashboard' }),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TeamsTab"
        component={AllTeamsScreen}
        options={{
          tabBarLabel: t('admin.areaManagerDashboard.tabTeams', { defaultValue: 'Teams' }),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={AreaManagerProfileScreen}
        options={{
          tabBarLabel: t('admin.areaManagerDashboard.tabProfile', { defaultValue: 'Profile' }),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AreaManagerAppNavigator = () => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={AreaManagerLoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="RegionMap" component={RegionMapScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
        <Stack.Screen name="RegionReports" component={RegionReportsScreen} />
        <Stack.Screen name="RegionAlerts" component={RegionAlertsScreen} />
        <Stack.Screen name="TeamLeaders" component={TeamLeadersScreen} />
        <Stack.Screen name="TeamLeaderDetail" component={TeamLeaderDetailScreen} />
        <Stack.Screen name="SupervisorTeamMembers" component={SupervisorTeamMembersScreen} />
        <Stack.Screen name="TeamMemberJobs" component={TeamMemberJobsScreen} />
        <Stack.Screen name="TechnicianProfileEdit" component={AreaManagerProfileEditScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="SubmitTicket" component={AreaManagerSubmitTicketScreen} />
        <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        <Stack.Screen name="SupportTicketChat" component={SupportTicketChatScreen} />
        <Stack.Screen name="Notifications" component={AreaManagerNotificationsScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default AreaManagerAppNavigator;

