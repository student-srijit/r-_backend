export const COMPANY_DIFFICULTY = {
  // Hard companies (FAANG+ / top-tier)
  'Google': 'hard',
  'Meta': 'hard',
  'Microsoft': 'hard',
  'Apple': 'hard',
  'Amazon': 'hard',
  'Netflix': 'hard',
  'Stripe': 'hard',
  'Goldman Sachs': 'hard',
  'Citadel': 'hard',
  'Bloomberg': 'hard',
  'Two Sigma': 'hard',
  'Jane Street': 'hard',
  'Palantir': 'hard',
  'OpenAI': 'hard',
  'DeepMind': 'hard',
  // Medium-hard companies
  'Uber': 'medium',
  'Airbnb': 'medium',
  'LinkedIn': 'medium',
  'Twitter': 'medium',
  'Snap': 'medium',
  'Dropbox': 'medium',
  'Salesforce': 'medium',
  'Adobe': 'medium',
  'Shopify': 'medium',
  'Atlassian': 'medium',
  'VMware': 'medium',
  'Oracle': 'medium',
  'SAP': 'medium',
  // Entry-level / service companies
  'TCS': 'easy',
  'Infosys': 'easy',
  'Wipro': 'easy',
  'HCL': 'easy',
  'Tech Mahindra': 'easy',
  'Accenture': 'easy',
  'Cognizant': 'easy',
  'Capgemini': 'easy',
  'IBM': 'easy',
  'Mphasis': 'easy',
};

// Rich company context for generating accurate interview questions
export const COMPANY_CONTEXT = {
  'Google': `Google interviews are highly competitive. Expect:
- 5-6 rounds (phone screen + onsite)
- LeetCode-hard algorithms and data structures (graphs, DP, trees)
- Large-scale system design (design Google Search, YouTube, Maps)
- Strong emphasis on code quality, edge cases, and time/space complexity
- Behavioral questions using the STAR method
- Brain teasers and estimation problems`,

  'Meta': `Meta (Facebook) interviews are extremely technical. Expect:
- Similar DSA depth to Google but heavier focus on product-scale systems
- System design: design Instagram feed, Facebook Messenger, real-time chat
- Coding: medium to hard LeetCode problems, clean code expected
- Behavioral: "Tell me about a time you disagreed with a decision"
- Emphasis on "move fast and break things" culture fit`,

  'Microsoft': `Microsoft interviews focus on problem-solving and system design. Expect:
- 4-5 rounds including coding, system design, and behavioral
- LeetCode medium to hard problems, trees and graphs heavy
- System design: design OneDrive, Microsoft Teams, Azure services
- culture/values alignment with "Growth Mindset"
- Behavioral: collaboration, learning from failure`,

  'Apple': `Apple interviews are rigorous with focus on fundamentals and product intuition. Expect:
- Strong algorithms (arrays, trees, hashmaps - medium/hard level)
- Low-level systems knowledge (memory management, concurrency)
- Product design and intuition questions
- Heavy emphasis on attention to detail
- Behavioral: "Why Apple?" and team fit`,

  'Amazon': `Amazon interviews use the Leadership Principles heavily. Expect:
- 5-6 rounds; behavioral questions tied to 16 Leadership Principles
- Coding: medium-hard LeetCode, emphasis on clean optimal solutions
- System design: distributed systems, design Amazon warehouse, Prime Video
- Bar Raiser round: cross-team evaluation
- Every answer should demonstrate a Leadership Principle`,

  'Netflix': `Netflix interviews are high-bar and culture-focused. Expect:
- Strong systems design (streaming, CDN, real-time recommendation)
- Coding: hard LeetCode problems with optimal solutions required
- Culture fit: "Highly aligned, loosely coupled", freedom and responsibility
- Emphasis on senior engineers; no hand-holding
- Questions on dealing with ambiguity`,

  'Stripe': `Stripe interviews focus on payment infrastructure and reliability. Expect:
- Systems design: distributed payment systems, idempotency, eventual consistency
- Coding: medium-hard problems, code review round
- API design and developer experience thinking
- Reliability engineering and fault tolerance questions
- "Thoughtful" is their highest compliment`,

  'Goldman Sachs': `Goldman Sachs interviews blend finance and software engineering. Expect:
- Strong CS fundamentals with quantitative reasoning
- Financial systems design (trading platforms, risk systems)
- Brain teasers and probability questions
- Market microstructure basics
- Medium-hard algorithm questions`,

  'Citadel': `Citadel is a top quant hedge fund. Expect:
- Highly mathematical: probability, statistics, stochastic processes
- Brain teasers and mental math
- Competitive programming-level algorithms
- Finance concepts: derivatives, options pricing, risk management
- C++ proficiency for trading roles`,

  'Bloomberg': `Bloomberg interviews focus on financial data systems. Expect:
- Financial data structures and APIs
- Real-time data processing systems design
- Medium LeetCode problems
- Knowledge of financial markets and instruments
- Understanding of Bloomberg Terminal use cases`,

  'Two Sigma': `Two Sigma is a quantitative investment firm. Expect:
- Statistical modeling and probability questions
- Machine learning fundamentals
- Competitive programming level algorithms
- Finance and market microstructure knowledge
- Take-home assignments for trading strategy coding`,

  'Jane Street': `Jane Street is one of the hardest quant trading shops. Expect:
- Advanced probability puzzles and expected value calculations
- Market-making scenarios and mental math
- OCaml or functional programming
- Logic puzzles and game theory
- Extreme quantitative rigor`,

  'Palantir': `Palantir interviews are long and rigorous. Expect:
- Decomposition exercises: break down complex problems
- Coding: medium-hard; emphasis on production-quality code
- Bootcamp-style take-home project
- Questions on data pipelines, analytics platforms, government data
- Strong emphasis on impact and "forward deployed engineer" mindset`,

  'OpenAI': `OpenAI interviews require ML depth and strong engineering. Expect:
- Deep ML knowledge: transformers, RLHF, scaling laws, fine-tuning
- Systems design for training and inference infrastructure
- Hard LeetCode + ML systems coding
- Research paper discussion
- Alignment and safety awareness`,

  'DeepMind': `DeepMind values research excellence and engineering. Expect:
- Research publications discussion
- Deep learning theory (backprop, optimization, regularization)
- RL fundamentals and deep RL algorithms
- System design for ML training pipelines
- Hard algorithm problems`,

  'Uber': `Uber interviews are solid and well-structured. Expect:
- Medium to hard LeetCode, graphs and maps problems common
- Systems design: design Uber surge pricing, ride matching, maps
- Behavioral questions around data-driven decisions
- Real-time geospatial computing topics`,

  'Airbnb': `Airbnb interviews are product-focused. Expect:
- Medium LeetCode problems
- Product design and data modeling
- Systems design: booking platform, pricing algorithms
- Behavioral: strong culture fit, belonging, creativity
- Cross-functional collaboration scenarios`,

  'LinkedIn': `LinkedIn interviews blend algorithms and data-focused design. Expect:
- Medium algorithm problems (graphs, BFS/DFS for social network traversal)
- System design: design LinkedIn feed, job recommendation, connection of connections
- Analytics and metrics reasoning
- Behavioral using STAR method`,

  'Shopify': `Shopify interviews focus on product and backend engineering. Expect:
- Medium LeetCode, Ruby on Rails or general backend questions
- Merchant-centric product thinking
- API design and eCommerce workflows
- Scalability questions`,

  'Salesforce': `Salesforce interviews are process-oriented. Expect:
- Medium difficulty algorithms
- Cloud platform architecture (SaaS, multi-tenancy)
- CRM data modeling
- Behavioral: Salesforce values (Trust, Customer Success, Innovation)`,

  'Adobe': `Adobe interviews cover both algorithms and creative systems. Expect:
- Medium LeetCode problems
- Creative tools architecture (image processing, video rendering)
- Design patterns and object-oriented design
- Behavioral: "Champion by choice", customer empathy`,

  'Atlassian': `Atlassian interviews are collaborative and practical. Expect:
- Medium algorithm problems
- System design for developer tools (Jira, Confluence, Bitbucket)
- Emphasis on team collaboration and DevOps understanding
- Values alignment: "Open company, no bullshit"`,

  'TCS': `TCS interviews are straightforward for fresh graduates. Expect:
- Aptitude test: quantitative, logical reasoning, verbal (easy level)
- Basic programming: simple array/string problems, sorting, searching
- Core CS concepts: OOP, DBMS basics, OS concepts
- HR round: "Tell me about yourself", extracurricular activities
- 2-3 rounds total; focus on attitude and learnability`,

  'Infosys': `Infosys interviews are entry-level and structured. Expect:
- Online test: aptitude, reasoning, and basic coding (Hackerrank-easy)
- Technical: basic OOP concepts, data structures fundamentals
- Simple SQL queries and database basics
- HR: career goals, why Infosys, teamwork scenarios
- Communication skills are judged`,

  'Wipro': `Wipro interviews target freshers and entry-level engineers. Expect:
- Aptitude and cognitive assessment (easy)
- Basic coding in any language (simple loops, conditions, arrays)
- Core CS: basic networking, OS, DBMS, OOP
- HR round: cultural fit, relocation, shift flexibility
- 3 rounds; focus on attitude over depth`,

  'Accenture': `Accenture interviews are structured and accessible. Expect:
- Online test: cognitive, technical MCQs, coding (easy HackerRank)
- Technical: JavaScript/Python basics, simple algorithms
- Behavioral: teamwork, client service, adaptability
- HR round: long-term vision, Accenture values
- Easy to moderate difficulty; volume hiring`,

  'Cognizant': `Cognizant interviews are moderate and process-driven. Expect:
- Aptitude test and basic coding assessment
- Technical: Java or Python fundamentals, data structures (arrays, linked lists)
- SQL basics and web fundamentals
- Behavioral: collaboration, handling deadlines
- 3-4 rounds; campus recruitment style`,

  'Capgemini': `Capgemini uses a standardized assessment for mass hiring. Expect:
- Online test: pseudo-code understanding, MCQ on CS fundamentals
- Basic programming challenges (easy loops/strings)
- Group discussion or HR interview
- Focus on communication and adaptability
- Easy difficulty; volume-focused hiring process`,

  'IBM': `IBM interviews cover a broad spectrum. Expect:
- Easy to medium technical questions on Java, Python, or C
- Cloud computing basics (IBM Cloud, AWS concepts)
- Soft skills heavily weighted
- Case study or scenario-based questions for consulting roles
- Behavioral: "Learning Agility", client-focused culture`,
};


export const RESEARCH_FIELDS = [
  'AI',
  'Machine Learning',
  'Deep Learning',
  'Natural Language Processing',
  'Computer Vision',
  'Blockchain',
  'Web Development',
  'Cloud Computing',
  'DevOps',
  'Cybersecurity',
  'Data Science',
  'Other',
];

export const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

export const INTERVIEW_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export const LINK_TYPES = {
  BLOG: 'blog',
  PAPER: 'paper',
  VLOG: 'vlog',
  OTHER: 'other',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};
