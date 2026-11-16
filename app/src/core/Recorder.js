// Screenshots, video recording and file downloads.

export function download(blob, filename) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestamp() {
	return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// Saves the canvas as a PNG. Call it right after rendering, in the same task, because the
// WebGL drawing buffer is cleared once the browser shows the frame.
export function screenshot(canvas, name = 'inkwell') {
	canvas.toBlob((blob) => download(blob, `${name}-${timestamp()}.png`), 'image/png');
}

// Records the canvas to a video file with MediaRecorder.
export class VideoRecorder {
	constructor(canvas) {
		this.canvas = canvas;
		this.recorder = null;
		this.chunks = [];
	}

	get recording() {
		return this.recorder !== null;
	}

	start(fps = 60) {
		const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
		const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
		if (!mimeType) throw new Error('This browser cannot record video');
		this.chunks = [];
		this.recorder = new MediaRecorder(this.canvas.captureStream(fps), { mimeType, videoBitsPerSecond: 20e6 });
		this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
		this.recorder.start();
		this.mimeType = mimeType;
	}

	stop(name = 'inkwell') {
		if (!this.recorder) return;
		const recorder = this.recorder;
		this.recorder = null;
		recorder.onstop = () => {
			const ext = this.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
			download(new Blob(this.chunks, { type: this.mimeType }), `${name}-${timestamp()}.${ext}`);
		};
		recorder.stop();
	}
}
