import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import type { ForgotPasswordRole } from '../services/forgotPasswordTypes';
import ForgotPasswordPhoneScreen from '../screens/auth/forgot/ForgotPasswordPhoneScreen';
import ForgotPasswordOtpScreen from '../screens/auth/forgot/ForgotPasswordOtpScreen';
import ForgotPasswordNewPasswordScreen from '../screens/auth/forgot/ForgotPasswordNewPasswordScreen';

export type ForgotPasswordStackParamList = {
  ForgotPasswordPhone: { role: ForgotPasswordRole; accent?: string };
  ForgotPasswordOtp: {
    role: ForgotPasswordRole;
    accent?: string;
    phone: string;
    maskedPhone?: string;
    resendAfterSeconds?: number;
  };
  ForgotPasswordNewPassword: {
    role: ForgotPasswordRole;
    accent?: string;
    phone: string;
    resetToken: string;
  };
};

const Stack = createStackNavigator<ForgotPasswordStackParamList>();

type FlowRoute = RouteProp<RootStackParamList, 'ForgotPasswordFlow'>;

const ForgotPasswordNavigator: React.FC = () => {
  const route = useRoute<FlowRoute>();
  const { role, accent } = route.params;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="ForgotPasswordPhone"
    >
      <Stack.Screen
        name="ForgotPasswordPhone"
        component={ForgotPasswordPhoneScreen}
        initialParams={{ role, accent }}
      />
      <Stack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpScreen} />
      <Stack.Screen name="ForgotPasswordNewPassword" component={ForgotPasswordNewPasswordScreen} />
    </Stack.Navigator>
  );
};

export default ForgotPasswordNavigator;
