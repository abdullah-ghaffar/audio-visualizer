const audioFileInput = document.getElementById('audioFile');
const playBtn = document.getElementById('playBtn');
const letterSelect = document.getElementById('letterSelect');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

let audioContext;
let analyser;
let source;

playBtn.addEventListener('click', async () => {
  const file = audioFileInput.files[0];
  if (!file) return alert('Please upload an audio file.');

  const letter = letterSelect.value.toUpperCase();

  // Create AudioContext
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume(); // ensure context running

  // Decode audio
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create source and analyser
  source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;

  source.connect(analyser);
  analyser.connect(audioContext.destination);

  source.start();

  visualize(letter);
});

function visualize(letter) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Map letters A-Z to spectrum bins
  const totalLetters = 26;
  const letterIndex = letter.charCodeAt(0) - 65;
  const binsPerLetter = bufferLength / totalLetters;
  const startBin = Math.floor(letterIndex * binsPerLetter);
  const endBin = Math.floor((letterIndex + 1) * binsPerLetter);

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw letter outline first
    ctx.save();
    ctx.font = `${canvas.height * 0.8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2);

    // Set clipping mask to letter
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2);

    // Reset to normal for drawing bars
    ctx.globalCompositeOperation = 'source-over';

    // Draw bars inside letter shape
    const selectedBins = dataArray.slice(startBin, endBin);
    const barWidth = canvas.width / selectedBins.length;
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#00ffd5');
    gradient.addColorStop(0.5, '#6a0dad');
    gradient.addColorStop(1, '#ffb347');
    ctx.fillStyle = gradient;

    let x = 0;
    for (let i = 0; i < selectedBins.length; i++) {
      const barHeight = (selectedBins[i] / 255) * canvas.height * 0.8;
      ctx.fillRect(x, canvas.height - barHeight, barWidth * 0.9, barHeight);
      x += barWidth;
    }

    ctx.restore();
  }

  draw();
}
