// ========================================================
// login.js - الكود الأصلي مع إصلاح التأخير
// ========================================================
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
            this._deletingSession = false;

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

            this.icons = {
                clock: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>',
                device: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>',
                location: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                globe: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"></path><path d="M7.99998 3H8.99998C7.04998 8.84 7.04998 15.16 8.99998 21H7.99998"></path><path d="M15 3C16.95 8.84 16.95 15.16 15 21"></path><path d="M3 16V15C8.84 16.95 15.16 16.95 21 15V16"></path><path d="M3 9.0001C8.84 7.0501 15.16 7.0501 21 9.0001"></path></svg>',
                check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4L9 15"></path><path d="M21 19L3 19"></path><path d="M9 15L4 10"></path></svg>'
            };

            this.init().catch(error => {
                console.error('فشل في التهيئة:', error);
            });

            this.setupCrossTabSync();
            this.setupBeforeUnload();
        }

        async init() {
            try {
                if (!window.supabase || !window.supabase.createClient) {
                    throw new Error('Supabase library not loaded');
                }

                this.supabase = window.supabase.createClient(this.config.url, this.config.key);
                
                this.supabase.auth.onAuthStateChange((event) => {
                    if (event === 'SIGNED_OUT') {
                        this.clearCache(); 
                        this.handleSmartRedirect();
                    }
                });

                const { data: { user }, error } = await this.supabase.auth.getUser();
                
                if (error && error.message !== 'Auth session missing!') {
                    console.error('خطأ:', error);
                }

                const path = window.location.pathname;

                if (user && path.includes(this.config.paths.login)) {
                    this.cacheUserData(user);
                    window.location.href = this.config.paths.home;
                    return;
                }

                if (!user && path.includes(this.config.paths.account)) {
                    window.location.href = this.config.paths.login;
                    return;
                }

                if (user) {
                    this.cacheUserData(user);
                    this.updateHeaderUI(user);
                    this.setupAccountPage(user).catch(e => {}); 
                    this.handleSessionSync(user).catch(e => {});
                    this.startGlobalSessionMonitoring(user);
                } else {
                    this.showGuestUI();
                    this.setupGoogleOneTap();
                }

                this.bindUserActions();
                this.isInitialized = true;

            } catch (error) {
                console.error('خطأ:', error);
                this.initializationAttempts++;
                if (this.initializationAttempts < this.maxRetries) {
                    setTimeout(() => this.init(), 1000);
                }
            }
        }

        cacheUserData(user) {
            const photo = user.user_metadata?.avatar_url || user.user_metadata?.picture;
            const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'مستخدم';
            
            if (photo) localStorage.setItem("userPhotoURL", photo);
            localStorage.setItem("userDisplayName", name);
            localStorage.setItem("userEmail", user.email || '');
            localStorage.setItem("last_uid", user.id);
            
            const date = new Date(user.created_at);
            const formatted = date.toLocaleString('ar-u-nu-latn', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: 'numeric', minute: 'numeric', hour12: true
            }).replace('ص', 'صباحاً').replace('م', 'مساءً');
            localStorage.setItem("userJoinedDate", "انضم في: " + formatted);
        }

        clearCache() {
            localStorage.removeItem("userPhotoURL");
            localStorage.removeItem("userDisplayName");
            localStorage.removeItem("userEmail");
            localStorage.removeItem("userJoinedDate");
            localStorage.removeItem("userSessionsHTMLCache");
            localStorage.removeItem("last_uid");
            localStorage.removeItem("supabaseSessionId");
        }

        showGuestUI() {
            var ic = document.getElementById("profile-icon");
            var av = document.getElementById("user-avatar-icon");
            var um = document.getElementById("user-menu");
            var gm = document.getElementById("guest-menu");
            
            if (ic) { ic.style.display = "block"; ic.classList.remove("hidden"); }
            if (av) { av.style.display = "none"; av.classList.add("hidden"); }
            if (um) um.style.display = "none";
            if (gm) gm.style.display = "block";
        }

        updateHeaderUI(user) {
            var av = document.getElementById("user-avatar-icon");
            var ic = document.getElementById("profile-icon");
            var um = document.getElementById("user-menu");
            var gm = document.getElementById("guest-menu");
            var photo = user.user_metadata?.avatar_url || user.user_metadata?.picture;

            if (photo && av) {
                av.src = photo;
                av.style.display = "block";
                av.classList.remove("hidden");
                if (ic) { ic.style.display = "none"; ic.classList.add("hidden"); }
                if (um) um.style.display = "block";
                if (gm) gm.style.display = "none";
            } else {
                if (av) { av.style.display = "none"; av.classList.add("hidden"); }
                if (ic) { ic.style.display = "block"; ic.classList.remove("hidden"); }
                if (um) um.style.display = "block";
                if (gm) gm.style.display = "none";
            }
        }

        async setupAccountPage(user) {
            try {
                var av = document.getElementById("account-avatar");
                var photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

                if (av && photoUrl) {
                    av.src = photoUrl;
                }

                this.updateUserInfo(user);
                
                var list = document.getElementById("sessions-list");
                if (list) {
                    await this.refreshSessionsUI(user);
                    this.startLiveDeviceSync(user);
                }
            } catch (error) {
                console.error('خطأ إعداد الحساب:', error);
            }
        }

        updateUserInfo(user) {
            try {
                var nameEl = document.getElementById("account-name");
                if (nameEl) {
                    var name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'مستخدم';
                    nameEl.textContent = name;
                }

                var emailEl = document.getElementById("account-email");
                if (emailEl) {
                    emailEl.textContent = user.email || '';
                }

                var joinedEl = document.getElementById("account-joined-date");
                if (joinedEl) {
                    var date = new Date(user.created_at);
                    var formatted = date.toLocaleString('ar-u-nu-latn', {
                        year: 'numeric', month: 'numeric', day: 'numeric',
                        hour: 'numeric', minute: 'numeric', hour12: true
                    }).replace('ص', 'صباحاً').replace('م', 'مساءً');
                    joinedEl.textContent = "انضم في: " + formatted;
                }
            } catch (error) {
                console.error('خطأ المعلومات:', error);
            }
        }

        async refreshSessionsUI(user, forceUpdate) {
            try {
                var list = document.getElementById("sessions-list");
                if (!list) return;

                var { data: sessions, error } = await this.supabase
                    .from('sessions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('خطأ الجلسات:', error);
                    return;
                }

                if (sessions && sessions.length > 0) {
                    var sid = localStorage.getItem("supabaseSessionId");
                    var self = this;
                    var htmlContent = sessions.map(function(s) {
                        var isCurr = s.id === sid;
                        var time = new Date(s.created_at).toLocaleString('ar-u-nu-latn', {
                            hour: 'numeric', minute: 'numeric', hour12: true
                        }).replace('ص', 'AM').replace('م', 'PM');

                        var domainLine = s.domain ? 
                            '<div class="session-detail-line">' + self.icons.globe + ' <span>الموقع: ' + self.escapeHtml(s.domain) + '</span></div>' : 
                            '';

                        return '<div class="session-item" id="session-' + s.id + '">' +
                            '<div class="session-details">' +
                                '<div class="session-detail-line">' + self.icons.clock + ' <span>الوقت: ' + time + '</span></div>' +
                                '<div class="session-detail-line">' + self.icons.device + ' <span>نظام التشغيل: ' + self.escapeHtml(s.os) + '</span></div>' +
                                '<div class="session-detail-line">' + self.icons.location + ' <span>العنوان: ' + self.escapeHtml(s.ip) + '</span></div>' +
                                domainLine +
                                (isCurr ? '<div class="session-detail-line current-session-indicator">' + self.icons.check + ' <span>جلستك الحالية</span></div>' : '') +
                            '</div>' +
                            '<button class="terminate-btn ' + (isCurr ? 'icon-current' : 'icon-terminate') + '" onclick="window.supabaseAuth.handleDeleteSession(\'' + s.id + '\')"></button>' +
                        '</div>';
                    }).join('');

                    localStorage.setItem("userSessionsHTMLCache", htmlContent);
                    list.innerHTML = htmlContent;
                }
            } catch (error) {
                console.error('خطأ تحديث الجلسات:', error);
            }
        }

        escapeHtml(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        setupCrossTabSync() {
            var self = this;
            window.addEventListener('storage', function(event) {
                if (event.key === 'last_uid') {
                    if (event.newValue === null && event.oldValue !== null) {
                        self.showGuestUI();
                    } else if (event.newValue !== event.oldValue && event.newValue !== null) {
                        location.reload();
                    }
                }
            });
        }

        setupBeforeUnload() {
            var self = this;
            window.addEventListener('beforeunload', function() {
                if (self.channel) {
                    try { self.supabase.removeChannel(self.channel); } catch (e) {}
                }
                if (self.globalChannel) {
                    try { self.supabase.removeChannel(self.globalChannel); } catch (e) {}
                }
            });
        }

        bindUserActions() {
            var self = this;
            document.addEventListener('click', function(e) {
                var target = e.target.closest('button, a, #logout-btn');
                if (!target) return;

                if (target.id === "logout-btn" || (target.innerText && target.innerText.indexOf("الخروج") !== -1)) {
                    e.preventDefault();
                    self.localLogout();
                    return;
                }

                // تجاهل Google One Tap
                if (target.closest('#credential_picker_container') || target.closest('[data-g-id]')) {
                    return;
                }

                // أزرار تسجيل الدخول
                if (target.id === "google-signin-btn-popup" || (target.innerText && target.innerText.indexOf("Google") !== -1)) {
                    e.preventDefault();
                    self.loginWithGoogle();
                    return;
                }
                
                if (target.id === "github-signin-btn" || (target.innerText && target.innerText.indexOf("GitHub") !== -1)) {
                    e.preventDefault();
                    self.loginWithGitHub();
                    return;
                }
            }, true);
        }

        loginWithGoogle() {
            this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
        }

        loginWithGitHub() {
            this.supabase.auth.signInWithOAuth({
                provider: 'github',
                options: { redirectTo: window.location.origin }
            });
        }

        async localLogout() {
            try {
                var sid = localStorage.getItem("supabaseSessionId");
                if (sid) {
                    await this.supabase.from('sessions').delete().eq('id', sid);
                }
                
                this.clearCache();
                this.showGuestUI();
                
                await this.supabase.auth.signOut({ scope: 'local' });
                
                var isAcc = window.location.pathname.indexOf(this.config.paths.account) !== -1;
                if (isAcc) {
                    window.location.href = this.config.paths.login;
                } else {
                    location.reload();
                }
            } catch (error) {
                location.reload();
            }
        }

        handleSmartRedirect() {
            var isAcc = window.location.pathname.indexOf(this.config.paths.account) !== -1;
            if (isAcc) {
                window.location.href = this.config.paths.login;
            } else {
                location.reload();
            }
        }

        getDeviceFingerprint() {
            try {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f60';
                ctx.fillRect(125, 1, 62, 20);
                ctx.fillStyle = '#069';
                ctx.fillText('FP', 2, 15);
                var canvasData = canvas.toDataURL();
                var fpData = [
                    navigator.userAgent, navigator.language,
                    navigator.languages ? navigator.languages.join(',') : '',
                    screen.colorDepth, screen.width + 'x' + screen.height,
                    new Date().getTimezoneOffset(), !!window.sessionStorage,
                    !!window.localStorage, navigator.hardwareConcurrency || 0,
                    navigator.deviceMemory || 0, navigator.maxTouchPoints || 0,
                    canvasData.substring(0, 100)
                ].join('|');
                var hash = 0;
                for (var i = 0; i < fpData.length; i++) {
                    var char = fpData.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return 'fp_' + Math.abs(hash).toString(36);
            } catch (error) {
                return 'fp_fallback_' + Date.now().toString(36);
            }
        }

        async handleSessionSync(user) {
            try {
                var fingerprint = this.getDeviceFingerprint();
                var os = this.getOS();
                
                var { data: existingSessions } = await this.supabase
                    .from('sessions')
                    .select('id, fingerprint')
                    .eq('user_id', user.id)
                    .eq('fingerprint', fingerprint)
                    .limit(1);

                if (existingSessions && existingSessions.length > 0) {
                    var sessionId = existingSessions[0].id;
                    var ip = await this.fetchIP();
                    var domain = window.location.hostname;
                    await this.supabase.from('sessions').update({ 
                        last_active: new Date().toISOString(),
                        ip: ip, domain: domain, os: os
                    }).eq('id', sessionId);
                    localStorage.setItem("supabaseSessionId", sessionId);
                } else {
                    var ip = await this.fetchIP();
                    var domain = window.location.hostname;
                    var { data: newSession, error } = await this.supabase.from('sessions').insert([{
                        user_id: user.id, os: os, ip: ip,
                        domain: domain, fingerprint: fingerprint,
                        last_active: new Date().toISOString()
                    }]).select();

                    if (error) console.error('خطأ إنشاء جلسة:', error);
                    if (newSession && newSession[0]) localStorage.setItem("supabaseSessionId", newSession[0].id);
                }
            } catch (error) {
                console.error('خطأ مزامنة:', error);
            }
        }

        startLiveDeviceSync(user) {
            try {
                var self = this;
                if (this.channel) this.supabase.removeChannel(this.channel);

                this.channel = this.supabase.channel('sync')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'sessions',
                        filter: 'user_id=eq.' + user.id
                    }, function(payload) {
                        var sid = localStorage.getItem("supabaseSessionId");
                        if (payload.eventType === 'DELETE' && payload.old && payload.old.id === sid) {
                            self.handleSmartRedirect();
                        } else {
                            self.refreshSessionsUI(user, true);
                        }
                    })
                    .subscribe();
            } catch (error) {
                console.error('خطأ Live Sync:', error);
            }
        }

        startGlobalSessionMonitoring(user) {
            try {
                var self = this;
                var sid = localStorage.getItem("supabaseSessionId");
                if (!sid) return;

                if (this.globalChannel) this.supabase.removeChannel(this.globalChannel);

                this.globalChannel = this.supabase.channel('session-monitor-' + sid)
                    .on('postgres_changes', {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'sessions',
                        filter: 'id=eq.' + sid
                    }, function() {
                        self.handleSmartRedirect();
                    })
                    .subscribe();
            } catch (error) {
                console.error('خطأ Global Monitor:', error);
            }
        }

        handleDeleteSession(id) {
            try {
                if (this._deletingSession) return;
                var self = this;

                var sid = localStorage.getItem("supabaseSessionId");
                var isCurrent = id === sid;

                this.showModalConfirm(
                    isCurrent ? "لا يمكن التراجع عن هذا الإجراء. أنت على وشك إلغاء جلستك الحالية، مما سيؤدي إلى تسجيل خروجك فوراً." : "إزالة هذا الجهاز؟",
                    async function() {
                        if (self._deletingSession) return;
                        self._deletingSession = true;

                        try {
                            if (isCurrent) {
                                await self.localLogout();
                            } else {
                                var { error } = await self.supabase.from('sessions').delete().eq('id', id);
                                if (error) console.error('فشل في الإزالة:', error);
                            }
                        } finally {
                            setTimeout(function() { self._deletingSession = false; }, 1000);
                        }
                    }
                );
            } catch (error) {
                this._deletingSession = false;
            }
        }

        async fetchIP() {
            try {
                var controller = new AbortController();
                var timeoutId = setTimeout(function() { controller.abort(); }, 3000); 
                var res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('IP Fetch Failed');
                var data = await res.json();
                return data.ip || "Unknown";
            } catch (error) {
                return "Unknown";
            }
        }

        showModalConfirm(msg, cb) {
            var modal = document.getElementById("custom-confirm-modal");
            var text = document.getElementById("custom-modal-text");
            var confirmBtn = document.getElementById("custom-modal-confirm-btn");
            var cancelBtn = document.getElementById("custom-modal-cancel-btn");

            if (!modal) {
                if (confirm(msg)) { if (cb) cb(); }
                return;
            }

            text.textContent = msg;
            modal.classList.remove("hidden");

            var newConfirmBtn = confirmBtn.cloneNode(true);
            var newCancelBtn = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            newConfirmBtn.onclick = async function() {
                modal.classList.add("hidden");
                if (cb) {
                    try { await cb(); } catch (error) {}
                }
            };

            newCancelBtn.onclick = function() {
                modal.classList.add("hidden");
            };
        }

        setupGoogleOneTap() {
            try {
                var self = this;
                if (!window.google || !window.google.accounts) return;

                google.accounts.id.initialize({
                    client_id: this.config.googleClientId,
                    callback: async function(response) {
                        try {
                            var { error } = await self.supabase.auth.signInWithIdToken({
                                provider: 'google', token: response.credential
                            });
                            if (!error) {
                                location.reload();
                            }
                        } catch (error) {
                            console.error('Login error:', error);
                        }
                    },
                    auto_select: false,
                    cancel_on_tap_outside: true
                });

                google.accounts.id.prompt();
            } catch (error) {
                console.error('Google One Tap Error:', error);
            }
        }

        getOS() {
            var ua = navigator.userAgent;
            if (/Android/i.test(ua)) return "أندرويد";
            if (/iPhone/i.test(ua)) return "آيفون";
            if (/iPad/i.test(ua)) return "آيباد";
            if (/iPod/i.test(ua)) return "آيبود";
            if (/Windows/i.test(ua)) return "ويندوز";
            if (/Macintosh|Mac OS X/i.test(ua)) return "ماك";
            if (/Linux/i.test(ua)) return "لينكس";
            return "جهاز غير معروف";
        }
    }

    if (!window.supaStarted) {
        window.supaStarted = true;
        new SupabaseAuthManager();
    }
})();
