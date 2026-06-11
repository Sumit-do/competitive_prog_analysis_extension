(function () {
  if (document.getElementById('metacog-root')) return;

  // ─── Platform detection ───────────────────────────────────────
  function getProblemKey() {
    const url = window.location.href;
    if (url.includes('atcoder.jp')) {
      const m = url.match(/atcoder\.jp\/contests\/([^/]+)\/tasks\/([^/?#]+)/);
      return m ? `atcoder::${m[1]}::${m[2]}` : null;
    }
    if (url.includes('codeforces.com')) {
      const m = url.match(/codeforces\.com\/(?:contest|problemset\/problem)\/(\d+)(?:\/problem)?\/([A-Z0-9]+)/i);
      return m ? `cf::${m[1]}::${m[2]}` : null;
    }
    return null;
  }

  function getProblemLabel() {
    const url = window.location.href;
    if (url.includes('atcoder.jp')) {
      const m = url.match(/contests\/([^/]+)\/tasks\/([^/?#]+)/);
      return m ? `${m[1].toUpperCase()} / ${m[2].toUpperCase()}` : 'AtCoder';
    }
    if (url.includes('codeforces.com')) {
      const m = url.match(/\/(\d+)(?:\/problem)?\/([A-Z0-9]+)/i);
      return m ? `CF ${m[1]} ${m[2].toUpperCase()}` : 'Codeforces';
    }
    return 'Problem';
  }

  function getPlatform() {
    if (window.location.href.includes('atcoder.jp')) return 'AC';
    return 'CF';
  }

  // ─── Constants ────────────────────────────────────────────────
  const THOUGHT_TAGS = [
    { id: 'observation', label: 'Obs',   full: 'Observation', color: '#34d399' },
    { id: 'approach',    label: 'Plan',  full: 'Approach',    color: '#60a5fa' },
    { id: 'stuck',       label: 'Stuck', full: 'Stuck',       color: '#f87171' },
    { id: 'insight',     label: '💡',    full: 'Insight',     color: '#fbbf24' },
    { id: 'mistake',     label: 'Oops',  full: 'Mistake',     color: '#e879f9' },
  ];

  const FAILURE_TYPES = [
    { id: 'knowledge',   label: 'Knowledge Gap',       desc: "Didn't know the required technique or algorithm",  color: '#f87171' },
    { id: 'pattern',     label: 'Pattern Blindness',   desc: "Knew the algo but didn't see it applied here",     color: '#fb923c' },
    { id: 'constraint',  label: 'Missed Constraint',   desc: 'Overlooked a key constraint in the problem',       color: '#fbbf24' },
    { id: 'overthink',   label: 'Overthinking',         desc: 'Overcomplicated what was actually a simple idea',  color: '#a78bfa' },
    { id: 'anchor',      label: 'Wrong First Instinct', desc: 'Got stuck on the wrong approach for too long',     color: '#e879f9' },
    { id: 'implement',   label: 'Implementation Bug',   desc: 'Had the right idea but fumbled the code',          color: '#38bdf8' },
  ];

  const ALGO_TAGS = [
    'DP', 'BFS/DFS', 'Binary Search', 'Greedy', 'Segment Tree',
    'Two Pointers', 'Graph', 'Math', 'String', 'Bit Mask',
    'Divide & Conquer', 'Trie', 'Fenwick', 'Combinatorics', 'Other'
  ];

  const STUCK_NUDGES = [
    "What constraints haven't you fully used yet?",
    "Can you solve a smaller version of this problem?",
    "What's the brute force? Can it be optimized?",
    "What invariant holds throughout the process?",
    "Draw a small example. What pattern emerges?",
    "What if you work backwards from the answer?",
    "Is there a monotonicity you can exploit?",
    "What data structure would make this O(n log n)?",
    "Have you checked sorted order? Prefix sums? Frequency count?",
    "What changes between adjacent states?",
  ];

  const problemKey   = getProblemKey();
  const problemLabel = getProblemLabel();
  const platform     = getPlatform();

  // ─── State ────────────────────────────────────────────────────
  let entries       = [];
  let selectedTag   = 'observation';
  let isMinimized   = false;
  let startTime     = Date.now();
  let timerInterval = null;
  let nudgeInterval = null;
  let sessionStatus = 'active';
  let nudgeIndex    = 0;
  let currentView   = 'log';

  const sKey = () => `metacog::${problemKey}`;
  const mKey = () => `metacog-meta::${problemKey}`;

  function loadData(cb) {
    if (!problemKey) return cb([], null);
    chrome.storage.local.get([sKey(), mKey()], r => cb(r[sKey()] || [], r[mKey()] || null));
  }

  function saveEntries() {
    if (!problemKey) return;
    chrome.storage.local.set({ [sKey()]: entries });
  }

  function saveMeta(meta) {
    if (!problemKey) return;
    chrome.storage.local.set({ [mKey()]: meta });
  }

  // ─── Helpers ──────────────────────────────────────────────────
  function formatTime(ms) {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${pad(m % 60)}:${pad(s % 60)}`;
    return `${pad(m)}:${pad(s % 60)}`;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtTs(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function randomNudge() {
    const n = STUCK_NUDGES[nudgeIndex % STUCK_NUDGES.length];
    nudgeIndex++;
    return n;
  }

  // ─── Build UI ─────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'metacog-root';
  document.body.appendChild(root);

  root.innerHTML = `
<div id="mc-panel">

  <!-- HEADER -->
  <div id="mc-header">
    <div id="mc-header-left">
      <span id="mc-platform" class="mc-plat-${platform.toLowerCase()}">${platform}</span>
      <span id="mc-title">${problemLabel}</span>
    </div>
    <div id="mc-header-right">
      <span id="mc-timer">00:00</span>
      <button id="mc-tab-log"    class="mc-tab active" title="Solve log">◈</button>
      <button id="mc-tab-review" class="mc-tab"        title="Post-solve review">⊞</button>
      <button id="mc-minimize"   title="Minimise">−</button>
      <button id="mc-close"      title="Close">×</button>
    </div>
  </div>

  <!-- NUDGE BAR -->
  <div id="mc-nudge" style="display:none">
    <span id="mc-nudge-icon">💭</span>
    <span id="mc-nudge-text"></span>
    <button id="mc-nudge-dismiss">×</button>
  </div>

  <!-- BODY -->
  <div id="mc-body">

    <!-- LOG VIEW -->
    <div id="mc-view-log">
      <div id="mc-tags">
        ${THOUGHT_TAGS.map(t => `
          <button class="mc-tag ${t.id === selectedTag ? 'active' : ''}"
                  data-tag="${t.id}"
                  style="--tc:${t.color}"
                  title="${t.full}">
            ${t.label}
          </button>`).join('')}
      </div>

      <div id="mc-input-row">
        <textarea id="mc-input" placeholder="What are you thinking right now?  (Ctrl+Enter to log)" rows="3"></textarea>
        <button id="mc-log-btn">LOG</button>
      </div>

      <div id="mc-end-row">
        <button id="mc-solved-btn" class="mc-end-btn solved">✓ Solved</button>
        <button id="mc-quit-btn"   class="mc-end-btn quit">✕ Give up</button>
      </div>

      <div id="mc-feed-header">
        <span id="mc-feed-label">Thought log</span>
        <div id="mc-feed-actions">
          <span id="mc-entry-count"></span>
          <button id="mc-clear-btn">clear</button>
        </div>
      </div>
      <div id="mc-feed"></div>
    </div>

    <!-- REVIEW VIEW -->
    <div id="mc-view-review" style="display:none">
      <div class="mc-review-section">
        <div class="mc-review-label">Which algorithm was this?</div>
        <div id="mc-algo-tags">
          ${ALGO_TAGS.map(a => `<button class="mc-algo-tag" data-algo="${a}">${a}</button>`).join('')}
        </div>
      </div>

      <div class="mc-review-section" id="mc-failure-section">
        <div class="mc-review-label">If you struggled — what was the real reason?</div>
        <div id="mc-failure-tags">
          ${FAILURE_TYPES.map(f => `
            <button class="mc-failure-tag" data-fail="${f.id}" style="--fc:${f.color}" title="${f.desc}">
              ${f.label}
            </button>`).join('')}
        </div>
      </div>

      <div class="mc-review-section">
        <div class="mc-review-label">The key insight (one line)</div>
        <textarea id="mc-key-insight" class="mc-review-input" placeholder="The observation that unlocked it was…" rows="2"></textarea>
      </div>

      <div class="mc-review-section">
        <div class="mc-review-label">What would you tell past-you?</div>
        <textarea id="mc-advice" class="mc-review-input" placeholder="Next time, look for…" rows="2"></textarea>
      </div>

      <div class="mc-review-section">
        <div class="mc-review-label">How hard did it feel?</div>
        <div id="mc-diff-row">
          ${['Easy', 'Medium', 'Hard', 'Very Hard'].map(d =>
            `<button class="mc-diff-btn" data-diff="${d}">${d}</button>`
          ).join('')}
        </div>
      </div>

      <button id="mc-save-review">Save review</button>
      <div id="mc-review-saved" style="display:none">✓ Saved</div>
    </div>

  </div>

  <!-- END OVERLAY -->
  <div id="mc-overlay" style="display:none">
    <div id="mc-overlay-inner">
      <div id="mc-overlay-icon"></div>
      <div id="mc-overlay-title"></div>
      <div id="mc-overlay-time"></div>
      <textarea id="mc-overlay-note" rows="2"></textarea>
      <button id="mc-overlay-confirm">Confirm  (Ctrl+↵)</button>
      <button id="mc-overlay-cancel">Cancel</button>
    </div>
  </div>

</div>`;

  // ─── Timer + nudges ───────────────────────────────────────────
  timerInterval = setInterval(() => {
    if (sessionStatus !== 'active') return;
    const el = document.getElementById('mc-timer');
    if (el) el.textContent = formatTime(Date.now() - startTime);
  }, 1000);

  nudgeInterval = setInterval(() => {
    if (sessionStatus !== 'active') return;
    const lastEntry = entries[entries.length - 1];
    if (!lastEntry) return;
    const sinceLast = Date.now() - lastEntry.ts;
    if (lastEntry.tag === 'stuck' && sinceLast > 600000) showNudge();
    if (sinceLast > 900000) showNudge();
  }, 60000);

  function showNudge() {
    const bar = document.getElementById('mc-nudge');
    const txt = document.getElementById('mc-nudge-text');
    if (!bar || !txt) return;
    txt.textContent = randomNudge();
    bar.style.display = 'flex';
  }

  // ─── Render feed ──────────────────────────────────────────────
  function renderFeed() {
    const feed    = document.getElementById('mc-feed');
    const counter = document.getElementById('mc-entry-count');
    if (!feed) return;

    const userEntries = entries.filter(e => e.tag !== 'system');
    if (counter) counter.textContent = userEntries.length ? `${userEntries.length} thoughts` : '';

    if (entries.length === 0) {
      feed.innerHTML = `<div class="mc-empty">Start logging your thinking above.<br>Every thought counts.</div>`;
      return;
    }

    feed.innerHTML = entries.slice().reverse().map((e, ri) => {
      const realIdx = entries.length - 1 - ri;

      if (e.tag === 'system') {
        return `<div class="mc-entry mc-sys" style="--sc:${e.color}">
          <span class="mc-sys-label">${e.label}</span>
          <span class="mc-sys-time">T+${formatTime(e.elapsed)}</span>
          ${e.text ? `<div class="mc-sys-note">${esc(e.text)}</div>` : ''}
        </div>`;
      }

      const tag = THOUGHT_TAGS.find(t => t.id === e.tag) || THOUGHT_TAGS[0];
      return `<div class="mc-entry">
        <div class="mc-entry-meta">
          <span class="mc-entry-tag" style="color:${tag.color}">${tag.full}</span>
          <span class="mc-entry-time">${fmtTs(e.ts)} · T+${formatTime(e.elapsed)}</span>
          <button class="mc-del" data-idx="${realIdx}">×</button>
        </div>
        <div class="mc-entry-text">${esc(e.text)}</div>
      </div>`;
    }).join('');

    feed.querySelectorAll('.mc-del').forEach(btn => {
      btn.addEventListener('click', () => {
        entries.splice(+btn.dataset.idx, 1);
        saveEntries();
        renderFeed();
      });
    });
  }

  function renderReviewState() {
    chrome.storage.local.get([mKey()], r => {
      const meta = r[mKey()];
      if (!meta) return;
      if (meta.algoTags) {
        meta.algoTags.forEach(a => {
          const btn = document.querySelector(`.mc-algo-tag[data-algo="${a}"]`);
          if (btn) btn.classList.add('active');
        });
      }
      if (meta.failureType) {
        const btn = document.querySelector(`.mc-failure-tag[data-fail="${meta.failureType}"]`);
        if (btn) btn.classList.add('active');
      }
      if (meta.keyInsight) document.getElementById('mc-key-insight').value = meta.keyInsight;
      if (meta.advice)     document.getElementById('mc-advice').value     = meta.advice;
      if (meta.diffFelt) {
        const btn = document.querySelector(`.mc-diff-btn[data-diff="${meta.diffFelt}"]`);
        if (btn) btn.classList.add('active');
      }
    });
  }

  // ─── Log thought ──────────────────────────────────────────────
  function logThought(text, tag) {
    if (sessionStatus !== 'active') return;
    text = (text || document.getElementById('mc-input').value).trim();
    tag  = tag || selectedTag;
    if (!text) return;
    entries.push({ text, tag, ts: Date.now(), elapsed: Date.now() - startTime });
    saveEntries();
    document.getElementById('mc-input').value = '';
    renderFeed();
    document.getElementById('mc-input').focus();
    if (tag === 'stuck') setTimeout(showNudge, 600000);
  }

  // ─── End session ──────────────────────────────────────────────
  function showOverlay(type) {
    const ov    = document.getElementById('mc-overlay');
    const icon  = document.getElementById('mc-overlay-icon');
    const title = document.getElementById('mc-overlay-title');
    const timeEl = document.getElementById('mc-overlay-time');
    const note  = document.getElementById('mc-overlay-note');
    const elapsed = Date.now() - startTime;
    ov._type = type;

    icon.textContent  = type === 'solved' ? '🎉' : '🚩';
    title.textContent = type === 'solved' ? 'Mark as solved?' : 'Give up on this one?';
    title.style.color = type === 'solved' ? '#34d399' : '#f87171';
    note.placeholder  = type === 'solved' ? 'Key insight was… (optional)' : 'Blocker was… (optional)';
    timeEl.textContent = `Time: ${formatTime(elapsed)}`;
    note.value = '';
    ov.style.display = 'flex';
    note.focus();
  }

  function hideOverlay() {
    document.getElementById('mc-overlay').style.display = 'none';
  }

  function confirmEnd(type) {
    const note    = document.getElementById('mc-overlay-note').value.trim();
    const elapsed = Date.now() - startTime;
    sessionStatus = type;
    clearInterval(timerInterval);
    clearInterval(nudgeInterval);
    document.getElementById('mc-nudge').style.display = 'none';

    const timerEl = document.getElementById('mc-timer');
    timerEl.textContent = formatTime(elapsed);
    timerEl.style.color = type === 'solved' ? '#34d399' : '#f87171';

    entries.push({
      tag: 'system',
      label:  type === 'solved' ? '✓ SOLVED' : '✕ GAVE UP',
      color:  type === 'solved' ? '#34d399'  : '#f87171',
      text: note,
      ts: Date.now(),
      elapsed,
    });

    saveEntries();
    saveMeta({ status: type, elapsed, endTs: Date.now(), note });
    hideOverlay();
    lockSolveUI();
    renderFeed();

    const hdr = document.getElementById('mc-header');
    if (type === 'solved') {
      hdr.style.background   = 'rgba(52,211,153,0.06)';
      hdr.style.borderBottom = '1px solid rgba(52,211,153,0.15)';
    } else {
      hdr.style.background   = 'rgba(248,113,113,0.06)';
      hdr.style.borderBottom = '1px solid rgba(248,113,113,0.15)';
    }

    if (type === 'solved') setTimeout(() => switchTab('review'), 600);
  }

  function lockSolveUI() {
    document.getElementById('mc-input').disabled = true;
    document.getElementById('mc-log-btn').disabled = true;
    document.getElementById('mc-tags').style.opacity = '0.3';
    document.getElementById('mc-tags').style.pointerEvents = 'none';
    document.getElementById('mc-end-row').style.display = 'none';
  }

  function applyRestoredStatus(meta) {
    if (!meta || meta.status === 'active') return;
    sessionStatus = meta.status;
    clearInterval(timerInterval);
    const timerEl = document.getElementById('mc-timer');
    timerEl.textContent = formatTime(meta.elapsed || 0);
    timerEl.style.color = meta.status === 'solved' ? '#34d399' : '#f87171';
    lockSolveUI();
    const hdr = document.getElementById('mc-header');
    if (meta.status === 'solved') {
      hdr.style.background   = 'rgba(52,211,153,0.06)';
      hdr.style.borderBottom = '1px solid rgba(52,211,153,0.15)';
    } else {
      hdr.style.background   = 'rgba(248,113,113,0.06)';
      hdr.style.borderBottom = '1px solid rgba(248,113,113,0.15)';
    }
  }

  // ─── Tab switching ────────────────────────────────────────────
  function switchTab(tab) {
    currentView = tab;
    document.getElementById('mc-view-log').style.display    = tab === 'log'    ? 'flex' : 'none';
    document.getElementById('mc-view-review').style.display = tab === 'review' ? 'flex' : 'none';
    document.getElementById('mc-tab-log').classList.toggle('active',    tab === 'log');
    document.getElementById('mc-tab-review').classList.toggle('active', tab === 'review');
    if (tab === 'review') renderReviewState();
  }

  // ─── Save review ──────────────────────────────────────────────
  function saveReview() {
    const algoTags  = [...document.querySelectorAll('.mc-algo-tag.active')].map(b => b.dataset.algo);
    const failBtn   = document.querySelector('.mc-failure-tag.active');
    const diffBtn   = document.querySelector('.mc-diff-btn.active');
    const keyInsight = document.getElementById('mc-key-insight').value.trim();
    const advice     = document.getElementById('mc-advice').value.trim();
    chrome.storage.local.get([mKey()], r => {
      const existing = r[mKey()] || {};
      const updated  = {
        ...existing,
        algoTags,
        failureType: failBtn?.dataset.fail || null,
        diffFelt:    diffBtn?.dataset.diff  || null,
        keyInsight,
        advice,
        reviewedAt:  Date.now(),
      };
      saveMeta(updated);
      const saved = document.getElementById('mc-review-saved');
      saved.style.display = 'block';
      setTimeout(() => { saved.style.display = 'none'; }, 2000);
    });
  }

  // ─── Event wiring ─────────────────────────────────────────────
  document.getElementById('mc-log-btn').addEventListener('click', () => logThought());
  document.getElementById('mc-input').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); logThought(); }
  });

  document.querySelectorAll('.mc-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      if (sessionStatus !== 'active') return;
      selectedTag = btn.dataset.tag;
      document.querySelectorAll('.mc-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('mc-tab-log').addEventListener('click',    () => switchTab('log'));
  document.getElementById('mc-tab-review').addEventListener('click', () => switchTab('review'));

  document.getElementById('mc-minimize').addEventListener('click', () => {
    isMinimized = !isMinimized;
    document.getElementById('mc-body').style.display  = isMinimized ? 'none'  : 'block';
    document.getElementById('mc-nudge').style.display = 'none';
    document.getElementById('mc-minimize').textContent = isMinimized ? '+' : '−';
  });

  document.getElementById('mc-close').addEventListener('click', () => {
    clearInterval(timerInterval);
    clearInterval(nudgeInterval);
    root.remove();
  });

  document.getElementById('mc-clear-btn').addEventListener('click', () => {
    if (confirm('Clear all logged thoughts for this problem?')) {
      entries = [];
      saveEntries();
      renderFeed();
    }
  });

  document.getElementById('mc-solved-btn').addEventListener('click', () => showOverlay('solved'));
  document.getElementById('mc-quit-btn').addEventListener('click',   () => showOverlay('quit'));

  document.getElementById('mc-overlay-confirm').addEventListener('click', () => {
    const title = document.getElementById('mc-overlay-title').textContent;
    confirmEnd(title.toLowerCase().includes('solved') ? 'solved' : 'quit');
  });
  document.getElementById('mc-overlay-cancel').addEventListener('click', hideOverlay);
  document.getElementById('mc-overlay-note').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('mc-overlay-confirm').click();
    }
  });

  document.getElementById('mc-nudge-dismiss').addEventListener('click', () => {
    document.getElementById('mc-nudge').style.display = 'none';
  });

  document.getElementById('mc-save-review').addEventListener('click', saveReview);

  // Algo tags — multi-select
  document.querySelectorAll('.mc-algo-tag').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });

  // Failure tag — single select
  document.querySelectorAll('.mc-failure-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mc-failure-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Difficulty — single select
  document.querySelectorAll('.mc-diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mc-diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // ─── Drag to reposition ───────────────────────────────────────
  const panel  = document.getElementById('mc-panel');
  const header = document.getElementById('mc-header');
  let dragging = false, dox = 0, doy = 0;

  header.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON') return;
    dragging = true;
    const r = panel.getBoundingClientRect();
    dox = e.clientX - r.left;
    doy = e.clientY - r.top;
    panel.style.transition = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    panel.style.left   = `${e.clientX - dox}px`;
    panel.style.top    = `${e.clientY - doy}px`;
    panel.style.right  = 'auto';
    panel.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // ─── Init ─────────────────────────────────────────────────────
  loadData((saved, meta) => {
    entries = saved;
    if (meta?.status && meta.status !== 'active') applyRestoredStatus(meta);
    renderFeed();
  });

  if (!problemKey) document.getElementById('mc-panel').style.display = 'none';
})();
