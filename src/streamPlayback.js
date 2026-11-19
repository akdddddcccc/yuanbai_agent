// Provider chunks may split both UTF-8 and a 16-bit audio sample.
export async function readVoiceStream(response, context, {signal, onText, onAnswer, onAudio}) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const chunks = [], active = new Set();
  const output = context.createGain();
  let next = 0, duration = 0, carry = -1, bytes = 0, buffer = "", text = "";
  let started = false, end, answer, connected = false, wake;
  const stop = () => {
    for (const node of active) { try { node.stop(); } catch {} }
    output.disconnect();
    reader.cancel().catch(() => {});
    wake?.();
  };
  signal.addEventListener("abort", stop, {once:true});
  function pcm(data) {
    const raw = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    if (!raw.length || (bytes += raw.length) > 24 * 1024 * 1024) throw new Error("声音数据无效");
    chunks.push(raw);
    let samples = raw;
    if (carry >= 0) { samples = new Uint8Array(raw.length + 1); samples[0] = carry; samples.set(raw, 1); }
    carry = samples.length % 2 ? samples[samples.length - 1] : -1;
    const count = samples.length >> 1;
    if (!count || context.state !== "running") return;
    const audio = context.createBuffer(1, count, 24000);
    const values = audio.getChannelData(0), view = new DataView(samples.buffer, samples.byteOffset);
    for (let i=0; i<count; i++) values[i] = view.getInt16(i*2, true) / 32768;
    const node = context.createBufferSource();
    node.buffer = audio; node.connect(output);
    if (!connected) { connected = true; onAudio(output, context); }
    next = Math.max(next, context.currentTime + 0.025);
    active.add(node);
    node.onended = () => { node.disconnect(); active.delete(node); if (!active.size) wake?.(); };
    node.start(next); next += audio.duration; duration += audio.duration;
  }
  try {
    while (!signal.aborted) {
      const part = await reader.read();
      buffer += part.done ? decoder.decode() : decoder.decode(part.value, {stream:true});
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const event = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        if (event.type === "start") {
          if (started || event.voice !== "longanhuan_v3.1" || event.rate !== 24000) throw new Error("语音配置尚未更新");
          started = true;
        } else if (!started || end) throw new Error("语音响应顺序异常");
        else if (event.type === "text") { text += event.text; onText(text); }
        else if (event.type === "answer") { answer = event; onAnswer(event); }
        else if (event.type === "pcm") pcm(event.data);
        else if (event.type === "end") end = event;
        else if (event.type === "error") throw new Error(event.message);
      }
      if (buffer.length > 524288) throw new Error("声音数据过大");
      if (part.done) break;
    }
    if (signal.aborted) throw new DOMException("已停止", "AbortError");
    if (!answer || !end || buffer.trim()) throw new Error("回复中断，已收到的文字保留");
    if (!end.audio || !bytes || carry >= 0) throw new Error("声音未完整返回，文字回答已保留");
    const header = new ArrayBuffer(44), view = new DataView(header);
    for (const [at, label] of [[0,"RIFF"],[8,"WAVEfmt "],[36,"data"]])
      for (let i=0;i<label.length;i++) view.setUint8(at+i,label.charCodeAt(i));
    for (const [i,v] of [[4,bytes+36],[16,16],[24,24000],[28,48000],[40,bytes]]) view.setUint32(i,v,true);
    for (const [i,v] of [[20,1],[22,1],[32,2],[34,16]]) view.setUint16(i,v,true);
    let blocked = Math.abs(duration - bytes/48000) > .001 || context.state !== "running";
    if (!blocked && active.size) {
      const interrupted = () => { if (context.state !== "running") { blocked = true; wake?.(); } };
      context.addEventListener("statechange", interrupted);
      try { await new Promise(resolve => { wake = resolve; interrupted(); }); }
      finally { context.removeEventListener("statechange", interrupted); }
    }
    if (signal.aborted) throw new DOMException("已停止", "AbortError");
    return {blob:new Blob([header,...chunks],{type:"audio/wav"}), blocked};
  } finally {
    signal.removeEventListener("abort", stop);
    stop();
    reader.releaseLock();
  }
}
