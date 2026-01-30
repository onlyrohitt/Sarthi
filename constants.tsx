
import { TranslationMap } from './types';

export const TRANSLATIONS: TranslationMap = {
  welcome: {
    hindi: 'सारथी में आपका स्वागत है',
    marathi: 'सारथी मध्ये तुमचे स्वागत आहे',
    english: 'Welcome to Sarthi'
  },
  subtitle: {
    hindi: 'सरकारी योजनाओं के लिए आपका मार्गदर्शक',
    marathi: 'सरकारी योजनांसाठी तुमचे मार्गदर्शक',
    english: 'Your Guide to Government Schemes'
  },
  chooseLanguage: {
    hindi: 'अपनी भाषा चुनें',
    marathi: 'तुमची भाषा निवडा',
    english: 'Choose your language'
  },
  letsStart: {
    hindi: 'शुरू करें',
    marathi: 'सुरु करूया',
    english: "Let's Start"
  },
  uploadId: {
    hindi: 'अपना आईडी कार्ड अपलोड करें',
    marathi: 'तुमचे आयडी कार्ड अपलोड करा',
    english: 'Upload Your ID Card'
  },
  continue: {
    hindi: 'आगे बढ़ें',
    marathi: 'पुढे जा',
    english: 'Continue'
  },
  next: {
    hindi: 'अगला',
    marathi: 'पुढील',
    english: 'Next'
  },
  processingId: {
    hindi: 'हम आपके दस्तावेज़ की जाँच कर रहे हैं...',
    marathi: 'आम्ही तुमचे दस्तऐवज तपासत आहोत...',
    english: 'We are verifying your document...'
  }
};

export const MOCK_SCHEMES = [
  {
    id: '1',
    title: 'Pradhan Mantri Awas Yojana',
    titleLocal: 'प्रधानमंत्री आवास योजना',
    description: 'Housing subsidy for economically weaker sections to build or buy a home.',
    benefit: 'Up to ₹2.67 Lakh subsidy',
    matchPercentage: 95,
    department: 'Ministry of Housing',
    nextSteps: ['Visit local municipal office', 'Bring Aadhar and Income proof', 'Fill Form A']
  },
  {
    id: '2',
    title: 'Ayushman Bharat Yojana',
    titleLocal: 'आयुष्मान भारत योजना',
    description: 'Free health insurance of ₹5 Lakh per family for secondary and tertiary care hospitalization.',
    benefit: '₹5 Lakh health coverage per year',
    matchPercentage: 88,
    department: 'Ministry of Health',
    nextSteps: ['Check name in list online', 'Get Golden Card', 'Visit Empaneled Hospital']
  }
];
