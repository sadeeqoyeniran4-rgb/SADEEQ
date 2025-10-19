// Centralized client configuration (do NOT store secrets here for private keys)
// Replace PAYSTACK_KEY value in CI or serve a real key via secure mechanism
// Detect local development and switch API_BASE to localhost for easier testing
(function () {
	const host = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
	if (host === 'localhost' || host === '127.0.0.1') {
		window.API_BASE = 'http://localhost:3000';
	} else {
		window.API_BASE = 'https://sadeeq-too1.onrender.com';
	}
	// Put a placeholder for the Paystack public key. Replace in deployment.
	window.PAYSTACK_KEY = window.PAYSTACK_KEY || 'REPLACE_WITH_PAYSTACK_KEY';
})();
