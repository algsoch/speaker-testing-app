// Global variables
let currentRating = 0;
let lastTestId = null;
let lastTestType = null;

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    initRatingStars();
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

// Run a speaker test
async function runTest(testType) {
    // Get speaker model
    const speakerModel = document.getElementById('speaker-model').value || 'Unknown';
    
    // Show loading state
    const resultsDiv = document.getElementById(`${testType}-results`);
    resultsDiv.innerHTML = '<p>Running test...</p>';
    resultsDiv.classList.add('active');
    
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
        
        // Format and display results
        let resultsHtml = `<h4>Test Results</h4>`;
        resultsHtml += `<div class="score-container">
            <p>Score: ${Math.round(data.score)}/100</p>
            <div class="score-bar" style="width: ${data.score}%"></div>
        </div>`;
        
        // Add specific test data
        if (testType === 'frequency-response') {
            resultsHtml += `<h4>Frequency Response:</h4><ul>`;
            for (const [freq, response] of Object.entries(data.results)) {
                resultsHtml += `<li>${freq} Hz: ${(response * 100).toFixed(1)}%</li>`;
            }
            resultsHtml += `</ul>`;
        } else if (testType === 'distortion') {
            resultsHtml += `<p>Distortion: ${data.distortion_percentage.toFixed(2)}%</p>`;
        } else if (testType === 'bass-response') {
            resultsHtml += `<h4>Bass Response:</h4><ul>`;
            for (const [freq, response] of Object.entries(data.results)) {
                resultsHtml += `<li>${freq} Hz: ${(response * 100).toFixed(1)}%</li>`;
            }
            resultsHtml += `</ul>`;
        }
        
        resultsDiv.innerHTML = resultsHtml;
    } catch (error) {
        resultsDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
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

// Load analytics data
async function loadAnalytics() {
    const analyticsDiv = document.getElementById('analytics-results');
    analyticsDiv.innerHTML = '<p>Loading analytics...</p>';
    analyticsDiv.classList.add('active');
    
    try {
        const response = await fetch('/analytics');
        const data = await response.json();
        
        let analyticsHtml = `<h4>Testing Analytics</h4>`;
        analyticsHtml += `<p>Total tests conducted: ${data.total_tests}</p>`;
        analyticsHtml += `<p>Average score across all tests: ${data.average_score.toFixed(1)}</p>`;
        
        // Test types breakdown
        analyticsHtml += `<h4>Test Types</h4><ul>`;
        for (const [type, count] of Object.entries(data.test_types)) {
            analyticsHtml += `<li>${type}: ${count} tests</li>`;
        }
        analyticsHtml += `</ul>`;
        
        // Speaker models breakdown
        analyticsHtml += `<h4>Speaker Models</h4><table class="analytics-table">`;
        analyticsHtml += `<tr><th>Model</th><th>Tests</th><th>Avg Score</th></tr>`;
        
        for (const [model, count] of Object.entries(data.speaker_models)) {
            const avgScore = data.average_scores_by_model[model].toFixed(1);
            analyticsHtml += `<tr>
                <td>${model}</td>
                <td>${count}</td>
                <td>${avgScore}</td>
            </tr>`;
        }
        analyticsHtml += `</table>`;
        
        analyticsDiv.innerHTML = analyticsHtml;
    } catch (error) {
        analyticsDiv.innerHTML = `<p class="error">Error loading analytics: ${error.message}</p>`;
    }
}