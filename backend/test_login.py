import requests
import json

url = "http://127.0.0.1:8000/api/auth/login"
payload = {
    "email": "admin@gatekeeper.com",
    "password": "admin123"
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
