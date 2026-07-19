import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const VOICE = "zh-CN-XiaoxiaoNeural";
const AUDIO_FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

function streamToBuffer(audioStream: NodeJS.ReadableStream, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      reject(new Error("TTS request timed out"));
    }, timeoutMs);

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

export async function generateTTS(text: string): Promise<Buffer> {
  const clippedText = text.slice(0, 500);

  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, AUDIO_FORMAT);

  const { audioStream } = await tts.toStream(clippedText);
  return streamToBuffer(audioStream, 15000);
}

/**
 * Split long article text into TTS-sized chunks at sentence boundaries so that
 * each Edge TTS request stays small and reliable. Chunks are kept under
 * `maxLen` characters; a single oversized sentence is hard-split as a fallback.
 */
function chunkArticleText(text: string, maxLen = 450): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Split after Chinese/ASCII sentence punctuation and newlines, keeping the delimiter.
  const pieces = normalized
    .split(/(?<=[。！？；!?;\n])/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    if (piece.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < piece.length; i += maxLen) {
        chunks.push(piece.slice(i, i + maxLen));
      }
      continue;
    }
    if ((current + piece).length > maxLen) {
      if (current) chunks.push(current);
      current = piece;
    } else {
      current += piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Generate a single stitched MP3 for a full article by synthesizing each text
 * chunk sequentially and concatenating the CBR MP3 buffers. A failing chunk is
 * skipped so one bad segment does not abort the whole article.
 */
export async function generateArticleTTS(text: string): Promise<Buffer> {
  const chunks = chunkArticleText(text);
  if (chunks.length === 0) {
    throw new Error("No text to synthesize");
  }

  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, AUDIO_FORMAT);

  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    try {
      const { audioStream } = await tts.toStream(chunk);
      const buffer = await streamToBuffer(audioStream, 20000);
      audioBuffers.push(buffer);
    } catch (e: any) {
      console.warn(`Skipping TTS chunk (${chunk.length} chars): ${e?.message || e}`);
    }
  }

  if (audioBuffers.length === 0) {
    throw new Error("Failed to synthesize any audio for article");
  }

  return Buffer.concat(audioBuffers);
}
