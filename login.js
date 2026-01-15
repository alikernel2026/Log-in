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
                paths: { home: "/", account: "/p/account.html", login: "/p/login.html" }
            };

            this.icons = {
                clock: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>',
                device: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>',
                location: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                globe: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"></path><path d="M7.99998 3H8.99998C7.04998 8.84 7.04998 15.16 8.99998 21H7.99998"></path><path d="M15 3C16.95 8.84 16.95 15.16 15 21"></path><path d="M3 16V15C8.84 16.95 15.16 16.95 21 15V16"></path><path d="M3 9.0001C8.84 7.0501 15.16 7.0501 21 9.0001"></path></svg>',
                check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4L9 15"></path><path d="M21 19L3 19"></path><path d="M9 15L4 10"></path></svg>'
            };

            // 1. الحقن الفوري للبيانات من الذاكرة (هذا ما يمنع الترميش)
            this.injectStyles();
            this.renderFromCache();

            // 2. إظهار الصفحة فوراً
            document.documentElement.style.visibility = 'visible';
            document.documentElement.style.opacity = '1';

            this.safetyTimer = setTimeout(() => {
                if (!this.pageRevealed) this.revealPage();
            }, 4000);

            this.init();
            this.setupCrossTabSync();
            this.setupBeforeUnload();
        }

        // حقن CSS لإخفاء القوائم فوراً بناءً على الحالة
        injectStyles() {
            const style = document.createElement('style');
            style.innerHTML = `
                body.is-logged-in #guest-menu, body.is-logged-in #profile-icon { display: none !important; }
                body.is-logged-in #user-menu, body.is-logged-in #user-avatar-icon { display: block !important; }
                body.is-guest #user-menu, body.is-guest #user-avatar-icon { display: none !important; }
                body.is-guest #guest-menu, body.is-guest #profile-icon { display: block !important; }
            `;
            document.head.appendChild(style);
        }

        // قراءة البيانات من الكاش وتطبيقها فوراً
        renderFromCache() {
            // التحقق من وجود مفتاح الجلسة
            const hasSession = localStorage.getItem('supabaseSessionId') || localStorage.getItem('last_uid');
            
            if (hasSession) {
                document.body.classList.add('is-logged-in');
                document.body.classList.remove('is-guest');
                
                // استرجاع البيانات المحفوظة
                const cachedName = localStorage.getItem('cached_user_name');
                const cachedEmail = localStorage.getItem('cached_user_email');
                const cachedAvatar = localStorage.getItem('cached_user_avatar');
                const cachedJoin = localStorage.getItem('cached_user_join');
                const cachedSessionsHTML = localStorage.getItem('cached_sessions_html');

                // تطبيق البيانات فوراً في الهيدر
                const headerAv = document.getElementById("user-avatar-icon");
                if (headerAv && cachedAvatar) headerAv.src = cachedAvatar;

                // تطبيق البيانات فوراً في صفحة الحساب
                if (window.location.pathname.includes(this.config.paths.account)) {
                    if (cachedName) document.getElementById("account-name").textContent = cachedName;
                    if (cachedEmail) document.getElementById("account-email").textContent = cachedEmail;
                    if (cachedJoin) document.getElementById("account-joined-date").textContent = cachedJoin;
                    const accAv = document.getElementById("account-avatar");
                    if (accAv && cachedAvatar) accAv.src = cachedAvatar;
                    
                    const list = document.getElementById("sessions-list");
                    // هنا السحر: عرض قائمة الأجهزة فوراً من الكاش
                    if (cachedSessionsHTML && list) {
                        list.innerHTML = cachedSessionsHTML;
                    }
                }
            } else {
                document.body.classList.add('is-guest');
                document.body.classList.remove('is-logged-in');
            }
        }

        async init() {
            try {
                if (!window.supabase || !window.supabase.createClient) {
                    setTimeout(() => this.init(), 100);
                    return;
                }
                this.supabase = window.supabase.createClient(this.config.url, this.config.key);
                
                this.supabase.auth.onAuthStateChange((event) => {
                    if (event === 'SIGNED_OUT') this.handleSmartRedirect();
                    else if (event === 'SIGNED_IN') {
                        document.body.classList.add('is-logged-in');
                        document.body.classList.remove('is-guest');
                    }
                });

                const { data: { user }, error } = await this.supabase.auth.getUser();
                const path = window.location.pathname;

                if (user) {
                    // المستخدم مسجل: تحديث البيانات الحقيقية وتحديث الكاش
                    this.updateAndCacheUserData(user);
                    this.updateHeaderUI(user);
                    this.handleSessionSync(user);
                    this.startGlobalSessionMonitoring(user);
                    
                    if (path.includes(this.config.paths.account)) {
                        await this.setupAccountPage(user);
                        this.startLiveDeviceSync(user);
                    }
                    if (path.includes(this.config.paths.login)) {
                         window.location.href = this.config.paths.home;
                    }
                } else {
                    // زائر: تنظيف الكاش
                    localStorage.removeItem('cached_sessions_html');
                    document.body.classList.add('is-guest');
                    this.setupGoogleOneTap();
                    if (path.includes(this.config.paths.account)) {
                        window.location.href = this.config.paths.login;
                    }
                }
                
                this.bindUserActions();
                this.revealPage();
                this.isInitialized = true;

            } catch (error) {
                console.error(error);
                this.initializationAttempts++;
                if (this.initializationAttempts < this.maxRetries) setTimeout(() => this.init(), 1000);
                else this.revealPage();
            }
        }

        // دالة جديدة لتحديث الكاش
        updateAndCacheUserData(user) {
            const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
            const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
            const email = user.email;
            const joinDate = `انضم في: ${new Date(user.created_at).toLocaleDateString('ar-EG')}`;

            localStorage.setItem('cached_user_name', name);
            localStorage.setItem('cached_user_email', email);
            if (avatar) localStorage.setItem('cached_user_avatar', avatar);
            localStorage.setItem('cached_user_join', joinDate);
        }

        async updateHeaderUI(user) {
            const av = await this.waitForElement("user-avatar-icon");
            if (user && av) {
                const photo = user.user_metadata?.avatar_url || user.user_metadata?.picture;
                if (photo) av.src = photo;
            }
        }

        async setupAccountPage(user) {
            const av = document.getElementById("account-avatar");
            const photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
            this.updateUserInfo(user); // يحدث البيانات على الصفحة
            if (av && photoUrl) av.src = photoUrl;
            await this.refreshSessionsUI(user);
        }

        updateUserInfo(user) {
            const nameEl = document.getElementById("account-name");
            const emailEl = document.getElementById("account-email");
            const joinedEl = document.getElementById("account-joined-date");
            
            const name = localStorage.getItem('cached_user_name');
            const email = localStorage.getItem('cached_user_email');
            const join = localStorage.getItem('cached_user_join');

            if (nameEl && name) nameEl.textContent = name;
            if (emailEl && email) emailEl.textContent = email;
            if (joinedEl && join) joinedEl.textContent = join;
        }

        async refreshSessionsUI(user) {
            try {
                const list = document.getElementById("sessions-list");
                if (!list) return;

                const { data: sessions, error } = await this.supabase
                    .from('sessions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error || !sessions || sessions.length === 0) {
                    list.innerHTML = '<p style="text-align:center;color:#999;">لا توجد جلسات</p>';
                    return;
                }

                const sid = localStorage.getItem("supabaseSessionId");
                
                const html = sessions.map(s => {
                    const isCurr = s.id === sid;
                    const time = new Date(s.created_at).toLocaleString('ar-EG', {
                        hour: 'numeric', minute: 'numeric', hour12: true
                    }).replace('ص', 'صباحاً').replace('م', 'مساءً');

                    const domainLine = s.domain ? 
                        `<div class="session-detail-line">${this.icons.globe} <span>الموقع: ${this.escapeHtml(s.domain)}</span></div>` : '';

                    return `
                    <div class="session-item" id="session-${s.id}">
                        <div class="session-details">
                            <div class="session-detail-line">${this.icons.clock} <span>الوقت: ${time}</span></div>
                            <div class="session-detail-line">${this.icons.device} <span>نظام التشغيل: ${this.escapeHtml(s.os)}</span></div>
                            <div class="session-detail-line">${this.icons.location} <span>العنوان: ${this.escapeHtml(s.ip)}</span></div>
                            ${domainLine}
                            ${isCurr ? `<div class="session-detail-line current-session-indicator">${this.icons.check} <span>جلستك الحالية</span></div>` : ''}
                        </div>
                        <button class="terminate-btn ${isCurr ? 'icon-current' : 'icon-terminate'}" onclick="window.supabaseAuth.handleDeleteSession('${s.id}')"></button>
                    </div>`;
                }).join('');

                list.innerHTML = html;
                
                // حفظ القائمة في الكاش للمرة القادمة
                localStorage.setItem('cached_sessions_html', html);

            } catch (error) { console.error(error); }
        }

        // بقية الدوال الأصلية بالكامل
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        async waitForElement(id, timeout = 5000) {
            return new Promise((resolve) => {
                const el = document.getElementById(id);
                if (el) return resolve(el);
                const observer = new MutationObserver(() => {
                    const target = document.getElementById(id);
                    if (target) { observer.disconnect(); resolve(target); }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
            });
        }

        revealPage() {
            if (this.pageRevealed) return;
            this.pageRevealed = true;
            if (this.safetyTimer) clearTimeout(this.safetyTimer);
            const style = document.getElementById('anti-flicker');
            if (style) style.remove();
            document.documentElement.style.visibility = 'visible';
        }

        setupCrossTabSync() {
            window.addEventListener('storage', (event) => {
                if (event.key === 'last_uid' && event.newValue !== event.oldValue && event.newValue !== null) location.reload();
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
                if (target.innerText.includes("Google")) {
                    e.preventDefault();
                    this.supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
                } else if (target.innerText.includes("GitHub")) {
                    e.preventDefault();
                    this.supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: window.location.origin } });
                }
            }, true);
        }

        async localLogout() {
            try {
                const sid = localStorage.getItem("supabaseSessionId");
                if (sid) await this.supabase.from('sessions').delete().eq('id', sid);
                await this.supabase.auth.signOut();
                this.handleSmartRedirect();
            } catch (e) { this.handleSmartRedirect(); }
        }

        handleSmartRedirect() {
            localStorage.clear(); // مسح كل شيء لتنظيف الكاش أيضاً
            if (window.location.pathname.includes(this.config.paths.account)) window.location.href = this.config.paths.login;
            else location.reload();
        }

        getDeviceFingerprint() {
             // نفس الدالة الأصلية تماماً
             try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top'; ctx.font = '14px Arial'; ctx.fillStyle = '#f60';
                ctx.fillRect(125, 1, 62, 20); ctx.fillStyle = '#069'; ctx.fillText('FP', 2, 15);
                const canvasData = canvas.toDataURL();
                const fpData = [navigator.userAgent, navigator.language, screen.colorDepth, screen.width + 'x' + screen.height, new Date().getTimezoneOffset(), canvasData.substring(0, 100)].join('|');
                let hash = 0;
                for (let i = 0; i < fpData.length; i++) { hash = ((hash << 5) - hash) + fpData.charCodeAt(i); hash = hash & hash; }
                return 'fp_' + Math.abs(hash).toString(36);
            } catch { return 'fp_fallback_' + Date.now().toString(36); }
        }

        async handleSessionSync(user) {
            try {
                localStorage.setItem("last_uid", user.id);
                const fingerprint = this.getDeviceFingerprint();
                const os = this.getOS();
                const { data: existing } = await this.supabase.from('sessions').select('id').eq('user_id', user.id).eq('fingerprint', fingerprint).limit(1);
                
                if (existing && existing.length > 0) {
                    const sid = existing[0].id;
                    const ip = await this.fetchIP();
                    await this.supabase.from('sessions').update({ last_active: new Date().toISOString(), ip, domain: window.location.hostname, os }).eq('id', sid);
                    localStorage.setItem("supabaseSessionId", sid);
                } else {
                    const ip = await this.fetchIP();
                    const { data: newS } = await this.supabase.from('sessions').insert([{ user_id: user.id, os, ip, domain: window.location.hostname, fingerprint, last_active: new Date().toISOString() }]).select();
                    if (newS && newS[0]) localStorage.setItem("supabaseSessionId", newS[0].id);
                }
            } catch (e) {}
        }

        startLiveDeviceSync(user) {
            if (this.channel) this.supabase.removeChannel(this.channel);
            this.channel = this.supabase.channel('sync').on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `user_id=eq.${user.id}` }, (payload) => {
                const sid = localStorage.getItem("supabaseSessionId");
                if (payload.eventType === 'DELETE' && payload.old && payload.old.id === sid) this.handleSmartRedirect();
                else this.refreshSessionsUI(user);
            }).subscribe();
        }

        startGlobalSessionMonitoring(user) {
            const sid = localStorage.getItem("supabaseSessionId");
            if (!sid) return;
            if (this.globalChannel) this.supabase.removeChannel(this.globalChannel);
            this.globalChannel = this.supabase.channel(`session-monitor-${sid}`).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sessions', filter: `id=eq.${sid}` }, () => {
                this.handleSmartRedirect();
            }).subscribe();
        }

        handleDeleteSession(id) {
            if (this._deletingSession) return;
            this.showModalConfirm(id === localStorage.getItem("supabaseSessionId") ? "خروج من هذا الجهاز؟" : "إزالة الجهاز؟", async () => {
                this._deletingSession = true;
                try {
                    if (id === localStorage.getItem("supabaseSessionId")) await this.localLogout();
                    else await this.supabase.from('sessions').delete().eq('id', id);
                } finally { this._deletingSession = false; }
            });
        }

        async fetchIP() {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                if (!res.ok) throw new Error('IP fail');
                return (await res.json()).ip;
            } catch { return "Unknown"; }
        }

        showModalConfirm(msg, cb) {
            // نفس دالة المودال الأصلية تماماً
            const modal = document.getElementById("custom-confirm-modal");
            const text = document.getElementById("custom-modal-text");
            const confirmBtn = document.getElementById("custom-modal-confirm-btn");
            const cancelBtn = document.getElementById("custom-modal-cancel-btn");
            if (!modal) { if (confirm(msg)) cb(); return; }
            text.textContent = msg; modal.classList.remove("hidden");
            const newConfirm = confirmBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            newConfirm.onclick = async () => { modal.classList.add("hidden"); cb(); };
            newCancel.onclick = () => modal.classList.add("hidden");
        }

        setupGoogleOneTap() {
            if (localStorage.getItem("supabase.auth.token")) return;
            try {
                if (!window.google) return;
                google.accounts.id.initialize({
                    client_id: this.config.googleClientId,
                    use_fedcm_for_prompt: false,
                    callback: async (res) => {
                        const { error } = await this.supabase.auth.signInWithIdToken({ provider: 'google', token: res.credential });
                        if (!error) location.reload();
                    },
                    auto_select: false, cancel_on_tap_outside: false
                });
                google.accounts.id.prompt();
            } catch (e) {}
        }

        getOS() {
            const ua = navigator.userAgent;
            if (/Android/i.test(ua)) return "أندرويد";
            if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
            if (/Windows/i.test(ua)) return "ويندوز";
            if (/Macintosh/i.test(ua)) return "ماك";
            if (/Linux/i.test(ua)) return "لينكس";
            return "جهاز غير معروف";
        }
    }

    if (!window.supaStarted) {
        window.supaStarted = true;
        new SupabaseAuthManager();
    }
})();
