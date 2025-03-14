// Global variables for user session
let currentUserId = null;
let currentUserName = null;

// Global variables
let currentRating = 0;
let lastTestId = null;
let lastTestType = null;

// Global chart variables so we can destroy and recreate them
let frequencyChart = null;
let ratingsChart = null;
let modelsChart = null;

// Test definitions
const tests = [
    // Basic Tests
    {
        id: 'frequency-response',
        name: 'Frequency Response Test',
        description: 'Tests how well your speakers reproduce different frequencies.',
        category: 'basic'
    },
    {
        id: 'distortion',
        name: 'Distortion Test',
        description: 'Measures audio distortion at high volumes.',
        category: 'basic'
    },
    {
        id: 'bass-response',
        name: 'Bass Response Test',
        description: 'Analyzes how well your speakers handle low frequencies.',
        category: 'basic'
    },
    {
        id: 'clarity',
        name: 'Clarity Test',
        description: 'Evaluates the clarity and detail in audio reproduction.',
        category: 'basic'
    },
    // Advanced Tests
    {
        id: 'stereo-imaging',
        name: 'Stereo Imaging Test',
        description: 'Tests the spatial positioning of sound elements.',
        category: 'advanced'
    },
    {
        id: 'max-volume',
        name: 'Maximum Volume Test',
        description: 'Measures maximum volume level without distortion.',
        category: 'advanced'
    },
    {
        id: 'dynamic-range',
        name: 'Dynamic Range Test',
        description: 'Tests the ability to reproduce both quiet and loud sounds.',
        category: 'advanced'
    },
    {
        id: 'transient-response',
        name: 'Transient Response Test',
        description: 'Measures how quickly speakers respond to sudden sounds.',
        category: 'advanced'
    },
    {
        id: 'voice-reproduction',
        name: 'Voice Reproduction Test',
        description: 'Evaluates how naturally the speakers reproduce voices.',
        category: 'advanced'
    },
    {
        id: 'soundstage',
        name: 'Soundstage Test',
        description: 'Analyzes the three-dimensional soundstage creation.',
        category: 'advanced'
    }
];

// Start a user session when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initRatingStars();
    detectSpeakers();
    startUserSession();
    loadTestCards();
    checkAudio();
    
    // Activate filter buttons
    document.querySelector('.filter-btn.all-tests').classList.add('active');
});

// Initialize rating star functionality
function initRatingStars() {
    const stars = document.querySelectorAll('.star');
    const ratingValue = document.getElementById('rating-value');
    const submitButton = document.getElementById('submit-rating');
    
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            currentRating = value;
            
            // Update stars
            stars.forEach(s => {
                if (parseInt(s.dataset.value) <= value) {
                    s.classList.add('selected');
                } else {
                    s.classList.remove('selected');
                }
            });
            
            // Update rating display
            ratingValue.textContent = `${value}/5`;
            
            // Enable submit button
            submitButton.disabled = false;
        });
    });
    
    // Set up rating submission
    submitButton.addEventListener('click', submitRating);
}

// Detect system speakers
async function detectSpeakers() {
    const speakerInfoDiv = document.getElementById('detected-speaker-info');
    speakerInfoDiv.innerHTML = 'Detecting speakers...';
    
    try {
        const response = await fetch('/detect-speakers');
        const data = await response.json();
        
        if (data.status === 'success') {
            let infoHtml = `<div class="detected-info">`;
            infoHtml += `<p><strong>Device:</strong> ${data.default_device.name}</p>`;
            infoHtml += `<p><strong>Channels:</strong> ${data.default_device.channels}</p>`;
            infoHtml += `<p><strong>Sample rate:</strong> ${data.default_device.default_samplerate} Hz</p>`;
            infoHtml += `</div>`;
            
            speakerInfoDiv.innerHTML = infoHtml;
            
            // If speaker model is empty, suggest using detected name
            const speakerModelInput = document.getElementById('speaker-model');
            if (!speakerModelInput.value) {
                speakerModelInput.placeholder = `Try: ${data.default_device.name}`;
            }
        } else {
            speakerInfoDiv.innerHTML = `<p class="error">Could not detect speakers: ${data.message}</p>`;
        }
    } catch (error) {
        speakerInfoDiv.innerHTML = `<p class="error">Error detecting speakers: ${error.message}</p>`;
    }
}

// Start a user session
async function startUserSession() {
    // Ask for user name
    const userName = localStorage.getItem('userName') || prompt("Please enter your name for the testing session:", "");
    
    if (userName) {
        localStorage.setItem('userName', userName);
        
        try {
            const response = await fetch('/user/start-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_name: userName })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                currentUserId = data.user_id;
                currentUserName = data.user_name;
                
                // Update UI to show user is logged in
                document.getElementById('user-info').innerHTML = `
                    <p>Testing session: <strong>${currentUserName}</strong></p>
                `;
                document.getElementById('user-actions').style.display = 'block';
            }
        } catch (error) {
            console.error("Error starting session:", error);
        }
    }
}

// Load all test cards dynamically
function loadTestCards() {
    const testsContainer = document.getElementById('tests-container');
    
    // Create test cards
    let html = '';
    for (const test of tests) {
        html += `
            <div class="test-card" data-test-id="${test.id}">
                <h3>${test.name}</h3>
                <p>${test.description}</p>
                <div class="test-buttons">
                    <button onclick="runTest('${test.id}')" class="primary-btn">
                        <i class="fas fa-play"></i> Run Test
                    </button>
                </div>
                <div id="${test.id}-results" class="results"></div>
            </div>
        `;
    }
    
    testsContainer.innerHTML = html;
}

// Function to detect audio issues
function detectAudioIssues() {
    return new Promise((resolve, reject) => {
        try {
            // Try to create audio elements
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            // Connect nodes
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // Set very low volume
            gainNode.gain.value = 0.01;
            
            // Play a short tone
            oscillator.frequency.value = 440;
            oscillator.start();
            
            setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
                resolve(true); // Audio seems to be working
            }, 200);
            
        } catch (error) {
            console.error("Audio test failed:", error);
            reject(error); // Audio system has issues
        }
    });
}

// Run a speaker test with improved simulation feedback
async function runTest(testType) {
    // First check if audio will work
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        try {
            await detectAudioIssues();
        } catch (error) {
            // Show error message but continue with the test
            const audioErrorDiv = document.createElement('div');
            audioErrorDiv.className = 'audio-error-notice';
            audioErrorDiv.innerHTML = `
                <p><i class="fas fa-exclamation-triangle"></i> Audio system issue detected!</p>
                <p>Please check that your speakers are turned on and your browser has permission to play audio.</p>
                <button class="close-notice">Continue anyway</button>
            `;
            document.body.appendChild(audioErrorDiv);
            
            // Allow user to dismiss the notice
            audioErrorDiv.querySelector('.close-notice').addEventListener('click', () => {
                audioErrorDiv.remove();
            });
            
            // Continue with test after a delay
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // Get speaker model
    const speakerModel = document.getElementById('speaker-model').value || 'Unknown';
    
    // Show loading state
    const resultsDiv = document.getElementById(`${testType}-results`);
    resultsDiv.innerHTML = `
        <div class="test-simulation-notice">
            <p><i class="fas fa-volume-up"></i> Starting audio test... Please ensure your speakers are turned on.</p>
            <div class="test-progress">
                <div class="progress-bar"></div>
                <p>Running test...</p>
            </div>
        </div>
    `;
    resultsDiv.classList.add('active');
    
    // Animate progress bar
    const progressBar = resultsDiv.querySelector('.progress-bar');
    progressBar.style.width = '0%';
    
    // Play actual test sounds when running locally
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        
        // Play different test sounds based on test type
        if (testType === 'frequency-response') {
            await playFrequencySweep(audioCtx, progressBar);
        } else if (testType === 'bass-response') {
            await playBassTest(audioCtx, progressBar);
        } else if (testType === 'distortion') {
            await playDistortionTest(audioCtx, progressBar);
        } else {
            // For other tests, just simulate
            await simulateTestProgress(progressBar, 3000);
        }
    } else {
        // Simulate test progress
        await simulateTestProgress(progressBar, 3000);
    }
    
    try {
        // Send test request
        const response = await fetch(`/test/${testType}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ speaker_model: speakerModel })
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Save test ID and type for rating
        lastTestId = data.id || null;
        lastTestType = testType;
        
        // Display results as before
        // ... [rest of your result display code]
    } catch (error) {
        resultsDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// Function to simulate test progress
function simulateTestProgress(progressBar, duration) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = (elapsed / duration) * 100;
            progressBar.style.width = `${Math.min(progress, 100)}%`;
            
            if (progress >= 100) {
                clearInterval(progressInterval);
                resolve();
            }
        }, 50);
    });
}

// Function to play a frequency sweep test
async function playFrequencySweep(audioCtx, progressBar) {
    // Create oscillator
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Set initial frequency and gain
    oscillator.frequency.value = 50;
    gainNode.gain.value = 0.2;
    
    // Start oscillator
    oscillator.start();
    
    // Perform frequency sweep
    const duration = 5000; // 5 seconds
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const sweepInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            // Update progress bar
            progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
            
            // Calculate current frequency (exponential sweep from 50Hz to 15000Hz)
            const freqProgress = Math.pow(15000 / 50, progress);
            const currentFreq = 50 * freqProgress;
            oscillator.frequency.value = currentFreq;
            
            if (progress >= 1) {
                clearInterval(sweepInterval);
                oscillator.stop();
                resolve();
            }
        }, 50);
    });
}

// Function to play bass response test
async function playBassTest(audioCtx, progressBar) {
    // Create oscillator
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Set initial gain
    gainNode.gain.value = 0.3;
    
    // Start oscillator
    oscillator.start();
    
    // Define bass frequencies to test
    const bassFreqs = [20, 30, 40, 60, 80, 100, 150, 200];
    const duration = 500; // Time per frequency in ms
    const totalDuration = bassFreqs.length * duration;
    
    return new Promise((resolve) => {
        let currentIndex = 0;
        
        const bassInterval = setInterval(() => {
            if (currentIndex >= bassFreqs.length) {
                clearInterval(bassInterval);
                oscillator.stop();
                resolve();
                return;
            }
            
            // Set current frequency
            oscillator.frequency.value = bassFreqs[currentIndex];
            
            // Update progress
            const progress = (currentIndex * duration) / totalDuration;
            progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
            
            currentIndex++;
        }, duration);
    });
}

// Function to play distortion test
async function playDistortionTest(audioCtx, progressBar) {
    // Create oscillator and wave shaper for distortion
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const distortion = audioCtx.createWaveShaper();
    
    // Make distortion curve
    function makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
    
    // Connect nodes
    oscillator.connect(distortion);
    distortion.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Configure nodes
    oscillator.type = 'sine';
    oscillator.frequency.value = 1000;
    distortion.curve = makeDistortionCurve(400);
    gainNode.gain.value = 0.1;
    
    // Start oscillator
    oscillator.start();
    
    // Test with increasing distortion
    const duration = 4000; // 4 seconds
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const distortionInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            // Update progress bar
            progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
            
            // Gradually increase the distortion and volume
            const distAmount = 400 + progress * 600;
            distortion.curve = makeDistortionCurve(distAmount);
            
            if (progress >= 1) {
                clearInterval(distortionInterval);
                oscillator.stop();
                resolve();
            }
        }, 50);
    });
}

// Helper functions for result display
function createFrequencyResponseResults(data) {
    let html = `<div class="result-details">`;
    html += `<h5>Frequency Response Details:</h5>`;
    
    html += `<div class="freq-chart">`;
    const freqs = Object.keys(data.results);
    freqs.forEach(freq => {
        const response = data.results[freq] * 100;
        html += `
            <div class="freq-bar-container">
                <div class="freq-label">${freq} Hz</div>
                <div class="freq-bar-wrapper">
                    <div class="freq-bar" style="height: ${response}%"></div>
                </div>
                <div class="freq-value">${response.toFixed(1)}%</div>
            </div>
        `;
    });
    html += `</div>`;
    
    html += `<p class="result-explanation">A good speaker provides consistent response across all frequencies.</p>`;
    html += `</div>`;
    
    return html;
}

// Similar functions for other test types
function createDistortionResults(data) {
    // Create distortion-specific result display
    let html = `<div class="result-details">`;
    html += `<h5>Distortion Measurement:</h5>`;
    
    const distortion = data.distortion_percentage;
    const qualityLevel = distortion < 1 ? "Excellent" : 
                        distortion < 2 ? "Very Good" : 
                        distortion < 3.5 ? "Good" : 
                        distortion < 5 ? "Fair" : "Poor";
    
    html += `
        <div class="meter-container">
            <div class="meter">
                <div class="needle" style="transform: rotate(${(distortion / 10) * 180}deg)"></div>
                <div class="meter-scale">
                    <span>0%</span>
                    <span>5%</span>
                    <span>10%</span>
                </div>
            </div>
            <div class="meter-value">${distortion.toFixed(1)}% Distortion</div>
            <div class="quality-label ${qualityLevel.toLowerCase()}">${qualityLevel}</div>
        </div>
        
        <p class="result-explanation">Lower distortion means cleaner sound reproduction, especially at higher volumes.</p>
    `;
    
    html += `</div>`;
    return html;
}

function createBassResponseResults(data) {
    let html = `<div class="result-details">`;
    html += `<h5>Bass Response Details:</h5>`;
    
    html += `<div class="freq-chart horizontal">`;
    const freqs = Object.keys(data.results);
    freqs.forEach(freq => {
        const response = data.results[freq] * 100;
        html += `
            <div class="freq-bar-container horizontal">
                <div class="freq-label">${freq} Hz</div>
                <div class="freq-bar-wrapper horizontal">
                    <div class="freq-bar horizontal" style="width: ${response}%"></div>
                </div>
                <div class="freq-value">${response.toFixed(1)}%</div>
            </div>
        `;
    });
    html += `</div>`;
    
    html += `<p class="result-explanation">Bass response measures how well your speakers reproduce low frequencies.</p>`;
    html += `</div>`;
    
    return html;
}

// Add CSS for the fixed button styling and simulation notice

function startUserSession() {
    // Create a unique session ID
    const sessionId = 'user_' + Math.random().toString(36).substring(2, 15);
    
    // Send request to start session
    fetch('/user/start-session', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_name: 'Guest User' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            currentUserId = data.user_id;
            
            // Update user info display
            const userInfo = document.getElementById('user-info');
            if (userInfo) {
                userInfo.innerHTML = `
                    <p>Testing Session: ${data.user_name} <span class="session-id">(${currentUserId})</span></p>
                `;
            }
            
            // Show user actions
            const userActions = document.getElementById('user-actions');
            if (userActions) {
                userActions.style.display = 'block';
            }
        }
    })
    .catch(error => {
        console.error('Error starting user session:', error);
    });
}

// Submit speaker rating
async function submitRating() {
    if (currentRating === 0) {
        alert('Please select a rating first.');
        return;
    }
    
    const speakerModel = document.getElementById('speaker-model').value || 'Unknown';
    
    try {
        const response = await fetch('/submit-rating', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                test_id: lastTestId, 
                rating: currentRating,
                speaker_model: speakerModel
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            alert('Rating submitted successfully!');
            
            // Reset rating
            document.querySelectorAll('.star').forEach(star => {
                star.classList.remove('selected');
            });
            document.getElementById('rating-value').textContent = '0/5';
            document.getElementById('submit-rating').disabled = true;
            currentRating = 0;
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (error) {
        alert(`Error submitting rating: ${error.message}`);
    }
}

// Export test results
function exportResults(format) {
    const speakerModel = document.getElementById('speaker-model').value;
    let url = `/export-results?format=${format}`;
    
    if (speakerModel) {
        url += `&speaker_model=${encodeURIComponent(speakerModel)}`;
    }
    
    window.location.href = url;
}

// Add this function to show the export options
function showExportOptions() {
    const exportDialog = document.createElement('div');
    exportDialog.className = 'export-dialog';
    exportDialog.innerHTML = `
        <div class="export-dialog-content">
            <h3>Export Test Results</h3>
            <p>Choose a format to export your test results:</p>
            
            <div class="export-format-options">
                <button onclick="exportResults('csv')">
                    <i class="fas fa-file-csv"></i>
                    CSV Format
                    <small>Best for spreadsheet software</small>
                </button>
                
                <button onclick="exportResults('excel')">
                    <i class="fas fa-file-excel"></i>
                    Excel Format
                    <small>Includes summary and formatting</small>
                </button>
                
                <button onclick="exportResults('json')">
                    <i class="fas fa-file-code"></i>
                    JSON Format
                    <small>For technical users</small>
                </button>
            </div>
            
            <div class="filter-options">
                <label for="export-speaker-model">Filter by Speaker Model (optional):</label>
                <input type="text" id="export-speaker-model" 
                    value="${document.getElementById('speaker-model').value || ''}">
            </div>
            
            <div class="export-dialog-buttons">
                <button onclick="closeExportDialog()">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(exportDialog);
    
    // Add event listeners for the export buttons
    const exportButtons = exportDialog.querySelectorAll('.export-format-options button');
    exportButtons.forEach(button => {
        button.addEventListener('click', function() {
            const format = this.getAttribute('data-format');
            const speakerModel = document.getElementById('export-speaker-model').value;
            
            let url = `/export-results?format=${format}`;
            if (speakerModel) {
                url += `&speaker_model=${encodeURIComponent(speakerModel)}`;
            }
            
            window.location.href = url;
            closeExportDialog();
        });
    });
}

function closeExportDialog() {
    const dialog = document.querySelector('.export-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// Load analytics data
async function loadAnalytics() {
    const analyticsDiv = document.getElementById('analytics-results');
    const summaryDiv = analyticsDiv.querySelector('.analytics-summary');
    
    analyticsDiv.classList.add('active');
    summaryDiv.innerHTML = '<p>Loading analytics...</p>';
    
    try {
        const response = await fetch('/analytics');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if there was an error from the server
        if (data.error) {
            throw new Error(data.message || data.error);
        }
        
        // Display summary statistics
        let summaryHTML = `<h3>Testing Summary</h3>`;
        
        // Create stat cards grid
        summaryHTML += `<div class="stat-grid">`;
        
        summaryHTML += `
            <div class="stat-card">
                <div class="stat-label">Total Tests</div>
                <div class="stat-value">${data.total_tests}</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Average Score</div>
                <div class="stat-value">${data.average_score.toFixed(1)}/100</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-label">Speakers Tested</div>
                <div class="stat-value">${Object.keys(data.speaker_models).length}</div>
            </div>
        `;
        
        summaryHTML += `</div>`;
        
        // Speaker model breakdown
        if (Object.keys(data.speaker_models).length > 0) {
            summaryHTML += `<h4>Speaker Models</h4><ul class="model-list">`;
            for (const [model, count] of Object.entries(data.speaker_models)) {
                const avgScore = data.average_scores_by_model[model] ? 
                    data.average_scores_by_model[model].toFixed(1) : "N/A";
                summaryHTML += `<li>${model}: ${count} tests, Avg score: ${avgScore}/100</li>`;
            }
            summaryHTML += `</ul>`;
        }
        
        // Add explanations for results
        summaryHTML += `<div class="result-explanation">
            <h4>Understanding Your Results</h4>
            <p>The frequency response test evaluates how accurately your speakers reproduce different frequencies. 
               A score near 100 indicates even reproduction across all frequencies.</p>
            <p>The distortion test measures unwanted noise or artifacts in audio reproduction. 
               Lower distortion percentages (and higher scores) indicate cleaner sound.</p>
            <p>The bass response test specifically evaluates low-frequency performance, which is important for music with strong bass elements.</p>
        </div>`;
        
        summaryDiv.innerHTML = summaryHTML;
        
        // Create charts
        createFrequencyChart(data.frequency_data);
        createRatingsChart(data.ratings_distribution);
        createModelsChart(data.average_scores_by_model);
        
    } catch (error) {
        summaryDiv.innerHTML = `<p class="error">Error loading analytics: ${error.message}</p>`;
    }
}

function createFrequencyChart(data) {
    const ctx = document.getElementById('frequencyChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (frequencyChart) {
        frequencyChart.destroy();
    }
    
    frequencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Average Response',
                data: data.average_response.map(val => val * 100), // Convert to percentage
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Response (%)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Average Frequency Response Curve'
                }
            }
        }
    });
}

function createRatingsChart(ratingsData) {
    const ctx = document.getElementById('ratingsChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (ratingsChart) {
        ratingsChart.destroy();
    }
    
    ratingsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1 Star', '2 Stars', '3 Stars', '4 Stars', '5 Stars'],
            datasets: [{
                label: 'Number of Ratings',
                data: ratingsData,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(255, 205, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(54, 162, 235, 0.7)'
                ],
                borderColor: [
                    'rgb(255, 99, 132)',
                    'rgb(255, 159, 64)',
                    'rgb(255, 205, 86)',
                    'rgb(75, 192, 192)',
                    'rgb(54, 162, 235)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Ratings'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'User Rating Distribution'
                }
            }
        }
    });
}

function createModelsChart(averageScores) {
    const ctx = document.getElementById('modelsChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (modelsChart) {
        modelsChart.destroy();
    }
    
    // Extract data for chart
    const labels = Object.keys(averageScores);
    const scores = Object.values(averageScores);
    
    modelsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Score',
                data: scores,
                backgroundColor: 'rgba(75, 192, 192, 0.7)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Score'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Average Scores by Speaker Model'
                }
            }
        }
    });
}

// Get speaker recommendations
async function getSpeakerRecommendations() {
    const recommendationsDiv = document.getElementById('recommendations-results');
    recommendationsDiv.innerHTML = '<p>Loading recommendations...</p>';
    recommendationsDiv.classList.add('active');
    
    try {
        // Get recommendations with user context if available
        let url = '/recommendations';
        if (currentUserId) {
            url += `?user_id=${currentUserId}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        let html = '<h3>Speaker Recommendations</h3>';
        
        // Show personalized recommendations if available
        if (data.personalized_recommendations && data.personalized_recommendations.length > 0) {
            html += '<h4>Personalized Recommendations</h4>';
            html += '<div class="recommendations-list">';
            
            for (const rec of data.personalized_recommendations.slice(0, 3)) {
                const score = rec.personalized_score.toFixed(1);
                html += `
                    <div class="recommendation-card">
                        <div class="model-name">${rec.model}</div>
                        <div class="score-display">
                            <div class="score-value">${score}</div>
                            <div class="score-bar" style="width: ${score}%"></div>
                        </div>
                        <div class="rec-details">
                            <p>Based on ${rec.test_count} tests</p>
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
        }
        
        // Show best overall speakers
        html += '<h4>Best Overall Speakers</h4>';
        html += '<div class="recommendations-list">';
        
        for (const speaker of data.best_speakers.slice(0, 5)) {
            const score = speaker.average_score.toFixed(1);
            html += `
                <div class="recommendation-card">
                    <div class="model-name">${speaker.model}</div>
                    <div class="score-display">
                        <div class="score-value">${score}</div>
                        <div class="score-bar" style="width: ${score}%"></div>
                    </div>
                    <div class="rec-details">
                        <p>Based on ${speaker.test_count} tests</p>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Add explanation
        html += `
            <div class="recommendation-explanation">
                <p>${data.explanation}</p>
                <p>These recommendations are based on aggregated test results from multiple users and speaker models.</p>
            </div>
        `;
        
        // Add export options
        html += `
            <div class="export-options">
                <h4>Export Data</h4>
                <button onclick="exportUserData()">Export Your Test Data</button>
                <button onclick="exportHistoricalData()">Export Historical Data</button>
            </div>
        `;
        
        recommendationsDiv.innerHTML = html;
    } catch (error) {
        recommendationsDiv.innerHTML = `<p class="error">Error loading recommendations: ${error.message}</p>`;
    }
}

// Export user data
function exportUserData() {
    if (!currentUserId) {
        alert("Please start a testing session first");
        return;
    }
    
    // Create URL with user_id parameter
    const url = `/user/export-data?user_id=${currentUserId}`;
    
    // Download the file
    window.location.href = url;
}

// Export historical data
function exportHistoricalData() {
    // Create URL for historical data export
    const url = `/export-historical-data`;
    
    // Download the file
    window.location.href = url;
}

// Load recommendations with test preferences
function loadRecommendationsWithPreferences() {
    // Get selected test types
    const checkboxes = document.querySelectorAll('.test-preference:checked');
    const selectedTests = Array.from(checkboxes).map(cb => cb.value);
    
    // Build URL with preferences
    let url = '/recommendations';
    const params = [];
    
    if (selectedTests.length > 0) {
        params.push(`test_types=${selectedTests.join(',')}`);
    }
    
    if (currentUserId) {
        params.push(`user_id=${currentUserId}`);
    }
    
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    
    // Fetch and display recommendations
    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayRecommendations(data);
        })
        .catch(error => {
            const recommendationsDiv = document.getElementById('recommendations-results');
            recommendationsDiv.innerHTML = `<p class="error">Error loading recommendations: ${error.message}</p>`;
        });
}

// Display recommendations data
function displayRecommendations(data) {
    const recommendationsDiv = document.getElementById('recommendations-results');
    
    let html = '<h3>Speaker Recommendations</h3>';
    
    // Show personalized recommendations if available
    if (data.personalized_recommendations && data.personalized_recommendations.length > 0) {
        html += '<h4>Personalized Recommendations</h4>';
        html += '<div class="recommendations-list">';
        
        for (const rec of data.personalized_recommendations.slice(0, 3)) {
            const score = rec.personalized_score.toFixed(1);
            html += `
                <div class="recommendation-card">
                    <div class="model-name">${rec.model}</div>
                    <div class="score-display">
                        <div class="score-value">${score}</div>
                        <div class="score-bar" style="width: ${score}%"></div>
                    </div>
                    <div class="rec-details">
                        <p>Based on ${rec.test_count} tests</p>
                        <p>Your preference match: ${(rec.preference_match * 100).toFixed(0)}%</p>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    // Show best overall speakers
    html += '<h4>Best Overall Speakers</h4>';
    html += '<div class="recommendations-list">';
    
    for (const speaker of data.best_speakers.slice(0, 5)) {
        const score = speaker.average_score.toFixed(1);
        html += `
            <div class="recommendation-card">
                <div class="model-name">${speaker.model}</div>
                <div class="score-display">
                    <div class="score-value">${score}</div>
                    <div class="score-bar" style="width: ${score}%"></div>
                </div>
                <div class="rec-details">
                    <p>Based on ${speaker.test_count} tests</p>
                    ${speaker.scores_by_type ? '<p class="test-scores-breakdown">Test scores:</p><ul>' : ''}
                    ${speaker.scores_by_type ? 
                        Object.entries(speaker.scores_by_type).map(([type, score]) => 
                            `<li>${formatTestType(type)}: ${score.toFixed(1)}</li>`).join('') : ''}
                    ${speaker.scores_by_type ? '</ul>' : ''}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    
    // Add explanation
    html += `
        <div class="recommendation-explanation">
            <p>${data.explanation || "Recommendations based on aggregated test data and your preferences."}</p>
            <p>These recommendations are based on ${data.total_tests} tests across ${Object.keys(data.speaker_models || {}).length} different speaker models.</p>
        </div>
    `;
    
    // Add export options
    html += `
        <div class="export-options">
            <h4>Export Data</h4>
            <button onclick="exportUserData()">Export Your Test Data</button>
            <button onclick="exportHistoricalData()">Export Historical Data</button>
        </div>
    `;
    
    recommendationsDiv.innerHTML = html;
    recommendationsDiv.classList.add('active');
}

// Format test type for display
function formatTestType(testType) {
    // Convert test_type to Title Case with spaces
    return testType
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

// Compare current speaker with historical data
function compareWithHistorical() {
    // Get current speaker model
    const speakerModel = document.getElementById('speaker-model').value;
    
    if (!speakerModel) {
        alert("Please enter a speaker model first");
        return;
    }
    
    const compareDiv = document.getElementById('comparison-results');
    compareDiv.innerHTML = '<p>Loading comparison data...</p>';
    compareDiv.classList.add('active');
    
    fetch(`/compare?speaker_model=${encodeURIComponent(speakerModel)}`)
        .then(response => response.json())
        .then(data => {
            displayComparison(data, speakerModel);
        })
        .catch(error => {
            compareDiv.innerHTML = `<p class="error">Error loading comparison: ${error.message}</p>`;
        });
}

// Display comparison data
function displayComparison(data, speakerModel) {
    const compareDiv = document.getElementById('comparison-results');
    
    let html = `<h3>Comparison: ${speakerModel}</h3>`;
    
    if (data.comparison && data.average && data.top_performer) {
        // Create comparison chart
        html += `<div class="chart-container"><canvas id="comparisonChart"></canvas></div>`;
        
        // Add comparison table
        html += `
            <div class="comparison-table-container">
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Test Type</th>
                            <th>${speakerModel}</th>
                            <th>Average</th>
                            <th>Top Performer</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        for (const [testType, score] of Object.entries(data.comparison)) {
            const avgScore = data.average[testType] || "N/A";
            const topScore = data.top_performer[testType]?.score || "N/A";
            const topModel = data.top_performer[testType]?.model || "N/A";
            
            html += `
                <tr>
                    <td>${formatTestType(testType)}</td>
                    <td>${score.toFixed(1)}</td>
                    <td>${typeof avgScore === 'number' ? avgScore.toFixed(1) : avgScore}</td>
                    <td>${typeof topScore === 'number' ? topScore.toFixed(1) : topScore} (${topModel})</td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Add insights
        if (data.insights && data.insights.length > 0) {
            html += `<div class="comparison-insights"><h4>Insights</h4><ul>`;
            for (const insight of data.insights) {
                html += `<li>${insight}</li>`;
            }
            html += `</ul></div>`;
        }
    } else {
        html += `<p>Not enough data available for comparison.</p>`;
    }
    
    compareDiv.innerHTML = html;
    
    // Create comparison chart if data exists
    if (data.comparison && data.average && data.top_performer) {
        createComparisonChart(data, speakerModel);
    }
}

// Create comparison chart
function createComparisonChart(data, speakerModel) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    // Get test types and scores
    const testTypes = Object.keys(data.comparison).map(type => formatTestType(type));
    const currentScores = Object.values(data.comparison);
    const avgScores = testTypes.map(type => {
        const originalType = type.toLowerCase().replace(/ /g, '_');
        return data.average[originalType] || 0;
    });
    
    // Create the chart
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: testTypes,
            datasets: [
                {
                    label: speakerModel,
                    data: currentScores,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                },
                {
                    label: 'Average',
                    data: avgScores,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 99, 132, 1)',
                }
            ]
        },
        options: {
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Speaker Performance Comparison'
                }
            }
        }
    });
}

// Filter tests by category
function filterTests(category) {
    const testCards = document.querySelectorAll('.test-card');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    // Update active filter button
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(category + '-tests')) {
            btn.classList.add('active');
        }
    });
    
    // Filter test cards
    testCards.forEach(card => {
        const testId = card.getAttribute('data-test-id');
        const test = tests.find(t => t.id === testId);
        
        if (test && test.category === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Show all tests
function showAllTests() {
    const testCards = document.querySelectorAll('.test-card');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    // Update active filter button
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains('all-tests')) {
            btn.classList.add('active');
        }
    });
    
    // Show all test cards
    testCards.forEach(card => {
        card.style.display = 'block';
    });
}

// Function to check if audio is playing and update UI accordingly
function checkAudio() {
    // Create a test audio context
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const testContext = new AudioContext();
        
        // Check state
        if (testContext.state === 'suspended') {
            // Audio is suspended, warn the user
            const warningDiv = document.createElement('div');
            warningDiv.className = 'audio-warning';
            warningDiv.innerHTML = `
                <p><i class="fas fa-volume-mute"></i> Audio is currently disabled in your browser.</p>
                <p>Click anywhere on the page to enable audio for testing.</p>
            `;
            document.body.appendChild(warningDiv);
            
            // Add click handler to resume audio
            document.addEventListener('click', function resumeAudio() {
                testContext.resume().then(() => {
                    if (warningDiv.parentNode) {
                        warningDiv.parentNode.removeChild(warningDiv);
                    }
                    document.removeEventListener('click', resumeAudio);
                });
            }, { once: true });
        }
        
    } catch (e) {
        console.error("Audio context not supported:", e);
    }
}

// Call this when page loads
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    checkAudio();
});