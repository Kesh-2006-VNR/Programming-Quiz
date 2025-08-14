 const questions = [
            {
                question: "What does HTML stand for?",
                options: ["Hyper Text Markup Language", "Home Tool Markup Language", "Hyperlinks Text Mark Language", "Hyper Text Making Language"],
                correct: 0
            },
            {
                question: "Which programming language is known as the 'language of the web'?",
                options: ["Python", "Java", "JavaScript", "C++"],
                correct: 2
            },
            {
                question: "What does CSS stand for?",
                options: ["Computer Style Sheets", "Cascading Style Sheets", "Creative Style System", "Colorful Style Sheets"],
                correct: 1
            },
            {
                question: "Which of the following is NOT a programming language?",
                options: ["Python", "HTML", "Java", "C++"],
                correct: 1
            },
            {
                question: "What is the correct way to create a function in JavaScript?",
                options: ["function myFunction() {}", "def myFunction():", "function = myFunction() {}", "create myFunction() {}"],
                correct: 0
            },
            {
                question: "Which company developed JavaScript?",
                options: ["Microsoft", "Sun Microsystems", "Netscape", "Google"],
                correct: 2
            },
            {
                question: "What does API stand for?",
                options: ["Application Programming Interface", "Advanced Programming Integration", "Automated Program Interaction", "Application Process Integration"],
                correct: 0
            },
            {
                question: "Which of these is a version control system?",
                options: ["Git", "HTML", "CSS", "MySQL"],
                correct: 0
            },
            {
                question: "What is the latest version of HTML?",
                options: ["HTML4", "HTML5", "HTML6", "XHTML"],
                correct: 1
            },
            {
                question: "Which symbol is used for comments in JavaScript?",
                options: ["#", "//", "<!-- -->", "/* */"],
                correct: 1
            }
        ];

        // Quiz State
        let currentQuestion = 0;
        let answers = [];
        let studentInfo = {};
        let timeLimit = 10 * 60; // 10 minutes in seconds
        let timerInterval;
        let testStartTime;
        let warningCount = 0;
        let quizActive = false;

        // AI Monitoring Variables
        let video, canvas, ctx;
        let faceApiLoaded = false;
        let monitoringActive = false;
        let faceDetectionInterval;
        let lookAwayCount = 0;
        let lastFaceDetection = Date.now();
        let faceLostWarnings = 0;

        // Google Sheets Web App URL
        const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxJ_aTBGvd4NKJAp2TcRzTHeudLTzpR9G69szmGAUfMNQT_xVZf8SbOn9GcRWVl0WdFSQ/exec';

        // Initialize
        window.addEventListener('load', async function() {
            answers = new Array(questions.length).fill(null);
            document.getElementById('totalQ').textContent = questions.length;
            
            setupSecurityFeatures();
            await initializeFaceDetection();
        });

        // Face Detection Initialization
        async function initializeFaceDetection() {
            try {
                video = document.getElementById('videoElement');
                canvas = document.getElementById('canvas');
                ctx = canvas.getContext('2d');

                // Load Face API models
                await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdnjs.cloudflare.com/ajax/libs/face-api.js/0.22.2/models');
                await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdnjs.cloudflare.com/ajax/libs/face-api.js/0.22.2/models');
                await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdnjs.cloudflare.com/ajax/libs/face-api.js/0.22.2/models');
                
                faceApiLoaded = true;
                updateFaceInfo('AI Models Loaded ✓');
                
                // Get camera access
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: 640, 
                        height: 480,
                        facingMode: 'user'
                    } 
                });
                video.srcObject = stream;
                
                video.addEventListener('loadedmetadata', () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    updateFaceInfo('Camera Ready ✓');
                });

            } catch (error) {
                console.error('Face detection initialization failed:', error);
                updateFaceInfo('Camera Error ✗');
                showWarning('Camera access required for AI monitoring. Please allow camera access and refresh the page.');
            }
        }

        // Start Face Monitoring
        function startFaceMonitoring() {
            if (!faceApiLoaded || !video) {
                showWarning('AI monitoring system not ready. Please refresh and try again.');
                return;
            }

            monitoringActive = true;
            document.getElementById('cameraStatus').classList.add('monitoring');
            document.getElementById('cameraContainer').classList.add('active');
            updateFaceInfo('AI Monitoring Active 👁️');

            faceDetectionInterval = setInterval(async () => {
                if (!quizActive || !monitoringActive) return;

                try {
                    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceDescriptors();

                    if (detections.length === 0) {
                        handleNoFaceDetected();
                    } else if (detections.length === 1) {
                        handleFaceDetected(detections[0]);
                    } else {
                        handleMultipleFaces();
                    }
                } catch (error) {
                    console.error('Face detection error:', error);
                }
            }, 500); // Check every 500ms
        }

        function handleFaceDetected(detection) {
            lastFaceDetection = Date.now();
            faceLostWarnings = 0;
            
            // Check eye gaze direction (simplified)
            const landmarks = detection.landmarks;
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const nose = landmarks.getNose();

            // Simple gaze detection based on eye-nose relationship
            const eyeCenter = {
                x: (leftEye[0].x + rightEye[3].x) / 2,
                y: (leftEye[0].y + rightEye[3].y) / 2
            };
            const noseCenter = nose[3];

            // Check if looking significantly away from center
            const horizontalOffset = Math.abs(eyeCenter.x - noseCenter.x);
            const faceWidth = detection.detection.box.width;
            const offsetRatio = horizontalOffset / faceWidth;

            if (offsetRatio > 0.15) { // Looking away threshold
                lookAwayCount++;
                updateFaceInfo(`Looking Away! (${lookAwayCount}/3)`);
                
                if (lookAwayCount >= 3) {
                    endQuizForViolation('Multiple instances of looking away detected');
                }
            } else {
                lookAwayCount = Math.max(0, lookAwayCount - 1);
                updateFaceInfo('Face Detected ✓');
            }
        }

        function handleNoFaceDetected() {
            const timeSinceLastDetection = Date.now() - lastFaceDetection;
            
            if (timeSinceLastDetection > 2000) { // 2 seconds without face
                faceLostWarnings++;
                updateFaceInfo(`Face Not Detected! (${faceLostWarnings}/3)`);
                
                if (faceLostWarnings >= 3) {
                    endQuizForViolation('Face not visible - student may have turned away');
                }
            } else {
                updateFaceInfo('Scanning for face...');
            }
        }

        function handleMultipleFaces() {
            endQuizForViolation('Multiple faces detected in camera');
        }

        function endQuizForViolation(reason) {
            monitoringActive = false;
            showWarning(`🚫 Test Terminated! ${reason}`);
            setTimeout(() => {
                endQuizDueToViolation();
            }, 3000);
        }

        function updateFaceInfo(message) {
            document.getElementById('faceInfo').textContent = message;
        }

        // Start Quiz Function
        async function startQuiz() {
            const name = document.getElementById('studentName').value.trim();
            const roll = document.getElementById('rollNo').value.trim();
            const email = document.getElementById('email').value.trim();

            if (!name || !roll || !email) {
                alert('Please fill in all required fields!');
                return;
            }

            if (!validateEmail(email)) {
                alert('Please enter a valid email address!');
                return;
            }

            studentInfo = { name, roll, email };
            testStartTime = new Date();

            try {
                await enterFullscreen();
                setTimeout(() => {
                    if (isFullscreen()) {
                        quizActive = true;
                        document.querySelector('.student-form').classList.remove('active');
                        document.querySelector('.quiz-container').classList.add('active');
                        startTimer();
                        loadQuestion();
                        startFaceMonitoring();
                    } else {
                        showWarning('Fullscreen mode is required to start the quiz!');
                    }
                }, 1000);
            } catch (err) {
                showWarning('Unable to enter fullscreen mode. Please try again or use a different browser.');
            }
        }

        // Security Functions
        function setupSecurityFeatures() {
            disableRightClick();
            preventTabSwitch();
            preventCopy();
            detectDevTools();
            setupFullscreenMonitoring();
        }

        function enterFullscreen() {
            const elem = document.documentElement;
            return elem.requestFullscreen?.() ||
                   elem.webkitRequestFullscreen?.() ||
                   elem.msRequestFullscreen?.() ||
                   elem.mozRequestFullScreen?.() ||
                   Promise.reject(new Error('Fullscreen not supported'));
        }

        function exitFullscreen() {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        }

        function isFullscreen() {
            return !!(document.fullscreenElement || 
                     document.webkitFullscreenElement || 
                     document.msFullscreenElement || 
                     document.mozFullScreenElement);
        }

        function setupFullscreenMonitoring() {
            document.addEventListener('fullscreenchange', handleFullscreenChange);
            document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.addEventListener('mozfullscreenchange', handleFullscreenChange);
            document.addEventListener('msfullscreenchange', handleFullscreenChange);

            document.addEventListener('keydown', function(e) {
                if (quizActive) {
                    if (e.key === 'F11' || e.key === 'Escape') {
                        e.preventDefault();
                        showWarning('Function keys are disabled during the quiz!');
                        return false;
                    }
                }
            });
        }

        function handleFullscreenChange() {
            if (quizActive && !document.querySelector('.results').classList.contains('active')) {
                if (!isFullscreen()) {
                    showWarning('🚫 Quiz terminated! You exited fullscreen mode.');
                    setTimeout(() => {
                        endQuizDueToViolation();
                    }, 2000);
                }
            }
        }

        function endQuizDueToViolation() {
            quizActive = false;
            monitoringActive = false;
            if (timerInterval) clearInterval(timerInterval);
            if (faceDetectionInterval) clearInterval(faceDetectionInterval);
            submitQuiz();
        }

        // Email Validation
        function validateEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }

        // Timer Functions
        function startTimer() {
            updateTimerDisplay();
            timerInterval = setInterval(() => {
                timeLimit--;
                updateTimerDisplay();
                
                if (timeLimit <= 0) {
                    showWarning('⏰ Time\'s up! Submitting your quiz automatically.');
                    setTimeout(() => {
                        endQuizDueToViolation();
                    }, 2000);
                }
            }, 1000);
        }

        function updateTimerDisplay() {
            const minutes = Math.floor(timeLimit / 60);
            const seconds = timeLimit % 60;
            document.getElementById('timeLeft').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Load Question
        function loadQuestion() {
            const q = questions[currentQuestion];
            document.getElementById('qNumber').textContent = currentQuestion + 1;
            document.getElementById('currentQ').textContent = currentQuestion + 1;
            document.getElementById('questionText').textContent = q.question;

            const optionsContainer = document.getElementById('optionsContainer');
            optionsContainer.innerHTML = '';

            q.options.forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'option';
                if (answers[currentQuestion] === index) {
                    optionDiv.classList.add('selected');
                }

                optionDiv.innerHTML = `
                    <input type="radio" name="question${currentQuestion}" value="${index}" 
                           ${answers[currentQuestion] === index ? 'checked' : ''}>
                    <label>${option}</label>
                `;

                optionDiv.addEventListener('click', () => selectAnswer(index));
                optionsContainer.appendChild(optionDiv);
            });

            updateNavigation();
        }

        // Select Answer
        function selectAnswer(answerIndex) {
            answers[currentQuestion] = answerIndex;
            
            document.querySelectorAll('.option').forEach((option, index) => {
                option.classList.toggle('selected', index === answerIndex);
                option.querySelector('input').checked = index === answerIndex;
            });
        }

        // Navigation
        function nextQuestion() {
            if (currentQuestion < questions.length - 1) {
                currentQuestion++;
                loadQuestion();
            }
        }

        function previousQuestion() {
            if (currentQuestion > 0) {
                currentQuestion--;
                loadQuestion();
            }
        }

        function updateNavigation() {
            document.getElementById('prevBtn').disabled = currentQuestion === 0;
            
            if (currentQuestion === questions.length - 1) {
                document.getElementById('nextBtn').style.display = 'none';
                document.getElementById('submitBtn').style.display = 'inline-block';
            } else {
                document.getElementById('nextBtn').style.display = 'inline-block';
                document.getElementById('submitBtn').style.display = 'none';
            }
        }

        // Submit Quiz
        function submitQuiz() {
            quizActive = false;
            monitoringActive = false;
            
            if (timerInterval) clearInterval(timerInterval);
            if (faceDetectionInterval) clearInterval(faceDetectionInterval);

            const unanswered = answers.filter(answer => answer === null).length;
            
            if (unanswered > 0 && quizActive) {
                if (!confirm(`You have ${unanswered} unanswered questions. Are you sure you want to submit?`)) {
                    quizActive = true;
                    return;
                }
            }

            const score = calculateScore();
            const testEndTime = new Date();
            const duration = Math.round((testEndTime - testStartTime) / 1000 / 60);

            const submissionData = {
                name: studentInfo.name,
                rollNo: studentInfo.roll,
                email: studentInfo.email,
                score: score,
                totalQuestions: questions.length,
                percentage: Math.round((score / questions.length) * 100),
                duration: duration,
                startTime: testStartTime.toLocaleString(),
                endTime: testEndTime.toLocaleString(),
                answers: answers.join(','),
                aiViolations: faceLostWarnings + lookAwayCount,
                timestamp: new Date().toISOString()
            };

            sendToGoogleSheets(submissionData);
            showResults(score);
        }

        // Calculate Score
        function calculateScore() {
            let score = 0;
            answers.forEach((answer, index) => {
                if (answer === questions[index].correct) {
                    score++;
                }
            });
            return score;
        }

        // Show Results
        function showResults(score) {
            document.querySelector('.quiz-container').classList.remove('active');
            document.querySelector('.results').classList.add('active');
            document.getElementById('cameraContainer').classList.remove('active');

            const percentage = Math.round((score / questions.length) * 100);
            document.getElementById('finalScore').textContent = `${score}/${questions.length} (${percentage}%)`;

            let message = '';
            if (percentage >= 90) message = '🌟 Excellent! Outstanding performance!';
            else if (percentage >= 80) message = '👍 Great job! Well done!';
            else if (percentage >= 70) message = '👌 Good work! Keep it up!';
            else if (percentage >= 60) message = '📚 Pass! Consider reviewing the topics.';
            else message = '📖 Keep studying and try again!';

            document.getElementById('resultMessage').textContent = message;
        }

        // Send Data to Google Sheets
        function sendToGoogleSheets(data) {
            fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            }).catch(error => {
                console.log('Data prepared for Google Sheets:', data);
            });
        }

        // Security Functions
        function disableRightClick() {
            document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                if (quizActive) {
                    showWarning('🚫 Right-click is disabled during the test!');
                }
                return false;
            });
        }

        function preventTabSwitch() {
            let hidden, visibilityChange;
            
            if (typeof document.hidden !== "undefined") {
                hidden = "hidden";
                visibilityChange = "visibilitychange";
            } else if (typeof document.msHidden !== "undefined") {
                hidden = "msHidden";
                visibilityChange = "msvisibilitychange";
            } else if (typeof document.webkitHidden !== "undefined") {
                hidden = "webkitHidden";
                visibilityChange = "webkitvisibilitychange";
            }

            document.addEventListener(visibilityChange, function() {
                if (quizActive && document[hidden]) {
                    warningCount++;
                    if (warningCount >= 3) {
                        showWarning('🚫 Multiple tab switches detected. Test ended for security reasons.');
                        setTimeout(() => {
                            endQuizDueToViolation();
                        }, 3000);
                    } else {
                        showWarning(`⚠️ Warning ${warningCount}/3: Do not switch tabs during the test!`);
                    }
                }
            });

            window.addEventListener('blur', function() {
                if (quizActive) {
                    showWarning('⚠️ Focus lost! Please stay on the quiz page.');
                }
            });
        }

        function preventCopy() {
            document.addEventListener('keydown', function(e) {
                if (quizActive) {
                    if (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 65 || e.keyCode === 86 || e.keyCode === 88)) {
                        e.preventDefault();
                        showWarning('🚫 Copy/paste operations are not allowed!');
                        return false;
                    }
                    
                    if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && e.keyCode === 73)) {
                        e.preventDefault();
                        showWarning('🚫 Developer tools are not allowed during the test!');
                        return false;
                    }
                }
            });

            document.addEventListener('selectstart', function(e) {
                if (quizActive) {
                    e.preventDefault();
                }
            });
        }

        function detectDevTools() {
            let devtools = {open: false, orientation: null};
            const threshold = 160;

            setInterval(() => {
                if (quizActive) {
                    if (window.outerHeight - window.innerHeight > threshold || 
                        window.outerWidth - window.innerWidth > threshold) {
                        if (!devtools.open) {
                            devtools.open = true;
                            showWarning('🚫 Developer tools detected! This action has been logged.');
                            warningCount++;
                            if (warningCount >= 2) {
                                setTimeout(() => {
                                    endQuizDueToViolation();
                                }, 2000);
                            }
                        }
                    } else {
                        devtools.open = false;
                    }
                }
            }, 1000);
        }

        function showWarning(message) {
            document.getElementById('warningMessage').textContent = message;
            document.getElementById('warningOverlay').classList.add('active');
            
            setTimeout(() => {
                document.getElementById('warningOverlay').classList.remove('active');
            }, 3000);
        }

        // Prevent page refresh/close during test
        window.addEventListener('beforeunload', function(e) {
            if (quizActive) {
                const message = 'Are you sure you want to leave? Your test will be ended.';
                e.returnValue = message;
                return message;
            }
        });

        // Additional security - detect window resize
        window.addEventListener('resize', function() {
            if (quizActive) {
                setTimeout(() => {
                    if (!isFullscreen()) {
                        console.log('Window resize detected - checking fullscreen status');
                    }
                }, 100);
            }
        });

        // Console security
        console.log('%c🚫 STOP!', 'color: red; font-size: 50px; font-weight: bold;');
        console.log('%cThis is a secure AI-monitored quiz environment. Any attempts to cheat will result in immediate test termination.', 'color: red; font-size: 16px;');
        
        // Disable console methods
        if (typeof console !== 'undefined') {
            console.clear = () => {};
            console.log = () => {};
            console.warn = () => {};
            console.error = () => {};
        }