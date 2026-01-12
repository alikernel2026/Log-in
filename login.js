// وظيفة لتحميل سكربت جوجل
function loadGoogleScript() {
  if (document.getElementById('google-jssdk')) return;
  const script = document.createElement('script');
  script.id = 'google-jssdk';
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

loadGoogleScript();

(function() {
    // --- حماية من الوميض (Anti-Flicker) ---
    const antiFlickerStyle = document.createElement('style');
    antiFlickerStyle.id = 'anti-flicker';
    antiFlickerStyle.textContent = 'html { visibility: hidden !important; }';
    (document.head || document.documentElement).appendChild(antiFlickerStyle);

    class SupabaseAuthManager {
        constructor() {
            window.supabaseAuth = this;
            this.supabase = null;
            this.isInitialized = false;
            this.pageRevealed = false;

            this.config = {
                url: "https://rxevykpywwbqfozjgxti.supabase.co",
                key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4ZXZ5a3B5d3dicWZvempneHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzAxNjQsImV4cCI6MjA4MjI0NjE2NH0.93uW6maT-L23GQ77HxJoihjIG-DTmciDQlPE3s0b64U",
                googleClientId: "617149480177-aimcujc67q4307sk43li5m6pr54vj1jv.apps.googleusercontent.com",
                paths: { home: "/", account: "/p/account.html", login: "/p/login.html" }
            };

            // أيقونات الـ UI (كاملة كما كانت)
            this.icons = {
                clock: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6l4 2"></path><circle cx="12" cy="12" r="10"></circle></svg>',
                device: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"></path><path d="M10 19v-3.96 3.15"></path><path d="M7 19h5"></path><rect width="6" height="10" x="16" y="12" rx="2"></rect></svg>',
                location: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                check: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4L9 15"></path><path d="M21 19L3 19"></path><path d="M9 15L4 10"></path></svg>'
            };

            this.init();
        }

        async init() {
            try {
                if (typeof supabase === 'undefined') {
                    setTimeout(() => this.init(), 500);
                    return;
                }
                this.supabase = supabase.createClient(this.config.url, this.config.key);
                
                const { data: { user } } = await this.supabase.auth.getUser();
                const path = window.location.pathname;

                // منع المستخدم المسجل من دخول صفحة Login
                if (user && path.includes(this.config.paths.login)) {
                    window.location.href = this.config.paths.home;
                    return;
                }

                await this.updateHeaderUI(user);
                
                if (user) {
                    await this.handleSessionSync(user);
                    if (path.includes(this.config.paths.account)) {
                        await this.setupAccountPage(user);
                    }
                } else {
                    this.setupGoogleOneTap();
                }

                this.bindUserActions();
                this.revealPage();
            } catch (error) {
                console.error('Initialization Error:', error);
                this.revealPage();
            }
        }

        async updateHeaderUI(user) {
            const av = document.getElementById("user-avatar-icon");
            const ic = document.getElementById("profile-icon");
            const um = document.getElementById("user-menu");
            const gm = document.getElementById("guest-menu");

            if (user) {
                const photo = user.user_metadata?.avatar_url || user.user_metadata?.picture;
                if (av && photo) { av.src = photo; av.style.display = "block"; }
                if (ic) ic.style.display = "none";
                if (um) um.style.display = "block";
                if (gm) gm.style.display = "none";
            } else {
                if (av) av.style.display = "none";
                if (ic) ic.style.display = "block";
                if (um) um.style.display = "none";
                if (gm) gm.style.display = "block";
            }
        }

        // --- نظام الجلسات الكامل (كما في كودك الأصلي) ---
        async handleSessionSync(user) {
            const fingerprint = this.getDeviceFingerprint();
            const ip = await this.fetchIP();
            const { data: existing } = await this.supabase.from('sessions')
                .select('id').eq('user_id', user.id).eq('fingerprint', fingerprint).limit(1);

            if (existing && existing.length > 0) {
                localStorage.setItem("supabaseSessionId", existing[0].id);
            } else {
                const { data: newS } = await this.supabase.from('sessions').insert([{
                    user_id: user.id, os: this.getOS(), ip: ip, fingerprint: fingerprint
                }]).select();
                if (newS) localStorage.setItem("supabaseSessionId", newS[0].id);
            }
        }

        async fetchIP() {
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();
                return data.ip;
            } catch (e) { return "Unknown"; }
        }

        getOS() {
            const ua = navigator.userAgent;
            if (/Android/i.test(ua)) return "أندرويد";
            if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
            if (/Windows/i.test(ua)) return "ويندوز";
            return "جهاز آخر";
        }

        getDeviceFingerprint() {
            return btoa(navigator.userAgent).substring(0, 16);
        }

        setupGoogleOneTap() {
            if (!window.google) return;
            try {
                google.accounts.id.initialize({
                    client_id: this.config.googleClientId,
                    itp_support: true,
                    callback: async (res) => {
                        await this.supabase.auth.signInWithIdToken({ provider: 'google', token: res.credential });
                        location.reload();
                    }
                });
                google.accounts.id.prompt();
            } catch (e) { console.warn("OneTap Error:", e); }
        }

        bindUserActions() {
            document.addEventListener('click', async (e) => {
                const logoutBtn = e.target.closest('#logout-btn');
                if (logoutBtn) {
                    e.preventDefault();
                    await this.supabase.auth.signOut();
                    window.location.href = this.config.paths.login;
                }
            });
        }

        revealPage() {
            const style = document.getElementById('anti-flicker');
            if (style) style.remove();
            document.documentElement.style.visibility = 'visible';
        }
    }

    new SupabaseAuthManager();
})();                        
