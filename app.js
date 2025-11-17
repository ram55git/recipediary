// ============================================================================
// SUPABASE AUTHENTICATION
// ============================================================================

// Supabase Client - Will be initialized on page load
let supabaseClient = null;
let currentUser = null;
let authToken = null;

// Initialize Supabase client
async function initSupabase() {
    // Get credentials from server-provided config
    // This allows environment variables to be used in production
    const SUPABASE_URL = Config.supabase.url;
    const SUPABASE_ANON_KEY = Config.supabase.anonKey;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Supabase credentials not configured');
        return;
    }

    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Check for existing session
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        authToken = session.access_token;
        updateAuthUI(true);
    } else {
        updateAuthUI(false);
    }

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            authToken = session.access_token;
            updateAuthUI(true);
            closeAuthModal();
            
            // Refresh gallery if on gallery view
            if (galleryView.style.display === 'block') {
                loadRecipes();
            }
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            authToken = null;
            updateAuthUI(false);
            
            // Clear gallery
            currentRecipes = [];
            galleryGrid.innerHTML = '';
        }
    });
}

function updateAuthUI(isAuthenticated) {
    const authLoading = document.getElementById('authLoading');
    const authUser = document.getElementById('authUser');
    const authGuest = document.getElementById('authGuest');
    const userEmail = document.getElementById('userEmail');
    const authPrompt = document.getElementById('authPrompt');

    authLoading.style.display = 'none';

    if (isAuthenticated) {
        authUser.style.display = 'flex';
        authGuest.style.display = 'none';
        userEmail.textContent = currentUser.email;
        
        // Hide auth prompt banner
        if (authPrompt) authPrompt.style.display = 'none';
        
        // Enable recording/upload buttons
        if (startBtn) startBtn.disabled = false;
        if (transcribeBtn) transcribeBtn.disabled = false;
    } else {
        authUser.style.display = 'none';
        authGuest.style.display = 'flex';
        
        // Show auth prompt banner
        if (authPrompt) authPrompt.style.display = 'block';
        
        // Disable recording/upload buttons and show login message
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.title = 'Please login to record recipes';
        }
        if (transcribeBtn) {
            transcribeBtn.disabled = true;
            transcribeBtn.title = 'Please login to generate recipes';
        }
    }
}

// ============================================================================
// AUTHENTICATION MODAL
// ============================================================================

const authModal = document.getElementById('authModal');
const authModalClose = document.getElementById('authModalClose');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// Auth Event Listeners
loginBtn.addEventListener('click', openAuthModal);
logoutBtn.addEventListener('click', handleLogout);
authModalClose.addEventListener('click', closeAuthModal);
tabLogin.addEventListener('click', () => switchAuthTab('login'));
tabSignup.addEventListener('click', () => switchAuthTab('signup'));
loginForm.addEventListener('submit', handleLogin);
signupForm.addEventListener('submit', handleSignup);

function openAuthModal() {
    authModal.style.display = 'block';
    switchAuthTab('login');
}

function closeAuthModal() {
    authModal.style.display = 'none';
    clearAuthForms();
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
    } else {
        tabLogin.classList.remove('active');
        tabSignup.classList.add('active');
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    }
    clearAuthForms();
}

function clearAuthForms() {
    loginForm.reset();
    signupForm.reset();
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('signupError').style.display = 'none';
    document.getElementById('signupSuccess').style.display = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Success - auth state change listener will handle UI updates
        closeAuthModal();
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupPasswordConfirm').value;
    const errorDiv = document.getElementById('signupError');
    const successDiv = document.getElementById('signupSuccess');

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validate password match
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        if (error) throw error;

        // Show success message
        successDiv.style.display = 'block';
        signupForm.reset();
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        // Auth state change listener will handle UI updates
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Helper function to get auth headers
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    return headers;
}

// ============================================================================
// EXISTING CODE BELOW
// ============================================================================

// Audio Recording State
let mediaRecorder;
let audioChunks = [];
let recordingStartTime;
let recordingDuration = 0;
let timerInterval;
let isPaused = false;
let pausedTime = 0;
let audioBlob = null;

// Gallery State
let currentRecipes = [];
let currentRecipeId = null;
let isEditMode = false;
let originalRecipeData = null;

// Constants
const MAX_RECORDING_TIME = 300; // 5 minutes in seconds

// DOM Elements - Recording View
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const stopBtn = document.getElementById('stopBtn');
const timer = document.getElementById('timer');
const statusIndicator = document.getElementById('statusIndicator');
const progressFill = document.getElementById('progressFill');
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadedFileName = document.getElementById('uploadedFileName');
const audioPreview = document.getElementById('audioPreview');
const audioPreviewCard = document.getElementById('audioPreviewCard');
const transcribeBtn = document.getElementById('transcribeBtn');
const loadingCard = document.getElementById('loadingCard');
const loadingMessage = document.getElementById('loadingMessage');
const recipeCard = document.getElementById('recipeCard');
const recipeContent = document.getElementById('recipeContent');
const errorCard = document.getElementById('errorCard');
const errorMessage = document.getElementById('errorMessage');
const newRecipeBtn = document.getElementById('newRecipeBtn');
const retryBtn = document.getElementById('retryBtn');
const saveImageBtn = document.getElementById('saveImageBtn');
const languageSelect = document.getElementById('languageSelect');

// DOM Elements - Navigation
const navRecord = document.getElementById('navRecord');
const navGallery = document.getElementById('navGallery');
const recordView = document.getElementById('recordView');
const galleryView = document.getElementById('galleryView');

// DOM Elements - Gallery View
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const recipeCount = document.getElementById('recipeCount');
const galleryGrid = document.getElementById('galleryGrid');
const emptyState = document.getElementById('emptyState');
const galleryLoadingCard = document.getElementById('galleryLoadingCard');
const goToRecordBtn = document.getElementById('goToRecordBtn');

// DOM Elements - Recipe Modal
const recipeModal = document.getElementById('recipeModal');
const modalClose = document.getElementById('modalClose');
const modalTitle = document.getElementById('modalTitle');
const modalRecipeContent = document.getElementById('modalRecipeContent');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const modalSaveImageBtn = document.getElementById('modalSaveImageBtn');

// Event Listeners - Recording
startBtn.addEventListener('click', startRecording);
pauseBtn.addEventListener('click', pauseRecording);
resumeBtn.addEventListener('click', resumeRecording);
stopBtn.addEventListener('click', stopRecording);
fileInput.addEventListener('change', handleFileUpload);
transcribeBtn.addEventListener('click', transcribeAndGenerateRecipe);
newRecipeBtn.addEventListener('click', resetApp);
retryBtn.addEventListener('click', resetApp);
saveImageBtn.addEventListener('click', saveRecipeAsImage);

// Event Listeners - Navigation
navRecord.addEventListener('click', () => switchView('record'));
navGallery.addEventListener('click', () => switchView('gallery'));
goToRecordBtn.addEventListener('click', () => switchView('record'));

// Event Listeners - Gallery
searchBtn.addEventListener('click', searchRecipes);
clearSearchBtn.addEventListener('click', clearSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchRecipes();
});

// Event Listeners - Modal
modalClose.addEventListener('click', closeModal);
modalEditBtn.addEventListener('click', enableEditMode);
modalSaveBtn.addEventListener('click', saveRecipeEdits);
modalCancelBtn.addEventListener('click', cancelEdit);
modalDeleteBtn.addEventListener('click', deleteCurrentRecipe);
modalSaveImageBtn.addEventListener('click', () => saveRecipeAsImage(modalRecipeContent));

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === recipeModal) closeModal();
});

// Drag and Drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFileUpload();
    }
});

// Recording Functions
async function startRecording() {
    // Check if user is logged in
    if (!authToken || !currentUser) {
        alert('Please login to record recipes. Click the "Login" button in the top right.');
        openAuthModal();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recordingStartTime = Date.now();
        recordingDuration = 0;
        isPaused = false;
        pausedTime = 0;

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            displayAudioPreview(audioBlob);
        };

        mediaRecorder.start();
        updateUIForRecording();
        startTimer();
    } catch (error) {
        showError('Microphone access denied. Please allow microphone access to record audio.');
        console.error('Error accessing microphone:', error);
    }
}

function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        isPaused = true;
        pausedTime = Date.now();
        clearInterval(timerInterval);
        updateUIForPaused();
    }
}

function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        isPaused = false;
        recordingStartTime += (Date.now() - pausedTime);
        startTimer();
        updateUIForRecording();
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        clearInterval(timerInterval);
        updateUIForStopped();
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        recordingDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
        updateTimer(recordingDuration);
        updateProgress(recordingDuration);

        // Auto-stop at 5 minutes
        if (recordingDuration >= MAX_RECORDING_TIME) {
            stopRecording();
        }
    }, 100);
}

function updateTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timer.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateProgress(seconds) {
    const percentage = (seconds / MAX_RECORDING_TIME) * 100;
    progressFill.style.width = `${Math.min(percentage, 100)}%`;
}

function updateUIForRecording() {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
    stopBtn.disabled = false;
    statusIndicator.textContent = 'Recording...';
    statusIndicator.className = 'status-indicator recording';
}

function updateUIForPaused() {
    pauseBtn.disabled = true;
    resumeBtn.disabled = false;
    statusIndicator.textContent = 'Paused';
    statusIndicator.className = 'status-indicator paused';
}

function updateUIForStopped() {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    stopBtn.disabled = true;
    statusIndicator.textContent = 'Ready';
    statusIndicator.className = 'status-indicator';
}

function displayAudioPreview(blob) {
    const url = URL.createObjectURL(blob);
    audioPreview.src = url;
    audioPreviewCard.style.display = 'block';
    hideOtherCards();
}

// File Upload Functions
function handleFileUpload() {
    // Check if user is logged in
    if (!authToken || !currentUser) {
        alert('Please login to upload audio files. Click the "Login" button in the top right.');
        openAuthModal();
        fileInput.value = ''; // Clear the file input
        return;
    }

    const file = fileInput.files[0];
    if (file) {
        if (!file.type.startsWith('audio/')) {
            showError('Please upload a valid audio file.');
            return;
        }

        audioBlob = file;
        uploadedFileName.textContent = `📎 ${file.name}`;
        uploadedFileName.classList.add('show');
        
        const url = URL.createObjectURL(file);
        audioPreview.src = url;
        audioPreviewCard.style.display = 'block';
        hideOtherCards();
    }
}

// Transcription and Recipe Generation
async function transcribeAndGenerateRecipe() {
    // Check if user is logged in
    if (!authToken || !currentUser) {
        showError('Please login to generate recipes. Click the "Login" button in the top right.');
        openAuthModal();
        return;
    }

    if (!audioBlob) {
        showError('No audio file available. Please record or upload audio first.');
        return;
    }

    showLoading('Transcribing audio...');

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recipe-audio.webm');
    formData.append('language', languageSelect.value);

    try {
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }

        const response = await fetch('/api/process-recipe', {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to process audio');
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        displayRecipe(data);
    } catch (error) {
        showError(`Error processing recipe: ${error.message}`);
        console.error('Error:', error);
    }
}

function showLoading(message) {
    loadingMessage.textContent = message;
    loadingCard.style.display = 'block';
    hideOtherCards('loading');
}

function displayRecipe(data) {
    let html = '';

    // Recipe Title
    if (data.recipe_name) {
        html += `<h1 class="recipe-title">${data.recipe_name}</h1>`;
    }

    // Header with Author and Meta Info
    html += `<div class="recipe-header">`;
    
    // Author (left side)
    if (data.author) {
        html += `<p class="recipe-author">by ${data.author}</p>`;
    }
    
    // Servings and Total Time (right side)
    html += `<div class="recipe-header-meta">`;
    if (data.yield) {
        html += `<span class="header-meta-item">🍽️ ${data.yield}</span>`;
    }
    if (data.cook_time || data.prep_time) {
        // Calculate or display total cooking time
        const cookingTime = data.cook_time || data.prep_time;
        html += `<span class="header-meta-item">⏱️ ${cookingTime}</span>`;
    }
    html += `</div></div>`;

    // Description
    if (data.description) {
        html += `<p class="recipe-description">${data.description}</p>`;
    }

    // Recipe Meta Information (Prep Time, Cook Time)
    const hasMeta = data.prep_time || data.cook_time;
    if (hasMeta) {
        html += `<div class="recipe-meta">`;
        
        if (data.prep_time) {
            html += `
                <div class="meta-item">
                    <span class="meta-label">⏱️ Prep Time</span>
                    <span class="meta-value">${data.prep_time}</span>
                </div>
            `;
        }
        
        if (data.cook_time) {
            html += `
                <div class="meta-item">
                    <span class="meta-label">🔥 Cook Time</span>
                    <span class="meta-value">${data.cook_time}</span>
                </div>
            `;
        }
        
        html += `</div>`;
    }

    // Two Column Layout for Ingredients and Instructions
    html += `<div class="recipe-two-column">`;
    
    // Ingredients Section (Left Column)
    if (data.ingredients && data.ingredients.length > 0) {
        html += `
            <div class="recipe-section ingredients-column">
                <h2 class="recipe-section-title">
                    <span class="icon">🥘</span>
                    Ingredients
                </h2>
                <ul class="ingredients-list">
        `;
        data.ingredients.forEach(ingredient => {
            html += `<li>${ingredient}</li>`;
        });
        html += `</ul></div>`;
    }

    // Instructions Section (Right Column)
    if (data.instructions && data.instructions.length > 0) {
        html += `
            <div class="recipe-section instructions-column">
                <h2 class="recipe-section-title">
                    <span class="icon">👨‍🍳</span>
                    Instructions
                </h2>
                <ol class="instructions-list">
        `;
        data.instructions.forEach(instruction => {
            html += `<li>${instruction}</li>`;
        });
        html += `</ol></div>`;
    }
    
    html += `</div>`; // Close two-column div

    // Tips Section (Full Width)
    if (data.tips && data.tips.length > 0) {
        html += `
            <div class="recipe-section">
                <h2 class="recipe-section-title">
                    <span class="icon">✨</span>
                    Tips
                </h2>
                <ul class="tips-list">
        `;
        data.tips.forEach(tip => {
            html += `<li>${tip}</li>`;
        });
        html += `</ul></div>`;
    }

    recipeContent.innerHTML = html;
    recipeCard.style.display = 'block';
    hideOtherCards('recipe');
}

function showError(message) {
    errorMessage.textContent = message;
    errorCard.style.display = 'block';
    hideOtherCards('error');
}

function hideOtherCards(keepVisible = null) {
    // Hide all cards except the one specified in keepVisible
    const cardMap = {
        'loading': loadingCard,
        'recipe': recipeCard,
        'error': errorCard
    };
    
    Object.keys(cardMap).forEach(key => {
        if (key !== keepVisible) {
            cardMap[key].style.display = 'none';
        }
    });
}

function resetApp() {
    // Reset recording state
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    clearInterval(timerInterval);
    audioChunks = [];
    audioBlob = null;
    recordingDuration = 0;
    
    // Reset UI
    updateTimer(0);
    updateProgress(0);
    updateUIForStopped();
    
    // Reset file upload
    fileInput.value = '';
    uploadedFileName.textContent = '';
    uploadedFileName.classList.remove('show');
    audioPreview.src = '';
    
    // Hide all result cards
    audioPreviewCard.style.display = 'none';
    loadingCard.style.display = 'none';
    recipeCard.style.display = 'none';
    errorCard.style.display = 'none';
}

// Save Recipe as Image
async function saveRecipeAsImage() {
    try {
        // Show loading state
        saveImageBtn.disabled = true;
        saveImageBtn.innerHTML = '<span class="icon">⏳</span> Generating...';

        // Clone the recipe content to create a standalone image
        const recipeContainer = document.createElement('div');
        recipeContainer.style.cssText = `
            background: white;
            padding: 50px;
            width: 900px;
            font-family: var(--font-body);
            position: absolute;
            left: -9999px;
            top: 0;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        `;
        
        // Add a header with branding
        const header = document.createElement('div');
        header.style.cssText = `
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #4CAF50;
        `;
        header.innerHTML = `
            <h1 style="font-family: var(--font-heading); color: #4CAF50; font-size: 2rem; margin-bottom: 5px;">
                🍳 Recipe Diary
            </h1>
            <p style="color: #666; font-size: 0.9rem; margin: 0;">
                Your personal recipe collection
            </p>
        `;
        recipeContainer.appendChild(header);
        
        // Add the recipe content
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = recipeContent.innerHTML;
        recipeContainer.appendChild(contentDiv);
        
        // Add a footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #999;
            font-size: 0.85rem;
        `;
        footer.innerHTML = `Created with Recipe Diary • ${new Date().toLocaleDateString()}`;
        recipeContainer.appendChild(footer);
        
        document.body.appendChild(recipeContainer);

        // Use html2canvas to capture the recipe
        const canvas = await html2canvas(recipeContainer, {
            backgroundColor: '#ffffff',
            scale: 2, // Higher quality
            logging: false,
            useCORS: true,
            allowTaint: true
        });

        // Remove the temporary container
        document.body.removeChild(recipeContainer);

        // Convert canvas to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            // Generate filename from recipe name or use default
            const recipeTitleElement = recipeContent.querySelector('.recipe-title');
            const recipeTitle = recipeTitleElement ? 
                recipeTitleElement.textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 
                'recipe';
            const timestamp = new Date().toISOString().slice(0, 10);
            
            link.download = `${recipeTitle}_${timestamp}.png`;
            link.href = url;
            link.click();
            
            // Clean up
            URL.revokeObjectURL(url);

            // Reset button
            saveImageBtn.disabled = false;
            saveImageBtn.innerHTML = '<span class="icon">💾</span> Save as Image';

            // Show success message briefly
            const originalText = saveImageBtn.innerHTML;
            saveImageBtn.innerHTML = '<span class="icon">✅</span> Saved!';
            setTimeout(() => {
                saveImageBtn.innerHTML = originalText;
            }, 2000);
        }, 'image/png');

    } catch (error) {
        console.error('Error saving recipe as image:', error);
        saveImageBtn.disabled = false;
        saveImageBtn.innerHTML = '<span class="icon">💾</span> Save as Image';
        showError('Failed to save recipe as image. Please try again.');
    }
}

// Check browser support
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Edge.');
    startBtn.disabled = true;
}


// ============================================================================
// GALLERY VIEW & NAVIGATION
// ============================================================================

function switchView(view) {
    if (view === 'record') {
        recordView.style.display = 'block';
        galleryView.style.display = 'none';
        navRecord.classList.add('active');
        navGallery.classList.remove('active');
    } else if (view === 'gallery') {
        // Check if user is logged in before showing gallery
        if (!authToken || !currentUser) {
            alert('Please login to view your recipes.');
            openAuthModal();
            return;
        }
        
        recordView.style.display = 'none';
        galleryView.style.display = 'block';
        navRecord.classList.remove('active');
        navGallery.classList.add('active');
        loadRecipes();
    }
}

async function loadRecipes(searchQuery = '') {
    try {
        galleryLoadingCard.style.display = 'block';
        galleryGrid.innerHTML = '';
        emptyState.style.display = 'none';

        const url = searchQuery 
            ? `/api/recipes?search=${encodeURIComponent(searchQuery)}`
            : '/api/recipes';
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to load recipes');
        }

        const data = await response.json();
        currentRecipes = data.recipes || [];

        galleryLoadingCard.style.display = 'none';

        if (currentRecipes.length === 0) {
            emptyState.style.display = 'block';
            recipeCount.textContent = '0 recipes';
        } else {
            displayRecipeGallery(currentRecipes);
            recipeCount.textContent = `${currentRecipes.length} recipe${currentRecipes.length !== 1 ? 's' : ''}`;
        }

    } catch (error) {
        console.error('Error loading recipes:', error);
        galleryLoadingCard.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <div class="icon large">⚠️</div>
            <h2>Error Loading Recipes</h2>
            <p>${error.message}</p>
            <button class="btn btn-primary" onclick="loadRecipes()">
                <span class="icon">🔄</span> Retry
            </button>
        `;
    }
}

function displayRecipeGallery(recipes) {
    galleryGrid.innerHTML = '';

    recipes.forEach(recipe => {
        const card = createRecipeGalleryCard(recipe);
        galleryGrid.appendChild(card);
    });
}

function createRecipeGalleryCard(recipe) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.onclick = () => openRecipeModal(recipe);

    card.innerHTML = `
        <div class="gallery-card-header">
            <h3 class="gallery-card-title">${recipe.recipe_name || 'Untitled Recipe'}</h3>
            <span class="gallery-card-author">by ${recipe.author || 'Unknown'}</span>
        </div>
        <div class="gallery-card-meta">
            ${recipe.prep_time ? `<span class="gallery-meta-item">⏱️ ${recipe.prep_time}</span>` : ''}
            ${recipe.cook_time ? `<span class="gallery-meta-item">🔥 ${recipe.cook_time}</span>` : ''}
            ${recipe.yield ? `<span class="gallery-meta-item">🍽️ ${recipe.yield}</span>` : ''}
        </div>
        <div class="gallery-card-description">
            ${recipe.description || 'No description available'}
        </div>
        <div class="gallery-card-footer">
            <span class="gallery-card-date">📅 ${formatDate(recipe.created_at)}</span>
        </div>
    `;

    return card;
}

function searchRecipes() {
    const query = searchInput.value.trim();
    loadRecipes(query);
}

function clearSearch() {
    searchInput.value = '';
    loadRecipes();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}


// ============================================================================
// RECIPE MODAL & EDIT MODE
// ============================================================================

function openRecipeModal(recipe) {
    currentRecipeId = recipe.id;
    originalRecipeData = JSON.parse(JSON.stringify(recipe));
    isEditMode = false;

    modalTitle.textContent = 'Recipe Details';
    modalEditBtn.style.display = 'inline-flex';
    modalSaveBtn.style.display = 'none';
    modalCancelBtn.style.display = 'none';
    modalDeleteBtn.style.display = 'inline-flex';

    displayRecipeInModal(recipe, false);
    recipeModal.style.display = 'block';
}

function closeModal() {
    recipeModal.style.display = 'none';
    currentRecipeId = null;
    originalRecipeData = null;
    isEditMode = false;
}

function displayRecipeInModal(data, editable = false) {
    let html = '';

    // Recipe Title
    if (editable) {
        html += `<h1 class="recipe-title" contenteditable="true" data-field="recipe_name">${data.recipe_name || ''}</h1>`;
    } else {
        html += `<h1 class="recipe-title">${data.recipe_name || 'Untitled Recipe'}</h1>`;
    }

    // Header with Author and Meta Info
    html += `<div class="recipe-header">`;
    
    if (editable) {
        html += `<p class="recipe-author">by <span contenteditable="true" data-field="author">${data.author || ''}</span></p>`;
    } else {
        html += `<p class="recipe-author">by ${data.author || 'Unknown'}</p>`;
    }
    
    html += `<div class="recipe-header-meta">`;
    if (editable) {
        html += `<span class="header-meta-item">🍽️ <span contenteditable="true" data-field="yield">${data.yield || ''}</span></span>`;
        html += `<span class="header-meta-item">⏱️ <span contenteditable="true" data-field="cook_time">${data.cook_time || ''}</span></span>`;
    } else {
        if (data.yield) html += `<span class="header-meta-item">🍽️ ${data.yield}</span>`;
        if (data.cook_time) html += `<span class="header-meta-item">⏱️ ${data.cook_time}</span>`;
    }
    html += `</div></div>`;

    // Description
    if (editable) {
        html += `<p class="recipe-description" contenteditable="true" data-field="description">${data.description || ''}</p>`;
    } else if (data.description) {
        html += `<p class="recipe-description">${data.description}</p>`;
    }

    // Recipe Meta (Prep/Cook Time)
    const hasMeta = data.prep_time || data.cook_time;
    if (hasMeta) {
        html += `<div class="recipe-meta">`;
        if (data.prep_time) {
            html += `<div class="meta-item">
                <span class="meta-label">⏱️ Prep Time</span>
                <span class="meta-value"${editable ? ' contenteditable="true" data-field="prep_time"' : ''}>${data.prep_time}</span>
            </div>`;
        }
        if (data.cook_time) {
            html += `<div class="meta-item">
                <span class="meta-label">🔥 Cook Time</span>
                <span class="meta-value"${editable ? ' contenteditable="true" data-field="cook_time"' : ''}>${data.cook_time}</span>
            </div>`;
        }
        html += `</div>`;
    }

    // Two Column Layout
    html += `<div class="recipe-two-column">`;
    
    // Ingredients
    if (data.ingredients && data.ingredients.length > 0) {
        html += `<div class="recipe-section ingredients-column">
            <h2 class="recipe-section-title"><span class="icon">🥘</span> Ingredients</h2>
            <ul class="ingredients-list"${editable ? ' data-field="ingredients"' : ''}>`;
        data.ingredients.forEach((ingredient, index) => {
            if (editable) {
                html += `<li contenteditable="true" data-index="${index}">${ingredient}</li>`;
            } else {
                html += `<li>${ingredient}</li>`;
            }
        });
        html += `</ul></div>`;
    }

    // Instructions
    if (data.instructions && data.instructions.length > 0) {
        html += `<div class="recipe-section instructions-column">
            <h2 class="recipe-section-title"><span class="icon">👨‍🍳</span> Instructions</h2>
            <ol class="instructions-list"${editable ? ' data-field="instructions"' : ''}>`;
        data.instructions.forEach((instruction, index) => {
            if (editable) {
                html += `<li contenteditable="true" data-index="${index}">${instruction}</li>`;
            } else {
                html += `<li>${instruction}</li>`;
            }
        });
        html += `</ol></div>`;
    }
    
    html += `</div>`;

    // Tips
    if (data.tips && data.tips.length > 0) {
        html += `<div class="recipe-section">
            <h2 class="recipe-section-title"><span class="icon">✨</span> Tips</h2>
            <ul class="tips-list"${editable ? ' data-field="tips"' : ''}>`;
        data.tips.forEach((tip, index) => {
            if (editable) {
                html += `<li contenteditable="true" data-index="${index}">${tip}</li>`;
            } else {
                html += `<li>${tip}</li>`;
            }
        });
        html += `</ul></div>`;
    }

    modalRecipeContent.innerHTML = html;
}

function enableEditMode() {
    isEditMode = true;
    modalTitle.textContent = 'Edit Recipe';
    modalEditBtn.style.display = 'none';
    modalSaveBtn.style.display = 'inline-flex';
    modalCancelBtn.style.display = 'inline-flex';
    modalDeleteBtn.style.display = 'none';

    // Use the original recipe data for editing
    displayRecipeInModal(originalRecipeData, true);
}

function cancelEdit() {
    isEditMode = false;
    modalTitle.textContent = 'Recipe Details';
    modalEditBtn.style.display = 'inline-flex';
    modalSaveBtn.style.display = 'none';
    modalCancelBtn.style.display = 'none';
    modalDeleteBtn.style.display = 'inline-flex';

    displayRecipeInModal(originalRecipeData, false);
}

function getCurrentRecipeData() {
    const data = {
        id: currentRecipeId,
        recipe_name: modalRecipeContent.querySelector('[data-field="recipe_name"]')?.textContent || '',
        author: modalRecipeContent.querySelector('[data-field="author"]')?.textContent || '',
        description: modalRecipeContent.querySelector('[data-field="description"]')?.textContent || '',
        prep_time: modalRecipeContent.querySelector('[data-field="prep_time"]')?.textContent || '',
        cook_time: modalRecipeContent.querySelector('[data-field="cook_time"]')?.textContent || '',
        yield: modalRecipeContent.querySelector('[data-field="yield"]')?.textContent || '',
        ingredients: [],
        instructions: [],
        tips: []
    };

    // Get ingredients
    const ingredientsList = modalRecipeContent.querySelector('[data-field="ingredients"]');
    if (ingredientsList) {
        ingredientsList.querySelectorAll('li').forEach(li => {
            const text = li.textContent.trim();
            if (text) data.ingredients.push(text);
        });
    }

    // Get instructions
    const instructionsList = modalRecipeContent.querySelector('[data-field="instructions"]');
    if (instructionsList) {
        instructionsList.querySelectorAll('li').forEach(li => {
            const text = li.textContent.trim();
            if (text) data.instructions.push(text);
        });
    }

    // Get tips
    const tipsList = modalRecipeContent.querySelector('[data-field="tips"]');
    if (tipsList) {
        tipsList.querySelectorAll('li').forEach(li => {
            const text = li.textContent.trim();
            if (text) data.tips.push(text);
        });
    }

    return data;
}

async function saveRecipeEdits() {
    try {
        const updatedData = getCurrentRecipeData();

        modalSaveBtn.disabled = true;
        modalSaveBtn.innerHTML = '<span class="spinner-small"></span> Saving...';

        const response = await fetch(`/api/recipes/${currentRecipeId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            throw new Error('Failed to save recipe');
        }

        const savedRecipe = await response.json();
        
        // Update the original data
        originalRecipeData = savedRecipe;
        
        // Exit edit mode
        isEditMode = false;
        modalTitle.textContent = 'Recipe Details';
        modalEditBtn.style.display = 'inline-flex';
        modalSaveBtn.style.display = 'none';
        modalCancelBtn.style.display = 'none';
        modalDeleteBtn.style.display = 'inline-flex';

        displayRecipeInModal(savedRecipe, false);

        // Show success message
        const originalText = modalSaveBtn.innerHTML;
        modalSaveBtn.innerHTML = '<span class="icon">✅</span> Saved!';
        setTimeout(() => {
            modalSaveBtn.disabled = false;
            modalSaveBtn.innerHTML = originalText;
        }, 2000);

        // Reload gallery if it's open
        if (galleryView.style.display !== 'none') {
            loadRecipes(searchInput.value);
        }

    } catch (error) {
        console.error('Error saving recipe:', error);
        alert('Failed to save recipe. Please try again.');
        modalSaveBtn.disabled = false;
        modalSaveBtn.innerHTML = '<span class="icon">💾</span> Save Changes';
    }
}

async function deleteCurrentRecipe() {
    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
        return;
    }

    try {
        modalDeleteBtn.disabled = true;
        modalDeleteBtn.innerHTML = '<span class="spinner-small"></span> Deleting...';

        const response = await fetch(`/api/recipes/${currentRecipeId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to delete recipe');
        }

        // Close modal
        closeModal();

        // Reload gallery
        loadRecipes(searchInput.value);

        // Show success notification
        alert('Recipe deleted successfully');

    } catch (error) {
        console.error('Error deleting recipe:', error);
        alert('Failed to delete recipe. Please try again.');
        modalDeleteBtn.disabled = false;
        modalDeleteBtn.innerHTML = '<span class="icon">🗑️</span> Delete';
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize Supabase authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});
