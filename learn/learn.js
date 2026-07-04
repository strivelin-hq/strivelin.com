// =========================================================================
// Strivelin Learning Portal — Content Template & Controller
// =========================================================================

let TOPICS = [];

const state = {
  activeTopicId: null,
  activeChapterId: null,
  loadedTopicData: null, // Holds the current stitched chapters html
};

// --- DOM References ---
const nav = document.getElementById('nav');
const topicsList = document.getElementById('topicsList');
const breadcrumbs = document.getElementById('breadcrumbs');
const chapterTitle = document.getElementById('chapterTitle');
const summaryContent = document.getElementById('summaryContent');
const learnSidebar = document.getElementById('learnSidebar');
const sidebarToggle = document.getElementById('sidebarToggle');

// --- Navigation Scroll Effect ---
window.addEventListener('scroll', () => {
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// --- App Navigation and Loading Logic ---
async function initApp() {
  // Mobile drawer trigger listener
  if (sidebarToggle && learnSidebar) {
    sidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      learnSidebar.classList.toggle('open');
      sidebarToggle.classList.toggle('active');
    });

    // Close drawer if clicked outside
    document.addEventListener('click', (e) => {
      if (learnSidebar.classList.contains('open') && !learnSidebar.contains(e.target) && e.target !== sidebarToggle) {
        learnSidebar.classList.remove('open');
        sidebarToggle.classList.remove('active');
      }
    });
  }

  try {
    const response = await fetch('topics.json');
    if (!response.ok) {
      throw new Error(`Failed to load topics: ${response.statusText}`);
    }
    TOPICS = await response.json();
  } catch (error) {
    console.error('Error loading topics:', error);
    if (topicsList) {
      topicsList.innerHTML = `<div class="learn-empty"><p>Error loading learning content. Please try again later.</p></div>`;
    }
    return;
  }

  setupEventListeners();
  loadStateFromUrl();
}

function renderSidebar() {
  if (!topicsList) return;
  topicsList.innerHTML = '';
  
  if (!state.activeTopicId) {
    // Dashboard state: show simplified message
    topicsList.innerHTML = `
      <div class="sidebar-welcome-card">
        <h3>Start Learning</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5; margin-top: var(--space-xs);">Select a topic from the dashboard to begin.</p>
      </div>
    `;
    return;
  }

  const activeTopic = TOPICS.find(t => t.id === state.activeTopicId);
  if (!activeTopic) return;

  const sidebarContainer = document.createElement('div');
  sidebarContainer.className = 'sidebar-active-topic';

  // Back Button
  const backBtn = document.createElement('button');
  backBtn.className = 'back-to-topics-btn';
  backBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
    <span>Back to Topics</span>
  `;
  backBtn.addEventListener('click', () => {
    window.location.hash = '/learn/';
  });
  sidebarContainer.appendChild(backBtn);

  // Topic Title
  const topicTitleEl = document.createElement('h3');
  topicTitleEl.className = 'sidebar-topic-title';
  topicTitleEl.innerHTML = activeTopic.title;
  sidebarContainer.appendChild(topicTitleEl);

  // Sidebar Search Bar
  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'sidebar-search-container';
  searchWrapper.innerHTML = `
    <svg class="sidebar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
    <input type="text" id="sidebarSearch" class="sidebar-search-input" placeholder="Search chapters...">
  `;
  sidebarContainer.appendChild(searchWrapper);

  // Chapters List
  const sublist = document.createElement('ul');
  sublist.className = 'chapters-list-active';

  activeTopic.chapters.forEach(chapter => {
    const item = document.createElement('li');
    item.className = 'chapter-item';
    item.id = `item-${activeTopic.id}-${chapter.id}`;
    
    const link = document.createElement('a');
    link.href = `#/learn/${activeTopic.id}/${chapter.id}`;
    link.className = 'chapter-link';
    link.innerHTML = chapter.title;
    
    link.addEventListener('click', (e) => {
      e.preventDefault();
      selectTopic(activeTopic.id, chapter.id);
    });

    item.appendChild(link);
    sublist.appendChild(item);
  });
  sidebarContainer.appendChild(sublist);

  // Sidebar search input listener
  const sidebarSearch = searchWrapper.querySelector('#sidebarSearch');
  if (sidebarSearch) {
    sidebarSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      sublist.querySelectorAll('.chapter-item').forEach(item => {
        const chapterId = item.id.replace(`item-${activeTopic.id}-`, '');
        const chapter = activeTopic.chapters.find(c => c.id === chapterId);
        if (!chapter) return;

        const isMatch = chapter.title.toLowerCase().includes(query);
        item.style.display = isMatch ? 'block' : 'none';
      });
    });
  }

  topicsList.appendChild(sidebarContainer);
}

// Global variable to keep track of active IntersectionObserver for scroll spy
let scrollSpyObserver = null;

async function selectTopic(topicId, chapterId = null, updateHistory = true) {
  const topic = TOPICS.find(t => t.id === topicId);
  if (!topic) return;

  // Show mobile drawer toggle on topic pages
  if (sidebarToggle) sidebarToggle.style.display = 'flex';

  // Collapse mobile sidebar drawer when selection happens
  if (learnSidebar) learnSidebar.classList.remove('open');
  if (sidebarToggle) sidebarToggle.classList.remove('active');

  const defaultChapterId = topic.chapters.length > 0 ? topic.chapters[0].id : null;
  const targetChapterId = chapterId || defaultChapterId;

  // Update URL Hash
  if (updateHistory && targetChapterId) {
    window.location.hash = `/learn/${topicId}/${targetChapterId}`;
  }

  // If we are switching topics, fetch and stitch the chapters
  if (state.activeTopicId !== topicId) {
    state.activeTopicId = topicId;
    state.activeChapterId = targetChapterId;

    // Render sidebar with active chapters + back button
    renderSidebar();

    // Render breadcrumbs and main title showing loading
    breadcrumbs.innerHTML = `
      <span class="crumb-topic">${topic.title}</span>
    `;
    chapterTitle.innerHTML = topic.title;

    // Show loading skeleton
    summaryContent.innerHTML = `
      <div class="sidebar-skeleton" style="padding: 2rem;">
        <div class="skeleton-line shadow" style="height: 30px; width: 40%; margin-bottom: 2rem;"></div>
        <div class="skeleton-line" style="margin-bottom: 1rem;"></div>
        <div class="skeleton-line" style="margin-bottom: 1rem;"></div>
        <div class="skeleton-line short" style="margin-bottom: 2rem;"></div>
        <div class="skeleton-line shadow" style="height: 30px; width: 30%; margin-bottom: 2rem;"></div>
        <div class="skeleton-line" style="margin-bottom: 1rem;"></div>
        <div class="skeleton-line short"></div>
      </div>
    `;

    try {
      // Fetch all chapter contents in parallel
      const fetchPromises = topic.chapters.map(c =>
        fetch(c.path).then(res => {
          if (!res.ok) throw new Error(`Could not load ${c.title}`);
          return res.text().then(html => ({ ...c, html }));
        })
      );

      const loadedChapters = await Promise.all(fetchPromises);
      state.loadedTopicData = loadedChapters;

      // Stitch chapters and build the single document view with Table of Contents (Index)
      renderStitchedTopic(topic, loadedChapters);
      setupScrollSpy(topicId);

    } catch (err) {
      console.error(err);
      summaryContent.innerHTML = `<div class="learn-empty"><p>Error loading content. Please verify that files exist in the content tree.</p></div>`;
      return;
    }
  }

  // Scroll to the specific chapter section
  if (targetChapterId) {
    state.activeChapterId = targetChapterId;
    updateActiveSidebarItem(topicId, targetChapterId);

    const sectionEl = document.getElementById(`section-${topicId}-${targetChapterId}`);
    if (sectionEl) {
      // Calculate layout nav offset
      const navOffset = 90; 
      const elementPosition = sectionEl.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - navOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }
}

function renderStitchedTopic(topic, chapters) {
  let html = '';

  // Render all chapters stitched together
  chapters.forEach(c => {
    html += `
      <section id="section-${topic.id}-${c.id}" class="chapter-section" data-chapter-id="${c.id}">
        <h2 class="chapter-section-title">${c.title}</h2>
        <div class="glass-card summary-card">
          ${c.html}
        </div>
      </section>
    `;
  });

  summaryContent.innerHTML = html;
}

function updateActiveSidebarItem(topicId, chapterId) {
  document.querySelectorAll('.chapter-item').forEach(item => {
    item.classList.remove('active');
  });

  const activeItem = document.getElementById(`item-${topicId}-${chapterId}`);
  if (activeItem) {
    activeItem.classList.add('active');
  }

  // Update Breadcrumbs
  const topic = TOPICS.find(t => t.id === topicId);
  const chapter = topic?.chapters.find(c => c.id === chapterId);
  if (topic && chapter) {
    breadcrumbs.innerHTML = `
      <span class="crumb-topic">${topic.title}</span>
      <span class="crumb-separator">&rarr;</span>
      <span class="crumb-chapter">${chapter.title}</span>
    `;
    chapterTitle.innerHTML = topic.title; // Keep main heading as the topic title
  }
}

// Scroll Spy to update sidebar active state on scroll
function setupScrollSpy(topicId) {
  if (scrollSpyObserver) {
    scrollSpyObserver.disconnect();
  }

  const sections = document.querySelectorAll('.chapter-section');
  if (sections.length === 0) return;

  const options = {
    root: null,
    rootMargin: '-100px 0px -60% 0px', // Trigger when section is near top of viewport
    threshold: 0
  };

  scrollSpyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const chapterId = entry.target.getAttribute('data-chapter-id');
        state.activeChapterId = chapterId;
        
        // Highlight active chapter in sidebar and breadcrumbs without scrolling or adding history
        updateActiveSidebarItem(topicId, chapterId);
        
        // Update URL hash without causing a page jump
        const newHash = `#/learn/${topicId}/${chapterId}`;
        if (window.location.hash !== newHash) {
          history.replaceState(null, null, newHash);
        }

        // Highlight active link in the index card
        document.querySelectorAll('.index-link').forEach(link => {
          const scrollId = link.getAttribute('data-chapter-scroll');
          link.classList.toggle('active', scrollId === chapterId);
        });
      }
    });
  }, options);

  sections.forEach(section => {
    scrollSpyObserver.observe(section);
  });
}

function showDashboard() {
  state.activeTopicId = null;
  state.activeChapterId = null;
  state.loadedTopicData = null;

  if (scrollSpyObserver) {
    scrollSpyObserver.disconnect();
  }

  // Hide mobile drawer toggle on dashboard
  if (sidebarToggle) sidebarToggle.style.display = 'none';
  if (learnSidebar) learnSidebar.classList.remove('open');

  // Breadcrumbs and Title
  if (breadcrumbs) {
    breadcrumbs.innerHTML = `
      <span class="crumb-topic" style="color: var(--text-muted);">Strivelin Learning Portal</span>
    `;
  }
  if (chapterTitle) {
    chapterTitle.innerHTML = 'What would you like to learn?';
  }

  // Render Sidebar in dashboard state
  renderSidebar();

  // Group topics by category
  const categories = {};
  TOPICS.forEach(topic => {
    const cat = topic.category || 'General';
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(topic);
  });

  let dashboardHtml = `
    <div class="dashboard-welcome">
      <p style="color: var(--text-secondary); line-height: 1.6; font-size: 1.1rem; margin-bottom: var(--space-lg);">Explore curated learning paths, chapters, and summaries. Select a topic card below to begin study.</p>
    </div>
    <div class="search-container">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input type="text" id="dashboardSearch" class="search-input" placeholder="Search topics, categories, descriptions...">
    </div>
  `;

  for (const [category, topics] of Object.entries(categories)) {
    dashboardHtml += `
      <div class="category-section" style="margin-bottom: var(--space-3xl);">
        <h3 class="category-title" style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--accent-blue); margin-bottom: var(--space-md); padding-bottom: var(--space-xs); border-bottom: 1px solid var(--bg-glass-border);">${category}</h3>
        <div class="dashboard-grid">
          ${topics.map(t => {
            const firstChapter = t.chapters.length > 0 ? t.chapters[0].id : '';
            const chapterCountText = `${t.chapters.length} ${t.chapters.length === 1 ? 'Chapter' : 'Chapters'}`;
            return `
              <a href="#/learn/${t.id}/${firstChapter}" class="glass-card topic-card" data-topic-card="${t.id}">
                <div class="topic-card-header">
                  <span class="topic-card-icon">${t.icon || '🎓'}</span>
                  <span class="topic-card-meta">${chapterCountText}</span>
                </div>
                <h4 class="topic-card-title">${t.title}</h4>
                <p class="topic-card-desc">${t.description || ''}</p>
                <div class="topic-card-footer">
                  <span>Start Learning</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  if (summaryContent) {
    summaryContent.innerHTML = dashboardHtml;
    
    // Add real-time filtering to dashboard search input
    const dashboardSearch = document.getElementById('dashboardSearch');
    if (dashboardSearch) {
      dashboardSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.topic-card').forEach(card => {
          const topicId = card.getAttribute('data-topic-card');
          const topic = TOPICS.find(t => t.id === topicId);
          if (!topic) return;
          
          const textToSearch = `${topic.title} ${topic.description || ''} ${topic.category || ''}`.toLowerCase();
          const isMatch = textToSearch.includes(query);
          card.style.display = isMatch ? 'flex' : 'none';
        });

        // Hide categories if all nested topic cards are filtered out
        document.querySelectorAll('.category-section').forEach(section => {
          const cards = section.querySelectorAll('.topic-card');
          const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
          section.style.display = visibleCards.length > 0 ? 'block' : 'none';
        });
      });
    }
    
    // Add click listeners to topic cards
    summaryContent.querySelectorAll('[data-topic-card]').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const topicId = card.getAttribute('data-topic-card');
        const topic = TOPICS.find(t => t.id === topicId);
        const firstChapter = topic && topic.chapters.length > 0 ? topic.chapters[0].id : null;
        selectTopic(topicId, firstChapter);
      });
    });
  }
}

// --- Event Handlers & State Sync ---
function setupEventListeners() {
  window.addEventListener('hashchange', loadStateFromUrl);
}

function loadStateFromUrl() {
  const hash = window.location.hash;
  
  if (hash.startsWith('#/learn/')) {
    const parts = hash.replace('#/learn/', '').split('/');
    if (parts.length >= 2) {
      const topicId = parts[0];
      const chapterId = parts[1];
      
      const topic = TOPICS.find(t => t.id === topicId);
      
      if (topic) {
        selectTopic(topicId, chapterId, false);
        return;
      }
    }
  }

  // Dashboard / All Topics view
  showDashboard();
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);
