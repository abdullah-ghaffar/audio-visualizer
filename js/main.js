const audioFileInput = document.getElementById('audioFile');
const playBtn = document.getElementById('playBtn');
const letterSelect = document.getElementById('letterSelect');
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

const maskCanvas = document.createElement('canvas');
maskCanvas.width = canvas.width;
maskCanvas.height = canvas.height;
const maskCtx = maskCanvas.getContext('2d');

let audioContext;
let analyser;
let source;

const MAX_PARTICLES = 400;
const particles = [];

function createParticle(x, y, size, speed, pathIndex, color, alpha){
  return {x, y, size, speed, pathIndex, color, alpha};
}

function spawnParticle(pathPoints, avgAmp){
  if(particles.length >= MAX_PARTICLES) return;
  const idx = Math.floor(Math.random()*pathPoints.length);
  const pnt = pathPoints[idx];
  const offset = 5 + avgAmp/50;
  const x = pnt.x + (Math.random()-0.5)*offset;
  const y = pnt.y + (Math.random()-0.5)*offset;
  const size = Math.random()*3 + 2 + avgAmp/80;
  const speed = 0.5 + avgAmp/300;
  const alpha = Math.max(0.5, Math.min(1, avgAmp/150));
  const hue = Math.random()*30 + 30; // golden fire tone
  const color = `hsl(${hue},100%,50%)`;
  particles.push(createParticle(x,y,size,speed,idx,color,alpha));
}

playBtn.addEventListener('click', async () => {
  const file = audioFileInput.files[0];
  if (!file) return alert('Please upload an audio file.');
  const letter = letterSelect.value.toUpperCase();

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  await audioContext.resume();

  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  source.connect(analyser);
  analyser.connect(audioContext.destination);

  source.start();

  // Draw letter mask
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  const fontSize = canvas.height*0.9;
  maskCtx.font = `${fontSize}px Arial`;
  maskCtx.textAlign = 'center';
  maskCtx.textBaseline = 'middle';
  maskCtx.fillStyle = 'white';
  maskCtx.fillText(letter, maskCanvas.width/2, maskCanvas.height/2);

  // Extract letter interior path points
  pathPoints.length = 0;
  const imgData = maskCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height).data;
  for(let y=0; y<maskCanvas.height; y+=2){
    for(let x=0; x<maskCanvas.width; x+=2){
      const alpha = imgData[(y*maskCanvas.width + x)*4+3];
      if(alpha>128) pathPoints.push({x,y});
    }
  }

  visualize();
});

const pathPoints = [];
let snakeIndex = 0;

function visualize(){
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw(){
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const avgAmp = dataArray.reduce((a,b)=>a+b,0)/dataArray.length;
    const now = performance.now()/500;

    // --- Snake / particle flow ---
    for(let i=0;i<3;i++) spawnParticle(pathPoints, avgAmp);
    for(let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      const nextIdx = (p.pathIndex+1)%pathPoints.length;
      const nextP = pathPoints[nextIdx];
      p.x += (nextP.x - p.x)*p.speed;
      p.y += (nextP.y - p.y)*p.speed;
      p.alpha -= 0.003;
      if(p.alpha<=0){particles.splice(i,1); continue;}
      const gradient = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);
      gradient.addColorStop(0,p.color.replace(')',`,${p.alpha})`));
      gradient.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fill();
      p.pathIndex = nextIdx;
    }

    // --- Beat-synced bars / waves layers ---
    const barCount = 60;
    const letterLeft = canvas.width*0.05;
    const letterRight = canvas.width*0.95;
    const letterTop = canvas.height*0.05;
    const letterBottom = canvas.height*0.95;
    const letterWidth = letterRight-letterLeft;
    const letterHeight = letterBottom-letterTop;

    // First layer: bottom -> top
    for(let i=0;i<barCount;i++){
      const freqIdx = Math.floor(i*(bufferLength/barCount));
      const amp = dataArray[freqIdx]/255;
      const x = letterLeft + (i/barCount)*letterWidth;
      const barHeight = amp*letterHeight;
      ctx.fillStyle = `hsla(${50+amp*50},100%,50%,0.7)`;
      ctx.fillRect(x,letterBottom-barHeight,letterWidth/barCount*0.8,barHeight);
    }

    // Second layer: top -> bottom (opposite flow)
    for(let i=0;i<barCount;i++){
      const freqIdx = Math.floor(i*(bufferLength/barCount));
      const amp = dataArray[freqIdx]/255;
      const x = letterLeft + (i/barCount)*letterWidth;
      const barHeight = amp*letterHeight*0.8; // slightly smaller
      ctx.fillStyle = `hsla(${30+amp*50},100%,50%,0.5)`; // color offset
      ctx.fillRect(x,letterTop,letterWidth/barCount*0.8,barHeight);
    }

    // --- Apply letter mask ---
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas,0,0);
    ctx.restore();
  }

  draw();
}
