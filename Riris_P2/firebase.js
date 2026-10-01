// ============================================
// MockFirestore Class - HARUS DI ATAS!
// ============================================
class MockFirestore {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('mock_inventory_db') || '[]');
        this.listeners = [];
    }

    collection() { return this; }

    async add(payload) {
        const doc = {
            ...payload,
            id: Date.now().toString(),
            timestamp: { toDate: () => new Date() }
        };
        this.data.unshift(doc);

        if (this.data.length > 50) this.data.pop();

        localStorage.setItem('mock_inventory_db', JSON.stringify(this.data));

        this.listeners.forEach(cb => cb(this.data));
        return Promise.resolve();
    }

    orderBy() { return this; }
    limit() { return this; }

    onSnapshot(cb) {
        this.listeners.push(cb);
        cb(this.data);
        return () => {};
    }
}

// ============================================
// KONFIGURASI DATABASE
// KOSONGKAN apiKey untuk Mock Mode, ISI untuk Firebase Mode
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyAqJBaxl2VyeMyP-q7XF-_QRgmozXOqdZ0",
  authDomain: "riris-p2.firebaseapp.com",
  projectId: "riris-p2",
  storageBucket: "riris-p2.firebasestorage.app",
  messagingSenderId: "883111330874",
  appId: "1:883111330874:web:ee7209dbde579773be2103"
};

function setDbStatus(text, className) {
    const dbStatusEl = document.getElementById('db-status');
    if (!dbStatusEl) return;
    dbStatusEl.textContent = text;
    dbStatusEl.className = `status-badge ${className}`;
}

window.db = new MockFirestore();
setDbStatus("MENGHUBUNGKAN...", "demo");

async function connectFirestore() {
    const firebaseAppUrl = "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
    const firestoreUrl = "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

    try {
        const [appSdk, firestoreSdk] = await Promise.all([
            import(firebaseAppUrl),
            import(firestoreUrl)
        ]);
        const app = appSdk.initializeApp(firebaseConfig);
        const firestore = firestoreSdk.getFirestore(app);

        window.db = {
            collection(collectionName) {
                return {
                    add(payload) {
                        return firestoreSdk.addDoc(
                            firestoreSdk.collection(firestore, collectionName),
                            payload
                        );
                    }
                };
            }
        };
        setDbStatus("FIREBASE ONLINE", "online");
    } catch (error) {
        console.error("Firebase init error", error);
        setDbStatus("DEMO MODE", "demo");
    }
}

connectFirestore();