
        // Quiz Questions Database
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

        // Google Sheets Web App URL - REPLACE WITH YOUR ACTUAL URL
        const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxJ_aTBGvd4NKJAp2TcRzTHeudLTzpR9G69szmGAUfMNQT_xVZf8SbOn9GcRWVl0WdFSQ/exec';

        // Initialize
        window.addEventListener('load', function() {
            // Initialize answers array
            answers = new Array(questions.length).fill(null);
            
            // Set total questions
            document.getElementById('totalQ').textContent = questions.length;
            
            // Setup security features
            disableRightClick();
            preventTabSwitch();
            preventCopy();
            detectDevTools();
            setupFullscreenMonitoring();
        });

        // Fullscreen Functions
        function enterFullscreen() {
            const elem = document.documentElement;
            
            const fullscreenPromise = elem.requestFullscreen?.() ||
                                    elem.webkitRequestFullscreen?.() ||
                                    elem.msRequestFullscreen?.() ||
                                    elem.mozRequestFullScreen?.();

            if (fullscreenPromise) {
                return fullscreenPromise.catch(err => {
                    console.log('Fullscreen request failed:', err);
                    showWarning('Please allow fullscreen mode to continue with the test.');
                    return Promise.reject(err);
                });
            } else {
                showWarning('Fullscreen mode is not supported on this browser.');
                return Promise.reject(new Error('Fullscreen not supported'));
            }
        }

        function exitFullscreen() {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }

        function isFullscreen() {
            return !!(document.fullscreenElement || 
                     document.webkitFullscreenElement || 
                     document.msFullscreenElement || 
                     document.mozFullScreenElement);
        }

        function setupFullscreenMonitoring() {
            // Listen for fullscreen change events
            document.addEventListener('fullscreenchange', handleFullscreenChange);
            document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.addEventListener('mozfullscreenchange', handleFullscreenChange);
            document.addEventListener('msfullscreenchange', handleFullscreenChange);

            // Prevent F11 and Escape keys during quiz
            document.addEventListener('keydown', function(e) {
                if (quizActive) {
                    if (e.key === 'F11') {
                        e.preventDefault();
                        showWarning('Please do not use F11! Use only the quiz interface.');
                        return false;
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        showWarning('Escape key is disabled during the quiz!');
                        return false;
                    }
                }
            });
        }

        function handleFullscreenChange() {
            console.log('Fullscreen change detected. Quiz active:', quizActive, 'Is fullscreen:', isFullscreen());
            
            // Only check if quiz is active and we're not in results phase
            if (quizActive && !document.querySelector('.results').classList.contains('active')) {
                if (!isFullscreen()) {
                    // User exited fullscreen during quiz - end test immediately
                    showWarning('🚫 Quiz terminated! You exited fullscreen mode.');
                    setTimeout(() => {
                        endQuizDueToViolation();
                    }, 2000);
                }
            }
        }

        function endQuizDueToViolation() {
            quizActive = false;
            if (timerInterval) {
                clearInterval(timerInterval);
            }
            submitQuiz();
        }

        // Start Quiz Function
        function startQuiz() {
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

            // Enter fullscreen mode first
            enterFullscreen().then(() => {
                // Only start quiz if fullscreen was successful
                setTimeout(() => {
                    if (isFullscreen()) {
                        quizActive = true;
                        document.querySelector('.student-form').classList.remove('active');
                        document.querySelector('.quiz-container').classList.add('active');
                        startTimer();
                        loadQuestion();
                    } else {
                        showWarning('Fullscreen mode is required to start the quiz!');
                    }
                }, 1000);
            }).catch(err => {
                console.error('Failed to enter fullscreen:', err);
                showWarning('Unable to enter fullscreen mode. Please try again or use a different browser.');
            });
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
            
            if (timerInterval) {
                clearInterval(timerInterval);
            }

            const unanswered = answers.filter(answer => answer === null).length;
            
            if (unanswered > 0 && quizActive) {
                if (!confirm(`You have ${unanswered} unanswered questions. Are you sure you want to submit?`)) {
                    quizActive = true;
                    return;
                }
            }

            const score = calculateScore();
            const testEndTime = new Date();
            const duration = Math.round((testEndTime - testStartTime) / 1000 / 60); // in minutes

            // Prepare data for Google Sheets
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
                timestamp: new Date().toISOString()
            };

            // Send to Google Sheets
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

            const percentage = Math.round((score / questions.length) * 100);
            document.getElementById('finalScore').textContent = `${score}/${questions.length} (${percentage}%)`;

            let message = '';
            if (percentage >= 90) message = '🌟 Excellent! Outstanding performance!';
            else if (percentage >= 80) message = '👏 Great job! Well done!';
            else if (percentage >= 70) message = '👍 Good work! Keep it up!';
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
                    // Prevent Ctrl+C, Ctrl+A, Ctrl+V, Ctrl+X, F12, Ctrl+Shift+I
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

        // Additional security - detect window resize (potential fullscreen exit)
        window.addEventListener('resize', function() {
            if (quizActive) {
                setTimeout(() => {
                    if (!isFullscreen()) {
                        console.log('Window resize detected - checking fullscreen status');
                        // This will be caught by fullscreen change event
                    }
                }, 100);
            }
        });

        // Console warning
        console.log('%c🚫 STOP!', 'color: red; font-size: 50px; font-weight: bold;');
        console.log('%cThis is a secure quiz environment. Any attempts to cheat will result in test termination.', 'color: red; font-size: 16px;');
        
        // Disable console
        if (typeof console !== 'undefined') {
            console.clear = () => {};
            console.log = () => {};
            console.warn = () => {};
            console.error = () => {};
        }