document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('doodleArea');

    if (!canvas || !canvas.getContext) {
        console.error("错误：找不到 ID 为 'doodleArea' 的 canvas 元素，或者浏览器不支持 getContext。绘图功能将不可用。");
        // 可以考虑在此处向用户显示一个更友好的消息，或者禁用相关按钮
        const controls = document.querySelector('.controls');
        const actions = document.querySelector('.action-buttons');
        if(controls) controls.style.display = 'none';
        if(actions) actions.style.display = 'none';
        const h1 = document.querySelector('h1');
        if(h1) {
            const errorMsg = document.createElement('p');
            errorMsg.textContent = "抱歉，绘图区域未能加载，相关功能已禁用。请确保您的浏览器支持HTML5 Canvas。";
            errorMsg.style.color = 'red';
            errorMsg.style.fontWeight = 'bold';
            h1.insertAdjacentElement('afterend', errorMsg);
        }
        return; // 终止脚本执行
    }

    const ctx = canvas.getContext('2d');
    const playSoundButton = document.getElementById('playSoundButton');
    const clearButton = document.getElementById('clearButton');
    const colorBrushes = document.querySelectorAll('.color-brush');
    const brushSizeInput = document.getElementById('brushSize');

    let isDrawing = false;
    let currentColor = 'black';
    let currentBrushSize = 5;
    let audioContext;

    function initAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error("Web Audio API is not supported in this browser.", e);
                alert("您的浏览器不支持 Web Audio API，无法播放声音。");
                return;
            }
        }
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(err => console.error("Error resuming AudioContext:", err));
        }
    }
    
    function handleFirstInteraction() {
        initAudioContext();
        document.body.removeEventListener('click', handleFirstInteraction);
        document.body.removeEventListener('touchstart', handleFirstInteraction);
        canvas.removeEventListener('mousedown', handleFirstInteraction);
        canvas.removeEventListener('touchstart', handleFirstInteraction);
    }

    document.body.addEventListener('click', handleFirstInteraction, { once: true });
    document.body.addEventListener('touchstart', handleFirstInteraction, { once: true });
    canvas.addEventListener('mousedown', handleFirstInteraction, { once: true });
    canvas.addEventListener('touchstart', handleFirstInteraction, { once: true });

    colorBrushes.forEach(brush => {
        brush.addEventListener('click', (e) => {
            currentColor = e.currentTarget.dataset.color;
            colorBrushes.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    if (colorBrushes.length > 0) {
        colorBrushes[0].classList.add('active');
        currentColor = colorBrushes[0].dataset.color;
    }

    brushSizeInput.addEventListener('input', (e) => {
        currentBrushSize = parseInt(e.target.value, 10);
    });

    function getRelativePos(canvasDom, event) {
        const rect = canvasDom.getBoundingClientRect();
        let clientX, clientY;
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        isDrawing = true;
        const pos = getRelativePos(canvas, e);
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);

        ctx.fillStyle = currentColor;
        ctx.arc(pos.x, pos.y, currentBrushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);

        if (e.cancelable !== false && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
    }

    function drawOnCanvas(e) {
        if (!isDrawing) return;
        const pos = getRelativePos(canvas, e);
        
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentBrushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        if (e.cancelable !== false && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', drawOnCanvas);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', drawOnCanvas, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);

    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    playSoundButton.addEventListener('click', () => {
        if (!audioContext || audioContext.state !== 'running') {
             if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log("AudioContext resumed for playback.");
                    processAndPlaySound();
                }).catch(err => {
                    alert("无法自动播放声音，请先在页面上进行一次点击或触摸操作。");
                    console.error("Error resuming AudioContext for playback:", err);
                });
                return;
            }
            alert("音频系统未准备好。请先在页面上进行一次点击或触摸操作以激活音频（比如点一下颜色按钮）。");
            return;
        }
        processAndPlaySound();
    });

    function processAndPlaySound() {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const durationPerColumn = 0.025;
        const baseFrequency = 80;
        const maxFrequency = 1200;

        const colorToTimbre = {
            'red': 'sine', 'blue': 'square', 'green': 'sawtooth',
            'yellow': 'triangle', 'black': 'sine' 
        };
        const notes = [];

        for (let x = 0; x < canvas.width; x++) {
            for (let y = 0; y < canvas.height; y++) {
                const index = (y * canvas.width + x) * 4;
                const r = data[index], g = data[index+1], b = data[index+2], a = data[index+3];

                if (a > 128) {
                    let pixelColor = null;
                    if (r > 200 && g < 100 && b < 100) pixelColor = 'red';
                    else if (r < 100 && g < 100 && b > 200) pixelColor = 'blue';
                    else if (r < 100 && g > 200 && b < 100) pixelColor = 'green';
                    else if (r > 200 && g > 200 && b < 100) pixelColor = 'yellow';
                    else if (r < 50 && g < 50 && b < 50 && a > 200) pixelColor = 'black';

                    if (pixelColor) {
                        const frequency = baseFrequency + ((canvas.height - 1 - y) / (canvas.height - 1)) * (maxFrequency - baseFrequency);
                        notes.push({ 
                            frequency, 
                            type: colorToTimbre[pixelColor] || 'sine', 
                            startTime: x * durationPerColumn 
                        });
                    }
                }
            }
        }
        
        if (notes.length === 0) {
            console.log("画布上没有内容可以转换为声音。");
            return;
        }

        const notePlayDuration = 0.1;
        notes.forEach(note => {
            if (!audioContext) return;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.type = note.type;
            oscillator.frequency.setValueAtTime(note.frequency, audioContext.currentTime + note.startTime);
            
            gainNode.gain.setValueAtTime(0.001, audioContext.currentTime + note.startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + note.startTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + note.startTime + notePlayDuration);

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.start(audioContext.currentTime + note.startTime);
            oscillator.stop(audioContext.currentTime + note.startTime + notePlayDuration + 0.05);
        });
    }
});