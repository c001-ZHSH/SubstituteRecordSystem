from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

options = webdriver.ChromeOptions()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

try:
    driver.get('http://127.0.0.1:5001')
    time.sleep(1)
    
    # 1. Check if empty row exists initially
    container = driver.find_element(By.ID, 'details-container')
    print("Initial details-container children:", len(container.find_elements(By.XPATH, "./*")))
    
    # 2. Click the button
    btn = driver.find_element(By.ID, 'manage-schedules-btn')
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(1)
    
    # 3. Check what is hidden
    print("input-section display:", driver.find_element(By.ID, 'input-section').value_of_css_property('display'))
    
    # 4. Check modal status
    modal = driver.find_element(By.ID, 'schedule-modal')
    print("modal classes:", modal.get_attribute('class'))
    print("schedule-list-view display:", driver.find_element(By.ID, 'schedule-list-view').value_of_css_property('display'))
    print("schedule-edit-view display:", driver.find_element(By.ID, 'schedule-edit-view').value_of_css_property('display'))
    
finally:
    driver.quit()
