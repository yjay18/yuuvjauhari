export const interactivePortfolioUrl =
  "https://portfolio-website-lake-zeta-65.vercel.app/";

export const profile = {
  name: "Yuuv Jauhari",
  location: "Dublin, Ireland",
  email: "jauhariyuuv@gmail.com",
  linkedin: "https://www.linkedin.com/in/yuuv-jauhari-66923a168",
  github: "https://github.com/yjay18",
  headline: "Fresh Computer Science graduate with overall distinction, focused on NLP, machine learning, and applied AI systems.",
  intro:
    "Fresh Integrated MSc Computer Science graduate from Trinity College Dublin with overall distinction and industry experience across NLP pipelines, clinical ML, legal-tech, backend tools, and applied research. I build AI systems that move from prototype to production.",
};

export const rolePhrases = [
  "an AI/ML Engineer",
  "an NLP Data Scientist",
  "a Software Engineer",
  "an AI/ML Researcher",
  "a Multi-Agent Systems Researcher",
  "an LLM / NLP Builder",
  "a Backend Developer",
  "a Robotics Enthusiast",
  "a Gaming & Simulation Enthusiast",
];

export const stats = [
  { value: "0.945", label: "AUROC clinical ML system" },
  { value: "65%+", label: "legal bill prediction accuracy" },
  { value: "COLM", label: "accepted multi-agent research" },
  { value: "94k+", label: "ICU stays modeled" },
];

export const skillGroups = [
  {
    title: "AI / ML",
    skills: [
      "LLM fine-tuning",
      "LoRA",
      "PyTorch",
      "Hugging Face",
      "scikit-learn",
      "XGBoost",
      "LSTMs",
      "SHAP",
      "Sparse models",
    ],
  },
  {
    title: "NLP / Agents",
    skills: [
      "Multi-agent systems",
      "RAG",
      "OpenAI API",
      "Sentence embeddings",
      "Vector representations",
      "Sentiment analysis",
    ],
  },
  {
    title: "Engineering",
    skills: [
      "Python",
      "JavaScript",
      "Java",
      "SQL",
      "C++",
      "ETL pipelines",
      "REST APIs",
      "Docker",
      "Node.js",
      "Git",
    ],
  },
  {
    title: "Tools / Platforms",
    skills: [
      "Jupyter",
      "LaTeX",
      "Oracle APEX",
      "Essbase",
      "Excel analysis",
      "AWS tooling",
    ],
  },
];

export const experience = [
  {
    marker: "2025 / Jan-Sep",
    year: "2025",
    role: "NLP Data Scientist",
    company: "Quantexa",
    period: "Jan 2025 - Sep 2025",
    location: "Dublin, Ireland",
    points: [
      "Upgraded the open-source News Signals library from v7.2 to v8.2.",
      "Awarded Q4 Innovation title for a financial use-case demo built on the News API.",
      "Co-authored a multi-agent negotiation simulation paper accepted at COLM 2025.",
      "Built and fine-tuned sparse ML models and LLMs for financial signal extraction.",
    ],
  },
  {
    marker: "2024 / May-Aug",
    year: "2024",
    role: "Analyst",
    company: "Oracle",
    period: "May 2024 - Aug 2024",
    location: "Remote / Gurgaon, India",
    points: [
      "Worked with Essbase multidimensional databases for reporting workflows.",
      "Built and optimized internal Oracle APEX applications.",
      "Implemented a JavaScript organizational chart tool used across the team.",
    ],
  },
  {
    marker: "2024 / Jan-Apr",
    year: "2024",
    role: "Back End Developer",
    company: "Fathom",
    period: "Jan 2024 - Apr 2024",
    location: "Dublin, Ireland",
    points: [
      "Built Cloud Builder, a CLI tool for fast AWS infrastructure deployment.",
      "Project selected for the Software Engineering Industry Awards.",
      "Codebase was later licensed and open-sourced.",
    ],
  },
  {
    marker: "2023 / Jun-Sep",
    year: "2023",
    role: "Software Engineer Intern",
    company: "BlastAsia Inc.",
    period: "Jun 2023 - Sep 2023",
    location: "Remote / Philippines",
    points: [
      "Trained an ML model to generate Figma UI code from design datasets.",
      "Integrated the ChatGPT API into a client-facing production product.",
      "Built an internal ML service with a custom API communication layer.",
    ],
  },
  {
    marker: "2023 / Jan-Apr",
    year: "2023",
    role: "AI Software Developer",
    company: "Propylon",
    period: "Jan 2023 - Apr 2023",
    location: "Dublin, Ireland",
    points: [
      "Built a text classifier over 1,000+ US legal documents.",
      "Combined classification and regression models to predict legal bill outcomes.",
      "Migrated baseline modeling to XGBoost, raising accuracy from 45% to 65%+.",
    ],
  },
  {
    marker: "2021-23 / DU Netsoc",
    year: "2021-23",
    role: "Chairperson / Event Officer",
    company: "DU Netsoc",
    period: "Sep 2021 - Jan 2023",
    location: "Dublin, Ireland",
    points: [
      "Chaired Trinity College Dublin's Network Society after serving as Events Officer.",
      "Ran technical community events across the 2021-2023 academic years.",
      "Built early leadership experience around university tech communities and event delivery.",
    ],
  },
  {
    marker: "2022 / Sep-Dec",
    year: "2022",
    role: "Competitions Officer",
    company: "Dublin University Computer Science Society",
    period: "Sep 2022 - Dec 2022",
    location: "Trinity College Dublin",
    points: [
      "Supported technical competitions for Trinity's computer science community.",
      "Helped coordinate competition programming during the 2022 term.",
      "Connected society leadership with hands-on computer science events.",
    ],
  },
  {
    marker: "2022 / Jun-Sep",
    year: "2022",
    role: "Project Intern",
    company: "Delhi University",
    period: "Jun 2022 - Sep 2022",
    location: "Delhi, India",
    points: [
      "Completed a research internship under Prof. Shobha Bagai on chess simulations and mathematical trees.",
      "Built an upscalable Java GUI for a chess-board simulation.",
      "Implemented a modified chess variant with a rudimentary decision-based opponent for probability experiments.",
    ],
  },
  {
    marker: "2016-20 / MINET",
    year: "2016-20",
    role: "Society Head / Robotics Head",
    company: "MINET - Mother's International Network",
    period: "2016 - Dec 2020",
    location: "Delhi, India",
    points: [
      "Started in MINET in 2016 and later led the school technology club after serving as Robotics Head.",
      "Organized the annual tech symposium X and the online cryptic hunt CryptX.",
      "Worked on robotics projects including battle robots and line-following robots.",
    ],
  },
];

export type Project = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  detail: string | string[];
  stack: string[];
  impact: string[];
  featured?: boolean;
  repoUrl?: string;
  externalUrl?: string;
  externalLabel?: string;
};

export const projects: Project[] = [
  {
    slug: "personaforge",
    title: "PersonaForge",
    eyebrow: "Local-First AI Desktop App",
    summary:
      "A local-first desktop AI chat app with three switchable personas, on-device voice cloning, and DuckDuckGo web search. Built with React, FastAPI, Ollama, Electron, and Coqui XTTS v2.",
    detail: [
      "PersonaForge is a local-first desktop AI chat application for Windows. It runs three switchable personas - Assistant, Tutor, and Thinker - against a locally hosted Ollama model, each driven by a creativity slider that parameterises ten escalating system prompts and a random-refusal probability. The app includes streaming SSE chat, DuckDuckGo-backed web retrieval, on-device voice cloning via Coqui XTTS v2, auto-generated conversation titles, and full per-persona theming.",
      "The most interesting engineering problem was sharing an 8 GB VRAM budget between Ollama and XTTS v2. I built a thread-locked GPU coordination layer that evicts the active LLM before TTS synthesis and releases the model afterwards so Ollama auto-reloads on the next chat request. Everything runs on the user's machine: no cloud APIs, no telemetry, no keys.",
    ],
    stack: [
      "React",
      "TypeScript",
      "Tailwind CSS",
      "Framer Motion",
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
    impact: [
      "Multi-persona prompt system with three personas, ten parameterised prompt presets per persona, in-character refusal behaviour, and runtime UI retheming via CSS custom properties.",
      "Thread-locked GPU coordination pipeline that shares an 8 GB VRAM budget between Ollama chat and Coqui XTTS v2 voice cloning on a single laptop GPU.",
      "On-device voice cloning with a per-persona reference-WAV system and graceful default-speaker fallback when no reference is supplied.",
      "Real-time streaming chat over SSE with abort support, background-thread auto-naming, and refusal-message filtering to prevent context poisoning across turns.",
      "Optional DuckDuckGo web retrieval with query rewriting from short follow-ups, model-context injection, and in-UI source attribution.",
      "Full Windows desktop packaging with a PyInstaller-bundled FastAPI backend, Vite-built React frontend, Electron shell, and single NSIS installer.",
      "Local-first by design: no cloud APIs, no API keys, no telemetry.",
    ],
    repoUrl: "https://github.com/yjay18/personaforge",
  },
  {
    slug: "icu-hypotension-warning",
    title: "ICU Hypotension Early Warning System",
    eyebrow: "Clinical ML",
    summary:
      "Hourly hypotension early-warning system trained on MIMIC-IV v3.1 ICU stays.",
    detail:
      "Built a clinical machine learning pipeline for early hypotension warning across 94,259 ICU stays. The work diagnosed a deployment failure caused by globally calibrated thresholds during MAP-absent hours and proposed subset-calibrated dual thresholds to restore practical recall.",
    stack: ["Python", "MIMIC-IV", "Clinical ML", "Threshold calibration", "AUROC analysis"],
    impact: [
      "Reached AUROC 0.945 on the warning task.",
      "Recovered 93.75% recall at 10% alarm burden after threshold recalibration.",
      "Focused on deployment behavior, not just offline model score.",
    ],
  },
  {
    slug: "negotiation-gym",
    title: "NegotiationGym",
    eyebrow: "Multi-Agent AI",
    summary:
      "Self-optimizing agents in a multi-agent social simulation environment.",
    detail:
      "A framework for simulating and optimizing negotiation strategies between AI agents using feedback-driven learning. The project was accepted and highlighted at COLM 2025.",
    stack: ["Python", "LLMs", "Multi-agent systems", "Simulation", "Evaluation"],
    impact: [
      "Accepted at COLM 2025.",
      "Explored feedback-driven learning for negotiation behavior.",
      "Connected agent evaluation with social simulation design.",
    ],
    repoUrl: "https://github.com/chrishokamp/multi-agent-social-simulation",
    externalUrl: "https://arxiv.org/abs/2510.04368",
    externalLabel: "Open Paper",
  },
  {
    slug: "emoji-sentiment-stability",
    title: "Stable Contexts, Mixed Feelings",
    eyebrow: "NLP Research",
    summary:
      "Emoji sentiment study separating topical coherence from affective consistency.",
    detail:
      "Built a per-emoji stability metric from sentence embeddings across 16,575 tweets. The work showed that emojis appearing in topically coherent contexts can carry more polarized sentiment, decoupling context stability from affective consistency.",
    stack: ["Python", "Sentence embeddings", "NLP", "Sentiment analysis", "Research"],
    impact: [
      "Submitted to ICWSM 2027 as a preprint.",
      "Analyzed 16,575 tweets.",
      "Introduced a stability-oriented view of emoji meaning.",
    ],
  },
  {
    slug: "cloud-builder",
    title: "Cloud Builder",
    eyebrow: "Backend Tooling",
    summary:
      "CLI tool for deploying and managing AWS infrastructure from compact config.",
    detail:
      "Built during Trinity College Dublin's Software Engineering Industry Programme with Fathom. Cloud Builder deploys and manages AWS infrastructure in seconds using a handful of configuration lines.",
    stack: ["Backend", "CLI", "AWS", "Infrastructure", "Developer tools"],
    impact: [
      "Selected for the Software Engineering Industry Awards.",
      "Codebase later licensed and open-sourced.",
      "Reduced deployment interaction from documentation-heavy workflows to compact config.",
    ],
    repoUrl: "https://github.com/yjay18/Cloud-Builder",
  },
  {
    slug: "legal-bill-predictor",
    title: "Legal Bill Outcome Predictor",
    eyebrow: "Legal-Tech ML",
    summary:
      "Legal document classifier and regression pipeline for US state bill outcomes.",
    detail:
      "Built an end-to-end ETL and machine learning system for Propylon using more than 1,000 legal documents. The system combined text classification with regression modeling to predict whether a legal bill would pass.",
    stack: ["Python", "XGBoost", "Text classification", "ETL", "pickle"],
    impact: [
      "Improved accuracy from 45% to 65%+ using XGBoost.",
      "Integrated multiple ML models into a working ETL pipeline.",
      "Serialized models offline to reduce loading time.",
    ],
    repoUrl: "https://github.com/yjay18/ClassifyingUSLegislation",
  },
  {
    slug: "figma-code-generation",
    title: "Figma Code Generation Model",
    eyebrow: "Applied AI",
    summary:
      "ML model for generating UI code from proprietary design datasets.",
    detail:
      "Developed during a software engineering internship at BlastAsia. The model used internal design data to generate Figma-related code and supported product exploration around AI-assisted development workflows.",
    stack: ["Machine learning", "Figma", "API integration", "Python", "JavaScript"],
    impact: [
      "Created an AI prototype for design-to-code automation.",
      "Integrated ChatGPT API capabilities into an existing production product.",
      "Built API communication layers for internal ML services.",
    ],
  },
  {
    slug: "chess-simulation-engine",
    title: "Chess Simulation Engine",
    eyebrow: "Simulation",
    summary:
      "Java GUI chess simulation for modified rules and decision-tree experiments.",
    detail:
      "Research internship under Prof. Shobha Bagai at Delhi University. The project explored chess simulations and mathematical trees through a configurable GUI and a modified opponent model.",
    stack: ["Java", "GUI", "Simulation", "Decision trees", "Research"],
    impact: [
      "Built an upscalable chess board GUI.",
      "Implemented a modified chess variant for probability experiments.",
      "Connected game simulation with mathematical tree exploration.",
    ],
    featured: false,
    repoUrl: "https://github.com/yjay18/DUProject",
  },
  {
    slug: "face-recognition-experiment",
    title: "ML FaceReg",
    eyebrow: "Early ML Experiment",
    summary:
      "Early Python face-recognition project that detects and recognizes faces in images, with a MySQL-backed setup and dlib shape-predictor dependency.",
    detail:
      "A small early machine-learning project built around face recognition in images. The repository documents a Python workflow that uses stock image inputs, a MySQL connection, and dlib's shape predictor setup.",
    stack: ["Python", "Face recognition", "dlib", "MySQL", "Image processing"],
    impact: [
      "Built an early practical ML image-recognition workflow.",
      "Connected recognition code with a local MySQL-backed setup.",
      "Kept as a lower-impact archive project rather than a primary case file.",
    ],
    featured: false,
    repoUrl: "https://github.com/yjay18/ML-FaceReg",
  },
  {
    slug: "hindi-video-transcriber",
    title: "Hindi Video Transcriber",
    eyebrow: "Language Tooling",
    summary:
      "Short Google Cloud API experiment that transcribes Hindi video, translates/extracts language signals, and identifies the subject matter being discussed.",
    detail:
      "A compact notebook-based experiment using Google Cloud APIs to process a Hindi video, transcribe the speech, and summarize the subject matter being discussed. The repository notes use of Cloud Translation, Media Translation, Natural Language, and Speech-to-Text APIs.",
    stack: [
      "Python",
      "Jupyter",
      "Google Cloud Speech-to-Text",
      "Cloud Translation",
      "Natural Language API",
    ],
    impact: [
      "Built a quick proof of concept for Hindi video transcription and topic extraction.",
      "Integrated multiple Google Cloud language APIs in a notebook workflow.",
      "Kept as a lower-impact archive project because it was a short experiment.",
    ],
    featured: false,
    repoUrl: "https://github.com/yjay18/ML-Hindi-Video-Transciber",
  },
];

export const featuredProjects = projects.filter((project) => project.featured !== false);
export const archiveProjects = projects.filter((project) => project.featured === false);

export const publications = [
  {
    title: "Stable Contexts, Mixed Feelings: Rethinking Emoji Sentiment",
    venue: "Preprint, submitted to ICWSM 2027",
    date: "May 2026",
  },
  {
    title: "ICU Hypotension Early Warning System",
    venue: "Master's thesis, Trinity College Dublin",
    date: "Apr 2026",
    url: "MCS_Hypotension_Thesis.pdf",
  },
  {
    title: "NegotiationGym: Self-Optimising Agents in a Multi-Agent Social Simulation",
    venue: "COLM 2025",
    date: "Oct 2025",
    url: "https://arxiv.org/abs/2510.04368",
  },
];

// Game reviews are intentionally parked for a later iteration.
// export const gameReviews = [
//   {
//     title: "Review Slot 01",
//     platform: "PC / Console",
//     status: "Draft",
//     score: "--",
//     summary:
//       "A reserved review card for long-form thoughts on mechanics, level design, story, and replay value.",
//     tags: ["Design", "Systems", "Feel"],
//   },
//   {
//     title: "Review Slot 02",
//     platform: "PC / Console",
//     status: "Draft",
//     score: "--",
//     summary:
//       "A second review slot for games worth writing about in more detail once the review list is ready.",
//     tags: ["World", "Combat", "Pacing"],
//   },
//   {
//     title: "Review Slot 03",
//     platform: "Indie / Retro",
//     status: "Draft",
//     score: "--",
//     summary:
//       "A compact review format for shorter notes on standout games, hidden gems, or retro picks.",
//     tags: ["Indie", "Retro", "Mood"],
//   },
// ];
