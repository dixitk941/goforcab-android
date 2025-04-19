import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyCGHuEhoh8QCaWEpSJDbY7yz1hrA0nYOGY",
    authDomain: "yogocab-ainor.firebaseapp.com",
    databaseURL: "https://yogocab-ainor-default-rtdb.firebaseio.com",
    projectId: "yogocab-ainor",
    storageBucket: "yogocab-ainor.appspot.com",
    messagingSenderId: "314566544815",
    appId: "1:314566544815:web:8ae9f04c9ff26fed63735a",
    measurementId: "G-E949P1J908"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
let messaging = null;

// Function to get FCM token
export const requestNotificationPermission = async () => {
  try {
    console.log("Starting FCM token request process");
    
    // First check if messaging is supported in this browser
    const isFCMSupported = await isSupported();
    if (!isFCMSupported) {
      console.error("Firebase Cloud Messaging is not supported in this browser");
      return null;
    }
    
    // Initialize messaging if not already done
    if (!messaging) {
      console.log("Initializing Firebase messaging");
      messaging = getMessaging(app);
    }
    
    console.log("Getting VAPID key from environment");
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    
    if (!vapidKey) {
      console.error("VAPID key not found in environment variables");
      return null;
    }
    
    console.log("Requesting token with VAPID key...");
    
    // Make sure service worker is registered and ready
    let swRegistration = null;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!swRegistration) {
          console.log("Service worker not found, registering now");
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          await navigator.serviceWorker.ready;
          console.log("New service worker registered and ready");
        }
      } catch (swError) {
        console.error("Service worker error:", swError);
      }
    }
    
    // Get token with all possible options
    const tokenOptions = {
      vapidKey: vapidKey,
      serviceWorkerRegistration: swRegistration
    };
    
    try {
      console.log("Requesting FCM token with options:", JSON.stringify(tokenOptions));
      const token = await getToken(messaging, tokenOptions);
      
      if (token) {
        console.log("FCM token obtained:", token.substring(0, 10) + "...");
        return token;
      } else {
        console.warn("Empty FCM token received");
        return null;
      }
    } catch (tokenError) {
      console.error("Error getting FCM token:", tokenError);
      return null;
    }
  } catch (error) {
    console.error("Fatal error in requestNotificationPermission:", error);
    return null;
  }
};