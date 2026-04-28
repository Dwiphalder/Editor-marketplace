import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, get, push, set, update, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Firebase Configuration from User
const firebaseConfig = {
  apiKey: "AIzaSyCcXYTx17efxmbISYD4tLEF98lyCbLQI0Q",
  authDomain: "editing-b1625.firebaseapp.com",
  databaseURL: "https://editing-b1625-default-rtdb.firebaseio.com",
  projectId: "editing-b1625",
  storageBucket: "editing-b1625.firebasestorage.app",
  messagingSenderId: "906686761161",
  appId: "1:906686761161:web:087800a1a87cb885256518",
  measurementId: "G-1JYEVNNEZ4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// System Settings
let userSettings = JSON.parse(localStorage.getItem('lumina_settings')) || {
    theme: 'dark',
    accent: '#3b82f6',
    font: 'sanfrancisco',
    animations: true,
    sounds: true
};
applySettings();

// Apply global settings
function applySettings() {
    let isDark = false;
    if (userSettings.theme === 'dark') {
        isDark = true;
    } else if (userSettings.theme === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    // Apply accent color
    if (userSettings.accent) {
        document.documentElement.style.setProperty('--primary', userSettings.accent);
    }
    
    // Apply font
    document.documentElement.className = document.documentElement.className.replace(/\bfont-\S+/g, '');
    if (userSettings.font && userSettings.font !== 'sanfrancisco') {
        document.documentElement.classList.add(`font-${userSettings.font}`);
    }

    // Apply animations
    if (!userSettings.animations) {
        document.body.classList.add('no-animations');
    } else {
        document.body.classList.remove('no-animations');
    }
    
    // Set UI selects (if they exist)
    if (document.getElementById('prefTheme')) {
        document.getElementById('prefTheme').value = userSettings.theme;
        document.getElementById('prefFont').value = userSettings.font || 'sanfrancisco';
        document.getElementById('prefAnimations').checked = userSettings.animations;
        document.getElementById('prefSounds').checked = userSettings.sounds;
        // Set accent active states
        document.querySelectorAll('.color-btn').forEach(btn => {
            if(btn.dataset.color === userSettings.accent) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }
}

// Tick Tock Sound Synthesizer
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function playTick() {
    if (!userSettings.sounds) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

// Bind tick to all buttons
document.addEventListener('click', (e) => {
    if(e.target.closest('button') || e.target.closest('.filter-chip') || e.target.closest('a')) {
        playTick();
    }
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (userSettings.theme === 'system') applySettings();
});

// App State
let editors = [];
let allRequests = [];
let allReviews = [];
let allUsers = {};
let allApplications = [];
let currentUser = null;
let currentProfileId = null;
let currentCategory = 'All';

// DOM Elements - User
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userProfile = document.getElementById('userProfile');
const userAvatar = document.getElementById('userAvatar');
const searchInput = document.getElementById('searchInput');

// Add specific elements for user profile
const userProfileModal = document.getElementById('userProfileModal');
const closeUserProfile = document.getElementById('closeUserProfile');
const bottomNavProfile = document.getElementById('bottomNavProfile');
const bottomNavHome = document.getElementById('bottomNavHome');
const bottomNavJobs = document.getElementById('bottomNavJobs');
const homeView = document.getElementById('homeView');
const jobsView = document.getElementById('jobsView');
const saveUserProfileBtn = document.getElementById('saveUserProfileBtn');
const upAvatarPreview = document.getElementById('upAvatarPreview');
const upAvatarUpload = document.getElementById('upAvatarUpload');
const upAvatarUrl = document.getElementById('upAvatarUrl');
const profileCompleteMsg = document.getElementById('profileCompleteMsg');

// DOM Elements - Editors
const trendingSection = document.getElementById('trendingSection');
const trendingGrid = document.getElementById('trendingGrid');
const mainGrid = document.getElementById('mainGrid');
const loadingMain = document.getElementById('loadingMain');
const emptyMain = document.getElementById('emptyMain');
const filterChips = document.querySelectorAll('.filter-chip');
const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
const filterContainer = document.getElementById('filterContainer');

if (toggleFiltersBtn && filterContainer) {
    toggleFiltersBtn.addEventListener('click', () => {
        if (filterContainer.style.display === 'none') {
            filterContainer.style.display = 'block';
        } else {
            filterContainer.style.display = 'none';
        }
    });
}

// DOM Elements - Modals
const profileModal = document.getElementById('editorProfileModal');
const contactModal = document.getElementById('contactModal');
const loginPromptModal = document.getElementById('loginPromptModal');

// Init
window.addEventListener('DOMContentLoaded', () => {
    fetchEditors();
});

// Authentication AuthState
onAuthStateChanged(auth, (user) => {
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const adminPanelOverlay = document.getElementById('adminPanelOverlay');
    
    if (user) {
        currentUser = user;
        authScreen.style.opacity = '0';
        authScreen.style.visibility = 'hidden';
        
        setTimeout(() => {
            authScreen.style.display = 'none';
            
            if (user.email === 'dwiphalder49@gmail.com' || user.email === 'dwiphalder608@gmail.com') {
                // Admin bypass
                mainApp.style.display = 'none';
                welcomeScreen.style.display = 'none';
                adminPanelOverlay.style.display = 'block';
                renderAdminList();
            } else {
                // Welcome screen
                adminPanelOverlay.style.display = 'none';
                const welcomeUserName = document.getElementById('welcomeUserName');
                if (welcomeUserName) welcomeUserName.textContent = user.displayName || user.email.split('@')[0];
                welcomeScreen.style.display = 'flex';
                welcomeScreen.style.opacity = '1';
                
                setTimeout(() => {
                    welcomeScreen.style.opacity = '0';
                    setTimeout(() => {
                        welcomeScreen.style.display = 'none';
                        mainApp.style.display = 'block';
                        fetchEditors(); // Refresh
                    }, 800);
                }, 2500); // show welcome for 2.5s
            }
        }, 500); // fade out auth screen wait
        
        loginBtn.style.display = 'none';
        userProfile.style.display = 'flex';
        let profilePic = user.photoURL;
        if(allUsers[user.uid] && allUsers[user.uid].photoUrl) {
            profilePic = allUsers[user.uid].photoUrl;
        } else {
            get(ref(db, "users/" + user.uid)).then(sp => {
                if(sp.exists()) {
                    allUsers[user.uid] = sp.val();
                    if(sp.val().photoUrl) {
                        userAvatar.src = sp.val().photoUrl;
                    }
                }
            });
        }
        userAvatar.src = profilePic || "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'%3e%3c/path%3e%3ccircle cx='12' cy='7' r='4'%3e%3c/circle%3e%3c/svg%3e";
    } else {
        currentUser = null;
        authScreen.style.display = 'flex';
        authScreen.style.opacity = '1';
        authScreen.style.visibility = 'visible';
        
        mainApp.style.display = 'none';
        if(welcomeScreen) welcomeScreen.style.display = 'none';
        if(adminPanelOverlay) adminPanelOverlay.style.display = 'none';
        
        loginBtn.style.display = 'block';
        userProfile.style.display = 'none';
    }
});

// Auth Splash Screen Logic
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const authForm = document.getElementById('authForm');
const mainAuthBtn = document.getElementById('mainAuthBtn');
const authErrorMsg = document.getElementById('authErrorMsg');

let isLoginMode = true;

if(tabLogin) tabLogin.addEventListener('click', () => {
    isLoginMode = true;
    tabLogin.classList.add('active');
    if(tabSignup) tabSignup.classList.remove('active');
    if(mainAuthBtn) mainAuthBtn.textContent = 'Log In';
    if(authForm) authForm.reset();
    if(authErrorMsg) authErrorMsg.classList.add('hidden');
    if(document.getElementById('signupWarning')) document.getElementById('signupWarning').classList.add('hidden');
});

if(tabSignup) tabSignup.addEventListener('click', () => {
    isLoginMode = false;
    tabSignup.classList.add('active');
    if(tabLogin) tabLogin.classList.remove('active');
    if(mainAuthBtn) mainAuthBtn.textContent = 'Sign Up';
    if(authForm) authForm.reset();
    if(authErrorMsg) authErrorMsg.classList.add('hidden');
    if(document.getElementById('signupWarning')) document.getElementById('signupWarning').classList.remove('hidden');
});

// Email/Password login logic
if(authForm) authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    
    mainAuthBtn.disabled = true;
    mainAuthBtn.textContent = 'Please Wait...';
    authErrorMsg.classList.add('hidden');
    
    try {
        if(isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            await createUserWithEmailAndPassword(auth, email, pass);
        }
        loginPromptModal.style.display = 'none'; // in case it was opened from hiring
    } catch(err) {
        authErrorMsg.textContent = err.message.replace('Firebase:', '').trim();
        authErrorMsg.classList.remove('hidden');
    } finally {
        mainAuthBtn.disabled = false;
        mainAuthBtn.textContent = isLoginMode ? 'Log In' : 'Sign Up';
    }
});

// Eye Toggle
const togglePassword = document.getElementById('toggleAuthPassword');
if(togglePassword) {
    togglePassword.addEventListener('click', () => {
        const pInput = document.getElementById('authPassword');
        if(pInput.type === 'password') {
            pInput.type = 'text';
            togglePassword.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
            pInput.type = 'password';
            togglePassword.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" class="eye-icon" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
    });
}

const handleGoogleLogin = async () => {
    // Coming soon
    if(authErrorMsg) {
        authErrorMsg.textContent = "Google Sign-In is coming soon!";
        authErrorMsg.classList.remove('hidden');
    }
};

if(document.getElementById('googleAuthBtn')) { document.getElementById('googleAuthBtn').addEventListener('click', handleGoogleLogin); }
if(loginBtn) loginBtn.addEventListener('click', () => {
    // If they click Login from navbar, show the auth screen if it was hidden
    // but the app structure handles this via AuthState.
    signOut(auth); // A small hack to return to splash page
});
if(document.getElementById('signInGoogleBtn')) document.getElementById('signInGoogleBtn').addEventListener('click', handleGoogleLogin);
if(logoutBtn) logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

if(userAvatar) {
    userAvatar.style.cursor = 'pointer';
    userAvatar.addEventListener('click', () => {
        window.openUserProfileModal(false);
    });
}
if(bottomNavProfile) {
    bottomNavProfile.addEventListener('click', (e) => {
        e.preventDefault();
        window.openUserProfileModal(false);
    });
}
window.switchNavView = function(view) {
    if(view === 'home') {
        if(homeView) homeView.style.display = 'block';
        if(jobsView) jobsView.style.display = 'none';
        if(bottomNavHome) bottomNavHome.classList.add('active');
        if(bottomNavJobs) bottomNavJobs.classList.remove('active');
    } else if(view === 'jobs') {
        if(homeView) homeView.style.display = 'none';
        if(jobsView) jobsView.style.display = 'block';
        if(bottomNavJobs) bottomNavJobs.classList.add('active');
        if(bottomNavHome) bottomNavHome.classList.remove('active');
        populateJobFormFromProfile();
    }
};

if(bottomNavHome && bottomNavJobs && homeView && jobsView) {
    bottomNavHome.addEventListener('click', (e) => {
        e.preventDefault();
        window.switchNavView('home');
    });
    bottomNavJobs.addEventListener('click', (e) => {
        e.preventDefault();
        window.switchNavView('jobs');
    });
}

function populateJobFormFromProfile() {
    if(!currentUser) {
        document.getElementById('jobsCompleteProfileMsg').classList.remove('hidden');
        document.getElementById('submitJobReqBtn').disabled = true;
        return;
    }
    const up = allUsers[currentUser.uid] || {};
    
    document.getElementById('jobsCompleteProfileMsg').classList.add('hidden');
    document.getElementById('submitJobReqBtn').disabled = false;
    document.getElementById('jobName').value = up.firstName ? (up.firstName + ' ' + (up.lastName||'').trim()) : '';
    document.getElementById('jobEmail').value = currentUser.email || '';
    document.getElementById('jobPhone').value = up.phone || '';
    
    const defaultPic = up.photoUrl || currentUser.photoURL || 'https://via.placeholder.com/80';
    const avatarPrev = document.getElementById('jobAvatarPreview');
    if(!document.getElementById('jobAvatarUrl').value) {
        avatarPrev.src = defaultPic;
        document.getElementById('jobAvatarUrl').value = defaultPic;
    }
}


// Fetch Data
async function fetchEditors() {
    loadingMain.style.display = 'block';
    emptyMain.style.display = 'none';
    mainGrid.innerHTML = '';
    
    try {
        const [editorsSnap, requestsSnap, reviewsSnap, usersSnap, appsSnap] = await Promise.all([
            get(ref(db, "editors")),
            get(ref(db, "requests")),
            get(ref(db, "reviews")),
            get(ref(db, "users")),
            get(ref(db, "editor_applications"))
        ]);
        
        if (editorsSnap.exists()) {
            const data = editorsSnap.val();
            editors = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        } else {
            editors = [];
        }
        
        if (requestsSnap.exists()) {
            const rData = requestsSnap.val();
            allRequests = Object.keys(rData).map(key => ({ id: key, ...rData[key] }));
        } else {
            allRequests = [];
        }
        
        if (reviewsSnap.exists()) {
            const revData = reviewsSnap.val();
            allReviews = Object.keys(revData).map(key => ({ id: key, ...revData[key] }));
        } else {
            allReviews = [];
        }
        
        if (usersSnap.exists()) {
            allUsers = usersSnap.val();
        } else {
            allUsers = {};
        }

        if (appsSnap && appsSnap.exists()) {
            allApplications = [];
            appsSnap.forEach(snap => {
                allApplications.push({ id: snap.key, ...snap.val() });
            });
        } else {
            allApplications = [];
        }
        
        renderTrending();
        filterAndRenderEditors();
        renderAdminList(); // Refresh admin list if it's open
    } catch (error) {
        console.error("Fetch error:", error);
        loadingMain.innerHTML = '<p class="text-danger">Failed to load data. Check DB connection.</p>';
    }
}

// Render Logic
function generateCardHTML(editor, index = 0) {
    let verifiedIcon = '';
    let cardBorderStyle = '';
    
    if (editor.verificationType === 'golden') {
        verifiedIcon = `<span class="verified-badge golden blink-badge" title="Trusted Profile" style="position: absolute; top: 12px; right: 12px; z-index: 10; background: var(--bg-card); border-radius: 50%; display: flex; box-shadow: 0 2px 10px rgba(0,0,0,0.5);"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="#F5C34B" d="M22.5 12.5l-1.58 1.58.21 2.24-2.24.21-1.27 1.86-2.16-.92-1.66 1.48L12 17.5l-1.8 1.45-1.66-1.48-2.16.92-1.27-1.86-2.24-.21.21-2.24L1.5 12.5l1.58-1.58-.21-2.24 2.24-.21 1.27-1.86 2.16.92 1.66-1.48L12 6.5l1.8-1.45 1.66 1.48 2.16-.92 1.27 1.86 2.24.21-.21 2.24 1.58 1.58z" /><path fill="#fff" d="M10.5 16l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z" /></svg></span>`;
        cardBorderStyle = 'border: 2px solid #F5C34B; box-shadow: 0 4px 15px rgba(245, 195, 75, 0.2);';
    } else if (editor.verificationType === 'blue' || editor.isVerified) {
        verifiedIcon = `<span class="verified-badge blink-badge" title="Verified" style="position: absolute; top: 12px; right: 12px; z-index: 10; background: var(--bg-card); border-radius: 50%; display: flex; box-shadow: 0 2px 10px rgba(0,0,0,0.5);"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><path fill="#1d9bf0" d="M22.5 12.5l-1.58 1.58.21 2.24-2.24.21-1.27 1.86-2.16-.92-1.66 1.48L12 17.5l-1.8 1.45-1.66-1.48-2.16.92-1.27-1.86-2.24-.21.21-2.24L1.5 12.5l1.58-1.58-.21-2.24 2.24-.21 1.27-1.86 2.16.92 1.66-1.48L12 6.5l1.8-1.45 1.66 1.48 2.16-.92 1.27 1.86 2.24.21-.21 2.24 1.58 1.58z" /><path fill="#fff" d="M10.5 16l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z" /></svg></span>`;
        cardBorderStyle = 'border: 2px solid #10B981; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);';
    }
    
    // Calculate real rating
    const editorReviews = allReviews.filter(r => r.editorId === editor.id);
    let avgRating = 0;
    if (editorReviews.length > 0) {
        const sum = editorReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        avgRating = (sum / editorReviews.length).toFixed(1);
    }
    const ratingText = editorReviews.length > 0 ? `⭐ ${avgRating} / ${editorReviews.length} reviews` : `⭐ New / 0 reviews`;
    
    let priceText = `₹${editor.price || 0}`;
    if(editor.maxPrice) {
        priceText += ` - ₹${editor.maxPrice}`;
    }

    // Convert video clips string to array
    const clips = editor.video_clips ? editor.video_clips.split(',').slice(0, 2) : [];
    
    let clipsPreviewHTML = '';

    return `
        <div class="editor-card new-style animate-fade" data-id="${editor.id}" style="animation-delay: ${index * 0.1}s; ${cardBorderStyle}">
            ${verifiedIcon}
            <div class="card-image-bg" style="background-image: url('${editor.photo_url || 'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?crop=entropy&fit=max&fm=jpg&q=80&w=400'}')"></div>
            <div class="card-overlay"></div>
            <div class="card-content">
                <h3 class="name font-title">${editor.name}</h3>
                <p class="title">${editor.category} Editor</p>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <p class="reviews" style="margin-bottom:8px;">${ratingText}</p>
                    <p class="price-range" style="font-size:0.85rem; font-weight:600; color:white; background:rgba(0,0,0,0.5); padding:2px 6px; border-radius:4px; margin-bottom:8px;">${priceText}</p>
                </div>
                ${clipsPreviewHTML}
                <div class="card-actions">
                    <button class="btn btn-hire">Hire Now</button>
                    <button class="btn btn-message">Message</button>
                </div>
            </div>
        </div>
    `;
}

function renderTrending() {
    let trendingPool = editors.filter(ed => ed.isFeatured === true && !ed.deletionScheduledAt);

    if (trendingPool.length > 0) {
        trendingSection.style.display = 'block';
        trendingGrid.innerHTML = trendingPool.map((ed, i) => generateCardHTML(ed, i)).join('');
        
        // Auto scroll setup
        if (window.trendingInterval) clearInterval(window.trendingInterval);
        window.trendingInterval = setInterval(() => {
            if (trendingGrid.scrollLeft + trendingGrid.clientWidth >= trendingGrid.scrollWidth - 10) {
                trendingGrid.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                trendingGrid.scrollBy({ left: trendingGrid.clientWidth / 2, behavior: 'smooth' });
            }
        }, 4000); // changes every 4-5 seconds
        
    } else {
        trendingSection.style.display = 'none';
    }
}

function filterAndRenderEditors() {
    const term = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase();
    loadingMain.style.display = 'none';
    
    const filterRating = document.getElementById('filterRating') ? document.getElementById('filterRating').value : 'All';
    const filterType = document.getElementById('filterType') ? document.getElementById('filterType').value : 'All';
    const sortPrice = document.getElementById('sortPrice') ? document.getElementById('sortPrice').value : 'None';

    let filtered = editors.filter(ed => {
        if (ed.deletionScheduledAt) return false;

        const safeName = (ed.name || '').toString().toLowerCase();
        const safeSkills = (ed.skills || '').toString().toLowerCase();
        
        const matchSearch = safeName.includes(term) || safeSkills.includes(term);
        const matchCat = currentCategory === 'All' ? true : ed.category === currentCategory;
        
        // Rating calculation
        const editorReviews = allReviews.filter(r => r.editorId === ed.id);
        let avgRating = 0;
        if (editorReviews.length > 0) {
            const sum = editorReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0);
            avgRating = sum / editorReviews.length;
        }

        let matchRating = true;
        if (filterRating === '4+') matchRating = avgRating >= 4.0;
        if (filterRating === '3+') matchRating = avgRating >= 3.0;

        let matchType = true;
        if (filterType === 'New') matchType = editorReviews.length === 0;
        if (filterType === 'Experienced') matchType = editorReviews.length > 0;
        
        return matchSearch && matchCat && matchRating && matchType;
    });

    if (sortPrice === 'LowToHigh') {
        filtered.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    } else if (sortPrice === 'HighToLow') {
        filtered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    }
    
    mainGrid.innerHTML = '';
    
    if (filtered.length === 0) {
        emptyMain.style.display = 'block';
    } else {
        emptyMain.style.display = 'none';
        mainGrid.innerHTML = filtered.map((ed, i) => generateCardHTML(ed, i)).join('');
    }
}

// User Interactions
if(searchInput) searchInput.addEventListener('input', filterAndRenderEditors);
if(document.getElementById('filterRating')) document.getElementById('filterRating').addEventListener('change', filterAndRenderEditors);
if(document.getElementById('filterType')) document.getElementById('filterType').addEventListener('change', filterAndRenderEditors);
if(document.getElementById('sortPrice')) document.getElementById('sortPrice').addEventListener('change', filterAndRenderEditors);

filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.getAttribute('data-cat');
        filterAndRenderEditors();
    });
});

// Event Delegation for Cards
document.addEventListener('click', (e) => {
    // If they click on "Message", intercept it
    if (e.target.closest('.btn-message')) {
        e.stopPropagation();
        const card = e.target.closest('.editor-card');
        if (card) {
            currentProfileId = card.dataset.id;
            const ed = editors.find(editor => editor.id === currentProfileId);
            if (!currentUser) {
                loginPromptModal.style.display = 'flex';
                return;
            }
            if (ed) {
                if (ed.email) {
                    document.getElementById('contactEmail').href = `mailto:${ed.email}`;
                    document.getElementById('contactEmail').style.display = 'inline-block';
                } else {
                    document.getElementById('contactEmail').href = '#';
                    document.getElementById('contactEmail').style.display = 'none';
                }
                
                const phoneNum = ed.whatsapp || ed.phone;
                if(phoneNum) {
                    const cleanNo = phoneNum.replace(/[^0-9]/g, '');
                    document.getElementById('contactWhatsapp').href = `https://wa.me/${cleanNo}`;
                    document.getElementById('contactWhatsapp').style.display = 'inline-block';
                } else {
                    document.getElementById('contactWhatsapp').href = '#';
                    document.getElementById('contactWhatsapp').style.display = 'none';
                }
                contactModal.style.display = 'flex';
            }
        }
        return;
    }
    // If they click on "Hire Now", intercept it
    if (e.target.closest('.btn-hire')) {
        e.stopPropagation();
        const card = e.target.closest('.editor-card');
        if (card) {
            openEditorProfile(card.dataset.id);
        }
        return;
    }

    const card = e.target.closest('.editor-card');
    if (card) {
        openEditorProfile(card.dataset.id);
    }
});

// Profile Modal
function openEditorProfile(id) {
    const ed = editors.find(e => e.id === id);
    if (!ed) return;
    currentProfileId = id;
    
    // Increment view count in background
    const newViews = (ed.views || 0) + 1;
    update(ref(db, "editors/" + id), { views: newViews });
    
    const verifiedBadge = document.getElementById('epVerified');
    const epAvatar = document.getElementById('epAvatar');
    const modalBody = document.querySelector('#editorProfileModal .modal-body');
    
    // reset border and bg
    if(epAvatar) epAvatar.style.border = '4px solid var(--glass-bg)';
    if(modalBody) modalBody.style.background = '';
    
    if (verifiedBadge) {
        if (ed.verificationType === 'golden') {
            verifiedBadge.title = "Premium Verified";
            verifiedBadge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path fill="#F5C34B" d="M22.5 12.5l-1.58 1.58.21 2.24-2.24.21-1.27 1.86-2.16-.92-1.66 1.48L12 17.5l-1.8 1.45-1.66-1.48-2.16.92-1.27-1.86-2.24-.21.21-2.24L1.5 12.5l1.58-1.58-.21-2.24 2.24-.21 1.27-1.86 2.16.92 1.66-1.48L12 6.5l1.8-1.45 1.66 1.48 2.16-.92 1.27 1.86 2.24.21-.21 2.24 1.58 1.58z" /><path fill="#fff" d="M10.5 16l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z" /></svg>';
            verifiedBadge.classList.remove('hidden');
            if(epAvatar) epAvatar.style.border = '4px solid #F5C34B';
            if(modalBody) modalBody.style.background = 'linear-gradient(180deg, rgba(245, 195, 75, 0.15) 0%, rgba(245, 195, 75, 0.05) 50%, transparent 100%)';
        } else if (ed.verificationType === 'blue' || ed.isVerified) {
            verifiedBadge.title = "Verified";
            verifiedBadge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28"><path fill="#1d9bf0" d="M22.5 12.5l-1.58 1.58.21 2.24-2.24.21-1.27 1.86-2.16-.92-1.66 1.48L12 17.5l-1.8 1.45-1.66-1.48-2.16.92-1.27-1.86-2.24-.21.21-2.24L1.5 12.5l1.58-1.58-.21-2.24 2.24-.21 1.27-1.86 2.16.92 1.66-1.48L12 6.5l1.8-1.45 1.66 1.48 2.16-.92 1.27 1.86 2.24.21-.21 2.24 1.58 1.58z" /><path fill="#fff" d="M10.5 16l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z" /></svg>';
            verifiedBadge.classList.remove('hidden');
            if(epAvatar) epAvatar.style.border = '4px solid #10B981'; // User requested green border for blue verify
        } else {
            verifiedBadge.classList.add('hidden');
        }
    }
    
    // Banner
    const epBanner = document.getElementById('epBanner');
    if (epBanner) {
        if (ed.banner_url) {
            epBanner.src = ed.banner_url;
            epBanner.style.display = 'block';
        } else {
            epBanner.src = '';
            epBanner.style.display = 'none';
        }
    }
    
    document.getElementById('epAvatar').src = ed.photo_url || 'https://via.placeholder.com/150';
    document.getElementById('epName').textContent = ed.name;
    document.getElementById('epCategory').textContent = ed.category;
    
    // Rating & Reviews
    const editorReviews = allReviews.filter(r => r.editorId === ed.id);
    let avgRating = 0;
    if (editorReviews.length > 0) {
        const sum = editorReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        avgRating = (sum / editorReviews.length).toFixed(1);
    }
    document.getElementById('epRating').textContent = editorReviews.length > 0 ? avgRating : 'New';
    
    const epReviewsCount = document.getElementById('epReviewsCount');
    if (epReviewsCount) epReviewsCount.textContent = editorReviews.length;
    
    const reviewsList = document.getElementById('epReviewsList');
    if (reviewsList) {
        if (editorReviews.length === 0) {
            reviewsList.innerHTML = '<p class="text-secondary text-sm">No reviews yet.</p>';
        } else {
            reviewsList.innerHTML = editorReviews.map(r => `
                <div class="review-item mb-2 p-2 glass-card" style="border: 1px solid var(--glass-border); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>${r.userEmail ? r.userEmail.split('@')[0] : 'User'}</strong>
                        <span style="color: #f59e0b;">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</span>
                    </div>
                    <p class="text-sm mt-1">${r.text || ''}</p>
                </div>
            `).join('');
        }
    }

    document.getElementById('epProjects').textContent = ed.projects || 0;
    document.getElementById('epBio').textContent = ed.bio || 'No professional summary provided.';
    document.getElementById('epExperience').textContent = ed.experience || 'Not specified';
    let epPriceText = ed.price || '0';
    if(ed.maxPrice) epPriceText += ` - ₹${ed.maxPrice}`;
    document.getElementById('epPrice').textContent = epPriceText;
    document.getElementById('epAvailability').textContent = ed.availability || 'Available';
    
    // Determine the user's request state for this editor
    const contactBtn = document.getElementById('contactEditorBtn');
    contactBtn.disabled = false;
    
    let userRequest = null;
    if(currentUser) {
        userRequest = allRequests.find(r => r.editorId === ed.id && r.userId === currentUser.uid);
    }

    if (userRequest) {
        // User has already made a request
        if (userRequest.status === 'pending') {
            contactBtn.textContent = 'Request Pending...';
            contactBtn.className = 'btn secondary w-100 btn-large mt-auto';
            contactBtn.disabled = true;
        } else if (userRequest.status === 'online') {
            contactBtn.innerHTML = '🟢 Working (Online)';
            contactBtn.className = 'btn secondary w-100 btn-large mt-auto';
            contactBtn.disabled = true;
        } else if (userRequest.status === 'completed') {
            // Check if user already reviewed
            const hasReviewed = allReviews.find(r => r.editorId === ed.id && r.userId === currentUser.uid);
            if(hasReviewed) {
                contactBtn.textContent = 'Completed & Reviewed';
                contactBtn.className = 'btn secondary w-100 btn-large mt-auto';
                contactBtn.disabled = true;
            } else {
                contactBtn.textContent = 'Completed - Write Review';
                contactBtn.className = 'btn primary w-100 btn-large mt-auto';
            }
        }
    } else {
        if (ed.availability === 'Busy') {
            document.getElementById('epAvailability').className = 'text-danger';
            contactBtn.textContent = 'Join Waitlist';
            contactBtn.className = 'btn secondary w-100 btn-large mt-auto';
        } else {
            document.getElementById('epAvailability').className = 'text-success';
            contactBtn.textContent = 'Send Hire Request';
            contactBtn.className = 'btn primary w-100 btn-large mt-auto';
        }
    }
    
    // Skills
    const skillsArr = ed.skills ? ed.skills.split(',').map(s => s.trim()) : [];
    document.getElementById('epSkills').innerHTML = skillsArr.length > 0 ? skillsArr.map(s => `<span class="skill-tag">${s}</span>`).join('') : '<p class="text-sm text-secondary">Not specified.</p>';
    
    // Tools
    const toolsArr = ed.tools ? ed.tools.split(',').map(s => s.trim()) : [];
    if(document.getElementById('epTools')) document.getElementById('epTools').innerHTML = toolsArr.length > 0 ? toolsArr.map(s => `<span class="tool-tag">${s}</span>`).join('') : '<p class="text-sm text-secondary">No tools specified.</p>';
    
    // Portfolio
    if (ed.portfolio) {
        document.getElementById('epPortfolio').innerHTML = `<a href="${ed.portfolio}" target="_blank">View Portfolio →</a>`;
    } else {
        document.getElementById('epPortfolio').innerHTML = '<span class="text-secondary text-sm">No portfolio link provided.</span>';
    }
    
    // Video Clips
    const clipsArr = ed.video_clips ? ed.video_clips.split(',').map(s => s.trim()) : [];
    if(document.getElementById('epVideoClips')) {
        document.getElementById('epVideoClips').innerHTML = clipsArr.length > 0 ? clipsArr.map((c, i) => {
            return `<a href="${c}" target="_blank" rel="noopener noreferrer" class="video-clip-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Watch Clip ${i+1}
            </a>`;
        }).join('') : '';
    }

    profileModal.style.display = 'flex';
}

document.getElementById('closeProfileModal').addEventListener('click', () => { profileModal.style.display = 'none'; });
if(document.getElementById('closeProfileBtn')) document.getElementById('closeProfileBtn').addEventListener('click', () => { profileModal.style.display = 'none'; });
if(document.getElementById('closeProfileBtnMobile')) document.getElementById('closeProfileBtnMobile').addEventListener('click', () => { profileModal.style.display = 'none'; });

// Workflow: Send Request / Leave Review / Waitlist
document.getElementById('contactEditorBtn').addEventListener('click', async () => {
    if (!currentUser) {
        loginPromptModal.style.display = 'flex';
        return;
    }
    
    // Check if profile is complete
    const up = allUsers[currentUser.uid];
    if (!up || !up.firstName || !up.lastName || !up.phone) {
        profileModal.style.display = 'none';
        window.openUserProfileModal(true);
        return;
    }
    
    const ed = editors.find(e => e.id === currentProfileId);
    if (!ed) return;
    
    let userRequest = allRequests.find(r => r.editorId === ed.id && r.userId === currentUser.uid);
    
    if (userRequest) {
        if (userRequest.status === 'completed') {
            // Check if already reviewed
            if (allReviews.find(r => r.editorId === ed.id && r.userId === currentUser.uid)) return;
            // Open review modal
            document.getElementById('reviewModal').style.display = 'flex';
        }
        return;
    }
    
    // We don't have a user request yet
    if (ed.availability === 'Busy') {
        alert("You have joined the waitlist.");
        return;
    }
    
    // Send Hire Request
    const btn = document.getElementById('contactEditorBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    try {
        const reqRef = push(ref(db, "requests"));
        await set(reqRef, {
            editorId: ed.id,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            status: "pending",
            timestamp: Date.now()
        });
        // re-fetch or optimistically update
        allRequests.push({
            id: reqRef.key,
            editorId: ed.id,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            status: "pending",
            timestamp: Date.now()
        });
        openEditorProfile(ed.id); // re-render profile state
    } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = 'Send Hire Request';
        alert('Failed to send request.');
    }
});

// Setup review modal close
document.getElementById('closeReviewModal').addEventListener('click', () => {
    document.getElementById('reviewModal').style.display = 'none';
});

// User Profile Logic
window.openUserProfileModal = function(showMustComplete = false) {
    if (!currentUser) {
        loginPromptModal.style.display = 'flex';
        return;
    }
    const up = allUsers[currentUser.uid] || {};
    document.getElementById('upFirstName').value = up.firstName || '';
    document.getElementById('upLastName').value = up.lastName || '';
    document.getElementById('upPhone').value = up.phone || '';
    document.getElementById('upEmail').value = currentUser.email;
    document.getElementById('upAvatarUrl').value = up.photoUrl || '';
    document.getElementById('upAvatarPreview').src = up.photoUrl || currentUser.photoURL || 'https://via.placeholder.com/80';
    
    if(showMustComplete) {
        profileCompleteMsg.classList.remove('hidden');
    } else {
        profileCompleteMsg.classList.add('hidden');
    }
    
    renderUserRequestsList();
    renderUserApplicationsList();
    userProfileModal.style.display = 'flex';
};

function renderUserApplicationsList() {
    const list = document.getElementById('userApplicationsList');
    if (!list || !currentUser) return;
    const apps = allApplications.filter(a => a.userId === currentUser.uid);
    if(apps.length === 0) {
        list.innerHTML = '<p class="text-secondary text-sm">No job applications submitted yet.</p>';
        return;
    }
    
    list.innerHTML = apps.map(app => {
        let statusColor = app.status === 'pending' ? 'var(--warning)' : (app.status === 'approved' ? 'var(--success)' : 'var(--danger)');
        
        let priceText = `₹${app.price}`;
        if(app.maxPrice) priceText += ` - ₹${app.maxPrice}`;
        
        const deleteButtonInfo = app.deletionScheduledAt ? 
            `<button class="btn success btn-sm" onclick="window.recoverUserJobApp('${app.id}')">Recover (30m)</button>` : 
            `<button class="btn danger btn-sm" onclick="window.deleteUserJobApp('${app.id}')">Remove</button>`;

        const pendingDeletionWarning = app.deletionScheduledAt ? `<p class="text-xs text-danger mb-2">Scheduled for deletion soon.</p>` : '';

        return `<div class="p-3 mb-3" style="background:rgba(255,255,255,0.02); border-radius:12px; border:1px solid var(--glass-border); ${app.deletionScheduledAt ? 'opacity: 0.6;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div>
                    <h4 style="margin:0; font-size:1.1rem;">${app.category} Editor ${app.style ? ' - ' + app.style : ''}</h4>
                    <p class="text-xs text-secondary mb-1">Submitted: ${new Date(app.timestamp).toLocaleDateString()}</p>
                </div>
                <span class="text-sm font-bold" style="color:${statusColor}; text-transform:uppercase;">${app.status || 'Pending'}</span>
            </div>
            ${pendingDeletionWarning}
            <p class="text-sm mb-2" style="color:#d1d5db;">Price: ${priceText} | Exp: ${app.experience}</p>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="btn secondary btn-sm" onclick="window.editUserJobApp('${app.id}')" ${app.deletionScheduledAt ? 'disabled' : ''}>Update</button>
                ${deleteButtonInfo}
            </div>
        </div>`;
    }).join('');
}

window.deleteUserJobApp = async (appId) => {
    if(!confirm("Are you sure? It will be deleted in 30 minutes, but you can recover it before then. Your public profile will also be hidden.")) return;
    try {
        await update(ref(db, "editor_applications/" + appId), { deletionScheduledAt: Date.now() });
        const app = allApplications.find(a => a.id === appId);
        if(app) {
            app.deletionScheduledAt = Date.now();
            const ed = editors.find(e => e.userId === app.userId);
            if(ed) {
                await update(ref(db, "editors/" + ed.id), { deletionScheduledAt: Date.now() });
                ed.deletionScheduledAt = Date.now();
            }
        }
        renderUserApplicationsList();
        filterAndRenderEditors();
        renderTrending();
    } catch(e) {
        console.error(e);
        alert('Failed to schedule deletion.');
    }
};

window.recoverUserJobApp = async (appId) => {
    try {
        await update(ref(db, "editor_applications/" + appId), { deletionScheduledAt: null });
        const app = allApplications.find(a => a.id === appId);
        if(app) {
            app.deletionScheduledAt = null;
            const ed = editors.find(e => e.userId === app.userId);
            if(ed) {
                await update(ref(db, "editors/" + ed.id), { deletionScheduledAt: null });
                ed.deletionScheduledAt = null;
            }
        }
        renderUserApplicationsList();
        filterAndRenderEditors();
        renderTrending();
    } catch(e) {
        console.error(e);
        alert('Failed to recover application.');
    }
};

window.editUserJobApp = (appId) => {
    const app = allApplications.find(a => a.id === appId);
    if(!app) return;
    
    // Switch to jobs view
    userProfileModal.style.display = 'none';
    window.switchNavView('jobs');
    
    // Fill the jobs form with the data safely
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    
    setVal('jobName', app.name || '');
    setVal('jobEmail', app.email || '');
    setVal('jobPhone', app.phone || '');
    setVal('jobCategory', app.category);
    setVal('jobStyle', app.style || '');
    setVal('jobPrice', app.price);
    setVal('jobMaxPrice', app.maxPrice || '');
    setVal('jobExperience', app.experience);
    setVal('jobSkills', app.skills);
    setVal('jobTools', app.tools || '');
    setVal('jobBio', app.bio);
    setVal('jobPortfolio', app.portfolio || '');
    setVal('jobVideoClips', app.videoLinks ? (Array.isArray(app.videoLinks) ? app.videoLinks.join(', ') : app.videoLinks) : '');
    
    setVal('jobAvatarUrl', app.photo_url || '');
    setVal('jobBannerUrl', app.banner_url || '');
    
    const avatarPrev = document.getElementById('jobAvatarPreview');
    const bannerPrev = document.getElementById('jobBannerPreview');
    
    if(app.photo_url) {
        avatarPrev.src = app.photo_url;
        avatarPrev.style.display = 'block';
    }
    if(app.banner_url) {
        bannerPrev.src = app.banner_url;
        bannerPrev.style.display = 'block';
    }
    
    // Mark as updating
    const submitBtn = document.getElementById('submitJobReqBtn');
    submitBtn.textContent = 'Update Application';
    submitBtn.dataset.updateId = appId;
};

function renderUserRequestsList() {
    const list = document.getElementById('userRequestsList');
    if (!currentUser) return;
    const reqs = allRequests.filter(r => r.userId === currentUser.uid);
    if(reqs.length === 0) {
        list.innerHTML = '<p class="text-secondary text-sm">No ongoing or past requests.</p>';
        return;
    }
    list.innerHTML = reqs.map(r => {
        const ed = editors.find(e => e.id === r.editorId) || editors.find(e => e.id === r.editorId);
        const edName = ed ? ed.name : 'Unknown Editor';
        let statusHtml = '';
        if(r.status === 'pending') statusHtml = '<span class="text-warning">Pending</span>';
        if(r.status === 'online') statusHtml = '<span class="text-primary">🟢 Active Request</span>';
        if(r.status === 'completed') statusHtml = '<span class="text-success">Completed</span>';
        
        return `<div class="glass-card mb-2 p-2" style="border: 1px solid var(--glass-border);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${edName}</strong>
                ${statusHtml}
            </div>
            <p class="text-sm mt-1 text-secondary">${new Date(r.timestamp).toLocaleDateString()}</p>
        </div>`;
    }).join('');
}

closeUserProfile.addEventListener('click', () => {
    userProfileModal.style.display = 'none';
});

upAvatarUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if (!file.type.match('image.*')) {
        alert('Please select an image file.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxWidth = 200, maxHeight = 200;
            if (width > height) {
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
            } else {
                if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            upAvatarUrl.value = dataUrl;
            upAvatarPreview.src = dataUrl;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

saveUserProfileBtn.addEventListener('click', async () => {
    const fName = document.getElementById('upFirstName').value.trim();
    const lName = document.getElementById('upLastName').value.trim();
    const phone = document.getElementById('upPhone').value.trim();
    
    if(!fName || !lName || !phone) {
        alert("First name, Last name, and Contact number are required.");
        return;
    }
    
    saveUserProfileBtn.disabled = true;
    saveUserProfileBtn.textContent = 'Saving...';
    
    try {
        const payload = {
            firstName: fName,
            lastName: lName,
            phone: phone,
            email: currentUser.email,
            photoUrl: upAvatarUrl.value || currentUser.photoURL || '',
            updatedAt: Date.now()
        };
        
        await set(ref(db, "users/" + currentUser.uid), payload);
        allUsers[currentUser.uid] = payload;
        
        if (payload.photoUrl) {
            userAvatar.src = payload.photoUrl;
        }
        
        userProfileModal.style.display = 'none';
    } catch(err) {
        console.error(err);
        alert('Failed to save profile. ' + err.message);
    } finally {
        saveUserProfileBtn.disabled = false;
        saveUserProfileBtn.textContent = 'Save Profile';
    }
});

window.viewAdminRequests = function(editorId) {
    const listContainer = document.getElementById('adminRequestsList');
    listContainer.innerHTML = '';
    
    // Filter requests for this editor
    const reqs = allRequests.filter(r => r.editorId === editorId);
    
    if (reqs.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-secondary">No requests for this editor yet.</p>';
    } else {
        reqs.forEach(r => {
            const div = document.createElement('div');
            div.className = 'glass-card mb-3 p-3';
            div.style.border = '1px solid var(--glass-border)';
            div.innerHTML = `
                <p><strong>User:</strong> ${r.userEmail}</p>
                <p><strong>Status:</strong> ${r.status}</p>
                <p><strong>Date:</strong> ${new Date(r.timestamp).toLocaleString()}</p>
                <div class="mt-2 text-right">
                    ${r.status === 'pending' ? `<button class="btn btn-sm primary mr-2" onclick="window.updateAdminRequest('${r.id}', 'online')">Accept Request</button>` : ''}
                    ${r.status === 'online' ? `<button class="btn btn-sm primary mr-2" onclick="window.updateAdminRequest('${r.id}', 'completed')">Mark Completed</button>` : ''}
                    <button class="btn btn-sm danger" onclick="window.updateAdminRequest('${r.id}', 'deleted')">Ignore / Delete</button>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }
    
    document.getElementById('adminRequestsModal').style.display = 'flex';
};

window.updateAdminRequest = async function(reqId, newStatus) {
    try {
        if (newStatus === 'deleted') {
            await remove(ref(db, "requests/" + reqId));
            // Update local state
            allRequests = allRequests.filter(r => r.id !== reqId);
        } else {
            await update(ref(db, "requests/" + reqId), { status: newStatus });
            // Update local state
            const rq = allRequests.find(r => r.id === reqId);
            if (rq) rq.status = newStatus;
        }
        
        // Re-render the modal
        // Find which editor's requests we are viewing (just pick it from the request if we can)
        document.getElementById('adminRequestsModal').style.display = 'none';
        alert('Request updated.');
        // No auto-re-open here, simplistic
    } catch(err) {
        console.error(err);
        alert('Failed to update request.');
    }
};

document.getElementById('closeAdminRequestsModal').addEventListener('click', () => {
    document.getElementById('adminRequestsModal').style.display = 'none';
});

// Submit review
document.getElementById('submitReviewBtn').addEventListener('click', async () => {
    const text = document.getElementById('reviewText').value.trim();
    if(!text || !window.currentReviewStars) {
        alert("Please provide a rating and review text.");
        return;
    }
    
    const btn = document.getElementById('submitReviewBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    
    try {
        const revRef = push(ref(db, "reviews"));
        await set(revRef, {
            editorId: currentProfileId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            rating: window.currentReviewStars,
            text: text,
            timestamp: Date.now()
        });
        allReviews.push({
            id: revRef.key,
            editorId: currentProfileId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            rating: window.currentReviewStars,
            text: text,
            timestamp: Date.now()
        });
        
        // Optionally update editor rating
        
        document.getElementById('reviewModal').style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Submit Review';
        document.getElementById('reviewText').value = '';
        window.currentReviewStars = 0;
        document.querySelectorAll('#reviewStars span').forEach(s => s.style.color = 'var(--text-secondary)');
        
        openEditorProfile(currentProfileId);
    } catch(err) {
        console.error(err);
        alert('Failed to submit review.');
        btn.disabled = false;
        btn.textContent = 'Submit Review';
    }
});

// Stars logic
document.querySelectorAll('#reviewStars span').forEach(span => {
    span.addEventListener('click', (e) => {
        const val = parseInt(e.target.dataset.val);
        window.currentReviewStars = val;
        document.querySelectorAll('#reviewStars span').forEach(s => {
            if(parseInt(s.dataset.val) <= val) {
                s.textContent = '★';
                s.style.color = '#f59e0b';
            } else {
                s.textContent = '☆';
                s.style.color = 'var(--text-secondary)';
            }
        });
    });
});

document.getElementById('closeContactModal').addEventListener('click', () => { contactModal.style.display = 'none'; });
document.getElementById('closeLoginPrompt').addEventListener('click', () => { loginPromptModal.style.display = 'none'; });

// 3D Hover Effect
document.addEventListener('mousemove', (e) => {
    if(!userSettings.animations) return;
    const card = document.getElementById('auth3dCard');
    if(!card) return;
    
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Only animate if mouse is generally near the card
    if (x > -100 && x < rect.width + 100 && y > -100 && y < rect.height + 100) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -10; // max rotation degrees
        const rotateY = ((x - centerX) / centerX) * 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    } else {
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
    }
});

// ==========================================
// Settings & Hidden Admin Access
// ==========================================
if(settingsBtn) settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
const authScreenSettingsBtn = document.getElementById('authScreenSettingsBtn');
if(authScreenSettingsBtn) { authScreenSettingsBtn.addEventListener('click', () => { settingsModal.style.display = 'flex'; }); }

if(closeSettings) closeSettings.addEventListener('click', () => { settingsModal.style.display = 'none'; });

// Handle Color Selection
document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        userSettings.accent = e.target.dataset.color;
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
    });
});

if(document.getElementById('saveSettingsBtn')) document.getElementById('saveSettingsBtn').addEventListener('click', () => {
    userSettings.theme = document.getElementById('prefTheme').value;
    userSettings.font = document.getElementById('prefFont').value;
    userSettings.animations = document.getElementById('prefAnimations').checked;
    userSettings.sounds = document.getElementById('prefSounds').checked;
    
    localStorage.setItem('lumina_settings', JSON.stringify(userSettings));
    applySettings();
    settingsModal.style.display = 'none';
});

// Admin Unlock Logic
let adminClickCount = 0;
let adminClickTimer = null;
const appVersionTracker = document.getElementById('appVersionTracker');
const adminPinModal = document.getElementById('adminPinModal');

if(appVersionTracker) appVersionTracker.addEventListener('click', () => {
    adminClickCount++;
    if (adminClickCount >= 5) {
        adminClickCount = 0;
        settingsModal.style.display = 'none';
        adminPinModal.style.display = 'flex';
    }
    clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 2000);
});

if(document.getElementById('closeAdminPin')) document.getElementById('closeAdminPin').addEventListener('click', () => { adminPinModal.style.display = 'none'; });
if(document.getElementById('verifyPinBtn')) document.getElementById('verifyPinBtn').addEventListener('click', () => {
    const pin = document.getElementById('adminPinInput').value;
    if (pin === 'admin123') { // Hidden password
        adminPinModal.style.display = 'none';
        document.getElementById('adminPinInput').value = '';
        document.getElementById('adminPinError').classList.add('hidden');
        openAdminPanel();
    } else {
        document.getElementById('adminPinError').classList.remove('hidden');
    }
});


// ==========================================
// Admin Operations
// ==========================================
const adminPanelOverlay = document.getElementById('adminPanelOverlay');
const editorFormModal = document.getElementById('editorFormModal');

function openAdminPanel() {
    adminPanelOverlay.style.display = 'block';
    renderAdminList();
}

if(document.getElementById('closeAdminPanelBtn')) {
    document.getElementById('closeAdminPanelBtn').addEventListener('click', () => { 
        adminPanelOverlay.style.display = 'none'; 
        mainApp.style.display = 'block'; 
        window.switchNavView('home');
    });
}

function renderAdminList() {
    document.getElementById('statTotal').textContent = editors.length;
    document.getElementById('statFeatured').textContent = editors.filter(e => e.isFeatured).length;
    document.getElementById('statVerified').textContent = editors.filter(e => e.isVerified || e.verificationType === 'blue' || e.verificationType === 'golden').length;
    
    const tbody = document.getElementById('adminEditorsList');
    tbody.innerHTML = '';
    
    editors.forEach(ed => {
        let verifiedText = '';
        if (ed.verificationType === 'golden') {
            verifiedText = '<span class="text-xs pl-1" style="color:var(--warning);">★ Golden</span>';
        } else if (ed.verificationType === 'blue' || ed.isVerified) {
            verifiedText = '<span class="text-success text-xs pl-1">✓ Blue</span>';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${ed.photo_url || 'https://via.placeholder.com/40'}" class="table-img"></td>
            <td><strong>${ed.name}</strong></td>
            <td><span class="category-tag">${ed.category}</span></td>
            <td>₹${ed.price}</td>
            <td>${ed.views || 0}</td>
            <td>
                ${verifiedText}
                ${ed.isFeatured ? '<span style="color:var(--primary); font-size:0.8rem; margin-left:5px;">[Featured]</span>' : ''}
            </td>
            <td style="display: flex; gap: 5px;">
                <button class="btn primary btn-sm" onclick="window.viewAdminRequests('${ed.id}')">Requests</button>
                <button class="btn secondary btn-sm" onclick="window.editAdminEditor('${ed.id}')">Edit</button>
                <button class="btn danger btn-sm" onclick="window.deleteAdminEditor('${ed.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const appsTbody = document.getElementById('adminJobAppsList');
    if(appsTbody) {
        appsTbody.innerHTML = '';
        const pendingApps = allApplications.filter(a => a.status === 'pending');
        if(pendingApps.length === 0) {
            appsTbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary text-sm">No new applications.</td></tr>';
        } else {
            pendingApps.forEach(app => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><img src="${app.photo_url || 'https://via.placeholder.com/40'}" class="table-img"></td>
                    <td><strong>${app.name}</strong><br><span class="text-xs text-secondary">${app.email}</span></td>
                    <td><span class="category-tag">${app.category}</span></td>
                    <td>₹${app.price}</td>
                    <td>${new Date(app.timestamp).toLocaleDateString()}</td>
                    <td style="display: flex; gap: 5px;">
                        <button class="btn btn-sm" style="background:#3b82f6;color:white;" onclick="window.viewEditJobApp('${app.id}')">View/Edit</button>
                        <button class="btn success btn-sm" onclick="window.approveJobApp('${app.id}')">Approve</button>
                        <button class="btn danger btn-sm" onclick="window.rejectJobApp('${app.id}')">Reject</button>
                    </td>
                `;
                appsTbody.appendChild(tr);
            });
        }
    }
}

// Job Application Actions
window.approveJobApp = async (appId) => {
    if(!confirm("Approve this application and add them as an editor?")) return;
    const app = allApplications.find(a => a.id === appId);
    if(!app) return;
    
    // Create new editor entry
    try {
        const editorRef = push(ref(db, "editors"));
        const newEditorData = {
            userId: app.userId || '',
            name: app.name,
            email: app.email,
            phone: app.phone,
            category: app.category,
            style: app.style || '',
            price: app.price,
            experience: app.experience,
            skills: app.skills,
            tools: app.tools || '',
            bio: app.bio,
            videoClips: app.videoLinks || [],
            photo_url: app.photo_url,
            banner_url: app.banner_url,
            portfolio: app.portfolio || '',
            availability: 'Available',
            projects: 0,
            views: 0,
            verificationType: 'blue',
            isVerified: true,  // Automatically verify when approved via admin
            isFeatured: false,
            createdAt: Date.now()
        };
        await set(editorRef, newEditorData);
        // Mark application as approved
        await set(ref(db, "editor_applications/" + appId + "/status"), 'approved');
        
        // Locally update to re-render without reloading
        const updatedApp = allApplications.find(a => a.id === appId);
        if(updatedApp) updatedApp.status = 'approved';
        
        // Optionally add to local editors array to reflect immediately
        editors.push({id: editorRef.key, ...newEditorData});
        
        renderAdminList();
        renderTrending();
        filterAndRenderEditors();
        alert('Editor approved and added to platform!');
    } catch(e) {
        console.error(e);
        alert('Failed to approve application.');
    }
};

window.rejectJobApp = async (appId) => {
    if(!confirm("Reject and delete this application?")) return;
    try {
        await remove(ref(db, "editor_applications/" + appId));
        allApplications = allApplications.filter(a => a.id !== appId);
        renderAdminList();
    } catch(e) {
        console.error(e);
        alert('Failed to reject application.');
    }
};

// Add New
if(document.getElementById('addNewEditorBtn')) document.getElementById('addNewEditorBtn').addEventListener('click', () => {
    document.getElementById('editorFormTitle').textContent = 'Add New Editor';
    document.getElementById('editEditorId').value = '';
    clearEditorForm();
    editorFormModal.style.display = 'flex';
});

function clearEditorForm() {
    document.getElementById('edName').value = '';
    document.getElementById('edCategory').value = 'Video';
    if (document.getElementById('edStyle')) document.getElementById('edStyle').value = '';
    document.getElementById('edPrice').value = '';
    document.getElementById('edExperience').value = '';
    document.getElementById('edSkills').value = '';
    if(document.getElementById('edTools')) document.getElementById('edTools').value = '';
    document.getElementById('edBio').value = '';
    if(document.getElementById('edVideoClips')) document.getElementById('edVideoClips').value = '';
    document.getElementById('edAvatarUrl').value = '';
    document.getElementById('edBannerUrl').value = '';
    document.getElementById('edAvailability').value = 'Available';
    document.getElementById('edProjects').value = 0;
    document.getElementById('edEmail').value = '';
    document.getElementById('edWhatsapp').value = '';
    document.getElementById('edPortfolio').value = '';
    document.getElementById('edIsFeatured').checked = false;
    document.getElementById('edVerificationType').value = 'none';
    
    document.getElementById('edAvatarPreview').style.display = 'none';
    document.getElementById('edBannerPreview').style.display = 'none';
}

if(document.getElementById('closeEditorForm')) document.getElementById('closeEditorForm').addEventListener('click', () => { editorFormModal.style.display = 'none'; });
if(document.getElementById('closeEditorFormBtn')) document.getElementById('closeEditorFormBtn').addEventListener('click', () => { editorFormModal.style.display = 'none'; });

window.viewEditJobApp = (appId) => {
    const app = allApplications.find(a => a.id === appId);
    if (!app) return;
    document.getElementById('editorFormTitle').textContent = 'Review Application';
    document.getElementById('editEditorId').value = 'APP_' + appId;
    document.getElementById('edName').value = app.name || '';
    document.getElementById('edCategory').value = app.category || 'Video';
    if(document.getElementById('edStyle')) document.getElementById('edStyle').value = app.style || '';
    document.getElementById('edPrice').value = app.price || 50;
    document.getElementById('edExperience').value = app.experience || '1-3 years';
    document.getElementById('edSkills').value = app.skills || '';
    document.getElementById('edTools').value = app.tools || '';
    document.getElementById('edBio').value = app.bio || '';
    document.getElementById('edPortfolio').value = app.portfolio || '';
    // video clips in app are saved as videoLinks[] array, sometimes comma joined
    if(document.getElementById('edVideoClips')) document.getElementById('edVideoClips').value = app.videoLinks ? (Array.isArray(app.videoLinks) ? app.videoLinks.join(', ') : app.videoLinks) : '';
    
    document.getElementById('edAvatarUrl').value = app.photo_url || '';
    document.getElementById('edBannerUrl').value = app.banner_url || '';
    
    if(app.photo_url) {
        document.getElementById('edAvatarPreview').src = app.photo_url;
        document.getElementById('edAvatarPreview').style.display = 'block';
    } else {
        document.getElementById('edAvatarPreview').style.display = 'none';
    }
    if(app.banner_url) {
        document.getElementById('edBannerPreview').src = app.banner_url;
        document.getElementById('edBannerPreview').style.display = 'block';
    } else {
        document.getElementById('edBannerPreview').style.display = 'none';
    }
    
    document.getElementById('edIsFeatured').checked = false;
    document.getElementById('edVerificationType').value = 'blue'; // Apps usually become verified automatically
    
    editorFormModal.style.display = 'flex';
};

// Edit Exposing Globally for inline onclick
window.editAdminEditor = (id) => {
    const ed = editors.find(e => e.id === id);
    if(!ed) return;
    
    document.getElementById('editorFormTitle').textContent = 'Edit Editor Profile';
    document.getElementById('editEditorId').value = id;
    
    document.getElementById('edName').value = ed.name || '';
    document.getElementById('edCategory').value = ed.category || 'Video';
    if(document.getElementById('edStyle')) document.getElementById('edStyle').value = ed.style || '';
    document.getElementById('edPrice').value = ed.price || '';
    if(document.getElementById('edMaxPrice')) document.getElementById('edMaxPrice').value = ed.maxPrice || '';
    document.getElementById('edExperience').value = ed.experience || '';
    document.getElementById('edSkills').value = ed.skills || '';
    if(document.getElementById('edTools')) document.getElementById('edTools').value = ed.tools || '';
    document.getElementById('edBio').value = ed.bio || '';
    if(document.getElementById('edVideoClips')) document.getElementById('edVideoClips').value = ed.video_clips || '';
    document.getElementById('edAvatarUrl').value = ed.photo_url || '';
    document.getElementById('edBannerUrl').value = ed.banner_url || '';
    document.getElementById('edAvailability').value = ed.availability || 'Available';
    document.getElementById('edProjects').value = ed.projects || 0;
    document.getElementById('edEmail').value = ed.email || '';
    document.getElementById('edWhatsapp').value = ed.whatsapp || '';
    document.getElementById('edPortfolio').value = ed.portfolio || '';
    document.getElementById('edIsFeatured').checked = !!ed.isFeatured;
    
    if (ed.verificationType) {
        document.getElementById('edVerificationType').value = ed.verificationType;
    } else {
        document.getElementById('edVerificationType').value = ed.isVerified ? 'blue' : 'none';
    }
    
    if(ed.photo_url) {
        document.getElementById('edAvatarPreview').src = ed.photo_url;
        document.getElementById('edAvatarPreview').style.display = 'block';
    }
    if(ed.banner_url) {
        document.getElementById('edBannerPreview').src = ed.banner_url;
        document.getElementById('edBannerPreview').style.display = 'block';
    }
    
    editorFormModal.style.display = 'flex';
};

window.deleteAdminEditor = async (id) => {
    if(confirm("Are you sure you want to completely remove this editor profile?")) {
        try {
            await remove(ref(db, "editors/" + id));
            fetchEditors();
        } catch(err) {
            console.error("Delete failed", err);
            alert("Delete failed. Check permissions.");
        }
    }
};

// Save Editor Logic
if(document.getElementById('saveEditorBtn')) document.getElementById('saveEditorBtn').addEventListener('click', async () => {
    const id = document.getElementById('editEditorId').value;
    const saveBtn = document.getElementById('saveEditorBtn');
    
    const maxP = document.getElementById('edMaxPrice') ? document.getElementById('edMaxPrice').value : '';
    const payload = {
        name: document.getElementById('edName').value,
        category: document.getElementById('edCategory').value,
        style: document.getElementById('edStyle') ? document.getElementById('edStyle').value : '',
        price: Number(document.getElementById('edPrice').value),
        maxPrice: maxP ? Number(maxP) : null,
        experience: document.getElementById('edExperience').value,
        skills: document.getElementById('edSkills').value,
        tools: document.getElementById('edTools') ? document.getElementById('edTools').value : '',
        bio: document.getElementById('edBio').value,
        video_clips: document.getElementById('edVideoLinks') ? document.getElementById('edVideoLinks').value : (document.getElementById('edVideoClips') ? document.getElementById('edVideoClips').value : ''),
        photo_url: document.getElementById('edAvatarUrl').value,
        banner_url: document.getElementById('edBannerUrl').value,
        availability: document.getElementById('edAvailability').value,
        projects: Number(document.getElementById('edProjects').value),
        email: document.getElementById('edEmail').value,
        whatsapp: document.getElementById('edWhatsapp').value,
        portfolio: document.getElementById('edPortfolio').value,
        isFeatured: document.getElementById('edIsFeatured').checked,
        verificationType: document.getElementById('edVerificationType').value,
        isVerified: document.getElementById('edVerificationType').value === 'blue' || document.getElementById('edVerificationType').value === 'golden',
    };
    
    if(!payload.name || !payload.price) {
        alert("Name and Price are required.");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        if(id) {
            if (id.startsWith('APP_')) {
                // Editing an existing job application to approve it
                const appId = id.replace('APP_', '');
                const app = allApplications.find(a => a.id === appId);
                if(app) {
                    payload.userId = app.userId || '';
                    payload.views = 0;
                    payload.rating = "5.0";
                    payload.createdAt = Date.now();
                    const editorRef = push(ref(db, "editors"));
                    await set(editorRef, payload);
                    await set(ref(db, "editor_applications/" + appId + "/status"), 'approved');
                    allApplications.find(a => a.id === appId).status = 'approved';
                    renderAdminList(); // Refresh admin list
                }
            } else {
                // Normal Update
                await update(ref(db, "editors/" + id), payload);
            }
        } else {
            // Create
            payload.views = 0;
            payload.rating = "5.0";
            payload.created_at = new Date().toISOString();
            await push(ref(db, "editors"), payload);
        }
        editorFormModal.style.display = 'none';
        fetchEditors();
    } catch(err) {
        console.error("Save error:", err);
        alert("Failed to save changes. Make sure you have Write permissions.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Editor';
    }
});


// ==========================================
// File Upload Logic (Canvas Base64)
// ==========================================
function setupImageUpload(inputId, urlInputId, previewId, btnId, containerId, barId, textId, maxWidth, maxHeight) {
    const fileInput = document.getElementById(inputId);
    const urlInput = document.getElementById(urlInputId);
    const previewImg = document.getElementById(previewId);
    const browseBtn = document.getElementById(btnId);
    const progressContainer = document.getElementById(containerId);
    const progressBar = document.getElementById(barId);
    const progressText = document.getElementById(textId);

    if (!fileInput || !urlInput || !previewImg || !browseBtn) return;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;

        if (!file.type.match('image.*')) {
            alert('Please select an image file.');
            return;
        }

        browseBtn.disabled = true;
        progressContainer.style.display = 'block';
        progressBar.style.width = '30%';
        progressText.textContent = 'Processing Image...';

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // Resize image via Canvas to avoid large base64 strings
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                
                progressBar.style.width = '100%';
                progressText.textContent = 'Complete!';
                
                urlInput.value = dataUrl;
                previewImg.src = dataUrl;
                previewImg.style.display = 'block';

                browseBtn.disabled = false;
                setTimeout(() => { progressContainer.style.display = 'none'; }, 2000);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Bind avatar (max 400x400) and banner (max 1200x800)
setupImageUpload('edAvatarUpload', 'edAvatarUrl', 'edAvatarPreview', 'edAvatarBtn', 'edAvatarProgressContainer', 'edAvatarProgressBar', 'edAvatarProgressText', 400, 400);
setupImageUpload('edBannerUpload', 'edBannerUrl', 'edBannerPreview', 'edBannerBtn', 'edBannerProgressContainer', 'edBannerProgressBar', 'edBannerProgressText', 1200, 800);

// Set up Job Application logic
const jobAvatarUpload = document.getElementById('jobAvatarUpload');
const jobBannerUpload = document.getElementById('jobBannerUpload');
const submitJobReqBtn = document.getElementById('submitJobReqBtn');

function handleJobImageProcessing(file, maxWidth, maxHeight, previewEl, urlEl) {
    if(!file) return;
    if(!file.type.match('image.*')) { alert('Please select an image file.'); return; }
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width, height = img.height;
            if (width > height) {
                if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
            } else {
                if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            urlEl.value = dataUrl;
            previewEl.src = dataUrl;
            previewEl.style.display = 'block';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

if(jobAvatarUpload) {
    jobAvatarUpload.addEventListener('change', (e) => {
        handleJobImageProcessing(e.target.files[0], 400, 400, document.getElementById('jobAvatarPreview'), document.getElementById('jobAvatarUrl'));
    });
}
if(jobBannerUpload) {
    jobBannerUpload.addEventListener('change', (e) => {
        handleJobImageProcessing(e.target.files[0], 1200, 800, document.getElementById('jobBannerPreview'), document.getElementById('jobBannerUrl'));
    });
}

if(submitJobReqBtn) {
    submitJobReqBtn.addEventListener('click', async () => {
        if(!currentUser) return;
        const name = document.getElementById('jobName').value;
        const email = document.getElementById('jobEmail').value;
        const phone = document.getElementById('jobPhone').value;
        const category = document.getElementById('jobCategory').value;
        const style = document.getElementById('jobStyle') ? document.getElementById('jobStyle').value : '';
        const price = document.getElementById('jobPrice').value;
        const maxPrice = document.getElementById('jobMaxPrice') ? document.getElementById('jobMaxPrice').value : '';
        const experience = document.getElementById('jobExperience').value;
        const skills = document.getElementById('jobSkills').value;
        const tools = document.getElementById('jobTools').value;
        const bio = document.getElementById('jobBio').value;
        const videoClipsStr = document.getElementById('jobVideoClips').value;
        const avatarUrl = document.getElementById('jobAvatarUrl').value;
        const bannerUrl = document.getElementById('jobBannerUrl').value;
        const portfolio = document.getElementById('jobPortfolio').value;

        if(!name || !email || !phone || !price || !experience || !skills || !bio) {
            alert('Please fill out all required fields.');
            return;
        }

        if(!avatarUrl || !bannerUrl) {
            alert('Please upload both a profile avatar and a banner.');
            return;
        }

        const videoLinks = videoClipsStr.split(',').map(s => s.trim()).filter(s => s);

        submitJobReqBtn.disabled = true;
        submitJobReqBtn.textContent = 'Submitting...';

        const reqPayload = {
            userId: currentUser.uid,
            name,
            email,
            phone,
            category,
            style,
            price: Number(price),
            maxPrice: maxPrice ? Number(maxPrice) : null,
            experience,
            skills,
            tools,
            bio,
            videoLinks,
            photo_url: avatarUrl,
            banner_url: bannerUrl,
            portfolio,
            status: 'pending',
            timestamp: Date.now()
        };

        try {
            const updateId = submitJobReqBtn.dataset.updateId;
            if (updateId) {
                // Updating existing app
                const updatePayload = {
                    ...reqPayload,
                    status: 'pending', // Resets to pending upon update
                    timestamp: Date.now()
                };
                await update(ref(db, "editor_applications/" + updateId), updatePayload);
                
                const idx = allApplications.findIndex(a => a.id === updateId);
                if(idx !== -1) allApplications[idx] = { ...allApplications[idx], ...updatePayload };
                
                alert('Application updated successfully! Resubmitted for review.');
                delete submitJobReqBtn.dataset.updateId;
                submitJobReqBtn.textContent = 'Submit Application';
            } else {
                const reqRef = push(ref(db, "editor_applications"));
                const newPayload = {
                    ...reqPayload,
                    status: 'pending',
                    timestamp: Date.now()
                };
                await set(reqRef, newPayload);
                allApplications.push({ id: reqRef.key, ...newPayload });
                alert('Application submitted successfully! Our team will review your profile.');
            }
            
            submitJobReqBtn.disabled = false;
            submitJobReqBtn.textContent = 'Submit Application';
            
            // Reset form safely
            ['jobName', 'jobEmail', 'jobPhone', 'jobPrice', 'jobMaxPrice', 'jobExperience', 'jobSkills', 'jobTools', 'jobBio', 'jobVideoClips', 'jobPortfolio', 'jobBannerUrl'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.value = '';
            });
            const bannerPrev = document.getElementById('jobBannerPreview');
            if (bannerPrev) {
                bannerPrev.src = '';
                bannerPrev.style.display = 'none';
            }

            // Return to home view
            window.switchNavView('home');
        } catch(err) {
            console.error(err);
            alert('Error submitting application.');
            submitJobReqBtn.disabled = false;
            submitJobReqBtn.textContent = 'Submit Application';
        }
    });
}
