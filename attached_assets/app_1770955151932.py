import streamlit as st
import pandas as pd
import json
import html
import os
import database
import fsrs_engine
import rss_reader
import audio_utils
from datetime import datetime, date


def get_reader_settings():
    """Load reader settings from database, return defaults if not set."""
    defaults = {'font_size': 18, 'line_height': 1.8, 'theme': 'light'}
    stored = database.get_setting('reader_settings')
    if stored:
        try:
            return json.loads(stored)
        except:
            return defaults
    return defaults


def save_reader_settings(settings):
    """Save reader settings to database."""
    database.set_setting('reader_settings', json.dumps(settings))


def get_streak():
    """Calculate current review streak (days in a row with reviews)."""
    stored = database.get_setting('streak_data')
    if stored:
        try:
            data = json.loads(stored)
            last_date = datetime.strptime(data['last_review_date'], '%Y-%m-%d').date()
            today = date.today()
            diff = (today - last_date).days

            if diff == 0:
                return data['streak']
            elif diff == 1:
                return data['streak']
            else:
                return 0
        except:
            return 0
    return 0


def update_streak():
    """Update streak after a review."""
    stored = database.get_setting('streak_data')
    today = date.today().isoformat()

    if stored:
        try:
            data = json.loads(stored)
            last_date = data['last_review_date']
            if last_date == today:
                return

            last = datetime.strptime(last_date, '%Y-%m-%d').date()
            diff = (date.today() - last).days

            if diff == 1:
                data['streak'] += 1
            elif diff > 1:
                data['streak'] = 1

            data['last_review_date'] = today
            database.set_setting('streak_data', json.dumps(data))
        except:
            database.set_setting('streak_data', json.dumps({'streak': 1, 'last_review_date': today}))
    else:
        database.set_setting('streak_data', json.dumps({'streak': 1, 'last_review_date': today}))


st.set_page_config(
    page_title="Chinese Tutor",
    page_icon="📚",
    layout="wide"
)

database.init_database()
database.import_hsk_vocabulary()
fsrs_engine.sync_cards()

if 'current_page' not in st.session_state:
    st.session_state.current_page = 'welcome'
if 'review_session' not in st.session_state:
    st.session_state.review_session = {
        'active': False,
        'cards': [],
        'current_index': 0,
        'reviewed_count': 0,
        'show_answer': False
    }
if 'selected_article' not in st.session_state:
    st.session_state.selected_article = None
if 'article_content' not in st.session_state:
    st.session_state.article_content = None
if 'title_translations' not in st.session_state:
    st.session_state.title_translations = {}

glass_css = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.main .block-container {
    padding-top: 1rem;
}

.glass-container {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border-radius: 24px;
    padding: 32px 40px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
    max-width: 800px;
    margin: 0 auto 24px auto;
}

.glass-container-wide {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(15px);
    -webkit-backdrop-filter: blur(15px);
    border-radius: 20px;
    padding: 24px 32px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
    margin-bottom: 20px;
}

.hud-bar {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 12px;
    padding: 10px 20px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 24px rgba(31, 38, 135, 0.08);
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.hud-stat {
    text-align: center;
    padding: 0 16px;
}

.hud-value {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.2;
}

.hud-label {
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
}

.streak-fire {
    color: #f59e0b;
}

.progress-bar-container {
    flex: 1;
    max-width: 300px;
    margin: 0 24px;
}

.progress-bar-bg {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 10px;
    height: 8px;
    overflow: hidden;
}

.progress-bar-fill {
    background: linear-gradient(90deg, #FF6B35, #f59e0b);
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s ease;
}

.progress-label {
    font-size: 11px;
    color: #6b7280;
    margin-top: 6px;
    text-align: center;
}

.page-title {
    font-size: 26px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 4px;
}

.page-subtitle {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 16px;
}

.sidebar-nav-item {
    padding: 12px 16px;
    border-radius: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.sidebar-nav-item:hover {
    background: rgba(255, 107, 53, 0.1);
}

.sidebar-nav-item.active {
    background: linear-gradient(135deg, #FF6B35, #f59e0b);
    color: white;
}

.article-card {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 20px 24px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 16px rgba(31, 38, 135, 0.06);
    margin-bottom: 16px;
    transition: all 0.2s ease;
}

.article-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(31, 38, 135, 0.1);
}

.vocab-word {
    color: #FF6B35;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 107, 53, 0.25);
    transition: background 0.2s ease, border-color 0.2s ease;
    cursor: help;
    position: relative;
    border-radius: 3px;
    padding: 0 1px;
}

.vocab-word:hover {
    background: rgba(255, 107, 53, 0.12);
    border-bottom-color: #FF6B35;
}

.vocab-word[data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    background: #1a1a2e;
    color: white;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 13px;
    white-space: nowrap;
    z-index: 1000;
    box-shadow: 0 4px 18px rgba(0,0,0,0.18);
    margin-bottom: 8px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, transform 0.15s ease;
    transition-delay: 0.35s;
    pointer-events: none;
}

.vocab-word[data-tip]:hover::after {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
}

.chinese-word {
    cursor: help;
    position: relative;
    transition: background 0.15s ease;
    border-radius: 2px;
}

.chinese-word:hover {
    background: rgba(55, 65, 81, 0.06);
}

.chinese-word[data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    background: #374151;
    color: white;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 13px;
    white-space: nowrap;
    z-index: 1000;
    box-shadow: 0 4px 18px rgba(0,0,0,0.18);
    margin-bottom: 8px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, transform 0.15s ease;
    transition-delay: 0.35s;
    pointer-events: none;
}

.chinese-word[data-tip]:hover::after {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
}

.flashcard {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 24px;
    padding: 32px 24px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.03);
    text-align: center;
    max-width: 480px;
    margin: 16px auto;
    border: none;
}

.flashcard-chinese {
    font-size: 56px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 8px;
    line-height: 1.2;
}

.flashcard-pinyin {
    font-size: 20px;
    color: #9ca3af;
    font-weight: 500;
    margin-bottom: 8px;
}

.flashcard-english {
    font-size: 24px;
    color: #374151;
    font-weight: 600;
}

.flashcard-answer-reveal {
    font-size: 24px;
    color: #1a1a2e;
    font-weight: 600;
    margin: 16px auto;
    padding: 16px 20px;
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border-radius: 16px;
    border-left: 4px solid #22c55e;
    max-width: 480px;
}

.card-progress {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin-bottom: 12px;
}

.card-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e5e7eb;
    transition: all 0.3s ease;
}

.card-dot.completed {
    background: linear-gradient(135deg, #22c55e, #16a34a);
}

.card-dot.current {
    background: linear-gradient(135deg, #FF6B35, #f59e0b);
    transform: scale(1.2);
}

.rating-buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
}

.rating-btn-again {
    background: linear-gradient(135deg, #ef4444, #dc2626) !important;
    color: white !important;
    border: none !important;
    border-radius: 16px !important;
    padding: 16px 24px !important;
    font-weight: 600 !important;
    font-size: 15px !important;
}

.rating-btn-hard {
    background: linear-gradient(135deg, #f97316, #ea580c) !important;
    color: white !important;
    border: none !important;
    border-radius: 16px !important;
    padding: 16px 24px !important;
    font-weight: 600 !important;
    font-size: 15px !important;
}

.rating-btn-good {
    background: linear-gradient(135deg, #22c55e, #16a34a) !important;
    color: white !important;
    border: none !important;
    border-radius: 16px !important;
    padding: 16px 24px !important;
    font-weight: 600 !important;
    font-size: 15px !important;
}

.rating-btn-easy {
    background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
    color: white !important;
    border: none !important;
    border-radius: 16px !important;
    padding: 16px 24px !important;
    font-weight: 600 !important;
    font-size: 15px !important;
}

.show-answer-btn {
    background: linear-gradient(135deg, #FF6B35, #f59e0b) !important;
    color: white !important;
    border: none !important;
    border-radius: 20px !important;
    padding: 18px 48px !important;
    font-weight: 600 !important;
    font-size: 18px !important;
    box-shadow: 0 8px 24px rgba(255, 107, 53, 0.3) !important;
}

.session-complete {
    text-align: center;
    padding: 48px;
}

.session-complete-icon {
    font-size: 80px;
    margin-bottom: 24px;
}

.session-complete-title {
    font-size: 32px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 12px;
}

.session-complete-subtitle {
    font-size: 18px;
    color: #6b7280;
}

.reader-container {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(15px);
    border-radius: 24px;
    padding: 40px 48px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
    max-width: 720px;
    margin: 0 auto;
}

.reader-title {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.4;
    color: #1a1a2e;
    margin-bottom: 16px;
}

.reader-meta {
    font-size: 14px;
    color: #6b7280;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    margin-bottom: 28px;
}

.article-text {
    font-size: 18px !important;
    line-height: 1.8 !important;
    color: #374151 !important;
    margin-bottom: 20px;
}

.vocab-sidebar {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 0;
    max-height: 70vh;
    overflow-y: auto;
}

.vocab-sidebar-header {
    position: sticky;
    top: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    font-weight: 600;
    color: #1a1a2e;
    z-index: 10;
}

.vocab-sidebar-items {
    padding: 12px 24px 24px;
}

.vocab-sidebar-item {
    padding: 14px 0;
    border-bottom: 1px solid rgba(0,0,0,0.05);
}

/* === EXPLORE PAGE: Card Grid & Premium UI === */
.explore-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.news-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    padding: 20px 24px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.04);
}

.news-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0,0,0,0.12);
}

.news-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}

.source-favicon {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    object-fit: contain;
}

.source-name {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
}
.news-card-english {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    line-height: 1.3;
    margin-bottom: 8px;
}
.news-card-title {
    font-size: 15px;
    font-weight: 600;
    color: #1a1a2e;
    line-height: 1.3;
    margin-bottom: 4px;
}

.news-card-pinyin {
    font-size: 13px;
    color: #9ca3af;
    line-height: 1.4;
    margin-bottom: 12px;
}

.news-card-translation {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.5;
    margin-bottom: 12px;
}

.news-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(0,0,0,0.05);
}

.news-card-date {
    font-size: 12px;
    color: #9ca3af;
}

.vocab-count-unavailable {
    font-size: 12px;
    color: #9ca3af;
    font-style: italic;
}

/* Pill badges */
.pill-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    position: absolute;
    top: 16px;
    right: 16px;
}

.pill-free {
    background: linear-gradient(135deg, #d1fae5, #a7f3d0);
    color: #065f46;
}

.pill-paywall {
    background: #f3f4f6;
    color: #6b7280;
}

/* Shimmer loading skeleton */
.shimmer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.shimmer-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    padding: 20px 24px;
    border: 1px solid rgba(0,0,0,0.04);
}

.shimmer-line {
    height: 16px;
    border-radius: 8px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    margin-bottom: 10px;
}

.shimmer-line.short {
    width: 60%;
}

.shimmer-line.medium {
    width: 85%;
}

.shimmer-line.tiny {
    width: 40%;
    height: 12px;
    margin-top: 16px;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* === READING ENVIRONMENT: Zen Mode === */
.reading-container {
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 48px 56px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 16px 48px rgba(31, 38, 135, 0.08);
    max-width: 680px;
    margin: 0 auto;
}

.reading-title {
    font-family: 'Noto Sans SC', 'Inter', -apple-system, sans-serif;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.5;
    color: #1a1a2e;
    margin-bottom: 20px;
}

.reading-meta {
    font-size: 14px;
    color: #6b7280;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    margin-bottom: 32px;
}

.reading-body {
    max-width: 640px;
    margin: 0 auto;
}

.reading-body p {
    font-family: 'Noto Sans SC', 'Inter', -apple-system, sans-serif;
    font-size: 1.25rem;
    line-height: 1.8;
    color: #374151;
    margin-bottom: 22px;
    letter-spacing: 0.01em;
    word-break: break-word;
    text-align: left;
}

/* Floating frosted header */
.floating-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    padding: 12px 20px;
    margin: -20px -20px 20px -20px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 16px 16px 0 0;
}

.floating-header-btn {
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    background: rgba(0,0,0,0.05);
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
}

.floating-header-btn:hover {
    background: rgba(0,0,0,0.1);
}

.original-link {
    display: inline-block;
    margin-top: 12px;
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
    font-size: 14px;
    transition: all 0.2s ease;
}

.original-link:hover {
    color: #2563eb;
    text-decoration: underline;
}

/* Interlinear text styling */
.interlinear {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    vertical-align: bottom;
    margin: 2px 1px;
}

.interlinear .pinyin {
    font-size: 0.75rem;
    color: rgba(107, 114, 128, 0.6);
    font-weight: 400;
    line-height: 1.2;
    order: -1;
}

.interlinear .chinese {
    font-size: 1.25rem;
    color: #1a1a2e;
    font-weight: 500;
    line-height: 1.4;
}

.interlinear .english {
    font-size: 0.75rem;
    color: rgba(107, 114, 128, 0.6);
    font-weight: 400;
    line-height: 1.2;
}

.plain-text {
    font-size: 1.25rem;
    color: #374151;
}

/* Improved vocabulary sidebar for reading */
.vocab-panel {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(12px);
    border-radius: 16px;
    border-left: 4px solid #FF6B35;
    box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    overflow: hidden;
}

.vocab-panel-header {
    position: sticky;
    top: 0;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(10px);
    padding: 16px 20px;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    font-weight: 600;
    font-size: 15px;
    color: #1a1a2e;
    z-index: 10;
}

.vocab-panel-list {
    padding: 8px 16px 16px;
    max-height: 65vh;
    overflow-y: auto;
}

.vocab-panel-item {
    padding: 12px 8px;
    border-bottom: 1px solid rgba(0,0,0,0.04);
    transition: background 0.15s ease;
}

.vocab-panel-item:hover {
    background: rgba(255, 107, 53, 0.05);
}

.vocab-panel-chinese {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a2e;
}

.vocab-panel-pinyin {
    font-size: 13px;
    color: #6b7280;
    margin-top: 2px;
}

.vocab-panel-english {
    font-size: 13px;
    color: #374151;
    margin-top: 2px;
}

.vocab-sidebar-item:last-child {
    border-bottom: none;
}

.original-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #6b7280;
    font-size: 14px;
    text-decoration: none;
    padding: 8px 16px;
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 10px;
    transition: all 0.2s;
    margin-top: 12px;
}

.original-link:hover {
    color: #FF6B35;
    border-color: #FF6B35;
    background: rgba(255, 107, 53, 0.05);
}

[data-testid="stSidebar"] {
    background: linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%);
    backdrop-filter: blur(20px);
}

[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p {
    font-size: 14px;
}

/* === HEADER NAVIGATION === */
.header-nav-container {
    position: sticky;
    top: 0;
    z-index: 999;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 24px rgba(31, 38, 135, 0.08);
    padding: 0 24px;
    margin: -1rem -1rem 1rem -1rem;
}

.header-nav-content {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    height: 64px;
    gap: 32px;
}

.header-logo {
    font-size: 18px;
    font-weight: 700;
    color: #1a1a2e;
    text-decoration: none;
    white-space: nowrap;
    margin-right: 16px;
}

.header-nav-items {
    display: flex;
    gap: 8px;
    align-items: center;
}

.nav-item {
    padding: 8px 16px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: #6b7280;
    background: transparent;
    border: none;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.nav-item:hover {
    background: rgba(255, 107, 53, 0.08);
    color: #FF6B35;
}

.nav-item.active {
    background: rgba(255, 107, 53, 0.12);
    color: #FF6B35;
    font-weight: 600;
}

.main .block-container {
    padding-top: 0.5rem;
}

</style>
"""
st.markdown(glass_css, unsafe_allow_html=True)

due_count = fsrs_engine.get_due_cards_count()
reviewed_today = fsrs_engine.get_cards_reviewed_today()
review_streak = database.get_review_streak()
max_new_cards = fsrs_engine.get_max_new_cards_per_day()
new_cards_today = fsrs_engine.get_new_cards_introduced_today()
total_words = database.get_word_count()

# Sticky Header Navigation - Use Streamlit columns with styled buttons
st.markdown('''<div class="header-nav-container"><div class="header-nav-content">
<div class="header-logo">📚 MoDu</div></div></div>''', unsafe_allow_html=True)

# Navigation buttons in a row
nav_col1, nav_col2, nav_col3, nav_col4, nav_col5 = st.columns([1, 1, 1, 1, 1])
with nav_col1:
    if st.button("Welcome", key="nav_welcome", use_container_width=True):
        st.session_state.current_page = 'welcome'
        st.rerun()
with nav_col2:
    if st.button("Vocabulary", key="nav_vocab", use_container_width=True):
        st.session_state.current_page = 'home'
        st.rerun()
with nav_col3:
    if st.button("News", key="nav_news", use_container_width=True):
        st.session_state.current_page = 'explore'
        st.session_state.selected_article = None
        st.session_state.article_content = None
        st.rerun()
with nav_col4:
    if st.button("Library", key="nav_lib", use_container_width=True):
        st.session_state.current_page = 'library'
        st.rerun()
with nav_col5:
    if st.button("Settings", key="nav_settings", use_container_width=True):
        st.session_state.current_page = 'settings'
        st.rerun()

# Style the buttons to hide default Streamlit styling and look like nav items
st.markdown("""
<style>
/* Hide and reposition navigation buttons */
button[key="nav_welcome"] { background: transparent !important; color: #6b7280 !important; border: none !important; }
button[key="nav_vocab"] { background: transparent !important; color: #6b7280 !important; border: none !important; }
button[key="nav_news"] { background: transparent !important; color: #6b7280 !important; border: none !important; }
button[key="nav_lib"] { background: transparent !important; color: #6b7280 !important; border: none !important; }
button[key="nav_settings"] { background: transparent !important; color: #6b7280 !important; border: none !important; }

button[key="nav_welcome"]:hover, button[key="nav_vocab"]:hover, button[key="nav_news"]:hover,
button[key="nav_lib"]:hover, button[key="nav_settings"]:hover {
    background: rgba(255, 107, 53, 0.08) !important;
    color: #FF6B35 !important;
}

/* Hide HUD bar on welcome page */
div.hud-bar {
    display: none;
}
</style>
""", unsafe_allow_html=True)

# Only show HUD bar on non-welcome pages
if st.session_state.current_page != 'welcome':
    daily_goal = 20
    progress_pct = min(100, int((reviewed_today / daily_goal) * 100))

    hud_html = f'''
    <div class="hud-bar">
        <div class="hud-stat">
            <div class="hud-value">{due_count}</div>
            <div class="hud-label">Due Now</div>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {progress_pct}%;"></div>
            </div>
            <div class="progress-label">{reviewed_today} / {daily_goal} daily goal</div>
        </div>
        <div class="hud-stat">
            <div class="hud-value streak-fire">🔥 {review_streak}</div>
            <div class="hud-label">Day Streak</div>
        </div>
    </div>
    '''
    st.markdown(hud_html, unsafe_allow_html=True)

if st.session_state.current_page == 'welcome':
    # Clean Welcome Page - Greeting + Stacked Cards
    st.markdown('''
    <div style="text-align: center; margin-top: 60px; margin-bottom: 80px;">
        <div style="font-size: 56px; font-weight: 800; color: #1a1a2e;">欢迎，Chris</div>
    </div>
    ''', unsafe_allow_html=True)

    # Stacked cards - centered
    container_col1, container_col2, container_col3 = st.columns([1, 2, 1])
    with container_col2:
        # Review Vocabulary Card
        if st.button("📚 Review Vocabulary", key="card_review", use_container_width=True):
            st.session_state.current_page = 'home'
            st.rerun()
        st.markdown('''
        <div style="
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(15px);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
            text-align: center;
            margin-bottom: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
        ">
            <div style="font-size: 32px; margin-bottom: 12px;">📚</div>
            <div style="font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px;">Review Vocabulary</div>
            <div style="font-size: 14px; color: #6b7280;">Practice your flashcards</div>
        </div>
        ''', unsafe_allow_html=True)

        # Read the News Card
        if st.button("📰 Read the News", key="card_news", use_container_width=True):
            st.session_state.current_page = 'explore'
            st.rerun()
        st.markdown('''
        <div style="
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(15px);
            border-radius: 16px;
            padding: 24px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
        ">
            <div style="font-size: 32px; margin-bottom: 12px;">📰</div>
            <div style="font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px;">Read the News</div>
            <div style="font-size: 14px; color: #6b7280;">Learn from real articles</div>
        </div>
        ''', unsafe_allow_html=True)

elif st.session_state.current_page == 'home':
    session = st.session_state.review_session
    total_cards = fsrs_engine.get_total_cards_count()

    if not session['active']:
        st.markdown('<div class="page-title">Daily Review</div>', unsafe_allow_html=True)
        st.markdown('<div class="page-subtitle">Master your vocabulary through spaced repetition</div>', unsafe_allow_html=True)

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Due Now", due_count)
        with col2:
            st.metric("Reviewed Today", reviewed_today)
        with col3:
            st.metric("New Today", f"{new_cards_today}/{max_new_cards}")
        with col4:
            st.metric("Total Cards", total_cards)


        if due_count > 0:
            st.markdown(f'''
            <div style="text-align: center; padding: 8px 20px;">
                <div style="font-size: 36px; font-weight: 700; color: #1a1a2e; margin-bottom: 2px;">{due_count}</div>
                <div style="font-size: 15px; color: #6b7280; margin-bottom: 12px;">cards ready for review</div>
            </div>
            ''', unsafe_allow_html=True)
            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                if st.button("Start Review", type="primary", use_container_width=True):
                    cards = fsrs_engine.get_due_cards(limit=50)
                    st.session_state.review_session = {
                        'active': True,
                        'cards': cards,
                        'current_index': 0,
                        'reviewed_count': 0,
                        'show_answer': False,
                        'is_practice': False
                    }
                    st.rerun()
        else:
            st.markdown('''
            <div style="text-align: center; padding: 8px 20px;">
                <div style="font-size: 28px; font-weight: 700; color: #22c55e; margin-bottom: 2px;">All caught up!</div>
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">No cards due for review right now</div>
            </div>
            ''', unsafe_allow_html=True)
            if total_cards > 0:
                col1, col2, col3 = st.columns([1, 2, 1])
                with col2:
                    if st.button("Practice Random Cards", type="secondary", use_container_width=True):
                        cards = fsrs_engine.get_practice_cards(limit=20)
                        if cards:
                            st.session_state.review_session = {
                                'active': True,
                                'cards': cards,
                                'current_index': 0,
                                'reviewed_count': 0,
                                'show_answer': False,
                                'is_practice': True
                            }
                            st.rerun()
                        else:
                            st.info("All cards were reviewed in the last 24 hours. Try again tomorrow!")
    else:
        cards = session['cards']
        idx = session['current_index']

        if idx >= len(cards):
            mode_text = "practiced" if session.get('is_practice') else "reviewed"
            reviewed_count = session['reviewed_count']
            update_streak()

            st.markdown(f'''
            <div style="text-align: center; padding: 32px 20px;">
                <div style="font-size: 72px; margin-bottom: 16px;">🎉</div>
                <div style="font-size: 28px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px;">Session Complete!</div>
                <div style="font-size: 16px; color: #6b7280; margin-bottom: 4px;">You {mode_text}</div>
                <div style="font-size: 44px; font-weight: 700; color: #22c55e; margin-bottom: 4px;">{reviewed_count}</div>
                <div style="font-size: 16px; color: #6b7280;">cards</div>
            </div>
            ''', unsafe_allow_html=True)

            col1, col2, col3 = st.columns([1, 2, 1])
            with col2:
                if st.button("Continue", type="primary", use_container_width=True):
                    st.session_state.review_session = {
                        'active': False,
                        'cards': [],
                        'current_index': 0,
                        'reviewed_count': 0,
                        'show_answer': False
                    }
                    st.rerun()
        else:
            card = cards[idx]
            card_type = card['card_type']
            total_cards_in_session = len(cards)

            progress_dots = ""
            max_dots = min(total_cards_in_session, 20)
            for i in range(max_dots):
                if i < idx:
                    progress_dots += '<div class="card-dot completed"></div>'
                elif i == idx:
                    progress_dots += '<div class="card-dot current"></div>'
                else:
                    progress_dots += '<div class="card-dot"></div>'
            if total_cards_in_session > 20:
                progress_dots += f'<span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">+{total_cards_in_session - 20}</span>'

            st.markdown(f'<div class="card-progress">{progress_dots}</div>', unsafe_allow_html=True)

            flashcard_content = card['simplified'] if card_type == 'Recognition' else card['english']
            chinese_text = card['simplified']

            autoplay_enabled = database.get_setting('audio_autoplay', 'true') == 'true'

            show_chinese_side = (card_type == 'Recognition' and not session['show_answer']) or (card_type == 'Production' and session['show_answer'])

            st.markdown(f'<div class="flashcard"><div class="flashcard-chinese">{flashcard_content}</div></div>', unsafe_allow_html=True)

            if show_chinese_side:
                col_audio1, col_audio2, col_audio3 = st.columns([1, 1, 1])
                with col_audio2:
                    if st.button("🔊 Play Audio", use_container_width=True, key="btn_audio"):
                        st.session_state.play_audio_text = chinese_text

                if card_type == 'Production' and session['show_answer'] and autoplay_enabled:
                    if 'last_autoplay_card' not in st.session_state or st.session_state.last_autoplay_card != card['id']:
                        st.session_state.play_audio_text = chinese_text
                        st.session_state.last_autoplay_card = card['id']

                if 'play_audio_text' in st.session_state and st.session_state.play_audio_text:
                    try:
                        audio_filepath = audio_utils.generate_audio(st.session_state.play_audio_text)
                        with open(audio_filepath, 'rb') as audio_file:
                            st.audio(audio_file.read(), format='audio/mp3', autoplay=True)
                        st.session_state.play_audio_text = None
                    except Exception as e:
                        st.error(f"Audio error: {e}")
                        st.session_state.play_audio_text = None

            if not session['show_answer']:
                col1, col2, col3 = st.columns([1, 2, 1])
                with col2:
                    if st.button("Tap to Reveal", type="primary", use_container_width=True, key="show_answer_btn"):
                        st.session_state.review_session['show_answer'] = True
                        st.rerun()
            else:
                if card_type == 'Recognition':
                    answer_html = f'<div class="flashcard-answer-reveal"><div style="font-size: 16px; color: #6b7280; margin-bottom: 4px;">{card["pinyin"]}</div><div style="font-size: 20px; color: #1a1a2e; font-weight: 600;">{card["english"]}</div></div>'
                else:
                    answer_html = f'<div class="flashcard-answer-reveal"><div style="font-size: 40px; color: #1a1a2e; font-weight: 700; margin-bottom: 4px;">{card["simplified"]}</div><div style="font-size: 16px; color: #6b7280;">{card["pinyin"]}</div></div>'

                st.markdown(answer_html, unsafe_allow_html=True)

                col1, col2, col3, col4 = st.columns(4)

                with col1:
                    if st.button("😓 Again", use_container_width=True, key="btn_again"):
                        fsrs_engine.update_card(card['id'], 1)
                        update_streak()
                        st.session_state.review_session['current_index'] += 1
                        st.session_state.review_session['reviewed_count'] += 1
                        st.session_state.review_session['show_answer'] = False
                        st.rerun()

                with col2:
                    if st.button("😐 Hard", use_container_width=True, key="btn_hard"):
                        fsrs_engine.update_card(card['id'], 2)
                        update_streak()
                        st.session_state.review_session['current_index'] += 1
                        st.session_state.review_session['reviewed_count'] += 1
                        st.session_state.review_session['show_answer'] = False
                        st.rerun()

                with col3:
                    if st.button("😊 Good", type="primary", use_container_width=True, key="btn_good"):
                        fsrs_engine.update_card(card['id'], 3)
                        update_streak()
                        st.session_state.review_session['current_index'] += 1
                        st.session_state.review_session['reviewed_count'] += 1
                        st.session_state.review_session['show_answer'] = False
                        st.rerun()

                with col4:
                    if st.button("🎯 Easy", use_container_width=True, key="btn_easy"):
                        fsrs_engine.update_card(card['id'], 4)
                        update_streak()
                        st.session_state.review_session['current_index'] += 1
                        st.session_state.review_session['reviewed_count'] += 1
                        st.session_state.review_session['show_answer'] = False
                        st.rerun()

                st.markdown("<div style='height: 8px'></div>", unsafe_allow_html=True)
                col1, col2, col3 = st.columns([1, 2, 1])
                with col2:
                    if st.button("🚫 Remove from deck", use_container_width=True, key="btn_bury", type="secondary"):
                        fsrs_engine.bury_card_vocabulary(card['id'])
                        st.session_state.review_session['current_index'] += 1
                        st.session_state.review_session['show_answer'] = False
                        st.rerun()

elif st.session_state.current_page == 'explore':

    def get_source_badge(feed_name):
        badges = {
            'BBC Chinese': ':green[BBC]',
            'BBC 金融财经': ':green[BBC]',
            'BBC 科技': ':green[BBC]',
            'BBC 主页': ':green[BBC]',
            'VOA Chinese': ':blue[VOA]',
            'NYT Chinese': ':orange[NYT]',
            'WSJ Chinese': ':red[WSJ]'
        }
        return badges.get(feed_name, feed_name)

    def get_favicon_url(feed_name):
        """Return favicon URL for each news source"""
        favicons = {
            'BBC 金融财经': 'https://www.google.com/s2/favicons?domain=bbc.com&sz=32',
            'BBC 科技': 'https://www.google.com/s2/favicons?domain=bbc.com&sz=32',
            'BBC 主页': 'https://www.google.com/s2/favicons?domain=bbc.com&sz=32',
            'VOA Chinese': 'https://www.google.com/s2/favicons?domain=voachinese.com&sz=32',
            'NYT Chinese': 'https://www.google.com/s2/favicons?domain=nytimes.com&sz=32',
            'WSJ Chinese': 'https://www.google.com/s2/favicons?domain=wsj.com&sz=32'
        }
        return favicons.get(feed_name, 'https://www.google.com/s2/favicons?domain=google.com&sz=32')

    def render_shimmer_loaders():
        """Render shimmer placeholder cards while loading"""
        shimmer_html = '<div class="shimmer-grid">'
        for _ in range(6):
            shimmer_html += '''
            <div class="shimmer-card">
                <div class="shimmer-line short"></div>
                <div class="shimmer-line medium"></div>
                <div class="shimmer-line"></div>
                <div class="shimmer-line short"></div>
                <div class="shimmer-line tiny"></div>
            </div>
            '''
        shimmer_html += '</div>'
        return shimmer_html
    if st.session_state.selected_article is None:
        st.markdown('<div class="page-title">Explore</div>', unsafe_allow_html=True)
        st.markdown('<div class="page-subtitle">Read Chinese news with vocabulary highlighting</div>', unsafe_allow_html=True)

        # Show warning if API key not set
        if not os.environ.get("GEMINI_API_KEY"):
            st.info("💡 **Tip**: Set `GEMINI_API_KEY` as an environment variable or in .streamlit/secrets.toml to see English translations of article titles. For now, you'll see the Chinese titles with vocabulary counts.")

        col1, col2 = st.columns([4, 1])
        with col2:
            if st.button("🔄 Refresh", type="secondary"):
                st.cache_data.clear()
                st.session_state.title_translations = {}
                st.session_state.articles_loaded = False
                st.session_state.cached_articles = []
                st.rerun()

        @st.cache_data(ttl=86400)
        def load_feeds():
            return rss_reader.fetch_all_feeds()[:30]

        @st.cache_data(ttl=86400)
        def load_translations(titles_tuple):
            return rss_reader.batch_translate_titles(list(titles_tuple))
        @st.cache_data(ttl=86400)
        def get_article_text_for_count(link: str, needs_conversion: bool):
            content = rss_reader.fetch_article_content(link, convert_to_simplified=needs_conversion)
            if content and content.get('text'):
                return content['text']
            return ""

        @st.cache_data(ttl=86400)
        def get_vocab_count_for_article(text: str):
            vocab = rss_reader.get_vocabulary_set()
            matches = rss_reader.get_vocabulary_matches(text, vocab)
            return len(matches)

        if 'articles_loaded' not in st.session_state:
            st.session_state.articles_loaded = False

        if not st.session_state.articles_loaded:
            st.markdown(render_shimmer_loaders(), unsafe_allow_html=True)
            articles = load_feeds()

            if articles:
                titles = [a['title'] for a in articles]
                translations = load_translations(tuple(titles))
                st.session_state.title_translations = translations
                st.session_state.cached_articles = articles
                st.session_state.articles_loaded = True
                st.rerun()
            else:
                st.warning("No articles found. Check your internet connection or try refreshing.")
            st.stop()

        articles = st.session_state.get('cached_articles', [])
        if articles:
            free_count = sum(1 for a in articles if a.get('is_free', False))
            st.caption(f"Found {len(articles)} articles ({free_count} free, {len(articles) - free_count} paywalled)")

            num_cols = 3
            rows = [articles[i:i+num_cols] for i in range(0, len(articles), num_cols)]

            for row_idx, row_articles in enumerate(rows):
                cols = st.columns(num_cols)
                for col_idx, article in enumerate(row_articles):
                    with cols[col_idx]:
                        i = row_idx * num_cols + col_idx
                        is_free = article.get('is_free', False)
                        feed_name = html.escape(article.get('feed_name', 'Unknown'))
                        title_key = article['title']
                        title_escaped = html.escape(article['title'])
                        favicon_url = get_favicon_url(article.get('feed_name', 'Unknown'))
                        pub_date = html.escape(article.get('published', '')[:16] if article.get('published') else '')

                        pill_class = 'pill-free' if is_free else 'pill-paywall'
                        pill_text = 'Free' if is_free else 'Paywall'

                        english_html = ''
                        pinyin_html = ''
                        if title_key in st.session_state.title_translations:
                            trans = st.session_state.title_translations[title_key]
                            pinyin_escaped = html.escape(trans.get("pinyin", ""))
                            english_escaped = html.escape(trans.get("english", ""))
                            english_html = f'<div class="news-card-english">{english_escaped}</div>'
                            pinyin_html = f'<div class="news-card-pinyin">{pinyin_escaped}</div>'

                        if not is_free:
                            vocab_badge = '<div class="vocab-count-unavailable">Word Count Unavailable</div>'
                        else:
                            article_text = get_article_text_for_count(article['link'], article.get('needs_conversion', False))
                            if article_text:
                                vocab_count = get_vocab_count_for_article(article_text)
                                vocab_badge = f'<div class="vocab-count-badge"><span class="count">{vocab_count}</span> words</div>' if vocab_count > 0 else ''
                            else:
                                vocab_badge = '<div class="vocab-count-unavailable">Word Count Unavailable</div>'

                        card = f'<div class="news-card">'
                        card += f'<span class="pill-badge {pill_class}">{pill_text}</span>'
                        card += f'<div class="news-card-header"><img src="{favicon_url}" class="source-favicon" alt="{feed_name}"><span class="source-name">{feed_name}</span></div>'
                        # Show English translation if available, otherwise show placeholder
                        if english_html:
                            card += english_html
                        else:
                            card += f'<div class="news-card-english" style="opacity: 0.6; font-style: italic;">Translation unavailable</div>'
                        card += f'<div class="news-card-title">{title_escaped}</div>'
                        card += f'<div class="news-card-footer"><span class="news-card-date">{pub_date}</span>{vocab_badge}</div>'
                        card += '</div>'
                        st.markdown(card, unsafe_allow_html=True)

                        if is_free:
                            if st.button("📖 Read", key=f"read_{i}", use_container_width=True):
                                st.session_state.selected_article = article
                                st.rerun()
                        else:
                            st.link_button("🔗 Open", article['link'], use_container_width=True)
        else:
            st.warning("No articles found. Check your internet connection or try refreshing.")

    else:
        article = st.session_state.selected_article
        feed_name = article.get('feed_name', '')

        if 'word_translations' not in st.session_state:
            st.session_state.word_translations = {}
        if 'reader_settings' not in st.session_state:
            st.session_state.reader_settings = get_reader_settings()

        rs = st.session_state.reader_settings

        floating_header_css = f'''
        <style>
        .reading-body p {{
            font-size: {rs['font_size']}px !important;
            line-height: {rs['line_height']} !important;
        }}
        </style>
        '''
        st.markdown(floating_header_css, unsafe_allow_html=True)

        col_back, col_link, col_spacer, col_aa = st.columns([1.5, 1.5, 5, 1])
        with col_back:
            if st.button("← Back", use_container_width=True):
                st.session_state.selected_article = None
                st.session_state.article_content = None
                st.session_state.word_translations = {}
                st.rerun()
        with col_link:
            st.link_button("View Original ↗", article['link'], use_container_width=True)
        with col_aa:
            with st.popover("Aa"):
                st.markdown("**Font Size**")
                new_font_size = st.slider("Size", 16, 28, rs['font_size'], 1, key="font_slider", label_visibility="collapsed")
                st.markdown("**Line Spacing**")
                new_line_height = st.slider("Spacing", 1.4, 2.4, rs['line_height'], 0.1, key="line_slider", label_visibility="collapsed")

                if (new_font_size != rs['font_size'] or new_line_height != rs['line_height']):
                    new_settings = {
                        'font_size': new_font_size,
                        'line_height': new_line_height,
                        'theme': rs['theme']
                    }
                    st.session_state.reader_settings = new_settings
                    save_reader_settings(new_settings)
                    st.rerun()

        badge = get_source_badge(feed_name)
        pub_date = article.get('published', '')[:20] if article.get('published') else ''
        favicon_url = get_favicon_url(feed_name)

        title_key = article['title']
        if title_key not in st.session_state.title_translations:
            translation = rss_reader.translate_title(article['title'])
            if translation:
                st.session_state.title_translations[title_key] = translation

        if st.session_state.article_content is None:
            shimmer_article = '''
            <div class="reading-container">
                <div class="shimmer-line medium" style="height: 28px; margin-bottom: 20px;"></div>
                <div class="shimmer-line short" style="height: 14px;"></div>
                <div class="shimmer-line" style="margin-top: 32px;"></div>
                <div class="shimmer-line medium"></div>
                <div class="shimmer-line"></div>
                <div class="shimmer-line short"></div>
            </div>
            '''
            loading_placeholder = st.empty()
            loading_placeholder.markdown(shimmer_article, unsafe_allow_html=True)

            needs_conversion = article.get('needs_conversion', False)
            content = rss_reader.fetch_article_content(article['link'], convert_to_simplified=needs_conversion)
            st.session_state.article_content = content
            loading_placeholder.empty()

        content = st.session_state.article_content

        if content and content.get('text'):
            vocabulary = rss_reader.get_vocabulary_set()
            matches = rss_reader.get_vocabulary_matches(content['text'], vocabulary)

            if not st.session_state.word_translations:
                with st.spinner("Loading translations..."):
                    st.session_state.word_translations = rss_reader.get_article_translations(content['text'], vocabulary)

            col_article, col_vocab = st.columns([3, 1])

            with col_article:
                trans_html = ""
                if title_key in st.session_state.title_translations:
                    trans = st.session_state.title_translations[title_key]
                    pinyin_escaped = html.escape(trans.get("pinyin", ""))
                    english_escaped = html.escape(trans.get("english", ""))
                    trans_html = f'<div style="margin-top: 12px; font-size: 14px;"><span style="color: #6b7280; font-style: italic;">{pinyin_escaped}</span></div>'
                    trans_html += f'<div style="margin-top: 6px; font-size: 15px; font-weight: 500; color: #374151;">{english_escaped}</div>'

                source_html = f'<div style="display: flex; align-items: center; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.06);">'
                source_html += f'<img src="{favicon_url}" style="width: 16px; height: 16px; border-radius: 3px;">'
                source_html += f'<span style="font-size: 13px; color: #6b7280;">{html.escape(feed_name)} • {html.escape(pub_date)}</span></div>'

                highlighted_text = rss_reader.highlight_all_words_html(content['text'], vocabulary, st.session_state.word_translations)
                import re
                normalized_text = highlighted_text.replace('\r\n', '\n')
                normalized_text = re.sub(r'\n\s*\n+', '\n\n', normalized_text)
                paragraphs = normalized_text.split('\n\n')
                body_html = '<div class="reading-body">'
                for para in paragraphs:
                    cleaned_para = re.sub(r'\s*\n\s*', ' ', para).strip()
                    if cleaned_para:
                        body_html += f'<p>{cleaned_para}</p>'
                body_html += '</div>'

                title_escaped = html.escape(article["title"])
                article_html = f'<div class="reading-container"><div class="reading-title">{title_escaped}</div>'
                article_html += trans_html
                article_html += source_html
                article_html += '<div style="height: 32px;"></div>'
                article_html += body_html
                article_html += '</div>'
                st.markdown(article_html, unsafe_allow_html=True)

            with col_vocab:
                all_translated_words = set(st.session_state.word_translations.keys())
                new_words = [w for w in all_translated_words if w not in vocabulary and len(w) >= 2]
                new_words = sorted(new_words, key=lambda w: content['text'].find(w) if w in content['text'] else 999)[:30]

                if matches:
                    vocab_html = f'<div class="vocab-panel">'
                    vocab_html += f'<div class="vocab-panel-header">Your Vocabulary ({len(matches)})</div>'
                    vocab_html += '<div class="vocab-panel-list">'
                    for word in matches[:30]:
                        trans = st.session_state.word_translations.get(word, {})
                        pinyin = html.escape(trans.get('pinyin', ''))
                        english = html.escape(trans.get('english', ''))
                        vocab_html += f'<div class="vocab-panel-item">'
                        vocab_html += f'<div class="vocab-panel-chinese">{html.escape(word)}</div>'
                        vocab_html += f'<div class="vocab-panel-pinyin">{pinyin}</div>'
                        vocab_html += f'<div class="vocab-panel-english">{english}</div>'
                        vocab_html += '</div>'
                    if len(matches) > 30:
                        vocab_html += f'<div style="color: #6b7280; font-size: 12px; padding: 12px 8px;">+{len(matches) - 30} more words</div>'
                    vocab_html += '</div></div>'
                    st.markdown(vocab_html, unsafe_allow_html=True)

                if new_words:
                    st.markdown("---")
                    st.markdown(f"**New Words** ({len(new_words)})")

                    for idx, word in enumerate(new_words[:15]):
                        trans = st.session_state.word_translations.get(word, {})
                        pinyin = trans.get('pinyin', '')
                        english = trans.get('english', '')

                        if not pinyin or not english:
                            continue

                        word_escaped = html.escape(word)
                        pinyin_escaped = html.escape(pinyin)
                        english_escaped = html.escape(english)

                        col_word, col_btn = st.columns([4, 1])
                        with col_word:
                            st.markdown(f"**{word_escaped}** <span style='color:#6b7280;font-size:12px;'>{pinyin_escaped}</span><br><span style='font-size:13px;'>{english_escaped}</span>", unsafe_allow_html=True)
                        with col_btn:
                            if st.button("➕", key=f"add_{idx}_{word}", help=f"Add to deck"):
                                result = database.add_word(word, pinyin, english)
                                if result['status'] == 'added':
                                    fsrs_engine.sync_cards()
                                    st.success("Added!")
                                    st.rerun()
                                else:
                                    st.info("Already in deck")

                    if len(new_words) > 15:
                        st.caption(f"+{len(new_words) - 15} more new words")

                if not matches and not new_words:
                    st.caption("No vocabulary words found in this article.")
        else:
            st.warning("Could not load article content.")
            if article.get('summary'):
                st.markdown("**Summary from feed:**")
                st.markdown(article['summary'])
            st.link_button("Read on original site", article['link'])

elif st.session_state.current_page == 'library':
    st.markdown('<div class="page-title">Library</div>', unsafe_allow_html=True)
    st.markdown('<div class="page-subtitle">Manage your vocabulary collection</div>', unsafe_allow_html=True)

    total_words = database.get_word_count()
    st.metric("Total Words", total_words)

    library_tab1, library_tab2 = st.tabs(["📋 Vocabulary", "📤 Upload"])

    with library_tab1:
        all_words = database.get_all_words()

        if all_words:
            df_display = pd.DataFrame(all_words)

            columns_to_edit = ['id', 'simplified', 'pinyin', 'english', 'lesson_number']
            columns_present = [col for col in columns_to_edit if col in df_display.columns]
            df_edit = df_display[columns_present].copy()

            st.markdown("**Edit entries directly in the table below. Click 'Save Changes' when done.**")

            edited_df = st.data_editor(
                df_edit,
                use_container_width=True,
                height=400,
                num_rows="fixed",
                disabled=["id"],
                column_config={
                    "id": st.column_config.NumberColumn("ID", width="small"),
                    "simplified": st.column_config.TextColumn("Chinese", width="medium"),
                    "pinyin": st.column_config.TextColumn("Pinyin", width="medium"),
                    "english": st.column_config.TextColumn("English", width="medium"),
                    "lesson_number": st.column_config.NumberColumn("Lesson", width="small"),
                },
                key="vocab_editor"
            )

            if st.button("Save Changes", type="primary"):
                changes_made = 0
                for idx, row in edited_df.iterrows():
                    original = df_edit.iloc[idx]
                    if not row.equals(original):
                        lesson_num = None if pd.isna(row['lesson_number']) else int(row['lesson_number'])
                        database.update_word(
                            word_id=int(row['id']),
                            simplified=str(row['simplified']),
                            pinyin=str(row['pinyin']),
                            english=str(row['english']),
                            lesson_number=lesson_num
                        )
                        changes_made += 1
                if changes_made > 0:
                    st.success(f"Saved {changes_made} changes!")
                    st.rerun()
                else:
                    st.info("No changes detected.")

            st.divider()

            with st.expander("⚠️ Danger Zone"):
                st.warning("This will permanently delete all vocabulary from the database.")
                if st.button("Clear Database", type="secondary"):
                    database.clear_database()
                    st.success("Database cleared.")
                    st.rerun()
        else:
            st.info("No vocabulary entries yet. Use the Upload tab to add vocabulary!")

    with library_tab2:
        st.markdown("""
        Upload a CSV file with your vocabulary. The file should have these columns:
        - **Simplified** - Chinese characters (simplified)
        - **Pinyin** - Pronunciation in pinyin
        - **English** - English translation
        - **Lesson Number** - Optional lesson number for organization
        """)

        uploaded_file = st.file_uploader("Choose a CSV file", type="csv")

        if uploaded_file is not None:
            try:
                df = pd.read_csv(uploaded_file)

                df.columns = df.columns.str.lower().str.strip().str.replace(' ', '_')

                required_cols = ['simplified', 'pinyin', 'english']
                missing_cols = [col for col in required_cols if col not in df.columns]

                if missing_cols:
                    st.error(f"Missing required columns: {', '.join(missing_cols)}")
                else:
                    st.success(f"Found {len(df)} vocabulary entries - Review them below before importing")

                    show_all = st.checkbox("Show all entries", value=False)
                    if show_all:
                        st.dataframe(df, use_container_width=True, height=400)
                    else:
                        st.dataframe(df.head(20), use_container_width=True)
                        if len(df) > 20:
                            st.caption(f"Showing first 20 of {len(df)} entries.")

                    if st.button("Import Vocabulary", type="primary"):
                        progress_bar = st.progress(0)
                        status_text = st.empty()

                        total = len(df)
                        added_count = 0
                        skipped_entries = []

                        for idx, row in df.iterrows():
                            simplified = str(row['simplified']).strip()
                            pinyin = str(row['pinyin']).strip()
                            english = str(row['english']).strip()
                            lesson_number = row.get('lesson_number', None)

                            if pd.isna(lesson_number):
                                lesson_number = None
                            else:
                                lesson_number = int(lesson_number)

                            status_text.text(f"Importing: {simplified} ({idx + 1}/{total})")

                            result = database.add_word(
                                simplified=simplified,
                                pinyin=pinyin,
                                english=english,
                                lesson_number=lesson_number
                            )

                            if result['status'] == 'added':
                                added_count += 1
                            else:
                                skipped_entries.append({'simplified': simplified, 'pinyin': pinyin, 'english': english})

                            progress_bar.progress((idx + 1) / total)

                        status_text.text("")

                        if added_count > 0:
                            st.success(f"Successfully imported {added_count} new vocabulary entries!")

                        if skipped_entries:
                            st.warning(f"Skipped {len(skipped_entries)} duplicate entries:")
                            skipped_df = pd.DataFrame(skipped_entries)
                            st.dataframe(skipped_df, use_container_width=True, height=min(200, len(skipped_entries) * 35 + 38))

                        if added_count > 0:
                            fsrs_engine.sync_cards()
                            st.rerun()

            except Exception as e:
                st.error(f"Error reading CSV: {str(e)}")

elif st.session_state.current_page == 'settings':
    st.markdown('<div class="page-title">Settings</div>', unsafe_allow_html=True)
    st.markdown('<div class="page-subtitle">Configure your learning experience</div>', unsafe_allow_html=True)

    st.markdown("### Daily Limits")

    max_new = fsrs_engine.get_max_new_cards_per_day()
    new_limit = st.slider(
        "Max new cards per day",
        min_value=1,
        max_value=50,
        value=max_new,
        help="Limit how many new (never reviewed) cards appear each day"
    )
    if new_limit != max_new:
        fsrs_engine.set_max_new_cards_per_day(new_limit)
        st.success("Setting saved!")
        st.rerun()

    max_due = fsrs_engine.get_max_due_cards_per_day()
    due_limit = st.number_input(
        "Max due cards per day",
        min_value=5,
        max_value=200,
        value=max_due,
        step=1,
        help="Hard cap on the number of due cards shown and scheduled per day"
    )
    if due_limit != max_due:
        fsrs_engine.set_max_due_cards_per_day(int(due_limit))
        st.success("Setting saved!")
        st.rerun()

    st.markdown("### Audio")

    current_autoplay = database.get_setting('audio_autoplay', 'true') == 'true'
    autoplay_toggle = st.toggle(
        "Auto-play audio on Production cards",
        value=current_autoplay,
        help="Automatically play Chinese pronunciation when English→Chinese cards are flipped"
    )
    if autoplay_toggle != current_autoplay:
        database.set_setting('audio_autoplay', 'true' if autoplay_toggle else 'false')
        st.success("Setting saved!")
        st.rerun()

    st.markdown("### Statistics")
    total_cards = fsrs_engine.get_total_cards_count()
    total_words = database.get_word_count()
    cache_count = database.get_word_cache_count()

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Vocabulary", total_words)
    with col2:
        st.metric("Flashcards", total_cards)
    with col3:
        st.metric("Translation Cache", cache_count)

st.markdown("---")
st.caption("Chinese Tutor • Built for language maintenance")
