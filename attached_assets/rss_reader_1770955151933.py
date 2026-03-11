import feedparser
import jieba
from typing import List, Dict, Any, Optional, Set
import database
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
import os
from google import genai
from google.genai import types
from opencc import OpenCC
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

cc_t2s = OpenCC('t2s')

def convert_traditional_to_simplified(text: str) -> str:
    """Convert traditional Chinese characters to simplified using OpenCC"""
    if not text:
        return text
    return cc_t2s.convert(text)


def parse_article_date(date_string: str) -> Optional[datetime]:
    """Parse various RSS date formats into a datetime object."""
    if not date_string:
        return None

    try:
        return parsedate_to_datetime(date_string)
    except (ValueError, TypeError):
        pass

    date_formats = [
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d',
        '%a, %d %b %Y %H:%M:%S %z',
        '%a, %d %b %Y %H:%M:%S %Z',
    ]

    for fmt in date_formats:
        try:
            return datetime.strptime(date_string, fmt)
        except (ValueError, TypeError):
            continue

    return None


def is_article_recent(date_string: str, max_age_days: int = 7) -> bool:
    """Check if an article was published within the last max_age_days."""
    article_date = parse_article_date(date_string)
    if article_date is None:
        return False

    if article_date.tzinfo is not None:
        article_date = article_date.replace(tzinfo=None)

    cutoff_date = datetime.now() - timedelta(days=max_age_days)
    return article_date >= cutoff_date

RSS_FEEDS = {
    'NYT Chinese': 'https://cn.nytimes.com/rss/',
    'WSJ Chinese': 'https://cn.wsj.com/zh-hans/rss',
    'BBC 金融财经': 'http://www.bbc.co.uk/zhongwen/simp/business/index.xml',
    'BBC 科技': 'http://www.bbc.co.uk/zhongwen/simp/science/index.xml',
    'BBC 主页': 'http://www.bbc.co.uk/zhongwen/simp/index.xml',
    'VOA Chinese': 'https://www.voachinese.com/api/z$mqrevqt_'
}

PRIORITY_KEYWORDS = ['关税', '特朗普', '金融', '财经', '科技', '经济', '贸易', '市场', '投资', '商业', '科学', '技术']

_gemini_client = None
_gemini_client_key = None


def _load_streamlit_secret_key() -> Optional[str]:
    secrets_path = os.path.join(os.path.dirname(__file__), '.streamlit', 'secrets.toml')
    if not os.path.exists(secrets_path):
        return None

    try:
        try:
            import tomllib  # Python 3.11+
        except ModuleNotFoundError:
            import tomli as tomllib

        with open(secrets_path, 'rb') as f:
            data = tomllib.load(f)
        return data.get('GEMINI_API_KEY')
    except Exception:
        return None


def get_gemini_client():
    global _gemini_client, _gemini_client_key

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        api_key = _load_streamlit_secret_key()
        if api_key:
            os.environ["GEMINI_API_KEY"] = api_key

    if not api_key:
        _gemini_client = None
        _gemini_client_key = None
        return None

    if _gemini_client is None or _gemini_client_key != api_key:
        _gemini_client = genai.Client(api_key=api_key)
        _gemini_client_key = api_key

    return _gemini_client


def fetch_feed(feed_url: str, convert_to_simplified: bool = False, max_age_days: int = 7) -> List[Dict[str, Any]]:
    feed = feedparser.parse(feed_url)
    articles = []

    for entry in feed.entries[:50]:
        published = ''
        if hasattr(entry, 'published'):
            published = entry.published
        elif hasattr(entry, 'updated'):
            published = entry.updated

        if not is_article_recent(published, max_age_days):
            continue

        title = entry.get('title', 'No title')
        summary = entry.get('summary', '')

        if convert_to_simplified:
            title = convert_traditional_to_simplified(title)
            summary = convert_traditional_to_simplified(summary)

        articles.append({
            'title': title,
            'link': entry.get('link', ''),
            'summary': summary,
            'published': published,
            'source': feed.feed.get('title', 'Unknown')
        })

    return articles


FREE_SOURCES = {'BBC 金融财经', 'BBC 科技', 'BBC 主页', 'VOA Chinese'}
PAYWALLED_SOURCES = {'NYT Chinese', 'WSJ Chinese'}

NEEDS_CONVERSION = {'BBC 金融财经', 'BBC 科技', 'BBC 主页'}


def calculate_article_priority(article: Dict[str, Any]) -> int:
    """Calculate priority score for an article based on keywords. Higher = more relevant."""
    title = article.get('title', '')
    summary = article.get('summary', '')
    text = title + ' ' + summary

    score = 0
    for keyword in PRIORITY_KEYWORDS:
        if keyword in text:
            score += 10

    return score


def fetch_all_feeds() -> List[Dict[str, Any]]:
    all_articles = []

    for name, url in RSS_FEEDS.items():
        try:
            needs_conversion = name in NEEDS_CONVERSION
            articles = fetch_feed(url, convert_to_simplified=needs_conversion)
            for article in articles:
                article['feed_name'] = name
                article['is_free'] = name in FREE_SOURCES
                article['needs_conversion'] = needs_conversion
                article['priority'] = calculate_article_priority(article)

            all_articles.extend(articles)
        except Exception as e:
            print(f"Error fetching {name}: {e}")

    free_articles = [a for a in all_articles if a.get('is_free', False)]
    paid_articles = [a for a in all_articles if not a.get('is_free', False)]

    free_articles.sort(key=lambda x: x.get('priority', 0), reverse=True)
    paid_articles.sort(key=lambda x: x.get('priority', 0), reverse=True)

    return free_articles + paid_articles


def fetch_article_content(url: str, convert_to_simplified: bool = False) -> Optional[Dict[str, Any]]:
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'

        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract title
        title = ''
        if soup.find('h1'):
            title = soup.find('h1').get_text().strip()
        elif soup.find('title'):
            title = soup.find('title').get_text().strip()

        # Extract main text content (paragraphs only)
        text = ''
        content_root = soup.find('article') or soup.find('main') or soup
        paragraphs = []
        for tag in content_root.find_all('p'):
            para = tag.get_text().strip()
            if not para:
                continue
            paragraphs.append(para)

        if not paragraphs:
            for tag in content_root.find_all('div'):
                para = tag.get_text().strip()
                if not para:
                    continue
                paragraphs.append(para)

        text = '\n\n'.join(paragraphs)

        # Extract image
        top_image = ''
        img_tag = soup.find('img')
        if img_tag:
            img_src = img_tag.get('src', '')
            if img_src:
                top_image = urljoin(url, img_src)

        if convert_to_simplified:
            title = convert_traditional_to_simplified(title)
            text = convert_traditional_to_simplified(text)

        return {
            'title': title,
            'text': text[:2000],  # Limit to 2000 chars
            'authors': [],
            'publish_date': None,
            'top_image': top_image
        }
    except Exception as e:
        print(f"Error fetching article: {e}")
        return None


def get_vocabulary_set() -> Set[str]:
    words = database.get_all_words()
    vocab_set = set()

    for word in words:
        simplified = word.get('simplified', '')
        if simplified:
            vocab_set.add(simplified)

    return vocab_set


def segment_text(text: str) -> List[str]:
    """Segment Chinese text into words using jieba."""
    try:
        return list(jieba.cut(text))
    except Exception as e:
        print(f"Error in jieba.cut: {e}")
        # Fallback: return text split by spaces and punctuation
        import re
        return re.findall(r'\S+', text)


def escape_html(text: str) -> str:
    """Escape HTML special characters for safe attribute insertion"""
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')


def highlight_all_words_html(text: str, vocabulary: Set[str], word_translations: Dict[str, Dict[str, str]] = None) -> str:
    """Highlight all Chinese words with HTML spans and tooltips. Vocab words in orange, others with just tooltips."""
    if not text:
        return text

    if word_translations is None:
        word_translations = {}

    import re
    chinese_pattern = re.compile(r'[\u4e00-\u9fff]')

    segments = segment_text(text)
    result = []

    for segment in segments:
        if chinese_pattern.search(segment) and segment in word_translations:
            trans = word_translations[segment]
            pinyin = escape_html(trans.get('pinyin', ''))
            english = escape_html(trans.get('english', ''))
            tooltip = f"{pinyin} - {english}"

            if segment in vocabulary:
                result.append(f'<span class="vocab-word" data-tip="{tooltip}">{segment}</span>')
            else:
                result.append(f'<span class="chinese-word" data-tip="{tooltip}">{segment}</span>')
        elif chinese_pattern.search(segment) and segment in vocabulary:
            result.append(f'<span class="vocab-word">{segment}</span>')
        else:
            result.append(segment)

    return ''.join(result)


def get_vocabulary_matches(text: str, vocabulary: Set[str]) -> List[str]:
    if not text or not vocabulary:
        return []

    segments = segment_text(text)
    matches = []

    for segment in segments:
        if segment in vocabulary and segment not in matches:
            matches.append(segment)

    return matches


def get_word_details(word: str) -> Optional[Dict[str, Any]]:
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vocabulary WHERE simplified = ?", (word,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)
    return None


def batch_translate_titles(titles: List[str]) -> Dict[str, Dict[str, str]]:
    """Translate multiple titles in a single API call. Returns dict mapping title -> {pinyin, english}"""
    gemini_client = get_gemini_client()
    if not gemini_client or not titles:
        return {}

    try:
        titles_text = "\n".join([f"{i+1}. {t}" for i, t in enumerate(titles)])
        prompt = f"""For each Chinese headline below, provide:
1. Pinyin with tone marks
2. English translation

Format each response as:
[number]. [pinyin] | [english]

Headlines:
{titles_text}"""

        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )

        result = {}
        lines = response.text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line or '|' not in line:
                continue
            try:
                parts = line.split('.', 1)
                if len(parts) < 2:
                    continue
                idx = int(parts[0].strip()) - 1
                rest = parts[1].strip()
                if '|' in rest:
                    pinyin, english = rest.split('|', 1)
                    if 0 <= idx < len(titles):
                        result[titles[idx]] = {
                            'pinyin': pinyin.strip(),
                            'english': english.strip()
                        }
            except (ValueError, IndexError):
                continue

        return result
    except Exception as e:
        print(f"Error batch translating: {e}")
        return {}


def batch_translate_words(words: List[str]) -> Dict[str, Dict[str, str]]:
    """Translate multiple Chinese words in a single API call. Returns dict mapping word -> {pinyin, english}"""
    gemini_client = get_gemini_client()
    if not gemini_client or not words:
        return {}

    try:
        words_text = "\n".join([f"{i+1}. {w}" for i, w in enumerate(words)])
        prompt = f"""For each Chinese word/phrase below, provide:
1. Pinyin with tone marks
2. Concise English translation (2-5 words max)

Format each response as:
[number]. [pinyin] | [english]

Words:
{words_text}"""

        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )

        result = {}
        lines = response.text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line or '|' not in line:
                continue
            try:
                parts = line.split('.', 1)
                if len(parts) < 2:
                    continue
                idx = int(parts[0].strip()) - 1
                rest = parts[1].strip()
                if '|' in rest:
                    pinyin, english = rest.split('|', 1)
                    if 0 <= idx < len(words):
                        result[words[idx]] = {
                            'pinyin': pinyin.strip(),
                            'english': english.strip()
                        }
            except (ValueError, IndexError):
                continue

        return result
    except Exception as e:
        print(f"Error batch translating words: {e}")
        return {}


def get_article_translations(text: str, vocabulary: Set[str]) -> Dict[str, Dict[str, str]]:
    """Get translations for ALL Chinese words in text. Uses DB first for vocab, then cache, then Gemini."""
    if not text:
        return {}

    segments = segment_text(text)
    unique_chinese_words = set()

    import re
    chinese_pattern = re.compile(r'[\u4e00-\u9fff]')

    for segment in segments:
        if chinese_pattern.search(segment):
            unique_chinese_words.add(segment)

    if not unique_chinese_words:
        return {}

    translations = {}
    words_needing_lookup = []

    for word in unique_chinese_words:
        if word in vocabulary:
            details = get_word_details(word)
            if details and details.get('pinyin') and details.get('english'):
                translations[word] = {
                    'pinyin': details['pinyin'],
                    'english': details['english']
                }
                continue
        words_needing_lookup.append(word)

    if words_needing_lookup:
        cached = database.get_cached_translations_batch(words_needing_lookup)
        translations.update(cached)

        words_needing_gemini = [w for w in words_needing_lookup if w not in cached]

        if words_needing_gemini:
            gemini_translations = batch_translate_words(words_needing_gemini)
            translations.update(gemini_translations)

            database.cache_translations_batch(gemini_translations, source='gemini')

    return translations


def generate_interlinear_html(text: str, translations: Dict[str, Dict[str, str]]) -> str:
    """Generate HTML with interlinear pinyin and English for the full article"""
    if not text:
        return ""

    segments = segment_text(text)
    html_parts = []

    for segment in segments:
        if segment == '\n':
            html_parts.append('<br>')
        elif segment.strip() == '':
            html_parts.append(segment)
        elif segment in translations:
            trans = translations[segment]
            pinyin = trans.get('pinyin', '')
            english = trans.get('english', '')
            html_parts.append(f'''<span class="interlinear">
                <span class="chinese">{segment}</span>
                <span class="pinyin">{pinyin}</span>
                <span class="english">{english}</span>
            </span>''')
        else:
            html_parts.append(f'<span class="plain-text">{segment}</span>')

    return ''.join(html_parts)


def translate_title(chinese_title: str) -> Optional[Dict[str, str]]:
    gemini_client = get_gemini_client()
    if not gemini_client or not chinese_title:
        return None

    try:
        prompt = f"""For this Chinese title, provide:
1. Pinyin with tone marks (not numbers)
2. English translation

Title: {chinese_title}

Respond in exactly this format (no extra text):
Pinyin: [pinyin here]
English: [english here]"""

        response = gemini_client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt
        )

        if response.text:
            lines = response.text.strip().split('\n')
            result = {}
            for line in lines:
                if line.startswith('Pinyin:'):
                    result['pinyin'] = line.replace('Pinyin:', '').strip()
                elif line.startswith('English:'):
                    result['english'] = line.replace('English:', '').strip()

            if 'pinyin' in result and 'english' in result:
                return result
        return None
    except Exception as e:
        print(f"Error translating title: {e}")
        return None


HSK_COMMON_WORDS = [
    "的", "一", "是", "不", "了", "在", "人", "有", "我", "他",
    "这", "中", "大", "来", "上", "国", "个", "到", "说", "们",
    "为", "子", "和", "你", "地", "出", "道", "也", "时", "年",
    "得", "就", "那", "要", "下", "以", "生", "会", "自", "着",
    "去", "之", "过", "家", "学", "对", "可", "她", "里", "后",
    "小", "么", "心", "多", "天", "而", "能", "好", "都", "然",
    "没", "日", "于", "起", "还", "发", "成", "事", "只", "作",
    "当", "想", "看", "文", "无", "开", "手", "十", "用", "主",
    "行", "方", "又", "如", "前", "所", "本", "见", "经", "头",
    "面", "外", "两", "高", "同", "把", "机", "现", "做", "被",
    "今天", "明天", "昨天", "现在", "时候", "工作", "学习", "中国", "美国", "公司",
    "经济", "市场", "发展", "政府", "社会", "问题", "研究", "技术", "世界", "国家",
    "企业", "投资", "贸易", "金融", "银行", "增长", "产业", "科技", "创新", "改革",
    "政策", "管理", "服务", "信息", "数据", "互联网", "电子", "商品", "消费", "价格",
    "收入", "成本", "利润", "资本", "股票", "债券", "货币", "利率", "汇率", "通货膨胀",
    "出口", "进口", "关税", "协议", "合作", "竞争", "产品", "客户", "供应", "需求",
    "制造", "生产", "销售", "营销", "品牌", "质量", "效率", "项目", "计划", "目标",
    "战略", "风险", "机会", "挑战", "解决", "分析", "报告", "会议", "决定", "影响",
    "重要", "新闻", "消息", "记者", "报道", "采访", "评论", "观点", "专家", "学者",
    "教授", "大学", "学生", "教育", "文化", "历史", "科学", "医学", "健康", "环境",
    "能源", "资源", "农业", "城市", "地区", "人口", "家庭", "孩子", "父母", "朋友",
    "生活", "工资", "房子", "汽车", "手机", "电脑", "网络", "游戏", "音乐", "电影",
    "体育", "足球", "篮球", "运动", "比赛", "冠军", "选手", "教练", "团队", "成绩"
]


def populate_common_words_cache(progress_callback=None):
    """Populate the word cache with common Chinese words using Gemini.
    progress_callback: optional function(current, total, message) to report progress"""
    if not gemini_client:
        return {'success': False, 'error': 'Gemini API not configured'}

    existing = database.get_cached_translations_batch(HSK_COMMON_WORDS)
    words_to_translate = [w for w in HSK_COMMON_WORDS if w not in existing]

    if not words_to_translate:
        return {'success': True, 'message': 'All common words already cached', 'added': 0}

    total_words = len(words_to_translate)
    batch_size = 50
    added_count = 0

    for i in range(0, total_words, batch_size):
        batch = words_to_translate[i:i + batch_size]

        if progress_callback:
            progress_callback(i, total_words, f"Translating batch {i//batch_size + 1}...")

        translations = batch_translate_words(batch)
        database.cache_translations_batch(translations, source='hsk_common')
        added_count += len(translations)

    if progress_callback:
        progress_callback(total_words, total_words, "Complete!")

    return {'success': True, 'message': f'Added {added_count} words to cache', 'added': added_count}
