import { createClient } from "@supabase/supabase-js";

// NOTE: The anon key is a publishable key — it is safe to embed in a browser
// extension. Row-Level Security on Supabase restricts what any user can access.
// process.env is NOT available in a Chrome Extension Service Worker context, so
// the credentials must be embedded directly here.
const SUPABASE_URL = "https://cutgjwfkgkoynmxpsntr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dGdqd2ZrZ2tveW5teHBzbnRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMjI1MDksImV4cCI6MjA4ODY5ODUwOX0.y0eHIyS-tZUH4_q3zqGPuDO8oiRlyBsFdN1_dNbvNrE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: {
            getItem: (key: string): Promise<string | null> => {
                return new Promise((resolve) => {
                    chrome.storage.local.get([key], (result) => {
                        const val = result[key];
                        resolve(typeof val === 'string' ? val : null);
                    });
                });
            },
            setItem: (key: string, value: string): Promise<void> => {
                return new Promise((resolve) => {
                    chrome.storage.local.set({ [key]: value }, () => {
                        resolve();
                    });
                });
            },
            removeItem: (key: string): Promise<void> => {
                return new Promise((resolve) => {
                    chrome.storage.local.remove([key], () => {
                        resolve();
                    });
                });
            }
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});
