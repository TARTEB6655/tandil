import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';

// Screens
import AreaManagerLoginScreen from '../screens/areamanager/AreaManagerLoginScreen';
import AreaManagerDashboardScreen from '../screens/areamanager/AreaManagerDashboardScreen';
import TechnicianProfileScreen from '../screens/technician/TechnicianProfileScreen';
import AllTeamsScreen from '../screens/areamanager/AllTeamsScreen';
import RegionMapScreen from '../screens/areamanager/RegionMapScreen';
import AnalyticsScreen from '../screens/areamanager/AnalyticsScreen';
import RegionReportsScreen from '../screens/areamanager/ReportsScreen';
import RegionAlertsScreen from '../screens/areamanager/RegionAlertsScreen';
import TeamLeadersScreen from '../screens/areamanager/TeamLeadersScreen';
import TeamLeaderDetailScreen from '../screens/areamanager/TeamLeaderDetailScreen';

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
        component={AreaManagerDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="TeamsTab"
        component={AllTeamsScreen}
        options={{
          tabBarLabel: 'Teams',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
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
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default AreaManagerAppNavigator;

