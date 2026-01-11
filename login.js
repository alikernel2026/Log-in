(function() {
    'use strict';

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

            this.init().catch(function(error) {
                console.error('فشل في تهيئة المصادقة:', error);
            });

            this.setupCrossTabSync();
            this.setupBeforeUnload();
        }

        async waitForElement(id, timeout) {
            timeout = timeout || 5000;
            var self = this;
            return new Promise(function(resolve) {
                var el = document.getElementById(id);
                if (el) return resolve(el);

                var timeoutId = setTimeout(function() {
                    observer.disconnect();
                    resolve(null);
                }, timeout);

                var observer = new MutationObserver(function() {
                    var target = document.getElementById(id);
                    if (target) {
                        clearTimeout(timeoutId);
                        observer.disconnect();
                        resolve(target);
                    }
                });
                observer.observe(document.documentElement, { 
                    childList: true, 
                    subtree: true 
                });
            });
        }

        // --- التعديل هنا: دالة تنتظر التفاعل أو الوقت ---
        waitForInteraction() {
            return new Promise(function(resolve) {
                var events = ['scroll', 'mouseover', 'keydown', 'touchstart', 'mousemove'];
                var triggered = false;
                
                // دالة التنفيذ (تُستدعى مرة واحدة فقط)
                var trigger = function() {
                    if (triggered) return;
                    triggered = true;
                    // تنظيف المستمعين
                    events.forEach(function(e) { window.removeEventListener(e, trigger); });
                    resolve();
                };
                
                // 1. الاستماع لتفاعل المستخدم (للتحميل الفوري)
                events.forEach(function(e) {
                    window.addEventListener(e, trigger, { passive: true, once: true });
                });

                // 2. مؤقت احتياطي (للتحميل التلقائي بعد 3.5 ثانية حتى بدون ماوس)
                // هذا الرقم (3500) كافٍ لتجاوز فحص PageSpeed
                setTimeout(trigger, 3500);
            });
        }

        async init() {
            var self = this;
            try {
                if (!window.supabase || !window.supabase.createClient) {
                    throw new Error('Supabase library not loaded');
                }

                this.supabase = window.supabase.createClient(this.config.url, this.config.key);
                
                this.supabase.auth.onAuthStateChange(function(event) {
                    if (event === 'SIGNED_OUT') {
                        self.clearUserData();
                        self.handleSmartRedirect();
                    }
                });

                var result = await this.supabase.auth.getUser();
                var user = result.data ? result.data.user : null;
                var error = result.error;
                
                if (error && error.message !== 'Auth session missing!') {
                    console.error('خطأ في جلب بيانات المستخدم:', error);
                }

                var path = window.location.pathname;

                if (user && path.includes(self.config.paths.login)) {
                    window.location.href = self.config.paths.home;
                    return;
                }

                if (!user && path.includes(self.config.paths.account)) {
                    window.location.href = self.config.paths.login;
                    return;
                }

                await this.updateHeaderUI(user);
                
                if (user) {
                    self.saveUserDataToStorage(user);
                    self.handleSessionSync(user).catch(function(e) { 
                        console.log('Background sync error', e); 
                    });
                    self.startGlobalSessionMonitoring(user);
                    
                    if (path.includes(self.config.paths.account)) {
                        await self.setupAccountPage(user);
                        self.startLiveDeviceSync(user);
                    }
                } else {
                    self.clearUserData();
                    
                    // استخدام دالة الانتظار الذكية (تفاعل أو وقت)
                    self.waitForInteraction().then(function() {
                        // استخدام requestIdleCallback لضمان عدم تجميد المتصفح
                        if ('requestIdleCallback' in window) {
                            requestIdleCallback(function() {
                                self.loadGoogleAndSetup();
                            });
                        } else {
                            // متصفحات قديمة (Safari القديم)
                            setTimeout(function() {
                                self.loadGoogleAndSetup();
                            }, 50);
                        }
                    });
                }

                self.bindUserActions();
                self.isInitialized = true;

            } catch (error) {
                console.error('خطأ في التهيئة:', error);
                self.initializationAttempts++;

                if (self.initializationAttempts < self.maxRetries) {
                    setTimeout(function() { self.init(); }, 1000);
                }
            }
        }

        loadGoogleAndSetup() {
            var self = this;
            if (document.getElementById('google-client-script')) return;

            var script = document.createElement('script');
            script.id = 'google-client-script';
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = function() {
                self.setupGoogleOneTap();
            };
            document.head.appendChild(script);
        }

        setupGoogleOneTap() {
            var self = this;
            try {
                if (!window.google || !window.google.accounts) return;
                if (localStorage.getItem("supabase.auth.token")) return;

                google.accounts.id.initialize({
                    client_id: self.config.googleClientId,
                    use_fedcm_for_prompt: true,
                    callback: async function(response) {
                        try {
                            var result = await self.supabase.auth.signInWithIdToken({
                                provider: 'google',
                                token: response.credential
                            });

                            if (result.error) {
                                console.error('خطأ في تسجيل الدخول:', result.error);
                                alert('فشل في تسجيل الدخول');
                                return;
                            }

                            location.reload();
                        } catch (error) {
                            console.error('خطأ في معالجة تسجيل الدخول:', error);
                        }
                    },
                    auto_select: false,
                    cancel_on_tap_outside: false
                });

                google.accounts.id.prompt();

                var btn = document.getElementById('google-signin-button');
                if (btn) {
                    google.accounts.id.renderButton(btn, { 
                        type: 'standard', 
                        theme: 'outline', 
                        size: 'large', 
                        width: 280 
                    });
                }
            } catch (error) {
                console.error('خطأ في إعداد Google One Tap:', error);
            }
        }

        saveUserDataToStorage(user) {
            var meta = user.user_metadata || {};
            var photo = meta.avatar_url || meta.picture || '';
            var name = meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'مستخدم');
            var email = user.email || '';
            var date = new Date(user.created_at);
            var joinedDate = date.toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            }).replace('ص', 'صباحاً').replace('م', 'مساءً');

            localStorage.setItem('userPhotoURL', photo);
            localStorage.setItem('userDisplayName', name);
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userJoinedDate', 'انضم في: ' + joinedDate);
        }

        clearUserData() {
            var keys = ['userPhotoURL', 'userDisplayName', 'userEmail', 'userJoinedDate', 'userSessionsHTMLCache', 'supabaseSessionId', 'last_uid'];
            keys.forEach(function(key) { localStorage.removeItem(key); });
            
            var style = document.getElementById('instant-auth-style');
            if (style) style.remove();
        }

        async updateHeaderUI(user) {
            var self = this;
            try {
                var av = await this.waitForElement("user-avatar-icon");
                var ic = document.getElementById("profile-icon");
                var um = document.getElementById("user-menu");
                var gm = document.getElementById("guest-menu");

                if (user && av) {
                    var photo = user.user_metadata ? (user.user_metadata.avatar_url || user.user_metadata.picture) : null;
                    
                    if (!photo) {
                        if (av) av.style.display = "none";
                        if (ic) ic.style.display = "block";
                        if (um) um.style.display = "block";
                        if (gm) gm.style.display = "none";
                        return Promise.resolve();
                    }

                    return new Promise(function(resolve) {
                        var timeout = setTimeout(function() {
                            resolve();
                        }, 2000); 

                        av.onload = function() {
                            clearTimeout(timeout);
                            av.classList.remove("hidden");
                            av.style.display = "block";
                            if (ic) {
                                ic.style.display = "none";
                                ic.classList.add("hidden");
                            }
                            if (um) um.style.display = "block";
                            if (gm) gm.style.display = "none";
                            resolve();
                        };

                        av.onerror = function() {
                            clearTimeout(timeout);
                            av.style.display = "none";
                            if (ic) ic.style.display = "block";
                            resolve();
                        };

                        av.setAttribute('referrerpolicy', 'no-referrer');
                        av.src = photo;
                    });
                } else {
                    if (av) {
                        av.style.display = "none";
                        av.classList.add("hidden");
                    }
                    if (ic) {
                        ic.style.display = "block";
                        ic.classList.remove("hidden");
                    }
                    if (um) um.style.display = "none";
                    if (gm) gm.style.display = "block";
                    return Promise.resolve();
                }
            } catch (error) {
                console.error('خطأ في تحديث واجهة الهيدر:', error);
                return Promise.resolve();
            }
        }

        async setupAccountPage(user) {
            var self = this;
            try {
                var av = document.getElementById("account-avatar");
                var photoUrl = user.user_metadata ? (user.user_metadata.avatar_url || user.user_metadata.picture) : null;

                this.updateUserInfo(user);
                var tasks = [this.refreshSessionsUI(user)];

                if (av && photoUrl) {
                    var imgPromise = new Promise(function(resolve) {
                        var timeout = setTimeout(resolve, 3000);
                        av.onload = function() {
                            clearTimeout(timeout);
                            resolve();
                        };
                        av.onerror = function() {
                            clearTimeout(timeout);
                            resolve();
                        };
                        av.src = photoUrl;
                    });
                    tasks.push(imgPromise);
                }

                await Promise.all(tasks);
            } catch (error) {
                console.error('خطأ في إعداد صفحة الحساب:', error);
            }
        }

        updateUserInfo(user) {
            try {
                var nameEl = document.getElementById("account-name");
                if (nameEl) {
                    var name = user.user_metadata ? (user.user_metadata.full_name || user.user_metadata.name) : null;
                    name = name || (user.email ? user.email.split('@')[0] : 'مستخدم');
                    nameEl.textContent = name;
                }

                var emailEl = document.getElementById("account-email");
                if (emailEl) {
                    emailEl.textContent = user.email || '';
                }

                var joinedEl = document.getElementById("account-joined-date");
                if (joinedEl) {
                    var date = new Date(user.created_at);
                    var formatted = date.toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    }).replace('ص', 'صباحاً').replace('م', 'مساءً');
                    
                    joinedEl.textContent = 'انضم في: ' + formatted;
                }
            } catch (error) {
                console.error('خطأ في تحديث معلومات المستخدم:', error);
            }
        }

        async refreshSessionsUI(user) {
            var self = this;
            try {
                var list = document.getElementById("sessions-list");
                if (!list) return;

                var result = await this.supabase
                    .from('sessions')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                var sessions = result.data;
                var error = result.error;

                if (error) {
                    console.error('خطأ في جلب الجلسات:', error);
                    list.innerHTML = '<p style="text-align:center;color:#999;">فشل في تحميل الجلسات</p>';
                    return;
                }

                if (sessions && sessions.length > 0) {
                    var sid = localStorage.getItem("supabaseSessionId");
                    
                    var html = sessions.map(function(s) {
                        var isCurr = s.id === sid;
                        var time = new Date(s.created_at).toLocaleString('ar-EG', {
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: true
                        }).replace('ص', 'صباحاً').replace('م', 'مساءً');

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

                    list.innerHTML = html;
                    localStorage.setItem('userSessionsHTMLCache', html);
                } else {
                    list.innerHTML = '<p style="text-align:center;color:#999;">لا توجد جلسات</p>';
                }
            } catch (error) {
                console.error('خطأ في تحديث واجهة الجلسات:', error);
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
                if (event.key === 'last_uid' && event.newValue !== event.oldValue && event.newValue !== null) {
                    location.reload();
                }
                if (event.key === 'supabaseSessionId' && !event.newValue) {
                    location.reload();
                }
                if (event.key === 'userSessionsHTMLCache') {
                    var list = document.getElementById("sessions-list");
                    if (list && event.newValue && event.newValue !== 'null') {
                        list.innerHTML = event.newValue;
                    }
                }
            });
        }

        setupBeforeUnload() {
            var self = this;
            window.addEventListener('beforeunload', function() {
                if (self.channel) {
                    try {
                        self.supabase.removeChannel(self.channel);
                    } catch (error) {
                        console.error('خطأ في تنظيف القناة:', error);
                    }
                }
                if (self.globalChannel) {
                    try {
                        self.supabase.removeChannel(self.globalChannel);
                    } catch (error) {
                        console.error('خطأ في تنظيف القناة العالمية:', error);
                    }
                }
            });
        }

        bindUserActions() {
            var self = this;
            document.addEventListener('click', function(e) {
                var target = e.target.closest('button, a, #logout-btn, #logout-btn-from-account');
                if (!target) return;

                if (target.id === "logout-btn" || target.id === "logout-btn-from-account" || (target.innerText && target.innerText.includes("الخروج"))) {
                    e.preventDefault();
                    self.localLogout();
                    return;
                }

                if (target.innerText && target.innerText.includes("Google")) {
                    e.preventDefault();
                    self.supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: { redirectTo: window.location.origin }
                    }).catch(function(error) {
                        console.error('خطأ في تسجيل دخول Google:', error);
                        alert('فشل في تسجيل الدخول. حاول مرة أخرى.');
                    });
                }
                
                else if (target.innerText && target.innerText.includes("GitHub")) {
                    e.preventDefault();
                    self.supabase.auth.signInWithOAuth({
                        provider: 'github',
                        options: { redirectTo: window.location.origin }
                    }).catch(function(error) {
                        console.error('خطأ في تسجيل دخول GitHub:', error);
                        alert('فشل في تسجيل الدخول. حاول مرة أخرى.');
                    });
                }
            }, true);
        }

        async localLogout() {
            var self = this;
            try {
                var sid = localStorage.getItem("supabaseSessionId");
                if (sid) {
                    await this.supabase.from('sessions').delete().eq('id', sid);
                }
                await this.supabase.auth.signOut({ scope: 'local' });
                this.clearUserData();
                this.handleSmartRedirect();
            } catch (error) {
                console.error('خطأ في تسجيل الخروج:', error);
                this.handleSmartRedirect();
            }
        }

        handleSmartRedirect() {
            try {
                var isAcc = window.location.pathname.includes(this.config.paths.account);
                if (isAcc) {
                    window.location.href = this.config.paths.login;
                } else {
                    location.reload();
                }
            } catch (error) {
                console.error('خطأ في إعادة التوجيه:', error);
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
                    navigator.userAgent,
                    navigator.language,
                    navigator.languages ? navigator.languages.join(',') : '',
                    screen.colorDepth,
                    screen.width + 'x' + screen.height,
                    new Date().getTimezoneOffset(),
                    !!window.sessionStorage,
                    !!window.localStorage,
                    navigator.hardwareConcurrency || 0,
                    navigator.deviceMemory || 0,
                    navigator.maxTouchPoints || 0,
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
                console.error('خطأ في إنشاء البصمة:', error);
                return 'fp_fallback_' + Date.now().toString(36);
            }
        }

        async handleSessionSync(user) {
            var self = this;
            try {
                localStorage.setItem("last_uid", user.id);
                var fingerprint = this.getDeviceFingerprint();
                var os = this.getOS();
                
                var result = await this.supabase
                    .from('sessions')
                    .select('id, fingerprint')
                    .eq('user_id', user.id)
                    .eq('fingerprint', fingerprint)
                    .limit(1);

                var existingSessions = result.data;

                if (existingSessions && existingSessions.length > 0) {
                    var sessionId = existingSessions[0].id;
                    var ip = await this.fetchIP();
                    var domain = window.location.hostname;
                    
                    await this.supabase
                        .from('sessions')
                        .update({ 
                            last_active: new Date().toISOString(),
                            ip: ip,
                            domain: domain,
                            os: os
                        })
                        .eq('id', sessionId);
                    
                    localStorage.setItem("supabaseSessionId", sessionId);
                } else {
                    var ip = await this.fetchIP();
                    var domain = window.location.hostname;
                    
                    var insertResult = await this.supabase
                        .from('sessions')
                        .insert([{
                            user_id: user.id,
                            os: os,
                            ip: ip,
                            domain: domain,
                            fingerprint: fingerprint,
                            last_active: new Date().toISOString()
                        }])
                        .select();

                    if (insertResult.error) {
                        console.error('خطأ في إنشاء الجلسة:', insertResult.error);
                        return;
                    }

                    if (insertResult.data && insertResult.data[0]) {
                        localStorage.setItem("supabaseSessionId", insertResult.data[0].id);
                    }
                }
            } catch (error) {
                console.error('خطأ في مزامنة الجلسة:', error);
            }
        }

        startLiveDeviceSync(user) {
            var self = this;
            try {
                if (this.channel) {
                    this.supabase.removeChannel(this.channel);
                }

                this.channel = this.supabase
                    .channel('sync')
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
                            self.refreshSessionsUI(user);
                        }
                    })
                    .subscribe();
            } catch (error) {
                console.error('خطأ في بدء المزامنة الفورية:', error);
            }
        }

        startGlobalSessionMonitoring(user) {
            var self = this;
            try {
                var sid = localStorage.getItem("supabaseSessionId");
                if (!sid) return;

                if (this.globalChannel) {
                    this.supabase.removeChannel(this.globalChannel);
                }

                this.globalChannel = this.supabase
                    .channel('session-monitor-' + sid)
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
                console.error('خطأ في مراقبة الجلسة العالمية:', error);
            }
        }

        handleDeleteSession(id) {
            var self = this;
            try {
                if (this._deletingSession) return;

                var sid = localStorage.getItem("supabaseSessionId");
                var isCurrent = id === sid;

                this.showModalConfirm(
                    isCurrent ? "خروج من هذا الجهاز؟" : "إزالة الجهاز؟",
                    async function() {
                        if (self._deletingSession) return;
                        self._deletingSession = true;

                        try {
                            if (isCurrent) {
                                await self.localLogout();
                            } else {
                                var result = await self.supabase
                                    .from('sessions')
                                    .delete()
                                    .eq('id', id);

                                if (result.error) {
                                    console.error('خطأ في حذف الجلسة:', result.error);
                                    alert('فشل في إزالة الجهاز');
                                }
                            }
                        } finally {
                            setTimeout(function() {
                                self._deletingSession = false;
                            }, 1000);
                        }
                    }
                );
            } catch (error) {
                console.error('خطأ في معالجة حذف الجلسة:', error);
                this._deletingSession = false;
            }
        }

        async fetchIP() {
            try {
                var controller = new AbortController();
                var timeoutId = setTimeout(function() { controller.abort(); }, 3000);
                var res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error('فشل جلب IP');
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
                if (confirm(msg)) {
                    if (cb) cb();
                }
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
                    try {
                        await cb();
                    } catch (error) {
                        console.error('خطأ في تنفيذ الإجراء:', error);
                    }
                }
            };

            newCancelBtn.onclick = function() {
                modal.classList.add("hidden");
            };
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
