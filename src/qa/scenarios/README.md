# Test Scenarios

## How to Create a New Test Scenario

1. Create a new JSON file in this directory
2. Use the format shown in existing scenarios
3. Scenario ID should match filename (e.g., `booking-002` → `booking-002-xyz.json`)

## Scenario Structure

```json
{
  "id": "unique-id",
  "name": "Display Name",
  "description": "What this tests",
  "steps": [
    {
      "id": "step-1",
      "userMessage": "What the user says",
      "expected": {
        "intent": "EXPECTED_INTENT",
        "minConfidence": 85,
        "functions": ["function_name"],
        "maxTimeMs": 5000
      },
      "criteria": [
        "What makes a good response"
      ]
    }
  ],
  "evaluation": {
    "criteria": ["Overall quality checks"]
  }
}
```

## Available Intents

- SERVICE_INQUIRY
- PRODUCT_INQUIRY
- AVAILABILITY_CHECK
- CREATE_BOOKING
- INFO_REQUEST
- HOURS_INQUIRY
- LEAD_SUBMISSION

## Available Functions

- get_services
- get_products
- get_store_info
- check_availability
- create_booking
- submit_lead
- get_misc_data
