

**PAaaS**  
Personal AI Agent as a Service

**TECHNICAL SPECIFICATION**

Architecture, Frameworks & Implementation Roadmap

*with LightRAG Graph-Enhanced Retrieval Pipeline*

Version 1.1  |  February 2026  
Based on Cloudflare moltworker / OpenClaw \+ LightRAG (EMNLP 2025\)

**CONFIDENTIAL**

# **Table of Contents**

# **1\. Executive Overview**

This specification defines the architecture for PAaaS (Personal AI Agent as a Service) — a multi-tenant platform providing personal AI assistants via Telegram, Discord, Slack, and web. Built as a fork of the moltworker framework (Cloudflare Workers \+ OpenClaw) with LightRAG (EMNLP 2025\) as the graph-enhanced retrieval engine for Phase 2, delivering personal knowledge graphs and cross-conversation memory for every user.

## **1.1 Scope of the Document**

* System architecture and component decomposition

* Multi-tenant isolation and data sovereignty model

* Framework and language recommendations (with comparison matrix)

* LightRAG integration strategy for graph-enhanced RAG in Phase 2

* Graph database backends (Neo4j, PostgreSQL AGE, in-memory) via LightRAG

* Extension points for niche/vertical industry applications

* Security, GDPR compliance, and operational constraints

* Infrastructure cost model and scaling strategy

* 90-day implementation roadmap with technical milestones

## **1.2 Design Principles**

| Principle | Description |
| :---- | :---- |
| Multi-tenancy First | Every component must support strict tenant isolation from day one. No shared state between tenants. |
| Edge-Native | Compute at the edge (Cloudflare Workers) for sub-50ms latency globally. Data remains close to the user. |
| BYOK Transparency | Users bring their own API keys. Platform never stores or proxies keys in plaintext. |
| Plugin Architecture | Skills, integrations, and AI providers are modular plugins. Adding a new channel or AI model requires zero core changes. |
| Infrastructure Abstraction | Core logic decoupled from Cloudflare primitives via interface layer. Enables migration to Fly.io, Deno Deploy, or K8s. |
| Privacy by Design | GDPR/CCPA compliance embedded in architecture. Data minimization, consent management, right to erasure. |
| LightRAG-Powered Memory | Every user gets a personal knowledge graph via LightRAG dual-level retrieval. Graph-enhanced context across all conversations. |

# **2\. Baseline: moltworker / OpenClaw Analysis**

The moltworker repository (github.com/cloudflare/moltworker) is a proof-of-concept running the OpenClaw personal AI assistant inside a Cloudflare Sandbox container.

## **2.1 Current Technology Stack**

| Layer | Technology | Role in PAaaS |
| :---- | :---- | :---- |
| Runtime | Cloudflare Workers \+ Sandbox (Durable Objects) | Isolated container per agent instance |
| Language | TypeScript (Node.js compat) | All server-side and gateway logic |
| Web Framework | Hono v4 | HTTP routing, middleware, API endpoints |
| Frontend Build | Vite 6 \+ React 19 | Admin/Control UI SPA |
| AI Provider | Anthropic Claude API / AI Gateway | LLM inference (extensible to multi-provider) |
| Storage | Cloudflare R2 (S3-compatible) | Conversations, files, user data persistence |
| State | Durable Objects \+ SQLite | In-process state, session management |
| Browser Automation | Cloudflare Puppeteer (CDP) | Web scraping, form filling, screenshots |
| Auth | Cloudflare Access \+ Gateway Token \+ Device Pairing | Multi-layer authentication |
| Messaging SDKs | Telegram Bot API, Discord.js, Slack Bolt | Multi-channel message delivery |
| Monitoring | Cloudflare Analytics \+ Observability | Metrics, logs, error tracking |
| Testing | Vitest \+ oxlint | Unit tests, linting |

## **2.2 Architecture Gaps for PAaaS**

| Gap | Severity | Effort | Description |
| :---- | :---- | :---- | :---- |
| Multi-Tenant Isolation | Critical | 2-3 weeks | Per-user R2 namespaces, routing, quota enforcement |
| Billing & Subscriptions | Critical | 1-2 weeks | Stripe/Paddle integration, plan management, usage metering |
| BYOK Key Management | High | 1 week | Encrypted vault for user API keys, per-request key injection |
| LightRAG Integration | High (Ph.2) | 2-3 weeks | Per-tenant LightRAG instance, graph storage, dual-level retrieval |
| Referral Engine | Medium | 3-5 days | Link generation, attribution tracking, credit ledger |
| Admin Dashboard | High | 1-2 weeks | React SPA: user management, revenue, usage analytics |
| i18n Framework | Medium | 3-5 days | UI translations, locale detection, RTL support |
| GDPR Compliance Layer | High | 1 week | Consent management, data export/delete API, DPA generation |
| Plugin/Skill Marketplace | Low (Ph.3) | 3-4 weeks | Skill registry, sandboxed execution, revenue sharing |

# **3\. System Architecture**

## **3.1 High-Level Component Diagram**

The system follows a layered architecture with LightRAG as the knowledge/retrieval layer operating alongside the core agent runtime.

| LAYER 6  |  CLIENT LAYER          |  Telegram Bot  |  Discord Bot  |  Slack Bot  |  Web UI (React)  |  Mobile (RN) LAYER 5  |  API GATEWAY (Hono)          |  Auth Middleware  |  Rate Limiter  |  Tenant Router  |  Webhook Handler LAYER 4  |  BUSINESS LOGIC          |  Agent Runtime  |  Skill Engine  |  Billing Service  |  Referral Engine LAYER 3  |  LIGHTRAG KNOWLEDGE LAYER  (Phase 2\)          |  Entity Extraction  |  Dual-Level Retrieval  |  Knowledge Graph  |  Embeddings          |  Per-Tenant Graph   |  Incremental Index     |  Cross-Conv Memory  |  RAG Pipeline LAYER 2  |  DATA & INTEGRATION          |  AI Provider Adapter  |  R2 Storage  |  Neo4j/PG AGE  |  Vector DB  |  External APIs LAYER 1  |  INFRASTRUCTURE          |  CF Workers  |  Durable Objects  |  R2 Buckets  |  CF Access  |  Browser Rendering |
| :---- |

## **3.2 Multi-Tenant Isolation Model**

| Layer | Isolation Mechanism | Implementation |
| :---- | :---- | :---- |
| Compute | Durable Object per tenant | Each user gets a dedicated Sandbox DO instance with independent lifecycle |
| Storage | R2 namespace prefix | All objects prefixed with tenant\_id/. ACL policy prevents cross-tenant access |
| State | SQLite per DO | Durable Objects embed per-tenant SQLite. No shared database tables |
| AI Keys | Encrypted per-tenant vault | AES-256-GCM encrypted BYOK keys stored in tenant-scoped R2 with HKDF-derived keys |
| LightRAG | Per-tenant workspace | LightRAG WORKSPACE env per tenant. Separate graph namespace \+ vector collection |
| Sessions | JWT with tenant claim | All API calls carry signed tenant\_id. Gateway validates before routing |
| Rate Limits | Per-tenant counters | Cloudflare Rate Limiting rules scoped to tenant\_id header |

## **3.3 AI Provider Abstraction Layer**

| Component | Description |
| :---- | :---- |
| IAIProvider Interface | Defines chat(), stream(), embed(), moderate() methods. All providers implement this. |
| ProviderRegistry | Maps provider names to factory functions. Supports runtime registration of new providers. |
| KeyResolver | Resolves API key per request: (1) User BYOK key, (2) Platform pool key, (3) AI Gateway. |
| ModelRouter | Routes requests to optimal provider based on task type, cost, latency, and user preference. |
| LightRAG Adapter | Wraps IAIProvider for LightRAG’s llm\_model\_func. Enables BYOK models for entity extraction \+ retrieval. |
| UsageTracker | Meters token consumption per tenant for billing. Writes to Durable Object counters. |
| FallbackChain | If primary provider fails, retries with secondary (e.g., Claude → GPT → Gemini). |

# **4\. Framework & Language Recommendations**

Based on the existing moltworker codebase (TypeScript \+ Hono \+ Vite \+ React), Cloudflare Workers constraints, and the need for LightRAG integration (Python-native), the following options are evaluated.

## **4.1 Backend Runtime / Framework Options**

### **Option A: TypeScript \+ Hono (RECOMMENDED — Primary)**

Natural evolution of the moltworker stack. All gateway, billing, auth, and agent runtime logic stays in TypeScript.

| Criterion | Assessment |
| :---- | :---- |
| Compatibility | Direct fork from moltworker. Zero migration cost. Hono is the existing web framework. |
| CF Workers Support | First-class. Hono designed for edge runtimes. Full DO, R2, AI Gateway support. |
| Ecosystem | npm (3M+ packages). Drizzle ORM for D1/SQLite. Zod validation. jose for JWT. |
| Performance | Sub-1ms cold start on Workers. V8 isolates. |
| Team Velocity | Largest JS/TS talent pool. Fast iteration. Community support. |
| LightRAG Integration | Calls LightRAG Python service via HTTP API. LightRAG Server exposes REST \+ Ollama-compatible endpoints. |
| Limitations | No native multithreading. CPU-intensive tasks need Queues or external compute. |

### **Option B: Python \+ FastAPI (RECOMMENDED — LightRAG Service)**

Dedicated Python microservice running LightRAG Server. This is the natural fit because LightRAG is a Python-native framework with its own API server and Web UI.

| Criterion | Assessment |
| :---- | :---- |
| Compatibility | LightRAG is Python-native (pip install lightrag-hku\[api\]). No adaptation needed. |
| CF Workers Support | NOT on Workers. Deployed separately on Fly.io, Railway, or Docker (VPS/K8s). |
| Ecosystem | Best AI/ML ecosystem. LangChain, transformers, sentence-transformers all available. |
| LightRAG Native | LightRAG Server provides REST API (port 9621), Web UI for graph exploration, Ollama-compatible chat endpoint. |
| Storage Backends | Neo4j, PostgreSQL+AGE+pgvector, MongoDB, Milvus, FAISS, Redis, Qdrant — all supported out of box. |
| Multi-Tenancy | LightRAG supports WORKSPACE isolation. Each tenant gets a separate workspace in the same instance. |
| Team Velocity | Largest developer community for AI. Fastest prototyping for RAG features. |
| Limitations | Separate deployment. Additional infra cost ($5-20/mo for Fly.io). Latency for cross-service calls (\~20-50ms). |

### **Option C: Rust \+ WASM (Phase 3 — Performance Modules)**

| Criterion | Assessment |
| :---- | :---- |
| Use Case | CPU-intensive processing: PDF parsing, encryption, data transformation, embedding quantization. |
| CF Workers Support | Workers support Rust via WASM. \~5ms cold start. |
| Recommendation | Compile specific hot-path modules to WASM. Not for main platform or LightRAG. |

### **Option D: Go \+ Chi (NOT RECOMMENDED)**

| Criterion | Assessment |
| :---- | :---- |
| CF Workers Support | NOT SUPPORTED. Go compiles to native, not WASM for Workers. |
| LightRAG | No LightRAG integration (Python-only library). |
| Recommendation | Only viable if migrating entirely away from Cloudflare. Not recommended. |

## **4.2 Recommendation Matrix**

| Criterion | TS+Hono (Primary) | Python+FastAPI (LightRAG) | Rust+WASM | Go+Chi |
| :---- | :---- | :---- | :---- | :---- |
| CF Workers Native | ✅ Full | ❌ Separate | ⚠ WASM only | ❌ No |
| Fork Compatibility | ✅ Direct | N/A (new service) | ❌ Rewrite | ❌ Rewrite |
| LightRAG Support | ⚠ Via HTTP API | ✅ Native | ❌ No | ❌ No |
| Graph DB Support | ⚠ Via LightRAG svc | ✅ Neo4j/PG/Mongo | ⚠ Crates | ⚠ Drivers |
| AI/ML Ecosystem | ⚠ Good | ✅ Best | ⚠ Growing | ⚠ Basic |
| Edge Performance | ✅ \<1ms cold | ❌ Server-based | ✅ \~5ms WASM | ❌ N/A |
| Developer Pool | ✅ Large | ✅ Largest | ⚠ Small | ✅ Large |
| OVERALL | 9/10 ⭐ Gateway | 9/10 ⭐ RAG Layer | 6/10 Modules | 3/10 Skip |

## **4.3 Final Architecture Decision**

**Primary Stack (Gateway \+ Agent):** TypeScript \+ Hono \+ Vite \+ React (direct fork of moltworker). Handles auth, billing, messaging, agent orchestration.

**Knowledge/RAG Layer (Phase 2):** Python \+ LightRAG Server as a dedicated microservice. Deployed on Fly.io or Docker VPS. Connected via REST API. Provides dual-level retrieval, knowledge graph, entity extraction, and per-tenant memory.

**Performance Modules (Phase 3+):** Rust WASM modules for PDF parsing, encryption, data transformation — compiled to Workers-compatible WASM.

# **5\. Data Architecture & LightRAG Integration**

## **5.1 Primary Data Model**

Hybrid approach: Durable Objects with SQLite for transactional data, R2 for blobs, and LightRAG for graph-based knowledge storage and retrieval.

| Entity | Storage | Key Fields | Relationships |
| :---- | :---- | :---- | :---- |
| Tenant | DO SQLite | id, email, plan, created\_at, locale, preferences | HAS Subscription, HAS Agent, REFERRED\_BY Tenant |
| Subscription | DO SQLite | id, tenant\_id, plan, status, stripe\_id, expires\_at | BELONGS\_TO Tenant, HAS UsageRecords |
| Agent | DO SQLite | id, tenant\_id, name, model, provider, system\_prompt | BELONGS\_TO Tenant, HAS Conversations, HAS Skills |
| Conversation | R2 \+ SQLite idx | id, agent\_id, channel, started\_at, message\_count | BELONGS\_TO Agent, CONTAINS Messages |
| Message | R2 (JSON) | id, conversation\_id, role, content, tokens, timestamp | PART\_OF Conversation → indexed in LightRAG |
| Knowledge Graph | LightRAG | Entities, relationships, embeddings, high/low level keys | Managed by LightRAG per tenant workspace |
| Skill | R2 (code bundle) | id, name, version, author, manifest, permissions | USED\_BY Agent |
| BYOKKey | R2 (encrypted) | id, tenant\_id, provider, encrypted\_key, created\_at | BELONGS\_TO Tenant |
| Referral | DO SQLite | id, referrer\_id, referee\_id, status, reward\_type | FROM Tenant TO Tenant |

## **5.2 LightRAG Architecture (Phase 2\)**

LightRAG (HKUDS/LightRAG, EMNLP 2025\) is a graph-enhanced RAG framework that integrates knowledge graphs into text indexing and retrieval. It provides the personal memory and knowledge layer for every PAaaS user.

### **5.2.1 Why LightRAG**

| Advantage | Description |
| :---- | :---- |
| Dual-Level Retrieval | Low-level retrieval for specific entities/relationships \+ high-level retrieval for themes/topics. Covers both precise and contextual queries. |
| Graph-Based Indexing | Automatically extracts entities and relationships from text using LLMs. Builds knowledge graph without manual ontology design. |
| Incremental Updates | New documents are indexed incrementally without rebuilding the entire graph. Critical for real-time conversation indexing. |
| Multi-Backend Storage | Supports Neo4j, PostgreSQL+AGE, Memgraph for graphs; FAISS, Milvus, pgvector, Qdrant for vectors; PostgreSQL, MongoDB, Redis for KV. |
| Built-in API Server | LightRAG Server provides REST API \+ Web UI for graph exploration \+ Ollama-compatible chat endpoint. |
| Workspace Isolation | Native multi-workspace support (WORKSPACE env per tenant). Each user gets isolated graph \+ vector \+ KV namespaces. |
| BYOK Compatible | Uses llm\_model\_func and embedding\_func abstractions. Can route through PAaaS’s AI Provider Adapter for BYOK key injection. |
| Proven Quality | Published at EMNLP 2025\. Outperforms Microsoft GraphRAG on comprehensiveness, diversity, and empowerment metrics. |

### **5.2.2 LightRAG Deployment Architecture**

LightRAG Server runs as a separate Python microservice, communicating with the main PAaaS gateway via HTTP REST API.

| PAaaS Gateway (Cloudflare Workers / Hono)     |                                                                             |  HTTP REST API (authenticated with internal service token)                   v                                                                         LightRAG Server (Python, Fly.io / Docker VPS)     |-- REST API (port 9621\)         /documents, /query, /graph, /health          |-- Web UI                       Knowledge graph visualization                |-- Ollama-compat endpoint       Chat interface for testing                    |-- Workspace Manager            Per-tenant namespace isolation                v                                                                         Storage Backends (per environment)     |-- Graph:   Neo4j AuraDB (prod) / PostgreSQL+AGE (staging) / In-memory (dev)     |-- Vector:  pgvector (prod) / FAISS (dev) / Milvus (scale)                   |-- KV:      PostgreSQL (prod) / JSON files (dev) / Redis (cache)         |
| :---- |

### **5.2.3 LightRAG Storage Backend Selection**

| Backend | Type | Phase | Use Case | Cost |
| :---- | :---- | :---- | :---- | :---- |
| JSON \+ NanoVectorDB | File-based | Dev/MVP | Local development, testing, proof of concept. Zero dependencies. | Free |
| PostgreSQL \+ pgvector \+ AGE | Unified | Phase 2 Prod | Single database for KV \+ vectors \+ graphs. Simplest production setup. PG 16.6+. | $7-15/mo (Fly.io PG) |
| Neo4j AuraDB \+ pgvector | Specialized | Phase 3 Scale | Best graph performance. Superior multi-hop reasoning. Production SLA. | $65+/mo (AuraDB Pro) |
| Redis | Cache | Phase 2+ | Hot data caching. Session state. Rate limiting. NOT primary storage. | $0-10/mo (Upstash) |
| Milvus / Qdrant | Vector | Phase 3+ | High-volume vector search if pgvector becomes bottleneck at 50K+ tenants. | $29+/mo (cloud) |

### **5.2.4 Recommended Phased Strategy**

**Phase 1 (MVP, Weeks 1-4):** No LightRAG. Simple conversation history stored in R2. Basic context window management. Focus on core platform: auth, billing, multi-tenant, messaging.

**Phase 2 (Months 2-3) — LightRAG Integration:** Deploy LightRAG Server on Fly.io with PostgreSQL (unified KV \+ vector \+ graph via AGE). Each tenant gets a WORKSPACE. Conversations are incrementally indexed into the graph. Dual-level retrieval enriches agent responses with personal knowledge context.

**Phase 3 (Months 4-6):** Migrate graph storage to Neo4j AuraDB for high-value tenants (Privacy+ plan). Add multimodal indexing via RAG-Anything. Skill marketplace can publish custom LightRAG extraction prompts for vertical-specific entity types.

### **5.2.5 LightRAG Integration Interface**

The PAaaS gateway communicates with LightRAG via a TypeScript adapter that wraps the LightRAG REST API:

| // ─── LightRAG Client Adapter (TypeScript, runs on CF Workers) ─── interface ILightRAGClient {   // Document ingestion — index conversation/file into tenant’s graph   insertDocument(tenantId: string, content: string, metadata?: DocMeta): Promise\<InsertResult\>;     // Dual-level query — LightRAG’s core retrieval   query(tenantId: string, question: string, mode: QueryMode): Promise\<RAGResponse\>;     // Retrieval modes mapped to LightRAG’s native modes   // mode: 'naive' | 'local' | 'global' | 'hybrid' | 'mix'     // Knowledge graph operations   getGraphStats(tenantId: string): Promise\<GraphStats\>;   getEntities(tenantId: string, filter?: EntityFilter): Promise\<Entity\[\]\>;   getRelationships(tenantId: string, entityId: string): Promise\<Relationship\[\]\>;     // Tenant lifecycle   createWorkspace(tenantId: string): Promise\<void\>;   deleteWorkspace(tenantId: string): Promise\<void\>;  // GDPR Art.17   exportWorkspace(tenantId: string): Promise\<ExportBundle\>;  // GDPR Art.20 }   // ─── Query modes explained ─── type QueryMode \=   | 'naive'   // Simple vector similarity (baseline, no graph)   | 'local'   // Low-level: specific entities and direct relationships   | 'global'  // High-level: broad themes, cross-document patterns   | 'hybrid'  // Combined local \+ global (recommended default)   | 'mix';    // All modes merged for maximum coverage |
| :---- |

### **5.2.6 Conversation-to-Graph Pipeline**

Every conversation message flows through a pipeline that indexes content into the tenant’s LightRAG knowledge graph:

| Step | Trigger | Action | LightRAG API |
| :---- | :---- | :---- | :---- |
| 1\. Message received | User sends message | Store in R2 as part of conversation | N/A |
| 2\. Agent responds | LLM generates response | Store response in R2 | N/A |
| 3\. Async indexing | Queue worker (every N messages or on conversation end) | Send conversation chunk to LightRAG for indexing | POST /documents |
| 4\. Entity extraction | LightRAG internal | LLM extracts entities and relationships from text | Internal (LightRAG) |
| 5\. Graph update | LightRAG internal | Entities/edges added to tenant’s workspace graph | Internal (LightRAG) |
| 6\. Context enrichment | Next user query | LightRAG retrieves relevant knowledge from graph | POST /query (hybrid mode) |
| 7\. Augmented prompt | Agent runtime | Retrieved context injected into system prompt for LLM | N/A |

# **6\. Extension Architecture for Vertical Applications**

The platform serves as a horizontal foundation customizable for specific industries through plugins and LightRAG-powered vertical knowledge graphs.

## **6.1 Vertical Extension Model**

| Vertical | Target ICP | LightRAG Customization | Custom Integrations | Premium |
| :---- | :---- | :---- | :---- | :---- |
| Legal Tech | Law firms, attorneys | Legal entity types (case, statute, precedent). Citation graph extraction. | Clio, Westlaw API | \+50-100% |
| Healthcare | Clinics, practitioners | Medical entity extraction (diagnosis, treatment, drug). HIPAA-safe processing. | Epic FHIR, DrChrono | \+100-200% |
| Real Estate | Agents, managers | Property/listing/buyer entity graph. Market relationship analysis. | Zillow API, MLS | \+30-50% |
| E-Commerce | Shopify merchants | Product/customer/order knowledge graph. Buying pattern relationships. | Shopify, WooCommerce | \+20-40% |
| Finance | Advisors, accountants | Financial entity extraction (company, metric, risk). Cross-report analysis. | QuickBooks, Plaid | \+100-150% |
| Education | Tutors, creators | Concept/topic knowledge graph. Learning dependency relationships. | Canvas, Google Classroom | \+20-30% |
| Marketing | Agencies, freelancers | Campaign/audience/channel entity graph. Performance relationship tracking. | Google Ads, Semrush | \+30-50% |

## **6.2 Vertical LightRAG Configuration**

Each vertical customizes LightRAG’s entity extraction via custom prompts injected into the LLM entity extraction step:

| Component | Horizontal (Default) | Vertical Example (Legal) |
| :---- | :---- | :---- |
| Entity types | Person, Organization, Location, Event, Concept | \+ Case, Statute, Court, Jurisdiction, LegalPrinciple |
| Relationship types | MENTIONS, RELATES\_TO, PART\_OF, CAUSES | \+ CITES, OVERRULES, AMENDS, APPLIES\_TO, FILED\_IN |
| Extraction prompt | Generic entity/relationship extraction | Domain-tuned prompt with legal terminology and citation patterns |
| Retrieval priority | Hybrid (local+global) default | Local-first for case lookup, global for legal principle analysis |
| Graph visualization | Generic node/edge display | Case timeline view, citation tree, jurisdiction hierarchy |

## **6.3 Skill Plugin Architecture**

| Component | Description |
| :---- | :---- |
| Skill Manifest (skill.json) | Declares name, version, permissions (network, storage, user\_data, lightrag), input/output schema. |
| Skill Runtime (index.ts) | Exports execute() function. Receives context (tenant, conversation, params, lightragClient). |
| LightRAG Access | Skills can query the tenant’s knowledge graph via injected ILightRAGClient. Read-only by default. |
| Sandboxed Execution | Skills run in isolated V8 isolates. No access to other tenants or platform internals. |
| Permission Model | Skills declare required permissions. ‘lightrag:read’ / ‘lightrag:write’ grants are explicit. |
| Marketplace | Central registry. Version management, reviews, analytics, revenue sharing (70/30). |

# **7\. Security Architecture**

## **7.1 Authentication & Authorization**

| Layer | Mechanism | Scope |
| :---- | :---- | :---- |
| L1: Edge Auth | Cloudflare Access (OIDC/SAML) | All admin routes, Control UI. Zero Trust network. |
| L2: Gateway Token | HMAC-SHA256 signed token | Control UI sessions. Rotated every 24h. |
| L3: API Auth | JWT (RS256) with tenant claim | All API calls. 1h expiry, refresh token 7d. |
| L4: Device Pairing | Challenge-response with explicit approval | Messenger bot authentication. |
| L5: BYOK Vault | AES-256-GCM \+ HKDF | User API keys encrypted at rest. Per-request decryption. |
| L6: LightRAG Service Auth | Internal service token (mTLS in Phase 3\) | Gateway → LightRAG API. Not exposed to internet. |
| L7: Skill Permissions | Capability-based access control | Skills declare permissions. User grants. Runtime enforced. |

## **7.2 GDPR & Data Sovereignty**

| GDPR Article | Requirement | Implementation (incl. LightRAG) |
| :---- | :---- | :---- |
| Art. 5 | Data minimization | Only email, preferences, conversations collected. LightRAG indexes only user’s own content. |
| Art. 6-7 | Consent | Explicit consent at registration. Separate consent for LightRAG knowledge graph creation. |
| Art. 15 | Right of access | One-click export (JSON/ZIP) including LightRAG graph export via exportWorkspace(). |
| Art. 17 | Right to erasure | Cascade delete: R2 \+ DO \+ LightRAG workspace (deleteWorkspace()). \<72h SLA. |
| Art. 20 | Data portability | API endpoint returning conversations \+ knowledge graph in machine-readable format. |
| Art. 25 | Privacy by design | Encryption at rest, TLS 1.3, tenant isolation, BYOK, LightRAG workspace isolation. |
| Art. 33 | Breach notification | Automated incident detection. Template notification within 72h. |
| Art. 35 | DPIA | Completed before launch. Includes LightRAG data processing assessment. |

# **8\. Constraints, Limitations & Risk Mitigation**

## **8.1 Technical Constraints**

| Constraint | Impact | Mitigation |
| :---- | :---- | :---- |
| CF Workers CPU limit (30s) | Heavy AI inference must be external | AI calls are async HTTP. LightRAG runs on separate service. |
| CF Workers memory (128MB) | Cannot load models in-memory | LightRAG \+ embeddings on dedicated Python service. |
| LightRAG on separate service | Cross-service latency 20-50ms per call | Async indexing via Queue. Cache hot results in DO. Batch queries. |
| LightRAG Python-only | No native Workers deployment | REST API bridge. TypeScript adapter on gateway. Consider WASM port long-term. |
| Per-tenant LightRAG workspace | Storage grows linearly with users | PostgreSQL scales well. Prune inactive graphs after 90 days. Tiered storage limits. |
| LLM cost for entity extraction | Each indexed document consumes tokens | Batch extraction. Use smaller models (Haiku) for extraction. BYOK passes cost. |
| Graph query complexity | Deep traversals can be slow on large graphs | Limit traversal depth. Pre-compute summaries. Neo4j for heavy users (Phase 3). |
| Sandbox container cold start | First request 2-5s | Keep-alive via cron every 5 min. Warm pool for active users. |
| BYOK key security | Compromised platform \= compromised keys | AES-256-GCM encryption. HKDF-derived keys. HSM in Phase 3\. |

## **8.2 Business Risks**

| Risk | Prob. | Severity | Mitigation |
| :---- | :---- | :---- | :---- |
| Cloudflare deprecates Sandbox | Low | Critical | Infra abstraction layer. Tested migration to Fly.io / Deno Deploy. |
| AI provider price hikes | Medium | Medium | BYOK insulates platform. Multi-provider. Usage-based billing. |
| Big Tech competing agent | High | High | Niche: BYOK \+ privacy \+ LightRAG personal memory \+ skill marketplace. |
| Low conversion (\<2%) | Medium | High | A/B pricing. Value-gating LightRAG features to paid tiers. Referral incentives. |
| LightRAG project abandoned | Low | Medium | MIT-licensed fork. Core graph logic is self-contained. Can maintain independently. |
| GDPR enforcement | Low | Critical | Privacy by design. DPO at 5K users. Quarterly audits. |
| High churn (\>10%) | Medium | High | LightRAG personal memory creates switching cost. NPS tracking. |

# **9\. Infrastructure & Cost Model**

## **9.1 Cost Breakdown (with LightRAG)**

| Service | Phase 1 (MVP) | Phase 2 (LightRAG) | Phase 3 (Scale) |
| :---- | :---- | :---- | :---- |
| CF Workers Paid Plan | $5/mo | $5/mo | $5/mo |
| CF Workers Requests | \~$5/mo | \~$15/mo | \~$50/mo |
| Durable Objects | \~$5/mo | \~$20/mo | \~$80/mo |
| R2 Storage | \~$2/mo | \~$15/mo | \~$100/mo |
| LightRAG Server (Fly.io) | $0 (not yet) | $7-15/mo (1x shared CPU) | $30-60/mo (2x dedicated) |
| PostgreSQL (Fly.io PG) | $0 (not yet) | $7-15/mo (1GB) | $30-60/mo (4GB+) |
| Neo4j AuraDB | $0 | $0 (using PG+AGE) | $65+/mo (Pro tier) |
| TOTAL Platform | \~$17/mo | \~$77-85/mo | \~$360-420/mo |
| Per-User Cost | $0.17 (100 users) | $0.08-0.09 (1K users) | $0.04-0.05 (10K users) |

**Key insight:** LightRAG adds only \~$14-30/mo in infrastructure cost (Fly.io \+ PostgreSQL) while providing per-user knowledge graphs that dramatically increase retention and justify premium pricing. At $24.99/mo Pro plan, a single subscriber covers the entire LightRAG infra cost for 1,000 users.

## **9.2 Scaling Thresholds**

| Users | Architecture Changes | LightRAG Scaling | Monthly Cost |
| :---- | :---- | :---- | :---- |
| 0-100 | Single Workers deploy. No LightRAG (Phase 1). | N/A | $15-20 |
| 100-1K | Add LightRAG on Fly.io. Single PG instance. | 1 LightRAG instance, PG workspaces | $75-100 |
| 1K-5K | Scale PG. Add Redis cache. DO sharding. | PG read replicas. Async indexing queue. | $200-500 |
| 5K-10K | Multi-region Workers. Dedicated PG. | Multiple LightRAG workers. Connection pooling. | $500-1,500 |
| 10K-50K | Enterprise CF plan. CDN for static. | Neo4j AuraDB for heavy users. PG for rest. | $1,500-5,000 |
| 50K+ | Dedicated clusters. Mobile CDN. | Sharded Neo4j. Milvus for vectors. Multiple regions. | $5,000-20,000 |

# **10\. Implementation Roadmap**

## **10.1 Phase 1: MVP (Weeks 1-4) — No LightRAG**

| Week | Deliverables | Technical Details |
| :---- | :---- | :---- |
| 1 | Fork & Foundation | Fork moltworker. CI/CD (GitHub Actions). Dev/staging/prod envs. Tenant context middleware in Hono. |
| 2 | Multi-Tenant & Auth | R2 namespace isolation. JWT auth. User registration (magic link). SQLite tenant schema. |
| 3 | Billing & BYOK | Stripe integration (Checkout, Webhooks, Portal). Plan enforcement. BYOK encrypted storage. Usage metering. |
| 4 | Launch Readiness | Landing page. Onboarding wizard. Referral links. E2E tests. Product Hunt prep. Security audit. |

## **10.2 Phase 2: LightRAG Integration (Months 2-3)**

*This is the key phase where LightRAG transforms PAaaS from a “chat wrapper” into a “personal knowledge agent.”*

| Sprint | Deliverables | Technical Details |
| :---- | :---- | :---- |
| 5-6 | LightRAG Server Deploy \+ Integration | Deploy LightRAG Server on Fly.io with PostgreSQL (KV \+ pgvector \+ AGE). TypeScript ILightRAGClient adapter. Workspace creation on tenant signup. Health check integration. |
| 7-8 | Conversation Indexing Pipeline | Async queue worker indexes conversations into LightRAG (POST /documents). Batch mode for efficiency. Entity extraction using tenant’s BYOK model or platform default (Haiku for cost). |
| 9-10 | Dual-Level Retrieval in Agent | Agent runtime queries LightRAG before LLM call (POST /query, hybrid mode). Retrieved context injected into system prompt. “Personal memory” feature visible to users. |
| 11-12 | Knowledge Graph UI \+ Admin | React component for knowledge graph visualization (entities, relationships). Admin dashboard: per-tenant graph stats, storage usage. GDPR: graph export/delete API. |

### **10.2.1 LightRAG Sprint 5-6 Detail**

| Task | Effort | Dependencies |
| :---- | :---- | :---- |
| Provision Fly.io app \+ PostgreSQL | 1 day | Fly.io account, PG 16.6+ |
| Configure LightRAG .env (PG storage, embeddings) | 1 day | AI provider API key for embeddings |
| Deploy LightRAG Server via Docker | 1 day | Docker image from HKUDS/LightRAG |
| Implement ILightRAGClient TypeScript adapter | 3 days | LightRAG REST API docs |
| Workspace creation on tenant registration | 2 days | Multi-tenant auth system |
| Health check \+ monitoring integration | 1 day | CF Analytics |
| Integration tests (insert \+ query \+ delete) | 2 days | Vitest \+ test tenant |
| Performance benchmarking (latency, throughput) | 1 day | Load testing tool |

## **10.3 Phase 3: Scale & Verticals (Months 4-6)**

| Sprint | Deliverables | Technical Details |
| :---- | :---- | :---- |
| 13-16 | Skill Marketplace \+ LightRAG Skills | Marketplace UI. Developer SDK. Skills can query/write to tenant graph. Revenue sharing (70/30). |
| 17-20 | Neo4j Migration \+ Multimodal | Neo4j AuraDB for Privacy+ tenants. RAG-Anything for PDF/image indexing. Custom extraction prompts. |
| 21-22 | Enterprise & Verticals | Team plans (shared knowledge graph). Enterprise API. First vertical template (Legal or Marketing). |
| 23-24 | Mobile & Advanced Features | React Native app. Offline mode. Voice interface (Whisper \+ TTS). Advanced browser automation. |

# **11\. Complete Technology Stack Summary**

| Category | Technology | Version / Notes |
| :---- | :---- | :---- |
| Language (Primary) | TypeScript | 5.9+ strict mode (gateway, agent, admin) |
| Language (LightRAG) | Python | 3.10+ (LightRAG Server, RAG pipeline) |
| Runtime (Gateway) | Cloudflare Workers \+ Sandbox | Paid plan ($5/mo) |
| Runtime (LightRAG) | Fly.io / Docker VPS | Gunicorn \+ uvicorn, port 9621 |
| Web Framework | Hono v4 | Edge-native, \<1ms cold start |
| RAG Framework | LightRAG (lightrag-hku) | EMNLP 2025\. Dual-level retrieval \+ knowledge graph |
| Frontend | React 19 \+ Vite 6 | Admin UI, Control UI, knowledge graph viewer |
| Mobile (Phase 3\) | React Native | Shared component library with web |
| State | Durable Objects \+ SQLite | Per-tenant transactional state |
| Object Storage | Cloudflare R2 | S3-compatible, encrypted at rest |
| Graph DB (Phase 2\) | PostgreSQL \+ AGE | Via LightRAG PGGraphStorage. PG 16.6+ |
| Graph DB (Phase 3\) | Neo4j AuraDB | Via LightRAG Neo4JStorage. Enterprise tier. |
| Vector DB | pgvector (PG) / FAISS (dev) | Via LightRAG PGVectorStorage / NanoVectorDB |
| KV Storage | PostgreSQL / JSON (dev) | Via LightRAG PGKVStorage / JsonKVStorage |
| AI Providers | Claude, GPT, Gemini (BYOK) | Abstracted behind IAIProvider \+ LightRAG llm\_model\_func |
| Embeddings | text-embedding-3-small / nomic-embed-text | Via LightRAG embedding\_func. BYOK compatible. |
| Billing | Stripe | Checkout, Webhooks, Customer Portal |
| Auth | Cloudflare Access \+ JWT (jose) | Multi-layer: edge \+ gateway \+ device \+ service |
| Messaging | Telegram Bot API, Discord.js, Slack Bolt | Multi-channel delivery |
| Browser Automation | Cloudflare Puppeteer (CDP) | Web scraping, form automation |
| Queue (Phase 2\) | Cloudflare Queues | Async conversation indexing to LightRAG |
| Testing | Vitest \+ Miniflare | Unit, integration, e2e |
| CI/CD | GitHub Actions \+ Wrangler \+ Fly.io CLI | Deploy on merge to main |
| Monitoring | Cloudflare Analytics \+ LightRAG /health | Built-in, no extra cost |

# **12\. Appendix: Key Interface Definitions**

Core TypeScript interfaces that define the PAaaS platform contracts.

## **12.1 Core Platform Interfaces**

| // ─── Tenant Context ─── interface ITenantContext {   tenantId: string;   plan: 'free' | 'starter' | 'pro' | 'privacy\_plus';   locale: string;   byokKeys: Map\<string, IEncryptedKey\>;   quotas: IQuotaLimits;   lightragWorkspace: string;  // LightRAG workspace ID }   // ─── AI Provider (used by both Agent and LightRAG) ─── interface IAIProvider {   readonly name: string;   chat(messages: Message\[\], options?: ChatOptions): Promise\<ChatResponse\>;   stream(messages: Message\[\], options?: ChatOptions): AsyncIterable\<StreamChunk\>;   embed(texts: string\[\]): Promise\<number\[\]\[\]\>;   moderate(content: string): Promise\<ModerationResult\>; }   // ─── LightRAG Client (Phase 2\) ─── interface ILightRAGClient {   insertDocument(tenantId: string, content: string, meta?: DocMeta): Promise\<InsertResult\>;   query(tenantId: string, question: string, mode: QueryMode): Promise\<RAGResponse\>;   getGraphStats(tenantId: string): Promise\<GraphStats\>;   getEntities(tenantId: string, filter?: EntityFilter): Promise\<Entity\[\]\>;   createWorkspace(tenantId: string): Promise\<void\>;   deleteWorkspace(tenantId: string): Promise\<void\>;   exportWorkspace(tenantId: string): Promise\<ExportBundle\>; }   // ─── Skill Plugin (with LightRAG access) ─── interface ISkill {   readonly manifest: SkillManifest;   execute(ctx: SkillContext): Promise\<SkillResult\>; } interface SkillContext {   tenant: ITenantContext;   conversation: Conversation;   params: Record\<string, any\>;   ai: IAIProvider;   lightrag?: ILightRAGClient;  // injected if skill has 'lightrag:read' permission }   // ─── Channel Adapter ─── interface IChannelAdapter {   readonly channelType: 'telegram' | 'discord' | 'slack' | 'web';   sendMessage(tenantId: string, content: MessageContent): Promise\<void\>;   onMessage(handler: (msg: IncomingMessage) \=\> Promise\<void\>): void; }   // ─── Billing ─── interface IBillingService {   createSubscription(tenantId: string, plan: PlanId): Promise\<Subscription\>;   cancelSubscription(tenantId: string): Promise\<void\>;   recordUsage(tenantId: string, metric: UsageMetric): Promise\<void\>;   handleWebhook(event: StripeEvent): Promise\<void\>; } |
| :---- |

*— End of Specification —*

PAaaS Technical Specification v1.1  |  LightRAG Edition  |  February 2026