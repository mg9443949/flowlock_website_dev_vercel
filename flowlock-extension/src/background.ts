import { supabase } from './supabase';

let currentSessionId: string | null = null;
let currentActivity: {
    url: string;
    domain: string;
    startTime: number;
} | null = null;

// Cached user-defined productivity rules from Supabase
let userRules: Array<{ rule_type: string; match_string: string; classification: string }> = [];

// Helper to extract domain from URL
function getDomain(url: string): string {
    try {
        const { hostname } = new URL(url);
        return hostname;
    } catch (e) {
        return '';
    }
}

// Default classification fallback
function defaultClassifyDomain(domain: string): 'study' | 'neutral' | 'distraction' {
    const distractions = ['youtube.com', 'netflix.com', 'facebook.com', 'twitter.com', 'instagram.com', 'reddit.com', 'tiktok.com'];
    if (distractions.some(d => domain.includes(d))) return 'distraction';

    const study = ['github.com', 'stackoverflow.com', 'notion.so', 'wikipedia.org', 'docs.google.com', 'coursera.org', 'udemy.com', 'khanacademy.org'];
    if (study.some(s => domain.includes(s))) return 'study';

    return 'neutral';
}

// Classify using user rules first, fall back to defaults
function classifyDomain(domain: string): 'study' | 'neutral' | 'distraction' {
    const d = domain.toLowerCase();
    for (const rule of userRules) {
        if (rule.rule_type === 'domain' && d.includes(rule.match_string)) {
            return rule.classification as 'study' | 'neutral' | 'distraction';
        }
    }
    return defaultClassifyDomain(d);
}

// Fetch user rules from Supabase and cache them
async function refreshUserRules() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('productivity_rules')
            .select('rule_type, match_string, classification')
            .eq('user_id', user.id);
        if (data) userRules = data;
    } catch (e) {
        console.warn('[FlowLock] Could not refresh user rules:', e);
    }
}

async function startSession() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Not logged in

    // Mark any old active sessions for this browser as completed first
    await supabase
        .from('device_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('device_type', 'chrome')
        .eq('device_id', 'browser-ext')
        .eq('status', 'active');

    const { data, error } = await supabase
        .from('device_sessions')
        .insert({
            user_id: user.id,
            device_type: 'chrome',
            device_id: 'browser-ext',
            status: 'active'
        })
        .select()
        .single();

    if (data) {
        currentSessionId = data.id;
        console.log('[FlowLock] Session started:', currentSessionId);
        await refreshUserRules(); // Load rules after session starts
    } else {
        console.error('[FlowLock] Failed to start session:', error);
    }
}

async function flushCurrentActivity() {
    if (!currentActivity || !currentActivity.url || !currentSessionId) return;

    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - currentActivity.startTime) / 1000);

    // Skip saving if less than a few seconds or an internal chrome page
    if (durationSeconds < 2 || currentActivity.url.startsWith('chrome://') || currentActivity.url.startsWith('chrome-extension://')) {
        currentActivity = null;
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const classification = classifyDomain(currentActivity.domain);
    const startDate = new Date(currentActivity.startTime);

    const { error } = await supabase.from('activity_logs').insert({
        session_id: currentSessionId,
        user_id: user.id,
        activity_type: 'browser',
        domain: currentActivity.domain,
        window_title: currentActivity.url,
        start_time: startDate.toISOString(),
        end_time: new Date(endTime).toISOString(),
        duration_seconds: durationSeconds,
        classification: classification
    });

    if (!error) {
        console.log(`[FlowLock] Saved: ${currentActivity.domain} (${durationSeconds}s) → ${classification}`);
        // Update daily summary for the date this activity happened on
        try {
            await supabase.rpc('update_daily_summary', {
                p_user_id: user.id,
                p_date: startDate.toISOString().split('T')[0]
            });
        } catch (e) {
            console.warn('[FlowLock] Could not update daily summary:', e);
        }
    }

    currentActivity = null;
}

// Ensure session exists
async function ensureSession() {
    if (!currentSessionId) {
        await startSession();
    }
}

// Handle tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await flushCurrentActivity(); // Flush the old tab

    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            handleTabStart(tab.url);
        }
    } catch (e) {
        console.warn('[FlowLock] Could not handle tab activation:', e);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active && tab.url) {
        await flushCurrentActivity(); // Flush if navigating away from previous URL
        handleTabStart(tab.url);
    }
});

// Handle window focus changed (idle / other apps)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Chrome lost focus (user switched to another Windows app)
        await flushCurrentActivity();
    } else {
        // Chrome regained focus, get active tab
        try {
            const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
            if (tabs && tabs.length > 0 && tabs[0].url) {
                handleTabStart(tabs[0].url);
            }
        } catch (e) {
            console.warn('[FlowLock] Could not handle window focus:', e);
        }
    }
});

async function handleTabStart(url: string) {
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return;

    await ensureSession();
    currentActivity = {
        url: url,
        domain: getDomain(url),
        startTime: Date.now()
    };
}

// Periodic flush every 2 minutes + refresh user rules every 10 minutes
chrome.alarms.create('periodicSync', { periodInMinutes: 2 });
chrome.alarms.create('refreshRules', { periodInMinutes: 10 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'periodicSync') {
        if (currentActivity) {
            const url = currentActivity.url;
            await flushCurrentActivity();
            handleTabStart(url); // Restart tracking for the current active tab
        }
    } else if (alarm.name === 'refreshRules') {
        await refreshUserRules();
    }
});

// BUG FIX: Start tracking session on Chrome startup (was missing before)
chrome.runtime.onStartup.addListener(async () => {
    console.log('[FlowLock] Chrome started — initializing session...');
    currentSessionId = null;
    currentActivity = null;
    await startSession();
});

// BUG FIX: Start tracking session on extension install/update (was missing before)
chrome.runtime.onInstalled.addListener(async () => {
    console.log('[FlowLock] Extension installed/updated — initializing session...');
    currentSessionId = null;
    currentActivity = null;
    await startSession();
});
