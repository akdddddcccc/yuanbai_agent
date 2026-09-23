import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Microphone } from "@phosphor-icons/react";
import { YuanbaiScene } from "./YuanbaiScene";

const PHASE_COPY = {
  idle: ["在这里，慢慢说", "按住下方按钮，松开发送"],
  listening: ["我在听", "松开后，我会认真想一想"],
  thinking: ["正在组织语言", "正在识别、思考并生成声音"],
  speaking: ["元白正在回答", "灯光会跟着语气明暗起伏"],
};

const INTRO = "我会记得发生在这里的事，也会像一个熟悉校园的老朋友那样和你聊天。";
// 本地 Python 服务使用 /api/chat；发布到共享域名的 /yuanbai/ 后自动切换到 EdgeOne 函数。
const API_CHAT_URL = import.meta.env.VITE_YUANBAI_API_URL || (
  globalThis.location?.pathname?.startsWith("/yuanbai/") ? "/api/yuanbai/chat" : "/api/chat"
);

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("录音读取失败"));
    reader.readAsDataURL(blob);
  });
}

function preferredMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function App() {
  // 四个阶段同时控制文字、按钮、楼体动画：idle → listening → thinking → speaking。
  const [phase, setPhase] = useState("idle");
  // level 是实时声音能量（0~1），会传给 Three.js，驱动灯光和体块爆发。
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    document.title = "对话元白 · YUANBAI";
  }, []);

  const mediaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(0);
  const timerRef = useRef(0);
  const startedAtRef = useRef(0);
  const responseRef = useRef(null);
  const responseObjectUrlRef = useRef("");
  const historyRef = useRef([]);
  const pressedRef = useRef(false);
  const sessionIdRef = useRef(
    globalThis.crypto?.randomUUID?.() || `yuanbai-${Date.now()}`,
  );

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    analyserRef.current?.disconnect?.();
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const meter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let energy = 0;
    for (const value of data) {
      const sample = (value - 128) / 128;
      energy += sample * sample;
    }
    // 7.5 是声音可视化灵敏度；调高后，小声说话也会产生更明显的灯光和位移。
    setLevel(Math.min(1, Math.max(0, Math.sqrt(energy / data.length) * 7.5)));
    animationRef.current = requestAnimationFrame(meter);
  }, []);

  const connectMeter = useCallback((source, context, audible = false) => {
    stopMeter();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    if (audible) analyser.connect(context.destination);
    analyserRef.current = analyser;
    meter();
  }, [meter, stopMeter]);

  const playWaitingChime = useCallback(async () => {
    const context = await ensureAudioContext();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.1);
    gain.connect(context.destination);
    [392, 523.25].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.16);
      oscillator.stop(context.currentTime + 1.15);
    });
  }, [ensureAudioContext]);

  const playResponse = useCallback(async (audioUrl, revokeAfterPlay = false) => {
    if (responseObjectUrlRef.current) {
      URL.revokeObjectURL(responseObjectUrlRef.current);
      responseObjectUrlRef.current = "";
    }
    if (revokeAfterPlay) responseObjectUrlRef.current = audioUrl;
    const audio = new Audio(audioUrl);
    responseRef.current = audio;
    const context = await ensureAudioContext();
    const source = context.createMediaElementSource(audio);
    connectMeter(source, context, true);
    audio.addEventListener("ended", () => {
      stopMeter();
      if (responseObjectUrlRef.current === audioUrl) {
        URL.revokeObjectURL(audioUrl);
        responseObjectUrlRef.current = "";
      }
      setPhase("idle");
    }, { once: true });
    audio.addEventListener("error", () => {
      stopMeter();
      setErrorMessage("声音加载失败，请再试一次。");
      setPhase("idle");
    }, { once: true });
    setPhase("speaking");
    await audio.play();
  }, [connectMeter, ensureAudioContext, stopMeter]);

  const submitRecording = useCallback(async (blob) => {
    try {
      if (blob.size < 800) throw new Error("录音太短了，请多说一点。 ");
      const audioBase64 = await blobToBase64(blob);
      // 浏览器只上传录音和最近四轮对话。API 密钥始终留在服务端函数中。
      const response = await fetch(API_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_base64: audioBase64,
          mime_type: blob.type || "audio/webm",
          session_id: sessionIdRef.current,
          history: historyRef.current,
        }),
      });
      // 先读取文本再解析，避免网关返回空响应时只看到“Unexpected end of JSON input”。
      const rawResponse = await response.text();
      let result;
      try {
        result = rawResponse ? JSON.parse(rawResponse) : null;
      } catch {
        throw new Error(`语音服务返回了无法识别的响应（HTTP ${response.status}）。`);
      }
      if (!result) {
        throw new Error(`语音服务没有返回内容（HTTP ${response.status}），请稍后重试。`);
      }
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "这次没有回答成功，请再试一次。");
      }
      setTranscript(result.transcript || "");
      setAnswer(result.answer || "");
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: result.transcript || "" },
        { role: "assistant", content: result.answer || "" },
      ].filter((message) => message.content).slice(-8);

      // 公网函数返回 base64，生成同源 Blob 后 WebAudio 才能稳定读取音量。
      // 本地 Python 仍可返回 audio_url，两种方式共用同一套前端。
      if (result.audio_base64) {
        const binary = atob(result.audio_base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const audioUrl = URL.createObjectURL(new Blob([bytes], { type: result.audio_mime_type || "audio/mpeg" }));
        await playResponse(audioUrl, true);
      } else if (result.audio_url) {
        await playResponse(result.audio_url);
      } else {
        throw new Error("回答已经生成，但没有收到声音文件。");
      }
    } catch (error) {
      setErrorMessage(error?.message || "这次没有回答成功，请再试一次。");
      stopMeter();
      setPhase("idle");
    }
  }, [playResponse, stopMeter]);

  const startListening = useCallback(async (event) => {
    event.preventDefault();
    if (phase !== "idle") return;
    pressedRef.current = true;
    setErrorMessage("");
    setTranscript("");
    event.currentTarget.setPointerCapture?.(event.pointerId);

    try {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
        throw new Error("当前浏览器不能录音，请使用最新版 Chrome 或 Edge。");
      }
      responseRef.current?.pause();
      // 这里可调整录音约束；回声消除和降噪适合展厅、教室等有外放的环境。
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      if (!pressedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaRef.current = stream;
      const context = await ensureAudioContext();
      connectMeter(context.createMediaStreamSource(stream), context, false);

      const mimeType = preferredMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (dataEvent) => {
        if (dataEvent.data.size) chunksRef.current.push(dataEvent.data);
      });
      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        chunksRef.current = [];
        submitRecording(blob);
      }, { once: true });
      recorder.start(200);

      startedAtRef.current = performance.now();
      setElapsed(0);
      setPhase("listening");
      timerRef.current = window.setInterval(() => {
        setElapsed((performance.now() - startedAtRef.current) / 1000);
      }, 100);
    } catch (error) {
      pressedRef.current = false;
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      mediaRef.current = null;
      stopMeter();
      setErrorMessage(error?.message || "无法使用麦克风，请检查浏览器权限。");
      setPhase("idle");
    }
  }, [connectMeter, ensureAudioContext, phase, stopMeter, submitRecording]);

  const stopListening = useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    window.clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      mediaRef.current?.getTracks().forEach((track) => track.stop());
      mediaRef.current = null;
      setErrorMessage("请按住按钮，看到“正在聆听”后再松开。");
      return;
    }
    setPhase("thinking");
    playWaitingChime().catch(() => {});
    recorder.stop();
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    recorderRef.current = null;
    stopMeter();
  }, [playWaitingChime, stopMeter]);

  useEffect(() => () => {
    window.clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    responseRef.current?.pause();
    if (responseObjectUrlRef.current) URL.revokeObjectURL(responseObjectUrlRef.current);
    audioContextRef.current?.close();
  }, []);

  const bars = useMemo(() => Array.from({ length: 29 }, (_, index) => ({
    index,
    height: `${8 + (14 - Math.abs(14 - index)) * 1.5}px`,
  })), []);
  const [headline, defaultSubline] = PHASE_COPY[phase];
  const visibleAnswer = answer || INTRO;
  const subline = errorMessage || (transcript ? `你刚才说：${transcript}` : defaultSubline);
  const buttonTitle = phase === "listening" ? `正在聆听 ${elapsed.toFixed(1)}s` : (
    phase === "thinking" ? "正在生成回答" : phase === "speaking" ? "元白正在说话" : "按住说话"
  );

  return (
    <main className={`experience phase-${phase}`}>
      <header className="brand">YUANBAI / 元白</header>
      <a className="back-to-portal" href={import.meta.env.BASE_URL}>
        <ArrowLeft size={14} weight="bold" />
        <span>返回元白工作台</span>
      </a>
      <section className="copy-panel" aria-live="polite">
        <div className="status-row">
          <span className="status-dot" />
          <span>{headline}</span>
        </div>
        <h1>一座会回应你的楼</h1>
        <p className="answer">{visibleAnswer}</p>
        <p className={`subline${errorMessage ? " is-error" : ""}`}>{subline}</p>
      </section>

      <section className="scene-panel" aria-label="元白楼语音交互形象">
        <YuanbaiScene phase={phase} level={level} />
        <div className="scene-caption">
          <span>VOICE ARCHITECTURE · 01</span>
          <span>{phase === "thinking" ? "PARTICLE MEMORY" : "12 LIVING MASSES · 5 LINKS"}</span>
        </div>
      </section>

      <button
        className="hold-button"
        type="button"
        onPointerDown={startListening}
        onPointerUp={stopListening}
        onPointerCancel={stopListening}
        onContextMenu={(event) => event.preventDefault()}
        disabled={phase === "thinking" || phase === "speaking"}
        aria-pressed={phase === "listening"}
        aria-label="按住说话，松开发送"
      >
        <span className="mic-disc"><Microphone size={20} weight="fill" /></span>
        <span className="hold-label">
          <strong>{buttonTitle}</strong>
          <small>{phase === "listening" ? "松开发送" : "PRESS & HOLD"}</small>
        </span>
        <span className="waveform" aria-hidden="true">
          {bars.map(({ index, height }) => (
            <i key={index} style={{ "--i": index, "--h": height, "--level": level }} />
          ))}
        </span>
      </button>

      <footer>
        <span>建筑记忆正在生长</span>
        <span>01 · 2026</span>
      </footer>
    </main>
  );
}
