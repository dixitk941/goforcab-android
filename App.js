import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, Alert, StatusBar, Appearance, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { db } from './firebase';
import { doc, setDoc, serverTimestamp, getDoc, query, collection, where, getDocs } from 'firebase/firestore';

const WebsiteContainer = ({ onUserIdReceived }) => {
  const webViewRef = useRef(null);

  const handleShouldStartLoadWithRequest = (event) => {
    const { url } = event;
    logActivity(`Navigating to URL: ${url}`);
    return true;
  };

  const logActivity = (activity) => {
    console.log(activity);
  };

  // Updated JavaScript to inject into the WebView to detect Firebase Phone Auth user IDs
  const INJECT_JS = `
    (function() {
      // Debug function to help identify how user is stored
      function debugAuthStorage() {
        try {
          // Log all localStorage keys for debugging
          const allKeys = Object.keys(localStorage);
          console.log('All localStorage keys:', allKeys);
          
          // Look specifically for Firebase keys
          const firebaseKeys = allKeys.filter(key => key.includes('firebase'));
          console.log('Firebase related localStorage keys:', firebaseKeys);
          
          // Check if Firebase auth is available in window
          console.log('Firebase in window:', !!window.firebase);
          console.log('Firebase auth in window:', !!(window.firebase && window.firebase.auth));
          
          if (window.firebase && window.firebase.auth) {
            console.log('Current user via API:', window.firebase.auth().currentUser);
          }
          
          // Try a few known patterns
          firebaseKeys.forEach(key => {
            try {
              const value = localStorage.getItem(key);
              console.log("Key: " + key + ", Value: " + value.substring(0, 50) + "...");
            } catch(e) {
              console.log("Error reading key " + key + ":", e);
            }
          });
          
          // Look for phone auth specific elements
          const phoneInputs = document.querySelectorAll('input[type="tel"]');
          if (phoneInputs.length > 0) {
            console.log("Found phone input fields:", phoneInputs.length);
          }
          
          // Check for recaptcha container
          const recaptchaContainer = document.getElementById('recaptcha-container');
          if (recaptchaContainer) {
            console.log("Found reCAPTCHA container");
          }
          
          // Send debug info to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'debug', 
            data: { 
              allKeys,
              firebaseKeys,
              hasFirebase: !!window.firebase,
              hasAuth: !!(window.firebase && window.firebase.auth),
              hasPhoneInputs: phoneInputs.length > 0,
              hasRecaptchaContainer: !!recaptchaContainer
            }
          }));
        } catch(e) {
          console.error('Debug error:', e);
        }
      }
      
      // Main function to extract user ID - updated for phone auth
      function extractUserId() {
        try {
          let userId = null;
          
          // Method 1: Direct Firebase Auth API access
          if (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
            userId = window.firebase.auth().currentUser.uid;
            const phoneNumber = window.firebase.auth().currentUser.phoneNumber;
            console.log('Found user ID via Firebase API:', userId, 'Phone:', phoneNumber);
          }
          
          // Method 2: Check localStorage for standard Firebase Auth pattern
          if (!userId) {
            const firebaseAuthKeys = Object.keys(localStorage).filter(key => 
              key.startsWith('firebase:authUser:')
            );
            
            if (firebaseAuthKeys.length > 0) {
              try {
                const authData = JSON.parse(localStorage.getItem(firebaseAuthKeys[0]));
                userId = authData.uid || null;
                const phoneNumber = authData.phoneNumber || null;
                console.log('Found user ID via localStorage pattern:', userId, 'Phone:', phoneNumber);
              } catch(e) {
                console.log('Error parsing Firebase auth data:', e);
              }
            }
          }
          
          // Method 3: Look for auth state in window.__FIREBASE_DEFAULTS__ (newer Firebase versions)
          if (!userId && window.__FIREBASE_DEFAULTS__) {
            console.log('Found __FIREBASE_DEFAULTS__, checking for auth state');
          }
          
          // Method 4: Look for React state containing user info
          // This checks for common patterns in React apps storing user state
          if (!userId && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            console.log('Detected React, checking for state containing user info');
          }
          
          // Method 5: Check for recent login indicators
          if (!userId) {
            const loginIndicators = ['confirmationResult', 'verificationId', 'phoneAuthProvider'];
            for (const key of Object.keys(sessionStorage)) {
              if (loginIndicators.some(indicator => key.toLowerCase().includes(indicator))) {
                console.log('Found potential phone auth session data:', key);
              }
            }
          }
          
          // Send the result back to React Native
          userId = userId || 'guest';
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'userId', data: userId }));
          
          // Run the debug function to help troubleshoot
          debugAuthStorage();
        } catch(e) {
          console.error('Error extracting user ID:', e);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'userId', data: 'guest' }));
        }
      }
      
      // Setup listener for auth state changes
      function setupAuthListener() {
        try {
          if (window.firebase && window.firebase.auth) {
            // This will trigger whenever auth state changes (login/logout)
            window.firebase.auth().onAuthStateChanged(function(user) {
              if (user) {
                console.log('Auth state changed: User logged in', user.uid);
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'userId', 
                  data: user.uid 
                }));
              } else {
                console.log('Auth state changed: User logged out');
                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                  type: 'userId', 
                  data: 'guest' 
                }));
              }
            });
            console.log('Set up Firebase auth state listener');
          } else {
            console.log('Firebase Auth not available, cannot set up listener');
          }
        } catch (e) {
          console.error('Error setting up auth listener:', e);
        }
      }
      
      // Check periodically and on storage changes
      function startMonitoring() {
        // Setup auth listener if Firebase is available
        setupAuthListener();
        
        // Initial check
        extractUserId();
        
        // Set up periodic checks (less frequent)
        setInterval(extractUserId, 10000);
        
        // Listen for storage changes
        window.addEventListener('storage', function(e) {
          if (e.key && (e.key.includes('firebase') || e.key.includes('auth'))) {
            console.log('Storage changed, might be auth related:', e.key);
            extractUserId();
          }
        });
        
        // Try to detect login/signup form submission
        document.addEventListener('submit', function(e) {
          console.log('Form submitted, might be login/signup');
          // Wait a bit for the auth to process
          setTimeout(extractUserId, 2000);
        });
        
        // Monitor clicks on buttons that might be login/signup related
        document.addEventListener('click', function(e) {
          if (e.target && e.target.tagName === 'BUTTON') {
            const text = e.target.textContent.toLowerCase();
            if (text.includes('login') || text.includes('sign') || 
                text.includes('verify') || text.includes('continue') ||
                text.includes('otp') || text.includes('code')) {
              console.log('Potential auth button clicked:', text);
              setTimeout(extractUserId, 2000);
            }
          }
        });
      }
      
      // Start monitoring when page is ready
      if (document.readyState === 'complete') {
        startMonitoring();
      } else {
        window.addEventListener('load', startMonitoring);
      }
    })();
    true;
  `;

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'userId') {
        console.log('Received user ID from WebView:', message.data);
        onUserIdReceived(message.data);
      } else if (message.type === 'debug') {
        console.log('WebView debug info:', JSON.stringify(message.data, null, 2));
      }
    } catch (error) {
      console.error('Failed to parse WebView message:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.webviewContainer}>
        <WebView 
          ref={webViewRef}
          source={{ uri: 'https://goforcab.com/' }} 
          style={styles.webview} 
          startInLoadingState
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          injectedJavaScript={INJECT_JS}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
        />
      </View>
    </SafeAreaView>
  );
};

const App = () => {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());
  const [userId, setUserId] = useState('guest');
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [tokenStored, setTokenStored] = useState(false);

  const storeTokenInFirestore = async (token, uid) => {
    try {
      // Check if this token is already stored
      if (tokenStored) {
        console.log('Token already stored, skipping duplicate storage');
        return;
      }

      // Check if the token already exists in Firestore
      const tokensRef = collection(db, 'push_tokens');
      const q = query(tokensRef, where('expoPushToken', '==', token));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Token exists, update the user ID if needed
        const existingDoc = querySnapshot.docs[0];
        
        // Only update if user ID has changed
        if (existingDoc.data().userId !== uid) {
          console.log('Token exists, updating user ID from', existingDoc.data().userId, 'to', uid);
          await setDoc(doc(db, 'push_tokens', existingDoc.id), {
            userId: uid,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } else {
          console.log('Token already exists with correct user ID, no update needed');
        }
      } else {
        // Token doesn't exist, create new document
        const deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const tokenRef = doc(db, 'push_tokens', deviceId);
        
        await setDoc(tokenRef, {
          userId: uid,
          expoPushToken: token,
          platform: Platform.OS,
          deviceId: deviceId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log(`New token stored in Firestore for user: ${uid}`);
      }
      
      // Mark token as stored to prevent redundant operations
      setTokenStored(true);
    } catch (error) {
      console.error('Error storing token in Firestore:', error);
    }
  };

  useEffect(() => {
    // Request location and notification permissions
    (async () => {
      // Location permissions
      let locationStatus = await Location.requestForegroundPermissionsAsync();
      if (locationStatus.status !== 'granted') {
        Alert.alert('Permission to access location was denied');
      } else {
        let location = await Location.getCurrentPositionAsync({});
        console.log(location);
      }

      // Notification permissions
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          Alert.alert('Permission to receive notifications was denied');
          return;
        }
        
        console.log('Notification permission granted');
        
        // Get the device push token (for sending push notifications)
        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;
        console.log('Expo push token:', token);
        setExpoPushToken(token);
        
        // Initial token storage with userId (guest or authenticated)
        await storeTokenInFirestore(token, userId);
      } catch (err) {
        console.error('Failed to get notification token:', err);
      }
    })();

    // Listen for color scheme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setColorScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  // Only update token in Firestore when userId changes AND we have a token
  // AND it's not the initial "guest" user state
  useEffect(() => {
    if (expoPushToken && userId && userId !== 'guest') {
      storeTokenInFirestore(expoPushToken, userId);
    }
  }, [userId]);  // Only depend on userId changes, not on expoPushToken

  const handleUserIdReceived = (newUserId) => {
    if (newUserId && newUserId !== userId) {
      console.log('User ID received from website:', newUserId);
      setUserId(newUserId);
      
      // We'll let the useEffect handle token updates when userId changes
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colorScheme === 'dark' ? '#000000' : '#ffffff'} 
      />
      <WebsiteContainer onUserIdReceived={handleUserIdReceived} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});

export default App;