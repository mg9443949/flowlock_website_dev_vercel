'use client';
import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

declare const chrome: any;

export default function ExtensionCallbackPage() {
  useEffect(() => {
    async function sendTokenToExtension() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        window.close();
        return;
      }

      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.set({
          'sb-access-token': session.access_token,
          'sb-refresh-token': session.refresh_token,
          'sb-user-id': session.user.id
        }, () => {
          window.close();
        });
      } else {
        // chrome.storage not available — tab opened outside extension context
        window.close();
      }
    }

    sendTokenToExtension();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-2xl font-bold mb-2">Connecting FlowLock...</h1>
      <p className="text-zinc-400">This tab will close automatically.</p>
    </div>
  );
}