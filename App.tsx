
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Mic, 
  Camera, 
  Image as ImageIcon, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  UserCheck, 
  Sparkles,
  Volume2,
  CheckCircle2,
  Loader2,
  X,
  Send,
  MapPin,
  RotateCcw,
  FileText,
  Search,
  Zap,
  Calendar,
  Link,
  AlertCircle,
  User,
  Trash2,
  History,
  PlusCircle,
  Save,
  ChevronRight,
  Eye,
  MessageCircle
} from 'lucide-react';
import { AppLanguage, AppStep, UserProfile, ChatMessage, SavedProcess } from './types';
import { TRANSLATIONS, MOCK_SCHEMES } from './constants';
import * as gemini from './services/geminiService';
import { GroundedScheme } from './services/geminiService';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('LANGUAGE_SELECTION');
  const [language, setLanguage] = useState<AppLanguage>('hindi');
  const [profile, setProfile] = useState<UserProfile>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [matchedSchemes, setMatchedSchemes] = useState<GroundedScheme[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [capturedText, setCapturedText] = useState<string | null>(null);
  const [idConfirmMode, setIdConfirmMode] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedProcess[]>([]);
  const [detectionLabels, setDetectionLabels] = useState<string[]>([]);

  const [activeChatScheme, setActiveChatScheme] = useState<GroundedScheme | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatGrounding, setChatGrounding] = useState<{ title: string; uri: string }[]>([]);
  const chatInstance = useRef<any>(null);

  const loadingMessages = [
    { hindi: 'विजन स्कैनिंग...', marathi: 'व्हिजन स्कॅनिंग...', english: 'Vision Scanning...' },
    { hindi: 'डेटा एक्सट्रैक्शन...', marathi: 'डेटा एक्स्ट्रॅक्शन...', english: 'Extracting Text...' },
    { hindi: 'डायलॉग इंजन सक्रिय...', marathi: 'संवाद इंजिन सक्रिय...', english: 'Initializing Dialog Engine...' },
    { hindi: 'सत्यापन...', marathi: 'पडताळणी...', english: 'Verifying...' }
  ];

  const questionnaire = [
    {
      field: 'income',
      title: { 
        hindi: 'आपकी मासिक पारिवारिक आय क्या है?', 
        marathi: 'तुमचे मासिक कौटुंबिक उत्पन्न काय आहे?', 
        english: 'What is your monthly family income?' 
      },
      options: ['Below ₹10,000', '₹10,000 - ₹25,000', '₹25,000 - ₹50,000', 'Above ₹50,000']
    },
    {
      field: 'occupation',
      title: { 
        hindi: 'आपका व्यवसाय क्या है?', 
        marathi: 'तुमचा व्यवसाय काय है?', 
        english: 'What is your occupation?' 
      },
      options: ['Farmer', 'Daily Wage Worker', 'Self-employed', 'Other']
    },
    {
      field: 'category',
      title: { 
        hindi: 'आपकी श्रेणी क्या है?', 
        marathi: 'तुमची प्रवर्ग काय आहे?', 
        english: 'What is your category?' 
      },
      options: ['General', 'OBC', 'SC', 'ST']
    }
  ];

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('sarthi_local_history');
    if (savedHistory) {
      const parsedHistory = JSON.parse(savedHistory);
      setHistory(parsedHistory);
      if (parsedHistory.length > 0) setStep('PROFILE');
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleMatchSchemes = useCallback(async (finalProfile: UserProfile) => {
    setStep('RESULTS');
    setIsProcessing(true);
    try {
      const schemes = await gemini.matchSchemes(finalProfile, language);
      setMatchedSchemes(schemes);
    } catch (err) {
      console.error("Match error", err);
    } finally {
      setIsProcessing(false);
    }
  }, [language]);

  const saveToProfile = () => {
    const newRecord: SavedProcess = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      profile: { ...profile },
      schemes: [...matchedSchemes]
    };
    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('sarthi_local_history', JSON.stringify(updatedHistory));
    setStep('PROFILE');
  };

  const clearProfile = () => {
    if (confirm("Clear your profile data from this device?")) {
      localStorage.removeItem('sarthi_local_history');
      setHistory([]);
      setProfile({});
      setStep('LANGUAGE_SELECTION');
    }
  };

  const openChat = useCallback((scheme: GroundedScheme) => {
    gemini.stopAllSpeech();
    setActiveChatScheme(scheme);
    setChatMessages([
      { 
        role: 'assistant', 
        content: language === 'marathi' 
          ? `नमस्ते! मी तुमचा सार्थी आहे. ${scheme.titleLocal} बद्दल तुम्हाला काय माहिती हवी आहे?` 
          : language === 'hindi' 
          ? `नमस्ते! मैं आपका सारथी हूँ। ${scheme.titleLocal} के बारे में आप क्या जानना चाहते हैं?` 
          : `Hello! I am your Sarthi Agent. What would you like to know about ${scheme.title}?` 
      }
    ]);
    chatInstance.current = gemini.createSchemeChat(scheme, profile, language);
  }, [profile, language]);

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || !chatInstance.current || isProcessing) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsProcessing(true);
    setChatGrounding([]); 

    try {
      const response = await chatInstance.current.sendMessage({ message: userMsg });
      const assistantMsg = response.text || '';
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks.filter((chunk: any) => chunk.web).map((chunk: any) => ({ title: chunk.web.title, uri: chunk.web.uri }));
      setChatGrounding(sources);
      setChatMessages(prev => [...prev, { role: 'assistant', content: assistantMsg }]);
      const audio = await gemini.speakText(assistantMsg, language);
      if (audio) gemini.playBase64Audio(audio);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Error communicating with AI." }]);
    } finally { setIsProcessing(false); }
  }, [chatInput, language, isProcessing]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setUploadError(null);
    setDetectionLabels([]);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const data = await gemini.extractDataFromId(base64, file.type);
        if (!data.isValid) {
          setUploadError(language === 'marathi' ? "अवैध दस्तऐवज. कृपया पुन्हा प्रयत्न करा." : "Invalid document. Please try again.");
          setIsProcessing(false);
          return;
        }
        setDetectionLabels(data.detectionLabels || []);
        setProfile(prev => ({ ...prev, ...data }));
        setIdConfirmMode(true);
        setIsProcessing(false); 
        const summaryText = await gemini.generateProfileSummary(data, language);
        const audio = await gemini.speakText(summaryText, language);
        if (audio) gemini.playBase64Audio(audio);
      } catch (err) {
        setIsProcessing(false);
        setUploadError("Vision System Error.");
      }
    };
    reader.readAsDataURL(file);
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    gemini.stopAllSpeech();
    try { recognitionRef.current.stop(); } catch (e) {}
    recognitionRef.current.lang = language === 'hindi' ? 'hi-IN' : language === 'marathi' ? 'mr-IN' : 'en-US';
    recognitionRef.current.start();
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onstart = () => { gemini.stopAllSpeech(); setIsListening(true); setCapturedText(null); };
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results).map((result: any) => result[0]).map((result) => result.transcript).join('');
        setCapturedText(transcript);
        if (event.results[0].isFinal) { 
          const lowerText = transcript.toLowerCase();
          if (idConfirmMode && step === 'ID_UPLOAD') {
            const pos = ['yes', 'correct', 'हां', 'हो', 'सही', 'बरोबर', 'ha'];
            const neg = ['no', 'wrong', 'नहीं', 'नाही', 'galat', 'na'];
            if (pos.some(w => lowerText.includes(w))) { setIdConfirmMode(false); setStep('QUESTIONNAIRE'); }
            else if (neg.some(w => lowerText.includes(w))) { setIdConfirmMode(false); setProfile({}); }
          } else if (step === 'QUESTIONNAIRE') {
            const currentQ = questionnaire[questionIndex];
            const updatedProfile = { ...profile, [currentQ.field]: transcript };
            setProfile(updatedProfile);
            if (questionIndex < questionnaire.length - 1) {
              setQuestionIndex(prev => prev + 1);
            } else {
              handleMatchSchemes(updatedProfile);
            }
          } else if (activeChatScheme) {
            setChatInput(transcript);
          }
          setIsListening(false); 
        }
      };
      recognitionRef.current = recognition;
    }
  }, [step, idConfirmMode, questionIndex, activeChatScheme, profile, language, handleMatchSchemes]);

  const TranscriptionFeedback = ({ text }: { text: string | null }) => (
    <div className={`mt-4 px-6 py-2 rounded-full border bg-orange-50 border-orange-200 inline-flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${!text ? 'invisible' : 'visible'}`}>
      <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Heard:</span>
      <span className="text-sm font-bold text-orange-700 italic">"{text}"</span>
    </div>
  );

  const renderProgressHeader = (current: number) => (
    <div className="w-full bg-white p-4 sticky top-0 z-50 shadow-sm border-b">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <button onClick={() => {
          if (step === 'QUESTIONNAIRE' && questionIndex > 0) setQuestionIndex(q => q - 1);
          else if (step === 'QUESTIONNAIRE') setStep('ID_UPLOAD');
          else if (step === 'ID_UPLOAD') setStep('PROFILE');
          else if (step === 'RESULTS') setStep('QUESTIONNAIRE');
          else setStep('PROFILE');
        }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex items-center gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < current ? 'bg-orange-500 text-white' : 
              i === current ? 'bg-orange-500 text-white ring-4 ring-orange-100' : 'bg-gray-100 text-gray-400'
            }`}>
              {i < current ? <CheckCircle2 className="w-5 h-5" /> : i}
            </div>
          ))}
        </div>
        <button onClick={() => setStep('PROFILE')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <User className="w-6 h-6 text-orange-500" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased selection:bg-orange-100">
      {step === 'LANGUAGE_SELECTION' && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white p-8 space-y-12">
           <div className="text-center space-y-6">
              <div className="bg-orange-50 w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto shadow-inner"><Sparkles className="w-12 h-12 text-orange-500" /></div>
              <h1 className="text-7xl font-black tracking-tighter text-gray-900">सारथी</h1>
              <p className="text-orange-500 font-bold text-xl">Your Scheme to Citizen Bridge</p>
           </div>
           <div className="w-full max-w-sm space-y-4">
              {['hindi', 'marathi', 'english'].map(l => (
                <button key={l} onClick={() => { setLanguage(l as any); setStep('ID_UPLOAD'); }} className="w-full p-8 bg-gray-50 rounded-[32px] font-black text-2xl hover:bg-orange-500 hover:text-white transition-all border-2 border-transparent hover:border-orange-200 uppercase tracking-widest flex items-center justify-between group shadow-sm">
                  {l === 'hindi' ? 'हिंदी' : l === 'marathi' ? 'मराठी' : 'English'}
                  <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-white transition-colors" />
                </button>
              ))}
           </div>
        </div>
      )}

      {step === 'PROFILE' && (
        <div className="min-h-screen bg-[#fafafa] flex flex-col">
          <header className="bg-white p-6 shadow-sm flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-100"><User className="w-6 h-6" /></div>
              <div><h2 className="font-black text-gray-900">Local Profile</h2><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Device-Only Storage</p></div>
            </div>
            <button onClick={clearProfile} className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
          </header>
          <main className="p-6 space-y-8 max-w-2xl mx-auto w-full pb-32">
            <div className="bg-orange-500 rounded-[48px] p-10 text-white space-y-6 shadow-2xl shadow-orange-100 relative overflow-hidden">
               <Zap className="absolute -right-8 -top-8 w-48 h-48 opacity-10" />
               <h3 className="text-4xl font-black leading-tight">Find Your Government Benefits</h3>
               <button onClick={() => setStep('ID_UPLOAD')} className="bg-white text-orange-500 px-8 py-5 rounded-[28px] font-black flex items-center gap-3 shadow-xl active:scale-95 transition-all"><PlusCircle className="w-6 h-6" /> New Verification</button>
            </div>
            <div className="space-y-4">
               <div className="flex items-center justify-between"><h3 className="font-black text-gray-900 flex items-center gap-2"><History className="w-5 h-5 text-orange-500" /> Saved Records</h3><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{history.length} ITEMS</span></div>
               {history.length === 0 ? (
                 <div className="bg-white p-12 rounded-[48px] border-2 border-dashed border-gray-100 text-center space-y-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto"><FileText className="w-8 h-8 text-gray-200" /></div>
                    <p className="text-gray-400 font-bold">No saved data found on this device.</p>
                 </div>
               ) : (
                 history.map(item => (
                   <div key={item.id} className="bg-white p-8 rounded-[40px] border shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                      <div className="space-y-1">
                        <h4 className="font-black text-xl text-gray-900">{item.profile.name}</h4>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3" /> {item.date} • {item.profile.idType}</p>
                      </div>
                      <button onClick={() => { setProfile(item.profile); setMatchedSchemes(item.schemes); setStep('RESULTS'); }} className="p-5 bg-gray-50 text-gray-400 rounded-3xl group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm"><ChevronRight className="w-6 h-6" /></button>
                   </div>
                 ))
               )}
            </div>
          </main>
        </div>
      )}

      {step === 'ID_UPLOAD' && (
        <div className="min-h-screen flex flex-col bg-white">
          {renderProgressHeader(1)}
          <main className="flex-1 p-8 text-center space-y-10 flex flex-col items-center justify-center">
            {isProcessing ? (
              <div className="space-y-10 animate-pulse w-full max-w-sm">
                <div className="w-48 h-48 bg-orange-50 rounded-full flex items-center justify-center mx-auto border-8 border-white shadow-2xl"><Eye className="w-20 h-20 text-orange-500 animate-bounce" /></div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-gray-900">{loadingMessages[loadingMessageIndex][language]}</h2>
                  <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">AI processing active</p>
                </div>
              </div>
            ) : idConfirmMode ? (
              <div className="space-y-8 animate-in zoom-in duration-500 w-full max-w-lg">
                 <div className="bg-orange-50/50 p-10 rounded-[56px] border-4 border-dashed border-orange-200 space-y-8 relative overflow-hidden">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {detectionLabels.map(l => <span key={l} className="px-4 py-2 bg-white text-[10px] font-black text-orange-600 rounded-full border shadow-sm uppercase tracking-widest">{l}</span>)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Extracted Name</p>
                      <p className="text-4xl font-black text-gray-900 tracking-tight">{profile.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white p-5 rounded-[28px] shadow-sm border border-orange-100 flex flex-col items-center justify-center gap-1">
                          <MapPin className="w-5 h-5 text-orange-400" />
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Location</p>
                          <p className="text-xs font-black text-gray-700 truncate w-full text-center">{profile.location || 'N/A'}</p>
                       </div>
                       <div className="bg-white p-5 rounded-[28px] shadow-sm border border-orange-100 flex flex-col items-center justify-center gap-1">
                          <UserCheck className="w-5 h-5 text-orange-400" />
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Doc Type</p>
                          <p className="text-xs font-black text-gray-700">{profile.idType}</p>
                       </div>
                    </div>
                    <div className="bg-white/80 py-4 px-6 rounded-3xl border border-orange-100 font-bold text-gray-600 text-sm">
                       {language === 'marathi' ? "हे बरोबर आहे का? 'हो' किंवा 'नाही' बोला." : language === 'hindi' ? "क्या यह सही है? 'हाँ' या 'नहीं' बोलें।" : "Is this correct? Say 'Yes' or 'No'."}
                    </div>
                 </div>
                 <div className="flex flex-col items-center gap-4">
                    <button onClick={startListening} className={`w-32 h-32 rounded-full flex items-center justify-center shadow-2xl transition-all border-8 border-white ${isListening ? 'bg-red-500 scale-110' : 'bg-orange-500'}`}><Mic className="w-12 h-12 text-white" /></button>
                    <TranscriptionFeedback text={capturedText} />
                 </div>
              </div>
            ) : (
              <div className="space-y-12 py-10 w-full max-w-2xl">
                <div className="space-y-4">
                  <h2 className="text-5xl font-black tracking-tight text-gray-900">Vision ID Scanner</h2>
                  <p className="text-gray-500 font-medium text-lg">Upload Aadhar, PAN, or Ration Card to automatically fill your details.</p>
                </div>
                {uploadError && <div className="p-6 bg-red-50 text-red-700 rounded-[32px] font-bold flex items-center justify-center gap-3 animate-bounce"><AlertCircle className="w-6 h-6" /> {uploadError}</div>}
                
                <label className="block border-4 border-dashed border-gray-100 bg-gray-50 rounded-[64px] p-24 cursor-pointer hover:border-orange-300 transition-all group relative overflow-hidden">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <div className="bg-white w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:scale-110 transition-transform"><ImageIcon className="w-12 h-12 text-orange-500" /></div>
                  <span className="font-black text-gray-700 text-2xl block">Drop Card Here</span>
                  <span className="text-xs text-gray-400 font-black uppercase tracking-[0.2em] mt-2 block">Aadhar • PAN • Ration</span>
                </label>
                
                <div className="grid grid-cols-2 gap-6 w-full">
                   <label className="flex items-center justify-center gap-3 bg-white border-2 border-gray-100 text-gray-900 font-black py-6 rounded-[32px] cursor-pointer shadow-sm hover:border-orange-500 transition-all active:scale-95"><ImageIcon className="w-6 h-6 text-orange-500" /> Gallery<input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} /></label>
                   <label className="flex items-center justify-center gap-3 bg-orange-500 text-white font-black py-6 rounded-[32px] cursor-pointer shadow-xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95"><Camera className="w-6 h-6" /> Camera<input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} /></label>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {step === 'QUESTIONNAIRE' && (
        <div className="min-h-screen flex flex-col bg-white">
          {renderProgressHeader(2)}
          <main className="flex-1 p-8 text-center space-y-16 flex flex-col items-center justify-center">
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-5xl font-black leading-tight text-gray-900 tracking-tight">{questionnaire[questionIndex].title[language]}</h2>
              <p className="text-xl text-orange-500 font-bold uppercase tracking-widest">{questionnaire[questionIndex].title.english}</p>
            </div>
            <div className="flex flex-col items-center gap-8">
               <button onClick={startListening} className={`w-48 h-48 rounded-full shadow-2xl flex items-center justify-center transition-all border-8 border-white ${isListening ? 'bg-orange-600 scale-110' : 'bg-orange-500'}`}><Mic className="w-20 h-20 text-white" /></button>
               <TranscriptionFeedback text={capturedText} />
            </div>
            <div className="flex flex-wrap justify-center gap-4 w-full max-w-2xl">
              {questionnaire[questionIndex].options.map(o => (
                <button 
                  key={o} 
                  onClick={() => { 
                    const currentQ = questionnaire[questionIndex];
                    const updatedProfile = { ...profile, [currentQ.field]: o };
                    setProfile(updatedProfile); 
                    if (questionIndex < questionnaire.length - 1) setQuestionIndex(q => q + 1); 
                    else handleMatchSchemes(updatedProfile); 
                  }} 
                  className="px-10 py-5 bg-gray-50 border-2 border-transparent rounded-[28px] font-black text-gray-700 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-50 transition-all shadow-sm"
                >
                  {o}
                </button>
              ))}
            </div>
          </main>
        </div>
      )}

      {step === 'RESULTS' && (
        <div className="min-h-screen bg-[#fafafa] flex flex-col pb-64">
          {renderProgressHeader(3)}
          <main className="p-8 max-w-5xl mx-auto w-full space-y-16">
            {isProcessing ? (
              <div className="py-24 flex flex-col items-center justify-center space-y-10 animate-in fade-in">
                <div className="relative">
                  <div className="w-32 h-32 bg-orange-100 rounded-[40px] flex items-center justify-center animate-spin border-4 border-white shadow-xl">
                    <Sparkles className="w-16 h-16 text-orange-500" />
                  </div>
                  <Search className="w-10 h-10 text-orange-600 absolute -bottom-4 -right-4 animate-bounce" />
                </div>
                <div className="text-center space-y-4">
                  <h2 className="text-5xl font-black text-gray-900 tracking-tighter">Finding Best Matches</h2>
                  <p className="text-gray-400 font-bold text-xl uppercase tracking-[0.2em]">Searching Government Grounded Data...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center space-y-4">
                  <div className="bg-green-100 text-green-700 px-6 py-2 rounded-full text-[11px] font-black inline-flex items-center gap-2 border border-green-200 shadow-sm uppercase tracking-widest"><CheckCircle2 className="w-4 h-4" /> {matchedSchemes.length} LIVE SCHEMES MATCHED</div>
                  <h1 className="text-6xl font-black tracking-tighter text-gray-900">Your Eligible Benefits</h1>
                  <p className="text-orange-500 font-black text-2xl italic tracking-tight">सार्थी द्वारा सुझाई गई योजनाएं</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {matchedSchemes.map(s => (
                    <div key={s.id} className="bg-white p-12 rounded-[56px] shadow-sm border border-gray-100 space-y-8 relative overflow-hidden flex flex-col group hover:shadow-2xl hover:-translate-y-2 transition-all">
                       <div className="absolute top-0 right-12 -translate-y-1/2 bg-green-500 text-white px-8 py-2.5 rounded-full font-black text-xs shadow-xl border-4 border-white group-hover:bg-green-600 transition-colors">{s.matchPercentage}% FIT</div>
                       <div className="flex-1 space-y-5">
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <h3 className="text-3xl font-black leading-tight text-gray-900 tracking-tight">{s.titleLocal}</h3>
                               <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{s.title}</p>
                            </div>
                            <button onClick={async () => {
                              const text = `${s.titleLocal}. ${s.description}. ${s.benefit}.`;
                              const audio = await gemini.speakText(text, language);
                              if (audio) gemini.playBase64Audio(audio);
                            }} className="p-5 bg-orange-50 rounded-[28px] text-orange-500 hover:bg-orange-500 hover:text-white transition-all shadow-sm"><Volume2 className="w-6 h-6" /></button>
                         </div>
                         <p className="text-gray-500 font-medium leading-relaxed text-lg line-clamp-3">{s.description}</p>
                         <div className="bg-green-50/50 p-6 rounded-[32px] border border-green-100 font-black text-green-700 text-xl flex items-center gap-3 shadow-inner"><Zap className="w-6 h-6" /> {s.benefit}</div>
                       </div>
                       
                       <div className="space-y-4 pt-6 border-t border-gray-50">
                         {s.sources && s.sources.length > 0 && (
                           <div className="flex flex-wrap gap-2">
                             {s.sources.slice(0, 2).map((src, idx) => (
                               <a key={idx} href={src.uri} target="_blank" className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2 border border-blue-100 hover:bg-blue-500 hover:text-white transition-all">
                                 <Link className="w-3 h-3" /> {src.title.slice(0, 20)}...
                               </a>
                             ))}
                           </div>
                         )}
                         <button onClick={() => openChat(s)} className="w-full bg-orange-500 py-6 rounded-[32px] font-black text-white flex items-center justify-center gap-3 shadow-2xl shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95 text-lg">Apply via Dialog Agent <ArrowRight className="w-6 h-6" /></button>
                       </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
          <div className="fixed bottom-0 left-0 right-0 p-8 bg-white/90 backdrop-blur-md border-t flex flex-col gap-4 z-50">
            <button onClick={saveToProfile} className="w-full bg-blue-600 py-7 rounded-[32px] font-black text-white flex items-center justify-center gap-3 shadow-2xl shadow-blue-100 active:scale-95 transition-all text-xl"><Save className="w-8 h-8" /> Save to Local Profile</button>
            <button onClick={() => setStep('PROFILE')} className="w-full bg-gray-50 py-4 rounded-[28px] font-black text-gray-500 hover:bg-gray-100 transition-colors">Return Home</button>
          </div>
        </div>
      )}

      {activeChatScheme && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl h-[88vh] sm:h-[85vh] sm:rounded-[60px] flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-bottom-full duration-500">
            <header className="p-8 border-b flex items-center justify-between bg-white relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-100 rounded-full mt-3 sm:hidden"></div>
              <div className="flex items-center gap-5">
                <div className="bg-orange-50 p-4 rounded-[32px] shadow-inner"><MessageCircle className="w-8 h-8 text-orange-500" /></div>
                <div><h3 className="font-black text-xl text-gray-900 tracking-tight truncate max-w-[200px]">{activeChatScheme.titleLocal}</h3><p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mt-1">Dialogflow AI Agent</p></div>
              </div>
              <button onClick={() => { gemini.stopAllSpeech(); setActiveChatScheme(null); }} className="p-4 hover:bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-all border border-transparent hover:border-gray-100"><X className="w-8 h-8" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-[#fafafa]">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-7 rounded-[48px] text-lg font-bold shadow-sm ${m.role === 'user' ? 'bg-orange-500 text-white rounded-tr-none shadow-orange-100' : 'bg-white border-2 border-white text-gray-800 rounded-tl-none shadow-md'}`}>{m.content}</div>
                </div>
              ))}
              {chatGrounding.length > 0 && <div className="p-8 bg-blue-50/50 rounded-[48px] border border-blue-100 space-y-4 shadow-inner"><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Link className="w-4 h-4" /> Grounded References</p><div className="flex flex-wrap gap-2">{chatGrounding.map((s, idx) => <a key={idx} href={s.uri} target="_blank" className="bg-white px-5 py-3 rounded-3xl border border-blue-100 text-[11px] font-black shadow-sm hover:bg-blue-100 transition-colors flex items-center gap-2">{s.title.slice(0, 30)}... <ArrowRight className="w-3 h-3" /></a>)}</div></div>}
              {isProcessing && <div className="flex justify-start"><div className="bg-white px-8 py-5 rounded-full border-2 border-white flex gap-4 animate-pulse shadow-md"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sarthi is reasoning...</span></div></div>}
            </div>
            <footer className="p-10 border-t space-y-6 bg-white shadow-inner">
              <div className="flex items-center gap-5">
                <button onClick={startListening} className={`p-7 rounded-full transition-all shadow-2xl active:scale-90 ${isListening ? 'bg-red-500 text-white ring-8 ring-red-50' : 'bg-gray-100 text-gray-400 border border-gray-100 hover:text-orange-500'}`}><Mic className="w-8 h-8" /></button>
                <div className="flex-1 relative">
                  <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="Ask eligibility or steps..." className="w-full bg-gray-50 p-7 rounded-[40px] font-bold text-lg outline-none border-2 border-transparent focus:border-orange-100 focus:bg-white transition-all shadow-inner placeholder:text-gray-300" />
                  <button onClick={sendMessage} disabled={!chatInput.trim() || isProcessing} className="absolute right-3 top-3 p-4 bg-orange-500 text-white rounded-full shadow-2xl disabled:opacity-50 hover:bg-orange-600 transition-all active:scale-90"><Send className="w-6 h-6" /></button>
                </div>
              </div>
              <div className="flex justify-center h-10">
                <TranscriptionFeedback text={capturedText} />
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
