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
