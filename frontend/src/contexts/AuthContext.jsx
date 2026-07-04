import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  deleteUser,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { userService, migrationService } from '../services/database';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // More graceful error handling during development
    console.error('useAuth must be used within an AuthProvider');
    return {
      currentUser: null,
      userProfile: null,
      loading: true,
      signup: () => {},
      login: () => {},
      logout: () => {},
      resetPassword: () => {},
      deleteAccount: () => {},
      runMigration: () => {}
    };
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const selectedLoginRoleRef = React.useRef(null);

  // Sign up function
  async function signup(email, password, userData) {
    // Set role ref BEFORE creating the user, because onAuthStateChanged fires
    // immediately after createUserWithEmailAndPassword and needs to know the role
    selectedLoginRoleRef.current = userData.userType || 'patient';

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update user profile with display name
    await updateProfile(user, {
      displayName: userData.name
    });

    // Save additional user data to Firestore (excluding password and other sensitive data)
    const userDocData = {
      uid: user.uid,
      email: user.email,
      name: userData.name,
      userType: userData.userType,
      createdAt: serverTimestamp(),
      // Include additional profile data but exclude sensitive fields
      ...(userData.phone && { phone: userData.phone }),
      ...(userData.age && { age: userData.age }),
      ...(userData.gender && { gender: userData.gender }),
      ...(userData.dosha && { dosha: userData.dosha }),
      ...(userData.medicalHistory && { medicalHistory: userData.medicalHistory }),
      ...(userData.specialization && { specialization: userData.specialization }),
      ...(userData.experience && { experience: userData.experience })
    };

    // Use the new role-based schema
    const result = await userService.createUserIndex(userDocData);
    if (!result.success) {
      throw new Error(`Failed to create user profile: ${result.error}`);
    }

    // Manually set the profile now so we don't rely on the onAuthStateChanged race
    setUserProfile(userDocData);
    
    return userCredential;
  }

  // Login function with role validation
  async function login(email, password, role = null) {
    selectedLoginRoleRef.current = role;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    
    // Validate role if one was selected
    if (role) {
      try {
        const userIndex = await getDoc(doc(db, 'users', credential.user.uid));
        if (userIndex.exists()) {
          const storedRole = userIndex.data().userType;
          if (storedRole && storedRole !== role) {
            // Role mismatch — sign out and throw error
            await signOut(auth);
            const correctRole = storedRole === 'patient' ? 'Patient' : 'Practitioner';
            throw { 
              code: 'auth/role-mismatch', 
              message: `This account is registered as a ${correctRole}. Please select "${correctRole}" and try again.` 
            };
          }
        }
      } catch (error) {
        if (error.code === 'auth/role-mismatch') {
          throw error;
        }
        // If we can't check role (network issue etc.), allow login to proceed
        console.warn('Could not verify role during login:', error);
      }
    }
    
    return credential;
  }

  // Logout function
  function logout() {
    return signOut(auth);
  }

  // Reset password function
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Delete account function
  async function deleteAccount() {
    if (currentUser) {
      // Note: deleteUser() requires recent authentication
      // In a production app, you should prompt for re-authentication before deletion
      try {
        // Optionally soft-delete user document instead of hard delete
        // This preserves data integrity for related records
        await setDoc(doc(db, 'users', currentUser.uid), {
          deletedAt: serverTimestamp(),
          active: false
        }, { merge: true });
        
        // Delete the user account from Firebase Auth
        await deleteUser(currentUser);
      } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
          throw new Error('Please log in again before deleting your account for security.');
        }
        throw error;
      }
    }
  }

  // Load user profile from Firestore
  async function loadUserProfile(uid, user = null, selectedRole = null) {
    try {
      console.log('🔍 Loading user profile for UID:', uid, 'Selected Role:', selectedRole);
      console.log('👤 Auth user details:', user);
      
      // If a role was selected at login, try direct lookup from that role collection first
      if (selectedRole) {
        const roleResult = await userService.getUserByRole(uid, selectedRole);
        if (roleResult.success) {
          console.log(`✅ Found user in selected role collection (${selectedRole})`);
          setUserProfile(roleResult.data);
          return;
        }
      }
      
      // Try to get user profile using the database service
      const result = await userService.getUser(uid);
      console.log('📊 Database result:', result);
      
      // If the main lookup fails, try to find the user directly in both collections
      if (!result.success) {
        console.log('⚠️ Main lookup failed, trying direct collection lookup...');
        
        // Try practitioners collection first
        const practitionerResult = await userService.getUserByRole(uid, 'practitioner');
        console.log('🩺 Practitioner lookup result:', practitionerResult);
        
        if (practitionerResult.success) {
          console.log('✅ Found user in practitioners collection');
          setUserProfile(practitionerResult.data);
          return;
        }
        
        // Try patients collection
        const patientResult = await userService.getUserByRole(uid, 'patient');
        console.log('🏥 Patient lookup result:', patientResult);
        
        if (patientResult.success) {
          console.log('✅ Found user in patients collection');
          setUserProfile(patientResult.data);
          return;
        }
        
        console.log('❌ User not found in any collection, will create default profile');
      }
      
      if (result.success) {
        console.log('✅ User profile loaded successfully:', result.data);
        setUserProfile(result.data);
      } else {
        // User profile doesn't exist, create a default profile with correct role
        const chosenRole = selectedRole || 'patient';
        console.warn(`User profile not found, creating default ${chosenRole} profile`);
        
        // Extract name from email if displayName is not available
        const authUser = user;
        const emailName = authUser?.email ? authUser.email.split('@')[0] : '';
        const displayName = authUser?.displayName;
        const derivedName = emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : '';
        const userName = displayName || derivedName || `New ${chosenRole === 'patient' ? 'Patient' : 'Practitioner'}`;
        
        console.log('🔧 Name extraction debug:', { 
          displayName, 
          emailName, 
          derivedName, 
          finalUserName: userName 
        });
        
        const defaultProfile = {
          uid: uid,
          email: authUser?.email || '',
          name: userName,
          userType: chosenRole,
          createdAt: serverTimestamp()
        };

        if (chosenRole === 'patient') {
          defaultProfile.dosha = null;
        } else {
          defaultProfile.specialization = 'General';
          defaultProfile.experience = '1';
        }
        
        // Save using database service
        const createResult = await userService.createUser(defaultProfile);
        console.log('💾 Create user result:', createResult);
        if (createResult.success) {
          setUserProfile(defaultProfile);
          console.log('✅ Created new user profile:', userName);
        } else {
          // Fallback to temporary profile
          setUserProfile({ ...defaultProfile, isTemporary: true });
          console.warn('⚠️ Using temporary profile');
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      
      // Fallback: create a better temporary profile for this session
      const chosenRole = selectedRole || 'patient';
      const authUser = user;
      const emailName = authUser?.email ? authUser.email.split('@')[0] : '';
      const displayName = authUser?.displayName;
      const derivedName = emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : '';
      const userName = displayName || derivedName || `New ${chosenRole === 'patient' ? 'Patient' : 'Practitioner'}`;
      
      console.log('🔧 Fallback name extraction debug:', { 
        displayName, 
        emailName, 
        derivedName, 
        finalUserName: userName 
      });
      
      const fallbackProfile = {
        uid: uid,
        email: authUser?.email || '',
        name: userName,
        userType: chosenRole,
        createdAt: serverTimestamp(),
        isTemporary: true
      };

      if (chosenRole === 'patient') {
        fallbackProfile.dosha = null;
      } else {
        fallbackProfile.specialization = 'General';
        fallbackProfile.experience = '1';
      }

      setUserProfile(fallbackProfile);
      console.warn('Using fallback profile due to Firestore connection issues');
    }
  }

  useEffect(() => {
    // Seeding is disabled by user request to keep the database completely fresh.

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user ? `User logged in: ${user.email}` : 'User logged out');
      setCurrentUser(user);
      if (user) {
        console.log('👤 User details:', { 
          uid: user.uid, 
          email: user.email, 
          displayName: user.displayName 
        });
        await loadUserProfile(user.uid, user, selectedLoginRoleRef.current);
        selectedLoginRoleRef.current = null;
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    login,
    logout,
    resetPassword,
    deleteAccount,
    loading,
    // Migration utility for development
    runMigration: migrationService.migrateExistingUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}