import os
import tempfile
import base64
from dotenv import load_dotenv
from google.cloud import speech_v1p1beta1 as speech

load_dotenv()

print("Testing Google Cloud Speech API...\n")

# Setup credentials (same as app.py)
if os.getenv('GOOGLE_CREDENTIALS_BASE64'):
    try:
        creds_json = base64.b64decode(os.getenv('GOOGLE_CREDENTIALS_BASE64')).decode('utf-8')
        creds_path = tempfile.gettempdir() + '/google-credentials-test.json'
        with open(creds_path, 'w') as f:
            f.write(creds_json)
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path
        print(f"✓ Credentials loaded to: {creds_path}\n")
    except Exception as e:
        print(f"✗ Failed to load credentials: {str(e)}\n")
        exit(1)

# Test API connection
try:
    print("Creating Speech client...")
    client = speech.SpeechClient()
    print("✓ Speech client created successfully!")
    
    # Try a simple recognition request to verify API is enabled
    print("\nTesting API with a simple request...")
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="en-US",
    )
    
    # Empty audio just to test API access
    audio = speech.RecognitionAudio(content=b'')
    
    try:
        # This will fail with invalid audio, but if API is enabled, we'll get a different error
        response = client.recognize(config=config, audio=audio)
    except Exception as api_error:
        error_msg = str(api_error)
        if "API has not been used" in error_msg or "disabled" in error_msg:
            print("\n✗ Speech-to-Text API is NOT ENABLED!")
            print("\n🔧 To fix:")
            print("1. Go to: https://console.cloud.google.com/apis/library/speech.googleapis.com?project=silent-elevator-401904")
            print("2. Click 'ENABLE' button")
            print("3. Wait 1-2 minutes for activation")
        elif "permission" in error_msg.lower() or "403" in error_msg:
            print("\n✗ Service account lacks permissions!")
            print("\n🔧 To fix:")
            print("1. Go to: https://console.cloud.google.com/iam-admin/iam?project=silent-elevator-401904")
            print("2. Find: recipediary@silent-elevator-401904.iam.gserviceaccount.com")
            print("3. Add role: 'Cloud Speech Client' or 'Cloud Speech Administrator'")
        elif "invalid" in error_msg.lower() or "empty" in error_msg.lower():
            print("\n✅ API is enabled and credentials work!")
            print("(The error is just because we sent empty audio for testing)")
        else:
            print(f"\n⚠ Unexpected error: {error_msg}")
    
except Exception as e:
    print(f"\n✗ Error creating Speech client: {str(e)}")
