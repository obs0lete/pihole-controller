// background.js

// Optional: Use background.js to initialize things or handle scheduled tasks
chrome.runtime.onInstalled.addListener(function () {
    console.log("Pi-hole control extension installed.");
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    const { action, url, apiKey } = message;

    // Function to make the fetch request
    const fetchPiholeAPI = (endpoint) => {
        return fetch(`${url}/admin/api.php?${endpoint}&auth=${apiKey}`, {
            method: 'GET',
            mode: 'cors', // Use CORS mode
            headers: {
                'Content-Type': 'application/json'
            }
        });
    };

    if (action === "fetchPiholeStatus") {
        console.log("Fetching Pi-hole status...");
        fetchPiholeAPI('status')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                sendResponse({ status: data.status || 'Unknown', error: null });
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true; // Keep the message channel open for async response
    }

    if (action === "disablePihole") {
        console.log("Disabling Pi-hole...");
        fetchPiholeAPI('disable')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                sendResponse({ status: data.status || 'Unknown', error: null });
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true; // Keep the message channel open for async response
    }

    if (action === "enablePihole") {
        console.log("Enabling Pi-hole...");
        fetchPiholeAPI('enable')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                sendResponse({ status: data.status || 'Unknown', error: null });
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true; // Keep the message channel open for async response
    }

    if (action === "deletePihole") {
        console.log("Deleting Pi-hole...");
        // Implement any specific logic needed for deletion, if applicable
        sendResponse({ status: "Pi-hole deleted.", error: null });
        return true; // Keep the message channel open for async response
    }
});
