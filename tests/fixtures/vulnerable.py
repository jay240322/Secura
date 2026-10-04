import os
import hashlib
import requests

user_input = input("Enter ID: ")

query = "SELECT * FROM users WHERE id=" + user_input

os.system(user_input)

requests.get("https://example.com", verify=False)

password_hash = hashlib.md5(user_input.encode())