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

            this.icons = {
                clock: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>',
                device: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>',
                location: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                globe: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"></path><path d="M7.99998 3H8.99998C7.04998 8.84 7.04998 15.16 8.99998 21H7.99998"></path><path d="M15 3C16.95 8.84 16.95 15.16 15 21"></path><path d="M3 16V15C8.84 16.95 15.16 16.95 21 15V16"></path><path d="M3 9.0001C8.84 7.0501 15.16 7.0501 21 9.0001"></path></svg>',
                check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4L9 15"></path><path d="M21 19L3 19"></path><path d="M9 15L4 10"></path></svg>'
            };

            // 1. تطبيق الحالة المتفائلة فوراً (قبل تحميل أي شيء)
            this.injectOptimisticStyles();
            this.applyOptimisticState();

            // مؤقت الأمان
            this.safetyTimer = setTimeout(() => {
                if (!this.pageRevealed) {
                    this.revealPage();
                }
            }, 3000);

            // بدء التهيئة الحقيقية
            this.init();
            this.setupCrossTabSync();
            this.setupBeforeUnload();
        }

        // --- جديد: حقن CSS للتحكم في الظهور ومنع الترميش ---
        injectOptimisticStyles() {
            const style = document.createElement('style');
            style.innerHTML = `
                /* إخفاء العناصر المتضاربة بناءً على حالة الجسم */
                body.is-logged-in #guest-menu, 
                body.is-logged-in #profile-icon { display: none !important; }
                body.is-logged-in #user-menu, 
                body.is-logged-in #user-avatar-icon { display: block !important; }

                body.is-guest #user-menu, 
                body.is-guest #user-avatar-icon { display: none !important; }
                body.is-guest #guest-menu, 
                body.is-guest #profile-icon { display: block !important; }

                /* Skeleton Loader for Sessions */
                .session-skeleton {
                    background: #f4f4f5; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;
                    animation: pulse 1.5s infinite;
                }
                .sk-line { height: 10px; background: #e2e8f0; margin-bottom: 8px; border-radius: 4px; }
                .sk-w50 { width: 50%; } .sk-w70 { width: 70%; }
                @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
            `;
            document.head.appendChild(style);
        }

        // --- جديد: تطبيق الحالة من LocalStorage فوراً ---
        applyOptimisticState() {
            // التحقق من وجود جلسة في التخزين المحلي (Supabase يخزن التوكن عادة ببادئة sb-)
            const hasLocalSession = localStorage.getItem('supabaseSessionId') || localStorage.getItem('last_uid') || Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
            
            if (hasLocalSession) {
                document.body.classList.add('is-logged-in');
                document.body.classList.remove('is-guest');
                // إذا كنا في صفحة الحساب، نعرض الهيكل العظمي فوراً
                if (window.location.pathname.includes(this.config.paths.account)) {
                    this.renderSessionSkeleton();
                }
            } else {
                document.body.classList.add('is-guest');
                document.body.classList.remove('is-logged-in');
            }
            // إظهار الصفحة فوراً لأننا حددنا الحالة
            this.revealPage();
        }

        // --- جديد: رسم هيكل التحميل (Skeleton) ---
        renderSessionSkeleton() {
            const list = document.getElementById("sessions-list");
            if (list) {
                let skeletons = '';
                for(let i=0; i<3; i++) {
                    skeletons += `
                        <div class="session-skeleton">
                            <div class="sk-line sk-w50"></div>
                            <div class="sk-line sk-w70"></div>
                            <div class="sk-line sk-w50"></div>
                        </div>
                    `;
                }
                list.innerHTML = skeletons;
            }
        }

        async init() {
            try {
                if (!window.supabase || !window.supabase.createClient) {
                    // الانتظار قليلاً إذا لم يتم تحميل المكتبة بعد
                    setTimeout(() => this.init(), 100);
                    return;
                }

                this.supabase = window.supabase.createClient(this.config.url, this.config.key);
                
                this.supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_OUT') {
                        this.handleSmartRedirect();
                    } else if (event === 'SIGNED_IN') {
                        // تحديث الحالة عند تسجيل الدخول
                        document.body.classList.add('is-logged-in');
                        document.body.classList.remove('is-guest');
                    }
                });

                const { data: { user }, error } = await this.supabase.auth.getUser();
                
                // تصحيح الحالة إذا كان التخزين المحلي خاطئاً
                if (!user) {
                    document.body.classList.add('is-guest');
                    document.body.classList.remove('is-logged-in');
                    if (window.location.pathname.includes(this.config.paths.account)) {
                         window.location.href = this.config.paths.login;
                         return;
                    }
                } else {
                    document.body.classList.add('is-logged-in');
                    document.body.classList.remove('is-guest');
                     if (window.location.pathname.includes(this.config.paths.login)) {
                        window.location.href = this.config.paths.home;
                        return;
                    }
                }

                // تحديث الصورة والمعلومات الحقيقية
                this.updateHeaderUI(user);
                
                if (user) {
                    this.handleSessionSync(user).catch(e => console.log('Sync error', e));
                    this.startGlobalSessionMonitoring(user);
                    
                    if (window.location.pathname.includes(this.config.paths.account)) {
                        await this.setupAccountPage(user);
                        this.startLiveDeviceSync(user);
                    }
                } else {
                    this.setupGoogleOneTap();
                }

                this.bindUserActions();
                this.isInitialized = true;

            } catch (error) {
                console.error('Init error:', error);
                this.initializationAttempts++;
                if (this.initializationAttempts < this.maxRetries) {
                    setTimeout(() => this.init(), 1000);
                }
            }
        }

        async updateHeaderUI(user) {
            const av = document.getElementById("user-avatar-icon");
            if (user && av) {
                const photo = user.user_metadata?.avatar_url || user.user_metadata?.picture;
                if (photo) {
                    av.src = photo; 
                    // الفئات CSS التي أضفناها ستتكفل بالإظهار والإخفاء، لا داعي للتلاعب بالـ style يدوياً هنا لتجنب التعارض
                }
            }
        }

        async setupAccountPage(user) {
            const av = document.getElementById("account-avatar");
            const photoUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

            this.updateUserInfo(user);
            
            if (av && photoUrl) av.src = photoUrl;
            
            // جلب الجلسات الحقيقية واستبدال الهيكل العظمي
            await this.refreshSessionsUI(user);
        }

        updateUserInfo(user) {
            const nameEl = document.getElementById("account-name");
            const emailEl = document.getElementById("account-email");
            const joinedEl = document.getElementById("account-joined-date");

            if (nameEl) nameEl.textContent = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0];
            if (emailEl) emailEl.textContent = user.email || '';
            if (joinedEl) {
                const date = new Date(user.created_at);
                joinedEl.textContent = `انضم في: ${date.toLocaleDateString('ar-EG')}`;
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

                if (error || !sessions || sessions.length === 0) {
                    list.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">لا توجد جلسات نشطة</p>';
                    return;
                }

                const sid = localStorage.getItem("supabaseSessionId");
                
                // بناء HTML الجلسات
                const html = sessions.map(s => {
                    const isCurr = s.id === sid;
                    const time = new Date(s.created_at).toLocaleString('ar-EG', {
                        hour: 'numeric', minute: 'numeric', hour12: true, month: 'numeric', day: 'numeric'
                    });
                    const domainLine = s.domain ? `<div class="session-detail-line">${this.icons.globe} <span>${this.escapeHtml(s.domain)}</span></div>` : '';

                    return `
                    <div class="session-item" id="session-${s.id}">
                        <div class="session-details">
                            <div class="session-detail-line">${this.icons.clock} <span>${time}</span></div>
                            <div class="session-detail-line">${this.icons.device} <span>${this.escapeHtml(s.os)}</span></div>
                            <div class="session-detail-line">${this.icons.location} <span>${this.escapeHtml(s.ip)}</span></div>
                            ${domainLine}
                            ${isCurr ? `<div class="session-detail-line current-session-indicator" style="color:#10b981;font-weight:bold;margin-top:5px;">${this.icons.check} <span>الجلسة الحالية</span></div>` : ''}
                        </div>
                        <button class="terminate-btn ${isCurr ? 'icon-current' : 'icon-terminate'}" onclick="window.supabaseAuth.handleDeleteSession('${s.id}')"></button>
                    </div>`;
                }).join('');

                list.innerHTML = html;

            } catch (error) {
                console.error('Session refresh error:', error);
            }
        }

        escapeHtml(text) {
            if (!text) return '';
            return text.replace(/[&<>"']/g, function(m) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
            });
        }

        revealPage() {
            if (this.pageRevealed) return;
            this.pageRevealed = true;
            if (this.safetyTimer) clearTimeout(this.safetyTimer);
            
            // إزالة أي عناصر إخفاء قديمة
            const style = document.getElementById('anti-flicker');
            if (style) style.remove();
            
            document.documentElement.style.visibility = 'visible';
            document.documentElement.style.opacity = '1';
        }

        setupCrossTabSync() {
            window.addEventListener('storage', (event) => {
                if (event.key === 'last_uid' && event.newValue !== event.oldValue) location.reload();
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
                    return;
                }

                if (target.innerText.includes("Google")) {
                    e.preventDefault();
                    this.supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: { redirectTo: window.location.origin }
                    });
                } else if (target.innerText.includes("GitHub")) {
                    e.preventDefault();
                    this.supabase.auth.signInWithOAuth({
                        provider: 'github',
                        options: { redirectTo: window.location.origin }
                    });
                }
            }, true);
        }

        async localLogout() {
            try {
                const sid = localStorage.getItem("supabaseSessionId");
                if (sid) await this.supabase.from('sessions').delete().eq('id', sid);
                await this.supabase.auth.signOut();
            } catch (e) { console.log(e); }
            this.handleSmartRedirect();
        }

        handleSmartRedirect() {
            localStorage.removeItem('supabaseSessionId');
            localStorage.removeItem('last_uid');
            // لا نحذف كل شيء لتجنب فقدان إعدادات الثيم، نحذف فقط ما يخص المصادقة
            for (let key in localStorage) {
                if (key.startsWith('sb-')) localStorage.removeItem(key);
            }
            
            document.body.classList.remove('is-logged-in');
            document.body.classList.add('is-guest');
            
            if (window.location.pathname.includes(this.config.paths.account)) {
                window.location.href = this.config.paths.login;
            } else {
                location.reload();
            }
        }

        async handleSessionSync(user) {
            // نفس المنطق السابق للمزامنة
            try {
                localStorage.setItem("last_uid", user.id);
                const fingerprint = this.getDeviceFingerprint();
                const os = this.getOS();
                
                const { data: existing } = await this.supabase.from('sessions').select('id').eq('user_id', user.id).eq('fingerprint', fingerprint).limit(1);
                
                const ip = await this.fetchIP();
                const domain = window.location.hostname;

                if (existing && existing.length > 0) {
                    const sid = existing[0].id;
                    await this.supabase.from('sessions').update({ last_active: new Date().toISOString(), ip, domain, os }).eq('id', sid);
                    localStorage.setItem("supabaseSessionId", sid);
                } else {
                    const { data: newS } = await this.supabase.from('sessions').insert([{ user_id: user.id, os, ip, domain, fingerprint, last_active: new Date().toISOString() }]).select();
                    if (newS && newS[0]) localStorage.setItem("supabaseSessionId", newS[0].id);
                }
            } catch (e) {}
        }

        // ... بقية الوظائف المساعدة (getDeviceFingerprint, fetchIP, getOS, showModalConfirm, etc.) تبقى كما هي ...
        // لضمان عدم طول الكود، تأكد من نقل الدوال المساعدة (fetchIP, getDeviceFingerprint, getOS, showModalConfirm, setupGoogleOneTap, startLiveDeviceSync, startGlobalSessionMonitoring, handleDeleteSession) من كودك القديم إلى هنا، فهي لا تؤثر على الترميش.
        
        // سأضيف أهم الدوال المساعدة باختصار ليعمل الكود:
        async fetchIP() { try { const r = await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip; } catch { return 'Unknown'; } }
        getOS() { const ua = navigator.userAgent; if(/Android/i.test(ua))return"أندرويد";if(/iPhone|iPad/i.test(ua))return"iOS";if(/Windows/i.test(ua))return"ويندوز";return"جهاز آخر"; }
        getDeviceFingerprint() { return 'fp_' + navigator.userAgent.length + (screen.width + screen.height); } // بصمة مبسطة للسرعة

        startGlobalSessionMonitoring(user) {
             const sid = localStorage.getItem("supabaseSessionId");
             if(!sid) return;
             this.supabase.channel(`s-${sid}`).on('postgres_changes', {event:'DELETE', schema:'public', table:'sessions', filter:`id=eq.${sid}`}, ()=>this.handleSmartRedirect()).subscribe();
        }
        startLiveDeviceSync(user) {
            this.supabase.channel('sync').on('postgres_changes', {event:'*', schema:'public', table:'sessions', filter:`user_id=eq.${user.id}`}, (payload)=>{
                if(payload.eventType==='DELETE' && payload.old.id === localStorage.getItem("supabaseSessionId")) this.handleSmartRedirect();
                else this.refreshSessionsUI(user);
            }).subscribe();
        }
        
        handleDeleteSession(id) {
            if(!confirm("هل أنت متأكد؟")) return;
            const sid = localStorage.getItem("supabaseSessionId");
            if(id === sid) this.localLogout();
            else this.supabase.from('sessions').delete().eq('id', id).then(this.refreshSessionsUI);
        }

        setupGoogleOneTap() {
            if(localStorage.getItem('sb-access-token')) return; // لا تظهر القائمة إذا كان مسجلاً
             // ... كود جوجل القديم ...
             // تأكد من وضع use_fedcm_for_prompt: false هنا
             try {
                if (!window.google) return;
                google.accounts.id.initialize({
                    client_id: this.config.googleClientId,
                    use_fedcm_for_prompt: false,
                    callback: async (res) => {
                        const { error } = await this.supabase.auth.signInWithIdToken({ provider: 'google', token: res.credential });
                        if (!error) location.reload();
                    }
                });
                google.accounts.id.prompt();
            } catch (e) {}
        }
    }

    if (!window.supaStarted) {
        window.supaStarted = true;
        new SupabaseAuthManager();
    }
})();
