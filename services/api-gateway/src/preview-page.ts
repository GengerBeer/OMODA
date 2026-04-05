export function renderPreviewPage() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NewsTok Preview</title>
    <style>
      :root {
        --paper: #f2ede3;
        --ink: #1f1c19;
        --muted: #6f685f;
        --line: rgba(31, 28, 25, 0.12);
        --panel: rgba(255, 252, 247, 0.8);
        --accent: #1f5e73;
        --accent-soft: #dcecf1;
        --card-top: #1d3841;
        --card-bottom: #d86d45;
        --shadow: 0 28px 60px rgba(26, 24, 20, 0.14);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(216, 109, 69, 0.16), transparent 28%),
          radial-gradient(circle at bottom right, rgba(31, 94, 115, 0.16), transparent 24%),
          var(--paper);
        color: var(--ink);
        font-family: "Segoe UI", "SF Pro Display", "Helvetica Neue", sans-serif;
      }

      body {
        padding: 28px;
      }

      .shell {
        max-width: 1440px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(320px, 520px) minmax(320px, 1fr);
        gap: 28px;
        align-items: start;
      }

      .phone {
        position: sticky;
        top: 28px;
        height: calc(100vh - 56px);
        min-height: 760px;
        background: rgba(255, 255, 255, 0.42);
        border: 1px solid rgba(255, 255, 255, 0.55);
        border-radius: 38px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(18px);
        overflow: hidden;
      }

      .phone-header {
        padding: 22px 22px 14px;
        border-bottom: 1px solid var(--line);
        background: linear-gradient(to bottom, rgba(255, 255, 255, 0.54), rgba(255, 255, 255, 0.26));
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(31, 94, 115, 0.08);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .eyebrow::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #32a56d;
      }

      .phone-header h1 {
        margin: 16px 0 8px;
        font-size: clamp(28px, 4vw, 38px);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }

      .phone-header p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .topics {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding: 14px 22px 0;
        scroll-snap-type: x proximity;
      }

      .topics::-webkit-scrollbar,
      .feed::-webkit-scrollbar {
        display: none;
      }

      .topic {
        border: 0;
        background: rgba(255, 255, 255, 0.72);
        color: var(--ink);
        border-radius: 999px;
        padding: 11px 16px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 160ms ease, background 160ms ease, color 160ms ease;
        scroll-snap-align: start;
      }

      .topic:hover {
        transform: translateY(-1px);
      }

      .topic.active {
        background: var(--accent);
        color: #fff;
      }

      .feed {
        height: calc(100% - 186px);
        overflow-y: auto;
        padding: 16px 22px 24px;
        display: grid;
        gap: 16px;
        scroll-snap-type: y proximity;
      }

      .card {
        position: relative;
        min-height: 520px;
        padding: 24px;
        border: 0;
        border-radius: 34px;
        text-align: left;
        color: #fff;
        background: linear-gradient(160deg, var(--card-top), var(--card-bottom));
        box-shadow: 0 20px 36px rgba(31, 28, 25, 0.18);
        cursor: pointer;
        scroll-snap-align: start;
        overflow: hidden;
      }

      .card::before {
        content: "";
        position: absolute;
        inset: -28% auto auto 58%;
        width: 240px;
        height: 240px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        filter: blur(6px);
      }

      .card-category,
      .card-source,
      .card-reason {
        position: relative;
        z-index: 1;
      }

      .card-category {
        display: inline-flex;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .card-source {
        position: absolute;
        top: 22px;
        right: 22px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
        font-size: 12px;
        font-weight: 600;
      }

      .card h2 {
        position: relative;
        z-index: 1;
        margin: 20px 0 16px;
        font-size: clamp(30px, 4vw, 42px);
        line-height: 0.96;
        letter-spacing: -0.05em;
      }

      .card p {
        position: relative;
        z-index: 1;
        margin: 0;
        max-width: 28ch;
        font-size: 16px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.9);
      }

      .card-reason {
        position: absolute;
        left: 24px;
        bottom: 24px;
        right: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        color: rgba(255, 255, 255, 0.76);
        font-size: 13px;
        font-weight: 600;
      }

      .card-arrow {
        font-size: 22px;
      }

      .load-more {
        border: 0;
        border-radius: 24px;
        padding: 16px 18px;
        background: rgba(255, 255, 255, 0.8);
        color: var(--ink);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .details {
        display: grid;
        gap: 18px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.54);
        box-shadow: var(--shadow);
        backdrop-filter: blur(20px);
      }

      .hero {
        padding: 28px;
        border-radius: 34px;
      }

      .hero-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
      }

      .hero-kicker {
        display: inline-flex;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-meta {
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }

      .hero h2 {
        margin: 18px 0 14px;
        font-size: clamp(34px, 5vw, 56px);
        line-height: 0.95;
        letter-spacing: -0.05em;
      }

      .hero-summary {
        margin: 0;
        max-width: 54ch;
        color: #423d37;
        font-size: 18px;
        line-height: 1.6;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }

      .metric {
        padding: 18px;
        border-radius: 24px;
      }

      .metric-label {
        display: block;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .metric-value {
        display: block;
        margin-top: 10px;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .story {
        padding: 24px 28px 28px;
        border-radius: 34px;
      }

      .story h3 {
        margin: 0 0 16px;
        font-size: 15px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .story p {
        margin: 0;
        color: #302b26;
        font-size: 16px;
        line-height: 1.8;
      }

      .status {
        padding: 14px 18px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.7);
        color: var(--muted);
        font-size: 13px;
        font-weight: 600;
      }

      .loading {
        opacity: 0.55;
        pointer-events: none;
      }

      @media (max-width: 1080px) {
        body {
          padding: 18px;
        }

        .shell {
          grid-template-columns: 1fr;
        }

        .phone {
          position: relative;
          top: 0;
          min-height: auto;
          height: auto;
        }

        .feed {
          height: auto;
          max-height: none;
        }

        .card {
          min-height: 420px;
        }

        .metrics {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="phone">
        <div class="phone-header">
          <div class="eyebrow">Live Preview</div>
          <h1>NewsTok<br />For You</h1>
          <p>Browser preview of the iPhone feed. It reads from the same REST endpoints as the mobile app.</p>
        </div>
        <div class="topics" id="topics"></div>
        <div class="feed" id="feed"></div>
      </section>

      <section class="details">
        <article class="panel hero">
          <div class="hero-top">
            <span class="hero-kicker" id="heroCategory">Technology</span>
            <span class="hero-meta" id="heroMeta">demo-user mix</span>
          </div>
          <h2 id="heroTitle">Loading the personalized feed...</h2>
          <p class="hero-summary" id="heroSummary">The preview is fetching your top stories and profile interests.</p>
        </article>

        <section class="metrics">
          <article class="panel metric">
            <span class="metric-label">Selected Topics</span>
            <span class="metric-value" id="metricTopics">3</span>
          </article>
          <article class="panel metric">
            <span class="metric-label">Top Category</span>
            <span class="metric-value" id="metricCategory">Tech</span>
          </article>
          <article class="panel metric">
            <span class="metric-label">Feed Items</span>
            <span class="metric-value" id="metricCount">0</span>
          </article>
        </section>

        <article class="panel story">
          <h3>Story Detail</h3>
          <p id="storyBody">Choose a card to inspect its full article body and summary.</p>
        </article>

        <div class="status" id="status">Connecting to the preview API...</div>
      </section>
    </main>

    <script>
      const state = {
        userId: "demo-user",
        nextCursor: null,
        items: [],
        selectedTopics: [],
        activeArticleId: null,
        availableTopics: ["technology", "business", "science", "world", "culture", "sports"]
      };

      const feedEl = document.getElementById("feed");
      const topicsEl = document.getElementById("topics");
      const statusEl = document.getElementById("status");
      const heroCategoryEl = document.getElementById("heroCategory");
      const heroMetaEl = document.getElementById("heroMeta");
      const heroTitleEl = document.getElementById("heroTitle");
      const heroSummaryEl = document.getElementById("heroSummary");
      const storyBodyEl = document.getElementById("storyBody");
      const metricTopicsEl = document.getElementById("metricTopics");
      const metricCategoryEl = document.getElementById("metricCategory");
      const metricCountEl = document.getElementById("metricCount");

      async function requestJson(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Request failed");
        }
        return response.json();
      }

      async function loadProfile() {
        const profile = await requestJson("/v1/profile/" + state.userId);
        state.selectedTopics = profile.selectedTopics || [];
        metricTopicsEl.textContent = String(state.selectedTopics.length);
        renderTopics();
        return profile;
      }

      async function loadFeed(cursor) {
        feedEl.classList.add("loading");
        const suffix = cursor ? "&cursor=" + encodeURIComponent(cursor) : "";
        const feed = await requestJson("/v1/feed?userId=" + encodeURIComponent(state.userId) + "&limit=4" + suffix);
        state.nextCursor = feed.nextCursor;

        if (!cursor) {
          state.items = feed.items || [];
        } else {
          state.items = state.items.concat(feed.items || []);
        }

        metricCountEl.textContent = String(state.items.length);
        renderFeed();
        feedEl.classList.remove("loading");

        if (!state.activeArticleId && state.items.length > 0) {
          showItem(state.items[0]);
        }
      }

      async function updateTopics(topic) {
        const nextTopics = new Set(state.selectedTopics);
        if (nextTopics.has(topic)) {
          if (nextTopics.size === 1) {
            return;
          }
          nextTopics.delete(topic);
        } else {
          nextTopics.add(topic);
        }

        const orderedTopics = state.availableTopics.filter((item) => nextTopics.has(item));
        statusEl.textContent = "Updating your interests...";

        await requestJson("/v1/profile/" + state.userId + "/topics", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ selectedTopics: orderedTopics })
        });

        state.selectedTopics = orderedTopics;
        renderTopics();
        state.items = [];
        state.nextCursor = null;
        state.activeArticleId = null;
        await loadFeed(null);
        statusEl.textContent = "Interests updated. Feed reranked in real time.";
      }

      async function showItem(item) {
        state.activeArticleId = item.articleId;
        const article = await requestJson("/v1/articles/" + item.articleId);
        heroCategoryEl.textContent = article.summary.category.toUpperCase();
        heroMetaEl.textContent = item.reason;
        heroTitleEl.textContent = article.title;
        heroSummaryEl.textContent = article.summary.summaryShort;
        storyBodyEl.textContent = article.body;
        metricCategoryEl.textContent = article.summary.category[0].toUpperCase() + article.summary.category.slice(1);
        renderFeed();
      }

      function renderTopics() {
        topicsEl.innerHTML = "";
        state.availableTopics.forEach((topic) => {
          const button = document.createElement("button");
          button.className = "topic" + (state.selectedTopics.includes(topic) ? " active" : "");
          button.textContent = topic[0].toUpperCase() + topic.slice(1);
          button.addEventListener("click", () => {
            updateTopics(topic).catch((error) => {
              console.error(error);
              statusEl.textContent = "Could not update interests.";
            });
          });
          topicsEl.appendChild(button);
        });
      }

      function renderFeed() {
        feedEl.innerHTML = "";

        state.items.forEach((item) => {
          const button = document.createElement("button");
          button.className = "card";
          button.innerHTML = [
            '<span class="card-category">' + item.article.summary.category.toUpperCase() + "</span>",
            '<span class="card-source">' + item.article.source + "</span>",
            "<h2>" + item.article.title + "</h2>",
            "<p>" + item.article.summary.summaryShort + "</p>",
            '<div class="card-reason"><span>' + item.reason + '</span><span class="card-arrow">↗</span></div>'
          ].join("");
          if (state.activeArticleId === item.articleId) {
            button.style.outline = "3px solid rgba(255,255,255,0.6)";
            button.style.outlineOffset = "-3px";
          }
          button.addEventListener("click", () => {
            showItem(item).catch((error) => {
              console.error(error);
              statusEl.textContent = "Could not load article detail.";
            });
          });
          feedEl.appendChild(button);
        });

        if (state.nextCursor) {
          const loadMore = document.createElement("button");
          loadMore.className = "load-more";
          loadMore.textContent = "Load more stories";
          loadMore.addEventListener("click", () => {
            loadFeed(state.nextCursor).catch((error) => {
              console.error(error);
              statusEl.textContent = "Could not load more stories.";
            });
          });
          feedEl.appendChild(loadMore);
        }
      }

      async function boot() {
        try {
          statusEl.textContent = "Loading profile and feed...";
          await loadProfile();
          await loadFeed(null);
          statusEl.textContent = "Preview connected. Click cards and switch topics to rerank the feed.";
        } catch (error) {
          console.error(error);
          statusEl.textContent = "Preview failed to load. Keep the backend running and refresh the page.";
          heroTitleEl.textContent = "Preview unavailable";
          heroSummaryEl.textContent = "The browser could not read the local API.";
        }
      }

      boot();
    </script>
  </body>
</html>`;
}
