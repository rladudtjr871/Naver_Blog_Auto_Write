// State management inside Popup
let fetchedPostData = null;

document.addEventListener("DOMContentLoaded", async () => {
  const serverUrlInput = document.getElementById("serverUrl");
  const postIdInput = document.getElementById("postId");
  const fetchBtn = document.getElementById("fetchBtn");
  const injectBtn = document.getElementById("injectBtn");
  const statusSection = document.getElementById("statusSection");
  const postTitleSpan = document.getElementById("postTitle");
  const imageCountSpan = document.getElementById("imageCount");
  const textLengthSpan = document.getElementById("textLength");

  // 1. Load saved settings from Chrome Storage
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["serverUrl", "postId"], (result) => {
      if (result.serverUrl) serverUrlInput.value = result.serverUrl;
      if (result.postId) postIdInput.value = result.postId;
    });
  }

  // 2. Fetch post data from backend API
  fetchBtn.addEventListener("click", async () => {
    const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
    const postId = postIdInput.value.trim();

    if (!serverUrl || !postId) {
      alert("서버 URL과 포스트 ID를 입력하세요.");
      return;
    }

    // Save configuration
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ serverUrl, postId });
    }

    fetchBtn.textContent = "불러오는 중...";
    fetchBtn.disabled = true;

    try {
      const response = await fetch(`${serverUrl}/api/posts/${postId}`);
      if (!response.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      if (data.status !== "COMPLETED") {
        alert(`포스트가 아직 준비되지 않았습니다. (현재 상태: ${data.status})`);
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

  // 3. Trigger injection in current active tab
  injectBtn.addEventListener("click", async () => {
    if (!fetchedPostData) return;

    if (typeof chrome === "undefined" || !chrome.tabs) {
      alert("크롬 익스텐션 환경이 아닙니다. 실제 브라우저 환경에서 실행해 주세요.");
      return;
    }

    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      alert("활성화된 탭을 찾을 수 없습니다.");
      return;
    }

    // Double check URL pattern
    const isNaverBlog = tab.url && (
      tab.url.includes("blog.naver.com") || 
      tab.url.includes("editor.blog.naver.com")
    );

    if (!isNaverBlog) {
      alert("네이버 블로그 글쓰기 에디터 페이지를 먼저 활성화해야 합니다.");
      return;
    }

    injectBtn.textContent = "네이버 주입 요청 중...";
    injectBtn.disabled = true;

    // Send post data message to content script (content.js)
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
  });

  function resetStatusPanel() {
    fetchedPostData = null;
    statusSection.style.display = "none";
    injectBtn.disabled = true;
    fetchBtn.textContent = "데이터 불러오기";
    fetchBtn.disabled = false;
  }
});
