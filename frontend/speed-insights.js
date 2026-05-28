// Vercel Speed Insights initialization
// https://vercel.com/docs/speed-insights
(async function initSpeedInsights() {
  // Only run in production (when deployed to Vercel)
  const isDevelopment = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.includes('192.168.');
  
  if (isDevelopment) {
    console.log('[Speed Insights] Skipped in development mode');
    return;
  }

  try {
    // Import and inject Speed Insights from CDN
    const { injectSpeedInsights } = await import('https://cdn.jsdelivr.net/npm/@vercel/speed-insights@2.0.0/dist/index.mjs');
    injectSpeedInsights();
    console.log('[Speed Insights] Initialized successfully');
  } catch (error) {
    console.error('[Speed Insights] Failed to initialize:', error);
  }
})();
