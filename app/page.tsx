"use client"

import { useEffect, useState } from "react";
import { getToken, getMessaging, isSupported } from "firebase/messaging";
import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = getMessaging(app);

export default function Home() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   const requestPermission = async () => {
  //     try {
  //       const supported = await isSupported();
  //       if (!supported) {
  //         throw new Error("This browser doesn't support the API's required to use the Firebase SDK.");
  //       }

  //       const messaging = getMessaging(app);
  //       const token = await getToken(messaging, {
  //         vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, // Required for web push notifications
  //       });
  //       if (token) {
  //         console.log("FCM Token:", token);
  //         // setFcmToken(token);
  //       } else {
  //         console.log("No registration token available.");
  //         setError("No registration token available.");
  //       }
  //     } catch (error: any) {
  //       console.error("An error occurred while retrieving token. ", error);
  //       setError(error.message);
  //     }
  //   };

  //   const registerServiceWorker = async () => {
  //     try {
  //       if ('serviceWorker' in navigator) {
  //         const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  //         console.log('Service Worker registered with scope:', registration.scope);
  //       }
  //     } catch (error) {
  //       console.error('Service Worker registration failed:', error);
  //       setError('Service Worker registration failed.');
  //     }
  //   };

  //   registerServiceWorker();
  //   requestPermission();
  // }, []);

  return (
    <div>
      <h1>FCM Token Example</h1>
      <div style={{ border: "1px solid black", padding: "10px", marginTop: "20px" }}>
        <h3>FCM Token Result:</h3>
        {fcmToken && <p>Token: {fcmToken}</p>}
        {error && <p style={{ color: "red" }}>Error: {error}</p>}
      </div>
    </div>
  );
}