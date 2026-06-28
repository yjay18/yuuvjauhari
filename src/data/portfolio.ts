// Single source of truth for all site content.
// Facts here are restructured for presentation only — nothing is fabricated.

export const profile = {
  name: "Yuuv Jauhari",
  location: "Dublin, Ireland",
  email: "jauhariyuuv@gmail.com",
  linkedin: "https://www.linkedin.com/in/yuuv-jauhari-66923a168",
  github: "https://github.com/yjay18",
  githubHandle: "yjay18",
  role: "AI/ML Engineer · NLP & LLM Systems",
  shortPitch:
    "AI/ML engineer building NLP systems, clinical ML pipelines, and local-first LLM products.",
  headline: "I build AI systems that move from research prototypes to usable products.",
  degree: "Integrated MSc Computer Science, Trinity College Dublin",
  degreeNote: "Overall distinction",
  availability: "Open to new roles",
  cvPath: "Yuuv_Jauhari_Resume.pdf",
  lastUpdated: "June 2026",
};

export const targetRoles = [
  "AI/ML Engineer",
  "NLP Engineer",
  "LLM / Applied AI Engineer",
  "NLP Data Scientist",
  "Software Engineer",
  "Research-to-production AI",
];

// Understated credibility row — wordmarks, not a loud logo wall.
export const credibility: { label: string; note?: string; href?: string }[] = [
  { label: "Trinity College Dublin", note: "MSc · Distinction" },
  { label: "Quantexa", note: "NLP Data Scientist" },
  { label: "Oracle" },
  { label: "Fathom" },
  { label: "COLM 2025", note: "Accepted paper", href: "https://arxiv.org/abs/2510.04368" },
  { label: "GitHub", note: "@yjay18", href: "https://github.com/yjay18" },
];

export type SkillGroup = {
  title: string;
  caption: string;
  skills: string[];
  appliedIn: { slug: string; label: string }[];
};

export const skillGroups: SkillGroup[] = [
  {
    title: "AI / ML Systems",
    caption: "Modeling, calibration, and evaluation built for deployment.",
    skills: [
      "PyTorch",
      "scikit-learn",
      "XGBoost",
      "SHAP",
      "Threshold calibration",
      "Evaluation design",
      "Clinical ML",
      "Sparse models",
    ],
    appliedIn: [
      { slug: "icu-hypotension-warning", label: "ICU Hypotension" },
      { slug: "legal-bill-predictor", label: "Legal Bill Predictor" },
    ],
  },
  {
    title: "NLP / LLMs",
    caption: "Retrieval, fine-tuning, embeddings, and multi-agent systems.",
    skills: [
      "Hugging Face",
      "LoRA",
      "RAG",
      "Embeddings",
      "Sentence transformers",
      "Multi-agent systems",
      "OpenAI API",
      "Ollama",
    ],
    appliedIn: [
      { slug: "personaforge", label: "PersonaForge" },
      { slug: "negotiation-gym", label: "NegotiationGym" },
    ],
  },
  {
    title: "Engineering",
    caption: "Shipping the systems around the model, end to end.",
    skills: [
      "Python",
      "TypeScript",
      "React",
      "FastAPI",
      "Node.js",
      "Docker",
      "REST APIs",
      "SQL",
      "Electron",
    ],
    appliedIn: [
      { slug: "personaforge", label: "PersonaForge" },
      { slug: "cloud-builder", label: "Cloud Builder" },
    ],
  },
  {
    title: "Research / Communication",
    caption: "Experiment design and writing that holds up to review.",
    skills: [
      "Experiment design",
      "Technical writing",
      "LaTeX",
      "Publications",
      "Data analysis",
      "Ablation thinking",
    ],
    appliedIn: [
      { slug: "negotiation-gym", label: "NegotiationGym" },
      { slug: "lora-interpretability", label: "LoRA Interpretability" },
    ],
  },
];

export type Experience = {
  year: string;
  role: string;
  company: string;
  period: string;
  location: string;
  tag?: string;
  summary: string;
};

export const experience: Experience[] = [
  {
    year: "2025",
    role: "NLP Data Scientist",
    company: "Quantexa",
    period: "Jan 2025 - Sep 2025",
    location: "Dublin, Ireland",
    tag: "NLP · LLMs · Research",
    summary:
      "Co-authored a COLM 2025 accepted multi-agent simulation paper and won the Q4 Innovation title for a financial News-API demo, while building and fine-tuning sparse ML models and LLM workflows for financial signal extraction.",
  },
  {
    year: "2024",
    role: "Analyst",
    company: "Oracle",
    period: "May 2024 - Aug 2024",
    location: "Remote · Gurgaon, India",
    tag: "Data · Internal Tools",
    summary:
      "Built and optimised internal Oracle APEX applications and Essbase reporting workflows, including a JavaScript org-chart tool adopted across the team.",
  },
  {
    year: "2024",
    role: "Back End Developer",
    company: "Fathom",
    period: "Jan 2024 - Apr 2024",
    location: "Dublin, Ireland",
    tag: "Backend · Cloud",
    summary:
      "Built Cloud Builder, a CLI that deploys AWS infrastructure from compact config. It was selected for the Software Engineering Industry Awards and later open-sourced.",
  },
  {
    year: "2023",
    role: "Software Engineer Intern",
    company: "BlastAsia Inc.",
    period: "Jun 2023 - Sep 2023",
    location: "Remote · Philippines",
    tag: "Applied AI",
    summary:
      "Trained an ML model to generate Figma UI code from design datasets, integrated the ChatGPT API into a client-facing product, and built an internal ML service with a custom API layer.",
  },
  {
    year: "2023",
    role: "AI Software Developer",
    company: "Propylon",
    period: "Jan 2023 - Apr 2023",
    location: "Dublin, Ireland",
    tag: "Legal-tech ML",
    summary:
      "Built a text classifier over 1,000+ US legal documents and combined classification with regression to predict bill outcomes, migrating modeling to XGBoost and raising accuracy from 45% to 65%+.",
  },
  {
    year: "2021-23",
    role: "Chairperson · Events Officer",
    company: "DU Netsoc",
    period: "Sep 2021 - Jan 2023",
    location: "Trinity College Dublin",
    tag: "Leadership",
    summary:
      "Chaired Trinity's Network Society after serving as Events Officer, running technical community events across the 2021-2023 academic years.",
  },
  {
    year: "2022",
    role: "Competitions Officer",
    company: "DU Computer Science Society",
    period: "Sep 2022 - Dec 2022",
    location: "Trinity College Dublin",
    tag: "Leadership",
    summary:
      "Coordinated competitive programming events for Trinity's computer science community.",
  },
  {
    year: "2022",
    role: "Research Intern",
    company: "Delhi University",
    period: "Jun 2022 - Sep 2022",
    location: "Delhi, India",
    tag: "Research",
    summary:
      "Research internship under Prof. Shobha Bagai, building a Java chess-simulation GUI and a modified variant with a decision-based opponent for probability experiments.",
  },
  {
    year: "2016-20",
    role: "Society Head · Robotics Head",
    company: "MINET",
    period: "2016 - Dec 2020",
    location: "Delhi, India",
    tag: "Origin",
    summary:
      "Led a school technology club after serving as Robotics Head, building battle robots and line-followers and running the annual tech symposium and online cryptic hunt.",
  },
];

export type ProjectLink = {
  label: string;
  url: string;
  kind: "repo" | "paper" | "thesis" | "demo" | "writeup" | "external";
};

export type Decision = { title: string; body: string };

export type Project = {
  slug: string;
  title: string;
  eyebrow: string;
  subtitle?: string;
  summary: string;
  detail: string | string[];
  stack: string[];
  impact?: string[];
  categories: string[];
  flagship?: boolean;
  roleFit?: string[];
  metrics?: { value: string; label: string }[];
  // Case-study sections — rendered only when present.
  problem?: string;
  constraints?: string[];
  build?: string[];
  architecture?: string[];
  decisions?: Decision[];
  evaluation?: string[];
  improvements?: string[];
  links?: ProjectLink[];
};

export const projects: Project[] = [
  {
    slug: "icu-hypotension-warning",
    title: "ICU Hypotension Early Warning System",
    eyebrow: "Clinical ML",
    subtitle:
      "Clinical ML early-warning system on MIMIC-IV ICU data, evaluated for deployment behaviour.",
    summary:
      "An hourly hypotension early-warning system trained on 94,259 MIMIC-IV v3.1 ICU stays, with threshold recalibration that restores recall under a fixed alarm budget.",
    flagship: true,
    categories: ["AI/ML", "Research"],
    roleFit: ["AI/ML Engineer", "Applied / Clinical ML", "Research-to-production"],
    metrics: [
      { value: "0.945", label: "AUROC" },
      { value: "93.75%", label: "recall @ 10% alarm budget" },
      { value: "94,259", label: "ICU stays modeled" },
    ],
    detail:
      "A clinical machine-learning pipeline for hourly hypotension early warning across 94,259 ICU stays. The work diagnosed a deployment failure caused by globally calibrated thresholds during MAP-absent hours and proposed subset-calibrated dual thresholds to restore practical recall.",
    stack: ["Python", "MIMIC-IV", "Clinical ML", "Threshold calibration", "AUROC analysis", "scikit-learn"],
    problem:
      "An hourly hypotension early-warning model can score well offline yet fail in practice. Here, globally calibrated alarm thresholds collapsed during hours when mean arterial pressure (MAP) was missing, exactly when a warning matters most.",
    constraints: [
      "Evaluated under a fixed alarm budget (10%), not just raw AUROC, to reflect what clinicians can tolerate.",
      "Hourly prediction cadence across 94,259 MIMIC-IV v3.1 ICU stays.",
      "Must remain useful during MAP-absent hours, where a single global threshold degraded recall.",
    ],
    build: [
      "Built an hourly hypotension early-warning pipeline over 94,259 MIMIC-IV v3.1 ICU stays.",
      "Reached AUROC 0.945 on the warning task.",
      "Diagnosed a deployment failure caused by globally calibrated thresholds during MAP-absent hours.",
      "Proposed subset-calibrated dual thresholds to restore practical recall.",
    ],
    decisions: [
      {
        title: "Evaluate under a fixed alarm budget",
        body: "Offline AUROC hides deployment behaviour. Fixing the alarm budget at 10% measures the recall clinicians would actually experience at a tolerable alarm burden.",
      },
      {
        title: "Diagnose and fix the MAP-absent failure",
        body: "A single global threshold degraded recall precisely during hours when MAP was unavailable. Subset-calibrated dual thresholds restored recall to 93.75% at the same alarm burden.",
      },
    ],
    evaluation: [
      "AUROC 0.945 on the early-warning task.",
      "Recovered 93.75% recall at a 10% alarm budget after recalibration.",
      "Centred on deployment behaviour.",
    ],
    improvements: [
      "Prospective and external-dataset validation beyond MIMIC-IV.",
      "Richer temporal feature windows and calibrated uncertainty estimates.",
      "Per-unit threshold adaptation to local alarm tolerances.",
    ],
    links: [{ label: "Read the thesis", url: "MCS_Hypotension_Thesis.pdf", kind: "thesis" }],
  },
  {
    slug: "negotiation-gym",
    title: "NegotiationGym",
    eyebrow: "Multi-Agent AI",
    subtitle:
      "Multi-agent negotiation simulation with feedback-driven strategy optimisation, accepted at COLM 2025.",
    summary:
      "A framework for simulating and optimising negotiation strategies between LLM agents using feedback-driven learning. Accepted and highlighted at COLM 2025.",
    flagship: true,
    categories: ["NLP", "Research"],
    roleFit: ["LLM / Applied AI", "AI/ML Researcher", "Multi-Agent Systems"],
    metrics: [
      { value: "COLM 2025", label: "accepted paper" },
      { value: "Multi-agent", label: "social simulation" },
    ],
    detail:
      "A framework for simulating and optimising negotiation strategies between AI agents using feedback-driven learning. The project was accepted and highlighted at COLM 2025.",
    stack: ["Python", "LLMs", "Multi-agent systems", "Simulation", "Evaluation"],
    problem:
      "How do LLM-driven agents improve negotiation strategy through interaction? NegotiationGym studies negotiation as a multi-agent social simulation with feedback-driven learning.",
    build: [
      "A framework for simulating and optimising negotiation strategies between LLM agents.",
      "Feedback-driven learning that adapts negotiation behaviour over rounds.",
      "Evaluation connecting agent behaviour with social-simulation design.",
    ],
    evaluation: [
      "Accepted and highlighted at COLM 2025.",
      "Explores feedback-driven learning for negotiation behaviour.",
      "Links agent evaluation with social-simulation design.",
    ],
    links: [
      { label: "Read the paper", url: "https://arxiv.org/abs/2510.04368", kind: "paper" },
      { label: "View on GitHub", url: "https://github.com/chrishokamp/multi-agent-social-simulation", kind: "repo" },
    ],
  },
  {
    slug: "cloud-builder",
    title: "Cloud Builder",
    eyebrow: "Backend Tooling",
    subtitle: "A CLI that deploys and manages AWS infrastructure from a handful of configuration lines.",
    summary:
      "A CLI tool for deploying and managing AWS infrastructure from compact configuration, selected for the Software Engineering Industry Awards and later open-sourced.",
    flagship: true,
    categories: ["Backend"],
    roleFit: ["Software Engineering", "Backend / Cloud"],
    detail:
      "Built during Trinity College Dublin's Software Engineering Industry Programme with Fathom. Cloud Builder deploys and manages AWS infrastructure in seconds using a handful of configuration lines.",
    stack: ["Python", "CLI", "AWS", "Infrastructure", "Developer tools"],
    impact: [
      "Selected for the Software Engineering Industry Awards.",
      "Codebase later licensed and open-sourced.",
      "Reduced deployment from documentation-heavy workflows to compact config.",
    ],
    links: [{ label: "View on GitHub", url: "https://github.com/yjay18/Cloud-Builder", kind: "repo" }],
  },
  {
    slug: "legal-bill-predictor",
    title: "Legal Bill Outcome Predictor",
    eyebrow: "Legal-Tech ML",
    subtitle: "Document classification plus regression to predict whether US state bills pass.",
    summary:
      "An end-to-end ETL and ML system over 1,000+ legal documents that improved bill-outcome accuracy from 45% to 65%+ with XGBoost.",
    flagship: true,
    categories: ["AI/ML", "Backend"],
    roleFit: ["AI/ML Engineer", "Software Engineering"],
    detail:
      "Built an end-to-end ETL and machine-learning system for Propylon using more than 1,000 legal documents. The system combined text classification with regression modeling to predict whether a legal bill would pass.",
    stack: ["Python", "XGBoost", "Text classification", "ETL", "pickle"],
    impact: [
      "Improved accuracy from 45% to 65%+ using XGBoost.",
      "Integrated multiple ML models into a working ETL pipeline.",
      "Serialised models offline to reduce loading time.",
    ],
    links: [{ label: "View on GitHub", url: "https://github.com/yjay18/ClassifyingUSLegislation", kind: "repo" }],
  },
  {
    slug: "personaforge",
    title: "PersonaForge",
    eyebrow: "Local-First AI Desktop App",
    subtitle:
      "Local-first desktop AI app: multi-persona chat, on-device voice cloning, web retrieval, and GPU coordination.",
    summary:
      "A local-first desktop AI chat app with three switchable personas, on-device voice cloning, and DuckDuckGo web search. Built with React, FastAPI, Ollama, Electron, and Coqui XTTS v2.",
    flagship: true,
    categories: ["AI/ML", "NLP"],
    roleFit: ["LLM / Applied AI", "Software Engineering", "AI Systems"],
    metrics: [
      { value: "8 GB", label: "shared VRAM, LLM + TTS" },
      { value: "3", label: "switchable personas" },
      { value: "10", label: "prompt presets per persona" },
    ],
    detail: [
      "PersonaForge is a local-first desktop AI chat application for Windows. It runs three switchable personas (Assistant, Tutor, and Thinker) against a locally hosted Ollama model, each driven by a creativity slider that parameterises ten escalating system prompts and a random-refusal probability. The app includes streaming SSE chat, DuckDuckGo-backed web retrieval, on-device voice cloning via Coqui XTTS v2, auto-generated conversation titles, and full per-persona theming.",
      "The most interesting engineering problem was sharing an 8 GB VRAM budget between Ollama and XTTS v2. I built a thread-locked GPU coordination layer that evicts the active LLM before TTS synthesis and releases the model afterwards so Ollama auto-reloads on the next chat request. Chat and voice run locally with no telemetry; the models need Ollama running, and the optional web search is the only feature that reaches the network.",
    ],
    stack: [
      "React",
      "TypeScript",
      "FastAPI",
      "Python",
      "SQLModel",
      "Ollama",
      "Coqui XTTS v2",
      "Electron",
      "PyInstaller",
      "Vite",
      "Local-first",
    ],
    problem:
      "Most capable AI assistants depend on cloud APIs and telemetry. PersonaForge set out to deliver streaming multi-persona chat and natural voice on a single consumer laptop, keeping chat and voice on-device with no telemetry.",
    constraints: [
      "A single laptop GPU with roughly 8 GB of VRAM, shared between the language model and the voice model.",
      "Keep chat and voice on-device, via Ollama and Coqui XTTS v2, with no telemetry.",
      "Must ship as one installable Windows desktop application, not a developer-only stack.",
    ],
    build: [
      "Multi-persona prompt system: three personas, ten parameterised prompt presets each, in-character refusal behaviour, and runtime retheming via CSS custom properties.",
      "Thread-locked GPU coordination that shares an 8 GB VRAM budget between Ollama chat and Coqui XTTS v2 voice cloning on one laptop GPU.",
      "On-device voice cloning with a per-persona reference-WAV system and graceful default-speaker fallback.",
      "Real-time streaming chat over SSE with abort support, background auto-naming, and refusal filtering to prevent context poisoning.",
      "Optional DuckDuckGo retrieval with query rewriting from short follow-ups and in-UI source attribution.",
    ],
    architecture: [
      "React + TypeScript frontend (Vite) running inside an Electron desktop shell.",
      "FastAPI + Python backend with SQLModel persistence for conversations and settings.",
      "Ollama serves the local LLM; Coqui XTTS v2 handles on-device voice cloning.",
      "A thread-locked GPU coordinator evicts the active LLM before TTS synthesis and releases it afterward, so Ollama auto-reloads on the next message.",
      "Packaged with PyInstaller (backend) plus a Vite build (frontend) inside Electron, shipped as a single NSIS installer.",
    ],
    decisions: [
      {
        title: "Share one GPU between chat and voice",
        body: "With only ~8 GB of VRAM, the LLM and XTTS v2 cannot both stay resident. A thread-locked coordinator evicts the model before synthesis and releases it after, trading a brief reload for reliable voice without out-of-memory failures.",
      },
      {
        title: "Filter in-character refusals from context",
        body: "Personas can refuse in character via a random-refusal probability. Those refusal turns are filtered out of model context so they do not poison later responses.",
      },
      {
        title: "Local-first by design",
        body: "Chat runs on a local Ollama model and voice is synthesised on-device with Coqui XTTS v2, with no telemetry. Web search is optional and is the only part that uses the network.",
      },
    ],
    evaluation: [
      "Delivers streaming multi-persona chat, web retrieval, and voice cloning on a single laptop GPU.",
      "Runs chat and voice locally with no telemetry; web search is optional.",
      "Ships as a one-click Windows installer with a bundled backend and frontend.",
    ],
    improvements: [
      "Cross-platform packaging for macOS and Linux beyond the current Windows installer.",
      "A model-agnostic backend adapter so engines other than Ollama can be swapped in.",
      "An automated evaluation harness for persona behaviour, refusal rates, and retrieval quality.",
      "Quantization-aware scheduling to fit larger models within the same VRAM budget.",
    ],
    links: [{ label: "View on GitHub", url: "https://github.com/yjay18/personaforge", kind: "repo" }],
  },
  {
    slug: "emoji-sentiment-stability",
    title: "Stable Contexts, Mixed Feelings",
    eyebrow: "NLP Research",
    subtitle: "Emoji sentiment stability across 16,575 tweets, separating topical coherence from affective consistency.",
    summary:
      "A per-emoji stability metric built from sentence embeddings across 16,575 tweets, decoupling context stability from affective consistency.",
    categories: ["NLP", "Research"],
    roleFit: ["NLP Engineer", "AI/ML Researcher"],
    detail:
      "Built a per-emoji stability metric from sentence embeddings across 16,575 tweets. The work showed that emojis appearing in topically coherent contexts can carry more polarised sentiment, decoupling context stability from affective consistency.",
    stack: ["Python", "Sentence embeddings", "NLP", "Sentiment analysis", "Research"],
    impact: [
      "Submitted to ICWSM 2027 as a preprint.",
      "Analysed 16,575 tweets.",
      "Introduced a stability-oriented view of emoji meaning.",
    ],
  },
  {
    slug: "lora-interpretability",
    title: "LoRA Interpretability Toolkit",
    eyebrow: "Mechanistic Interpretability Research",
    subtitle: "An interpretability pipeline around LoRA adapters and sparse autoencoders.",
    summary:
      "An interpretability pipeline around LoRA adapters and sparse autoencoders, covering activation collection, SAE decoding, and steering experiments to test causal effects.",
    categories: ["AI/ML", "Research"],
    roleFit: ["AI/ML Researcher", "Interpretability"],
    detail:
      "An interpretability pipeline around LoRA adapters and sparse autoencoders, covering activation collection and SAE decoding. It implements differential activation analysis, feature classification, and cross-domain feature fingerprints, with steering experiments to test causal effects. The work is organised into notebooks and result-generation scripts.",
    stack: ["Python", "LoRA", "Sparse autoencoders", "Interpretability", "Jupyter"],
    impact: [
      "Built an interpretability pipeline around LoRA adapters and sparse autoencoders, covering activation collection and SAE decoding.",
      "Implemented differential activation analysis, feature classification, and cross-domain feature fingerprints.",
      "Ran steering experiments to test causal effects, organised as notebooks and result-generation scripts.",
    ],
    links: [{ label: "View on GitHub", url: "https://github.com/yjay18/LoraResearch", kind: "repo" }],
  },
  {
    slug: "kundl-ai",
    title: "kundl.ai",
    eyebrow: "Client-Side Web App",
    subtitle: "Privacy-first Vedic astrology that computes sidereal charts entirely in the browser.",
    summary:
      "A privacy-first Vedic astrology demo that computes sidereal charts entirely in the browser, including planetary positions, lagna, nakshatras, bhavas, and Vimshottari mahadasha.",
    categories: ["Web", "Backend"],
    roleFit: ["Software Engineering", "Web"],
    detail:
      "A privacy-first Vedic astrology demo that computes sidereal charts entirely in the browser, including planetary positions, lagna, nakshatras, bhavas, and Vimshottari mahadasha. The calculation engine is separated from the UI, with an optional Python backend for higher-grade ephemeris support.",
    stack: ["JavaScript", "Browser", "Python", "Ephemeris"],
    impact: [
      "Computes sidereal charts fully client-side: planetary positions, lagna, nakshatras, bhavas, and Vimshottari mahadasha.",
      "Separated the calculation engine from the UI for reuse and testing.",
      "Added an optional Python backend for higher-grade ephemeris support.",
    ],
  },
  {
    slug: "ets-consulting",
    title: "ETS Consulting Site",
    eyebrow: "React Marketing Site",
    subtitle: "A marketing site for E.T.S Consulting Services with a custom design system and serverless contact flow.",
    summary:
      "A marketing site for E.T.S Consulting Services, built in React and Vite with a custom CSS design system, responsive layout, and subtle motion.",
    categories: ["Web"],
    roleFit: ["Web", "Frontend"],
    detail:
      "A marketing site for E.T.S Consulting Services, built in React and Vite with a custom CSS design system, responsive layout, and subtle motion. The contact flow runs locally via Express or in production through a Vercel serverless API with optional Redis queuing.",
    stack: ["React", "Vite", "CSS", "Express", "Vercel", "Redis"],
    impact: [
      "Built in React and Vite with a custom CSS design system, responsive layout, and subtle motion.",
      "Contact flow runs locally via Express or in production through a Vercel serverless API.",
      "Added optional Redis queuing for contact submissions.",
    ],
  },
  {
    slug: "figma-code-generation",
    title: "Figma Code Generation Model",
    eyebrow: "Applied AI",
    subtitle: "An ML prototype for design-to-code generation from proprietary design datasets.",
    summary:
      "An ML model that generates UI code from internal design datasets, with ChatGPT-API integration into an existing production product.",
    categories: ["AI/ML"],
    roleFit: ["Applied AI", "Software Engineering"],
    detail:
      "Developed during a software-engineering internship at BlastAsia. The model used internal design data to generate Figma-related code and supported product exploration around AI-assisted development workflows.",
    stack: ["Machine learning", "Figma", "API integration", "Python", "JavaScript"],
    impact: [
      "Created an AI prototype for design-to-code automation.",
      "Integrated ChatGPT-API capabilities into an existing production product.",
      "Built API communication layers for internal ML services.",
    ],
  },
  {
    slug: "chess-simulation-engine",
    title: "Chess Simulation Engine",
    eyebrow: "Simulation · Early Work",
    subtitle: "A configurable Java GUI for modified-rule chess and decision-tree experiments.",
    summary:
      "A Java chess-simulation GUI built during a Delhi University research internship, exploring modified rules and mathematical decision trees.",
    categories: ["Early Work"],
    roleFit: ["Software Engineering", "Research"],
    detail:
      "Research internship under Prof. Shobha Bagai at Delhi University. The project explored chess simulations and mathematical trees through a configurable GUI and a modified opponent model.",
    stack: ["Java", "GUI", "Simulation", "Decision trees", "Research"],
    impact: [
      "Built an upscalable chess-board GUI.",
      "Implemented a modified chess variant for probability experiments.",
      "Connected game simulation with mathematical tree exploration.",
    ],
    links: [{ label: "View on GitHub", url: "https://github.com/yjay18/DUProject", kind: "repo" }],
  },
  {
    slug: "face-recognition-experiment",
    title: "ML FaceReg",
    eyebrow: "Early ML Experiment",
    subtitle: "An early Python face-recognition workflow with a MySQL-backed setup.",
    summary:
      "An early machine-learning project that detects and recognises faces in images, using dlib's shape predictor and a MySQL-backed setup.",
    categories: ["AI/ML", "Early Work"],
    roleFit: ["AI/ML", "Early Work"],
    detail:
      "A small early machine-learning project built around face recognition in images. The repository documents a Python workflow using stock image inputs, a MySQL connection, and dlib's shape-predictor setup.",
    stack: ["Python", "Face recognition", "dlib", "MySQL", "Image processing"],
    impact: [
      "Built an early practical ML image-recognition workflow.",
      "Connected recognition code with a local MySQL-backed setup.",
      "Kept as a lower-impact archive project rather than a primary case file.",
    ],
    links: [{ label: "View on GitHub", url: "https://github.com/yjay18/ML-FaceReg", kind: "repo" }],
  },
  {
    slug: "hindi-video-transcriber",
    title: "Hindi Video Transcriber",
    eyebrow: "Language Tooling · Early Work",
    subtitle: "A Google Cloud experiment that transcribes Hindi video and extracts its subject matter.",
    summary:
      "A compact notebook experiment using Google Cloud APIs to transcribe Hindi video, translate language signals, and identify the subject being discussed.",
    categories: ["NLP", "Early Work"],
    roleFit: ["NLP", "Early Work"],
    detail:
      "A compact notebook-based experiment using Google Cloud APIs to process a Hindi video, transcribe the speech, and summarise the subject matter being discussed. It uses Cloud Translation, Media Translation, Natural Language, and Speech-to-Text APIs.",
    stack: ["Python", "Jupyter", "Speech-to-Text", "Cloud Translation", "Natural Language API"],
    impact: [
      "Built a quick proof of concept for Hindi video transcription and topic extraction.",
      "Integrated multiple Google Cloud language APIs in a notebook workflow.",
      "Kept as a lower-impact archive project because it was a short experiment.",
    ],
    links: [{ label: "View on GitHub", url: "https://github.com/yjay18/ML-Hindi-Video-Transciber", kind: "repo" }],
  },
];

export const flagshipProjects = projects.filter((project) => project.flagship);
export const archiveProjects = projects.filter((project) => !project.flagship);

// Compact, non-linking community/leadership entries for the archive grid.
export type CommunityHighlight = {
  title: string;
  eyebrow: string;
  period: string;
  summary: string;
  categories: string[];
};

export const communityHighlights: CommunityHighlight[] = [
  {
    title: "DU Netsoc · Chairperson",
    eyebrow: "Trinity Leadership",
    period: "2021-2023",
    summary:
      "Chaired Trinity College Dublin's Network Society after serving as Events Officer, running technical community events across 2021-2023.",
    categories: ["Leadership"],
  },
  {
    title: "MINET · Robotics & Tech Lead",
    eyebrow: "Early Origin",
    period: "2016-2020",
    summary:
      "Led a school technology club after serving as Robotics Head, covering battle robots, line-followers, and the annual tech symposium and cryptic hunt.",
    categories: ["Leadership", "Early Work"],
  },
];

export const archiveFilters = [
  "All",
  "AI/ML",
  "NLP",
  "Web",
  "Backend",
  "Research",
  "Early Work",
  "Leadership",
];

export type Publication = {
  title: string;
  subtitle?: string;
  venue: string;
  date: string;
  url?: string;
  status?: string;
};

export const publications: Publication[] = [
  {
    title: "NegotiationGym",
    subtitle: "Self-optimising agents in a multi-agent social simulation.",
    venue: "COLM 2025",
    date: "Oct 2025",
    url: "https://arxiv.org/abs/2510.04368",
    status: "Accepted",
  },
  {
    title: "ICU Hypotension Early Warning System",
    subtitle: "Threshold calibration and deployment behaviour on MIMIC-IV ICU data.",
    venue: "Master's thesis · Trinity College Dublin",
    date: "Apr 2026",
    url: "MCS_Hypotension_Thesis.pdf",
    status: "Thesis",
  },
  {
    title: "Stable Contexts, Mixed Feelings",
    subtitle: "Emoji sentiment stability research across 16,575 tweets.",
    venue: "Preprint · submitted to ICWSM 2027",
    date: "May 2026",
    status: "Preprint",
  },
];
