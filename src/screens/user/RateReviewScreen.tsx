import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import Header from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { useTranslation } from 'react-i18next';
import { rateClientOrder } from '../../services/orderService';

const MAX_REVIEW_LENGTH = 500;

const RateReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const route = useRoute<any>();
  const { orderId, serviceName, orderNumber } = route.params || {};

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ratingLabels = (t('rateReview.ratingLabels', { returnObjects: true }) as string[]) || [];
  const displayOrderId = orderNumber || orderId || '—';
  const displayServiceName =
    serviceName ||
    t('rateReview.defaultServiceName', { defaultValue: 'Service Order' });

  const handleStarPress = (starIndex: number) => {
    setRating(starIndex + 1);
  };

  const handleSubmitReview = async () => {
    if (!orderId) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('orders.invalidOrder', { defaultValue: 'Invalid order.' })
      );
      return;
    }

    if (rating === 0) {
      Alert.alert(
        t('rateReview.alerts.ratingRequiredTitle'),
        t('rateReview.alerts.ratingRequiredBody')
      );
      return;
    }

    if (reviewText.trim().length < 10) {
      Alert.alert(
        t('rateReview.alerts.reviewRequiredTitle'),
        t('rateReview.alerts.reviewRequiredBody')
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await rateClientOrder({
        orderId,
        rating,
        review: reviewText,
      });

      if (result.success) {
        Alert.alert(
          t('rateReview.alerts.submittedTitle'),
          result.message || t('rateReview.alerts.submittedBody'),
          [
            {
              text: t('rateReview.alerts.continue'),
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          result.message ||
            t('rateReview.alerts.submitFailed', {
              defaultValue: 'Could not submit your review. Please try again.',
            })
        );
      }
    } catch (err: unknown) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err instanceof Error
          ? err.message
          : t('rateReview.alerts.submitFailed', {
              defaultValue: 'Could not submit your review. Please try again.',
            })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = () => (
    <View style={styles.starsContainer}>
      {[0, 1, 2, 3, 4].map((index) => (
        <TouchableOpacity
          key={index}
          style={styles.starButton}
          onPress={() => handleStarPress(index)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={index < rating ? 'star' : 'star-outline'}
            size={36}
            color={index < rating ? COLORS.warning : COLORS.textSecondary}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title={t('rateReview.title')} showBack={true} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.serviceCard}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>{displayServiceName}</Text>
            <Text style={styles.orderId}>
              {t('orders.orderNumber', {
                id: displayOrderId,
                defaultValue: `Order #${displayOrderId}`,
              })}
            </Text>
            <Text style={styles.completedText}>{t('rateReview.serviceCompleted')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rateReview.howWasExperience')}</Text>
          {renderStars()}
          {rating > 0 ? (
            <Text style={styles.ratingLabel}>{ratingLabels[rating - 1]}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rateReview.writeReview')}</Text>
          <Text style={styles.sectionSubtitle}>{t('rateReview.shareExperience')}</Text>

          <View style={styles.reviewInputContainer}>
            <TextInput
              style={styles.reviewInput}
              placeholder={t('rateReview.placeholder')}
              value={reviewText}
              onChangeText={(text) => setReviewText(text.slice(0, MAX_REVIEW_LENGTH))}
              multiline
              numberOfLines={6}
              maxLength={MAX_REVIEW_LENGTH}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.characterCount}>
              {t('rateReview.charCount', {
                current: reviewText.length,
                defaultValue: `${reviewText.length}/${MAX_REVIEW_LENGTH} characters`,
              })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rateReview.guidelinesTitle')}</Text>
          <View style={styles.guidelinesContainer}>
            {(t('rateReview.guidelines', { returnObjects: true }) as string[]).map((g, i) => (
              <View key={i} style={styles.guidelineItem}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                <Text style={styles.guidelineText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <Button
          title={isSubmitting ? t('rateReview.submitting') : t('rateReview.submit')}
          onPress={handleSubmitReview}
          disabled={isSubmitting || rating === 0}
          style={styles.submitButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
  },
  scroll: {
    paddingBottom: SPACING.xl,
  },
  serviceCard: {
    backgroundColor: COLORS.background,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serviceInfo: {
    alignItems: 'center',
  },
  serviceName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  orderId: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  completedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: FONT_WEIGHTS.medium,
  },
  section: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  starButton: {
    padding: SPACING.xs,
  },
  ratingLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.primary,
    textAlign: 'center',
  },
  reviewInputContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reviewInput: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 120,
  },
  characterCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: SPACING.sm,
  },
  guidelinesContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  guidelineText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  bottomActions: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitButton: {
    width: '100%',
  },
});

export default RateReviewScreen;
