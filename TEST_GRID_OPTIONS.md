# Testing Guide for Grid Options Fix

## Prerequisites

1. Ensure you have a valid authentication token
2. Have a survey ID ready
3. Have the category ID for "multi-choice grid" or "checkbox grid"

## Test 1: Create Multi-Choice Grid Question

### Request
```bash
POST /api/questions
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "surveyId": "YOUR_SURVEY_ID",
  "question_type": "TEXT",
  "question_text": "How would you rate the following features?",
  "categoryId": "MULTI_CHOICE_GRID_CATEGORY_ID",
  "rowOptions": [
    { "text": "User Interface" },
    { "text": "Performance" },
    { "text": "Documentation" }
  ],
  "columnOptions": [
    { "text": "Poor" },
    { "text": "Fair" },
    { "text": "Good" },
    { "text": "Excellent" }
  ],
  "order_index": 1,
  "required": true
}
```

### Expected Response
```json
{
  "message": "Question created successfully",
  "question": {
    "id": "...",
    "question_text": "How would you rate the following features?",
    "rowOptions": [
      {
        "id": "...",
        "text": "User Interface",
        "questionId": "...",
        "rowQuestionOptionId": "..."
      },
      {
        "id": "...",
        "text": "Performance",
        "questionId": "...",
        "rowQuestionOptionId": "..."
      },
      {
        "id": "...",
        "text": "Documentation",
        "questionId": "...",
        "rowQuestionOptionId": "..."
      }
    ],
    "columnOptions": [
      {
        "id": "...",
        "text": "Poor",
        "questionId": "...",
        "columnQuestionOptionId": "..."
      },
      {
        "id": "...",
        "text": "Fair",
        "questionId": "...",
        "columnQuestionOptionId": "..."
      },
      {
        "id": "...",
        "text": "Good",
        "questionId": "...",
        "columnQuestionOptionId": "..."
      },
      {
        "id": "...",
        "text": "Excellent",
        "questionId": "...",
        "columnQuestionOptionId": "..."
      }
    ],
    "options": [],
    "category": { ... },
    "mediaAsset": null
  }
}
```

### Verification
- ✅ Response includes `rowOptions` array with 3 items
- ✅ Response includes `columnOptions` array with 4 items
- ✅ Each option has correct `rowQuestionOptionId` or `columnQuestionOptionId`
- ✅ `options` array is empty (grid types don't use it)

## Test 2: Retrieve Grid Question

### Request
```bash
GET /api/questions?id=QUESTION_ID_FROM_TEST_1
Authorization: Bearer YOUR_TOKEN
```

### Expected Response
Same structure as Test 1 response

### Verification
- ✅ `rowOptions` and `columnOptions` are retrieved correctly
- ✅ All option text values match what was saved

## Test 3: Update Grid Question

### Request
```bash
PUT /api/questions/QUESTION_ID_FROM_TEST_1
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "question_type": "TEXT",
  "question_text": "Updated: How would you rate these features?",
  "categoryId": "MULTI_CHOICE_GRID_CATEGORY_ID",
  "rowOptions": [
    { "text": "User Interface" },
    { "text": "Performance" },
    { "text": "Documentation" },
    { "text": "Support" }
  ],
  "columnOptions": [
    { "text": "Very Poor" },
    { "text": "Poor" },
    { "text": "Fair" },
    { "text": "Good" },
    { "text": "Excellent" }
  ],
  "order_index": 1,
  "required": true
}
```

### Expected Response
```json
{
  "message": "Question updated successfully",
  "question": {
    "id": "...",
    "question_text": "Updated: How would you rate these features?",
    "rowOptions": [ /* 4 items now */ ],
    "columnOptions": [ /* 5 items now */ ]
  }
}
```

### Verification
- ✅ Old options are deleted
- ✅ New options are created
- ✅ `rowOptions` now has 4 items (was 3)
- ✅ `columnOptions` now has 5 items (was 4)

## Test 4: Get All Questions for Survey

### Request
```bash
GET /api/questions?surveyId=YOUR_SURVEY_ID
Authorization: Bearer YOUR_TOKEN
```

### Expected Response
```json
[
  {
    "id": "...",
    "question_text": "...",
    "rowOptions": [ ... ],
    "columnOptions": [ ... ],
    "options": [],
    "category": { ... }
  },
  // ... other questions
]
```

### Verification
- ✅ Grid questions include `rowOptions` and `columnOptions`
- ✅ Non-grid questions have empty `rowOptions` and `columnOptions` arrays
- ✅ All questions are returned in correct order

## Test 5: Checkbox Grid Question

Repeat Test 1 but use the "checkbox grid" category ID instead.

### Verification
- ✅ Works exactly the same as multi-choice grid
- ✅ Both types use the same option storage mechanism

## Common Issues to Check

### Issue: rowOptions or columnOptions are empty in response
**Cause**: Category type name doesn't match exactly
**Solution**: Check that category type_name is exactly "multi-choice grid" or "checkbox grid" (case-insensitive)

### Issue: Options saved in wrong relation
**Cause**: Wrong field set in option record
**Solution**: Verify `rowQuestionOptionId` is set for rows, `columnQuestionOptionId` for columns

### Issue: Old options not deleted on update
**Cause**: Delete query not working
**Solution**: Check that `deleteMany` is called before creating new options

## Database Verification

You can verify the data directly in the database:

```sql
-- Check question
SELECT * FROM "Question" WHERE id = 'YOUR_QUESTION_ID';

-- Check row options
SELECT * FROM "Option" 
WHERE "rowQuestionOptionId" = 'YOUR_QUESTION_ID';

-- Check column options
SELECT * FROM "Option" 
WHERE "columnQuestionOptionId" = 'YOUR_QUESTION_ID';

-- Check that regular options are empty for grid questions
SELECT * FROM "Option" 
WHERE "questionId" = 'YOUR_QUESTION_ID' 
  AND "rowQuestionOptionId" IS NULL 
  AND "columnQuestionOptionId" IS NULL;
```

## Console Logs to Monitor

When creating/updating grid questions, you should see these logs:

```
>>>>> Processing GRID type question
>>>>> the value of the ROW OPTIONS is : [...]
>>>>> the value of the COLUMN OPTIONS is : [...]
>>>>> the value of the ROW OPTION RECORDS is : [...]
>>>>> the value of the COLUMN OPTION RECORDS is : [...]
>>>>>> the value of the OPTION RECORDS is : [...]
```

If you don't see these logs, the grid case is not being executed.

