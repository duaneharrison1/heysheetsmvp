# HeySheets Chat Intelligence System - Implementation Guide

**Status:** ✅ IMPLEMENTED
**Date:** 2025-01-07
**Dependencies:** Production-Ready base (auth, database, google-sheet function)

---

## 🎯 What Was Built

Transformed basic chat into an **intelligent conversation system** with:

- ✅ **Intent Classification** - Understands what users want (BOOKING, PRODUCT, INFO, etc.)
- ✅ **Parameter Extraction** - Extracts dates, times, names from natural language
- ✅ **Function Calling** - Automatically executes actions (check_availability, create_booking, etc.)
- ✅ **Smart Responses** - Generates natural replies using function results
- ✅ **Multi-step Conversations** - Handles booking flows, product browsing

---

## 📁 Files Created

### Backend (Supabase Edge Functions)

```
supabase/functions/chat-completion/
├── index.ts                         (UPDATED - integrated classifier)
├── classifier/
│   ├── classifier.ts               (NEW - intent classification)
│   └── responder.ts                (NEW - response generation)
└── functions/
    ├── definitions.ts              (NEW - function schemas)
    └── executor.ts                 (NEW - function execution)
```

### What Each Module Does

**classifier.ts**
- Analyzes user messages to determine intent
- Extracts parameters (dates, times, names, emails)
- Recommends which function to call
- Uses OpenRouter API (Claude 3.5 Sonnet)

**executor.ts**
- Executes 4 functions based on classification:
  - `get_store_info` - Fetch store hours/services/products
  - `check_availability` - Check open time slots
  - `create_booking` - Create confirmed booking
  - `get_products` - Get product catalog
- Calls google-sheet function for data access
- Returns structured results

**responder.ts**
- Generates natural, conversational responses
- Uses function results as context
- Handles both success and error cases gracefully
- Maintains store's tone and style

**definitions.ts**
- Defines function schemas (documentation)
- Specifies required parameters
- Used for type safety

---

## 🔄 How It Works

### Example Flow: Booking a Service

```
1. User: "I want to book pottery class tomorrow at 2pm, my name is John, email john@test.com"

2. Classifier analyzes:
   {
     intent: "BOOKING",
     confidence: "HIGH",
     params: {
       service_name: "pottery class",
       date: "2025-01-08",
       time: "14:00",
       customer_name: "John",
       email: "john@test.com"
     },
     functionToCall: "create_booking"
   }

3. Executor calls create_booking:
   - Validates all parameters
   - Checks availability (calls check_availability internally)
   - Writes to Bookings sheet via google-sheet function
   - Returns confirmation

4. Responder generates:
   "✅ Perfect! Your pottery class is confirmed for tomorrow at 2pm.
    I've sent a confirmation email to john@test.com."

5. Frontend receives:
   {
     text: "✅ Perfect! Your pottery class is...",
     intent: "BOOKING",
     confidence: "HIGH",
     functionCalled: "create_booking",
     functionResult: { success: true, booking: {...} }
   }
```

---

## 🚀 Testing the Intelligence System

### Test 1: Greeting (No Function)

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/chat-completion \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Hello!"}],
    "storeId": "store-xxx"
  }'

Expected:
{
  "text": "Hi! Welcome to... How can I help you today?",
  "intent": "GREETING",
  "confidence": "HIGH",
  "functionCalled": null,
  "functionResult": null
}
```

### Test 2: Info Request (Calls get_store_info)

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/chat-completion \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type": application/json" \
  -d '{
    "messages": [{"role":"user","content":"What are your hours?"}],
    "storeId": "store-xxx"
  }'

Expected:
{
  "text": "We're open Monday-Friday 9am-5pm...",
  "intent": "INFO",
  "confidence": "HIGH",
  "functionCalled": "get_store_info",
  "functionResult": {
    "success": true,
    "data": { "hours": [...] }
  }
}
```

### Test 3: Product Browse (Calls get_products)

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/chat-completion \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type": application/json" \
  -d '{
    "messages": [{"role":"user","content":"Show me your products"}],
    "storeId": "store-xxx"
  }'

Expected:
{
  "text": "Here are our products: **Product 1** - $45...",
  "intent": "PRODUCT",
  "confidence": "HIGH",
  "functionCalled": "get_products",
  "functionResult": {
    "success": true,
    "products": [...],
    "count": 5
  }
}
```

### Test 4: Check Availability

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/chat-completion \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Check availability for pottery class on 2025-01-15"}],
    "storeId": "store-xxx"
  }'

Expected:
{
  "text": "Here are the available times for pottery class on...",
  "intent": "BOOKING",
  "confidence": "HIGH",
  "functionCalled": "check_availability",
  "functionResult": {
    "success": true,
    "service": "pottery class",
    "date": "2025-01-15",
    "available_slots": ["09:00", "10:00", "14:00", "15:00"]
  }
}
```

### Test 5: Complete Booking

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/chat-completion \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role":"user","content":"Book pottery class tomorrow at 2pm for John Smith, email john@test.com"}],
    "storeId": "store-xxx"
  }'

Expected:
{
  "text": "✅ All set! Your pottery class is confirmed...",
  "intent": "BOOKING",
  "confidence": "HIGH",
  "functionCalled": "create_booking",
  "functionResult": {
    "success": true,
    "booking": {
      "service": "pottery class",
      "date": "2025-01-08",
      "time": "14:00",
      "customer_name": "John Smith",
      "email": "john@test.com",
      "confirmation": "CONFIRMED-..."
    }
  }
}
```

---

## 🔧 Prerequisites for Testing

### 1. Google Sheet Setup

Your Google Sheet must have these tabs (exact names):

- **Services** - Service offerings
  - Columns: `serviceName` or `name`, `duration`, `price`, `description`

- **Products** - Product catalog
  - Columns: `name`, `price`, `category`, `description`, `stock`

- **Hours** - Operating hours
  - Columns: `day`, `isOpen`, `openTime`, `closeTime`

- **Bookings** - Booking records (will be written to)
  - Columns: `service`, `date`, `time`, `customerName`, `email`, `phone`, `status`, `createdAt`

### 2. Share Sheet with Service Account

Share your Google Sheet with Editor permission to:
```
heysheets-backend@heysheets-mvp.iam.gserviceaccount.com
```

### 3. Connect Sheet to Store

1. Sign in to your app
2. Go to Settings for your store
3. Paste your Google Sheet URL
4. Click "Detect Sheet Structure"
5. Verify tabs are detected

---

## 📊 Response Format

All chat responses now include:

```typescript
{
  text: string;              // The conversational response
  intent: string;            // Detected intent (BOOKING, PRODUCT, INFO, etc.)
  confidence: string;        // HIGH, MEDIUM, or LOW
  functionCalled: string;    // Function that was executed (or null)
  functionResult: object;    // Structured result from function (or null)
}
```

**Old Response (Before Intelligence):**
```json
{
  "response": "I can help you with that!"
}
```

**New Response (After Intelligence):**
```json
{
  "text": "I can help you with that!",
  "intent": "GREETING",
  "confidence": "HIGH",
  "functionCalled": null,
  "functionResult": null
}
```

---

## 🎨 Optional: Frontend Enhancements

The current frontend displays `text` responses. You can optionally add rich UI components to display function results visually:

### Example: Product Cards

When `functionCalled === 'get_products'`, display products as cards instead of text:

```typescript
if (data.functionResult?.products) {
  return <ProductGrid products={data.functionResult.products} />;
}
```

### Example: Time Slot Picker

When `functionCalled === 'check_availability'`, display available slots as clickable buttons:

```typescript
if (data.functionResult?.available_slots) {
  return <TimeSlotPicker slots={data.functionResult.available_slots} />;
}
```

### Example: Booking Confirmation

When `functionCalled === 'create_booking'`, display a styled confirmation card:

```typescript
if (data.functionResult?.booking) {
  return <BookingConfirmation booking={data.functionResult.booking} />;
}
```

**These enhancements are optional** - the system works perfectly with just text responses.

---

## 🐛 Troubleshooting

### Issue: Classifier returns "OTHER" for everything

**Check:**
1. OpenRouter API key is set correctly
2. Store data is being fetched (check logs)
3. Messages format is correct

**Solution:**
```bash
# View logs
supabase functions logs chat-completion --tail

# Look for:
# [Chat] Step 3: Fetching store data for context...
# [Chat] Store data loaded successfully
# [Chat] Step 4: Classifying intent...
# [Chat] Classification result: {...}
```

### Issue: Functions not being called

**Check:**
1. Classification result shows `functionToCall`
2. Function executor logs

**Solution:**
```bash
# Check classification output
# Should see: functionToCall: "get_store_info" (or other function)

# If functionToCall is null, check classifier prompt
# Verify store data includes services/products
```

### Issue: "Failed to fetch store data"

**Check:**
1. google-sheet function is deployed
2. Sheet is shared with service account
3. Tabs exist with correct names

**Solution:**
```bash
# Test google-sheet function directly
curl -X POST ${SUPABASE_URL}/functions/v1/google-sheet \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"operation":"read","storeId":"store-xxx","tabName":"Services"}'

# Should return: { "success": true, "data": [...] }
```

### Issue: Booking created but not visible in sheet

**Check:**
1. Service account has Editor permission (not just Viewer)
2. Bookings tab exists
3. Sheet write operation succeeded

**Solution:**
```bash
# Check function logs for write operation
# Look for: [createBooking] Successfully created booking

# Verify in Google Sheet:
# - Go to Bookings tab
# - Look for new row with booking data
```

---

## 📈 Monitoring & Logs

View real-time logs during testing:

```bash
# Watch all chat-completion logs
supabase functions logs chat-completion --tail

# Filter for specific steps
supabase functions logs chat-completion --tail | grep "Classifier"
supabase functions logs chat-completion --tail | grep "Executor"
supabase functions logs chat-completion --tail | grep "Responder"
```

**Key log markers:**
- `[Chat] Step 0: Authenticating...` - Auth check
- `[Chat] Step 3: Fetching store data...` - Loading context
- `[Chat] Step 4: Classifying intent...` - Classification
- `[Chat] Step 5: Executing function...` - Function call
- `[Chat] Step 6: Generating response...` - Response generation
- `[Classifier] Result:` - Classification output
- `[Executor] Calling function:` - Function execution
- `[Responder] Response generated` - Response ready

---

## ✅ Success Criteria

Your intelligence system is working correctly if:

- ✅ Greetings are detected (GREETING intent, no function)
- ✅ Info requests call get_store_info
- ✅ "Show products" calls get_products
- ✅ Booking requests with date call check_availability
- ✅ Complete booking info calls create_booking
- ✅ Responses are natural and conversational
- ✅ Function results are used in responses
- ✅ Errors are handled gracefully
- ✅ Multi-step conversations work (asking for missing info)

---

## 🚀 Next Steps

1. **Deploy and Test**
   ```bash
   # Already deployed with this PR
   # Just test with the examples above
   ```

2. **Monitor Conversations**
   - Watch logs for classification accuracy
   - Check if functions are being called appropriately
   - Verify responses are natural

3. **Iterate on Prompts**
   - If classification is inaccurate, adjust classifier.ts prompt
   - If responses are too robotic, adjust responder.ts prompt
   - Add more examples for edge cases

4. **Add More Functions** (Optional)
   - `cancel_booking` - Cancel existing bookings
   - `reschedule_booking` - Change booking time
   - `add_to_cart` - Shopping cart management
   - `get_order_status` - Check order status

5. **Enhance Frontend** (Optional)
   - Create ProductCard, TimeSlotPicker, BookingConfirmation components
   - Display rich UI based on functionResult
   - Add loading states and animations

---

## 🎉 Summary

You now have a **fully intelligent chat system** that:
- 🧠 Understands user intent automatically
- ⚡ Executes actions without manual triggers
- 💬 Responds naturally using real data
- 🔄 Handles multi-step conversations
- 🔒 Maintains security and multi-tenancy

**The system is production-ready and deployed!** Test it with the examples above and iterate on prompts as needed.

---

## 📚 Additional Resources

- **OpenRouter Docs**: https://openrouter.ai/docs
- **Google Sheets API**: https://developers.google.com/sheets/api
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Claude 3.5 Sonnet**: https://www.anthropic.com/claude

---

**Questions or Issues?**

Check logs first:
```bash
supabase functions logs chat-completion --tail
```

Look for error messages and stack traces. Most issues are:
1. Missing Google Sheet permissions
2. Incorrect tab names
3. OpenRouter API errors
4. Authentication problems

All are easily fixed by following the troubleshooting section above!
