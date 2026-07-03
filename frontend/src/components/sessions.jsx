import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSessions, usePractitioners } from '../hooks/useDatabase';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Calendar, Clock, User, Edit, X, CheckCircle, AlertCircle, Loader2,
  MapPin, Plus
} from 'lucide-react';

export function Sessions({ onPageChange }) {
  const { currentUser, userProfile } = useAuth();
  const { 
    sessions, upcomingSessions, loading: isLoading, 
    createSession, updateSession, deleteSession 
  } = useSessions(currentUser?.uid, 'patient');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState(null);

  // Separate past sessions from all sessions
  const pastSessions = (sessions || []).filter(s => {
    const sessionDate = s.date?.seconds ? new Date(s.date.seconds * 1000) : new Date(s.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessionDate < today || s.status === 'completed' || s.status === 'cancelled';
  }).sort((a, b) => {
    const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date);
    const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date);
    return dateB - dateA;
  });

  const handleOpenCreateModal = () => {
    setSessionToEdit(null);
    setIsModalOpen(true);
  };
  
  const handleOpenEditModal = (session) => {
    setSessionToEdit(session);
    setIsModalOpen(true);
  };

  const handleSaveSession = async (formData) => {
    if (!currentUser) return;
    
    const sessionData = {
      therapy: formData.therapy,
      date: formData.date, // Store as ISO string
      time: formData.time,
      notes: formData.notes || '',
      practitioner: formData.practitioner,
      practitionerName: formData.practitioner,
      practitionerId: formData.practitionerId || '',
      patientId: currentUser.uid,
      patientName: userProfile?.name || currentUser.displayName || 'Patient',
      duration: formData.duration || '60 minutes',
      location: formData.location || 'Treatment Room A',
      status: formData.status || 'confirmed',
      sessionId: `SES${Date.now()}`,
      preparation: ['Light meal 2 hours before', 'Wear comfortable clothes', 'Arrive 15 minutes early']
    };
    
    try {
      if (sessionToEdit) {
        // Update existing session
        await updateSession(sessionToEdit.id, {
          therapy: sessionData.therapy,
          date: sessionData.date,
          time: sessionData.time,
          notes: sessionData.notes,
          practitioner: sessionData.practitioner,
          practitionerName: sessionData.practitioner,
          practitionerId: sessionData.practitionerId,
          duration: sessionData.duration,
          location: sessionData.location,
        });
      } else {
        // Create new session
        await createSession(sessionData);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save error:', err);
      alert('Could not save the session.');
    }
  };

  const handleCancelSession = async (session) => {
    if (!window.confirm('Are you sure you want to cancel this session?')) return;
    try {
      await updateSession(session.id, { status: 'cancelled' });
    } catch (err) {
      alert('Could not cancel the session.');
    }
  };

  const formatSessionDate = (date) => {
    if (!date) return 'TBD';
    const sessionDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    if (isNaN(sessionDate.getTime())) return 'TBD';
    return sessionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'confirmed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const SessionCard = ({ session, showActions = true }) => (
    <Card className="transition-all hover:shadow-lg border-emerald-100">
      <CardContent className="p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-emerald-900">{session.therapy}</h3>
              <div className="flex items-center text-sm text-gray-500">
                <User className="w-4 h-4 mr-2" />
                <span>With: {session.practitionerName || session.practitioner || 'Assigned Practitioner'}</span>
              </div>
            </div>
            <Badge className={getStatusColor(session.status)}>
              {session.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-emerald-700 border-t border-b border-emerald-50 py-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span>{formatSessionDate(session.date)}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>{session.time || 'TBD'}</span>
            </div>
            {session.location && (
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>{session.location}</span>
              </div>
            )}
          </div>
          
          {/* Preparation Tips */}
          {session.preparation && session.preparation.length > 0 && session.status !== 'completed' && session.status !== 'cancelled' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="font-medium text-amber-900 text-sm mb-1">Pre-therapy Preparation:</p>
              <ul className="space-y-0.5">
                {session.preparation.map((item, idx) => (
                  <li key={idx} className="text-xs text-amber-800 flex items-center space-x-2">
                    <div className="w-1 h-1 bg-amber-600 rounded-full"></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {session.notes && (
            <p className="text-sm text-gray-600 italic">"{session.notes}"</p>
          )}

          {showActions && session.status !== 'completed' && session.status !== 'cancelled' && (
            <div className="flex space-x-3 pt-2">
              <Button size="sm" onClick={() => handleOpenEditModal(session)} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <Edit className="w-4 h-4 mr-2" />Modify
              </Button>
              <Button size="sm" onClick={() => handleCancelSession(session)} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
                <X className="w-4 h-4 mr-2" />Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) return (
    <div className="flex justify-center items-center h-[70vh]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading your sessions...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-8 text-white">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Sessions</h1>
            <p className="text-emerald-100 mt-1">Manage your therapy sessions and track your wellness journey</p>
          </div>
          <Button onClick={handleOpenCreateModal} className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm">
            <Plus className="w-4 h-4 mr-2" />Schedule New Session
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm p-4 text-center rounded-xl">
            <Calendar className="mx-auto w-8 h-8 mb-2" />
            <p className="text-sm text-emerald-100">Upcoming</p>
            <p className="text-2xl font-bold">{(upcomingSessions || []).length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 text-center rounded-xl">
            <CheckCircle className="mx-auto w-8 h-8 mb-2" />
            <p className="text-sm text-emerald-100">Completed</p>
            <p className="text-2xl font-bold">{pastSessions.filter(s => s.status === 'completed').length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 text-center rounded-xl">
            <Clock className="mx-auto w-8 h-8 mb-2" />
            <p className="text-sm text-emerald-100">Total</p>
            <p className="text-2xl font-bold">{(sessions || []).length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 text-center rounded-xl">
            <X className="mx-auto w-8 h-8 mb-2" />
            <p className="text-sm text-emerald-100">Cancelled</p>
            <p className="text-2xl font-bold">{(sessions || []).filter(s => s.status === 'cancelled').length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">Upcoming Sessions ({(upcomingSessions || []).length})</TabsTrigger>
          <TabsTrigger value="previous">Past Sessions ({pastSessions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          {(upcomingSessions || []).length > 0 ? (
            <div className="space-y-4">
              {upcomingSessions.map(s => <SessionCard key={s.id} session={s} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center flex flex-col items-center">
                <Calendar className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">No Upcoming Sessions</h3>
                <p className="text-gray-600 mb-4">You have no sessions scheduled. Book your next therapy session to continue your wellness journey.</p>
                <Button onClick={handleOpenCreateModal} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />Schedule a Session
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="previous">
          {pastSessions.length > 0 ? (
            <div className="space-y-4">
              {pastSessions.map(s => <SessionCard key={s.id} session={s} showActions={false} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p>No completed sessions yet. Your session history will appear here.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      
      <SessionFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleSaveSession} 
        session={sessionToEdit} 
      />
    </div>
  );
}

function SessionFormModal({ isOpen, onClose, onSubmit, session }) {
  const isEditing = !!session;
  const [formData, setFormData] = useState({});
  const { practitioners } = usePractitioners();

  useEffect(() => {
    if (session) {
      // Convert Firestore timestamp to date string for input
      let displayDate = '';
      if (session.date) {
        const d = session.date.seconds ? new Date(session.date.seconds * 1000) : new Date(session.date);
        if (!isNaN(d.getTime())) {
          displayDate = d.toISOString().split('T')[0];
        }
      }

      setFormData({
        therapy: session.therapy || '',
        date: displayDate,
        time: session.time || '',
        notes: session.notes || '',
        practitioner: session.practitionerName || session.practitioner || '',
        practitionerId: session.practitionerId || '',
        duration: session.duration || '60 minutes',
        location: session.location || 'Treatment Room A',
      });
    } else {
      setFormData({
        therapy: '', date: '', time: '', notes: '', 
        practitioner: '', practitionerId: '',
        duration: '60 minutes', location: 'Treatment Room A',
      });
    }
  }, [session, isOpen]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    if (id === 'practitionerId') {
      const selected = practitioners.find(p => p.id === value);
      setFormData(prev => ({
        ...prev,
        practitionerId: value,
        practitioner: selected ? selected.name : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); onSubmit(formData); };

  const therapyOptions = [
    'Abhyanga Massage', 'Shirodhara', 'Basti', 'Swedana',
    'Nasya', 'Vamana', 'Virechana', 'Panchakarma Consultation',
    'Follow-up Consultation', 'Yoga Therapy'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-900">
            {isEditing ? 'Edit Session' : 'Schedule New Session'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="practitionerId">Practitioner</Label>
            <select 
              id="practitionerId" 
              value={formData.practitionerId || ''} 
              onChange={handleChange} 
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 text-gray-800"
              required
            >
              <option value="">Select a Practitioner</option>
              {practitioners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="therapy">Therapy Type</Label>
            <select
              id="therapy"
              value={formData.therapy || ''}
              onChange={handleChange}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 text-gray-800"
              required
            >
              <option value="">Select Therapy</option>
              {therapyOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={formData.date || ''} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" value={formData.time || ''} onChange={handleChange} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <select
                id="duration"
                value={formData.duration || '60 minutes'}
                onChange={handleChange}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm text-gray-800"
              >
                <option value="30 minutes">30 minutes</option>
                <option value="45 minutes">45 minutes</option>
                <option value="60 minutes">60 minutes</option>
                <option value="90 minutes">90 minutes</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={formData.location || ''} onChange={handleChange} placeholder="Treatment Room A" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea id="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Any additional notes for your practitioner..." rows={3} />
          </div>
          <DialogFooter className="pt-2">
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
              {isEditing ? 'Save Changes' : 'Schedule Session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}