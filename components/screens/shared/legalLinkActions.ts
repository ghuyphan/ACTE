import {
  hasAccountDeletionLink,
  hasPrivacyPolicyLink,
  hasSupportLink,
  openAccountDeletionHelp,
  openPrivacyPolicy,
  openSupport,
} from '../../../services/legalLinks';

export interface LegalLinkAvailability {
  showPrivacyPolicyLink: boolean;
  showSupportLink: boolean;
  showAccountDeletionLink: boolean;
}

export interface LegalLinkActions {
  openPrivacyPolicyLink: () => void;
  openSupportLink: () => void;
  openAccountDeletionHelpLink: () => void;
}

export function getLegalLinkAvailability(): LegalLinkAvailability {
  return {
    showPrivacyPolicyLink: hasPrivacyPolicyLink(),
    showSupportLink: hasSupportLink(),
    showAccountDeletionLink: hasAccountDeletionLink(),
  };
}

export function createLegalLinkActions(): LegalLinkActions {
  return {
    openPrivacyPolicyLink: () => {
      void openPrivacyPolicy();
    },
    openSupportLink: () => {
      void openSupport();
    },
    openAccountDeletionHelpLink: () => {
      void openAccountDeletionHelp();
    },
  };
}
