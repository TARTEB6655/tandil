import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { DeliveryStackParamList } from '../types';

// Screens
import DeliveryLoginScreen from '../screens/delivery/DeliveryLoginScreen';
import DeliveryDashboardScreen from '../screens/delivery/DeliveryDashboardScreen';
import DeliveryOrderDetailScreen from '../screens/delivery/DeliveryOrderDetailScreen';
import MapViewScreen from '../screens/delivery/MapViewScreen';
import DeliveryOrderStatusScreen from '../screens/delivery/DeliveryOrderStatusScreen';
import DeliveryProfileScreen from '../screens/delivery/DeliveryProfileScreen';
import DeliverySettingsScreen from '../screens/delivery/DeliverySettingsScreen';
import MembershipsScreen from '../screens/common/MembershipsScreen';
import MembershipCheckoutScreen from '../screens/common/MembershipCheckoutScreen';

const Stack = createStackNavigator<DeliveryStackParamList>();

const DeliveryAppNavigator = () => {
  return (
    <SafeAreaView
      style={{ flex: 1 }}
      // Android: avoid outer bottom inset gap above system nav (match client/tab bar).
      edges={Platform.OS === 'android' ? ['top'] : ['top', 'bottom']}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={DeliveryLoginScreen} />
        <Stack.Screen name="Dashboard" component={DeliveryDashboardScreen} />
        <Stack.Screen name="OrderDetail" component={DeliveryOrderDetailScreen} />
        <Stack.Screen name="MapView" component={MapViewScreen} />
        <Stack.Screen name="OrderStatus" component={DeliveryOrderStatusScreen} />
        <Stack.Screen name="Profile" component={DeliveryProfileScreen} />
        <Stack.Screen name="Settings" component={DeliverySettingsScreen} />
        <Stack.Screen name="Memberships" component={MembershipsScreen} />
        <Stack.Screen name="MembershipCheckout" component={MembershipCheckoutScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

export default DeliveryAppNavigator; 