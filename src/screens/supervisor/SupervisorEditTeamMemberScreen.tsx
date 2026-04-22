import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { updateSupervisorTeamMember } from '../../services/supervisorService';

const SupervisorEditTeamMemberScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useTranslation();

  const technicianId = Number(route.params?.technicianId ?? route.params?.technician_id ?? 0);
  const initialMember = route.params?.member;

  const [name, setName] = useState<string>(initialMember?.name ?? '');
  const [email, setEmail] = useState<string>(initialMember?.email ?? '');
  const [phone, setPhone] = useState<string>(initialMember?.phone ?? '');
  const [emails, setEmails] = useState<string[]>(
    Array.isArray(initialMember?.emails) && initialMember.emails.length > 0 ? initialMember.emails : ['']
  );
  const [phones, setPhones] = useState<string[]>(
    Array.isArray(initialMember?.phones) && initialMember.phones.length > 0 ? initialMember.phones : ['']
  );
  const [saving, setSaving] = useState(false);

  const hasValidTechnicianId = useMemo(() => Number.isFinite(technicianId) && technicianId > 0, [technicianId]);

  const updateArrayItem = useCallback(
    (kind: 'emails' | 'phones', index: number, value: string) => {
      if (kind === 'emails') {
        setEmails((prev) => prev.map((v, i) => (i === index ? value : v)));
      } else {
        setPhones((prev) => prev.map((v, i) => (i === index ? value : v)));
      }
    },
    []
  );

  const addArrayItem = useCallback((kind: 'emails' | 'phones') => {
    if (kind === 'emails') setEmails((prev) => [...prev, '']);
    else setPhones((prev) => [...prev, '']);
  }, []);

  const removeArrayItem = useCallback((kind: 'emails' | 'phones', index: number) => {
    if (kind === 'emails') {
      setEmails((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)));
    } else {
      setPhones((prev) => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)));
    }
  }, []);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validate = () => {
    if (!hasValidTechnicianId) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('supervisorDashboard.memberNotFound', { defaultValue: 'Member not found' }));
      return false;
    }
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert(
        t('booking.missingTitle', { defaultValue: 'Missing Information' }),
        t('booking.missingBody', { defaultValue: 'Please fill in all fields' })
      );
      return false;
    }
    if (!isValidEmail(email.trim())) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('technicianSignup.invalidEmail', { defaultValue: 'Please enter a valid email address.' }));
      return false;
    }
    const extraEmails = emails.map((v) => v.trim()).filter(Boolean);
    const invalidExtraEmail = extraEmails.find((v) => !isValidEmail(v));
    if (invalidExtraEmail) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('technicianSignup.invalidEmail', { defaultValue: 'Please enter a valid email address.' }));
      return false;
    }
    return true;
  };

  const onSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const response = await updateSupervisorTeamMember(technicianId, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        emails: emails.map((v) => v.trim()).filter(Boolean),
        phones: phones.map((v) => v.trim()).filter(Boolean),
      });
      if (!response.success) {
        throw new Error(response.message || 'Failed to update team member.');
      }
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        response.message || 'Team member updated successfully.',
        [
          {
            text: t('common.ok', { defaultValue: 'OK' }),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (e: any) {
      const message = e?.response?.data?.message ?? e?.message ?? 'Failed to update team member.';
      Alert.alert(t('common.error', { defaultValue: 'Error' }), message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Team Member</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Input
          label={t('auth.nameLabel', { defaultValue: 'Name' })}
          placeholder={t('auth.namePlaceholder', { defaultValue: 'Enter your full name' })}
          value={name}
          onChangeText={setName}
          leftIcon="person-outline"
        />
        <Input
          label={t('auth.emailLabel', { defaultValue: 'Email' })}
          placeholder={t('auth.emailPlaceholder', { defaultValue: 'Enter your email' })}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon="mail-outline"
        />
        <Input
          label={t('auth.phoneLabel', { defaultValue: 'Phone Number' })}
          placeholder={t('auth.phonePlaceholder', { defaultValue: '+971...' })}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          leftIcon="call-outline"
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Emails</Text>
          {emails.map((value, index) => (
            <View key={`email-${index}`} style={styles.row}>
              <View style={styles.rowInput}>
                <Input
                  placeholder={`Email ${index + 1}`}
                  value={value}
                  onChangeText={(text) => updateArrayItem('emails', index, text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon="mail-outline"
                />
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => removeArrayItem('emails', index)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addMoreBtn} onPress={() => addArrayItem('emails')}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.addMoreText}>Add email</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Phones</Text>
          {phones.map((value, index) => (
            <View key={`phone-${index}`} style={styles.row}>
              <View style={styles.rowInput}>
                <Input
                  placeholder={`Phone ${index + 1}`}
                  value={value}
                  onChangeText={(text) => updateArrayItem('phones', index, text)}
                  keyboardType="phone-pad"
                  leftIcon="call-outline"
                />
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={() => removeArrayItem('phones', index)}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addMoreBtn} onPress={() => addArrayItem('phones')}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.addMoreText}>Add phone</Text>
          </TouchableOpacity>
        </View>

        <Button
          title={saving ? 'Saving...' : 'Save Changes'}
          onPress={onSave}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.sm },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
  },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  section: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rowInput: { flex: 1 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error + '12',
    marginTop: -SPACING.sm,
  },
  addMoreBtn: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  addMoreText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHTS.medium,
  },
  saveBtn: {
    marginTop: SPACING.sm,
  },
});

export default SupervisorEditTeamMemberScreen;
