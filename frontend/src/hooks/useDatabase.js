import { useState, useEffect, useCallback } from 'react';
import { 
  userService, 
  sessionService, 
  notificationService, 
  feedbackService, 
  notesService,
  progressService,
  taskService,
  documentService,
  messageService,
  subscribeToUserNotifications,
  subscribeToUserSessions
} from '../services/database';

// Hook for user data operations
export const useUser = (userId) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await userService.getUser(userId);
    if (result.success) { setUser(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const updateUser = async (updates) => {
    const result = await userService.updateUser(userId, updates);
    if (result.success) { setUser(prev => ({ ...prev, ...updates })); }
    return result;
  };

  return { user, loading, error, updateUser, refresh: fetchUser };
};

// Hook for sessions data
export const useSessions = (userId, userType) => {
  const [sessions, setSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    if (!userId || !userType) { setLoading(false); return; }
    setLoading(true);

    const sessionsResult = await sessionService.getUserSessions(userId, userType);
    if (sessionsResult.success) { setSessions(sessionsResult.data); }
    else { setError(sessionsResult.error); }

    const upcomingResult = await sessionService.getUpcomingSessions(userId, userType);
    if (upcomingResult.success) { setUpcomingSessions(upcomingResult.data); }

    setLoading(false);
  }, [userId, userType]);

  useEffect(() => {
    fetchSessions();

    if (!userId || !userType) return;

    const unsubscribe = subscribeToUserSessions(userId, userType, (updatedSessions) => {
      setSessions(updatedSessions);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = updatedSessions.filter(session => {
        const sessionDate = session.date?.seconds 
          ? new Date(session.date.seconds * 1000) 
          : new Date(session.date);
        return sessionDate >= today && session.status !== 'cancelled';
      }).sort((a, b) => {
        const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date);
        const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date);
        return dateA - dateB;
      });
      setUpcomingSessions(upcoming);
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [userId, userType, fetchSessions]);

  const createSession = async (sessionData) => {
    const result = await sessionService.createSession(sessionData);
    if (result.success) await fetchSessions();
    return result;
  };

  const updateSession = async (sessionId, updates) => {
    const result = await sessionService.updateSession(sessionId, updates);
    if (result.success) await fetchSessions();
    return result;
  };

  const deleteSession = async (sessionId) => {
    const result = await sessionService.deleteSession(sessionId);
    if (result.success) await fetchSessions();
    return result;
  };

  return { 
    sessions, upcomingSessions, loading, error, 
    createSession, updateSession, deleteSession, 
    refresh: fetchSessions 
  };
};

// Hook for notifications
export const useNotifications = (userId) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await notificationService.getUserNotifications(userId);
    if (result.success) {
      setNotifications(result.data);
      setUnreadCount(result.data.filter(n => !n.read).length);
      setError(null);
    } else { setError(result.error); }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();

    if (!userId) return;

    const unsubscribe = subscribeToUserNotifications(userId, (unreadNotifications) => {
      setUnreadCount(unreadNotifications.length);
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [userId, fetchNotifications]);

  const markAsRead = async (notificationId) => {
    const result = await notificationService.markAsRead(notificationId);
    if (result.success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    return result;
  };

  const markAllAsRead = async () => {
    const result = await notificationService.markAllAsRead(userId);
    if (result.success) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
    return result;
  };

  const createNotification = async (notificationData) => {
    const result = await notificationService.createNotification(notificationData);
    if (result.success) await fetchNotifications();
    return result;
  };

  return { 
    notifications, unreadCount, loading, error, 
    markAsRead, markAllAsRead, createNotification, 
    refresh: fetchNotifications 
  };
};

// Hook for feedback data
export const useFeedback = (userId, sessionId = null) => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeedback = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    let result;
    if (sessionId) {
      result = await feedbackService.getSessionFeedback(sessionId);
    } else {
      result = await feedbackService.getUserFeedback(userId);
    }
    if (result.success) { setFeedback(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [userId, sessionId]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const createFeedback = async (feedbackData) => {
    const result = await feedbackService.createFeedback(feedbackData);
    if (result.success) {
      setFeedback(prev => [{ ...feedbackData, id: result.id }, ...prev]);
    }
    return result;
  };

  return { feedback, loading, error, createFeedback, refresh: fetchFeedback };
};

// Hook for practitioner feedback
export const usePractitionerFeedback = (practitionerId) => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeedback = useCallback(async () => {
    if (!practitionerId) { setLoading(false); return; }
    setLoading(true);
    const result = await feedbackService.getPractitionerFeedback(practitionerId);
    if (result.success) { setFeedback(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [practitionerId]);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  return { feedback, loading, error, refresh: fetchFeedback };
};

// Hook for patient notes
export const useNotes = (patientId, practitionerId = null) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotes = useCallback(async () => {
    if (!patientId && !practitionerId) { setLoading(false); return; }
    setLoading(true);
    let result;
    if (practitionerId && !patientId) {
      result = await notesService.getPractitionerNotes(practitionerId);
    } else {
      result = await notesService.getPatientNotes(patientId);
    }
    if (result.success) { setNotes(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [patientId, practitionerId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const createNote = async (noteData) => {
    const result = await notesService.createNote(noteData);
    if (result.success) {
      setNotes(prev => [{ ...noteData, id: result.id }, ...prev]);
    }
    return result;
  };

  const updateNote = async (noteId, updates) => {
    const result = await notesService.updateNote(noteId, updates);
    if (result.success) {
      setNotes(prev => prev.map(note => note.id === noteId ? { ...note, ...updates } : note));
    }
    return result;
  };

  const deleteNote = async (noteId) => {
    const result = await notesService.deleteNote(noteId);
    if (result.success) {
      setNotes(prev => prev.filter(note => note.id !== noteId));
    }
    return result;
  };

  return { notes, loading, error, createNote, updateNote, deleteNote, refresh: fetchNotes };
};

// Hook for progress data
export const useProgress = (userId) => {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProgress = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await progressService.getProgress(userId);
    if (result.success) { setProgress(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const updateProgress = async (progressData) => {
    const result = await progressService.updateProgress(userId, progressData);
    if (result.success) { setProgress(prev => ({ ...prev, ...progressData })); }
    return result;
  };

  return { progress, loading, error, updateProgress, refresh: fetchProgress };
};

// Hook for patients list (for practitioners)
export const usePatients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    const result = await userService.getAllPatients();
    if (result.success) { setPatients(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  return { patients, loading, error, refresh: fetchPatients };
};

// Hook for practitioners list
export const usePractitioners = () => {
  const [practitioners, setPractitioners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPractitioners = useCallback(async () => {
    setLoading(true);
    const result = await userService.getAllPractitioners();
    if (result.success) { setPractitioners(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPractitioners(); }, [fetchPractitioners]);

  return { practitioners, loading, error, refresh: fetchPractitioners };
};

// Hook for tasks
export const useTasks = (userId) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await taskService.getUserTasks(userId);
    if (result.success) { setTasks(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const createTask = async (taskData) => {
    const result = await taskService.createTask({ ...taskData, userId });
    if (result.success) await fetchTasks();
    return result;
  };

  const updateTask = async (taskId, updates) => {
    const result = await taskService.updateTask(taskId, updates);
    if (result.success) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    }
    return result;
  };

  const deleteTask = async (taskId) => {
    const result = await taskService.deleteTask(taskId);
    if (result.success) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
    return result;
  };

  const toggleTask = async (taskId, completed) => {
    const result = await taskService.toggleTaskComplete(taskId, completed);
    if (result.success) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed } : t));
    }
    return result;
  };

  return { tasks, loading, error, createTask, updateTask, deleteTask, toggleTask, refresh: fetchTasks };
};

// Hook for documents
export const useDocuments = (userId) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await documentService.getUserDocuments(userId);
    if (result.success) { setDocuments(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const createDocument = async (docData) => {
    const result = await documentService.createDocumentRecord({ ...docData, userId });
    if (result.success) await fetchDocuments();
    return result;
  };

  const deleteDocument = async (docId) => {
    const result = await documentService.deleteDocument(docId);
    if (result.success) {
      setDocuments(prev => prev.filter(d => d.id !== docId));
    }
    return result;
  };

  return { documents, loading, error, createDocument, deleteDocument, refresh: fetchDocuments };
};

// Hook for messages/conversations
export const useMessages = (userId) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const result = await messageService.getUserConversations(userId);
    if (result.success) { setConversations(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const sendMessage = async (messageData) => {
    const result = await messageService.sendMessage(messageData);
    if (result.success) await fetchConversations();
    return result;
  };

  const getConversation = async (partnerId) => {
    return await messageService.getConversation(userId, partnerId);
  };

  return { conversations, loading, error, sendMessage, getConversation, refresh: fetchConversations };
};

// Hook for all sessions (practitioner analytics)
export const useAllSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const result = await sessionService.getAllSessions();
    if (result.success) { setSessions(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return { sessions, loading, error, refresh: fetchSessions };
};

// Hook for all feedback (practitioner view)
export const useAllFeedback = () => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    const result = await feedbackService.getAllFeedback();
    if (result.success) { setFeedback(result.data); setError(null); }
    else { setError(result.error); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  return { feedback, loading, error, refresh: fetchFeedback };
};