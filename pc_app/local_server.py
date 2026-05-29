import os
import sys
import json
import time
import random
import tempfile
import shutil
import urllib.request
import urllib.parse
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

# Import selenium components
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

VERSION = "1.2.4"
PORT = 5000

# Global Selenium Driver instance and Lock for window/tab reuse
global_driver = None
global_driver_lock = threading.Lock()

# Windows Clipboard API utility using ctypes to handle unicode natively
def set_clipboard_text(text):
    if sys.platform != "win32":
        import subprocess
        process = subprocess.Popen('clip', stdin=subprocess.PIPE, shell=True, text=True, encoding='utf-8')
        process.communicate(input=text)
        return
        
    import ctypes
    CF_UNICODETEXT = 13
    GMEM_MOVEABLE = 2
    
    OpenClipboard = ctypes.windll.user32.OpenClipboard
    EmptyClipboard = ctypes.windll.user32.EmptyClipboard
    CloseClipboard = ctypes.windll.user32.CloseClipboard
    SetClipboardData = ctypes.windll.user32.SetClipboardData
    GlobalAlloc = ctypes.windll.kernel32.GlobalAlloc
    GlobalLock = ctypes.windll.kernel32.GlobalLock
    GlobalUnlock = ctypes.windll.kernel32.GlobalUnlock
    memcpy = ctypes.cdll.msvcrt.memcpy
    
    if not isinstance(text, str):
        text = str(text)
        
    if not OpenClipboard(None):
        return
        
    try:
        EmptyClipboard()
        text_bytes = (text + '\0').encode('utf-16le')
        h_mem = GlobalAlloc(GMEM_MOVEABLE, len(text_bytes))
        if h_mem:
            p_mem = GlobalLock(h_mem)
            if p_mem:
                memcpy(p_mem, text_bytes, len(text_bytes))
                GlobalUnlock(h_mem)
                SetClipboardData(CF_UNICODETEXT, h_mem)
    finally:
        CloseClipboard()

def dismiss_popup(driver, selector_string, name):
    if not selector_string:
        return
    for sel in selector_string.split(","):
        sel = sel.strip()
        try:
            btn = WebDriverWait(driver, 2).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
            )
            if btn:
                btn.click()
                print(f"[INFO] Dismissed popup '{name}' using: {sel}")
                time.sleep(1)
                break
        except:
            continue

def find_element_with_fallbacks(driver, selector_string):
    if not selector_string:
        return None
    for sel in selector_string.split(","):
        sel = sel.strip()
        try:
            el = WebDriverWait(driver, 3).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, sel))
            )
            if el:
                return el
        except:
            continue
    return None

def insert_place_map(driver, place_name):
    print(f"[INFO] Looking for Place (장소) button...")
    place_btn = None
    place_selectors = [
        (By.CSS_SELECTOR, ".se-toolbar-button-place"),
        (By.XPATH, "//button[contains(., '장소')]"),
        (By.XPATH, "//span[text()='장소']/parent::button"),
        (By.XPATH, "//button[contains(@class, 'place')]")
    ]
    for by, sel in place_selectors:
        try:
            place_btn = WebDriverWait(driver, 4).until(
                EC.element_to_be_clickable((by, sel))
            )
            if place_btn:
                break
        except:
            continue
            
    if not place_btn:
        print("[WARNING] Place button not found. Skipping map insertion.")
        return
        
    place_btn.click()
    time.sleep(2)
    
    # Locate location input field
    search_input = None
    search_selectors = [
        (By.CSS_SELECTOR, "input[placeholder*='장소']"),
        (By.CSS_SELECTOR, ".se-place-search-input"),
        (By.CSS_SELECTOR, "input[placeholder*='검색']"),
        (By.XPATH, "//input[@type='text' and contains(@placeholder, '검색')]")
    ]
    for by, sel in search_selectors:
        try:
            search_input = WebDriverWait(driver, 4).until(
                EC.element_to_be_clickable((by, sel))
            )
            if search_input:
                break
        except:
            continue
            
    if not search_input:
        print("[WARNING] Location search input not found. Skipping map insertion.")
        return
        
    # Focus and paste place name
    search_input.click()
    time.sleep(0.5)
    
    set_clipboard_text(place_name)
    actions = ActionChains(driver)
    actions.key_down(Keys.CONTROL).send_keys('v').key_up(Keys.CONTROL).perform()
    time.sleep(0.5)
    
    # Submit search
    actions = ActionChains(driver)
    actions.send_keys(Keys.ENTER)
    actions.perform()
    time.sleep(2.5)
    
    # Find first result
    first_item = None
    item_selectors = [
        (By.CSS_SELECTOR, ".se-place-search-result-item"),
        (By.CSS_SELECTOR, ".se-place-list-item"),
        (By.XPATH, "//ul[contains(@class, 'result') or contains(@class, 'list')]/li[1]")
    ]
    for by, sel in item_selectors:
        try:
            first_item = WebDriverWait(driver, 4).until(
                EC.presence_of_element_located((by, sel))
            )
            if first_item:
                break
        except:
            continue
            
    if not first_item:
        print(f"[WARNING] No place results found for: '{place_name}'")
        try:
            close_btn = driver.find_element(By.XPATH, "//button[contains(., '닫기') or contains(., '취소')]")
            close_btn.click()
        except:
            pass
        return
        
    # Hover first element via ActionChains and JavaScript
    print("[INFO] Hovering over first place result...")
    try:
        driver.execute_script(
            "var ev1 = new MouseEvent('mouseover', {bubbles: true});"
            "var ev2 = new MouseEvent('mouseenter', {bubbles: true});"
            "arguments[0].dispatchEvent(ev1);"
            "arguments[0].dispatchEvent(ev2);",
            first_item
        )
        time.sleep(0.5)
        ActionChains(driver).move_to_element(first_item).perform()
        time.sleep(1.0)
    except Exception as e:
        print(f"[WARNING] Hover action failed: {e}")
        
    # Find and click "추가" button
    print("[INFO] Clicking '추가' button...")
    add_btn = None
    add_selectors = [
        (By.XPATH, ".//button[contains(., '추가')]"),
        (By.XPATH, ".//span[text()='추가']/parent::button"),
        (By.CSS_SELECTOR, ".btn_add"),
        (By.CSS_SELECTOR, "button[class*='add']")
    ]
    for by, sel in add_selectors:
        try:
            add_btn = first_item.find_element(by, sel)
            if add_btn:
                driver.execute_script("arguments[0].scrollIntoView(true);", add_btn)
                time.sleep(0.2)
                try:
                    add_btn.click()
                except Exception as click_err:
                    print(f"[INFO] Normal click on '추가' failed: {click_err}. Trying JS click...")
                    driver.execute_script("arguments[0].click();", add_btn)
                print("[INFO] Clicked '추가' button inside item.")
                break
        except:
            continue
            
    if not add_btn:
        print("[WARNING] '추가' button not found, trying direct click on list item.")
        try:
            try:
                first_item.click()
            except Exception as click_err:
                driver.execute_script("arguments[0].click();", first_item)
        except Exception as e:
            print(f"[WARNING] Direct click on item failed: {e}")
            
    time.sleep(1.5)
    
    # Click Confirm "완료" or "확인"
    print("[INFO] Clicking '완료' or '확인' button...")
    confirm_btn = None
    confirm_selectors = [
        (By.XPATH, "//button[contains(., '완료')]"),
        (By.XPATH, "//span[contains(., '완료')]/parent::button"),
        (By.XPATH, "//button[text()='확인']"),
        (By.XPATH, "//span[text()='확인']/parent::button"),
        (By.XPATH, "//button[contains(., '확인')]"),
        (By.CSS_SELECTOR, ".se-popup-button-confirm"),
        (By.CSS_SELECTOR, "button[class*='confirm']"),
        (By.CSS_SELECTOR, "button[class*='complete']")
    ]
    for by, sel in confirm_selectors:
        try:
            confirm_btn = WebDriverWait(driver, 4).until(
                EC.presence_of_element_located((by, sel))
            )
            if confirm_btn:
                try:
                    confirm_btn.click()
                except Exception as click_err:
                    print(f"[INFO] Normal click on confirm failed: {click_err}. Trying JS click...")
                    driver.execute_script("arguments[0].click();", confirm_btn)
                print(f"[INFO] Place Map successfully inserted for: {place_name}")
                time.sleep(2)
                return
        except:
            continue
            
    print("[WARNING] Place confirm/done button not found.")

def run_selenium_macro(data):
    global global_driver
    blog_id = data.get("blogId")
    title = data.get("title")
    content = data.get("content")
    place = data.get("place")
    images = data.get("images", [])
    
    if not blog_id:
        print("[ERROR] blogId missing from request data.")
        return
        
    # Setup directories
    script_dir = os.path.dirname(os.path.abspath(__file__))
    profile_dir = os.path.join(script_dir, ".chrome_profile")
    
    # Load selectors config
    config_path = os.path.join(script_dir, "config.json")
    selectors = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
                selectors = config_data.get("naver_editor_selectors", {})
                print("[INFO] Successfully loaded selectors from config.json")
        except Exception as e:
            print(f"[WARNING] Error reading config.json: {e}")
            
    title_selector = selectors.get("title_input", ".se-section-documentTitle, .se-document-title [contenteditable='true']")
    content_selector = selectors.get("content_editable", ".se-section-text, .se-content [contenteditable='true']")
    popup_cancel_selector = selectors.get("popup_cancel_button", ".se-popup-button-cancel")
    help_close_selector = selectors.get("help_close_button", ".se-help-panel-close-button")
    save_selector = selectors.get("save_button", ".save_btn__bzc5B")
    
    # Download/Extract images to temporary local directory
    temp_dir = tempfile.mkdtemp()
    local_image_paths = []
    image_map = {} # Maps filename & placeholder keys to local temporary paths
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    for i, img_obj in enumerate(images):
        img_url = img_obj.get("url") if isinstance(img_obj, dict) else img_obj
        if img_url:
            # 1. Parse name from url hash parameter or use index
            name = f"IMAGE_PLACEHOLDER_{i + 1}"
            if "#name=" in img_url:
                try:
                    part = img_url.split("#name=")[1]
                    name = urllib.parse.unquote(part)
                except Exception as parse_err:
                    print(f"[WARNING] Failed to parse filename from URL hash: {parse_err}")
            
            # Remove hash part for processing the data/url itself
            url_data = img_url.split("#")[0]
            
            # 2. Download or save image binary
            try:
                local_path = None
                if url_data.startswith("data:image/"):
                    header, base64_data = url_data.split(";base64,", 1)
                    mime_type = header.split(":", 1)[1]
                    ext = ".png"
                    if "jpeg" in mime_type or "jpg" in mime_type:
                        ext = ".jpg"
                    elif "gif" in mime_type:
                        ext = ".gif"
                    elif "webp" in mime_type:
                        ext = ".webp"
                        
                    local_path = os.path.join(temp_dir, f"image_{i}{ext}")
                    print(f"[INFO] Writing base64 image: {name} -> {local_path}")
                    with open(local_path, "wb") as f:
                        f.write(base64.b64decode(base64_data))
                else:
                    parsed_url = urllib.parse.urlparse(url_data)
                    ext = os.path.splitext(parsed_url.path)[1]
                    if not ext:
                        ext = ".png"
                    local_path = os.path.join(temp_dir, f"image_{i}{ext}")
                    print(f"[INFO] Downloading image URL: {name} ({url_data}) -> {local_path}")
                    
                    req = urllib.request.Request(url_data, headers=headers)
                    with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
                        out_file.write(response.read())
                
                if local_path and os.path.exists(local_path):
                    local_image_paths.append(local_path)
                    image_map[name.lower()] = local_path
                    image_map[f"image_placeholder_{i + 1}"] = local_path
                    # Also map name without extension for flexible parsing
                    name_without_ext = os.path.splitext(name)[0]
                    image_map[name_without_ext.lower()] = local_path
                    
                    # Normalize helper to strip spaces, underscores and dashes
                    def normalize_img_key(k):
                        return k.lower().replace("_", "").replace("-", "").replace(" ", "")
                        
                    image_map[normalize_img_key(name)] = local_path
                    image_map[normalize_img_key(f"image_placeholder_{i + 1}")] = local_path
                    image_map[normalize_img_key(name_without_ext)] = local_path
            except Exception as img_err:
                print(f"[WARNING] Image processing failed for {name}: {img_err}")
                
    # Configure Chrome Options with persistent profile
    chrome_options = Options()
    chrome_options.add_argument(f"--user-data-dir={profile_dir}")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    
    # 💡 핵심 추가: 이미 열려 있는 크롬 창(포트)이 있다면 해당 창에 우선적으로 연결을 시도합니다.
    # 이렇게 하면 하나의 프로필 디렉토리가 충돌해서 게스트 모드로 열리는 것을 원천 차단합니다.
    chrome_options.add_argument("--remote-debugging-port=9222") 
    
    print(f"[INFO] Starting Chrome driver session...")
    driver = None
    is_new_session = False
    
    with global_driver_lock:
        # 1차 검증: 전역 드라이버 인스턴스가 살아있는지 확인
        if global_driver is not None:
            try:
                global_driver.switch_to.default_content()
                _ = global_driver.window_handles
                driver = global_driver
                print("[INFO] Reusing existing Chrome browser window via Global instance.")
            except Exception:
                print("[INFO] Existing global Chrome window was lost. Trying debugger reconnection...")
                global_driver = None

        # 2차 검증: 포트(9222)가 이미 열려 있다면, 인스턴스가 날아갔어도 그 브라우저에 다시 붙습니다.
        if driver is None:
            try:
                connect_options = Options()
                connect_options.add_experimental_option("debuggerAddress", "127.0.0.1:9222")
                # 기존 9222 포트로 살아있는 크롬에 제어권만 연결 시도
                driver = webdriver.Chrome(options=connect_options)
                global_driver = driver
                print("[INFO] Successfully reconnected to existing Chrome window via debugger port.")
            except Exception:
                print("[INFO] No active debugging session found. Spawning a completely new Chrome window...")

        # 3차 단계: 진짜 아무것도 없다면 크롬을 새로 실행합니다.
        if driver is None:
            try:
                service = Service(ChromeDriverManager().install())
                driver = webdriver.Chrome(service=service, options=chrome_options)
                global_driver = driver
                is_new_session = True
                
                # Bypass simple webdriver check (only on launch)
                driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                    "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
                })
                print("[INFO] Spawned a new Chrome browser window.")
            except Exception as launch_err:
                raise Exception(f"Failed to start Chrome browser: {launch_err}")

    try:
        try:
            driver.maximize_window()
        except:
            pass

        write_url = f"https://blog.naver.com/{blog_id}?Redirect=Write"

        # Open in a new tab if we are reusing an existing session
        if not is_new_session:
            print("[INFO] Opening Naver Blog write URL in a new tab...")
            try:
                driver.switch_to.default_content() # ensure we are on top-level context for window.open
                current_handles_count = len(driver.window_handles)
                driver.execute_script("window.open('about:blank', '_blank');")
                # Wait until the new tab handle is registered in selenium (up to 5 seconds)
                WebDriverWait(driver, 5).until(lambda d: len(d.window_handles) > current_handles_count)
                driver.switch_to.window(driver.window_handles[-1])
                time.sleep(0.5)
            except Exception as tab_err:
                print(f"[WARNING] Failed to open new tab, navigating in current: {tab_err}")

        print(f"[INFO] Navigating to: {write_url}")
        driver.get(write_url)
        
        # Detect if Naver Login page is loaded
        if "nid.naver.com" in driver.current_url:
            print("[INFO] Naver login page detected. Please log in in the opened Chrome window...")
            while "nid.naver.com" in driver.current_url:
                time.sleep(1)
            print("[INFO] Login detected. Redirecting back to writing page...")
            driver.get(write_url)
            
        # Switch to Editor IFrame (mainFrame)
        print("[INFO] Waiting for mainFrame...")
        WebDriverWait(driver, 20).until(
            EC.frame_to_be_available_and_switch_to_it((By.ID, "mainFrame"))
        )
        print("[INFO] Switched to mainFrame")
        
        # Dismiss initial auto-save popups and guidelines
        dismiss_popup(driver, popup_cancel_selector, "Auto-save Cancel")
        dismiss_popup(driver, help_close_selector, "Tutorial Close")
        
        # Clipboard pasting handler
        def paste_content(text):
            set_clipboard_text(text)
            time.sleep(0.1)
            actions = ActionChains(driver)
            actions.key_down(Keys.CONTROL).send_keys('v').key_up(Keys.CONTROL).perform()
            time.sleep(0.2)
            
        # Find and input Title
        print("[INFO] Locating Title element...")
        title_el = find_element_with_fallbacks(driver, title_selector)
        if not title_el:
            raise Exception("Failed to locate title input element in Naver SmartEditor.")
            
        print("[INFO] Pasting Title...")
        title_el.click()
        actions = ActionChains(driver)
        actions.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).send_keys(Keys.DELETE).perform()
        time.sleep(0.5)
        paste_content(title)
        
        # Find and input Content
        print("[INFO] Locating Content element...")
        content_el = find_element_with_fallbacks(driver, content_selector)
        if not content_el:
            raise Exception("Failed to locate content editor element in Naver SmartEditor.")
            
        print("[INFO] Pasting Content and placing images...")
        inserted_images = set()
        
        # Focus content editor once
        content_el.click()
        time.sleep(0.5)
        
        paragraphs = content.split('\n')
        for idx, para in enumerate(paragraphs):
            para_strip = para.strip()
            if not para_strip:
                continue
                
            # Check if paragraph is an image placeholder, e.g. [dog.png] or [IMAGE_PLACEHOLDER_1] (case-insensitive check)
            is_image_placeholder = False
            matched_path = None
            matched_name = None
            
            if para_strip.startswith("[") and para_strip.endswith("]"):
                inner_name = para_strip[1:-1].strip()
                inner_norm = inner_name.lower().replace("_", "").replace("-", "").replace(" ", "")
                
                # Check direct match first
                if inner_norm in image_map:
                    matched_path = image_map[inner_norm]
                    matched_name = inner_name
                    is_image_placeholder = True
                else:
                    # Check manual match against normalized keys of image_map
                    for k, path in image_map.items():
                        k_norm = k.lower().replace("_", "").replace("-", "").replace(" ", "")
                        if k_norm == inner_norm:
                            matched_path = path
                            matched_name = inner_name
                            is_image_placeholder = True
                            break
                    
            if is_image_placeholder and matched_path:
                print(f"[INFO] Image placeholder detected: '{para_strip}'. Uploading matched image: {matched_name}...")
                try:
                    file_inputs = driver.find_elements(By.CSS_SELECTOR, "input.se-file-input")
                    if not file_inputs:
                        file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
                        
                    uploaded = False
                    for file_input in file_inputs:
                        try:
                            try:
                                file_input.send_keys(matched_path)
                                uploaded = True
                            except Exception:
                                driver.execute_script(
                                    "arguments[0].style.display = 'block'; arguments[0].style.visibility = 'visible'; arguments[0].style.opacity = '1'; arguments[0].style.width = '100px'; arguments[0].style.height = '100px';",
                                    file_input
                                )
                                time.sleep(0.3)
                                file_input.send_keys(matched_path)
                                uploaded = True
                            
                            if uploaded:
                                inserted_images.add(matched_path)
                                break
                        except Exception as inner_err:
                            continue
                            
                    if not uploaded:
                        file_input = WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, "input.se-file-input, input[type='file']"))
                        )
                        driver.execute_script(
                            "arguments[0].style.display = 'block'; arguments[0].style.visibility = 'visible'; arguments[0].style.opacity = '1'; arguments[0].style.width = '100px'; arguments[0].style.height = '100px';",
                            file_input
                        )
                        time.sleep(0.3)
                        file_input.send_keys(matched_path)
                        inserted_images.add(matched_path)
                        
                    time.sleep(6.0)  # Wait for upload completion
                except Exception as upload_err:
                    print(f"[WARNING] Failed to upload image for placeholder '{para_strip}': {upload_err}")
                    paste_content(para_strip) # Fallback to pasting the tag text
                
                # Newline after image insertion
                try:
                    active_el = driver.switch_to.active_element
                    active_el.send_keys(Keys.ENTER)
                except:
                    actions = ActionChains(driver)
                    actions.send_keys(Keys.ENTER).perform()
                time.sleep(0.5)
            else:
                # Normal paragraph pasting (much faster than typing!)
                paste_content(para_strip)
                
                # Create a newline block if not the last paragraph
                if idx < len(paragraphs) - 1:
                    try:
                        active_el = driver.switch_to.active_element
                        active_el.send_keys(Keys.ENTER)
                    except:
                        actions = ActionChains(driver)
                        actions.send_keys(Keys.ENTER).perform()
                    time.sleep(0.3)
                    
        # Upload any remaining images that were not placed in the text
        remaining_images = [p for p in local_image_paths if p not in inserted_images]
        if remaining_images:
            print(f"[INFO] Uploading {len(remaining_images)} remaining images at the end of the post...")
            try:
                content_el.click()
                time.sleep(0.5)
                file_inputs = driver.find_elements(By.CSS_SELECTOR, "input.se-file-input")
                if not file_inputs:
                    file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
                    
                uploaded = False
                for file_input in file_inputs:
                    try:
                        try:
                            file_input.send_keys("\n".join(remaining_images))
                            uploaded = True
                        except Exception:
                            driver.execute_script(
                                "arguments[0].style.display = 'block'; arguments[0].style.visibility = 'visible'; arguments[0].style.opacity = '1'; arguments[0].style.width = '100px'; arguments[0].style.height = '100px';",
                                file_input
                            )
                            time.sleep(0.3)
                            file_input.send_keys("\n".join(remaining_images))
                            uploaded = True
                        
                        if uploaded:
                            break
                    except:
                        continue
                if not uploaded:
                    file_input = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "input.se-file-input, input[type='file']"))
                    )
                    driver.execute_script(
                        "arguments[0].style.display = 'block'; arguments[0].style.visibility = 'visible'; arguments[0].style.opacity = '1'; arguments[0].style.width = '100px'; arguments[0].style.height = '100px';",
                        file_input
                    )
                    time.sleep(0.3)
                    file_input.send_keys("\n".join(remaining_images))
                time.sleep(6.0)
            except Exception as upload_err:
                print(f"[WARNING] Failed to upload remaining images: {upload_err}")
                
        # Insert map place if available
        if place and place.strip():
            try:
                insert_place_map(driver, place)
            except Exception as place_err:
                print(f"[WARNING] Error inserting map: {place_err}")
                

                
        print("[INFO] Local automation macro executed successfully!")
        
    except Exception as e:
        print(f"[ERROR] Selenium automation process failed: {e}")
    finally:
        # Clean up local image files after a short delay
        try:
            time.sleep(5)
            shutil.rmtree(temp_dir)
            print("[INFO] Cleaned up temporary download directory.")
        except Exception as cleanup_err:
            pass
            
        # Switch to default content to avoid trapping next session inside Naver's mainFrame
        try:
            if driver:
                driver.switch_to.default_content()
        except:
            pass

        # USER RULE 2: Do NOT close Chrome browser window after execution finishes
        print("[INFO] Execution finished. Keeping Chrome browser window open as requested.")
        # driver.quit() (Disabled as requested)

class LocalServerHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Override to suppress server logging output
        pass
        
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
    def do_GET(self):
        if self.path == '/ping':
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "status": "ok",
                "version": VERSION,
                "message": f"Naver Blog Auto-Write Local Daemon v{VERSION} is running."
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            
    def do_POST(self):
        if self.path == '/run':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                
                # Check origin header for safety
                origin = self.headers.get('Origin')
                if origin:
                    parsed_origin = urllib.parse.urlparse(origin)
                    hostname = parsed_origin.hostname
                    if hostname and not (hostname == 'localhost' or hostname == '127.0.0.1' or hostname.endswith('vercel.app')):
                         self.send_response(403)
                         self.send_header('Access-Control-Allow-Origin', '*')
                         self.end_headers()
                         self.wfile.write(json.dumps({"success": False, "error": "Forbidden origin."}).encode('utf-8'))
                         return
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Automation macro launched in background."}).encode('utf-8'))
                
                # Run Selenium thread asynchronously so the HTTP post call responds immediately
                threading.Thread(target=run_selenium_macro, args=(data,)).start()
                
            except Exception as e:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def main():
    print(f"============================================================")
    print(f" Naver Blog Auto-Write Daemon v{VERSION} started on http://localhost:{PORT}")
    print(f" Keep this terminal window open during automated writes.")
    print(f" Browser window will REMAIN OPEN after completion.")
    print(f"============================================================")
    
    server = HTTPServer(('localhost', PORT), LocalServerHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down daemon server...")
        server.server_close()
        sys.exit(0)

if __name__ == "__main__":
    main()
