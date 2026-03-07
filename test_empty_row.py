from selenium import webdriver
from selenium.webdriver.common.by import By
import time

options = webdriver.ChromeOptions()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

try:
    driver.get('http://127.0.0.1:5001')
    time.sleep(1)
    
    container = driver.find_element(By.ID, 'details-container')
    print("Children count:", len(container.find_elements(By.XPATH, "./*")))
    print("Container HTML:")
    print(container.get_attribute('innerHTML'))
finally:
    driver.quit()
