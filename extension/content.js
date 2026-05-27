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

// 1. Listen for runtime messages from popup.js (only in the TOP frame)
if (window.self === window.top) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "INJECT_POST") {
      const { title, content, images } = request.data;

      // Case A: Direct editor tab (not inside blog.naver.com wrapper)
      if (window.location.hostname.includes("editor.blog.naver.com")) {
        injectBlogContent(title, content, images)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      }

      // Case B: blog.naver.com wrapper containing the editor iframe
      const iframe = document.getElementById("mainFrame");
      if (iframe) {
        const handleIframeResponse = (e) => {
          if (e.data && e.data.action === "INJECT_POST_RESPONSE") {
            window.removeEventListener("message", handleIframeResponse);
            sendResponse(e.data.response);
          }
        };
        window.addEventListener("message", handleIframeResponse);

        // Forward to the iframe content script
        iframe.contentWindow.postMessage({ action: "INJECT_POST", data: request.data }, "*");
        return true;
      } else {
        sendResponse({ success: false, error: "네이버 블로그 에디터 아이프레임(mainFrame)을 찾을 수 없습니다." });
      }
    }
  });
}

// 2. Listen for postMessage from parent frame (only inside the editor iframe)
if (window.self !== window.top && window.location.hostname.includes("editor.blog.naver.com")) {
  window.addEventListener("message", (e) => {
    if (e.data && e.data.action === "INJECT_POST") {
      const { title, content, images } = e.data.data;
      injectBlogContent(title, content, images)
        .then(() => {
          window.parent.postMessage({ action: "INJECT_POST_RESPONSE", response: { success: true } }, "*");
        })
        .catch((err) => {
          window.parent.postMessage({ action: "INJECT_POST_RESPONSE", response: { success: false, error: err.message } }, "*");
        });
    }
  });
}

// 3. Auto-run if there is a pending injection from direct tab open (only inside the editor frame/iframe)
if (window.location.hostname.includes("editor.blog.naver.com")) {
  chrome.storage.local.get("pendingInjection", (result) => {
    if (result && result.pendingInjection) {
      const data = result.pendingInjection;
      // Consume the pending injection immediately to prevent loops
      chrome.storage.local.remove("pendingInjection", () => {
        console.log("Pending injection data consumed.");
      });
      waitForEditorAndInject(data.title, data.content, data.images);
    }
  });
}

// 4. Listen for custom events from the Next.js web application (only on the dashboard pages)
const isDashboard = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.includes("vercel.app");
if (isDashboard) {
  window.addEventListener("BLOG_AUTO_WRITE_INJECT", (e) => {
    // Acknowledge the message immediately so the web page knows the extension is installed
    window.dispatchEvent(new CustomEvent("BLOG_AUTO_WRITE_INJECT_ACK"));

    const { title, content, images } = e.detail;

    // Get the Naver Blog ID from extension storage
    chrome.storage.local.get("blogId", (result) => {
      const blogId = result.blogId;
      if (!blogId) {
        alert("오류: 크롬 익스텐션 설정에서 네이버 블로그 ID를 먼저 기입해 주세요.");
        return;
      }

      // Store pending injection in local storage
      chrome.storage.local.set({
        pendingInjection: { title, content, images }
      }, () => {
        // Open the write editor URL
        const writeUrl = `https://blog.naver.com/${blogId}?Redirect=Write&`;
        window.open(writeUrl, "_blank");
      });
    });
  });
}

/**
 * Find the actual editable element from a comma-separated selector string
 */
function findEditableElement(selectorString) {
  if (!selectorString) return null;
  const selectors = selectorString.split(",").map(s => s.trim());
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) {
      if (el.getAttribute("contenteditable") === "true" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        return el;
      }
      const editableChild = el.querySelector("[contenteditable='true'], input, textarea");
      if (editableChild) {
        return editableChild;
      }
      // Do not return el if it is not editable!
    }
  }
  return null;
}

/**
 * Focuses and sets the cursor at the end of the editable element,
 * simulating clicking the wrapper element first to trigger react state if needed.
 */
async function focusAndSetCursor(element, selectorString) {
  if (selectorString) {
    const wrapper = document.querySelector(selectorString.split(",")[0]);
    if (wrapper && wrapper !== element) {
      wrapper.click();
      await sleep(100);
    }
  }
  
  element.focus();
  element.click();
  
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false); // position cursor at the end
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (e) {
    console.warn("Failed to set cursor range:", e);
  }
  
  await sleep(100);
}

/**
 * Execute typing macro for Naver SmartEditor ONE
 */
async function injectBlogContent(title, content, images) {
  const selectors = editorConfig.naver_editor_selectors;
  const settings = editorConfig.macro_settings;

  // 0. Dismiss auto-save and help popups if present
  if (selectors.popup_cancel_button) {
    const popupCancel = document.querySelector(selectors.popup_cancel_button);
    if (popupCancel) {
      console.log("Dismissing popup cancel button...");
      popupCancel.click();
      await sleep(500);
    }
  }

  if (selectors.help_close_button) {
    const helpClose = document.querySelector(selectors.help_close_button);
    if (helpClose) {
      console.log("Dismissing tutorial help close button...");
      helpClose.click();
      await sleep(500);
    }
  }

  // 1. Inject Title
  console.log("Injecting title...");
  const titleEl = findEditableElement(selectors.title_input);
  if (!titleEl) {
    throw new Error("네이버 블로그 에디터 제목 영역을 찾을 수 없습니다. 에디터 모드인지 확인해 주세요.");
  }
  
  await focusAndSetCursor(titleEl, selectors.title_input);

  // Clear any existing placeholder or content
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  await sleep(100);

  // Insert title character by character (ActionChains style: 10ms ~ 100ms random delay)
  for (let i = 0; i < title.length; i++) {
    const char = title[i];
    document.execCommand("insertText", false, char);
    const delay = Math.floor(Math.random() * (100 - 10 + 1)) + 10;
    await sleep(delay);
  }
  await sleep(settings.paragraph_delay_ms);

  // 2. Focus on Content Area
  console.log("Focusing content area...");
  const contentEl = findEditableElement(selectors.content_editable);
  if (!contentEl) {
    throw new Error("네이버 블로그 에디터 본문 영역을 찾을 수 없습니다.");
  }
  
  await focusAndSetCursor(contentEl, selectors.content_editable);

  // 3. Split content into paragraphs to inject them naturally
  const paragraphs = content.split("\n");
  console.log(`Injecting ${paragraphs.length} paragraphs...`);

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraphText = paragraphs[i].trim();
    
    if (paragraphText) {
      // Type paragraph character by character (ActionChains style: 10ms ~ 100ms random delay)
      for (let j = 0; j < paragraphText.length; j++) {
        const char = paragraphText[j];
        document.execCommand("insertText", false, char);
        const delay = Math.floor(Math.random() * (100 - 10 + 1)) + 10;
        await sleep(delay);
      }
    }
    
    // Trigger Enter key (newline) to create a new editor paragraph block
    if (i < paragraphs.length - 1) {
      const activeEl = document.activeElement;
      const targetEl = (activeEl && activeEl.getAttribute("contenteditable") === "true") ? activeEl : contentEl;
      
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      targetEl.dispatchEvent(enterEvent);
      
      // Secondary fallback if keyboard event doesn't trigger block split
      document.execCommand("insertParagraph", false, null);
      
      await sleep(settings.paragraph_delay_ms);
    }
  }

  // 4. Click Save Button if it exists
  if (selectors.save_button) {
    console.log("Checking for save button...");
    const saveBtn = document.querySelector(selectors.save_button);
    if (saveBtn) {
      console.log("Clicking save button:", selectors.save_button);
      saveBtn.click();
    } else {
      console.warn("Save button not found matching:", selectors.save_button);
    }
  }

  // 5. Handle Images by creating a helper layout inside the web view
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

/**
 * Polls for editor selectors to be loaded and ready, then performs autoinjection.
 */
async function waitForEditorAndInject(title, content, images) {
  console.log("Waiting for Naver editor elements to be ready...");
  let attempts = 0;
  const maxAttempts = 40; // 40 attempts * 500ms = 20 seconds max wait
  
  while (attempts < maxAttempts) {
    const selectors = editorConfig ? editorConfig.naver_editor_selectors : null;
    if (selectors) {
      // Proactively dismiss auto-save and help popups during waiting
      const popupCancelEl = document.querySelector(selectors.popup_cancel_button);
      if (popupCancelEl) {
        console.log("Auto-save popup found, clicking cancel...");
        popupCancelEl.click();
        await sleep(500);
      }

      const helpCloseEl = document.querySelector(selectors.help_close_button);
      if (helpCloseEl) {
        console.log("Tutorial help panel found, clicking close...");
        helpCloseEl.click();
        await sleep(500);
      }

      const titleEl = findEditableElement(selectors.title_input);
      const contentEl = findEditableElement(selectors.content_editable);
      
      if (titleEl && contentEl) {
        console.log("Editor elements found! Injecting content automatically...");
        try {
          await injectBlogContent(title, content, images);
          console.log("Automatic injection successful!");
        } catch (err) {
          console.error("Automatic injection failed:", err);
          alert(`자동 주입 실패: ${err.message}`);
        }
        return;
      }
    }
    
    attempts++;
    await sleep(500);
  }
  
  console.error("Editor elements not found after 20 seconds. Autoinjection aborted.");
  alert("자동 주입 실패: 네이버 블로그 에디터를 찾지 못했습니다. 에디터 모드인지 확인해 주세요.");
}
