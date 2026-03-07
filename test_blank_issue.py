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
    
    # Check JS console logs 
    print("Initial Console Logs:")
    for entry in driver.get_log('browser'):
        print(entry)
        
    btn = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.ID, 'manage-schedules-btn')))
    btn.click()
    
    time.sleep(1)
    
    print("\nPost-Click Console Logs:")
    for entry in driver.get_log('browser'):
        print(entry)
        
finally:
    driver.quit()
