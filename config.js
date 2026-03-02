// Supabase Configuration for Beach Rocks Web Map
// Credentials are injected at deploy time via GitHub Actions secrets.
// For local development: replace the placeholders below with your actual values.
// WARNING: Never commit real credentials — keep placeholders here in version control.
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
(async function initializeSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded.');
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

        // Test connection
        const { count, error } = await supabaseClient
            .from('beachrocks')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Connection test failed:', error.message);
        } else {
            console.log('✅ Connection test successful -', count, 'beachrocks found');
        }
        
        window.dispatchEvent(new CustomEvent('supabase-ready', { detail: { client: supabaseClient } }));
        
    } catch (error) {
        console.error('❌ Failed to initialize Supabase client:', error);
    }
})();
