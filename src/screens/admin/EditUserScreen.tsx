import React, { useState, useEffect } from 'react';
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
import { adminService, AdminUser } from '../../services/adminService';

const EditUserScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const user: AdminUser = route.params?.user;
  const lockRole = Boolean(route.params?.lockRole);
  const forcedRole = (route.params?.forcedRole as string | undefined) || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<string>('');
  const [status, setStatus] = useState<string>('active');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRole(forcedRole || user.role || '');
      setStatus(user.status || 'active');
    }
  }, [user, forcedRole]);

  const roles = [
    { value: 'client', labelKey: 'admin.editUser.roleClient' },
    { value: 'technician', labelKey: 'admin.editUser.roleTechnician' },
    { value: 'supervisor', labelKey: 'admin.editUser.roleSupervisor' },
    { value: 'area_manager', labelKey: 'admin.editUser.roleAreaManager' },
    { value: 'hr', labelKey: 'admin.editUser.roleHr' },
    { value: 'admin', labelKey: 'admin.editUser.roleAdmin' },
  ];

  const statuses = [
    { value: 'active', labelKey: 'admin.editUser.statusActive' },
    { value: 'inactive', labelKey: 'admin.editUser.statusInactive' },
  ];

  const getRoleLabel = (value: string) => {
    const r = roles.find((x) => x.value === value);
    return r ? t(r.labelKey) : t('admin.editUser.selectRole');
  };

  const getStatusLabel = (value: string) => {
    const s = statuses.find((x) => x.value === value);
    return s ? t(s.labelKey) : t('admin.editUser.statusActive');
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = t('admin.editUser.errorFullName');
    if (!email.trim()) {
      newErrors.email = t('admin.editUser.errorEmail');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = t('admin.editUser.errorEmailInvalid');
    }
    if (password.trim()) {
      if (password.length < 8) newErrors.password = t('admin.editUser.errorPasswordLength');
      if (!confirmPassword.trim()) {
        newErrors.confirmPassword = t('admin.editUser.errorConfirmPassword');
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = t('admin.editUser.errorPasswordsMatch');
      }
    } else if (confirmPassword.trim()) {
      newErrors.password = t('admin.editUser.errorPasswordRequired');
    }
    if (!role) newErrors.role = t('admin.editUser.errorRole');
    if (!status) newErrors.status = t('admin.editUser.errorStatus');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateUser = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user) {
      Alert.alert(t('admin.users.error'), t('admin.editUser.userNotFound'));
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role: lockRole ? (forcedRole || role || 'technician') : role,
        status,
      };

      // Only include password if provided
      if (password.trim()) {
        updateData.password = password;
        updateData.password_confirmation = confirmPassword;
      }

      await adminService.updateUser(user.id, updateData);

      Alert.alert(
        'Success',
        'User updated successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back and refresh users list
              navigation.goBack();
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('Error updating user:', err);
      const errorMessage = 
        err.response?.data?.message || 
        err.response?.data?.error ||
        err.message || 
        'Failed to update user. Please try again.';
      
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
    options: Array<{ value: string; labelKey: string }>,
    showDropdown: boolean,
    onToggle: () => void,
    onSelect: (value: string) => void,
    error?: string,
    hint?: string,
    placeholderKey?: string
  ) => {
    const selectedOpt = options.find((opt) => opt.value === value);
    const selectedLabel = selectedOpt ? t(selectedOpt.labelKey) : label;

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
            {value ? selectedLabel : (placeholderKey ? t(placeholderKey) : label)}
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
                      {t(option.labelKey)}
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

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{t('admin.editUser.userNotFound')}</Text>
          <Button
            title={t('admin.editUser.goBack')}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.editUser.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin.editUser.personalInfo')}</Text>
          <Input
            label={t('admin.editUser.fullName')}
            placeholder={t('admin.editUser.fullNamePlaceholder')}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
            leftIcon="person-outline"
            error={errors.name}
          />
          <Input
            label={t('admin.editUser.email')}
            placeholder={t('admin.editUser.emailPlaceholder')}
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
            label={t('admin.editUser.phone')}
            placeholder={t('admin.editUser.phonePlaceholder')}
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
          <Text style={styles.sectionTitle}>{t('admin.editUser.security')}</Text>
          <Input
            label={t('admin.editUser.password')}
            placeholder={t('admin.editUser.passwordPlaceholder')}
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
            <Text style={styles.hint}>{t('admin.editUser.errorPasswordLength')}</Text>
          )}
          {!password && (
            <Text style={styles.hint}>{t('admin.editUser.passwordPlaceholder')}</Text>
          )}
          <Input
            label={t('admin.editUser.confirmPassword')}
            placeholder={t('admin.editUser.confirmPasswordPlaceholder')}
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
          <Text style={styles.sectionTitle}>{t('admin.editUser.roleAndStatus')}</Text>
          {lockRole ? (
            <View style={styles.dropdownWrapper}>
              <Text style={styles.label}>{t('admin.editUser.userRole')} *</Text>
              <View style={[styles.dropdown, styles.dropdownLocked]}>
                <Text style={styles.dropdownText}>
                  {getRoleLabel(forcedRole || role || 'technician')}
                </Text>
              </View>
            </View>
          ) : (
            renderDropdown(
              t('admin.editUser.userRole'),
              role,
              roles,
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
              undefined,
              'admin.editUser.selectRole'
            )
          )}
          {renderDropdown(
            t('admin.editUser.accountStatus'),
            status,
            statuses,
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
            t('admin.editUser.statusHint'),
            'admin.addUser.selectStatus'
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title={t('admin.editUser.cancel')}
            onPress={() => navigation.goBack()}
            variant="outline"
            style={styles.cancelButton}
            icon={<Ionicons name="close" size={20} color={COLORS.primary} style={styles.buttonIcon} />}
          />
          <Button
            title={t('admin.editUser.updateUser')}
            onPress={handleUpdateUser}
            loading={loading}
            style={styles.createButton}
            icon={<Ionicons name="checkmark" size={20} color={COLORS.background} style={styles.buttonIcon} />}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
});

export default EditUserScreen;

