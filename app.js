import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, get, push, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
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
let allSupportChats = {};
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
const bottomNavWishlist = document.getElementById('bottomNavWishlist');
const homeView = document.getElementById('homeView');
const jobsView = document.getElementById('jobsView');
const wishlistView = document.getElementById('wishlistView');
const wishlistGrid = document.getElementById('wishlistGrid');
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

const toggleFiltersBtnResults = document.getElementById('toggleFiltersBtnResults');
const filterContainerResults = document.getElementById('filterContainerResults');

if (toggleFiltersBtnResults && filterContainerResults) {
    toggleFiltersBtnResults.addEventListener('click', () => {
        if (filterContainerResults.style.display === 'none') {
            filterContainerResults.style.display = 'block';
        } else {
            filterContainerResults.style.display = 'none';
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
onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const adminPanelOverlay = document.getElementById('adminPanelOverlay');
    
    if (user) {
        currentUser = user;
        
        window.currentUserIsAdmin = false;
        try {
            const userEmail = (user.email || '').toLowerCase();
            if (userEmail === 'dwiphalder49@gmail.com' || userEmail === 'dwiphalder608@gmail.com') {
                window.currentUserIsAdmin = true;
            }
            const adminSnap = await get(ref(db, "admins"));
            if (adminSnap.exists()) {
                const admins = adminSnap.val();
                const matchedAdmin = Object.values(admins).find(a => 
                    ((a.email || '').toLowerCase() === userEmail || a.uid === user.uid)
                );
                
                if (matchedAdmin) {
                    if (!matchedAdmin.isDisabled) {
                        window.currentUserIsAdmin = true;
                    } else {
                        window.currentUserIsAdmin = false;
                        // If hardcoded matched but is disabled in db, it gets disabled.
                    }
                }
            }
        } catch(e) {
            console.error("Failed to check admin status", e);
        }

        authScreen.style.opacity = '0';
        authScreen.style.visibility = 'hidden';
        
        setTimeout(() => {
            authScreen.style.display = 'none';
            
            if (window.currentUserIsAdmin) {
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
        const supportBtn = document.getElementById('supportBtn');
        if(supportBtn) supportBtn.style.display = 'block';
        if(typeof listenToUserSupportChats === 'function') listenToUserSupportChats();
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
        const supportBtn = document.getElementById('supportBtn');
        if(supportBtn) supportBtn.style.display = 'none';
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
        if(wishlistView) wishlistView.style.display = 'none';
        if(document.getElementById('searchResultsView')) document.getElementById('searchResultsView').style.display = 'none';
        if(bottomNavHome) bottomNavHome.classList.add('active');
        if(bottomNavJobs) bottomNavJobs.classList.remove('active');
        if(bottomNavWishlist) bottomNavWishlist.classList.remove('active');
    } else if(view === 'jobs') {
        if(homeView) homeView.style.display = 'none';
        if(jobsView) jobsView.style.display = 'block';
        if(wishlistView) wishlistView.style.display = 'none';
        if(document.getElementById('searchResultsView')) document.getElementById('searchResultsView').style.display = 'none';
        if(bottomNavJobs) bottomNavJobs.classList.add('active');
        if(bottomNavHome) bottomNavHome.classList.remove('active');
        if(bottomNavWishlist) bottomNavWishlist.classList.remove('active');
        populateJobFormFromProfile();
    } else if(view === 'wishlist') {
        if(homeView) homeView.style.display = 'none';
        if(jobsView) jobsView.style.display = 'none';
        if(wishlistView) wishlistView.style.display = 'block';
        if(document.getElementById('searchResultsView')) document.getElementById('searchResultsView').style.display = 'none';
        if(bottomNavWishlist) bottomNavWishlist.classList.add('active');
        if(bottomNavHome) bottomNavHome.classList.remove('active');
        if(bottomNavJobs) bottomNavJobs.classList.remove('active');
        renderWishlist();
    } else if(view === 'searchResults') {
        if(homeView) homeView.style.display = 'none';
        if(jobsView) jobsView.style.display = 'none';
        if(wishlistView) wishlistView.style.display = 'none';
        if(document.getElementById('searchResultsView')) document.getElementById('searchResultsView').style.display = 'block';
        if(bottomNavWishlist) bottomNavWishlist.classList.remove('active');
        if(bottomNavHome) bottomNavHome.classList.remove('active');
        if(bottomNavJobs) bottomNavJobs.classList.remove('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

if(bottomNavHome && bottomNavJobs && bottomNavWishlist) {
    bottomNavHome.addEventListener('click', (e) => {
        e.preventDefault();
        window.switchNavView('home');
    });
    bottomNavJobs.addEventListener('click', (e) => {
        e.preventDefault();
        window.switchNavView('jobs');
    });
    bottomNavWishlist.addEventListener('click', (e) => {
        e.preventDefault();
        window.switchNavView('wishlist');
    });
}

function populateJobFormFromProfile() {
    if(!currentUser) {
        document.getElementById('jobsCompleteProfileMsg').classList.remove('hidden');
        document.getElementById('submitJobReqBtn').disabled = true;
        return;
    }
    const up = allUsers[currentUser.uid] || {};
    
    // Check if user is already an editor
    const isAlreadyEditor = editors.find(e => e.userId === currentUser.uid);
    if(isAlreadyEditor) {
        document.getElementById('jobsCompleteProfileMsg').classList.remove('hidden');
        document.getElementById('jobsCompleteProfileMsg').innerHTML = `<p class="text-danger text-center">You already have an active job profile.</p>`;
        document.getElementById('submitJobReqBtn').disabled = true;
        
        // Disable form fields
        ['jobName', 'jobEmail', 'jobPhone', 'jobCategory', 'jobStyle', 'jobPrice', 'jobMaxPrice', 'jobExperience', 'jobSkills', 'jobTools', 'jobBio', 'jobVideoClips', 'jobPortfolio'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.disabled = true;
        });
        const urlEl = document.getElementById('jobBannerUrl');
        if(urlEl) urlEl.disabled = true;
        return;
    } else {
        document.getElementById('jobsCompleteProfileMsg').innerHTML = `<p class="text-danger">Please <button class="btn btn-sm primary" onclick="window.openUserProfileModal(true)">Complete Profile</button> first. It's required for applying.</p>`;
        // Enable form fields just in case
        ['jobName', 'jobEmail', 'jobPhone', 'jobCategory', 'jobStyle', 'jobPrice', 'jobMaxPrice', 'jobExperience', 'jobSkills', 'jobTools', 'jobBio', 'jobVideoClips', 'jobPortfolio'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.disabled = false;
        });
        const urlEl = document.getElementById('jobBannerUrl');
        if(urlEl) urlEl.disabled = false;
    }

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
    if(loadingMain) loadingMain.style.display = 'block';
    if(emptyMain) emptyMain.style.display = 'none';
    if(mainGrid) mainGrid.innerHTML = '';
    
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
        refreshCurrentFeeds();
        renderWishlist();
        renderAdminList(); // Refresh admin list if it's open
    } catch (error) {
        console.error("Fetch error:", error);
        if(loadingMain) loadingMain.innerHTML = '<p class="text-danger">Failed to load data. Check DB connection.</p>';
    }
}

function refreshCurrentFeeds() {
    if (document.getElementById('searchResultsView') && document.getElementById('searchResultsView').style.display === 'block') {
        processSearch();
    } else {
        renderHomeFeeds();
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

    if (currentUser) {
        const up = allUsers[currentUser.uid] || {};
        if (up.wishlist && up.wishlist[editor.id]) {
            cardBorderStyle = 'border: 2px solid #ec4899; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.3);';
        }
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

function renderWishlist() {
    if (!currentUser) {
        wishlistGrid.innerHTML = '<div class="text-center p-4"><p>Please sign in to view your wishlist.</p></div>';
        return;
    }
    const up = allUsers[currentUser.uid] || {};
    const wishlistObj = up.wishlist || {};
    
    const wishlistedEditors = editors.filter(ed => wishlistObj[ed.id] && !ed.deletionScheduledAt);
    
    if (wishlistedEditors.length > 0) {
        wishlistGrid.innerHTML = wishlistedEditors.map((ed, i) => generateCardHTML(ed, i)).join('');
    } else {
        wishlistGrid.innerHTML = '<div class="text-center p-4"><p>Your wishlist is empty.</p></div>';
    }
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

function renderHomeFeeds() {
    if(loadingMain) loadingMain.style.display = 'none';
    const filterRating = document.getElementById('filterRating') ? document.getElementById('filterRating').value : 'All';
    const filterType = document.getElementById('filterType') ? document.getElementById('filterType').value : 'All';
    const sortPrice = document.getElementById('sortPrice') ? document.getElementById('sortPrice').value : 'None';

    let baseFiltered = editors.filter(ed => {
        if (ed.deletionScheduledAt) return false;
        
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
        
        return matchCat && matchRating && matchType;
    }).map(ed => {
        // compute rating once for sorting
        const editorReviews = allReviews.filter(r => r.editorId === ed.id);
        let avgRating = 0;
        if (editorReviews.length > 0) {
            avgRating = editorReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / editorReviews.length;
        }
        return { ...ed, avgRating, totalReviews: editorReviews.length };
    });

    if (sortPrice === 'LowToHigh') {
        baseFiltered.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    } else if (sortPrice === 'HighToLow') {
        baseFiltered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    }

    // Check for expiration
    const now = Date.now();
    baseFiltered.forEach(ed => {
        if (ed.verificationType === 'golden' && ed.goldenExpiry && now > ed.goldenExpiry) {
            ed.verificationType = 'verified'; // Downgrade if expired
            // Optionally update in DB, but since we re-fetch, we can just let it expire in view
        }
    });

    // Split into categories
    const goldenEditors = baseFiltered.filter(ed => ed.verificationType === 'golden');
    const nonGolden = baseFiltered.filter(ed => ed.verificationType !== 'golden');
    
    // Sort remaining non-golden by rating for best choice but also respect a manual 'best' flag
    const manualBest = nonGolden.filter(ed => ed.isBestEditor && (!ed.bestExpiry || now <= ed.bestExpiry));
    const autoBest = [...nonGolden].filter(ed => !ed.isBestEditor || (ed.bestExpiry && now > ed.bestExpiry)).sort((a, b) => b.avgRating - a.avgRating).slice(0, 4 - manualBest.length);
    
    const bestEditors = [...manualBest, ...autoBest].slice(0, 4); // max 4 best choice
    const bestEditorIds = bestEditors.map(e => e.id);
    
    // For All Editors section, we display ALL filtered editors, but randomize their order
    const allEditorsShuffled = [...baseFiltered].sort(() => Math.random() - 0.5);

    // Render Golden
    const goldenSection = document.getElementById('goldenEditorsSection');
    const goldenGrid = document.getElementById('goldenGrid');
    if (goldenSection && goldenGrid) {
        if (goldenEditors.length > 0) {
            goldenSection.style.display = 'block';
            goldenGrid.innerHTML = goldenEditors.map((ed, i) => generateCardHTML(ed, i)).join('');
        } else {
            goldenSection.style.display = 'none';
        }
    }

    // Render Best
    const bestSection = document.getElementById('bestEditorsSection');
    const bestGrid = document.getElementById('bestEditorsGrid');
    if (bestSection && bestGrid) {
        if (bestEditors.length > 0) {
            bestSection.style.display = 'block';
            bestGrid.innerHTML = bestEditors.map((ed, i) => generateCardHTML(ed, i)).join('');
        } else {
            bestSection.style.display = 'none';
        }
    }

    // Render All Editors (Shuffled)
    if(mainGrid) mainGrid.innerHTML = '';
    if (allEditorsShuffled.length === 0) {
        if(emptyMain) emptyMain.style.display = 'block';
    } else {
        if(emptyMain) emptyMain.style.display = 'none';
        mainGrid.innerHTML = allEditorsShuffled.map((ed, i) => generateCardHTML(ed, i)).join('');
    }
}

function processSearch(triggeredFromResults = false) {
    let term = '';
    const searchInputHome = document.getElementById('searchInput');
    const searchInputResults = document.getElementById('searchInputResults');
    
    if (triggeredFromResults) {
        term = (searchInputResults ? searchInputResults.value || '' : '').toLowerCase().trim();
        if(searchInputHome) searchInputHome.value = term;
    } else {
        term = (searchInputHome ? searchInputHome.value || '' : '').toLowerCase().trim();
        if(searchInputResults) searchInputResults.value = term;
    }

    if (!term) return; // Ignore empty search
    
    window.switchNavView('searchResults');
    
    const queryLabel = document.getElementById('searchQueryLabel');
    if(queryLabel) queryLabel.innerHTML = `Search results for: <strong>"${term}"</strong>`;
    
    const resultsList = document.getElementById('searchResultsList');
    const emptySearch = document.getElementById('emptySearch');
    
    if (resultsList) resultsList.innerHTML = '';
    if (emptySearch) emptySearch.style.display = 'none';
    
    // Use the results filters, fallback to home filters if missing
    const filterRating = document.getElementById('filterRatingResults') ? document.getElementById('filterRatingResults').value : 'All';
    const filterType = document.getElementById('filterTypeResults') ? document.getElementById('filterTypeResults').value : 'All';
    const sortPrice = document.getElementById('sortPriceResults') ? document.getElementById('sortPriceResults').value : 'None';
    
    const minBudgetInput = document.getElementById('minBudget');
    const maxBudgetInput = document.getElementById('maxBudget');
    const minBudget = minBudgetInput && minBudgetInput.value ? parseFloat(minBudgetInput.value) : 0;
    const maxBudget = maxBudgetInput && maxBudgetInput.value ? parseFloat(maxBudgetInput.value) : Infinity;

    // Scoring logic for relevance
    let searchResults = editors.map(ed => {
        if (ed.deletionScheduledAt) return null;
        
        const matchCat = currentCategory === 'All' ? true : ed.category === currentCategory;
        if (!matchCat) return null;

        const safeName = (ed.name || '').toLowerCase();
        const safeSkills = (ed.skills || '').toLowerCase() + ' ' + (ed.style || '').toLowerCase();
        const safeBio = (ed.bio || '').toLowerCase();

        let score = 0;
        const searchTerms = term.split(/\s+/).filter(Boolean);
        
        searchTerms.forEach(t => {
            if (safeName.includes(t)) score += 10;
            if (safeSkills.includes(t)) score += 5;
            if (safeBio.includes(t)) score += 2;
        });
        
        if (safeName === term) score += 50; // Exact match bonus
        if (safeName.includes(term)) score += 20; // Full phrase match bonus

        if (score === 0) return null;

        const editorReviews = allReviews.filter(r => r.editorId === ed.id);
        let avgRating = 0;
        if (editorReviews.length > 0) {
            avgRating = editorReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / editorReviews.length;
        }

        let matchRating = true;
        if (filterRating === '4+') matchRating = avgRating >= 4.0;
        if (filterRating === '3+') matchRating = avgRating >= 3.0;

        let matchType = true;
        if (filterType === 'New') matchType = editorReviews.length === 0;
        if (filterType === 'Experienced') matchType = editorReviews.length > 0;
        
        if (!matchRating || !matchType) return null;
        
        const edPrice = parseFloat(ed.price) || 0;
        if (edPrice < minBudget || edPrice > maxBudget) return null;

        return { ...ed, score, avgRating };
    }).filter(Boolean);

    // Sort by relevance
    searchResults.sort((a, b) => b.score - a.score);

    if (sortPrice === 'LowToHigh') {
        searchResults.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    } else if (sortPrice === 'HighToLow') {
        searchResults.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    }

    if (searchResults.length === 0) {
        if(emptySearch) emptySearch.style.display = 'block';
    } else {
        if(resultsList) resultsList.innerHTML = searchResults.map((ed, i) => generateCardHTML(ed, i)).join('');
    }
}

function generateHorizontalCardHTML(editor) {
    const editorReviews = allReviews.filter(r => r.editorId === editor.id);
    let avgRating = 0;
    if (editorReviews.length > 0) {
        const sum = editorReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        avgRating = sum / editorReviews.length;
    }
    const ratingText = editorReviews.length > 0 ? `⭐ ${avgRating.toFixed(1)} (${editorReviews.length})` : `⭐ New`;
    
    let priceText = `₹${editor.price || '0'}`;
    if(editor.maxPrice && parseFloat(editor.maxPrice) > parseFloat(editor.price)) {
        priceText = `₹${editor.price} - ₹${editor.maxPrice}`;
    }

    let verifiedIcon = '';
    if(editor.verificationType === 'blue') {
        verifiedIcon = `<span title="Verified User" style="color: #3b82f6; display:inline-flex; align-items:center; margin-left:5px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></span>`;
    } else if (editor.verificationType === 'golden') {
        verifiedIcon = `<span title="Golden Profile" style="color: #fbbf24; display:inline-flex; align-items:center; margin-left:5px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>`;
    }

    const img = editor.photo_url || 'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?crop=entropy&fit=max&fm=jpg&q=80&w=400';

    return `
        <div class="editor-row-card glass-card animate-fade" data-id="${editor.id}" style="display: flex; gap: 15px; padding: 15px; border-radius: 16px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.03); align-items: center; text-align: left; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            <img src="${img}" style="width: 100px; height: 100px; border-radius: 12px; object-fit: cover;">
            <div style="flex: 1;">
                <h3 style="margin: 0 0 5px; font-size: 1.25rem;">${editor.name} ${verifiedIcon}</h3>
                <p style="margin: 0 0 5px; font-size: 0.9rem; color: var(--primary); font-weight: 500;">${editor.category} Editor</p>
                <div style="display: flex; gap: 10px; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 5px;">
                    <span>${ratingText}</span>
                    <span>•</span>
                    <span style="color: white; font-weight: 600;">${priceText}</span>
                </div>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${editor.bio || 'No bio provided.'}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="btn primary btn-sm btn-hire">Hire Now</button>
                <button class="btn secondary btn-sm btn-message">Message</button>
            </div>
        </div>
    `;
}

// User Interactions
if(document.getElementById('searchBtn')) document.getElementById('searchBtn').addEventListener('click', () => processSearch(false));
if(searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') processSearch(false);
    });
}
if(document.getElementById('searchBtnResults')) document.getElementById('searchBtnResults').addEventListener('click', () => processSearch(true));
if(document.getElementById('searchInputResults')) {
    document.getElementById('searchInputResults').addEventListener('keypress', (e) => {
        if(e.key === 'Enter') processSearch(true);
    });
}
if(document.getElementById('closeSearchBtn')) {
    document.getElementById('closeSearchBtn').addEventListener('click', () => {
        window.switchNavView('home');
        if(searchInput) searchInput.value = '';
        if(document.getElementById('searchInputResults')) document.getElementById('searchInputResults').value = '';
        renderHomeFeeds();
    });
}

const syncFilters = () => {
    // Keep filter selects strictly matched if we wanted to visually sync them, but for now we'll just run search
    const isShowingResults = document.getElementById('searchResultsView') && document.getElementById('searchResultsView').style.display === 'block';
    if (isShowingResults) { 
        processSearch(true); 
    } else { 
        renderHomeFeeds(); 
    }
};

['filterRating', 'filterType', 'sortPrice', 'filterRatingResults', 'filterTypeResults', 'sortPriceResults'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', syncFilters);
});

if(document.getElementById('applyBudgetBtn')) {
    document.getElementById('applyBudgetBtn').addEventListener('click', () => processSearch(true));
}

filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.getAttribute('data-cat');
        
        if (document.getElementById('searchResultsView') && document.getElementById('searchResultsView').style.display === 'block') {
            processSearch();
        } else {
            renderHomeFeeds();
        }
    });
});

// Event Delegation for Cards
document.addEventListener('click', (e) => {
    // If they click on "Message", intercept it
    if (e.target.closest('.btn-message')) {
        e.stopPropagation();
        const card = e.target.closest('.editor-card, .editor-row-card');
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
        const card = e.target.closest('.editor-card, .editor-row-card');
        if (card) {
            openEditorProfile(card.dataset.id);
        }
        return;
    }

    const card = e.target.closest('.editor-card, .editor-row-card');
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
    
    // Update wishlist icon
    const wishlistIcon = document.getElementById('wishlistHeartIcon');
    if (currentUser && allUsers[currentUser.uid]?.wishlist?.[id]) {
        wishlistIcon.setAttribute('fill', '#ec4899');
        wishlistIcon.setAttribute('stroke', '#ec4899');
    } else {
        wishlistIcon.setAttribute('fill', 'none');
        wishlistIcon.setAttribute('stroke', 'white');
    }
    
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

const wishlistSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // short pop sound

document.getElementById('toggleWishlistBtn').addEventListener('click', async () => {
    if (!currentUser) {
        loginPromptModal.style.display = 'flex';
        return;
    }
    if (!currentProfileId) return;

    try {
        const btn = document.getElementById('toggleWishlistBtn');
        const icon = document.getElementById('wishlistHeartIcon');
        
        btn.style.transform = 'scale(0.8)';
        setTimeout(() => btn.style.transform = 'scale(1)', 150);

        const up = allUsers[currentUser.uid] || {};
        const wishlistObj = up.wishlist || {};
        
        const isWishlisted = !!wishlistObj[currentProfileId];
        
        if (isWishlisted) {
            delete wishlistObj[currentProfileId];
            icon.setAttribute('fill', 'none');
            icon.setAttribute('stroke', 'white');
        } else {
            wishlistObj[currentProfileId] = true;
            icon.setAttribute('fill', '#ec4899');
            icon.setAttribute('stroke', '#ec4899');
            
            // Play sound
            wishlistSound.currentTime = 0;
            wishlistSound.play().catch(e => console.log('Audio play prevented', e));
        }
        
        // Save to Firebase
        await set(ref(db, "users/" + currentUser.uid + "/wishlist"), wishlistObj);
        
        if (allUsers[currentUser.uid]) {
            allUsers[currentUser.uid].wishlist = wishlistObj;
        }

        // Refresh UI
        refreshCurrentFeeds();
        renderTrending();
        renderWishlist();

    } catch (e) {
        console.error(e);
        alert('Could not update wishlist.');
    }
});

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
    
    // Set up Short ID
    if(document.getElementById('userShortId')) {
        document.getElementById('userShortId').textContent = 'ID: ' + currentUser.uid.substring(0, 8).toUpperCase();
    }

    if(showMustComplete) {
        profileCompleteMsg.classList.remove('hidden');
    } else {
        profileCompleteMsg.classList.add('hidden');
    }
    
    // Job Profile Section
    const jobProfileSection = document.getElementById('jobProfileSection');
    if (jobProfileSection) {
        const myEditorProfile = editors.find(e => e.userId === currentUser.uid);
        if (myEditorProfile) {
            jobProfileSection.style.display = 'block';
        } else {
            jobProfileSection.style.display = 'none';
        }
    }

    renderUserRequestsList();
    renderUserApplicationsList();
    
    const adminPanelReentryBtnProfile = document.getElementById('adminPanelReentryBtnProfile');
    if (adminPanelReentryBtnProfile) {
        if (window.currentUserIsAdmin) {
            adminPanelReentryBtnProfile.style.display = 'flex';
        } else {
            adminPanelReentryBtnProfile.style.display = 'none';
        }
    }
    
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
        refreshCurrentFeeds();
        renderTrending();
        renderWishlist();
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
        refreshCurrentFeeds();
        renderTrending();
        renderWishlist();
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
            const reqUser = allUsers[r.userId] || {};
            const userName = reqUser.firstName ? (reqUser.firstName + ' ' + (reqUser.lastName||'')).trim() : 'Unknown Name';
            const userPhone = reqUser.phone || 'No phone provided';
            const userPhoto = reqUser.photoUrl || 'https://via.placeholder.com/60';

            const div = document.createElement('div');
            div.className = 'glass-card mb-3 p-3';
            div.style.border = '1px solid var(--glass-border)';
            div.innerHTML = `
                <div style="display:flex; gap:15px; align-items:center; margin-bottom:10px;">
                    <img src="${userPhoto}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
                    <div>
                        <h4 style="margin:0;">${userName}</h4>
                        <p style="margin:2px 0 0; font-size:0.9rem; color:var(--text-secondary);">📧 ${r.userEmail}</p>
                        <p style="margin:2px 0 0; font-size:0.9rem; color:var(--text-secondary);">📞 ${userPhone}</p>
                    </div>
                </div>
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
        renderAdminList();
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
if(settingsBtn) settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
    const adminPanelReentryBtn = document.getElementById('adminPanelReentryBtn');
    if (adminPanelReentryBtn) {
        if (window.currentUserIsAdmin) {
            adminPanelReentryBtn.style.display = 'flex';
        } else {
            adminPanelReentryBtn.style.display = 'none';
        }
    }
});
const authScreenSettingsBtn = document.getElementById('authScreenSettingsBtn');
if(authScreenSettingsBtn) { 
    authScreenSettingsBtn.addEventListener('click', () => { 
        settingsModal.style.display = 'flex'; 
        const adminPanelReentryBtn = document.getElementById('adminPanelReentryBtn');
        if (adminPanelReentryBtn) {
            if (window.currentUserIsAdmin) {
                adminPanelReentryBtn.style.display = 'flex';
            } else {
                adminPanelReentryBtn.style.display = 'none';
            }
        }
    }); 
}

if(closeSettings) closeSettings.addEventListener('click', () => { settingsModal.style.display = 'none'; });

const adminPanelReentryBtn = document.getElementById('adminPanelReentryBtn');
const adminPanelReentryBtnProfile = document.getElementById('adminPanelReentryBtnProfile');

function enterAdminPanel() {
    settingsModal.style.display = 'none';
    userProfileModal.style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('adminPanelOverlay').style.display = 'block';
    if (typeof renderAdminList === 'function') renderAdminList();
}

if (adminPanelReentryBtn) {
    adminPanelReentryBtn.addEventListener('click', enterAdminPanel);
}

if (adminPanelReentryBtnProfile) {
    adminPanelReentryBtnProfile.addEventListener('click', enterAdminPanel);
}

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

// Admin Tab Switching
const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
const adminTabContents = document.querySelectorAll('.admin-tab-content');

adminTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if(btn.id === 'adminSupportChatsBtn' || btn.id === 'closeAdminPanelBtn') return;
        const target = btn.getAttribute('data-tab');
        if(!target) return;
        
        // Update active class on buttons
        adminTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show correct content
        adminTabContents.forEach(content => {
            content.style.display = 'none';
        });
        const targetTab = document.getElementById('adminTab' + target.charAt(0).toUpperCase() + target.slice(1));
        if (targetTab) {
            targetTab.style.display = 'block';
        }
    });
});

function renderAdminList() {
    if (typeof setupAdminSupportListener === 'function') setupAdminSupportListener();
    const totalUsers = Object.keys(allUsers || {}).length;
    const totalViews = editors.reduce((sum, ed) => sum + (ed.views || 0), 0);
    
    if (document.getElementById('statTotalUsers')) document.getElementById('statTotalUsers').textContent = totalUsers;
    if (document.getElementById('statTotalViews')) document.getElementById('statTotalViews').textContent = totalViews;

    if (document.getElementById('statTotal')) document.getElementById('statTotal').textContent = editors.length;
    if (document.getElementById('statFeatured')) document.getElementById('statFeatured').textContent = editors.filter(e => e.isFeatured).length;
    if (document.getElementById('statVerified')) document.getElementById('statVerified').textContent = editors.filter(e => e.isVerified || e.verificationType === 'blue' || e.verificationType === 'golden').length;
    
    const tbody = document.getElementById('adminEditorsList');
    tbody.innerHTML = '';
    
    editors.forEach(ed => {
        let verifiedText = '';
        if (ed.verificationType === 'golden') {
            verifiedText = '<span class="text-xs pl-1" style="color:var(--warning);">★ Golden</span>';
        } else if (ed.verificationType === 'blue' || ed.isVerified) {
            verifiedText = '<span class="text-success text-xs pl-1">✓ Blue</span>';
        }
        
        const reqs = allRequests.filter(r => r.editorId === ed.id);
        const pendingCount = reqs.filter(r => r.status === 'pending').length;

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
                <button class="btn primary btn-sm" style="position:relative;" onclick="window.viewAdminRequests('${ed.id}')">
                    Requests
                    ${pendingCount > 0 ? `<span style="position:absolute; top:-8px; right:-8px; background:red; color:white; border-radius:50%; width:20px; height:20px; font-size:12px; display:flex; align-items:center; justify-content:center;">${pendingCount}</span>` : ''}
                </button>
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

    const featTbody = document.getElementById('adminFeaturedList');
    if (featTbody) {
        featTbody.innerHTML = '';
        const featuredApps = editors.filter(e => e.verificationType === 'golden' || e.isBestEditor);
        if (featuredApps.length === 0) {
            featTbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary text-sm">No featured profiles managed.</td></tr>';
        } else {
            featuredApps.forEach(ed => {
                const tr = document.createElement('tr');
                const isGolden = ed.verificationType === 'golden';
                const isBest = ed.isBestEditor;
                
                let typeBadge = '';
                if(isGolden) typeBadge += '<span class="text-xs" style="color:var(--warning); margin-right:5px;">★ Golden</span>';
                if(isBest) typeBadge += '<span class="text-xs" style="color:#3b82f6;">⭐ Best Choice</span>';
                
                let expiryText = 'Never';
                if (isGolden && ed.goldenExpiry) expiryText = new Date(ed.goldenExpiry).toLocaleString();
                if (isBest && ed.bestExpiry) expiryText = new Date(ed.bestExpiry).toLocaleString();
                
                tr.innerHTML = `
                    <td style="display:flex; align-items:center; gap:10px;">
                        <img src="${ed.photo_url || 'https://via.placeholder.com/40'}" class="table-img">
                        <strong>${ed.name}</strong>
                    </td>
                    <td>${typeBadge}</td>
                    <td>-</td>
                    <td><span class="text-xs text-secondary">${expiryText}</span></td>
                    <td>Active</td>
                    <td>
                        <button class="btn secondary btn-sm" onclick="window.manageFeaturedEditor('${ed.id}')">Manage</button>
                    </td>
                `;
                featTbody.appendChild(tr);
            });
        }
    }

    const usersTbody = document.getElementById('adminUsersList');
    if (usersTbody) {
        usersTbody.innerHTML = '';
        const userKeys = Object.keys(allUsers || {});
        if (userKeys.length === 0) {
            usersTbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary text-sm">No users found.</td></tr>';
        } else {
            userKeys.forEach(uid => {
                const u = allUsers[uid];
                const tr = document.createElement('tr');
                const fullName = u.firstName ? (u.firstName + ' ' + (u.lastName || '')).trim() : 'Anonymous';
                tr.innerHTML = `
                    <td><img src="${u.photoUrl || 'https://via.placeholder.com/40'}" class="table-img"></td>
                    <td><strong>${fullName}</strong></td>
                    <td><span class="text-xs text-secondary">${uid}</span></td>
                    <td>${u.phone || '-'}</td>
                    <td>
                        <button class="btn btn-sm secondary" onclick="window.viewAdminUserProfile('${uid}')">Profile</button>
                    </td>
                `;
                usersTbody.appendChild(tr);
            });
        }
    }
}

window.viewAdminUserProfile = function(uid) {
    const u = allUsers[uid];
    if (!u) return;
    document.getElementById('adminUpAvatar').src = u.photoUrl || 'https://via.placeholder.com/100';
    document.getElementById('adminUpName').textContent = u.firstName ? (u.firstName + ' ' + (u.lastName || '')).trim() : 'Anonymous User';
    document.getElementById('adminUpEmail').textContent = u.email || 'No email';
    document.getElementById('adminUpPhone').textContent = u.phone || 'No phone';
    document.getElementById('adminUpId').textContent = 'UID: ' + uid + ' (Short: ' + uid.substring(0,8).toUpperCase() + ')';
    document.getElementById('adminUserProfileModal').style.display = 'flex';
};

if (document.getElementById('closeAdminUserProfile')) {
    document.getElementById('closeAdminUserProfile').addEventListener('click', () => {
        document.getElementById('adminUserProfileModal').style.display = 'none';
    });
}

if (document.getElementById('adminIdCheckerBtn')) {
    document.getElementById('adminIdCheckerBtn').addEventListener('click', () => {
        const inputVal = document.getElementById('adminIdCheckerInput').value.trim().toUpperCase();
        if(!inputVal) return;
        const uid = Object.keys(allUsers).find(k => k.substring(0,8).toUpperCase() === inputVal);
        if(uid) {
            window.viewAdminUserProfile(uid);
        } else {
            alert('No user found with that ID.');
        }
    });
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
        refreshCurrentFeeds();
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

// Featured Management Logic
window.manageFeaturedEditor = (editorId = null) => {
    document.getElementById('featuredForm').reset();
    document.getElementById('featuredEditorId').value = '';
    
    // Populate select
    const select = document.getElementById('featuredEditorSelect');
    select.innerHTML = '<option value="">Select an editor...</option>';
    editors.forEach(ed => {
        const option = document.createElement('option');
        option.value = ed.id;
        option.textContent = ed.name;
        select.appendChild(option);
    });

    if (editorId) {
        select.value = editorId;
        const ed = editors.find(e => e.id === editorId);
        if (ed) {
            document.getElementById('featuredEditorId').value = ed.id;
            document.getElementById('featuredType').value = ed.isBestEditor ? 'best' : 'golden';
            document.getElementById('revokeFeaturedBtn').style.display = 'block';
        }
    } else {
        document.getElementById('revokeFeaturedBtn').style.display = 'none';
        
        // If clicking the top "+ Assign Featured" button
        select.addEventListener('change', function() {
            document.getElementById('featuredEditorId').value = this.value;
            const ed = editors.find(e => e.id === this.value);
            if (ed && (ed.verificationType === 'golden' || ed.isBestEditor)) {
                document.getElementById('revokeFeaturedBtn').style.display = 'block';
                document.getElementById('featuredType').value = ed.isBestEditor ? 'best' : 'golden';
            } else {
                document.getElementById('revokeFeaturedBtn').style.display = 'none';
            }
        });
    }

    document.getElementById('featuredManagerModal').style.display = 'flex';
};

if (document.getElementById('assignFeaturedBtn')) {
    document.getElementById('assignFeaturedBtn').addEventListener('click', () => window.manageFeaturedEditor());
}
if (document.getElementById('closeFeaturedManager')) {
    document.getElementById('closeFeaturedManager').addEventListener('click', () => document.getElementById('featuredManagerModal').style.display = 'none');
}
if (document.getElementById('cancelFeaturedManager')) {
    document.getElementById('cancelFeaturedManager').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('featuredManagerModal').style.display = 'none'; });
}

if (document.getElementById('saveFeaturedBtn')) {
    document.getElementById('saveFeaturedBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const editorId = document.getElementById('featuredEditorId').value;
        if (!editorId) return alert('Please select an editor.');

        const type = document.getElementById('featuredType').value;
        const val = parseFloat(document.getElementById('featuredDurationValue').value);
        const unit = document.getElementById('featuredDurationUnit').value;

        let expiryTime = null;
        const now = Date.now();
        if (unit !== 'permanent') {
            if (!val || val <= 0) return alert('Enter a valid duration.');
            if (unit === 'hours') expiryTime = now + (val * 60 * 60 * 1000);
            if (unit === 'days') expiryTime = now + (val * 24 * 60 * 60 * 1000);
            if (unit === 'months') expiryTime = now + (val * 30 * 24 * 60 * 60 * 1000);
        }

        const payload = {};
        if (type === 'golden') {
            payload.verificationType = 'golden';
            payload.goldenExpiry = expiryTime;
            payload.isBestEditor = false;
        } else {
            payload.isBestEditor = true;
            payload.bestExpiry = expiryTime;
            payload.verificationType = 'none'; // Un-golden them if setting to best? Let's assume they are separate but let's just keep their config
        }

        try {
            await update(ref(db, "editors/" + editorId), payload);
            document.getElementById('featuredManagerModal').style.display = 'none';
            fetchEditors();
            alert('Featured status applied.');
        } catch(err) {
            console.error(err);
            alert('Failed to update status.');
        }
    });
}

if (document.getElementById('revokeFeaturedBtn')) {
    document.getElementById('revokeFeaturedBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const editorId = document.getElementById('featuredEditorId').value;
        if (!editorId) return;

        if (confirm("Revoke all featured (Golden/Best) status from this editor?")) {
            try {
                // To be safe, revoke both
                await update(ref(db, "editors/" + editorId), {
                    verificationType: 'verified', // Fallback to normal verified
                    goldenExpiry: null,
                    isBestEditor: false,
                    bestExpiry: null
                });
                document.getElementById('featuredManagerModal').style.display = 'none';
                fetchEditors();
            } catch(err) {
                console.error(err);
                alert('Failed to revoke status.');
            }
        }
    });
}

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

// -------------------------------------------------------------
// IN-APP MESSAGING & JOB DASHBOARD
// -------------------------------------------------------------
const contactInApp = document.getElementById('contactInApp');
const editorClientChatModal = document.getElementById('editorClientChatModal');
const closeEccChat = document.getElementById('closeEccChat');
const eccChatContainer = document.getElementById('eccChatContainer');
const eccChatInput = document.getElementById('eccChatInput');
const sendEccMsgBtn = document.getElementById('sendEccMsgBtn');
let currentEccPath = null;
let eccListener = null;

if (contactInApp) {
    contactInApp.addEventListener('click', () => {
        if (!currentUser) {
            loginPromptModal.style.display = 'flex';
            return;
        }
        if (!currentProfileId) return;
        document.getElementById('contactModal').style.display = 'none';
        editorClientChatModal.style.display = 'flex';
        
        currentEccPath = `editor_client_chats/${currentProfileId}_${currentUser.uid}/messages`;
        
        const ed = editors.find(e => e.id === currentProfileId);
        document.getElementById('eccUserName').textContent = 'Chat with ' + (ed ? ed.name : 'Editor');
        
        if (eccListener) eccListener(); // Unsubscribe prev
        
        eccListener = onValue(ref(db, currentEccPath), (snap) => {
            const data = snap.val() || {};
            const messages = Object.keys(data).map(k => ({id: k, ...data[k]})).sort((a,b) => a.timestamp - b.timestamp);
            renderEccChat(messages);
        });
    });
}

if (closeEccChat) {
    closeEccChat.addEventListener('click', () => {
        editorClientChatModal.style.display = 'none';
        if (eccListener) {
            // Can't directly unsubscribe with onValue in this exact syntax easily without keeping the ref exactly, but onValue returns the unsubscribe function in newer SDKs! Wait, we use 10.9.0 which returns the unsubscribe function.
            eccListener();
            eccListener = null;
        }
    });
}

if (sendEccMsgBtn && eccChatInput) {
    const sendEccMsg = async () => {
        const text = eccChatInput.value.trim();
        if (!text || !currentEccPath || !currentUser) return;
        eccChatInput.value = '';
        
        try {
            await push(ref(db, currentEccPath), {
                senderId: currentUser.uid,
                text: text,
                timestamp: Date.now()
            });
        } catch (e) {
            console.error("Chat error", e);
        }
    };
    sendEccMsgBtn.addEventListener('click', sendEccMsg);
    eccChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendEccMsg();
    });
}

function renderEccChat(messages) {
    if (!eccChatContainer) return;
    eccChatContainer.innerHTML = '';
    
    if (messages.length === 0) {
        eccChatContainer.innerHTML = '<div class="text-center text-secondary mt-3">Start the conversation...</div>';
        return;
    }
    
    messages.forEach(msg => {
        const isMe = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.style.maxWidth = '80%';
        div.style.padding = '10px 15px';
        div.style.borderRadius = '12px';
        div.style.marginBottom = '5px';
        div.style.wordBreak = 'break-word';
        if (isMe) {
            div.style.alignSelf = 'flex-end';
            div.style.background = 'var(--primary)';
            div.style.color = 'white';
        } else {
            div.style.alignSelf = 'flex-start';
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.color = 'white';
        }
        
        div.innerHTML = `
            <div style="font-size:0.95rem;">${msg.text}</div>
            <div style="font-size:0.7rem; color:rgba(255,255,255,0.6); margin-top:5px; text-align: ${isMe ? 'right' : 'left'}">
                ${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        `;
        eccChatContainer.appendChild(div);
    });
    eccChatContainer.scrollTop = eccChatContainer.scrollHeight;
}

// Job Dashboard Logic
const jobDashboardModal = document.getElementById('jobDashboardModal');
const openJobProfileBtn = document.getElementById('openJobProfileBtn');
const closeJobDashboard = document.getElementById('closeJobDashboard');
const jobDashboardClientsList = document.getElementById('jobDashboardClientsList');

if (openJobProfileBtn) {
    openJobProfileBtn.addEventListener('click', () => {
        document.getElementById('userProfileModal').style.display = 'none';
        jobDashboardModal.style.display = 'flex';
        renderJobDashboard();
    });
}

if (closeJobDashboard) {
    closeJobDashboard.addEventListener('click', () => {
        jobDashboardModal.style.display = 'none';
    });
}

function renderJobDashboard() {
    if (!currentUser) return;
    const myEditorProfile = editors.find(e => e.userId === currentUser.uid);
    if (!myEditorProfile) return;
    
    // Find unique clients from requests
    const myRequests = allRequests.filter(r => r.editorId === myEditorProfile.id);
    const uniqueClientIds = [...new Set(myRequests.map(r => r.userId))];
    
    if (uniqueClientIds.length === 0) {
        jobDashboardClientsList.innerHTML = '<div class="text-center text-secondary w-100" style="grid-column: 1/-1;">You do not have any clients yet.</div>';
        return;
    }
    
    jobDashboardClientsList.innerHTML = '';
    uniqueClientIds.forEach(clientId => {
        const u = allUsers[clientId] || {};
        const name = u.firstName ? (u.firstName + ' ' + (u.lastName || '')).trim() : 'Anonymous';
        const photo = u.photoUrl || 'https://via.placeholder.com/60';
        
        const div = document.createElement('div');
        div.className = 'glass-card p-3';
        div.style.background = 'rgba(255,255,255,0.02)';
        div.style.border = '1px solid var(--glass-border)';
        div.style.borderRadius = '12px';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
        div.style.textAlign = 'center';
        
        div.innerHTML = `
            <img src="${photo}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; margin-bottom:10px;">
            <h4 style="margin:0 0 5px;">${name}</h4>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 10px; word-break:break-all;">${u.email || 'No email'}</p>
            <button class="btn secondary btn-sm w-100 mt-auto msg-client-btn">💬 Message</button>
        `;
        
        div.querySelector('.msg-client-btn').addEventListener('click', () => {
            jobDashboardModal.style.display = 'none';
            editorClientChatModal.style.display = 'flex';
            
            currentEccPath = `editor_client_chats/${myEditorProfile.id}_${clientId}/messages`;
            document.getElementById('eccUserName').textContent = 'Chat with ' + name;
            
            if (eccListener) eccListener(); // Unsubscribe prev
            
            eccListener = onValue(ref(db, currentEccPath), (snap) => {
                const data = snap.val() || {};
                const messages = Object.keys(data).map(k => ({id: k, ...data[k]})).sort((a,b) => a.timestamp - b.timestamp);
                renderEccChat(messages);
            });
        });
        
        jobDashboardClientsList.appendChild(div);
    });
}
const supportChatModal = document.getElementById('supportChatModal');
const closeSupportChatBtn = document.getElementById('closeSupportChat');
const supportBtn = document.getElementById('supportBtn');
const supportChatContainer = document.getElementById('supportChatContainer');
const supportChatInput = document.getElementById('supportChatInput');
const sendSupportMsgBtn = document.getElementById('sendSupportMsgBtn');

const adminSupportChatsModal = document.getElementById('adminSupportChatsModal');
const closeAdminSupportChatsBtn = document.getElementById('closeAdminSupportChats');
const adminSupportChatsBtn = document.getElementById('adminSupportChatsBtn');
const adminSupportUserList = document.getElementById('adminSupportUserList');
const adminSupportChatContainer = document.getElementById('adminSupportChatContainer');
const adminSupportChatInput = document.getElementById('adminSupportChatInput');
const sendAdminSupportMsgBtn = document.getElementById('sendAdminSupportMsgBtn');
const adminSupportChatHeader = document.getElementById('adminSupportChatHeader');
const adminSupportChatFooter = document.getElementById('adminSupportChatFooter');
let adminActiveSupportUserId = null;
let currentSupportListener = null;

// User Side
if (supportBtn) {
    supportBtn.addEventListener('click', () => {
        if (!currentUser) return;
        supportChatModal.style.display = 'flex';
        renderUserSupportChat();
        if (allSupportChats[currentUser.uid] && allSupportChats[currentUser.uid].unreadUser > 0) {
            update(ref(db, `support_chats/${currentUser.uid}`), { unreadUser: 0 });
        }
    });
}

function listenToUserSupportChats() {
    if(!currentUser) return;
    if(!currentSupportListener) {
        currentSupportListener = onValue(ref(db, `support_chats/${currentUser.uid}`), (snap) => {
            const data = snap.val() || {};
            allSupportChats[currentUser.uid] = data;
            
            // Badge
            const badge = document.getElementById('userUnreadSupportBadge');
            if (badge) {
                if (data.unreadUser > 0) {
                    badge.style.display = 'flex';
                    badge.textContent = data.unreadUser;
                } else {
                    badge.style.display = 'none';
                }
            }
            
            // UI
            if (supportChatModal.style.display === 'flex') {
                const msgsData = data.messages || {};
                const messages = Object.keys(msgsData).map(k => ({ id: k, ...msgsData[k] })).sort((a,b) => a.timestamp - b.timestamp);
                renderUserSupportChatUI(messages);
                if (data.unreadUser > 0) {
                    update(ref(db, `support_chats/${currentUser.uid}`), { unreadUser: 0 });
                }
            }
        });
    }
}

if (closeSupportChatBtn) {
    closeSupportChatBtn.addEventListener('click', () => {
        supportChatModal.style.display = 'none';
    });
}

if (sendSupportMsgBtn && supportChatInput) {
    const sendUserMessage = async () => {
        const text = supportChatInput.value.trim();
        if (!text || !currentUser) return;
        supportChatInput.value = '';
        
        try {
            const up = allUsers[currentUser.uid] || {};
            await push(ref(db, `support_chats/${currentUser.uid}/messages`), {
                senderId: currentUser.uid,
                text: text,
                timestamp: Date.now()
            });
            await update(ref(db, `support_chats/${currentUser.uid}`), {
                lastMessage: text,
                lastTimestamp: Date.now(),
                unreadAdmin: (allSupportChats[currentUser.uid]?.unreadAdmin || 0) + 1,
                userId: currentUser.uid,
                userName: up.firstName ? (up.firstName + ' ' + (up.lastName || '')).trim() : 'Anonymous',
                userPhoto: up.photoUrl || 'https://via.placeholder.com/40'
            });
        } catch(e) {
            console.error("Failed to send message", e);
        }
    };
    sendSupportMsgBtn.addEventListener('click', sendUserMessage);
    supportChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendUserMessage();
    });
}

function renderUserSupportChatUI(messages) {
    if (!supportChatContainer) return;
    supportChatContainer.innerHTML = '';
    
    if (messages.length === 0) {
        supportChatContainer.innerHTML = `<div class="text-center text-secondary" style="margin-top:20px;">Start a conversation with our support team.</div>`;
        return;
    }
    
    messages.forEach(msg => {
        const isMe = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.style.maxWidth = '80%';
        div.style.padding = '10px 15px';
        div.style.borderRadius = '12px';
        div.style.marginBottom = '5px';
        div.style.wordBreak = 'break-word';
        if (isMe) {
            div.style.alignSelf = 'flex-end';
            div.style.background = 'var(--primary)';
            div.style.color = 'white';
        } else {
            div.style.alignSelf = 'flex-start';
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.color = 'white';
        }
        
        div.innerHTML = `
            <div style="font-size:0.95rem;">${msg.text}</div>
            <div style="font-size:0.7rem; color:rgba(255,255,255,0.6); margin-top:5px; text-align: ${isMe ? 'right' : 'left'}">
                ${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        `;
        supportChatContainer.appendChild(div);
    });
    supportChatContainer.scrollTop = supportChatContainer.scrollHeight;
}

function renderUserSupportChat() {
    // Initial fetch from state if needed
    let msgs = [];
    if (allSupportChats[currentUser.uid] && allSupportChats[currentUser.uid].messages) {
        const d = allSupportChats[currentUser.uid].messages;
        msgs = Object.keys(d).map(k => ({id: k, ...d[k]})).sort((a,b) => a.timestamp - b.timestamp);
    }
    renderUserSupportChatUI(msgs);
}


// Admin Side
let globalAdminSupportListener = null;

if (adminSupportChatsBtn) {
    adminSupportChatsBtn.addEventListener('click', () => {
        adminSupportChatsModal.style.display = 'flex';
        renderAdminSupportUsersList();
    });
}

if (closeAdminSupportChatsBtn) {
    closeAdminSupportChatsBtn.addEventListener('click', () => {
        adminSupportChatsModal.style.display = 'none';
        adminActiveSupportUserId = null;
        renderAdminActiveChat([]);
        adminSupportChatHeader.style.display = 'none';
        adminSupportChatFooter.style.display = 'none';
    });
}

// Set up global listener inside onAuthStateChanged for admins
function setupAdminSupportListener() {
    if (!globalAdminSupportListener) {
        globalAdminSupportListener = onValue(ref(db, 'support_chats'), (snap) => {
            const data = snap.val() || {};
            allSupportChats = data;
            renderAdminSupportUsersList();
            
            // Update badge
            let unreadCount = 0;
            Object.values(data).forEach(ch => {
                if (ch.unreadAdmin && ch.unreadAdmin > 0) unreadCount += ch.unreadAdmin;
            });
            const badge = document.getElementById('adminUnreadSupportBadge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }

            // Refresh active chat if it's currently open
            if (adminActiveSupportUserId && data[adminActiveSupportUserId]) {
                const msgsData = data[adminActiveSupportUserId].messages || {};
                const messages = Object.keys(msgsData).map(k => ({ id: k, ...msgsData[k] })).sort((a,b) => a.timestamp - b.timestamp);
                renderAdminActiveChat(messages);
            }
        });
    }
}

function renderAdminSupportUsersList() {
    if (!adminSupportUserList) return;
    adminSupportUserList.innerHTML = '';
    
    const chats = Object.keys(allSupportChats).map(k => ({ id: k, ...allSupportChats[k] }))
        .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
        
    if (chats.length === 0) {
        adminSupportUserList.innerHTML = `<div class="p-3 text-secondary text-center">No chats yet.</div>`;
        return;
    }
    
    chats.forEach(ch => {
        const div = document.createElement('div');
        const isActive = adminActiveSupportUserId === ch.id;
        div.style.padding = '15px';
        div.style.borderBottom = '1px solid var(--glass-border)';
        div.style.cursor = 'pointer';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        div.style.background = isActive ? 'rgba(255,255,255,0.05)' : 'transparent';
        
        div.onmouseover = () => { if(!isActive) div.style.background = 'rgba(255,255,255,0.02)'; };
        div.onmouseout = () => { if(!isActive) div.style.background = 'transparent'; };
        
        const photo = ch.userPhoto || 'https://via.placeholder.com/40';
        const name = ch.userName || 'Anonymous';
        const unreadBadge = (ch.unreadAdmin > 0) ? `<span style="background:red; color:white; border-radius:50%; width:20px; height:20px; font-size:12px; display:flex; align-items:center; justify-content:center;">${ch.unreadAdmin}</span>` : '';
        
        div.innerHTML = `
            <img src="${photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
            <div style="flex:1; overflow:hidden;">
                <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${ch.lastMessage || '...'}
                </div>
            </div>
            ${unreadBadge}
        `;
        
        div.addEventListener('click', () => {
            adminActiveSupportUserId = ch.id;
            
            // Mark as read
            update(ref(db, `support_chats/${ch.id}`), { unreadAdmin: 0 });
            
            // Update Header
            adminSupportChatHeader.style.display = 'flex';
            document.getElementById('adminSupportChatAvatar').src = photo;
            document.getElementById('adminSupportChatName').textContent = name;
            adminSupportChatFooter.style.display = 'flex';
            
            // Initial render
            const msgsData = ch.messages || {};
            const messages = Object.keys(msgsData).map(k => ({ id: k, ...msgsData[k] })).sort((a,b) => a.timestamp - b.timestamp);
            renderAdminActiveChat(messages);
            
            // Re-render list to show active state
            renderAdminSupportUsersList();
        });
        
        adminSupportUserList.appendChild(div);
    });
}

function renderAdminActiveChat(messages) {
    if (!adminSupportChatContainer) return;
    adminSupportChatContainer.innerHTML = '';
    
    if (messages.length === 0) {
        adminSupportChatContainer.innerHTML = `<div class="text-center text-secondary" style="margin-top: 20px;">No messages yet.</div>`;
        return;
    }
    
    messages.forEach(msg => {
        const isAdmin = msg.senderId === 'admin';
        const div = document.createElement('div');
        div.style.maxWidth = '70%';
        div.style.padding = '10px 15px';
        div.style.borderRadius = '12px';
        div.style.marginBottom = '5px';
        div.style.wordBreak = 'break-word';
        if (isAdmin) {
            div.style.alignSelf = 'flex-end';
            div.style.background = 'var(--primary)';
            div.style.color = 'white';
        } else {
            div.style.alignSelf = 'flex-start';
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.color = 'white';
        }
        
        div.innerHTML = `
            <div style="font-size:0.95rem;">${msg.text}</div>
            <div style="font-size:0.7rem; color:rgba(255,255,255,0.6); margin-top:5px; text-align: ${isAdmin ? 'right' : 'left'}">
                ${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        `;
        adminSupportChatContainer.appendChild(div);
    });
    adminSupportChatContainer.scrollTop = adminSupportChatContainer.scrollHeight;
}

if (sendAdminSupportMsgBtn && adminSupportChatInput) {
    const sendAdminMessage = async () => {
        const text = adminSupportChatInput.value.trim();
        if (!text || !adminActiveSupportUserId) return;
        adminSupportChatInput.value = '';
        
        try {
            await push(ref(db, `support_chats/${adminActiveSupportUserId}/messages`), {
                senderId: 'admin',
                text: text,
                timestamp: Date.now()
            });
            await update(ref(db, `support_chats/${adminActiveSupportUserId}`), {
                lastMessage: text,
                lastTimestamp: Date.now(),
                unreadUser: (allSupportChats[adminActiveSupportUserId]?.unreadUser || 0) + 1
            });
        } catch(e) {
            console.error("Failed to send admin message", e);
        }
    };
    sendAdminSupportMsgBtn.addEventListener('click', sendAdminMessage);
    adminSupportChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendAdminMessage();
    });
}

// Auto-shuffle All Editors every 60 seconds
setInterval(() => {
    const isShowingResults = document.getElementById('searchResultsView') && document.getElementById('searchResultsView').style.display === 'block';
    const homeView = document.getElementById('homeView');
    
    if (!isShowingResults && homeView && homeView.style.display !== 'none') {
        const mainGrid = document.getElementById('mainGrid');
        if (mainGrid && mainGrid.children.length > 1) {
            const children = Array.from(mainGrid.children);
            children.sort(() => Math.random() - 0.5);
            children.forEach(child => {
                child.style.transition = 'opacity 0.3s';
                child.style.opacity = '0';
            });
            
            setTimeout(() => {
                children.forEach(child => mainGrid.appendChild(child));
                children.forEach(child => {
                    void child.offsetWidth; // Force reflow
                    child.style.opacity = '1';
                });
            }, 300);
        }
    }
}, 60000);

// Super Admin Logic
const SUPER_ADMIN_PW = "Escanor @6289947781";
const superadminLoginBtn = document.getElementById('superadminLoginBtn');
const superadminPassword = document.getElementById('superadminPassword');
const superadminErrorMsg = document.getElementById('superadminErrorMsg');
const superadminAuthSection = document.getElementById('superadminAuthSection');
const superadminContentSection = document.getElementById('superadminContentSection');
const addAdminManagerModal = document.getElementById('addAdminManagerModal');

if (superadminLoginBtn) {
    superadminLoginBtn.addEventListener('click', () => {
        if (superadminPassword.value === SUPER_ADMIN_PW) {
            superadminAuthSection.style.display = 'none';
            superadminContentSection.style.display = 'block';
            fetchAdmins();
        } else {
            superadminErrorMsg.style.display = 'block';
        }
    });
}

function fetchAdmins() {
    get(ref(db, "admins")).then(snap => {
        const adminTbody = document.getElementById('adminManagersList');
        if (!adminTbody) return;
        adminTbody.innerHTML = '';
        
        let hardcodedAdmins = ['dwiphalder49@gmail.com', 'dwiphalder608@gmail.com'];
        let hasAdminsInDb = false;
        
        if (snap.exists()) {
            hasAdminsInDb = true;
            const admins = snap.val();
            Object.keys(admins).forEach(key => {
                const admin = admins[key];
                const tr = document.createElement('tr');
                const disabledStatus = admin.isDisabled ? '<span class="text-danger text-xs">Disabled</span>' : '<span class="text-success text-xs">Active</span>';
                const toggleBtn = admin.isDisabled 
                    ? `<button class="btn success btn-sm" onclick="window.toggleAdmin('${key}', false)">Enable</button>`
                    : `<button class="btn warning btn-sm" onclick="window.toggleAdmin('${key}', true)">Disable</button>`;
                
                tr.innerHTML = `
                    <td>${admin.email} <br>${disabledStatus}</td>
                    <td>${new Date(admin.addedAt).toLocaleDateString()}</td>
                    <td style="display:flex; gap:10px;">
                        ${toggleBtn}
                        <button class="btn danger btn-sm" onclick="window.removeAdmin('${key}')">Remove</button>
                    </td>
                `;
                adminTbody.appendChild(tr);
            });
        }
        
        if (!hasAdminsInDb) {
            // Display hardcoded ones so user can manage them
            hardcodedAdmins.forEach((email, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${email} <span class="text-xs text-warning">(Default)</span></td>
                    <td>Platform Creator</td>
                    <td><button class="btn danger btn-sm" onclick="window.removeAdmin('fallback_${idx}')" disabled style="opacity: 0.5;">Required</button></td>
                `;
                adminTbody.appendChild(tr);
            });
        }
    }).catch(err => console.error("Error fetching admins", err));
}

if (document.getElementById('addNewAdminBtn')) {
    document.getElementById('addNewAdminBtn').addEventListener('click', () => {
        document.getElementById('adminSearchInput').value = '';
        document.getElementById('adminSearchResult').style.display = 'none';
        document.getElementById('adminSearchError').style.display = 'none';
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPassword').value = '';
        window.foundAdminCandidate = null;
        addAdminManagerModal.style.display = 'flex';
    });
}
if (document.getElementById('closeAddAdminManager')) {
    document.getElementById('closeAddAdminManager').addEventListener('click', () => { addAdminManagerModal.style.display = 'none'; });
}

if (document.getElementById('adminSearchBtn')) {
    document.getElementById('adminSearchBtn').addEventListener('click', () => {
        const query = document.getElementById('adminSearchInput').value.trim().toLowerCase();
        let foundUid = null;
        let foundData = null;
        
        // Exact short ID length is 8
        Object.keys(allUsers).forEach(uid => {
            const u = allUsers[uid];
            if (uid.toLowerCase() === query || uid.substring(0,8).toLowerCase() === query || (u.email && u.email.toLowerCase() === query)) {
                foundUid = uid;
                foundData = u;
            }
        });
        
        if (foundUid && foundData) {
            window.foundAdminCandidate = { uid: foundUid, email: foundData.email, name: foundData.firstName + ' ' + foundData.lastName };
            document.getElementById('adminSearchAvatar').src = foundData.photoUrl || 'https://via.placeholder.com/60';
            document.getElementById('adminSearchName').textContent = foundData.firstName + ' ' + foundData.lastName;
            document.getElementById('adminSearchEmail').textContent = foundData.email;
            document.getElementById('adminSearchResult').style.display = 'block';
            document.getElementById('adminSearchError').style.display = 'none';
        } else {
            window.foundAdminCandidate = null;
            document.getElementById('adminSearchResult').style.display = 'none';
            document.getElementById('adminSearchError').style.display = 'block';
        }
    });
}

if (document.getElementById('confirmAddAdminBtn')) {
    document.getElementById('confirmAddAdminBtn').addEventListener('click', async () => {
        if(!window.foundAdminCandidate) return;
        const email = window.foundAdminCandidate.email;
        const uid = window.foundAdminCandidate.uid;
        
        try {
            const adminRef = push(ref(db, "admins"));
            await set(adminRef, {
                email: email,
                uid: uid,
                addedAt: Date.now(),
                isDisabled: false
            });
            alert("Admin access granted to " + window.foundAdminCandidate.name);
            addAdminManagerModal.style.display = 'none';
            fetchAdmins();
        } catch(err) {
            console.error(err);
            alert("Failed to grant admin access.");
        }
    });
}

if (document.getElementById('createNewAdminBtn')) {
    document.getElementById('createNewAdminBtn').addEventListener('click', async () => {
        const email = document.getElementById('newAdminEmail').value.trim().toLowerCase();
        const password = document.getElementById('newAdminPassword').value;
        if(!email || !password) return alert("Please enter both an email address and a password.");
        if(password.length < 6) return alert("Password must be at least 6 characters.");
        
        // We initialize a secondary firebase app to purely create the account without logging out the current admin
        try {
            const tempApp = initializeApp(firebaseConfig, "TempApp_" + Date.now());
            const tempAuth = getAuth(tempApp);
            
            await createUserWithEmailAndPassword(tempAuth, email, password);
            
            // Now sign out from the temp app so it isn't left hanging
            await signOut(tempAuth);
            
            // Record admin in the database
            const adminRef = push(ref(db, "admins"));
            await set(adminRef, {
                email: email,
                addedAt: Date.now(),
                isDisabled: false
            });
            alert("Admin created successfully. They can now log in using the email and password.");
            addAdminManagerModal.style.display = 'none';
            document.getElementById('newAdminEmail').value = '';
            document.getElementById('newAdminPassword').value = '';
            fetchAdmins();
        } catch(err) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                // If it already exists, just add it to the admins list
                try {
                    const adminRef = push(ref(db, "admins"));
                    await set(adminRef, {
                        email: email,
                        addedAt: Date.now(),
                        isDisabled: false
                    });
                    alert("User already existed. They have now been granted admin privileges! (Password unchanged)");
                    addAdminManagerModal.style.display = 'none';
                    document.getElementById('newAdminEmail').value = '';
                    document.getElementById('newAdminPassword').value = '';
                    fetchAdmins();
                } catch(e) {
                     alert("Failed to grant admin access to existing user.");
                }
            } else {
                alert("Failed to create admin: " + err.message);
            }
        }
    });
}

window.toggleAdmin = async (adminId, disableState) => {
    try {
        await update(ref(db, "admins/" + adminId), { isDisabled: disableState });
        fetchAdmins();
    } catch(err) {
        console.error(err);
        alert("Failed to toggle admin state.");
    }
};

window.removeAdmin = async (adminId) => {
    if(adminId.startsWith('fallback_')) return alert("Cannot remove default admins. You must add new admins first.");
    if(confirm("Are you sure you want to revoke admin access for this user?")) {
        try {
            const snap = await get(ref(db, "admins"));
            if (snap.exists()) {
                const adminsCount = Object.keys(snap.val()).length;
                if (adminsCount <= 1) {
                    return alert("You cannot remove the last remaining admin. Add another admin first.");
                }
            }
            await remove(ref(db, "admins/" + adminId));
            fetchAdmins();
        } catch(err) {
            console.error(err);
            alert("Failed to remove admin.");
        }
    }
};

// ==========================================
// AI Assistant Logic
// ==========================================
window.populateJobAppsSelect = function() {
    const appSelect = document.getElementById('aiJobAppSelect');
    if(!appSelect) return;
    const pendingApps = allApplications ? allApplications.filter(a => a.status === 'pending') : [];
    appSelect.innerHTML = '<option value="">-- Choose a pending application --</option>';
    pendingApps.forEach(app => {
        const name = app.name || 'Unknown';
        appSelect.innerHTML += `<option value="${app.id}">${name} - ${app.email}</option>`;
    });
};

// 1. Setup Admin Tab handling for AI Assistant
const aiAdminTabBtns = document.querySelectorAll('.admin-tab-btn');

aiAdminTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if(btn.id === 'adminSupportChatsBtn' || btn.id === 'closeAdminPanelBtn') return;
        const target = btn.getAttribute('data-tab');
        if(target === 'ai_assistant') {
            populateJobAppsSelect();
        }
    });
});

// 2. Image Generator
const generateBtn = document.getElementById('aiGenerateImageBtn');
const promptInput = document.getElementById('aiImagePrompt');
const ratioSelect = document.getElementById('aiImageAspectRatio');
const loadingDiv = document.getElementById('aiImageLoading');
const resultContainer = document.getElementById('aiImageResultContainer');
const resultImg = document.getElementById('aiGeneratedImage');
const downloadBtn = document.getElementById('aiImageDownloadBtn');

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const prompt = promptInput.value.trim();
            if(!prompt) return alert('Please enter a prompt.');
            
            loadingDiv.style.display = 'block';
            resultContainer.style.display = 'none';
            generateBtn.disabled = true;

            const [width, height] = ratioSelect.value.split('x');
            const encodedPrompt = encodeURIComponent(prompt) + encodeURIComponent(" professional high quality polished 8k");
            
            // Generate a random seed to prevent caching
            const seed = Math.floor(Math.random() * 9999999);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

            // Preload image
            const img = new Image();
            img.onload = () => {
                resultImg.src = imageUrl;
                loadingDiv.style.display = 'none';
                resultContainer.style.display = 'block';
                generateBtn.disabled = false;
            };
            img.onerror = () => {
                alert('Failed to generate image. Please try again.');
                loadingDiv.style.display = 'none';
                generateBtn.disabled = false;
            };
            img.src = imageUrl;
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const url = resultImg.src;
            if(!url) return;
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const objectUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = `lumina-ai-bg-${Date.now()}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(objectUrl);
            } catch(e) {
                alert('Failed to download image.');
            }
        });
    }

    // 3. Application Enhancer
    const appSelect = document.getElementById('aiJobAppSelect');
    const workspace = document.getElementById('aiJobAppWorkspace');
    const originalBio = document.getElementById('aiOriginalBio');
    const originalTags = document.getElementById('aiOriginalTags');
    const textLoading = document.getElementById('aiTextLoading');
    const enhancedWorkspace = document.getElementById('aiEnhancedWorkspace');
    const enhancedBio = document.getElementById('aiEnhancedBio');
    const enhancedTags = document.getElementById('aiEnhancedTags');
    const enhanceBtn = document.getElementById('aiEnhanceContentBtn');
    const saveApproveBtn = document.getElementById('aiSaveAndApproveBtn');

    if (appSelect) {
        appSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if(!val) {
                workspace.style.display = 'none';
                return;
            }
            
            const app = allApplications.find(a => a.id === val);
            if(app) {
                originalBio.textContent = app.bio || 'No bio provided.';
                originalTags.textContent = app.tags || 'No tags provided.';
                workspace.style.display = 'block';
                enhancedWorkspace.style.display = 'none';
            }
        });
    }

    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', async () => {
            const appId = appSelect.value;
            const app = allApplications.find(a => a.id === appId);
            if(!app) return;

            textLoading.style.display = 'block';
            enhancedWorkspace.style.display = 'none';
            enhanceBtn.disabled = true;

            const bioPrompt = encodeURIComponent(`Rewrite the following bio professionally to attract clients in a creative marketplace. Keep it concise, engaging, and in first person. Fix all grammar issues. Do not add any conversational filler, just the rewritten bio. Original bio: ${app.bio || 'I edit videos'}`);
            const tagsPrompt = encodeURIComponent(`Given the following bio: "${app.bio || 'I edit videos'}", suggest 4-6 concise comma-separated tags (like "Video Editing", "VFX", "Color Grading"). Do not include quotes or bullet points. Just comma separated words. Output format: Tag 1, Tag 2, Tag 3`);

            try {
                const [bioRes, tagsRes] = await Promise.all([
                    fetch(`https://text.pollinations.ai/prompt/${bioPrompt}`),
                    fetch(`https://text.pollinations.ai/prompt/${tagsPrompt}`)
                ]);
                
                const rewritenBio = await bioRes.text();
                let rewritenTags = await tagsRes.text();

                // Clean up tags
                rewritenTags = rewritenTags.replace(/["\n\*]/g, '').trim();

                enhancedBio.value = rewritenBio;
                enhancedTags.value = rewritenTags;

                textLoading.style.display = 'none';
                enhancedWorkspace.style.display = 'block';
                enhanceBtn.disabled = false;
            } catch(e) {
                alert('Text generation failed. Please try again.');
                textLoading.style.display = 'none';
                enhanceBtn.disabled = false;
            }
        });
    }

    if (saveApproveBtn) {
        saveApproveBtn.addEventListener('click', async () => {
            const appId = appSelect.value;
            const app = allApplications.find(a => a.id === appId);
            if(!app) return;

            const newBio = enhancedBio.value.trim();
            const newTags = enhancedTags.value.trim();

            if(!newBio || !newTags) return alert('Please ensure bio and tags are not empty.');

            saveApproveBtn.innerHTML = 'Approving...';
            saveApproveBtn.disabled = true;

            try {
                // Update the application object locally
                app.bio = newBio;
                app.tags = newTags;

                await window.aiDirectApproveJobApp(appId);
                
                alert('Application approved and published successfully with AI enhanced content!');
                saveApproveBtn.innerHTML = 'Save Changes & Approve Application';
                saveApproveBtn.disabled = false;
                workspace.style.display = 'none';
                appSelect.value = '';
                populateJobAppsSelect(); // refresh
            } catch(e) {
                console.error(e);
                alert('Failed to approve application.');
                saveApproveBtn.innerHTML = 'Save Changes & Approve Application';
                saveApproveBtn.disabled = false;
            }
        });
    }

window.aiDirectApproveJobApp = async (appId) => {
    const app = allApplications.find(a => a.id === appId);
    if(!app) return;
    
    // Create new editor entry
    const editorRef = push(ref(db, "editors"));
    const newEditorData = {
        userId: app.userId || '',
        name: app.name || '',
        email: app.email || '',
        phone: app.phone || '',
        portfolioUrl: app.portfolioUrl || '',
        bio: app.bio || '',
        tags: app.tags || '',
        category: app.category || '',
        price: app.price || 0,
        maxPrice: app.maxPrice || null,
        currency: app.currency || 'INR',
        photo_url: app.photo_url || '',
        status: 'active',
        isFeatured: false,
        joinedAt: Date.now(),
        ordersCompleted: 0,
        rating: 0
    };
    await set(editorRef, newEditorData);
    
    // Set application status to approved
    await update(ref(db, "editor_applications/" + appId), { status: 'approved' });
    app.status = 'approved';
    
    renderAdminList();
};

