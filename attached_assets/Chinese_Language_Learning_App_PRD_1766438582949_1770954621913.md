# PRD

## Introduction

Retaining foreign language competency is challenging, particularly outside the support of an academic and formal language-learning environment. Without concerted efforts to maintain proficiency, learners quite quickly lose foreign language skills and experience great difficulty in rebuilding them [citations needed].

My own experience learning Mandarin is exemplary of this. After studying Chinese in high school (2012-2016), I took one year off from studying before resuming it again as a sophomore in college. During that year, language loss was significant, despite some attempts at maintaining it through a weekly Chinese reading course. My language skills recovered and furthered through minoring in the language, continuing study between 2017 and 2020. However, with minimal engagement after graduating through Spring 2025, language loss was significant. It took more than a full semester of language study at MIT for me to feel that my language skills have returned to collegiate levels. With graduation from MIT approaching, I am concerned that I will lose the learning gains I have made with 14 years engaged with Mandarin and seek to build an app that will help maintain proficiency in everyday life as a full-time worker. 

## Purpose

This app is primarily intended to bridge the gap between academic Chinese study and professional-level fluency, maintaining and gradually increasing my Chinese language proficiency upon returning to work full-time. It is designed to fit into my daily life and routines, engage me with Chinese content congruent with my interests, and build upon the vocabulary, grammar, and other language skills I have learned at MIT and beyond, incorporating reading, writing, and speaking practice (simplified Chinese only). Naturally, the app is also grounded in science-backed strategies for language retention and expansion. This is a product meant to grow with me. 

## Pedagogical Pillars

Several pedagogies have been shown to be effective for language learning and retention:

- **Spaced Retrieval Practice**: Regularly recalling words and structures at increasing intervals (spaced retrieval) leads to far better long‑term retention than massed study or simple rereading. Testing yourself (flashcards, cloze deletions, quizzes) strengthens memory more than restudying because retrieval itself consolidates the knowledge. [citation needed]
- **Input Flood:** Input flood is a technique in which learners are immersed in language input that contains an unusually high frequency of a specific target form—be it grammatical (like the past tense) or lexical (such as adjectives of opinion). Unlike mechanical drills, the input is meaning-focused and embedded within communicative or authentic texts (e.g., dialogues, articles, stories, videos). The goal is not to overtly teach the rule at first, but to increase the salience of the form through sheer repetition in context. To maximise effectiveness, input flood is often combined with a “focus on form”—a subtle pedagogical intervention (like underlining or enunciating with more emphasis, brief questioning, gapping the target items in the text for a dictation asking the students to track all the occurrences of the target structure) that draws learners’ attention to the target structure. This blend of frequent exposure and guided noticing makes the input both engaging and form-rich without being intrusive.
- **Pushed Output Tasks:** Pushed output refers to tasks that compel learners to produce language that stretches them beyond memorised or habitual patterns. These tasks don’t just ask students to “say something”; they require precision, elaboration, or reformulation — all of which activate deeper processing. Think of a learner trying to explain a past holiday experience and realising they need the past perfect to clarify sequencing. Or one engaging in a debate who must reach for modal verbs to express nuance. That gap—the moment of linguistic struggle—is where the learning happens.
- **Interaction and Corrective Feedback:** Interaction promotes both input and output, creating opportunities for noticing and repair. Interaction with feedback enhances grammatical development, especially when learners are developmentally ready. The feedback must be timely and context-sensitive to be effective. Use jigsaw tasks, role plays, or problem-solving activities that require real-time negotiation. When learners make errors, use clarification requests (“Sorry? Did you mean…?”), metalinguistic prompts (“What’s the correct verb form?”), or recasts (rephrasing the error correctly). Encourage peer correction using sentence starters or correction cards to keep feedback structured and supportive.
- **Text Reconstruction and Sentence Processing Tasks:** Text reconstruction tasks involve learners working with fragmented or incomplete texts to rebuild coherent language structures. This includes techniques like jigsaw reading/listening, [dictogloss](https://www.teachingenglish.org.uk/professional-development/teachers/knowing-subject/d-h/dictogloss) (where students reconstruct a short text after listening), and sentence puzzles (where students reassemble jumbled sentences). These tasks engage learners in noticing, collaboration, and deep syntactic processing.
- **Lexical Chunks and Formulaic Sequences Practice:** This technique involves explicit instruction and practice with high-frequency lexical bundles and formulaic expressions — sequences of words that native speakers use regularly and automatically. These might include collocations (e.g., “make a decision”), discourse markers (“on the other hand”), or sentence stems (“I think it’s important to…”). Such chunks help learners produce language more fluently and naturally by reducing cognitive load and supporting message construction. Learners who master common chunks are better able to focus on meaning and interaction rather than grammar assembly in real time. Studies also show that teaching collocations explicitly improves retention, fluency, and idiomaticity
- **Metalinguistic Awareness Tasks:** Metalinguistic awareness tasks prompt learners to reflect on language form, structure, and function consciously. These tasks ask learners to compare, explain, or reformulate language, often encouraging them to notice patterns, articulate rules, or hypothesize about usage. This may take the form of grammar explanation discussions, sentence transformation challenges, or error analysis activities. Use contrastive grammar tasks (e.g., comparing two similar sentences and discussing which is correct and why or comparing the L1 and L2 equivalents, guiding the students to notice the differences), guided discovery activities, or collaborative error analysis. Encourage learners to explain their reasoning, reflect on grammar explanations, or reformulate incorrect utterances. These tasks can be integrated into pair work or as a reflective follow-up to productive tasks.

## Market Landscape

### Existing Products

The market for language-learning products is large [citation]. For Chinese, specifically, it can be divided into the following categories:

- **Content-Driven Platforms (Input-Focused Immersion)**
    - **The Chairman's Bao (TCB) / DuChinese**: Specifically focuses on graded news articles and short stories with native audio, making them the closest direct competitors for news-based reading.
    - **Readibu / LingQ**: Allows intermediate and advanced users to "mine" real-world web content, such as web novels or news sites, for learning.
    - **Read Bean**: An AI-powered graded reader that converts authentic articles (culture, tech, commerce) into lessons.
    - **FluentU**: Uses real Chinese media (movie clips, music videos) with interactive subtitles to provide authentic context.
- **Comprehensive Learning Apps (Structured Curricula)**
    - **Duolingo**: Dominates the market with gamification but is often limited to beginner/lower-intermediate levels (HSK 3).
    - **HelloChinese / LingoDeer**: Often preferred over Duolingo for Mandarin specifically due to better grammar explanations and character writing practice.
    - **ChinesePod**: A massive library of situational audio lessons ranging from survival Chinese to advanced "media" analysis.
- **Specialized Flashcard & Utility Systems (Active Recall)**
    - **Anki / Quizlet**: Powerful, customizable SRS tools; Anki is favored for "sentence mining" from news sources.
    - **Pleco**: The industry-standard dictionary; its paid flashcard module is the primary maintenance tool for most advanced learners.
    - **Skritter**: The gold standard for maintaining character handwriting skills through specialized SRS.
- **Social & Tutoring Networks (Production Practice)**
    - **iTalki / Preply**: Platforms for 1-on-1 sessions with professional tutors, essential for maintaining high-level conversational nuance.
    - **HelloTalk / Tandem**: Social-style networks for language exchange via text, voice, and "moments" (social feeds).

### Key Issues

Though there are numerous offerings, several problems exist within the current solution set:

1. **Lack of affordable upper intermediate and advanced resources:** Most products cater towards beginner study, not suitable for someone with 14 years’ experience with the language. Upper intermediate and advanced learners typically need private tutors, which can be cost prohibitive.
2. **Not based on existing learning**: Formal language learners have a corpus of knowledge (specific grammar, vocabulary, etc.) that they learned and seek to retain. Besides bespoke flashcard systems, language learning products do not build off the learners’ existing language foundation. 
3. **Insufficient interest-based context personalization**: While some products provide stories and news articles tagged to and/or recommended based on certain interests, the level of personalization is often not personalized enough to the student to be sufficiently compelling. Interest is key to motivation, and independent learners (those outside academic environments or formal language learning courses) need significant motivation to retain language skills. 
4. **Reliance on gamification**: Language learning apps often use gamification to motivate students and help them retain information. While studies show gamification can be an effective approach to language-learning, it is not effective for all students and may be a disadvantage for some [[Luo 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10135444/)]. 

## Problem Alignment

### **The Problem**

Maintaining foreign language skills after formal academic study is challenging, particularly for intermediate to advanced learners of Chinese. The best existing solutions are continued language classes and tutors, but these are time-intensive and costly. Other solutions, like Chinese language learning apps, are not tailored to higher-level learners, do not build upon the students’ existing corpus of educational material (i.e., previously learned vocabulary and grammatical patterns), struggle to sufficiently personalize to students’ interests (which is key to fostering intrinsic motivation for continued study), and often overly rely on gamification, which does not appeal to all students. 

### **High-level Approach**

This app uses a knowledge base (”corpus”) of the students’ previously learned vocabulary and grammar, specific interests, and real-world Chinese-language content in a pedagogically aligned daily language learning solution. Multi-format content supports practice reading, writing, listening, and speaking. 

The foundation of the app is twofold: spaced retrieval practice, and corpus-based news feed. 

- **Spaced retrieval practice**: The app maintains a database of vocabulary and grammar, both pre-existing content the user uploads and new content over time, and provides daily practice with the language through a spaced retrieval flashcard system.
- **Smart RSS Feed**: The Smart RSS Feed aggregates authentic, native-level reporting from reputable outlets like *NYT Chinese* and *WSJ Chinese*, prioritizing content that mirrors the user’s corpus of language knowledge and personal interests. By cross-referencing articles against the user’s corpus, the feed intelligently ranks and highlights text based on the density of target lexical chunks—such as **根深蒂固** (deep-rooted) or **缓解** (alleviate).
- **Progress measurement:** Leveraging the spaced retrieval system and quizzing, the app will measure the user’s ability to maintain their current level (i.e., how much previously learned material they are proficient in) and growth (e.g., number of new words learned).

Such features incorporate other pedagogically informed language learning methods like input flood, text reconstruction, metalinguistic awareness, and pushed output. 

### **Success Metrics**

The app must be meet certain technical requirements and, from an engagement perspective, achieve complementary goals of fostering intrinsic motivation in continuing to study the language and fostering Chinese proficiency. These will be measured as follows:

**Technical** **Performance**

- **Corpus Match Density**: The average number of matches per article from the corpus (e.g., how often terms like **"缓解"** (huǎnjiě) or **"按照"** (ànzhào) appear in the daily feed).
    - *Baseline Target:* At least [5 "High-Value" matches per 500-character article].
- **RSS Extraction Success**: The percentage of articles successfully scraped and "cleaned" for reading without paywall or formatting errors.
    - *Target:* >[90]% success rate for NYT and WSJ Chinese sources.

**Engagement**

- **Weekly Reading Volume**: Total number of native Chinese articles read to completion.
    - *Baseline Target:* 3 articles per week (one every other weekday).
- **SRS Consistency**: The percentage of "Due" flashcards reviewed each day.
    - *Baseline Target:* 100% completion of cards scheduled by the FSRS algorithm.
- **Mining Rate**: The number of new "Contextual Cards" saved per article read.
    - *Tracking Metric:* Indicates if the content is at the right "n+1" difficulty level.

**Pedagogical Efficacy**

- **Retrieval Stability (SRS Accuracy)**: The percentage of cards marked "Good" or "Easy" during review.
    - *Target:* 80–90% accuracy (indicating the Spaced Retrieval is optimally timed).
- **Output "Pushed" Rate**: The frequency of completing the optional "Executive Summary" task after a reading session.
    - *Target:* At least 1 summary written per week to practice Pushed Output.
- **Metalinguistic Engagement**: Number of times the "Nuance Sidebar" is consulted per [1,000] characters read.
    - *Tracking Metric:* Measures active "noticing" and depth of processing.

## Solution Alignment

### **Key Features**

| **Feature** | **Description** | **Priority** |
| --- | --- | --- |
| Corpus Manager | Imports a structured CSV (Chinese, Pinyin, English, Translation, Lesson) containing coprus of previously studied vocabulary and grammar and stores information in central database | P0 |
| SRS | A daily review interface using FSRS/SRS to prevent attrition of the terms and vocabularly in the corpus. | P0 |
| RSS Reader | Scrapes NYT/WSJ Chinese and bolds/highlights terms from the CSV (e.g., 缓解, 按照) found in the article text. | P0 |
| Grammar Pattern Matcher | Scans articles for specific grammatical structures (e.g., 不仅...而且...) identified in your grammar CSV. | P1 |
| Nuance & Syntax Sidebar | Gemini-powered breakdown of complex sentence structures (Text Reconstruction logic) and nuance between words and contextual differences.  | P1 |
| Contextual minining | One-tap functionality to add new native sentences and vocabulary discovered in news back into the SRS loop. | P1 |
| Smart RSS Reader | Scrapes NYT/WSJ Chinese and bolds/highlights terms from the CSV (e.g., 缓解, 按照) found in the article text, prioritizing articles containing "due" SRS terms. | P2 |
| Vocabulary Clustering | Back-end categorization and tagging of vocabulary based on specific themes, topics, etc. (e.g., “economics,” “artificial intelligence,” “marriage & family”, etc.) | P3 |

### **Key Flows & User Stories**

**Flow 1: Setting the Foundation (Corpus Ingestion)**

- **User Story:** As an advanced learner with a decade of fragmented notes, I want to upload my MIT and high school vocabulary and grammar in bulk so that the app understands my exact "Permastore" baseline.
- **The Flow:**
    1. User prepares a CSV with columns: `Chinese`, `Pinyin`, `English`, and `Lesson Number`.
    2. User navigates to the "Corpus Manager" and uploads the file.
    3. The system parses the data (e.g., recognizing **按照** from Lesson 1 or **缓解** from Lesson 1) and initializes an SRS profile for each entry.

**Flow 2: The Daily Pulse (Maintenance SRS)**

- **Flow 2: The Daily Pulse (Multi-Directional SRS)**
- **User Story:** I want a varied review session that tests my ability to recognize characters, produce Chinese from English, and use words in context.
- **The Logic:** For every entry in the corpus, the system generates **three sibling card types**. FSRS manages the stability of each independently.

| **Card Type** | **Front (Prompt)** | **Back (Reveal)** | **Pedagogical Goal** |
| --- | --- | --- | --- |
| Recognition | Simplified Chinese characters only. | Pinyin + English Translation + Example Sentence. | Visual decoding and semantic link. |
| Production | English definition/translation. | Simplified Chinese characters + Pinyin + Example Sentence. | Active recall and character writing/recall. |
| Cloze Deletion | A sentence with the target word/pattern hidden: “我们要[ ? ]贫困问题。” (sentence with cloze deleition generated by Gemini 3 Pro) | Simplified Chinese word (缓解) + Pinyin + Full sentence translation. | Contextual encoding and syntactic use. |
- **The Flow:**
    1. User opens "Daily Pulse."
    2. System pulls "Due" cards (Vocabulary, Grammar, or Cloze).
    3. User sees the Front based on the direction 
    4. User attempts recall, Taps "Reveal", Self-grades (Again, Hard, Good, Easy).
    5. FSRS calculates the next interval.

**Flow 3: The Professional Input Flood (News Reading)**

- **User Story:** I want to read a *New York Times* article about the Chinese economy and see my professional vocabulary highlighted to reinforce my "Noticing" skills.
- **The Flow:**
    1. User selects an article from the RSS feed (e.g., a piece on the "Liquidity Crisis" or "Demographics").
    2. The app fetches the full text and cross-references it against the corpus.
    3. Known terms like **保障** (guarantee) or **导致** (lead to) are bolded or highlighted in the text.
    4. User taps a highlighted word to see their own English definition, or taps a new word (not in the corpus) to "Mine" it.

**Flow 4: Deep Contextual Analysis (Gemini Sidebar)**

- **User Story:** When I encounter a complex sentence or a synonym like **改善** vs. **转变**, I want an AI explanation that respects my advanced level.
- **The Flow:**
    1. User highlights a confusing sentence or a specific word in an article.
    2. User triggers the Nuance Sidebar.
    3. Gemini provides an analysis: *"The author used **改善** (improve) here to imply a gradual positive shift in quality, whereas **转变** (transform) would imply a more fundamental change in nature."*
    4. The explanation is optionally saved as a "Nuance Note" on the corresponding SRS card.

### **Technical Strategy**

- **Frontend**: **Streamlit** (Python-based). It is ideal for "vibe coding" because it provides mobile-responsive UI components without requiring HTML/CSS knowledge.
- **Backend**: Python (FastAPI) hosted on Replit.
- **Intelligence Layer**: Gemini 3 Pro API for all metalinguistic analysis, sentence reconstruction generation, and news summarization.
- **Database**: **SQLite**. This will store the Unified Corpus and SRS states (Stability, Difficulty, and Retrievability).
- **NLP Tools**: `jieba` for Chinese word segmentation and `py-fsrs` for the spaced repetition math.
- **RSS & Scraping**: `feedparser` for fetching headlines and `newspaper4k` for extracting the body text from NYT/WSJ Chinese articles.
- **Authentication**: Use of local session cookies stored as Replit Secrets to bypass NYT/WSJ paywalls for personal use.

### **Open Issues & Key Decisions**

- **FSRS Complexity vs. Value:** Is the mathematical overhead of FSRS worth it for a personal project, or is a simpler SM-2 (Anki-style) algorithm sufficient for a "vibe coder"?
- **Grammar Pattern Schema:** How to best represent non-linear grammar in a CSV (e.g., **不仅...而且...**) so the "Grammar Matcher" can find it in a 1,000-character article.
- **Paywall Persistence:** Deciding on a robust method to keep NYT/WSJ session cookies fresh in the Replit environment without manual intervention every few days.

## **Timeline & Roadmap**

- **Phase 1: The Core Pulse (Weeks 1–2)**
    - Build CSV uploader for the corpus.
    - Implement basic FSRS review screen (Vocabulary only).
- **Phase 2: The Reading Loop (Weeks 3–4)**
    - Integrate NYT/WSJ RSS feeds.
    - Develop the "Noticing" engine to highlight known terms in news text.
    - Launch the "Mining" tool to turn news sentences into flashcards.
- **Phase 3: The Intelligence Layer (Weeks 5–6)**
    - Integrate Gemini for the Nuance Sidebar.
    - Add Grammar Pattern Matching.
    - Implement "Smart Ranking" to surface articles with the highest "Due" word density.

### **Questions & Answers**