from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from google.cloud import speech_v1p1beta1 as speech
import google.generativeai as genai
import os
import json
from pathlib import Path
import tempfile
from dotenv import load_dotenv
import soundfile as sf
import numpy as np
from scipy import signal as scipy_signal
import io
from supabase import create_client, Client
from datetime import datetime
import jwt
from functools import wraps
import base64
import time
from collections import defaultdict
import requests
import config_credits

# Load environment variables from .env file
load_dotenv()

# Handle Google Cloud credentials - prioritize base64 for consistency
if os.getenv('GOOGLE_CREDENTIALS_BASE64'):
    # Decode base64 credentials (works for both Railway and local)
    try:
        creds_json = base64.b64decode(os.getenv('GOOGLE_CREDENTIALS_BASE64')).decode('utf-8')
        creds_path = tempfile.gettempdir() + '/google-credentials.json'
        with open(creds_path, 'w') as f:
            f.write(creds_json)
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path
        print(f"✓ Google credentials loaded from GOOGLE_CREDENTIALS_BASE64 to {creds_path}")
    except Exception as e:
        print(f"✗ Failed to decode GOOGLE_CREDENTIALS_BASE64: {str(e)}")
        # Fall back to file path if available
        if os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
            print(f"✓ Using GOOGLE_APPLICATION_CREDENTIALS file path: {os.getenv('GOOGLE_APPLICATION_CREDENTIALS')}")
elif os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON'):
    # Use JSON string directly
    creds_json = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON')
    creds_path = tempfile.gettempdir() + '/google-credentials.json'
    with open(creds_path, 'w') as f:
        f.write(creds_json)
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = creds_path
    print(f"✓ Google credentials loaded from GOOGLE_APPLICATION_CREDENTIALS_JSON to {creds_path}")
elif os.getenv('GOOGLE_APPLICATION_CREDENTIALS'):
    print(f"✓ Using GOOGLE_APPLICATION_CREDENTIALS file path: {os.getenv('GOOGLE_APPLICATION_CREDENTIALS')}")
else:
    print("⚠ WARNING: No Google Cloud credentials configured!")

app = Flask(__name__, static_folder='.')
CORS(app)

# Configuration
GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')

# Rate Limiting Configuration
RATE_LIMIT_WINDOW = 60  # 1 minute
RATE_LIMIT_MAX_REQUESTS = 5  # 5 requests per minute
rate_limit_store = defaultdict(list)

def check_rate_limit(user_id):
    """Check if user has exceeded rate limit"""
    current_time = time.time()
    # Filter out old requests
    rate_limit_store[user_id] = [t for t in rate_limit_store[user_id] if current_time - t < RATE_LIMIT_WINDOW]
    
    if len(rate_limit_store[user_id]) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    
    rate_limit_store[user_id].append(current_time)
    return True

# Configure Gemini API
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # Use the latest stable flash model
    model = genai.GenerativeModel('models/gemini-2.5-flash')

# Initialize Supabase client only if credentials are provided
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✓ Supabase client initialized")
    except Exception as e:
        print(f"⚠ Warning: Failed to initialize Supabase client: {str(e)}")
        print("  Database features will be disabled.")
        supabase = None
else:
    print("⚠ Warning: Supabase credentials not found in .env file.")
    print("  Database features will be disabled.")
    print("  Add SUPABASE_URL and SUPABASE_KEY to .env to enable gallery and recipe management.")

# Ensure uploads directory exists
UPLOAD_FOLDER = Path('uploads')
UPLOAD_FOLDER.mkdir(exist_ok=True)


# ============================================================================
# AUTHENTICATION MIDDLEWARE
# ============================================================================

def verify_token(f):
    """Decorator to verify Supabase JWT token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        if not SUPABASE_JWT_SECRET:
            return jsonify({'error': 'Server authentication not configured'}), 500
        
        try:
            # Verify and decode the JWT token
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=['HS256'],
                audience='authenticated'
            )
            
            # Extract user_id from the token
            request.user_id = payload.get('sub')
            
            if not request.user_id:
                return jsonify({'error': 'Invalid token'}), 401
            
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'error': f'Invalid token: {str(e)}'}), 401
    
    return decorated_function


@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory('.', 'index.html')


@app.route('/config.js')
def serve_config():
    """Serve configuration with environment variables injected"""
    config_js = f"""
// Auto-generated configuration from server
const Config = {{
    supabase: {{
        url: '{SUPABASE_URL or ''}',
        anonKey: '{SUPABASE_KEY or ''}'
    }}
}};
"""
    return config_js, 200, {'Content-Type': 'application/javascript'}


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('.', path)


@app.route('/api/process-recipe', methods=['POST'])
@verify_token
def process_recipe():
    """
    Process uploaded audio file:
    1. Transcribe using Google Speech-to-Text
    2. Extract recipe information using Gemini
    """
    # Check rate limit
    if not check_rate_limit(request.user_id):
        return jsonify({'error': 'Rate limit exceeded. Please wait a minute before trying again.'}), 429

    RECIPE_COST = config_credits.RECIPE_GENERATION_COST
    
    # 1. Pre-check credits (Read-only)
    # We check if user has enough credits BEFORE starting the expensive process
    try:
        token = request.headers.get('Authorization').split(' ')[1]
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Query profiles table via REST API to ensure we use the user's auth context
        check_url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{request.user_id}&select=credits"
        check_response = requests.get(check_url, headers=headers)
        
        current_credits = 0
        if check_response.status_code == 200:
            data = check_response.json()
            if data and len(data) > 0:
                current_credits = data[0]['credits']
            else:
                # If profile doesn't exist, they have default credits
                current_credits = config_credits.DEFAULT_NEW_USER_CREDITS
        else:
            print(f"Error checking credits status: {check_response.status_code} - {check_response.text}")
            return jsonify({'error': 'Unable to verify credit balance.'}), 500
            
        if current_credits < RECIPE_COST:
            return jsonify({
                'error': 'Insufficient credits', 
                'code': 'INSUFFICIENT_CREDITS',
                'current_balance': current_credits,
                'required': RECIPE_COST
            }), 402
            
    except Exception as e:
        print(f"Error checking credit balance: {str(e)}")
        # Fail safe: If we can't check, we might block or allow. 
        # Let's block to be safe, but with a helpful message.
        return jsonify({'error': 'Unable to verify credit balance. Please try again.'}), 500

    try:
        # Check if file is present
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400

        audio_file = request.files['audio']
        language_code = request.form.get('language', 'en-US')  # Default to English US
        output_language = request.form.get('output_language', 'en') # Default to English
        
        # Save audio file temporarily
        temp_audio_path = UPLOAD_FOLDER / f'temp_{audio_file.filename}'
        audio_file.save(temp_audio_path)

        # Step 1: Transcribe audio
        print(f"Starting transcription with language: {language_code}...")
        transcription = transcribe_audio(temp_audio_path, language_code)
        
        if not transcription:
            # Clean up temp file before returning error
            if temp_audio_path.exists():
                temp_audio_path.unlink()
            return jsonify({
                'error': 'Failed to transcribe audio. Please ensure:\n• Audio contains clear speech\n• Recording is not too quiet\n• There is minimal background noise\n• Audio duration is at least 1 second'
            }), 400

        print(f"Transcription: {transcription}")

        # Step 2: Extract recipe using Gemini
        print(f"Extracting recipe information in {output_language}...")
        recipe_data = extract_recipe_with_gemini(transcription, output_language)

        # Clean up temp file
        if temp_audio_path.exists():
            temp_audio_path.unlink()

        # Add transcription to response
        recipe_data['transcription'] = transcription
        
        # Step 3: Deduct Credits (ONLY after successful generation)
        try:
            token = request.headers.get('Authorization').split(' ')[1]
            url = f"{SUPABASE_URL}/rest/v1/rpc/deduct_credits"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Call the RPC function
            deduct_response = requests.post(url, headers=headers, json={"amount": RECIPE_COST})
            deduct_result = deduct_response.json()
            
            if not deduct_result.get('success'):
                # This is a rare edge case: User had credits at start, but spent them during generation
                # We will still return the recipe (freebie) but warn the user or log it
                print(f"⚠️ Warning: Failed to deduct credits AFTER generation: {deduct_result.get('error')}")
                # We don't block the user here because they already waited for the recipe
            else:
                print(f"✓ Deducted {RECIPE_COST} credits. New balance: {deduct_result.get('new_balance')}")
                # Add credit info to response so frontend can update UI
                recipe_data['credits_remaining'] = deduct_result.get('new_balance')
                
        except Exception as credit_error:
            print(f"Error deducting credits: {str(credit_error)}")
            # Continue anyway, don't block the recipe
        
        # Save recipe to Supabase database with user_id
        if supabase:
            try:
                saved_recipe = save_recipe_to_db(recipe_data, request.user_id)
                recipe_data['id'] = saved_recipe.get('id')
                print(f"✓ Recipe saved to database with ID: {recipe_data['id']}")
            except Exception as db_error:
                print(f"Warning: Failed to save to database: {str(db_error)}")
                # Continue without database save

        return jsonify(recipe_data)

    except Exception as e:
        print(f"Error processing recipe: {str(e)}")
        # Clean up temp file if it exists
        if 'temp_audio_path' in locals() and temp_audio_path.exists():
            temp_audio_path.unlink()
            
        return jsonify({'error': f'We encountered an issue generating your recipe. Please try again. (Error: {str(e)})'}), 500


def transcribe_audio(audio_path, language_code='en-US'):
    """
    Transcribe audio file using Google Speech-to-Text API
    """
    try:
        # Initialize the Speech client
        client = speech.SpeechClient()

        print(f"Processing audio file: {audio_path}")
        
        # Check file size
        file_size = os.path.getsize(audio_path)
        print(f"Audio file size: {file_size} bytes")
        
        if file_size == 0:
            print("Error: Audio file is empty")
            return None
        
        # For WebM files, convert using ffmpeg (more reliable than soundfile)
        file_ext = Path(audio_path).suffix.lower()
        
        if file_ext in ['.webm', '.opus']:
            print("Converting WebM to WAV using ffmpeg...")
            try:
                import subprocess
                
                # Convert to WAV using ffmpeg
                wav_path = str(audio_path).replace(file_ext, '_converted.wav')
                
                # ffmpeg command: convert to mono, 16kHz, 16-bit PCM WAV
                cmd = [
                    'ffmpeg', '-y', '-i', str(audio_path),
                    '-acodec', 'pcm_s16le',
                    '-ar', '16000',
                    '-ac', '1',
                    wav_path
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    print(f"ffmpeg conversion failed: {result.stderr}")
                    raise Exception("ffmpeg conversion failed")
                
                print(f"✓ Converted to WAV: {wav_path}")
                audio_path = Path(wav_path)
                file_ext = '.wav'
                
            except FileNotFoundError:
                print("⚠ ffmpeg not found, trying soundfile conversion...")
            except Exception as ffmpeg_error:
                print(f"⚠ ffmpeg error: {ffmpeg_error}, trying soundfile...")
        
        # Try with audio conversion (for non-WebM or if ffmpeg failed)
        try:
            # Load audio file with soundfile
            audio_data, sample_rate = sf.read(audio_path, always_2d=True)
            
            print(f"Loaded audio: {audio_data.shape} at {sample_rate}Hz")
            
            # Check if audio has data
            if len(audio_data) == 0:
                print("Error: Audio data is empty")
                return None
            
            # Convert to mono if stereo (average channels)
            if audio_data.shape[1] > 1:
                audio_data = np.mean(audio_data, axis=1)
            else:
                audio_data = audio_data[:, 0]
            
            # Resample to 16kHz if needed (optimal for speech recognition)
            target_rate = 16000
            if sample_rate != target_rate:
                # Calculate resampling ratio
                num_samples = int(len(audio_data) * target_rate / sample_rate)
                audio_data = scipy_signal.resample(audio_data, num_samples)
                sample_rate = target_rate
                print(f"Resampled to {sample_rate}Hz, {len(audio_data)} samples")
            
            # Convert to 16-bit PCM and export as WAV in memory
            wav_io = io.BytesIO()
            sf.write(wav_io, audio_data, sample_rate, subtype='PCM_16', format='WAV')
            wav_io.seek(0)
            content = wav_io.read()
            
            print(f"Generated WAV: {len(content)} bytes")
            
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=16000,
                language_code=language_code,  # Use provided language code
                enable_automatic_punctuation=True,
                model='default',
                audio_channel_count=1,
            )
            
            print("Using converted audio format (LINEAR16)")
            
        except Exception as conv_error:
            print(f"Audio conversion failed: {conv_error}")
            
            # Fallback: Read raw audio file
            with open(audio_path, 'rb') as audio_file:
                content = audio_file.read()
            
            print(f"Using raw audio: {len(content)} bytes")
            
            # Try to auto-detect encoding based on file extension
            if file_ext in ['.webm', '.opus']:
                encoding = speech.RecognitionConfig.AudioEncoding.WEBM_OPUS
                sample_rate = 48000
            elif file_ext in ['.mp3']:
                encoding = speech.RecognitionConfig.AudioEncoding.MP3
                sample_rate = 44100
            elif file_ext in ['.flac']:
                encoding = speech.RecognitionConfig.AudioEncoding.FLAC
                sample_rate = 44100
            else:  # Default to LINEAR16 for WAV and others
                encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
                sample_rate = 16000
            
            config = speech.RecognitionConfig(
                encoding=encoding,
                sample_rate_hertz=sample_rate,
                language_code=language_code,  # Use provided language code
                enable_automatic_punctuation=True,
                model='default',
            )
            
            print(f"Using direct audio format: {encoding} at {sample_rate}Hz")

        audio = speech.RecognitionAudio(content=content)

        # Perform the transcription
        print("Sending audio to Google Speech-to-Text...")
        response = client.recognize(config=config, audio=audio)

        # Extract transcription
        transcription = ''
        for result in response.results:
            transcription += result.alternatives[0].transcript + ' '

        transcription = transcription.strip()
        
        if not transcription:
            print("No transcription results returned from API - audio may be empty or unclear")
            return None
            
        print(f"Transcription successful: {transcription[:100]}...")
        return transcription

    except Exception as e:
        print(f"Error in transcription: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def extract_recipe_with_gemini(transcription, output_language='en'):
    """
    Use Google Gemini to extract structured recipe information from transcription
    """
    try:
        # Map language codes to full names for better prompting
        language_names = {
            'en': 'English',
            'es': 'Spanish',
            'hi': 'Hindi',
            'ta': 'Tamil',
            'te': 'Telugu',
            'ml': 'Malayalam',
            'kn': 'Kannada',
            'bn': 'Bengali',
            'mr': 'Marathi',
            'gu': 'Gujarati',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'ar': 'Arabic',
            'ru': 'Russian',
            'th': 'Thai',
            'vi': 'Vietnamese',
            'id': 'Indonesian',
            'ms': 'Malay'
        }
        
        target_language = language_names.get(output_language, 'English')
        
        prompt = f"""
You are a recipe extraction expert. Analyze the following transcription of someone describing a recipe and extract structured recipe information.

Transcription:
{transcription}

Please extract and return the recipe information in the following JSON format.
IMPORTANT: The content of the recipe (name, description, ingredients, instructions, tips) MUST be in {target_language}.

{{
    "recipe_name": "Name of the recipe in {target_language}",
    "author": "Author name if mentioned, otherwise 'Home Chef'",
    "description": "Brief description of the dish in {target_language}",
    "prep_time": "preparation time (e.g., '15 minutes'). If not mentioned, estimate based on recipe complexity",
    "cook_time": "cooking/baking time (e.g., '30 minutes'). If not mentioned, estimate based on the cooking method",
    "yield": "number of servings or people (e.g., '4 servings', 'Serves 6', '2-3 people'). If not mentioned, estimate based on ingredient quantities",
    "ingredients": [
        "quantity measurement ingredient (e.g., '2 cups (240g) all-purpose flour') in {target_language}",
        "1 teaspoon vanilla extract in {target_language}",
        "..."
    ],
    "instructions": [
        "Detailed step 1 in {target_language}",
        "Detailed step 2 in {target_language}",
        "..."
    ],
    "tips": [
        "Helpful tip 1 if any mentioned in {target_language}",
        "Helpful tip 2 if any mentioned in {target_language}"
    ]
}}

Important guidelines:
- ALWAYS provide prep_time, cook_time, and yield. If not explicitly mentioned, make reasonable estimates based on the recipe
- Extract all ingredients with quantities in format: "quantity measurement ingredient (metric equivalent if applicable)"
- For example: "2 cups (240g) flour", "1 tablespoon olive oil", "3 large eggs"
- Break down instructions into clear, detailed steps
- Include any cooking tips, variations, or notes mentioned in the tips array
- If author is not mentioned, use "Home Chef" as default
- Ensure the recipe_name is descriptive and appetizing
- Make the instructions clear and easy to follow
- For yield, always specify how many people/servings (e.g., "Serves 4", "4 servings", "2-3 people") Calculate the approximate number if not explicitly mentioned.
- For cook_time, include the actual cooking/baking time on heat/in oven. Calculate the approximate time if not explicitly mentioned.
- For prep_time, include time for chopping, mixing, marinating, etc.Calculate approximate time if not explicitly mentioned.
- TRANSLATION: Ensure all text fields (except keys) are translated to {target_language} if the transcription is in a different language.

Return ONLY the JSON object, no additional text.
"""

        # Generate content using Gemini with timeout (no auto-retry to avoid excessive API calls)
        print("Calling Gemini API...")
        
        # Configure generation with timeout
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        }
        
        try:
            response = model.generate_content(
                prompt,
                generation_config=generation_config,
                request_options={"timeout": 60}  # 60 second timeout
            )
        except Exception as api_error:
            error_msg = str(api_error)
            if "timeout" in error_msg.lower() or "504" in error_msg:
                raise Exception("Gemini API is taking too long. This recipe might be too complex. Please try with a shorter recipe or simplify your description.")
            else:
                raise
        
        # Extract the text response safely
        try:
            response_text = response.text.strip()
        except Exception as e:
            # Handle cases where response.text fails (e.g. safety filters or max tokens with no valid part)
            print(f"Error accessing response.text: {str(e)}")
            
            if not response.candidates:
                raise Exception("Gemini returned no candidates.")
                
            candidate = response.candidates[0]
            print(f"Candidate finish reason: {candidate.finish_reason}")
            
            # Check for safety blocks
            if candidate.finish_reason == 3: # SAFETY
                raise Exception("The recipe content was flagged by safety filters. Please try again with different wording.")
                
            # Check for max tokens
            if candidate.finish_reason == 2: # MAX_TOKENS
                # Try to get partial text if available
                if candidate.content and candidate.content.parts:
                    response_text = candidate.content.parts[0].text.strip()
                    print("Warning: Response truncated due to max tokens, attempting to parse partial response.")
                else:
                    raise Exception("Response was truncated due to length limits and no text was returned.")
            else:
                raise Exception(f"Gemini returned no valid text. Finish reason: {candidate.finish_reason}")
        
        print(f"Raw Gemini response (first 500 chars): {response_text[:500]}")
        
        # Remove markdown code blocks if present
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        # Try to find JSON object boundaries if response has extra text
        json_start = response_text.find('{')
        json_end = response_text.rfind('}')
        if json_start != -1 and json_end != -1 and json_end > json_start:
            response_text = response_text[json_start:json_end + 1]
        
        print(f"Cleaned response (first 500 chars): {response_text[:500]}")

        # Parse JSON response with better error handling
        try:
            recipe_data = json.loads(response_text)
        except json.JSONDecodeError as json_err:
            print(f"JSON parsing failed at position {json_err.pos}")
            print(f"Error: {json_err.msg}")
            # Try to fix common JSON issues
            
            # Fix trailing commas in arrays/objects
            import re
            response_text = re.sub(r',(\s*[}\]])', r'\1', response_text)
            
            # Try parsing again
            try:
                recipe_data = json.loads(response_text)
                print("Successfully parsed after fixing trailing commas")
            except:
                # If still failing, raise the original error
                raise json_err
        
        # Ensure critical fields have default values if missing
        if not recipe_data.get('prep_time'):
            recipe_data['prep_time'] = '15 minutes'
        if not recipe_data.get('cook_time'):
            recipe_data['cook_time'] = '30 minutes'
        if not recipe_data.get('yield'):
            recipe_data['yield'] = 'Serves 4'
        if not recipe_data.get('author'):
            recipe_data['author'] = 'Home Chef'

        return recipe_data

    except json.JSONDecodeError as e:
        print(f"Error parsing Gemini response: {str(e)}")
        print(f"Full response text:\n{response_text}")
        print(f"Character at error position: {response_text[e.pos-10:e.pos+10] if e.pos < len(response_text) else 'N/A'}")
        # Return a fallback structure
        return {
            'recipe_name': 'Recipe from Audio',
            'author': 'Home Chef',
            'description': 'Could not extract structured recipe data. Please try again.',
            'ingredients': [],
            'instructions': [transcription],
            'prep_time': '15 minutes',
            'cook_time': '30 minutes',
            'yield': 'Serves 4',
            'tips': ['The AI had trouble parsing the recipe. You can edit this manually.']
        }
    except Exception as e:
        print(f"Error using Gemini API: {str(e)}")
        raise


# ============================================================================
# DATABASE FUNCTIONS
# ============================================================================

def save_recipe_to_db(recipe_data, user_id):
    """Save recipe to Supabase database with user_id"""
    if not supabase:
        raise Exception("Supabase client not initialized")
    
    # Prepare data for database (convert lists to JSON)
    db_data = {
        'user_id': user_id,
        'recipe_name': recipe_data.get('recipe_name', 'Untitled Recipe'),
        'author': recipe_data.get('author', 'Home Chef'),
        'description': recipe_data.get('description', ''),
        'prep_time': recipe_data.get('prep_time', ''),
        'cook_time': recipe_data.get('cook_time', ''),
        'yield': recipe_data.get('yield', ''),
        'ingredients': recipe_data.get('ingredients', []),
        'instructions': recipe_data.get('instructions', []),
        'tips': recipe_data.get('tips', []),
        'created_at': datetime.utcnow().isoformat()
    }
    
    result = supabase.table('recipes').insert(db_data).execute()
    return result.data[0] if result.data else None


# ============================================================================
# RECIPE CRUD API ENDPOINTS
# ============================================================================

@app.route('/api/recipes', methods=['GET'])
@verify_token
def get_recipes():
    """Get all recipes for the authenticated user with optional search and filter"""
    if not supabase:
        return jsonify({'error': 'Database not configured'}), 503
    
    try:
        search_query = request.args.get('search', '').strip()
        
        # Filter by user_id and order by newest first
        result = supabase.table('recipes').select('*').eq('user_id', request.user_id).order('created_at', desc=True).execute()
        
        # Filter in Python if search query provided (since supabase 2.0.3 doesn't support or_)
        recipes = result.data
        if search_query:
            search_lower = search_query.lower()
            recipes = [
                recipe for recipe in recipes
                if (recipe.get('recipe_name', '').lower().find(search_lower) >= 0 or
                    recipe.get('author', '').lower().find(search_lower) >= 0 or
                    recipe.get('description', '').lower().find(search_lower) >= 0)
            ]
        
        return jsonify({
            'recipes': recipes,
            'count': len(recipes)
        })
        
    except Exception as e:
        print(f"Error fetching recipes: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/recipes/<recipe_id>', methods=['GET'])
@verify_token
def get_recipe(recipe_id):
    """Get a single recipe by ID (only if owned by user)"""
    if not supabase:
        return jsonify({'error': 'Database not configured'}), 503
    
    try:
        result = supabase.table('recipes').select('*').eq('id', recipe_id).eq('user_id', request.user_id).execute()
        
        if not result.data:
            return jsonify({'error': 'Recipe not found'}), 404
        
        return jsonify(result.data[0])
        
    except Exception as e:
        print(f"Error fetching recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/recipes', methods=['POST'])
@verify_token
def create_recipe():
    """Create a new recipe manually"""
    if not supabase:
        return jsonify({'error': 'Database not configured'}), 503
    
    try:
        recipe_data = request.json
        saved_recipe = save_recipe_to_db(recipe_data, request.user_id)
        
        return jsonify(saved_recipe), 201
        
    except Exception as e:
        print(f"Error creating recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/recipes/<recipe_id>', methods=['PUT'])
@verify_token
def update_recipe(recipe_id):
    """Update an existing recipe (only if owned by user)"""
    if not supabase:
        return jsonify({'error': 'Database not configured'}), 503
    
    try:
        recipe_data = request.json
        
        # Prepare update data
        update_data = {
            'recipe_name': recipe_data.get('recipe_name'),
            'author': recipe_data.get('author'),
            'description': recipe_data.get('description'),
            'prep_time': recipe_data.get('prep_time'),
            'cook_time': recipe_data.get('cook_time'),
            'yield': recipe_data.get('yield'),
            'ingredients': recipe_data.get('ingredients'),
            'instructions': recipe_data.get('instructions'),
            'tips': recipe_data.get('tips'),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        # Update only if recipe belongs to user
        result = supabase.table('recipes').update(update_data).eq('id', recipe_id).eq('user_id', request.user_id).execute()
        
        if not result.data:
            return jsonify({'error': 'Recipe not found or unauthorized'}), 404
        
        return jsonify(result.data[0])
        
    except Exception as e:
        print(f"Error updating recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/recipes/<recipe_id>', methods=['DELETE'])
@verify_token
def delete_recipe(recipe_id):
    """Delete a recipe (only if owned by user)"""
    if not supabase:
        return jsonify({'error': 'Database not configured'}), 503
    
    try:
        # Delete only if recipe belongs to user
        result = supabase.table('recipes').delete().eq('id', recipe_id).eq('user_id', request.user_id).execute()
        
        if not result.data:
            return jsonify({'error': 'Recipe not found or unauthorized'}), 404
        
        return jsonify({'message': 'Recipe deleted successfully', 'id': recipe_id})
        
    except Exception as e:
        print(f"Error deleting recipe: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/credits', methods=['GET'])
@verify_token
def get_user_credits():
    """Get current user credits"""
    try:
        # Call Supabase RPC to get credits or query table directly
        # We use the user's token to authenticate with Supabase
        token = request.headers.get('Authorization').split(' ')[1]
        
        url = f"{SUPABASE_URL}/rest/v1/profiles?select=credits&id=eq.{request.user_id}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return jsonify({'credits': data[0]['credits']})
            else:
                # Profile might not exist yet for old users or if trigger failed
                # We return the default credits so the UI looks correct.
                # The actual profile will be created when they first try to spend credits
                # via the deduct_credits RPC which handles missing profiles.
                return jsonify({'credits': config_credits.DEFAULT_NEW_USER_CREDITS})
        else:
            return jsonify({'error': 'Failed to fetch credits'}), 500
            
    except Exception as e:
        print(f"Error fetching credits: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/config/pricing', methods=['GET'])
def get_pricing_config():
    """Get pricing configuration"""
    return jsonify({
        'packages': config_credits.PRICING_PACKAGES,
        'recipe_cost': config_credits.RECIPE_GENERATION_COST,
        'default_credits': config_credits.DEFAULT_NEW_USER_CREDITS
    })

import stripe
import razorpay

# Initialize Payment Gateways
try:
    stripe.api_key = config_credits.STRIPE_SECRET_KEY
except:
    print("⚠️ Stripe not configured")

try:
    razorpay_client = razorpay.Client(auth=(config_credits.RAZORPAY_KEY_ID, config_credits.RAZORPAY_KEY_SECRET))
except:
    print("⚠️ Razorpay not configured")

@app.route('/api/config/payments', methods=['GET'])
def get_payment_config():
    """Get public payment keys"""
    return jsonify({
        'stripePublicKey': config_credits.STRIPE_PUBLIC_KEY,
        'razorpayKeyId': config_credits.RAZORPAY_KEY_ID
    })

@app.route('/api/create-payment-intent', methods=['POST'])
@verify_token
def create_payment_intent():
    """Create Stripe Payment Intent"""
    try:
        data = request.json
        package_id = data.get('packageId')
        
        # Find package
        package = next((p for p in config_credits.PRICING_PACKAGES if p['id'] == package_id), None)
        if not package:
            return jsonify({'error': 'Invalid package'}), 400
            
        # Create Payment Intent
        intent = stripe.PaymentIntent.create(
            amount=int(package['price_usd'] * 100), # Amount in cents
            currency='usd',
            metadata={
                'user_id': request.user_id,
                'credits': package['credits'],
                'package_id': package_id
            }
        )
        
        return jsonify({
            'clientSecret': intent.client_secret
        })
    except Exception as e:
        print(f"Stripe Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-razorpay-order', methods=['POST'])
@verify_token
def create_razorpay_order():
    """Create Razorpay Order"""
    try:
        data = request.json
        package_id = data.get('packageId')
        
        # Find package
        package = next((p for p in config_credits.PRICING_PACKAGES if p['id'] == package_id), None)
        if not package:
            return jsonify({'error': 'Invalid package'}), 400
            
        # Create Order
        order_amount = int(package['price_inr'] * 100) # Amount in paise
        order_currency = 'INR'
        
        order_data = {
            'amount': order_amount,
            'currency': order_currency,
            'receipt': f'order_{int(time.time())}',
            'notes': {
                'user_id': request.user_id,
                'credits': package['credits'],
                'package_id': package_id
            }
        }
        
        order = razorpay_client.order.create(data=order_data)
        
        return jsonify({
            'id': order['id'],
            'amount': order['amount'],
            'currency': order['currency'],
            'key_id': config_credits.RAZORPAY_KEY_ID
        })
    except Exception as e:
        print(f"Razorpay Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-payment', methods=['POST'])
@verify_token
def verify_payment():
    """Verify Payment and Add Credits"""
    try:
        data = request.json
        provider = data.get('provider')
        
        credits_to_add = 0
        
        if provider == 'razorpay':
            # Verify Razorpay Signature
            params_dict = {
                'razorpay_order_id': data.get('razorpay_order_id'),
                'razorpay_payment_id': data.get('razorpay_payment_id'),
                'razorpay_signature': data.get('razorpay_signature')
            }
            
            # Verify signature
            razorpay_client.utility.verify_payment_signature(params_dict)
            
            # Get credits from order notes (we need to fetch order details or pass them)
            # For simplicity, we'll trust the package_id passed from client but verify against config
            # In production, fetch order from Razorpay to get notes
            package_id = data.get('package_id')
            package = next((p for p in config_credits.PRICING_PACKAGES if p['id'] == package_id), None)
            if package:
                credits_to_add = package['credits']
                
        elif provider == 'stripe':
            # Verify Stripe Payment Intent
            payment_intent_id = data.get('payment_intent_id')
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            if intent.status == 'succeeded':
                credits_to_add = int(intent.metadata.get('credits', 0))
            else:
                return jsonify({'error': 'Payment not successful'}), 400
                
        else:
            return jsonify({'error': 'Invalid provider'}), 400
            
        if credits_to_add > 0:
            # Add credits via Supabase RPC
            url = f"{SUPABASE_URL}/rest/v1/rpc/add_credits"
            headers = {
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}", # Service role key preferred
                "Content-Type": "application/json"
            }
            
            # We need a service role key to add credits securely if RLS prevents it
            # But our RPC is SECURITY DEFINER so anon key works if we allow it
            # Ideally, use a secret key here.
            
            payload = {
                "user_id": request.user_id,
                "amount": credits_to_add
            }
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                return jsonify({
                    'success': True, 
                    'message': f'Added {credits_to_add} credits',
                    'new_balance': result.get('new_balance')
                })
            else:
                return jsonify({'error': 'Failed to update credits database'}), 500
                
        return jsonify({'error': 'No credits to add'}), 400
            
    except Exception as e:
        print(f"Payment Verification Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Keep the old buy-credits for backward compatibility or testing if needed
# But we can remove it or rename it to 'simulate-buy-credits'
@app.route('/api/simulate-buy-credits', methods=['POST'])
@verify_token
def simulate_buy_credits():
    """
    Simulate buying credits
    In a real app, this would verify a Stripe payment intent
    """
    try:
        data = request.json
        amount = data.get('amount')
        
        if not amount or amount <= 0:
            return jsonify({'error': 'Invalid amount'}), 400
            
        # Call Supabase RPC to add credits
        # We use the anon key but the function is SECURITY DEFINER
        # In production, use SERVICE_ROLE_KEY and do not expose this RPC publicly
        
        url = f"{SUPABASE_URL}/rest/v1/rpc/add_credits"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}", # Using anon key to call RPC
            "Content-Type": "application/json"
        }
        
        payload = {
            "user_id": request.user_id,
            "amount": amount
        }
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            return jsonify({'success': True, 'message': f'Added {amount} credits'})
        else:
            print(f"Supabase RPC error: {response.text}")
            return jsonify({'error': 'Failed to add credits'}), 500
            
    except Exception as e:
        print(f"Error buying credits: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'speech_to_text': bool(GOOGLE_APPLICATION_CREDENTIALS),
        'gemini': bool(GEMINI_API_KEY),
        'database': bool(supabase)
    })


if __name__ == '__main__':
    # Check if required environment variables are set
    if not GOOGLE_APPLICATION_CREDENTIALS:
        print("⚠️  WARNING: GOOGLE_APPLICATION_CREDENTIALS not set")
        print("   Set it to the path of your Google Cloud service account JSON file")
    
    if not GEMINI_API_KEY:
        print("⚠️  WARNING: GEMINI_API_KEY not set")
        print("   Get your API key from https://makersuite.google.com/app/apikey")
    
    # Use PORT from environment variable (for Railway) or default to 5000
    port = int(os.getenv('PORT', 5000))
    
    print("\n🍳 Recipe Diary Server Starting...")
    print(f"📍 Access the app at: http://localhost:{port}")
    print("\nPress Ctrl+C to stop the server\n")
    
    app.run(debug=True, host='0.0.0.0', port=port)
