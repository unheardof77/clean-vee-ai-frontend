// Handles microphone, STT, AI, and TTS integration
const recordBtn = document.getElementById('record-btn');
const statusDiv = document.getElementById('status');
const transcriptDiv = document.getElementById('transcript');
const aiResponseDiv = document.getElementById('ai-response');
const audioPlayer = document.getElementById('audio-player');

let mediaRecorder;
let audioChunks = [];


// API Gateway base URL (relative path, works for both HTTP and HTTPS)
const API_GATEWAY_URL = '/ask';

// Helper: Send audio blob to API gateway for full pipeline (STT + AI + TTS)
async function sendAudioToGateway(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'speech.wav');
  statusDiv.textContent = 'Processing...';
  // Request both text and audio response
  const res = await fetch(`${API_GATEWAY_URL}?audio=true`, {
    method: 'POST',
    body: formData
  });
  if (res.headers.get('content-type').includes('application/json')) {
    // Error or text-only response
    const data = await res.json();
    return { transcript: data.text || '', aiResponse: data.response || '', audioBlob: null };
  } else {
    // Audio response (WAV)
    const audioBlob = await res.blob();
    // We need to get the transcript and AI response separately
    // So, send again without audio param to get text
    const textRes = await fetch(API_GATEWAY_URL, {
      method: 'POST',
      body: formData
    });
    const textData = await textRes.json();
    return { transcript: textData.text || '', aiResponse: textData.response || '', audioBlob };
  }
}

// Play audio from blob
function playAudio(blob) {
  const url = URL.createObjectURL(blob);
  audioPlayer.src = url;
  audioPlayer.style.display = 'block';
  audioPlayer.play();
}

// Main record/stop logic

recordBtn.onclick = async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    recordBtn.textContent = '🎤 Start Talking';
    statusDiv.textContent = 'Processing...';
    return;
  }
  // Start recording
  audioChunks = [];
  statusDiv.textContent = 'Listening...';
  recordBtn.textContent = '⏹️ Stop';
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        // Send audio to API gateway for full pipeline
        const { transcript, aiResponse, audioBlob: ttsAudio } = await sendAudioToGateway(audioBlob);
        transcriptDiv.textContent = transcript;
        aiResponseDiv.textContent = aiResponse;
        if (ttsAudio) playAudio(ttsAudio);
        statusDiv.textContent = 'Ready.';
      };
    })
    .catch(err => {
      statusDiv.textContent = 'Microphone access denied.';
    });
};

// Optionally, auto-start recording on page load
// recordBtn.click();
