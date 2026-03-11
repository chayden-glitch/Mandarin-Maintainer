import edge_tts
import asyncio
import os
import hashlib
import base64

AUDIO_CACHE_DIR = "audio_cache"
CHINESE_VOICE = "zh-CN-XiaoxiaoNeural"

def ensure_cache_dir():
    if not os.path.exists(AUDIO_CACHE_DIR):
        os.makedirs(AUDIO_CACHE_DIR)

def get_audio_filename(text: str) -> str:
    text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()[:12]
    return os.path.join(AUDIO_CACHE_DIR, f"{text_hash}.mp3")

async def generate_audio_async(text: str) -> str:
    ensure_cache_dir()
    filepath = get_audio_filename(text)
    
    if os.path.exists(filepath):
        return filepath
    
    communicate = edge_tts.Communicate(text, CHINESE_VOICE)
    await communicate.save(filepath)
    return filepath

def generate_audio(text: str) -> str:
    try:
        loop = asyncio.get_running_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, generate_audio_async(text))
            return future.result()
    except RuntimeError:
        return asyncio.run(generate_audio_async(text))

def get_audio_base64(text: str) -> str:
    filepath = generate_audio(text)
    with open(filepath, 'rb') as f:
        audio_data = f.read()
    return base64.b64encode(audio_data).decode('utf-8')

def get_audio_html(text: str, autoplay: bool = False) -> str:
    audio_b64 = get_audio_base64(text)
    autoplay_attr = "autoplay" if autoplay else ""
    return f'''
    <audio id="tts-audio" {autoplay_attr}>
        <source src="data:audio/mp3;base64,{audio_b64}" type="audio/mp3">
    </audio>
    '''
