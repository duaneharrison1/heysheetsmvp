# Google Calendar Booking Integration - Implementation Guide

**Status:** ✅ IMPLEMENTED
**Date:** 2024-11-20
**Dependencies:** Google Sheets integration, Chat intelligence system

---

## 🎯 What Was Built

A complete **calendar-based booking system** that enables customers to book services through chat, with:

- ✅ **Automatic Calendar Management** - Creates calendars for availability schedules
- ✅ **Service Linking** - Maps services to specific availability calendars
- ✅ **Availability Checking** - Verifies time slots against calendar events
- ✅ **Capacity Management** - Tracks bookings per time slot with configurable limits
- ✅ **Booking Confirmation** - Creates calendar invites with customer details
- ✅ **Multi-Service Support** - One calendar can handle multiple services
- ✅ **Frontend Calendar Manager** - Visual UI for managing schedules

---

## 📁 Files Created

### Backend (Supabase Edge Functions)

```
supabase/
├── functions/
│   ├── _shared/
│   │   └── google-calendar.ts           (NEW - Calendar API wrapper)
│   ├── tools/
│   │   └── calendar-booking.ts          (NEW - Booking functions)
│   ├── setup-calendars/index.ts         (NEW - Initial calendar setup)
│   └── link-calendar/index.ts           (NEW - Calendar management)
└── migrations/
    └── 20241120_add_calendar_columns.sql (NEW - Database schema)
```

### Frontend

```
src/
├── pages/
│   └── CalendarSetup.tsx                (NEW - Calendar management UI)
├── lib/
│   ├── calendar-links.ts                (NEW - Google Calendar URL helpers)
│   └── calendar-data.ts                 (NEW - Calendar data fetching)
└── components/
    └── ui/calendar.tsx                  (shadcn/ui component)
```

### What Each Module Does

**google-calendar.ts** (Backend)
- Handles Google Calendar API authentication via service account
- Creates new calendars programmatically
- Lists and filters calendar events
- Creates booking events with customer details
- Counts bookings for capacity management
- Shares calendars with store owners

**calendar-booking.ts** (Backend)
- `checkAvailability()` - Verifies if service is available at requested time
  - Checks against availability calendar events
  - Validates capacity limits
  - Returns available spots remaining
- `createBooking()` - Creates confirmed booking
  - Validates all required fields
  - Checks capacity before booking
  - Creates invite in customer bookings calendar
  - Stores customer data in event metadata

**setup-calendars/index.ts** (Backend)
- Creates initial "Customer Bookings" calendar
- Shares calendar with store owner (write access)
- Stores `invite_calendar_id` in database

**link-calendar/index.ts** (Backend)
- `create` action - Creates new availability calendar + links services
- `link` action - Links existing calendar to services
- `unlink` action - Removes service from calendar mapping

**CalendarSetup.tsx** (Frontend)
- Visual interface for managing availability schedules
- Create/edit/delete calendar mappings
- View upcoming bookings
- Display next available time slots
- One-click access to Google Calendar

---

## 🔄 How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Google Calendar                         │
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────┐ │
│  │ Availability Calendar│    │ Customer Bookings        │ │
│  │ (Service Hours)      │    │ (Confirmed Bookings)     │ │
│  │                      │    │                          │ │
│  │ Mon-Fri 9am-5pm     │    │ John - Pottery 2pm      │ │
│  │ (Recurring Event)    │    │ Sarah - Yoga 10am       │ │
│  └──────────────────────┘    └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          ↑                              ↑
          │                              │
    checkAvailability()            createBooking()
          │                              │
┌─────────┴──────────────────────────────┴──────────────┐
│              Chat Intelligence System                  │
│                                                        │
│  User: "Book pottery class tomorrow at 2pm"          │
│  AI: Classifies intent → Executes booking function   │
└────────────────────────────────────────────────────────┘
          ↑
          │
┌─────────┴──────────────────────────────────────────┐
│              stores table                          │
│                                                    │
│  calendar_mappings: {                             │
│    "cal_abc123": {                                │
│      "name": "Store Hours",                       │
│      "serviceIds": ["pottery", "yoga"]            │
│    }                                              │
│  }                                                │
│  invite_calendar_id: "bookings_xyz789"           │
└────────────────────────────────────────────────────┘
```

### Booking Flow Example

```
1. User: "Can I book pottery class tomorrow at 2pm? I'm John, john@email.com"

2. Chat Intelligence:
   - Classifies intent: BOOKING
   - Extracts params: {
       service_name: "pottery class",
       date: "2024-11-21",
       time: "14:00",
       customer_name: "John",
       customer_email: "john@email.com"
     }
   - Calls: createBooking()

3. createBooking():
   a) Load store from database → get calendar_mappings
   b) Find "pottery class" in Services sheet
   c) Look up which calendar handles pottery (e.g., "cal_abc123")
   d) Build dateTime: "2024-11-21T14:00:00+08:00"
   e) Call checkAvailability() internally:
      - Query "cal_abc123" for events on 2024-11-21
      - Find event covering 2pm slot (e.g., "Mon-Fri 9am-5pm")
      - Count existing bookings at that exact time
      - Verify capacity not exceeded
   f) If available:
      - Generate booking ID
      - Create event in invite_calendar_id:
        * Summary: "Pottery Class - John"
        * Description: Customer details
        * Time: 2pm - 3pm (based on service duration)
        * Extended properties: booking_id, service_id, customer info
   g) Return success with confirmation

4. AI Response:
   "Booking confirmed for Pottery Class on Nov 21 at 2pm!
    Your confirmation details have been saved. See you there!"
```

---

## 🚀 Testing the Calendar Booking System

### Prerequisites

1. **Complete Setup Guide** - Run `SETUP_GUIDE.md` first
2. **Google Sheet with Services** - Must have Services tab with:
   - `serviceName` or `name`
   - `serviceID` (optional, uses serviceName if missing)
   - `duration` (minutes, default: 60)
   - `capacity` (max bookings per slot, default: 20)
   - `price`

### Step 1: Initial Calendar Setup

```bash
# Call setup-calendars edge function
curl -X POST ${SUPABASE_URL}/functions/v1/setup-calendars \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "store-xxx",
    "ownerEmail": "owner@example.com"
  }'

Expected:
{
  "success": true,
  "message": "Calendar created and shared",
  "inviteCalendarId": "abc123@group.calendar.google.com"
}
```

**What this does:**
- Creates "Customer Bookings - [Store Name]" calendar
- Shares it with your email (write access)
- Stores calendar ID in `stores.invite_calendar_id`

### Step 2: Create Availability Calendar

**Option A: Via Frontend (Recommended)**

1. Go to Store Settings → Calendar Setup
2. Click "+ Create Schedule"
3. Choose "General Hours" or "Unique Schedule"
4. Name it (e.g., "Store Hours")
5. Select which services use this schedule
6. Click "Create Calendar"
7. Opens Google Calendar → Add availability events

**Option B: Via API**

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/link-calendar \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "storeId": "store-xxx",
    "serviceIds": ["pottery", "yoga"],
    "calendarName": "Store Hours",
    "ownerEmail": "owner@example.com"
  }'

Expected:
{
  "success": true,
  "calendarId": "xyz789@group.calendar.google.com",
  "message": "Calendar created and linked"
}
```

### Step 3: Add Availability Events

In Google Calendar, create recurring events on your new calendar:

```
Event: "Available Hours"
Calendar: Store Hours (select from dropdown!)
Time: Mon-Fri 9:00 AM - 5:00 PM
Repeat: Weekly on M, T, W, Th, F
```

⚠️ **CRITICAL:** Select the correct calendar from the dropdown when creating events!

### Step 4: Test Availability Check

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/chat-completion \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Is pottery class available tomorrow at 2pm?"
    }],
    "storeId": "store-xxx"
  }'

Expected Flow:
1. Classifier detects BOOKING intent
2. Extracts: service_name, date, time
3. Calls check_availability function
4. Returns:
   {
     "text": "Yes! Pottery Class is available on Nov 21 at 2pm. 20 spots remaining. Price: $45",
     "functionCalled": "check_availability",
     "functionResult": {
       "success": true,
       "available": true,
       "service": "Pottery Class",
       "available_spots": 20,
       "capacity": 20,
       "booked": 0
     }
   }
```

### Step 5: Test Complete Booking

```bash
curl -X POST ${SUPABASE_URL}/functions/v1/chat-completion \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Book pottery class tomorrow at 2pm for John Smith, email john@test.com"
    }],
    "storeId": "store-xxx"
  }'

Expected:
{
  "text": "Booking confirmed for Pottery Class on Nov 21 at 2pm! Your confirmation details have been saved. See you there!",
  "functionCalled": "create_booking",
  "functionResult": {
    "success": true,
    "booking_id": "bk_1732176000000_abc123def",
    "service": "Pottery Class",
    "date": "2024-11-21",
    "time": "14:00",
    "customer_name": "John Smith",
    "customer_email": "john@test.com",
    "available_spots_remaining": 19
  }
}
```

**Verify in Google Calendar:**
- Go to "Customer Bookings" calendar
- Should see event: "Pottery Class - John Smith"
- Click event → See customer details in description

---

## 📊 Database Schema

### Stores Table Additions

```sql
-- Calendar mappings (maps calendar IDs to services)
calendar_mappings JSONB DEFAULT '{}'::jsonb

-- Customer bookings calendar ID
invite_calendar_id TEXT
```

**calendar_mappings format:**

```json
{
  "cal_abc123@group.calendar.google.com": {
    "name": "Store Hours",
    "serviceIds": ["pottery", "yoga", "painting"]
  },
  "cal_xyz789@group.calendar.google.com": {
    "name": "Weekend Classes",
    "serviceIds": ["advanced_pottery"]
  }
}
```

**Legacy formats (automatically handled):**

```json
// Array format (deprecated)
{
  "cal_abc123": ["pottery", "yoga"]
}

// String format (deprecated)
{
  "cal_abc123": "pottery"
}
```

---

## 🔧 Service Account Configuration

The integration uses the same service account as Google Sheets:

```
heysheets-backend@heysheets-mvp.iam.gserviceaccount.com
```

**Scopes:**
- `https://www.googleapis.com/auth/calendar` (full calendar access)

**Limitations:**
- ⚠️ Cannot send email invites to customers (service account restriction)
- ✅ Can create events with customer details in description/metadata
- ✅ Can share calendars with store owners
- ✅ Owner receives notifications for new bookings

**Future Enhancement (Requires Domain-Wide Delegation):**
- Send actual calendar invites to customer emails
- Customer can accept/decline in their own calendar

---

## 🐛 Troubleshooting

### Issue: "Calendar not accessible" error

**Symptoms:**
```
Error: Calendar not accessible. Calendar ID: cal_abc123...
Make sure it's shared with heysheets-backend@heysheets-mvp.iam.gserviceaccount.com
```

**Solution:**
1. The calendar must be shared with the service account
2. This happens automatically when using `link-calendar` with `action: "create"`
3. If linking existing calendar manually, share it:
   - Open calendar in Google Calendar
   - Settings → Share with specific people
   - Add: `heysheets-backend@heysheets-mvp.iam.gserviceaccount.com`
   - Permission: "Make changes to events"

### Issue: Availability check returns "not available" but calendar has events

**Check:**
1. Requested time falls within an event's time range
2. Events are on the correct calendar
3. Events are not all-day events (must have specific times)

**Debug:**
```bash
# View logs
supabase functions logs chat-completion --tail

# Look for:
[check_availability] Found events: 5
[check_availability] Requested time: 2024-11-21T14:00:00+08:00
[check_availability] Event 1: { start: "2024-11-21T09:00:00+08:00", end: "2024-11-21T17:00:00+08:00" }
```

**Common causes:**
- Event created on wrong calendar (e.g., personal calendar instead of availability calendar)
- Time zone mismatch
- Event is all-day instead of timed
- Requested time is outside event window

### Issue: Booking created but not visible in calendar

**Check:**
1. Check `invite_calendar_id` is set in stores table
2. Verify service account has write access
3. Check function logs for errors

**Solution:**
```sql
-- Check calendar ID
SELECT invite_calendar_id FROM stores WHERE id = 'store-xxx';

-- Should return something like: abc123@group.calendar.google.com
```

```bash
# Check function logs
supabase functions logs chat-completion --tail | grep "create_booking"

# Should see:
[create_booking] ✅ Booking created successfully: bk_123...
```

### Issue: Multiple services showing as unavailable

**Check calendar_mappings:**
```sql
SELECT calendar_mappings FROM stores WHERE id = 'store-xxx';
```

**Expected:**
```json
{
  "cal_abc123": {
    "name": "Store Hours",
    "serviceIds": ["pottery", "yoga"]
  }
}
```

**If missing:**
- Services not linked to any calendar
- Use frontend Calendar Setup page to create/link calendars

### Issue: Capacity exceeded immediately (0 bookings but shows full)

**Check:**
- Service capacity in Google Sheet
- Default capacity is 20 if not specified
- If capacity = 1, only one booking per time slot allowed

**Solution:**
```
Update your Services sheet:
- Add "capacity" column if missing
- Set appropriate value (e.g., 20 for classes, 1 for appointments)
```

---

## 📈 Frontend Integration

### Calendar Setup Page

The `CalendarSetup.tsx` component provides:

**Features:**
- ✅ One-click calendar creation
- ✅ Service selection (multi-select)
- ✅ Two calendar types:
  - General Hours (shared across services)
  - Unique Schedule (specific services)
- ✅ View upcoming bookings
- ✅ See next available time slots
- ✅ Quick links to Google Calendar
- ✅ Edit/remove schedules

**Integration:**
```typescript
import CalendarSetup from '@/pages/CalendarSetup';

// In your settings page
<CalendarSetup storeId={storeId} />
```

### Calendar Helper Functions

```typescript
import {
  getCalendarEmbedLink,
  getCalendarEditLink,
  getCalendarViewLink
} from '@/lib/calendar-links';

// Embed calendar in iframe
const embedUrl = getCalendarEmbedLink(calendarId, { mode: 'WEEK' });

// Open in Google Calendar for editing
const editUrl = getCalendarEditLink(calendarId);

// View calendar (customer-facing)
const viewUrl = getCalendarViewLink(calendarId);
```

---

## ✅ Success Checklist

After setup, verify:

- [ ] `invite_calendar_id` is set in stores table
- [ ] "Customer Bookings" calendar exists in Google Calendar
- [ ] "Customer Bookings" calendar is shared with store owner email
- [ ] At least one availability calendar created
- [ ] Availability calendar has events (e.g., Mon-Fri 9-5)
- [ ] Services are linked to calendars (check `calendar_mappings`)
- [ ] `check_availability` returns correct available spots
- [ ] `create_booking` creates event in customer bookings calendar
- [ ] AI chat correctly calls booking functions
- [ ] Calendar Setup page displays schedules
- [ ] Upcoming bookings section shows confirmed bookings

---

## 🚀 Next Steps

### Immediate Improvements

1. **Email Notifications** (Requires external service)
   - Send confirmation emails to customers
   - Use SendGrid/Mailgun to send booking details
   - Include add-to-calendar link

2. **Booking Cancellation**
   ```typescript
   // Add to calendar-booking.ts
   export async function cancelBooking(bookingId: string) {
     // Find event by extendedProperties.private.booking_id
     // Update status to cancelled
   }
   ```

3. **Rescheduling**
   ```typescript
   export async function rescheduleBooking(
     bookingId: string,
     newDate: string,
     newTime: string
   ) {
     // Update event start/end times
   }
   ```

### Advanced Features

1. **Buffer Times**
   - Add padding between bookings (e.g., 15 min cleanup)
   - Implement in `check_availability` logic

2. **Multi-Day Events**
   - Support bookings spanning multiple days
   - Handle overnight services

3. **Waitlist**
   - When capacity full, add to waitlist
   - Notify when spot opens

4. **Payment Integration**
   - Require deposit for booking
   - Integrate Stripe payment links

5. **SMS Reminders**
   - Send reminder 24h before appointment
   - Use Twilio for SMS

---

## 🎉 Summary

You now have a **production-ready calendar booking system** that:

- 🗓️ Manages availability schedules via Google Calendar
- ✅ Validates bookings against available time slots
- 👥 Tracks capacity per service and time slot
- 📧 Stores customer details in event metadata
- 🎨 Provides beautiful frontend UI for setup
- 🤖 Integrates seamlessly with AI chat
- 🔒 Maintains security with RLS policies

**The system is fully deployed and ready to accept bookings!**

---

## 📚 Additional Resources

- **Google Calendar API**: https://developers.google.com/calendar/api/v3/reference
- **Service Account Auth**: https://developers.google.com/identity/protocols/oauth2/service-account
- **Calendar Embed Options**: https://support.google.com/calendar/answer/41207
- **iCal/ICS Format**: https://icalendar.org/

---

**Questions or Issues?**

Check logs first:
```bash
supabase functions logs chat-completion --tail | grep "check_availability\|create_booking"
```

Most issues are:
1. Calendar not shared with service account
2. Events on wrong calendar
3. Service not linked to any calendar
4. Time zone mismatches (use +08:00 for Asia/Hong_Kong)
