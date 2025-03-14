import numpy as np
from flask import Flask, render_template, request, jsonify, send_file
import sounddevice as sd
from scipy.io import wavfile
import tempfile
import os
import csv
import datetime
import json
import pandas as pd
from io import StringIO
import uuid

app = Flask(__name__)

# Create data directory if it doesn't exist
data_dir = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(data_dir, exist_ok=True)

# CSV file path
results_csv = os.path.join(data_dir, 'results.csv')

# Create CSV file with headers if it doesn't exist
if not os.path.exists(results_csv):
    with open(results_csv, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'timestamp', 'speaker_model', 'test_type', 
                        'score', 'user_rating', 'additional_data'])

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/test/frequency-response', methods=['POST'])
def test_frequency_response():
    # Get speaker model from request
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Generate sine waves at different frequencies
    sample_rate = 44100
    frequencies = [100, 500, 1000, 5000, 10000, 15000]
    duration = 1  # seconds
    
    results = {}
    
    for freq in frequencies:
        # Generate sine wave
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        tone = 0.5 * np.sin(2 * np.pi * freq * t)
        
        # Play the tone and measure response
        sd.play(tone, sample_rate)
        sd.wait()
        
        # In a real app, you'd capture the audio response here
        # For this example, we'll simulate a measurement
        simulated_response = 0.9 - (0.2 * abs(freq - 1000) / 14000)
        results[str(freq)] = simulated_response
    
    score = sum(results.values()) / len(results) * 100
    
    # Save results to CSV
    save_test_result(
        speaker_model=speaker_model,
        test_type='frequency_response',
        score=score,
        additional_data=json.dumps(results)
    )
    
    return jsonify({
        "test": "frequency_response",
        "results": results,
        "score": score
    })

@app.route('/test/distortion', methods=['POST'])
def test_distortion():
    # Get speaker model from request
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulate distortion test
    distortion_percentage = np.random.uniform(0.5, 5.0)
    score = 100 - (distortion_percentage * 10)
    
    # Save results to CSV
    save_test_result(
        speaker_model=speaker_model,
        test_type='distortion',
        score=score,
        additional_data=json.dumps({"distortion_percentage": distortion_percentage})
    )
    
    return jsonify({
        "test": "distortion",
        "distortion_percentage": distortion_percentage,
        "score": score
    })

@app.route('/test/bass-response', methods=['POST'])
def test_bass_response():
    # Get speaker model from request
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Test bass frequencies (20-200 Hz)
    sample_rate = 44100
    frequencies = [20, 40, 60, 80, 100, 150, 200]
    duration = 1.5  # seconds
    
    results = {}
    
    for freq in frequencies:
        # Generate sine wave
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        tone = 0.5 * np.sin(2 * np.pi * freq * t)
        
        # Apply fade in/out to avoid speaker damage
        fade = 0.05  # 50ms fade
        fade_len = int(fade * sample_rate)
        fade_in = np.linspace(0, 1, fade_len)
        fade_out = np.linspace(1, 0, fade_len)
        tone[:fade_len] *= fade_in
        tone[-fade_len:] *= fade_out
        
        # Play the tone
        sd.play(tone, sample_rate)
        sd.wait()
        
        # Simulate a measurement
        simulated_response = 0.7 + (0.2 * freq / 200)
        results[str(freq)] = simulated_response
    
    score = sum(results.values()) / len(results) * 100
    
    # Save results to CSV
    save_test_result(
        speaker_model=speaker_model,
        test_type='bass_response',
        score=score,
        additional_data=json.dumps(results)
    )
    
    return jsonify({
        "test": "bass_response",
        "results": results,
        "score": score
    })

@app.route('/submit-rating', methods=['POST'])
def submit_rating():
    data = request.json
    test_id = data.get('test_id')
    rating = data.get('rating')
    
    # Update rating in CSV if test_id is provided
    if test_id:
        update_rating(test_id, rating)
    else:
        # For general ratings without specific test
        save_test_result(
            speaker_model=data.get('speaker_model', 'Unknown'),
            test_type='user_rating_only',
            score=float(rating) * 20,  # Convert 1-5 rating to percentage
            user_rating=rating
        )
    
    return jsonify({"status": "success", "message": "Rating submitted"})

@app.route('/export-results', methods=['GET'])
def export_results():
    format_type = request.args.get('format', 'csv')
    speaker_model = request.args.get('speaker_model')
    
    # Read CSV data
    df = pd.read_csv(results_csv)
    
    # Filter by speaker model if provided
    if speaker_model:
        df = df[df['speaker_model'] == speaker_model]
    
    if format_type == 'csv':
        output = StringIO()
        df.to_csv(output, index=False)
        
        # Create response
        response_data = output.getvalue()
        filename = f"speaker_test_results_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        # Return as downloadable file
        return response_data, 200, {
            'Content-Type': 'text/csv',
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    
    elif format_type == 'json':
        # Convert DataFrame to JSON
        results = df.to_dict(orient='records')
        return jsonify(results)
    
    else:
        return jsonify({"error": "Unsupported format"}), 400

@app.route('/analytics', methods=['GET'])
def get_analytics():
    # Read CSV data
    df = pd.read_csv(results_csv)
    
    # Calculate basic statistics
    stats = {
        "total_tests": len(df),
        "average_score": df['score'].mean(),
        "test_types": df['test_type'].value_counts().to_dict(),
        "speaker_models": df['speaker_model'].value_counts().to_dict(),
        "average_scores_by_model": df.groupby('speaker_model')['score'].mean().to_dict()
    }
    
    return jsonify(stats)

# Helper functions for CSV operations
def save_test_result(speaker_model, test_type, score, additional_data=None, user_rating=None):
    """Save test result to CSV file"""
    with open(results_csv, 'a', newline='') as f:
        writer = csv.writer(f)
        test_id = str(uuid.uuid4())
        timestamp = datetime.datetime.now().isoformat()
        writer.writerow([
            test_id, 
            timestamp, 
            speaker_model, 
            test_type, 
            score, 
            user_rating or '', 
            additional_data or ''
        ])
    return test_id

def update_rating(test_id, rating):
    """Update user rating for a specific test"""
    df = pd.read_csv(results_csv)
    if test_id in df['id'].values:
        df.loc[df['id'] == test_id, 'user_rating'] = rating
        df.to_csv(results_csv, index=False)
        return True
    return False

if __name__ == '__main__':
    app.run(debug=True)