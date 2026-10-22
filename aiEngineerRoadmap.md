# AI Engineer Roadmap for Full-Stack Developers
### Self-Study Topic Map — From Full-Stack to AI Engineering

As a Full-Stack Developer with 5+ years of experience, you already possess **80% of the required skills** to excel as an AI Engineer. You understand system integration, state management, databases, security, and deployment. The remaining 20% involves shifting from deterministic programming to probabilistic AI architectures.

This document maps every topic needed for the transition, prioritized by industry relevance, with progress checkboxes for self-tracking.

---

## 🔴 PHASE 1: Foundations — HIGH PRIORITY
*Prerequisites — learn these before touching LLMs.*

### 1.1 Pre-Course Foundations
- [ ] Python fundamentals (data structures, OOP, generators, decorators)
- [ ] Virtual environments & dependency management (venv, conda, poetry)

### 1.2 Natural Language Processing (NLP)
- [ ] Text preprocessing: tokenization, stopword removal, lemmatization, stemming
- [ ] Word embeddings: Word2Vec, GloVe, FastText
- [ ] Named Entity Recognition (NER) with spaCy & HuggingFace Transformers
- [ ] Text classification & sequence labeling
- [ ] Sentence similarity & embedding models (SBERT, USE)

### 1.3 Machine Learning Foundations
- [ ] Supervised vs. Unsupervised Learning overview
- [ ] Linear & Logistic Regression
- [ ] Decision Trees & Random Forests
- [ ] XGBoost (Extreme Gradient Boosting)
- [ ] Deep Learning basics (neural networks, backpropagation)
- [ ] Reinforcement Learning overview
- [ ] Model evaluation metrics: Accuracy, Precision, Recall, F1, AUC-ROC
- [ ] Cross-validation & hyperparameter tuning (GridSearchCV, Optuna)

### 1.4 GenAI Fundamentals
- [ ] GPU basics (CUDA cores, VRAM, tensor cores)
- [ ] CUDA & NVIDIA driver setup
- [ ] Whisper (Speech-to-Text model)
- [ ] Multimodal models & image processing overview

---

## 🔴 PHASE 2: LLM Theory — HIGH PRIORITY
*Understanding how LLMs work under the hood.*

- [ ] Transformer architecture (self-attention, multi-head attention, positional encoding)
- [ ] Encoder-only vs. Decoder-only vs. Encoder-Decoder
- [ ] Autoregressive generation & sampling strategies
- [ ] Pretraining (next-token prediction, masked language modeling)
- [ ] Fine-tuning (full fine-tuning, LoRA, QLoRA)
- [ ] Model families:
  - [ ] GPT (OpenAI)
  - [ ] Claude (Anthropic)
  - [ ] LLaMA (Meta)
  - [ ] Mistral, Falcon, Cohere

---

## 🔴 PHASE 3: Using LLMs — HIGH PRIORITY
*Core daily work — prompting, integrating, and building with LLMs.*

### 3.1 Prompt Engineering
- [ ] Core principles: instruction following, temperature, top-p, top-k
- [ ] Role prompting & system instructions
- [ ] Chain of Thought (CoT) & ReAct patterns
- [ ] Few-shot vs. Zero-shot prompting
- [ ] Prompt evaluation & iteration strategies

### 3.2 LLM Integration
- [ ] OpenAI API (Chat Completions, Assistants, structured outputs)
- [ ] Anthropic Claude API (Messages API, tool use)
- [ ] AWS Bedrock (multi-model abstraction, auth, cost, latency)
- [ ] Open WebUI setup & configuration
- [ ] Llama.cpp (local LLM runtime, quantization, system requirements)
- [ ] LangChain & LangGraph fundamentals
- [ ] LiteLLM (model-agnostic API abstraction)
- [ ] Pure Python LLM integration (no frameworks)

### 3.3 Claude Code (Engineering Workflows)
- [ ] Code generation, debugging & refactoring
- [ ] Large codebase context (multi-file navigation)
- [ ] Test generation & code validation
- [ ] Tool use & system interaction
- [ ] Prompt-driven development workflows
- [ ] Iterative development & rapid prototyping
- [ ] Integration into daily dev workflows
- [x] AI Hero: AI Coding Crash Course — agent skills, steering, planning workflows (aihero.dev)

---

## 🔴 PHASE 4: Embeddings & RAG — HIGH PRIORITY
*Most common production pattern — grounding LLMs in your data.*

### 4.1 Embeddings & Vector Search
- [ ] Word embeddings (Word2Vec, GloVe, FastText)
- [ ] Sentence & document embeddings (SBERT, USE, OpenAI embeddings)
- [ ] Vector databases: ChromaDB, Pinecone, Qdrant, Weaviate
- [ ] Vector search algorithms: KNN (k-Nearest Neighbors), ANN (Approximate Nearest Neighbors)
- [ ] FAISS (Facebook AI Similarity Search)
- [ ] Distance metrics: cosine similarity, dot product, Euclidean

### 4.2 RAG Architecture
- [ ] RAG pipeline: ingest → chunk → embed → store → retrieve → generate
- [ ] Document chunking strategies (fixed-size, semantic, recursive)
- [ ] Retrieval strategies: dense vs. sparse, hybrid search
- [ ] Basic RAG pipeline with open-source tools (FAISS + HuggingFace)
- [ ] Document Q&A systems
- [ ] Knowledge-grounded chatbots
- [ ] Advanced RAG: re-ranking, contextual compression, query transformation

---

## 🟡 PHASE 5: AI Agents — MEDIUM PRIORITY
*Rapidly growing in importance — agents are the next frontier.*

- [ ] Context management & windowing strategies
- [ ] Chatbot development (conversation state, multi-turn)
- [ ] History management (summarization, sliding window, selective retention)
- [ ] Agent design patterns: Agent loop vs. DAG
- [ ] Planning & decision-making: tool use, memory, goal decomposition
- [ ] Implementation patterns:
  - [ ] LangChain Agents
  - [ ] ReAct (Reasoning + Acting) loop
  - [ ] Finite State Agents
- [ ] Runtime management & cost implications (token budgeting)
- [ ] Multi-agent architectures with CrewAI

### 5.2 Domain-Specific Agents
- [ ] Designing agents scoped to a vertical (healthcare, legal, finance, etc.)
- [ ] Domain-specific tool sets — curating APIs and functions for a single domain
- [ ] Domain knowledge injection (ontologies, regulations, terminology via RAG or system prompts)
- [ ] Domain guardrails & compliance (safety boundaries, regulatory constraints, PII handling)
- [ ] Domain-specific evaluation — expert-driven metrics beyond generic LLM evals
- [ ] Vertical SaaS agent patterns — embedding agents into industry-specific products

---

## 🟡 PHASE 6: Applied LLM Engineering — MEDIUM PRIORITY
*Advanced patterns for production systems.*

- [ ] Model distillation (large → small model knowledge transfer)
- [ ] MCP (Model Context Protocol) Server/Client architecture:
  - [ ] Server: queuing, scheduling, inference management
  - [ ] Client: structured requests, retries, output handling
- [ ] Vibe Coding (LLM-powered development workflows)
- [ ] Async processing (asyncio, concurrent.futures)
- [ ] Resiliency: error handling, retries, exponential backoff, schema validation
- [ ] Context engineering (prompt chaining, dynamic context injection)
- [ ] Progressive disclosure (revealing complexity gradually to LLMs)
- [ ] Agent skills development (composable capabilities: `grill-me`, `tdd`, `handoff`, `review`, `to-prd`, `to-issues`)

---

## 🟡 PHASE 7: Infrastructure & Deployment — MEDIUM PRIORITY
*You already have DevOps skills — adapt them for AI workloads.*

- [ ] Containerization with Docker (GPU passthrough, multi-stage builds)
- [ ] Serving APIs via FastAPI / Flask
- [ ] Inference at scale (batching, request queuing, load balancing)
- [ ] GPU resource management (VRAM allocation, concurrent inference)
- [ ] Monitoring & logging: LangFuse, OpenTelemetry
- [ ] Model serving with vLLM (PagedAttention, continuous batching)
- [ ] CI/CD for ML pipelines (model versioning, A/B testing)
- [ ] Ethics, compliance & security in AI systems (bias, hallucination guards, PII redaction)

---

## 🟢 PHASE 8: Model Reasoning — ADVANCED
*Specialized knowledge — understand LLM reasoning capabilities and limitations.*

- [ ] Reasoning vs. pattern completion in LLMs
- [ ] Inductive, deductive & abductive reasoning modes
- [ ] Multi-hop reasoning & intermediate steps
- [ ] Tool use to extend reasoning (calculators, retrievers, code executors)
- [ ] Evaluation methods for reasoning quality:
  - [ ] TruthfulQA
  - [ ] BIG-Bench Hard (BBH)
  - [ ] GSM8K (grade school math)

---

## 🟢 PHASE 9: Advanced ML — NICE-TO-HAVE
*Optional depth — industry-adjacent but not required daily.*

- [ ] Deep Learning deep dive (CNNs, RNNs, LSTMs, GANs)
- [ ] Reinforcement Learning (Q-learning, policy gradients, PPO)
- [ ] Advanced XGBoost: hyperparameter optimization, feature importance
- [ ] Optuna for automated hyperparameter search

---

## 📚 Free Resource Hub

| Resource / Platform | Topics Covered | Where to Find It |
| :--- | :--- | :--- |
| **DeepLearning.AI** *(Short Courses)* | LangChain, RAG, prompt engineering, vector databases, agents | [deeplearning.ai/short-courses](https://deeplearning.ai) |
| **Andrej Karpathy** *(YouTube)* | LLM fundamentals, neural networks zero-to-hero | [YouTube @AndrejKarpathy](https://youtube.com) |
| **OpenAI Cookbook** *(Official)* | Embeddings, structured outputs, token optimization | [cookbook.openai.com](https://cookbook.openai.com) |
| **Vercel AI SDK Docs** *(Official)* | Streaming, multi-agent UI, conversational state | [sdk.vercel.ai/docs](https://sdk.vercel.ai) |
| **HuggingFace Course** *(Free)* | Transformer models, NLP pipelines, fine-tuning | [huggingface.co/learn](https://huggingface.co/learn) |
| **Fast.ai Practical Deep Learning** *(Free)* | Deep learning fundamentals, practical code-first approach | [course.fast.ai](https://course.fast.ai) |
| **LangChain Docs** *(Official)* | Chains, agents, RAG, tools | [python.langchain.com](https://python.langchain.com) |
| **LangGraph Docs** *(Official)* | Agent orchestration, state graphs, multi-agent | [langchain-ai.github.io/langgraph](https://langchain-ai.github.io/langgraph) |
| **LiteLLM Docs** *(Official)* | 100+ LLM providers, unified API | [docs.litellm.ai](https://docs.litellm.ai) |
| **FAISS Docs** *(Meta)* | Vector search library, GPU-accelerated similarity search | [github.com/facebookresearch/faiss](https://github.com/facebookresearch/faiss) |
| **ChromaDB Docs** *(Official)* | Vector database for RAG, local-first | [docs.trychroma.com](https://docs.trychroma.com) |
| **vLLM Docs** *(Official)* | High-throughput LLM serving | [docs.vllm.ai](https://docs.vllm.ai) |
| **LangFuse** *(Open Source)* | LLM observability, monitoring, tracing | [langfuse.com/docs](https://langfuse.com) |
| **CrewAI Docs** *(Official)* | Multi-agent orchestration | [docs.crewai.com](https://docs.crewai.com) |
| **Llama.cpp** *(GitHub)* | Local LLM inference, quantization | [github.com/ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp) |

---

## 🛠️ Portfolio Projects (The Build Syllabus)

### Project 1: Strict Schema Data Extractor — 🔴 HIGH
- **The Goal**: Send messy text (raw medical logs or customer receipts) to an LLM and force it to yield a perfectly clean JSON output validated by a TypeScript schema.
- **Skills Learned**: Structured output constraints, schema validation, exception routing.

### Project 2: Multi-Document RAG Application — 🔴 HIGH
- **The Goal**: Build a local backend using Ollama (running Llama 3 or Mistral), split an uploaded PDF manual into 500-token chunks, vector-index them in ChromaDB, and chat with the documentation.
- **Skills Learned**: Text chunking strategy, vector databases, prompt context injection.

### Project 3: The Autonomous Database Agent — 🔴 HIGH
- **The Goal**: Connect an LLM chat input safely to an SQL or NoSQL database. Allow the LLM to inspect user intent, pick custom tool functions you built, run queries safely, and return plain-English results.
- **Skills Learned**: Function calling, sandboxed tool orchestration, stochastic safety design.

### Project 4: Production AI-Powered MCP Application — 🟡 MEDIUM
*A 3-phase rolling project mirroring real-world production development.*

**Phase 1 — Foundation Build: AI-Powered Microservice**
- [ ] Set up development environment & manage dependencies
- [ ] Write clean, modular Python code with proper error handling
- [ ] Integrate an LLM with basic prompting capabilities
- [ ] Handle input/output & prepare for automation
- [ ] Apply ML concepts & prompt engineering in a functional prototype

**Phase 2 — Workflow Integration: Modular Automation & Orchestration**
- [ ] Wrap the microservice in an MCP client-server structure (queuing, retries, structured requests)
- [ ] Build a real-world agentic ReAct loop with reasoning & tool use
- [ ] Containerize the system with Docker for repeatable deployment
- [ ] Add logging, modular components, and performance handling

**Phase 3 — Production Deployment: Prototype to Live System**
- [ ] Implement CI/CD pipelines for continuous updates & deployment
- [ ] Optimize for real-time or batch inference & resource efficiency
- [ ] Integrate monitoring & observability (LangFuse, OpenTelemetry)
- [ ] Address compliance, failover planning & responsible AI use

---

# 🗺️ DeepLearning.AI — Sequenced Learning Timeline

> A course-by-course route through the DeepLearning.AI catalog that covers every 🔴 HIGH-priority phase (1–4) and most 🟡/🟢 phases, using the smallest sensible set of courses. Built for a working Full-Stack developer.

## How to read this plan

- ✅ **Free** — DeepLearning.AI *Short Courses* (1–3 h each). No subscription needed. This is the majority of the route.
- 💳 **Pro** — *Courses* and *Professional Certificates* (require Pro ≈ $25–30/mo, or a Coursera plan). Subscribe **only** when you reach a 💳 anchor, and cancel when done.
- ⏱️ **Time** = the platform's stated duration. Budget **~1.5–2×** for exercises and notes.
- 📅 **Pace assumed**: 10–12 h/week. Week ranges are guidance, not deadlines.
- 🎯 Every stage ends in a **milestone output** — a project or artifact, never just "completed a course."
- 🧩 The roadmap's own **Portfolio Projects** are slotted at the end of the relevant stages.

**The only 💳 anchors on the core path:** `Machine Learning Specialization`, `Retrieval Augmented Generation (RAG)`, `Agentic AI`, and `Generative AI for Software Development`. Everything else on the critical path is a free short course.

---

## 🟢 Stage 0 — Orientation (Week 1 · ~7 h)

Get the mental model before any code. Pick one (or both if new to GenAI).

- [ ] 💳 `AI for Everyone` — 6h54m — what AI can/can't do, societal impact.
- [ ] 💳 `Generative AI for Everyone` — 5h1m — GenAI capabilities, limits, business framing. *(often free to audit)*

🎯 **Milestone:** Write a one-page note defining "AI Engineer" vs "ML Engineer" vs "Data Scientist" in your own words.

---

## 🟢 Stage 1 — Python & AI Fluency (Weeks 1–2 · ~12 h · fast-track)

You already program, so treat this as an AI-idiom speedrun, not a from-zero course.

- [ ] 💳 `AI Python for Beginners` — 11h30m — Python with AI assistance; writing, testing, debugging; first AI apps.

🎯 **Milestone:** Rebuild one small existing script of yours using the AI-assisted workflow from the course.

> Skip entirely if you're already fluent in Python (you'll pick up the AI-specific idioms in Stage 5).

---

## 🔴 Stage 2 — Machine Learning Foundations (Weeks 3–10 · ~95 h) — PHASE 1.3

The theory spine. This single specialization covers almost all of Phase 1.3.

- [ ] 💳 `Machine Learning Specialization` (DeepLearning.AI + Stanford Online) — 94h58m
  - Supervised vs. unsupervised, linear & logistic regression
  - Decision trees, random forests, XGBoost / ensemble methods
  - Regularization, evaluation metrics (precision/recall/F1/AUC), cross-validation
  - A taste of neural networks and the deep-learning path forward

**Optional depth (Phase 1 math / Phase 9):**
- [ ] 💳 `Mathematics for Machine Learning and Data Science` — 94h29m — calculus, linear algebra, statistics, probability. *(only if the math feels shaky; otherwise learn just-in-time)*

🎯 **Milestone → Roadmap Portfolio Project 1 (part 1):** Train and evaluate a classifier on a real dataset, report metrics, and explain the bias/variance trade-off.
📌 *Covers roadmap Phase 1.3 and the "ML concepts" line of Portfolio Project 4 – Phase 1.*

---

## 🔴 Stage 3 — LLM Theory: Transformers (Weeks 11–12 · ~14 h) — PHASE 2

The phase both Codecademy and DataCamp under-serve. Do these even if you skip the Deep Learning Specialization.

- [ ] ✅ `Attention in Transformers: Concepts and Code in PyTorch` (StatQuest) — 1h16m — self-attention implemented by hand.
- [ ] 💳 `Transformers in Practice` (AMD) — 11h1m — how transformers behave, how to debug and deploy them.
- [ ] ✅ `Build and Train an LLM with JAX` (Google) — 49m — **pretraining from scratch** (next-token prediction) on a tiny model.
- [ ] ✅ `Finetuning Large Language Models` (Lamini) — ~1h — full fine-tune vs. PEFT/LoRA.
- [ ] 💳 *(optional anchor)* `Generative AI with Large Language Models` (AWS) — 13h18m — the full GenAI lifecycle: transformer architecture → training/tuning → inference, plus AWS/Bedrock context.

**Optional deep-dive (Phase 9 backfill):**
- [ ] 💳 `Deep Learning Specialization` — 127h29m — do **Course 1 (NN & DL), Course 2 (improving models), Course 5 (Sequence Models → RNN/LSTM/attention/transformers)**. Skip 3–4 unless CNNs matter to you.

🎯 **Milestone:** Whiteboard the transformer forward pass from memory and explain encoder-only vs. decoder-only vs. encoder-decoder.
📌 *Covers roadmap Phase 2 and Phase 9 (CNN/RNN/LSTM), plus the model-family breadth via the Meta/Llama and AWS courses.*

---

## 🔴 Stage 4 — Prompting, Integration & AI Coding (Weeks 12–14 · ~20 h) — PHASE 3

Overlaps Stage 3 in week 12 — fine, they reinforce each other.

**3.1 Prompt engineering**
- [ ] 💳 `AI Prompting for Everyone` (Andrew Ng) — 7h4m — from finding info to building apps.
- [ ] ✅ `ChatGPT Prompt Engineering for Developers` (OpenAI) — ~1h — zero/few-shot, CoT, instruction refinement.
- [ ] ✅ `Reasoning with o1` (OpenAI) — 1h44m — prompting reasoning models, sampling/temperature intuition.

**3.2 LLM integration**
- [ ] ✅ `Building Systems with the ChatGPT API` (OpenAI) — ~1h — chat completions, structured outputs, moderation.
- [ ] ✅ `LangChain for LLM Application Development` (LangChain) — ~1h30m — chains, memory, agents.
- [ ] ✅ `Functions, Tools and Agents with LangChain` (LangChain) — ~1h — tool/function calling.
- [ ] ✅ `LangChain: Chat with Your Data` (LangChain) — ~1h — RAG with LangChain (preview of Stage 5).
- [ ] ✅ `Serverless LLM Apps with Amazon Bedrock` (AWS) — ~1h — **fills the Bedrock gap** (auth, multi-model, cost/latency).

**3.3 Claude Code & engineering workflows (Phase 3.3 / Phase 6 vibe coding)**
- [ ] ✅ `Claude Code: A Highly Agentic Coding Assistant` (Anthropic) — 2h
- [ ] ✅ `Spec-Driven Development with Coding Agents` (JetBrains) — 1h16m — replaces vibe coding with specs + context.
- [ ] ✅ `AI Coding Workflows: From Cloud to Local` (JetBrains) — 1h32m — switch agents/providers, cloud → local, cost/speed trade-offs.
- [ ] ✅ `AI Code Review` (Qodo) — 1h4m — review agents and context.

**Optional:** 💳 `Generative AI for Software Development` — 31h32m — a full certificate in AI pair-programming and prompt engineering. Take only if you want structured depth here.

🎯 **Milestone → Roadmap Portfolio Project 1:** `Strict Schema Data Extractor` — messy text → validated JSON, using structured outputs + Pydantic (see Stage 7).
📌 *Covers roadmap Phase 3.1, 3.2 (minus LiteLLM/Open WebUI/Llama.cpp), and 3.3.*

---

## 🔴 Stage 5 — Embeddings, Vector Search & RAG (Weeks 15–18 · ~40 h) — PHASE 4

- [ ] 💳 `Retrieval Augmented Generation (RAG)` (DeepLearning.AI) — 26h3m — **the anchor**: architecture → chunking → retrieval → deployment → evaluation.
- [ ] ✅ `Advanced Retrieval for AI with Chroma` (Chroma) — 1h2m — re-ranking, query improvement, spotting bad retrievals.
- [ ] ✅ `Building and Evaluating Advanced RAG` (LlamaIndex / TruEra) — ~1h30m — advanced retrieval + eval metrics.
- [ ] ✅ `Preprocessing Unstructured Data for LLM Applications` (Unstructured) — 1h22m — PDF/PPTX/HTML extraction (chunking inputs).
- [ ] ✅ `Building AI Assistants with On-Device Memory` (Qdrant) — 1h4m — vector memory across text/voice/images.
- [ ] ✅ `Multi-vector Image Retrieval` (Qdrant) — 1h43m — multimodal retrieval.
- [ ] ✅ `Event-Driven Agentic Document Workflows` (LlamaIndex) — 1h19m — RAG + human-in-the-loop.

**Deployment of RAG apps (bridges to Stage 8):**
- [ ] 💳 `Fast Prototyping of GenAI Apps with Streamlit` (Snowflake) — 9h21m — MVP → deploy with prompt engineering + RAG.

🎯 **Milestone → Roadmap Portfolio Project 2:** `Multi-Document RAG Application` — Ollama + Llama 3 + ChromaDB, 500-token chunks, chat with a PDF manual.
📌 *Covers roadmap Phase 4.1 and 4.2 (FAISS and distance-metric internals remain — see gap table).*

---

## 🟡 Stage 6 — Agents & Tool Use (Weeks 19–22 · ~30 h) — PHASE 5

- [ ] 💳 `Agentic AI` (Andrew Ng) — 9h55m — **the anchor**: agent loops, reflection, tool use, planning, multi-step workflows.
- [ ] ✅ `Multi AI Agent Systems with crewAI` (crewAI) — 3h1m — **fills the CrewAI gap** — multi-agent orchestration.
- [ ] ✅ `Long-Term Agentic Memory With LangGraph` (LangChain) — 1h24m — memory + state graphs (LangGraph).
- [ ] ✅ `Building Adaptive AI Agents` (Oracle) — 1h3m — agent traces → reusable skills; knowledge graphs.
- [ ] ✅ `Building AI Browser Agents` (AGI Inc) — 1h5m — computer/browser-use agents.
- [ ] ✅ `Agentic Knowledge Graph Construction` (Neo4j) — 3h8m — planning multi-agent systems.
- [ ] ✅ `Knowledge Graphs for AI Agent API Discovery` (SAP) — 1h14m — domain tool/API curation.
- [ ] ✅ `DSPy: Build and Optimize Agentic Apps` (Databricks) — 59m — programmatic agent optimization + MLflow.

🎯 **Milestone → Roadmap Portfolio Project 3:** `The Autonomous Database Agent` — NL → safe tool calls → SQL → plain-English results.
📌 *Covers roadmap Phase 5 (implementation patterns, ReAct loop, multi-agent). Domain-specific agent guardrails are covered in Stage 7 + gap table.*

---

## 🟡 Stage 7 — Evaluation & Applied LLM Engineering (Weeks 23–24 · ~12 h) — PHASE 6

- [ ] ✅ `Evaluating AI Agents` (Arize AI) — 2h36m — structured assessments, iteration.
- [ ] ✅ `Context Engineering` (DeepLearning.AI) — ~1–2h — designing/curating dynamic context windows, retrieval payloads, and prompt scaffolds for reliable agent behavior.
- [ ] ✅ `Pydantic for LLM Workflows` (DeepLearning.AI) — 1h50m — **structured outputs, schema validation, retries** (roadmap Phase 6 resiliency).
- [ ] ✅ `MCP: Build Rich-Context AI Apps with Anthropic` (Anthropic) — 1h58m — **fills the MCP gap** — server/client tools, data, prompts.
- [ ] ✅ `Build AI Apps with MCP Server: Working with Box Files` (Box) — 36m — MCP + multi-agent A2A.
- [ ] ✅ `Safe and reliable AI via guardrails` (GuardrailsAI) — 1h42m — safety boundaries, PII, production guardrails.

🎯 **Milestone:** Add guardrails + schema validation + an eval harness to Portfolio Project 3.
📌 *Covers roadmap Phase 6 (MCP, resiliency, context engineering) and Phase 5.2 domain guardrails.*

---

## 🟡 Stage 8 — Deployment, Serving & LLMOps (Weeks 24–25 · ~14 h) — PHASE 7

- [ ] ✅ `Fast & Efficient LLM Inference with vLLM` (Red Hat) — 1h38m — **fills the vLLM gap** — batching, benchmarking, serving.
- [ ] ✅ `Efficiently Serving LLMs` — ~1h — inference at scale, throughput/latency trade-offs.
- [ ] ✅ `Fast LLM Inference with Cerebras` (Cerebras) — 1h41m — real-time, latency-sensitive serving.
- [ ] ✅ `Orchestrating Workflows for GenAI Applications` (Astronomer) — 1h48m — Airflow pipelines for GenAI.
- [ ] 💳 *(optional)* `Data Engineering` (AWS) — 106h48m — only if you want the ingestion/serving pipeline background.

🎯 **Milestone → Roadmap Portfolio Project 4 (Phase 1–2):** containerize the microservice, add MCP client/server, async + retries.
📌 *Covers roadmap Phase 7 (FastAPI, vLLM, batching, CI/CD basics). LangFuse/OpenTelemetry remain — see gap table.*

---

## 🟢 Stage 9 — Fine-tuning, Reasoning & Advanced (Weeks 26+ · optional) — PHASES 8–9

- [ ] ✅ `Post-training of LLMs` (UW / NexusFlow) — 1h26m — SFT, DPO, online RL.
- [ ] ✅ `Reinforcement Fine-Tuning LLMs With GRPO` (Predibase) — 1h53m — reward functions, reasoning improvement.
- [ ] 💳 `Fine-tuning & RL for LLMs: Intro to Post-training` (AMD) — 13h19m — deeper fine-tuning/RL.
- [ ] ✅ `Reasoning with o1` (OpenAI) — 1h44m *(repeat for depth)* — reasoning vs. pattern completion.
- [ ] 💳 `Deep Learning Specialization` — finish remaining courses (CNNs, GANs-adjacent) for Phase 9.

🎯 **Milestone:** Fine-tune a small open model with LoRA and compare against a prompted baseline on the same eval.

---

## 🟢 Stage 10 — Multimodal & Voice (interspersed) — PHASE 1.4

- [ ] ✅ `Introducing Multimodal Llama 3.2` (Meta) — 1h39m
- [ ] ✅ `Building with Llama 4` (Meta) — 1h20m
- [ ] ✅ `AI Agents for Image and Video Generation` (Google) — 1h34m — generation + automatic output evaluation.
- [ ] ✅ `Voice for AI Agents and Applications` (Vocal Bridge) — 1h26m — embedded/layered/tool voice.
- [ ] ✅ `Document AI: From OCR to Agentic Doc Extraction` (LandingAI) — 3h11m — vision-grounded extraction.

🎯 **Milestone → Roadmap Portfolio Project 1 (variant):** schema-extract structured fields from scanned receipts/images.

---

## 📌 Roadmap Phase → DeepLearning.AI Coverage Map

| Roadmap Phase | Covered by | Coverage |
| :--- | :--- | :--- |
| **Phase 1.1** Python & envs | AI Python for Beginners | Partial (env/deps you already know) |
| **Phase 1.2** NLP | *(no dedicated NLP course on DL.AI)* | ❌ → HuggingFace Course, spaCy docs |
| **Phase 1.3** ML foundations | Machine Learning Specialization | ✅ Strong |
| **Phase 1.4** GPU / Whisper / multimodal | Voice, Llama 3.2/4, Image-Video Agents | Partial (no CUDA/Whisper internals) |
| **Phase 2** LLM theory | Attention in Transformers, Transformers in Practice, JAX, Fine-tuning, GenAI with LLMs, DLS C5 | ✅ Strong |
| **Phase 3.1** Prompt engineering | AI Prompting, ChatGPT Prompt Eng, Reasoning with o1 | ✅ Strong |
| **Phase 3.2** LLM integration | ChatGPT API, LangChain ×3, Bedrock | ✅ Strong (no LiteLLM/Open WebUI/Llama.cpp) |
| **Phase 3.3** Claude Code | Claude Code, Spec-Driven Dev, AI Code Review | ✅ Strong |
| **Phase 4.1** Embeddings & vector search | RAG course, On-Device Memory, Multi-vector | ✅ Strong (no FAISS-specific) |
| **Phase 4.2** RAG architecture | RAG (26h), Advanced Retrieval, Advanced RAG, Unstructured, Streamlit | ✅ Strong |
| **Phase 5** AI agents | Agentic AI, crewAI, LangGraph memory, Adaptive Agents, Browser Agents, DSPy | ✅ Strong |
| **Phase 5.2** Domain-specific agents | Knowledge Graphs (SAP/Neo4j), Guardrails | Partial |
| **Phase 6** Applied LLM engineering | Pydantic, MCP ×2, Guardrails, DSPy, Eval Agents | ✅ Strong |
| **Phase 7** Infra & deployment | vLLM, Serving LLMs, Cerebras, Airflow, Streamlit | Partial (no LangFuse/OpenTelemetry) |
| **Phase 8** Reasoning | Reasoning with o1, GRPO, Post-training | Partial (no TruthfulQA/BBH/GSM8K) |
| **Phase 9** Advanced ML | Deep Learning Specialization, Fine-tuning & RL | ✅ Strong |

## ⚠️ Gaps DL.AI Does Not Fill (and where to get them)

| Missing topic | Roadmap item | Where to get it |
| :--- | :--- | :--- |
| CUDA / NVIDIA driver / GPU internals | Phase 1.4 | NVIDIA CUDA docs, `fast.ai` Part 2 |
| Whisper (speech-to-text) | Phase 1.4 | OpenAI Whisper repo, HF Audio course |
| Dedicated NLP preprocessing / Word2Vec / GloVe / FastText / spaCy NER | Phase 1.2 | HuggingFace NLP Course, spaCy docs |
| FAISS + distance metrics internals | Phase 4.1 | FAISS docs (Meta) |
| LiteLLM (model-agnostic abstraction) | Phase 3.2 | LiteLLM docs |
| Open WebUI setup | Phase 3.2 | Open WebUI docs |
| Llama.cpp / local GGUF quantization | Phase 3.2 | llama.cpp GitHub |
| LangFuse + OpenTelemetry observability | Phase 7 | LangFuse docs, OpenTelemetry docs |
| Formal reasoning benchmarks (TruthfulQA, BBH, GSM8K) | Phase 8 | Original papers / EleutherAI lm-eval-harness |
| Domain-specific vertical SaaS agent patterns | Phase 5.2 | Build your own; no course exists |

## 🧭 Suggested cadence

1. **Weeks 1–10** — Stages 0–2 (orientation, Python, ML). No Pro needed until ML Specialization.
2. **Weeks 11–14** — Stages 3–4 (transformers + prompting + Claude Code). Mostly free.
3. **Weeks 15–22** — Stages 5–6 (RAG + agents). This is the highest-value stretch — build both portfolio projects.
4. **Weeks 23–25** — Stages 7–8 (eval, MCP, deployment). Assemble Portfolio Project 4.
5. **Week 26+** — Stage 9–10 (fine-tuning, reasoning, multimodal) as ongoing depth.

**Subscription strategy:** stay free through Stages 0, 1, 3 (short courses). Buy **Pro for 2–3 consecutive months** to knock out `Machine Learning Specialization` (Stage 2) + `RAG` (Stage 5) + `Agentic AI` (Stage 6), then cancel. Re-subscribe briefly for `Fast Prototyping`/`Generative AI for SW Dev` if needed. Most of this roadmap costs **$0** in short courses.
