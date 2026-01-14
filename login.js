<script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'/>
<script async='async' defer='defer' src='https://accounts.google.com/gsi/client'/>

<script>
// <![CDATA[
(function() {
    // 1. حارس الوميض - يعمل فقط على صفحة الأجهزة
    const isAccountPage = window.location.pathname.includes('/p/account.html');
    
    if (isAccountPage) {
        const antiFlickerStyle = document.createElement('style');
        antiFlickerStyle.id = 'anti-flicker';
        antiFlickerStyle.textContent = 'html { visibility: hidden !important; background: #000 !important; }';
        (document.head || document.documentElement).appendChild(antiFlickerStyle);
    }

    class SupabaseAuthManager {
        constructor() {
            window.supabaseAuth = this;
            this.supabase = null;
            this.isInitialized = false;
            this.channel = null;
            this.globalChannel = null;
            this.initializationAttempts = 0;
            this.maxRetries = 3;

            this.config = {
                url: "https://rxevykpywwbqfozjgxti.supabase.co",
                key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZXZ5a3B5d3dicWZvempneHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzAxNjQsImV4cCI6MjA4MjI0NjE2NH0.93uW6maT-L23GQ77HxJoihjIG-DTmciDQlPE3s0b64U",
                googleClientId: "72689337956-olguuh15bua77gq17frsim0o79dj63dq.apps.googleusercontent.com",
                paths: { 
                    home: "/", 
                    account: "/p/account.html", 
                    login: "/p/blog-page_27.html" 
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
                console.error('فشل في تهيئة المصادقة:', error);
                this.revealPage();
            });

            this.setupCrossTabSync();
            this.setupBeforeUnload();
        }

        async waitForElement(id, timeout = 5000) {
            return new Promise((resolve, reject) => {
                const el = document.getElementById(id);
                if (el) return resolve(el);

                const timeoutId = setTimeout(() => {
                    observer.disconnect();
                    resolve(null);
                }, timeout);

                const observer = new MutationObserver(() => {
                    const target = document.getElementById(id);
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

        async init() {
            try {
                if (!window.supabase || !window.supabase.createClient) {
                    throw new Error('Supabase library not loaded');
                }

                this.supabase = window.supabase.createClient(
                    this.config.url, 
                    this.config.key
                );
                
                this.supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_OUT') {
                        this.handleSmartRedirect();
                    }
                });

                const { data: { user }, error } = await this.supabase.auth.getUser();
                
                if (error && error.message !== 'Auth session missing!') {
                    console.error('خطأ في جلب بيانات المستخدم:', error);
                }

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
                    await this.handleSessionSync(user);
                    
                    // ✅ بدء المراقبة العالمية للجلسة
                    this.startGlobalSessionMonitoring(user);
                    
                    if (path.includes(this.config.paths.account)) {
                        await this.setupAccountPage(user);
                        this.startLiveDeviceSync(user);
                    }
                } else {
                    this.setupGoogleOneTap();
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

        async updateHeaderUI(user) {
            try {
                const av = await this.waitForElement("user-avatar-icon");
                const ic = document.getElementById("profile-icon");
                const um = document.getElementById("user-menu");
                const gm = document.getElementById("guest-menu");

                if (user && av) {
                    const photo = user.user_metadata?.avatar_url || 
                                  user.user_metadata?.picture;
                    
                    if (!photo) {
                        if (av) av.style.display = "none";
                        if (ic) ic.style.display = "block";
                        if (um) um.style.display = "block";
                        if (gm) gm.style.display = "none";
                        return Promise.resolve();
                    }

                    return new Promise(resolve => {
                        const timeout = setTimeout(() => {
                            console.warn('تحميل الصورة استغرق وقتاً طويلاً');
                            resolve();
                        }, 3000);

                        av.onload = () => {
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

                        av.onerror = () => {
                            clearTimeout(timeout);
                            console.error('فشل تحميل صورة المستخدم');
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
            try {
                const av = document.getElementById("account-avatar");
                const photoUrl = user.user_metadata?.avatar_url || 
                                 user.user_metadata?.picture;

                this.updateUserInfo(user);

                const tasks = [this.refreshSessionsUI(user)];

                if (av && photoUrl) {
                    const imgPromise = new Promise(resolve => {
                        const timeout = setTimeout(resolve, 3000);
                        av.onload = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                        av.onerror = () => {
                            clearTimeout(timeout);
                            console.error('فشل تحميل صورة الحساب');
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
                const nameEl = document.getElementById("account-name");
                if (nameEl) {
                    const name = user.user_metadata?.full_name || 
                                 user.user_metadata?.name || 
                                 user.email?.split('@')[0] || 
                                 'مستخدم';
                    nameEl.textContent = name;
                }

                const emailEl = document.getElementById("account-email");
                if (emailEl) {
                    emailEl.textContent = user.email || '';
                }

                const joinedEl = document.getElementById("account-joined-date");
                if (joinedEl) {
                    const date = new Date(user.created_at);
                    const formatted = date.toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true
                    }).replace('ص', 'صباحاً').replace('م', 'مساءً');
                    
                    joinedEl.textContent = `انضم في: ${formatted}`;
                }
            } catch (error) {
                console.error('خطأ في تحديث معلومات المستخدم:', error);
            }
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

                if (error) {
                    console.error('خطأ في جلب الجلسات:', error);
                    list.innerHTML = '<p style="text-align:center;color:#999;">فشل في تحميل الجلسات</p>';
                    return;
                }

                if (sessions && sessions.length > 0) {
                    const sid = localStorage.getItem("supabaseSessionId");
                    
                    list.innerHTML = sessions.map(s => {
                        const isCurr = s.id === sid;
                        const time = new Date(s.created_at).toLocaleString('ar-EG', {
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: true
                        }).replace('ص', 'صباحاً').replace('م', 'مساءً');

                        // عرض domain فقط إذا كان موجوداً
                        const domainLine = s.domain ? 
                            `<div class="session-detail-line">${this.icons.globe} <span>الموقع: ${this.escapeHtml(s.domain)}</span></div>` : 
                            '';

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
                } else {
                    list.innerHTML = '<p style="text-align:center;color:#999;">لا توجد جلسات</p>';
                }
            } catch (error) {
                console.error('خطأ في تحديث واجهة الجلسات:', error);
            }
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        revealPage() {
            try {
                const style = document.getElementById('anti-flicker');
                if (style && style.parentNode) {
                    style.parentNode.removeChild(style);
                }
                document.documentElement.style.visibility = 'visible';
            } catch (error) {
                console.error('خطأ في إظهار الصفحة:', error);
                document.documentElement.style.visibility = 'visible';
            }
        }

        setupCrossTabSync() {
            window.addEventListener('storage', (event) => {
                if (event.key === 'last_uid' && 
                    event.newValue !== event.oldValue && 
                    event.newValue !== null) {
                    location.reload();
                }
            });
        }

        setupBeforeUnload() {
            window.addEventListener('beforeunload', () => {
                if (this.channel) {
                    try {
                        this.supabase.removeChannel(this.channel);
                    } catch (error) {
                        console.error('خطأ في تنظيف القناة:', error);
                    }
                }
                if (this.globalChannel) {
                    try {
                        this.supabase.removeChannel(this.globalChannel);
                    } catch (error) {
                        console.error('خطأ في تنظيف القناة العالمية:', error);
                    }
                }
            });
        }

        bindUserActions() {
            document.addEventListener('click', (e) => {
                const target = e.target.closest('button, a, #logout-btn');
                if (!target) return;

                if (target.id === "logout-btn" || 
                    target.innerText.includes("الخروج")) {
                    e.preventDefault();
                    this.localLogout(); // ✅ خروج مباشر بدون تأكيد
                    return;
                }

                if (target.innerText.includes("Google")) {
                    e.preventDefault();
                    this.supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: { 
                            redirectTo: window.location.origin 
                        }
                    }).catch(error => {
                        console.error('خطأ في تسجيل دخول Google:', error);
                        alert('فشل في تسجيل الدخول. حاول مرة أخرى.');
                    });
                }
                
                else if (target.innerText.includes("GitHub")) {
                    e.preventDefault();
                    this.supabase.auth.signInWithOAuth({
                        provider: 'github',
                        options: { 
                            redirectTo: window.location.origin 
                        }
                    }).catch(error => {
                        console.error('خطأ في تسجيل دخول GitHub:', error);
                        alert('فشل في تسجيل الدخول. حاول مرة أخرى.');
                    });
                }
            }, true);
        }

        async localLogout() {
            try {
                const sid = localStorage.getItem("supabaseSessionId");
                
                if (sid) {
                    await this.supabase
                        .from('sessions')
                        .delete()
                        .eq('id', sid);
                }

                await this.supabase.auth.signOut({ scope: 'local' });
                this.handleSmartRedirect();
            } catch (error) {
                console.error('خطأ في تسجيل الخروج:', error);
                this.handleSmartRedirect();
            }
        }

        handleSmartRedirect() {
            try {
                localStorage.clear();
                sessionStorage.clear();

                const isAcc = window.location.pathname.includes(
                    this.config.paths.account
                );

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

        async handleSessionSync(user) {
            try {
                localStorage.setItem("last_uid", user.id);

                const sid = localStorage.getItem("supabaseSessionId");

                if (sid) {
                    const { data, error } = await this.supabase
                        .from('sessions')
                        .select('id')
                        .eq('id', sid)
                        .maybeSingle();

                    if (!error && data) {
                        // الجلسة موجودة، محاولة تحديث domain
                        try {
                            await this.supabase
                                .from('sessions')
                                .update({ domain: window.location.hostname })
                                .eq('id', sid);
                        } catch (updateError) {
                            console.warn('تحديث domain فشل (العمود ربما غير موجود):', updateError);
                        }
                        return;
                    }
                }

                // إنشاء جلسة جديدة
                const ip = await this.fetchIP();
                const os = this.getOS();

                // محاولة الإضافة مع domain أولاً
                let insertData = {
                    user_id: user.id,
                    os: os,
                    ip: ip
                };

                // محاولة إضافة domain
                try {
                    insertData.domain = window.location.hostname;
                    const { data, error } = await this.supabase
                        .from('sessions')
                        .insert([insertData])
                        .select();

                    if (error) throw error;

                    if (data && data[0]) {
                        localStorage.setItem("supabaseSessionId", data[0].id);
                        console.log('✅ تم إنشاء جلسة جديدة مع domain');
                    }
                } catch (domainError) {
                    // إذا فشل مع domain، جرب بدون domain
                    console.warn('فشل الإضافة مع domain، محاولة بدون domain...');
                    delete insertData.domain;
                    
                    const { data, error } = await this.supabase
                        .from('sessions')
                        .insert([insertData])
                        .select();

                    if (error) {
                        console.error('❌ خطأ في إنشاء الجلسة:', error);
                        return;
                    }

                    if (data && data[0]) {
                        localStorage.setItem("supabaseSessionId", data[0].id);
                        console.log('✅ تم إنشاء جلسة جديدة بدون domain');
                    }
                }
            } catch (error) {
                console.error('خطأ في مزامنة الجلسة:', error);
            }
        }

        startLiveDeviceSync(user) {
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
                        filter: `user_id=eq.${user.id}`
                    }, (payload) => {
                        const sid = localStorage.getItem("supabaseSessionId");

                        if (payload.eventType === 'DELETE' && 
                            payload.old && 
                            payload.old.id === sid) {
                            this.handleSmartRedirect();
                        } else {
                            this.refreshSessionsUI(user);
                        }
                    })
                    .subscribe((status) => {
                        if (status === 'SUBSCRIPTION_ERROR') {
                            console.error('خطأ في الاشتراك بالقناة');
                        }
                    });
            } catch (error) {
                console.error('خطأ في بدء المزامنة الفورية:', error);
            }
        }

        // ✅ دالة المراقبة العالمية للجلسة
        startGlobalSessionMonitoring(user) {
            try {
                const sid = localStorage.getItem("supabaseSessionId");
                if (!sid) return;

                if (this.globalChannel) {
                    this.supabase.removeChannel(this.globalChannel);
                }

                this.globalChannel = this.supabase
                    .channel(`session-monitor-${sid}`)
                    .on('postgres_changes', {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'sessions',
                        filter: `id=eq.${sid}`
                    }, () => {
                        console.log('🚨 تم حذف جلستك من موقع آخر');
                        this.handleSmartRedirect();
                    })
                    .subscribe();
            } catch (error) {
                console.error('خطأ في مراقبة الجلسة العالمية:', error);
            }
        }

        handleDeleteSession(id) {
            try {
                if (this._deletingSession) {
                    console.log('عملية حذف جارية بالفعل');
                    return;
                }

                const sid = localStorage.getItem("supabaseSessionId");
                const isCurrent = id === sid;

                this.showModalConfirm(
                    isCurrent ? "خروج من هذا الجهاز؟" : "إزالة الجهاز؟",
                    async () => {
                        if (this._deletingSession) return;
                        this._deletingSession = true;

                        try {
                            if (isCurrent) {
                                await this.localLogout();
                            } else {
                                const { error } = await this.supabase
                                    .from('sessions')
                                    .delete()
                                    .eq('id', id);

                                if (error) {
                                    console.error('خطأ في حذف الجلسة:', error);
                                    alert('فشل في إزالة الجهاز');
                                }
                            }
                        } finally {
                            setTimeout(() => {
                                this._deletingSession = false;
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
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const res = await fetch('https://api.ipify.org?format=json', {
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!res.ok) throw new Error('فشل جلب IP');

                const data = await res.json();
                return data.ip || "Unknown";
            } catch (error) {
                console.warn('فشل في جلب عنوان IP:', error.message);
                return "Unknown";
            }
        }

        showModalConfirm(msg, cb) {
            const modal = document.getElementById("custom-confirm-modal");
            const text = document.getElementById("custom-modal-text");
            const confirmBtn = document.getElementById("custom-modal-confirm-btn");
            const cancelBtn = document.getElementById("custom-modal-cancel-btn");

            if (!modal) {
                if (confirm(msg)) {
                    if (cb) cb();
                }
                return;
            }

            text.textContent = msg;
            modal.classList.remove("hidden");

            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            newConfirmBtn.onclick = async () => {
                modal.classList.add("hidden");
                if (cb) {
                    try {
                        await cb();
                    } catch (error) {
                        console.error('خطأ في تنفيذ الإجراء:', error);
                    }
                }
            };

            newCancelBtn.onclick = () => {
                modal.classList.add("hidden");
            };
        }

        setupGoogleOneTap() {
            try {
                if (!window.google || !window.google.accounts) {
                    console.warn('مكتبة Google لم يتم تحميلها');
                    return;
                }

                if (localStorage.getItem("supabase.auth.token")) {
                    return;
                }

                google.accounts.id.initialize({
                    client_id: this.config.googleClientId,
                    callback: async (response) => {
                        try {
                            const { error } = await this.supabase.auth.signInWithIdToken({
                                provider: 'google',
                                token: response.credential
                            });

                            if (error) {
                                console.error('خطأ في تسجيل الدخول:', error);
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

                google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed()) {
                        console.log('One Tap لم يتم عرضه:', notification.getNotDisplayedReason());
                    }
                    if (notification.isSkippedMoment()) {
                        console.log('One Tap تم تخطيه:', notification.getSkippedReason());
                    }
                });
            } catch (error) {
                console.error('خطأ في إعداد Google One Tap:', error);
            }
        }

        getOS() {
            const ua = navigator.userAgent;
            
            // فحص الهواتف والأجهزة اللوحية أولاً
            if (/Android/i.test(ua)) return "أندرويد";
            if (/iPhone/i.test(ua)) return "آيفون";
            if (/iPad/i.test(ua)) return "آيباد";
            if (/iPod/i.test(ua)) return "آيبود";
            
            // فحص أنظمة الكمبيوتر
            if (/Windows/i.test(ua)) return "ويندوز";
            if (/Macintosh|Mac OS X/i.test(ua)) return "ماك";
            if (/Linux/i.test(ua)) return "لينكس";
            
            // إذا لم يتعرف على النظام
            return "جهاز غير معروف";
        }
    }

    if (!window.supaStarted) {
        window.supaStarted = true;
        new SupabaseAuthManager();
    }
})();
//]]>
</script>  
