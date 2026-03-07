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
    
    # Click manage schedules
    btn = driver.find_element(By.ID, 'manage-schedules-btn')
    btn.click()
    time.sleep(1)
    
    # If no schedules, let's create one
    rows = driver.find_elements(By.CSS_SELECTOR, '.delete-sch-btn')
    if not rows:
        driver.find_element(By.ID, 'new-schedule-btn').click()
        time.sleep(1)
        driver.find_element(By.ID, 'schedule-teacher-select').send_keys('王大明')
        driver.execute_script("document.getElementById('schedule-start-date').value = '2026-03-01';")
        driver.execute_script("document.getElementById('schedule-end-date').value = '2026-06-30';")
        driver.find_element(By.ID, 'save-schedule-btn').click()
        time.sleep(1)
        driver.switch_to.alert.accept()
        time.sleep(1)
    
    rows = driver.find_elements(By.CSS_SELECTOR, '.delete-sch-btn')
    print(f"Found {len(rows)} delete buttons.")
    if len(rows) > 0:
        rows[0].click()
        print("Clicked delete button.")
        time.sleep(1)
        alert = driver.switch_to.alert
        print("Alert text:", alert.text)
        alert.dismiss()
        print("Alert dismissed successfully.")
    else:
        print("No delete buttons found even after creation.")
except Exception as e:
    print(f"Error: {e}")
finally:
    driver.quit()
