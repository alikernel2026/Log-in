<!--[ عرض فوري للبيانات من localStorage ]-->
<script>
//<![CDATA[
(function() {
    // عرض البيانات فوراً قبل تحميل Firebase
    const photoURL = localStorage.getItem('userPhotoURL');
    const avatar = document.getElementById('user-avatar-icon');
    const guestIcon = document.getElementById('profile-icon');
    const userMenu = document.getElementById('user-menu');
    const guestMenu = document.getElementById('guest-menu');
    
    if (photoURL && photoURL !== 'null') {
        if (avatar) {
            avatar.src = photoURL;
            avatar.classList.remove('hidden');
            avatar.style.display = 'block';
        }
        if (guestIcon) {
            guestIcon.classList.add('hidden');
            guestIcon.style.display = 'none';
        }
        if (userMenu) {
            userMenu.classList.remove('hidden');
            userMenu.style.display = 'block';
        }
        if (guestMenu) {
            guestMenu.classList.add('hidden');
            guestMenu.style.display = 'none';
        }
    }
})();
//]]>
</script>

<script type='module'>
//<![CDATA[
class FirebaseAuthManager {
    constructor() {
        window.firebaseAuth = this;
        this.app = null;
        this.auth = null;
        this.db = null;
        this.unsubscribeSessions = null;
        this.currentUser = null;
        this.isTabSwitching = false;
        this.isFirstTimeLogin = false;
        this.sessionCheckInterval = null;
        this.globalSessionWatcher = null;

        this.config = {
            firebase: { 
                apiKey: "AIzaSyDEyp0GF0BSSjJEXH7AJCUhKIb8CRJeO5Y", 
                authDomain: "sign-in-8e42c.firebaseapp.com", 
                projectId: "sign-in-8e42c" 
            },
            paths: {
                login: '/p/login.html',
                account: '/p/account.html',
                home: '/',
                lockPage: '/p/lock-page.html'
            },
            googleClientId: '617149480177-aimcujc67q4307sk43li5m6pr54vj1jv.apps.googleusercontent.com'
        };

        this.init();
    }

    async init() {
        try {
            // تحميل كل شيء بالتوازي = أسرع!
            const [_, googleSDK] = await Promise.all([
                this.loadFirebaseSDK(),
                this.loadGoogleSignIn()
            ]);
            
            await this.initializeFirebase();
            this.setupEventListeners();
            this.setupStorageWatcher();
            this.setupGoogleOneTap();
            this.hideLoadingScreen();
        } catch (error) {
            this.handleError('فشل في تهيئة النظام', error);
        }
    }

    async loadFirebaseSDK() {
        const modules = await Promise.all([
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"),
            import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
        ]);

        this.firebaseModules = { app: modules[0], auth: modules[1], firestore: modules[2] };
    }

    async initializeFirebase() {
        this.app = this.firebaseModules.app.initializeApp(this.config.firebase);
        this.auth = this.firebaseModules.auth.getAuth(this.app);
        this.db = this.firebaseModules.firestore.getFirestore(this.app);

        this.firebaseModules.auth.onAuthStateChanged(this.auth, (user) => {
            this.handleAuthStateChange(user);
        });
    }

    async loadGoogleSignIn() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('فشل تحميل Google Sign-In'));
            document.head.appendChild(script);
        });
    }

    setupGoogleOneTap() {
        const googleDiv = document.createElement('div');
        googleDiv.id = 'g_id_onload';
        googleDiv.setAttribute('data-client_id', this.config.googleClientId);
        googleDiv.setAttribute('data-callback', 'handleGoogleCredentialResponse');
        googleDiv.setAttribute('data-auto_prompt', 'false');
        document.body.appendChild(googleDiv);

        window.handleGoogleCredentialResponse = async (response) => {
            try {
                this.isFirstTimeLogin = true;
                const credential = this.firebaseModules.auth.GoogleAuthProvider.credential(response.credential);
                const result = await this.firebaseModules.auth.signInWithCredential(this.auth, credential);
                if (result.user) {
                    await this.createUserSession(result.user);
                    const redirectUrl = sessionStorage.getItem('redirectAfterLogin');

                    if (redirectUrl && !window.location.pathname.includes(this.config.paths.home)) {
                        sessionStorage.removeItem('redirectAfterLogin');
                        window.location.href = redirectUrl;
                    } else {
                        sessionStorage.removeItem('redirectAfterLogin');
                        if (window.location.pathname.includes(this.config.paths.login)) {
                            window.location.href = this.config.paths.home;
                        }
                    }
                }
            } catch (error) {
                this.handleError("فشل تسجيل الدخول عبر Google", error);
            }
        };
    }

    setupEventListeners() {
        const googleBtn = document.getElementById('google-signin-btn-popup');
        const githubBtn = document.getElementById('github-signin-btn');
        const logoutBtns = document.querySelectorAll('#logout-btn-from-account, #logout-btn');
        const homeBtn = document.getElementById('home-btn');
        const accountBtn = document.getElementById('view-account-btn');

        googleBtn?.addEventListener('click', () => { this.isFirstTimeLogin = true; this.signInWithProvider('google'); });
        githubBtn?.addEventListener('click', () => { this.isFirstTimeLogin = true; this.signInWithProvider('github'); });
        logoutBtns.forEach(btn => btn?.addEventListener('click', (e) => this.signOut(e)));
        homeBtn?.addEventListener('click', (e) => this.navigateTo(e, this.config.paths.home));
        accountBtn?.addEventListener('click', (e) => this.navigateTo(e, this.config.paths.account));
    }

    setupStorageWatcher() {
        window.addEventListener('storage', (event) => {
            // عند تسجيل الدخول في تبويب آخر
            if (event.key === 'firebaseSessionId' && event.newValue && !this.currentUser) {
                window.location.reload();
            }
            
            // عند تسجيل الخروج في تبويب آخر
            if (event.key === 'firebaseSessionId' && !event.newValue && this.currentUser) {
                window.location.reload();
            }
            
            if (event.key === 'firebaseSessionId' && event.newValue && window.location.pathname.includes(this.config.paths.login)) {
                window.location.href = this.config.paths.home;
            }
            if (event.key === 'firebaseSessionId' && event.newValue) {
                this.hideGoogleOneTap();
            }
        });
    }

    async signInWithProvider(providerType) {
        try {
            const provider = this.createAuthProvider(providerType);
            const result = await this.firebaseModules.auth.signInWithPopup(this.auth, provider);
            if (result.user) {
                await this.createUserSession(result.user);
                const redirectUrl = sessionStorage.getItem('redirectAfterLogin');

                if (redirectUrl && !window.location.pathname.includes(this.config.paths.home)) {
                    sessionStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl;
                } else {
                    sessionStorage.removeItem('redirectAfterLogin');
                    if (window.location.pathname.includes(this.config.paths.login)) {
                        window.location.href = this.config.paths.home;
                    }
                }
            }
        } catch (error) { this.handleError(`فشل تسجيل الدخول عبر ${providerType}`, error); }
    }

    createAuthProvider(type) {
        const providers = { 
            google: new this.firebaseModules.auth.GoogleAuthProvider(), 
            github: new this.firebaseModules.auth.GithubAuthProvider() 
        };
        return providers[type];
    }

    async createUserSession(user) {
        try {
            const sessionData = { 
                uid: user.uid, 
                createdAt: this.firebaseModules.firestore.serverTimestamp(), 
                os: this.getOperatingSystem(), 
                ip: await this.getUserIP() 
            };
            const docRef = await this.firebaseModules.firestore.addDoc(
                this.firebaseModules.firestore.collection(this.db, "sessions"), 
                sessionData
            );
            this.saveToStorage('firebaseSessionId', docRef.id);
        } catch (error) { 
            this.handleError('فشل إنشاء جلسة المستخدم', error); 
        }
    }
    
    async handleAuthStateChange(user) {
        this.currentUser = user;
        if (user) {
            this.handleAuthenticatedUser(user);
            this.startSessionMonitoring();
            this.startGlobalSessionWatcher(user);
        } else {
            this.handleUnauthenticatedUser();
            this.stopSessionMonitoring();
            this.stopGlobalSessionWatcher();
        }
        this.updateUIForAuthState(user);
        this.handlePageSpecificLogic(user);
    }
    
    startGlobalSessionWatcher(user) {
        if (this.globalSessionWatcher) return;

        const query = this.firebaseModules.firestore.query(
            this.firebaseModules.firestore.collection(this.db, "sessions"),
            this.firebaseModules.firestore.where("uid", "==", user.uid)
        );

        this.globalSessionWatcher = this.firebaseModules.firestore.onSnapshot(query,
            (querySnapshot) => {
                const currentSessionId = this.getFromStorage('firebaseSessionId');
                if (currentSessionId) {
                    const currentSessionExists = querySnapshot.docs.some(doc => doc.id === currentSessionId);
                    if (!currentSessionExists) {
                        console.log('Session terminated from another device');
                        this.handleRemoteLogout();
                    }
                }
            },
            (error) => {
                console.error('Error in global session watcher:', error);
            }
        );
    }

    stopGlobalSessionWatcher() {
        if (this.globalSessionWatcher) {
            this.globalSessionWatcher();
            this.globalSessionWatcher = null;
        }
    }

    handleAuthenticatedUser(user) {
        this.hideGoogleOneTap();
        const userData = { 
            photoURL: user.photoURL || '', 
            displayName: user.displayName || 'مستخدم جديد', 
            email: user.email || '', 
            joinedDate: new Date(user.metadata.creationTime).toLocaleString('en-US') 
        };
        Object.entries(userData).forEach(([key, value]) => { 
            this.saveToStorage(`user${key.charAt(0).toUpperCase() + key.slice(1)}`, value); 
        });
    }

    handleUnauthenticatedUser() {
        console.log('User unauthenticated, cleaning up...');
        this.clearUserData();
        if (this.unsubscribeSessions) {
            this.unsubscribeSessions();
            this.unsubscribeSessions = null;
        }
        this.showGoogleOneTap();
    }

    updateUIForAuthState(user) {
        // تحديث فوري بدون setTimeout!
        const elements = {
            profileIcon: document.getElementById('profile-icon'),
            userAvatarIcon: document.getElementById('user-avatar-icon'),
            guestMenu: document.getElementById('guest-menu'),
            userMenu: document.getElementById('user-menu')
        };

        if (user) {
            if (elements.profileIcon) {
                elements.profileIcon.classList.add('hidden');
                elements.profileIcon.style.display = 'none';
            }
            if (elements.userAvatarIcon) {
                elements.userAvatarIcon.src = user.photoURL || '';
                elements.userAvatarIcon.classList.remove('hidden');
                elements.userAvatarIcon.style.display = 'block';
            }
            if (elements.guestMenu) {
                elements.guestMenu.classList.add('hidden');
                elements.guestMenu.style.display = 'none';
            }
            if (elements.userMenu) {
                elements.userMenu.classList.remove('hidden');
                elements.userMenu.style.display = 'block';
            }
        } else {
            if (elements.profileIcon) {
                elements.profileIcon.classList.remove('hidden');
                elements.profileIcon.style.display = 'block';
            }
            if (elements.userAvatarIcon) {
                elements.userAvatarIcon.classList.add('hidden');
                elements.userAvatarIcon.style.display = 'none';
            }
            if (elements.guestMenu) {
                elements.guestMenu.classList.remove('hidden');
                elements.guestMenu.style.display = 'block';
            }
            if (elements.userMenu) {
                elements.userMenu.classList.add('hidden');
                elements.userMenu.style.display = 'none';
            }
        }
    }

    async handlePageSpecificLogic(user) {
        const currentPath = window.location.pathname;
        const secureContainer = document.getElementById('secure-post-container');

        if (currentPath === '/' || currentPath === this.config.paths.home) {
            sessionStorage.removeItem('redirectAfterLogin');
        }

        if (secureContainer) {
            if (user) {
                const postId = secureContainer.dataset.postId;
                if (postId && !secureContainer.dataset.loaded) {
                    secureContainer.innerHTML = "<p>جاري تحميل المحتوى...</p>";
                    try {
                        const postRef = this.firebaseModules.firestore.doc(this.db, "protected_posts", postId);
                        const docSnap = await this.firebaseModules.firestore.getDoc(postRef);
                        if (docSnap.exists()) { 
                            secureContainer.innerHTML = docSnap.data().contentHTML; 
                            secureContainer.dataset.loaded = 'true'; 
                        } else { 
                            secureContainer.innerHTML = "<p>خطأ: الموضوع المحمي غير موجود.</p>"; 
                        }
                    } catch (error) { 
                        console.error("Error fetching protected post:", error); 
                        secureContainer.innerHTML = "<p>فشل تحميل المحتوى.</p>"; 
                    }
                }
            } else {
                sessionStorage.setItem('redirectAfterLogin', window.location.href);
                const postId = secureContainer.dataset.postId;
                window.location.href = `${this.config.paths.lockPage}?postId=${postId}`;
            }
        }

        if (currentPath.includes(this.config.paths.lockPage.replace(/\/[^\/]*$/, ''))) {
            this.handleLockPageLogic(user);
        }

        if (!user && currentPath.includes(this.config.paths.account)) { 
            window.location.href = this.config.paths.login; 
            return; 
        }
        if (user && currentPath.includes(this.config.paths.account)) { 
            this.setupAccountPage(user); 
        }
    }

    handleLockPageLogic(user) {
        if (user) {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
            sessionStorage.removeItem('redirectAfterLogin');
            
            if (redirectUrl && window.location.pathname.includes(this.config.paths.lockPage)) {
                window.location.href = redirectUrl;
            }
        }
    }

    setupAccountPage(user) {
        this.updateAccountPageElements(user);
        this.setupSessionsManager(user);
        this.setupCustomModal();
    }

    updateAccountPageElements(user) {
        const elements = { 
            avatar: document.getElementById('account-avatar'), 
            name: document.getElementById('account-name'), 
            email: document.getElementById('account-email'), 
            joinedDate: document.getElementById('account-joined-date') 
        };
        if (elements.avatar) elements.avatar.src = user.photoURL || '';
        if (elements.name) {
    (async () => {
        try {
            // تحديث بيانات المستخدم من Google
            await user.reload();
            const updatedUser = this.auth.currentUser;
            
            const userDocRef = this.firebaseModules.firestore.doc(this.db, "users", user.uid);
            const userDoc = await this.firebaseModules.firestore.getDoc(userDocRef);
            
            let customName = null;
            
            // استخدم الاسم من Firebase إذا موجود
            if (userDoc.exists() && userDoc.data().customName) {
                customName = userDoc.data().customName;
            } else {
                // إذا لا يوجد، استخدم الاسم الجديد من Google
                customName = updatedUser.displayName;
                
                // احفظه في Firebase
                if (customName) {
                    await this.firebaseModules.firestore.setDoc(userDocRef, { customName: customName }, { merge: true });
                }
            }
            
            const finalName = customName || 'مستخدم جديد';
            elements.name.textContent = finalName;
            localStorage.setItem('userDisplayName', finalName);
            
        } catch (error) {
            elements.name.textContent = user.displayName || 'مستخدم جديد';
        }
    })();
}
        if (elements.email) elements.email.textContent = user.email || '';
        if (elements.joinedDate) {
            const joinedText = `انضم في: ${new Date(user.metadata.creationTime).toLocaleString('en-US')}`;
            elements.joinedDate.textContent = joinedText;
            this.saveToStorage('userJoinedDate', joinedText);
        }
    }

    setupSessionsManager(user) {
        const sessionsList = document.getElementById('sessions-list');
        const query = this.firebaseModules.firestore.query(
            this.firebaseModules.firestore.collection(this.db, "sessions"), 
            this.firebaseModules.firestore.where("uid", "==", user.uid)
        );
        this.unsubscribeSessions = this.firebaseModules.firestore.onSnapshot(query,
            (querySnapshot) => {
                const currentSessionId = this.getFromStorage('firebaseSessionId');
                if (currentSessionId) {
                    const currentSessionExists = querySnapshot.docs.some(doc => doc.id === currentSessionId);
                    if (!currentSessionExists) {
                        console.log('Current session was terminated remotely');
                        this.handleRemoteLogout();
                        return;
                    }
                }
                if (sessionsList) {
                    this.handleSessionsUpdate(querySnapshot, sessionsList);
                }
            },
            (error) => this.handleSessionsError(error, sessionsList)
        );
    }

    async handleRemoteLogout() {
        try {
            await this.firebaseModules.auth.signOut(this.auth);
        } catch (error) {
            console.error('خطأ في تسجيل الخروج عن بُعد:', error);
        }
    }

    handleSessionsUpdate(querySnapshot, sessionsList) {
        let listHTML = '';
        if (querySnapshot.empty) {
            listHTML = '<p style="text-align: center;">لا توجد أجهزة متصلة.</p>';
        } else {
            const currentSessionId = this.getFromStorage('firebaseSessionId');
            const sessions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
            listHTML = this.buildSessionsHTML(sessions, currentSessionId);
        }
        sessionsList.innerHTML = listHTML;
        this.saveToStorage('userSessionsHTMLCache', listHTML);
        this.bindSessionButtons(sessionsList);
    }

    buildSessionsHTML(sessions, currentSessionId) {
        const clockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock shrink-0" aria-hidden="true"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>`;
        const deviceIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor-smartphone shrink-0" aria-hidden="true"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>`;
        const mapPinIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin shrink-0" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
        const checkBadgeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-line shrink-0" aria-hidden="true"><path d="M20 4L9 15"></path><path d="M21 19L3 19"></path><path d="M9 15L4 10"></path></svg>`;

        return sessions.map(session => {
            const isCurrentSession = session.id === currentSessionId;
            const iconClass = isCurrentSession ? 'icon-current' : 'icon-terminate';
            const buttonTitle = isCurrentSession ? 'تسجيل الخروج' : 'إنهاء هذه الجلسة';
            const createdTime = session.createdAt ? new Date(session.createdAt.toDate()).toLocaleString('en-US', { 
                hour: 'numeric', 
                minute: 'numeric', 
                hour12: true 
            }).replace('AM', 'صباحًا').replace('PM', 'مساءً') : 'غير معروف';

            let detailsHTML = `<div class="session-detail-line">${clockIcon} <span>الوقت: ${createdTime}</span></div><div class="session-detail-line">${deviceIcon} <span>نظام التشغيل: ${session.os}</span></div><div class="session-detail-line">${mapPinIcon} <span>العنوان: ${session.ip}</span></div>`;
            if (isCurrentSession) { 
                detailsHTML += `<div class="session-detail-line current-session-indicator">${checkBadgeIcon} <span>جلستك الحالية</span></div>`; 
            }
            return `<div class="session-item"><div class="session-details">${detailsHTML}</div><button data-session-id="${session.id}" class="terminate-btn ${iconClass}" title="${buttonTitle}"></button></div>`;
        }).join('');
    }

    bindSessionButtons(sessionsList) {
        sessionsList.querySelectorAll('.terminate-btn').forEach(btn => {
            const sessionId = btn.dataset.sessionId;
            const isCurrentSession = btn.classList.contains('icon-current');
            btn.addEventListener('click', () => {
                if (isCurrentSession) {
                    this.showCustomConfirm("لا يمكن التراجع عن هذا الإجراء. أنت على وشك إلغاء جلستك الحالية، مما سيؤدي إلى تسجيل خروجك فوراً.", () => this.signOut());
                } else {
                    this.showCustomConfirm("لا يمكن التراجع عن هذا الإجراء. سيؤدي إلغاء هذه الجلسة إلى إزالة إمكانية الوصول إليها من الجهاز المتصل.", () => this.terminateSession(sessionId));
                }
            });
        });
    }

    setupCustomModal() {
        const modal = document.getElementById('custom-confirm-modal');
        const modalText = document.getElementById('custom-modal-text');
        const confirmBtn = document.getElementById('custom-modal-confirm-btn');
        const cancelBtn = document.getElementById('custom-modal-cancel-btn');
        if (!modal || !confirmBtn || !cancelBtn) return;
        this.modalElements = { modal, modalText, confirmBtn, cancelBtn };
        confirmBtn.onclick = () => { 
            modal.classList.add('hidden'); 
            if (this.confirmCallback) this.confirmCallback(); 
        };
        cancelBtn.onclick = () => { modal.classList.add('hidden'); };
    }

    showCustomConfirm(message, onConfirm) {
        if (!this.modalElements) return;
        if (this.modalElements.modalText) { 
            this.modalElements.modalText.textContent = message; 
        }
        this.confirmCallback = onConfirm;
        this.modalElements.modal.classList.remove('hidden');
    }

    async terminateSession(sessionId) {
        try { 
            await this.firebaseModules.firestore.deleteDoc(
                this.firebaseModules.firestore.doc(this.db, "sessions", sessionId)
            ); 
        } catch (error) { 
            this.handleError('فشل في إنهاء الجلسة', error); 
        }
    }

    handleSessionsError(error, sessionsList) {
        console.error("خطأ في الاستماع للجلسات:", error);
        if (sessionsList) { 
            sessionsList.innerHTML = '<p style="text-align: center; color: red;">فشل تحميل الأجهزة.</p>'; 
        }
    }

    startSessionMonitoring() {
        this.stopSessionMonitoring();
        this.sessionCheckInterval = setInterval(async () => {
            const sessionId = this.getFromStorage('firebaseSessionId');
            if (sessionId && this.currentUser) {
                try {
                    const sessionRef = this.firebaseModules.firestore.doc(this.db, "sessions", sessionId);
                    const docSnap = await this.firebaseModules.firestore.getDoc(sessionRef);
                    if (!docSnap.exists()) {
                        await this.firebaseModules.auth.signOut(this.auth);
                    }
                } catch (error) {
                    console.error('Error in session monitoring interval:', error);
                }
            }
        }, 3000);
    }

    stopSessionMonitoring() {
        if (this.sessionCheckInterval) { 
            clearInterval(this.sessionCheckInterval); 
            this.sessionCheckInterval = null; 
        }
    }

    showGoogleOneTap() {
        if (window.google?.accounts?.id) {
            google.accounts.id.initialize({
                client_id: this.config.googleClientId,
                callback: window.handleGoogleCredentialResponse
            });
            google.accounts.id.prompt();
        }
    }

    hideGoogleOneTap() {
        if (window.google?.accounts?.id) {
            try {
                google.accounts.id.cancel();
                const googleIframe = document.querySelector('iframe[id^="gsi_"]');
                const parentContainer = googleIframe?.parentElement;
                if (parentContainer) {
                    parentContainer.style.display = 'none';
                    setTimeout(() => parentContainer.remove(), 100);
                }
            } catch (error) {
                console.log('Could not hide Google One Tap prompt.', error);
            }
        }
    }

    async signOut(event) {
        if (event) event.preventDefault();

        const menuToggle = document.getElementById('headerLoginToggle');
        if (menuToggle) { menuToggle.checked = false; }

        try {
            const sessionId = this.getFromStorage('firebaseSessionId');
            if (sessionId) {
                await this.terminateSession(sessionId);
            }
            
            // إرسال إشارة للتبويبات الأخرى
            localStorage.setItem('authStateChanged', Date.now().toString());
            
            await this.firebaseModules.auth.signOut(this.auth);
        } catch (error) {
            this.handleError('فشل تسجيل الخروج', error);
        }
    }
    
    clearUserData() {
        const keysToRemove = ['firebaseSessionId', 'userPhotoURL', 'userDisplayName', 'userEmail', 'userJoinedDate', 'userSessionsHTMLCache'];
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        const sessionsList = document.getElementById('sessions-list');
        if (sessionsList) {
            sessionsList.innerHTML = '';
        }
    }

    navigateTo(event, path) {
        event.preventDefault();
        window.location.href = path;
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) { loadingScreen.classList.add('hidden'); }
    }

    getOperatingSystem() {
        const userAgent = navigator.userAgent;
        const osMap = [
            { pattern: /iPhone|iPad/i, name: 'آي أو إس' },
            { pattern: /Android/i, name: 'أندرويد' },
            { pattern: /Windows/i, name: 'ويندوز' },
            { pattern: /Macintosh|Mac OS/i, name: 'ماك' },
            { pattern: /Linux/i, name: 'لينكس' }
        ];
        for (const os of osMap) {
            if (os.pattern.test(userAgent)) { return os.name; }
        }
        return 'غير معروف';
    }

    async getUserIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip || 'Unknown';
        } catch (error) { 
            console.warn('فشل الحصول على IP:', error); 
            return 'Unknown'; 
        }
    }

    saveToStorage(key, value) {
        try { localStorage.setItem(key, value); }
        catch (error) { console.warn('فشل حفظ البيانات:', error); }
    }

    getFromStorage(key) {
        try { return localStorage.getItem(key); }
        catch (error) { console.warn('فشل قراءة البيانات:', error); return null; }
    }

    handleError(message, error) {
        console.error(`${message}:`, error);
    }
}

// بدء التطبيق فوراً بدون انتظار!
new FirebaseAuthManager();
//]]>
</script>
    
<!--[ التحميل الفوري لبيانات صفحة الحساب ]-->
<script>
//<![CDATA[
(function() {
  try {
    const card = document.querySelector('#account-page .account-card');
    if (!card) return;

    const dataMap = {
      'account-avatar':      { property: 'src',         storageKey: 'userPhotoURL' },
      'account-name':        { property: 'textContent', storageKey: 'userDisplayName' },
      'account-email':       { property: 'textContent', storageKey: 'userEmail' },
      'account-joined-date': { property: 'textContent', storageKey: 'userJoinedDate' },
      'sessions-list':       { property: 'innerHTML',   storageKey: 'userSessionsHTMLCache' }
    };

    for (const id in dataMap) {
      const element = document.getElementById(id);
      const config = dataMap[id];
      const value = localStorage.getItem(config.storageKey);
      if (element && value) {
        if (id === 'account-joined-date') {
          element.textContent = value.includes('انضم في:') ? value : 'انضم في: ' + value;
        } else {
          element[config.property] = value;
        }
      }
    }

    // أظهر البطاقة فوراً
    requestAnimationFrame(() => {
      card.style.opacity = '1';
    });

  } catch (e) {
    console.error(e);
  }
})();
//]]>
</script>
