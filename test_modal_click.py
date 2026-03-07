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
    
    btn = driver.find_element(By.ID, 'manage-schedules-btn')
    print("Before click, main section display:", driver.find_element(By.ID, 'input-section').value_of_css_property('display'))
    
    driver.execute_script("arguments[0].click();", btn)
    time.sleep(1)
    
    print("After click, main section display:", driver.find_element(By.ID, 'input-section').value_of_css_property('display'))
    modal = driver.find_element(By.ID, 'schedule-modal')
    print("Modal display:", modal.value_of_css_property('display'))
    print("Modal classes:", modal.get_attribute('class'))
    
    print("Modal InnerHTML:")
    print(modal.get_attribute('innerHTML')[:500] + "...")
finally:
    driver.quit()
