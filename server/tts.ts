import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export async function generateTTS(text: string): Promise<Buffer> {
  const clippedText = text.slice(0, 500);

  const tts = new MsEdgeTTS();
  await tts.setMetadata("zh-CN-XiaoxiaoNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = await tts.toStream(clippedText);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      reject(new Error("TTS request timed out"));
    }, 15000);

    audioStream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    audioStream.on("end", () => {
      clearTimeout(timeout);
      if (chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error("No audio data received"));
      }
    });

    audioStream.on("error", (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
