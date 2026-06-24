/* ===================================================
   Tech Navigators — Main Script
   Backend Integration (MySQL, Express, Nodemailer)
   =================================================== */

(function () {
  'use strict';

  // ─── DOM cache ────────────────────────────────
  const form              = document.getElementById('schedule-form');
  const dateInput         = document.getElementById('interview-date');
  const timeInput         = document.getElementById('interview-time');
  const typeSelect        = document.getElementById('interview-type');
  const notesInput        = document.getElementById('interview-notes');
  const interviewList     = document.getElementById('interview-list');
  const toastContainer    = document.getElementById('toast-container');
  const jitsiModal        = document.getElementById('jitsi-modal');
  const jitsiContainer    = document.getElementById('jitsi-container');
  const modalTitle        = document.getElementById('modal-title');
  const mobileToggle      = document.getElementById('mobile-toggle');
  const navLinks          = document.getElementById('nav-links');
  const mainHeader        = document.querySelector('.main-header');
  
  // Auth specific
  const loginForm         = document.getElementById('login-form');
  const registerForm      = document.getElementById('register-form');

  let interviews = [];
  let jitsiApi = null;
  let currentUser = null;

  // ─── Init ──────────────────────────────────────
  async function init() {
    await checkAuth();
    updateNavForAuth();

    // Only load interviews if we are on a protected page and logged in
    if (interviewList) {
      if (currentUser) {
        await loadInterviews();
        renderInterviews();
      } else {
        window.location.href = '/login.html';
      }
    }

    if (form && !currentUser) {
      window.location.href = '/login.html';
    }

    if (dateInput) setMinDate();
    bindEvents();
    initScrollReveal();
    initHeaderScroll();
    initCountUp();
    highlightActiveNav();
  }

  // ─── Auth Checking ─────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        currentUser = await res.json();
      } else {
        currentUser = null;
      }
    } catch (e) {
      currentUser = null;
    }
  }

  function updateNavForAuth() {
    if (!navLinks) return;
    
    // Remove existing login/register/logout buttons
    const ctas = navLinks.querySelectorAll('.nav-cta, .logout-btn');
    ctas.forEach(el => el.remove());

    if (currentUser) {
      const userSpan = document.createElement('span');
      userSpan.className = 'nav-user';
      userSpan.style.color = '#06b6d4';
      userSpan.style.fontWeight = '600';
      userSpan.style.marginRight = '10px';
      userSpan.textContent = `Hi, ${currentUser.name.split(' ')[0]}`;
      navLinks.appendChild(userSpan);

      const scheduleBtn = document.createElement('a');
      scheduleBtn.href = '/schedule.html';
      scheduleBtn.className = 'nav-cta';
      scheduleBtn.textContent = 'Schedule Interview';
      navLinks.appendChild(scheduleBtn);

      const logoutBtn = document.createElement('a');
      logoutBtn.href = '#';
      logoutBtn.className = 'logout-btn';
      logoutBtn.style.color = '#ef4444';
      logoutBtn.style.marginLeft = '10px';
      logoutBtn.textContent = 'Log Out';
      logoutBtn.addEventListener('click', handleLogout);
      navLinks.appendChild(logoutBtn);
    } else {
      const loginBtn = document.createElement('a');
      loginBtn.href = '/login.html';
      loginBtn.className = 'nav-cta';
      loginBtn.style.background = 'rgba(255,255,255,0.1)';
      loginBtn.textContent = 'Log In';
      navLinks.appendChild(loginBtn);

      const registerBtn = document.createElement('a');
      registerBtn.href = '/register.html';
      registerBtn.className = 'nav-cta';
      registerBtn.textContent = 'Register';
      navLinks.appendChild(registerBtn);
    }
  }

  async function handleLogout(e) {
    e.preventDefault();
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (e) {
      console.error('Logout failed', e);
    }
  }

  // ─── Events ────────────────────────────────────
  function bindEvents() {
    if (form) form.addEventListener('submit', handleSchedule);
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    
    const modalCloseBtn = document.getElementById('modal-close');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeJitsiModal);
    
    if (jitsiModal) {
      jitsiModal.addEventListener('click', function (e) {
        if (e.target === jitsiModal) closeJitsiModal();
      });
    }

    if (mobileToggle) {
      mobileToggle.addEventListener('click', function () {
        navLinks.classList.toggle('open');
      });
    }

    document.querySelectorAll('.nav-links a:not(.logout-btn)').forEach(function (a) {
      a.addEventListener('click', function () {
        if (navLinks) navLinks.classList.remove('open');
      });
    });
  }

  function highlightActiveNav() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes(currentPath) && currentPath !== '') {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  function initHeaderScroll() {
    if (!mainHeader) return;
    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        mainHeader.classList.add('scrolled');
      } else {
        mainHeader.classList.remove('scrolled');
      }
    });
  }

  function initCountUp() {
    const stats = document.querySelectorAll('.stat-number[data-count]');
    if (!stats.length) return;
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-count'), 10);
          const suffix = el.getAttribute('data-suffix') || '';
          animateCount(el, 0, target, 2000, suffix);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    stats.forEach(function (s) { observer.observe(s); });
  }

  function animateCount(el, start, end, duration, suffix) {
    const startTime = performance.now();
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      el.textContent = current.toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(function (el) { observer.observe(el); });
    
    setTimeout(() => {
      reveals.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
          el.classList.add('visible');
        }
      });
    }, 100);
  }

  function setMinDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm   = String(today.getMonth() + 1).padStart(2, '0');
    const dd   = String(today.getDate()).padStart(2, '0');
    dateInput.setAttribute('min', yyyy + '-' + mm + '-' + dd);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function formatTime(timeStr) {
    var parts = timeStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ampm;
  }

  // ─── API Integration ───────────────────────────

  async function handleRegister(e) {
    e.preventDefault();
    const btn = registerForm.querySelector('button');
    btn.textContent = 'Registering...';
    btn.disabled = true;

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();

      if (res.ok) {
        showToast(data.message, 'success');
        setTimeout(() => window.location.href = '/login.html', 1500);
      } else {
        showToast(data.error, 'error');
        btn.textContent = 'Register 🚀';
        btn.disabled = false;
      }
    } catch (err) {
      showToast('Connection error', 'error');
      btn.textContent = 'Register 🚀';
      btn.disabled = false;
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const btn = loginForm.querySelector('button');
    btn.textContent = 'Logging in...';
    btn.disabled = true;

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        window.location.href = '/interviews.html';
      } else {
        showToast(data.error, 'error');
        btn.textContent = 'Log In 🔐';
        btn.disabled = false;
      }
    } catch (err) {
      showToast('Connection error', 'error');
      btn.textContent = 'Log In 🔐';
      btn.disabled = false;
    }
  }

  async function loadInterviews() {
    try {
      const res = await fetch('/api/interviews');
      if (res.ok) {
        interviews = await res.json();
      }
    } catch (e) {
      console.error('Failed to load interviews');
    }
  }

  async function handleSchedule(e) {
    e.preventDefault();

    const submitBtn = form.querySelector('.btn-schedule');
    var date  = dateInput.value;
    var time  = timeInput.value;
    var type  = typeSelect.value;
    var notes = notesInput.value.trim();

    if (!date || !time || !type) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    var interviewDateTime = new Date(date + 'T' + time);
    if (interviewDateTime <= new Date()) {
      showToast('Please select a future date and time.', 'error');
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time, type, notes })
      });
      
      const data = await res.json();

      if (res.ok) {
        form.reset();
        showToast('Scheduled! Email sent.', 'success');
        setTimeout(() => {
            window.location.href = '/interviews.html';
        }, 1500);
      } else {
        showToast(data.error || 'Failed to schedule', 'error');
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    } catch (err) {
      showToast('Connection error', 'error');
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  function renderInterviews() {
    if (!interviewList) return;

    if (interviews.length === 0) {
      interviewList.innerHTML =
        '<div class="empty-state">' +
          '<span>📋</span>' +
          '<p>No interviews scheduled yet.<br>Click Schedule Interview to get started!</p>' +
        '</div>';
      return;
    }

    var html = '';
    interviews.forEach(function (iv) {
      var initials = iv.name.split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().substring(0, 2);
      var isLive = checkIfLive(iv.date, iv.time);
      var statusClass = isLive ? 'status-live' : 'status-upcoming';
      var statusText  = isLive ? '● LIVE NOW' : 'Upcoming';

      html +=
        '<div class="interview-item" id="' + iv.id + '">' +
          '<div class="interview-item-left">' +
            '<div class="interview-avatar">' + initials + '</div>' +
            '<div class="interview-details">' +
              '<h5>' + escapeHtml(iv.type) + '</h5>' +
              '<p>📅 ' + formatDate(iv.date) + ' &nbsp;·&nbsp; 🕐 ' + formatTime(iv.time) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="interview-item-right">' +
            '<span class="status-badge ' + statusClass + '">' + statusText + '</span>' +
            '<button class="btn-copy-link" onclick="window.TechNav.copyLink(\'' + iv.jitsi_link + '\')" title="Copy Meeting Link">' +
              '🔗 Link' +
            '</button>' +
            '<button class="btn-join" onclick="window.TechNav.joinInterview(\'' + iv.id + '\')" title="Join via Jitsi Meet">' +
              '🎥 Join' +
            '</button>' +
            '<button class="btn-cancel" onclick="window.TechNav.cancelInterview(\'' + iv.id + '\')" title="Cancel Interview">' +
              '✕' +
            '</button>' +
          '</div>' +
        '</div>';
    });

    interviewList.innerHTML = html;
  }

  function checkIfLive(date, time) {
    // MySQL returns date format that needs proper parsing sometimes, let's ensure it's simple YYYY-MM-DD
    const d = new Date(date).toISOString().split('T')[0];
    var dt = new Date(d + 'T' + time);
    var now = new Date();
    var diff = (now - dt) / 60000; // diff in minutes
    return diff >= -15 && diff <= 60; // 15 min before to 1 hour after
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function copyLink(link) {
    navigator.clipboard.writeText(link).then(function() {
      showToast('Meeting link copied to clipboard!', 'success');
    }).catch(function() {
      showToast('Failed to copy link.', 'error');
    });
  }

  // ─── Join interview via Jitsi ──────────────────
  function joinInterview(id) {
    var iv = interviews.find(function (i) { return i.id === id; });
    if (!iv) {
      showToast('Interview not found.', 'error');
      return;
    }

    openJitsiModal(iv);
  }

  function openJitsiModal(interview) {
    if (!jitsiModal) {
      window.open(interview.jitsi_link, '_blank');
      return;
    }

    jitsiModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (modalTitle) {
      modalTitle.textContent = 'Mock Interview — ' + interview.name + ' (' + interview.type + ')';
    }

    if (typeof JitsiMeetExternalAPI === 'undefined') {
      var script = document.createElement('script');
      script.src = 'https://meet.ffmuc.net/external_api.js';
      script.onload = function () {
        startJitsiMeeting(interview);
      };
      script.onerror = function () {
        window.open(interview.jitsi_link, '_blank');
        closeJitsiModal();
        showToast('Opening interview in a new tab.', 'info');
      };
      document.head.appendChild(script);
    } else {
      startJitsiMeeting(interview);
    }
  }

  function startJitsiMeeting(interview) {
    if (jitsiApi) {
      jitsiApi.dispose();
      jitsiApi = null;
    }

    if(jitsiContainer) jitsiContainer.innerHTML = '';

    try {
      jitsiApi = new JitsiMeetExternalAPI('meet.ffmuc.net', {
        roomName: interview.room_name,
        parentNode: jitsiContainer,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: interview.name,
          email: interview.email
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableDeepLinking: true,
          toolbarButtons: [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'chat', 'raisehand', 'tileview', 'hangup',
            'settings'
          ]
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#0a0e1a',
          TOOLBAR_ALWAYS_VISIBLE: true,
          DISABLE_FOCUS_INDICATOR: true
        }
      });

      jitsiApi.addEventListener('readyToClose', function () {
        closeJitsiModal();
      });

      showToast('Connecting securely...', 'info');
    } catch (err) {
      window.open(interview.jitsi_link, '_blank');
      closeJitsiModal();
      showToast('Opened interview in a new tab instead.', 'info');
    }
  }

  function closeJitsiModal() {
    if(jitsiModal) jitsiModal.classList.remove('active');
    document.body.style.overflow = '';

    if (jitsiApi) {
      jitsiApi.dispose();
      jitsiApi = null;
    }
    if(jitsiContainer) jitsiContainer.innerHTML = '';
  }

  // ─── Cancel interview ──────────────────────────
  async function cancelInterview(id) {
    if(!confirm("Are you sure you want to cancel this interview?")) return;

    try {
        const res = await fetch(`/api/interviews/${id}`, { method: 'DELETE' });
        if (res.ok) {
            var el = document.getElementById(id);
            if (el) {
                el.style.transition = 'all 0.3s ease';
                el.style.opacity = '0';
                el.style.transform = 'translateX(30px)';
            }
            setTimeout(function () {
                interviews = interviews.filter(i => i.id !== id);
                renderInterviews();
                showToast('Interview cancelled.', 'error');
            }, 300);
        } else {
            showToast('Failed to cancel.', 'error');
        }
    } catch (e) {
        showToast('Connection error', 'error');
    }
  }

  function showToast(message, type) {
    if(!toastContainer) return;
    type = type || 'info';
    var icons = { success: '✅', error: '❌', info: 'ℹ️' };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + (icons[type] || '') + '</span> ' + message;
    toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.style.animation = 'toastOut 0.4s ease-out forwards';
      setTimeout(function () {
        toast.remove();
      }, 400);
    }, 4000);
  }

  // ─── Expose global API ─────────────────────────
  window.TechNav = {
    joinInterview: joinInterview,
    cancelInterview: cancelInterview,
    copyLink: copyLink
  };

  // ─── Boot ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

})();
