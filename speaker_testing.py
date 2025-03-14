from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
import uuid
import datetime
import numpy as np
import random

# Initialize Flask app
app = Flask(__name__, 
    static_folder='static',
    template_folder='templates')

# In-memory storage for Vercel (since SQLite won't work in serverless)
class MemoryStorage:
    def __init__(self):
        self.tests = []
        self.users = {}  # user_id -> [test_ids]
        self.current_user_id = None
        self.historical_data = []  # For storing "past" test data
        
        # Add some sample data
        self._add_sample_data()
        self._add_historical_data()
    
    def _add_sample_data(self):
        # Add some sample test data
        speaker_models = ["Bose SoundLink", "JBL Flip 5", "Sony WH-1000XM4", "Sonos One"]
        test_types = ["frequency_response", "distortion", "bass_response"]
        
        for i in range(10):
            model = random.choice(speaker_models)
            test_type = random.choice(test_types)
            
            if test_type == "frequency_response":
                additional_data = {
                    "100": random.uniform(0.7, 0.95),
                    "500": random.uniform(0.75, 0.98),
                    "1000": random.uniform(0.8, 0.99),
                    "5000": random.uniform(0.75, 0.95),
                    "10000": random.uniform(0.7, 0.9),
                    "15000": random.uniform(0.6, 0.85)
                }
            elif test_type == "distortion":
                distortion = random.uniform(0.5, 5.0)
                additional_data = {"distortion_percentage": distortion}
            else:  # bass_response
                additional_data = {
                    "20": random.uniform(0.6, 0.9),
                    "40": random.uniform(0.65, 0.92),
                    "60": random.uniform(0.7, 0.94),
                    "100": random.uniform(0.75, 0.96),
                    "150": random.uniform(0.8, 0.98),
                    "200": random.uniform(0.75, 0.95)
                }
                
            self.add_test({
                "id": str(uuid.uuid4()),
                "timestamp": (datetime.datetime.now() - datetime.timedelta(days=i)).isoformat(),
                "speaker_model": model,
                "test_type": test_type,
                "score": random.uniform(70, 95),
                "user_rating": random.randint(3, 5) if random.random() > 0.3 else None,
                "additional_data": json.dumps(additional_data)
            })
    
    def _add_historical_data(self):
        # Add historical data for comparison purposes
        speaker_models = ["Bose SoundLink", "JBL Flip 5", "Sony WH-1000XM4", "Sonos One", 
                         "Klipsch R-51M", "KEF Q150", "Edifier R1280T", "Polk Audio T15"]
        test_types = ["frequency_response", "distortion", "bass_response", "stereo_imaging", 
                     "clarity", "max_volume", "dynamic_range", "transient_response", 
                     "voice_reproduction", "soundstage"]
        
        # Create 50 historical test records
        for i in range(50):
            model = random.choice(speaker_models)
            # Bias some speakers to be better than others
            if model in ["KEF Q150", "Sony WH-1000XM4"]:
                base_score = random.uniform(80, 95)
            elif model in ["Bose SoundLink", "Sonos One"]:
                base_score = random.uniform(75, 90)
            else:
                base_score = random.uniform(65, 85)
                
            # Create tests for different types
            for test_type in random.sample(test_types, k=random.randint(3, 8)):
                # Add some variation to scores
                test_score = base_score + random.uniform(-10, 10)
                test_score = max(50, min(99, test_score))
                
                historical_test = {
                    "id": str(uuid.uuid4()),
                    "timestamp": (datetime.datetime.now() - datetime.timedelta(days=random.randint(30, 365))).isoformat(),
                    "speaker_model": model,
                    "test_type": test_type,
                    "score": test_score,
                    "user_rating": random.randint(3, 5) if random.random() > 0.3 else None,
                    "additional_data": json.dumps({"historical": True}),
                    "is_historical": True,
                    "user_id": f"past_user_{random.randint(1, 10)}"
                }
                
                self.historical_data.append(historical_test)
    
    def set_user_session(self, user_id):
        # Set current user ID and initialize if needed
        self.current_user_id = user_id
        if user_id not in self.users:
            self.users[user_id] = []
        return user_id
    
    def add_test(self, test_data):
        # Add user_id to test data if we have a current user
        if self.current_user_id:
            test_data["user_id"] = self.current_user_id
            # Add to user's test list
            self.users[self.current_user_id].append(test_data["id"])
        
        self.tests.append(test_data)
        return test_data["id"]
    
    def update_rating(self, test_id, rating):
        for test in self.tests:
            if test["id"] == test_id:
                test["user_rating"] = rating
                return True
        return False
    
    def get_all_tests(self, speaker_model=None, user_id=None, include_historical=False):
        results = []
        
        # Add current tests
        for test in self.tests:
            if (speaker_model is None or test.get("speaker_model") == speaker_model) and \
               (user_id is None or test.get("user_id") == user_id):
                results.append(test)
        
        # Add historical data if requested
        if include_historical:
            for test in self.historical_data:
                if (speaker_model is None or test.get("speaker_model") == speaker_model) and \
                   (user_id is None or test.get("user_id") == user_id):
                    results.append(test)
        
        return results
    
    def get_test_by_id(self, test_id):
        # Check current tests
        for test in self.tests:
            if test["id"] == test_id:
                return test
        
        # Check historical tests
        for test in self.historical_data:
            if test["id"] == test_id:
                return test
        
        return None
    
    def get_user_tests(self, user_id=None):
        """Get all tests for a specific user or current user"""
        if user_id is None:
            user_id = self.current_user_id
        
        if not user_id:
            return []
        
        return [t for t in self.tests if t.get("user_id") == user_id]
    
    def export_user_data(self, user_id=None):
        """Export data for a specific user or current user as CSV"""
        tests = self.get_user_tests(user_id)
        return self._tests_to_csv(tests)
    
    def export_historical_data(self):
        """Export all historical data as CSV"""
        return self._tests_to_csv(self.historical_data)
    
    def _tests_to_csv(self, tests):
        """Convert tests to CSV string"""
        from io import StringIO
        import csv
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Define column names
        column_names = ["id", "timestamp", "speaker_model", "test_type", 
                        "score", "user_rating", "additional_data", "user_id"]
        
        # Write header
        writer.writerow(column_names)
        
        # Write data rows
        for test in tests:
            row = [test.get(col, '') for col in column_names]
            writer.writerow(row)
        
        return output.getvalue()
    
    def get_best_speakers(self, test_types=None, limit=5):
        """Find the best speakers based on average scores"""
        # Combine current and historical tests
        all_tests = self.tests + self.historical_data
        
        # Filter by test types if specified
        if test_types:
            all_tests = [t for t in all_tests if t.get("test_type") in test_types]
        
        # Group tests by speaker model
        model_scores = {}
        for test in all_tests:
            model = test.get("speaker_model", "Unknown")
            if model not in model_scores:
                model_scores[model] = {"sum": 0, "count": 0, "scores_by_type": {}}
            
            test_type = test.get("test_type")
            score = test.get("score")
            
            if score is not None:
                model_scores[model]["sum"] += score
                model_scores[model]["count"] += 1
                
                if test_type:
                    if test_type not in model_scores[model]["scores_by_type"]:
                        model_scores[model]["scores_by_type"][test_type] = []
                    model_scores[model]["scores_by_type"][test_type].append(score)
        
        # Calculate averages
        results = []
        for model, data in model_scores.items():
            if data["count"] > 0:
                avg_score = data["sum"] / data["count"]
                
                # Calculate scores by test type
                type_scores = {}
                for test_type, scores in data["scores_by_type"].items():
                    if scores:
                        type_scores[test_type] = sum(scores) / len(scores)
                
                results.append({
                    "model": model,
                    "average_score": avg_score,
                    "test_count": data["count"],
                    "scores_by_type": type_scores
                })
        
        # Sort by average score (descending)
        results.sort(key=lambda x: x["average_score"], reverse=True)
        
        # Return top N results
        return results[:limit]

# Initialize storage
storage = MemoryStorage()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('../static', path)

@app.route('/detect-speakers', methods=['GET'])
def detect_speakers():
    # Simulated speaker detection since real detection won't work on Vercel
    return jsonify({
        "status": "success",
        "default_device": {
            "name": "Default Audio Device",
            "channels": 2,
            "default_samplerate": 44100,
            "hostapi": 0
        },
        "system_info": {
            "api_version": "19.6.0",
            "available_devices": 3
        }
    })

@app.route('/test/frequency-response', methods=['POST'])
def test_frequency_response():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated test results
    frequencies = [100, 500, 1000, 5000, 10000, 15000]
    results = {}
    
    for freq in frequencies:
        # Generate realistic simulated response
        simulated_response = 0.9 - (0.2 * abs(freq - 1000) / 14000)
        # Add some random variation
        simulated_response += random.uniform(-0.05, 0.05)
        simulated_response = max(0.5, min(0.99, simulated_response))
        results[str(freq)] = simulated_response
    
    score = sum(results.values()) / len(results) * 100
    
    # Save results
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "frequency_response",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps(results)
    })
    
    return jsonify({
        "test": "frequency_response",
        "results": results,
        "score": score,
        "id": test_id
    })

@app.route('/test/distortion', methods=['POST'])
def test_distortion():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated distortion test
    distortion_percentage = random.uniform(0.5, 5.0)
    score = 100 - (distortion_percentage * 10)
    
    # Save results
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "distortion",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({"distortion_percentage": distortion_percentage})
    })
    
    return jsonify({
        "test": "distortion",
        "distortion_percentage": distortion_percentage,
        "score": score,
        "id": test_id
    })

@app.route('/test/bass-response', methods=['POST'])
def test_bass_response():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated bass response test
    frequencies = [20, 40, 60, 80, 100, 150, 200]
    results = {}
    
    for freq in frequencies:
        # Generate realistic simulated response
        simulated_response = 0.7 + (0.2 * freq / 200)
        # Add some random variation
        simulated_response += random.uniform(-0.05, 0.05)
        simulated_response = max(0.5, min(0.98, simulated_response))
        results[str(freq)] = simulated_response
    
    score = sum(results.values()) / len(results) * 100
    
    # Save results
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "bass_response",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps(results)
    })
    
    return jsonify({
        "test": "bass_response",
        "results": results,
        "score": score,
        "id": test_id
    })

@app.route('/test/stereo-imaging', methods=['POST'])
def test_stereo_imaging():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated stereo imaging test
    channel_separation = random.uniform(70, 98)
    phase_accuracy = random.uniform(75, 95)
    sound_stage_width = random.uniform(65, 95)
    
    # Calculate overall score
    score = (channel_separation + phase_accuracy + sound_stage_width) / 3
    
    # Save results
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "stereo_imaging",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({
            "channel_separation": channel_separation,
            "phase_accuracy": phase_accuracy,
            "sound_stage_width": sound_stage_width
        })
    })
    
    return jsonify({
        "test": "stereo_imaging",
        "channel_separation": channel_separation,
        "phase_accuracy": phase_accuracy,
        "sound_stage_width": sound_stage_width,
        "score": score,
        "id": test_id
    })

@app.route('/test/clarity', methods=['POST'])
def test_clarity():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated clarity test
    mid_clarity = random.uniform(70, 98)
    high_clarity = random.uniform(65, 95)
    vocal_clarity = random.uniform(75, 99)
    
    # Calculate overall score
    score = (mid_clarity + high_clarity + vocal_clarity) / 3
    
    # Save results
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "clarity",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({
            "mid_clarity": mid_clarity,
            "high_clarity": high_clarity,
            "vocal_clarity": vocal_clarity
        })
    })
    
    return jsonify({
        "test": "clarity",
        "mid_clarity": mid_clarity,
        "high_clarity": high_clarity,
        "vocal_clarity": vocal_clarity,
        "score": score,
        "id": test_id
    })

@app.route('/test/max-volume', methods=['POST'])
def test_max_volume():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated max volume test
    max_db = random.uniform(85, 110)
    distortion_at_max = random.uniform(3, 15)
    
    # Calculate score (higher volume is better, but higher distortion is worse)
    volume_score = (max_db - 85) * 3  # 0-75 points
    distortion_penalty = distortion_at_max * 2  # 6-30 points penalty
    score = max(0, min(100, 85 + volume_score - distortion_penalty))
    
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "max_volume",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({
            "max_db": max_db,
            "distortion_at_max": distortion_at_max
        })
    })
    
    return jsonify({
        "test": "max_volume",
        "max_db": max_db,
        "distortion_at_max": distortion_at_max,
        "score": score,
        "id": test_id
    })

@app.route('/test/dynamic-range', methods=['POST'])
def test_dynamic_range():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated dynamic range test
    dynamic_range_db = random.uniform(60, 95)
    detail_preservation = random.uniform(70, 95)
    
    # Calculate score
    score = (dynamic_range_db - 60) * 1.5 + detail_preservation * 0.2
    score = max(0, min(100, score))
    
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "dynamic_range",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({
            "dynamic_range_db": dynamic_range_db,
            "detail_preservation": detail_preservation
        })
    })
    
    return jsonify({
        "test": "dynamic_range",
        "dynamic_range_db": dynamic_range_db,
        "detail_preservation": detail_preservation,
        "score": score,
        "id": test_id
    })

@app.route('/test/transient-response', methods=['POST'])
def test_transient_response():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated transient response test
    attack_speed = random.uniform(70, 98)
    decay_accuracy = random.uniform(65, 95)
    
    # Calculate score
    score = (attack_speed + decay_accuracy) / 2
    
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "transient_response",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({
            "attack_speed": attack_speed,
            "decay_accuracy": decay_accuracy
        })
    })
    
    return jsonify({
        "test": "transient_response",
        "attack_speed": attack_speed,
        "decay_accuracy": decay_accuracy,
        "score": score,
        "id": test_id
    })

@app.route('/test/voice-reproduction', methods=['POST'])
def test_voice_reproduction():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated voice reproduction test
    male_voice = random.uniform(75, 98)
    female_voice = random.uniform(70, 98)
    sibilance = random.uniform(60, 95)
    
    # Calculate score
    score = (male_voice + female_voice) / 2 - (100 - sibilance) * 0.2
    score = max(0, min(100, score))
    
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "voice_reproduction",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({
            "male_voice": male_voice,
            "female_voice": female_voice,
            "sibilance": sibilance
        })
    })
    
    return jsonify({
        "test": "voice_reproduction",
        "male_voice": male_voice,
        "female_voice": female_voice,
        "sibilance": sibilance,
        "score": score,
        "id": test_id
    })

@app.route('/test/soundstage', methods=['POST'])
def test_soundstage():
    data = request.json or {}
    speaker_model = data.get('speaker_model', 'Unknown')
    
    # Simulated soundstage test
    width = random.uniform(65, 95)
    depth = random.uniform(60, 90)
    imaging_precision = random.uniform(70, 95)
    
    # Calculate score
    score = (width + depth + imaging_precision) / 3
    
    test_id = storage.add_test({
        "id": str(uuid.uuid4()),
        "timestamp": datetime.datetime.now().isoformat(),
        "speaker_model": speaker_model,
        "test_type": "soundstage",
        "score": score,
        "user_rating": None,
        "additional_data": json.dumps({
            "width": width,
            "depth": depth,
            "imaging_precision": imaging_precision
        })
    })
    
    return jsonify({
        "test": "soundstage",
        "width": width,
        "depth": depth,
        "imaging_precision": imaging_precision,
        "score": score,
        "id": test_id
    })

@app.route('/submit-rating', methods=['POST'])
def submit_rating():
    data = request.json
    test_id = data.get('test_id')
    rating = data.get('rating')
    
    # Update rating if test_id is provided
    if test_id:
        success = storage.update_rating(test_id, rating)
        if not success:
            # For general ratings without specific test
            storage.add_test({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.datetime.now().isoformat(),
                "speaker_model": data.get('speaker_model', 'Unknown'),
                "test_type": "user_rating_only",
                "score": float(rating) * 20,  # Convert 1-5 rating to percentage
                "user_rating": rating,
                "additional_data": None
            })
    else:
        # For general ratings without specific test
        storage.add_test({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.datetime.now().isoformat(),
            "speaker_model": data.get('speaker_model', 'Unknown'),
            "test_type": "user_rating_only",
            "score": float(rating) * 20,  # Convert 1-5 rating to percentage
            "user_rating": rating,
            "additional_data": None
        })
    
    return jsonify({"status": "success", "message": "Rating submitted"})

@app.route('/analytics', methods=['GET'])
def get_analytics():
    try:
        # Get all tests
        all_tests = storage.get_all_tests()
        
        if not all_tests:
            return jsonify({
                "total_tests": 0,
                "average_score": 0,
                "test_types": {},
                "speaker_models": {},
                "average_scores_by_model": {},
                "frequency_data": {
                    "labels": ["100Hz", "500Hz", "1kHz", "5kHz", "10kHz", "15kHz"],
                    "average_response": [0.8, 0.85, 0.9, 0.85, 0.8, 0.7]
                },
                "ratings_distribution": [0, 0, 0, 0, 0]
            })
        
        # Calculate basic statistics
        total_tests = len(all_tests)
        scores = [t["score"] for t in all_tests if t.get("score") is not None]
        average_score = sum(scores) / len(scores) if scores else 0
        
        # Count test types
        test_types = {}
        for test in all_tests:
            test_type = test.get("test_type", "unknown")
            test_types[test_type] = test_types.get(test_type, 0) + 1
        
        # Count speaker models
        speaker_models = {}
        for test in all_tests:
            model = test.get("speaker_model", "Unknown")
            speaker_models[model] = speaker_models.get(model, 0) + 1
        
        # Calculate average scores by model
        model_scores = {}
        for test in all_tests:
            if test.get("score") is not None:
                model = test.get("speaker_model", "Unknown")
                if model not in model_scores:
                    model_scores[model] = {"sum": 0, "count": 0}
                model_scores[model]["sum"] += test["score"]
                model_scores[model]["count"] += 1
        
        avg_scores_by_model = {}
        for model, data in model_scores.items():
            avg_scores_by_model[model] = data["sum"] / data["count"]
        
        # Process frequency data
        freq_counts = {}
        freq_sums = {}
        
        for test in all_tests:
            if test.get("test_type") == "frequency_response" and test.get("additional_data"):
                try:
                    data = json.loads(test["additional_data"])
                    for freq, response in data.items():
                        if freq not in freq_counts:
                            freq_counts[freq] = 0
                            freq_sums[freq] = 0
                        freq_counts[freq] += 1
                        freq_sums[freq] += float(response)
                except:
                    continue
        
        frequency_data = {"labels": [], "average_response": []}
        if freq_counts:
            frequency_data["labels"] = sorted(freq_counts.keys(), key=lambda x: float(x) if x.replace('.', '').isdigit() else 0)
            frequency_data["average_response"] = [freq_sums[freq] / freq_counts[freq] for freq in frequency_data["labels"]]
        else:
            frequency_data = {
                "labels": ["100Hz", "500Hz", "1kHz", "5kHz", "10kHz", "15kHz"],
                "average_response": [0.8, 0.85, 0.9, 0.85, 0.8, 0.7]
            }
        
        # Calculate rating distribution
        ratings_dist = [0, 0, 0, 0, 0]
        for test in all_tests:
            if test.get("user_rating") is not None:
                try:
                    rating = int(test["user_rating"])
                    if 1 <= rating <= 5:
                        ratings_dist[rating-1] += 1
                except:
                    pass
        
        return jsonify({
            "total_tests": total_tests,
            "average_score": float(average_score),
            "test_types": test_types,
            "speaker_models": speaker_models,
            "average_scores_by_model": avg_scores_by_model,
            "frequency_data": frequency_data,
            "ratings_distribution": ratings_dist
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Could not load analytics data"
        }), 500

@app.route('/export-results', methods=['GET'])
def export_results():
    format_type = request.args.get('format', 'csv')
    speaker_model = request.args.get('speaker_model')
    
    try:
        # Get filtered results
        results = storage.get_all_tests(speaker_model)
        
        # Define column names based on our data structure
        column_names = ["id", "timestamp", "speaker_model", "test_type", 
                        "score", "user_rating", "additional_data"]
        
        if format_type == 'json':
            return jsonify(results)
        
        elif format_type == 'csv':
            from io import StringIO
            import csv
            
            output = StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow(column_names)
            
            # Write data rows
            for test in results:
                row = [test.get(col, '') for col in column_names]
                writer.writerow(row)
            
            # Create response
            response_data = output.getvalue()
            filename = f"speaker_test_results_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            
            # Return as downloadable file
            return response_data, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        
        else:
            return jsonify({"error": "Unsupported export format"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add these new routes

@app.route('/user/start-session', methods=['POST'])
def start_user_session():
    data = request.json or {}
    user_name = data.get('user_name', f'user_{uuid.uuid4().hex[:8]}')
    
    # Create a unique user ID
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    # Set the user session
    storage.set_user_session(user_id)
    
    return jsonify({
        "status": "success",
        "user_id": user_id,
        "user_name": user_name
    })

@app.route('/user/export-data', methods=['GET'])
def export_user_data():
    user_id = request.args.get('user_id')
    
    # Export user data to CSV
    csv_data = storage.export_user_data(user_id)
    
    # Create response
    filename = f"user_speaker_tests_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    # Return as downloadable file
    return csv_data, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': f'attachment; filename="{filename}"'
    }

@app.route('/export-historical-data', methods=['GET'])
def export_historical_data():
    # Export historical data to CSV
    csv_data = storage.export_historical_data()
    
    # Create response
    filename = f"historical_speaker_tests_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    # Return as downloadable file
    return csv_data, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': f'attachment; filename="{filename}"'
    }

# Add this new route

@app.route('/recommendations', methods=['GET'])
def get_recommendations():
    try:
        # Get user preferences from query parameters
        test_types = request.args.get('test_types')
        if test_types:
            test_types = test_types.split(',')
        
        # Get user ID (optional)
        user_id = request.args.get('user_id')
        
        # Get the best speakers based on all data
        best_speakers = storage.get_best_speakers(test_types)
        
        # Get user's test data if available
        user_tests = []
        if user_id:
            user_tests = storage.get_user_tests(user_id)
        
        # Personalize recommendations if we have user data
        personalized = []
        if user_tests:
            # Extract user's preferred test types
            user_test_types = {}
            for test in user_tests:
                test_type = test.get("test_type")
                if test_type:
                    user_test_types[test_type] = user_test_types.get(test_type, 0) + 1
            
            # Sort by most tested types
            preferred_types = sorted(user_test_types.items(), key=lambda x: x[1], reverse=True)
            preferred_types = [t[0] for t in preferred_types[:3]]  # Top 3 preferred test types
            
            # Calculate weighted scores for speakers based on user preferences
            for speaker in best_speakers:
                weighted_score = speaker["average_score"]
                type_bonus = 0
                
                for test_type in preferred_types:
                    if test_type in speaker["scores_by_type"]:
                        type_score = speaker["scores_by_type"][test_type]
                        type_bonus += type_score * 0.05  # Small bonus for matching preferred test types
                
                personalized.append({
                    "model": speaker["model"],
                    "base_score": speaker["average_score"],
                    "personalized_score": min(100, weighted_score + type_bonus),
                    "test_count": speaker["test_count"],
                    "preferred_type_scores": {t: speaker["scores_by_type"].get(t, 0) for t in preferred_types if t in speaker["scores_by_type"]}
                })
            
            # Sort by personalized score
            personalized.sort(key=lambda x: x["personalized_score"], reverse=True)
        
        return jsonify({
            "best_speakers": best_speakers,
            "personalized_recommendations": personalized,
            "explanation": "Recommendations are based on historical test data and your testing preferences."
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "message": "Could not generate recommendations"
        }), 500

# Required for Vercel
app.debug = False

# This line is used when running locally
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)