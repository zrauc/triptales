const API_BASE = "https://triptales-rvym.onrender.com";



const getToken = () => localStorage.getItem('tt_token') || '';
const setToken = (token) => localStorage.setItem('tt_token', token);
const clearToken = () => {
  localStorage.removeItem('tt_token');
  localStorage.removeItem('tt_user');
};
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('tt_user') || 'null');
  } catch {
    return null;
  }
};
const setUser = (user) => localStorage.setItem('tt_user', JSON.stringify(user));
const hasSession = () => Boolean(getToken());
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const apiFetch = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.detail || 'Request failed');
  }
  return data;
};

const initNav = () => {
  const links = document.querySelectorAll('.nav-links a');
  const current = window.location.pathname.split('/').pop();
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href.includes(current)) {
      link.classList.add('active');
    }
  });
};

const initFadeUp = () => {
  const elements = document.querySelectorAll('.fade-up');
  if (!('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  elements.forEach((el) => observer.observe(el));
};

const initThemeToggle = () => {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const ICON_SUN = '☀';
  const ICON_MOON = '🌙';

  const applyTheme = (mode) => {
    const isDark = mode === 'dark';
    document.body.classList.toggle('dark', isDark);
    toggle.textContent = isDark ? ICON_SUN : ICON_MOON;
    toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    toggle.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  };

  const stored = localStorage.getItem('theme');
  applyTheme(stored === 'dark' ? 'dark' : 'light');

  toggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark');
    const next = isDark ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
  });
};

const performSignOut = async () => {
  try {
    if (hasSession()) {
      await apiFetch('/auth/logout', { method: 'POST' });
    }
  } catch {
    // no-op
  }
  clearToken();
  window.location.href = 'login.html';
};

const initSignoutModal = () => {
  let modal = document.getElementById('signout-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'signout-confirm-modal';
    modal.className = 'confirm-modal fixed inset-0 z-50 hidden flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="modal-backdrop absolute inset-0 bg-slate-900/55 backdrop-blur-sm"></div>
      <div class="modal-panel relative z-10 w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/30">
        <h3 class="display-font text-2xl text-slate-900">Sign out?</h3>
        <p class="mt-3 text-sm text-slate-600">You will be signed out of your current session.</p>
        <div class="mt-6 flex justify-end gap-3">
          <button id="signout-cancel-btn" class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
          <button id="signout-confirm-btn" class="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Sign out</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const cancelBtn = document.getElementById('signout-cancel-btn');
  const confirmBtn = document.getElementById('signout-confirm-btn');

  const closeModal = () => {
    modal.classList.remove('is-open');
    window.setTimeout(() => modal.classList.add('hidden'), 180);
    document.body.classList.remove('overflow-hidden');
  };

  const openModal = () => {
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.body.classList.add('overflow-hidden');
  };

  if (!modal.dataset.bound) {
    cancelBtn?.addEventListener('click', closeModal);
    confirmBtn?.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      await performSignOut();
      confirmBtn.disabled = false;
      closeModal();
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.classList.contains('modal-backdrop')) {
        closeModal();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
    modal.dataset.bound = '1';
  }

  return { openModal };
};

const initSessionNav = () => {
  const navLoginLink = document.querySelector('.nav-links a[href="login.html"]');
  const logoutBtn = document.getElementById('logout-btn');
  const { openModal } = initSignoutModal();

  const bindSignout = (el) => {
    if (!el || el.dataset.signoutBound === '1') return;
    el.dataset.signoutBound = '1';
    el.addEventListener('click', (event) => {
      event.preventDefault();
      openModal();
    });
  };

  if (hasSession() && navLoginLink) {
    navLoginLink.textContent = 'Sign out';
    navLoginLink.setAttribute('aria-label', 'Sign out');
    bindSignout(navLoginLink);
  }

  bindSignout(logoutBtn);
};

const initItineraryModal = () => {
  const modal = document.getElementById('itinerary-modal');
  if (!modal) return;

  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalDetails = document.getElementById('modal-details');
  const modalImage = document.getElementById('modal-image');
  const closeButton = document.getElementById('modal-close');

  const renderDetails = (rawText) => {
    const text = String(rawText || '').replace(/\s+/g, ' ').trim();
    modalDetails.innerHTML = '';
    if (!text) return;

    const section = document.createElement('div');
    section.className = 'space-y-3';

    const metaValues = {};
    let remainder = text;
    const metaRegex = /(Best Season|Ideal For|Short)\s*:\s*([^.]*)\.?/gi;
    let match = metaRegex.exec(text);
    while (match) {
      metaValues[match[1].toLowerCase()] = match[2].trim();
      match = metaRegex.exec(text);
    }
    remainder = remainder.replace(metaRegex, '').trim();

    const metaOrder = [
      ['best season', 'Best Season'],
      ['ideal for', 'Ideal For'],
      ['short', 'Overview'],
    ];
    metaOrder.forEach(([key, label]) => {
      const value = metaValues[key];
      if (!value) return;
      const line = document.createElement('p');
      line.className = 'text-sm text-slate-600';
      line.innerHTML = `<span class="font-semibold text-slate-800">${label}:</span> ${escapeHtml(value)}`;
      section.appendChild(line);
    });

    if (remainder) {
      const intro = remainder.split(/Day\s*\d+/i)[0].trim().replace(/[.:\-\s]+$/, '');
      if (intro) {
        const introLine = document.createElement('p');
        introLine.className = 'text-sm text-slate-600';
        introLine.textContent = intro;
        section.appendChild(introLine);
      }

      const dayMatches = [...remainder.matchAll(/(Day\s*\d+(?:\s*-\s*\d+)?)\s*[:\-]\s*([\s\S]*?)(?=(?:Day\s*\d+(?:\s*-\s*\d+)?)\s*[:\-]|$)/gi)];
      if (dayMatches.length) {
        const dayList = document.createElement('ul');
        dayList.className = 'space-y-2';

        dayMatches.forEach((m) => {
          const dayLabel = String(m[1] || '').trim();
          const dayText = String(m[2] || '').trim().replace(/[.:\-\s]+$/, '');
          if (!dayLabel || !dayText) return;

          const item = document.createElement('li');
          item.className = 'text-sm text-slate-600';
          item.innerHTML = `<span class="font-semibold text-slate-800">${escapeHtml(dayLabel)}:</span> ${escapeHtml(dayText)}`;
          dayList.appendChild(item);
        });

        if (dayList.children.length) section.appendChild(dayList);
      } else {
          const sentenceList = remainder
            .split('.')
            .map((s) => s.trim())
            .filter(Boolean);
        if (sentenceList.length) {
          const list = document.createElement('ul');
          list.className = 'space-y-2';
          sentenceList.forEach((lineText) => {
            const item = document.createElement('li');
            item.className = 'text-sm text-slate-600';
            item.textContent = lineText;
            list.appendChild(item);
          });
          section.appendChild(list);
        }
      }
    }

    modalDetails.appendChild(section);
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    window.setTimeout(() => modal.classList.add('hidden'), 180);
    document.body.classList.remove('overflow-hidden');
  };

  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.classList.contains('modal-backdrop')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-modal]');
    if (!button) return;

    modalTitle.textContent = button.dataset.title || '';
    modalMeta.innerHTML = '';

    ['region', 'duration', 'budget', 'status'].forEach((key) => {
      const val = button.dataset[key];
      if (!val) return;
      const span = document.createElement('span');
      span.textContent = val;
      modalMeta.appendChild(span);
    });

    const decodedDetails = decodeURIComponent(button.dataset.details || '');
    renderDetails(decodedDetails);
    modalImage.src = button.dataset.image || '';
    modalImage.alt = button.dataset.title || 'Itinerary image';

    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.body.classList.add('overflow-hidden');
  });
};

const makeCard = (item) => {
  const title = escapeHtml(item.title);
  const imageUrl = escapeHtml(item.image_url);
  const status = escapeHtml(item.status);
  const region = escapeHtml(item.region);
  const duration = Number(item.duration_days);
  const budgetMin = Number(item.budget_min);
  const budgetMax = Number(item.budget_max);
  const detailsEncoded = encodeURIComponent(String(item.details || ''));

  const card = document.createElement('article');
  card.className = 'fade-up overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/70';
  card.innerHTML = `
    <img loading="lazy" src="${imageUrl}" alt="${title}" class="h-56 w-full object-cover" />
    <div class="p-6">
      <span class="inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">${status}</span>
      <h3 class="mt-3 text-xl font-semibold text-slate-900">${title}</h3>
      <div class="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>Region: ${region}</span>
        <span>Duration: ${duration} Days</span>
        <span>Budget: Rs ${budgetMin} - ${budgetMax}</span>
      </div>
      <button
        class="mt-4 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
        data-open-modal="1"
        data-title="${title}"
        data-region="Region: ${region}"
        data-duration="Duration: ${duration} Days"
        data-budget="Budget: Rs ${budgetMin} - ${budgetMax}"
        data-status="Status: ${status}"
        data-image="${imageUrl}"
        data-details="${detailsEncoded}"
      >View details</button>
    </div>
  `;
  return card;
};

const initExplorePage = () => {
  const grid = document.getElementById('explore-grid');
  if (!grid) return;

  const msg = document.getElementById('explore-msg');
  const search = document.getElementById('explore-search');
  const region = document.getElementById('explore-region');
  const apply = document.getElementById('explore-filter-btn');

  let requestId = 0;
  let debounceTimer;

  const load = async () => {
    const currentRequest = ++requestId;
    msg.textContent = 'Loading itineraries...';
    grid.innerHTML = '';
    try {
      const params = new URLSearchParams();
      if (search.value.trim()) params.set('q', search.value.trim());
      if (region.value) params.set('region', region.value);
      const data = await apiFetch(`/itineraries?${params.toString()}`);
      if (currentRequest !== requestId) return;

      if (!data.items.length) {
        msg.textContent = 'No itineraries found for this filter.';
        return;
      }

      msg.textContent = `${data.items.length} itineraries found.`;
      const fragment = document.createDocumentFragment();
      data.items.forEach((item) => fragment.appendChild(makeCard(item)));
      grid.appendChild(fragment);
      initFadeUp();
    } catch (err) {
      if (currentRequest !== requestId) return;
      msg.textContent = err.message;
    }
  };

  apply.addEventListener('click', load);
  search.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(load, 300);
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      load();
    }
  });
  region.addEventListener('change', load);
  load();
};

const initAuthForms = () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  if (!loginForm || !registerForm) return;

  const loginPanel = document.getElementById('auth-login-panel');
  const registerPanel = document.getElementById('auth-register-panel');
  const loginTab = document.getElementById('auth-tab-login');
  const registerTab = document.getElementById('auth-tab-register');
  const showRegisterLink = document.getElementById('show-register-link');
  const showLoginLink = document.getElementById('show-login-link');
  const loginMsg = document.getElementById('login-msg');
  const registerMsg = document.getElementById('register-msg');
  const loginBtn = document.getElementById('login-submit-btn');
  const registerBtn = document.getElementById('register-submit-btn');

  const setAuthMode = (mode) => {
    const showLogin = mode === 'login';
    loginPanel.classList.toggle('hidden', !showLogin);
    registerPanel.classList.toggle('hidden', showLogin);
    loginTab.classList.toggle('is-active', showLogin);
    registerTab.classList.toggle('is-active', !showLogin);
    loginTab.setAttribute('aria-selected', showLogin ? 'true' : 'false');
    registerTab.setAttribute('aria-selected', showLogin ? 'false' : 'true');
    loginMsg.textContent = '';
    registerMsg.textContent = '';
  };

  setAuthMode('login');

  loginTab.addEventListener('click', () => setAuthMode('login'));
  registerTab.addEventListener('click', () => setAuthMode('register'));
  showRegisterLink?.addEventListener('click', () => setAuthMode('register'));
  showLoginLink?.addEventListener('click', () => setAuthMode('login'));

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMsg.textContent = 'Logging in...';
    loginBtn.disabled = true;
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('login-email').value.trim(),
          password: document.getElementById('login-password').value,
        }),
      });
      setToken(data.token);
      setUser(data.user);
      loginMsg.textContent = 'Login successful. Redirecting to home page...';
      const nextPage = 'index.html';
      setTimeout(() => { window.location.href = nextPage; }, 500);
    } catch (err) {
      loginMsg.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
    }
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    registerMsg.textContent = 'Creating account...';
    registerBtn.disabled = true;
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('register-name').value.trim(),
          email: document.getElementById('register-email').value.trim(),
          password: document.getElementById('register-password').value,
        }),
      });
      const registeredEmail = document.getElementById('register-email').value.trim();
      registerMsg.textContent = 'Registration successful. Please login.';
      registerForm.reset();
      document.getElementById('login-email').value = registeredEmail;
      setAuthMode('login');
    } catch (err) {
      registerMsg.textContent = err.message;
    } finally {
      registerBtn.disabled = false;
    }
  });
};

const initAdminPage = () => {
  const sessionInfo = document.getElementById('session-info');
  if (!sessionInfo) return;

  const msg = document.getElementById('admin-msg');
  const logoutBtn = document.getElementById('logout-btn');
  const itineraryForm = document.getElementById('itinerary-form');
  const myBody = document.getElementById('my-itineraries-body');
  const reviewSection = document.getElementById('admin-review-section');
  const reviewBody = document.getElementById('review-body');

  const renderMine = (items) => {
    myBody.innerHTML = '';
    if (!items.length) {
      myBody.innerHTML = '<tr><td class="px-2 py-3" colspan="4">No itineraries yet.</td></tr>';
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const id = Number(item.id);
      const row = document.createElement('tr');
      row.className = 'border-b border-slate-200';
      row.innerHTML = `
        <td class="px-2 py-3">${escapeHtml(item.title)}</td>
        <td class="px-2 py-3">${escapeHtml(item.region)}</td>
        <td class="px-2 py-3">${escapeHtml(item.status)}</td>
        <td class="px-2 py-3">
          <button data-edit-id="${id}" class="mr-2 rounded-full border border-slate-300 px-3 py-1 text-xs">Edit</button>
          <button data-delete-id="${id}" class="rounded-full border border-red-300 px-3 py-1 text-xs text-red-600">Delete</button>
        </td>
      `;
      fragment.appendChild(row);
    });
    myBody.appendChild(fragment);
  };

  const renderReview = (items) => {
    reviewBody.innerHTML = '';
    if (!items.length) {
      reviewBody.innerHTML = '<tr><td class="px-2 py-3" colspan="4">No submissions found.</td></tr>';
      return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const id = Number(item.id);
      const row = document.createElement('tr');
      row.className = 'border-b border-slate-200';
      row.innerHTML = `
        <td class="px-2 py-3">${escapeHtml(item.title)}</td>
        <td class="px-2 py-3">${escapeHtml(item.created_by.name)}</td>
        <td class="px-2 py-3">${escapeHtml(item.status)}</td>
        <td class="px-2 py-3">
          <button data-approve-id="${id}" class="mr-2 rounded-full bg-teal-500 px-3 py-1 text-xs text-white">Approve</button>
          <button data-reject-id="${id}" class="rounded-full border border-slate-300 px-3 py-1 text-xs">Reject</button>
        </td>
      `;
      fragment.appendChild(row);
    });
    reviewBody.appendChild(fragment);
  };

  const payloadFromForm = () => ({
    title: document.getElementById('it-title').value.trim(),
    region: document.getElementById('it-region').value.trim(),
    duration_days: Number(document.getElementById('it-duration').value),
    budget_min: Number(document.getElementById('it-budget-min').value),
    budget_max: Number(document.getElementById('it-budget-max').value),
    image_url: document.getElementById('it-image').value.trim(),
    details: document.getElementById('it-details').value.trim(),
  });

  const loadMine = async () => {
    const data = await apiFetch('/itineraries?mine=true');
    renderMine(data.items);
  };

  const loadReview = async () => {
    const data = await apiFetch('/itineraries?status=pending');
    renderReview(data.items);
  };

  const boot = async () => {
    if (!getToken()) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const me = await apiFetch('/auth/me');
      setUser(me);
      sessionInfo.textContent = `Signed in as ${me.name} (${me.role})`;
      await loadMine();

      if (me.role === 'admin') {
        reviewSection.classList.remove('hidden');
        await loadReview();
      }
    } catch (err) {
      clearToken();
      msg.textContent = err.message;
      setTimeout(() => { window.location.href = 'login.html'; }, 700);
    }
  };

  itineraryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    msg.textContent = 'Submitting itinerary...';
    try {
      await apiFetch('/itineraries', {
        method: 'POST',
        body: JSON.stringify(payloadFromForm()),
      });
      itineraryForm.reset();
      msg.textContent = 'Submitted. Waiting for admin review.';
      await loadMine();
      const me = getUser();
      if (me?.role === 'admin') await loadReview();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  myBody.addEventListener('click', async (event) => {
    const delBtn = event.target.closest('[data-delete-id]');
    const editBtn = event.target.closest('[data-edit-id]');

    if (delBtn) {
      const id = delBtn.dataset.deleteId;
      if (!confirm('Delete this itinerary?')) return;
      try {
        await apiFetch(`/itineraries/${id}`, { method: 'DELETE' });
        msg.textContent = 'Deleted.';
        await loadMine();
      } catch (err) {
        msg.textContent = err.message;
      }
    }

    if (editBtn) {
      const id = editBtn.dataset.editId;
      const title = prompt('New title:');
      if (!title) return;
      try {
        const mine = await apiFetch('/itineraries?mine=true');
        const item = mine.items.find((x) => String(x.id) === String(id));
        if (!item) throw new Error('Itinerary not found');
        await apiFetch(`/itineraries/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...item, title }),
        });
        msg.textContent = 'Updated.';
        await loadMine();
      } catch (err) {
        msg.textContent = err.message;
      }
    }
  });

  reviewBody.addEventListener('click', async (event) => {
    const approve = event.target.closest('[data-approve-id]');
    const reject = event.target.closest('[data-reject-id]');
    const id = approve?.dataset.approveId || reject?.dataset.rejectId;
    if (!id) return;

    const status = approve ? 'approved' : 'rejected';
    try {
      await apiFetch(`/itineraries/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      msg.textContent = `Marked as ${status}.`;
      await loadReview();
      await loadMine();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  boot();
};

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initFadeUp();
  initThemeToggle();
  initSessionNav();
  initItineraryModal();
  initAuthForms();
  initExplorePage();
  initAdminPage();
});
