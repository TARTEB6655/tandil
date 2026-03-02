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
import TechnicianProfileScreen from '../screens/technician/TechnicianProfileScreen';
import AssignTasksScreen from '../screens/supervisor/AssignTasksScreen';
import TeamStatsScreen from '../screens/supervisor/TeamStatsScreen';
import HelpCenterScreen from '../screens/user/HelpCenterScreen';
import SupervisorSubmitTicketScreen from '../screens/supervisor/SupervisorSubmitTicketScreen';
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
        component={SupervisorReportScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={TechnicianProfileScreen}
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
        <Stack.Screen name="SubmitTicket" component={SupervisorSubmitTicketScreen} />
        <Stack.Screen name="MyTickets" component={MyTicketsScreen} />
        <Stack.Screen name="SupportTicketChat" component={SupportTicketChatScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default SupervisorAppNavigator;

