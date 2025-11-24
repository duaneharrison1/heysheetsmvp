# QA Testing System - Implementation Guide

**Status:** ✅ IMPLEMENTED (localStorage) / ⚠️ IN PROGRESS (Vercel Blob)
**Date:** 24-11-2025
**Dependencies:** React, Zustand, Supabase Edge Functions, OpenRouter API

---

## 🎯 What Was Built

The QA Testing System provides automated end-to-end testing of chatbot conversations with both technical validation and AI-powered quality assessment.

**Core Features:**
- **Automated test scenario execution** - Run multi-step conversation tests
- **Live test display** - Watch tests execute in real-time in chat interface
- **Dual AI evaluation system:**
  - Per-step evaluation (uses chat model, async/non-blocking)
  - Overall conversation evaluation (uses evaluator model, detailed breakdown)
- **Technical validation** - Automatic checks for intent, confidence, functions, timing
- **Performance scoring** - Color-coded timing tiers (Excellent/Good/Acceptable/Slow)
- **Test mode toggle** - Easy switch between normal chat and test mode
- **Scenario selector** - Button-based scenario picker
- **Debug panel integration** - View detailed test results in timeline
- **Markdown-formatted results** - Rich formatting with bold text, sections, scores
- **localStorage persistence** - Save last 100 test runs for history
- **Natural conversation pacing** - User messages delayed 1-2s for realistic feel

---

## 📁 Files Created/Modified

```
src/
├── qa/
│   ├── components/
│   │   ├── TestModeSwitch.tsx       # Toggle test mode on/off
│   │   ├── ScenarioSelector.tsx     # Scenario selection UI
│   │   ├── TestControls.tsx         # Run/Pause/Stop buttons
│   │   └── QAResultsPage.tsx        # Historical results viewer
│   ├── lib/
│   │   ├── types.ts                 # TypeScript definitions
│   │   ├── test-runner.ts           # Core test execution engine
│   │   ├── evaluator.ts             # AI quality evaluation
│   │   └── storage.ts               # localStorage persistence
│   └── scenarios/
│       ├── README.md                # Scenario authoring guide
│       ├── booking-001-happy-path.json
│       └── service-inquiry-001.json
├── lib/
│   └── markdown.tsx                 # Markdown parser utility
├── pages/
│   └── StorePage.tsx                # Modified: test mode integration
├── stores/
│   └── useDebugStore.ts             # Modified: test state management
└── components/
    ├── chat/
    │   └── ChatMessage.tsx          # Modified: markdown rendering
    └── debug/
        └── DebugPanel.tsx           # Modified: test result display
```

### What Each Module Does

**`types.ts`** - Defines TypeScript interfaces for:
- `TestScenario` - Test scenario structure with steps and evaluation criteria
- `TestStep` - Individual test step with expectations and quality criteria
- `TestExecution` - Test run state and results
- `TestStepResult` - Per-step validation and evaluation results
- `TestRunSummary` - Summary for storage/history

**`test-runner.ts`** - Core test engine (501 lines):
- `runScenario()` - Main execution loop with callbacks
- `executeStep()` - Calls Edge Function, validates results
- `validateTechnical()` - Checks intent, confidence, functions, timing
- `extractRichContent()` - Parses function results (products, services, etc.)
- `calculatePerformanceScore()` - Timing-based scoring (0-100)
- Async quality evaluation (non-blocking)

**`evaluator.ts`** - AI quality assessment (220 lines):
- `evaluateStepQuality()` - Per-message evaluation (uses chat model)
- `evaluateOverallQuality()` - Holistic conversation analysis (uses evaluator model)
- Calls Supabase Edge Function with evaluation prompts
- Returns structured JSON: score, passed, reasoning

**`storage.ts`** - Persistence layer (60 lines):
- `saveTestResult()` - Saves to localStorage
- `loadTestResults()` - Retrieves all results
- `getTestResultsByScenario()` - Filter by scenario ID
- `getRecentTestResults()` - Get last N results
- Keeps last 100 test runs

**`markdown.tsx`** - Lightweight markdown parser:
- Converts `**bold**` to `<strong>` tags
- Handles line breaks (`\n`)
- Handles horizontal rules (`---`)
- No external dependencies

**UI Components:**
- `TestModeSwitch` - Simple toggle switch with "🧪 Test Mode: ON" indicator
- `ScenarioSelector` - Loads scenarios via `import.meta.glob()`, displays as button chips
- `TestControls` - Run/Pause/Resume/Stop buttons (exists but not currently used)
- `QAResultsPage` - Historical test results viewer

---

## 🔄 How It Works

### Test Mode Activation

```
1. User toggles "Test Mode" switch in StorePage
   ↓
2. Debug store: isTestMode = true
   ↓
3. ScenarioSelector appears below toggle
   ↓
4. User selects scenario (e.g., "Booking - Happy Path")
   ↓
5. Debug store: selectedScenario = "booking-001"
   ↓
6. User clicks "Send" button
   ↓
7. StorePage calls runTest() instead of sendMessage()
```

### Test Execution Flow

```typescript
// 1. Load scenario
const scenario = await loadScenario(selectedScenario);

// 2. Create test runner
const runner = new TestRunner();

// 3. Run with callbacks for progressive UI updates
const execution = await runner.runScenario(
  scenario,
  storeId,
  selectedModel,          // Chat model
  evaluatorModel,         // Evaluator model
  // onStepComplete - called after bot responds
  (result) => {
    const botMsg = {
      content: result.botResponse,
      richContent: result.richContent,
      testResult: { passed: result.passed }
    };
    setMessages(prev => [...prev, botMsg]);
  },
  // onStepStart - called when step starts
  async (userMessage, stepIndex) => {
    // Add 1-2s delay for natural feel
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const userMsg = {
      content: userMessage
    };
    setMessages(prev => [...prev, userMsg]);
  }
);

// 4. Display summary message
const summaryMsg = {
  content: formatSummary(execution)  // Markdown formatted
};
setMessages(prev => [...prev, summaryMsg]);
```

**Detailed Flow:**
1. **Initialization** - Create `TestExecution` object, add scenario card to debug timeline
2. **Step Loop** - For each step:
   - Call `onStepStart()` → UI adds user message (with 1-2s delay)
   - Call Supabase Edge Function with user message
   - Validate technical requirements (intent, confidence, functions, timing)
   - Extract rich content (products, services, bookings, etc.)
   - Update debug request with results
   - **Launch async quality evaluation** (non-blocking)
   - Call `onStepComplete()` → UI adds bot message
   - Add to conversation history
3. **Overall Evaluation** - After all steps complete, evaluate full conversation
4. **Complete** - Save results to localStorage, show summary

### Evaluation Strategy

The system uses a **two-tier evaluation approach** to balance cost and quality:

#### Per-Step Evaluation (Quick Checks)
- **Model:** Uses the **same model** as the chat conversation
- **Timing:** Runs **asynchronously** (doesn't block test execution)
- **Purpose:** Quick quality check after each message
- **Evaluates:**
  - Does response meet each criterion?
  - Is response helpful and clear?
  - Overall quality score (0-100)
- **Cost:** Same as a regular message (~$0.001 per evaluation)
- **Example prompt:**
  ```
  Evaluate the response:
  1. Does it meet each criterion?
  2. Is the response helpful and clear?
  3. Overall quality score (0-100)

  Scoring guide:
  - 90-100: Excellent response
  - 70-89: Good response
  - 60-69: Acceptable
  - Below 60: Poor
  ```

#### Overall Evaluation (Comprehensive Analysis)
- **Model:** Uses the **evaluator model** (configurable in debug panel)
- **Timing:** Runs **after all steps complete**
- **Purpose:** Holistic assessment of entire conversation
- **Evaluates:**
  - **Goal Achievement (X/100)** - Did conversation accomplish its purpose?
  - **Response Quality (X/100)** - Helpful, accurate, appropriate?
  - **Conversation Flow (X/100)** - Natural, well-structured?
  - **Technical Accuracy (X/100)** - Correct intents, functions?
  - **User Experience (X/100)** - Would user be satisfied?
  - **Summary** - Overall assessment with specific examples
- **Returns:**
  - Overall score (0-100)
  - Passed (true/false based on minQualityScore)
  - Detailed reasoning with score breakdown
  - Conversation quality rating (excellent/good/fair/poor)
  - Goal achieved (true/false)
- **Cost:** Slightly higher (~$0.003 per evaluation, longer prompt)
- **Example output:**
  ```
  **Goal Achievement (95/100):** The booking flow completed successfully.
  All required information was collected and the booking was confirmed.

  **Response Quality (90/100):** Responses were clear, friendly, and included
  all necessary details. One minor improvement: could have proactively
  mentioned cancellation policy.

  **Conversation Flow (85/100):** Natural progression through the booking
  steps. Slight delay in one transition but overall smooth.

  **Technical Accuracy (90/100):** All intents correctly identified.
  Functions executed without errors. High confidence scores throughout.

  **User Experience (88/100):** Professional and efficient interaction.
  User would likely be satisfied and complete the booking.

  **Summary:** Excellent overall performance. The conversation achieved its
  goal efficiently while maintaining a friendly, professional tone.
  ```

**Why Two Evaluation Types?**
- **Per-step:** Fast, cost-effective, provides immediate feedback
- **Overall:** Comprehensive, considers full context, catches flow issues
- **Together:** Balance between speed/cost and quality/insight

### Performance Scoring

Response times are scored on a tier system. **Timing does NOT cause test failure** - it only affects the performance score and badge color.

| Tier | Time Range | Score | Badge Color | Result |
|------|------------|-------|-------------|--------|
| 🏆 Excellent | < 3 seconds | 100 | Green | ✅ Pass |
| ✅ Good | 3-5 seconds | 85 | Green | ✅ Pass |
| 👍 Acceptable | 5-10 seconds | 70 | Yellow | ✅ Pass |
| 🐌 Slow | 10-15 seconds | 50 | Orange | ✅ Pass (warning) |
| ❌ Unacceptable | > 15 seconds | 25 | Red | ✅ Pass (warning) |

**Implementation:**
```typescript
calculatePerformanceScore(timeMs: number): number {
  if (timeMs < 3000) return 100;      // Excellent
  if (timeMs < 5000) return 85;       // Good
  if (timeMs < 10000) return 70;      // Acceptable
  if (timeMs < 15000) return 50;      // Slow
  return 25;                          // Unacceptable
}
```

**Why timing doesn't fail tests:**
- Slow response is better than wrong response
- Network conditions vary
- First request may be slower (cold start)
- Focus on correctness, not speed

---

## 📝 Writing Test Scenarios

### Scenario JSON Format

Create a new JSON file in `/src/qa/scenarios/`:

```json
{
  "id": "unique-scenario-id",
  "name": "Display Name",
  "description": "Brief description of what this tests",

  "steps": [
    {
      "id": "step-1",
      "userMessage": "What the user says",

      "expected": {
        "intent": "EXPECTED_INTENT",
        "minConfidence": 85,
        "functions": ["function_name"],
        "maxTimeMs": 20000,
        "responseContains": ["keyword1", "keyword2"],
        "responseNotContains": ["error"],
        "richContentType": "services",
        "minItems": 1,
        "calendarEventCreated": false,
        "leadCaptured": false
      },

      "criteria": [
        "Response includes all required information",
        "Tone is friendly and professional",
        "Information is accurate"
      ]
    }
  ],

  "evaluation": {
    "criteria": [
      "Overall goal was achieved",
      "Conversation felt natural",
      "User would be satisfied"
    ],
    "minQualityScore": 80
  }
}
```

### Available Expected Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `intent` | `string \| string[]` | ✅ Yes | - | Expected intent(s). Can be single intent or array of acceptable intents |
| `minConfidence` | `number` | ❌ No | 85 | Minimum confidence score (0-100) |
| `functions` | `string[]` | ❌ No | `[]` | Expected function calls (must match exactly) |
| `maxTimeMs` | `number` | ❌ No | 30000 | Maximum response time in milliseconds |
| `responseContains` | `string[]` | ❌ No | `[]` | Keywords/phrases that must appear in response (case-insensitive) |
| `responseNotContains` | `string[]` | ❌ No | `[]` | Keywords that should NOT appear |
| `richContentType` | `string` | ❌ No | - | Expected rich content type: `"products"`, `"services"`, `"hours"`, `"bookings"`, `"quick_actions"`, `"lead_form"` |
| `minItems` | `number` | ❌ No | - | Minimum items in rich content lists (for products, services, bookings) |
| `calendarEventCreated` | `boolean` | ❌ No | - | Expect calendar event to be created |
| `leadCaptured` | `boolean` | ❌ No | - | Expect lead to be captured |

**Available Intents:**
- `SERVICE_INQUIRY` - User asking about services
- `PRODUCT_INQUIRY` - User asking about products
- `AVAILABILITY_CHECK` - User checking availability
- `CREATE_BOOKING` - User wants to book
- `INFO_REQUEST` - General information request
- `HOURS_INQUIRY` - Asking about operating hours
- `LEAD_SUBMISSION` - Lead capture form
- `GREETING` - User greeting
- `FAREWELL` - User saying goodbye

**Available Functions:**
- `get_services` - Retrieve services
- `get_products` - Retrieve products
- `get_store_info` - Get store details
- `check_availability` - Check service availability
- `create_booking` - Create a booking
- `submit_lead` - Submit lead information
- `get_misc_data` - Get miscellaneous data

### Example: Service Inquiry Test

**File:** `/src/qa/scenarios/service-inquiry-001.json`

```json
{
  "id": "service-inquiry-001",
  "name": "Service Inquiry - Basic",
  "description": "User asks about available services and gets complete information",

  "steps": [
    {
      "id": "step-1",
      "userMessage": "What services do you offer?",

      "expected": {
        "intent": ["SERVICE_INQUIRY", "INFO_REQUEST"],
        "minConfidence": 75,
        "functions": ["get_services"],
        "maxTimeMs": 20000,
        "richContentType": "services"
      },

      "criteria": [
        "Lists all available services",
        "Includes key details (price, duration)",
        "Invites further questions",
        "Uses friendly, professional tone"
      ]
    }
  ],

  "evaluation": {
    "criteria": [
      "Response was helpful and complete",
      "Tone was friendly and professional",
      "User received all information needed"
    ],
    "minQualityScore": 75
  }
}
```

**What This Tests:**
- Bot correctly identifies service inquiry intent
- Bot calls `get_services` function
- Bot returns services as rich content cards
- Response quality is professional and helpful

### Example: Booking Flow Test

**File:** `/src/qa/scenarios/booking-001-happy-path.json`

```json
{
  "id": "booking-001",
  "name": "Booking - Happy Path",
  "description": "User successfully books Hand Building class with all information provided",

  "steps": [
    {
      "id": "step-1",
      "userMessage": "What pottery classes do you have?",
      "expected": {
        "intent": "SERVICE_INQUIRY",
        "minConfidence": 75,
        "functions": ["get_services"],
        "maxTimeMs": 20000,
        "richContentType": "services",
        "minItems": 1
      },
      "criteria": [
        "Lists available pottery services",
        "Includes prices for each service",
        "Mentions class durations",
        "Uses friendly, conversational tone"
      ]
    },
    {
      "id": "step-2",
      "userMessage": "When is Hand Building available?",
      "expected": {
        "intent": "AVAILABILITY_CHECK",
        "minConfidence": 75,
        "functions": ["check_availability"],
        "maxTimeMs": 20000,
        "responseContains": ["available", "time"]
      },
      "criteria": [
        "Shows specific available dates and times",
        "Indicates remaining capacity",
        "Information is clear and actionable"
      ]
    },
    {
      "id": "step-3",
      "userMessage": "Book me for Tuesday at 2pm. My name is John Doe, email john@example.com",
      "expected": {
        "intent": "CREATE_BOOKING",
        "minConfidence": 75,
        "functions": ["create_booking"],
        "maxTimeMs": 20000,
        "calendarEventCreated": true,
        "responseContains": ["confirmed", "booking"]
      },
      "criteria": [
        "Confirms booking was successful",
        "Repeats key details (service, date, time)",
        "Confirms email notification",
        "Thanks the customer"
      ]
    }
  ],

  "evaluation": {
    "criteria": [
      "Complete booking flow accomplished smoothly",
      "Conversation felt natural and human-like",
      "All information was accurate",
      "User would be satisfied with the experience"
    ],
    "minQualityScore": 80
  }
}
```

**What This Tests:**
- Multi-step conversation flow (3 steps)
- Service inquiry → Availability check → Booking creation
- Intent classification at each step
- Function calls match expectations
- Calendar event creation
- Response quality throughout conversation
- Overall user satisfaction

### Tips for Writing Good Scenarios

1. **Start Simple** - Begin with 1-2 step scenarios, then build up
2. **Real User Language** - Use natural phrasing, not technical terms
3. **Clear Expectations** - Be specific about what constitutes success
4. **Quality Criteria** - Focus on what makes a *good* response, not just correct
5. **Edge Cases** - Create scenarios for error handling, missing info, etc.
6. **Conversation Flow** - Test multi-turn conversations, not just single Q&A
7. **Cost Awareness** - Longer scenarios = more API calls = higher cost

---

## 🚀 Running Tests

### Step 1: Enable Test Mode

Navigate to a store page (`/store/:storeId`) and click the **Test Mode** toggle switch in the chat input area.

```
┌────────────────────────────────────┐
│ Chat with Store Assistant          │
├────────────────────────────────────┤
│                                    │
│ [Test Mode] ◻️ → 🧪 Test Mode: ON │
│                                    │
└────────────────────────────────────┘
```

### Step 2: Select Scenario

When test mode is enabled, scenario buttons appear. Click a scenario to select it:

```
🧪 Test Mode: ON

[Booking - Happy Path]  [Service Inquiry - Basic]
User successfully books Hand Building class with all information provided
```

### Step 3: Choose Evaluator Model (Optional)

Open the debug panel (Ctrl+Shift+D or click debug icon) and select an evaluator model from the dropdown.

**Options:**
- `x-ai/grok-4.1-fast` (Default) - Fast, cost-effective
- `anthropic/claude-3.5-sonnet` - High quality, comprehensive analysis
- `openai/gpt-4o` - Balanced quality and cost

**Note:** Per-step evaluations always use the chat model. This setting only affects the overall evaluation.

### Step 4: Run Test

Click the **Send** button (remains labeled "Send" even in test mode). The test will execute automatically.

### Step 5: Watch Execution

- **User messages** appear with 1-2s delay (natural pacing)
- **Bot responses** appear immediately after processing
- **Debug panel** shows each request with:
  - ✅/❌ Pass/fail indicator
  - Performance score badge (colored by tier)
  - Technical validation details
  - Quality evaluation score (appears async)

**During execution you can:**
- Scroll through chat to see conversation
- Open debug panel requests to see validation details
- Pause execution (not currently implemented in UI)
- Stop execution (not currently implemented in UI)

### Step 6: View Results

**In Chat:**
- Summary message appears at the end with markdown formatting
- Shows: technical results, quality score, detailed analysis

**In Debug Panel:**
- Click any request to see full details
- Technical validation shows intent, confidence, functions, timing
- Quality evaluation shows score and reasoning
- Performance score badge color-coded

**Example Summary:**
```
**Test Complete: Booking - Happy Path**

---

**📊 Technical Results**

**Per-Step Results:** ✅ All steps passed

**Duration:** 15.3s (5.1s per step)

**Model:** x-ai/grok-4.1-fast

**Evaluator Model:** anthropic/claude-3.5-sonnet

---

**🤖 AI Quality Evaluation**

**Overall Result:** ✅ **PASSED**

**Quality Score:** 88/100

**Conversation Quality:** Excellent

**Goal Achieved:** 🎯 Yes

---

**📝 Detailed Analysis**

**Goal Achievement (95/100):** The booking flow completed successfully...

[Full detailed breakdown from AI evaluator]

---

✨ **Excellent!** All technical checks passed and conversation quality is high.
```

### View Test History

Click "View Test History" button (when implemented) or navigate to `/qa-results` to see past test runs.

---

## 🔧 Prerequisites

Before running QA tests, ensure:

- ✅ **OpenRouter API key** configured in environment (`VITE_OPENROUTER_API_KEY`)
- ✅ **Supabase project** set up with Edge Functions deployed
- ✅ **Store created** with Google Sheet connected
- ✅ **Sheet has data** (services, products, availability)
- ✅ **Test scenarios exist** in `/src/qa/scenarios/`
- ✅ **Debug panel accessible** (Ctrl+Shift+D)

**Environment Variables:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_OPENROUTER_API_KEY=your-openrouter-key
```

---

## 📊 Technical Details

### State Management

**New fields in `useDebugStore`:**
```typescript
interface DebugStore {
  // Test mode state
  isTestMode: boolean
  selectedScenario: string | null
  currentTest: TestExecution | null
  evaluatorModel: string
  clearChatRequested: boolean

  // Test control methods
  setTestMode: (enabled: boolean) => void
  setSelectedScenario: (scenarioId: string | null) => void
  setEvaluatorModel: (model: string) => void
  startTest: (execution: TestExecution) => void
  updateTestExecution: (updates: Partial<TestExecution>) => void
  addTestResult: (result: TestStepResult) => void
  completeTest: () => void
  pauseTest: () => void
  stopTest: () => void
}
```

**DebugRequest extended with test data:**
```typescript
interface DebugRequest {
  // ... existing fields
  testResult?: {
    passed: boolean
    performanceScore: number
    technical: {
      intentCorrect: boolean
      intentActual: string
      intentExpected: string | string[]
      confidenceOK: boolean
      confidence: number
      minConfidence: number
      functionsCorrect: boolean
      functionsActual: string[]
      functionsExpected: string[]
      timingOK: boolean
      timeMs: number
      maxTimeMs: number
      noErrors: boolean
      error?: string
    }
    quality?: {
      score: number
      passed: boolean
      reasoning: string
    }
  }
}
```

### Async Quality Evaluation

**Why async?**
- Prevents blocking test execution (4s improvement per step)
- User sees bot response immediately
- Quality score updates when available

**Implementation:**
```typescript
// Technical validation runs synchronously
const passedTechnical = validateTechnical(step.expected, data, timeMs);

// Update UI immediately
updateRequest(correlationId, {
  testResult: {
    passed: passedTechnical,
    quality: undefined  // Not yet available
  }
});

// Quality evaluation runs async (non-blocking)
evaluateStepQuality(userMessage, botResponse, criteria, model)
  .then(quality => {
    // Update with quality score later
    updateRequest(correlationId, {
      testResult: {
        passed: passedTechnical && quality.passed,
        quality: {
          score: quality.score,
          passed: quality.passed,
          reasoning: quality.reasoning
        }
      }
    });
  })
  .catch(err => {
    console.error('Quality evaluation failed:', err);
    // Keep technical-only result if evaluation fails
  });

// Continue to next step without waiting
return result;
```

### Cost Estimation

**Per 4-message test:**
- Chat model calls: 4 × $0.001 = **$0.004**
- Per-message eval: 4 × $0.001 = **$0.004** (uses chat model)
- Overall eval: 1 × $0.003 = **$0.003** (uses evaluator model, longer prompt)
- **Total: ~$0.011 per test**

**Cost projections:**
- 10 tests = $0.11
- 100 tests = $1.10
- 1,000 tests = $11.00

**Cost optimization tips:**
- Use fast models for per-step evaluations (already done - uses chat model)
- Use premium models only for overall evaluation (when quality matters most)
- Keep scenarios focused (fewer steps = lower cost)
- Run tests strategically (not every commit)

### Markdown Rendering

**Custom lightweight parser** (no dependencies):
```typescript
// Handles:
// - **bold** → <strong>
// - \n → line breaks
// - --- → horizontal rules

parseMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements = [];

  for (const line of lines) {
    if (line.trim() === '---') {
      elements.push(<hr />);
    } else if (line.trim() === '') {
      elements.push(<br />);
    } else {
      elements.push(<span>{parseInlineMarkdown(line)}</span>);
    }
  }

  return <div>{elements}</div>;
}
```

**Why not use react-markdown?**
- Avoid dependency bloat
- Only need basic formatting
- Custom implementation is lightweight (60 lines)

---

## 🐛 Troubleshooting

### Issue: Test mode toggle doesn't appear
**Check:** Is the chat interface loaded correctly?
**Solution:**
- Refresh the page
- Ensure you're on a store page (`/store/:storeId`)
- Check browser console for errors
- Verify StorePage.tsx has TestModeSwitch imported

### Issue: No scenarios in dropdown
**Check:** Are there JSON files in `/src/qa/scenarios/`?
**Solution:**
- Create at least one scenario file following the JSON format
- Ensure scenario files have `.json` extension
- Check scenario JSON is valid (use JSON validator)
- Restart dev server (`npm run dev`)

### Issue: Scenario buttons don't appear
**Check:** Is test mode enabled?
**Solution:**
- Click the Test Mode toggle switch first
- Verify `isTestMode` is true in debug store
- Check ScenarioSelector is rendering (inspect DOM)

### Issue: Test runs but all steps fail
**Check:** Is the store connected to a Google Sheet with data?
**Solution:**
- Verify Google Sheet is connected in store settings
- Ensure sheet has services/products data
- Check sheet permissions (must be shared with service account)
- Test normal chat first (should work before testing)

### Issue: Evaluation scores always 0 or undefined
**Check:** Is the OpenRouter API key configured?
**Solution:**
- Set `VITE_OPENROUTER_API_KEY` in `.env.local`
- Restart dev server after adding env variable
- Check Supabase Edge Function has OpenRouter key configured
- Verify Edge Function is deployed and accessible

### Issue: "Run Test" button disabled
**Check:** Have you selected a scenario?
**Solution:**
- Click a scenario button to select it
- Selected scenario should highlight in blue
- Check `selectedScenario` is not null in debug store

### Issue: Test execution freezes or hangs
**Check:** Is the Edge Function responding?
**Solution:**
- Check Supabase Edge Function logs
- Verify CORS configuration
- Test Edge Function directly (Postman/curl)
- Check for network errors in browser console

### Issue: Quality evaluation never appears
**Check:** Did async evaluation fail?
**Solution:**
- Check browser console for errors
- Verify Edge Function accepts `skipIntent: true` flag
- Test evaluator model is accessible via OpenRouter
- Check Edge Function timeout settings

### Issue: Markdown not rendering (no bold, no line breaks)
**Check:** Is `parseMarkdown()` being called?
**Solution:**
- Verify ChatMessage.tsx imports `parseMarkdown`
- Check markdown.tsx file exists in `/src/lib/`
- Inspect rendered HTML (should have `<strong>` tags)
- Verify message content has markdown syntax (`**bold**`)

### Issue: Test results not saving to history
**Check:** Is localStorage available?
**Solution:**
- Check browser allows localStorage (not in private mode)
- Verify storage.ts functions are being called
- Check browser console for storage errors
- Try clearing localStorage and re-running test

---

## ✅ Success Checklist

After implementation, verify:

**UI & UX:**
- [ ] Test mode toggle appears in chat input area
- [ ] Scenarios load and display as buttons when test mode enabled
- [ ] Selected scenario highlights in blue
- [ ] Scenario description appears below buttons
- [ ] "Send" button triggers test when scenario selected
- [ ] User messages appear with 1-2s delay during test
- [ ] Bot responses appear immediately after processing
- [ ] Messages show pass/fail indicator (✅/❌)
- [ ] Summary message appears at end with markdown formatting

**Debug Panel:**
- [ ] Evaluator model selector appears in debug panel
- [ ] Scenario card appears in timeline when test starts
- [ ] Each step appears as a request in timeline
- [ ] Requests show test validation badge
- [ ] Performance score badge is color-coded
- [ ] Technical validation details expand on click
- [ ] Quality evaluation score appears (may be delayed)

**Functionality:**
- [ ] Test executes all steps sequentially
- [ ] Technical validation runs (intent, confidence, functions, timing)
- [ ] Per-step quality evaluation runs async
- [ ] Overall quality evaluation runs at end
- [ ] Test results save to localStorage
- [ ] Test summary displays detailed analysis

**Edge Cases:**
- [ ] Test handles missing data gracefully
- [ ] Test handles API errors without crashing
- [ ] Quality evaluation failure doesn't block test
- [ ] Can switch between test mode and normal chat
- [ ] Chat clears when switching modes

---

## 🚀 Next Steps / Future Enhancements

### Immediate Improvements
- [ ] **Use TestControls component** - Replace "Send" button with dedicated Run/Pause/Stop buttons
- [ ] **More test scenarios** - Add scenarios for all major flows:
  - Product inquiry and purchase
  - Operating hours and location
  - Lead capture flow
  - Error handling (missing data, API failures)
  - Edge cases (ambiguous requests, multi-intent messages)

### Short-Term (1-2 weeks)
- [ ] **Vercel Blob storage** - Replace localStorage with server-side storage
  - Create Edge Function for saving/loading results
  - Implement blob storage API
  - Migrate existing localStorage data
- [ ] **Test history page** - Implement QAResultsPage with:
  - List of past test runs
  - Filter by scenario, date, pass/fail
  - Click to view detailed results
  - Export to CSV/JSON
- [ ] **Scenario upload UI** - Allow adding scenarios without code changes
  - Drag-and-drop JSON upload
  - Visual scenario builder
  - Validation and preview

### Medium-Term (1-2 months)
- [ ] **Trend charts** - Visualize quality scores over time
  - Line chart: Score by date
  - Bar chart: Pass rate by scenario
  - Heatmap: Performance by time of day
- [ ] **Comparison view** - Compare test runs side-by-side
  - Diff viewer for responses
  - Score delta highlighting
  - Regression detection
- [ ] **CI/CD integration** - Run tests automatically
  - GitHub Actions workflow
  - Run on PR creation
  - Comment results on PR
  - Block merge if critical tests fail
  - **Cost awareness:** Set budget limits

### Long-Term (3+ months)
- [ ] **Scheduled testing** - Run tests on a schedule
  - Cron-based execution
  - Email notifications for failures
  - Slack/Discord integration
- [ ] **A/B testing** - Compare different models/prompts
  - Run same scenario with different models
  - Compare quality scores
  - Cost vs. quality analysis
- [ ] **Load testing** - Test performance under load
  - Concurrent test execution
  - Rate limiting handling
  - Performance benchmarking
- [ ] **Export reports** - Generate PDF/HTML reports
  - Executive summary
  - Detailed test results
  - Charts and graphs
  - Shareable links

---

## 📚 Related Documentation

- [Debug Panel Guide](./DEBUG_PANEL.md) - How to use the debug panel
- [Edge Functions](./EDGE_FUNCTIONS.md) - Supabase Edge Function architecture
- [Intent Classification](./INTENT_SYSTEM.md) - How intents work
- [Function Calling](./FUNCTION_CALLING.md) - Available functions and usage

---

**Last Updated:** 24-11-2025
**Version:** 1.0.0
**Status:** ✅ Production Ready (localStorage) | ⚠️ Planned (Vercel Blob)
