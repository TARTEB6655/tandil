import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { adminService } from '../../services/adminService';

const AddUserScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const lockRole = Boolean(route.params?.lockRole);
  const preselectedRole = (route.params?.preselectedRole as string | undefined) || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<string>(preselectedRole);
  const [status, setStatus] = useState<string>('active');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const roleOptions = useMemo(
    () => [
      { value: 'client', label: t('admin.addUser.roleClient') },
      { value: 'technician', label: t('admin.addUser.roleTechnician') },
      { value: 'supervisor', label: t('admin.addUser.roleSupervisor') },
      { value: 'area_manager', label: t('admin.addUser.roleAreaManager') },
      { value: 'hr', label: t('admin.addUser.roleHr') },
      { value: 'admin', label: t('admin.addUser.roleAdmin') },
    ],
    [t]
  );

  useEffect(() => {
    if (lockRole && preselectedRole) {
      setRole(preselectedRole);
    }
  }, [lockRole, preselectedRole]);

  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('admin.addUser.statusActive') },
      { value: 'inactive', label: t('admin.addUser.statusInactive') },
    ],
    [t]
  );

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = t('admin.addUser.errorFullName');
    if (!email.trim()) {
      newErrors.email = t('admin.addUser.errorEmail');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = t('admin.addUser.errorEmailInvalid');
    }
    if (!password.trim()) {
      newErrors.password = t('admin.addUser.errorPassword');
    } else if (password.length < 8) {
      newErrors.password = t('admin.addUser.errorPasswordLength');
    }
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = t('admin.addUser.errorConfirmPassword');
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t('admin.addUser.errorPasswordsMatch');
    }
    if (!role) newErrors.role = t('admin.addUser.errorRole');
    if (!status) newErrors.status = t('admin.addUser.errorStatus');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateUser = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await adminService.createUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        password_confirmation: confirmPassword,
        role,
        status,
      });

      Alert.alert(
        t('admin.users.success'),
        t('admin.addUser.success'),
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setName('');
              setEmail('');
              setPhone('');
              setPassword('');
              setConfirmPassword('');
              setRole(preselectedRole);
              setStatus('active');
              setErrors({});
              // Navigate back and refresh users list
              navigation.goBack();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Error creating user:', err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        t('admin.addUser.createFailed');
      
      // Handle validation errors from API
      if (err.response?.data?.errors) {
        const apiErrors: { [key: string]: string } = {};
        Object.keys(err.response.data.errors).forEach((key) => {
          apiErrors[key] = err.response.data.errors[key][0];
        });
        setErrors(apiErrors);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderDropdown = (
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    showDropdown: boolean,
    onToggle: () => void,
    onSelect: (value: string) => void,
    error?: string,
    hint?: string
  ) => {
    const selectedLabel = options.find(opt => opt.value === value)?.label || label;
    
    return (
      <View style={styles.dropdownWrapper}>
        <Text style={styles.label}>
          {label} {label.includes('*') ? '' : '*'}
        </Text>
        <TouchableOpacity
          style={[
            styles.dropdown,
            showDropdown && styles.dropdownOpen,
            error && styles.dropdownError,
          ]}
          onPress={onToggle}
        >
          <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
            {value ? selectedLabel : `Select ${label.toLowerCase().replace('*', '').trim()}`}
          </Text>
          <Ionicons
            name={showDropdown ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        {showDropdown && (
          <Modal
            transparent
            visible={showDropdown}
            animationType="fade"
            onRequestClose={onToggle}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={onToggle}
            >
              <View style={styles.dropdownList}>
                {options.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.dropdownItem,
                      value === option.value && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      onSelect(option.value);
                      onToggle();
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        value === option.value && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {value === option.value && (
                      <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.addUser.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.addUser.personalInfo')}</Text>
          <Input
            label={t('admin.addUser.fullName')}
            placeholder={t('admin.addUser.fullNamePlaceholder')}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
            leftIcon="person-outline"
            error={errors.name}
          />
          <Input
            label={t('admin.addUser.email')}
            placeholder={t('admin.addUser.emailPlaceholder')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            error={errors.email}
          />
          <Input
            label={t('admin.addUser.phone')}
            placeholder={t('admin.addUser.phonePlaceholder')}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (errors.phone) setErrors({ ...errors, phone: '' });
            }}
            keyboardType="phone-pad"
            leftIcon="call-outline"
            error={errors.phone}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.addUser.security')}</Text>
          <Input
            label={t('admin.addUser.password')}
            placeholder={t('admin.addUser.passwordPlaceholder')}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors({ ...errors, password: '' });
            }}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={errors.password}
          />
          {!errors.password && password && (
            <Text style={styles.hint}>{t('admin.addUser.errorPasswordLength')}</Text>
          )}
          <Input
            label={t('admin.addUser.confirmPassword')}
            placeholder={t('admin.addUser.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
            }}
            secureTextEntry
            leftIcon="lock-closed-outline"
            error={errors.confirmPassword}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.addUser.roleAndStatus')}</Text>
          {lockRole ? (
            <View style={styles.dropdownWrapper}>
              <Text style={styles.label}>{t('admin.addUser.userRole')} *</Text>
              <View style={[styles.dropdown, styles.dropdownLocked]}>
                <Text style={styles.dropdownText}>
                  {roleOptions.find((opt) => opt.value === role)?.label || role || t('admin.addUser.roleTechnician')}
                </Text>
              </View>
            </View>
          ) : (
            renderDropdown(
              t('admin.addUser.userRole'),
              role,
              roleOptions,
              showRoleDropdown,
              () => {
                setShowRoleDropdown(!showRoleDropdown);
                setShowStatusDropdown(false);
              },
              (value) => {
                setRole(value);
                if (errors.role) setErrors({ ...errors, role: '' });
              },
              errors.role,
              undefined
            )
          )}
          {renderDropdown(
            t('admin.addUser.accountStatus'),
            status,
            statusOptions,
            showStatusDropdown,
            () => {
              setShowStatusDropdown(!showStatusDropdown);
              setShowRoleDropdown(false);
            },
            (value) => {
              setStatus(value);
              if (errors.status) setErrors({ ...errors, status: '' });
            },
            errors.status,
            t('admin.addUser.statusHint')
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={t('admin.addUser.cancel')}
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.cancelButton}
            icon={<Ionicons name="close" size={20} color={COLORS.primary} style={styles.buttonIcon} />}
          />
          <Button
            title={t('admin.addUser.createUser')}
            onPress={handleCreateUser}
            loading={loading}
            style={styles.createButton}
            icon={<Ionicons name="add" size={20} color={COLORS.background} style={styles.buttonIcon} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  dropdownWrapper: {
    marginBottom: SPACING.md,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  dropdownOpen: {
    borderColor: COLORS.primary,
  },
  dropdownLocked: {
    backgroundColor: COLORS.surface,
  },
  dropdownError: {
    borderColor: COLORS.error,
  },
  dropdownText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  dropdownPlaceholder: {
    color: COLORS.textSecondary,
  },
  hint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  errorText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownList: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 200,
    maxWidth: '80%',
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownItemSelected: {
    backgroundColor: COLORS.surface,
  },
  dropdownItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  dropdownItemTextSelected: {
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  cancelButton: {
    flex: 1,
  },
  createButton: {
    flex: 1,
  },
  buttonIcon: {
    marginRight: SPACING.xs,
  },
});

export default AddUserScreen;

