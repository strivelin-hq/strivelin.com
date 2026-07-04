// =========================================================================
// Strivelin Learning Portal — Content Template & Controller
// =========================================================================

/**
 * CONTENT TEMPLATE
 * Edit this array to add your own topics, chapters, and summaries.
 * You can write HTML directly inside the `summary` string.
 */
const TOPICS = [
  {
    id: "getting-started",
    title: "Getting Started",
    chapters: [
      {
        id: "welcome",
        title: "Welcome to Strivelin Learn",
        summary: `
          <h2>Welcome to your Learning Portal!</h2>
          <p>This is a premium, interactive template for hosting structured learning content. You can organize your studies, guides, or courseware into <strong>Topics</strong> and <strong>Chapters</strong>.</p>
          
          <blockquote>
            "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice." — Brian Herbert
          </blockquote>

          <h3>How to Customize this Content</h3>
          <p>To replace this welcome template with your own learnings, open the file <code>learn/learn.js</code> in your editor. Locate the <code>TOPICS</code> array at the top of the file and replace it with your custom structure:</p>
          
          <ul>
            <li><strong>id</strong>: A unique, URL-safe identifier (e.g., <code>"ai-engineering"</code>).</li>
            <li><strong>title</strong>: The text displayed in the sidebar and headers.</li>
            <li><strong>summary</strong>: Rich HTML content containing the key takeaways of the chapter.</li>
          </ul>

          <p>Once updated, you can commit your changes and push them to GitHub. Cloudflare Pages will automatically rebuild and host your new learning modules!</p>
        `
      }
    ]
  }
];

// =========================================================================
// App State Controller
// =========================================================================

const state = {
  activeTopicId: null,
  activeChapterId: null,
};

// --- DOM References ---
const nav = document.getElementById('nav');
const topicsList = document.getElementById('topicsList');
const breadcrumbs = document.getElementById('breadcrumbs');
const chapterTitle = document.getElementById('chapterTitle');
const summaryContent = document.getElementById('summaryContent');

// --- Navigation Scroll Effect ---
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// --- App Navigation and Loading Logic ---
function initApp() {
  renderSidebar();
  setupEventListeners();
  loadStateFromUrl();
}

function renderSidebar() {
  topicsList.innerHTML = '';
  
  if (TOPICS.length === 0) {
    topicsList.innerHTML = `<div class="learn-empty"><p>No topics configured.</p></div>`;
    return;
  }

  TOPICS.forEach(topic => {
    const topicGroup = document.createElement('div');
    topicGroup.className = 'topic-group';
    topicGroup.id = `group-${topic.id}`;

    const header = document.createElement('button');
    header.className = 'topic-header';
    header.innerHTML = `
      <span>${topic.title}</span>
      <svg class="topic-toggle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    `;

    const sublist = document.createElement('ul');
    sublist.className = 'chapters-list';

    topic.chapters.forEach(chapter => {
      const item = document.createElement('li');
      item.className = 'chapter-item';
      item.id = `item-${topic.id}-${chapter.id}`;
      
      const link = document.createElement('a');
      link.href = `#/learn/${topic.id}/${chapter.id}`;
      link.className = 'chapter-link';
      link.textContent = chapter.title;
      
      link.addEventListener('click', (e) => {
        e.preventDefault();
        selectChapter(topic.id, chapter.id);
      });

      item.appendChild(link);
      sublist.appendChild(item);
    });

    // Toggle expand/collapse of topic folders
    header.addEventListener('click', () => {
      const isExpanded = topicGroup.classList.contains('expanded');
      
      // Close all others
      document.querySelectorAll('.topic-group').forEach(group => {
        group.classList.remove('expanded');
      });

      if (!isExpanded) {
        topicGroup.classList.add('expanded');
      }
    });

    topicGroup.appendChild(header);
    topicGroup.appendChild(sublist);
    topicsList.appendChild(topicGroup);
  });
}

function selectChapter(topicId, chapterId, updateHistory = true) {
  const topic = TOPICS.find(t => t.id === topicId);
  if (!topic) return;

  const chapter = topic.chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  state.activeTopicId = topicId;
  state.activeChapterId = chapterId;

  // 1. Update URL Hash
  if (updateHistory) {
    window.location.hash = `/learn/${topicId}/${chapterId}`;
  }

  // 2. Manage sidebar active and expanded classes
  document.querySelectorAll('.topic-group').forEach(group => {
    group.classList.remove('expanded');
  });
  document.querySelectorAll('.chapter-item').forEach(item => {
    item.classList.remove('active');
  });

  const activeGroup = document.getElementById(`group-${topicId}`);
  if (activeGroup) activeGroup.classList.add('expanded');

  const activeItem = document.getElementById(`item-${topicId}-${chapterId}`);
  if (activeItem) activeItem.classList.add('active');

  // 3. Render Breadcrumbs & Title
  breadcrumbs.innerHTML = `
    <span class="crumb-topic">${topic.title}</span>
    <span class="crumb-separator">&rarr;</span>
    <span class="crumb-chapter">${chapter.title}</span>
  `;
  chapterTitle.textContent = chapter.title;

  // 4. Render Summary Content
  summaryContent.innerHTML = chapter.summary;
}

// --- Event Handlers & State Sync ---
function setupEventListeners() {
  // Watch for back/forward browser hash changes
  window.addEventListener('hashchange', loadStateFromUrl);
}

function loadStateFromUrl() {
  const hash = window.location.hash;
  
  // Format: #/learn/topic-id/chapter-id
  if (hash.startsWith('#/learn/')) {
    const parts = hash.replace('#/learn/', '').split('/');
    if (parts.length >= 2) {
      const topicId = parts[0];
      const chapterId = parts[1];
      
      const topic = TOPICS.find(t => t.id === topicId);
      const chapter = topic?.chapters.find(c => c.id === chapterId);
      
      if (topic && chapter) {
        selectChapter(topicId, chapterId, false);
        return;
      }
    }
  }

  // Fallback default: Load the first chapter of the first topic
  if (TOPICS.length > 0 && TOPICS[0].chapters.length > 0) {
    selectChapter(TOPICS[0].id, TOPICS[0].chapters[0].id);
  }
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);
