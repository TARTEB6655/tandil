import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { useAppStore } from '../../store';
import { hrService } from '../../services/hrService';

const HRManagerSubmitTicketScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAppStore();
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedEmail = email.trim();
    const trimmedDescription = description.trim();
    if (!trimmedSubject) {
      Alert.alert(
        t('common.error', 'Error'),
        t('helpCenter.submitTicket.subjectPlaceholder', 'Please enter a subject.')
      );
      return;
    }
    if (!trimmedEmail) {
      Alert.alert(
        t('common.error', 'Error'),
        t('helpCenter.submitTicket.emailPlaceholder', 'Please enter your email.')
      );
      return;
    }
    if (!trimmedDescription) {
      Alert.alert(
        t('common.error', 'Error'),
        t('helpCenter.submitTicket.messagePlaceholder', 'Please enter your message.')
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await hrService.submitSupportTicket({
        subject: trimmedSubject,
        email: trimmedEmail,
        description: trimmedDescription,
      });
      setSubmitting(false);
      if (result.success) {
        Alert.alert(
          t('helpCenter.submitTicket.successTitle'),
          t('helpCenter.submitTicket.successMessage'),
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          t('common.error', 'Error'),
          result.message || t('helpCenter.submitTicket.errorMessage')
        );
      }
    } catch {
      setSubmitting(false);
      Alert.alert(t('common.error', 'Error'), t('helpCenter.submitTicket.errorMessage'));
    }
  };

  return (
    <View style={styles.container}>
      <Header title={t('helpCenter.submitTicket.title')} showBack={true} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={styles.label}>{t('helpCenter.submitTicket.subject')}</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder={t('helpCenter.submitTicket.subjectPlaceholder')}
              placeholderTextColor={COLORS.textSecondary}
              editable={!submitting}
              maxLength={200}
              keyboardType="default"
              autoCapitalize="sentences"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('helpCenter.submitTicket.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('helpCenter.submitTicket.emailPlaceholder', 'Your email address')}
              placeholderTextColor={COLORS.textSecondary}
              editable={!submitting}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('helpCenter.submitTicket.message')}</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('helpCenter.submitTicket.messagePlaceholder')}
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!submitting}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <Text style={styles.submitButtonText}>{t('helpCenter.submitTicket.submitButton')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  field: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageInput: {
    minHeight: 120,
    paddingTop: SPACING.sm,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    minHeight: 48,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
});

export default HRManagerSubmitTicketScreen;
