import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAOFB3Xf8ru3Uhauhtt8LGAbX_0b2-V6fw",
    authDomain: "jgs-business-tracker.firebaseapp.com",
    projectId: "jgs-business-tracker",
    storageBucket: "jgs-business-tracker.firebasestorage.app",
    messagingSenderId: "183591785629",
    appId: "1:183591785629:web:9710670076127e6faeb074"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collection and Document References
const logCol = collection(db, "jgs_logs");
const settingsDocRef = doc(db, "jgs_settings", "auth");
const auditCol = collection(db, "jgs_audit_logs");

// Export shared instances and references
export { db, logCol, settingsDocRef, auditCol };

// Export all firestore functions individually to ensure they are available to services
export {
    addDoc,
    setDoc, 
    updateDoc, 
    deleteDoc, 
    doc,
    collection,
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    getDoc,
    getDocs
};
