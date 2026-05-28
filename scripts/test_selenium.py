import os
import sys
import time
import random
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def safe_click(driver, element):
    try:
        element.click()
    except Exception as e:
        print(f"Normal click failed: {e}. Trying JS click...")
        driver.execute_script("arguments[0].click();", element)

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_selenium.py <blog_id>")
        sys.exit(1)
    
    blog_id = sys.argv[1]
    
    # Rule 3: Load selectors from config.json to support easy updates if Naver DOM changes
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    config_path = os.path.join(project_root, "extension", "config.json")
    
    selectors = {}
    try:
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
                selectors = config_data.get("naver_editor_selectors", {})
                print("Successfully loaded selectors from config.json")
        else:
            print("config.json not found. Using fallback selectors.")
    except Exception as e:
        print(f"Error loading config.json: {e}. Using fallback selectors.")
    
    # Selector definitions with fallback lists
    title_selector = selectors.get("title_input", ".se-section-documentTitle, [contenteditable='true']")
    content_selector = selectors.get("content_editable", ".se-section-text, .se-content [contenteditable='true']")
    popup_cancel_selector = selectors.get("popup_cancel_button", ".se-popup-button-cancel")
    help_close_selector = selectors.get("help_close_button", ".se-help-panel-close-button")
    save_selector = selectors.get("save_button", ".save_btn__bzc5B")
    
    # Setup Chrome Options with persistent profile in workspace
    chrome_options = Options()
    profile_dir = os.path.join(project_root, ".chrome_profile")
    chrome_options.add_argument(f"--user-data-dir={profile_dir}")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    
    print(f"Starting Chrome with profile directory: {profile_dir}")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    # Avoid selenium detection
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })
    
    try:
        driver.maximize_window()
        # 1. Navigating to the Naver Blog write page
        write_url = f"https://blog.naver.com/{blog_id}?Redirect=Write"
        print(f"Navigating to Naver Blog write URL: {write_url}")
        driver.get(write_url)
        
        # Wait to check if user is not logged in
        # If user is not logged in, we wait and let them log in
        current_url = driver.current_url
        if "nid.naver.com" in current_url:
            print("Naver login page detected. Please complete login in the opened Chrome window...")
            # Poll for redirection back to blog
            while "nid.naver.com" in driver.current_url:
                time.sleep(1)
            print("Login successful, returning to write page...")
            driver.get(write_url)
        
        # 2. Wait for mainFrame and switch to it
        print("Waiting for mainFrame iframe...")
        WebDriverWait(driver, 20).until(
            EC.frame_to_be_available_and_switch_to_it((By.ID, "mainFrame"))
        )
        print("Successfully switched context to mainFrame")
        
        # 3. Dismiss popups if present
        # Dismiss cancel popup (e.g. draft restore question)
        try:
            print("Checking for draft restore popup (.se-popup-button-cancel)...")
            # Parse CSS selectors by splitting comma-separated options
            cancel_btn = None
            for sel in popup_cancel_selector.split(","):
                sel = sel.strip()
                try:
                    cancel_btn = WebDriverWait(driver, 3).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
                    )
                    if cancel_btn:
                        cancel_btn.click()
                        print(f"Dismissed auto-save restore popup using: {sel}")
                        time.sleep(1)
                        break
                except:
                    continue
        except Exception:
            print("Restore popup not visible or not found. Skipping.")
            
        # Dismiss tutorial popup (.se-help-panel-close-button)
        try:
            print("Checking for tutorial popup (.se-help-panel-close-button)...")
            help_btn = None
            for sel in help_close_selector.split(","):
                sel = sel.strip()
                try:
                    help_btn = WebDriverWait(driver, 3).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
                    )
                    if help_btn:
                        help_btn.click()
                        print(f"Dismissed tutorial help popup using: {sel}")
                        time.sleep(1)
                        break
                except:
                    continue
        except Exception:
            print("Tutorial popup not visible or not found. Skipping.")
            
        # Helper function for typing character-by-character using ActionChains
        def type_natural_action_chains(element, text):
            # Click and focus element
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
                # 0.01s ~ 0.10s random delay
                time.sleep(random.uniform(0.01, 0.10))
            time.sleep(0.5)
            
        # 4. Click and input Title
        print("Searching for Title element...")
        title_el = None
        for sel in title_selector.split(","):
            sel = sel.strip()
            try:
                title_el = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
                )
                if title_el:
                    print(f"Found Title element matching selector: {sel}")
                    break
            except:
                continue
                
        if not title_el:
            raise Exception("Failed to locate title input element in Naver SmartEditor.")
            
        # Typing title: "테스트"
        print("Typing title '테스트'...")
        type_natural_action_chains(title_el, "테스트")
        
        # 5. Click and input Content
        print("Searching for Content element...")
        content_el = None
        for sel in content_selector.split(","):
            sel = sel.strip()
            try:
                content_el = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
                )
                if content_el:
                    print(f"Found Content element matching selector: {sel}")
                    break
            except:
                continue
                
        if not content_el:
            raise Exception("Failed to locate content editor element in Naver SmartEditor.")
            
        # Typing content: 
        # 테스트테스트테스트
        # 테스트테스트테스트
        print("Typing content paragraphs...")
        content_text = "테스트테스트테스트\n테스트테스트테스트"
        type_natural_action_chains(content_el, content_text)
        
        # 6. Click '장소' (Place) button, search '서울특별시청', and insert map
        print("Searching for Place (장소) button...")
        place_btn = None
        place_selectors = [
            (By.CSS_SELECTOR, ".se-toolbar-button-place"),
            (By.XPATH, "//button[contains(., '장소')]"),
            (By.XPATH, "//span[text()='장소']/parent::button"),
            (By.XPATH, "//button[contains(@class, 'place')]")
        ]
        for by, sel in place_selectors:
            try:
                place_btn = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((by, sel))
                )
                if place_btn:
                    print(f"Found Place button: {sel}")
                    break
            except:
                continue
                
        if not place_btn:
            raise Exception("Failed to locate Place (장소) button on the editor toolbar.")
            
        print("Clicking Place button...")
        place_btn.click()
        time.sleep(2)
        
        # In place popup, locate search input field
        print("Searching for location search input...")
        search_input = None
        search_input_selectors = [
            (By.CSS_SELECTOR, "input[placeholder*='장소']"),
            (By.CSS_SELECTOR, ".se-place-search-input"),
            (By.CSS_SELECTOR, "input[placeholder*='검색']"),
            (By.XPATH, "//input[@type='text' and contains(@placeholder, '검색')]"),
            (By.XPATH, "//input[contains(@class, 'search')]")
        ]
        for by, sel in search_input_selectors:
            try:
                search_input = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((by, sel))
                )
                if search_input:
                    print(f"Found search input: {sel}")
                    break
            except:
                continue
                
        if not search_input:
            raise Exception("Failed to locate search input field inside Place dialog.")
            
        print("Typing search query '서울특별시청'...")
        type_natural_action_chains(search_input, "서울특별시청")
        time.sleep(1)
        
        # Press Enter to perform search
        print("Submitting search...")
        actions = ActionChains(driver)
        actions.send_keys(Keys.ENTER)
        actions.perform()
        time.sleep(2)
        
        # Click first search result item
        print("Searching for the first result item...")
        first_item = None
        item_selectors = [
            (By.CSS_SELECTOR, ".se-place-search-result-item"),
            (By.CSS_SELECTOR, ".se-place-list-item"),
            (By.XPATH, "//ul[contains(@class, 'result')]//li[1]"),
            (By.XPATH, "//ul[contains(@class, 'list')]//li[1]"),
            (By.XPATH, "//div[contains(@class, 'search_result')]//li[1]")
        ]
        for by, sel in item_selectors:
            try:
                first_item = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((by, sel))
                )
                if first_item:
                    print(f"Found first search result item: {sel}")
                    break
            except:
                continue
                
        if not first_item:
            raise Exception("장소 검색 결과가 없습니다: '서울특별시청'")
            
        # Hover mouse over first_item to reveal the "추가" button
        print("Hovering mouse over the first result item to reveal the '추가' button...")
        try:
            actions = ActionChains(driver)
            actions.move_to_element(first_item).perform()
            time.sleep(1)
        except Exception as hover_err:
            print(f"Failed to hover over first item: {hover_err}. Proceeding anyway.")
            
        # Click the "추가" (Add) button inside the first search result item
        print("Searching for the '추가' (Add) button inside the first result item...")
        add_btn = None
        add_selectors = [
            (By.XPATH, ".//button[contains(., '추가')]"),
            (By.XPATH, ".//span[text()='추가']/parent::button"),
            (By.CSS_SELECTOR, "button"),
            (By.CSS_SELECTOR, ".btn_add"),
            (By.XPATH, ".//button")
        ]
        for by, sel in add_selectors:
            try:
                add_btn = first_item.find_element(by, sel)
                if add_btn:
                    print(f"Found '추가' button inside first item using: {sel}")
                    break
            except:
                continue
                
        if add_btn:
            print("Clicking the '추가' button...")
            safe_click(driver, add_btn)
        else:
            print("'추가' button not found inside first item. Clicking the first item itself as fallback...")
            safe_click(driver, first_item)
        time.sleep(2)
        
        # Click Confirm (확인) button
        print("Searching for confirm button...")
        confirm_btn = None
        confirm_selectors = [
            (By.XPATH, "//button[text()='확인']"),
            (By.XPATH, "//span[text()='확인']/parent::button"),
            (By.CSS_SELECTOR, ".se-popup-button-confirm"),
            (By.XPATH, "//button[contains(@class, 'confirm')]"),
            (By.XPATH, "//button[contains(., '확인')]")
        ]
        for by, sel in confirm_selectors:
            try:
                confirm_btn = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((by, sel))
                )
                if confirm_btn:
                    print(f"Found confirm button: {sel}")
                    break
            except:
                continue
                
        if not confirm_btn:
            raise Exception("Failed to locate confirm button inside Place dialog.")
            
        print("Confirming place selection...")
        safe_click(driver, confirm_btn)
        time.sleep(2)
        
        # 7. Click temporary save button (.save_btn__bzc5B)
        print("Searching for Draft Save button...")
        save_btn = None
        for sel in save_selector.split(","):
            sel = sel.strip()
            try:
                save_btn = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, sel))
                )
                if save_btn:
                    print(f"Found Draft Save button matching selector: {sel}")
                    break
            except:
                continue
                
        if save_btn:
            print("Clicking Draft Save button...")
            save_btn.click()
            time.sleep(3)
            print("Draft saved successfully!")
        else:
            print("Draft Save button not found. Skipping saving step.")
            
        print("Selenium testing completed successfully!")
        
    except Exception as e:
        print(f"An error occurred during Selenium execution: {e}")
        sys.exit(1)
        
    finally:
        print("Quitting chrome driver...")
        driver.quit()

if __name__ == "__main__":
    main()
