// Supabase Configuration for Beach Rocks Web Map
// This file initializes the Supabase JavaScript client for the Beach Rocks application.

// Configuration - These will be replaced during GitHub Pages deployment via GitHub Actions
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Helper function to display configuration error banner
function showConfigurationError(message, details) {
    console.error('⚠️ Configuration Error:', message);
    if (details) console.error('Details:', details);
    
    let errorBanner = document.getElementById('error-banner');
    if (!errorBanner) {
        errorBanner = document.createElement('div');
        errorBanner.id = 'error-banner';
        errorBanner.className = 'error-banner';
        document.body.insertBefore(errorBanner, document.body.firstChild);
    }
    
    errorBanner.innerHTML = `
        <div class="error-banner-content">
            <div class="error-banner-icon">⚠️</div>
            <div class="error-banner-message">
                <strong>Supabase Configuration Required</strong>
                <p>${message}</p>
            </div>
            <button class="error-banner-close" aria-label="Close error banner">×</button>
        </div>
    `;
    errorBanner.classList.remove('hidden');
    
    const closeButton = errorBanner.querySelector('.error-banner-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => errorBanner.classList.add('hidden'));
    }
}

// Validate configuration
function validateConfig() {
    console.log('🔍 Validating Supabase configuration...');

    if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
        showConfigurationError('Supabase URL is not configured.');
        return false;
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        showConfigurationError('Supabase anon key is not configured.');
        return false;
    }

    if (!SUPABASE_URL.startsWith('https://') || !SUPABASE_URL.includes('.supabase.co')) {
        showConfigurationError('Invalid Supabase URL format.');
        return false;
    }

    if (!SUPABASE_ANON_KEY.startsWith('eyJ')) {
        showConfigurationError('Invalid Supabase anon key format.');
        return false;
    }

    console.log('✅ Configuration validation passed');
    return true;
}

// Test Supabase connection
async function testConnection(supabaseClient) {
    console.log('🔌 Testing Supabase connection...');
    try {
        const { count, error } = await supabaseClient
            .from('beachrocks')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Connection test failed:', error.message);
            showConfigurationError('Failed to connect to Supabase.', error.message);
            return false;
        }

        console.log('✅ Connection test successful');
        console.log('📊 Beachrocks table has', count, 'records');
        return true;

    } catch (error) {
        console.error('❌ Connection test exception:', error);
        showConfigurationError('An error occurred while testing the database connection.', error.message);
        return false;
    }
}

// Initialize Supabase client
(async function initializeSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded.');
        showConfigurationError('Supabase library not loaded. Please check the CDN script.');
        return;
    }
    
    if (!validateConfig()) {
        console.error('❌ Cannot initialize Supabase client without valid credentials');
        return;
    }
    
    try {
        const { createClient } = supabase;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                storage: window.localStorage
            }
        });

        window.supabaseClient = supabaseClient;
        console.log('✅ Supabase client initialized successfully');
        console.log('📍 Project URL:', SUPABASE_URL);

        await testConnection(supabaseClient);
        window.dispatchEvent(new CustomEvent('supabase-ready', { detail: { client: supabaseClient } }));
        
    } catch (error) {
        console.error('❌ Failed to initialize Supabase client:', error);
        showConfigurationError('Failed to initialize Supabase client.', error.message);
    }
})();
