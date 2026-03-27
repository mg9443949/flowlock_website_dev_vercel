// @ts-ignore
import desktopIdle from 'desktop-idle';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { getSupabaseClient } from './supabase';

dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

const supabase = getSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Define minimum idle seconds before tracking as "idle" instead of app
const IDLE_THRESHOLD_SECONDS = 60;

let currentSessionId: string | null = null;
let currentUserId: string | null = null;
let currentActivity: {
    app: string;
    title: string;
    startTime: number;
} | null = null;

// User-defined productivity rules fetched from Supabase
let userRules: Array<{ rule_type: string; match_string: string; classification: string }> = [];

// Fetch and cache user-defined rules from Supabase
async function refreshUserRules() {
    if (!currentUserId) return;
    try {
        const { data } = await supabase
            .from('productivity_rules')
            .select('rule_type, match_string, classification')
            .eq('user_id', currentUserId);
        if (data) {
            userRules = data;
            console.log(`[FlowLock] Loaded ${data.length} custom productivity rule(s).`);
        }
    } catch (e) {
        console.warn('[FlowLock] Could not refresh user rules:', e);
    }
}

// Default app classification fallback
function defaultClassifyApp(appName: string): 'study' | 'neutral' | 'distraction' | 'idle' {
    const app = appName.toLowerCase();
    const distractions = ['spotify.exe', 'discord.exe', 'steam.exe', 'vlc.exe', 'epicgameslauncher.exe', 'origin.exe', 'twitch.exe'];
    if (distractions.some(d => app.includes(d))) return 'distraction';

    const study = ['code.exe', 'notion.exe', 'word.exe', 'powerpnt.exe', 'idea64.exe', 'pycharm64.exe', 'excel.exe', 'onenote.exe', 'obsidian.exe'];
    if (study.some(s => app.includes(s))) return 'study';

    return 'neutral';
}

// Classify using user rules first, then defaults
function classifyApp(appName: string): 'study' | 'neutral' | 'distraction' | 'idle' {
    const app = appName.toLowerCase();
    for (const rule of userRules) {
        if (rule.rule_type === 'app' && app.includes(rule.match_string)) {
            return rule.classification as 'study' | 'neutral' | 'distraction' | 'idle';
        }
    }
    return defaultClassifyApp(app);
}

async function startTrackingSession(userId: string) {
    currentUserId = userId;

    // Mark any stale active sessions from this machine as completed
    const hostname = require('os').hostname();
    await supabase
        .from('device_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('device_type', 'windows')
        .eq('device_id', hostname)
        .eq('status', 'active');

    const { data, error } = await supabase
        .from('device_sessions')
        .insert({
            user_id: userId,
            device_type: 'windows',
            device_id: hostname,
            status: 'active'
        })
        .select()
        .single();

    if (data) {
        currentSessionId = data.id;
        console.log(`[FlowLock] Syncing started. Session ID: ${currentSessionId}`);
        await refreshUserRules(); // Load user rules before polling starts
        startPolling();
    } else {
        console.error('[FlowLock] Failed to start session on backend:', error);
    }
}

async function flushActivity() {
    if (!currentActivity || !currentSessionId || !currentUserId) return;

    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - currentActivity.startTime) / 1000);

    if (durationSeconds < 2) {
        currentActivity = null;
        return;
    }

    let classification = classifyApp(currentActivity.app);
    let appName = currentActivity.app;

    // If the system has been idle for >= threshold, annotate as idle
    if (desktopIdle.getIdleTime() >= IDLE_THRESHOLD_SECONDS) {
        classification = 'idle';
        appName = 'System Idle';
    }

    const startDate = new Date(currentActivity.startTime);

    try {
        const { error } = await supabase.from('activity_logs').insert({
            session_id: currentSessionId,
            user_id: currentUserId,
            activity_type: 'app',
            app_name: appName,
            window_title: currentActivity.title,
            start_time: startDate.toISOString(),
            end_time: new Date(endTime).toISOString(),
            duration_seconds: durationSeconds,
            classification: classification
        });

        if (!error) {
            // BUG FIX: Update daily summary after logging activity
            try {
                await supabase.rpc('update_daily_summary', {
                    p_user_id: currentUserId,
                    p_date: startDate.toISOString().split('T')[0]
                });
            } catch (rpcErr) {
                console.warn('[FlowLock] Could not update daily summary:', rpcErr);
            }
        }
    } catch (err) {
        // Silently fail if offline — ideal client would cache and retry
    }

    currentActivity = null;
}

async function pollActiveWindow() {
    try {
        const activeWinModule = await import('active-win');
        const activeWin = activeWinModule.default || activeWinModule;
        const window = await (activeWin as any)();
        if (window) {
            const app = window.owner.name;
            const title = window.title;

            // Did the app or window title change?
            if (!currentActivity || currentActivity.app !== app || currentActivity.title !== title) {
                await flushActivity();
                currentActivity = {
                    app,
                    title,
                    startTime: Date.now()
                };
            }
        } else {
            // No active window (lock screen etc.)
            await flushActivity();
        }
    } catch (error) {
        // Ignore permissions errors sometimes thrown by active-win
    }
}

function startPolling() {
    // Poll every 5 seconds
    setInterval(pollActiveWindow, 5000);

    // Refresh user rules every 10 minutes so changes take effect without restart
    setInterval(refreshUserRules, 10 * 60 * 1000);

    // Ensure we flush on exit
    process.on('SIGINT', async () => {
        console.log("\n[FlowLock] Shutting down, flushing last activity...");
        await flushActivity();

        // Mark session as completed
        if (currentSessionId) {
            await supabase
                .from('device_sessions')
                .update({ status: 'completed', ended_at: new Date().toISOString() })
                .eq('id', currentSessionId);
            console.log("[FlowLock] Session ended.");
        }
        process.exit(0);
    });
}

async function main() {
    console.log("=========================================");
    console.log("   FlowLock Windows Background Agent");
    console.log("=========================================\n");

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        console.log(`Logged in as: ${session.user.email}`);
        startTrackingSession(session.user.id);
    } else {
        console.log("You are not logged in.");
        const answers = await inquirer.prompt([
            { type: 'input', name: 'email', message: 'Email:' },
            { type: 'password', name: 'password', message: 'Password:' }
        ]);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: answers.email,
            password: answers.password
        });

        if (error) {
            console.error("[FlowLock] Login failed:", error.message);
            process.exit(1);
        } else {
            console.log("\nLogin successful!");
            startTrackingSession(data.user.id);
        }
    }
}

main();
