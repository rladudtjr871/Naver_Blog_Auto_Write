// State management inside Popup
let fetchedPostData = null;

document.addEventListener("DOMContentLoaded", async () => {
  const serverUrlInput = document.getElementById("serverUrl");
  const blogIdInput = document.getElementById("blogId");
  const openEditorBtn = document.getElementById("openEditorBtn");
  const postIdInput = document.getElementById("postId");
  const accessTokenInput = document.getElementById("accessToken");
  const syncStatusSpan = document.getElementById("syncStatus");
  const fetchBtn = document.getElementById("fetchBtn");
  const injectBtn = document.getElementById("injectBtn");
  const statusSection = document.getElementById("statusSection");
  const postTitleSpan = document.getElementById("postTitle");
  const imageCountSpan = document.getElementById("imageCount");
  const textLengthSpan = document.getElementById("textLength");

  // 1. Helper to update sync status style & text
  function updateSyncStatus(isSynced, message) {
    if (!syncStatusSpan) return;
    syncStatusSpan.textContent = message;
    if (isSynced) {
      syncStatusSpan.style.color = "#03c75a"; // Green
    } else {
      syncStatusSpan.style.color = "#ff4d4f"; // Red
    }
  }

  // 2. Helper to sync token from the Next.js site localStorage
  async function syncTokenFromTab() {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
      updateSyncStatus(false, "개발자 모드");
      return;
    }

    const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    if (!serverUrl) return;

    const matchPattern = serverUrl + "/*";

    chrome.tabs.query({ url: matchPattern }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.warn("Tabs query error:", chrome.runtime.lastError);
        return;
      }

      if (!tabs || tabs.length === 0) {
        updateSyncStatus(false, "대시보드 탭 없음");
        return;
      }

      const targetTab = tabs[0];
      chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: () => {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
              try {
                const sessionData = JSON.parse(localStorage.getItem(key));
                if (sessionData && sessionData.access_token) {
                  return sessionData.access_token;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
          return null;
        }
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.warn("Execute script error:", chrome.runtime.lastError);
          // If we can't execute script (e.g. host permission issue), we keep existing token
          return;
        }

        if (results && results[0] && results[0].result) {
          const token = results[0].result;
          accessTokenInput.value = token;
          updateSyncStatus(true, "자동 동기화됨");
          chrome.storage.local.set({ accessToken: token }, () => {
            fetchProfileAndSyncBlogId();
          });
        } else {
          // If tab exists but no token is found, user might be logged out
          updateSyncStatus(false, "로그인 필요");
        }
      });
    });
  }

  // Helper to fetch profile from server and sync blogId
  async function fetchProfileAndSyncBlogId() {
    const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    const token = accessTokenInput.value.trim();
    if (!serverUrl || !token) return;

    try {
      const response = await fetch(`${serverUrl}/api/user/profile`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.naverBlogId) {
          blogIdInput.value = data.naverBlogId;
          chrome.storage.local.set({ blogId: data.naverBlogId });
        }
      }
    } catch (e) {
      console.warn("Failed to fetch user profile for blog ID:", e);
    }
  }

  // 3. Load saved settings from Chrome Storage
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["serverUrl", "blogId", "postId", "accessToken"], (result) => {
      if (result.serverUrl) serverUrlInput.value = result.serverUrl;
      if (result.blogId) {
        blogIdInput.value = result.blogId;
      }
      if (result.postId) postIdInput.value = result.postId;
      if (result.accessToken) {
        accessTokenInput.value = result.accessToken;
        updateSyncStatus(true, "저장됨");
        fetchProfileAndSyncBlogId();
      }

      // Auto-sync token once config is loaded
      syncTokenFromTab();
    });
  }

  // Open Naver Blog Write editor window
  openEditorBtn.addEventListener("click", () => {
    const blogId = blogIdInput.value.trim();
    if (!blogId) {
      alert("네이버 블로그 ID를 입력해 주세요.");
      return;
    }
    const writeUrl = `https://blog.naver.com/${blogId}?Redirect=Write&`;
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url: writeUrl });
    } else {
      window.open(writeUrl, "_blank");
    }
  });

  // 4. Save manual token changes
  accessTokenInput.addEventListener("input", () => {
    const token = accessTokenInput.value.trim();
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ accessToken: token }, () => {
        if (token) {
          fetchProfileAndSyncBlogId();
        }
      });
    }
    if (token) {
      updateSyncStatus(true, "수동 입력됨");
    } else {
      updateSyncStatus(false, "연동 안 됨");
    }
  });

  // Re-sync when server URL is edited
  serverUrlInput.addEventListener("change", () => {
    syncTokenFromTab();
  });

  // 5. Fetch post data from backend API
  fetchBtn.addEventListener("click", async () => {
    const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    const postId = postIdInput.value.trim();
    const token = accessTokenInput.value.trim();

    if (!serverUrl || !postId) {
      alert("서버 URL과 포스트 ID를 입력하세요.");
      return;
    }

    if (!token) {
      alert("액세스 토큰이 필요합니다. 대시보드 로그인 상태이거나 토큰을 직접 입력해 주세요.");
      return;
    }

    // Save configuration
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ serverUrl, postId, accessToken: token });
    }

    fetchBtn.textContent = "불러오는 중...";
    fetchBtn.disabled = true;

    try {
      const response = await fetch(`${serverUrl}/api/posts/${postId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      if (data.status !== "COMPLETED") {
        alert(`포스트가 아직 완료되지 않았습니다. (현재 상태: ${data.status})`);
        resetStatusPanel();
        return;
      }

      fetchedPostData = data;

      // Update UI with summary
      postTitleSpan.textContent = data.title || "제목 없음";
      imageCountSpan.textContent = `${data.images ? data.images.length : 0}개`;
      textLengthSpan.textContent = `${data.content ? data.content.length : 0}자`;

      statusSection.style.display = "block";
      injectBtn.disabled = false;
      fetchBtn.textContent = "데이터 불러오기";
      fetchBtn.disabled = false;
    } catch (err) {
      alert(`데이터를 불러오지 못했습니다: ${err.message}`);
      resetStatusPanel();
    }
  });

  // 6. Trigger injection in current active tab or open write page automatically
  injectBtn.addEventListener("click", async () => {
    if (!fetchedPostData) return;

    if (typeof chrome === "undefined" || !chrome.tabs) {
      alert("크롬 익스텐션 환경이 아닙니다. 실제 브라우저 환경에서 실행해 주세요.");
      return;
    }

    const blogId = blogIdInput.value.trim();
    if (!blogId) {
      alert("네이버 블로그 ID를 입력해 주세요.");
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if current active tab is already the editor for this blog ID
    const isCurrentTabBlogEditor = tab && tab.url && (
      tab.url.includes("editor.blog.naver.com") ||
      (tab.url.includes("blog.naver.com") && tab.url.includes("PostWrite.naver") && tab.url.includes(`blogId=${blogId}`)) ||
      (tab.url.includes("blog.naver.com") && tab.url.includes(blogId) && tab.url.toLowerCase().includes("redirect=write"))
    );

    if (isCurrentTabBlogEditor) {
      // Direct injection into current active editor tab
      injectBtn.textContent = "네이버 주입 요청 중...";
      injectBtn.disabled = true;

      chrome.tabs.sendMessage(tab.id, { 
        action: "INJECT_POST", 
        data: {
          title: fetchedPostData.title,
          content: fetchedPostData.content,
          images: fetchedPostData.images || []
        } 
      }, (response) => {
        injectBtn.textContent = "네이버 블로그 주입하기";
        injectBtn.disabled = false;

        if (chrome.runtime.lastError) {
          console.error("Message Error:", chrome.runtime.lastError);
          alert("콘텐츠 스크립트가 로드되지 않았거나 주입 대기 상태가 아닙니다. 페이지를 새로고침한 후 다시 시도해 보세요.");
          return;
        }

        if (response && response.success) {
          alert("성공적으로 네이버 스마트에디터 ONE 주입 매크로가 실행되었습니다!");
        } else {
          alert(`주입 실패: ${response ? response.error : "알 수 없는 에러"}`);
        }
      });
    } else {
      // Save pending injection to storage and open new write tab
      injectBtn.textContent = "페이지 여는 중...";
      injectBtn.disabled = true;

      chrome.storage.local.set({
        pendingInjection: {
          title: fetchedPostData.title,
          content: fetchedPostData.content,
          images: fetchedPostData.images || []
        }
      }, () => {
        const writeUrl = `https://blog.naver.com/${blogId}?Redirect=Write&`;
        chrome.tabs.create({ url: writeUrl }, () => {
          injectBtn.textContent = "네이버 블로그 주입하기";
          injectBtn.disabled = false;
          window.close(); // Close the popup since focus moves to the new tab
        });
      });
    }
  });

  function resetStatusPanel() {
    fetchedPostData = null;
    statusSection.style.display = "none";
    injectBtn.disabled = true;
    fetchBtn.textContent = "데이터 불러오기";
    fetchBtn.disabled = false;
  }

  function autoDetectBlogId() {
    if (typeof chrome === "undefined" || !chrome.tabs) return;

    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError || !tabs) return;

      for (const tab of tabs) {
        if (!tab.url) continue;

        try {
          const url = new URL(tab.url);
          if (url.hostname === "blog.naver.com" || url.hostname === "editor.blog.naver.com") {
            // 1. Check query parameter `blogId`
            const blogIdParam = url.searchParams.get("blogId");
            if (blogIdParam) {
              saveAndFillBlogId(blogIdParam);
              return;
            }

            // 2. Check path segment (e.g., /username)
            const pathSegments = url.pathname.split("/").filter(Boolean);
            if (pathSegments.length > 0) {
              const firstSegment = pathSegments[0];
              const systemPages = ["postwrite.naver", "postlist.naver", "postview.naver", "editor", "myblog", "category"];
              if (!systemPages.includes(firstSegment.toLowerCase()) && !firstSegment.includes(".")) {
                saveAndFillBlogId(firstSegment);
                return;
              }
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
    });
  }

  function saveAndFillBlogId(blogId) {
    if (blogIdInput && !blogIdInput.value) {
      blogIdInput.value = blogId;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ blogId });
      }
    }
  }
});

