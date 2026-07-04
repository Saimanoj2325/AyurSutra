import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { usePatients, usePractitioners } from '../hooks/useDatabase';
import { messageService, subscribeToConversation, notesService } from '../services/database';
import {
  ArrowLeft,
  Send,
  Plus,
  Phone,
  Video,
  Clock,
  CheckCheck,
  Lock,
  User,
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  Search
} from 'lucide-react';

export function CommunicationMessaging({ onPageChange }) {
  const { currentUser, userProfile } = useAuth();
  const isPractitioner = userProfile?.userType === 'practitioner';

  // Fetch real contacts based on role
  const { patients = [], loading: patientsLoading } = usePatients();
  const { practitioners = [], loading: practitionersLoading } = usePractitioners();

  const contacts = isPractitioner ? patients : practitioners;
  const isLoadingContacts = isPractitioner ? patientsLoading : practitionersLoading;

  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  // Video Call States
  const [isCallActive, setIsCallActive] = useState(false);
  const [callType, setCallType] = useState('video'); // 'video' or 'audio'

  // Initialize selected contact to first available once contacts load
  useEffect(() => {
    if (contacts.length > 0 && !selectedContact) {
      // Check if there's an active call request in localStorage
      const autoStart = localStorage.getItem('auto_start_call');
      const partnerId = localStorage.getItem('active_call_partner_id');
      
      if (autoStart === 'true' && partnerId) {
        const target = contacts.find(c => c.id === partnerId || c.uid === partnerId);
        if (target) {
          setSelectedContact(target);
          setIsCallActive(true);
          setCallType('video');
        }
        localStorage.removeItem('auto_start_call');
        localStorage.removeItem('active_call_partner_id');
        localStorage.removeItem('active_call_partner_name');
      } else {
        setSelectedContact(contacts[0]);
      }
    }
  }, [contacts, selectedContact]);

  // Subscribe to real-time conversation
  useEffect(() => {
    if (!currentUser?.uid || !selectedContact?.id) {
      setMessages([]);
      return;
    }

    console.log(`📡 Subscribing to messages between ${currentUser.uid} and ${selectedContact.id}`);
    const unsubscribe = subscribeToConversation(
      currentUser.uid,
      selectedContact.id,
      (newMessages) => {
        setMessages(newMessages);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser?.uid, selectedContact?.id]);

  const filteredContacts = contacts.filter((contact) =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !currentUser) return;

    const messageData = {
      senderId: currentUser.uid,
      senderName: userProfile?.name || currentUser.displayName || 'User',
      receiverId: selectedContact.id,
      receiverName: selectedContact.name || 'Recipient',
      content: newMessage,
      type: 'text'
    };

    setNewMessage('');
    try {
      await messageService.sendMessage(messageData);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleStartCall = (type) => {
    setCallType(type);
    setIsCallActive(true);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-emerald-900 mb-2">Secure Care Portal</h1>
            <p className="text-emerald-600">
              {isPractitioner 
                ? 'Review patients, document session notes, and consult securely' 
                : 'Connect with your assigned practitioners and join video therapy sessions'}
            </p>
          </div>
          <Button
            onClick={() => onPageChange(isPractitioner ? 'practitioner-dashboard' : 'patient-dashboard')}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Contacts List */}
          <Card className="lg:col-span-4 bg-white/90 backdrop-blur-sm border-emerald-200">
            <CardHeader className="p-4">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-emerald-900 text-lg">
                  {isPractitioner ? 'My Patients' : 'My Care Practitioners'}
                </CardTitle>
                <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-emerald-700 hover:bg-emerald-100 p-2 rounded-full">
                      <Plus className="w-5 h-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-emerald-900">Start New Conversation</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 space-y-3">
                      <p className="text-sm text-gray-600 mb-2">Select a practitioner or patient to begin messaging.</p>
                      <div className="space-y-2">
                        {filteredContacts.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => {
                              setSelectedContact(c);
                              setIsNewChatOpen(false);
                            }}
                            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-emerald-50 cursor-pointer transition-all"
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-emerald-600 text-white font-semibold">
                                {c.name?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-emerald-900">{c.name}</p>
                              <p className="text-xs text-emerald-600 capitalize">{c.userType}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={isPractitioner ? "Search patients..." : "Search practitioners..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-emerald-100 focus:border-emerald-500 bg-white"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingContacts ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-2"></div>
                  <p className="text-sm">Loading contacts...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <User className="w-12 h-12 mx-auto text-emerald-200 mb-2" />
                  <p className="text-sm">No contacts found</p>
                </div>
              ) : (
                <ScrollArea className="h-[480px]">
                  <div className="space-y-1">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => setSelectedContact(contact)}
                        className={`p-4 cursor-pointer hover:bg-emerald-50/50 transition-colors ${
                          selectedContact?.id === contact.id
                            ? 'bg-emerald-50 border-r-4 border-emerald-600'
                            : ''
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar>
                              <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-semibold">
                                {contact.name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-emerald-950 truncate">
                                {contact.name}
                              </p>
                              <span className="text-[10px] text-gray-500">
                                {contact.dosha ? `[${contact.dosha}]` : contact.specialization || ''}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 truncate mt-1">
                              {contact.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Chat Panel */}
          <Card className="lg:col-span-8 bg-white/90 backdrop-blur-sm border-emerald-200 flex flex-col min-h-[500px]">
            {selectedContact ? (
              <>
                {/* Chat Header */}
                <CardHeader className="border-b border-gray-100 p-4 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-semibold">
                        {selectedContact.name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-emerald-950">{selectedContact.name}</h3>
                      <p className="text-xs text-emerald-600 flex items-center">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                        Active Consultation Room
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartCall('audio')}
                      className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 bg-white"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartCall('video')}
                      className="text-teal-700 border-teal-200 hover:bg-teal-50 bg-white flex items-center space-x-1"
                    >
                      <Video className="w-4 h-4" />
                      <span className="hidden sm:inline">Join Call</span>
                    </Button>
                  </div>
                </CardHeader>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 max-h-[360px] bg-slate-50/50">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Lock className="w-8 h-8 mx-auto text-emerald-300 mb-2" />
                        <p className="text-sm">Secure chat started. Type your message below.</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isOwn = message.senderId === currentUser?.uid;
                        const isSystem = message.senderId === 'system';

                        if (isSystem) {
                          return (
                            <div key={message.id} className="flex justify-center my-2">
                              <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2.5 py-1 rounded-full flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {message.content}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${
                                isOwn
                                  ? 'bg-emerald-600 text-white rounded-tr-none'
                                  : 'bg-white text-gray-900 border border-emerald-100 rounded-tl-none'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                              <div
                                className={`flex items-center justify-between mt-1.5 text-[9px] ${
                                  isOwn ? 'text-emerald-100' : 'text-gray-500'
                                }`}
                              >
                                <span>{formatTime(message.createdAt)}</span>
                                {isOwn && <CheckCheck className="w-3 h-3 ml-1" />}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Message Input */}
                <div className="border-t border-gray-100 p-4 bg-white">
                  <div className="flex items-end space-x-2">
                    <div className="flex-1">
                      <Textarea
                        placeholder="Type a message or clinical query..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        rows={1}
                        className="resize-none border-emerald-100 focus:border-emerald-500"
                      />
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-4"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-20">
                <User className="w-16 h-16 text-emerald-100 mb-3 animate-pulse" />
                <h3 className="font-semibold text-emerald-950 text-lg mb-1">Select a Contact</h3>
                <p className="text-sm text-gray-500">Pick a care practitioner or patient to begin secure consulting.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Video Call Overlay */}
      {isCallActive && selectedContact && createPortal(
        <VideoCallOverlay
          callType={callType}
          partnerName={selectedContact.name}
          partnerRole={selectedContact.userType}
          partnerData={selectedContact}
          currentUser={currentUser}
          userProfile={userProfile}
          onClose={async (durationSec) => {
            // Close media stream and overlay
            setIsCallActive(false);

            // Log session call completion in chat log
            const callDurationText = `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
            try {
              await messageService.sendMessage({
                senderId: 'system',
                senderName: 'System',
                receiverId: selectedContact.id,
                receiverName: selectedContact.name,
                content: `📞 Video call session ended. Duration: ${callDurationText}`,
                type: 'text'
              });
            } catch (err) {
              console.error('Failed to log call end:', err);
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}

// Subcomponent: VideoCallOverlay
function VideoCallOverlay({ callType, partnerName, partnerRole, partnerData, currentUser, userProfile, onClose }) {
  const [localStream, setLocalStream] = useState(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isNotesSaved, setIsNotesSaved] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [hasPartnerJoined, setHasPartnerJoined] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Generate unique room ID for patient + practitioner
  const callId = React.useMemo(() => {
    if (!currentUser?.uid || !partnerData?.id) return 'temp_call_room';
    return [currentUser.uid, partnerData.id].sort().join('_');
  }, [currentUser?.uid, partnerData?.id]);

  // Set presence document on mount, clean up on unmount
  useEffect(() => {
    if (callId === 'temp_call_room' || !db) return;

    const myRoleField = userProfile?.userType === 'practitioner' ? 'practitionerJoined' : 'patientJoined';
    const callDocRef = doc(db, 'active_calls', callId);

    // Join room
    setDoc(callDocRef, {
      [myRoleField]: true,
      lastActive: Date.now()
    }, { merge: true }).catch(err => console.warn('Failed to set presence: ', err));

    // Listen to changes
    const unsubscribe = onSnapshot(callDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const partnerRoleField = partnerRole === 'practitioner' ? 'practitionerJoined' : 'patientJoined';
        setHasPartnerJoined(!!data[partnerRoleField]);
      }
    });

    return () => {
      unsubscribe();
      // Leave room
      updateDoc(callDocRef, {
        [myRoleField]: false
      }).catch(err => console.warn('Failed to clean presence: ', err));
    };
  }, [callId, userProfile?.userType, partnerRole]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Request local camera and microphone stream
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Could not initialize local video/audio: ', err);
      }
    };
    initCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [callType]);

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = micMuted;
      });
      setMicMuted(!micMuted);
    }
  };

  const toggleCamera = () => {
    setCameraOff(!cameraOff);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Re-enable camera
      try {
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
        setIsScreenSharing(false);
      } catch (err) {
        console.warn('Failed to restart camera after screen share: ', err);
      }
    } else {
      // Start screen capture
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localStream) {
          // Merge audio tracks from mic with video from screen share
          const micTrack = localStream.getAudioTracks()[0];
          if (micTrack) {
            screenStream.addTrack(micTrack);
          }
        }
        setLocalStream(screenStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);

        // Listen for browser stop share button click
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          // Auto restart camera
          navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(camStream => {
            setLocalStream(camStream);
            if (localVideoRef.current) localVideoRef.current.srcObject = camStream;
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = camStream;
          });
        };
      } catch (err) {
        console.warn('Screen share cancelled or failed: ', err);
      }
    }
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    onClose(callDuration);
  };

  const handleSaveNotes = async () => {
    if (!sessionNotes.trim()) return;
    try {
      const notePayload = {
        patientId: partnerRole === 'patient' ? partnerData.id : currentUser.uid,
        patientName: partnerRole === 'patient' ? partnerName : userProfile?.name || 'Patient',
        practitionerId: partnerRole === 'practitioner' ? partnerData.id : currentUser.uid,
        practitionerName: partnerRole === 'practitioner' ? partnerName : userProfile?.name || 'Practitioner',
        sessionType: partnerData.assignedTherapy || 'Ayurvedic Consultation',
        noteType: 'Session Note',
        title: 'Consultation Session Notes',
        content: sessionNotes,
        tags: ['video-session', 'realtime-consultation'],
        attachments: []
      };
      await notesService.createNote(notePayload);
      setIsNotesSaved(true);
      setTimeout(() => setIsNotesSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save session notes:', err);
    }
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="fixed inset-0 flex flex-col md:flex-row text-white overflow-hidden font-sans"
      style={{ 
        backgroundColor: '#090d16', 
        zIndex: 99999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: '100vh',
        width: '100vw'
      }}
    >
      {/* Video Streams and Controls Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-950">
        
        {/* Call Info Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900/80 border-b border-white/10 flex-shrink-0 z-20">
          <div className="flex items-center space-x-3">
            <Badge className="bg-red-600 text-white animate-pulse px-2 py-0.5 rounded text-[10px]">LIVE</Badge>
            <h2 className="font-semibold text-sm tracking-wide md:text-base">
              Secure Consultation — {partnerName}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <span className="font-mono text-sm tracking-wider bg-white/10 px-3 py-1 rounded">
              {formatDuration(callDuration)}
            </span>
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-green-400">
              <Lock className="w-3.5 h-3.5" />
              <span>End-to-End Encrypted</span>
            </div>
          </div>
        </div>

        {/* Video Grid Container */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 min-h-0 items-stretch bg-slate-950/40">
          
          {/* Box 1: Remote Partner Video */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl relative overflow-hidden flex items-center justify-center shadow-xl">
            {hasPartnerJoined ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Partner Name Label */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md rounded px-2.5 py-1 text-xs text-white border border-white/5">
                  {partnerName} ({partnerRole})
                </div>
                {/* Live Indicator */}
                <div className="absolute top-4 left-4 flex items-center space-x-1.5 bg-green-500/20 text-green-400 px-2 py-1 rounded-md text-[10px] font-bold border border-green-500/30">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span>CONNECTED</span>
                </div>
              </>
            ) : (
              <div className="text-center space-y-4 p-6 flex flex-col items-center justify-center h-full">
                <div className="relative inline-block">
                  <Avatar className="w-20 h-20 border-2 border-emerald-500/50 shadow-2xl scale-100">
                    <AvatarFallback className="bg-emerald-800 text-white text-2xl font-bold">
                      {partnerName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 rounded-full border border-emerald-500 animate-ping opacity-75" />
                </div>
                <div>
                  <p className="font-semibold text-base text-white">{partnerName}</p>
                  <p className="text-xs text-emerald-400 capitalize">{partnerRole}</p>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 justify-center">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <span>Waiting for partner to join call...</span>
                </div>
              </div>
            )}
          </div>

          {/* Box 2: Local Video Feed */}
          <div className="bg-slate-900 border border-white/10 rounded-3xl relative overflow-hidden flex items-center justify-center shadow-xl">
            {!cameraOff ? (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                {/* Local User Label */}
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md rounded px-2.5 py-1 text-xs text-white border border-white/5">
                  You (Self)
                </div>
                {/* Camera Status Indicator */}
                <div className="absolute top-4 left-4 flex items-center space-x-1.5 bg-white/10 text-white/80 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10">
                  <span>CAMERA ON</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400 space-y-2">
                <VideoOff className="w-12 h-12 text-gray-600" />
                <p className="text-sm font-semibold">Your Camera is Off</p>
                <p className="text-xs text-gray-500">Other participants cannot see you</p>
              </div>
            )}
          </div>

        </div>

        {/* Controls Bar */}
        <div className="p-4 flex-shrink-0 flex items-center justify-center bg-slate-950 border-t border-white/5">
          <div className="flex items-center space-x-4 bg-slate-900 border border-white/10 rounded-2xl px-6 py-3 shadow-lg">
            <Button
              onClick={toggleMic}
              className={`p-3 rounded-xl hover:scale-105 transition-all duration-200 border border-white/10 ${
                micMuted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              onClick={toggleCamera}
              className={`p-3 rounded-xl hover:scale-105 transition-all duration-200 border border-white/10 ${
                cameraOff ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>

            <Button
              onClick={toggleScreenShare}
              className={`p-3 rounded-xl hover:scale-105 transition-all duration-200 border border-white/10 ${
                isScreenSharing ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              <Monitor className="w-5 h-5" />
            </Button>

            <div className="w-px h-6 bg-white/20 mx-2" />

            <Button
              onClick={handleEndCall}
              className="p-3 bg-red-600 hover:bg-red-700 rounded-xl hover:scale-110 transition-all duration-200 shadow-md text-white flex items-center justify-center"
            >
              <Phone className="w-6 h-6 rotate-[135deg]" />
            </Button>
          </div>
        </div>

      </div>

      {/* Therapy Context Sidebar */}
      <div 
        className="w-full md:w-80 lg:w-96 border-t md:border-t-0 md:border-l border-white/10 flex flex-col p-6 overflow-y-auto flex-shrink-0 h-full"
        style={{ backgroundColor: '#111827' }}
      >
        <h3 className="text-emerald-400 font-semibold tracking-wider text-xs uppercase mb-4">
          Session Therapy Card
        </h3>

        <div className="space-y-6 flex-1">
          {/* Main info card */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <h4 className="font-bold text-white text-base mb-1">
              {partnerRole === 'patient' ? partnerName : 'Therapy Consultation'}
            </h4>
            <p className="text-xs text-gray-400">
              Active Therapy: {partnerData.assignedTherapy || 'Ayurvedic Panchakarma Consultation'}
            </p>
            {partnerData.dosha && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mt-3">
                {partnerData.dosha} Constitution
              </Badge>
            )}
          </div>

          {/* Role-based sidebar panels */}
          {partnerRole === 'patient' ? (
            /* Practitioner Portal: Input Consultation Notes */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">
                  Patient Profile Details
                </label>
                <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-xs space-y-2">
                  <p><strong className="text-gray-300">Age / Gender:</strong> {partnerData.age || 'N/A'} / {partnerData.gender || 'N/A'}</p>
                  <p><strong className="text-gray-300">Medical History:</strong> {partnerData.medicalHistory || 'None registered'}</p>
                  <p><strong className="text-gray-300">Current Condition:</strong> {partnerData.currentCondition || 'Monitoring progress'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase">
                  Clinical Session Notes
                </label>
                <Textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Document observations, pulse diagnostics, ghee dosage updates, and treatment response..."
                  className="bg-black/30 border-white/10 text-white text-sm focus:border-emerald-500 placeholder-gray-500"
                  rows={6}
                />
                <Button
                  onClick={handleSaveNotes}
                  disabled={!sessionNotes.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  Save Consultation Notes
                </Button>
                {isNotesSaved && (
                  <p className="text-xs text-green-400 text-center animate-pulse">
                    ✓ Notes saved to Patient History successfully.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Patient Portal: View Guidelines */
            <div className="space-y-4 text-sm text-gray-300">
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-2 uppercase">
                  Your Preparation Guidelines
                </label>
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-4 text-xs space-y-2.5">
                  <div className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5" />
                    <p>Sip warm water or herbal teas continuously throughout the day.</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5" />
                    <p>Avoid cold environments, strong air conditioners, or cold winds.</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5" />
                    <p>Consume only light, easily digestible food (like kitchari) after the call.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-teal-400 mb-2 uppercase">
                  Daily Yoga Guideline
                </label>
                <div className="bg-teal-950/20 border border-teal-900/30 rounded-2xl p-4 text-xs text-gray-300">
                  <p>Incorporate 15 minutes of slow, breathing-focused postures (Mountain Pose, Child's Pose) and 10 rounds of Alternate Nostril Pranayama.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 pt-4 mt-6 text-center text-[10px] text-gray-500 flex-shrink-0">
          Secure consulting provided by AyurSutra.
        </div>
      </div>
    </div>
  );
}
