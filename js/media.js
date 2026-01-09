/**
 * Media Module
 * Handles image and audio processing
 */

const Media = (function() {
    let mediaRecorder = null;
    let audioChunks = [];
    let currentRecordingSide = null;
    let currentAudio = null;

    // Configuration
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_IMAGE_DIMENSION = 1200;
    const IMAGE_QUALITY = 0.85;

    const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const SUPPORTED_AUDIO_TYPES = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav'];

    /**
     * Process an image file for storage
     */
    async function processImage(file, options = {}) {
        const maxWidth = options.maxWidth || MAX_IMAGE_DIMENSION;
        const maxHeight = options.maxHeight || MAX_IMAGE_DIMENSION;
        const quality = options.quality || IMAGE_QUALITY;

        // Validate file
        const validation = validateFile(file, 'image');
        if (!validation.valid) {
            throw new MediaError(validation.error, 'format');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    // Calculate new dimensions
                    let { width, height } = img;

                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    // Create canvas and draw resized image
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to data URL
                    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                    const dataUrl = canvas.toDataURL(mimeType, quality);

                    resolve({
                        id: generateId(),
                        mimeType: mimeType,
                        data: dataUrl,
                        filename: file.name,
                        size: Math.round(dataUrl.length * 0.75), // Approximate decoded size
                        width: width,
                        height: height
                    });
                };

                img.onerror = () => {
                    reject(new MediaError('Failed to load image', 'format'));
                };

                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new MediaError('Failed to read file', 'format'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Start audio recording
     */
    async function startRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            throw new MediaError('Already recording', 'recording');
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: getSupportedMimeType()
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.start();
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                throw new MediaError('Microphone access denied', 'permission');
            }
            throw new MediaError('Failed to start recording: ' + error.message, 'recording');
        }
    }

    /**
     * Stop recording and return the audio attachment
     */
    async function stopRecording() {
        if (!mediaRecorder || mediaRecorder.state !== 'recording') {
            throw new MediaError('Not recording', 'recording');
        }

        return new Promise((resolve, reject) => {
            mediaRecorder.onstop = async () => {
                try {
                    const mimeType = mediaRecorder.mimeType;
                    const blob = new Blob(audioChunks, { type: mimeType });

                    // Check size
                    if (blob.size > MAX_AUDIO_SIZE) {
                        reject(new MediaError('Recording too large (max 10MB)', 'size'));
                        return;
                    }

                    // Convert to data URL
                    const dataUrl = await blobToDataUrl(blob);

                    // Get duration
                    const duration = await getAudioDuration(dataUrl);

                    // Stop all tracks
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                    mediaRecorder = null;
                    audioChunks = [];

                    resolve({
                        id: generateId(),
                        mimeType: mimeType,
                        data: dataUrl,
                        size: blob.size,
                        duration: duration
                    });
                } catch (error) {
                    reject(error);
                }
            };

            mediaRecorder.stop();
        });
    }

    /**
     * Check if currently recording
     */
    function isRecording() {
        return mediaRecorder && mediaRecorder.state === 'recording';
    }

    /**
     * Cancel current recording
     */
    function cancelRecording() {
        if (mediaRecorder) {
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            mediaRecorder = null;
            audioChunks = [];
        }
    }

    /**
     * Play audio from a data URI
     */
    function playAudio(dataUri) {
        return new Promise((resolve, reject) => {
            stopAudio(); // Stop any currently playing audio

            currentAudio = new Audio(dataUri);

            currentAudio.onended = () => {
                currentAudio = null;
                resolve();
            };

            currentAudio.onerror = () => {
                currentAudio = null;
                reject(new MediaError('Failed to play audio', 'format'));
            };

            currentAudio.play().catch(error => {
                currentAudio = null;
                reject(new MediaError('Failed to play audio: ' + error.message, 'format'));
            });
        });
    }

    /**
     * Stop current audio playback
     */
    function stopAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
    }

    /**
     * Validate a file for upload
     */
    function validateFile(file, type) {
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }

        if (type === 'image') {
            if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
                return { valid: false, error: 'Unsupported image format. Use JPEG, PNG, GIF, or WebP.' };
            }
            if (file.size > MAX_IMAGE_SIZE) {
                return { valid: false, error: 'Image too large. Maximum size is 5MB.' };
            }
        } else if (type === 'audio') {
            if (!SUPPORTED_AUDIO_TYPES.some(t => file.type.includes(t.split('/')[1]))) {
                return { valid: false, error: 'Unsupported audio format. Use MP3, WAV, OGG, or WebM.' };
            }
            if (file.size > MAX_AUDIO_SIZE) {
                return { valid: false, error: 'Audio too large. Maximum size is 10MB.' };
            }
        }

        return { valid: true };
    }

    /**
     * Process an audio file for storage
     */
    async function processAudio(file) {
        const validation = validateFile(file, 'audio');
        if (!validation.valid) {
            throw new MediaError(validation.error, 'format');
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const dataUrl = e.target.result;
                    const duration = await getAudioDuration(dataUrl);

                    resolve({
                        id: generateId(),
                        mimeType: file.type,
                        data: dataUrl,
                        filename: file.name,
                        size: file.size,
                        duration: duration
                    });
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new MediaError('Failed to read audio file', 'format'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Get audio duration from data URL
     */
    function getAudioDuration(dataUrl) {
        return new Promise((resolve) => {
            const audio = new Audio(dataUrl);
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
            };
            audio.onerror = () => {
                resolve(0); // Return 0 if can't determine duration
            };
        });
    }

    /**
     * Convert blob to data URL
     */
    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new MediaError('Failed to convert blob', 'format'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Get supported mime type for recording
     */
    function getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'audio/webm';
    }

    /**
     * Generate unique ID
     */
    function generateId() {
        return 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Handle image upload from file input
     */
    function addImage(side) {
        currentRecordingSide = side;
        const input = document.getElementById('image-file');
        input.onclick = null;
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const attachment = await processImage(file);
                    App.addMediaToCard(currentRecordingSide, 'image', attachment);
                } catch (error) {
                    App.showNotification(error.message, 'error');
                }
            }
            input.value = '';
        };
        input.click();
    }

    /**
     * Handle audio upload from file input
     */
    function addAudio(side) {
        currentRecordingSide = side;
        const input = document.getElementById('audio-file');
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const attachment = await processAudio(file);
                    App.addMediaToCard(currentRecordingSide, 'audio', attachment);
                } catch (error) {
                    App.showNotification(error.message, 'error');
                }
            }
            input.value = '';
        };
        input.click();
    }

    /**
     * Toggle recording for a side
     */
    async function toggleRecording(side) {
        if (isRecording()) {
            try {
                const attachment = await stopRecording();
                App.addMediaToCard(currentRecordingSide, 'audio', attachment);
                updateRecordingUI(currentRecordingSide, false);
                currentRecordingSide = null;
            } catch (error) {
                App.showNotification(error.message, 'error');
                cancelRecording();
                updateRecordingUI(currentRecordingSide, false);
                currentRecordingSide = null;
            }
        } else {
            try {
                currentRecordingSide = side;
                await startRecording();
                updateRecordingUI(side, true);
            } catch (error) {
                App.showNotification(error.message, 'error');
                currentRecordingSide = null;
            }
        }
    }

    /**
     * Update recording button UI
     */
    function updateRecordingUI(side, isRecording) {
        const btn = document.getElementById(`record-${side}-btn`);
        if (btn) {
            if (isRecording) {
                btn.classList.add('recording');
                btn.style.color = 'var(--color-danger)';
            } else {
                btn.classList.remove('recording');
                btn.style.color = '';
            }
        }
    }

    // Custom error class
    class MediaError extends Error {
        constructor(message, type) {
            super(message);
            this.name = 'MediaError';
            this.type = type;
        }
    }

    return {
        processImage,
        processAudio,
        startRecording,
        stopRecording,
        cancelRecording,
        isRecording,
        playAudio,
        stopAudio,
        validateFile,
        addImage,
        addAudio,
        toggleRecording,
        MediaError
    };
})();
