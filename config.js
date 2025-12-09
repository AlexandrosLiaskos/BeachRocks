// Supabase Configuration for Beach Rocks Web Map
const SUPABASE_URL = 'https://uhzhkmqodkulmcoausud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoemhrbXFvZGt1bG1jb2F1c3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzg3NzUsImV4cCI6MjA4MDg1NDc3NX0.aA5PusrMXuWbvNIStLCh8QwvK5est0KiWVAKEiQDDm0';

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
