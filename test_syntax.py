from selenium import webdriver
from selenium.webdriver.common.by import By
import time
options = webdriver.ChromeOptions()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)
try:
    driver.get('http://127.0.0.1:5001')
    time.sleep(1)
    for entry in driver.get_log('browser'):
        print(entry)
except Exception as e:
    print(f"Error: {e}")
finally:
    driver.quit()
