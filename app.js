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

        // Fetch user credits
        fetchUserCredits();
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
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsModalClose = document.getElementById('settingsModalClose');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// Auth Event Listeners
loginBtn.addEventListener('click', openAuthModal);
logoutBtn.addEventListener('click', handleLogout);
settingsBtn.addEventListener('click', openSettingsModal);
authModalClose.addEventListener('click', closeAuthModal);
settingsModalClose.addEventListener('click', closeSettingsModal);
tabLogin.addEventListener('click', () => switchAuthTab('login'));
tabSignup.addEventListener('click', () => switchAuthTab('signup'));
document.getElementById('tabMagicLink').addEventListener('click', () => switchAuthTab('magicLink'));
document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthTab('reset');
});
document.getElementById('backToLoginLink').addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthTab('login');
});
loginForm.addEventListener('submit', handleLogin);
signupForm.addEventListener('submit', handleSignup);
document.getElementById('magicLinkForm').addEventListener('submit', handleMagicLink);
document.getElementById('resetPasswordForm').addEventListener('submit', handlePasswordReset);

// Background Selection Event Listeners
document.getElementById('backgroundGrid').addEventListener('click', handleBackgroundSelection);

function openAuthModal() {
    authModal.style.display = 'block';
    switchAuthTab('login');
}

function openSettingsModal() {
    settingsModal.style.display = 'block';
    loadBackgroundPreference();
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

function closeAuthModal() {
    authModal.style.display = 'none';
    clearAuthForms();
}

function switchAuthTab(tab) {
    const tabMagicLink = document.getElementById('tabMagicLink');
    const magicLinkForm = document.getElementById('magicLinkForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    
    // Reset all tabs
    tabLogin.classList.remove('active');
    tabSignup.classList.remove('active');
    tabMagicLink.classList.remove('active');
    
    // Hide all forms
    loginForm.style.display = 'none';
    signupForm.style.display = 'none';
    magicLinkForm.style.display = 'none';
    resetPasswordForm.style.display = 'none';
    
    // Show selected form
    if (tab === 'login') {
        tabLogin.classList.add('active');
        loginForm.style.display = 'block';
    } else if (tab === 'signup') {
        tabSignup.classList.add('active');
        signupForm.style.display = 'block';
    } else if (tab === 'magicLink') {
        tabMagicLink.classList.add('active');
        magicLinkForm.style.display = 'block';
    } else if (tab === 'reset') {
        // Password reset doesn't have a tab, just show the form
        resetPasswordForm.style.display = 'block';
    }
    
    clearAuthForms();
}

function clearAuthForms() {
    loginForm.reset();
    signupForm.reset();
    document.getElementById('magicLinkForm').reset();
    document.getElementById('resetPasswordForm').reset();
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('signupError').style.display = 'none';
    document.getElementById('signupSuccess').style.display = 'none';
    document.getElementById('magicLinkError').style.display = 'none';
    document.getElementById('magicLinkSuccess').style.display = 'none';
    document.getElementById('resetError').style.display = 'none';
    document.getElementById('resetSuccess').style.display = 'none';
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

// ============================================================================
// SETTINGS & BACKGROUND CUSTOMIZATION
// ============================================================================

function handleBackgroundSelection(e) {
    const option = e.target.closest('.background-option');
    if (!option) return;

    const selectedBg = option.dataset.bg;
    
    // Update UI selection
    document.querySelectorAll('.background-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    option.classList.add('selected');
    
    // Save preference
    localStorage.setItem('recipeBackground', selectedBg);
    
    // Apply to all recipe cards immediately
    applyBackgroundToCards(selectedBg);
}

function loadBackgroundPreference() {
    const savedBg = localStorage.getItem('recipeBackground') || 'none';
    
    // Highlight selected option in settings
    document.querySelectorAll('.background-option').forEach(opt => {
        if (opt.dataset.bg === savedBg) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

function applyBackgroundToCards(backgroundClass) {
    const allCards = document.querySelectorAll('.recipe-card, #recipeContent, #modalRecipeContent');
    
    // Remove all background classes
    const bgClasses = ['bg-none', 'bg-peach', 'bg-mint', 'bg-lavender', 'bg-sky', 'bg-rose', 'bg-lemon', 'bg-coral', 'bg-sage'];
    allCards.forEach(card => {
        bgClasses.forEach(cls => card.classList.remove(cls));
        
        // Add selected background
        if (backgroundClass !== 'none') {
            card.classList.add(`bg-${backgroundClass}`);
        }
    });
}

// Apply saved background on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedBg = localStorage.getItem('recipeBackground') || 'none';
    applyBackgroundToCards(savedBg);
});

async function handleMagicLink(e) {
    e.preventDefault();
    
    const email = document.getElementById('magicLinkEmail').value;
    const errorDiv = document.getElementById('magicLinkError');
    const successDiv = document.getElementById('magicLinkSuccess');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="icon">⏳</span> Sending...';

        const { data, error } = await supabaseClient.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: window.location.origin
            }
        });

        if (error) throw error;

        // Show success message
        successDiv.textContent = `Magic link sent to ${email}! Check your inbox and click the link to login.`;
        successDiv.style.display = 'block';
        document.getElementById('magicLinkForm').reset();
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="icon">✉️</span> Send Magic Link';
    }
}

async function handlePasswordReset(e) {
    e.preventDefault();
    
    const email = document.getElementById('resetEmail').value;
    const errorDiv = document.getElementById('resetError');
    const successDiv = document.getElementById('resetSuccess');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="icon">⏳</span> Sending...';

        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });

        if (error) throw error;

        // Show success message
        successDiv.textContent = `Password reset link sent to ${email}! Check your inbox.`;
        successDiv.style.display = 'block';
        document.getElementById('resetPasswordForm').reset();
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="icon">🔄</span> Send Reset Link';
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
// CREDIT SYSTEM & PAYMENTS
// ============================================================================

const userCreditsSpan = document.getElementById('userCredits');
const buyCreditsBtn = document.getElementById('buyCreditsBtn');
const pricingModal = document.getElementById('pricingModal');
const pricingModalClose = document.getElementById('pricingModalClose');
const currencySelect = document.getElementById('currencySelect');
const pricingGrid = document.getElementById('pricingGrid');
const recipeCostDisplay = document.getElementById('recipeCostDisplay');

let pricingConfig = null;

// Fetch Pricing Configuration
async function fetchPricingConfig() {
    try {
        const response = await fetch('/api/config/pricing');
        if (response.ok) {
            pricingConfig = await response.json();
            renderPricingCards();
            if (recipeCostDisplay) {
                recipeCostDisplay.textContent = pricingConfig.recipe_cost;
            }
        }
    } catch (error) {
        console.error('Error fetching pricing config:', error);
        if (pricingGrid) {
            pricingGrid.innerHTML = '<div style="color: red; text-align: center;">Failed to load pricing. Please try again later.</div>';
        }
    }
}

// Render Pricing Cards
function renderPricingCards() {
    if (!pricingConfig || !pricingGrid) return;

    const currency = currencySelect ? currencySelect.value : 'INR';
    const symbol = currency === 'INR' ? '₹' : '$';
    
    pricingGrid.innerHTML = pricingConfig.packages.map(pkg => {
        const price = currency === 'INR' ? pkg.price_inr : pkg.price_usd;
        const formattedPrice = currency === 'INR' ? `₹${price}` : `$${price.toFixed(2)}`;
        
        return `
            <div class="pricing-card ${pkg.popular ? 'popular' : ''}">
                ${pkg.popular ? '<div class="badge">Most Popular</div>' : ''}
                <div class="pricing-header">
                    <h3>${pkg.name}</h3>
                    <div class="price">${formattedPrice}</div>
                </div>
                <div class="pricing-features">
                    <p><strong>${pkg.credits}</strong> Credits</p>
                    <p>Generate <strong>${pkg.recipes_count}</strong> Recipes</p>
                </div>
                <button class="btn btn-primary btn-block buy-btn" 
                    data-id="${pkg.id}"
                    onclick="initiatePurchase('${pkg.id}')">
                    Buy Now
                </button>
            </div>
        `;
    }).join('');
}

// Fetch user credits
async function fetchUserCredits() {
    if (!currentUser) return;

    try {
        const response = await fetch('/api/user/credits', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (userCreditsSpan) {
                userCreditsSpan.textContent = data.credits;
            }
        }
    } catch (error) {
        console.error('Error fetching credits:', error);
    }
}

// Open Pricing Modal
if (buyCreditsBtn) {
    buyCreditsBtn.addEventListener('click', () => {
        pricingModal.style.display = 'block';
        if (!pricingConfig) {
            fetchPricingConfig();
        }
    });
}

// Close Pricing Modal
if (pricingModalClose) {
    pricingModalClose.addEventListener('click', () => {
        pricingModal.style.display = 'none';
    });
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === pricingModal) {
        pricingModal.style.display = 'none';
    }
});

// Handle Currency Toggle
if (currencySelect) {
    currencySelect.addEventListener('change', () => {
        renderPricingCards();
    });
}

// Initiate Purchase
async function initiatePurchase(packageId) {
    if (!currentUser) {
        alert('Please login to purchase credits');
        return;
    }

    const pkg = pricingConfig.packages.find(p => p.id === packageId);
    if (!pkg) return;

    const currency = currencySelect.value;
    const btn = document.querySelector(`.buy-btn[data-id="${packageId}"]`);
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        // Fetch payment config (keys)
        const configResponse = await fetch('/api/config/payments');
        const config = await configResponse.json();

        if (currency === 'INR') {
            // RAZORPAY FLOW
            if (!config.razorpayKeyId || config.razorpayKeyId.includes('test_your_key')) {
                // Fallback to simulation if keys not set
                await simulatePurchase(packageId, currency);
                return;
            }
            await handleRazorpayPayment(packageId, config.razorpayKeyId);
        } else {
            // STRIPE FLOW
            if (!config.stripePublicKey || config.stripePublicKey.includes('test_your_stripe')) {
                // Fallback to simulation if keys not set
                await simulatePurchase(packageId, currency);
                return;
            }
            await handleStripePayment(packageId, config.stripePublicKey);
        }
    } catch (error) {
        console.error('Purchase error:', error);
        alert('Purchase failed: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

async function handleRazorpayPayment(packageId, keyId) {
    // Create Order
    const response = await fetch('/api/create-razorpay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ packageId })
    });
    
    const order = await response.json();
    if (order.error) throw new Error(order.error);

    const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Recipe Diary",
        description: "Credits Purchase",
        image: "images/recipediary_icon.png",
        order_id: order.id,
        handler: async function (response) {
            // Verify Payment
            const verifyResponse = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    provider: 'razorpay',
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    package_id: packageId
                })
            });
            
            const result = await verifyResponse.json();
            if (result.success) {
                alert('Payment Successful! Credits added.');
                userCreditsSpan.textContent = result.new_balance;
                pricingModal.style.display = 'none';
            } else {
                alert('Payment Verification Failed: ' + result.error);
            }
        },
        prefill: {
            email: currentUser.email
        },
        theme: {
            color: "#4CAF50"
        }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
}

async function handleStripePayment(packageId, publicKey) {
    const stripe = Stripe(publicKey);
    
    // Create Payment Intent
    const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ packageId })
    });
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    // Confirm Payment (using Stripe Elements or simple redirect)
    // For simplicity, we'll use confirmCardPayment if we had Elements, 
    // but here we might need a proper Checkout Session for redirect.
    // Since we implemented PaymentIntent, we need Elements.
    // Let's switch to a simpler simulation or assume Elements is too complex for this snippet.
    // Actually, for PaymentIntent we need to mount Elements.
    // To keep it simple without changing HTML too much, let's use the simulation fallback 
    // or alert user that Stripe needs full setup.
    
    alert("Stripe integration requires frontend Elements setup. Please use INR/Razorpay for testing or check console.");
    console.log("Client Secret:", data.clientSecret);
}

async function simulatePurchase(packageId, currency) {
    const pkg = pricingConfig.packages.find(p => p.id === packageId);
    const amount = currency === 'INR' ? pkg.price_inr : pkg.price_usd;
    
    const response = await fetch('/api/simulate-buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
            credits: pkg.credits,
            amount: amount,
            currency: currency
        })
    });

    const data = await response.json();
    if (response.ok) {
        alert(`(Simulation) Successfully purchased ${pkg.credits} credits!`);
        userCreditsSpan.textContent = data.new_balance || (parseInt(userCreditsSpan.textContent) + pkg.credits);
        pricingModal.style.display = 'none';
        // Refresh credits to be sure
        fetchUserCredits();
    } else {
        throw new Error(data.error || 'Purchase failed');
    }
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
const shareBtn = document.getElementById('shareBtn');
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
const modalShareBtn = document.getElementById('modalShareBtn');

// Event Listeners - Recording
startBtn.addEventListener('click', startRecording);
pauseBtn.addEventListener('click', pauseRecording);
resumeBtn.addEventListener('click', resumeRecording);
stopBtn.addEventListener('click', stopRecording);
fileInput.addEventListener('change', handleFileUpload);
transcribeBtn.addEventListener('click', transcribeAndGenerateRecipe);
newRecipeBtn.addEventListener('click', resetApp);
retryBtn.addEventListener('click', resetApp);
saveImageBtn.addEventListener('click', () => saveRecipeAsImage());
shareBtn.addEventListener('click', () => shareRecipeImage());

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
modalShareBtn.addEventListener('click', () => shareRecipeImage(modalRecipeContent));

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

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Your browser does not support audio recording. Please use a modern browser like Chrome, Firefox, or Edge.');
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
                console.log('Audio chunk received:', event.data.size, 'bytes');
            }
        };

        mediaRecorder.onstop = () => {
            console.log('Recording stopped. Total chunks:', audioChunks.length);
            stream.getTracks().forEach(track => track.stop());
            
            if (audioChunks.length === 0) {
                console.error('No audio data recorded');
                showError('No audio was recorded. Please try again.');
                return;
            }
            
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('Audio blob created:', audioBlob.size, 'bytes');
            
            if (audioBlob.size === 0) {
                console.error('Audio blob is empty');
                showError('Recording failed. Please try again.');
                return;
            }
            
            displayAudioPreview(audioBlob);
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            showError('Recording error: ' + event.error.name);
        };

        // Start recording with timeslice to ensure data is collected
        mediaRecorder.start(1000); // Collect data every 1 second
        console.log('MediaRecorder started');
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
    try {
        console.log('Displaying audio preview, blob size:', blob.size);
        const url = URL.createObjectURL(blob);
        audioPreview.src = url;
        
        // Add error handler for audio element
        audioPreview.onerror = (e) => {
            console.error('Audio preview error:', e);
            showError('Could not play audio preview. The recording may be corrupted.');
        };
        
        // Add success handler
        audioPreview.onloadedmetadata = () => {
            console.log('Audio loaded successfully, duration:', audioPreview.duration);
        };
        
        audioPreviewCard.style.display = 'block';
        hideOtherCards();
    } catch (error) {
        console.error('Error creating audio preview:', error);
        showError('Failed to create audio preview: ' + error.message);
    }
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
    
    const outputLanguageSelect = document.getElementById('outputLanguageSelect');
    if (outputLanguageSelect) {
        formData.append('output_language', outputLanguageSelect.value);
    }

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
            
            // Handle Insufficient Credits
            if (response.status === 402) {
                alert('Insufficient credits! Please purchase more credits to continue.');
                pricingModal.style.display = 'block';
                loadingCard.style.display = 'none';
                return;
            }
            
            throw new Error(errorData.error || 'Failed to process audio');
        }

        const data = await response.json();
        
        // Update credits display
        if (data.credits_remaining !== undefined && userCreditsSpan) {
            userCreditsSpan.textContent = data.credits_remaining;
        }
        
        if (data.error) {
            throw new Error(data.error);
        }

        displayRecipe(data);
    } catch (error) {
        let message = error.message;
        
        // If it's a generic network error, provide more context
        if (message === 'Failed to fetch' || message === 'NetworkError') {
            message = 'Network error. Please check your connection and try again.';
        } 
        // If the error doesn't already have advice (and isn't the credit error which is handled separately), add it
        else if (!message.includes('Please') && !message.includes('try again') && !message.includes('credits')) {
            message = `${message}. Please try again.`;
        }
        
        showError(message);
        console.error('Error processing recipe:', error);
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

    // Author (centered below title)
    if (data.author) {
        html += `<p class="recipe-author">by ${data.author}</p>`;
    }

    // Description
    if (data.description) {
        html += `<p class="recipe-description">${data.description}</p>`;
    }

    // Recipe Meta Information (Prep Time, Cook Time, Yield in one row)
    const hasMeta = data.prep_time || data.cook_time || data.yield;
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
        
        if (data.yield) {
            html += `
                <div class="meta-item">
                    <span class="meta-label">🍽️ Servings</span>
                    <span class="meta-value">${data.yield}</span>
                </div>
            `;
        }
        
        html += `</div>`;
    }

    // Ingredients Section (2 columns)
    if (data.ingredients && data.ingredients.length > 0) {
        html += `
            <div class="recipe-section">
                <h2 class="recipe-section-title">
                    <span class="icon">🥘</span>
                    Ingredients
                </h2>
                <ul class="ingredients-list ingredients-two-column">
        `;
        data.ingredients.forEach(ingredient => {
            html += `<li>${ingredient}</li>`;
        });
        html += `</ul></div>`;
    }

    // Instructions Section (2 columns)
    if (data.instructions && data.instructions.length > 0) {
        html += `
            <div class="recipe-section">
                <h2 class="recipe-section-title">
                    <span class="icon">👨‍🍳</span>
                    Instructions
                </h2>
                <ol class="instructions-list instructions-two-column">
        `;
        data.instructions.forEach(instruction => {
            html += `<li>${instruction}</li>`;
        });
        html += `</ol></div>`;
    }
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
    
    // Apply saved background preference
    const savedBg = localStorage.getItem('recipeBackground') || 'none';
    applyBackgroundToCards(savedBg);
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
async function generateRecipeBlob(contentElement) {
    // Create a container for the image
    const recipeContainer = document.createElement('div');
    recipeContainer.style.cssText = `
        background: white;
        padding: 50px;
        width: 900px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        position: fixed;
        left: -10000px;
        top: 0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        border-radius: 24px;
        overflow: hidden;
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
        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
            <img src="images/recipediary_icon.png" alt="Recipe Diary" style="width: 56px; height: 56px; object-fit: contain;" onerror="this.style.display='none';">
            <h1 style="font-family: 'Georgia', serif; color: #4CAF50; font-size: 2.5rem; margin: 0; font-weight: 700;">
                Recipe Diary
            </h1>
        </div>
        <p style="color: #666; font-size: 1rem; margin-top: 8px; font-weight: 500;">
            Your personal recipe collection
        </p>
    `;
    recipeContainer.appendChild(header);
    
    // Clone and add the recipe content with proper styling
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = contentElement.innerHTML;
    
    // Apply inline styles to ensure they render in the image
    contentDiv.style.cssText = `
        color: #333;
        line-height: 1.6;
    `;
    
    // Style all elements properly
    const elements = contentDiv.querySelectorAll('*');
    
    elements.forEach(el => {
        const computed = window.getComputedStyle(el);
        el.style.color = computed.color;
        el.style.fontSize = computed.fontSize;
        el.style.fontWeight = computed.fontWeight;
        el.style.margin = computed.margin;
        el.style.padding = computed.padding;
    });
    
    recipeContainer.appendChild(contentDiv);
    
    // Add a footer
    const footer = document.createElement('div');
    footer.style.cssText = `
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #e0e0e0;
        text-align: center;
        color: #999;
        font-size: 0.9rem;
    `;
    footer.innerHTML = `Created with Recipe Diary • ${new Date().toLocaleDateString()}`;
    recipeContainer.appendChild(footer);
    
    document.body.appendChild(recipeContainer);

    try {
        // Wait a bit for rendering
        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if html2canvas is available
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library not loaded. Please refresh the page and try again.');
        }

        // Use html2canvas to capture the recipe
        const canvas = await html2canvas(recipeContainer, {
            backgroundColor: null,
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            width: recipeContainer.offsetWidth,
            height: recipeContainer.offsetHeight
        });

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to create image blob'));
                } else {
                    resolve(blob);
                }
            }, 'image/png');
        });
    } finally {
        // Remove the temporary container
        if (document.body.contains(recipeContainer)) {
            document.body.removeChild(recipeContainer);
        }
    }
}

async function saveRecipeAsImage(contentElement = null) {
    const sourceContent = contentElement || recipeContent;
    const buttonElement = contentElement === modalRecipeContent ? modalSaveImageBtn : saveImageBtn;
    
    if (!sourceContent || !sourceContent.innerHTML || !sourceContent.innerHTML.trim()) {
        showError('No recipe to save. Please generate a recipe first.');
        return;
    }

    try {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<span class="icon">⏳</span> Generating...';

        const blob = await generateRecipeBlob(sourceContent);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Generate filename
        const recipeTitleElement = sourceContent.querySelector('.recipe-title');
        const recipeTitle = recipeTitleElement ? 
            recipeTitleElement.textContent.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 
            'recipe';
        const timestamp = new Date().toISOString().slice(0, 10);
        
        link.download = `${recipeTitle}_${timestamp}.png`;
        link.href = url;
        link.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 100);

        buttonElement.disabled = false;
        buttonElement.innerHTML = '<span class="icon">💾</span> Save as Image';

        const originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = '<span class="icon">✅</span> Saved!';
        setTimeout(() => {
            buttonElement.innerHTML = originalText;
        }, 2000);

    } catch (error) {
        console.error('Error saving recipe:', error);
        buttonElement.disabled = false;
        buttonElement.innerHTML = '<span class="icon">💾</span> Save as Image';
        showError(`Failed to save recipe: ${error.message}`);
    }
}

async function shareRecipeImage(contentElement = null) {
    const sourceContent = contentElement || recipeContent;
    const buttonElement = contentElement === modalRecipeContent ? modalShareBtn : shareBtn;
    
    if (!sourceContent || !sourceContent.innerHTML || !sourceContent.innerHTML.trim()) {
        showError('No recipe to share. Please generate a recipe first.');
        return;
    }

    try {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<span class="icon">⏳</span> Preparing...';

        const blob = await generateRecipeBlob(sourceContent);
        
        // Generate filename
        const recipeTitleElement = sourceContent.querySelector('.recipe-title');
        const recipeTitle = recipeTitleElement ? 
            recipeTitleElement.textContent.trim() : 
            'Recipe';
        const filename = `${recipeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
        
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: recipeTitle,
                text: `Check out this recipe for ${recipeTitle}! Created with Recipe Diary.`,
                files: [file]
            });
            
            buttonElement.innerHTML = '<span class="icon">✅</span> Shared!';
        } else {
            // Fallback for desktop/unsupported browsers
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                alert('Image copied to clipboard! You can now paste it in WhatsApp, Telegram, or Email.');
                buttonElement.innerHTML = '<span class="icon">📋</span> Copied!';
            } catch (clipboardError) {
                // If clipboard fails, fallback to download
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = filename;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 100);
                alert('Sharing not supported on this device. The image has been downloaded instead.');
                buttonElement.innerHTML = '<span class="icon">💾</span> Downloaded';
            }
        }

        setTimeout(() => {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<span class="icon">📤</span> Share';
        }, 2000);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error sharing recipe:', error);
            showError(`Failed to share recipe: ${error.message}`);
        }
        buttonElement.disabled = false;
        buttonElement.innerHTML = '<span class="icon">📤</span> Share';
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
    
    // Apply saved background preference to gallery cards
    const savedBg = localStorage.getItem('recipeBackground') || 'none';
    applyBackgroundToCards(savedBg);
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

    // Author (centered below title)
    if (editable) {
        html += `<p class="recipe-author">by <span contenteditable="true" data-field="author">${data.author || ''}</span></p>`;
    } else {
        html += `<p class="recipe-author">by ${data.author || 'Unknown'}</p>`;
    }

    // Description
    if (editable) {
        html += `<p class="recipe-description" contenteditable="true" data-field="description">${data.description || ''}</p>`;
    } else if (data.description) {
        html += `<p class="recipe-description">${data.description}</p>`;
    }

    // Recipe Meta (Prep/Cook Time/Yield in one row)
    const hasMeta = data.prep_time || data.cook_time || data.yield;
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
        if (data.yield) {
            html += `<div class="meta-item">
                <span class="meta-label">🍽️ Servings</span>
                <span class="meta-value"${editable ? ' contenteditable="true" data-field="yield"' : ''}>${data.yield}</span>
            </div>`;
        }
        html += `</div>`;
    }

    // Ingredients (2 columns)
    if (data.ingredients && data.ingredients.length > 0) {
        html += `<div class="recipe-section">
            <h2 class="recipe-section-title"><span class="icon">🥘</span> Ingredients</h2>
            <ul class="ingredients-list ingredients-two-column"${editable ? ' data-field="ingredients"' : ''}>`;
        data.ingredients.forEach((ingredient, index) => {
            if (editable) {
                html += `<li contenteditable="true" data-index="${index}">${ingredient}</li>`;
            } else {
                html += `<li>${ingredient}</li>`;
            }
        });
        html += `</ul></div>`;
    }

    // Instructions (2 columns)
    if (data.instructions && data.instructions.length > 0) {
        html += `<div class="recipe-section">
            <h2 class="recipe-section-title"><span class="icon">👨‍🍳</span> Instructions</h2>
            <ol class="instructions-list instructions-two-column"${editable ? ' data-field="instructions"' : ''}>`;
        data.instructions.forEach((instruction, index) => {
            if (editable) {
                html += `<li contenteditable="true" data-index="${index}">${instruction}</li>`;
            } else {
                html += `<li>${instruction}</li>`;
            }
        });
        html += `</ol></div>`;
    }

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
    
    // Apply saved background preference
    const savedBg = localStorage.getItem('recipeBackground') || 'none';
    applyBackgroundToCards(savedBg);
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
    fetchUserCredits();
});
