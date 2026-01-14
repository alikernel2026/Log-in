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
                const timeoutId = setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
                const observer = new MutationObserver(() => {
                    const target = document.getElementById(id);
                    if (target) { clearTimeout(timeoutId); observer.disconnect(); resolve(target); }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
            });
        }

        async init() {
            try {
                if (!window.supabase || !window.supabase.createClient) {
                    throw new Error('Supabase library not loaded');
                }
                this.supabase = window.supabase.createClient(this.config.url, this.config.key);
                this.supabase.auth.onAuthStateChange((event) => {
                    if (event === 'SIGNED_OUT') this.handleSmartRedirect();
                });

                const { data: { user }, error } = await this.supabase.auth.getUser();
                const path = window.location.pathname;

                if (user && path.includes(this.config.paths.login)) {
                    window.location.href = this.config.paths.home;
                    return;
                }
                if (!user && path.includes(this.config.paths.account)) {
                    window.location.href = this.config.paths.login;
                    return;
                }

                const headerReady = this.updateHeaderUI(user);
                
                if (user) {
                    this.handleSessionSync(user).catch(e => console.log('Background sync error', e));
                    this.startGlobalSessionMonitoring(user);
                    if (path.includes(this.config.paths.account)) {
                        await this.setupAccountPage(user);
                        this.startLiveDeviceSync(user);
                    }
                } else {
                    // التعديل هنا: استخدام FedCM بدلاً من الطريقة القديمة لضمان سرعة 100%
                    setTimeout(() => this.setupFedCM(), 1500);
                }

                this.bindUserActions();
                await headerReady;
                this.revealPage();
                this.isInitialized = true;
            } catch (error) {
                console.error('خطأ في التهيئة:', error);
                this.initializationAttempts++;
                if (this.initializationAttempts < this.maxRetries) {
                    setTimeout(() => this.init(), 1000);
                } else {
                    this.revealPage();
                }
            }
        }

        // --- نظام FedCM الجديد المدمج ---
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
            } catch (err) {
                console.warn("FedCM prompt dismissed");
            }
        }

        async updateHeaderUI(user) {
            try {
                const av = await this.waitForElement("user-avatar-icon");
                const ic = document.getElementById("profile-icon");
                const um = document.getElementById("user-menu");
                const gm = document.getElementById("guest-menu");

                if (user && av) {
                    const photo = user.user_metadata?.avatar_url || user.user_metadata?.picture;
                    if (!photo) {
                        if (av) av.style.display = "none";
                        if (ic) ic.style.display = "block";
                        if (um) um.style.display = "block";
                        if (gm) gm.style.display = "none";
                        return Promise.resolve();
                    }

                    return new Promise(resolve => {
                        const timeout = setTimeout(resolve, 2000);
                        av.onload = () => {
                            clearTimeout(timeout);
                            av.style.display = "block";
                            if (ic) ic.style.display = "none";
                            if (um) um.style.display = "block";
                            if (gm) gm.style.display = "none";
                            resolve();
                        };
                        av.onerror = () => {
                            clearTimeout(timeout);
                            if (ic) ic.style.display = "block";
                            resolve();
                        };
                        av.setAttribute('referrerpolicy', 'no-referrer');
                        av.src = photo;
                    });
                } else {
                    if (av) av.style.display = "none";
                    if (ic) ic.style.display = "block";
                    if (um) um.style.display = "none";
                    if (gm) gm.style.display = "block";
                    return Promise.resolve();
                }
            } catch (error) { return Promise.resolve(); }
        }

        async setupAccountPage(user) {
            try {
                const av = document.getElementById("account-avatar");
                const photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
                this.updateUserInfo(user);
                const tasks = [this.refreshSessionsUI(user)];
                if (av && photoUrl) {
                    tasks.push(new Promise(resolve => {
                        const t = setTimeout(resolve, 3000);
                        av.onload = () => { clearTimeout(t); resolve(); };
                        av.onerror = resolve;
                        av.src = photoUrl;
                    }));
                }
                await Promise.all(tasks);
            } catch (error) {}
        }

        updateUserInfo(user) {
            const nameEl = document.getElementById("account-name");
            if (nameEl) nameEl.textContent = user.user_metadata?.full_name || user.email?.split('@')[0] || 'مستخدم';
            const emailEl = document.getElementById("account-email");
            if (emailEl) emailEl.textContent = user.email || '';
            const joinedEl = document.getElementById("account-joined-date");
            if (joinedEl) {
                const date = new Date(user.created_at);
                joinedEl.textContent = `انضم في: ${date.toLocaleDateString('ar-EG')}`;
            }
        }

        async refreshSessionsUI(user) {
            const list = document.getElementById("sessions-list");
            if (!list) return;
            const { data: sessions, error } = await this.supabase.from('sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
            if (error) return;
            const sid = localStorage.getItem("supabaseSessionId");
            list.innerHTML = sessions.map(s => {
                const isCurr = s.id === sid;
                return `
                <div class="session-item" id="session-${s.id}">
                    <div class="session-details">
                        <div class="session-detail-line">${this.icons.device} <span>نظام: ${this.escapeHtml(s.os)}</span></div>
                        <div class="session-detail-line">${this.icons.location} <span>IP: ${this.escapeHtml(s.ip)}</span></div>
                        ${isCurr ? `<div class="session-detail-line current-session-indicator">${this.icons.check} <span>جلستك الحالية</span></div>` : ''}
                    </div>
                    <button class="terminate-btn ${isCurr ? 'icon-current' : 'icon-terminate'}" onclick="window.supabaseAuth.handleDeleteSession('${s.id}')"></button>
                </div>`;
            }).join('');
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        revealPage() {
            if (this.pageRevealed) return;
            this.pageRevealed = true;
            clearTimeout(this.safetyTimer);
            const style = document.getElementById('anti-flicker');
            if (style) style.remove();
            document.documentElement.style.visibility = 'visible';
        }

        setupCrossTabSync() {
            window.addEventListener('storage', (e) => {
                if (e.key === 'last_uid' && e.newValue !== e.oldValue) location.reload();
            });
        }

        setupBeforeUnload() {
            window.addEventListener('beforeunload', () => {
                if (this.channel) this.supabase.removeChannel(this.channel);
                if (this.globalChannel) this.supabase.removeChannel(this.globalChannel);
            });
        }

        bindUserActions() {
            document.addEventListener('click', (e) => {
                const target = e.target.closest('button, a, #logout-btn');
                if (!target) return;
                if (target.id === "logout-btn" || target.innerText.includes("الخروج")) {
                    e.preventDefault();
                    this.localLogout();
                }
            }, true);
        }

        async localLogout() {
            const sid = localStorage.getItem("supabaseSessionId");
            if (sid) await this.supabase.from('sessions').delete().eq('id', sid);
            await this.supabase.auth.signOut({ scope: 'local' });
            this.handleSmartRedirect();
        }

        handleSmartRedirect() {
            localStorage.clear();
            sessionStorage.clear();
            location.reload();
        }

        getDeviceFingerprint() {
            const fpData = [navigator.userAgent, screen.width + 'x' + screen.height, navigator.language].join('|');
            let hash = 0;
            for (let i = 0; i < fpData.length; i++) { hash = ((hash << 5) - hash) + fpData.charCodeAt(i); hash |= 0; }
            return 'fp_' + Math.abs(hash).toString(36);
        }

        async handleSessionSync(user) {
            localStorage.setItem("last_uid", user.id);
            const fingerprint = this.getDeviceFingerprint();
            const ip = await this.fetchIP();
            const { data } = await this.supabase.from('sessions').upsert({
                user_id: user.id, fingerprint, os: this.getOS(), ip, last_active: new Date().toISOString()
            }).select();
            if (data?.[0]) localStorage.setItem("supabaseSessionId", data[0].id);
        }

        startLiveDeviceSync(user) {
            this.channel = this.supabase.channel('sync').on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${user.id}` }, (payload) => {
                const sid = localStorage.getItem("supabaseSessionId");
                if (payload.eventType === 'DELETE' && payload.old?.id === sid) this.handleSmartRedirect();
                else this.refreshSessionsUI(user);
            }).subscribe();
        }

        startGlobalSessionMonitoring(user) {
            const sid = localStorage.getItem("supabaseSessionId");
            if (!sid) return;
            this.globalChannel = this.supabase.channel(`monitor-${sid}`).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sessions', filter: `id=eq.${sid}` }, () => {
                this.handleSmartRedirect();
            }).subscribe();
        }

        handleDeleteSession(id) {
            const sid = localStorage.getItem("supabaseSessionId");
            const isCurrent = id === sid;
            this.showModalConfirm(isCurrent ? "خروج من هذا الجهاز؟" : "إزالة الجهاز؟", async () => {
                if (isCurrent) await this.localLogout();
                else await this.supabase.from('sessions').delete().eq('id', id);
            });
        }

        async fetchIP() {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();
                return data.ip || "Unknown";
            } catch { return "Unknown"; }
        }

        showModalConfirm(msg, cb) {
            const modal = document.getElementById("custom-confirm-modal");
            if (!modal) { if (confirm(msg)) cb(); return; }
            document.getElementById("custom-modal-text").textContent = msg;
            modal.classList.remove("hidden");
            document.getElementById("custom-modal-confirm-btn").onclick = () => { modal.classList.add("hidden"); cb(); };
            document.getElementById("custom-modal-cancel-btn").onclick = () => modal.classList.add("hidden");
        }

        getOS() {
            const ua = navigator.userAgent;
            if (/Android/i.test(ua)) return "أندرويد";
            if (/iPhone|iPad/i.test(ua)) return "iOS";
            if (/Windows/i.test(ua)) return "ويندوز";
            return "جهاز غير معروف";
        }
    }

    if (!window.supaStarted) {
        window.supaStarted = true;
        new SupabaseAuthManager();
    }
})();
