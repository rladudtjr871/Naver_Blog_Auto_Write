// Naver Blog SmartEditor ONE DOM Injector (content.js)

let editorConfig = {
  "naver_editor_selectors": {
    "title_input": ".se-document-title .se-placeholder, .se-document-title [contenteditable='true']",
    "content_editable": ".se-content [contenteditable='true']",
    "editor_focus_area": ".se-canvas, .se-container",
    "placeholder_check": ".se-placeholder"
  },
  "macro_settings": {
    "typing_delay_ms": 10,
    "paragraph_delay_ms": 300,
    "image_insertion_delay_ms": 1500
  }
};

// Load configurations from config.json if accessible via extension runtime
try {
  fetch(chrome.runtime.getURL("config.json"))
    .then(res => res.json())
    .then(config => {
      editorConfig = config;
      console.log("BlogAutoWrite Config loaded:", editorConfig);
    });
} catch (e) {
  console.log("Config fetch skipped. Using default fallback selectors.");
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "INJECT_POST") {
    const { title, content, images } = request.data;
    
    injectBlogContent(title, content, images)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((err) => {
        console.error("Injection failed:", err);
        sendResponse({ success: false, error: err.message });
      });
      
    return true; // Keep message channel open for asynchronous response
  }
});

/**
 * Execute typing macro for Naver SmartEditor ONE
 */
async function injectBlogContent(title, content, images) {
  const selectors = editorConfig.naver_editor_selectors;
  const settings = editorConfig.macro_settings;

  // 1. Inject Title
  console.log("Injecting title...");
  const titleEl = document.querySelector(selectors.title_input);
  if (!titleEl) {
    throw new Error("네이버 블로그 에디터 제목 영역을 찾을 수 없습니다. 에디터 모드인지 확인해 주세요.");
  }
  
  titleEl.focus();
  // Clear any existing placeholder or content
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  // Insert new title
  document.execCommand("insertText", false, title);
  await sleep(settings.paragraph_delay_ms);

  // 2. Focus on Content Area
  console.log("Focusing content area...");
  const contentEl = document.querySelector(selectors.content_editable);
  if (!contentEl) {
    throw new Error("네이버 블로그 에디터 본문 영역을 찾을 수 없습니다.");
  }
  
  contentEl.focus();
  
  // Clear existing content (optional, but safer to start fresh if needed)
  // document.execCommand("selectAll", false, null);
  // document.execCommand("delete", false, null);

  // 3. Split content into paragraphs to inject them naturally
  const paragraphs = content.split("\n");
  console.log(`Injecting ${paragraphs.length} paragraphs...`);

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraphText = paragraphs[i].trim();
    
    if (paragraphText) {
      // Use document.execCommand('insertText') to trigger React/Vue editor state change properly
      document.execCommand("insertText", false, paragraphText);
      await sleep(settings.typing_delay_ms);
    }
    
    // Trigger Enter key (newline) to create a new editor paragraph block
    if (i < paragraphs.length - 1) {
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      contentEl.dispatchEvent(enterEvent);
      
      // Secondary fallback if keyboard event doesn't trigger block split
      document.execCommand("insertParagraph", false, null);
      
      await sleep(settings.paragraph_delay_ms);
    }
  }

  // 4. Handle Images by creating a helper layout inside the web view
  if (images && images.length > 0) {
    createImageHelperOverlay(images);
  }
}

/**
 * Creates a floating overlay window helping users drag and drop generated images 
 * since direct local clipboard injection of external HTTP URLs is restricted by Chrome sandbox.
 */
function createImageHelperOverlay(images) {
  // Check if overlay already exists
  const existing = document.getElementById("blog-auto-write-image-helper");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "blog-auto-write-image-helper";
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 280px;
    background: #090a0f;
    border: 1px solid rgba(99, 102, 241, 0.4);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
    border-radius: 12px;
    z-index: 999999;
    padding: 12px;
    color: #f8fafc;
    font-family: sans-serif;
  `;

  const header = document.createElement("div");
  header.style.cssText = "display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;";
  header.innerHTML = `
    <span style="font-size:11px; font-weight:bold; color:#6366f1;">본문 삽입용 이미지 리스트 (${images.length})</span>
    <button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#64748b; cursor:pointer; font-size:12px;">✕</button>
  `;
  overlay.appendChild(header);

  const guide = document.createElement("p");
  guide.style.cssText = "font-size:10px; color:#94a3b8; margin-bottom:10px; line-height:1.4;";
  guide.textContent = "아래 이미지를 네이버 에디터 본문 영역으로 직접 드래그 앤 드롭하여 삽입하세요.";
  overlay.appendChild(guide);

  const grid = document.createElement("div");
  grid.style.cssText = "display:grid; grid-template-cols: repeat(4, 1fr); gap:6px; max-height: 150px; overflow-y:auto; padding: 2px;";

  images.forEach((img, idx) => {
    const container = document.createElement("div");
    container.style.cssText = "position:relative; aspect-ratio:1; border:1px solid rgba(255,255,255,0.08); border-radius:6px; overflow:hidden; cursor:grab;";
    container.setAttribute("draggable", "true");
    
    const imageEl = document.createElement("img");
    imageEl.src = img.url;
    imageEl.style.cssText = "width:100%; h-weight:100%; object-fit:cover;";
    container.appendChild(imageEl);

    // Number label
    const label = document.createElement("span");
    label.style.cssText = "position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.6); color:white; font-size:8px; padding:1px 3px; border-radius:3px;";
    label.textContent = idx + 1;
    container.appendChild(label);

    grid.appendChild(container);
  });

  overlay.appendChild(grid);
  document.body.appendChild(overlay);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
