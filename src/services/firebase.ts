// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCWXNyTyak-0a754IcfSjiKAl9q7dqLd-8",
    authDomain: "groupmemoryvault.firebaseapp.com",
    projectId: "groupmemoryvault",
    storageBucket: "groupmemoryvault.firebasestorage.app",
    messagingSenderId: "1065975807660",
    appId: "1:1065975807660:web:52bb0555ce15f838896909"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);