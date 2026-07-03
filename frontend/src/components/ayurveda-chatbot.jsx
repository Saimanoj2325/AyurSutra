import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../hooks/useDatabase';
import {
  MessageCircle,
  Send,
  Bot,
  User,
  X,
  Minimize2,
  Maximize2,
  Leaf,
  Clock,
  Heart,
  Coffee,
  Utensils,
  Moon,
  Droplets,
  Trash2,
  Sparkles
} from 'lucide-react';

// Configure API base URL based on environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV 
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : `${window.location.protocol}//${window.location.hostname}`);

const quickQuestions = [
  { icon: Utensils, text: "Diet tips for my dosha", category: "diet" },
  { icon: Clock, text: "Pre-session preparation", category: "preparation" },
  { icon: Droplets, text: "Post-treatment care", category: "aftercare" },
  { icon: Moon, text: "Sleep & lifestyle advice", category: "lifestyle" },
  { icon: Heart, text: "Stress management tips", category: "wellness" },
  { icon: Coffee, text: "Daily routine guidance", category: "routine" }
];

// Fallback responses when API is unavailable
const fallbackResponses = {
  diet: "🌿 **Diet Tips for Your Dosha:**\n\n• **Vata**: Warm, cooked, moist foods — kitchadi, soups, herbal teas\n• **Pitta**: Cooling foods — cucumber, mint, coconut water, sweet fruits\n• **Kapha**: Light, spicy foods — ginger tea, steamed vegetables, legumes\n\n⚠️ Avoid cold drinks, processed foods, and heavy meals 2-3 hours before treatments.",
  preparation: "🧘 **Pre-Treatment Preparation:**\n\n• **2-3 hours before**: Light meal, avoid heavy/oily foods\n• **1 hour before**: Stop eating, drink warm water\n• **30 minutes before**: Arrive early, use restroom, relax\n• **Clothing**: Wear comfortable, loose clothing\n• **Mental state**: Practice deep breathing, set positive intentions\n\n💡 Avoid alcohol, caffeine, and strenuous exercise before sessions.",
  aftercare: "🌸 **Post-Treatment Care:**\n\n• **First 2 hours**: Rest quietly, avoid cold environments\n• **Hydration**: Sip warm water or herbal tea\n• **Avoid**: Cold showers, vigorous activity, heavy meals\n• **Gentle activities**: Light walking, meditation, reading\n• **Evening**: Early dinner, warm bath with Epsom salts\n\n⚠️ Some mild fatigue is normal — listen to your body!",
  lifestyle: "🌅 **Daily Ayurvedic Routine:**\n\n• **Morning (6-10 AM)**: Wake before sunrise, warm water with lemon, yoga/meditation\n• **Midday (10 AM-2 PM)**: Main meal of the day, mental activities\n• **Evening (2-6 PM)**: Light activities, creative pursuits\n• **Night (6-10 PM)**: Light dinner, calming activities, sleep by 10 PM",
  wellness: "🧠 **Stress Management:**\n\n**Breathing (Pranayama)**:\n• 4-7-8 breathing: Inhale 4, hold 7, exhale 8\n• Alternate nostril breathing\n\n**Herbs for calm**:\n• Ashwagandha for stress\n• Brahmi for mental clarity\n• Jatamansi for anxiety\n\n**Daily practices**:\n• Oil massage, meditation 10-20 minutes, nature walks",
  routine: "⏰ **Ideal Daily Routine (Dinacharya):**\n\n• **5:30-6:00 AM**: Wake up\n• **6:00-7:00 AM**: Oral hygiene, warm water\n• **7:00-8:00 AM**: Exercise/Yoga\n• **8:00-9:00 AM**: Meditation, oil massage\n• **9:00-10:00 AM**: Breakfast\n• **12:00-1:00 PM**: Lunch (main meal)\n• **6:00-7:00 PM**: Light dinner\n• **10:00 PM**: Sleep time"
};

function renderMarkdown(text) {
  if (!text) return '';
  
  // Convert markdown to HTML elements inline
  let html = text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="font-bold text-sm mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-bold text-base mt-3 mb-1">$1</h3>')
    // Bullet points
    .replace(/^[•\-] (.+)$/gm, '<li class="ml-4 text-sm list-disc">$1</li>')
    // Numbered lists
    .replace(/^\d+\) (.+)$/gm, '<li class="ml-4 text-sm list-decimal">$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>');
  
  return `<p class="mb-2">${html}</p>`;
}

export function AyurvedaChatbot({ isVisible = true }) {
  const { currentUser, userProfile } = useAuth();
  const { progress } = useProgress(currentUser?.uid);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [inputMessage, setInputMessage] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  React.useEffect(() => {
    if (isOpen && messages.length === 0) {
      const patientName = userProfile?.name?.split(' ')[0] || 'there';
      const dosha = userProfile?.dosha ? ` Based on your ${userProfile.dosha} constitution, I can provide personalized guidance.` : '';
      const welcomeMessage = {
        id: '1',
        text: `🙏 **Namaste, ${patientName}!** I'm AyurBot, your Ayurvedic wellness assistant.\n\nI can help you with:\n• 🍃 Diet & nutrition for your dosha\n• 🧘 Pre & post-treatment care\n• 🌅 Daily lifestyle routines\n• 🧠 Stress management techniques\n• 🌿 Herbal remedies & yoga guidance${dosha}\n\nWhat would you like to explore today?`,
        sender: 'bot',
        timestamp: new Date(),
        sources: [],
        sourceCategories: []
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, userProfile]);

  const buildPatientContext = () => {
    if (!userProfile) return undefined;
    
    const context = {};
    if (userProfile.name) context.name = userProfile.name;
    if (userProfile.dosha) context.dosha = userProfile.dosha;
    if (userProfile.assignedTherapy) context.current_therapy = userProfile.assignedTherapy;
    if (userProfile.medicalHistory) context.medical_history = userProfile.medicalHistory;
    if (progress?.treatmentProgress) {
      context.treatment_day = progress.treatmentProgress.currentDay;
      context.total_treatment_days = progress.treatmentProgress.totalDays;
    }
    
    return Object.keys(context).length > 0 ? context : undefined;
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: text,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chatbot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_history: messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          })).slice(-8),
          patient_context: buildPatientContext()
        })
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const data = await response.json();
      
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response || data.plain_text,
        sender: 'bot',
        timestamp: new Date(),
        sources: data.sources || [],
        sourceCategories: data.source_categories || []
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Fallback to local responses
      const fallbackResponse = generateFallbackResponse(text);
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: fallbackResponse,
        sender: 'bot',
        timestamp: new Date(),
        sources: ['Local Ayurvedic Knowledge'],
        sourceCategories: []
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateFallbackResponse = (userInput) => {
    const input = userInput.toLowerCase();
    
    if (input.includes('diet') || input.includes('food') || input.includes('eat') || input.includes('dosha')) {
      return fallbackResponses.diet;
    } else if (input.includes('before') || input.includes('preparation') || input.includes('prepare') || input.includes('pre-')) {
      return fallbackResponses.preparation;
    } else if (input.includes('after') || input.includes('post') || input.includes('care') || input.includes('treatment')) {
      return fallbackResponses.aftercare;
    } else if (input.includes('stress') || input.includes('anxiety') || input.includes('calm') || input.includes('relax')) {
      return fallbackResponses.wellness;
    } else if (input.includes('routine') || input.includes('schedule') || input.includes('day') || input.includes('daily')) {
      return fallbackResponses.routine;
    } else if (input.includes('sleep') || input.includes('lifestyle') || input.includes('evening') || input.includes('morning')) {
      return fallbackResponses.lifestyle;
    } else {
      return "🌿 I'm having trouble connecting to my AI assistant right now. However, I can still help with:\n\n• **Diet & nutrition** for your dosha\n• **Pre & post-treatment** care\n• **Daily lifestyle** routines\n• **Stress management** techniques\n\nTry asking about one of these topics, or contact your practitioner for personalized advice.";
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          >
            <MessageCircle className="w-8 h-8 text-white" />
          </Button>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center animate-pulse">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
          isMinimized ? 'w-80 h-16' : 'w-[420px] h-[36rem]'
        }`}>
          <Card className="bg-white shadow-2xl border-emerald-200 h-full flex flex-col overflow-hidden">
            {/* Chat Header */}
            <CardHeader className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Leaf className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-lg">AyurBot</CardTitle>
                    <CardDescription className="text-emerald-100 text-sm">
                      AI-Powered Ayurvedic Assistant
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearChat}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                    title="Clear chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  >
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-white hover:bg-white/20 h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {!isMinimized && (
              <>
                {/* Quick Questions (only shown initially) */}
                {messages.length <= 1 && (
                  <div className="p-3 border-b border-gray-100 flex-shrink-0 bg-emerald-50/50">
                    <p className="text-xs text-emerald-700 mb-2 font-medium">Quick questions:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {quickQuestions.map((question, index) => {
                        const Icon = question.icon;
                        return (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => sendMessage(question.text)}
                            className="text-xs h-auto py-1.5 px-2 justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                          >
                            <Icon className="w-3 h-3 mr-1 flex-shrink-0" />
                            <span className="truncate">{question.text}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <CardContent className="flex-1 p-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[88%] rounded-2xl p-3 ${
                            message.sender === 'user'
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-md'
                              : 'bg-gray-50 text-gray-900 border border-gray-100 rounded-bl-md'
                          }`}>
                            <div className="flex items-start space-x-2">
                              {message.sender === 'bot' && (
                                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Bot className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div 
                                  className="text-sm leading-relaxed [&_strong]:font-semibold [&_li]:my-0.5 [&_h3]:text-emerald-800 [&_h4]:text-emerald-700"
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
                                />
                                
                                {/* Source citations */}
                                {message.sender === 'bot' && message.sources && message.sources.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                      📚 Sources: {message.sources.join(' • ')}
                                    </p>
                                  </div>
                                )}
                                
                                <p className={`text-xs mt-1.5 ${
                                  message.sender === 'user' ? 'text-emerald-200' : 'text-gray-400'
                                }`}>
                                  {formatTime(message.timestamp)}
                                </p>
                              </div>
                              {message.sender === 'user' && (
                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <User className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Typing Indicator */}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md p-3 max-w-[80%]">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
                                <Bot className="w-3 h-3 text-white" />
                              </div>
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                              </div>
                              <span className="text-xs text-gray-400 ml-1">AyurBot is thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>

                {/* Input */}
                <div className="p-3 border-t border-gray-100 flex-shrink-0 bg-white">
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Ask about diet, lifestyle, or treatments..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(inputMessage);
                        }
                      }}
                      className="flex-1 border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400/20 text-sm"
                      disabled={isTyping}
                    />
                    <Button
                      onClick={() => sendMessage(inputMessage)}
                      disabled={!inputMessage.trim() || isTyping}
                      className="bg-emerald-600 hover:bg-emerald-700 transition-colors"
                      size="sm"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5 text-center">
                    🌿 Powered by Ayurvedic RAG AI • Consult your practitioner for personalized advice
                  </p>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}