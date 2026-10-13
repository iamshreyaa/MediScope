// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDPHvjhhiVvTN_ofl4GWpg_eq4ogp9lxmE",
  authDomain: "medical-assistant-68b5c.firebaseapp.com",
  projectId: "medical-assistant-68b5c",
  storageBucket: "medical-assistant-68b5c.firebasestorage.app",
  messagingSenderId: "65450615059",
  appId: "1:65450615059:web:a5c1643634e21057613ae6",
  measurementId: "G-X478MD7G9F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Firebase is used for authentication only; all app data goes through the backend API
export const auth = getAuth(app);
