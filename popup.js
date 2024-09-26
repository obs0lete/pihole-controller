// Function to validate IP address, domain name, or URL with http/https
function validatePiholeAddress(address) {
    const httpRegex = /^(https?:\/\/)/; // Regex to check for http or https
    const ipRegex = /^(https?:\/\/)?(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const domainRegex = /^(https?:\/\/)?([a-zA-Z0-9-_]{1,63}\.)+[a-zA-Z]{2,6}$/;

    // Ensure the address starts with http:// or https://
    if (!httpRegex.test(address)) {
        return false;
    }

    return ipRegex.test(address) || domainRegex.test(address);
}

// Function to validate the API key (64 alphanumeric characters)
function validateApiKey(apiKey) {
    const apiKeyRegex = /^[a-zA-Z0-9]{64}$/;
    return apiKeyRegex.test(apiKey);
}

// Function to save a Pi-hole to storage
document.getElementById('save').addEventListener('click', function () {
    const address = document.getElementById('piholeAddress').value;
    const apiKey = document.getElementById('apiKey').value;

    // Validate Pi-hole address and API key
    if (!validatePiholeAddress(address)) {
        showNotification('Please enter a valid Pi-hole address (IP, domain name, or URL with http/https).');
        return;
    }

    if (!validateApiKey(apiKey)) {
        showNotification('Please enter a valid 64-character API key.');
        return;
    }

    // Retrieve existing Pi-hole configurations from storage
    chrome.storage.sync.get(['piholes'], function (data) {
        let piholes = data.piholes || [];

        // Add the new Pi-hole to the list
        piholes.push({ address: address, apiKey: apiKey });

        // Save the updated Pi-hole list to storage
        chrome.storage.sync.set({ piholes: piholes }, function () {
            showNotification('Pi-hole added successfully!');
            updatePiholeList();
        });
    });
});

// Function to update the Pi-hole list dropdown and select the first Pi-hole automatically
function updatePiholeList() {
    chrome.storage.sync.get(['piholes'], function (data) {
        const piholeList = document.getElementById('piholeList');
        piholeList.innerHTML = '';  // Clear the existing list

        let piholes = data.piholes || [];

        piholes.forEach((pihole, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = pihole.address;
            piholeList.appendChild(option);
        });

        if (piholes.length > 0) {
            // Select the first Pi-hole by default
            piholeList.selectedIndex = 0;
            const firstPihole = piholes[0];
            getPiholeStatus(firstPihole); // Check status for the first Pi-hole

            // Update button text to include the first Pi-hole name
            updateButtonsText(firstPihole);
        }
    });
}

// Function to update the buttons text with Pi-hole address without the protocol
function updateButtonsText(pihole) {
    if (pihole && pihole.address) {
        // Remove the protocol (http:// or https://) from the address
        const addressWithoutProtocol = pihole.address.replace(/^(https?:\/\/)/, '');

        document.getElementById('enable').innerText = `Enable ${addressWithoutProtocol}`;
        document.getElementById('disable').innerText = `Disable ${addressWithoutProtocol}`;
        document.getElementById('deletePihole').innerText = `Delete ${addressWithoutProtocol}`;
    } else {
        console.error('Invalid Pi-hole object passed to updateButtonsText:', pihole);
    }
}


// Load saved Pi-hole configurations on popup load
window.onload = function () {
    updatePiholeList();
};

// Function to get the status of the selected Pi-hole
function getPiholeStatus(pihole) {
    if (!pihole) {
        console.error('No Pi-hole provided for status check.');
        return;
    }

    console.log(`Fetching status for Pi-hole at ${pihole.address}`); // Debugging log

    fetch(`${pihole.address}/admin/api.php?status&auth=${pihole.apiKey}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log(`Status for ${pihole.address}: ${data.status}`); // Debugging log

        const statusText = data.status === 'enabled' ? 'Enabled' : 'Disabled';
        const statusElement = document.getElementById('piholeStatus');
        statusElement.innerHTML = `Pi-hole Status: <span id="dynamicStatus">${statusText}</span>`;

        const dynamicStatusElement = document.getElementById('dynamicStatus');
        dynamicStatusElement.style.color = data.status === 'enabled' ? 'green' : 'red';
    })
    .catch(error => {
        console.error('Error fetching Pi-hole status:', error);
        const statusElement = document.getElementById('piholeStatus');
        statusElement.innerHTML = 'Pi-hole Status: <span id="dynamicStatus">Error fetching status</span>';
        document.getElementById('dynamicStatus').style.color = 'orange';
    });
}

// Function to disable the selected Pi-hole
document.getElementById('disable').addEventListener('click', function () {
    const selectedPiholeIndex = document.getElementById('piholeList').value;

    chrome.storage.sync.get(['piholes'], function (data) {
        let piholes = data.piholes || [];

        if (piholes[selectedPiholeIndex]) {
            const pihole = piholes[selectedPiholeIndex];

            // Disable the selected Pi-hole
            fetch(`${pihole.address}/admin/api.php?disable&auth=${pihole.apiKey}`, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                showNotification('Pi-hole disabled');
                
                // Fetch the updated status after disabling the specific Pi-hole
                getPiholeStatus(pihole); // Only call for the disabled Pi-hole
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error disabling Pi-hole');
            });
        } else {
            showNotification('Please select a valid Pi-hole.');
        }
    });
});


// Update the function where you want to start the interval
let statusRefreshInterval;

function stopPiholeStatusRefresh() {
    clearInterval(statusRefreshInterval);
}

function startPiholeStatusRefresh(pihole) {
    stopPiholeStatusRefresh(); // Clear any existing interval

    // Start fetching status for the specific Pi-hole
    getPiholeStatus(pihole);

    statusRefreshInterval = setInterval(() => {
        getPiholeStatus(pihole);
    }, 500);
}


// Call startPiholeStatusRefresh instead of getPiholeStatus directly
function updatePiholeList() {
    chrome.storage.sync.get(['piholes'], function (data) {
        const piholeList = document.getElementById('piholeList');
        piholeList.innerHTML = '';  // Clear the existing list

        let piholes = data.piholes || [];

        piholes.forEach((pihole, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = pihole.address;
            piholeList.appendChild(option);
        });

        if (piholes.length > 0) {
            // Select the first Pi-hole by default
            piholeList.selectedIndex = 0;
            const firstPihole = piholes[0];

            // Start refreshing status for the first Pi-hole
            startPiholeStatusRefresh(firstPihole);

            // Update button text to include the first Pi-hole name
            updateButtonsText(firstPihole);
        }
    });
}

document.getElementById('piholeList').addEventListener('change', function () {
    const selectedPiholeIndex = this.value;

    chrome.storage.sync.get(['piholes'], function (data) {
        let piholes = data.piholes || [];

        if (piholes[selectedPiholeIndex]) {
            const selectedPihole = piholes[selectedPiholeIndex];

            // Stop previous interval for the currently selected Pi-hole
            stopPiholeStatusRefresh();

            // Get the status for the selected Pi-hole
            getPiholeStatus(selectedPihole);

            // Start the refresh for the selected Pi-hole
            startPiholeStatusRefresh(selectedPihole);
            
            // Update button text
            updateButtonsText(selectedPihole);
        }
    });
});


// Collapsible Add Pi-hole section
document.getElementById('toggleAddPihole').addEventListener('click', function() {
    const content = document.getElementById('addPiholeSection');
    if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block'; // Show the content
    } else {
        content.style.display = 'none'; // Hide the content
    }
});

// Function to disable the selected Pi-hole
document.getElementById('disable').addEventListener('click', function () {
    const selectedPiholeIndex = document.getElementById('piholeList').value;

    chrome.storage.sync.get(['piholes'], function (data) {
        let piholes = data.piholes || [];

        if (piholes[selectedPiholeIndex]) {
            const pihole = piholes[selectedPiholeIndex];

            // Fetch to disable the selected Pi-hole
            fetch(`${pihole.address}/admin/api.php?disable&auth=${pihole.apiKey}`, {
                method: 'GET',
                mode: 'cors', // Ensure CORS mode is set
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                showNotification('Pi-hole disabled');
                getPiholeStatus(pihole); // Update status after disabling
            })
            .catch(error => console.error('Error:', error));
        } else {
            showNotification('Please select a valid Pi-hole.');
        }
    });
});

// Function to enable the selected Pi-hole
document.getElementById('enable').addEventListener('click', function () {
    const selectedPiholeIndex = document.getElementById('piholeList').value;

    chrome.storage.sync.get(['piholes'], function (data) {
        let piholes = data.piholes || [];

        if (piholes[selectedPiholeIndex]) {
            const pihole = piholes[selectedPiholeIndex];

            // Fetch to enable the selected Pi-hole
            fetch(`${pihole.address}/admin/api.php?enable&auth=${pihole.apiKey}`, {
                method: 'GET',
                mode: 'cors', // Ensure CORS mode is set
                headers: {
                    'Content-Type': 'application/json',
                },
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                showNotification('Pi-hole enabled');
                getPiholeStatus(pihole); // Update status after enabling
            })
            .catch(error => console.error('Error:', error));
        } else {
            showNotification('Please select a valid Pi-hole.');
        }
    });
});

// Function to disable all Pi-holes
document.getElementById('disableAll').addEventListener('click', function () {
    chrome.storage.sync.get(['piholes'], function (data) {
        let piholes = data.piholes || [];

        if (piholes.length > 0) {
            piholes.forEach(pihole => {
                fetch(`${pihole.address}/admin/api.php?disable&auth=${pihole.apiKey}`, {
                    method: 'GET',
                    mode: 'cors', // Ensure CORS mode is set
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok: ' + response.statusText);
                    }
                })
                .catch(error => console.error('Error:', error));
            });
            showNotification('All Pi-holes disabled');
            updateAllPiholeStatus(); // Update status for all
        } else {
            showNotification('No Pi-holes to disable.');
        }
    });
});

// Function to enable all Pi-holes
document.getElementById('enableAll').addEventListener('click', function () {
    chrome.storage.sync.get(['piholes'], function (data) {
        let piholes = data.piholes || [];

        if (piholes.length > 0) {
            piholes.forEach(pihole => {
                fetch(`${pihole.address}/admin/api.php?enable&auth=${pihole.apiKey}`, {
                    method: 'GET',
                    mode: 'cors', // Ensure CORS mode is set
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok: ' + response.statusText);
                    }
                })
                .catch(error => console.error('Error:', error));
            });
            showNotification('All Pi-holes enabled');
            updateAllPiholeStatus(); // Update status for all
        } else {
            showNotification('No Pi-holes to enable.');
        }
    });
});

// Function to delete the selected Pi-hole
document.getElementById('deletePihole').addEventListener('click', function() {
    const select = document.getElementById('piholeList'); // Ensure you're using the correct select element
    const selectedIndex = select.value;

    if (selectedIndex !== '') {
        // Get the Pi-hole details before deleting for confirmation
        chrome.storage.sync.get(['piholes'], function(data) {
            let piholes = data.piholes || [];
            const selectedPihole = piholes[selectedIndex];

            // Show confirmation modal
            const confirmMessage = document.getElementById('confirmMessage');
            confirmMessage.innerText = `Are you sure you want to delete Pi-hole at ${selectedPihole.address}?`;
            const confirmModal = document.getElementById('confirmDeleteModal');
            confirmModal.classList.remove('hidden');

            // Handle confirmation button clicks
            document.getElementById('confirmDeleteYes').onclick = function() {
                // Proceed with deletion if user confirms
                piholes.splice(selectedIndex, 1); // Remove the selected Pi-hole

                chrome.storage.sync.set({ piholes: piholes }, function() {
                    console.log('Pi-hole deleted');
                    updatePiholeList(); // Refresh the select options
                    showNotification('Pi-hole deleted successfully.');
                    confirmModal.classList.add('hidden'); // Hide modal
                });
            };

            document.getElementById('confirmDeleteNo').onclick = function() {
                // Hide the modal if the user cancels
                console.log('Pi-hole deletion cancelled.');
                confirmModal.classList.add('hidden'); // Hide modal
            };
        });
    } else {
        showNotification('No Pi-hole selected for deletion.');
    }
});

// Function to show notifications
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.innerText = message;
    notification.classList.remove('hidden');
    notification.classList.add('visible');

    // Hide the notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('visible');
        notification.classList.add('hidden');
    }, 3000);
}
