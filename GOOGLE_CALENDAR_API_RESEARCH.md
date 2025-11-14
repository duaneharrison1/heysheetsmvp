# Google Calendar API Research - Technical Capabilities for Booking Systems

**Research Date:** 2025-11-14
**Purpose:** Validate feasibility of migrating HeySheets booking system to Google Calendar API
**Sources:** Google official documentation, Stack Overflow, recent 2025 updates

---

## Executive Summary

✅ **Google Calendar API is HIGHLY SUITABLE for booking system migration**

**Key Findings:**
- ✅ FreeBusy API can query up to 50 calendars simultaneously for availability
- ✅ Resource calendars (rooms, equipment, staff) are natively supported
- ✅ New 2025 features include pre-configured booking pages with automatic conflict prevention
- ✅ API is free up to 1,000,000 queries/day (well beyond typical booking site needs)
- ⚠️ Resource calendar creation requires Directory API (not Calendar API)
- ⚠️ Capacity management beyond 1:1 bookings requires custom logic

---

## 1. FreeBusy API - Availability Checking

### Capabilities

**Official Documentation:** [Google Calendar API - FreeBusy Query](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)

**Endpoint:** `POST https://www.googleapis.com/calendar/v3/freeBusy`

### Request Format

```json
{
  "timeMin": "2025-11-15T00:00:00-05:00",
  "timeMax": "2025-11-15T23:59:59-05:00",
  "timeZone": "America/New_York",
  "items": [
    { "id": "stylist1@salon.example.com" },
    { "id": "stylist2@salon.example.com" },
    { "id": "stylist3@salon.example.com" }
  ]
}
```

### Response Format

```json
{
  "kind": "calendar#freeBusy",
  "timeMin": "2025-11-15T00:00:00.000Z",
  "timeMax": "2025-11-15T23:59:59.000Z",
  "calendars": {
    "stylist1@salon.example.com": {
      "busy": [
        {
          "start": "2025-11-15T09:00:00-05:00",
          "end": "2025-11-15T09:45:00-05:00"
        },
        {
          "start": "2025-11-15T14:00:00-05:00",
          "end": "2025-11-15T15:00:00-05:00"
        }
      ]
    },
    "stylist2@salon.example.com": {
      "busy": [
        {
          "start": "2025-11-15T10:00:00-05:00",
          "end": "2025-11-15T10:45:00-05:00"
        }
      ]
    },
    "stylist3@salon.example.com": {
      "busy": []
    }
  }
}
```

### Limits & Quotas

- **Maximum calendars per query:** 50
- **Google Groups:** Supported (max 100 members per group)
- **Rate limit:** 1,000,000 queries/day (free tier)
- **Typical booking site usage:** ~1,000-5,000 queries/day
- **Conclusion:** Well within free tier limits

### Example: Finding Available Time Slots

```javascript
// Step 1: Query FreeBusy for all stylists
const freeBusyResponse = await calendar.freebusy.query({
  requestBody: {
    timeMin: '2025-11-15T09:00:00-05:00',
    timeMax: '2025-11-15T17:00:00-05:00',
    items: [
      { id: 'stylist1@example.com' },
      { id: 'stylist2@example.com' }
    ]
  }
});

// Step 2: Generate potential time slots (every 15 minutes, 9am-5pm)
function generateTimeSlots(startHour, endHour, intervalMinutes) {
  const slots = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      slots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
  }
  return slots;
}

const allSlots = generateTimeSlots(9, 17, 15); // 9am-5pm, 15-min intervals

// Step 3: Filter available slots
function isSlotAvailable(slot, busyRanges, serviceDuration) {
  const slotStart = new Date(`2025-11-15T${slot}:00-05:00`);
  const slotEnd = new Date(slotStart.getTime() + serviceDuration * 60000);

  // Check if slot overlaps with any busy range
  return !busyRanges.some(busy => {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);
    return (slotStart < busyEnd && slotEnd > busyStart);
  });
}

// Step 4: Find slots where at least one stylist is available
const serviceDuration = 45; // minutes
const availableSlots = allSlots.filter(slot => {
  // Check each stylist
  for (const [calendarId, data] of Object.entries(freeBusyResponse.data.calendars)) {
    if (isSlotAvailable(slot, data.busy || [], serviceDuration)) {
      return true; // At least one stylist is free
    }
  }
  return false;
});

console.log('Available slots:', availableSlots);
// Output: ['09:00', '09:15', '11:00', '11:15', '15:00', '15:15', ...]
```

**Performance:** Single FreeBusy query returns availability for all resources, then client-side filtering. Fast and efficient.

---

## 2. Resource Calendars - Staff, Rooms, Equipment

### Official Documentation

**Source:** [Google Calendar API - Domain Resources, Rooms & Calendars](https://developers.google.com/workspace/calendar/api/concepts/domain)

### Key Concept: Resource Calendars

**What is a Resource Calendar?**
- Special calendar account representing physical spaces or equipment
- Can be booked as attendees in events
- Automatically accepts/rejects invites based on availability
- Has its own email address (e.g., `conference-room-1@example.com`)

### Creating Resource Calendars

**❌ Calendar API CANNOT create resource calendars**
**✅ Must use Admin SDK Directory API**

**Directory API Endpoint:**
```
POST https://admin.googleapis.com/admin/directory/v1/customer/{customerId}/resources/calendars
```

**Example Request:**
```json
{
  "resourceId": "stylist-jane",
  "resourceName": "Jane Doe - Hair Stylist",
  "resourceEmail": "jane-stylist@salon.example.com",
  "resourceType": "Staff Member",
  "resourceCategory": "Hair Services",
  "resourceDescription": "Senior stylist specializing in cuts and color",
  "capacity": 1,
  "buildingId": "main-salon",
  "featureInstances": [
    "HAIR_CUTTING",
    "HAIR_COLORING"
  ]
}
```

**Reference:** [Admin SDK - resources.calendars](https://developers.google.com/admin-sdk/directory/reference/rest/v1/resources.calendars)

### Booking Resources

Once resource calendar exists, booking is done via Calendar API:

```javascript
// Add resource as attendee to event
const event = {
  summary: 'Haircut - John Smith',
  start: {
    dateTime: '2025-11-15T10:00:00-05:00',
    timeZone: 'America/New_York'
  },
  end: {
    dateTime: '2025-11-15T10:45:00-05:00',
    timeZone: 'America/New_York'
  },
  attendees: [
    {
      email: 'jane-stylist@salon.example.com', // Resource email
      displayName: 'Jane Doe',
      resource: true // Mark as resource
    },
    {
      email: 'customer@example.com', // Customer email
      displayName: 'John Smith'
    }
  ],
  extendedProperties: {
    private: {
      serviceType: 'haircut',
      customerId: 'cust-123',
      price: '29.00'
    }
  }
};

await calendar.events.insert({
  calendarId: 'jane-stylist@salon.example.com',
  resource: event,
  sendUpdates: 'all' // Send email to attendees
});
```

**Auto-Accept Behavior:**
- Resource automatically accepts if time slot is free
- Resource automatically declines if time slot is busy
- No manual intervention needed

### Checking Resource Availability

```javascript
// Use FreeBusy to check resource availability
const resourceAvailability = await calendar.freebusy.query({
  requestBody: {
    timeMin: '2025-11-15T00:00:00Z',
    timeMax: '2025-11-15T23:59:59Z',
    items: [
      { id: 'jane-stylist@salon.example.com' },
      { id: 'john-stylist@salon.example.com' },
      { id: 'sarah-stylist@salon.example.com' }
    ]
  }
});

// Result shows busy times for each resource
```

### Resource Metadata via Directory API

**Get Resource Info:**
```
GET https://admin.googleapis.com/admin/directory/v1/customer/{customerId}/resources/calendars/{calendarResourceId}
```

**List All Resources:**
```
GET https://admin.googleapis.com/admin/directory/v1/customer/{customerId}/resources/calendars
```

**Response includes:**
- `resourceId` - Unique identifier
- `resourceEmail` - Calendar email (use as calendarId)
- `resourceName` - Display name
- `capacity` - Number (though not enforced by Calendar API)
- `buildingId` - Physical location
- `floorName`, `floorSection` - Location details
- `resourceCategory`, `resourceType` - Classification
- `featureInstances` - List of features/capabilities

---

## 3. Google Calendar Appointment Scheduling (2025 New Features)

### Source

**Official Announcement:** [Google Workspace Updates - Pre-configured Appointment Booking](https://workspaceupdates.googleblog.com/2025/08/pre-configured-appointment-booking-calendar.html)

### What's New (August-September 2025)

Google introduced **pre-configured booking pages** that:
- ✅ Automatically update based on working hours
- ✅ Prevent conflicts by syncing with all calendars
- ✅ Reflect real-time availability
- ✅ Support email verification (Business Standard+)
- ✅ Stripe payment integration (Business Standard+)
- ✅ Automated email reminders (Business Standard+)

### Appointment Schedule Features

**Available on:** Web only (for creation/editing), mobile for sharing

**Key Controls:**
- Maximum appointments per day
- Adjustable appointment windows
- Buffer time between appointments
- Information collection from bookers
- Email verification to prevent spam

**Customization Options:**
- Recurring availability times
- Scheduling windows (how far in advance)
- Daily booking limits
- Automatic availability checking

### Appointment Schedule vs. Old Appointment Slots

**Appointment Schedules** (current):
- Feature-rich booking system
- Smoother booking experience
- Modern UI
- Better integration

**Appointment Slots** (deprecated):
- Legacy feature
- Limited functionality
- Being phased out

**Recommendation:** Use Appointment Schedules for new implementations

### API Availability

**Important Note:** Based on search results, there appears to be **limited public API documentation** for programmatic creation of Appointment Schedules via Calendar API.

**Current Status (as of research):**
- ❌ No official Calendar API endpoint for creating Appointment Schedules
- ✅ Can create regular events programmatically
- ✅ Can use FreeBusy to check availability
- ⚠️ May need to create booking pages manually, then use API to create bookings

**For HeySheets Implementation:**
- **Recommended:** Use regular Calendar events with FreeBusy API
- **Don't rely on:** Appointment Schedule API (not publicly available)
- **Implement custom:** Booking logic on top of Calendar events

---

## 4. Capacity Management Analysis

### What Google Calendar Provides

1. **✅ Single Resource Booking**
   - One calendar = one resource
   - Automatic conflict prevention
   - Easy to implement

2. **✅ Multi-Resource Availability Checking**
   - FreeBusy can query up to 50 calendars
   - Identify which resources are available
   - Assign booking to available resource

3. **⚠️ Limited Capacity Enforcement**
   - No built-in "capacity > 1" concept for a single calendar
   - Cannot directly support "2 stylists share availability"

### What Google Calendar DOES NOT Provide

1. **❌ Capacity Count > 1**
   - Cannot set "this calendar accepts 2 concurrent bookings"
   - Must use multiple calendars or custom logic

2. **❌ Pooled Resources**
   - Cannot create "any available stylist" pool
   - Must explicitly assign to specific calendar

3. **❌ Automatic Resource Assignment**
   - Application must choose which calendar to book
   - No built-in "find best available resource" logic

### Recommended Capacity Patterns

#### Pattern A: One Calendar per Resource (Recommended)
```
Staff:
- jane@salon.com (Calendar 1)
- john@salon.com (Calendar 2)

Capacity = Number of calendars = 2

Algorithm:
1. Query FreeBusy for both calendars
2. Find which calendars are free
3. Book into first available calendar
```

**Pros:**
- ✅ True capacity management
- ✅ Individual resource tracking
- ✅ Scales to any number of resources
- ✅ Leverages Calendar's strengths

**Cons:**
- ⚠️ Need to create calendar per resource
- ⚠️ Application chooses which calendar

#### Pattern B: Single Calendar + Database Capacity Tracking
```
Service:
- yoga-class@studio.com (Single calendar)

Database:
- capacity: 30
- current_bookings: 15
- available: 15

Algorithm:
1. Check database capacity count
2. If under capacity, create event
3. Increment database counter
4. Keep database and calendar in sync
```

**Pros:**
- ✅ Flexible capacity (any number)
- ✅ Simple calendar setup

**Cons:**
- ❌ Sync complexity
- ❌ Database is source of truth (not Calendar)
- ❌ Risk of desync

**Recommendation for HeySheets:** Use Pattern A (One Calendar per Resource)

---

## 5. Practical Implementation Guide

### Scenario: Hair Salon with 3 Stylists

**Resources:**
- Jane Doe (Senior Stylist) - Cuts, Color, Styling
- John Smith (Stylist) - Cuts only
- Sarah Johnson (Junior Stylist) - Cuts, Color

**Services:**
- Haircut (45 min, $35)
- Hair Coloring (120 min, $85)
- Styling (30 min, $25)

### Step 1: Create Resource Calendars (Directory API)

```javascript
// One-time setup using Admin SDK Directory API
const resources = [
  {
    resourceId: 'stylist-jane',
    resourceName: 'Jane Doe',
    resourceEmail: 'jane@salon.example.com',
    resourceType: 'Staff',
    featureInstances: ['haircut', 'coloring', 'styling']
  },
  {
    resourceId: 'stylist-john',
    resourceName: 'John Smith',
    resourceEmail: 'john@salon.example.com',
    resourceType: 'Staff',
    featureInstances: ['haircut']
  },
  {
    resourceId: 'stylist-sarah',
    resourceName: 'Sarah Johnson',
    resourceEmail: 'sarah@salon.example.com',
    resourceType: 'Staff',
    featureInstances: ['haircut', 'coloring']
  }
];

// Create each resource (requires admin privileges)
for (const resource of resources) {
  await admin.directory.resources.calendars.insert({
    customer: 'my_customer',
    requestBody: resource
  });
}
```

### Step 2: Store Resource Mapping in Database

```sql
CREATE TABLE resources (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  calendar_id TEXT NOT NULL, -- 'jane@salon.example.com'
  service_types TEXT[], -- ['haircut', 'coloring', 'styling']
  active BOOLEAN DEFAULT true
);

INSERT INTO resources (name, calendar_id, service_types) VALUES
  ('Jane Doe', 'jane@salon.example.com', ARRAY['haircut', 'coloring', 'styling']),
  ('John Smith', 'john@salon.example.com', ARRAY['haircut']),
  ('Sarah Johnson', 'sarah@salon.example.com', ARRAY['haircut', 'coloring']);
```

### Step 3: Check Availability Function

```javascript
async function checkAvailability(serviceType, date, duration) {
  // 1. Get resources that can perform this service
  const resources = await db.query(
    'SELECT * FROM resources WHERE $1 = ANY(service_types) AND active = true',
    [serviceType]
  );

  if (resources.length === 0) {
    throw new Error(`No resources available for ${serviceType}`);
  }

  // 2. Query FreeBusy for all matching resources
  const calendarIds = resources.map(r => ({ id: r.calendar_id }));

  const freeBusyResponse = await calendar.freebusy.query({
    requestBody: {
      timeMin: `${date}T00:00:00-05:00`,
      timeMax: `${date}T23:59:59-05:00`,
      items: calendarIds
    }
  });

  // 3. Generate time slots (9am-6pm, every 15 min)
  const slots = [];
  for (let hour = 9; hour < 18; hour++) {
    for (let min = 0; min < 60; min += 15) {
      slots.push({
        time: `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`,
        hour,
        min
      });
    }
  }

  // 4. Find available slots for each resource
  const availabilityByResource = {};

  for (const resource of resources) {
    const busyTimes = freeBusyResponse.data.calendars[resource.calendar_id]?.busy || [];

    const availableSlots = slots.filter(slot => {
      const slotStart = new Date(`${date}T${slot.time}:00-05:00`);
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);

      // Check if slot overlaps with any busy time
      return !busyTimes.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return (slotStart < busyEnd && slotEnd > busyStart);
      });
    });

    availabilityByResource[resource.name] = {
      resourceId: resource.id,
      calendarId: resource.calendar_id,
      availableSlots: availableSlots.map(s => s.time)
    };
  }

  // 5. Return combined availability
  // (All slots where at least one resource is available)
  const allAvailableSlots = new Set();
  Object.values(availabilityByResource).forEach(resource => {
    resource.availableSlots.forEach(slot => allAvailableSlots.add(slot));
  });

  return {
    date,
    service: serviceType,
    duration,
    availableSlots: Array.from(allAvailableSlots).sort(),
    resourceAvailability: availabilityByResource
  };
}

// Usage
const availability = await checkAvailability('haircut', '2025-11-15', 45);
console.log(availability);
/*
{
  date: '2025-11-15',
  service: 'haircut',
  duration: 45,
  availableSlots: ['09:00', '09:15', '09:30', '10:45', ...],
  resourceAvailability: {
    'Jane Doe': {
      resourceId: 'uuid-1',
      calendarId: 'jane@salon.example.com',
      availableSlots: ['09:00', '09:15', '14:00', ...]
    },
    'John Smith': {
      resourceId: 'uuid-2',
      calendarId: 'john@salon.example.com',
      availableSlots: ['09:00', '09:15', '09:30', '10:45', ...]
    },
    ...
  }
}
*/
```

### Step 4: Create Booking Function

```javascript
async function createBooking(params) {
  const { serviceType, date, time, customerName, customerEmail, duration } = params;

  // 1. Check availability again (prevent race conditions)
  const availability = await checkAvailability(serviceType, date, duration);

  if (!availability.availableSlots.includes(time)) {
    throw new Error('Time slot no longer available');
  }

  // 2. Find a resource that has this slot available
  let selectedResource = null;
  for (const [resourceName, resourceData] of Object.entries(availability.resourceAvailability)) {
    if (resourceData.availableSlots.includes(time)) {
      selectedResource = resourceData;
      break;
    }
  }

  if (!selectedResource) {
    throw new Error('No resource available for selected time');
  }

  // 3. Calculate start/end times
  const startDateTime = `${date}T${time}:00-05:00`;
  const endTime = new Date(new Date(startDateTime).getTime() + duration * 60000);
  const endDateTime = endTime.toISOString();

  // 4. Create Calendar event
  const event = {
    summary: `${serviceType} - ${customerName}`,
    description: `Service: ${serviceType}\nCustomer: ${customerName}\nEmail: ${customerEmail}`,
    start: {
      dateTime: startDateTime,
      timeZone: 'America/New_York'
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'America/New_York'
    },
    attendees: [
      {
        email: customerEmail,
        displayName: customerName
      }
    ],
    extendedProperties: {
      private: {
        serviceType,
        customerName,
        customerEmail,
        resourceId: selectedResource.resourceId,
        bookingSource: 'heysheets'
      }
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'email', minutes: 60 }       // 1 hour before
      ]
    }
  };

  const calendarEvent = await calendar.events.insert({
    calendarId: selectedResource.calendarId,
    resource: event,
    sendUpdates: 'all' // Send email notification to customer
  });

  // 5. Record in database
  await db.query(`
    INSERT INTO bookings (
      calendar_event_id,
      resource_id,
      service_type,
      customer_name,
      customer_email,
      start_time,
      end_time,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    calendarEvent.data.id,
    selectedResource.resourceId,
    serviceType,
    customerName,
    customerEmail,
    startDateTime,
    endDateTime,
    'confirmed'
  ]);

  return {
    success: true,
    bookingId: calendarEvent.data.id,
    resource: selectedResource,
    startTime: startDateTime,
    endTime: endDateTime,
    confirmationMessage: `Booking confirmed with ${resourceName} on ${date} at ${time}`
  };
}
```

---

## 6. API Quotas & Cost Analysis

### Official Quotas

**Source:** [Google Calendar API - Manage Quotas](https://developers.google.com/workspace/calendar/api/guides/quota)

**Free Tier Limits:**
- **Queries per day:** 1,000,000
- **Queries per user per second:** 5
- **Queries per 100 seconds per user:** 500

### Typical Booking Site Usage

**Scenario:** Small-medium booking business

**Daily Operations:**
- 50 customers checking availability: 50 FreeBusy queries
- Each checks 3 different dates: 150 queries
- 40 bookings created: 40 event.insert queries
- 5 cancellations: 5 event.delete queries
- 10 reschedules: 10 event.update queries

**Total:** ~200-300 queries/day

**Headroom:** 1,000,000 / 300 = 3,333x below quota

**Conclusion:** Free tier is MORE than sufficient

### Cost Comparison

| Service | Current (Sheets) | After Migration (Calendar) |
|---------|------------------|----------------------------|
| Google Sheets API | Free | Still used for services catalog |
| Google Calendar API | Not used | Free (within quotas) |
| Google Workspace | Not required | Optional ($6/user/month for resource calendars) |
| Supabase Database | $25/month | $25-50/month (more data) |
| OpenRouter AI | ~$0.01/message | ~$0.01/message (unchanged) |

**Total Monthly Cost:**
- **Without Workspace:** +$0-25 (just Supabase increase)
- **With Workspace (3 staff):** +$18-43 (Workspace + Supabase)

**ROI:** Massive - gains real availability checking, conflict prevention, automated emails, timezone support, etc.

---

## 7. Recommended Architecture for HeySheets

### Hybrid System Design

```
┌──────────────────────────────────────────────────────────────┐
│                     GOOGLE CALENDAR                          │
│                                                              │
│  Calendar: jane@salon.example.com                            │
│  └─ Events: Customer bookings                                │
│                                                              │
│  Calendar: john@salon.example.com                            │
│  └─ Events: Customer bookings                                │
│                                                              │
│  FreeBusy API: Check availability across all calendars       │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            │ Sync bidirectional
                            │
┌──────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                          │
│                                                              │
│  resources table:                                            │
│  - id, name, calendar_id, service_types[]                    │
│                                                              │
│  bookings table:                                             │
│  - id, calendar_event_id, resource_id, customer_id           │
│  - service_id, start_time, end_time, status                  │
│                                                              │
│  services table:                                             │
│  - id, name, duration, price, description, category          │
│                                                              │
│  customers table:                                            │
│  - id, name, email, phone, booking_history[]                 │
└──────────────────────────────────────────────────────────────┘
                            ▲
                            │
                            │ Optional sync
                            │
┌──────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS (Optional)                  │
│                                                              │
│  Services sheet: Business owner edits pricing, descriptions  │
│  Products sheet: E-commerce catalog                          │
│  Bookings sheet: Read-only archive (deprecated)              │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow: Booking Creation

1. **User:** "Book haircut tomorrow at 2pm"
2. **AI Classifier:** Extract params (service, date, time, customer info)
3. **Application:**
   - Query database: Get resources that offer "haircut"
   - Query Calendar: FreeBusy check for those resources
   - Calculate: Available time slots
   - Find: First available resource at 2pm
4. **Calendar API:** Create event in resource calendar
5. **Database:** Record booking with `calendar_event_id`
6. **Customer:** Receives email confirmation (from Calendar)
7. **Response:** "Confirmed! Jane will see you tomorrow at 2pm"

### Data Flow: Availability Check

1. **User:** "What times are available for haircut on Friday?"
2. **AI Classifier:** Extract params (service="haircut", date="2025-11-15")
3. **Application:**
   - Query database: `SELECT * FROM resources WHERE 'haircut' = ANY(service_types)`
   - Result: [Jane, John, Sarah]
4. **Calendar API:** FreeBusy query for all three calendars on 2025-11-15
5. **Application:**
   - Generate slots: 9:00, 9:15, 9:30, ... 17:45
   - Filter: Remove slots where all resources are busy
   - Return: Available slots
6. **Response:** "Available times: 9:00 AM, 9:15 AM, 11:30 AM, 2:00 PM, ..."

---

## 8. Migration Risks & Mitigations

### Risk 1: Google Workspace Requirement

**Risk:** Resource calendars require Google Workspace account

**Impact:** Additional cost ($6/user/month minimum)

**Mitigation:**
- **Option A:** Use personal Gmail accounts as "resource calendars" (free, but less professional)
- **Option B:** Start with single calendar per service, migrate to Workspace later
- **Option C:** Use Google Workspace only for store owner, create resource calendars under that domain

**Recommendation:** Option C - single Workspace account for admin, create resource calendars under that domain

### Risk 2: API Quota Exceeded

**Risk:** High traffic exceeds 1M queries/day

**Impact:** API throttling, booking failures

**Likelihood:** Very low (would need 10,000+ daily bookings)

**Mitigation:**
- Implement caching (5-minute cache for availability)
- Batch FreeBusy queries (query multiple dates at once)
- Monitor quota usage via Google Cloud Console
- Request quota increase if needed (usually approved)

### Risk 3: Calendar-Database Sync Issues

**Risk:** Calendar event created but database insert fails (or vice versa)

**Impact:** Inconsistent data, double bookings

**Mitigation:**
- **Transaction Pattern:**
  ```javascript
  try {
    // 1. Create Calendar event first
    const event = await calendar.events.insert(...);

    // 2. Record in database with event ID
    await db.bookings.insert({
      calendar_event_id: event.id,
      ...
    });
  } catch (error) {
    // 3. Rollback: Delete Calendar event if DB insert fails
    if (event?.id) {
      await calendar.events.delete({
        calendarId: resourceCalendarId,
        eventId: event.id
      });
    }
    throw error;
  }
  ```
- Use Calendar webhook to detect external changes
- Periodic sync job to reconcile differences

### Risk 4: Timezone Complexity

**Risk:** Booking shown in wrong timezone, customer confused

**Impact:** Missed appointments, bad UX

**Mitigation:**
- Always store times in UTC in database
- Always include timezone in Calendar API calls
- Display times in user's local timezone in UI
- Test with users in different timezones

### Risk 5: Email Spam/Deliverability

**Risk:** Calendar notifications go to spam

**Impact:** Customers don't see confirmation

**Mitigation:**
- Use verified domain for resource calendars
- Test email deliverability
- Provide option to resend confirmation
- Show confirmation in app (don't rely only on email)

---

## 9. Comparison: Current System vs. Calendar API

| Feature | Current (Sheets) | After (Calendar API) | Improvement |
|---------|------------------|----------------------|-------------|
| **Availability Check** | ❌ Hardcoded slots | ✅ Real-time FreeBusy | ⭐⭐⭐⭐⭐ |
| **Conflict Detection** | ❌ None | ✅ Automatic | ⭐⭐⭐⭐⭐ |
| **Capacity (1 resource)** | ❌ Not enforced | ✅ One calendar = 1 capacity | ⭐⭐⭐⭐⭐ |
| **Capacity (multiple)** | ❌ No concept | ✅ Multiple calendars | ⭐⭐⭐⭐⭐ |
| **Business Hours** | ✅ Stored in Sheets | ✅ Calendar working hours | ⭐⭐ |
| **Email Notifications** | ❌ Fake (not sent) | ✅ Real (automatic) | ⭐⭐⭐⭐⭐ |
| **Timezone Support** | ❌ Naive strings | ✅ Full timezone awareness | ⭐⭐⭐⭐⭐ |
| **Reminders** | ❌ None | ✅ Email/SMS 1 day & 1 hour before | ⭐⭐⭐⭐ |
| **Customer Calendar Invite** | ❌ None | ✅ .ics file sent | ⭐⭐⭐⭐ |
| **Cancellation/Rescheduling** | ❌ UI only, no backend | ✅ Update/delete events | ⭐⭐⭐⭐⭐ |
| **Multi-day Events** | ❌ Not supported | ✅ Native support | ⭐⭐⭐ |
| **Recurring Bookings** | ❌ Not supported | ✅ Native support | ⭐⭐⭐⭐ |
| **API Cost** | Free | Free (up to 1M/day) | - |
| **Data Export** | ✅ Easy (Sheets UI) | ⚠️ Need to query API | ⭐⭐ |
| **Business Owner Editing** | ✅ Sheets UI | ⚠️ Calendar UI or custom admin | ⭐⭐⭐ |

**Overall Improvement:** ⭐⭐⭐⭐⭐ (Transformational upgrade)

---

## 10. Final Recommendations

### ✅ PROCEED with Google Calendar API Migration

**Confidence:** HIGH

**Reasoning:**
1. Current system is fundamentally broken (fake availability)
2. Calendar API provides exactly what's missing
3. Free tier is more than sufficient
4. Implementation is well-documented
5. Risk is manageable
6. ROI is extremely high

### Recommended Implementation Phases

**Phase 1 (Weeks 1-2): Database Foundation**
- Create `resources`, `bookings`, `services`, `customers` tables
- Migrate Services data from Sheets to database
- No Calendar integration yet (don't break existing system)

**Phase 2 (Weeks 3-4): Calendar Setup**
- Set up Google Workspace (if using resource calendars)
- Create resource calendars via Directory API
- Test FreeBusy queries
- Implement availability checking algorithm

**Phase 3 (Weeks 5-7): Booking Integration**
- Implement `createBooking()` function with Calendar API
- Dual-write: Create event in Calendar AND record in database
- Add conflict detection before booking
- Test end-to-end flow

**Phase 4 (Weeks 8-9): Replace Hardcoded Availability**
- Remove hardcoded slots from `checkAvailability()`
- Replace with real FreeBusy-based availability
- Test thoroughly with various scenarios

**Phase 5 (Weeks 10-11): Advanced Features**
- Implement cancellation/rescheduling
- Add email notifications (Calendar's built-in)
- Implement resource assignment logic
- Add timezone support

**Phase 6 (Week 12): Cleanup & Optimization**
- Stop writing bookings to Google Sheets
- Archive historical Sheets data
- Optimize API calls (caching, batching)
- Load testing

**Total Timeline:** 12 weeks (3 months)

### Success Metrics

Track these metrics to validate migration success:

1. **Availability Accuracy:** 100% (no more fake slots)
2. **Double Bookings:** 0 (currently unknown/possible)
3. **Email Delivery Rate:** >95%
4. **API Error Rate:** <0.1%
5. **Booking Completion Time:** <3 seconds
6. **Customer Satisfaction:** Track via feedback

---

## 11. Resources & References

### Official Documentation
- [Google Calendar API Overview](https://developers.google.com/workspace/calendar/api/guides/overview)
- [FreeBusy API Reference](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Events API Reference](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- [Domain Resources & Calendars](https://developers.google.com/workspace/calendar/api/concepts/domain)
- [Admin SDK - Calendar Resources](https://developers.google.com/admin-sdk/directory/reference/rest/v1/resources.calendars)
- [Quota Management](https://developers.google.com/workspace/calendar/api/guides/quota)

### Helpful Guides
- [Finding Time to Meet via Google Calendar API](https://dzone.com/articles/finding-a-time-to-meet-via-the-google-calendar-api)
- [Can Google Calendar API be used for scalable scheduling?](https://stackoverflow.com/questions/54183602/can-google-calendar-api-be-used-to-create-scalable-scheduling-service)
- [Google Calendar API Integration Guide](https://www.namesspark.com/google-calendar-api-integration-developer-guide-to-seamless-scheduling/)

### Code Examples
- [Booking with Google Calendar API and Node.js](https://github.com/sar-joshi/booking-with-google-calender-api-and-nodejs_v1.1)

---

**Document Version:** 1.0
**Research Completed:** 2025-11-14
**Status:** ✅ Research Complete - Ready for Implementation Decision

