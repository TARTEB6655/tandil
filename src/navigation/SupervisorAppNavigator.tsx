import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';

// Screens
import SupervisorLoginScreen from '../screens/supervisor/SupervisorLoginScreen';
import SupervisorDashboardScreen from '../screens/supervisor/SupervisorDashboardScreen';
import SupervisorReportScreen from '../screens/technician/SupervisorReportScreen';
import PendingReportsListScreen from '../screens/supervisor/PendingReportsListScreen';
import SupervisorProfileScreen from '../screens/supervisor/SupervisorProfileScreen';
import AssignTasksScreen from '../screens/supervisor/AssignTasksScreen';
import TeamStatsScreen from '../screens/supervisor/TeamStatsScreen';
import HelpCenterScreen from '../screens/user/HelpCenterScreen';
import TechnicianServiceAreasSettingsScreen from '../screens/technician/TechnicianServiceAreasSettingsScreen';
import TechnicianSpecializationsScreen from '../screens/technician/TechnicianSpecializationsScreen';
import TechnicianNotificationsScreen from '../screens/technician/TechnicianNotificationsScreen';
import SupervisorSubmitTicketScreen from '../screens/supervisor/SupervisorSubmitTicketScreen';
import SupervisorTeamListScreen from '../screens/supervisor/SupervisorTeamListScreen';
import SupervisorTeamMemberDetailScreen from '../screens/supervisor/SupervisorTeamMemberDetailScreen';
import SupervisorAssignmentDetailScreen from '../screens/supervisor/SupervisorAssignmentDetailScreen';
import MyTicketsScreen from '../screens/user/MyTicketsScreen';
import SupportTicketChatScreen from '../screens/user/SupportTicketChatScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
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
        component={SupervisorDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ReportsTab"
        component={PendingReportsListScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={SupervisorProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const SupervisorAppNavigator = () => {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={SupervisorLoginScreen} />
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen name="AssignTasks" component={AssignTasksScreen} />
        <Stack.Screen name="TeamStats" component={TeamStatsScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="ServiceAreasSettings" component={TechnicianServiceAreasSettingsScreen} />
        <Stack.Screen name="Specializations" component={TechnicianSpecializationsScreen} />
        <Stack.Screen name="Notifications" component={TechnicianNotificationsScreen} />
        <Stack.Screen name="SubmitTicket" component={SupervisorSubmitTicketScreen} />
        <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        <Stack.Screen name="SupportTicketChat" component={SupportTicketChatScreen} />
        <Stack.Screen name="SupervisorReport" component={SupervisorReportScreen} />
        <Stack.Screen name="SupervisorTeamList" component={SupervisorTeamListScreen} />
        <Stack.Screen name="SupervisorTeamMemberDetail" component={SupervisorTeamMemberDetailScreen} />
        <Stack.Screen name="SupervisorAssignmentDetail" component={SupervisorAssignmentDetailScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default SupervisorAppNavigator;

