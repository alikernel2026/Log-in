(function() {
    class SupabaseAuthManager {
        constructor() {
            window.supabaseAuth = this;
            this.supabase = null;
            this.isInitialized = false;
            this.channel = null;
            this.globalChannel = null;
            this.initializationAttempts = 0;
            this.maxRetries = 3;
            this.pageRevealed = false;

            this.config = {
                url: "https://rxevykpywwbqfozjgxti.supabase.co",
                key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZXZ5a3B5d3dicWZvempneHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzAxNjQsImV4cCI6MjA4MjI0NjE2NH0.93uW6maT-L23GQ77HxJoihjIG-DTmciDQlPE3s0b64U",
                googleClientId: "617149480177-aimcujc67q4307sk43li5m6pr54vj1jv.apps.googleusercontent.com",
                paths: { 
                    home: "/", 
                    account: "/p/account.html", 
                    login: "/p/login.html" 
                }
            };

            this.safetyTimer = setTimeout(() => {
                if (!this.pageRevealed) {
                    this.revealPage();
                }
            }, 4000);

            this.icons = {
                clock: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>',
                device: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>',
                location: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                globe: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"></path><path d="M7.99998 3H8.99998C7.04998 8.84 7.04998 15.16 8.99998 21H7.99998"></path><path d="M15 3C16.95 8.84 16.95 15.16 15 21"></path><path d="M3 16V15C8.84 16.95 15.16 16.95 21 15V16"></path><path d="M3 9.0001C8.84 7.0501 15.16 7.0501 21 9.0001"></path></svg>',
                check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4L9 15"></path><path d="M21 19L3 19"></path><path d="M9 15L4 10"></path></svg>'
            };

            this.init().catch(error => {
                console.error('فشل في تهيئة المصادقة:', error);
                this.revealPage();
            });

            this.setupCrossTabSync();
            this.setupBeforeUnload();
        }

        async waitForElement(id, timeout = 5000) {
            return new Promise((resolve) => {
                const el = document.getElementById(id);
                if (el) return resolve(el);
                const observer = new MutationObserver(() => {
                    const target = document.getElementById(id);
                    if (target) {
                        observer.disconnect();
                        resolve(target);
                    }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
                setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
            });
        }

        async init() {
            try {
                if (!window.supabase) throw new Error('Supabase not loaded');
                this.supabase = window.supabase.createClient(this.config.url, this.config.key);
                
                const { data: { user } } = await this.supabase.auth.getUser();
                const path = window.location.pathname;

                if (user && path.includes(this.config.paths.login)) {
                    window.location.href = this.config.paths.home;
                    return;
                }

                const headerReady = this.updateHeaderUI(user);
                
                if (user) {
                    this.handleSessionSync(user);
                    this.startGlobalSessionMonitoring(user);
                    if (path.includes(this.config.paths.account)) {
                        await this.setupAccountPage(user);
                        this.startLiveDeviceSync(user);
                    }
                } else {
                    // هذا هو التعديل الأساسي: تشغيل FedCM بدلاً من One Tap القديم
                    setTimeout(() => this.setupFedCM(), 1500);
                }

                this.bindUserActions();
                await headerReady;
                this.revealPage();
                this.isInitialized = true;
            } catch (error) {
                this.revealPage();
            }
        }

        async setupFedCM() {
            try {
                if (!window.IdentityCredential) return;
                const credential = await navigator.credentials.get({
                    identity: {
                        context: 'signin',
                        providers: [{
                            configURL: 'https://accounts.google.com/gsi/fedcm.json',
                            clientId: this.config.googleClientId,
                            nonce: btoa(Math.random().toString())
                        }]
                    },
                    mediation: 'optional'
                });
                if (credential) {
                    const { error } = await this.supabase.auth.signInWithIdToken({
                        provider: 'google',
                        token: credential.token
                    });
                    if (!error) location.reload();
                }
            } catch (err) { console.warn("FedCM skipped"); }
        }

        async updateHeaderUI(user) {
            const av = await this.waitForElement("user-avatar-icon");
            const ic = document.getElementById("profile-icon");
            const um = document.getElementById("user-menu");
            const gm = document.getElementById("guest-menu");

            if (user && av) {
                const photo = user.user_metadata?.avatar_url || user.user_metadata?.picture;
                if (photo) {
                    av.src = photo;
                    av.style.display = "block";
                    if (ic) ic.style.display = "none";
                }
                if (um) um.style.display = "block";
                if (gm) gm.style.display = "none";
            } else {
                if (um) um.style.display = "none";
                if (gm) gm.style.display = "block";
            }
        }

        async setupAccountPage(user) {
            const nameEl = document.getElementById("account-name");
            const emailEl = document.getElementById("account-email");
            if (nameEl) nameEl.textContent = user.user_metadata?.full_name || user.email;
            if (emailEl) emailEl.textContent = user.email;
            await this.refreshSessionsUI(user);
        }

        async refreshSessionsUI(user) {
            const list = document.getElementById("sessions-list");
            if (!list) return;
            const { data: sessions } = await this.supabase.from('sessions').select('*').eq('user_id', user.id);
            const sid = localStorage.getItem("supabaseSessionId");
            list.innerHTML = (sessions || []).map(s => `
                <div class="session-item">
                    <span>${this.icons.device} ${s.os}</span>
                    ${s.id === sid ? `<span>(الحالي)</span>` : `<button onclick="window.supabaseAuth.handleDeleteSession('${s.id}')">حذف</button>`}
                </div>`).join('');
        }

        async handleSessionSync(user) {
            const { data } = await this.supabase.from('sessions').upsert({
                user_id: user.id,
                os: navigator.platform,
                ip: 'جاري الجلب...',
                last_active: new Date().toISOString()
            }).select();
            if (data?.[0]) localStorage.setItem("supabaseSessionId", data[0].id);
        }

        async handleDeleteSession(id) {
            await this.supabase.from('sessions').delete().eq('id', id);
            location.reload();
        }

        revealPage() {
            this.pageRevealed = true;
            document.documentElement.style.visibility = 'visible';
            const flicker = document.getElementById('anti-flicker');
            if (flicker) flicker.remove();
        }

        setupCrossTabSync() {
            window.addEventListener('storage', (e) => {
                if (e.key === 'supabase.auth.token') location.reload();
            });
        }

        setupBeforeUnload() {
            window.addEventListener('beforeunload', () => {
                if (this.channel) this.supabase.removeChannel(this.channel);
            });
        }

        bindUserActions() {
            const logoutBtn = document.getElementById("logout-btn");
            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    await this.supabase.auth.signOut();
                    location.reload();
                };
            }
        }

        startGlobalSessionMonitoring(user) { /* مراقبة الجلسة */ }
        startLiveDeviceSync(user) { /* مزامنة حية */ }
    }
    new SupabaseAuthManager();
})();
