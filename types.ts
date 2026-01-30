
export type AppLanguage = 'hindi' | 'marathi' | 'english';

export type AppStep = 
  | 'LANGUAGE_SELECTION'
  | 'ID_UPLOAD'
  | 'QUESTIONNAIRE'
  | 'RESULTS'
  | 'PROFILE';

export interface UserProfile {
  name?: string;
  age?: number;
  gender?: string;
  location?: string;
  income?: string;
  occupation?: string;
  category?: string;
  idType?: string;
}

export interface SavedProcess {
  id: string;
  date: string;
  profile: UserProfile;
  schemes: any[];
}

export interface Scheme {
  id: string;
  title: string;
  titleLocal: string;
  description: string;
  benefit: string;
  matchPercentage: number;
  nextSteps: string[];
  department: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TranslationMap {
  [key: string]: {
    hindi: string;
    marathi: string;
    english: string;
  };
}
