import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, get, push, set, update, remove, onValue, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { GoogleGenAI } from "@google/genai";

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

window.DEFAULT_AVATAR = "data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'%3e%3c/path%3e%3ccircle cx='12' cy='7' r='4'%3e%3c/circle%3e%3c/svg%3e";

// Handle redirect returns from standalone/mobile logins
getRedirectResult(auth).then((result) => {
    if (result && window.loginPromptModal) window.closeModal(loginPromptModal);
}).catch(err => console.error("Redirect login error:", err));

const provider = new GoogleAuthProvider();

// System Settings
let userSettings = JSON.parse(localStorage.getItem('lumina_settings')) || {
    theme: 'dark',
    accent: '#3b82f6',
    font: 'sanfrancisco',
    animations: true,
    sounds: true,
    lowEnd: false,
    hideOnline: false
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
    if (!userSettings.animations || userSettings.lowEnd) {
        document.body.classList.add('no-animations');
    } else {
        document.body.classList.remove('no-animations');
    }

    if (userSettings.lowEnd) {
        document.body.classList.add('low-end-mode');
    } else {
        document.body.classList.remove('low-end-mode');
    }
    
    // Set UI selects (if they exist)
    if (document.getElementById('prefTheme')) {
        document.getElementById('prefTheme').value = userSettings.theme;
        document.getElementById('prefFont').value = userSettings.font || 'sanfrancisco';
        document.getElementById('prefSounds').checked = userSettings.sounds;
        document.getElementById('prefHideOnline').checked = userSettings.hideOnline;
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
let allStatuses = {};
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
const toggleFiltersBtnResults = document.getElementById('toggleFiltersBtnResults');
const filterModal = document.getElementById('filterModal');

if (toggleFiltersBtn) {
    toggleFiltersBtn.addEventListener('click', () => {
        openModal(filterModal);
    });
}
if (toggleFiltersBtnResults) {
    toggleFiltersBtnResults.addEventListener('click', () => {
        openModal(filterModal);
    });
}

const closeFilterModal = document.getElementById('closeFilterModal');
if(closeFilterModal) closeFilterModal.addEventListener('click', () => closeModal(filterModal));

// Modal Tabs Logic
const filterTabs = document.querySelectorAll('.filter-tab');
const filterPanes = document.querySelectorAll('.filter-pane');

filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        filterPanes.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-target');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');
    });
});

window.activeModalsStack = [];

window.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        // If it's the animated chat modal, close it specifically!
        if (e.target.id === 'editorClientChatModal') {
            closeAnimatedModal(e.target);
            return;
        }
        
        // Let image viewer close itself
        if (e.target.id === 'imageViewerModal') {
            return;
        }

        closeModal(e.target);
    }
});

window.addEventListener('popstate', (e) => {
    if (window._isClosingFromCode) {
        window._isClosingFromCode = false;
        return;
    }
    
    if (window.activeModalsStack.length > 0) {
        const topModalEntry = window.activeModalsStack.pop();
        if (topModalEntry.type === 'normal') {
            const modal = topModalEntry.modal;
            document.body.style.overflow = window.activeModalsStack.length > 0 ? 'hidden' : '';
            if(userSettings.animations) {
                modal.style.animation = 'fadeOutModal 0.3s ease forwards';
                const card = modal.querySelector('.modal-card');
                if(card) {
                    card.style.animation = 'zoomOutModal 0.3s ease forwards';
                }
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 280);
            } else {
                modal.style.display = 'none';
            }
        } else if (topModalEntry.type === 'animated') {
            const modal = topModalEntry.modal;
            document.body.style.overflow = window.activeModalsStack.length > 0 ? 'hidden' : '';
            modal.style.transform = 'translateX(100%)';
            setTimeout(() => {
                modal.style.display = 'none';
                if (topModalEntry.callback) topModalEntry.callback();
            }, 300);
        } else if (topModalEntry.type === 'imageViewer') {
            const modal = topModalEntry.modal;
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        return;
    }

    // Modal stack is empty, handle tab navigation
    if (e.state && e.state.type === 'nav') {
        const view = e.state.view;
        window.currentNavView = view;
        window.switchNavView(view, true); // pass true to skip replacing/pushing state
    } else if (e.state && e.state.type === 'guard') {
        // User exited the initial guard state (meaning they hit back on Home tab).
        // Push the guard and home state back immediately so they don't exit if they cancel.
        history.pushState({ type: 'nav', view: 'home' }, "");
        window.currentNavView = 'home';
        openModal(document.getElementById('exitConfirmModal'));
    }
});

const exitConfirmModal = document.getElementById('exitConfirmModal');
document.getElementById('cancelExitBtn')?.addEventListener('click', () => {
    if(exitConfirmModal) closeModal(exitConfirmModal);
});
document.getElementById('confirmExitBtn')?.addEventListener('click', () => {
    // If they confirm, we try to close the window (works in some PWA/standalone modes)
    try { window.close(); } catch(e){}
    // Otherwise, we navigate back far enough to exit the history stack we created
    // Stack is currently: [Guard, Home, Modal]
    // To exit to the previous page (before Guard), we go back 3 times.
    history.go(-3);
});

// Setup navigation history on load
window.addEventListener('load', () => {
    if (!history.state || history.state.type !== 'nav') {
        history.replaceState({ type: 'guard' }, "");
        history.pushState({ type: 'nav', view: 'home' }, "");
        window.currentNavView = 'home';
    }
});

window.openModal = function(modal) {
    if(!modal) return;
    document.body.style.overflow = 'hidden';
    
    window.activeModalsStack.push({ type: 'normal', modal: modal });
    history.pushState({ modalOpen: true }, "");

    if(userSettings.animations && !userSettings.lowEnd) {
        modal.style.display = 'flex';
        modal.style.animation = 'fadeInModal 0.3s ease forwards';
        const card = modal.querySelector('.modal-card');
        if(card) {
            card.style.animation = 'zoomInModal 0.3s ease forwards';
        }
    } else {
        modal.style.display = 'flex';
    }
}

window.closeModal = function(modal) {
    if(!modal) return;
    
    const idx = window.activeModalsStack.findIndex(m => m.modal === modal);
    if(idx > -1) {
        window.activeModalsStack.splice(idx, 1);
        window._isClosingFromCode = true;
        history.back();
    }
    
    document.body.style.overflow = window.activeModalsStack.length > 0 ? 'hidden' : '';
    if(userSettings.animations && !userSettings.lowEnd) {
        modal.style.animation = 'fadeOutModal 0.3s ease forwards';
        const card = modal.querySelector('.modal-card');
        if(card) {
            card.style.animation = 'zoomOutModal 0.3s ease forwards';
        }
        setTimeout(() => {
            modal.style.display = 'none';
            modal.style.animation = '';
            if(card) card.style.animation = '';
        }, 280);
    } else {
        modal.style.display = 'none';
    }
}

// DOM Elements - Modals
const profileModal = document.getElementById('editorProfileModal');
const contactModal = document.getElementById('contactModal');
const loginPromptModal = document.getElementById('loginPromptModal');

// Init
window.addEventListener('DOMContentLoaded', () => {
    fetchEditors();
    onValue(ref(db, 'status'), (snap) => {
        allStatuses = snap.val() || {};
        if (typeof renderClientChatsList === 'function' && window.globalClientChatsData) {
            renderClientChatsList(window.globalClientChatsData);
        }
        if (currentProfileId) {
            openProfile(currentProfileId);
        }
    });

    // Navbar scroll behavior
    let lastScrollY = window.scrollY;
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (!navbar) return;
        const currentScrollY = window.scrollY;
        // Don't trigger at the very top
        if (currentScrollY < 50) {
            navbar.classList.remove('nav-hidden');
        } else if (currentScrollY > lastScrollY) {
            // Scrolling down
            navbar.classList.add('nav-hidden');
        } else {
            // Scrolling up
            navbar.classList.remove('nav-hidden');
        }
        lastScrollY = currentScrollY;
    });
});

let isInitialAuthCheck = true;
const appStartTime = Date.now();
const MINIMUM_SPLASH_TIME = 3500;

window.updateOnlineStatus = function(forceUpdate = false) {
    if (!currentUser) return;
    const myStatusRef = ref(db, `status/${currentUser.uid}`);
    if (userSettings.hideOnline) {
        set(myStatusRef, { state: 'offline', last_changed: serverTimestamp() });
        onDisconnect(myStatusRef).cancel();
    } else {
        const connectedRef = ref(db, '.info/connected');
        if (forceUpdate) {
            set(myStatusRef, { state: 'online', last_changed: serverTimestamp() });
            onDisconnect(myStatusRef).set({ state: 'offline', last_changed: serverTimestamp() });
        }
    }
};

const connectedRef = ref(db, '.info/connected');
onValue(connectedRef, (snap) => {
    if (snap.val() === true && currentUser && !userSettings.hideOnline) {
        const myStatusRef = ref(db, `status/${currentUser.uid}`);
        onDisconnect(myStatusRef).set({ state: 'offline', last_changed: serverTimestamp() }).then(() => {
            set(myStatusRef, { state: 'online', last_changed: serverTimestamp() });
        });
    }
});

// Authentication AuthState
onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const adminPanelOverlay = document.getElementById('adminPanelOverlay');
    const splashScreenOverlay = document.getElementById('splashScreenOverlay');

    const processAuthState = async () => {
        if (user) {
            currentUser = user;
            updateOnlineStatus(true);
            
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
            if(typeof listenToClientChats === 'function') listenToClientChats();
            if(typeof listenToGlobalRequests === 'function') listenToGlobalRequests();
            let profilePic = user.photoURL;
            if(allUsers[user.uid] && allUsers[user.uid].photoUrl) {
                profilePic = allUsers[user.uid].photoUrl;
                userAvatar.src = profilePic || window.DEFAULT_AVATAR;
            } else {
                get(ref(db, "users/" + user.uid)).then(sp => {
                    if(sp.exists()) {
                        allUsers[user.uid] = sp.val();
                        if(sp.val().photoUrl) {
                            userAvatar.src = sp.val().photoUrl || window.DEFAULT_AVATAR;
                        } else {
                            userAvatar.src = profilePic || window.DEFAULT_AVATAR;
                        }
                    } else {
                        // Create basic user profile on sign up
                        const newUser = {
                            email: user.email || '',
                            photoUrl: user.photoURL || '',
                            displayName: user.displayName || '',
                            createdAt: Date.now()
                        };
                        set(ref(db, "users/" + user.uid), newUser).then(() => {
                            allUsers[user.uid] = newUser;
                            userAvatar.src = newUser.photoUrl || window.DEFAULT_AVATAR;
                        });
                    }
                });
            }
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
    };
    
    if (isInitialAuthCheck) {
        isInitialAuthCheck = false;
        const elapsedTime = Date.now() - appStartTime;
        const remainingTime = Math.max(0, MINIMUM_SPLASH_TIME - elapsedTime);
        
        setTimeout(async () => {
            await processAuthState();
            if (splashScreenOverlay) {
                splashScreenOverlay.style.opacity = '0';
                setTimeout(() => {
                    splashScreenOverlay.style.display = 'none';
                }, 800);
            }
        }, remainingTime);
    } else {
        processAuthState();
    }
});

// Auth Splash Screen Logic
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const authForm = document.getElementById('authForm');
const mainAuthBtn = document.getElementById('mainAuthBtn');
const authErrorMsg = document.getElementById('authErrorMsg');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

let isLoginMode = true;

// Magical Idle Animation Logic
let authIdleTimer;
const resetAuthIdleTimer = () => {
    if (mainAuthBtn) {
        mainAuthBtn.classList.remove('auth-btn-magical');
        clearTimeout(authIdleTimer);
        // Do not add animation if button is disabled
        if (!mainAuthBtn.disabled) {
            authIdleTimer = setTimeout(() => {
                mainAuthBtn.classList.add('auth-btn-magical');
            }, 4000); // 4 seconds
        }
    }
};

// Listen to interactions to reset the timer
['mousedown', 'touchstart', 'keydown', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, resetAuthIdleTimer, { passive: true });
});
// Start the initial timer
resetAuthIdleTimer();

if(tabLogin) tabLogin.addEventListener('click', () => {
    if (isLoginMode) return;
    performTabSwitch(true);
});

if(tabSignup) tabSignup.addEventListener('click', () => {
    if (!isLoginMode) return;
    performTabSwitch(false);
});

let isAnimatingTab = false;

async function performTabSwitch(toLogin) {
    if (isAnimatingTab) return;
    isAnimatingTab = true;

    const card = document.getElementById('auth3dCard');
    const labels = authForm.querySelectorAll('label, .text-center:not(.logo), button');
    const inputs = authForm.querySelectorAll('input');
    
    const shouldAnimate = userSettings.animations && !userSettings.lowEnd;

    // Disable inline transform for animation
    if (card) card.style.transform = '';

    // Add 3d flip animation
    if (shouldAnimate && card) {
        card.classList.remove('animate-tab-switch');
        void card.offsetWidth; // trigger reflow
        card.classList.add('animate-tab-switch');
    }
    
    // Wait for the card to be at 90 degrees (halfway point)
    if (shouldAnimate) {
        await new Promise(r => setTimeout(r, 300));
    }
    
    isLoginMode = toLogin;
    
    if (isLoginMode) {
        if(tabLogin) tabLogin.classList.add('active');
        if(tabSignup) tabSignup.classList.remove('active');
        if(mainAuthBtn) mainAuthBtn.textContent = 'Log In';
        if(forgotPasswordLink) forgotPasswordLink.style.display = 'block';
        if(document.getElementById('confirmPasswordGroup')) document.getElementById('confirmPasswordGroup').style.display = 'none';
        if(document.getElementById('authConfirmPassword')) document.getElementById('authConfirmPassword').removeAttribute('required');
    } else {
        if(tabSignup) tabSignup.classList.add('active');
        if(tabLogin) tabLogin.classList.remove('active');
        if(mainAuthBtn) mainAuthBtn.textContent = 'Sign Up';
        if(forgotPasswordLink) forgotPasswordLink.style.display = 'none';
        if(document.getElementById('confirmPasswordGroup')) document.getElementById('confirmPasswordGroup').style.display = 'block';
        if(document.getElementById('authConfirmPassword')) document.getElementById('authConfirmPassword').setAttribute('required', 'true');
    }
    
    if(authForm) authForm.reset();
    if(authErrorMsg) authErrorMsg.classList.add('hidden');
    
    if (shouldAnimate) {
        // Add falling animation to text elements
        labels.forEach((el, index) => {
            el.classList.remove('animate-text-drop');
            void el.offsetWidth;
            el.style.animationDelay = `${index * 0.05}s`;
            el.classList.add('animate-text-drop');
        });
        inputs.forEach((el, index) => {
            el.classList.remove('animate-text-drop');
            void el.offsetWidth;
            el.style.animationDelay = `${(labels.length + index) * 0.05}s`;
            el.classList.add('animate-text-drop');
        });
        
        // Remove the flip class after animation completes
        setTimeout(() => {
            if (card) card.classList.remove('animate-tab-switch');
            isAnimatingTab = false;
        }, 350);
    } else {
        isAnimatingTab = false;
    }
}

const showCustomToast = (msg, isAnim1, type = 'error') => {
    const toast = document.getElementById('customToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'custom-toast'; // reset
    if (type === 'success') toast.classList.add('toast-success');
    void toast.offsetWidth; // trigger reflow
    toast.classList.add(isAnim1 ? 'toast-anim-1' : 'toast-anim-2');
};

// Email/Password login logic
if(authForm) authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const pass = document.getElementById('authPassword').value;
    
    if (!email.toLowerCase().endsWith('@gmail.com')) {
        showCustomToast("Please enter a valid @gmail.com address!", true);
        return;
    }

    if (!isLoginMode) {
        const confirmPass = document.getElementById('authConfirmPassword').value;
        if (pass !== confirmPass) {
            showCustomToast("Passwords do not match!", false);
            return;
        }
    }
    
    mainAuthBtn.disabled = true;
    mainAuthBtn.textContent = 'Please Wait...';
    if(authErrorMsg) authErrorMsg.classList.add('hidden');
    
    try {
        if(isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pass);
        } else {
            await createUserWithEmailAndPassword(auth, email, pass);
        }
        closeModal(loginPromptModal); // in case it was opened from hiring
    } catch(err) {
        console.error("Auth error:", err);
        let msg = err.message.replace('Firebase:', '').trim();
        if (err.code === 'auth/network-request-failed') {
            msg = "Network request failed. If you are in the preview window, please click 'Open in new tab' (top right).";
        } else if (err.code === 'auth/invalid-credential') {
            msg = "Invalid email or password.";
        } else if (err.code === 'auth/email-already-in-use') {
            msg = "This email is already registered. Switch to 'Log In'.";
        } else if (err.code === 'auth/operation-not-allowed') {
            msg = "Email/Password login is not enabled.";
        }
        showCustomToast(msg, true);
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

// Forgot Password Logic
let forgotPasswordCooldown = 0;
let defaultForgotText = "Forgotten password?";

if(forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (forgotPasswordCooldown > 0) return;
        
        const email = document.getElementById('authEmail').value.trim();
        if(!email) {
            showCustomToast("Please enter your email address first, then click 'Forgotten password?'.", false);
            return;
        }
        try {
            forgotPasswordCooldown = 60;
            forgotPasswordLink.style.opacity = '0.5';
            forgotPasswordLink.style.cursor = 'not-allowed';
            
            await sendPasswordResetEmail(auth, email);
            
            showCustomToast(`Message Sent! A password reset link has been sent to ${email}.`, true, 'success');
            
            const timerInterval = setInterval(() => {
                forgotPasswordCooldown--;
                if (forgotPasswordCooldown <= 0) {
                    clearInterval(timerInterval);
                    forgotPasswordLink.textContent = defaultForgotText;
                    forgotPasswordLink.style.opacity = '1';
                    forgotPasswordLink.style.cursor = 'pointer';
                } else {
                    forgotPasswordLink.textContent = `Resend in ${forgotPasswordCooldown}s`;
                }
            }, 1000);
            
        } catch (error) {
            console.error(error);
            forgotPasswordCooldown = 0;
            forgotPasswordLink.style.opacity = '1';
            forgotPasswordLink.style.cursor = 'pointer';
            
            showCustomToast(error.message.replace('Firebase:', '').trim(), false);
        }
    });
}

const handleGoogleLogin = async (e) => {
    e.preventDefault();
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        showCustomToast("Successfully logged in with Google!");
        authScreen.style.display = 'none';
        mainApp.style.display = 'flex';
        // You might want to save additional user info to the database if it's their first time
        // but Firebase Auth automatically handles user creation.
    } catch (error) {
        console.error("Google login error", error);
        showCustomToast(error.message || "Failed to log in with Google", true);
    }
};

if(document.getElementById('googleAuthBtn')) { document.getElementById('googleAuthBtn').addEventListener('click', handleGoogleLogin); }


if(loginBtn) loginBtn.addEventListener('click', () => {
    // If they click Login from navbar, show the auth screen if it was hidden
    // but the app structure handles this via AuthState.
    signOut(auth); // A small hack to return to splash page
});
if(document.getElementById('signInGoogleBtn')) document.getElementById('signInGoogleBtn').addEventListener('click', handleGoogleLogin);
const logoutConfirmModal = document.getElementById('logoutConfirmModal');

if(logoutBtn) logoutBtn.addEventListener('click', () => {
    openModal(logoutConfirmModal);
});

if(document.getElementById('cancelLogoutBtn')) {
    document.getElementById('cancelLogoutBtn').addEventListener('click', () => {
        closeModal(logoutConfirmModal);
    });
}

if(document.getElementById('confirmLogoutBtn')) {
    document.getElementById('confirmLogoutBtn').addEventListener('click', () => {
        closeModal(logoutConfirmModal);
        signOut(auth);
    });
}

if(userAvatar) {
    userAvatar.style.cursor = 'pointer';
    userAvatar.addEventListener('click', () => {
        window.openUserProfileView();
    });
}
if(bottomNavProfile) {
    bottomNavProfile.addEventListener('click', (e) => {
        e.preventDefault();
        window.openUserProfileView();
    });
}

const bottomNavMessages = document.getElementById('bottomNavMessages');
if(bottomNavMessages) {
    bottomNavMessages.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentUser) {
            openModal(document.getElementById('loginPromptModal'));
            return;
        }
        window.switchNavView('messages');
        if (typeof listenToClientChats === 'function') {
            listenToClientChats();
        } else {
            // Because listenToClientChats might be declared after
            setTimeout(() => {
                if (typeof listenToClientChats === 'function') listenToClientChats();
            }, 100);
        }
    });
}
function updateNavIndicator(view) {
    const navItems = {
        'messages': 0,
        'jobs': 1,
        'home': 2,
        'wishlist': 3,
        'profile': 4
    };
    const idx = navItems[view];
    const navIndicator = document.getElementById('navIndicator');
    if (navIndicator && idx !== undefined) {
        navIndicator.style.transform = `translateX(${idx * 100}%)`;
    }
}

function animateViewSwitch(newViewEl, oldViewElements, callback, direction = null) {
    if (!userSettings.animations || userSettings.lowEnd) {
        oldViewElements.forEach(el => { if(el) el.style.display = 'none'; });
        if(newViewEl) newViewEl.style.display = 'block';
        if(callback) callback();
        return;
    }

    let delay = 0;
    let anyVisible = false;
    
    let outAnim = 'fadeOutUp 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    let inAnim = 'fadeInUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

    if (direction === 'Next') {
        outAnim = 'slideLeftOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards';
        inAnim = 'slideLeftIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
    } else if (direction === 'Prev') {
        outAnim = 'slideRightOut 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards';
        inAnim = 'slideRightIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
    }

    oldViewElements.forEach(el => {
        if(el && el.style.display !== 'none') {
            anyVisible = true;
            el.style.animation = outAnim;
            setTimeout(() => {
                el.style.display = 'none';
                el.style.animation = '';
            }, 200);
        }
    });

    if (anyVisible) delay = 200;

    if(newViewEl) {
        setTimeout(() => {
            newViewEl.style.display = 'block';
            newViewEl.style.animation = inAnim;
            if(callback) callback();
        }, delay);
    } else {
        setTimeout(() => {
            if(callback) callback();
        }, delay);
    }
}

window.goToWizardStep = function(targetStep, currentStep = null) {
    if (currentStep !== null && targetStep > currentStep) {
        // Validate current step
        let idsToValidate = [];
        if (currentStep === 1) idsToValidate = ['jobName', 'jobEmail', 'jobPhone'];
        if (currentStep === 2) idsToValidate = ['jobCategory', 'jobPrice', 'jobExperience'];
        if (currentStep === 3) idsToValidate = ['jobSkills', 'jobBio'];
        if (currentStep === 4) idsToValidate = ['jobAvatarUrl', 'jobBannerUrl'];
        
        let isValid = true;
        idsToValidate.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                // If it's a hidden input for image URL, validate the value but highlight the button instead
                let errorTarget = el;
                if (id === 'jobAvatarUrl') {
                    errorTarget = document.getElementById('jobAvatarUpload').nextElementSibling; // The button
                } else if (id === 'jobBannerUrl') {
                    errorTarget = document.getElementById('jobBannerUpload').nextElementSibling; // The button
                }

                errorTarget.classList.remove('error-field');
                // Trigger reflow to restart animation
                void errorTarget.offsetWidth;
                if (!el.value || el.value.trim() === '') {
                    isValid = false;
                    errorTarget.classList.add('error-field');
                }
            }
        });
        
        if (!isValid) {
            playTick(); // Or error sound if we had one
            return; // Prevent step change
        }
    }

    for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById('wizardStep' + i);
        if (stepEl) {
            stepEl.style.display = i === targetStep ? 'block' : 'none';
        }
    }
    const progressSegments = document.querySelectorAll('#jobsProgressBar .progress-segment');
    progressSegments.forEach((seg, idx) => {
        if (idx < targetStep) {
            seg.style.background = 'var(--primary)';
        } else {
            seg.style.background = 'rgba(255,255,255,0.1)';
        }
    });
};

window.switchNavView = function(view, skipHistory = false) {
    const searchResultsView = document.getElementById('searchResultsView');
    const profileView = document.getElementById('profileView');
    const messagesView = document.getElementById('messagesView');
    const bottomNavMessages = document.getElementById('bottomNavMessages');
    
    // Determine scroll direction
    const prevView = window.currentNavView || 'home';
    if (prevView === view && !skipHistory) return;
    
    const oldIdx = navOrder.indexOf(prevView);
    const newIdx = navOrder.indexOf(view);
    
    // History management
    if (!skipHistory) {
        if (view === 'home') {
            // If they go to home, and they were somewhere else, we pop back to home
            // Assuming home is always 1 step back from any non-home tab
            if (history.state && history.state.type === 'nav' && history.state.view !== 'home') {
                window._isClosingFromCode = true;
                history.back();
            }
        } else {
            // Target is non-home
            if (history.state && history.state.type === 'nav' && history.state.view === 'home') {
                history.pushState({ type: 'nav', view: view }, "");
            } else {
                // If they are on another non-home tab, just replace
                history.replaceState({ type: 'nav', view: view }, "");
            }
        }
    }
    
    let direction = null;
    if (oldIdx !== -1 && newIdx !== -1) {
        if (newIdx > oldIdx) direction = 'Next';
        if (newIdx < oldIdx) direction = 'Prev';
    }
    
    // Clear all nav active states
    [bottomNavHome, bottomNavJobs, bottomNavWishlist, bottomNavProfile, bottomNavMessages].forEach(el => {
        if(el) el.classList.remove('active');
    });

    // Update the visual selection indicator
    updateNavIndicator(view);

    if(view === 'home') {
        animateViewSwitch(homeView, [jobsView, wishlistView, searchResultsView, profileView, messagesView], null, direction);
        if(bottomNavHome) bottomNavHome.classList.add('active');
    } else if(view === 'jobs') {
        animateViewSwitch(jobsView, [homeView, wishlistView, searchResultsView, profileView, messagesView], populateJobFormFromProfile, direction);
        if(bottomNavJobs) bottomNavJobs.classList.add('active');
    } else if(view === 'wishlist') {
        animateViewSwitch(wishlistView, [homeView, jobsView, searchResultsView, profileView, messagesView], renderWishlist, direction);
        if(bottomNavWishlist) bottomNavWishlist.classList.add('active');
    } else if(view === 'searchResults') {
        animateViewSwitch(searchResultsView, [homeView, jobsView, wishlistView, profileView, messagesView], null, direction);
    } else if(view === 'profile') {
        animateViewSwitch(profileView, [homeView, jobsView, wishlistView, searchResultsView, messagesView], populateUserProfileData, direction);
        if(bottomNavProfile) bottomNavProfile.classList.add('active');
    } else if(view === 'messages') {
        animateViewSwitch(messagesView, [homeView, jobsView, wishlistView, searchResultsView, profileView], null, direction);
        if(bottomNavMessages) bottomNavMessages.classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.currentNavView = view;
};

// Swipe Gestures for Navigation
const navOrder = ['messages', 'jobs', 'home', 'wishlist', 'profile'];
let touchstartX = 0;
let touchendX = 0;
let touchstartY = 0;
let touchendY = 0;
let touchStartTarget = null;

function handleGesture(e) {
    const target = touchStartTarget || (e && e.target);
    if (target && target.closest && target.closest('.horizontal-scroll-container, .filters-scroll, .chat-container, .messages-list, .ad-section')) {
        return;
    }

    const xDiff = Math.abs(touchendX - touchstartX);
    const yDiff = Math.abs(touchendY - touchstartY);
    // Be sure it is a horizontal swipe, not vertical scrolling
    if (xDiff < 60 || yDiff > 50) return; 

    // If currentUser is not defined, we can't switch to some protected routes like wishlist, jobs, messages, profile.
    // For simplicity, let's only allow swipe if we are already in one of these tabs.
    const curIdx = navOrder.indexOf(window.currentNavView || 'home');
    if (curIdx === -1) return; // i.e. on searchResults
    
    if (touchendX < touchstartX) { // Swiped left -> Next
        if (curIdx < navOrder.length - 1) {
            const nextView = navOrder[curIdx + 1];
            if ((nextView === 'messages' || nextView === 'profile' || nextView === 'jobs' || nextView === 'wishlist') && !currentUser) {
                // Must be logged in to go here
                openModal(document.getElementById('loginPromptModal'));
                return;
            }
            window.switchNavView(nextView);
        }
    }
    
    if (touchendX > touchstartX) { // Swiped right -> Previous
        if (curIdx > 0) {
            const prevView = navOrder[curIdx - 1];
            if ((prevView === 'messages' || prevView === 'profile' || prevView === 'jobs' || prevView === 'wishlist') && !currentUser) {
                openModal(document.getElementById('loginPromptModal'));
                return;
            }
            window.switchNavView(prevView);
        }
    }
}

const mainApp = document.getElementById('mainApp');
if (mainApp) {
    mainApp.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
        touchstartY = e.changedTouches[0].screenY;
        touchStartTarget = e.target;
    }, {passive: true});

    mainApp.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        touchendY = e.changedTouches[0].screenY;
        handleGesture(e);
    }, {passive: true});
}

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
    if(typeof window.goToWizardStep === 'function') window.goToWizardStep(1);
    const jobsMsg = document.getElementById('jobsCompleteProfileMsg');
    
    const jobsFormContainer = document.getElementById('jobsFormContainer');
    const jobsStatusContainer = document.getElementById('jobsStatusContainer');
    const jobsHeaderSection = document.getElementById('jobsHeaderSection');
    
    if (jobsFormContainer) jobsFormContainer.style.display = 'block';
    if (jobsStatusContainer) jobsStatusContainer.style.display = 'none';
    if (jobsHeaderSection) jobsHeaderSection.style.display = 'block';

    if(!currentUser) {
        if(jobsMsg) jobsMsg.classList.remove('hidden');
        if(document.getElementById('submitJobReqBtn')) document.getElementById('submitJobReqBtn').disabled = true;
        return;
    }
    const up = allUsers[currentUser.uid] || {};
    
    // Check if user is already an editor or has an application
    const isAlreadyEditor = editors.find(e => e.userId === currentUser.uid && !e.deletionScheduledAt);
    const pendingApp = allApplications.find(a => a.userId === currentUser.uid && !a.deletionScheduledAt);
    
    const displayEntity = isAlreadyEditor || pendingApp;

    if(displayEntity) {
        if (jobsFormContainer) jobsFormContainer.style.display = 'none';
        if (jobsHeaderSection) jobsHeaderSection.style.display = 'none';
        if (jobsStatusContainer) {
            jobsStatusContainer.style.display = 'block';
            
            const statusTitle = jobsStatusContainer.querySelector('h2');
            const statusMsg = jobsStatusContainer.querySelector('p.text-secondary') || jobsStatusContainer.querySelectorAll('p')[0];
            const countdownContainer = document.getElementById('countdownHours').parentElement.parentElement;
            
            const isUpdatePending = isAlreadyEditor && pendingApp && pendingApp.status === 'pending';

            if (isUpdatePending) {
                statusTitle.textContent = "Profile Updates Under Review";
                statusMsg.textContent = "Your creator profile is live, but your recent updates are currently being reviewed.";
                statusTitle.style.color = "var(--warning)";
                if (jobsStatusContainer.querySelector('svg')) {
                    jobsStatusContainer.querySelector('svg').outerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 3s linear infinite;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
                }
                countdownContainer.style.display = 'none';
            } else if (isAlreadyEditor || (pendingApp && pendingApp.status === 'approved')) {
                statusTitle.textContent = "Profile is Live & Verified!";
                statusMsg.textContent = "Your creator profile has been approved and is public on the platform.";
                statusTitle.style.color = "var(--success)";
                if (jobsStatusContainer.querySelector('svg')) {
                    jobsStatusContainer.querySelector('svg').outerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
                }
                countdownContainer.style.display = 'none';
            } else if (pendingApp) {
                statusTitle.textContent = "Application Under Review";
                statusMsg.textContent = "Your profile has been submitted and is currently being reviewed. The process can take up to 48 hours.";
                statusTitle.style.color = "white";
                if (jobsStatusContainer.querySelector('svg')) {
                    jobsStatusContainer.querySelector('svg').outerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 3s linear infinite;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
                }
                countdownContainer.style.display = 'flex';
                
                const applicationTime = pendingApp.timestamp || Date.now();
                const targetTime = applicationTime + (48 * 60 * 60 * 1000);
                
                if(window.jobsCountdownInterval) clearInterval(window.jobsCountdownInterval);
                window.jobsCountdownInterval = setInterval(() => {
                    const now = Date.now();
                    const diff = targetTime - now;
                    if(diff <= 0) {
                        document.getElementById('countdownHours').textContent = '00';
                        document.getElementById('countdownMinutes').textContent = '00';
                        document.getElementById('countdownSeconds').textContent = '00';
                        clearInterval(window.jobsCountdownInterval);
                    } else {
                        const h = Math.floor((diff / (1000 * 60 * 60)));
                        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        const s = Math.floor((diff % (1000 * 60)) / 1000);
                        document.getElementById('countdownHours').textContent = h.toString().padStart(2, '0');
                        document.getElementById('countdownMinutes').textContent = m.toString().padStart(2, '0');
                        document.getElementById('countdownSeconds').textContent = s.toString().padStart(2, '0');
                    }
                }, 1000);
            }
            
            // Setup Profile Preview
            let tempEntity = { ...displayEntity };
            const pBanner = document.getElementById('previewBannerImg');
            const pAvatar = document.getElementById('previewAvatarImg');
            const pName = document.getElementById('previewNameTxt');
            const pCat = document.getElementById('previewCatTxt');
            const pBio = document.getElementById('previewBioTxt');
            
            if (pBanner) pBanner.src = tempEntity.banner_url || '';
            if (pAvatar) pAvatar.src = tempEntity.photo_url || window.DEFAULT_AVATAR;
            if (pName) pName.textContent = tempEntity.name || 'Your Name';
            if (pCat) pCat.textContent = tempEntity.category || 'Category';
            if (pBio) pBio.textContent = tempEntity.bio || 'Please write a bio to attract clients...';

            // Bind edit button
            const editBtn = document.getElementById('editPendingAppBtn');
            const editResetWarningModal = document.getElementById('editResetWarningModal');
            const cancelEditWarningBtn = document.getElementById('cancelEditWarningBtn');
            const confirmEditWarningBtn = document.getElementById('confirmEditWarningBtn');

            const enterEditMode = () => {
                jobsStatusContainer.style.display = 'none';
                jobsFormContainer.style.display = 'block';
                if (jobsHeaderSection) jobsHeaderSection.style.display = 'block';
                
                // We need to inject the data back into the form fields
                document.getElementById('submitJobReqBtn').dataset.updateId = pendingApp ? pendingApp.id : '';
                const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
                
                if(tempEntity) {
                    setVal('jobName', tempEntity.name);
                    setVal('jobEmail', tempEntity.email);
                    setVal('jobPhone', tempEntity.phone);
                    setVal('jobCategory', tempEntity.category);
                    setVal('jobStyle', tempEntity.style);
                    setVal('jobPrice', tempEntity.price);
                    setVal('jobMaxPrice', tempEntity.maxPrice);
                    setVal('jobExperience', tempEntity.experience);
                    setVal('jobSkills', tempEntity.skills);
                    setVal('jobTools', tempEntity.tools);
                    setVal('jobBio', tempEntity.bio);
                    setVal('jobPortfolio', tempEntity.portfolio);
                    
                    // Handling files preview manually
                    document.getElementById('jobAvatarUrl').value = tempEntity.photo_url || '';
                    if(tempEntity.photo_url) {
                        document.getElementById('jobAvatarPreview').src = tempEntity.photo_url;
                    }
                    
                    document.getElementById('jobBannerUrl').value = tempEntity.banner_url || '';
                    if(tempEntity.banner_url) {
                        if(document.getElementById('jobBannerPreview')) document.getElementById('jobBannerPreview').src = tempEntity.banner_url;
                    }
                    
                    // Handling videos
                    if(Array.isArray(tempEntity.videoClips)) {
                        setVal('jobVideoClips', tempEntity.videoClips.join(', '));
                    }
                }
                
                if (typeof window.goToWizardStep === 'function') {
                    window.goToWizardStep(1);
                }
            };

            if(editBtn) {
                editBtn.onclick = (e) => {
                    e.preventDefault();
                    if (isAlreadyEditor) {
                        enterEditMode();
                    } else if (editResetWarningModal) {
                        openModal(editResetWarningModal);
                    }
                };
            }

            if (cancelEditWarningBtn) {
                cancelEditWarningBtn.onclick = () => {
                    if (editResetWarningModal) closeModal(editResetWarningModal);
                };
            }

            if (confirmEditWarningBtn) {
                confirmEditWarningBtn.onclick = () => {
                    if (editResetWarningModal) closeModal(editResetWarningModal);
                    enterEditMode();
                };
            }
        }
        if (typeof renderJobDashboard === 'function') renderJobDashboard();
        return;
    } else {
        if(jobsMsg) jobsMsg.innerHTML = `<p class="text-danger">Please <button class="btn btn-sm primary" onclick="window.openUserProfileView()">Complete Profile</button> first. It's required for applying.</p>`;
        // Enable form fields just in case
        ['jobName', 'jobEmail', 'jobPhone', 'jobCategory', 'jobStyle', 'jobPrice', 'jobMaxPrice', 'jobExperience', 'jobSkills', 'jobTools', 'jobBio', 'jobVideoClips', 'jobPortfolio'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.disabled = false;
        });
        const urlEl = document.getElementById('jobBannerUrl');
        if(urlEl) urlEl.disabled = false;
    }

    if(jobsMsg) jobsMsg.classList.add('hidden');
    if(document.getElementById('submitJobReqBtn')) document.getElementById('submitJobReqBtn').disabled = false;
    document.getElementById('jobName').value = up.firstName ? (up.firstName + ' ' + (up.lastName||'').trim()) : '';
    document.getElementById('jobEmail').value = currentUser.email || '';
    document.getElementById('jobPhone').value = up.phone || '';
    
    const defaultPic = up.photoUrl || currentUser.photoURL || window.DEFAULT_AVATAR;
    const avatarPrev = document.getElementById('jobAvatarPreview');
    if(!document.getElementById('jobAvatarUrl').value) {
        avatarPrev.src = defaultPic;
        document.getElementById('jobAvatarUrl').value = defaultPic;
    }
    
    if (typeof renderJobDashboard === 'function') renderJobDashboard();
}


// Fetch Data
async function fetchEditors() {
    if(emptyMain) emptyMain.style.display = 'none';
    
    // Show Skeletons
    const skeletonHTML = Array(8).fill(null).map(() => generateSkeletonHTML()).join('');
    if(mainGrid) mainGrid.innerHTML = skeletonHTML;
    if(trendingGrid) trendingGrid.innerHTML = Array(4).fill(null).map(() => generateSkeletonHTML()).join('');
    
    const goldenGrid = document.getElementById('goldenGrid');
    if(goldenGrid) goldenGrid.innerHTML = Array(4).fill(null).map(() => generateSkeletonHTML()).join('');
    
    const bestGrid = document.getElementById('bestEditorsGrid');
    if(bestGrid) bestGrid.innerHTML = Array(4).fill(null).map(() => generateSkeletonHTML()).join('');

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
        if (typeof renderClientChatsList === 'function' && window.globalClientChatsData) renderClientChatsList(window.globalClientChatsData);
        if (typeof renderJobDashboard === 'function') renderJobDashboard();
        if (typeof updateChatNotifications === 'function') updateChatNotifications(window.globalClientChatsData || {});
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

function generateSkeletonHTML() {
    return `
        <div class="skeleton-card">
            <div class="skeleton-bg skeleton-box"></div>
            <div class="card-content">
                <div class="skeleton-name skeleton-box"></div>
                <div class="skeleton-title skeleton-box"></div>
                <div class="skeleton-reviews skeleton-box"></div>
                
                <div class="skeleton-thumbs">
                    <div class="skeleton-thumb skeleton-box"></div>
                    <div class="skeleton-thumb skeleton-box"></div>
                    <div class="skeleton-thumb skeleton-box"></div>
                </div>
                
                <div class="skeleton-actions">
                    <div class="skeleton-btn skeleton-box"></div>
                    <div class="skeleton-btn skeleton-box"></div>
                </div>
            </div>
        </div>
    `;
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
    
    if (window.renderRecentlyViewed) {
        window.renderRecentlyViewed();
    }
}

const recentlyViewedSection = document.getElementById('recentlyViewedSection');
const recentlyViewedGrid = document.getElementById('recentlyViewedGrid');

window.renderRecentlyViewed = function() {
    if (!recentlyViewedSection || !recentlyViewedGrid) return;
    
    let rv = [];
    try {
        rv = JSON.parse(localStorage.getItem('recentlyViewedEditors') || '[]');
    } catch(e) {}
    
    const rvEditors = [];
    rv.forEach(id => {
        const ed = editors.find(e => e.id === id && !e.deletionScheduledAt);
        if (ed) rvEditors.push(ed);
    });
    
    if (rvEditors.length > 0) {
        recentlyViewedSection.style.display = 'block';
        recentlyViewedGrid.innerHTML = rvEditors.map((ed, i) => generateCardHTML(ed, i)).join('');
    } else {
        recentlyViewedSection.style.display = 'none';
    }
};

function renderHomeFeeds() {
    if(loadingMain) loadingMain.style.display = 'none';
    const ratingInput = document.querySelector('input[name="modalRating"]:checked');
    const typeInput = document.querySelector('input[name="modalType"]:checked');
    const sortInput = document.querySelector('input[name="modalSort"]:checked');
    
    const filterRating = ratingInput ? ratingInput.value : 'All';
    const filterType = typeInput ? typeInput.value : 'All';
    const sortPrice = sortInput ? sortInput.value : 'None';

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
    
    // Use the modal filters
    const ratingInput = document.querySelector('input[name="modalRating"]:checked');
    const typeInput = document.querySelector('input[name="modalType"]:checked');
    const sortInput = document.querySelector('input[name="modalSort"]:checked');
    
    const filterRating = ratingInput ? ratingInput.value : 'All';
    const filterType = typeInput ? typeInput.value : 'All';
    const sortPrice = sortInput ? sortInput.value : 'None';
    
    const minBudgetInput = document.getElementById('modalMinBudget');
    const maxBudgetInput = document.getElementById('modalMaxBudget');
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
if(document.getElementById('searchIconLeft')) document.getElementById('searchIconLeft').addEventListener('click', () => processSearch(false));
if(searchInput) {
    searchInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') processSearch(false);
    });
}
if(document.getElementById('searchBtnResults')) document.getElementById('searchBtnResults').addEventListener('click', () => processSearch(true));
if(document.getElementById('searchIconLeftResults')) document.getElementById('searchIconLeftResults').addEventListener('click', () => processSearch(true));
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

const applyFiltersModalBtn = document.getElementById('applyFiltersModalBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

if (applyFiltersModalBtn) {
    applyFiltersModalBtn.addEventListener('click', () => {
        closeModal(filterModal);
        
        let category = document.querySelector('input[name="modalCategory"]:checked');
        let selectedCat = category ? category.value : 'All';
        
        // Update home and search feeds based on filters
        currentCategory = selectedCat;
        renderHomeFeeds();
        if (document.getElementById('searchResultsView') && document.getElementById('searchResultsView').style.display === 'block') {
            processSearch();
        }
    });
}

if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
        document.querySelector('input[name="modalCategory"][value="All"]').checked = true;
        document.querySelector('input[name="modalSort"][value="None"]').checked = true;
        document.querySelector('input[name="modalRating"][value="All"]').checked = true;
        document.querySelector('input[name="modalType"][value="All"]').checked = true;
        const minBdgt = document.getElementById('modalMinBudget');
        const maxBdgt = document.getElementById('modalMaxBudget');
        if (minBdgt) minBdgt.value = '';
        if (maxBdgt) maxBdgt.value = '';
        
        closeModal(filterModal);
        
        currentCategory = 'All';
        renderHomeFeeds();
        if (document.getElementById('searchResultsView') && document.getElementById('searchResultsView').style.display === 'block') {
            processSearch();
        }
    });
}

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
        let selectedProfileId = card ? card.dataset.id : null;
        
        // If clicking from profile modal, there is no card, but currentProfileId is set
        if (!selectedProfileId && e.target.closest('#editorProfileModal')) {
            selectedProfileId = currentProfileId;
        }

        if (selectedProfileId) {
            currentProfileId = selectedProfileId;
            const ed = editors.find(editor => editor.id === currentProfileId);
            if (!currentUser) {
                openModal(loginPromptModal);
                return;
            }
            if (ed) {
                const chatId = `${ed.id}_${currentUser.uid}`;
                window.switchNavView('messages');
                // Close the profile modal if it's open
                const profileModal = document.getElementById('editorProfileModal');
                if (profileModal && profileModal.style.display !== 'none') {
                    profileModal.style.display = 'none';
                }
                window.openClientSideChat(ed.id, chatId, ed.name);
            }
        }
        return;
    }
    // If they click on "Hire Now", intercept it
    if (e.target.closest('.btn-hire')) {
        e.stopPropagation();
        const card = e.target.closest('.editor-card, .editor-row-card');
        
        // Check if clicking from profile modal
        let selectedProfileId = card ? card.dataset.id : null;
        if (!selectedProfileId && e.target.closest('#editorProfileModal')) {
            selectedProfileId = currentProfileId;
        }
        
        if (selectedProfileId) {
            if (!currentUser) {
                openModal(loginPromptModal);
                return;
            }
            window.currentHireProfileId = selectedProfileId;
            const hireModal = document.getElementById('hireRequestModal');
            if (hireModal) hireModal.style.display = 'flex';
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
    
    // Update recently viewed in localStorage
    try {
        let rv = JSON.parse(localStorage.getItem('recentlyViewedEditors') || '[]');
        rv = rv.filter(x => x !== id);
        rv.unshift(id);
        if(rv.length > 10) rv = rv.slice(0, 10);
        localStorage.setItem('recentlyViewedEditors', JSON.stringify(rv));
        if(typeof renderRecentlyViewed === 'function') renderRecentlyViewed();
    } catch(e) { console.error(e); }
    
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
    
    document.getElementById('epAvatar').src = ed.photo_url || window.DEFAULT_AVATAR;
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
        } else if (userRequest.status === 'contacted' || userRequest.status === 'online') {
            contactBtn.innerHTML = 'Chat with Editor';
            contactBtn.className = 'btn primary w-100 btn-large mt-auto';
            contactBtn.disabled = false;
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

    openModal(profileModal);
}

document.getElementById('closeProfileModal').addEventListener('click', () => { closeModal(profileModal); });
if(document.getElementById('closeProfileBtn')) document.getElementById('closeProfileBtn').addEventListener('click', () => { closeModal(profileModal); });
if(document.getElementById('closeProfileBtnMobile')) document.getElementById('closeProfileBtnMobile').addEventListener('click', () => { closeModal(profileModal); });

const wishlistSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // short pop sound

document.getElementById('toggleWishlistBtn').addEventListener('click', async () => {
    if (!currentUser) {
        openModal(loginPromptModal);
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
        openModal(loginPromptModal);
        return;
    }
    
    // Check if profile is complete
    const up = allUsers[currentUser.uid];
    if (!up || !up.firstName || !up.lastName || !up.phone) {
        closeModal(profileModal);
        window.openUserProfileView();
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
            openModal(document.getElementById('reviewModal'));
        } else if (userRequest.status === 'contacted' || userRequest.status === 'online') {
            closeModal(profileModal);
            window.switchNavView('messages');
            window.openClientSideChat(ed.id, `${ed.id}_${currentUser.uid}`, ed.name || 'Editor', ed.photo_url || window.DEFAULT_AVATAR);
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
        
        // Seed an initial message so the chat history is created instantly
        const chatKey = `${ed.id}_${currentUser.uid}`;
        await push(ref(db, `editor_client_chats/${chatKey}/messages`), {
            senderId: currentUser.uid,
            text: "Hi, I've sent you a hire request! Let's discuss my project.",
            timestamp: Date.now(),
            read: false
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
    closeModal(document.getElementById('reviewModal'));
});

// User Profile Logic
window.populateUserProfileData = function(showMustComplete = false) {
    if (!currentUser) return;
    const up = allUsers[currentUser.uid] || {};
    document.getElementById('upFirstName').value = up.firstName || '';
    document.getElementById('upLastName').value = up.lastName || '';
    document.getElementById('upPhone').value = up.phone || '';
    document.getElementById('upEmail').value = currentUser.email;
    document.getElementById('upAvatarUrl').value = up.photoUrl || '';
    document.getElementById('upAvatarPreview').src = up.photoUrl || currentUser.photoURL || window.DEFAULT_AVATAR;
    
    // Set up Short ID
    if(document.getElementById('userShortId')) {
        document.getElementById('userShortId').textContent = 'ID: ' + currentUser.uid.substring(0, 8).toUpperCase();
    }

    if(profileCompleteMsg) {
        if(showMustComplete) {
            profileCompleteMsg.classList.remove('hidden');
        } else {
            profileCompleteMsg.classList.add('hidden');
        }
    }
    
    // Job Profile Section
    const jobProfileSection = document.getElementById('jobProfileSection');
    if (jobProfileSection) {
        const myEditorProfile = editors.find(e => e.userId === currentUser.uid && !e.deletionScheduledAt);
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
};

window.openUserProfileView = function(showMustComplete = false) {
    if (!currentUser) {
        openModal(loginPromptModal);
        return;
    }
    window.switchNavView('profile');
    window.populateUserProfileData(showMustComplete);
    listenToClientChats();
};

let clientChatsListener = null;
window.globalClientChatsData = {};

function listenToClientChats() {
    if (clientChatsListener || !currentUser) return;
    clientChatsListener = onValue(ref(db, 'editor_client_chats'), (snap) => {
        const data = snap.val() || {};
        window.globalClientChatsData = data;
        renderClientChatsList(data);
        if (typeof renderJobDashboard === 'function') renderJobDashboard();
        updateChatNotifications(data);
    });
}

let globalRequestsListener = null;

function listenToGlobalRequests() {
    if (globalRequestsListener || !currentUser) return;
    globalRequestsListener = onValue(ref(db, 'requests'), (snap) => {
        if (snap.exists()) {
            const rData = snap.val();
            allRequests = Object.keys(rData).map(key => ({ id: key, ...rData[key] }));
        } else {
            allRequests = [];
        }
        if (typeof renderJobDashboard === 'function') renderJobDashboard();
        if (typeof updateChatNotifications === 'function') updateChatNotifications(window.globalClientChatsData || {});
    });
}

function updateChatNotifications(data) {
    if (!currentUser) return;
    let unreadClients = 0;
    let unreadEditors = 0;
    
    const myEditorProfile = editors.find(e => e.userId === currentUser.uid && !e.deletionScheduledAt);
    
    Object.keys(data).forEach(key => {
        const parts = key.split('_');
        if (parts.length !== 2) return;
        const editorId = parts[0];
        const clientId = parts[1];
        
        const msgsObj = data[key].messages || {};
        const msgs = Object.values(msgsObj);
        if (msgs.length === 0) return;
        
        const lastMsg = msgs.sort((a,b) => b.timestamp - a.timestamp)[0];
        // If I am the client and the last message is from the editor (or admin)
        if (clientId === currentUser.uid && lastMsg.senderId !== currentUser.uid && !lastMsg.read) {
            unreadEditors++;
        }
        
        // If I am the editor and the last message is from the client (or admin)
        if (myEditorProfile && editorId === myEditorProfile.id && lastMsg.senderId !== currentUser.uid && !lastMsg.read) {
            unreadClients++;
        }
    });
    
    const totalUnread = unreadClients + unreadEditors;
    
    let pendingRequestsForMe = 0;
    if (myEditorProfile) {
        pendingRequestsForMe = allRequests.filter(r => r.editorId === myEditorProfile.id && r.status === 'pending').length;
    }
    const jobsBadgeCount = unreadClients + pendingRequestsForMe;
    
    const updateBadge = (id, count) => {
        const badge = document.getElementById(id);
        if (badge) {
            if (count > 0) {
                badge.style.display = 'flex';
                badge.textContent = count;
            } else {
                badge.style.display = 'none';
            }
        }
    };
    
    updateBadge('bottomNavProfileBadge', 0); // Clear any old profile badge if still around
    updateBadge('bottomNavMessagesBadge', totalUnread);
    updateBadge('bottomNavJobsBadge', jobsBadgeCount);
}

let lastRenderedChats = [];

document.addEventListener('DOMContentLoaded', () => {
    const chatSearchInput = document.getElementById('chatSearchInput');
    if (chatSearchInput) {
        chatSearchInput.addEventListener('input', () => {
            renderChatsToDOM();
        });
    }
});

function renderClientChatsList(data) {
    const list = document.getElementById('clientChatsList');
    if (!list) return;
    
    if (!currentUser) return;
    window.globalClientChatsData = data;
    
    // filter chats involving currentUser.uid (either as client or editor)
    const myEditorProfile = editors.find(e => e.userId === currentUser.uid && !e.deletionScheduledAt);
    const myChats = [];
    Object.keys(data).forEach(key => {
        const parts = key.split('_');
        const isClient = (parts.length === 2 && parts[1] === currentUser.uid);
        const isEditor = (parts.length === 2 && myEditorProfile && parts[0] === myEditorProfile.id);
        
        if (isClient || isEditor) {
            const otherPartyId = isClient ? parts[0] : parts[1];
            
            const msgsObj = data[key].messages || {};
            const msgs = Object.values(msgsObj);
            
            let name = 'Unknown User';
            let photo_url = window.DEFAULT_AVATAR;
            
            let otherPartyUid = otherPartyId;
            if (isClient) {
                // Find Editor
                const ed = typeof editors !== 'undefined' ? editors.find(e => e.id === otherPartyId) : null;
                if (ed) {
                    name = ed.name || 'Editor';
                    photo_url = ed.photo_url || window.DEFAULT_AVATAR;
                    otherPartyUid = ed.userId || otherPartyId;
                }
            } else {
                // Find Client
                const cUser = typeof allUsers !== 'undefined' ? allUsers[otherPartyId] : null;
                if (cUser) {
                    name = (cUser.firstName || '') + ' ' + (cUser.lastName || '');
                    if (!name.trim()) name = cUser.name || cUser.email || 'Client';
                    photo_url = cUser.photoUrl || window.DEFAULT_AVATAR;
                }
            }
            
            if (msgs.length > 0) {
                const lastMsg = msgs.sort((a,b) => b.timestamp - a.timestamp)[0];
                myChats.push({
                    chatId: key,
                    otherPartyId: otherPartyId,
                    otherPartyUid: otherPartyUid,
                    isClient: isClient,
                    name: name,
                    photo_url: photo_url,
                    lastMsg: lastMsg,
                    timestamp: lastMsg.timestamp
                });
            }
        }
    });
    
    lastRenderedChats = myChats;
    renderChatsToDOM();
}

function renderChatsToDOM() {
    const list = document.getElementById('clientChatsList');
    if (!list) return;
    const searchInput = document.getElementById('chatSearchInput');
    const filterText = (searchInput ? searchInput.value.toLowerCase() : '');

    let filtered = lastRenderedChats.filter(chat => chat.name.toLowerCase().includes(filterText));

    if (filtered.length === 0) {
        if (lastRenderedChats.length === 0) {
            list.innerHTML = '<div class="glass-card p-4 text-center text-secondary">No conversations yet.</div>';
        } else {
            list.innerHTML = '<div class="glass-card p-4 text-center text-secondary">No chats found for your search.</div>';
        }
        return;
    }
    
    // Get favorites from user profile
    const userProfile = (allUsers && currentUser && allUsers[currentUser.uid]) ? allUsers[currentUser.uid] : {};
    const favChats = userProfile.favoriteChats || [];
    
    filtered.sort((a, b) => {
        const aFav = favChats.includes(a.chatId);
        const bFav = favChats.includes(b.chatId);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return b.timestamp - a.timestamp;
    });
    
    list.innerHTML = '';
    filtered.forEach(chat => {
        const isFav = favChats.includes(chat.chatId);
        
        const otherStatus = allStatuses && allStatuses[chat.otherPartyUid] ? allStatuses[chat.otherPartyUid] : {state: 'offline'};
        const isOnline = otherStatus.state === 'online';
        
        let lastSeenText = '';
        if (isOnline) {
            lastSeenText = '<span style="color:#25d366; font-size: 0.8em; margin-left:8px;">Online</span>';
        } else if (otherStatus.last_changed) {
            const minAgo = Math.floor((Date.now() - otherStatus.last_changed) / 60000);
            if (minAgo < 1) lastSeenText = '<span style="color:var(--text-secondary); font-size: 0.8em; margin-left:8px;">Just now</span>';
            else if (minAgo < 60) lastSeenText = `<span style="color:var(--text-secondary); font-size: 0.8em; margin-left:8px;">${minAgo}m ago</span>`;
            else if (minAgo < 1440) lastSeenText = `<span style="color:var(--text-secondary); font-size: 0.8em; margin-left:8px;">${Math.floor(minAgo/60)}h ago</span>`;
            else lastSeenText = `<span style="color:var(--text-secondary); font-size: 0.8em; margin-left:8px;">${Math.floor(minAgo/1440)}d ago</span>`;
        }

        const div = document.createElement('div');
        div.className = 'glass-card p-3';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'space-between';
        div.style.cursor = 'pointer';
        div.style.transition = 'all 0.2s';
        
        let msgText = chat.lastMsg.text || '';
        if (msgText.length > 40) msgText = msgText.substring(0, 40) + '...';
        
        const isUnread = chat.lastMsg.senderId !== currentUser.uid && !chat.lastMsg.read;
        const unreadDot = isUnread ? `<span style="display:inline-block; width:10px; height:10px; background:#25d366; border-radius:50%; margin-left:8px; box-shadow: 0 0 5px #25d366;" class="bounce-anim"></span>` : '';
        
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; flex: 1; overflow: hidden;">
                <div style="position:relative; flex-shrink:0;">
                    <img src="${chat.photo_url || window.DEFAULT_AVATAR}" onclick="event.stopPropagation(); window.openImageViewer(this.src)" style="width:52px; height:52px; border-radius:50%; object-fit:cover; border: 2px solid rgba(255,255,255,0.1); cursor:pointer;">
                    ${isOnline ? '<div style="position:absolute; bottom:2px; right:2px; width:12px; height:12px; background:#25d366; border-radius:50%; border:2px solid var(--bg-color);"></div>' : ''}
                </div>
                <div style="min-width: 0; flex: 1;">
                    <h4 style="margin:0 0 6px; display:flex; align-items:center; justify-content:space-between; gap:6px; white-space: nowrap;">
                        <span style="overflow: hidden; text-overflow: ellipsis; flex: 1; font-size: 1.05rem; display:flex; align-items:center;">
                            ${chat.name} ${!chat.isClient ? '<span style="font-size:0.7em; background:rgba(59,130,246,0.2); color:#60a5fa; padding:2px 6px; border-radius:10px; margin-left:6px; vertical-align:middle;">Client</span>' : ''}${unreadDot}
                        </span>
                        <span class="text-xs text-secondary" style="flex-shrink: 0; display:flex; flex-direction:column; align-items:flex-end;">
                            <span>${new Date(chat.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            ${lastSeenText}
                        </span>
                    </h4>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <p style="margin:0; font-size:0.9rem; color:var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex:1;">
                            ${chat.lastMsg.senderId === currentUser.uid ? '<span style="color:#60a5fa">You:</span> ' : ''}${msgText}
                        </p>
                        ${isFav ? '<span style="color: gold; font-size: 14px; flex-shrink: 0; margin-left: 10px;">⭐</span>' : ''}
                    </div>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap: 8px; flex-shrink: 0; padding-left: 15px; border-left: 1px solid rgba(255,255,255,0.05); margin-left: 10px;">
                <button class="btn btn-sm secondary favorite-chat-btn hover-pop" data-id="${chat.chatId}" style="padding:4px 8px; font-size: 14px; background: transparent; border: none; box-shadow: none;" title="${isFav ? 'Unfavorite' : 'Favorite'}">
                    ${isFav ? '⭐' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'}
                </button>
                <button class="btn btn-sm danger delete-chat-btn hover-pop" data-id="${chat.chatId}" style="padding:4px 8px; background: transparent; border: none; color: #ef4444; box-shadow: none;" title="Delete Chat">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        
        div.addEventListener('click', () => {
            window.openClientSideChat(chat.otherPartyId, chat.chatId, chat.name, chat.photo_url);
        });
        
        const favBtn = div.querySelector('.favorite-chat-btn');
        favBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            let newFavs = [...favChats];
            if (isFav) {
                newFavs = newFavs.filter(id => id !== chat.chatId);
            } else {
                newFavs.push(chat.chatId);
            }
            try {
                await update(ref(db, `users/${currentUser.uid}`), { favoriteChats: newFavs });
                if(allUsers[currentUser.uid]) allUsers[currentUser.uid].favoriteChats = newFavs;
                renderChatsToDOM(); // Re-render DOM
            } catch(err) {
                console.error(err);
            }
        });
        
        const delBtn = div.querySelector('.delete-chat-btn');
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(!confirm("Are you sure you want to delete this chat?")) return;
            try {
                await remove(ref(db, `editor_client_chats/${chat.chatId}`));
            } catch(err) {
                console.error(err);
            }
        });
        
        list.appendChild(div);
    });
}


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
    if (!list || !currentUser) return;
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
        
        // Show success alert
        alert('Profile saved successfully!');
        window.populateUserProfileData();
        
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
            const userPhoto = reqUser.photoUrl || window.DEFAULT_AVATAR;

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
    
    openModal(document.getElementById('adminRequestsModal'));
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
        closeModal(document.getElementById('adminRequestsModal'));
        renderAdminList();
        alert('Request updated.');
        // No auto-re-open here, simplistic
    } catch(err) {
        console.error(err);
        alert('Failed to update request.');
    }
};

document.getElementById('closeAdminRequestsModal').addEventListener('click', () => {
    closeModal(document.getElementById('adminRequestsModal'));
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
        
        closeModal(document.getElementById('reviewModal'));
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

document.getElementById('closeContactModal')?.addEventListener('click', () => { if(contactModal) closeModal(contactModal); });
document.getElementById('closeLoginPrompt')?.addEventListener('click', () => { if(loginPromptModal) closeModal(loginPromptModal); });

const hireRequestModal = document.getElementById('hireRequestModal');
document.getElementById('closeHireRequestModal')?.addEventListener('click', () => { if(hireRequestModal) closeModal(hireRequestModal); });
document.getElementById('cancelHireRequest')?.addEventListener('click', () => { if(hireRequestModal) closeModal(hireRequestModal); });

const confirmHireRequest = document.getElementById('confirmHireRequest');
if (confirmHireRequest) {
    confirmHireRequest.addEventListener('click', async () => {
        if (!currentUser || !window.currentHireProfileId) return;
        
        try {
            confirmHireRequest.disabled = true;
            confirmHireRequest.textContent = 'Sending...';
            
            const reqRef = push(ref(db, "requests"));
            await set(reqRef, {
                editorId: window.currentHireProfileId,
                userId: currentUser.uid,
                userEmail: currentUser.email || 'No email',
                status: 'pending',
                timestamp: Date.now()
            });
            
            // Seed an initial message so the chat history is created instantly
            const chatKey = `${window.currentHireProfileId}_${currentUser.uid}`;
            await push(ref(db, `editor_client_chats/${chatKey}/messages`), {
                senderId: currentUser.uid,
                text: "Hi, I have sent you a project request! Let's discuss.",
                timestamp: Date.now(),
                read: false
            });
            
            // Notification to editor
            const notifRef = push(ref(db, "notifications/" + window.currentHireProfileId));
            await set(notifRef, {
                title: "New Job Request!",
                message: `You have received a new project request from ${currentUser.email || 'a client'}.`,
                type: "request",
                timestamp: Date.now(),
                read: false
            });
            
            closeModal(hireRequestModal);
            alert("Request sent successfully! The editor will review it soon.");
            
            // Re-render editor profile if it's open, to update the button state
            if(document.getElementById('editorProfileModal').style.display === 'flex') {
                openEditorProfile(window.currentHireProfileId);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to send request.');
        } finally {
            confirmHireRequest.disabled = false;
            confirmHireRequest.textContent = 'Send Request';
        }
    });
}

// 3D Hover Effect
document.addEventListener('mousemove', (e) => {
    if(!userSettings.animations || userSettings.lowEnd) return;
    if(typeof isAnimatingTab !== 'undefined' && isAnimatingTab) return;
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
    openModal(settingsModal);
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
        openModal(settingsModal); 
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

if(closeSettings) closeSettings.addEventListener('click', () => { closeModal(settingsModal); });

const adminPanelReentryBtn = document.getElementById('adminPanelReentryBtn');
const adminPanelReentryBtnProfile = document.getElementById('adminPanelReentryBtnProfile');

function enterAdminPanel() {
    closeModal(settingsModal);
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
    userSettings.sounds = document.getElementById('prefSounds').checked;
    userSettings.hideOnline = document.getElementById('prefHideOnline').checked;
    
    localStorage.setItem('lumina_settings', JSON.stringify(userSettings));
    applySettings();
    updateOnlineStatus(true); // Manually trigger status update
    closeModal(settingsModal);
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
        closeModal(settingsModal);
        openModal(adminPinModal);
    }
    clearTimeout(adminClickTimer);
    adminClickTimer = setTimeout(() => { adminClickCount = 0; }, 2000);
});

if(document.getElementById('closeAdminPin')) document.getElementById('closeAdminPin').addEventListener('click', () => { closeModal(adminPinModal); });
if(document.getElementById('verifyPinBtn')) document.getElementById('verifyPinBtn').addEventListener('click', () => {
    const pin = document.getElementById('adminPinInput').value;
    const pinErr = document.getElementById('adminPinError');
    if (pin === 'admin123') { // Hidden password
        closeModal(adminPinModal);
        document.getElementById('adminPinInput').value = '';
        if(pinErr) pinErr.classList.add('hidden');
        openAdminPanel();
    } else {
        if(pinErr) pinErr.classList.remove('hidden');
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
    if (typeof setupAdminInterceptListener === 'function') setupAdminInterceptListener();
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
            <td><img src="${ed.photo_url || window.DEFAULT_AVATAR}" class="table-img"></td>
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
    const updatesTbody = document.getElementById('adminUpdateAppsList');
    if(appsTbody && updatesTbody) {
        appsTbody.innerHTML = '';
        updatesTbody.innerHTML = '';
        
        const pendingApps = allApplications.filter(a => a.status === 'pending').sort((a, b) => {
            const timeA = a.timestamp || Date.now();
            const timeB = b.timestamp || Date.now();
            return timeA - timeB; // Oldest first
        });
        
        const newApps = [];
        const updateApps = [];
        
        pendingApps.forEach(app => {
            if (editors.some(e => e.userId === app.userId)) {
                updateApps.push(app);
            } else {
                newApps.push(app);
            }
        });

        const renderAppRow = (app) => {
            const tr = document.createElement('tr');
            
            // Calculate time left (48 hours from timestamp)
            const applicationTime = app.timestamp || Date.now();
            const targetTime = applicationTime + (48 * 60 * 60 * 1000);
            const diff = targetTime - Date.now();
            let timeLeftHtml = '';
            if (diff <= 0) {
                timeLeftHtml = `<span class="text-danger" style="font-weight: 600;">Overdue</span>`;
            } else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                timeLeftHtml = `<span class="${h < 12 ? 'text-danger' : (h < 24 ? 'text-warning' : 'text-success')}">${h}h ${m}m</span>`;
            }

            tr.innerHTML = `
                <td><img src="${app.photo_url || window.DEFAULT_AVATAR}" class="table-img"></td>
                <td><strong>${app.name}</strong><br><span class="text-xs text-secondary">${app.email}</span><br><span class="text-xs text-secondary">${app.phone || 'No phone'}</span></td>
                <td><span class="category-tag">${app.category}</span></td>
                <td>${timeLeftHtml}</td>
                <td>${new Date(app.timestamp).toLocaleDateString()}</td>
                <td style="display: flex; gap: 5px;">
                    <button class="btn btn-sm" style="background:#3b82f6;color:white;" onclick="window.viewEditJobApp('${app.id}')">View/Edit</button>
                    <button class="btn success btn-sm" onclick="window.approveJobApp('${app.id}')">Approve</button>
                    <button class="btn danger btn-sm" onclick="window.rejectJobApp('${app.id}')">Reject</button>
                </td>
            `;
            return tr;
        };
        
        if(newApps.length === 0) {
            appsTbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary text-sm">No new applications.</td></tr>';
        } else {
            newApps.forEach(app => appsTbody.appendChild(renderAppRow(app)));
        }

        if(updateApps.length === 0) {
            updatesTbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary text-sm">No profile update requests.</td></tr>';
        } else {
            updateApps.forEach(app => updatesTbody.appendChild(renderAppRow(app)));
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
                        <img src="${ed.photo_url || window.DEFAULT_AVATAR}" class="table-img">
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
                    <td><img src="${u.photoUrl || window.DEFAULT_AVATAR}" class="table-img"></td>
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
    document.getElementById('adminUpAvatar').src = u.photoUrl || window.DEFAULT_AVATAR;
    document.getElementById('adminUpName').textContent = u.firstName ? (u.firstName + ' ' + (u.lastName || '')).trim() : 'Anonymous User';
    document.getElementById('adminUpEmail').textContent = u.email || 'No email';
    document.getElementById('adminUpPhone').textContent = u.phone || 'No phone';
    document.getElementById('adminUpId').textContent = 'UID: ' + uid + ' (Short: ' + uid.substring(0,8).toUpperCase() + ')';
    openModal(document.getElementById('adminUserProfileModal'));
};

if (document.getElementById('closeAdminUserProfile')) {
    document.getElementById('closeAdminUserProfile').addEventListener('click', () => {
        closeModal(document.getElementById('adminUserProfileModal'));
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
    const app = allApplications.find(a => a.id === appId);
    if(!app) return;
    
    // Check if this is an update request
    const existingEditor = editors.find(e => e.userId === app.userId);
    const isUpdate = !!existingEditor;
    
    const confirmMsg = isUpdate ? "Approve this profile update?" : "Approve this application and add them as an editor?";
    if(!confirm(confirmMsg)) return;

    try {
        const editorData = {
            userId: app.userId || '',
            name: app.name,
            email: app.email,
            phone: app.phone,
            category: app.category,
            style: app.style || '',
            price: app.price,
            maxPrice: app.maxPrice || null,
            experience: app.experience,
            skills: app.skills,
            tools: app.tools || '',
            bio: app.bio,
            video_clips: (app.videoLinks && Array.isArray(app.videoLinks)) ? app.videoLinks.join(', ') : (app.videoLinks || ''),
            photo_url: app.photo_url,
            banner_url: app.banner_url,
            portfolio: app.portfolio || '',
            isVerified: true
        };

        if (isUpdate) {
            // Update existing live profile
            await update(ref(db, "editors/" + existingEditor.id), editorData);
            
            // Update local state
            Object.assign(existingEditor, editorData);
        } else {
            // Create new profile
            const editorRef = push(ref(db, "editors"));
            const newEditorData = {
                ...editorData,
                availability: 'Available',
                projects: 0,
                views: 0,
                verificationType: 'blue',
                isFeatured: false,
                createdAt: Date.now()
            };
            await set(editorRef, newEditorData);
            editors.push({id: editorRef.key, ...newEditorData});
        }

        // Mark application as approved
        await set(ref(db, "editor_applications/" + appId + "/status"), 'approved');
        
        // Locally update to re-render without reloading
        if(app) app.status = 'approved';
        
        renderAdminList();
        renderTrending();
        refreshCurrentFeeds();
        alert(isUpdate ? 'Profile update approved!' : 'Editor approved and added to platform!');
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
    openModal(editorFormModal);
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

if(document.getElementById('closeEditorForm')) document.getElementById('closeEditorForm').addEventListener('click', () => { closeModal(editorFormModal); });
if(document.getElementById('closeEditorFormBtn')) document.getElementById('closeEditorFormBtn').addEventListener('click', () => { closeModal(editorFormModal); });

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
    
    openModal(editorFormModal);
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
    
    openModal(editorFormModal);
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

    openModal(document.getElementById('featuredManagerModal'));
};

if (document.getElementById('assignFeaturedBtn')) {
    document.getElementById('assignFeaturedBtn').addEventListener('click', () => window.manageFeaturedEditor());
}
if (document.getElementById('closeFeaturedManager')) {
    document.getElementById('closeFeaturedManager').addEventListener('click', () => closeModal(document.getElementById('featuredManagerModal')));
}
if (document.getElementById('cancelFeaturedManager')) {
    document.getElementById('cancelFeaturedManager').addEventListener('click', (e) => { e.preventDefault(); closeModal(document.getElementById('featuredManagerModal')); });
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
            closeModal(document.getElementById('featuredManagerModal'));
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
                closeModal(document.getElementById('featuredManagerModal'));
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
        closeModal(editorFormModal);
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

function playSuccessSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1); 
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2); 
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
}

if(submitJobReqBtn) {
    submitJobReqBtn.addEventListener('click', async () => {
        if(!currentUser) return;
        
        // Final step validation
        window.goToWizardStep(5, 4); // Attempt to proceed from 4 to trigger validation
        const avatarUrl = document.getElementById('jobAvatarUrl').value;
        const bannerUrl = document.getElementById('jobBannerUrl').value;
        if (!avatarUrl || !bannerUrl) return; // Blocked by validation
        
        const name = document.getElementById('jobName').value;
        const email = document.getElementById('jobEmail').value;
        const countryCode = document.getElementById('countryCode') ? document.getElementById('countryCode').value : '';
        const phoneInput = document.getElementById('jobPhone').value;
        const phone = countryCode ? `${countryCode} ${phoneInput}` : phoneInput;
        
        const category = document.getElementById('jobCategory').value;
        const style = document.getElementById('jobStyle') ? document.getElementById('jobStyle').value : '';
        const price = document.getElementById('jobPrice').value;
        const maxPrice = document.getElementById('jobMaxPrice') ? document.getElementById('jobMaxPrice').value : '';
        const experience = document.getElementById('jobExperience').value;
        const skills = document.getElementById('jobSkills').value;
        const tools = document.getElementById('jobTools').value;
        const bio = document.getElementById('jobBio').value;
        const videoClipsStr = document.getElementById('jobVideoClips').value;
        const portfolio = document.getElementById('jobPortfolio').value;

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
                
                // Show Success Overlay
                const successOverlay = document.getElementById('successProfileModal');
                if (successOverlay) {
                    successOverlay.querySelector('h2').textContent = 'Profile Updated!';
                    openModal(successOverlay);
                    playSuccessSound();
                    
                    await new Promise(r => setTimeout(r, 2000));
                    successOverlay.style.display = 'none';
                    
                    populateJobFormFromProfile();
                } else {
                    alert('Application updated successfully! Resubmitted for review.');
                }
                
                delete submitJobReqBtn.dataset.updateId;
            } else {
                const reqRef = push(ref(db, "editor_applications"));
                const newPayload = {
                    ...reqPayload,
                    status: 'pending',
                    timestamp: Date.now()
                };
                await set(reqRef, newPayload);
                allApplications.push({ id: reqRef.key, ...newPayload });
                
                // Show Success Overlay
                const successOverlay = document.getElementById('successProfileModal');
                if (successOverlay) {
                    successOverlay.querySelector('h2').textContent = 'Profile Created!';
                    openModal(successOverlay);
                    playSuccessSound();
                    
                    // Wait 2.5 seconds, then hide and show profile
                    await new Promise(r => setTimeout(r, 2500));
                    successOverlay.style.display = 'none';
                    
                    populateJobFormFromProfile();
                    window.scrollTo({top: 0, behavior: 'smooth'});
                } else {
                    alert('Application submitted successfully! Our team will review your profile.');
                }
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

            // We do NOT return to home view here because we want to see the application status!
            // window.switchNavView('home');
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

// Attachment Handling
let eccAttachmentFile = null;
const eccAttachBtn = document.getElementById('eccAttachBtn');
const eccAttachInput = document.getElementById('eccAttachInput');
const eccAttachmentPreview = document.getElementById('eccAttachmentPreview');
const eccAttachedImage = document.getElementById('eccAttachedImage');
const eccRemoveAttachmentBtn = document.getElementById('eccRemoveAttachmentBtn');

if(eccAttachBtn && eccAttachInput) {
    eccAttachBtn.addEventListener('click', () => eccAttachInput.click());
    eccAttachInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        if(!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        eccAttachmentFile = file;
        eccAttachedImage.src = URL.createObjectURL(file);
        eccAttachmentPreview.style.display = 'block';
    });
}
if(eccRemoveAttachmentBtn) {
    eccRemoveAttachmentBtn.addEventListener('click', () => {
        eccAttachmentFile = null;
        eccAttachInput.value = '';
        eccAttachmentPreview.style.display = 'none';
        eccAttachedImage.src = '';
    });
}

function openAnimatedModal(modal) {
    if(!modal) return;
    document.body.style.overflow = 'hidden';
    
    window.activeModalsStack.push({ type: 'animated', modal: modal });
    history.pushState({ modalOpen: true }, "");

    modal.style.display = 'flex';
    setTimeout(() => {
        modal.style.transform = 'translateX(0)';
    }, 10);
}

function closeAnimatedModal(modal, callback) {
    if(!modal) return;
    
    const idx = window.activeModalsStack.findIndex(m => m.modal === modal);
    if(idx > -1) {
        window.activeModalsStack.splice(idx, 1);
        window._isClosingFromCode = true;
        history.back();
    }
    
    document.body.style.overflow = window.activeModalsStack.length > 0 ? 'hidden' : '';
    modal.style.transform = 'translateX(100%)';
    setTimeout(() => {
        modal.style.display = 'none';
        if (callback) callback();
    }, 300);
}

if (contactInApp) {
    contactInApp.addEventListener('click', () => {
        if (!currentUser) {
            openModal(loginPromptModal);
            return;
        }
        if (!currentProfileId) return;
        document.getElementById('contactModal').style.display = 'none';
        
        openAnimatedModal(editorClientChatModal);
        window.isInterceptingChat = false;
        
        currentEccPath = `editor_client_chats/${currentProfileId}_${currentUser.uid}/messages`;
        
        const ed = editors.find(e => e.id === currentProfileId);
        let onlineText = '<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">Offline</span>';
        if (ed && ed.userId) {
            const st = allStatuses[ed.userId] || {};
            if (st.state === 'online') {
                onlineText = '<span style="font-size:0.75rem; color:var(--success); font-weight:normal;">Online</span>';
            } else if (st.last_changed) {
                const minAgo = Math.floor((Date.now() - st.last_changed) / 60000);
                if (minAgo < 1) onlineText = '<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">Last seen: Just now</span>';
                else if (minAgo < 60) onlineText = `<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">Last seen: ${minAgo}m ago</span>`;
                else if (minAgo < 1440) onlineText = `<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">Last seen: ${Math.floor(minAgo/60)}h ago</span>`;
                else onlineText = `<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">Last seen: ${Math.floor(minAgo/1440)}d ago</span>`;
            }
        }
        
        document.getElementById('eccUserName').innerHTML = `
            <img src="${ed ? ed.photo_url || window.DEFAULT_AVATAR : window.DEFAULT_AVATAR}" onclick="event.stopPropagation(); window.openImageViewer(this.src)" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.1);cursor:pointer;">
            <div style="display:flex; flex-direction:column; line-height:1.2;">
                <span>${ed ? ed.name : 'Editor'}</span>
                ${onlineText}
            </div>
        `;
        
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
        closeAnimatedModal(editorClientChatModal, () => {
            window.isInterceptingChat = false;
            if (eccListener) {
                eccListener();
                eccListener = null;
            }
        });
    });
}

window.openImageViewer = function(url) {
    const modal = document.getElementById('imageViewerModal');
    const img = document.getElementById('imageViewerImg');
    if (modal && img) {
        window.activeModalsStack.push({ type: 'imageViewer', modal: modal });
        history.pushState({ modalOpen: true }, "");

        img.src = url;
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
};

const closeImageViewer = document.getElementById('closeImageViewer');
if (closeImageViewer) {
    const closeViewer = () => {
        const modal = document.getElementById('imageViewerModal');
        if (modal) {
            const idx = window.activeModalsStack.findIndex(m => m.modal === modal);
            if(idx > -1) {
                window.activeModalsStack.splice(idx, 1);
                window._isClosingFromCode = true;
                history.back();
            }

            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    };

    closeImageViewer.addEventListener('click', closeViewer);
    
    const imageViewerModal = document.getElementById('imageViewerModal');
    if (imageViewerModal) {
        imageViewerModal.addEventListener('click', (e) => {
            if (e.target === imageViewerModal) {
                closeViewer();
            }
        });
    }
}

window.openClientSideChat = (otherId, chatId, otherName, otherPhotoUrl) => {
    openAnimatedModal(editorClientChatModal);
    window.isInterceptingChat = false;
    currentEccPath = `editor_client_chats/${chatId}/messages`;
    
    // Attempt fallback lookup if photoUrl not provided
    let photoUrl = otherPhotoUrl;
    let otherUid = otherId;
    if (!otherPhotoUrl) {
        const ed = editors.find(e => e.id === otherId);
        const cUser = allUsers[otherId];
        if (ed && ed.photo_url) { photoUrl = ed.photo_url; otherUid = ed.userId; }
        else if (cUser && cUser.photoUrl) { photoUrl = cUser.photoUrl; otherUid = otherId; }
        else photoUrl = window.DEFAULT_AVATAR;
    } else {
        // Find if they are an editor
        const ed = editors.find(e => e.id === otherId);
        if (ed) otherUid = ed.userId;
    }
    
    let onlineText = '<div style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal; line-height:1;">Offline</div>';
    const st = allStatuses[otherUid] || {};
    if (st.state === 'online') {
        onlineText = '<div style="font-size:0.75rem; color:var(--success); font-weight:normal; line-height:1;">Online</div>';
    } else if (st.last_changed) {
        const minAgo = Math.floor((Date.now() - st.last_changed) / 60000);
        if (minAgo < 1) onlineText = '<div style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal; line-height:1;">Last seen: Just now</div>';
        else if (minAgo < 60) onlineText = `<div style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal; line-height:1;">Last seen: ${minAgo}m ago</div>`;
        else if (minAgo < 1440) onlineText = `<div style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal; line-height:1;">Last seen: ${Math.floor(minAgo/60)}h ago</div>`;
        else onlineText = `<div style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal; line-height:1;">Last seen: ${Math.floor(minAgo/1440)}d ago</div>`;
    }
    
    document.getElementById('eccUserName').innerHTML = `
        <div style="display:flex; align-items:center; gap: 8px;">
            <img src="${photoUrl}" onclick="event.stopPropagation(); window.openImageViewer(this.src)" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;">
            <div style="display:flex; flex-direction:column;">
                <div style="font-size: 1.1rem; font-weight: bold; line-height:1.2;">${otherName}</div>
                ${onlineText}
            </div>
        </div>
    `;
    
    if (eccListener) eccListener();
    eccListener = onValue(ref(db, currentEccPath), (snap) => {
        const data = snap.val() || {};
        const messages = Object.keys(data).map(k => ({id: k, ...data[k]})).sort((a,b) => a.timestamp - b.timestamp);
        renderEccChat(messages);
    });
};

if (sendEccMsgBtn && eccChatInput) {
    const sendEccMsg = async () => {
        const text = eccChatInput.value.trim();
        const fileToUpload = eccAttachmentFile; // Capture any attached file
        
        if ((!text && !fileToUpload) || !currentEccPath || (!currentUser && !window.isInterceptingChat)) return;
        
        eccChatInput.value = '';
        if(eccRemoveAttachmentBtn) eccRemoveAttachmentBtn.click(); // Clear preview immediately
        
        try {
            const payload = {
                senderId: window.isInterceptingChat ? 'admin' : currentUser.uid,
                text: text,
                timestamp: Date.now(),
                read: false
            };
            if (window.isInterceptingChat) {
                payload.isAdmin = true;
            }
            
            if (fileToUpload) {
                // Convert to Base64 using Canvas to compress and avoid Firebase Storage
                const base64Url = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            const MAX_DIMENSION = 800; // max size to keep DB clean
                            
                            if (width > height) {
                                if (width > MAX_DIMENSION) {
                                    height *= MAX_DIMENSION / width;
                                    width = MAX_DIMENSION;
                                }
                            } else {
                                if (height > MAX_DIMENSION) {
                                    width *= MAX_DIMENSION / height;
                                    height = MAX_DIMENSION;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            // compress to 0.6 quality JPEG
                            resolve(canvas.toDataURL('image/jpeg', 0.6));
                        };
                        img.onerror = reject;
                        img.src = e.target.result;
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(fileToUpload);
                });
                
                payload.imageUrl = base64Url;
            }
            
            await push(ref(db, currentEccPath), payload);
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
    
    // Mark messages from the other person as read
    if (currentUser && !window.isInterceptingChat && currentEccPath) {
        messages.forEach(msg => {
            if (msg.senderId !== currentUser.uid && !msg.read) {
                // Update in DB
                update(ref(db, `${currentEccPath}/${msg.id}`), { read: true });
            }
        });
    }

    eccChatContainer.innerHTML = '';
    
    if (messages.length === 0) {
        eccChatContainer.innerHTML = '<div class="text-center text-secondary mt-3">Start the conversation...</div>';
        return;
    }
    
    messages.forEach(msg => {
        const isAdminMsg = msg.isAdmin || msg.senderId === 'admin';
        const isMe = window.isInterceptingChat ? isAdminMsg : (msg.senderId === currentUser?.uid);
        
        const div = document.createElement('div');
        div.style.maxWidth = '85%';
        div.style.padding = '10px 15px';
        div.style.borderRadius = '12px';
        div.style.marginBottom = '5px';
        div.style.wordBreak = 'break-word';
        div.style.position = 'relative';
        
        if (isAdminMsg) {
            div.style.background = 'linear-gradient(135deg, #d4af37, #f3e5ab)';
            div.style.color = '#000';
            div.style.alignSelf = isMe ? 'flex-end' : 'flex-start';
            div.style.border = '1px solid #ffdf00';
            div.style.boxShadow = '0 0 10px rgba(212, 175, 55, 0.4)';
        } else if (isMe) {
            div.style.alignSelf = 'flex-end';
            div.style.background = 'var(--primary)';
            div.style.color = 'white';
        } else {
            div.style.alignSelf = 'flex-start';
            div.style.background = 'rgba(255,255,255,0.1)';
            div.style.color = 'white';
        }
        
        let mediaHtml = '';
        if (msg.imageUrl) {
            mediaHtml = `<img src="${msg.imageUrl}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: ${msg.text ? '8px' : '0'}; cursor: pointer; object-fit: contain;" onclick="window.openImageViewer(this.src)">`;
        }

        div.innerHTML = `
            ${isAdminMsg && !isMe ? '<div style="font-size: 0.7rem; font-weight: bold; margin-bottom: 4px; color: #b8860b;">🛡️ Support Admin (Verified)</div>' : ''}
            ${isAdminMsg && isMe ? '<div style="font-size: 0.7rem; font-weight: bold; margin-bottom: 4px; color: #b8860b;">🛡️ Sent as Admin</div>' : ''}
            ${mediaHtml}
            ${msg.text ? `<div style="font-size:0.95rem; font-weight: ${isAdminMsg ? '500' : 'normal'};">${msg.text.replace(/\n/g, '<br>')}</div>` : ''}
            <div style="font-size:0.7rem; color: ${isAdminMsg ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)'}; margin-top:5px; text-align: ${isMe ? 'right' : 'left'}">
                ${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
        `;
        eccChatContainer.appendChild(div);
    });
    eccChatContainer.scrollTop = eccChatContainer.scrollHeight;
}

// Job Dashboard Logic
const inlineJobDashboard = document.getElementById('inlineJobDashboard');
const jobDashboardClientsList = document.getElementById('jobDashboardClientsList');

function renderJobDashboard() {
    if (!currentUser || !inlineJobDashboard) return;
    const myEditorProfile = editors.find(e => e.userId === currentUser.uid && !e.deletionScheduledAt);
    if (!myEditorProfile) {
        inlineJobDashboard.style.display = 'none';
        return;
    }
    
    // Check if the current user profile is correctly rendered (is it inside jobsStatusContainer?)
    if (document.getElementById('jobsStatusContainer')?.style.display === 'block') {
        inlineJobDashboard.style.display = 'block';
    } else {
        inlineJobDashboard.style.display = 'none';
    }

    // Find unique clients from requests
    const myRequests = allRequests.filter(r => r.editorId === myEditorProfile.id);
    const uniqueClientIds = new Set(myRequests.map(r => r.userId));
    
    // Add clients from chats
    const data = window.globalClientChatsData || {};
    const chatData = [];
    Object.keys(data).forEach(key => {
        const parts = key.split('_');
        if (parts.length === 2 && parts[0] === myEditorProfile.id) {
            uniqueClientIds.add(parts[1]);
        }
    });
    
    if (uniqueClientIds.size === 0) {
        jobDashboardClientsList.innerHTML = '<div class="text-center text-secondary w-100" style="grid-column: 1/-1;">You do not have any clients or messages yet.</div>';
        return;
    }
    
    // Build array of clients with last msg data
    const clients = Array.from(uniqueClientIds).map(clientId => {
        const chatKey = `${myEditorProfile.id}_${clientId}`;
        const msgsObj = (data[chatKey] && data[chatKey].messages) || {};
        const msgs = Object.values(msgsObj);
        let unread = false;
        let lastTimestamp = 0;
        let lastMsgText = '';
        
        const hasPendingRequest = myRequests.some(r => r.userId === clientId && r.status === 'pending');
        
        if (msgs.length > 0) {
            const lastMsg = msgs.sort((a,b) => b.timestamp - a.timestamp)[0];
            lastTimestamp = lastMsg.timestamp;
            lastMsgText = lastMsg.text;
            if (lastMsg.senderId !== currentUser.uid && !lastMsg.read) {
                unread = true;
            }
        } else if (hasPendingRequest) {
            unread = true; // highlight requests
            lastMsgText = 'New hiring request!';
            const requestObj = myRequests.find(r => r.userId === clientId && r.status === 'pending');
            lastTimestamp = requestObj ? requestObj.timestamp : 0;
        }
        
        return { clientId, unread, lastTimestamp, lastMsgText, chatKey };
    });
    
    const userProfile = allUsers[currentUser.uid] || {};
    const favChats = userProfile.favoriteChats || [];
    
    clients.sort((a, b) => {
        const aFav = favChats.includes(a.chatKey);
        const bFav = favChats.includes(b.chatKey);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return b.lastTimestamp - a.lastTimestamp;
    });
    
    jobDashboardClientsList.innerHTML = '';
    clients.forEach(client => {
        const u = allUsers[client.clientId] || {};
        const name = u.firstName ? (u.firstName + ' ' + (u.lastName || '')).trim() : 'Anonymous';
        const photo = u.photoUrl || window.DEFAULT_AVATAR;
        
        const div = document.createElement('div');
        div.className = 'glass-card p-3';
        div.style.background = 'rgba(255,255,255,0.02)';
        div.style.border = '1px solid var(--glass-border)';
        div.style.borderRadius = '12px';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'center';
        div.style.textAlign = 'center';
        div.style.position = 'relative';
        
        let msgPreview = client.lastMsgText;
        if (msgPreview.length > 30) msgPreview = msgPreview.substring(0, 30) + '...';
        
        const isFav = allUsers[currentUser.uid]?.favoriteChats?.includes(client.chatKey);
        
        div.innerHTML = `
            ${client.unread ? '<div class="bounce-anim" style="position:absolute; top:10px; right:10px; background:var(--warning); width:12px; height:12px; border-radius:50%; box-shadow:0 0 8px var(--warning);"></div>' : ''}
            
            <div style="position:absolute; top:5px; left:5px; display:flex; gap:5px;">
                <button class="btn fav-chat-btn-editor" style="background:transparent; border:none; color:var(--warning); cursor:pointer; padding:5px;" title="Favorite this client chat">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            
            <button class="btn delete-chat-btn-editor" style="position:absolute; top:5px; right:5px; background:transparent; border:none; color:var(--danger); cursor:pointer; padding:5px; ${client.unread ? 'right: 25px;' : ''}" title="Delete Chat From Editor Side">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            
            <img src="${photo}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; margin-bottom:10px; margin-top:20px;">
            <h4 style="margin:0 0 5px; display:flex; align-items:center; gap:5px; justify-content:center;">
                ${name}
            </h4>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 10px; word-break:break-all;">${u.email || 'No email'}</p>
            ${msgPreview ? `<p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 10px; font-style:italic;">"${msgPreview}"</p>` : ''}
            <button class="btn secondary btn-sm w-100 mt-auto msg-client-btn">💬 Message</button>
        `;
        
        const favBtnEditor = div.querySelector('.fav-chat-btn-editor');
        if (favBtnEditor) {
            favBtnEditor.addEventListener('click', async (e) => {
                e.stopPropagation();
                let favChats = allUsers[currentUser.uid]?.favoriteChats || [];
                let newFavs = [...favChats];
                if (isFav) {
                    newFavs = newFavs.filter(id => id !== client.chatKey);
                } else {
                    newFavs.push(client.chatKey);
                }
                try {
                    await update(ref(db, `users/${currentUser.uid}`), { favoriteChats: newFavs });
                    if(allUsers[currentUser.uid]) allUsers[currentUser.uid].favoriteChats = newFavs;
                    renderJobDashboard(); // re-render to reflect change
                } catch(e) {
                    console.error(e);
                }
            });
        }
        
        const delBtnEditor = div.querySelector('.delete-chat-btn-editor');
        if (delBtnEditor) {
            delBtnEditor.addEventListener('click', async (e) => {
                e.stopPropagation();
                if(!confirm("Are you sure you want to delete this chat with the client?")) return;
                try {
                    await remove(ref(db, `editor_client_chats/${client.chatKey}`));
                } catch(err) {
                    console.error(err);
                }
            });
        }
        
        div.querySelector('.msg-client-btn').addEventListener('click', async () => {
            const req = myRequests.find(r => r.userId === clientId && r.status === 'pending');
            if (req) {
                try {
                    await update(ref(db, `requests/${req.id}`), { status: 'contacted' });
                } catch(e) { }
            }
            window.switchNavView('messages');
            window.openClientSideChat(client.clientId, client.chatKey, name, photo);
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
        openModal(supportChatModal);
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
        closeModal(supportChatModal);
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
                userPhoto: up.photoUrl || window.DEFAULT_AVATAR
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
        openModal(adminSupportChatsModal);
        renderAdminSupportUsersList();
    });
}

if (closeAdminSupportChatsBtn) {
    closeAdminSupportChatsBtn.addEventListener('click', () => {
        closeModal(adminSupportChatsModal);
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

let globalAdminInterceptListener = null;
let allInterceptedChats = {};

function setupAdminInterceptListener() {
    if (!globalAdminInterceptListener) {
        globalAdminInterceptListener = onValue(ref(db, 'editor_client_chats'), (snap) => {
            allInterceptedChats = snap.val() || {};
            renderAdminInterceptedChats();
        });
    }
}

window.openInterceptChat = (chatId, clientName, editorName) => {
    const modal = document.getElementById('editorClientChatModal');
    if(modal) modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    currentEccPath = `editor_client_chats/${chatId}/messages`;
    document.getElementById('eccUserName').innerHTML = `
        <div style="display:flex; align-items:center; gap: 8px;">
            <div style="display:flex; flex-direction:column;">
                <div style="font-size: 1.0rem; font-weight: bold; line-height:1.2;">
                    ${(clientName && editorName) ? `Chat: ${clientName} ⇄ ${editorName}` : 'Admin Chat View'}
                </div>
            </div>
        </div>
    `;
    
    // We also set the ID to send from Admin side so it stands out
    window.isInterceptingChat = true;
    
    if (eccListener) eccListener();
    eccListener = onValue(ref(db, currentEccPath), (snap) => {
        const data = snap.val() || {};
        const messages = Object.keys(data).map(k => ({id: k, ...data[k]})).sort((a,b) => a.timestamp - b.timestamp);
        renderEccChat(messages);
    });
};

function renderAdminInterceptedChats() {
    const list = document.getElementById('adminSupportChatsList');
    if(!list) return;
    list.innerHTML = '';
    
    const chatKeys = Object.keys(allInterceptedChats);
    if(chatKeys.length === 0) {
        list.innerHTML = '<tr><td colspan="4" class="text-center text-secondary text-sm">No intercepted chats found.</td></tr>';
        return;
    }
    
    const sortedChats = chatKeys.map(key => {
        const msgs = Object.values(allInterceptedChats[key].messages || {});
        const lastMsg = msgs.sort((a,b) => b.timestamp - a.timestamp)[0];
        return {
            id: key,
            lastUpdated: lastMsg ? lastMsg.timestamp : 0,
            lastMsg: lastMsg,
            msgsCount: msgs.length
        };
    }).sort((a,b) => b.lastUpdated - a.lastUpdated);
    
    if(sortedChats.length === 0) {
        list.innerHTML = '<tr><td colspan="4" class="text-center text-secondary text-sm">No intercepted chats found.</td></tr>';
        return;
    }
    
    sortedChats.forEach(chat => {
        if(chat.msgsCount === 0) return;
        const parts = chat.id.split('_');
        const editorId = parts[0];
        const clientId = parts[1];
        
        const ed = typeof editors !== 'undefined' ? editors.find(e => e.id === editorId) : null;
        let cUser = typeof allUsers !== 'undefined' ? allUsers[clientId] : null;
        let cliName = clientId;
        if(cUser) {
            cliName = (cUser.firstName || '') + ' ' + (cUser.lastName || '');
            if (!cliName.trim()) cliName = cUser.name || cUser.email || clientId;
        }
        
        // Helper to escape single quotes
        const escapeAttr = (str) => String(str || '').replace(/'/g, "\\'");
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="text-sm">${cliName}</span></td>
            <td><strong>${ed ? ed.name : 'Unknown Editor'}</strong></td>
            <td><span class="text-xs text-secondary">${new Date(chat.lastUpdated).toLocaleString()}</span></td>
            <td>
                <button class="btn secondary btn-sm" onclick="window.openInterceptChat('${chat.id}', '${escapeAttr(cliName)}', '${escapeAttr(ed ? ed.name : 'Unknown Editor')}')">View Chat / Reply</button>
            </td>
        `;
        list.appendChild(tr);
    });
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
        
        const photo = ch.userPhoto || window.DEFAULT_AVATAR;
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

// Auto-shuffle All Editors every 5 minutes
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
}, 300000);

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
        openModal(addAdminManagerModal);
    });
}
if (document.getElementById('closeAddAdminManager')) {
    document.getElementById('closeAddAdminManager').addEventListener('click', () => { closeModal(addAdminManagerModal); });
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
            document.getElementById('adminSearchAvatar').src = foundData.photoUrl || window.DEFAULT_AVATAR;
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
            closeModal(addAdminManagerModal);
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
            closeModal(addAdminManagerModal);
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
                    closeModal(addAdminManagerModal);
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
    
    // Check if this is an update request
    const existingEditor = editors.find(e => e.userId === app.userId);
    const isUpdate = !!existingEditor;
    
    const editorData = {
        userId: app.userId || '',
        name: app.name || '',
        email: app.email || '',
        phone: app.phone || '',
        category: app.category || '',
        style: app.style || '',
        price: app.price || 0,
        maxPrice: app.maxPrice || null,
        experience: app.experience || '',
        skills: app.tags || app.skills || '', // Using the AI generated tags here
        tools: app.tools || '',
        bio: app.bio || '', // This is the AI enhanced bio
        video_clips: (app.videoLinks && Array.isArray(app.videoLinks)) ? app.videoLinks.join(', ') : (app.videoLinks || ''),
        photo_url: app.photo_url || '',
        banner_url: app.banner_url || '',
        portfolio: app.portfolio || '',
        isVerified: true
    };

    if (isUpdate) {
        // Update existing live profile
        await update(ref(db, "editors/" + existingEditor.id), editorData);
        // Update local state
        Object.assign(existingEditor, editorData);
    } else {
        // Create new profile
        const editorRef = push(ref(db, "editors"));
        const newEditorData = {
            ...editorData,
            availability: 'Available',
            projects: 0,
            views: 0,
            verificationType: 'blue',
            isFeatured: false,
            createdAt: Date.now()
        };
        await set(editorRef, newEditorData);
        editors.push({id: editorRef.key, ...newEditorData});
    }

    // Set application status to approved
    await update(ref(db, "editor_applications/" + appId), { status: 'approved' });
    app.status = 'approved';
    
    renderAdminList();
    renderTrending();
    refreshCurrentFeeds();
};

// ============================================
// AI Support Chat & Draggable FAB Logic
// ============================================
const aiSupportFab = document.getElementById('aiSupportFab');
const aiSupportChatModal = document.getElementById('aiSupportChatModal');
const closeAiSupportChat = document.getElementById('closeAiSupportChat');
const aiSupportChatContainer = document.getElementById('aiSupportChatContainer');
const aiSupportChatInput = document.getElementById('aiSupportChatInput');
const sendAiSupportMessageBtn = document.getElementById('sendAiSupportMessageBtn');

let ai;
try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch(e) {
    console.warn("Failed to initialize GoogleGenAI", e);
}

const chatHistory = [
    { role: 'model', parts: [{ text: "Hi there! I'm Lumina AI, your virtual assistant. How can I help you today?" }] }
];
let ongoingAiChat = null;

if (aiSupportFab) {
    // Draggable logic for FAB
    let isDragging = false;
    let startX, startY, initialX, initialY;

    const onMove = (moveEvent) => {
        const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            isDragging = true;
        }
        if (isDragging) {
            aiSupportFab.style.right = 'auto';
            aiSupportFab.style.bottom = 'auto';
            aiSupportFab.style.left = (initialX + dx) + 'px';
            aiSupportFab.style.top = (initialY + dy) + 'px';
            if (moveEvent.cancelable) moveEvent.preventDefault(); // Prevent scrolling on mobile
        }
    };

    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
    };

    const onDown = (e) => {
        isDragging = false;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = aiSupportFab.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        document.addEventListener('mousemove', onMove, {passive: false});
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, {passive: false});
        document.addEventListener('touchend', onUp);
    };

    aiSupportFab.addEventListener('mousedown', onDown);
    aiSupportFab.addEventListener('touchstart', onDown, {passive: false});

    aiSupportFab.addEventListener('click', (e) => {
        if (!isDragging) {
            openModal(aiSupportChatModal);
        }
    });
}

if (closeAiSupportChat) {
    closeAiSupportChat.addEventListener('click', () => {
        closeModal(aiSupportChatModal);
    });
}

function appendAiMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.style.background = isUser ? 'var(--primary)' : 'var(--glass-card)';
    msgDiv.style.padding = '10px 15px';
    msgDiv.style.borderRadius = '12px';
    msgDiv.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
    msgDiv.style.maxWidth = '80%';
    msgDiv.style.marginTop = '10px';
    msgDiv.style.color = 'white';
    msgDiv.style.wordBreak = 'break-word';
    msgDiv.textContent = text;
    aiSupportChatContainer.appendChild(msgDiv);
    aiSupportChatContainer.scrollTop = aiSupportChatContainer.scrollHeight;
    return msgDiv;
}

async function handleAiSubmit() {
    const text = aiSupportChatInput.value.trim();
    if (!text) return;
    
    appendAiMessage(text, true);
    aiSupportChatInput.value = '';
    
    if (!ai) {
        appendAiMessage("Sorry, the AI is not configured correctly.");
        return;
    }

    if (!ongoingAiChat) {
        ongoingAiChat = ai.chats.create({
            model: "gemini-3-flash-preview",
            config: {
                systemInstruction: "You are Lumina AI, an AI assistant created by this company to help users with the Lumina Editors app. Assist users with their problems in a friendly, helpful manner."
            }
        });
    }

    // Show thinking animation
    const thinkingDiv = document.createElement('div');
    thinkingDiv.style.background = 'var(--glass-card)';
    thinkingDiv.style.padding = '10px 15px';
    thinkingDiv.style.borderRadius = '12px';
    thinkingDiv.style.alignSelf = 'flex-start';
    thinkingDiv.style.marginTop = '10px';
    thinkingDiv.style.color = 'var(--secondary)';
    thinkingDiv.style.fontStyle = 'italic';
    thinkingDiv.innerHTML = 'Thinking... <span style="display:inline-block; animation: spin 2s linear infinite;">⏳</span>';
    aiSupportChatContainer.appendChild(thinkingDiv);
    aiSupportChatContainer.scrollTop = aiSupportChatContainer.scrollHeight;

    try {
        let streamResponse = await ongoingAiChat.sendMessageStream({ message: text });
        
        thinkingDiv.remove();
        
        const responseDiv = appendAiMessage("", false);
        let fullText = "";

        for await (const chunk of streamResponse) {
            fullText += (chunk.text || "");
            responseDiv.textContent = fullText;
            aiSupportChatContainer.scrollTop = aiSupportChatContainer.scrollHeight;
        }
    } catch(err) {
        console.error(err);
        thinkingDiv.remove();
        appendAiMessage("Sorry, I encountered an error. Please try again later.");
    }
}

if (sendAiSupportMessageBtn) {
    sendAiSupportMessageBtn.addEventListener('click', handleAiSubmit);
}
if (aiSupportChatInput) {
    aiSupportChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAiSubmit();
    });
}


