import React, { useCallback, useState } from 'react';
import {
  NavigationContainer,
  type NavigationState,
} from '@react-navigation/native';
import '../i18n';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { ActiveRoleNotificationSound } from '../components/common/ActiveRoleNotificationSound';

// Screens
import SplashScreen from '../screens/SplashScreen';
import RoleSelectionScreen from '../screens/RoleSelectionScreen';
import AuthScreen from '../screens/AuthScreen';
import UserAppNavigator from './UserAppNavigator';
import TechnicianAppNavigator from './TechnicianAppNavigator';
import SupervisorAppNavigator from './SupervisorAppNavigator';
import AreaManagerAppNavigator from './AreaManagerAppNavigator';
import HRManagerAppNavigator from './HRManagerAppNavigator';
import AdminAppNavigator from './AdminAppNavigator';
import DeliveryAppNavigator from './DeliveryAppNavigator';
import VendorAppNavigator from './VendorAppNavigator';
import VendorLoginScreen from '../screens/vendor/VendorLoginScreen';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const [navState, setNavState] = useState<NavigationState | undefined>();

  const onNavStateChange = useCallback((state: NavigationState | undefined) => {
    setNavState(state);
  }, []);

  return (
    <NavigationContainer onStateChange={onNavStateChange}>
      <ActiveRoleNotificationSound navigationState={navState} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName="Splash"
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="UserApp" component={UserAppNavigator} />
        <Stack.Screen name="TechnicianApp" component={TechnicianAppNavigator} />
        <Stack.Screen name="SupervisorApp" component={SupervisorAppNavigator} />
        <Stack.Screen name="AreaManagerApp" component={AreaManagerAppNavigator} />
        <Stack.Screen name="HRManagerApp" component={HRManagerAppNavigator} />
        <Stack.Screen name="AdminApp" component={AdminAppNavigator} />
        <Stack.Screen name="DeliveryApp" component={DeliveryAppNavigator} />
        <Stack.Screen name="VendorApp" component={VendorAppNavigator} />
        <Stack.Screen name="VendorLogin" component={VendorLoginScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}; 