// Vercel Web Analytics initialization
// https://vercel.com/docs/analytics/quickstart
(function initWebAnalytics() {
  // Initialize the analytics queue
  window.va = window.va || function () { 
    (window.vaq = window.vaq || []).push(arguments); 
  };
  
  // Only run in production (when deployed to Vercel)
  const isDevelopment = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.includes('192.168.');
  
  if (isDevelopment) {
    console.log('[Web Analytics] Running in development mode - analytics will be enabled in production');
    return;
  }

  // In production, the Vercel platform will automatically inject the analytics script
  // This initialization ensures the queue is ready for tracking
  console.log('[Web Analytics] Initialized successfully');
})();
