import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',           // Index collection with minimal data
  PATIENTS: 'patients',     // Patient-specific data
  PRACTITIONERS: 'practitioners', // Practitioner-specific data
  SESSIONS: 'sessions',
  NOTIFICATIONS: 'notifications',
  FEEDBACK: 'feedback',
  NOTES: 'notes',
  MESSAGES: 'messages',
  PROGRESS: 'progress',
  RECIPES: 'recipes',
  ANALYTICS: 'analytics',
  TASKS: 'tasks',
  DOCUMENTS: 'documents'
};

// ==========================================
// User Operations (Index Collection)
// ==========================================
export const userService = {
  async createUserIndex(userData) {
    try {
      // Create minimal user index with just uid, email, and role
      const userIndex = {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        userType: userData.userType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, COLLECTIONS.USERS, userData.uid), userIndex);
      
      // Create role-specific document
      const roleCollection = userData.userType === 'patient' ? COLLECTIONS.PATIENTS : COLLECTIONS.PRACTITIONERS;
      const roleData = {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add allowedPractitionerIds for patients (empty initially)
      if (userData.userType === 'patient') {
        roleData.allowedPractitionerIds = [];
      }
      
      await setDoc(doc(db, roleCollection, userData.uid), roleData);
      
      return { success: true };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserByRole(uid, userType) {
    try {
      const col = userType === 'patient' ? COLLECTIONS.PATIENTS : COLLECTIONS.PRACTITIONERS;
      const userDoc = await getDoc(doc(db, col, uid));
      if (userDoc.exists()) {
        return { success: true, data: { id: userDoc.id, ...userDoc.data() } };
      }
      return { success: false, error: 'User profile not found' };
    } catch (error) {
      console.error('Error getting user by role:', error);
      return { success: false, error: error.message };
    }
  },

  async updateUserByRole(uid, userType, updates) {
    try {
      const col = userType === 'patient' ? COLLECTIONS.PATIENTS : COLLECTIONS.PRACTITIONERS;
      await updateDoc(doc(db, col, uid), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      // Update name in index if changed
      if (updates.name) {
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
          name: updates.name,
          updatedAt: serverTimestamp()
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating user by role:', error);
      return { success: false, error: error.message };
    }
  },

  // Legacy methods for backward compatibility
  async createUser(userData) {
    return this.createUserIndex(userData);
  },

  async getUser(uid) {
    try {
      // First get user index to determine role
      const userIndex = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (!userIndex.exists()) {
        return { success: false, error: 'User not found' };
      }
      
      const indexData = userIndex.data();
      // Then get full profile from role-specific collection
      return this.getUserByRole(uid, indexData.userType);
    } catch (error) {
      console.error('Error getting user:', error);
      return { success: false, error: error.message };
    }
  },

  async updateUser(uid, updates) {
    try {
      // Get user type from index
      const userIndex = await getDoc(doc(db, COLLECTIONS.USERS, uid));
      if (!userIndex.exists()) {
        return { success: false, error: 'User not found' };
      }
      
      const indexData = userIndex.data();
      return this.updateUserByRole(uid, indexData.userType, updates);
    } catch (error) {
      console.error('Error updating user:', error);
      return { success: false, error: error.message };
    }
  },

  async getAllPatients() {
    try {
      const q = query(collection(db, COLLECTIONS.PATIENTS));
      const snapshot = await getDocs(q);
      const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort client-side to avoid composite index
      patients.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      return { success: true, data: patients };
    } catch (error) {
      console.error('Error getting patients:', error);
      return { success: false, error: error.message };
    }
  },

  async getAllPractitioners() {
    try {
      const q = query(collection(db, COLLECTIONS.PRACTITIONERS));
      const snapshot = await getDocs(q);
      const practitioners = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      practitioners.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      return { success: true, data: practitioners };
    } catch (error) {
      console.error('Error getting practitioners:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Session Operations
// ==========================================
export const sessionService = {
  async createSession(sessionData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.SESSIONS), {
        ...sessionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating session:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserSessions(userId, userType) {
    try {
      const field = userType === 'patient' ? 'patientId' : 'practitionerId';
      const q = query(
        collection(db, COLLECTIONS.SESSIONS),
        where(field, '==', userId)
      );
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date);
          const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date);
          return dateB - dateA; // Sort by date desc
        });
      return { success: true, data: sessions };
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return { success: false, error: error.message };
    }
  },

  async getAllSessions() {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.SESSIONS));
      const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date);
          const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date);
          return dateB - dateA;
        });
      return { success: true, data: sessions };
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return { success: false, error: error.message };
    }
  },

  async updateSession(sessionId, updates) {
    try {
      await updateDoc(doc(db, COLLECTIONS.SESSIONS, sessionId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating session:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteSession(sessionId) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.SESSIONS, sessionId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting session:', error);
      return { success: false, error: error.message };
    }
  },

  async getUpcomingSessions(userId, userType) {
    try {
      const field = userType === 'patient' ? 'patientId' : 'practitionerId';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const q = query(
        collection(db, COLLECTIONS.SESSIONS),
        where(field, '==', userId)
      );
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(session => {
          const sessionDate = session.date?.seconds ? new Date(session.date.seconds * 1000) : new Date(session.date);
          return sessionDate >= today && session.status !== 'cancelled';
        })
        .sort((a, b) => {
          const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date);
          const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date);
          return dateA - dateB; // Sort by date asc
        })
        .slice(0, 10);
      return { success: true, data: sessions };
    } catch (error) {
      console.error('Error getting upcoming sessions:', error);
      return { success: false, error: error.message };
    }
  },

  async getSessionsByDateRange(userId, userType, startDate, endDate) {
    try {
      const field = userType === 'patient' ? 'patientId' : 'practitionerId';
      const q = query(
        collection(db, COLLECTIONS.SESSIONS),
        where(field, '==', userId)
      );
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(session => {
          const sessionDate = session.date?.seconds ? new Date(session.date.seconds * 1000) : new Date(session.date);
          return sessionDate >= startDate && sessionDate <= endDate;
        })
        .sort((a, b) => {
          const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date);
          const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date);
          return dateA - dateB;
        });
      return { success: true, data: sessions };
    } catch (error) {
      console.error('Error getting sessions by date range:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Notification Operations
// ==========================================
export const notificationService = {
  async createNotification(notificationData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        ...notificationData,
        createdAt: serverTimestamp(),
        read: false
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserNotifications(userId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
          return timeB - timeA;
        })
        .slice(0, 50);
      return { success: true, data: notifications };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return { success: false, error: error.message };
    }
  },

  async markAsRead(notificationId) {
    try {
      await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
        read: true,
        readAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  },

  async markAllAsRead(userId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const unread = snapshot.docs.filter(d => !d.data().read);
      for (const d of unread) {
        await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, d.id), {
          read: true,
          readAt: serverTimestamp()
        });
      }
      return { success: true, count: unread.length };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteNotification(notificationId) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Feedback Operations
// ==========================================
export const feedbackService = {
  async createFeedback(feedbackData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.FEEDBACK), {
        ...feedbackData,
        createdAt: serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating feedback:', error);
      return { success: false, error: error.message };
    }
  },

  async getSessionFeedback(sessionId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.FEEDBACK),
        where('sessionId', '==', sessionId)
      );
      const snapshot = await getDocs(q);
      const feedback = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, data: feedback };
    } catch (error) {
      console.error('Error getting feedback:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserFeedback(userId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.FEEDBACK),
        where('patientId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const feedback = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      return { success: true, data: feedback };
    } catch (error) {
      console.error('Error getting user feedback:', error);
      return { success: false, error: error.message };
    }
  },

  async getAllFeedback() {
    try {
      const snapshot = await getDocs(collection(db, COLLECTIONS.FEEDBACK));
      const feedback = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      return { success: true, data: feedback };
    } catch (error) {
      console.error('Error getting all feedback:', error);
      return { success: false, error: error.message };
    }
  },

  async getPractitionerFeedback(practitionerId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.FEEDBACK),
        where('practitionerId', '==', practitionerId)
      );
      const snapshot = await getDocs(q);
      const feedback = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      return { success: true, data: feedback };
    } catch (error) {
      console.error('Error getting practitioner feedback:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Notes Operations
// ==========================================
export const notesService = {
  async createNote(noteData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.NOTES), {
        ...noteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating note:', error);
      return { success: false, error: error.message };
    }
  },

  async getPatientNotes(patientId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.NOTES),
        where('patientId', '==', patientId)
      );
      const snapshot = await getDocs(q);
      const notes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      return { success: true, data: notes };
    } catch (error) {
      console.error('Error getting patient notes:', error);
      return { success: false, error: error.message };
    }
  },

  async getPractitionerNotes(practitionerId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.NOTES),
        where('practitionerId', '==', practitionerId)
      );
      const snapshot = await getDocs(q);
      const notes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      return { success: true, data: notes };
    } catch (error) {
      console.error('Error getting practitioner notes:', error);
      return { success: false, error: error.message };
    }
  },

  async updateNote(noteId, updates) {
    try {
      await updateDoc(doc(db, COLLECTIONS.NOTES, noteId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating note:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteNote(noteId) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.NOTES, noteId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting note:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Messages Operations
// ==========================================
export const messageService = {
  async sendMessage(messageData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
        ...messageData,
        createdAt: serverTimestamp(),
        status: 'sent'
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  },

  async getConversation(userId1, userId2) {
    try {
      // Get messages where user1 is sender and user2 is receiver, and vice versa
      const q1 = query(
        collection(db, COLLECTIONS.MESSAGES),
        where('senderId', '==', userId1),
        where('receiverId', '==', userId2)
      );
      const q2 = query(
        collection(db, COLLECTIONS.MESSAGES),
        where('senderId', '==', userId2),
        where('receiverId', '==', userId1)
      );
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const messages = [
        ...snapshot1.docs.map(d => ({ id: d.id, ...d.data() })),
        ...snapshot2.docs.map(d => ({ id: d.id, ...d.data() }))
      ].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB; // oldest first
      });
      
      return { success: true, data: messages };
    } catch (error) {
      console.error('Error getting conversation:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserConversations(userId) {
    try {
      // Get all messages where user is sender or receiver
      const q1 = query(
        collection(db, COLLECTIONS.MESSAGES),
        where('senderId', '==', userId)
      );
      const q2 = query(
        collection(db, COLLECTIONS.MESSAGES),
        where('receiverId', '==', userId)
      );
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const allMessages = [
        ...snapshot1.docs.map(d => ({ id: d.id, ...d.data() })),
        ...snapshot2.docs.map(d => ({ id: d.id, ...d.data() }))
      ];
      
      // Group by conversation partner
      const conversations = {};
      allMessages.forEach(msg => {
        const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        const partnerName = msg.senderId === userId ? msg.receiverName : msg.senderName;
        if (!conversations[partnerId] || 
            (msg.createdAt?.seconds || 0) > (conversations[partnerId].lastMessage?.createdAt?.seconds || 0)) {
          conversations[partnerId] = {
            partnerId,
            partnerName: partnerName || 'Unknown',
            lastMessage: msg,
            unreadCount: 0
          };
        }
        if (msg.receiverId === userId && msg.status !== 'read') {
          conversations[partnerId].unreadCount = (conversations[partnerId].unreadCount || 0) + 1;
        }
      });
      
      return { success: true, data: Object.values(conversations) };
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return { success: false, error: error.message };
    }
  },

  async markMessageAsRead(messageId) {
    try {
      await updateDoc(doc(db, COLLECTIONS.MESSAGES, messageId), {
        status: 'read',
        readAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error marking message as read:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Progress Operations
// ==========================================
export const progressService = {
  async updateProgress(userId, progressData) {
    try {
      await setDoc(doc(db, COLLECTIONS.PROGRESS, userId), {
        ...progressData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error('Error updating progress:', error);
      return { success: false, error: error.message };
    }
  },

  async getProgress(userId) {
    try {
      const progressDoc = await getDoc(doc(db, COLLECTIONS.PROGRESS, userId));
      if (progressDoc.exists()) {
        return { success: true, data: progressDoc.data() };
      }
      return { success: false, error: 'Progress not found' };
    } catch (error) {
      console.error('Error getting progress:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Task Operations
// ==========================================
export const taskService = {
  async createTask(taskData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.TASKS), {
        ...taskData,
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating task:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserTasks(userId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.TASKS),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      return { success: true, data: tasks };
    } catch (error) {
      console.error('Error getting tasks:', error);
      return { success: false, error: error.message };
    }
  },

  async updateTask(taskId, updates) {
    try {
      await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating task:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteTask(taskId) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.TASKS, taskId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting task:', error);
      return { success: false, error: error.message };
    }
  },

  async toggleTaskComplete(taskId, completed) {
    try {
      await updateDoc(doc(db, COLLECTIONS.TASKS, taskId), {
        completed,
        completedAt: completed ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Error toggling task:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Document Metadata Operations
// ==========================================
export const documentService = {
  async createDocumentRecord(docData) {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), {
        ...docData,
        createdAt: serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creating document record:', error);
      return { success: false, error: error.message };
    }
  },

  async getUserDocuments(userId) {
    try {
      const q = query(
        collection(db, COLLECTIONS.DOCUMENTS),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
      return { success: true, data: docs };
    } catch (error) {
      console.error('Error getting documents:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteDocument(docId) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, docId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Patient-specific operations
// ==========================================
export const patientService = {
  async getPatient(uid) {
    return userService.getUserByRole(uid, 'patient');
  },

  async updatePatient(uid, updates) {
    return userService.updateUserByRole(uid, 'patient', updates);
  },

  async assignPractitioner(patientUid, practitionerUid) {
    try {
      const patientResult = await this.getPatient(patientUid);
      if (!patientResult.success) {
        return { success: false, error: 'Patient not found' };
      }

      const currentAllowed = patientResult.data.allowedPractitionerIds || [];
      if (!currentAllowed.includes(practitionerUid)) {
        const updatedAllowed = [...currentAllowed, practitionerUid];
        return this.updatePatient(patientUid, { 
          allowedPractitionerIds: updatedAllowed 
        });
      }
      return { success: true, message: 'Practitioner already assigned' };
    } catch (error) {
      console.error('Error assigning practitioner:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Practitioner-specific operations
// ==========================================
export const practitionerService = {
  async getPractitioner(uid) {
    return userService.getUserByRole(uid, 'practitioner');
  },

  async updatePractitioner(uid, updates) {
    return userService.updateUserByRole(uid, 'practitioner', updates);
  },

  async getAssignedPatients(practitionerUid) {
    try {
      const q = query(
        collection(db, COLLECTIONS.PATIENTS),
        where('allowedPractitionerIds', 'array-contains', practitionerUid)
      );
      const snapshot = await getDocs(q);
      const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, data: patients };
    } catch (error) {
      console.error('Error getting assigned patients:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Migration helper function
// ==========================================
export const migrationService = {
  async migrateExistingUsers() {
    try {
      console.log('Starting user migration to role-based collections...');
      
      const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
      let migratedCount = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const uid = userDoc.id;
        
        const roleCollection = userData.userType === 'patient' ? COLLECTIONS.PATIENTS : COLLECTIONS.PRACTITIONERS;
        const roleDoc = await getDoc(doc(db, roleCollection, uid));
        
        if (!roleDoc.exists()) {
          const roleData = {
            ...userData,
            updatedAt: serverTimestamp()
          };
          
          if (userData.userType === 'patient') {
            roleData.allowedPractitionerIds = [];
          }
          
          await setDoc(doc(db, roleCollection, uid), roleData);
          migratedCount++;
          
          const userIndex = {
            uid: userData.uid,
            email: userData.email,
            name: userData.name,
            userType: userData.userType,
            createdAt: userData.createdAt,
            updatedAt: serverTimestamp()
          };
          
          await setDoc(doc(db, COLLECTIONS.USERS, uid), userIndex);
          console.log(`Migrated ${userData.userType}: ${userData.name}`);
        }
      }
      
      console.log(`Migration completed. Migrated ${migratedCount} users.`);
      return { success: true, migratedCount };
    } catch (error) {
      console.error('Migration error:', error);
      return { success: false, error: error.message };
    }
  }
};

// ==========================================
// Real-time listeners
// ==========================================
export const subscribeToUserNotifications = (userId, callback) => {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', userId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(n => !n.read)
      .sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
        return timeB - timeA;
      });
    callback(notifications);
  });
};

export const subscribeToUserSessions = (userId, userType, callback) => {
  const field = userType === 'patient' ? 'patientId' : 'practitionerId';
  const q = query(
    collection(db, COLLECTIONS.SESSIONS),
    where(field, '==', userId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const dateA = a.date?.seconds ? new Date(a.date.seconds * 1000) : new Date(a.date);
        const dateB = b.date?.seconds ? new Date(b.date.seconds * 1000) : new Date(b.date);
        return dateB - dateA;
      });
    callback(sessions);
  });
};

export const subscribeToConversation = (userId1, userId2, callback) => {
  // Listen to messages in both directions
  const q1 = query(
    collection(db, COLLECTIONS.MESSAGES),
    where('senderId', '==', userId1),
    where('receiverId', '==', userId2)
  );
  
  const unsub1 = onSnapshot(q1, () => {
    // Refetch full conversation on any change
    messageService.getConversation(userId1, userId2).then(result => {
      if (result.success) callback(result.data);
    });
  });
  
  const q2 = query(
    collection(db, COLLECTIONS.MESSAGES),
    where('senderId', '==', userId2),
    where('receiverId', '==', userId1)
  );
  
  const unsub2 = onSnapshot(q2, () => {
    messageService.getConversation(userId1, userId2).then(result => {
      if (result.success) callback(result.data);
    });
  });
  
  return () => { unsub1(); unsub2(); };
};