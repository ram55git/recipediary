import base64
import os
import json
from dotenv import load_dotenv

load_dotenv()

print("Testing Google Cloud Credentials...\n")

# Test GOOGLE_CREDENTIALS_BASE64
b64 = os.getenv('GOOGLE_CREDENTIALS_BASE64')
if b64:
    try:
        decoded = base64.b64decode(b64).decode('utf-8')
        data = json.loads(decoded)
        print("✓ GOOGLE_CREDENTIALS_BASE64 is valid!")
        print(f"  Project ID: {data.get('project_id')}")
        print(f"  Client Email: {data.get('client_email')}")
        print(f"  Has Private Key: {'Yes' if data.get('private_key') else 'No'}")
    except Exception as e:
        print(f"✗ GOOGLE_CREDENTIALS_BASE64 decoding failed: {str(e)}")
else:
    print("✗ GOOGLE_CREDENTIALS_BASE64 not found in .env")

# Test file path
file_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
if file_path:
    print(f"\n✓ GOOGLE_APPLICATION_CREDENTIALS found: {file_path}")
    if os.path.exists(file_path):
        print("  ✓ File exists")
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            print(f"  ✓ Valid JSON file")
            print(f"  Project ID: {data.get('project_id')}")
            print(f"  Client Email: {data.get('client_email')}")
        except Exception as e:
            print(f"  ✗ Error reading file: {str(e)}")
    else:
        print("  ✗ File does NOT exist")
else:
    print("\n✗ GOOGLE_APPLICATION_CREDENTIALS not found")
