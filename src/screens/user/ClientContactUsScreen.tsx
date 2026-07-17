import React from 'react';
import { useTranslation } from 'react-i18next';
import { ContactUsContentScreen } from '../vendor/VendorContactUsScreen';

const ClientContactUsScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <ContactUsContentScreen
      audience="client"
      title={t('profile.contactUs', { defaultValue: 'Contact Us' })}
      subtitle={t('profile.contactSubtitle', {
        defaultValue: 'We are here to help you',
      })}
      showLiveChat={false}
    />
  );
};

export default ClientContactUsScreen;
