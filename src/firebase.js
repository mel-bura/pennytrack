import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBE4HZpvxlM4U07uOhn5t8v03f74fG0rjc",
  authDomain: "basketbuddy-1607f.firebaseapp.com",
  projectId: "basketbuddy-1607f",
  storageBucket: "basketbuddy-1607f.firebasestorage.app",
  messagingSenderId: "999660735077",
  appId: "1:999660735077:web:c6c5b9ceea9152dce3148c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
