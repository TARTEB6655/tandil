import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, FONT_WEIGHTS } from '../../constants';
import { PartnerTierInfo } from '../../types';
import { VendorHeroBanner, VENDOR_SCREEN_BG } from '../../components/vendor/VendorUi';

const { width } = Dimensions.get('window');

const VendorPartnershipScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const [currentTier, setCurrentTier] = useState<PartnerTierInfo | null>(null); // Changed to null for demo
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedTierForApplication, setSelectedTierForApplication] = useState<string>('');
  const [estimatedProducts, setEstimatedProducts] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const partnerTiers: PartnerTierInfo[] = [
    {
      tier: 'Basic',
      requirement: '10-20 free products',
      adminFee: 200,
      duration: '1 month',
      benefits: [
        'Partner logo + 1 product image in Partners section',
        'Mention of the shop when gifts are distributed',
        'Monthly report with number of gifts delivered'
      ],
      color: '#FF6B00'
    },
    {
      tier: 'Silver',
      requirement: '25-50 free products',
      adminFee: 400,
      duration: '2 months',
      benefits: [
        'All Basic benefits',
        'Small banner inside the app',
        'Up to 3 product images in Partners section',
        '1 social media post per month on Tandil\'s official accounts'
      ],
      color: '#C0C0C0'
    },
    {
      tier: 'Gold',
      requirement: '51-100 free products',
      adminFee: 700,
      duration: '3 months',
      benefits: [
        'All Silver benefits',
        'Medium banner on the home page of the app',
        'Short video (Reel/Story) about partner products',
        'Special discount code for Tandil customers'
      ],
      color: '#FFD700'
    },
    {
      tier: 'Platinum',
      requirement: '101-200 free products',
      adminFee: 1200,
      duration: '6 months',
      benefits: [
        'All Gold benefits',
        'Full banner on the app\'s home page',
        'Special social media campaign dedicated to the partner',
        'Products listed under "Exclusive Offers" section',
        'Partner logo featured in app notifications'
      ],
      color: '#E5E4E2'
    },
    {
      tier: 'Diamond',
      requirement: '200+ free products',
      adminFee: 2000,
      duration: '12 months (1 year)',
      benefits: [
        'All Platinum benefits',
        'Permanent "Featured Partner" status inside the app',
        'Dedicated partner page showcasing products',
        'Joint marketing content (photos/videos) with Tandil',
        'Priority access for any future events, offers, or promotions'
      ],
      color: '#B9F2FF'
    }
  ];

  const paymentMethods = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: 'card-outline'
    },
    {
      id: 'bank',
      name: 'Bank Transfer',
      icon: 'business-outline'
    },
    {
      id: 'wallet',
      name: 'Digital Wallet',
      icon: 'wallet-outline'
    }
  ];

  const partnershipStats = {
    totalProducts: 45,
    productsDelivered: 23,
    remainingProducts: 22,
    daysRemaining: 45,
    nextPaymentDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    totalRevenue: 0, // Free products
    marketingExposure: 'High',
    socialMediaPosts: 1,
    appBanners: 2,
  };

  const handleUpgradeTier = (tier: PartnerTierInfo) => {
    if (tier.tier === currentTier?.tier) {
      Alert.alert('Current Tier', `You are already on the ${tier.tier} tier.`);
      return;
    }

    Alert.alert(
      'Upgrade Partnership',
      `Upgrade to ${tier.tier} tier?\n\nRequirement: ${tier.requirement}\nFee: AED ${tier.adminFee}/${tier.duration}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => {
          Alert.alert('Success', `Partnership upgraded to ${tier.tier} tier!`);
          setCurrentTier(tier);
        }},
      ]
    );
  };

  const handleRenewPartnership = () => {
    Alert.alert(
      'Renew Partnership',
      `Renew your ${currentTier?.tier} partnership?\n\nFee: AED ${currentTier?.adminFee}/${currentTier?.duration}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Renew', onPress: () => {
          Alert.alert('Success', 'Partnership renewed successfully!');
        }},
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Our partnership team will contact you within 24 hours.',
      [{ text: 'OK' }]
    );
  };

  const handleApplyPartnership = () => {
    setShowApplicationForm(true);
  };

  const handleSubmitApplication = async () => {
    if (!canSubmitApplicationWithPayment) {
      Alert.alert('Error', 'Please fill in all required fields and select a payment method.');
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate payment success
      Alert.alert(
        'Payment Successful!',
        `Your ${selectedTierForApplication} partnership application has been submitted and payment processed successfully. Our team will review your application and contact you within 24-48 hours.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowApplicationForm(false);
              setSelectedTierForApplication('');
              setEstimatedProducts('');
              setBusinessDescription('');
              setContactPhone('');
              setSelectedPaymentMethod('');
              setCardNumber('');
              setCardExpiry('');
              setCardCvv('');
              setIsProcessingPayment(false);
              
              // Simulate approval after 2 seconds
              setTimeout(() => {
                const selectedTier = partnerTiers.find(t => t.tier === selectedTierForApplication);
                if (selectedTier) {
                  setCurrentTier(selectedTier);
                  Alert.alert(
                    'Partnership Approved!',
                    `Congratulations! Your ${selectedTier.tier} partnership has been approved. You can now start uploading products and enjoy your partnership benefits.`,
                    [{ text: 'Great!' }]
                  );
                }
              }, 2000);
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Payment Failed', 'There was an issue processing your payment. Please try again.');
      setIsProcessingPayment(false);
    }
  };

  const canSubmitApplication = selectedTierForApplication && estimatedProducts && businessDescription && contactPhone;
  const canSubmitApplicationWithPayment = canSubmitApplication && selectedPaymentMethod && 
    (selectedPaymentMethod !== 'card' || (cardNumber && cardExpiry && cardCvv));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <VendorHeroBanner
          badge={t('vendorTabs.partnership')}
          title={t('vendorTabs.partnership')}
          subtitle={t('vendorDashboard.partnershipHint')}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Partnership</Text>
          
          {currentTier && (
            <View style={styles.currentTierCard}>
              <View style={styles.tierHeader}>
                <View style={[styles.tierBadge, { backgroundColor: currentTier.color + '20' }]}>
                  <Text style={[styles.tierName, { color: currentTier.color }]}>
                    {currentTier.tier}
                  </Text>
                </View>
                <View style={styles.tierStatus}>
                  <Text style={styles.statusText}>Active</Text>
                  <View style={styles.statusDot} />
                </View>
              </View>
              
              <View style={styles.tierDetails}>
                <View style={styles.tierRow}>
                  <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.tierLabel}>Requirement:</Text>
                  <Text style={styles.tierValue}>{currentTier.requirement}</Text>
                </View>
                
                <View style={styles.tierRow}>
                  <Ionicons name="card-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.tierLabel}>Admin Fee:</Text>
                  <Text style={styles.tierValue}>AED {currentTier.adminFee}/{currentTier.duration}</Text>
                </View>
                
                <View style={styles.tierRow}>
                  <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.tierLabel}>Duration:</Text>
                  <Text style={styles.tierValue}>{currentTier.duration}</Text>
                </View>
              </View>

              <View style={styles.tierBenefits}>
                <Text style={styles.benefitsTitle}>Your Benefits:</Text>
                {currentTier.benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Partnership Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partnership Statistics</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="cube-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.statNumber}>{partnershipStats.totalProducts}</Text>
              <Text style={styles.statLabel}>Total Products</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="checkmark-done-circle-outline" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.statNumber}>{partnershipStats.productsDelivered}</Text>
              <Text style={styles.statLabel}>Delivered</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="time-outline" size={24} color={COLORS.warning} />
              </View>
              <Text style={styles.statNumber}>{partnershipStats.remainingProducts}</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <Ionicons name="calendar-outline" size={24} color={COLORS.info} />
              </View>
              <Text style={styles.statNumber}>{partnershipStats.daysRemaining}</Text>
              <Text style={styles.statLabel}>Days Left</Text>
            </View>
          </View>

          <View style={styles.additionalStats}>
            <View style={styles.additionalStat}>
              <Text style={styles.additionalStatLabel}>Next Payment:</Text>
              <Text style={styles.additionalStatValue}>
                {partnershipStats.nextPaymentDate.toLocaleDateString()}
              </Text>
            </View>
            
            <View style={styles.additionalStat}>
              <Text style={styles.additionalStatLabel}>Marketing Exposure:</Text>
              <Text style={styles.additionalStatValue}>{partnershipStats.marketingExposure}</Text>
            </View>
            
            <View style={styles.additionalStat}>
              <Text style={styles.additionalStatLabel}>Social Media Posts:</Text>
              <Text style={styles.additionalStatValue}>{partnershipStats.socialMediaPosts}/month</Text>
            </View>
            
            <View style={styles.additionalStat}>
              <Text style={styles.additionalStatLabel}>App Banners:</Text>
              <Text style={styles.additionalStatValue}>{partnershipStats.appBanners} active</Text>
            </View>
          </View>
        </View>

        {/* Available Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Partnership Tiers</Text>
          <Text style={styles.sectionDescription}>
            Choose your partnership level and unlock exclusive benefits
          </Text>
          
          {partnerTiers.map((tier, index) => (
            <View key={index} style={styles.tierCard}>
              <View style={styles.tierCardHeader}>
                <View style={[styles.tierCardBadge, { backgroundColor: tier.color + '20' }]}>
                  <Text style={[styles.tierCardName, { color: tier.color }]}>{tier.tier}</Text>
                </View>
                <View style={styles.tierCardPricing}>
                  <Text style={styles.tierCardFee}>AED {tier.adminFee}</Text>
                  <Text style={styles.tierCardDuration}>/{tier.duration}</Text>
                </View>
              </View>
              
              <View style={styles.tierCardDetails}>
                <Text style={styles.tierCardRequirement}>Requirement: {tier.requirement}</Text>
                <Text style={styles.tierCardBenefitsTitle}>Benefits:</Text>
                {tier.benefits.map((benefit, benefitIndex) => (
                  <View key={benefitIndex} style={styles.tierCardBenefitItem}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                    <Text style={styles.tierCardBenefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.tierCardActions}>
                {tier.tier === currentTier?.tier ? (
                  <View style={styles.currentTierButton}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                    <Text style={styles.currentTierButtonText}>Current Tier</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => handleUpgradeTier(tier)}
                  >
                    <Ionicons name="arrow-up-circle" size={20} color={COLORS.background} />
                    <Text style={styles.upgradeButtonText}>Upgrade to {tier.tier}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* New Partnership Application */}
        {!currentTier && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Start Your Partnership</Text>
            <Text style={styles.sectionDescription}>
              Don't have a partnership yet? Apply now to get started with Tandil!
            </Text>
            
            <View style={styles.newPartnershipCard}>
              <View style={styles.newPartnershipHeader}>
                <Ionicons name="rocket-outline" size={48} color={COLORS.primary} />
                <Text style={styles.newPartnershipTitle}>Ready to Partner?</Text>
                <Text style={styles.newPartnershipSubtitle}>
                  Join our network of successful vendors and grow your business
                </Text>
              </View>
              
              <View style={styles.partnershipSteps}>
                <Text style={styles.stepsTitle}>How it works:</Text>
                <View style={styles.stepItem}>
                  <View style={styles.stepBullet}>
                    <Text style={styles.stepBulletText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>Select your preferred partnership tier</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBullet}>
                    <Text style={styles.stepBulletText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>Provide free products as per tier requirements</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBullet}>
                    <Text style={styles.stepBulletText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>Pay monthly administrative fee</Text>
                </View>
                <View style={styles.stepItem}>
                  <View style={styles.stepBullet}>
                    <Text style={styles.stepBulletText}>4</Text>
                  </View>
                  <Text style={styles.stepText}>Get marketing exposure and grow your business</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.applyPartnershipButton}
                onPress={() => handleApplyPartnership()}
              >
                <Ionicons name="business-outline" size={24} color={COLORS.background} />
                <Text style={styles.applyPartnershipButtonText}>Apply for Partnership</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Partnership Application Form */}
        {showApplicationForm && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Partnership Application</Text>
            <Text style={styles.sectionDescription}>
              Fill out the form below to apply for your chosen partnership tier
            </Text>
            
            <View style={styles.applicationForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Selected Tier *</Text>
                <View style={styles.tierSelector}>
                  {partnerTiers.map((tier, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.tierOption,
                        selectedTierForApplication === tier.tier && styles.tierOptionSelected
                      ]}
                      onPress={() => setSelectedTierForApplication(tier.tier)}
                    >
                      <Text style={[
                        styles.tierOptionText,
                        selectedTierForApplication === tier.tier && styles.tierOptionTextSelected
                      ]}>
                        {tier.tier}
                      </Text>
                      <Text style={[
                        styles.tierOptionPrice,
                        selectedTierForApplication === tier.tier && styles.tierOptionPriceSelected
                      ]}>
                        AED {tier.adminFee}/{tier.duration}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Estimated Products to Provide *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter number of products"
                  keyboardType="numeric"
                  value={estimatedProducts}
                  onChangeText={setEstimatedProducts}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Business Description *</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Describe your business and products..."
                  multiline
                  numberOfLines={4}
                  value={businessDescription}
                  onChangeText={setBusinessDescription}
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Contact Phone *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                />
              </View>

              {/* Payment Method Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Method *</Text>
                <View style={styles.paymentMethods}>
                  {paymentMethods.map((method, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.paymentMethodOption,
                        selectedPaymentMethod === method.id && styles.paymentMethodOptionSelected
                      ]}
                      onPress={() => setSelectedPaymentMethod(method.id)}
                    >
                      <Ionicons 
                        name={method.icon as any} 
                        size={24} 
                        color={selectedPaymentMethod === method.id ? COLORS.background : COLORS.primary} 
                      />
                      <Text style={[
                        styles.paymentMethodText,
                        selectedPaymentMethod === method.id && styles.paymentMethodTextSelected
                      ]}>
                        {method.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Details */}
              {selectedPaymentMethod === 'card' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Card Details</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Card Number"
                    keyboardType="numeric"
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    maxLength={16}
                  />
                  <View style={styles.cardRow}>
                    <TextInput
                      style={[styles.formInput, styles.cardInput]}
                      placeholder="MM/YY"
                      keyboardType="numeric"
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                      maxLength={5}
                    />
                    <TextInput
                      style={[styles.formInput, styles.cardInput]}
                      placeholder="CVV"
                      keyboardType="numeric"
                      value={cardCvv}
                      onChangeText={setCardCvv}
                      maxLength={3}
                      secureTextEntry
                    />
                  </View>
                </View>
              )}

              {selectedPaymentMethod === 'bank' && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Bank Transfer Details</Text>
                  <View style={styles.bankDetails}>
                    <Text style={styles.bankDetailText}>
                      <Text style={styles.bankDetailLabel}>Bank:</Text> Emirates NBD
                    </Text>
                    <Text style={styles.bankDetailText}>
                      <Text style={styles.bankDetailLabel}>Account:</Text> 1234567890
                    </Text>
                    <Text style={styles.bankDetailText}>
                      <Text style={styles.bankDetailLabel}>IBAN:</Text> AE123456789012345678901
                    </Text>
                    <Text style={styles.bankDetailText}>
                      <Text style={styles.bankDetailLabel}>Reference:</Text> {selectedTierForApplication} Partnership
                    </Text>
                  </View>
                </View>
              )}

              {/* Payment Summary */}
              {selectedTierForApplication && (
                <View style={styles.paymentSummary}>
                  <Text style={styles.paymentSummaryTitle}>Payment Summary</Text>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Partnership Tier:</Text>
                    <Text style={styles.paymentSummaryValue}>{selectedTierForApplication}</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Administrative Fee:</Text>
                    <Text style={styles.paymentSummaryValue}>
                      AED {partnerTiers.find(t => t.tier === selectedTierForApplication)?.adminFee}
                    </Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={styles.paymentSummaryLabel}>Duration:</Text>
                    <Text style={styles.paymentSummaryValue}>
                      {partnerTiers.find(t => t.tier === selectedTierForApplication)?.duration}
                    </Text>
                  </View>
                  <View style={[styles.paymentSummaryRow, styles.paymentSummaryTotal]}>
                    <Text style={styles.paymentSummaryTotalLabel}>Total Amount:</Text>
                    <Text style={styles.paymentSummaryTotalValue}>
                      AED {partnerTiers.find(t => t.tier === selectedTierForApplication)?.adminFee}
                    </Text>
                  </View>
                </View>
              )}
              
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowApplicationForm(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.submitApplicationButton,
                    !canSubmitApplicationWithPayment && styles.submitApplicationButtonDisabled
                  ]}
                  onPress={handleSubmitApplication}
                  disabled={!canSubmitApplicationWithPayment}
                >
                  <Text style={styles.submitApplicationButtonText}>
                    {isProcessingPayment ? 'Processing Payment...' : 'Submit & Pay'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Partnership Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partnership Actions</Text>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleRenewPartnership}>
              <Ionicons name="refresh-circle" size={24} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>Renew Partnership</Text>
              <Text style={styles.actionButtonSubtext}>Extend your current tier</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleContactSupport}>
              <Ionicons name="headset-outline" size={24} color={COLORS.info} />
              <Text style={styles.actionButtonText}>Contact Support</Text>
              <Text style={styles.actionButtonSubtext}>Get help with partnership</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Partnership Works</Text>
          
          <View style={styles.howItWorks}>
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepTitle}>Choose Your Tier</Text>
              <Text style={styles.stepDescription}>
                Select a partnership level based on the number of products you can provide
              </Text>
            </View>
            
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Provide Free Products</Text>
              <Text style={styles.stepDescription}>
                Supply the required number of free products following our quality guidelines
              </Text>
            </View>
            
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepTitle}>Pay Administrative Fee</Text>
              <Text style={styles.stepDescription}>
                Pay the monthly fee based on your chosen partnership tier
              </Text>
            </View>
            
            <View style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepTitle}>Get Marketing Exposure</Text>
              <Text style={styles.stepDescription}>
                Receive in-app banners, social media promotion, and customer exposure
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VENDOR_SCREEN_BG,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  sectionDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  currentTierCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tierBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  tierName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
  },
  tierStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.success,
    marginRight: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  tierDetails: {
    marginBottom: SPACING.md,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  tierLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    marginRight: SPACING.sm,
    minWidth: 80,
  },
  tierValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  tierBenefits: {
    gap: SPACING.sm,
  },
  benefitsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  benefitText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: (width - SPACING.lg * 3) / 2,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statNumber: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  additionalStats: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  additionalStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  additionalStatLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  additionalStatValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  tierCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tierCardBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.round,
  },
  tierCardName: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  tierCardPricing: {
    alignItems: 'flex-end',
  },
  tierCardFee: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
  tierCardDuration: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  tierCardDetails: {
    marginBottom: SPACING.md,
  },
  tierCardRequirement: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  tierCardBenefitsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  tierCardBenefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  tierCardBenefitText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  tierCardActions: {
    alignItems: 'center',
  },
  currentTierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  currentTierButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.success,
    marginLeft: SPACING.xs,
  },
  upgradeButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  upgradeButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    marginLeft: SPACING.xs,
  },
  actionButtons: {
    gap: SPACING.md,
  },
  actionButton: {
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  actionButtonSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  howItWorks: {
    gap: SPACING.md,
  },
  stepCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  stepNumberText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
  },
  stepTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // New Partnership Application Styles
  newPartnershipCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  newPartnershipHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  newPartnershipTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  newPartnershipSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  partnershipSteps: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  stepsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stepBullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  stepBulletText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.bold,
  },
  stepText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  applyPartnershipButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  applyPartnershipButtonText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    marginLeft: SPACING.sm,
  },
  // Application Form Styles
  applicationForm: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  tierSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tierOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    minWidth: 80,
  },
  tierOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tierOptionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  tierOptionTextSelected: {
    color: COLORS.background,
  },
  tierOptionPrice: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  tierOptionPriceSelected: {
    color: COLORS.background + '80',
  },
  formInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.textSecondary,
  },
  submitApplicationButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitApplicationButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  submitApplicationButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.background,
  },
  // Payment Method Styles
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  paymentMethodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    minWidth: 120,
    gap: SPACING.xs,
  },
  paymentMethodOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  paymentMethodText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  paymentMethodTextSelected: {
    color: COLORS.background,
  },
  cardRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cardInput: {
    flex: 1,
  },
  bankDetails: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bankDetailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    lineHeight: 20,
  },
  bankDetailLabel: {
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  paymentSummary: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
  },
  paymentSummaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '30',
  },
  paymentSummaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  paymentSummaryValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: FONT_WEIGHTS.medium,
    color: COLORS.text,
  },
  paymentSummaryTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
  },
  paymentSummaryTotalLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.semiBold,
    color: COLORS.text,
  },
  paymentSummaryTotalValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: FONT_WEIGHTS.bold,
    color: COLORS.primary,
  },
});

export default VendorPartnershipScreen;
