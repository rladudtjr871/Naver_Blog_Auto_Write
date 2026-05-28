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

VERSION = "1.2.0"
PORT = 5000

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
        
    # Focus and type place name
    search_input.click()
    time.sleep(0.5)
    
    actions = ActionChains(driver)
    for char in place_name:
        actions.send_keys(char)
        actions.perform()
        actions = ActionChains(driver)
        time.sleep(random.uniform(0.01, 0.08))
    time.sleep(0.5)
    
    # Submit search
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
                EC.element_to_be_clickable((by, sel))
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
        
    # Hover and click "추가" button inside first item
    try:
        ActionChains(driver).move_to_element(first_item).perform()
        time.sleep(0.5)
    except:
        pass
        
    try:
        add_btn = first_item.find_element(By.XPATH, ".//button[contains(., '추가')]")
        add_btn.click()
    except:
        first_item.click()
    time.sleep(1.5)
    
    # Click Confirm "확인"
    confirm_btn = None
    confirm_selectors = [
        (By.XPATH, "//button[text()='확인']"),
        (By.XPATH, "//span[text()='확인']/parent::button"),
        (By.CSS_SELECTOR, ".se-popup-button-confirm")
    ]
    for by, sel in confirm_selectors:
        try:
            confirm_btn = WebDriverWait(driver, 4).until(
                EC.element_to_be_clickable((by, sel))
            )
            if confirm_btn:
                break
        except:
            continue
            
    if confirm_btn:
        confirm_btn.click()
        print(f"[INFO] Place Map successfully inserted for: {place_name}")
        time.sleep(2)
    else:
        print("[WARNING] Place confirm button not found.")

def run_selenium_macro(data):
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
                    image_map[name] = local_path
                    image_map[f"IMAGE_PLACEHOLDER_{i + 1}"] = local_path
                    # Also map name without extension for flexible parsing
                    name_without_ext = os.path.splitext(name)[0]
                    image_map[name_without_ext] = local_path
            except Exception as img_err:
                print(f"[WARNING] Image processing failed for {name}: {img_err}")
                
    # Configure Chrome Options with persistent profile
    chrome_options = Options()
    chrome_options.add_argument(f"--user-data-dir={profile_dir}")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    
    print(f"[INFO] Starting Chrome with profile directory: {profile_dir}")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    # Bypass simple webdriver check
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })
    
    try:
        driver.maximize_window()
        write_url = f"https://blog.naver.com/{blog_id}?Redirect=Write"
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
        
        # Natural typing handler (simulating human input)
        def type_natural(element, text):
            actions = ActionChains(driver)
            actions.move_to_element(element).click().perform()
            time.sleep(0.5)
            
            for char in text:
                actions = ActionChains(driver)
                if char == '\n':
                    actions.send_keys(Keys.ENTER)
                else:
                    actions.send_keys(char)
                actions.perform()
                time.sleep(random.uniform(0.01, 0.08))
            time.sleep(0.5)
            
        # Find and input Title
        print("[INFO] Locating Title element...")
        title_el = find_element_with_fallbacks(driver, title_selector)
        if not title_el:
            raise Exception("Failed to locate title input element in Naver SmartEditor.")
            
        print("[INFO] Typing Title...")
        title_el.click()
        actions = ActionChains(driver)
        actions.key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).send_keys(Keys.DELETE).perform()
        time.sleep(0.5)
        type_natural(title_el, title)
        
        # Find and input Content
        print("[INFO] Locating Content element...")
        content_el = find_element_with_fallbacks(driver, content_selector)
        if not content_el:
            raise Exception("Failed to locate content editor element in Naver SmartEditor.")
            
        print("[INFO] Typing Content and placing images...")
        inserted_images = set()
        
        paragraphs = content.split('\n')
        for idx, para in enumerate(paragraphs):
            para_strip = para.strip()
            if not para_strip:
                continue
                
            # Check if paragraph is an image placeholder, e.g. [dog.png] or [IMAGE_PLACEHOLDER_1]
            is_image_placeholder = False
            matched_path = None
            matched_name = None
            
            if para_strip.startswith("[") and para_strip.endswith("]"):
                inner_name = para_strip[1:-1].strip()
                if inner_name in image_map:
                    matched_path = image_map[inner_name]
                    matched_name = inner_name
                    is_image_placeholder = True
                    
            if is_image_placeholder and matched_path:
                print(f"[INFO] Image placeholder detected: '{para_strip}'. Uploading matched image: {matched_name}...")
                try:
                    file_input = WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file'], input.se-file-input"))
                    )
                    file_input.send_keys(matched_path)
                    inserted_images.add(matched_path)
                    time.sleep(3.5)  # Wait for upload completion
                except Exception as upload_err:
                    print(f"[WARNING] Failed to upload image for placeholder '{para_strip}': {upload_err}")
                    type_natural(content_el, para_strip) # Fallback to typing the tag text
                
                # Newline after image insertion
                try:
                    active_el = driver.switch_to.active_element
                    active_el.send_keys(Keys.ENTER)
                except:
                    content_el.send_keys(Keys.ENTER)
                time.sleep(0.5)
            else:
                # Normal paragraph typing
                type_natural(content_el, para_strip)
                
                # Create a newline block if not the last paragraph
                if idx < len(paragraphs) - 1:
                    try:
                        active_el = driver.switch_to.active_element
                        active_el.send_keys(Keys.ENTER)
                    except:
                        content_el.send_keys(Keys.ENTER)
                    time.sleep(0.3)
                    
        # Upload any remaining images that were not placed in the text
        remaining_images = [p for p in local_image_paths if p not in inserted_images]
        if remaining_images:
            print(f"[INFO] Uploading {len(remaining_images)} remaining images at the end of the post...")
            try:
                content_el.click()
                time.sleep(0.5)
                file_input = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file'], input.se-file-input"))
                )
                file_input.send_keys("\n".join(remaining_images))
                time.sleep(4.0)
            except Exception as upload_err:
                print(f"[WARNING] Failed to upload remaining images: {upload_err}")
                
        # Insert map place if available
        if place and place.strip():
            try:
                insert_place_map(driver, place)
            except Exception as place_err:
                print(f"[WARNING] Error inserting map: {place_err}")
                
        # Click Save Draft button
        print("[INFO] Clicking Save Draft button...")
        save_btn = None
        for sel in save_selector.split(","):
            sel = sel.strip()
            try:
                save_btn = WebDriverWait(driver, 3).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
                )
                if save_btn:
                    save_btn.click()
                    print("[INFO] Saved draft using selector.")
                    time.sleep(3)
                    break
            except:
                continue
                
        if not save_btn:
            try:
                save_btn = WebDriverWait(driver, 3).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(., '저장')]"))
                )
                if save_btn:
                    save_btn.click()
                    print("[INFO] Saved draft using text match button.")
                    time.sleep(3)
            except Exception as save_err:
                print(f"[WARNING] Save button click failed: {save_err}")
                
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
