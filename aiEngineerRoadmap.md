# AI Application Engineer Roadmap for Full-Stack Developers
### Self-Study Topic Map — From Full-Stack to Building AI-Powered Products

You are **not** becoming an ML researcher or model trainer. Your target role is the one described in most "AI Engineer" job ads today: a strong full-stack engineer who builds **production AI applications** — RAG systems, MCP servers, chatbots, agents, and AI features wired front-to-back into real products.

As a Full-Stack Developer with 5+ years of experience, you already have **~85% of the required skills**. The gap is not machine learning theory. It is:

1. **Probabilistic architecture** — designing around non-deterministic models.
2. **Retrieval & context engineering** — grounding models in your data.
3. **Evaluation** — measuring AI behavior instead of asserting it.
4. **AI product engineering** — streaming UX, cost controls, security, observability.

This document maps that path, prioritized by relevance to building AI products, with progress checkboxes for self-tracking.

> **Design principle:** learn the *minimum* ML needed to make good engineering decisions, then spend the rest of your time shipping AI features end-to-end.

---

## 🎯 Target Role & Scope

**You are optimizing for:** AI Application Engineer / AI Product Engineer / LLM Engineer — the "build RAGs, MCPs, chatbots, and full AI solutions front-to-back" role.

**You are NOT optimizing for:** ML Engineer / Applied Scientist / Research Engineer — the "train, fine-tune, and serve models" role.

**The one hard rule:** don't spend 100 hours training models you will never ship. Learn what a model *is* and *how it fails*; let the model vendors handle the weights.

---

## 🔴 PHASE 0: Orientation & ML Literacy — HIGH PRIORITY
*A small, deliberate dose of ML — concepts only. This replaces the old 95-hour ML specialization.*

- [x] What AI can and can't do; the AI Engineer vs. ML Engineer vs. Data Scientist distinction
- [ ] Probabilistic vs. deterministic systems: why the same input can produce different output
- [ ] Supervised vs. unsupervised learning in one page (what "training" means, at a high level)
- [ ] Overfitting / train-val-test split — the intuition, not the math
- [ ] Evaluation metrics **in the retrieval context**: precision, recall, precision@k, recall@k, MRR, nDCG
- [ ] Embeddings intuition: what a vector represents, why similar meaning → nearby points
- [ ] Distance metrics: cosine similarity, dot product, Euclidean (when each is used)
- [ ] Sampling parameters: temperature, top-p, top-k; determinism vs. creativity
- [ ] What fine-tuning is (conceptually) and **why you usually shouldn't start there** — compare prompting vs. RAG vs. fine-tuning
- [ ] Token economics: tokens, context limits, input/output pricing, rough cost math

**Deliberately excluded from this phase:** backpropagation, gradient descent, XGBoost, random forests, CNNs, RNNs, reinforcement learning. You will never need these to build RAG or agent products.

🎯 **Milestone:** Write a one-page decision guide — "When do I prompt, when do I add RAG, when do I fine-tune, when do I train a model?" — and explain it to a non-technical colleague.

---

## 🟡 PHASE 1: Python & AI Dev Fluency — MEDIUM PRIORITY (fast-track)
*Skip most of this if you already write Python. The goal is AI idioms, not the language.*

- [ ] Python fluency check: type hints, async/await, generators, decorators, Pydantic
- [ ] Environments & dependency management (uv/poetry/venv)
- [ ] Project layout for AI services (config, secrets, logging, tests)

🎯 **Milestone:** Rebuild one small existing script of yours as a typed, tested Python service.

---

## 🔴 PHASE 2: LLM Literacy — HIGH PRIORITY
*Enough theory to debug behavior and budget cost — not enough to build a model.*

- [ ] Transformer at a conceptual level: tokens in → next-token probabilities out
- [ ] Tokenization: why "characters ≠ tokens," and how it affects cost and truncation
- [ ] Context window: what fits, what gets dropped, and how to manage it
- [ ] Encoder-only vs. decoder-only vs. encoder-decoder (one paragraph each)
- [ ] Model families & provider trade-offs: GPT, Claude, Gemini, Llama, Mistral
- [ ] Chat vs. completion vs. reasoning models — when each is appropriate
- [ ] Structured outputs & tool calling as first-class model features
- [ ] Hallucination: why it happens and the engineering responses (grounding, citations, evals)
- [ ] What fine-tuning is — and the decision rule from Phase 0

**Deferred (know they exist, don't study deeply):** pretraining from scratch, masked language modeling, attention math, LoRA/QLoRA internals, model distillation.

🎯 **Milestone:** Whiteboard "what happens between sending a prompt and receiving a token," including where cost and latency come from.

---

## 🔴 PHASE 3: Prompting & LLM Integration — HIGH PRIORITY
*Core daily work — the interface between your code and the model.*

### 3.1 Prompt Engineering
- [ ] Instruction-following principles; temperature/top-p/top-k in practice
- [ ] System instructions & role prompting
- [ ] Chain of Thought (CoT) & ReAct patterns
- [ ] Few-shot vs. zero-shot; example selection
- [ ] Prompt evaluation & iteration (treat prompts as code under test)
- [ ] Context engineering: what goes in, in what order, and why

### 3.2 LLM Integration
- [ ] OpenAI API (Chat Completions, structured outputs, tool use)
- [ ] Anthropic Claude API (Messages API, tool use)
- [ ] One cloud abstraction layer (Bedrock, Vertex, or Azure OpenAI) — auth, cost, latency
- [ ] LiteLLM or equivalent model-agnostic abstraction (provider switching, fallbacks)
- [ ] Pure Python integration with no framework — understand what frameworks hide
- [ ] LangChain & LangGraph fundamentals
- [ ] Streaming responses (SSE / token streaming)

### 3.3 AI-Assisted Engineering Workflows
- [ ] Code generation, debugging & refactoring with AI agents
- [ ] Large-codebase context and multi-file navigation
- [ ] Test generation & validation
- [ ] Spec-driven development with coding agents
- [x] AI Hero: AI Coding Crash Course — agent skills, steering, planning workflows (aihero.dev)

**Skip unless a job requires it:** Open WebUI, Llama.cpp, local GGUF quantization. These are self-hosting concerns, not application-building concerns. Add later only if you need on-prem inference.

🎯 **Milestone → Portfolio Project 1:** `Strict Schema Data Extractor` — messy text → validated JSON via structured outputs + Pydantic, with retries and failure routing.

---

## 🔴 PHASE 4: Embeddings & RAG — HIGH PRIORITY
*The most common production AI pattern — grounding models in real data.*

### 4.1 Embeddings & Vector Search
- [ ] Sentence & document embeddings (OpenAI embeddings, SBERT, Cohere, open models)
- [ ] Vector databases: ChromaDB, Qdrant, Pinecone, pgvector (pick one to start)
- [ ] KNN vs. ANN; what an index actually buys you
- [ ] Distance metrics and normalization (cosine, dot product, Euclidean)
- [ ] Embedding dimension, cost, and re-embedding strategy
- [ ] Metadata filtering and hybrid (dense + keyword) search
- [ ] FAISS basics (optional; useful for local experiments)

### 4.2 RAG Architecture
- [ ] Full pipeline: ingest → parse → chunk → embed → store → retrieve → rerank → generate
- [ ] Chunking strategies: fixed-size, semantic, recursive, structure-aware
- [ ] Retrieval strategies: dense vs. sparse vs. hybrid
- [ ] Reranking and contextual compression
- [ ] Query transformation (rewriting, HyDE, multi-query)
- [ ] Citations & grounding; refusing when retrieval is empty
- [ ] RAG evaluation: retrieval metrics + answer groundedness/faithfulness
- [ ] Document Q&A and knowledge-grounded chatbots

**Skip:** Word2Vec, GloVe, FastText, classical NLP preprocessing pipelines. They are historically important and practically irrelevant to your stack.

🎯 **Milestone → Portfolio Project 2:** `Multi-Document RAG Application` — parse PDFs, chunk, embed in a vector DB, retrieve + rerank, answer with citations, and an eval set that scores retrieval.

---

## 🔴 PHASE 5: Agents, Tool Use & Conversational UX — HIGH PRIORITY
*The difference between a demo and a product.*

### 5.1 Agent Fundamentals
- [ ] Agent loop vs. DAG / workflow; when *not* to use an agent
- [ ] Tool/function calling: schemas, validation, error feedback to the model
- [ ] Planning, goal decomposition, and bounded autonomy
- [ ] Memory: conversation state, sliding window, summarization, long-term memory
- [ ] Multi-step and multi-agent orchestration (LangGraph, CrewAI)
- [ ] Human-in-the-loop checkpoints — where automation must stop
- [ ] Failure modes: loops, tool misuse, runaway cost, stale state

### 5.2 Conversational Product Engineering
- [ ] Chatbot development: multi-turn state, history management, interrupts
- [ ] Streaming UX: token streaming, stop/cancel, optimistic UI, error states
- [ ] Conversation persistence and resumability
- [ ] Guardrails: input/output validation, PII handling, refusal behavior

### 5.3 Domain Scoping (optional depth)
- [ ] Vertical agents: curated tool sets and domain terminology
- [ ] Domain knowledge injection via RAG or system prompts
- [ ] Compliance boundaries and domain-specific evaluation

🎯 **Milestone → Portfolio Project 3:** `The Autonomous Database Agent` — NL → safe tool calls → SQL/database → plain-English answer, with a human-review step for destructive actions.

---

## 🔴 PHASE 6: MCP & Applied LLM Engineering — HIGH PRIORITY
*Production patterns that turn a prototype into a reliable system.*

- [ ] MCP (Model Context Protocol): server/client architecture, tools, resources, prompts
- [ ] Building an MCP server that exposes your app's capabilities
- [ ] Building an MCP client with structured requests, retries, and timeouts
- [ ] Structured outputs & schema validation (Pydantic), with repair/retry loops
- [ ] Resiliency: error handling, exponential backoff, idempotency, rate limits
- [ ] Async processing (asyncio, concurrency, background jobs)
- [ ] Context engineering: prompt chaining, dynamic injection, progressive disclosure
- [ ] Prompt-injection defense and tool sandboxing
- [ ] Cost control: token budgeting, caching, model routing/fallbacks
- [ ] Composable agent skills (`grill-me`, `tdd`, `review`, `to-spec`, etc.)

🎯 **Milestone:** Add MCP, schema validation, retries, and guardrails to Portfolio Project 3.

---

## 🔴 PHASE 7: Full-Stack AI Features (Front-to-Back) — HIGH PRIORITY
*The part the generic AI roadmap misses — and your biggest advantage as a full-stack dev.*

- [ ] Streaming chat UI end-to-end (SSE or AI SDK; React/Next.js integration)
- [ ] Server routes / API design for AI endpoints (timeouts, cancellation, retries)
- [ ] Auth & multi-tenancy for AI features (per-user/per-org isolation of data and vectors)
- [ ] Usage metering, quotas, and per-user cost attribution
- [ ] Caching layers: exact-match, semantic cache, prompt caching
- [ ] Persistence: conversations, messages, feedback, embeddings, job state
- [ ] File ingestion UX: upload → parse → index → status, with progress + failures
- [ ] Security: prompt injection, output handling/XSS, PII redaction, secret management
- [ ] Background/async workloads and long-running job orchestration
- [ ] Accessibility & failure UX for probabilistic outputs (retry, edit, regenerate)

**Recommended stack anchor:** Vercel AI SDK for the front-to-back streaming path, plus your existing backend/framework for persistence and business logic.

🎯 **Milestone → Portfolio Project 4:** `Full-Stack AI Product` — a real app with auth, tenancy, streaming UI, RAG, one agentic workflow, usage limits, and eval dashboards.

---

## 🔴 PHASE 8: Evaluation & Observability — HIGH PRIORITY
*The single most differentiating AI engineering skill. Treat it as a deliverable, not an afterthought.*

- [ ] Build a golden dataset: representative inputs + expected properties
- [ ] Deterministic checks vs. LLM-as-judge; when each is appropriate
- [ ] Retrieval evals (precision@k, recall@k, MRR) and answer evals (groundedness, relevance, safety)
- [ ] Regression testing prompts and models across versions
- [ ] Online evaluation: user feedback, thumbs, correction capture
- [ ] Tracing & observability: LangFuse / OpenTelemetry / provider dashboards
- [ ] Quality/latency/cost dashboards; alerting on failure modes
- [ ] A/B testing model or prompt changes safely

🎯 **Milestone:** Add an eval harness + tracing + a quality/latency/cost dashboard to Portfolio Project 4, with a documented baseline.

---

## 🟡 PHASE 9: Deployment & LLMOps — MEDIUM PRIORITY
*You already know DevOps — adapt it for AI workloads. API-first; self-hosting is optional.*

- [ ] Containerize the AI service (multi-stage builds)
- [ ] Serving APIs via FastAPI (or your existing backend framework)
- [ ] CI/CD including prompt/config versioning and eval gates
- [ ] Secrets, environment separation, and provider key management
- [ ] Rate limiting, request queuing, retries, and graceful degradation
- [ ] Model/config versioning and rollback
- [ ] Ethics, compliance & responsible AI (bias, hallucination guards, PII, retention)

**Optional, only if self-hosting:** vLLM, batching, GPU/VRAM management, Cerebras/other inference providers. Most product roles call hosted APIs instead.

🎯 **Milestone:** Deploy Portfolio Project 4 with CI eval gates, tracing, and a rollback plan.

---

## 🟢 DEFERRED / OPTIONAL: The ML-Engineer Track
*Everything below is intentionally out of scope for your target role. Revisit only if you pivot toward model training.*

- [ ] Classical ML: linear/logistic regression, decision trees, random forests, XGBoost
- [ ] Deep learning: neural networks, backpropagation, CNNs, RNNs, LSTMs, GANs
- [ ] Reinforcement learning and RLHF/GRPO
- [ ] Pretraining, full fine-tuning, LoRA/QLoRA
- [ ] Classical NLP: Word2Vec, GloVe, FastText, spaCy NER pipelines
- [ ] GPU internals, CUDA setup, local quantization (Llama.cpp/GGUF)
- [ ] Research reasoning benchmarks (TruthfulQA, BBH, GSM8K)

---

## 📚 Resource Hub

| Resource / Platform | Topics Covered | Where to Find It |
| :--- | :--- | :--- |
| **DeepLearning.AI** *(Short Courses)* | LangChain, RAG, prompt engineering, agents, evals | [deeplearning.ai/short-courses](https://deeplearning.ai) |
| **Vercel AI SDK Docs** *(Official)* | Streaming, chat UI, tool calls, front-to-back AI features | [sdk.vercel.ai/docs](https://sdk.vercel.ai/docs) |
| **OpenAI Cookbook** *(Official)* | Embeddings, structured outputs, token optimization, evals | [cookbook.openai.com](https://cookbook.openai.com) |
| **Anthropic Docs** *(Official)* | Tool use, MCP, context engineering, prompt guidance | [docs.anthropic.com](https://docs.anthropic.com) |
| **LangChain Docs** *(Official)* | Chains, agents, RAG, tools | [python.langchain.com](https://python.langchain.com) |
| **LangGraph Docs** *(Official)* | Agent orchestration, state graphs, multi-agent | [langchain-ai.github.io/langgraph](https://langchain-ai.github.io/langgraph) |
| **LiteLLM Docs** *(Official)* | 100+ LLM providers, unified API, fallbacks | [docs.litellm.ai](https://docs.litellm.ai) |
| **ChromaDB Docs** *(Official)* | Vector database for RAG, local-first | [docs.trychroma.com](https://docs.trychroma.com) |
| **Qdrant Docs** *(Official)* | Vector search, filtering, hybrid retrieval | [qdrant.tech/documentation](https://qdrant.tech/documentation) |
| **LangFuse** *(Open Source)* | LLM observability, tracing, evals, cost | [langfuse.com/docs](https://langfuse.com/docs) |
| **CrewAI Docs** *(Official)* | Multi-agent orchestration | [docs.crewai.com](https://docs.crewai.com) |
| **HuggingFace Course** *(Free)* | Transformer concepts, embeddings, model landscape | [huggingface.co/learn](https://huggingface.co/learn) |
| **Andrej Karpathy** *(YouTube)* | Deep intuition for how LLMs work (watch selectively) | [YouTube @AndrejKarpathy](https://youtube.com) |
| **FAISS Docs** *(Meta)* | Local similarity search | [github.com/facebookresearch/faiss](https://github.com/facebookresearch/faiss) |
| **vLLM Docs** *(Official)* | Self-hosted inference (optional) | [docs.vllm.ai](https://docs.vllm.ai) |

---

## 🛠️ Portfolio Projects (The Build Syllabus)

Build these in order. Each one is a production-shaped artifact, not a tutorial.

### Project 1: Strict Schema Data Extractor — 🔴 HIGH
- **Goal:** Send messy text (receipts, logs, emails) to an LLM and force clean, validated JSON against a schema.
- **Stack:** Python/Pydantic (or TypeScript/Zod), provider API, retries.
- **Skills:** Structured outputs, schema validation, repair loops, failure routing.
- **Eval:** Field-level accuracy on a hand-labeled set.

### Project 2: Multi-Document RAG Application — 🔴 HIGH
- **Goal:** Ingest PDFs/docs, chunk and embed them, retrieve + rerank, and chat with citations.
- **Stack:** Vector DB (Chroma/Qdrant/pgvector), embedding model, LLM API, simple UI.
- **Skills:** Parsing, chunking, indexing, hybrid retrieval, reranking, grounding.
- **Eval:** Retrieval precision/recall@k + answer groundedness. **This eval is part of the deliverable.**

### Project 3: The Autonomous Database/Tool Agent — 🔴 HIGH
- **Goal:** NL input → safe tool calls → database/API → plain-English answer, with human approval for risky actions.
- **Stack:** Tool calling, LangGraph or plain loop, sandboxed tools.
- **Skills:** Function calling, bounded autonomy, tool validation, human-in-the-loop.
- **Eval:** Task success rate + unsafe-action rate (should be zero).

### Project 4: Full-Stack AI Product (Capstone) — 🔴 HIGH
*A rolling, 3-phase project that mirrors real product development.*

**Phase 1 — Foundation**
- [ ] Auth + multi-tenancy (users/orgs, data isolation)
- [ ] Core domain model + database
- [ ] LLM integration with structured outputs
- [ ] Streaming server endpoint + basic chat UI

**Phase 2 — Intelligence & Workflow**
- [ ] RAG over the product's own data, with citations
- [ ] One agentic workflow with tools and human-in-the-loop
- [ ] MCP server exposing app capabilities (and/or an MCP client)
- [ ] Guardrails, PII handling, prompt-injection defenses
- [ ] Usage metering, quotas, caching, cost controls
- [ ] Dockerize the stack

**Phase 3 — Production**
- [ ] Evaluation harness with golden dataset + regression gates
- [ ] Tracing, observability, quality/latency/cost dashboard
- [ ] CI/CD with eval gates and config/prompt versioning
- [ ] Failure UX, rate limiting, rollback plan, compliance notes

---

# 🗺️ DeepLearning.AI — Sequenced Learning Timeline

> A reduced, application-focused route through the DeepLearning.AI catalog. It covers the HIGH-priority phases (0–8) with the smallest sensible set of courses, and drops the ML-training specialization entirely. Built for a working full-stack developer.

## How to read this plan

- ✅ **Free** — DeepLearning.AI *Short Courses* (1–3 h each). No subscription needed. This is the majority of the route.
- 💳 **Pro** — *Courses* and *Professional Certificates* (require Pro ≈ $25–30/mo, or a Coursera plan). Subscribe **only** when you reach a 💳 anchor, and cancel when done.
- ⏱️ **Time** = the platform's stated duration. Budget **~1.5–2×** for exercises and notes.
- 📅 **Pace assumed**: 10–12 h/week. Week ranges are guidance, not deadlines.
- 🎯 Every stage ends in a **milestone output** — a project or artifact, never just "completed a course."
- 🧩 The roadmap's own **Portfolio Projects** are slotted at the end of the relevant stages.

**The only 💳 anchors on the core path:** `Retrieval Augmented Generation (RAG)` and `Agentic AI`. Everything else on the critical path is free. The old `Machine Learning Specialization` anchor is **dropped** — it served the model-training path, not yours.

---

## 🟢 Stage 0 — Orientation & ML Literacy (Week 1 · ~4 h)

The mental model before any code. Do this instead of a full ML course.

- [x] 💳 `AI for Everyone` — 6h54m — what AI can/can't do, societal impact. *(already done)*
- [ ] ✅ `Generative AI for Everyone` — 5h1m — GenAI capabilities, limits, business framing. *(often free to audit; skim)*
- [ ] Read/watch: evaluation metrics in retrieval (precision/recall@k, MRR), embeddings intuition, sampling parameters. Use the OpenAI Cookbook + provider docs.

🎯 **Milestone:** The "prompt vs. RAG vs. fine-tune vs. train" decision guide from Phase 0.

> **Skip:** `Machine Learning Specialization` (95 h), `Mathematics for ML` (94 h). Not on this path.

---

## 🟢 Stage 1 — Python & AI Fluency (Weeks 1–2 · fast-track)

You already program. Treat this as an AI-idiom speedrun, not a from-zero course.

- [ ] 💳 `AI Python for Beginners` — 11h30m — *only if* your Python is weak. Otherwise skip and pick up idioms on the fly.

🎯 **Milestone:** Rebuild one small existing script as a typed, tested Python service.

---

## 🔴 Stage 2 — LLM Literacy: How Models Behave (Week 2 · ~4 h) — PHASE 2

Concepts, not training. Prefer docs and short videos over long courses.

- [ ] ✅ `Attention in Transformers: Concepts and Code in PyTorch` (StatQuest) — 1h16m — watch for intuition; you won't implement it in production.
- [ ] ✅ `Finetuning Large Language Models` (Lamini) — ~1h — understand full fine-tune vs. PEFT/LoRA **as a decision**, not a skill.
- [ ] 💳 *(optional)* `Generative AI with Large Language Models` (AWS) — 13h18m — only if you want the lifecycle narrative and Bedrock context.

**Drop from the old plan:** `Transformers in Practice` (11 h), `Build and Train an LLM with JAX`, `Deep Learning Specialization`. These serve the ML path.

🎯 **Milestone:** Whiteboard prompt → tokens → output, including where latency and cost come from.

---

## 🔴 Stage 3 — Prompting, Integration & AI Coding (Weeks 3–4 · ~15 h) — PHASE 3

**3.1 Prompt engineering**
- [ ] 💳 `AI Prompting for Everyone` (Andrew Ng) — 7h4m — from finding info to building apps.
- [ ] ✅ `ChatGPT Prompt Engineering for Developers` (OpenAI) — ~1h — zero/few-shot, CoT, instruction refinement.
- [ ] ✅ `Reasoning with o1` (OpenAI) — 1h44m — prompting reasoning models, sampling intuition.

**3.2 LLM integration**
- [ ] ✅ `Building Systems with the ChatGPT API` (OpenAI) — ~1h — chat completions, structured outputs, moderation.
- [ ] ✅ `LangChain for LLM Application Development` (LangChain) — ~1h30m — chains, memory, agents.
- [ ] ✅ `Functions, Tools and Agents with LangChain` (LangChain) — ~1h — tool/function calling.
- [ ] ✅ `LangChain: Chat with Your Data` (LangChain) — ~1h — RAG with LangChain (preview of Stage 4).
- [ ] ✅ `Serverless LLM Apps with Amazon Bedrock` (AWS) — ~1h — cloud provider auth, multi-model, cost/latency.

**3.3 AI-assisted engineering workflows**
- [ ] ✅ `Claude Code: A Highly Agentic Coding Assistant` (Anthropic) — 2h
- [ ] ✅ `Spec-Driven Development with Coding Agents` (JetBrains) — 1h16m
- [ ] ✅ `AI Coding Workflows: From Cloud to Local` (JetBrains) — 1h32m
- [ ] ✅ `AI Code Review` (Qodo) — 1h4m

🎯 **Milestone → Portfolio Project 1:** `Strict Schema Data Extractor`.

---

## 🔴 Stage 4 — Embeddings, Vector Search & RAG (Weeks 5–8 · ~35 h) — PHASE 4

- [ ] 💳 `Retrieval Augmented Generation (RAG)` (DeepLearning.AI) — 26h3m — **the anchor**: architecture → chunking → retrieval → deployment → evaluation.
- [ ] ✅ `Advanced Retrieval for AI with Chroma` (Chroma) — 1h2m — reranking, query improvement, spotting bad retrieval.
- [ ] ✅ `Building and Evaluating Advanced RAG` (LlamaIndex / TruEra) — ~1h30m — retrieval + eval metrics.
- [ ] ✅ `Preprocessing Unstructured Data for LLM Applications` (Unstructured) — 1h22m — PDF/PPTX/HTML extraction.
- [ ] ✅ `Building AI Assistants with On-Device Memory` (Qdrant) — 1h4m — vector memory.
- [ ] ✅ `Multi-vector Image Retrieval` (Qdrant) — 1h43m — multimodal retrieval (optional).

**Shipping the RAG app (front-to-back bridge):**
- [ ] 💳 `Fast Prototyping of GenAI Apps with Streamlit` (Snowflake) — 9h21m — or build the UI yourself with the Vercel AI SDK (preferred for your goal).

🎯 **Milestone → Portfolio Project 2:** `Multi-Document RAG Application` with retrieval + answer evals.

---

## 🔴 Stage 5 — Agents, Tool Use & Chat UX (Weeks 9–11 · ~20 h) — PHASE 5

- [ ] 💳 `Agentic AI` (Andrew Ng) — 9h55m — **the anchor**: agent loops, reflection, tool use, planning.
- [ ] ✅ `Multi AI Agent Systems with crewAI` (crewAI) — 3h1m — multi-agent orchestration.
- [ ] ✅ `Long-Term Agentic Memory With LangGraph` (LangChain) — 1h24m — memory + state graphs.
- [ ] ✅ `Building Adaptive AI Agents` (Oracle) — 1h3m — agent traces → reusable skills.
- [ ] ✅ `DSPy: Build and Optimize Agentic Apps` (Databricks) — 59m — programmatic optimization.

**Chat UX (fill from docs, not courses):**
- [ ] Vercel AI SDK: streaming chat, tool calls, generative UI
- [ ] Conversation state, cancellation, error/retry states

**Optional:** `Building AI Browser Agents`, `Agentic Knowledge Graph Construction`, `Knowledge Graphs for AI Agent API Discovery` — only if your product needs them.

🎯 **Milestone → Portfolio Project 3:** `The Autonomous Database/Tool Agent`.

---

## 🔴 Stage 6 — MCP & Applied LLM Engineering (Weeks 12–13 · ~10 h) — PHASE 6

- [ ] ✅ `MCP: Build Rich-Context AI Apps with Anthropic` (Anthropic) — 1h58m — **the MCP anchor**.
- [ ] ✅ `Build AI Apps with MCP Server: Working with Box Files` (Box) — 36m — MCP + multi-agent.
- [ ] ✅ `Pydantic for LLM Workflows` (DeepLearning.AI) — 1h50m — structured outputs, validation, retries.
- [ ] ✅ `Context Engineering` (DeepLearning.AI) — ~1–2h — dynamic context windows and scaffolds.
- [ ] ✅ `Safe and reliable AI via guardrails` (GuardrailsAI) — 1h42m — safety boundaries, PII, production guardrails.

🎯 **Milestone:** Add MCP + validation + guardrails to Portfolio Project 3.

---

## 🔴 Stage 7 — Evaluation & Observability (Weeks 14–15 · ~10 h) — PHASE 8

- [ ] ✅ `Evaluating AI Agents` (Arize AI) — 2h36m — structured assessments, iteration.
- [ ] LangFuse docs — tracing, datasets, evals, cost dashboards (hands-on).
- [ ] Build your own eval harness for Projects 2–4 (golden set + regression gate).

🎯 **Milestone:** Eval harness + tracing + quality/latency/cost dashboard on Portfolio Project 4.

---

## 🟡 Stage 8 — Deployment & LLMOps (Weeks 15–16 · ~8 h) — PHASE 9

- [ ] ✅ `Orchestrating Workflows for GenAI Applications` (Astronomer) — 1h48m — background/async pipelines.
- [ ] Vercel/your host: deploy the full-stack AI product with secrets and rate limiting.
- [ ] CI/CD with prompt/config versioning + eval gates.

**Skip unless self-hosting:** `Fast & Efficient LLM Inference with vLLM`, `Efficiently Serving LLMs`, `Fast LLM Inference with Cerebras`. Hosted APIs are the product default.

🎯 **Milestone → Portfolio Project 4 complete and deployed.**

---

## 🟢 Stage 9 — Optional Depth (Weeks 17+)

- [ ] ✅ `Post-training of LLMs` (UW / NexusFlow) — 1h26m — SFT, DPO, online RL (concepts only).
- [ ] ✅ `Reasoning with o1` (OpenAI) — 1h44m *(repeat for depth)*.
- [ ] ✅ `Introducing Multimodal Llama 3.2` (Meta) — 1h39m — only if your product is multimodal.
- [ ] ✅ `Voice for AI Agents and Applications` (Vocal Bridge) — 1h26m — only if voice is in scope.
- [ ] ✅ `Document AI: From OCR to Agentic Doc Extraction` (LandingAI) — 3h11m — useful for ingestion-heavy products.

**Removed entirely from the old plan:** `Machine Learning Specialization`, `Mathematics for ML`, `Deep Learning Specialization`, `Fine-tuning & RL for LLMs`, `Reinforcement Fine-Tuning with GRPO`, `Transformers in Practice`, `Build and Train an LLM with JAX`.

🎯 **Milestone:** Extend Portfolio Project 4 with whichever optional capability is relevant to your product.

---

## 📌 Roadmap Phase → Course Coverage Map

| Roadmap Phase | Covered by | Coverage |
| :--- | :--- | :--- |
| **Phase 0** Orientation & ML literacy | AI for Everyone, GenAI for Everyone, docs | ✅ Sufficient (deliberately shallow) |
| **Phase 1** Python & AI fluency | AI Python for Beginners (optional) | ✅ |
| **Phase 2** LLM literacy | Attention (StatQuest), Fine-tuning (Lamini) | ✅ Conceptual |
| **Phase 3.1** Prompt engineering | AI Prompting, ChatGPT Prompt Eng, Reasoning with o1 | ✅ Strong |
| **Phase 3.2** LLM integration | ChatGPT API, LangChain ×3, Bedrock | ✅ Strong (add Vercel AI SDK for UI) |
| **Phase 3.3** AI coding workflows | Claude Code, Spec-Driven Dev, AI Code Review | ✅ Strong |
| **Phase 4.1** Embeddings & vector search | RAG course, On-Device Memory, Multi-vector | ✅ Strong |
| **Phase 4.2** RAG architecture | RAG (26h), Advanced Retrieval, Advanced RAG, Unstructured | ✅ Strong |
| **Phase 5** Agents & chat UX | Agentic AI, crewAI, LangGraph memory, DSPy + AI SDK docs | ✅ Strong |
| **Phase 6** MCP & applied engineering | MCP ×2, Pydantic, Context Engineering, Guardrails | ✅ Strong |
| **Phase 7** Full-stack AI features | *(no single course — build + AI SDK docs)* | ⚠️ Build-driven |
| **Phase 8** Evaluation & observability | Evaluating AI Agents + LangFuse docs | ✅ Strong (hands-on required) |
| **Phase 9** Deployment & LLMOps | Airflow, deploy hands-on | ✅ Sufficient |
| **Deferred ML track** | Machine Learning Specialization, DLS, RL, fine-tuning | ⏸️ Intentionally skipped |

## ⚠️ Gaps Courses Don't Fill (and where to get them)

| Missing topic | Roadmap item | Where to get it |
| :--- | :--- | :--- |
| Streaming chat UI / front-to-back AI UX | Phase 7 | Vercel AI SDK docs, build it |
| Auth, multi-tenancy & per-user cost isolation | Phase 7 | Your existing full-stack patterns |
| Prompt-injection defense & tool sandboxing | Phase 6–7 | OWASP LLM Top 10, provider security docs |
| Retrieval metrics (precision@k, MRR, nDCG) | Phase 0/4 | Search/IR references, build the eval |
| LangFuse + OpenTelemetry tracing | Phase 8 | LangFuse docs, OpenTelemetry docs |
| LiteLLM / model routing & fallbacks | Phase 3 | LiteLLM docs |
| pgvector / production vector DB ops | Phase 4 | Postgres + pgvector docs, Qdrant docs |
| Domain-specific vertical agent patterns | Phase 5.3 | Build your own; no course exists |
| Self-hosting / vLLM / quantization *(optional)* | Deferred | vLLM docs, llama.cpp docs |

## 🧭 Suggested Cadence

1. **Weeks 1–2** — Stages 0–2 (orientation, ML literacy, LLM literacy). Cheap and fast; no ML specialization.
2. **Weeks 3–4** — Stage 3 (prompting + integration + AI coding). Mostly free; ship Project 1.
3. **Weeks 5–8** — Stage 4 (RAG). The anchor course; ship Project 2 **with evals**.
4. **Weeks 9–11** — Stage 5 (agents + chat UX). Ship Project 3.
5. **Weeks 12–15** — Stages 6–7 (MCP, applied engineering, eval/observability).
6. **Weeks 15–16** — Stage 8 (deployment). Finish and deploy Project 4.
7. **Week 17+** — Stage 9 optional depth, driven by your product.

**Subscription strategy:** stay free through Stages 0–1 and most of Stage 3. Buy **Pro for ~2 months** to cover `RAG` (Stage 4) + `Agentic AI` (Stage 5), then cancel. Everything else is free short courses plus docs and building. Expected total cost is far lower than the old plan — and you skip ~200 hours of ML theory you would never use.
