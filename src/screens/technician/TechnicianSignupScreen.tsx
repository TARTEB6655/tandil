import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useTranslation } from 'react-i18next';
import { technicianSignupRequestService } from '../../services/technicianSignupRequestService';
import { getAddressFromCurrentLocation } from '../../utils/addressFromLocation';

const TechnicianSignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locatingServiceArea, setLocatingServiceArea] = useState(false);

  const validate = (): boolean => {
    if (!name.trim() || !email.trim() || !phone.trim() || !serviceArea.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert(
        t('booking.missingTitle', { defaultValue: 'Missing Information' }),
        t('booking.missingBody', { defaultValue: 'Please fill in all fields' })
      );
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('technicianSignup.invalidEmail')
      );
      return false;
    }
    if (password.length < 6) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('technicianSignup.passwordMin')
      );
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('technicianSignup.passwordMismatch')
      );
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setError(null);
    try {
      await technicianSignupRequestService.createRequest({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        service_area: serviceArea.trim(),
        password,
        password_confirmation: confirmPassword,
      });
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t(
          'technicianSignup.requestSubmitted',
          { defaultValue: 'Signup request sent successfully. Please wait for supervisor approval.' }
        ),
        [{ text: t('common.ok', { defaultValue: 'OK' }), onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('technicianSignup.registrationFailed');
      setError(errorMessage);
      Alert.alert(t('common.error', { defaultValue: 'Error' }), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocatingServiceArea(true);
    try {
      const result = await getAddressFromCurrentLocation();
      if (!result.ok) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('locationError', { defaultValue: 'Could not get current location. Please allow location access or enter manually.' })
        );
        return;
      }
      const a = result.address;
      const area =
        [a.city, a.state, a.country].filter(Boolean).join(', ').trim() ||
        a.street_address ||
        t('serviceArea.selectedLocation', { defaultValue: 'Selected location' });
      setServiceArea(area);
      setError(null);
    } finally {
      setLocatingServiceArea(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('technicianSignup.title', { defaultValue: 'Technician Sign Up' })}</Text>
          <Text style={styles.subtitle}>
            {t('technicianSignup.subtitle', { defaultValue: 'Create your technician account' })}
          </Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label={t('auth.nameLabel', { defaultValue: 'Name' })}
            placeholder={t('auth.namePlaceholder', { defaultValue: 'Enter your full name' })}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            leftIcon="person-outline"
          />
          <Input
            label={t('auth.emailLabel', { defaultValue: 'Email' })}
            placeholder={t('auth.emailPlaceholder', { defaultValue: 'Enter your email' })}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
          />
          <Input
            label={t('auth.phoneLabel', { defaultValue: 'Phone Number' })}
            placeholder={t('auth.phonePlaceholder', { defaultValue: '+971...' })}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setError(null);
            }}
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />
          <Input
            label={t('technicianSignup.serviceArea', { defaultValue: 'Service Area' })}
            placeholder={t('technicianSignup.serviceAreaPlaceholder', { defaultValue: 'Enter your service area' })}
            value={serviceArea}
            onChangeText={(text) => {
              setServiceArea(text);
              setError(null);
            }}
            leftIcon="location-outline"
          />
          <TouchableOpacity
            style={[styles.useCurrentLocationButton, locatingServiceArea && styles.useCurrentLocationButtonDisabled]}
            onPress={handleUseCurrentLocation}
            disabled={locatingServiceArea}
            activeOpacity={0.8}
          >
            {locatingServiceArea ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="locate-outline" size={18} color={COLORS.primary} />
            )}
            <Text style={styles.useCurrentLocationText}>
              {locatingServiceArea
                ? t('serviceArea.findingLocations', { defaultValue: 'Finding locations...' })
                : t('useCurrentLocation', { defaultValue: 'Use current location' })}
            </Text>
          </TouchableOpacity>
          <Input
            label={t('auth.passwordLabel', { defaultValue: 'Password' })}
            placeholder={t('auth.passwordPlaceholder', { defaultValue: 'Enter your password' })}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? 'eye-off' : 'eye'}
            onRightIconPress={() => setShowPassword((prev) => !prev)}
          />
          <Input
            label={t('auth.confirmPasswordLabel', { defaultValue: 'Confirm Password' })}
            placeholder={t('auth.confirmPasswordPlaceholder', { defaultValue: 'Enter confirm password' })}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError(null);
            }}
            secureTextEntry={!showConfirmPassword}
            rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
            onRightIconPress={() => setShowConfirmPassword((prev) => !prev)}
          />

          <Button
            title={isLoading
              ? t('technicianSignup.signingUp', { defaultValue: 'Creating account...' })
              : t('technicianSignup.signup', { defaultValue: 'Sign Up' })}
            onPress={handleSignup}
            loading={isLoading}
            disabled={isLoading}
            style={styles.signupButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  form: {
    gap: SPACING.sm,
  },
  signupButton: {
    marginTop: SPACING.md,
  },
  useCurrentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginTop: 2,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.primary + '10',
  },
  useCurrentLocationButtonDisabled: {
    opacity: 0.7,
  },
  useCurrentLocationText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
});

export default TechnicianSignupScreen;
