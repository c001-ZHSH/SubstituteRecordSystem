import requests
import json

base_url = 'http://127.0.0.1:5001/api'

print("Adding schedule...")
payload = {
    "teacher_name": "王大明",
    "start_date": "2026-03-01",
    "end_date": "2026-06-30",
    "periods": [
        {"day_of_week": 1, "period_num": 1, "subject": "國文", "class_name": "一甲", "is_moe_subsidized": False},
        {"day_of_week": 1, "period_num": 2, "subject": "國文", "class_name": "一甲", "is_moe_subsidized": False},
        {"day_of_week": 5, "period_num": 7, "subject": "輔導", "class_name": "二甲", "is_moe_subsidized": True}
    ]
}
res = requests.post(f"{base_url}/schedules", json=payload)
print(res.status_code, res.json())

print("\nMatching schedule...")
res = requests.get(f"{base_url}/schedule/match?teacher_name=王大明&start_date=2026-03-02&start_period=2&end_date=2026-03-06&end_period=7")
print(res.status_code, json.dumps(res.json(), indent=2, ensure_ascii=False))
