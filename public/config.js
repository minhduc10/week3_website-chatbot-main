(function() {
  try {
    var url = new URL(window.location.href);
    var qp = url.searchParams.get('apiBase') || url.searchParams.get('api');
    if (qp) {
      window.PROD_API_BASE = qp;
    }
    if (!window.PROD_API_BASE) {
      // Set your production API base here when deploying static hosting (e.g., GitHub Pages)
      // Example: 'https://your-vercel-backend-domain.vercel.app/api'
      window.PROD_API_BASE = '/api';
    }
  } catch (e) {
    window.PROD_API_BASE = window.PROD_API_BASE || '/api';
  }
})();


